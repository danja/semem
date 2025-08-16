/**
 * Wikipedia Enhancement Service
 * 
 * Provides Wikipedia search integration for query enhancement by finding relevant
 * Wikipedia articles and extracting contextual information to augment responses.
 * 
 * Extracted and refactored from examples/wikipedia/WikipediaDemo.js into core service
 * following structured patterns and using SPARQL template system.
 */

import logger from 'loglevel';
import fetch from 'node-fetch';
import { SPARQLQueryService } from '../sparql/index.js';
import SPARQLHelper from '../sparql/SPARQLHelper.js';

export class WikipediaService {
    constructor(options = {}) {
        this.sparqlHelper = options.sparqlHelper;
        this.embeddingHandler = options.embeddingHandler;
        this.config = options.config;
        
        // Default configuration
        this.settings = {
            apiEndpoint: options.apiEndpoint || 'https://en.wikipedia.org/api/rest_v1',
            searchEndpoint: options.searchEndpoint || 'https://en.wikipedia.org/w/api.php',
            maxResults: options.maxResults || 5,
            rateLimit: options.rateLimit || 200, // milliseconds between requests
            storageGraph: options.storageGraph || 'http://hyperdata.it/content',
            maxContentLength: options.maxContentLength || 2000,
            enableCaching: options.enableCaching !== false,
            userAgent: options.userAgent || 'SememEnhancementService/1.0 (https://github.com/danja/hyperdata)',
            ...options.settings
        };

        // Initialize SPARQL query service for template management
        this.queryService = new SPARQLQueryService({
            queryPath: options.queryPath || 'sparql'
        });

        // Cache for Wikipedia results
        this.searchCache = new Map();
        this.lastRequestTime = 0;
    }

    /**
     * Search Wikipedia for articles related to a query
     * 
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @returns {Object} Wikipedia search results
     */
    async searchWikipedia(query, options = {}) {
        logger.info(`🔍 Searching Wikipedia for: "${query}"`);

        const limit = options.limit || this.settings.maxResults;
        const cacheKey = `${query}:${limit}`;

        // Check cache first
        if (this.settings.enableCaching && this.searchCache.has(cacheKey)) {
            logger.info('📋 Using cached Wikipedia results');
            return this.searchCache.get(cacheKey);
        }

        try {
            // Apply rate limiting
            await this.applyRateLimit();

            // Build search parameters
            const searchParams = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                srlimit: limit,
                srprop: 'snippet|titlesnippet|size|wordcount|timestamp',
                origin: '*'
            });

