import { v4 as uuidv4 } from 'uuid'
import { configureLogging } from './utils/LoggingConfig.js'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import EmbeddingHandler from './handlers/EmbeddingHandler.js'
import CacheManager from './handlers/CacheManager.js'
import LLMHandler from './handlers/LLMHandler.js'
import { WorkflowLogger, workflowLoggerRegistry } from './utils/WorkflowLogger.js'

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
        config = null,
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
        this.workflowLogger = new WorkflowLogger('MemoryManager');
        workflowLoggerRegistry.register('MemoryManager', this.workflowLogger);
        
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
        this.memStore = new MemoryStore(dimension, config)
        this.store = storage || new InMemoryStore()
        this.config = config
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
        // Start workflow tracking for memory persistence
        const operationId = this.workflowLogger.startOperation(
            null,
            'memory',
            'Storing interaction in knowledge graph',
            {
                promptLength: prompt?.length || 0,
                outputLength: output?.length || 0,
                embeddingDimensions: embedding?.length || 0,
                conceptsCount: concepts?.length || 0,
                conversationId: metadata.conversationId
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);

        try {
            // Step 1: Create structured interaction object
            opLogger.step(
                'create_interaction',
                '📋 Creating interaction object',
                `[MemoryManager] Structuring interaction with ID: ${metadata.id || 'auto-generated'}`,
                { interactionId: metadata.id }
            );

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

            // Step 2: Add to in-memory store
            opLogger.step(
                'add_to_memory',
                '🧠 Adding to short-term memory store',
                `[MemoryManager] Adding interaction to memStore - current size: ${this.memStore.shortTermMemory.length}`,
                { 
                    currentMemorySize: this.memStore.shortTermMemory.length,
                    interactionId: interaction.id
                }
            );

            this.memStore.shortTermMemory.push(interaction)
            this.memStore.embeddings.push(interaction.embedding)
            this.memStore.timestamps.push(interaction.timestamp)
            this.memStore.accessCounts.push(interaction.accessCount)
            this.memStore.conceptsList.push(interaction.concepts)

            // Step 3: Persist to storage backend
            opLogger.step(
                'persist_to_storage',
                '💾 Persisting to SPARQL knowledge graph',
                `[MemoryManager] store.saveMemoryToHistory() - persisting ${this.memStore.shortTermMemory.length} interactions`,
                { 
                    storageType: this.store.constructor.name,
                    totalInteractions: this.memStore.shortTermMemory.length
                }
            );

            await this.store.saveMemoryToHistory(this.memStore)

            opLogger.complete(
                'Interaction stored successfully in knowledge graph',
                {
                    interactionId: interaction.id,
                    embeddingDimensions: embedding?.length || 0,
                    conceptsStored: concepts?.length || 0,
                    totalMemories: this.memStore.shortTermMemory.length
                }
            );

            this.logger.info('Interaction added successfully')
        } catch (error) {
            opLogger.fail(error, {
                promptLength: prompt?.length || 0,
                outputLength: output?.length || 0,
                embeddingLength: embedding?.length || 0,
                conceptsCount: concepts?.length || 0
            });

            this.logger.error('Failed to add interaction:', error)
            throw error
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0, limit = null) {
        // Start workflow tracking for memory retrieval
        const operationId = this.workflowLogger.startOperation(
            null,
            'search',
            'Searching for relevant memories',
            {
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                similarityThreshold,
                excludeLastN,
                limit,
                memoryStoreSize: this.memStore?.shortTermMemory?.length || 0
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);
        
        try {
            // Step 1: Generate query embedding
            opLogger.step(
                'generate_embedding',
                '🎯 Generating query embedding',
                '[MemoryManager] embeddingHandler.generateEmbedding() - creating vector representation'
            );
            
            const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
            
            opLogger.step(
                'embedding_generated',
                `✅ Generated ${queryEmbedding?.length || 0}D embedding vector`,
                `[MemoryManager] Embedding generated - dimensions: ${queryEmbedding?.length || 'unknown'}`,
                { embeddingDimensions: queryEmbedding?.length || 0 }
            );
            
            // Step 2: Extract query concepts (if LLM available)
            let queryConcepts = [];
            if (this.llmHandler) {
                opLogger.step(
                    'extract_concepts',
                    '💡 Extracting query concepts',
                    '[MemoryManager] llmHandler.extractConcepts() - identifying key concepts'
                );
                
                queryConcepts = await this.llmHandler.extractConcepts(query);
                
                opLogger.step(
                    'concepts_extracted',
                    `🔍 Extracted ${queryConcepts.length} concepts`,
                    `[MemoryManager] Concepts extracted: ${queryConcepts.join(', ')}`,
                    { conceptCount: queryConcepts.length, concepts: queryConcepts }
                );
            } else {
                opLogger.step(
                    'skip_concepts',
                    '⚡ Skipping concept extraction (no LLM available)',
                    '[MemoryManager] No chat provider available for concept extraction - using embedding-only search'
                );
            }
            
            // Step 3: Search memory store
            opLogger.step(
                'search_memory_store',
                '🧠 Searching in-memory store',
                `[MemoryManager] memStore.retrieve() - searching ${this.memStore?.shortTermMemory?.length || 0} memories`,
                { memoryStoreSize: this.memStore?.shortTermMemory?.length || 0 }
            );
            
            const memStoreResults = await this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);

            // Step 4: Search SPARQL store
            let sparqlResults = [];
            if (this.store && typeof this.store.search === 'function') {
                opLogger.step(
                    'search_sparql_store',
                    '🗃️ Searching SPARQL knowledge graph',
                    `[MemoryManager] store.search() - searching persistent knowledge graph with ${this.store.constructor.name}`,
                    { storageType: this.store.constructor.name }
                );
                
                try {
                    const threshold = similarityThreshold > 1 ? similarityThreshold / 100 : similarityThreshold;
                    const searchLimit = limit || 10;
                    
                    sparqlResults = await this.store.search(queryEmbedding, searchLimit, threshold);
                    
                    opLogger.step(
                        'sparql_results_found',
                        `📥 Found ${sparqlResults.length} results in knowledge graph`,
                        `[MemoryManager] SPARQL search completed - ${sparqlResults.length} results found`,
                        { sparqlResultCount: sparqlResults.length }
                    );
                } catch (error) {
                    opLogger.step(
                        'sparql_search_failed',
                        `⚠️ SPARQL search failed: ${error.message}`,
                        `[MemoryManager] SPARQL store search failed: ${error.message}`,
                        { error: error.message }
                    );
                }
            } else {
                opLogger.step(
                    'skip_sparql_search',
                    '⚡ Skipping SPARQL search (not available)',
                    '[MemoryManager] SPARQL store not available or search method missing'
                );
            }
            
            // Step 5: Combine and deduplicate results
            opLogger.step(
                'combine_results',
                `🔄 Combining results (${memStoreResults.length} + ${sparqlResults.length})`,
                `[MemoryManager] Combining ${memStoreResults.length} memory results with ${sparqlResults.length} SPARQL results`,
                { memoryResults: memStoreResults.length, sparqlResults: sparqlResults.length }
            );
            
            const combinedResults = [...memStoreResults, ...sparqlResults];
            
            // Remove duplicates based on content similarity
            const uniqueResults = [];
            const seenContent = new Set();
            
            for (const result of combinedResults) {
                const contentKey = (result.prompt + result.response).substring(0, 100);
                if (!seenContent.has(contentKey)) {
                    seenContent.add(contentKey);
                    uniqueResults.push(result);
                }
            }
            
            // Step 6: Sort by similarity score
            uniqueResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            
            opLogger.step(
                'deduplicated',
                `📊 Deduplicated to ${uniqueResults.length} unique results`,
                `[MemoryManager] After deduplication: ${uniqueResults.length} unique results, sorted by similarity`,
                { 
                    uniqueResults: uniqueResults.length,
                    duplicatesRemoved: combinedResults.length - uniqueResults.length,
                    topSimilarities: uniqueResults.slice(0, 3).map(r => r.similarity?.toFixed(3))
                }
            );
            
            // Step 7: Apply limit if specified
            let finalResults = uniqueResults;
            if (limit && typeof limit === 'number' && limit > 0) {
                finalResults = uniqueResults.slice(0, limit);
                
                opLogger.step(
                    'apply_limit',
                    `✂️ Applied limit: ${finalResults.length}/${uniqueResults.length} results`,
                    `[MemoryManager] Applied result limit - returning ${finalResults.length} of ${uniqueResults.length} results`,
                    { limit, totalResults: uniqueResults.length, returnedResults: finalResults.length }
                );
            }

            // Complete operation successfully
            opLogger.complete(
                `Found ${finalResults.length} relevant memories`,
                {
                    totalResults: finalResults.length,
                    memoryStoreResults: memStoreResults.length,
                    sparqlStoreResults: sparqlResults.length,
                    topSimilarities: finalResults.slice(0, 3).map(r => r.similarity?.toFixed(3)),
                    queryEmbeddingDims: queryEmbedding?.length || 0,
                    conceptsUsed: queryConcepts.length
                }
            );

            return finalResults;
            
        } catch (error) {
            opLogger.fail(error, {
                query: query.substring(0, 100),
                similarityThreshold,
                excludeLastN,
                limit
            });
            
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
        console.log('🔥 DEBUG: MemoryManager.storeInteraction called with:', {
            promptLength: prompt?.length || 0,
            responseLength: response?.length || 0,
            metadataKeys: Object.keys(metadata || {})
        });
        const combinedText = `${prompt} ${response}`;
        const MEMORY_CONTENT_LIMIT = 5000; // Conservative limit for in-memory processing
        
        // Check if content is too large for memory processing
        if (combinedText.length > MEMORY_CONTENT_LIMIT) {
            this.logger.warn('Content too large for memory processing, storing directly to SPARQL without embeddings', {
                combinedLength: combinedText.length,
                limit: MEMORY_CONTENT_LIMIT,
                suggestion: 'Use Augment → Chunk Documents to process this content for semantic search'
            });
            
            // Store directly to SPARQL as a document without embeddings
            const documentData = {
                id: `interaction_${Date.now()}`,
                prompt: prompt,
                response: response,
                timestamp: Date.now(),
                metadata: {
                    ...metadata,
                    contentTooLarge: true,
                    originalLength: combinedText.length,
                    processingSkipped: 'content_too_large'
                }
            };
            
            // Store to SPARQL as Ragno document without memory processing
            await this.store.storeDocument(documentData);
            
            return {
                success: true,
                deferred: true,
                reason: 'content_too_large',
                storedAs: 'document',
                concepts: 0,
                timestamp: Date.now(),
                suggestion: 'Use Augment → Chunk Documents to enable semantic search'
            };
        }
        
        // Generate embedding for the combined prompt and response
        const embedding = await this.generateEmbedding(combinedText);
        
        // Extract concepts from the combined text (returns empty array if no chat provider)
        const concepts = await this.extractConcepts(combinedText);
        
        // Store the interaction using addInteraction
        await this.addInteraction(prompt, response, embedding, concepts, metadata);
        
        return {
            success: true,
            concepts: concepts.length,
            timestamp: Date.now()
        };
    }

    async dispose() {
        let error = null
        try {
            // Save current state before disposal
            await this.store.saveMemoryToHistory(this.memStore)
        } catch (e) {
            // Handle large content errors gracefully during disposal
            if (e.code === 'CONTENT_TOO_LARGE' || e.message.includes('string length')) {
                this.logger.warn('Skipping memory persistence during disposal due to oversized content', {
                    error: e.message
                });
                // Don't treat this as a fatal error during disposal
            } else {
                error = e;
            }
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