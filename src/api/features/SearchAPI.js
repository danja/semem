import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Search API handler for semantic search capabilities
 */
export default class SearchAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.memoryManager = null;
        this.searchService = null;
        this.similarityThreshold = config.similarityThreshold || 0.7;
        this.defaultLimit = config.defaultLimit || 5;
    }

    async initialize() {
        await super.initialize();
        
        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for SearchAPI');
        }
        
        try {
            this.memoryManager = registry.get('memory');
            
            // SearchService is optional, try to get it if available
            try {
                this.searchService = registry.get('search');
            } catch (error) {
                this.logger.warn('Search service not available, using memory manager for search');
            }
            
            this.logger.info('SearchAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize SearchAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a search operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        
        try {
            let result;
            
            switch (operation) {
                case 'search':
                    result = await this.searchContent(params);
                    break;
                case 'index':
                    result = await this.indexContent(params);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            this._emitMetric(`search.${operation}.duration`, duration);
            this._emitMetric(`search.${operation}.count`, 1);
            
            return result;
        } catch (error) {
            this._emitMetric(`search.${operation}.errors`, 1);
            throw error;
        }
    }

    /**
     * Search content using semantic similarity
     */
    async searchContent({ query, limit = this.defaultLimit, types, threshold }) {
        if (!query) {
            throw new Error('Query is required');
        }

        try {
            const similarityThreshold = threshold || this.similarityThreshold;
            
            // Use dedicated search service if available, otherwise fall back to memory manager
            let results;
            if (this.searchService) {
                results = await this.searchService.search(query, {
                    threshold: similarityThreshold,
                    limit,
                    types: types ? types.split(',') : undefined
                });
            } else {
                // Fall back to memory manager for search
                const embedding = await this.memoryManager.generateEmbedding(query);
                const memories = await this.memoryManager.retrieveRelevantInteractions(
                    query,
                    similarityThreshold,
                    0,
                    limit
                );
                
                // Transform memory format to search result format
                results = memories.map(item => ({
                    id: item.interaction.id || uuidv4(),
                    title: item.interaction.metadata?.title || item.interaction.prompt.slice(0, 50),
                    content: `${item.interaction.prompt}\n${item.interaction.output}`,
                    similarity: item.similarity,
                    type: item.interaction.metadata?.type || 'memory',
                    metadata: item.interaction.metadata || {}
                }));
            }
            
            this._emitMetric('search.count', 1);
            return { 
                results,
                count: results.length
            };
        } catch (error) {
            this._emitMetric('search.errors', 1);
            throw error;
        }
    }

    /**
     * Index content for search
     */
    async indexContent({ content, type, title, metadata = {} }) {
        if (!content) {
            throw new Error('Content is required');
        }
        
        if (!type) {
            throw new Error('Content type is required');
        }

        try {
            let result;
            
            // Use dedicated search service if available
            if (this.searchService) {
                const id = uuidv4();
                await this.searchService.index({
                    id,
                    content,
                    type,
                    title: title || content.slice(0, 50),
                    metadata
                });
                
                result = { id, success: true };
            } else {
                // Fall back to storing in memory
                const embedding = await this.memoryManager.generateEmbedding(content);
                const concepts = await this.memoryManager.extractConcepts(content);
                
                const id = uuidv4();
                await this.memoryManager.addInteraction(
                    title || content.slice(0, 50),
                    content,
                    embedding,
                    concepts,
                    {
                        id,
                        type,
                        timestamp: Date.now(),
                        ...metadata
                    }
                );
                
                result = { id, success: true };
            }
            
            this._emitMetric('index.count', 1);
            return result;
        } catch (error) {
            this._emitMetric('index.errors', 1);
            throw error;
        }
    }

    /**
     * Get search API metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();
        
        const serviceInfo = this.searchService 
            ? { service: 'dedicated', indexSize: await this._getIndexSize() }
            : { service: 'memory-fallback' };
        
        return {
            ...baseMetrics,
            search: {
                ...serviceInfo,
                operations: {
                    search: {
                        count: await this._getMetricValue('search.count'),
                        errors: await this._getMetricValue('search.errors'),
                        duration: await this._getMetricValue('search.duration')
                    },
                    index: {
                        count: await this._getMetricValue('index.count'),
                        errors: await this._getMetricValue('index.errors')
                    }
                }
            }
        };
    }

    async _getIndexSize() {
        if (this.searchService && typeof this.searchService.getIndexSize === 'function') {
            return await this.searchService.getIndexSize();
        }
        return 0;
    }

    async _getMetricValue(metricName) {
        // In a real implementation, this would fetch from a metrics store
        return 0;
    }
}