/**
 * ResearchService - Unified interface for Wikipedia and Wikidata research
 * 
 * This service provides a simplified API for conducting research using both
 * Wikipedia and Wikidata sources. It can be used independently or as part
 * of the HTTP API through ResearchAPI.
 * 
 * Features:
 * - Concept extraction and research
 * - Entity discovery and lookup
 * - Wikipedia article search
 * - Combined research workflows
 * - Knowledge graph storage
 */

import WikidataResearcher from './wikidata/WikidataResearcher.js';
import WikipediaSearch from './wikipedia/Search.js';
import WikidataSearch from './wikidata/WikidataSearch.js';
import WikidataConnector from './wikidata/WikidataConnector.js';
import logger from 'loglevel';

export default class ResearchService {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint,
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            defaultGraphURI: options.defaultGraphURI || 'http://purl.org/stuff/research',
            maxEntitiesPerConcept: options.maxEntitiesPerConcept || 3,
            maxSearchResults: options.maxSearchResults || 15,
            minConfidence: options.minConfidence,
            timeout: options.timeout || 30000,
            ...options
        };

        // Initialize service instances
        this.wikidataResearcher = new WikidataResearcher();
        this.wikipediaSearch = new WikipediaSearch({
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.defaultGraphURI,
            timeout: this.options.timeout
        });
        this.wikidataSearch = new WikidataSearch();
        this.wikidataConnector = new WikidataConnector();

        // Statistics
        this.stats = {
            totalResearches: 0,
            wikidataQueries: 0,
            wikipediaQueries: 0,
            entitiesDiscovered: 0,
            conceptsExtracted: 0
        };

        logger.info('ResearchService initialized');
    }

    /**
     * Research concepts using Wikidata
     * 
     * @param {Object} input - Research input
     * @param {string} input.question - Question to research
     * @param {Array<string>} input.concepts - Pre-extracted concepts (optional)
     * @param {Object} resources - Required resources (llmHandler, sparqlHelper, config)
     * @param {Object} options - Research options
     * @returns {Promise<Object>} Research results
     */
    async researchConcepts(input, resources, options = {}) {
        this.stats.totalResearches++;
        this.stats.wikidataQueries++;

        const researchOptions = {
            maxEntitiesPerConcept: options.maxEntitiesPerConcept || this.options.maxEntitiesPerConcept,
            maxWikidataSearchResults: options.maxSearchResults || this.options.maxSearchResults,
            minEntityConfidence: options.minConfidence || this.options.minConfidence,
            enableHierarchySearch: options.enableHierarchySearch !== false,
            storeResults: options.storeResults !== false,
            ...options
        };

        logger.info(`Researching concepts for: "${input.question || 'provided concepts'}"`);

        const result = await this.wikidataResearcher.executeResearch(input, resources, researchOptions);

        this.stats.entitiesDiscovered += result.statistics?.entitiesFound || 0;

        return result;
    }

    /**
     * Search Wikipedia articles
     * 
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async searchWikipedia(query, options = {}) {
        this.stats.wikipediaQueries++;

        const searchOptions = {
            limit: options.limit || 10,
            offset: options.offset || 0,
            namespace: options.namespace || '0',
            format: options.format || 'json',
            ingestResults: options.ingestResults !== false,
            ...options
        };

        logger.info(`Searching Wikipedia for: "${query}"`);

        return await this.wikipediaSearch.search(query, searchOptions);
    }

    /**
     * Combined research using both Wikidata and Wikipedia
     * 
     * @param {string} question - Research question
     * @param {Object} resources - Required resources (llmHandler, sparqlHelper, config)
     * @param {Object} options - Research options
     * @returns {Promise<Object>} Combined research results
     */
    async combinedResearch(question, resources, options = {}) {
        this.stats.totalResearches++;

        logger.info(`Starting combined research for: "${question}"`);

        const results = {};

        // Step 1: Wikidata research
        try {
            results.wikidata = await this.researchConcepts(
                { question },
                resources,
                {
                    ...options,
                    storeResults: options.storeWikidataResults !== false
                }
            );
        } catch (error) {
            logger.warn('Wikidata research failed:', error.message);
            results.wikidata = { error: error.message };
        }

        // Step 2: Wikipedia search
        try {
            results.wikipedia = await this.searchWikipedia(question, {
                limit: options.wikipediaLimit || 5,
                ingestResults: options.storeWikipediaResults !== false
            });
        } catch (error) {
            logger.warn('Wikipedia search failed:', error.message);
            results.wikipedia = { error: error.message };
        }

        // Generate summary
        results.summary = {
            entitiesFound: results.wikidata?.statistics?.entitiesFound || 0,
            wikipediaArticles: results.wikipedia?.results?.length || 0,
            totalSources: (results.wikidata?.statistics?.entitiesFound || 0) +
                (results.wikipedia?.results?.length || 0),
            hasWikidataResults: !results.wikidata?.error,
            hasWikipediaResults: !results.wikipedia?.error
        };

        return results;
    }

    /**
     * Look up a specific entity by ID or name
     * 
     * @param {Object} params - Lookup parameters
     * @param {string} params.entityId - Wikidata entity ID (e.g., Q42)
     * @param {string} params.entityName - Entity name to search for
     * @param {string} params.language - Language code (default: 'en')
     * @returns {Promise<Object>} Entity details
     */
    async lookupEntity({ entityId, entityName, language = 'en' }) {
        if (!entityId && !entityName) {
            throw new Error('Either entityId or entityName must be provided');
        }

        logger.info(`Looking up entity: ${entityId || entityName}`);

        if (entityId) {
            // Direct lookup by ID
            return await this.wikidataConnector.getEntityDetails(entityId, { language });
        } else {
            // Search by name first
            const searchResults = await this.wikidataSearch.searchEntities(entityName, {
                language,
                limit: 1
            });

            if (searchResults.length === 0) {
                throw new Error(`No entity found with name: ${entityName}`);
            }

            const foundEntityId = searchResults[0].id;
            return await this.wikidataConnector.getEntityDetails(foundEntityId, { language });
        }
    }

    /**
     * Extract concepts from text and optionally research them
     * 
     * @param {string} text - Text to analyze
     * @param {Object} resources - Required resources (llmHandler)
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Concept extraction and research results
     */
    async extractAndResearchConcepts(text, resources, options = {}) {
        const { llmHandler } = resources;

        if (!llmHandler) {
            throw new Error('LLM handler is required for concept extraction');
        }

        logger.info(`Extracting concepts from text (${text.length} chars)`);

        // Extract concepts
        const concepts = await llmHandler.extractConcepts(text);
        this.stats.conceptsExtracted += concepts.length;

        const result = {
            concepts,
            summary: {
                conceptsExtracted: concepts.length
            }
        };

        // Optionally research concepts using Wikidata
        if (options.searchWikidata !== false && concepts.length > 0) {
            try {
                result.wikidataResults = await this.researchConcepts(
                    { concepts },
                    resources,
                    {
                        maxEntitiesPerConcept: options.maxEntitiesPerConcept || 2,
                        storeResults: options.storeResults !== false
                    }
                );

                result.summary.entitiesFound = result.wikidataResults.statistics?.entitiesFound || 0;
            } catch (error) {
                logger.warn('Concept research failed:', error.message);
                result.wikidataResults = { error: error.message };
            }
        }

        return result;
    }

    /**
     * Batch research multiple questions
     * 
     * @param {Array<string>} questions - Questions to research
     * @param {Object} resources - Required resources
     * @param {Object} options - Research options
     * @returns {Promise<Array>} Array of research results
     */
    async batchResearch(questions, resources, options = {}) {
        logger.info(`Starting batch research for ${questions.length} questions`);

        const results = [];
        const batchSize = options.batchSize || 3;
        const useParallel = options.parallel !== false;

        if (useParallel) {
            // Process in parallel batches
            for (let i = 0; i < questions.length; i += batchSize) {
                const batch = questions.slice(i, i + batchSize);
                const batchPromises = batch.map(async (question, index) => {
                    try {
                        const result = await this.combinedResearch(question, resources, options);
                        return {
                            index: i + index,
                            question,
                            success: true,
                            result
                        };
                    } catch (error) {
                        logger.warn(`Batch research failed for question ${i + index}:`, error.message);
                        return {
                            index: i + index,
                            question,
                            success: false,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Brief pause between batches to avoid overwhelming services
                if (i + batchSize < questions.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            // Process sequentially
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                try {
                    const result = await this.combinedResearch(question, resources, options);
                    results.push({
                        index: i,
                        question,
                        success: true,
                        result
                    });
                } catch (error) {
                    logger.warn(`Sequential research failed for question ${i}:`, error.message);
                    results.push({
                        index: i,
                        question,
                        success: false,
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            averageEntitiesPerQuery: this.stats.wikidataQueries > 0 ?
                (this.stats.entitiesDiscovered / this.stats.wikidataQueries).toFixed(2) : 0
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalResearches: 0,
            wikidataQueries: 0,
            wikipediaQueries: 0,
            entitiesDiscovered: 0,
            conceptsExtracted: 0
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newOptions) {
        this.options = {
            ...this.options,
            ...newOptions
        };

        // Update Wikipedia search configuration
        this.wikipediaSearch.options = {
            ...this.wikipediaSearch.options,
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.defaultGraphURI,
            timeout: this.options.timeout
        };

        logger.info('ResearchService configuration updated');
    }
}