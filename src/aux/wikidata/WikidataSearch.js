/**
 * WikidataSearch.js - Advanced entity search functionality for Wikidata
 * 
 * This class provides sophisticated search capabilities for finding Wikidata
 * entities using various search strategies: text-based, concept-based,
 * Wikipedia title matching, and hierarchical exploration.
 * 
 * Key Features:
 * - Multi-strategy entity search
 * - Concept-to-entity mapping
 * - Wikipedia article linking
 * - Instance/subclass hierarchy traversal
 * - Search result ranking and filtering
 */

import logger from 'loglevel';
import WikidataConnector from './WikidataConnector.js';

export default class WikidataSearch {
    constructor(options = {}) {
        this.options = {
            defaultLanguage: 'en',
            maxResults: 10,
            minConfidence: 0.3,
            enableHierarchy: true,
            enableImages: false,
            enableCoordinates: false,
            ...options
        };

        this.connector = new WikidataConnector(options);
        
        // Search statistics
        this.stats = {
            searchesByType: {
                text: 0,
                concept: 0,
                wikipedia: 0,
                hierarchy: 0
            },
            totalEntitiesFound: 0,
            averageResultsPerSearch: 0
        };
    }

    /**
     * Search for entities by text with advanced filtering
     * @param {string|Array<string>} searchTerms - Text to search for
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results with ranked entities
     */
    async searchByText(searchTerms, options = {}) {
        const searchOptions = {
            limit: this.options.maxResults,
            language: this.options.defaultLanguage,
            includeAliases: true,
            includeDescriptions: true,
            filterTypes: [], // Optional array of entity types to filter by
            ...options
        };

        this.stats.searchesByType.text++;

        const termArray = Array.isArray(searchTerms) ? searchTerms : [searchTerms];
        
        try {
            // Use Wikidata's full-text search via wikibase:mwapi
            const sparql = this.buildTextSearchQuery(termArray, searchOptions);
            const result = await this.connector.executeQuery(sparql, options);

            if (result.success) {
                const entities = this.processSearchResults(result.data, searchOptions);
                this.updateSearchStats(entities.length);
                
                return {
                    success: true,
                    entities: entities,
                    searchTerms: termArray,
                    totalFound: entities.length,
                    searchType: 'text'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    searchTerms: termArray,
                    searchType: 'text'
                };
            }
        } catch (error) {
            logger.error('Text search failed:', error.message);
            return {
                success: false,
                error: error.message,
                searchTerms: termArray,
                searchType: 'text'
            };
        }
    }

    /**
     * Search for entities by Wikipedia article titles
     * @param {string|Array<string>} titles - Wikipedia article titles
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Matching Wikidata entities
     */
    async searchByWikipediaTitle(titles, options = {}) {
        const searchOptions = {
            language: this.options.defaultLanguage,
            exactMatch: false,
            includeRedirects: true,
            ...options
        };

        this.stats.searchesByType.wikipedia++;

        const titleArray = Array.isArray(titles) ? titles : [titles];

        try {
            const result = await this.connector.findEntitiesByWikipediaTitle(titleArray, searchOptions);

            if (result.success) {
                const entities = this.processWikipediaResults(result.data, searchOptions);
                this.updateSearchStats(entities.length);

                return {
                    success: true,
                    entities: entities,
                    searchTerms: titleArray,
                    totalFound: entities.length,
                    searchType: 'wikipedia'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    searchTerms: titleArray,
                    searchType: 'wikipedia'
                };
            }
        } catch (error) {
            logger.error('Wikipedia title search failed:', error.message);
            return {
                success: false,
                error: error.message,
                searchTerms: titleArray,
                searchType: 'wikipedia'
            };
        }
    }