            const searchUrl = `${this.settings.searchEndpoint}?${searchParams}`;

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.settings.userAgent,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.query || !data.query.search) {
                throw new Error('Invalid Wikipedia API response format');
            }

            const searchResults = data.query.search.map(result => ({
                title: result.title,
                snippet: result.snippet,
                size: result.size,
                wordcount: result.wordcount,
                timestamp: result.timestamp,
                pageId: result.pageid,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
                relevanceScore: this.calculateRelevanceScore(result, query)
            }));

            const searchObject = {
                query,
                results: searchResults,
                totalHits: data.query.searchinfo?.totalhits || searchResults.length,
                timestamp: new Date().toISOString(),
                searchId: `wiki_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
            };

            // Cache results
            if (this.settings.enableCaching) {
                this.searchCache.set(cacheKey, searchObject);
            }

            logger.info(`✅ Found ${searchResults.length} Wikipedia articles`);
            return searchObject;

        } catch (error) {
            logger.error('❌ Wikipedia search failed:', error.message);
            throw new Error(`Wikipedia search failed: ${error.message}`);
        }
    }

    /**
     * Fetch detailed content for Wikipedia articles
     * 
     * @param {Array} articles - Array of articles from search results
     * @param {Object} options - Fetch options
     * @returns {Array} Articles with detailed content
     */
    async fetchArticleContent(articles, options = {}) {
        logger.info(`📄 Fetching content for ${articles.length} Wikipedia articles`);

        const maxArticles = Math.min(articles.length, options.maxArticles || this.settings.maxResults);
        const articlesWithContent = [];

        for (let i = 0; i < maxArticles; i++) {
            const article = articles[i];
            
            try {
                // Apply rate limiting
                await this.applyRateLimit();

                // Fetch article extract
                const extractParams = new URLSearchParams({
                    action: 'query',
                    format: 'json',
                    prop: 'extracts|info',
                    pageids: article.pageId,
                    exintro: true,
                    explaintext: true,
                    exsectionformat: 'plain',
                    inprop: 'url',
                    origin: '*'
                });

                const extractUrl = `${this.settings.searchEndpoint}?${extractParams}`;

                const response = await fetch(extractUrl, {
                    headers: {
                        'User-Agent': this.settings.userAgent,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    logger.warn(`Failed to fetch content for article ${article.title}: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                const page = data.query?.pages?.[article.pageId];

                if (page && page.extract) {
                    // Truncate content if too long
                    let content = page.extract;
                    if (content.length > this.settings.maxContentLength) {
                        content = content.substring(0, this.settings.maxContentLength) + '...';
                    }

                    articlesWithContent.push({
                        ...article,
                        content,
                        fullUrl: page.fullurl || article.url,
                        contentLength: content.length,
                        hasContent: true
                    });
                } else {
                    // Add article without content
                    articlesWithContent.push({
                        ...article,
                        content: article.snippet || '',
                        hasContent: false
                    });
                }

            } catch (error) {
                logger.warn(`Failed to fetch content for article ${article.title}:`, error.message);
                // Add article with snippet as content
                articlesWithContent.push({
                    ...article,
                    content: article.snippet || '',
                    hasContent: false,
                    error: error.message
                });
            }
        }

        logger.info(`✅ Retrieved content for ${articlesWithContent.filter(a => a.hasContent).length}/${maxArticles} articles`);
        return articlesWithContent;
    }

    /**
     * Store Wikipedia context with embeddings using SPARQL templates
     * 
     * @param {Object} searchResults - Wikipedia search results
     * @param {string} originalQuery - The original query
     * @returns {Array} Array of stored context results
     */
    async storeWikipediaContext(searchResults, originalQuery) {
        if (!this.sparqlHelper || !searchResults.results || searchResults.results.length === 0) {
            logger.warn('No SPARQL helper provided or no Wikipedia results to store');
            return [];
        }

        logger.info('💾 Storing Wikipedia context with embeddings...');

        const results = [];

        try {
            for (const article of searchResults.results) {
                // Generate embedding for article content
                const contentForEmbedding = article.content || article.snippet || article.title;
                const embedding = this.embeddingHandler 
                    ? await this.embeddingHandler.generateEmbedding(contentForEmbedding)
                    : null;

                // Create article URI
                const articleURI = `http://purl.org/stuff/instance/wikipedia-article/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;

                // Use SPARQL template for context storage
                const insertQuery = await this.buildContextStorageQuery(
                    articleURI, 
                    article, 
                    embedding, 
                    searchResults.searchId,
                    originalQuery
                );
                
                const result = await this.sparqlHelper.executeUpdate(insertQuery);
                
                if (!result.success) {
                    logger.error('SPARQL context storage failed:', result.error);
                    throw new Error(`Failed to store Wikipedia context: ${result.error}`);
                }

                results.push({
                    uri: articleURI,
                    title: article.title,
                    embedding: embedding,
                    searchId: searchResults.searchId,
                    relevanceScore: article.relevanceScore
                });
            }

            logger.info(`✅ Stored ${results.length} Wikipedia articles with context`);
            return results;

        } catch (error) {
            logger.error('❌ Failed to store Wikipedia context:', error.message);
            throw error;
        }
    }

    /**
     * Enhance a query with Wikipedia-derived context
     * 
     * @param {string} originalQuery - The original query
     * @param {Object} searchResults - Wikipedia search results
     * @param {Array} articlesWithContent - Articles with detailed content
     * @returns {Object} Enhanced query context
     */
    async enhanceQueryWithWikipedia(originalQuery, searchResults, articlesWithContent = null) {
        logger.info('🔍 Enhancing query with Wikipedia context...');

        // Use articles with content if provided, otherwise use search results
        const articles = articlesWithContent || searchResults.results;

        // Build Wikipedia context
        const wikipediaContext = {
            originalQuery,
            searchResults: {
                totalHits: searchResults.totalHits,
                searchId: searchResults.searchId,
                articlesFound: searchResults.results.length
            },
            articles: articles.map(article => ({
                title: article.title,
                content: article.content || article.snippet,
                url: article.url,
                relevanceScore: article.relevanceScore,
                hasContent: article.hasContent,
                wordcount: article.wordcount
            })),
            enhancement: {
                type: 'wikipedia',
                timestamp: new Date().toISOString(),
                articleCount: articles.length,
                averageRelevance: this.calculateAverageRelevance(articles)
            }
        };

        // Create enhanced prompt
        const enhancedPrompt = this.buildEnhancedPrompt(originalQuery, wikipediaContext);

        logger.info(`✅ Enhanced query with Wikipedia context (${articles.length} articles)`);
        
        return {
            enhancedPrompt,
            wikipediaContext,
            metadata: {
                searchId: searchResults.searchId,
                articleCount: articles.length,
                totalHits: searchResults.totalHits,
                enhancementType: 'wikipedia'
            }
        };
    }

    /**
     * Execute full Wikipedia pipeline for query enhancement
     * 
     * @param {string} query - Original query
     * @param {Object} options - Pipeline options
     * @returns {Object} Complete Wikipedia enhancement result
     */
    async processQueryWithWikipedia(query, options = {}) {
        logger.info(`🔍 Processing query with full Wikipedia pipeline: "${query}"`);

        try {
            // Step 1: Search Wikipedia
            const searchResults = await this.searchWikipedia(query, options);

            // Step 2: Fetch detailed content for top articles (if requested)
            let articlesWithContent = null;
            if (options.fetchContent !== false && searchResults.results.length > 0) {
                articlesWithContent = await this.fetchArticleContent(searchResults.results, options);
            }

            // Step 3: Store context (if SPARQL helper available)
            let storedContext = [];
            if (this.sparqlHelper && options.storeContext !== false) {
                storedContext = await this.storeWikipediaContext(searchResults, query);
            }

            // Step 4: Create enhanced query context
            const enhancement = await this.enhanceQueryWithWikipedia(
                query, 
                searchResults, 
                articlesWithContent
            );

            return {
                success: true,
                originalQuery: query,
                searchResults,
                articlesWithContent,
                storedContext,
                enhancement,
                stats: {
                    articlesFound: searchResults.results.length,
                    totalHits: searchResults.totalHits,
                    articlesWithContent: articlesWithContent ? articlesWithContent.filter(a => a.hasContent).length : 0,
                    storedContextCount: storedContext.length,
                    averageRelevance: this.calculateAverageRelevance(searchResults.results)
                }
            };

        } catch (error) {
            logger.error('❌ Wikipedia pipeline processing failed:', error.message);
            return {
                success: false,
                originalQuery: query,
                error: error.message,
                stats: {
                    failed: true,
                    errorType: error.constructor.name
                }
            };
        }
    }

    /**
     * Apply rate limiting between requests
     * 
     * @private
     */
    async applyRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.settings.rateLimit) {
            const waitTime = this.settings.rateLimit - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Calculate relevance score for a search result
     * 
     * @private
     * @param {Object} result - Wikipedia search result
     * @param {string} query - Original search query
     * @returns {number} Relevance score between 0 and 1
     */
    calculateRelevanceScore(result, query) {
        const queryLower = query.toLowerCase();
        const titleLower = result.title.toLowerCase();
        const snippetLower = (result.snippet || '').toLowerCase();
        
        // Title match score (higher weight)
        const titleMatch = titleLower.includes(queryLower) ? 0.4 : 
                          this.calculatePartialMatch(titleLower, queryLower) * 0.4;
        
        // Snippet match score
        const snippetMatch = snippetLower.includes(queryLower) ? 0.3 : 
                            this.calculatePartialMatch(snippetLower, queryLower) * 0.3;
        
        // Size/quality bonus (larger articles are often more comprehensive)
        const sizeBonus = result.wordcount ? Math.min(0.3, result.wordcount / 10000 * 0.3) : 0.1;
        
        return Math.min(1.0, titleMatch + snippetMatch + sizeBonus);
    }

    /**
     * Calculate partial match score between two strings
     * 
     * @private
     * @param {string} text - Text to search in
     * @param {string} query - Query to search for
     * @returns {number} Partial match score
     */
    calculatePartialMatch(text, query) {
        const queryWords = query.split(/\s+/);
        const matchedWords = queryWords.filter(word => text.includes(word));
        return matchedWords.length / queryWords.length;
    }

    /**
     * Calculate average relevance score for articles
     * 
     * @private
     * @param {Array} articles - Array of articles
     * @returns {number} Average relevance score
     */
    calculateAverageRelevance(articles) {
        if (!articles || articles.length === 0) return 0;
        const totalRelevance = articles.reduce((sum, article) => sum + (article.relevanceScore || 0), 0);
        return totalRelevance / articles.length;
    }

    /**
     * Build enhanced prompt with Wikipedia context
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} wikipediaContext - Wikipedia context
     * @returns {string} Enhanced prompt
     */
    buildEnhancedPrompt(originalQuery, wikipediaContext) {
        const articleSummaries = wikipediaContext.articles
            .slice(0, 5) // Limit to top 5 articles
            .map((article, index) => 
                `${index + 1}. **${article.title}** (Relevance: ${article.relevanceScore.toFixed(2)})\n   ${article.content.substring(0, 300)}${article.content.length > 300 ? '...' : ''}\n   Source: ${article.url}`
            )
            .join('\n\n');

        return `You are answering a question with Wikipedia knowledge enhancement. Use the provided Wikipedia articles to inform your response with accurate, well-sourced information.

ORIGINAL QUESTION: ${originalQuery}

WIKIPEDIA CONTEXT (${wikipediaContext.articles.length} articles found, ${wikipediaContext.searchResults.totalHits} total hits):

${articleSummaries}

Instructions:
- Use information from the Wikipedia articles to provide a comprehensive answer
- Cite specific Wikipedia sources when referencing information
- If the Wikipedia content doesn't fully address the question, acknowledge this limitation
- Prioritize information from higher relevance articles
- Maintain factual accuracy and provide specific details when available

ANSWER:`;
    }

    /**
     * Build SPARQL query for context storage using template system
     * 
     * @private
     * @param {string} articleURI - URI for the article
     * @param {Object} article - Article data
     * @param {Array} embedding - Embedding vector
     * @param {string} searchId - Search session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    async buildContextStorageQuery(articleURI, article, embedding, searchId, originalQuery) {
        try {
            const embeddingString = embedding ? embedding.map(x => x.toString()).join(',') : '';
            const content = article.content || article.snippet || '';
            
            return await this.queryService.getQuery('store-wikipedia-article', {
                storageGraph: this.settings.storageGraph,
                articleURI: articleURI,
                title: this.escapeForSparql(article.title),
                content: this.escapeForSparql(content),
                snippet: this.escapeForSparql(article.snippet || ''),
                pageUrl: article.url,
                pageId: article.pageId,
                wordCount: article.wordcount || 0,
                relevanceScore: article.relevanceScore || 0,
                searchId: searchId,
                originalQuery: this.escapeForSparql(originalQuery),
                embedding: embeddingString,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Fallback to direct query if template not available
            logger.warn('Using fallback query for Wikipedia storage:', error.message);
            return this.buildFallbackContextStorageQuery(articleURI, article, embedding, searchId, originalQuery);
        }
    }

    /**
     * Build fallback SPARQL query for context storage
     * 
     * @private
     * @param {string} articleURI - URI for the article
     * @param {Object} article - Article data
     * @param {Array} embedding - Embedding vector
     * @param {string} searchId - Search session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    buildFallbackContextStorageQuery(articleURI, article, embedding, searchId, originalQuery) {
        const embeddingString = embedding ? embedding.map(x => x.toString()).join(',') : '';
        const content = article.content || article.snippet || '';
        
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.settings.storageGraph}> {
                    <${articleURI}> a ragno:WikipediaArticle ;
                        dcterms:title "${this.escapeForSparql(article.title)}" ;
                        ragno:content "${this.escapeForSparql(content)}" ;
                        ragno:snippet "${this.escapeForSparql(article.snippet || '')}" ;
                        foaf:page <${article.url}> ;
                        ragno:wikipediaPageId "${article.pageId}" ;
                        ragno:wordCount "${article.wordcount || 0}"^^xsd:integer ;
                        ragno:relevanceScore "${article.relevanceScore || 0}"^^xsd:float ;
                        ragno:searchId "${searchId}" ;
                        ragno:originalQuery "${this.escapeForSparql(originalQuery)}" ;
                        ragno:enhancementSource "wikipedia" ;
                        ${embedding ? `ragno:hasEmbedding "${embeddingString}" ;` : ''}
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        ragno:status "active" .
                }
            }
        `;
    }

    /**
     * Escape string for SPARQL literal
     * 
     * @private
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeForSparql(str) {
        if (!str) return '';
        return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.searchCache.clear();
        logger.info('📋 Wikipedia search cache cleared');
    }

    /**
     * Get service statistics and health information
     * 
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            serviceName: 'WikipediaService',
            settings: this.settings,
            handlers: {
                embedding: !!this.embeddingHandler,
                sparql: !!this.sparqlHelper
            },
            cache: {
                enabled: this.settings.enableCaching,
                size: this.searchCache.size,
                lastRequestTime: this.lastRequestTime
            },
            capabilities: {
                search: true,
                contentFetch: true,
                contextStorage: !!this.sparqlHelper,
                embeddingGeneration: !!this.embeddingHandler
            }
        };
    }
}

export default WikipediaService;