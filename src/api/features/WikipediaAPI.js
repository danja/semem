import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import WikipediaSearch from '../../aux/wikipedia/Search.js';

/**
 * Wikipedia API handler for Wikipedia search and article retrieval
 * 
 * Provides endpoints for:
 * - Article search and retrieval
 * - Content ingestion to knowledge graph
 * - Article metadata extraction
 * - Batch processing
 */
export default class WikipediaAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.memoryManager = null;
        
        // Wikipedia service instance
        this.wikipediaSearch = null;
        
        // Configuration
        this.defaultLimit = config.defaultLimit || 10;
        this.maxLimit = config.maxLimit || 50;
        this.requestTimeout = config.requestTimeout || 30000;
        this.defaultGraphURI = config.defaultGraphURI || 'http://purl.org/stuff/wikipedia';
        this.defaultNamespace = config.defaultNamespace || '0'; // Main articles
    }

    async initialize() {
        await super.initialize();
        
        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for WikipediaAPI');
        }
        
        try {
            this.memoryManager = registry.get('memory');
            
            // Initialize Wikipedia search service
            this.wikipediaSearch = new WikipediaSearch({
                sparqlEndpoint: registry.get('config')?.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
                sparqlAuth: registry.get('config')?.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                graphURI: this.defaultGraphURI,
                timeout: this.requestTimeout
            });
            
            this.logger.info('WikipediaAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize WikipediaAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a Wikipedia operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        const requestId = params.requestId || uuidv4();
        
        try {
            let result;
            
            switch (operation) {
                case 'search':
                    result = await this._executeSearch(params, requestId);
                    break;
                    
                case 'article':
                    result = await this._executeArticleLookup(params, requestId);
                    break;
                    
                case 'batch-search':
                    result = await this._executeBatchSearch(params, requestId);
                    break;
                    
                case 'ingest':
                    result = await this._executeIngest(params, requestId);
                    break;
                    
                case 'categories':
                    result = await this._executeCategorySearch(params, requestId);
                    break;
                    
                default:
                    throw new Error(`Unknown Wikipedia operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            
            return {
                success: true,
                operation,
                requestId,
                duration,
                result
            };
            
        } catch (error) {
            const duration = Date.now() - start;
            this.logger.error(`Wikipedia operation ${operation} failed:`, error);
            
            return {
                success: false,
                operation,
                requestId,
                duration,
                error: error.message
            };
        }
    }

    /**
     * Execute Wikipedia search
     */
    async _executeSearch(params, requestId) {
        const { 
            query, 
            limit = this.defaultLimit, 
            offset = 0, 
            namespace = this.defaultNamespace,
            ingestResults = false,
            language = 'en'
        } = params;
        
        if (!query) {
            throw new Error('Search query is required');
        }
        
        if (limit > this.maxLimit) {
            throw new Error(`Limit cannot exceed ${this.maxLimit}`);
        }
        
        this.logger.info(`[${requestId}] Searching Wikipedia for: "${query}" (limit: ${limit})`);
        
        const searchOptions = {
            limit,
            offset,
            namespace,
            format: 'json',
            ingestResults,
            language
        };
        
        const result = await this.wikipediaSearch.search(query, searchOptions);
        
        return {
            query,
            ...result,
            searchOptions,
            resultCount: result.results?.length || 0
        };
    }

    /**
     * Execute article lookup by title or page ID
     */
    async _executeArticleLookup(params, requestId) {
        const { 
            title, 
            pageId, 
            includeContent = true, 
            includeSummary = true,
            includeMetadata = true,
            ingestArticle = false,
            language = 'en'
        } = params;
        
        if (!title && !pageId) {
            throw new Error('Either title or pageId must be provided');
        }
        
        this.logger.info(`[${requestId}] Looking up Wikipedia article: ${title || `page ${pageId}`}`);
        
        try {
            const article = await this.wikipediaSearch.getArticle({
                title,
                pageId,
                includeContent,
                includeSummary,
                includeMetadata,
                language
            });
            
            // Optionally ingest the article into the knowledge graph
            if (ingestArticle && article) {
                const ingestionResult = await this.wikipediaSearch.ingestArticle(article);
                article.ingestionResult = ingestionResult;
            }
            
            return {
                article,
                lookupMethod: title ? 'title' : 'pageId',
                requestedTitle: title,
                requestedPageId: pageId
            };
        } catch (error) {
            throw new Error(`Article lookup failed: ${error.message}`);
        }
    }

    /**
     * Execute batch search for multiple queries
     */
    async _executeBatchSearch(params, requestId) {
        const { 
            queries, 
            limit = this.defaultLimit, 
            namespace = this.defaultNamespace,
            ingestResults = false,
            parallel = true,
            batchSize = 3
        } = params;
        
        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            throw new Error('Queries array is required and must not be empty');
        }
        
        if (queries.length > 20) {
            throw new Error('Maximum 20 queries allowed per batch');
        }
        
        this.logger.info(`[${requestId}] Batch searching ${queries.length} queries (parallel: ${parallel})`);
        
        const results = [];
        
        if (parallel) {
            // Process in parallel batches
            for (let i = 0; i < queries.length; i += batchSize) {
                const batch = queries.slice(i, i + batchSize);
                const batchPromises = batch.map(async (query, index) => {
                    try {
                        const searchResult = await this.wikipediaSearch.search(query, {
                            limit,
                            namespace,
                            ingestResults,
                            format: 'json'
                        });
                        
                        return {
                            index: i + index,
                            query,
                            success: true,
                            result: searchResult,
                            resultCount: searchResult.results?.length || 0
                        };
                    } catch (error) {
                        this.logger.warn(`Batch search failed for query "${query}":`, error.message);
                        return {
                            index: i + index,
                            query,
                            success: false,
                            error: error.message
                        };
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Brief pause between batches
                if (i + batchSize < queries.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } else {
            // Process sequentially
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                try {
                    const searchResult = await this.wikipediaSearch.search(query, {
                        limit,
                        namespace,
                        ingestResults,
                        format: 'json'
                    });
                    
                    results.push({
                        index: i,
                        query,
                        success: true,
                        result: searchResult,
                        resultCount: searchResult.results?.length || 0
                    });
                } catch (error) {
                    this.logger.warn(`Sequential search failed for query "${query}":`, error.message);
                    results.push({
                        index: i,
                        query,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        const summary = {
            totalQueries: queries.length,
            successfulQueries: results.filter(r => r.success).length,
            failedQueries: results.filter(r => !r.success).length,
            totalResults: results.reduce((sum, r) => sum + (r.resultCount || 0), 0)
        };
        
        return {
            results,
            summary,
            batchOptions: { parallel, batchSize }
        };
    }

    /**
     * Execute article ingestion to knowledge graph
     */
    async _executeIngest(params, requestId) {
        const { 
            articles, 
            titles, 
            pageIds,
            searchQueries,
            options = {}
        } = params;
        
        let articlesToIngest = [];
        
        if (articles) {
            articlesToIngest = Array.isArray(articles) ? articles : [articles];
        } else if (titles || pageIds || searchQueries) {
            // Fetch articles first
            if (titles) {
                const titleArray = Array.isArray(titles) ? titles : [titles];
                for (const title of titleArray) {
                    try {
                        const article = await this.wikipediaSearch.getArticle({ title });
                        if (article) articlesToIngest.push(article);
                    } catch (error) {
                        this.logger.warn(`Failed to fetch article "${title}":`, error.message);
                    }
                }
            }
            
            if (pageIds) {
                const pageIdArray = Array.isArray(pageIds) ? pageIds : [pageIds];
                for (const pageId of pageIdArray) {
                    try {
                        const article = await this.wikipediaSearch.getArticle({ pageId });
                        if (article) articlesToIngest.push(article);
                    } catch (error) {
                        this.logger.warn(`Failed to fetch article with ID ${pageId}:`, error.message);
                    }
                }
            }
            
            if (searchQueries) {
                const queryArray = Array.isArray(searchQueries) ? searchQueries : [searchQueries];
                for (const query of queryArray) {
                    try {
                        const searchResult = await this.wikipediaSearch.search(query, {
                            limit: options.searchLimit || 3,
                            ingestResults: false
                        });
                        
                        // Get articles for top search results
                        for (const result of searchResult.results || []) {
                            try {
                                const article = await this.wikipediaSearch.getArticle({ 
                                    title: result.title 
                                });
                                if (article) articlesToIngest.push(article);
                            } catch (error) {
                                this.logger.warn(`Failed to fetch search result "${result.title}":`, error.message);
                            }
                        }
                    } catch (error) {
                        this.logger.warn(`Search failed for query "${query}":`, error.message);
                    }
                }
            }
        } else {
            throw new Error('Must provide articles, titles, pageIds, or searchQueries');
        }
        
        if (articlesToIngest.length === 0) {
            throw new Error('No articles to ingest');
        }
        
        this.logger.info(`[${requestId}] Ingesting ${articlesToIngest.length} articles to knowledge graph`);
        
        const ingestionResults = [];
        
        for (const article of articlesToIngest) {
            try {
                const result = await this.wikipediaSearch.ingestArticle(article);
                ingestionResults.push({
                    article: article.title || article.pageId,
                    success: true,
                    result
                });
            } catch (error) {
                this.logger.warn(`Ingestion failed for article "${article.title}":`, error.message);
                ingestionResults.push({
                    article: article.title || article.pageId,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const summary = {
            totalArticles: articlesToIngest.length,
            successfulIngestions: ingestionResults.filter(r => r.success).length,
            failedIngestions: ingestionResults.filter(r => !r.success).length
        };
        
        return {
            ingestionResults,
            summary
        };
    }

    /**
     * Execute category-based search
     */
    async _executeCategorySearch(params, requestId) {
        const { 
            category, 
            limit = this.defaultLimit,
            recursive = false,
            ingestResults = false
        } = params;
        
        if (!category) {
            throw new Error('Category is required');
        }
        
        this.logger.info(`[${requestId}] Searching Wikipedia category: "${category}"`);
        
        try {
            const result = await this.wikipediaSearch.searchCategory(category, {
                limit,
                recursive,
                ingestResults
            });
            
            return {
                category,
                ...result,
                resultCount: result.pages?.length || 0
            };
        } catch (error) {
            throw new Error(`Category search failed: ${error.message}`);
        }
    }

    /**
     * Validate required parameters
     */
    _validateParams(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Parameters object is required');
        }
    }

    /**
     * Get API endpoints configuration
     */
    getEndpoints() {
        return [
            {
                method: 'GET',
                path: '/wikipedia/search',
                operation: 'search',
                description: 'Search Wikipedia articles',
                schema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        limit: { type: 'number', default: 10, maximum: 50 },
                        offset: { type: 'number', default: 0 },
                        namespace: { type: 'string', default: '0' },
                        ingestResults: { type: 'boolean', default: false },
                        language: { type: 'string', default: 'en' }
                    },
                    required: ['query']
                }
            },
            {
                method: 'GET',
                path: '/wikipedia/article',
                operation: 'article',
                description: 'Get specific Wikipedia article by title or page ID',
                schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Article title' },
                        pageId: { type: 'number', description: 'Wikipedia page ID' },
                        includeContent: { type: 'boolean', default: true },
                        includeSummary: { type: 'boolean', default: true },
                        includeMetadata: { type: 'boolean', default: true },
                        ingestArticle: { type: 'boolean', default: false },
                        language: { type: 'string', default: 'en' }
                    },
                    anyOf: [
                        { required: ['title'] },
                        { required: ['pageId'] }
                    ]
                }
            },
            {
                method: 'POST',
                path: '/wikipedia/batch-search',
                operation: 'batch-search',
                description: 'Search multiple queries in batch',
                schema: {
                    type: 'object',
                    properties: {
                        queries: { 
                            type: 'array', 
                            items: { type: 'string' },
                            maxItems: 20,
                            description: 'Array of search queries'
                        },
                        limit: { type: 'number', default: 10, maximum: 50 },
                        namespace: { type: 'string', default: '0' },
                        ingestResults: { type: 'boolean', default: false },
                        parallel: { type: 'boolean', default: true },
                        batchSize: { type: 'number', default: 3 }
                    },
                    required: ['queries']
                }
            },
            {
                method: 'POST',
                path: '/wikipedia/ingest',
                operation: 'ingest',
                description: 'Ingest Wikipedia articles into knowledge graph',
                schema: {
                    type: 'object',
                    properties: {
                        articles: { type: 'array', description: 'Array of article objects' },
                        titles: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'Array of article titles to fetch and ingest'
                        },
                        pageIds: { 
                            type: 'array', 
                            items: { type: 'number' },
                            description: 'Array of page IDs to fetch and ingest'
                        },
                        searchQueries: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'Search queries to find and ingest articles'
                        },
                        options: {
                            type: 'object',
                            properties: {
                                searchLimit: { type: 'number', default: 3 }
                            }
                        }
                    },
                    anyOf: [
                        { required: ['articles'] },
                        { required: ['titles'] },
                        { required: ['pageIds'] },
                        { required: ['searchQueries'] }
                    ]
                }
            },
            {
                method: 'GET',
                path: '/wikipedia/categories',
                operation: 'categories',
                description: 'Search articles by Wikipedia category',
                schema: {
                    type: 'object',
                    properties: {
                        category: { type: 'string', description: 'Wikipedia category name' },
                        limit: { type: 'number', default: 10, maximum: 50 },
                        recursive: { type: 'boolean', default: false },
                        ingestResults: { type: 'boolean', default: false }
                    },
                    required: ['category']
                }
            }
        ];
    }
}