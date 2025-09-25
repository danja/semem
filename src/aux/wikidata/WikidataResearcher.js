/**
 * WikidataResearcher - Orchestrate Wikidata research workflows
 * 
 * This component provides a simplified, standardized API for conducting
 * Wikidata research. It encapsulates the complex workflow of concept extraction,
 * entity searching, RDF conversion, and knowledge graph storage.
 * 
 * API: executeResearch(input, resources, options)
 */

import logger from 'loglevel';
import WikidataSearch from './WikidataSearch.js';
import WikidataToRagno from './WikidataToRagno.js';
import QueryTemplateManager from './QueryTemplateManager.js';

export default class WikidataResearcher {
    constructor() {
        this.stats = {
            totalResearches: 0,
            conceptsExtracted: 0,
            entitiesFound: 0,
            entitiesConverted: 0,
            researchSessions: []
        };
    }

    /**
     * Execute complete Wikidata research workflow
     * 
     * @param {Object} input - Research input data
     * @param {string} input.question - Research question or text to analyze
     * @param {Array<string>} input.concepts - Pre-extracted concepts (optional)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for concept extraction
     * @param {Object} resources.sparqlHelper - SPARQL helper for storage operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @param {number} options.maxEntitiesPerConcept - Max entities per concept (default: 3)
     * @param {number} options.maxWikidataSearchResults - Max search results (default: 15)
     * @param {number} options.minEntityConfidence - Min confidence threshold (default: 0.4)
     * @param {boolean} options.enableHierarchySearch - Enable hierarchy exploration (default: true)
     * @param {boolean} options.storeResults - Store results in knowledge graph (default: true)
     * @returns {Promise<Object>} Research results with entities and metadata
     */
    async executeResearch(input, resources, options = {}) {
        const startTime = Date.now();

        try {
            const { question, concepts: preExtractedConcepts } = input;
            const { llmHandler, sparqlHelper, config } = resources;

            const researchConfig = {
                maxEntitiesPerConcept: options.maxEntitiesPerConcept || 3,
                maxWikidataSearchResults: options.maxWikidataSearchResults || 15,
                minEntityConfidence: options.minEntityConfidence,
                enableHierarchySearch: options.enableHierarchySearch !== false,
                storeResults: options.storeResults !== false,
                storageGraph: options.storageGraph || config.wikidataGraphURI || 'http://purl.org/stuff/wikidata/research',
                ...options
            };

            this.stats.totalResearches++;

            // Step 1: Extract concepts from the question (if not provided)
            let concepts = preExtractedConcepts;
            if (!concepts && llmHandler) {
                const conceptResult = await this._extractConcepts(question, llmHandler, researchConfig);
                if (conceptResult.success) {
                    concepts = conceptResult.concepts;
                    this.stats.conceptsExtracted += concepts.length;
                }
            }

            if (!concepts || concepts.length === 0) {
                // Fallback: use question text directly
                concepts = [question];
            }

            // Step 2: Search Wikidata for entities
            const searchResult = await this._searchWikidataEntities(concepts, researchConfig);

            if (!searchResult.success) {
                return {
                    success: false,
                    error: searchResult.error,
                    question,
                    concepts: concepts || [],
                    ragnoEntities: [],
                    metadata: {
                        researchDuration: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Step 3: Convert to Ragno format
            const conversionResult = await this._convertToRagno(
                searchResult.entities,
                question,
                researchConfig
            );

            // Step 4: Store results (if enabled)
            let storageResult = null;
            if (researchConfig.storeResults && sparqlHelper) {
                storageResult = await this._storeResults(
                    conversionResult.ragnoEntities,
                    question,
                    concepts,
                    sparqlHelper,
                    researchConfig
                );
            }

            // Update statistics
            this.stats.entitiesFound += searchResult.entities.length;
            this.stats.entitiesConverted += conversionResult.ragnoEntities.length;

            // Record session
            const sessionData = {
                question,
                concepts: concepts || [],
                entitiesFound: searchResult.entities.length,
                entitiesConverted: conversionResult.ragnoEntities.length,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                stored: storageResult?.success || false
            };

            this.stats.researchSessions.push(sessionData);

            return {
                success: true,
                question,
                concepts: concepts || [],
                wikidataEntities: searchResult.entities,
                ragnoEntities: conversionResult.ragnoEntities,
                storageResult,
                metadata: {
                    researchDuration: Date.now() - startTime,
                    conceptsUsed: concepts.length,
                    entitiesFound: searchResult.entities.length,
                    entitiesConverted: conversionResult.ragnoEntities.length,
                    stored: storageResult?.success || false,
                    timestamp: new Date().toISOString(),
                    config: researchConfig
                }
            };

        } catch (error) {
            logger.error('Wikidata research failed:', error.message);
            return {
                success: false,
                error: error.message,
                question: input.question,
                concepts: [],
                ragnoEntities: [],
                metadata: {
                    researchDuration: Date.now() - startTime,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get research statistics
     * 
     * @param {Object} input - Statistics input (can be empty)
     * @param {Object} resources - External dependencies (unused)
     * @param {Object} options - Configuration options
     * @param {boolean} options.includeSessionDetails - Include session details (default: false)
     * @returns {Object} Research statistics
     */
    getStatistics(input = {}, resources = {}, options = {}) {
        const stats = {
            totalResearches: this.stats.totalResearches,
            conceptsExtracted: this.stats.conceptsExtracted,
            entitiesFound: this.stats.entitiesFound,
            entitiesConverted: this.stats.entitiesConverted,
            averageEntitiesPerResearch: this.stats.totalResearches > 0 ?
                Math.round(this.stats.entitiesFound / this.stats.totalResearches) : 0,
            conversionRate: this.stats.entitiesFound > 0 ?
                (this.stats.entitiesConverted / this.stats.entitiesFound) : 0
        };

        if (options.includeSessionDetails) {
            stats.recentSessions = this.stats.researchSessions.slice(-5); // Last 5 sessions
        }

        return {
            success: true,
            statistics: stats,
            metadata: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Extract concepts from text using LLM
     * @private
     */
    async _extractConcepts(text, llmHandler, config) {
        try {
            const prompt = `Extract 3-5 key concepts from this text that could be searched in Wikidata:

"${text}"

Return only the concepts, one per line, without explanations or numbers.`;

            const response = await llmHandler.generateResponse(prompt);

            // Parse concepts from response
            const concepts = response
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 2 && line.length < 50)
                .slice(0, 5); // Limit to 5 concepts

            return {
                success: true,
                concepts,
                extractionMethod: 'llm'
            };

        } catch (error) {
            logger.debug('Concept extraction failed:', error.message);
            return {
                success: false,
                error: error.message,
                concepts: []
            };
        }
    }

    /**
     * Search Wikidata for entities based on concepts
     * @private
     */
    async _searchWikidataEntities(concepts, config) {
        try {
            const wikidataSearch = new WikidataSearch({
                maxResults: config.maxWikidataSearchResults,
                minConfidence: config.minEntityConfidence,
                enableHierarchy: config.enableHierarchySearch
            });

            const allEntities = [];
            const searchPromises = concepts.map(concept =>
                wikidataSearch.searchByText(concept)
                    .then(result => result.success ? result.entities : [])
                    .catch(() => [])
            );

            const searchResults = await Promise.all(searchPromises);

            // Flatten and deduplicate entities
            const entityMap = new Map();
            searchResults.forEach(entities => {
                entities.forEach(entity => {
                    if (!entityMap.has(entity.id)) {
                        entityMap.set(entity.id, entity);
                    }
                });
            });

            const entities = Array.from(entityMap.values())
                .slice(0, config.maxWikidataSearchResults);

            return {
                success: true,
                entities,
                conceptsSearched: concepts.length,
                totalFound: entities.length
            };

        } catch (error) {
            logger.error('Wikidata entity search failed:', error.message);
            return {
                success: false,
                error: error.message,
                entities: []
            };
        }
    }

    /**
     * Convert Wikidata entities to Ragno format
     * @private
     */
    async _convertToRagno(entities, originalQuestion, config) {
        try {
            const ragnoConverter = new WikidataToRagno({
                enableDescriptions: true,
                enableProperties: true,
                maxPropertiesPerEntity: 5
            });

            const ragnoEntities = [];

            for (const entity of entities) {
                try {
                    const ragnoEntity = await ragnoConverter.convertEntity(entity, {
                        sourceQuestion: originalQuestion,
                        timestamp: new Date().toISOString()
                    });

                    if (ragnoEntity && ragnoEntity.success) {
                        // Create a proper entity object with label for display
                        const entityObject = {
                            uri: ragnoEntity.entityURI,
                            label: entity.label || entity.id,
                            description: entity.description || '',
                            type: 'wikidata-entity',
                            wikidataId: entity.id,
                            triples: ragnoEntity.ragnoTriples,
                            originalEntity: entity,
                            conversionMetadata: {
                                convertedAt: new Date().toISOString(),
                                sourceQuestion: originalQuestion,
                                conversionMethod: 'wikidata-to-ragno',
                                propertyCount: ragnoEntity.propertyCount || 0
                            }
                        };
                        ragnoEntities.push(entityObject);
                    }
                } catch (conversionError) {
                    logger.debug(`Failed to convert entity ${entity.id}:`, conversionError.message);
                }
            }

            return {
                success: true,
                ragnoEntities,
                originalCount: entities.length,
                convertedCount: ragnoEntities.length
            };

        } catch (error) {
            logger.error('Ragno conversion failed:', error.message);
            return {
                success: false,
                error: error.message,
                ragnoEntities: []
            };
        }
    }

    /**
     * Store research results in knowledge graph
     * @private
     */
    async _storeResults(ragnoEntities, originalQuestion, concepts, sparqlHelper, config) {
        try {
            const triples = [];

            // Create research session metadata
            const sessionURI = `${config.storageGraph}/session/${Date.now()}`;
            triples.push(`<${sessionURI}> a ragno:ResearchSession ;`);
            triples.push(`    ragno:originalQuestion "${this._escapeRDFString(originalQuestion)}" ;`);
            triples.push(`    ragno:conceptsUsed "${concepts.join(', ')}" ;`);
            triples.push(`    ragno:entitiesFound ${ragnoEntities.length} ;`);
            triples.push(`    dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .`);

            // Add entity triples
            ragnoEntities.forEach(entity => {
                if (entity.triples) {
                    triples.push(...entity.triples);
                }
            });

            if (triples.length > 0) {
                const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${config.storageGraph}> {
        ${triples.join('\n        ')}
    }
}`;

                const result = await sparqlHelper.executeUpdate(insertQuery);

                return {
                    success: result.success,
                    triplesStored: triples.length,
                    sessionURI,
                    graph: config.storageGraph
                };
            }

            return {
                success: true,
                triplesStored: 0,
                message: 'No triples to store'
            };

        } catch (error) {
            logger.error('Failed to store research results:', error.message);
            return {
                success: false,
                error: error.message,
                triplesStored: 0
            };
        }
    }

    /**
     * Escape special characters in RDF strings
     * @private
     */
    _escapeRDFString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Clear statistics
     */
    clearStatistics() {
        this.stats = {
            totalResearches: 0,
            conceptsExtracted: 0,
            entitiesFound: 0,
            entitiesConverted: 0,
            researchSessions: []
        };
    }
}