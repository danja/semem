/**
 * Wikipedia Search - Fetches search results from Wikipedia API and ingests as RDF
 * 
 * This class provides Wikipedia search functionality and converts results to RDF
 * using the Ragno vocabulary. Search results are stored as ragno:Unit instances
 * with associated ragno:Entity and ragno:TextElement components.
 */

import fetch from 'node-fetch';
import logger from 'loglevel';
import SPARQLHelper from '../../../examples/beerqa/SPARQLHelper.js';

export default class WikipediaSearch {
    /**
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'http://localhost:3030/wikipedia/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            graphURI: options.graphURI || 'http://purl.org/stuff/wikipedia',
            baseURI: options.baseURI || 'http://purl.org/stuff/wikipedia/',
            ragnoBaseURI: options.ragnoBaseURI || 'http://purl.org/stuff/ragno/',
            wikipediaAPIBase: options.wikipediaAPIBase || 'https://en.wikipedia.org/w/api.php',
            timeout: options.timeout || 30000,
            defaultSearchLimit: options.defaultSearchLimit || 10,
            rateLimit: options.rateLimit || 100,
            ...options
        };

        // Initialize RDF namespaces
        this.namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            dcterms: 'http://purl.org/dc/terms/',
            prov: 'http://www.w3.org/ns/prov#',
            wikipedia: this.options.baseURI
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout,
            continueOnError: false
        });

        // Statistics tracking
        this.stats = {
            totalQueries: 0,
            totalResults: 0,
            processedResults: 0,
            generatedUnits: 0,
            generatedTriples: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Search Wikipedia using the API
     * 
     * @param {string} queryText - Search query text
     * @param {Object} options - Search options
     * @returns {Promise<Object>} - Search results with query metadata
     */
    async search(queryText, options = {}) {
        const searchOptions = {
            delay: options.delay || this.options.rateLimit || 100, // Use configured rate limiting
            limit: options.limit || this.options.defaultSearchLimit || 10,  // Use configured search limit
            ...options
        };

        try {
            logger.info(`Searching Wikipedia for: "${queryText}"`);
            
            // Apply rate limiting if specified
            if (searchOptions.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, searchOptions.delay));
            }

            // Construct Wikipedia API URL
            const apiUrl = new URL(this.options.wikipediaAPIBase);
            apiUrl.searchParams.set('action', 'query');
            apiUrl.searchParams.set('list', 'search');
            apiUrl.searchParams.set('srsearch', queryText);
            apiUrl.searchParams.set('format', 'json');
            apiUrl.searchParams.set('srlimit', searchOptions.limit);
            apiUrl.searchParams.set('srprop', 'title|snippet|size|timestamp|wordcount');

            logger.debug(`Wikipedia API URL: ${apiUrl.toString()}`);

            // Execute search request
            const response = await fetch(apiUrl.toString(), {
                method: 'GET',
                headers: {
                    'User-Agent': 'SememWikipediaSearch/1.0 (https://github.com/danja/semem)',
                    'Accept': 'application/json'
                },
                timeout: this.options.timeout
            });

