/**
 * Web Search Enhancement Service
 * 
 * Provides DuckDuckGo web search integration for query enhancement by finding relevant
 * web content and extracting contextual information to augment responses.
 * 
 * Follows the same pattern as WikipediaService.js for architectural consistency.
 */

import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

const logger = createUnifiedLogger('WebSearchService');
import { search, SafeSearchType } from 'duck-duck-scrape';
import { SPARQLQueryService } from '../sparql/index.js';
import SPARQLHelper from '../sparql/SPARQLHelper.js';

export class WebSearchService {
    constructor(options = {}) {
        this.sparqlHelper = options.sparqlHelper;
        this.embeddingHandler = options.embeddingHandler;
        this.config = options.config;

        // Default configuration
        this.settings = {
            maxResults: options.maxResults || 5,
            rateLimit: options.rateLimit || 1000, // milliseconds between requests
            storageGraph: options.storageGraph,
            maxContentLength: options.maxContentLength || 2000,
            enableCaching: options.enableCaching !== false,
            userAgent: options.userAgent || 'SememEnhancementService/1.0 (https://github.com/danja/hyperdata)',
            safeSearch: options.safeSearch || SafeSearchType.MODERATE,
            region: options.region || 'us-en',
            timeout: options.timeout || 10000,
            ...options.settings
        };

        // Initialize SPARQL query service for template management
        this.queryService = new SPARQLQueryService({
            queryPath: options.queryPath || 'sparql'
        });

        // Cache for web search results
        this.cache = new Map();
        this.lastRequestTime = 0;

        // Statistics
        this.stats = {
            totalQueries: 0,
            successfulQueries: 0,
            cacheHits: 0,
            averageResponseTime: 0,
            lastQueryTime: null
        };

        logger.info('🔍 WebSearchService initialized');
    }

