/**
 * Wikidata Enhancement Service
 * 
 * Provides Wikidata entity and relationship integration for query enhancement by
 * finding relevant entities, relationships, and structured knowledge to augment responses.
 * 
 * Extracted and refactored from examples/beerqa-wikidata/WikidataGetResult.js into core service
 * following structured patterns and using SPARQL template system.
 */

import logger from 'loglevel';
import fetch from 'node-fetch';
import { SPARQLQueryService } from '../sparql/index.js';
import SPARQLHelper from '../sparql/SPARQLHelper.js';

export class WikidataService {
    constructor(options = {}) {
        this.sparqlHelper = options.sparqlHelper;
        this.config = options.config;

        // Default configuration
        this.settings = {
            wikidataEndpoint: options.wikidataEndpoint || 'https://query.wikidata.org/sparql',
            entityEndpoint: options.entityEndpoint || 'https://www.wikidata.org/wiki/Special:EntityData',
            searchEndpoint: options.searchEndpoint || 'https://www.wikidata.org/w/api.php',
            maxEntities: options.maxEntities || 10,
            maxRelationships: options.maxRelationships || 20,
            rateLimit: options.rateLimit || 500, // milliseconds between requests
            storageGraph: options.storageGraph,
            enableCaching: options.enableCaching !== false,
            userAgent: options.userAgent || 'SememEnhancementService/1.0 (https://github.com/danja/hyperdata)',
            timeout: options.timeout || 10000,
            languages: options.languages || ['en'],
            ...options.settings
        };

        // Initialize SPARQL query service for template management
        this.queryService = new SPARQLQueryService({
            queryPath: options.queryPath || 'sparql'
        });

        // Cache for Wikidata results
        this.entityCache = new Map();
        this.relationshipCache = new Map();
        this.lastRequestTime = 0;
    }