    /**
     * Search for entities by extracted concepts
     * @param {Array<Object>} concepts - Concept objects with value, type, confidence
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Concept-to-entity mappings
     */
    async searchByConcepts(concepts, options = {}) {
        const searchOptions = {
            minConceptConfidence: this.options.minConfidence,
            maxEntitiesPerConcept: 5,
            prioritizeHighConfidence: true,
            ...options
        };

        this.stats.searchesByType.concept++;

        try {
            const conceptResults = [];

            for (const concept of concepts) {
                // Skip low-confidence concepts
                if (concept.confidence && concept.confidence < searchOptions.minConceptConfidence) {
                    continue;
                }

                // Search for entities matching this concept
                const entitySearch = await this.searchByText(concept.value, {
                    limit: searchOptions.maxEntitiesPerConcept,
                    language: searchOptions.language || this.options.defaultLanguage
                });

                if (entitySearch.success && entitySearch.entities.length > 0) {
                    conceptResults.push({
                        concept: concept,
                        entities: entitySearch.entities,
                        entityCount: entitySearch.entities.length
                    });
                }

                // Add delay between concept searches to respect rate limits
                await this.sleep(100);
            }

            // Sort by concept confidence if available
            if (searchOptions.prioritizeHighConfidence) {
                conceptResults.sort((a, b) => 
                    (b.concept.confidence || 0.5) - (a.concept.confidence || 0.5)
                );
            }

            const totalEntities = conceptResults.reduce((sum, cr) => sum + cr.entityCount, 0);
            this.updateSearchStats(totalEntities);

            return {
                success: true,
                conceptMappings: conceptResults,
                totalConcepts: concepts.length,
                mappedConcepts: conceptResults.length,
                totalEntities: totalEntities,
                searchType: 'concept'
            };

        } catch (error) {
            logger.error('Concept search failed:', error.message);
            return {
                success: false,
                error: error.message,
                totalConcepts: concepts.length,
                searchType: 'concept'
            };
        }
    }

    /**
     * Get instance/subclass hierarchy for entities
     * @param {string|Array<string>} entityIds - Wikidata entity IDs
     * @param {Object} options - Hierarchy options
     * @returns {Promise<Object>} Hierarchical relationships
     */
    async getInstanceHierarchy(entityIds, options = {}) {
        const hierarchyOptions = {
            maxDepth: 3,
            includeSubclasses: true,
            includeInstances: true,
            language: this.options.defaultLanguage,
            ...options
        };

        this.stats.searchesByType.hierarchy++;

        const idArray = Array.isArray(entityIds) ? entityIds : [entityIds];

        try {
            const hierarchyResults = [];

            for (const entityId of idArray) {
                const sparql = this.buildHierarchyQuery(entityId, hierarchyOptions);
                const result = await this.connector.executeQuery(sparql, options);

                if (result.success) {
                    const hierarchy = this.processHierarchyResults(result.data, entityId, hierarchyOptions);
                    hierarchyResults.push(hierarchy);
                }

                // Rate limiting
                await this.sleep(100);
            }

            return {
                success: true,
                hierarchies: hierarchyResults,
                searchType: 'hierarchy'
            };

        } catch (error) {
            logger.error('Hierarchy search failed:', error.message);
            return {
                success: false,
                error: error.message,
                searchType: 'hierarchy'
            };
        }
    }

    /**
     * Build text search query using wikibase:mwapi
     * @private
     */
    buildTextSearchQuery(searchTerms, options) {
        const searchString = searchTerms.join(' ');
        
        return `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?score WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch" .
    bd:serviceParam wikibase:endpoint "www.wikidata.org" .
    bd:serviceParam mwapi:search "${searchString.replace(/"/g, '\\"')}" .
    bd:serviceParam mwapi:language "${options.language}" .
    bd:serviceParam mwapi:limit "${options.limit}" .
    ?item wikibase:apiOutputItem mwapi:item .
    ?score wikibase:apiOutput "@score" .
  }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${options.language}". }
  
  ${options.filterTypes && options.filterTypes.length > 0 ? 
    `FILTER EXISTS { ?item wdt:P31/wdt:P279* ?type . VALUES ?type { ${options.filterTypes.map(t => `wd:${t}`).join(' ')} } }` : 
    ''
  }
}
ORDER BY DESC(?score)`;
    }

