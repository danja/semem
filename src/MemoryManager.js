import { v4 as uuidv4 } from 'uuid'
import { configureLogging } from './utils/LoggingConfig.js'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import EmbeddingHandler from './handlers/EmbeddingHandler.js'
import CacheManager from './handlers/CacheManager.js'
import LLMHandler from './handlers/LLMHandler.js'

/**
 * Manages semantic memory operations, embeddings, and LLM interactions
 */
export default class MemoryManager {
    constructor({
        llmProvider,
        embeddingProvider = null,
        chatModel = 'qwen2:1.5b',
        embeddingModel = 'nomic-embed-text',
        storage = null,
        dimension = 1536,
        contextOptions = {
            maxTokens: 8192
        },
        cacheOptions = {
            maxSize: 1000,
            ttl: 3600000
        }
    }) {
        // Initialize logging for MemoryManager
        this.logger = configureLogging('memory-manager');
        
        if (!llmProvider) {
            throw new Error('LLM provider is required')
        }

        // Use llmProvider for embeddings if no separate embeddingProvider is provided
        const embeddingProviderToUse = embeddingProvider || llmProvider;

        // Normalize model names
        this.chatModel = String(chatModel)
        this.embeddingModel = String(embeddingModel)

        // Track initialization state
        this._initialized = false;
        this._initialization = null;

        // Initialize components
        this.cacheManager = new CacheManager(cacheOptions)
        this.embeddingHandler = new EmbeddingHandler(
            embeddingProviderToUse,
            this.embeddingModel,
            dimension,
            this.cacheManager
        )

        // Only initialize LLMHandler if the provider supports chat operations
        // Check if the provider has working chat capabilities by checking provider info
        let hasChatCapability = false;
        
        if (llmProvider && llmProvider.getInfo) {
            const providerInfo = llmProvider.getInfo();
            hasChatCapability = providerInfo.capabilities && providerInfo.capabilities.includes('chat');
        } else if (llmProvider) {
            // Fallback: check if provider has chat methods and doesn't throw on basic test
            hasChatCapability = (
                typeof llmProvider.generateChat === 'function' || 
                typeof llmProvider.chat === 'function' ||  // Support hyperdata-clients interface
                (typeof llmProvider.generateCompletion === 'function' && 
                 llmProvider.constructor.name !== 'NomicConnector')  // Explicitly exclude NomicConnector
            );
        }
        
        if (hasChatCapability) {
            this.llmHandler = new LLMHandler(llmProvider, this.chatModel)
        } else {
            this.logger.warn('Provider does not support chat operations - LLM functionality will be limited')
            this.llmHandler = null
        }
        this.memStore = new MemoryStore(dimension)
        this.store = storage || new InMemoryStore()
        this.contextManager = new ContextManager(contextOptions)

        // Start initialization but don't wait for it here
        this._initialization = this.initialize().catch(error => {
            this.logger.error('Failed to initialize MemoryManager:', error);
            // Re-throw the error to ensure it's not silently swallowed
            throw error;
        });
    }

    /**
     * Wait for the MemoryManager to be fully initialized
     * @returns {Promise<void>}
     */
    async ensureInitialized() {
        if (this._initialized) {
            return;
        }
        if (this._initialization) {
            await this._initialization;
        } else {
            await this.initialize();
        }
    }

    async initialize() {
        if (this._initialized) {
            return;
        }

        try {
            const [shortTerm, longTerm] = await this.store.loadHistory()
            this.logger.info(`Loading memory history: ${shortTerm.length} short-term, ${longTerm.length} long-term items`)

            for (const interaction of shortTerm) {
                const embedding = this.embeddingHandler.standardizeEmbedding(interaction.embedding)
                interaction.embedding = embedding
                this.memStore.shortTermMemory.push(interaction)
                this.memStore.embeddings.push(embedding)
                this.memStore.timestamps.push(interaction.timestamp)
                this.memStore.accessCounts.push(interaction.accessCount)
                this.memStore.conceptsList.push(interaction.concepts)
            }

            this.memStore.longTermMemory.push(...longTerm)
            this.memStore.clusterInteractions()
            this.logger.info('Memory initialization complete')
            this._initialized = true;
            return this;
        } catch (error) {
            this.logger.error('Memory initialization failed:', error)
            this._initialized = false;
            throw error
        }
    }