    /**
     * Search Wikidata for entities related to a query
     * 
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @returns {Object} Wikidata entity search results
     */
    async searchWikidataEntities(query, options = {}) {
        logger.info(`🔍 Searching Wikidata entities for: "${query}"`);

        const limit = options.limit || this.settings.maxEntities;
        const cacheKey = `entities:${query}:${limit}`;

        // Check cache first
        if (this.settings.enableCaching && this.entityCache.has(cacheKey)) {
            logger.info('📋 Using cached Wikidata entity results');
            return this.entityCache.get(cacheKey);
        }

        try {
            // Apply rate limiting
            await this.applyRateLimit();

            // Build entity search parameters
            const searchParams = new URLSearchParams({
                action: 'wbsearchentities',
                format: 'json',
                search: query,
                language: this.settings.languages[0],
                type: 'item',
                limit: limit,
                origin: '*'
            });

            const searchUrl = `${this.settings.searchEndpoint}?${searchParams}`;

            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.settings.userAgent,
                    'Accept': 'application/json'
                },
                timeout: this.settings.timeout
            });

            if (!response.ok) {
                throw new Error(`Wikidata search API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.search) {
                throw new Error('Invalid Wikidata search API response format');
            }

            const entities = data.search.map(entity => ({
                wikidataId: entity.id,
                label: entity.label,
                description: entity.description || '',
                url: entity.concepturi,
                match: entity.match || {},
                relevanceScore: this.calculateEntityRelevance(entity, query),
                aliases: entity.aliases || []
            }));

            const searchResults = {
                query,
                entities,
                totalFound: entities.length,
                timestamp: new Date().toISOString(),
                searchId: `wikidata_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
            };

            // Cache results
            if (this.settings.enableCaching) {
                this.entityCache.set(cacheKey, searchResults);
            }

            logger.info(`✅ Found ${entities.length} Wikidata entities`);
            return searchResults;

        } catch (error) {
            logger.error('❌ Wikidata entity search failed:', error.message);
            throw new Error(`Wikidata entity search failed: ${error.message}`);
        }
    }

    /**
     * Get detailed entity information and relationships from Wikidata
     * 
     * @param {Array} entityIds - Array of Wikidata entity IDs (e.g., ['Q123', 'Q456'])
     * @param {Object} options - Fetch options
     * @returns {Object} Detailed entity information with relationships
     */
    async getEntityDetails(entityIds, options = {}) {
        logger.info(`📄 Fetching details for ${entityIds.length} Wikidata entities`);

        const maxEntities = Math.min(entityIds.length, options.maxEntities || this.settings.maxEntities);
        const entitiesToFetch = entityIds.slice(0, maxEntities);

        const cacheKey = `details:${entitiesToFetch.join(',')}`;

        // Check cache first
        if (this.settings.enableCaching && this.entityCache.has(cacheKey)) {
            logger.info('📋 Using cached Wikidata entity details');
            return this.entityCache.get(cacheKey);
        }

        try {
            // Apply rate limiting
            await this.applyRateLimit();

            // Build SPARQL query for entity details and relationships
            const sparqlQuery = this.buildEntityDetailsQuery(entitiesToFetch, options);

            const response = await fetch(this.settings.wikidataEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.settings.userAgent,
                    'Accept': 'application/sparql-results+json'
                },
                body: `query=${encodeURIComponent(sparqlQuery)}`,
                timeout: this.settings.timeout
            });

            if (!response.ok) {
                throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.results || !data.results.bindings) {
                throw new Error('Invalid Wikidata SPARQL response format');
            }

            // Process results into structured format
            const entityDetails = this.processEntityDetails(data.results.bindings, entitiesToFetch);

            const detailsResult = {
                entityIds: entitiesToFetch,
                entities: entityDetails.entities,
                relationships: entityDetails.relationships,
                totalEntities: entityDetails.entities.length,
                totalRelationships: entityDetails.relationships.length,
                timestamp: new Date().toISOString(),
                detailsId: `details_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
            };

            // Cache results
            if (this.settings.enableCaching) {
                this.entityCache.set(cacheKey, detailsResult);
            }

            logger.info(`✅ Retrieved details for ${entityDetails.entities.length} entities with ${entityDetails.relationships.length} relationships`);
            return detailsResult;

        } catch (error) {
            logger.error('❌ Wikidata entity details fetch failed:', error.message);
            throw new Error(`Wikidata entity details fetch failed: ${error.message}`);
        }
    }

    /**
     * Store Wikidata context with relationships using SPARQL templates
     * 
     * @param {Object} entityDetails - Wikidata entity details and relationships
     * @param {string} originalQuery - The original query
     * @returns {Array} Array of stored context results
     */
    async storeWikidataContext(entityDetails, originalQuery) {
        if (!this.sparqlHelper || !entityDetails.entities || entityDetails.entities.length === 0) {
            logger.warn('No SPARQL helper provided or no Wikidata entities to store');
            return [];
        }

        logger.info('💾 Storing Wikidata context with relationships...');

        const results = [];

        try {
            // Store entities
            for (const entity of entityDetails.entities) {
                const entityURI = `http://purl.org/stuff/instance/wikidata-entity/${entity.wikidataId}`;

                const insertQuery = await this.buildEntityStorageQuery(
                    entityURI,
                    entity,
                    entityDetails.detailsId,
                    originalQuery
                );

                const result = await this.sparqlHelper.executeUpdate(insertQuery);

                if (!result.success) {
                    logger.error('SPARQL entity storage failed:', result.error);
                    throw new Error(`Failed to store Wikidata entity: ${result.error}`);
                }

                results.push({
                    uri: entityURI,
                    wikidataId: entity.wikidataId,
                    label: entity.label,
                    type: 'entity'
                });
            }

            // Store relationships
            for (const relationship of entityDetails.relationships) {
                const relationshipURI = `http://purl.org/stuff/instance/wikidata-relationship/${relationship.relationshipId}`;

                const insertQuery = await this.buildRelationshipStorageQuery(
                    relationshipURI,
                    relationship,
                    entityDetails.detailsId,
                    originalQuery
                );

                const result = await this.sparqlHelper.executeUpdate(insertQuery);

                if (!result.success) {
                    logger.error('SPARQL relationship storage failed:', result.error);
                    throw new Error(`Failed to store Wikidata relationship: ${result.error}`);
                }

                results.push({
                    uri: relationshipURI,
                    sourceEntity: relationship.sourceEntity,
                    targetEntity: relationship.targetEntity,
                    property: relationship.property,
                    type: 'relationship'
                });
            }

            logger.info(`✅ Stored ${results.length} Wikidata items (${entityDetails.entities.length} entities, ${entityDetails.relationships.length} relationships)`);
            return results;

        } catch (error) {
            logger.error('❌ Failed to store Wikidata context:', error.message);
            throw error;
        }
    }

    /**
     * Enhance a query with Wikidata-derived context
     * 
     * @param {string} originalQuery - The original query
     * @param {Object} entitySearchResults - Entity search results
     * @param {Object} entityDetails - Detailed entity information
     * @returns {Object} Enhanced query context
     */
    async enhanceQueryWithWikidata(originalQuery, entitySearchResults, entityDetails = null) {
        logger.info('🔍 Enhancing query with Wikidata context...');

        // Build Wikidata context
        const wikidataContext = {
            originalQuery,
            entitySearch: {
                totalFound: entitySearchResults.totalFound,
                searchId: entitySearchResults.searchId,
                entities: entitySearchResults.entities.length
            },
            entities: entitySearchResults.entities.map(entity => ({
                wikidataId: entity.wikidataId,
                label: entity.label,
                description: entity.description,
                url: entity.url,
                relevanceScore: entity.relevanceScore
            })),
            relationships: entityDetails ? entityDetails.relationships.map(rel => ({
                sourceEntity: rel.sourceEntityLabel || rel.sourceEntity,
                property: rel.propertyLabel || rel.property,
                targetEntity: rel.targetEntityLabel || rel.targetEntity,
                confidence: rel.confidence || 1.0
            })) : [],
            enhancement: {
                type: 'wikidata',
                timestamp: new Date().toISOString(),
                entityCount: entitySearchResults.entities.length,
                relationshipCount: entityDetails ? entityDetails.relationships.length : 0
            }
        };

        // Create enhanced prompt
        const enhancedPrompt = this.buildEnhancedPrompt(originalQuery, wikidataContext);

        logger.info(`✅ Enhanced query with Wikidata context (${entitySearchResults.entities.length} entities, ${wikidataContext.relationships.length} relationships)`);

        return {
            enhancedPrompt,
            wikidataContext,
            metadata: {
                searchId: entitySearchResults.searchId,
                detailsId: entityDetails?.detailsId,
                entityCount: entitySearchResults.entities.length,
                relationshipCount: wikidataContext.relationships.length,
                enhancementType: 'wikidata'
            }
        };
    }

    /**
     * Execute full Wikidata pipeline for query enhancement
     * 
     * @param {string} query - Original query
     * @param {Object} options - Pipeline options
     * @returns {Object} Complete Wikidata enhancement result
     */
    async processQueryWithWikidata(query, options = {}) {
        logger.info(`🔍 Processing query with full Wikidata pipeline: "${query}"`);

        try {
            // Step 1: Search for entities
            const entitySearchResults = await this.searchWikidataEntities(query, options);

            // Step 2: Get detailed entity information (if entities found and requested)
            let entityDetails = null;
            if (entitySearchResults.entities.length > 0 && options.fetchDetails !== false) {
                const entityIds = entitySearchResults.entities.map(e => e.wikidataId);
                entityDetails = await this.getEntityDetails(entityIds, options);
            }

            // Step 3: Store context (if SPARQL helper available)
            let storedContext = [];
            if (this.sparqlHelper && options.storeContext !== false && entityDetails) {
                storedContext = await this.storeWikidataContext(entityDetails, query);
            }

            // Step 4: Create enhanced query context
            const enhancement = await this.enhanceQueryWithWikidata(
                query,
                entitySearchResults,
                entityDetails
            );

            return {
                success: true,
                originalQuery: query,
                entitySearchResults,
                entityDetails,
                storedContext,
                enhancement,
                stats: {
                    entitiesFound: entitySearchResults.entities.length,
                    relationshipsFound: entityDetails ? entityDetails.relationships.length : 0,
                    storedContextCount: storedContext.length,
                    averageRelevance: this.calculateAverageRelevance(entitySearchResults.entities)
                }
            };

        } catch (error) {
            logger.error('❌ Wikidata pipeline processing failed:', error.message);
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
     * Build SPARQL query for entity details and relationships
     * 
     * @private
     * @param {Array} entityIds - Array of entity IDs
     * @param {Object} options - Query options
     * @returns {string} SPARQL query
     */
    buildEntityDetailsQuery(entityIds, options = {}) {
        const entityValues = entityIds.map(id => `wd:${id}`).join(' ');
        const language = this.settings.languages[0];
        const relationshipLimit = options.maxRelationships || this.settings.maxRelationships;

        return `
            SELECT DISTINCT ?entity ?entityLabel ?entityDescription 
                   ?property ?propertyLabel 
                   ?value ?valueLabel 
                   ?valueType
            WHERE {
                VALUES ?entity { ${entityValues} }
                
                # Get entity labels and descriptions
                OPTIONAL {
                    ?entity rdfs:label ?entityLabel .
                    FILTER(LANG(?entityLabel) = "${language}")
                }
                OPTIONAL {
                    ?entity schema:description ?entityDescription .
                    FILTER(LANG(?entityDescription) = "${language}")
                }
                
                # Get properties and values
                OPTIONAL {
                    ?entity ?property ?value .
                    ?property rdfs:label ?propertyLabel .
                    FILTER(LANG(?propertyLabel) = "${language}")
                    
                    # Determine value type
                    BIND(IF(ISURI(?value), 
                        IF(STRSTARTS(STR(?value), "http://www.wikidata.org/entity/Q"), "entity", "uri"),
                        IF(ISLITERAL(?value), "literal", "other")
                    ) AS ?valueType)
                    
                    # Get labels for entity values
                    OPTIONAL {
                        ?value rdfs:label ?valueLabel .
                        FILTER(LANG(?valueLabel) = "${language}")
                    }
                    
                    # Filter to important properties only
                    FILTER(?property != wdt:P31 || ?property = wdt:P31) # instance of
                    FILTER(?property != wdt:P279 || ?property = wdt:P279) # subclass of
                }
            }
            LIMIT ${relationshipLimit * entityIds.length}
        `;
    }

    /**
     * Process entity details from SPARQL results
     * 
     * @private
     * @param {Array} bindings - SPARQL result bindings
     * @param {Array} entityIds - Original entity IDs
     * @returns {Object} Processed entities and relationships
     */
    processEntityDetails(bindings, entityIds) {
        const entitiesMap = new Map();
        const relationships = [];

        for (const binding of bindings) {
            const entityId = binding.entity.value.split('/').pop();

            // Process entity
            if (!entitiesMap.has(entityId)) {
                entitiesMap.set(entityId, {
                    wikidataId: entityId,
                    label: binding.entityLabel?.value || entityId,
                    description: binding.entityDescription?.value || '',
                    url: binding.entity.value,
                    properties: []
                });
            }

            // Process relationships
            if (binding.property && binding.value) {
                const relationship = {
                    relationshipId: `${entityId}_${binding.property.value.split('/').pop()}_${Date.now()}`,
                    sourceEntity: entityId,
                    sourceEntityLabel: binding.entityLabel?.value || entityId,
                    property: binding.property.value.split('/').pop(),
                    propertyLabel: binding.propertyLabel?.value || binding.property.value.split('/').pop(),
                    targetEntity: binding.value.value,
                    targetEntityLabel: binding.valueLabel?.value || binding.value.value,
                    valueType: binding.valueType?.value || 'unknown',
                    confidence: 1.0
                };

                relationships.push(relationship);

                // Add to entity properties
                entitiesMap.get(entityId).properties.push({
                    property: relationship.property,
                    propertyLabel: relationship.propertyLabel,
                    value: relationship.targetEntity,
                    valueLabel: relationship.targetEntityLabel,
                    valueType: relationship.valueType
                });
            }
        }

        return {
            entities: Array.from(entitiesMap.values()),
            relationships: relationships.slice(0, this.settings.maxRelationships)
        };
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
     * Calculate relevance score for an entity
     * 
     * @private
     * @param {Object} entity - Wikidata entity
     * @param {string} query - Original query
     * @returns {number} Relevance score between 0 and 1
     */
    calculateEntityRelevance(entity, query) {
        const queryLower = query.toLowerCase();
        const labelLower = (entity.label || '').toLowerCase();
        const descLower = (entity.description || '').toLowerCase();

        // Exact label match
        if (labelLower === queryLower) return 1.0;

        // Label contains query
        if (labelLower.includes(queryLower)) return 0.8;

        // Description contains query
        if (descLower.includes(queryLower)) return 0.6;

        // Partial match in label
        const labelMatch = this.calculatePartialMatch(labelLower, queryLower);
        if (labelMatch > 0.5) return 0.4 + (labelMatch * 0.2);

        // Partial match in description
        const descMatch = this.calculatePartialMatch(descLower, queryLower);
        return 0.2 + (descMatch * 0.2);
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
     * Calculate average relevance score for entities
     * 
     * @private
     * @param {Array} entities - Array of entities
     * @returns {number} Average relevance score
     */
    calculateAverageRelevance(entities) {
        if (!entities || entities.length === 0) return 0;
        const totalRelevance = entities.reduce((sum, entity) => sum + (entity.relevanceScore || 0), 0);
        return totalRelevance / entities.length;
    }

    /**
     * Build enhanced prompt with Wikidata context
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} wikidataContext - Wikidata context
     * @returns {string} Enhanced prompt
     */
    buildEnhancedPrompt(originalQuery, wikidataContext) {
        const entitySummaries = wikidataContext.entities
            .slice(0, 5) // Limit to top 5 entities
            .map((entity, index) =>
                `${index + 1}. **${entity.label}** (${entity.wikidataId})\n   ${entity.description}\n   Relevance: ${entity.relevanceScore.toFixed(2)} | URL: ${entity.url}`
            )
            .join('\n\n');

        const relationshipSummaries = wikidataContext.relationships
            .slice(0, 10) // Limit to top 10 relationships
            .map(rel => `• ${rel.sourceEntity} → ${rel.property} → ${rel.targetEntity}`)
            .join('\n');

        return `You are answering a question with Wikidata knowledge enhancement. Use the provided structured knowledge from Wikidata to inform your response with accurate, linked data.

ORIGINAL QUESTION: ${originalQuery}

WIKIDATA ENTITIES (${wikidataContext.entities.length} found):

${entitySummaries}

${wikidataContext.relationships.length > 0 ? `
ENTITY RELATIONSHIPS (${wikidataContext.relationships.length} found):

${relationshipSummaries}
` : ''}

Instructions:
- Use information from the Wikidata entities and relationships to provide a comprehensive answer
- Reference specific Wikidata entities by their labels and IDs when relevant
- Leverage the structured relationships to explain connections between concepts
- If the Wikidata content doesn't fully address the question, acknowledge this limitation
- Maintain factual accuracy using the authoritative structured data provided

ANSWER:`;
    }

    /**
     * Build SPARQL query for entity storage using template system
     * 
     * @private
     * @param {string} entityURI - URI for the entity
     * @param {Object} entity - Entity data
     * @param {string} detailsId - Details session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    async buildEntityStorageQuery(entityURI, entity, detailsId, originalQuery) {
        try {
            return await this.queryService.getQuery('store-wikidata-entity', {
                storageGraph: this.settings.storageGraph,
                entityURI: entityURI,
                wikidataId: entity.wikidataId,
                label: this.escapeForSparql(entity.label),
                description: this.escapeForSparql(entity.description),
                wikidataUrl: entity.url,
                detailsId: detailsId,
                originalQuery: this.escapeForSparql(originalQuery),
                relevanceScore: entity.relevanceScore || 0,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Fallback to direct query if template not available
            logger.warn('Using fallback query for Wikidata entity storage:', error.message);
            return this.buildFallbackEntityStorageQuery(entityURI, entity, detailsId, originalQuery);
        }
    }

    /**
     * Build fallback SPARQL query for entity storage
     * 
     * @private
     * @param {string} entityURI - URI for the entity
     * @param {Object} entity - Entity data
     * @param {string} detailsId - Details session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    buildFallbackEntityStorageQuery(entityURI, entity, detailsId, originalQuery) {
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.settings.storageGraph}> {
                    <${entityURI}> a ragno:WikidataEntity ;
                        ragno:wikidataId "${entity.wikidataId}" ;
                        dcterms:title "${this.escapeForSparql(entity.label)}" ;
                        dcterms:description "${this.escapeForSparql(entity.description)}" ;
                        foaf:page <${entity.url}> ;
                        ragno:detailsId "${detailsId}" ;
                        ragno:originalQuery "${this.escapeForSparql(originalQuery)}" ;
                        ragno:enhancementSource "wikidata" ;
                        ragno:relevanceScore "${entity.relevanceScore || 0}"^^xsd:float ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        ragno:status "active" .
                }
            }
        `;
    }

    /**
     * Build SPARQL query for relationship storage using template system
     * 
     * @private
     * @param {string} relationshipURI - URI for the relationship
     * @param {Object} relationship - Relationship data
     * @param {string} detailsId - Details session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    async buildRelationshipStorageQuery(relationshipURI, relationship, detailsId, originalQuery) {
        try {
            return await this.queryService.getQuery('store-wikidata-relationship', {
                storageGraph: this.settings.storageGraph,
                relationshipURI: relationshipURI,
                sourceEntity: relationship.sourceEntity,
                sourceEntityLabel: this.escapeForSparql(relationship.sourceEntityLabel),
                property: relationship.property,
                propertyLabel: this.escapeForSparql(relationship.propertyLabel),
                targetEntity: this.escapeForSparql(relationship.targetEntity),
                targetEntityLabel: this.escapeForSparql(relationship.targetEntityLabel),
                valueType: relationship.valueType,
                confidence: relationship.confidence,
                detailsId: detailsId,
                originalQuery: this.escapeForSparql(originalQuery),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Fallback to direct query if template not available
            logger.warn('Using fallback query for Wikidata relationship storage:', error.message);
            return this.buildFallbackRelationshipStorageQuery(relationshipURI, relationship, detailsId, originalQuery);
        }
    }

    /**
     * Build fallback SPARQL query for relationship storage
     * 
     * @private
     * @param {string} relationshipURI - URI for the relationship
     * @param {Object} relationship - Relationship data
     * @param {string} detailsId - Details session ID
     * @param {string} originalQuery - Original query
     * @returns {string} SPARQL update query
     */
    buildFallbackRelationshipStorageQuery(relationshipURI, relationship, detailsId, originalQuery) {
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.settings.storageGraph}> {
                    <${relationshipURI}> a ragno:WikidataRelationship ;
                        ragno:sourceEntity "${relationship.sourceEntity}" ;
                        ragno:sourceEntityLabel "${this.escapeForSparql(relationship.sourceEntityLabel)}" ;
                        ragno:property "${relationship.property}" ;
                        ragno:propertyLabel "${this.escapeForSparql(relationship.propertyLabel)}" ;
                        ragno:targetEntity "${this.escapeForSparql(relationship.targetEntity)}" ;
                        ragno:targetEntityLabel "${this.escapeForSparql(relationship.targetEntityLabel)}" ;
                        ragno:valueType "${relationship.valueType}" ;
                        ragno:confidence "${relationship.confidence}"^^xsd:float ;
                        ragno:detailsId "${detailsId}" ;
                        ragno:originalQuery "${this.escapeForSparql(originalQuery)}" ;
                        ragno:enhancementSource "wikidata" ;
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
     * Clear all caches
     */
    clearCache() {
        this.entityCache.clear();
        this.relationshipCache.clear();
        logger.info('📋 Wikidata caches cleared');
    }

    /**
     * Get service statistics and health information
     * 
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            serviceName: 'WikidataService',
            settings: this.settings,
            handlers: {
                sparql: !!this.sparqlHelper
            },
            cache: {
                enabled: this.settings.enableCaching,
                entityCacheSize: this.entityCache.size,
                relationshipCacheSize: this.relationshipCache.size,
                lastRequestTime: this.lastRequestTime
            },
            capabilities: {
                entitySearch: true,
                entityDetails: true,
                relationshipExtraction: true,
                contextStorage: !!this.sparqlHelper
            }
        };
    }
}

export default WikidataService;