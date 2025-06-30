/**
 * WikidataConnector.js - SPARQL endpoint connector for Wikidata
 * 
 * This class provides rate-limited access to the Wikidata SPARQL endpoint
 * with proper error handling, retry logic, and compliance with Wikidata's
 * usage policies.
 * 
 * Key Features:
 * - Rate limiting to respect Wikidata service limits
 * - User-Agent compliance with Wikidata policies
 * - Retry logic with exponential backoff
 * - Response format handling (JSON/XML)
 * - Query timeout management
 */

import fetch from 'node-fetch';
import logger from 'loglevel';

export default class WikidataConnector {
    constructor(options = {}) {
        this.options = {
            endpoint: options.endpoint || 'https://query.wikidata.org/sparql',
            userAgent: options.userAgent || 'Semem-Research-Bot/1.0 (https://github.com/danja/semem)',
            rateLimit: options.rateLimit || 1000, // 1 second between requests
            timeout: options.timeout || 30000,    // 30 second timeout
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 2000, // Initial retry delay
            ...options
        };

        // Track request timing for rate limiting
        this.lastRequestTime = 0;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalRetries: 0,
            averageResponseTime: 0,
            errors: []
        };
    }

    /**
     * Execute a SPARQL query against the Wikidata endpoint
     * @param {string} sparql - SPARQL query string
     * @param {Object} options - Query-specific options
     * @returns {Promise<Object>} Query results
     */
    async executeQuery(sparql, options = {}) {
        const queryOptions = {
            format: 'json',
            timeout: this.options.timeout,
            ...options
        };

        // Apply rate limiting
        await this.applyRateLimit();

        const startTime = Date.now();
        this.stats.totalRequests++;

        try {
            const result = await this.executeWithRetry(sparql, queryOptions);
            
            // Update statistics
            const responseTime = Date.now() - startTime;
            this.updateResponseTimeStats(responseTime);
            this.stats.successfulRequests++;

            return {
                success: true,
                data: result,
                responseTime: responseTime,
                query: sparql
            };

        } catch (error) {
            this.stats.failedRequests++;
            this.stats.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message,
                query: sparql.substring(0, 200) + '...'
            });

            logger.error('Wikidata query failed:', error.message);
            
            return {
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime,
                query: sparql
            };
        }
    }

    /**
     * Execute query with retry logic
     * @private
     */
    async executeWithRetry(sparql, options, attempt = 1) {
        try {
            return await this.executeSingleQuery(sparql, options);
        } catch (error) {
            if (attempt < this.options.maxRetries && this.isRetryableError(error)) {
                this.stats.totalRetries++;
                
                // Exponential backoff
                const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
                logger.warn(`Wikidata query attempt ${attempt} failed, retrying in ${delay}ms...`);
                
                await this.sleep(delay);
                return this.executeWithRetry(sparql, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Execute a single query without retry logic
     * @private
     */
    async executeSingleQuery(sparql, options) {
        const url = new URL(this.options.endpoint);
        url.searchParams.set('query', sparql);
        url.searchParams.set('format', options.format);

        const requestOptions = {
            method: 'GET',
            headers: {
                'User-Agent': this.options.userAgent,
                'Accept': options.format === 'json' ? 
                    'application/sparql-results+json' : 
                    'application/sparql-results+xml'
            },
            timeout: options.timeout
        };

        logger.debug(`Executing Wikidata query: ${sparql.substring(0, 100)}...`);

        const response = await fetch(url.toString(), requestOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (options.format === 'json') {
            return await response.json();
        } else {
            return await response.text();
        }
    }

    /**
     * Apply rate limiting between requests
     * @private
     */
    async applyRateLimit() {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.options.rateLimit) {
            const delay = this.options.rateLimit - timeSinceLastRequest;
            logger.debug(`Rate limiting: waiting ${delay}ms before next request`);
            await this.sleep(delay);
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Check if an error is retryable
     * @private
     */
    isRetryableError(error) {
        const retryableMessages = [
            'timeout',
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'socket hang up'
        ];

        const retryableStatusCodes = [429, 500, 502, 503, 504];

        // Check for HTTP status codes in error message
        const statusMatch = error.message.match(/HTTP (\d+):/);
        if (statusMatch) {
            const statusCode = parseInt(statusMatch[1]);
            return retryableStatusCodes.includes(statusCode);
        }

        // Check for network errors
        return retryableMessages.some(msg => 
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    /**
     * Update response time statistics
     * @private
     */
    updateResponseTimeStats(responseTime) {
        if (this.stats.successfulRequests === 1) {
            this.stats.averageResponseTime = responseTime;
        } else {
            // Running average
            this.stats.averageResponseTime = 
                (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + responseTime) / 
                this.stats.successfulRequests;
        }
    }

    /**
     * Sleep utility function
     * @private
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Find entities by label (text search)
     * @param {string|Array<string>} labels - Label(s) to search for
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async findEntitiesByLabel(labels, options = {}) {
        const labelArray = Array.isArray(labels) ? labels : [labels];
        const searchOptions = {
            limit: 10,
            language: 'en',
            ...options
        };

        const labelFilters = labelArray.map(label => 
            `CONTAINS(LCASE(?itemLabel), LCASE("${label.replace(/"/g, '\\"')}"))`
        ).join(' || ');

        const sparql = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription WHERE {
  ?item rdfs:label ?itemLabel .
  FILTER(${labelFilters})
  FILTER(LANG(?itemLabel) = "${searchOptions.language}" || LANG(?itemLabel) = "")
  
  OPTIONAL { ?item schema:description ?itemDescription . 
             FILTER(LANG(?itemDescription) = "${searchOptions.language}") }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${searchOptions.language}". }
}
LIMIT ${searchOptions.limit}`;

        return this.executeQuery(sparql, options);
    }

    /**
     * Get entity properties and values
     * @param {string} entityId - Wikidata entity ID (e.g., 'Q146')
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Entity properties
     */
    async getEntityProperties(entityId, options = {}) {
        const queryOptions = {
            limit: 50,
            language: 'en',
            ...options
        };

        const sparql = `
SELECT ?property ?propertyLabel ?value ?valueLabel WHERE {
  wd:${entityId} ?property ?value .
  ?prop wikibase:directClaim ?property .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${queryOptions.language}". }
}
LIMIT ${queryOptions.limit}`;

        return this.executeQuery(sparql, options);
    }

    /**
     * Find entities by Wikipedia article title
     * @param {string|Array<string>} titles - Wikipedia article title(s)
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Matching entities
     */
    async findEntitiesByWikipediaTitle(titles, options = {}) {
        const titleArray = Array.isArray(titles) ? titles : [titles];
        const searchOptions = {
            language: 'en',
            ...options
        };

        const titleFilters = titleArray.map(title => 
            `CONTAINS(LCASE(?wikipediaTitle), LCASE("${title.replace(/"/g, '\\"')}"))`
        ).join(' || ');

        const sparql = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?wikipediaTitle WHERE {
  ?article schema:about ?item ;
           schema:isPartOf <https://${searchOptions.language}.wikipedia.org/> ;
           schema:name ?wikipediaTitle .
  
  FILTER(${titleFilters})
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${searchOptions.language}". }
}`;

        return this.executeQuery(sparql, options);
    }

    /**
     * Get related entities
     * @param {string} entityId - Wikidata entity ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Related entities
     */
    async getEntityRelationships(entityId, options = {}) {
        const queryOptions = {
            limit: 20,
            language: 'en',
            depth: 1,
            ...options
        };

        const sparql = `
SELECT DISTINCT ?related ?relatedLabel ?property ?propertyLabel ?direction WHERE {
  {
    wd:${entityId} ?property ?related .
    BIND("outgoing" AS ?direction)
  }
  UNION
  {
    ?related ?property wd:${entityId} .
    BIND("incoming" AS ?direction)
  }
  
  ?related wdt:P31 ?type .
  ?prop wikibase:directClaim ?property .
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${queryOptions.language}". }
}
LIMIT ${queryOptions.limit}`;

        return this.executeQuery(sparql, options);
    }

    /**
     * Get connector statistics
     * @returns {Object} Usage statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0 ? 
                (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
            averageResponseTime: Math.round(this.stats.averageResponseTime) + 'ms'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalRetries: 0,
            averageResponseTime: 0,
            errors: []
        };
    }
}