import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Memory API handler for managing semantic memory operations
 */
export default class MemoryAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.memoryManager = null;
        this.similarityThreshold = config.similarityThreshold || 40;
        this.defaultLimit = config.defaultLimit || 10;
    }

    async initialize() {
        await super.initialize();
        
        // Get dependency from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for MemoryAPI');
        }
        
        try {
            this.memoryManager = registry.get('memory');
            this.logger.info('MemoryAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize MemoryAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a memory operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        
        try {
            let result;
            
            switch (operation) {
                case 'store':
                    result = await this.storeInteraction(params);
                    break;
                case 'search':
                    result = await this.retrieveInteractions(params);
                    break;
                case 'embedding':
                    result = await this.generateEmbedding(params);
                    break;
                case 'concepts':
                    result = await this.extractConcepts(params);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            this._emitMetric(`operation.${operation}.duration`, duration);
            this._emitMetric(`operation.${operation}.count`, 1);
            
            return result;
        } catch (error) {
            this._emitMetric(`operation.${operation}.errors`, 1);
            throw error;
        }
    }

    /**
     * Store an interaction in memory
     */
    async storeInteraction({ prompt, response, metadata = {} }) {
        if (!prompt || !response) {
            throw new Error('Prompt and response are required');
        }

        try {
            // Generate embedding
            const embedding = await this.memoryManager.generateEmbedding(
                `${prompt} ${response}`
            );
            
            // Extract concepts
            const concepts = await this.memoryManager.extractConcepts(
                `${prompt} ${response}`
            );
            
            // Add interaction to memory
            const id = uuidv4();
            await this.memoryManager.addInteraction(
                prompt, 
                response, 
                embedding, 
                concepts,
                {
                    id,
                    timestamp: Date.now(),
                    ...metadata
                }
            );
            
            this._emitMetric('memory.store.count', 1);
            return { 
                id, 
                concepts, 
                timestamp: Date.now(),
                success: true 
            };
        } catch (error) {
            this._emitMetric('memory.store.errors', 1);
            throw error;
        }
    }

    /**
     * Retrieve interactions from memory
     */
    async retrieveInteractions(params) {
        this.logger.info('retrieveInteractions called with params:', params);
        
        const { query, threshold, limit = this.defaultLimit } = params || {};
        
        if (!query) {
            throw new Error('Query is required');
        }

        try {
            const similarityThreshold = threshold || this.similarityThreshold;
            
            // Debug: Check if memory manager is available
            if (!this.memoryManager) {
                throw new Error('Memory manager not initialized');
            }
            
            this.logger.info('Starting search with params:', {
                query,
                similarityThreshold,
                limit
            });
            
            const results = await this.memoryManager.retrieveRelevantInteractions(
                query,
                similarityThreshold,
                0, // excludeLastN
                limit // limit
            );
            
            this.logger.info('Search results received:', {
                resultsType: typeof results,
                resultsLength: Array.isArray(results) ? results.length : 'not array',
                firstResult: results?.[0] ? Object.keys(results[0]) : 'no first result'
            });
            
            // Format the results according to API schema
            // Note: MemoryManager returns results with similarity field
            const formattedResults = results.map(item => ({
                id: item.id,
                prompt: item.prompt,
                output: item.output,
                concepts: item.concepts,
                timestamp: item.timestamp,
                accessCount: item.accessCount,
                similarity: item.similarity || 0
            }));
            
            this._emitMetric('memory.search.count', 1);
            return { 
                results: formattedResults, 
                count: formattedResults.length 
            };
        } catch (error) {
            this._emitMetric('memory.search.errors', 1);
            this.logger.error('Search error details:', {
                message: error.message,
                stack: error.stack,
                query,
                threshold: similarityThreshold,
                limit
            });
            throw error;
        }
    }

    /**
     * Generate embedding for text
     */
    async generateEmbedding({ text, model }) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const embedding = await this.memoryManager.generateEmbedding(text, model);
            
            this._emitMetric('memory.embedding.count', 1);
            return { 
                embedding, 
                model: model || 'default',
                dimension: embedding.length
            };
        } catch (error) {
            this._emitMetric('memory.embedding.errors', 1);
            throw error;
        }
    }

    /**
     * Extract concepts from text
     */
    async extractConcepts({ text }) {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const concepts = await this.memoryManager.extractConcepts(text);
            
            this._emitMetric('memory.concepts.count', 1);
            return { 
                concepts, 
                text
            };
        } catch (error) {
            this._emitMetric('memory.concepts.errors', 1);
            throw error;
        }
    }

    /**
     * Get memory API metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();
        
        return {
            ...baseMetrics,
            operations: {
                store: {
                    count: await this._getMetricValue('memory.store.count'),
                    errors: await this._getMetricValue('memory.store.errors')
                },
                search: {
                    count: await this._getMetricValue('memory.search.count'),
                    errors: await this._getMetricValue('memory.search.errors')
                },
                embedding: {
                    count: await this._getMetricValue('memory.embedding.count'),
                    errors: await this._getMetricValue('memory.embedding.errors')
                },
                concepts: {
                    count: await this._getMetricValue('memory.concepts.count'),
                    errors: await this._getMetricValue('memory.concepts.errors')
                }
            }
        };
    }

    async _getMetricValue(metricName) {
        // In a real implementation, this would fetch from a metrics store
        return 0;
    }
}