    async addInteraction(prompt, output, embedding, concepts, metadata = {}) {
        try {
            const interaction = {
                id: metadata.id || uuidv4(),
                prompt,
                output,
                embedding: this.embeddingHandler.standardizeEmbedding(embedding),
                timestamp: metadata.timestamp || Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0,
                ...metadata
            }

            this.memStore.shortTermMemory.push(interaction)
            this.memStore.embeddings.push(interaction.embedding)
            this.memStore.timestamps.push(interaction.timestamp)
            this.memStore.accessCounts.push(interaction.accessCount)
            this.memStore.conceptsList.push(interaction.concepts)

            await this.store.saveMemoryToHistory(this.memStore)
            this.logger.info('Interaction added successfully')
        } catch (error) {
            this.logger.error('Failed to add interaction:', error)
            throw error
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0, limit = null) {
        this.logger.info('MemoryManager.retrieveRelevantInteractions called with:', {
            query,
            similarityThreshold,
            excludeLastN,
            limit,
            hasMemStore: !!this.memStore,
            memStoreMemoryLength: this.memStore?.shortTermMemory?.length || 0
        });
        
        try {
            this.logger.info('Generating embedding for query...');
            const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
            this.logger.info('Embedding generated successfully, dimensions:', queryEmbedding?.length || 'unknown');
            
            let queryConcepts = [];
            
            // Only extract concepts if we have a chat-capable LLM handler
            if (this.llmHandler) {
                this.logger.info('Extracting concepts using LLM handler...');
                queryConcepts = await this.llmHandler.extractConcepts(query);
                this.logger.info('Concepts extracted:', queryConcepts);
            } else {
                this.logger.debug('No chat provider available for concept extraction - using embedding-only search');
            }
            
            this.logger.info('Calling memStore.retrieve with params:', {
                queryEmbeddingLength: queryEmbedding?.length || 0,
                queryConceptsLength: queryConcepts?.length || 0,
                similarityThreshold,
                excludeLastN
            });
            
            const results = await this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);
            
            this.logger.info('MemStore.retrieve returned:', {
                resultsType: typeof results,
                resultsLength: Array.isArray(results) ? results.length : 'not array',
                firstResultKeys: results?.[0] ? Object.keys(results[0]) : 'no first result'
            });
            
            // Apply limit if specified
            if (limit && typeof limit === 'number' && limit > 0) {
                const limitedResults = results.slice(0, limit);
                this.logger.info(`Applied limit ${limit}, final result count: ${limitedResults.length}`);
                return limitedResults;
            }
            
            this.logger.info(`Returning ${results?.length || 0} results`);
            return results;
        } catch (error) {
            this.logger.error('Failed to retrieve interactions:', {
                message: error.message,
                stack: error.stack,
                query,
                similarityThreshold
            });
            throw error;
        }
    }

    async generateResponse(prompt, lastInteractions = [], retrievals = [], contextWindow = 3) {
        try {
            if (!this.llmHandler) {
                throw new Error('No chat provider available for response generation')
            }
            
            const context = this.contextManager.buildContext(
                prompt,
                retrievals,
                lastInteractions,
                { systemContext: "You're a helpful assistant with memory of past interactions." }
            )

            return await this.llmHandler.generateResponse(prompt, context)
        } catch (error) {
            this.logger.error('Error generating response:', error)
            throw error
        }
    }

    async generateEmbedding(text) {
        return await this.embeddingHandler.generateEmbedding(text)
    }

    async extractConcepts(text) {
        if (!this.llmHandler) {
            this.logger.debug('No chat provider available for concept extraction')
            return []
        }
        return await this.llmHandler.extractConcepts(text)
    }

    async storeInteraction(prompt, response, metadata = {}) {
        // Generate embedding for the combined prompt and response
        const embedding = await this.generateEmbedding(`${prompt} ${response}`)
        
        // Extract concepts from the combined text (returns empty array if no chat provider)
        const concepts = await this.extractConcepts(`${prompt} ${response}`)
        
        // Store the interaction using addInteraction
        await this.addInteraction(prompt, response, embedding, concepts, metadata)
        
        return {
            success: true,
            concepts: concepts.length,
            timestamp: Date.now()
        }
    }

    async dispose() {
        let error = null
        try {
            // Save current state before disposal
            await this.store.saveMemoryToHistory(this.memStore)
        } catch (e) {
            error = e
        }

        try {
            // Clean up resources
            this.cacheManager.dispose()
            if (this.store?.close) {
                await this.store.close()
            }
        } catch (e) {
            if (!error) error = e
        }

        // Clear references
        this.memStore = null

        // If there were any errors, throw after cleanup
        if (error) throw error
    }
}