    /**
     * Enhance a query with web search results
     * 
     * @param {string} query - The search query
     * @param {Object} options - Enhancement options
     * @returns {Promise<Object>} Enhancement results
     */
    async enhance(query, options = {}) {
        console.log('🌐 CONSOLE: WebSearchService starting DuckDuckGo search for:', query.substring(0, 50) + '...');
        const startTime = Date.now();

        try {
            this.stats.totalQueries++;

            // Apply rate limiting
            await this.enforceRateLimit();

            // Check cache first
            const cacheKey = this.generateCacheKey(query, options);
            if (this.settings.enableCaching && this.cache.has(cacheKey)) {
                this.stats.cacheHits++;
                logger.debug('🔍 Web search cache hit', { query: query.substring(0, 50) });
                return this.cache.get(cacheKey);
            }

            // Extract searchable terms from the query
            const searchTerms = this.extractSearchableTerms(query);
            if (!searchTerms) {
                return this.createEmptyResult('No searchable terms extracted from query');
            }

            logger.debug('🔍 Performing web search', {
                query: query.substring(0, 50),
                searchTerms: searchTerms.substring(0, 50)
            });

            // Perform DuckDuckGo search
            const searchResults = await this.performSearch(searchTerms, options);

            // Process and format results
            const enhancementResult = await this.processSearchResults(
                searchResults,
                query,
                options
            );

            // Cache the result
            if (this.settings.enableCaching) {
                this.cache.set(cacheKey, enhancementResult);

                // Clean up old cache entries
                if (this.cache.size > 100) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }
            }

            // Update statistics
            this.stats.successfulQueries++;
            this.stats.averageResponseTime = (
                (this.stats.averageResponseTime * (this.stats.successfulQueries - 1) +
                    (Date.now() - startTime)) / this.stats.successfulQueries
            );
            this.stats.lastQueryTime = new Date().toISOString();

            logger.info('🔍 Web search completed', {
                query: query.substring(0, 50),
                resultsCount: enhancementResult.results?.length || 0,
                duration: Date.now() - startTime
            });

            return enhancementResult;

        } catch (error) {
            logger.error('🔍 Web search enhancement failed', {
                query: query.substring(0, 50),
                error: error.message
            });

            return this.createErrorResult(error, query);
        }
    }

    /**
     * Perform the actual DuckDuckGo search
     * 
     * @private
     * @param {string} searchTerms - Processed search terms
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Raw search results
     */
    async performSearch(searchTerms, options = {}) {
        const searchOptions = {
            safeSearch: options.safeSearch || this.settings.safeSearch,
            region: options.region || this.settings.region
        };

        try {
            const results = await Promise.race([
                search(searchTerms, searchOptions),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Search timeout')), this.settings.timeout)
                )
            ]);

            return results;

        } catch (error) {
            throw new Error(`DuckDuckGo search failed: ${error.message}`);
        }
    }

    /**
     * Process and format search results
     * 
     * @private
     * @param {Object} searchResults - Raw search results from DuckDuckGo
     * @param {string} originalQuery - Original query
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed enhancement result
     */
    async processSearchResults(searchResults, originalQuery, options = {}) {
        if (!searchResults?.results || searchResults.results.length === 0) {
            return this.createEmptyResult('No search results found');
        }

        // Filter and rank results by relevance
        const relevantResults = this.filterAndRankResults(
            searchResults.results,
            originalQuery
        ).slice(0, this.settings.maxResults);

        // Extract and clean content
        const processedResults = relevantResults.map((result, index) => {
            const cleanTitle = this.cleanHtmlEntities(result.title || '');
            const cleanDescription = this.cleanHtmlEntities(result.description || '');
            const truncatedDescription = cleanDescription.length > this.settings.maxContentLength
                ? cleanDescription.substring(0, this.settings.maxContentLength) + '...'
                : cleanDescription;

            return {
                id: index + 1,
                title: cleanTitle,
                url: result.url || '',
                description: truncatedDescription,
                domain: this.extractDomain(result.url),
                relevanceScore: result.relevanceScore || 0,
                source: 'web_search'
            };
        });

        // Build contextual information string
        const contextualInfo = this.buildContextualInformation(processedResults);

        return {
            success: true,
            source: 'web_search',
            query: originalQuery,
            results: processedResults,
            contextualInfo,
            instantAnswer: searchResults.abstract || null,
            metadata: {
                searchTerms: this.extractSearchableTerms(originalQuery),
                resultCount: processedResults.length,
                totalFound: searchResults.results?.length || 0,
                searchOptions: {
                    safeSearch: this.settings.safeSearch,
                    region: this.settings.region
                },
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Extract searchable terms from query
     * 
     * @private
     * @param {string} query - Original query
     * @returns {string} Processed search terms
     */
    extractSearchableTerms(query) {
        // Remove question words and extract key terms
        const stopWords = new Set([
            'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could',
            'should', 'would', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'
        ]);

        const terms = query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 5); // Limit to 5 key terms

        return terms.length > 0 ? terms.join(' ') : null;
    }

    /**
     * Filter and rank search results by relevance
     * 
     * @private
     * @param {Array} results - Raw search results
     * @param {string} query - Original query
     * @returns {Array} Filtered and ranked results
     */
    filterAndRankResults(results, query) {
        const queryWords = query.toLowerCase().split(/\s+/);

        return results
            .map(result => ({
                ...result,
                relevanceScore: this.calculateRelevanceScore(result, queryWords)
            }))
            .filter(result => result.relevanceScore > 0.1)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Calculate relevance score for a search result
     * 
     * @private
     * @param {Object} result - Search result
     * @param {Array} queryWords - Query words array
     * @returns {number} Relevance score (0-1)
     */
    calculateRelevanceScore(result, queryWords) {
        const title = (result.title || '').toLowerCase();
        const description = (result.description || '').toLowerCase();
        const url = (result.url || '').toLowerCase();

        let score = 0;
        let totalPossible = 0;

        queryWords.forEach(word => {
            totalPossible += 10; // Max possible score per word

            // Title matches (highest weight)
            if (title.includes(word)) score += 5;

            // Description matches
            if (description.includes(word)) score += 3;

            // URL matches
            if (url.includes(word)) score += 2;

            // Exact phrase matching bonus
            if (title.includes(queryWords.join(' '))) score += 3;
        });

        return totalPossible > 0 ? Math.min(score / totalPossible, 1) : 0;
    }

    /**
     * Build contextual information from results
     * 
     * @private
     * @param {Array} results - Processed search results
     * @returns {string} Formatted contextual information
     */
    buildContextualInformation(results) {
        return results.map((result, index) => {
            return `[${index + 1}] ${result.title}: ${result.description}`;
        }).join('\n\n');
    }

    /**
     * Clean HTML entities from text
     * 
     * @private
     * @param {string} text - Text with HTML entities
     * @returns {string} Cleaned text
     */
    cleanHtmlEntities(text) {
        return text
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#x2F;/g, '/')
            .trim();
    }

    /**
     * Extract domain from URL
     * 
     * @private
     * @param {string} url - Full URL
     * @returns {string} Domain name
     */
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    /**
     * Generate cache key for a query
     * 
     * @private
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {string} Cache key
     */
    generateCacheKey(query, options = {}) {
        const key = `${query}_${options.safeSearch || this.settings.safeSearch}_${options.region || this.settings.region}`;
        return Buffer.from(key).toString('base64').substring(0, 50);
    }

    /**
     * Enforce rate limiting between requests
     * 
     * @private
     * @returns {Promise<void>}
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.settings.rateLimit) {
            const delay = this.settings.rateLimit - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Create empty result object
     * 
     * @private
     * @param {string} reason - Reason for empty result
     * @returns {Object} Empty result
     */
    createEmptyResult(reason) {
        return {
            success: true,
            source: 'web_search',
            results: [],
            contextualInfo: '',
            reason,
            metadata: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Create error result object
     * 
     * @private
     * @param {Error} error - Error object
     * @param {string} query - Original query
     * @returns {Object} Error result
     */
    createErrorResult(error, query) {
        return {
            success: false,
            source: 'web_search',
            error: error.message,
            query: query.substring(0, 100),
            results: [],
            contextualInfo: '',
            metadata: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get service statistics
     * 
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            settings: {
                maxResults: this.settings.maxResults,
                rateLimit: this.settings.rateLimit,
                enableCaching: this.settings.enableCaching
            }
        };
    }

    /**
     * Clear cache and reset statistics
     */
    reset() {
        this.cache.clear();
        this.stats = {
            totalQueries: 0,
            successfulQueries: 0,
            cacheHits: 0,
            averageResponseTime: 0,
            lastQueryTime: null
        };
        logger.info('🔍 WebSearchService reset');
    }
}

export default WebSearchService;