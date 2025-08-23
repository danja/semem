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
            let results = [];
            
            try {
                if (this.searchService) {
                    this.logger.info('Using search service for query:', query);
                    results = await this.searchService.search(query, {
                        threshold: similarityThreshold,
                        limit,
                        types: types ? types.split(',') : undefined
                    });
                } else {
                    // Fall back to memory manager for search
                    this.logger.info('Using memory manager fallback for search');
                    
                    try {
                        // Generate embedding safely
                        const embedding = await this.memoryManager.generateEmbedding(query);
                        this.logger.info('Embedding generated successfully');
                        
                        // Retrieve interactions safely
                        let memories = [];
                        try {
                            memories = await this.memoryManager.retrieveRelevantInteractions(
                                query,
                                similarityThreshold,
                                0,
                                limit
                            );
                            console.log('🔥 CONSOLE: SearchAPI received memories from MemoryManager', { 
                                memoriesCount: memories?.length || 0, 
                                firstMemory: memories?.[0] ? Object.keys(memories[0]) : 'no memories',
                                hasInteractionProperty: memories?.[0]?.interaction ? 'YES' : 'NO',
                                memoriesStructure: memories?.[0] ? JSON.stringify(memories[0], null, 2).substring(0, 200) : 'no memories'
                            });
                            this.logger.info(`Retrieved ${memories?.length || 0} memories`);
                        } catch (retrievalError) {
                            this.logger.error('Error retrieving interactions:', retrievalError);
                            memories = []; // Fallback to empty array
                        }
                        
                        // Ensure memories is an array before processing
                        if (!Array.isArray(memories)) {
                            this.logger.warn('Memory retrieval did not return an array');
                            memories = [];
                        }
                        
                        // Apply safe transformation with defensive coding
                        console.log('🔥 CONSOLE: SearchAPI applying filter and transformation', { 
                            memoriesBeforeFilter: memories.length,
                            memoriesWithInteractionProperty: memories.filter(item => item && typeof item === 'object' && item.interaction).length
                        });
                        
                        results = memories
                            .filter(item => item && typeof item === 'object' && item.interaction)
                            .map(item => {
                                try {
                                    const interaction = item.interaction || {};
                                    return {
                                        id: interaction.id || uuidv4(),
                                        title: (interaction.metadata && interaction.metadata.title) || 
                                              (interaction.prompt && interaction.prompt.slice(0, 50)) || 
                                              'Untitled',
                                        content: `${interaction.prompt || ''}\n${interaction.output || ''}`,
                                        similarity: typeof item.similarity === 'number' ? item.similarity : 0,
                                        type: (interaction.metadata && interaction.metadata.type) || 'memory',
                                        metadata: interaction.metadata || {}
                                    };
                                } catch (transformError) {
                                    this.logger.error('Error transforming memory item:', transformError);
                                    // Return a default item on transform error
                                    return {
                                        id: uuidv4(),
                                        title: 'Error Item',
                                        content: 'Could not process this item',
                                        similarity: 0,
                                        type: 'error',
                                        metadata: {}
                                    };
                                }
                            });
                    } catch (embeddingError) {
                        this.logger.error('Error generating embedding:', embeddingError);
                        // Return empty results on embedding error
                        results = [];
                    }
                }
            } catch (searchError) {
                this.logger.error('Error during search process:', searchError);
                // Return empty results on search error
                results = [];
            }
            
            this._emitMetric('search.count', 1);
            return { 
                results,
                count: results.length
            };
        } catch (error) {
            this.logger.error('Search operation error:', error);
            this._emitMetric('search.errors', 1);
            
            // Return empty results rather than throwing, for API stability
            return { 
                results: [],
                count: 0,
                error: error.message
            };
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