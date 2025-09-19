import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import { PromptSynthesis } from '../../../mcp/lib/PromptSynthesis.js';

/**
 * Unified Search API that aggregates search across all Semem services
 * Provides intelligent query routing and result ranking across Memory, Ragno, and ZPT
 */
export default class UnifiedSearchAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        
        // Search configuration
        this.defaultLimit = config.defaultLimit || 20;
        this.maxTotalResults = config.maxTotalResults || 100;
        this.searchTimeout = config.searchTimeout || 30000;
        this.enableParallelSearch = config.enableParallelSearch !== false;
        this.enableResultRanking = config.enableResultRanking !== false;
        
        // Service references (will be injected)
        this.memoryAPI = null;
        this.ragnoAPI = null;
        this.zptAPI = null;
        this.searchAPI = null;
        
        // Search strategy weights for result ranking
        this.searchWeights = {
            memory: config.memoryWeight || 0.4,
            ragno: config.ragnoWeight || 0.3,
            search: config.searchWeight || 0.2,
            zpt: config.zptWeight || 0.1
        };
        
        // Query analysis patterns
        this.queryPatterns = {
            entity: /\b(who|person|people|organization|company|entity)\b/i,
            concept: /\b(what|concept|idea|meaning|definition)\b/i,
            relationship: /\b(how|relate|connect|link|relationship)\b/i,
            temporal: /\b(when|time|date|year|ago|recently|before|after)\b/i,
            navigation: /\b(navigate|explore|traverse|browse|discover)\b/i,
            knowledge: /\b(knowledge|graph|semantic|ontology|rdf)\b/i
        };
        
        // Metrics
        this.metrics = {
            totalSearches: 0,
            parallelSearches: 0,
            avgResponseTime: 0,
            serviceUsage: {
                memory: 0,
                ragno: 0,
                search: 0,
                zpt: 0
            },
            queryTypes: {
                entity: 0,
                concept: 0,
                relationship: 0,
                temporal: 0,
                navigation: 0,
                knowledge: 0,
                general: 0
            }
        };
    }

    async initialize() {
        await super.initialize();
        
        // Get service references from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for UnifiedSearchAPI');
        }
        
        try {
            // Get API instances from the registry's API context
            const apiContext = registry.get('apis') || {};
            
            this.memoryAPI = apiContext['memory-api'];
            this.ragnoAPI = apiContext['ragno-api'];
            this.zptAPI = apiContext['zpt-api'];
            this.searchAPI = apiContext['search-api'];

            // Initialize PromptSynthesis for answer generation
            const llmHandler = registry.get('llm');
            if (llmHandler) {
                this.promptSynthesis = new PromptSynthesis(llmHandler);
            }

            this.logger.info('UnifiedSearchAPI initialized successfully', {
                availableServices: {
                    memory: !!this.memoryAPI,
                    ragno: !!this.ragnoAPI,
                    zpt: !!this.zptAPI,
                    search: !!this.searchAPI,
                    synthesis: !!this.promptSynthesis
                }
            });
        } catch (error) {
            this.logger.error('Failed to initialize UnifiedSearchAPI:', error);
            throw error;
        }
    }

    /**
     * Execute unified search operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        const requestId = uuidv4();
        
        try {
            let result;
            
            switch (operation) {
                case 'unified':
                    result = await this.unifiedSearch(params, requestId);
                    break;
                case 'analyze':
                    result = await this.analyzeQuery(params, requestId);
                    break;
                case 'services':
                    result = await this.getAvailableServices(params, requestId);
                    break;
                case 'strategies':
                    result = await this.getSearchStrategies(params, requestId);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            this.metrics.avgResponseTime = this._updateAverage(this.metrics.avgResponseTime, duration);
            this._emitMetric(`unified.operation.${operation}.duration`, duration);
            this._emitMetric(`unified.operation.${operation}.count`, 1);
            
            return {
                ...result,
                requestId,
                processingTime: duration
            };
        } catch (error) {
            this._emitMetric(`unified.operation.${operation}.errors`, 1);
            this.logger.error(`Unified search operation ${operation} failed:`, error);
            throw error;
        }
    }

    /**
     * Main unified search that queries all available services and merges results
     */
    async unifiedSearch({ query, limit = this.defaultLimit, strategy = 'auto', services, weights }, requestId) {
        if (!query) {
            throw new Error('Search query is required');
        }
        
        this.logger.info('Executing unified search', { requestId, query, strategy, limit });
        
        const searchStart = Date.now();
        
        // Analyze query to determine optimal search strategy
        const queryAnalysis = this._analyzeQuery(query);
        const searchStrategy = strategy === 'auto' ? this._determineStrategy(queryAnalysis) : strategy;
        
        // Determine which services to query
        const servicesToQuery = services || this._selectServices(queryAnalysis, searchStrategy);
        
        // Execute searches in parallel or sequence based on configuration
        let searchResults;
        if (this.enableParallelSearch) {
            searchResults = await this._executeParallelSearches(query, servicesToQuery, limit, requestId);
            this.metrics.parallelSearches++;
        } else {
            searchResults = await this._executeSequentialSearches(query, servicesToQuery, limit, requestId);
        }
        
        // Rank and merge results
        const mergedResults = this.enableResultRanking ? 
            this._rankAndMergeResults(searchResults, queryAnalysis, weights) :
            this._simpleMergeResults(searchResults, limit);
        
        const searchTime = Date.now() - searchStart;
        this.metrics.totalSearches++;
        
        // Update service usage metrics
        servicesToQuery.forEach(service => {
            if (this.metrics.serviceUsage[service] !== undefined) {
                this.metrics.serviceUsage[service]++;
            }
        });
        
        // Update query type metrics
        this._updateQueryTypeMetrics(queryAnalysis);

        // Generate answer using PromptSynthesis if available and results exist
        let answer = null;
        if (this.promptSynthesis && mergedResults.length > 0) {
            try {
                answer = await this.promptSynthesis.synthesizeResponse(query, mergedResults, {
                    mode: searchStrategy,
                    useContext: true
                });
            } catch (error) {
                this.logger.warn('Failed to synthesize answer:', error.message);
            }
        }

        return {
            success: true,
            query,
            strategy: searchStrategy,
            analysis: queryAnalysis,
            servicesQueried: servicesToQuery,
            results: mergedResults,
            answer: answer,
            metadata: {
                totalResults: mergedResults.length,
                searchTime,
                servicesUsed: searchResults.length,
                resultDistribution: this._getResultDistribution(searchResults)
            }
        };
    }

    /**
     * Execute searches across all services in parallel
     */
    async _executeParallelSearches(query, services, limit, requestId) {
        const searchPromises = [];
        
        // Memory search
        if (services.includes('memory') && this.memoryAPI) {
            searchPromises.push(
                this._executeServiceSearch('memory', this.memoryAPI, 'search', {
                    query,
                    limit: Math.ceil(limit / services.length)
                }).catch(error => ({ service: 'memory', error: error.message, results: [] }))
            );
        }
        
        // Ragno search
        if (services.includes('ragno') && this.ragnoAPI) {
            searchPromises.push(
                this._executeServiceSearch('ragno', this.ragnoAPI, 'search', {
                    query,
                    type: 'dual',
                    limit: Math.ceil(limit / services.length)
                }).catch(error => ({ service: 'ragno', error: error.message, results: [] }))
            );
        }
        
        // Basic search
        if (services.includes('search') && this.searchAPI) {
            searchPromises.push(
                this._executeServiceSearch('search', this.searchAPI, 'search', {
                    query,
                    limit: Math.ceil(limit / services.length)
                }).catch(error => ({ service: 'search', error: error.message, results: [] }))
            );
        }
        
        // ZPT search (via preview for concept exploration)
        if (services.includes('zpt') && this.zptAPI) {
            searchPromises.push(
                this._executeServiceSearch('zpt', this.zptAPI, 'preview', {
                    zoom: 'unit',
                    pan: { topic: query.replace(/\s+/g, '-').toLowerCase() },
                    tilt: 'keywords'
                }).catch(error => ({ service: 'zpt', error: error.message, results: [] }))
            );
        }
        
        const results = await Promise.allSettled(searchPromises);
        return results.map(result => result.status === 'fulfilled' ? result.value : result.reason);
    }

    /**
     * Execute searches across services sequentially
     */
    async _executeSequentialSearches(query, services, limit, requestId) {
        const results = [];
        
        for (const service of services) {
            try {
                let result;
                switch (service) {
                    case 'memory':
                        if (this.memoryAPI) {
                            result = await this._executeServiceSearch('memory', this.memoryAPI, 'search', {
                                query, limit: Math.ceil(limit / services.length)
                            });
                        }
                        break;
                    case 'ragno':
                        if (this.ragnoAPI) {
                            result = await this._executeServiceSearch('ragno', this.ragnoAPI, 'search', {
                                query, type: 'dual', limit: Math.ceil(limit / services.length)
                            });
                        }
                        break;
                    case 'search':
                        if (this.searchAPI) {
                            result = await this._executeServiceSearch('search', this.searchAPI, 'search', {
                                query, limit: Math.ceil(limit / services.length)
                            });
                        }
                        break;
                    case 'zpt':
                        if (this.zptAPI) {
                            result = await this._executeServiceSearch('zpt', this.zptAPI, 'preview', {
                                zoom: 'unit',
                                pan: { topic: query.replace(/\s+/g, '-').toLowerCase() },
                                tilt: 'keywords'
                            });
                        }
                        break;
                }
                
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                this.logger.warn(`Search failed for service ${service}:`, error.message);
                results.push({ service, error: error.message, results: [] });
            }
        }
        
        return results;
    }

    /**
     * Execute search on a specific service
     */
    async _executeServiceSearch(serviceName, api, operation, params) {
        const start = Date.now();
        
        try {
            const result = await Promise.race([
                api.executeOperation(operation, params),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), this.searchTimeout)
                )
            ]);
            
            const duration = Date.now() - start;
            
            return {
                service: serviceName,
                operation,
                results: this._normalizeResults(result, serviceName),
                metadata: {
                    searchTime: duration,
                    resultCount: this._getResultCount(result, serviceName)
                }
            };
        } catch (error) {
            throw new Error(`${serviceName} search failed: ${error.message}`);
        }
    }

    /**
     * Normalize results from different services to a common format
     */
    _normalizeResults(result, service) {
        switch (service) {
            case 'memory':
                return (result.results || []).map(item => ({
                    type: 'memory',
                    id: item.id,
                    title: item.prompt || 'Memory Item',
                    content: item.output || item.response,
                    score: item.similarity || 0,
                    metadata: {
                        concepts: item.concepts,
                        timestamp: item.timestamp,
                        accessCount: item.accessCount
                    },
                    source: 'memory'
                }));
                
            case 'ragno':
                return (result.results || []).map(item => ({
                    type: 'entity',
                    id: item.uri || item.id,
                    title: item.name || item.title,
                    content: item.content || item.description,
                    score: item.score || item.confidence || 0,
                    metadata: {
                        entityType: item.type,
                        confidence: item.confidence,
                        uri: item.uri
                    },
                    source: 'ragno'
                }));
                
            case 'search':
                return (result.results || []).map(item => ({
                    type: 'content',
                    id: item.id || uuidv4(),
                    title: item.title || 'Search Result',
                    content: item.content || item.text,
                    score: item.score || item.relevance || 0,
                    metadata: item.metadata || {},
                    source: 'search'
                }));
                
            case 'zpt':
                return (result.corpuscles || []).map(item => ({
                    type: 'corpuscle',
                    id: item.id || uuidv4(),
                    title: item.title || 'Navigation Result',
                    content: item.content || item.summary,
                    score: item.relevance || 0.5,
                    metadata: {
                        complexity: item.complexity,
                        entities: item.entities
                    },
                    source: 'zpt'
                }));
                
            default:
                return [];
        }
    }

    /**
     * Rank and merge results from multiple services
     */
    _rankAndMergeResults(searchResults, queryAnalysis, customWeights = {}) {
        const weights = { ...this.searchWeights, ...customWeights };
        const allResults = [];
        
        // Apply service-specific weights and collect all results
        searchResults.forEach(serviceResult => {
            if (serviceResult.results && serviceResult.results.length > 0) {
                const serviceWeight = weights[serviceResult.service] || 0.1;
                const weightedResults = serviceResult.results.map(result => ({
                    ...result,
                    weightedScore: result.score * serviceWeight,
                    serviceWeight
                }));
                allResults.push(...weightedResults);
            }
        });
        
        // Apply query-based boost factors
        allResults.forEach(result => {
            result.finalScore = this._calculateFinalScore(result, queryAnalysis);
        });
        
        // Sort by final score and limit results
        return allResults
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, this.maxTotalResults);
    }

    /**
     * Calculate final score based on query analysis and result characteristics
     */
    _calculateFinalScore(result, queryAnalysis) {
        let score = result.weightedScore;
        
        // Boost based on query type alignment
        if (queryAnalysis.type === 'entity' && result.type === 'entity') {
            score *= 1.3;
        }
        if (queryAnalysis.type === 'concept' && result.source === 'memory') {
            score *= 1.2;
        }
        if (queryAnalysis.type === 'navigation' && result.source === 'zpt') {
            score *= 1.4;
        }
        if (queryAnalysis.type === 'knowledge' && result.source === 'ragno') {
            score *= 1.3;
        }
        
        // Boost recent content
        if (result.metadata?.timestamp) {
            const age = Date.now() - new Date(result.metadata.timestamp).getTime();
            const daysSinceCreation = age / (1000 * 60 * 60 * 24);
            if (daysSinceCreation < 30) {
                score *= 1.1;
            }
        }
        
        // Boost high-confidence results
        if (result.metadata?.confidence > 0.8) {
            score *= 1.15;
        }
        
        return score;
    }

    /**
     * Simple merge without ranking (fallback)
     */
    _simpleMergeResults(searchResults, limit) {
        const allResults = [];
        
        searchResults.forEach(serviceResult => {
            if (serviceResult.results) {
                allResults.push(...serviceResult.results);
            }
        });
        
        return allResults.slice(0, limit);
    }

    /**
     * Analyze query to determine search characteristics
     */
    _analyzeQuery(query) {
        const analysis = {
            query,
            type: 'general',
            characteristics: [],
            keywords: query.toLowerCase().split(/\s+/).filter(word => word.length > 2),
            confidence: 0
        };
        
        // Check query patterns
        let maxScore = 0;
        for (const [type, pattern] of Object.entries(this.queryPatterns)) {
            if (pattern.test(query)) {
                if (type !== 'general') {
                    analysis.characteristics.push(type);
                    const score = (query.match(pattern) || []).length;
                    if (score > maxScore) {
                        maxScore = score;
                        analysis.type = type;
                    }
                }
            }
        }
        
        analysis.confidence = Math.min(maxScore / 3, 1); // Normalize to 0-1
        
        return analysis;
    }

    /**
     * Determine optimal search strategy based on query analysis
     */
    _determineStrategy(analysis) {
        switch (analysis.type) {
            case 'entity':
                return 'entity-focused';
            case 'concept':
                return 'concept-focused';
            case 'relationship':
                return 'graph-focused';
            case 'navigation':
                return 'navigation-focused';
            case 'knowledge':
                return 'knowledge-focused';
            default:
                return 'balanced';
        }
    }

    /**
     * Select services based on query analysis
     */
    _selectServices(analysis, strategy) {
        const allServices = ['memory', 'ragno', 'search', 'zpt'];
        
        switch (strategy) {
            case 'entity-focused':
                return ['ragno', 'memory', 'search'];
            case 'concept-focused':
                return ['memory', 'search', 'ragno'];
            case 'graph-focused':
                return ['ragno', 'zpt', 'memory'];
            case 'navigation-focused':
                return ['zpt', 'ragno', 'search'];
            case 'knowledge-focused':
                return ['ragno', 'memory', 'zpt'];
            default:
                return allServices;
        }
    }

    /**
     * Analyze query operation
     */
    async analyzeQuery({ query }, requestId) {
        const analysis = this._analyzeQuery(query);
        const strategy = this._determineStrategy(analysis);
        const services = this._selectServices(analysis, strategy);
        
        return {
            success: true,
            query,
            analysis,
            recommendedStrategy: strategy,
            recommendedServices: services,
            estimatedRelevance: {
                memory: this._estimateServiceRelevance('memory', analysis),
                ragno: this._estimateServiceRelevance('ragno', analysis),
                search: this._estimateServiceRelevance('search', analysis),
                zpt: this._estimateServiceRelevance('zpt', analysis)
            }
        };
    }

    /**
     * Get available services and their status
     */
    async getAvailableServices(params = {}, requestId) {
        return {
            success: true,
            services: {
                memory: {
                    available: !!this.memoryAPI,
                    description: 'Semantic memory search and retrieval',
                    capabilities: ['similarity_search', 'concept_extraction', 'interaction_storage']
                },
                ragno: {
                    available: !!this.ragnoAPI,
                    description: 'Knowledge graph operations and entity search',
                    capabilities: ['entity_search', 'graph_analysis', 'corpus_decomposition']
                },
                search: {
                    available: !!this.searchAPI,
                    description: 'General content search and indexing',
                    capabilities: ['content_search', 'indexing', 'text_analysis']
                },
                zpt: {
                    available: !!this.zptAPI,
                    description: 'Zero-Point Traversal corpus navigation',
                    capabilities: ['corpus_navigation', 'parameter_validation', 'content_transformation']
                }
            },
            totalAvailable: [this.memoryAPI, this.ragnoAPI, this.searchAPI, this.zptAPI]
                .filter(Boolean).length
        };
    }

    /**
     * Get search strategies information
     */
    async getSearchStrategies(params = {}, requestId) {
        return {
            success: true,
            strategies: {
                'entity-focused': {
                    description: 'Prioritizes entity and knowledge graph search',
                    services: ['ragno', 'memory', 'search'],
                    useCase: 'Finding specific entities, people, organizations'
                },
                'concept-focused': {
                    description: 'Emphasizes conceptual and semantic search',
                    services: ['memory', 'search', 'ragno'],
                    useCase: 'Exploring ideas, definitions, conceptual relationships'
                },
                'graph-focused': {
                    description: 'Leverages graph relationships and connections',
                    services: ['ragno', 'zpt', 'memory'],
                    useCase: 'Understanding relationships and network structures'
                },
                'navigation-focused': {
                    description: 'Optimized for corpus exploration and navigation',
                    services: ['zpt', 'ragno', 'search'],
                    useCase: 'Browsing and discovering content patterns'
                },
                'knowledge-focused': {
                    description: 'Comprehensive knowledge base search',
                    services: ['ragno', 'memory', 'zpt'],
                    useCase: 'Deep knowledge exploration and research'
                },
                'balanced': {
                    description: 'Queries all available services equally',
                    services: ['memory', 'ragno', 'search', 'zpt'],
                    useCase: 'General search with comprehensive coverage'
                }
            },
            defaultWeights: this.searchWeights
        };
    }

    /**
     * Helper methods
     */
    _estimateServiceRelevance(service, analysis) {
        let relevance = 0.5; // Base relevance
        
        if (analysis.type === 'entity' && service === 'ragno') relevance = 0.9;
        if (analysis.type === 'concept' && service === 'memory') relevance = 0.9;
        if (analysis.type === 'navigation' && service === 'zpt') relevance = 0.9;
        if (analysis.type === 'knowledge' && service === 'ragno') relevance = 0.8;
        
        return relevance;
    }

    _getResultCount(result, service) {
        switch (service) {
            case 'memory':
                return result.results?.length || 0;
            case 'ragno':
                return result.results?.length || 0;
            case 'search':
                return result.results?.length || 0;
            case 'zpt':
                return result.corpuscles?.length || 0;
            default:
                return 0;
        }
    }

    _getResultDistribution(searchResults) {
        const distribution = {};
        searchResults.forEach(result => {
            distribution[result.service] = result.results?.length || 0;
        });
        return distribution;
    }

    _updateQueryTypeMetrics(analysis) {
        if (this.metrics.queryTypes[analysis.type] !== undefined) {
            this.metrics.queryTypes[analysis.type]++;
        } else {
            this.metrics.queryTypes.general++;
        }
    }

    _updateAverage(currentAvg, newValue) {
        const count = this.metrics.totalSearches + 1;
        return (currentAvg * (count - 1) + newValue) / count;
    }

    /**
     * Store interaction (inherited from BaseAPI)
     */
    async storeInteraction(interaction) {
        throw new Error('Use unified search operation to search across all services');
    }

    /**
     * Retrieve interactions (inherited from BaseAPI)
     */
    async retrieveInteractions(query) {
        return this.unifiedSearch({ query });
    }

    /**
     * Get unified search metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();
        
        return {
            ...baseMetrics,
            unified: this.metrics,
            searchWeights: this.searchWeights,
            configuration: {
                enableParallelSearch: this.enableParallelSearch,
                enableResultRanking: this.enableResultRanking,
                defaultLimit: this.defaultLimit,
                searchTimeout: this.searchTimeout
            }
        };
    }

    async shutdown() {
        this.logger.info('Shutting down UnifiedSearchAPI');
        
        // Clear any active searches
        // In a production system, you might want to cancel ongoing searches
        
        await super.shutdown();
    }
}