            if (!response.ok) {
                throw new Error(`Wikipedia API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Validate response structure
            if (!data.query || !data.query.search) {
                throw new Error('Invalid Wikipedia API response structure');
            }

            this.stats.totalQueries++;
            this.stats.totalResults += data.query.search.length;

            logger.info(`Found ${data.query.search.length} Wikipedia results for "${queryText}"`);

            // Return enriched search object
            return {
                query: queryText,
                options: searchOptions,
                timestamp: new Date().toISOString(),
                results: data.query.search,
                totalHits: data.query.searchinfo?.totalhits || data.query.search.length,
                apiResponse: data
            };

        } catch (error) {
            logger.error('Wikipedia search failed:', error);
            this.stats.errors.push(`Search "${queryText}": ${error.message}`);
            throw error;
        }
    }

    /**
     * Ingest search results into SPARQL store as RDF
     * 
     * @param {Object} searchObject - Search results from search() method
     * @returns {Promise<Object>} - Ingestion results
     */
    async ingest(searchObject) {
        try {
            this.stats.startTime = new Date();
            logger.info(`Ingesting ${searchObject.results.length} Wikipedia search results for query: "${searchObject.query}"`);

            // Transform search results to RDF units
            const units = await this.transformToUnits(searchObject);
            logger.info(`Transformed ${units.length} search results to RDF units`);

            // Load units to SPARQL store
            const loadResults = await this.loadUnitsToSPARQL(units);
            logger.info(`Loaded ${loadResults.successful}/${loadResults.total} units to SPARQL store`);

            this.stats.endTime = new Date();
            this.stats.processingTime = this.stats.endTime - this.stats.startTime;

            return {
                success: true,
                query: searchObject.query,
                statistics: this.getStatistics(),
                loadResults: loadResults
            };

        } catch (error) {
            logger.error('Wikipedia ingestion failed:', error);
            this.stats.errors.push(`Ingestion: ${error.message}`);
            this.stats.endTime = new Date();

            return {
                success: false,
                error: error.message,
                query: searchObject.query,
                statistics: this.getStatistics()
            };
        }
    }

    /**
     * Transform Wikipedia search results to RDF units
     * 
     * @param {Object} searchObject - Search results object
     * @returns {Promise<Array>} - Array of RDF unit data
     */
    async transformToUnits(searchObject) {
        const units = [];
        
        for (let i = 0; i < searchObject.results.length; i++) {
            try {
                const result = searchObject.results[i];
                const unit = await this.createUnit(result, searchObject, i);
                units.push(unit);
                
                this.stats.processedResults++;
                this.stats.generatedUnits++;

                if ((i + 1) % 10 === 0) {
                    logger.info(`Processed ${i + 1}/${searchObject.results.length} Wikipedia results`);
                }

            } catch (error) {
                logger.warn(`Failed to transform Wikipedia result ${i}:`, error.message);
                this.stats.errors.push(`Result ${i}: ${error.message}`);
            }
        }

        logger.info(`Successfully transformed ${units.length} Wikipedia results to units`);
        return units;
    }

    /**
     * Create RDF unit from Wikipedia search result
     * 
     * @param {Object} result - Wikipedia search result
     * @param {Object} searchObject - Original search object
     * @param {number} index - Result index
     * @returns {Object} - RDF unit data
     */
    async createUnit(result, searchObject, index) {
        // Generate URIs
        const unitURI = `${this.options.baseURI}unit/${this.generateResultId(result)}`;
        const entityURI = `${this.options.baseURI}entity/${this.generateResultId(result)}`;
        const textElementURI = `${this.options.baseURI}text/${this.generateResultId(result)}`;
        const wikipediaPageURI = `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;

        // Create unit structure
        const unit = {
            uri: unitURI,
            type: 'wikipedia-search-result',
            title: result.title,
            snippet: this.cleanSnippet(result.snippet),
            metadata: {
                query: searchObject.query,
                searchTimestamp: searchObject.timestamp,
                wikipediaPageId: result.pageid,
                wikipediaTitle: result.title,
                wikipediaPageURI: wikipediaPageURI,
                entityURI: entityURI,
                textElementURI: textElementURI,
                size: result.size || 0,
                wordcount: result.wordcount || 0,
                lastModified: result.timestamp,
                resultIndex: index,
                namespace: result.ns || 0
            },
            triples: []
        };

        // Generate RDF triples for the unit
        unit.triples = this.generateUnitTriples(unit, result, searchObject);
        
        this.stats.generatedTriples += unit.triples.length;
        
        return unit;
    }

    /**
     * Generate RDF triples for a Wikipedia unit
     * 
     * @param {Object} unit - Unit data
     * @param {Object} result - Original Wikipedia result
     * @param {Object} searchObject - Original search object
     * @returns {Array} - Array of RDF triple strings
     */
    generateUnitTriples(unit, result, searchObject) {
        const triples = [];
        const unitURI = `<${unit.uri}>`;
        const entityURI = `<${unit.metadata.entityURI}>`;
        const textElementURI = `<${unit.metadata.textElementURI}>`;
        const wikipediaPageURI = `<${unit.metadata.wikipediaPageURI}>`;

        // Core unit properties
        triples.push(`${unitURI} rdf:type ragno:Unit .`);
        triples.push(`${unitURI} rdfs:label ${SPARQLHelper.createLiteral(unit.title)} .`);
        triples.push(`${unitURI} ragno:unitType ${SPARQLHelper.createLiteral(unit.type)} .`);
        
        // Metadata properties
        triples.push(`${unitURI} dcterms:identifier ${SPARQLHelper.createLiteral(unit.metadata.wikipediaPageId.toString())} .`);
        triples.push(`${unitURI} dcterms:source ${SPARQLHelper.createLiteral('wikipedia-search')} .`);
        triples.push(`${unitURI} dcterms:created ${SPARQLHelper.createLiteral(searchObject.timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
        triples.push(`${unitURI} dcterms:modified ${SPARQLHelper.createLiteral(result.timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);

        // Search provenance
        triples.push(`${unitURI} prov:wasGeneratedBy ${SPARQLHelper.createLiteral('wikipedia-search')} .`);
        triples.push(`${unitURI} ragno:searchQuery ${SPARQLHelper.createLiteral(searchObject.query)} .`);
        triples.push(`${unitURI} ragno:resultIndex ${SPARQLHelper.createLiteral(unit.metadata.resultIndex.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        triples.push(`${unitURI} ragno:namespace ${SPARQLHelper.createLiteral(unit.metadata.namespace.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);

        // Entity (Wikipedia page) properties
        triples.push(`${entityURI} rdf:type ragno:Entity .`);
        triples.push(`${entityURI} rdfs:label ${SPARQLHelper.createLiteral(unit.title)} .`);
        triples.push(`${entityURI} ragno:entityType ${SPARQLHelper.createLiteral('wikipedia-page')} .`);
        triples.push(`${entityURI} dcterms:identifier ${SPARQLHelper.createLiteral(unit.metadata.wikipediaPageId.toString())} .`);
        triples.push(`${entityURI} ragno:pageSize ${SPARQLHelper.createLiteral(unit.metadata.size.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        triples.push(`${entityURI} ragno:wordCount ${SPARQLHelper.createLiteral(unit.metadata.wordcount.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        triples.push(`${entityURI} ragno:wikipediaURI ${wikipediaPageURI} .`);
        
        // Unit-Entity relationship
        triples.push(`${unitURI} ragno:hasEntity ${entityURI} .`);
        triples.push(`${entityURI} ragno:belongsToUnit ${unitURI} .`);

        // TextElement (snippet) properties
        triples.push(`${textElementURI} rdf:type ragno:TextElement .`);
        triples.push(`${textElementURI} rdfs:label ${SPARQLHelper.createLiteral('Wikipedia Search Snippet')} .`);
        triples.push(`${textElementURI} ragno:content ${SPARQLHelper.createLiteral(unit.snippet)} .`);
        triples.push(`${textElementURI} ragno:textType ${SPARQLHelper.createLiteral('search-snippet')} .`);
        triples.push(`${textElementURI} ragno:contentLength ${SPARQLHelper.createLiteral(unit.snippet.length.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        
        // TextElement provenance
        triples.push(`${textElementURI} prov:wasDerivedFrom ${wikipediaPageURI} .`);
        triples.push(`${textElementURI} prov:wasGeneratedBy ${SPARQLHelper.createLiteral('wikipedia-search-api')} .`);
        
        // Entity-TextElement relationship
        triples.push(`${entityURI} ragno:hasTextElement ${textElementURI} .`);
        triples.push(`${textElementURI} ragno:describesEntity ${entityURI} .`);

        return triples;
    }

    /**
     * Load units to SPARQL store
     * 
     * @param {Array} units - Array of unit data
     * @returns {Promise<Object>} - Load operation results
     */
    async loadUnitsToSPARQL(units) {
        logger.info(`Loading ${units.length} Wikipedia units to SPARQL store`);
        
        const results = [];
        
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            logger.debug(`Loading unit ${i + 1}/${units.length}: ${unit.title}`);
            
            try {
                const unitTriples = unit.triples.join('\n        ');
                const query = this.sparqlHelper.createInsertDataQuery(this.options.graphURI, unitTriples);
                
                const result = await this.sparqlHelper.executeUpdate(query);
                results.push(result);
                
                if (!result.success) {
                    logger.error(`Unit ${i + 1} (${unit.title}) failed:`, result.error);
                    this.stats.errors.push(`Unit "${unit.title}": ${result.error}`);
                }
                
            } catch (error) {
                logger.error(`Failed to load unit ${i + 1} (${unit.title}):`, error);
                this.stats.errors.push(`Unit "${unit.title}": ${error.message}`);
                results.push({ success: false, error: error.message });
            }
        }
        
        return SPARQLHelper.getExecutionStats(results);
    }

    /**
     * Clean Wikipedia snippet text
     * 
     * @param {string} snippet - Raw snippet from Wikipedia
     * @returns {string} - Cleaned snippet text
     */
    cleanSnippet(snippet) {
        if (!snippet) return '';
        
        return snippet
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&quot;/g, '"') // Convert HTML entities
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    /**
     * Generate unique ID for Wikipedia result
     * 
     * @param {Object} result - Wikipedia search result
     * @returns {string} - Unique result ID
     */
    generateResultId(result) {
        // Use Wikipedia page ID as unique identifier
        return `wp_${result.pageid}`;
    }

    /**
     * Get processing statistics
     * 
     * @returns {Object} - Current statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            processingTimeMs: this.stats.endTime ? this.stats.endTime - this.stats.startTime : null,
            successRate: this.stats.totalResults > 0 ? (this.stats.processedResults / this.stats.totalResults) * 100 : 0,
            avgTriplesPerUnit: this.stats.generatedUnits > 0 ? this.stats.generatedTriples / this.stats.generatedUnits : 0
        };
    }

    /**
     * Query loaded Wikipedia units for verification
     * 
     * @param {number} limit - Maximum number of results to return
     * @returns {Promise<Object>} - Query results
     */
    async queryUnits(limit = 10) {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?unit ?label ?query ?namespace ?entity ?textElement
FROM <${this.options.graphURI}>
WHERE {
    ?unit a ragno:Unit ;
          rdfs:label ?label ;
          ragno:searchQuery ?query ;
          ragno:namespace ?namespace ;
          ragno:hasEntity ?entity .
    ?entity ragno:hasTextElement ?textElement .
}
ORDER BY ?unit
LIMIT ${limit}`;

        try {
            const response = await fetch(queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    ...(this.options.sparqlAuth ? {
                        'Authorization': `Basic ${btoa(`${this.options.sparqlAuth.user}:${this.options.sparqlAuth.password}`)}`
                    } : {})
                },
                body: query
            });

            if (!response.ok) {
                throw new Error(`Query failed: ${response.status} ${response.statusText}`);
            }

            const results = await response.json();
            return results;
            
        } catch (error) {
            logger.error('Failed to query Wikipedia units:', error);
            throw error;
        }
    }

    /**
     * Generate summary report
     * 
     * @returns {Object} - Summary report
     */
    generateReport() {
        const stats = this.getStatistics();
        
        return {
            summary: {
                totalQueries: stats.totalQueries,
                totalResults: stats.totalResults,
                processedResults: stats.processedResults,
                generatedUnits: stats.generatedUnits,
                generatedTriples: stats.generatedTriples,
                successRate: `${stats.successRate.toFixed(2)}%`,
                processingTime: stats.processingTimeMs ? `${(stats.processingTimeMs / 1000).toFixed(2)}s` : 'N/A',
                avgTriplesPerUnit: stats.avgTriplesPerUnit.toFixed(2)
            },
            configuration: {
                graphURI: this.options.graphURI,
                sparqlEndpoint: this.options.sparqlEndpoint,
                wikipediaAPIBase: this.options.wikipediaAPIBase
            },
            errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : [],
            timestamp: new Date().toISOString()
        };
    }
}