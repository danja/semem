# Storage Integration Patterns

## Memory Manager Integration

```javascript
export default class MemoryManager {
    constructor(config) {
        // Initialize appropriate store based on config
        this.store = this.initializeStore(config.storage)
        this.llmHandler = new LLMHandler(config.models)
        this.contextManager = new ContextManager(config.context)
    }

    initializeStore(config) {
        switch (config.type) {
            case 'sparql':
                return new SPARQLStore(config.options)
            case 'cached-sparql':
                return new CachedSPARQLStore(config.options)
            case 'json':
                return new JSONStore(config.options)
            default:
                return new InMemoryStore(config.options)
        }
    }

    async addInteraction(prompt, output, embedding, concepts) {
        // Use transaction for atomic operations
        await this.store.beginTransaction()
        try {
            const interaction = {
                id: uuidv4(),
                prompt,
                output,
                embedding,
                timestamp: Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0
            }

            await this.store.saveMemoryToHistory({
                shortTermMemory: [...this.store.shortTermMemory, interaction],
                longTermMemory: this.store.longTermMemory
            })

            await this.store.commitTransaction()
            return interaction
        } catch (error) {
            await this.store.rollbackTransaction()
            throw error
        }
    }
}
```

## Active Handler Integration

```javascript
export default class ActiveHandler extends BaseAPI {
    async handleInteraction({ prompt, context = [] }) {
        const memoryManager = this.registry.get('memory')
        
        try {
            // Get relevant past interactions
            const retrievals = await memoryManager.retrieveRelevantInteractions(
                prompt,
                this.similarityThreshold
            )

            // Generate response
            const response = await this.llmHandler.generateResponse(
                prompt,
                this._buildContext(context, retrievals)
            )

            // Store with embeddings
            const embedding = await memoryManager.generateEmbedding(
                `${prompt} ${response}`
            )
            const concepts = await memoryManager.extractConcepts(
                `${prompt} ${response}`
            )

            await memoryManager.addInteraction(
                prompt, 
                response, 
                embedding, 
                concepts
            )

            return { response, concepts, retrievals }
        } catch (error) {
            this._emitMetric('interaction.errors', 1)
            throw error
        }
    }
}
```

## SPARQL Store Transaction Pattern

```javascript
export default class SPARQLStore extends BaseStore {
    async saveMemoryToHistory(memoryStore) {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress')
        }

        try {
            await this.beginTransaction()
            
            // Backup current graph
            const backupQuery = `
                COPY GRAPH <${this.graphName}> 
                TO GRAPH <${this.graphName}.backup>
            `
            await this._executeSparqlUpdate(backupQuery)

            // Clear and update main graph
            const clearQuery = `CLEAR GRAPH <${this.graphName}>`
            await this._executeSparqlUpdate(clearQuery)

            const insertQuery = this._generateInsertStatements(
                memoryStore.shortTermMemory,
                memoryStore.longTermMemory
            )
            await this._executeSparqlUpdate(insertQuery)

            await this.commitTransaction()
        } catch (error) {
            await this.rollbackTransaction()
            throw error
        }
    }
}
```

## Cache Integration Pattern

```javascript
export default class CachedSPARQLStore extends SPARQLStore {
    async _executeSparqlQuery(query, endpoint) {
        const cacheKey = this._generateCacheKey(query)
        
        // Check cache
        const cachedResult = this.queryCache.get(cacheKey)
        if (cachedResult) {
            const timestamp = this.cacheTimestamps.get(cacheKey)
            if (Date.now() - timestamp < this.cacheTTL) {
                return JSON.parse(JSON.stringify(cachedResult))
            }
        }

        // Cache miss - execute query
        const result = await super._executeSparqlQuery(query, endpoint)
        
        // Update cache
        this.queryCache.set(cacheKey, result)
        this.cacheTimestamps.set(cacheKey, Date.now())
        
        // Cleanup if needed
        if (this.queryCache.size > this.maxCacheSize) {
            this.cleanupCache()
        }

        return result
    }
}
```

## Error Handling Pattern

```javascript
export default class BaseStore {
    async executeWithRetry(operation, maxRetries = 3) {
        let lastError
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error
                
                if (!this.isRetryableError(error)) {
                    throw error
                }

                await new Promise(resolve => 
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                )
            }
        }

        throw lastError
    }

    isRetryableError(error) {
        return error.code === 'ECONNRESET' ||
               error.code === 'ETIMEDOUT' ||
               error.message.includes('deadlock') ||
               error.message.includes('timeout')
    }
}
```