    /**
     * Build hierarchy query for P31/P279 relationships
     * @private
     */
    buildHierarchyQuery(entityId, options) {
        return `
SELECT DISTINCT ?related ?relatedLabel ?relationship ?relationshipLabel ?depth WHERE {
  {
    wd:${entityId} wdt:P31* ?related .
    BIND("instanceOf" AS ?relationship)
    BIND(1 AS ?depth)
  }
  ${options.includeSubclasses ? `
  UNION {
    wd:${entityId} wdt:P279* ?related .
    BIND("subclassOf" AS ?relationship)
    BIND(1 AS ?depth)
  }` : ''}
  ${options.includeInstances ? `
  UNION {
    ?related wdt:P31 wd:${entityId} .
    BIND("hasInstance" AS ?relationship)
    BIND(1 AS ?depth)
  }` : ''}
  
  FILTER(?related != wd:${entityId})
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${options.language}". }
}
LIMIT 50`;
    }

    /**
     * Process search results and add confidence scores
     * @private
     */
    processSearchResults(data, options) {
        if (!data.results || !data.results.bindings) return [];

        return data.results.bindings.map(binding => {
            const entity = {
                id: this.extractEntityId(binding.item.value),
                uri: binding.item.value,
                label: binding.itemLabel?.value || 'Unknown',
                description: binding.itemDescription?.value || '',
                score: binding.score ? parseFloat(binding.score.value) : 0.5,
                source: 'wikidata',
                searchType: 'text'
            };

            // Calculate confidence based on score and label match
            entity.confidence = this.calculateConfidence(entity, options);

            return entity;
        }).filter(entity => entity.confidence >= this.options.minConfidence);
    }

    /**
     * Process Wikipedia search results
     * @private
     */
    processWikipediaResults(data, options) {
        if (!data.results || !data.results.bindings) return [];

        return data.results.bindings.map(binding => ({
            id: this.extractEntityId(binding.item.value),
            uri: binding.item.value,
            label: binding.itemLabel?.value || 'Unknown',
            description: binding.itemDescription?.value || '',
            wikipediaTitle: binding.wikipediaTitle?.value || '',
            confidence: 0.9, // High confidence for Wikipedia matches
            source: 'wikidata',
            searchType: 'wikipedia'
        }));
    }

    /**
     * Process hierarchy results
     * @private
     */
    processHierarchyResults(data, rootEntityId, options) {
        if (!data.results || !data.results.bindings) return { rootEntity: rootEntityId, relationships: [] };

        const relationships = data.results.bindings.map(binding => ({
            relatedEntity: {
                id: this.extractEntityId(binding.related.value),
                uri: binding.related.value,
                label: binding.relatedLabel?.value || 'Unknown'
            },
            relationshipType: binding.relationship?.value || 'related',
            depth: parseInt(binding.depth?.value) || 1
        }));

        return {
            rootEntity: rootEntityId,
            relationships: relationships,
            totalRelationships: relationships.length
        };
    }

    /**
     * Calculate confidence score for entity matches
     * @private
     */
    calculateConfidence(entity, options) {
        let confidence = entity.score || 0.5;

        // Boost confidence for exact label matches
        if (options.searchTerm && entity.label.toLowerCase() === options.searchTerm.toLowerCase()) {
            confidence = Math.min(confidence + 0.3, 1.0);
        }

        // Boost confidence for entities with descriptions
        if (entity.description && entity.description.length > 10) {
            confidence = Math.min(confidence + 0.1, 1.0);
        }

        return confidence;
    }

    /**
     * Extract entity ID from Wikidata URI
     * @private
     */
    extractEntityId(uri) {
        const match = uri.match(/\/(Q\d+)$/);
        return match ? match[1] : null;
    }

    /**
     * Update search statistics
     * @private
     */
    updateSearchStats(entityCount) {
        this.stats.totalEntitiesFound += entityCount;
        const totalSearches = Object.values(this.stats.searchesByType).reduce((a, b) => a + b, 0);
        this.stats.averageResultsPerSearch = totalSearches > 0 ? 
            this.stats.totalEntitiesFound / totalSearches : 0;
    }

    /**
     * Sleep utility function
     * @private
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get search statistics
     * @returns {Object} Search usage statistics
     */
    getStats() {
        return {
            ...this.stats,
            connectorStats: this.connector.getStats()
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            searchesByType: {
                text: 0,
                concept: 0,
                wikipedia: 0,
                hierarchy: 0
            },
            totalEntitiesFound: 0,
            averageResultsPerSearch: 0
        };
        this.connector.resetStats();
    }
}