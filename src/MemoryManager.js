import { v4 as uuidv4 } from 'uuid'
import { configureLogging } from './utils/LoggingConfig.js'
import { SPARQL_CONFIG } from '../config/preferences.js'
import Config from '../Config.js'; // Import Config.js to fetch dynamic values
// MIGRATION: Using enhanced SPARQLStore instead of dual MemoryStore + BaseStore architecture
import SPARQLStore from './stores/SPARQLStore.js'
import ContextManager from './ContextManager.js'
import Embeddings from './core/Embeddings.js';
import EmbeddingsAPIBridge from './services/embeddings/EmbeddingsAPIBridge.js';
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
        chatModel = Config.get('chatModel'),
        embeddingModel = Config.get('embeddingModel'),
        storage = null,
        dimension,
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

        if (!dimension) {
            throw new Error('Embedding dimension is required - check config.json embeddingDimension setting')
        }

        // Use llmProvider for embeddings if no separate embeddingProvider is provided
        const embeddingProviderToUse = embeddingProvider || llmProvider;

        // Normalize model names
        this.chatModel = String(chatModel)
        this.embeddingModel = String(embeddingModel)
        this.dimension = dimension

        // Track initialization state
        this._initialized = false;
        this._initialization = null;

        // Initialize components
        this.cacheManager = new CacheManager(cacheOptions)
        // Replace EmbeddingHandler with Embeddings and EmbeddingsAPIBridge
        this.embeddings = new Embeddings(embeddingProviderToUse, this.embeddingModel, dimension, this.cacheManager);
        this.embeddingsAPIBridge = new EmbeddingsAPIBridge(config);

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
        // MIGRATION: Replace dual storage with single enhanced SPARQLStore
        // The new SPARQLStore includes all MemoryStore capabilities (FAISS, graphs, clustering)
        // while providing durable SPARQL persistence
        if (storage && storage instanceof SPARQLStore) {
            // Use provided SPARQLStore instance
            this.store = storage
        } else if (storage && typeof storage === 'object' && storage.endpoint) {
            // Create SPARQLStore from endpoint configuration
            this.store = new SPARQLStore(storage.endpoint, {
                dimension,
                ...storage
            }, config)
        } else {
            throw new Error('MemoryManager now requires a SPARQLStore instance or SPARQL configuration. In-memory and JSON storage are no longer supported.')
        }
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
            // MIGRATION: SPARQLStore now handles both persistence and in-memory operations
            // The enhanced SPARQLStore automatically loads history and builds in-memory structures
            await this.store._ensureMemoryLoaded()

            const shortTermCount = this.store.shortTermMemory?.length || 0
            const longTermCount = this.store.longTermMemory?.length || 0

            this.logger.info(`Enhanced SPARQLStore loaded: ${shortTermCount} short-term, ${longTermCount} long-term memories`)
            this.logger.info(`In-memory structures: FAISS index, concept graph, and semantic clustering initialized`)

            this._initialized = true;
            return this;
        } catch (error) {
            this.logger.error('Enhanced SPARQLStore initialization failed:', error)
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
                embedding: this.embeddings.standardizeEmbedding(embedding, this.dimension),
                timestamp: metadata.timestamp || Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0,
                ...metadata
            }

            // Step 2: Store with enhanced SPARQLStore (handles both persistence and memory)
            opLogger.step(
                'store_interaction',
                '🧠 Storing in enhanced SPARQLStore with in-memory capabilities',
                `[MemoryManager] store.store() - unified storage with FAISS indexing`,
                {
                    currentMemorySize: this.store.shortTermMemory?.length || 0,
                    interactionId: interaction.id,
                    storageType: 'Enhanced SPARQLStore'
                }
            );

            // MIGRATION: Enhanced SPARQLStore handles both SPARQL persistence and in-memory structures
            // This single call updates FAISS index, concept graph, clustering, and SPARQL store
            this.logger.info('🔥 DEBUG: About to call store.store()', {
                interactionId: interaction.id,
                promptPreview: interaction.prompt?.substring(0, 50),
                hasEmbedding: !!interaction.embedding
            });
            await this.store.store(interaction)

            opLogger.complete(
                'Interaction stored successfully in enhanced SPARQLStore',
                {
                    interactionId: interaction.id,
                    embeddingDimensions: embedding?.length || 0,
                    conceptsStored: concepts?.length || 0,
                    totalMemories: this.store.shortTermMemory?.length || 0,
                    storageBackend: 'Enhanced SPARQLStore'
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

    async retrieveRelevantInteractions(query, similarityThreshold = SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD, excludeLastN = 0, limit = null) {
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
                memoryStoreSize: this.store?.shortTermMemory?.length || 0
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);

        try {
            // Step 1: Generate query embedding
            const embeddingStartTime = Date.now();
            opLogger.step(
                'generate_embedding',
                '🎯 Generating query embedding',
                '[MemoryManager] embeddingHandler.generateEmbedding() - creating vector representation'
            );

            const queryEmbedding = await this.embeddingsAPIBridge.generateEmbedding(query);
            const embeddingDuration = Date.now() - embeddingStartTime;
            this.logger.info(`⏱️ [SEARCH-TIMING] Embedding generation took ${embeddingDuration}ms`);

            opLogger.step(
                'embedding_generated',
                `✅ Generated ${queryEmbedding?.length || 0}D embedding vector`,
                `[MemoryManager] Embedding generated - dimensions: ${queryEmbedding?.length || 'unknown'}`,
                { embeddingDimensions: queryEmbedding?.length || 0 }
            );

            // Step 2: Extract query concepts (if LLM available)
            let queryConcepts = [];
            if (this.llmHandler) {
                const conceptsStartTime = Date.now();
                opLogger.step(
                    'extract_concepts',
                    '💡 Extracting query concepts',
                    '[MemoryManager] llmHandler.extractConcepts() - identifying key concepts'
                );

                queryConcepts = await this.llmHandler.extractConcepts(query);
                const conceptsDuration = Date.now() - conceptsStartTime;
                this.logger.info(`⏱️ [SEARCH-TIMING] Concept extraction took ${conceptsDuration}ms`);

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

            // Step 3: Search with enhanced SPARQLStore (unified in-memory + SPARQL search)
            opLogger.step(
                'search_enhanced_store',
                '🎆 Searching enhanced SPARQLStore (in-memory + persistent)',
                `[MemoryManager] store.retrieve() - unified search with FAISS indexing and SPARQL fallback`,
                {
                    memoryStoreSize: this.store?.shortTermMemory?.length || 0,
                    hasConceptGraph: this.store?.graph?.nodes()?.length > 0,
                    hasFAISSIndex: this.store?.index?.ntotal() > 0
                }
            );

            // MIGRATION: Enhanced SPARQLStore combines in-memory (FAISS, concept graph, clustering)
            // with SPARQL persistence in a single retrieve call
            const searchStartTime = Date.now();
            const enhancedResults = await this.store.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);
            const searchDuration = Date.now() - searchStartTime;
            this.logger.info(`⏱️ [SEARCH-TIMING] Store.retrieve took ${searchDuration}ms`);

            opLogger.step(
                'enhanced_results_found',
                `📥 Found ${enhancedResults.length} results from enhanced search`,
                `[MemoryManager] Enhanced SPARQLStore search completed - ${enhancedResults.length} results found`,
                {
                    enhancedResultCount: enhancedResults.length,
                    searchMethod: 'Unified FAISS + SPARQL'
                }
            );

            // Step 4: Enhanced SPARQLStore already handles deduplication and sorting
            // The unified search automatically combines FAISS, concept graph activation,
            // and SPARQL results with intelligent deduplication

            opLogger.step(
                'results_processed',
                `📊 Enhanced search results already optimized`,
                `[MemoryManager] Enhanced SPARQLStore provides pre-sorted, deduplicated results`,
                {
                    resultCount: enhancedResults.length,
                    topSimilarities: enhancedResults.slice(0, 3).map(r => r.similarity?.toFixed(3) || 'N/A'),
                    searchFeatures: ['FAISS similarity', 'Concept activation', 'Memory classification', 'Semantic clustering']
                }
            );

            const uniqueResults = enhancedResults; // Already processed by enhanced store

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
                `Found ${finalResults.length} relevant memories from enhanced store`,
                {
                    totalResults: finalResults.length,
                    searchBackend: 'Enhanced SPARQLStore',
                    features: ['FAISS indexing', 'Concept graph', 'SPARQL persistence'],
                    topSimilarities: finalResults.slice(0, 3).map(r => r.similarity?.toFixed(3) || 'N/A'),
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
        return await this.embeddingsAPIBridge.generateEmbedding(text)
    }

    async extractConcepts(text) {
        if (!this.llmHandler) {
            this.logger.debug('No chat provider available for concept extraction')
            return []
        }
        return await this.llmHandler.extractConcepts(text)
    }

    async storeInteraction(prompt, response, metadata = {}) {
        this.logger.debug('🔥 DEBUG: MemoryManager.storeInteraction called with:', {
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
            await this.store.store(documentData);

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
        this.logger.info('🔥 DEBUG: About to call addInteraction', {
            promptPreview: prompt?.substring(0, 50),
            responsePreview: response?.substring(0, 50),
            embeddingLength: embedding?.length,
            conceptsCount: concepts?.length
        });
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
            // MIGRATION: Enhanced SPARQLStore handles its own cleanup and persistence
            // The cleanup() method persists FAISS indexes, concept graphs, and memory state
            if (this.store && typeof this.store.cleanup === 'function') {
                await this.store.cleanup()
            }
        } catch (e) {
            // Handle errors gracefully during disposal
            if (e.code === 'CONTENT_TOO_LARGE' || e.message.includes('string length')) {
                this.logger.warn('Skipping enhanced store cleanup during disposal due to oversized content', {
                    error: e.message
                });
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

        // Clear references - no more separate memStore
        this.store = null

        // If there were any errors, throw after cleanup
        if (error) throw error
    }
}