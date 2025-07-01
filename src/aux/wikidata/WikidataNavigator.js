/**
 * WikidataNavigator - Enhanced ZPT navigation with Wikidata integration
 * 
 * This component provides enhanced semantic navigation by integrating Wikidata
 * entities into ZPT navigation workflows. It creates cross-references between
 * local knowledge and global Wikidata entities for richer navigation contexts.
 * 
 * API: enhanceNavigation(input, resources, options)
 */

import logger from 'loglevel';
import { ZPTDataFactory } from '../../zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../zpt/ontology/ZPTNamespaces.js';
import WikidataResearcher from './WikidataResearcher.js';

export default class WikidataNavigator {
    constructor() {
        this.wikidataResearcher = new WikidataResearcher();
        this.navigationSessions = [];
    }

    /**
     * Enhance ZPT navigation with Wikidata integration
     * 
     * @param {Object} input - Navigation input data
     * @param {Object} input.question - Question object with text and uri
     * @param {Array<Object>} input.localEntities - Local entities from BeerQA navigation
     * @param {Object} input.navigationContext - Existing navigation context
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for concept extraction
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} resources.embeddingHandler - Embedding handler for similarity (optional)
     * @param {Object} options - Configuration options
     * @param {boolean} options.enableWikidataResearch - Enable Wikidata research (default: true)
     * @param {number} options.maxWikidataEntities - Max Wikidata entities (default: 10)
     * @param {boolean} options.createCrossReferences - Create cross-references (default: true)
     * @param {number} options.similarityThreshold - Similarity threshold for matching (default: 0.7)
     * @returns {Promise<Object>} Enhanced navigation results
     */
    async enhanceNavigation(input, resources, options = {}) {
        const startTime = Date.now();
        
        try {
            const { question, localEntities = [], navigationContext = {} } = input;
            const { llmHandler, sparqlHelper, config, embeddingHandler } = resources;
            
            const navConfig = {
                enableWikidataResearch: options.enableWikidataResearch !== false,
                maxWikidataEntities: options.maxWikidataEntities || 10,
                createCrossReferences: options.createCrossReferences !== false,
                similarityThreshold: options.similarityThreshold || 0.7,
                enhancementLevel: options.enhancementLevel || 'standard',
                ...options
            };

            const enhancementResult = {
                originalEntities: localEntities,
                wikidataEntities: [],
                crossReferences: [],
                enhancedContext: navigationContext,
                relationships: [],
                metadata: {
                    startTime: new Date().toISOString(),
                    enhancementLevel: navConfig.enhancementLevel
                }
            };

            // Step 1: Wikidata research (if enabled)
            if (navConfig.enableWikidataResearch) {
                const researchResult = await this._conductWikidataResearch(
                    question,
                    llmHandler,
                    sparqlHelper,
                    config,
                    navConfig
                );

                if (researchResult.success) {
                    enhancementResult.wikidataEntities = researchResult.ragnoEntities.slice(0, navConfig.maxWikidataEntities);
                    enhancementResult.metadata.wikidataResearchDuration = researchResult.metadata.researchDuration;
                }
            }

            // Step 2: Create cross-references between local and Wikidata entities
            if (navConfig.createCrossReferences && enhancementResult.wikidataEntities.length > 0) {
                const crossRefResult = await this._createCrossReferences(
                    localEntities,
                    enhancementResult.wikidataEntities,
                    embeddingHandler,
                    navConfig
                );

                if (crossRefResult.success) {
                    enhancementResult.crossReferences = crossRefResult.crossReferences;
                    enhancementResult.relationships = crossRefResult.relationships;
                }
            }

            // Step 3: Build enhanced navigation context
            const contextResult = await this._buildEnhancedContext(
                enhancementResult,
                question,
                navConfig
            );

            if (contextResult.success) {
                enhancementResult.enhancedContext = contextResult.context;
                enhancementResult.metadata.contextEnhancement = contextResult.metadata;
            }

            // Step 4: Store navigation session
            const sessionData = {
                questionText: question.text,
                questionURI: question.uri,
                localEntitiesCount: localEntities.length,
                wikidataEntitiesCount: enhancementResult.wikidataEntities.length,
                crossReferencesCount: enhancementResult.crossReferences.length,
                enhancementLevel: navConfig.enhancementLevel,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            this.navigationSessions.push(sessionData);

            // Final metadata
            enhancementResult.metadata = {
                ...enhancementResult.metadata,
                totalDuration: Date.now() - startTime,
                endTime: new Date().toISOString(),
                entitiesTotal: localEntities.length + enhancementResult.wikidataEntities.length,
                enhancementSuccessful: true
            };

            return {
                success: true,
                data: enhancementResult,
                metadata: enhancementResult.metadata
            };

        } catch (error) {
            logger.error('Navigation enhancement failed:', error.message);
            return {
                success: false,
                error: error.message,
                data: {
                    originalEntities: input.localEntities || [],
                    wikidataEntities: [],
                    crossReferences: [],
                    enhancedContext: input.navigationContext || {},
                    relationships: []
                },
                metadata: {
                    totalDuration: Date.now() - startTime,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get enhanced entity context for questions
     * 
     * @param {Object} input - Context input data
     * @param {Array<string>} input.entityURIs - Entity URIs to get context for
     * @param {Object} input.question - Question object
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Enhanced entity context
     */
    async getEnhancedEntityContext(input, resources, options = {}) {
        try {
            const { entityURIs, question } = input;
            const { sparqlHelper, config } = resources;

            if (!entityURIs || entityURIs.length === 0) {
                return {
                    success: true,
                    entities: [],
                    metadata: { contextType: 'empty' }
                };
            }

            // Query multiple graphs for comprehensive context
            const contextQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?graph ?label ?content ?embedding ?conceptValue ?relationshipWeight
WHERE {
    VALUES ?entity { ${entityURIs.map(uri => `<${uri}>`).join(' ')} }
    
    GRAPH ?graph {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL {
            ?entity ragno:hasTextElement ?textElement .
            ?textElement ragno:content ?content .
        }
        
        OPTIONAL {
            ?entity ragno:hasAttribute ?embeddingAttr .
            ?embeddingAttr ragno:attributeType "vector-embedding" ;
                          ragno:attributeValue ?embedding .
        }
        
        OPTIONAL {
            ?entity ragno:hasAttribute ?conceptAttr .
            ?conceptAttr ragno:attributeType "concept" ;
                        ragno:attributeValue ?conceptValue .
        }
        
        OPTIONAL {
            ?relationship ragno:hasTargetEntity ?entity ;
                         ragno:hasSourceEntity <${question.uri}> ;
                         ragno:weight ?relationshipWeight .
        }
    }
    
    FILTER(?graph IN (
        <${config.beerqaGraphURI}>, 
        <${config.wikipediaGraphURI}>, 
        <${config.wikidataGraphURI}>
    ))
}
ORDER BY DESC(?relationshipWeight) ?label`;

            const result = await sparqlHelper.executeSelect(contextQuery);

            if (result.success) {
                const entities = this._processEntityContext(result.data.results.bindings);
                
                return {
                    success: true,
                    entities,
                    metadata: {
                        entitiesFound: entities.length,
                        graphsQueried: 3,
                        contextType: 'enhanced-multi-graph'
                    }
                };
            } else {
                throw new Error(result.error || 'Context query failed');
            }

        } catch (error) {
            logger.error('Failed to get enhanced entity context:', error.message);
            return {
                success: false,
                error: error.message,
                entities: [],
                metadata: {
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get navigation statistics
     * 
     * @param {Object} input - Statistics input (can be empty)
     * @param {Object} resources - External dependencies (unused)
     * @param {Object} options - Configuration options
     * @returns {Object} Navigation statistics
     */
    getNavigationStatistics(input = {}, resources = {}, options = {}) {
        const stats = {
            totalNavigationSessions: this.navigationSessions.length,
            averageWikidataEntities: 0,
            averageCrossReferences: 0,
            averageDuration: 0,
            enhancementLevels: {}
        };

        if (this.navigationSessions.length > 0) {
            stats.averageWikidataEntities = Math.round(
                this.navigationSessions.reduce((sum, s) => sum + s.wikidataEntitiesCount, 0) / 
                this.navigationSessions.length
            );
            
            stats.averageCrossReferences = Math.round(
                this.navigationSessions.reduce((sum, s) => sum + s.crossReferencesCount, 0) / 
                this.navigationSessions.length
            );
            
            stats.averageDuration = Math.round(
                this.navigationSessions.reduce((sum, s) => sum + s.duration, 0) / 
                this.navigationSessions.length
            );

            // Count enhancement levels
            this.navigationSessions.forEach(session => {
                const level = session.enhancementLevel || 'unknown';
                stats.enhancementLevels[level] = (stats.enhancementLevels[level] || 0) + 1;
            });
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
     * Conduct Wikidata research for the question
     * @private
     */
    async _conductWikidataResearch(question, llmHandler, sparqlHelper, config, navConfig) {
        return await this.wikidataResearcher.executeResearch(
            { question: question.text },
            { llmHandler, sparqlHelper, config },
            {
                maxWikidataSearchResults: navConfig.maxWikidataEntities,
                storeResults: true,
                storageGraph: config.wikidataGraphURI
            }
        );
    }

    /**
     * Create cross-references between local and Wikidata entities
     * @private
     */
    async _createCrossReferences(localEntities, wikidataEntities, embeddingHandler, navConfig) {
        try {
            const crossReferences = [];
            const relationships = [];

            // Simple text-based matching for now
            // In production, this would use embeddings for semantic similarity
            for (const localEntity of localEntities) {
                for (const wikidataEntity of wikidataEntities) {
                    const similarity = this._calculateTextSimilarity(
                        localEntity.label || localEntity.content || '',
                        wikidataEntity.label || wikidataEntity.description || ''
                    );

                    if (similarity >= navConfig.similarityThreshold) {
                        const crossRef = {
                            localEntity: localEntity.uri,
                            wikidataEntity: wikidataEntity.uri,
                            similarity: similarity,
                            type: 'semantic-similarity',
                            confidence: similarity
                        };

                        crossReferences.push(crossRef);

                        // Create relationship
                        const relationship = {
                            uri: `${localEntity.uri}/related/${Date.now()}`,
                            sourceEntity: localEntity.uri,
                            targetEntity: wikidataEntity.uri,
                            relationshipType: 'ragno:relatedTo',
                            weight: similarity,
                            source: 'wikidata-enhancement'
                        };

                        relationships.push(relationship);
                    }
                }
            }

            return {
                success: true,
                crossReferences,
                relationships,
                metadata: {
                    localEntitiesProcessed: localEntities.length,
                    wikidataEntitiesProcessed: wikidataEntities.length,
                    crossReferencesCreated: crossReferences.length
                }
            };

        } catch (error) {
            logger.error('Failed to create cross-references:', error.message);
            return {
                success: false,
                error: error.message,
                crossReferences: [],
                relationships: []
            };
        }
    }

    /**
     * Build enhanced navigation context
     * @private
     */
    async _buildEnhancedContext(enhancementResult, question, navConfig) {
        try {
            const context = {
                question: question.text,
                localEntitiesCount: enhancementResult.originalEntities.length,
                wikidataEntitiesCount: enhancementResult.wikidataEntities.length,
                crossReferencesCount: enhancementResult.crossReferences.length,
                enhancementLevel: navConfig.enhancementLevel,
                contextSummary: '',
                entities: [
                    ...enhancementResult.originalEntities,
                    ...enhancementResult.wikidataEntities
                ],
                relationships: enhancementResult.relationships
            };

            // Build context summary
            const totalEntities = context.localEntitiesCount + context.wikidataEntitiesCount;
            context.contextSummary = `Enhanced navigation context with ${totalEntities} entities ` +
                `(${context.localEntitiesCount} local, ${context.wikidataEntitiesCount} Wikidata) ` +
                `and ${context.crossReferencesCount} cross-references.`;

            return {
                success: true,
                context,
                metadata: {
                    contextBuilt: true,
                    totalEntities: totalEntities,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Failed to build enhanced context:', error.message);
            return {
                success: false,
                error: error.message,
                context: {}
            };
        }
    }

    /**
     * Process entity context from SPARQL results
     * @private
     */
    _processEntityContext(bindings) {
        const entityMap = new Map();

        bindings.forEach(binding => {
            const uri = binding.entity.value;
            
            if (!entityMap.has(uri)) {
                entityMap.set(uri, {
                    uri: uri,
                    graph: binding.graph.value,
                    label: binding.label?.value || '',
                    content: binding.content?.value || '',
                    embedding: binding.embedding?.value || null,
                    concepts: [],
                    relationshipWeight: parseFloat(binding.relationshipWeight?.value || 0)
                });
            }

            // Add concept if present
            if (binding.conceptValue?.value) {
                const entity = entityMap.get(uri);
                if (!entity.concepts.includes(binding.conceptValue.value)) {
                    entity.concepts.push(binding.conceptValue.value);
                }
            }
        });

        return Array.from(entityMap.values())
            .sort((a, b) => b.relationshipWeight - a.relationshipWeight);
    }

    /**
     * Calculate simple text similarity
     * @private
     */
    _calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        
        return union.length > 0 ? intersection.length / union.length : 0;
    }

    /**
     * Clear navigation statistics
     */
    clearStatistics() {
        this.navigationSessions = [];
        this.wikidataResearcher.clearStatistics();
    }
}