import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import WikidataResearcher from '../../aux/wikidata/WikidataResearcher.js';
import WikidataSearch from '../../aux/wikidata/WikidataSearch.js';
import WikidataConnector from '../../aux/wikidata/WikidataConnector.js';

/**
 * Wikidata API handler for Wikidata research capabilities
 * 
 * Provides endpoints for:
 * - Concept research using Wikidata
 * - Entity lookup by ID or name
 * - Entity search and discovery
 * - SPARQL query execution
 */
export default class WikidataAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.memoryManager = null;
        this.llmHandler = null;
        this.sparqlHelper = null;
        
        // Wikidata service instances
        this.wikidataResearcher = null;
        this.wikidataSearch = null;
        this.wikidataConnector = null;
        
        // Configuration
        this.maxEntitiesPerConcept = config.maxEntitiesPerConcept || 3;
        this.maxSearchResults = config.maxSearchResults || 15;
        this.minConfidence = config.minConfidence || 0.4;
        this.requestTimeout = config.requestTimeout || 30000;
        this.defaultGraphURI = config.defaultGraphURI || 'http://purl.org/stuff/wikidata';
    }

    async initialize() {
        await super.initialize();
        
        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for WikidataAPI');
        }
        
        try {
            this.memoryManager = registry.get('memory');
            this.llmHandler = registry.get('llm');
            
            // Initialize Wikidata services
            this.wikidataResearcher = new WikidataResearcher();
            this.wikidataSearch = new WikidataSearch();
            this.wikidataConnector = new WikidataConnector();
            
            // Try to get SPARQL helper from registry
            try {
                this.sparqlHelper = registry.get('sparql');
            } catch (error) {
                this.logger.warn('SPARQL helper not available in registry, some features may be limited');
            }
            
            this.logger.info('WikidataAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize WikidataAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a Wikidata operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        const requestId = params.requestId || uuidv4();
        
        try {
            let result;
            
            switch (operation) {
                case 'research-concepts':
                    result = await this._executeConceptResearch(params, requestId);
                    break;
                    
                case 'entity-lookup':
                    result = await this._executeEntityLookup(params, requestId);
                    break;
                    
                case 'entity-search':
                    result = await this._executeEntitySearch(params, requestId);
                    break;
                    
                case 'sparql-query':
                    result = await this._executeSPARQLQuery(params, requestId);
                    break;
                    
                case 'concept-discovery':
                    result = await this._executeConceptDiscovery(params, requestId);
                    break;
                    
                default:
                    throw new Error(`Unknown Wikidata operation: ${operation}`);
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
            this.logger.error(`Wikidata operation ${operation} failed:`, error);
            
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
     * Execute Wikidata concept research
     */
    async _executeConceptResearch(params, requestId) {
        const { question, concepts, options = {} } = params;
        
        if (!question && !concepts) {
            throw new Error('Either question or concepts must be provided');
        }
        
        if (!this.sparqlHelper) {
            throw new Error('SPARQL helper is required for concept research but not available');
        }
        
        const input = { question, concepts };
        const resources = {
            llmHandler: this.llmHandler,
            sparqlHelper: this.sparqlHelper,
            config: {
                wikidataGraphURI: options.graphURI || this.defaultGraphURI
            }
        };
        
        const researchOptions = {
            maxEntitiesPerConcept: options.maxEntitiesPerConcept || this.maxEntitiesPerConcept,
            maxWikidataSearchResults: options.maxSearchResults || this.maxSearchResults,
            minEntityConfidence: options.minConfidence || this.minConfidence,
            enableHierarchySearch: options.enableHierarchySearch !== false,
            storeResults: options.storeResults !== false
        };
        
        this.logger.info(`[${requestId}] Starting Wikidata concept research for: "${question || 'provided concepts'}"`);
        
        return await this.wikidataResearcher.executeResearch(input, resources, researchOptions);
    }

    /**
     * Execute entity lookup by ID or name
     */
    async _executeEntityLookup(params, requestId) {
        const { entityId, entityName, language = 'en', includeRelated = false } = params;
        
        if (!entityId && !entityName) {
            throw new Error('Either entityId or entityName must be provided');
        }
        
        this.logger.info(`[${requestId}] Looking up entity: ${entityId || entityName}`);
        
        if (entityId) {
            // Direct entity lookup by Wikidata ID
            const entity = await this.wikidataConnector.getEntityDetails(entityId, { 
                language,
                includeRelated 
            });
            return {
                entity,
                lookupMethod: 'direct',
                entityId
            };
        } else {
            // Search for entity by name first
            const searchResults = await this.wikidataSearch.searchEntities(entityName, {
                language,
                limit: 5 // Get multiple candidates
            });
            
            if (searchResults.length === 0) {
                throw new Error(`No entity found with name: ${entityName}`);
            }
            
            // Get details for the top result
            const topResult = searchResults[0];
            const entity = await this.wikidataConnector.getEntityDetails(topResult.id, { 
                language,
                includeRelated 
            });
            
            return {
                entity,
                lookupMethod: 'search',
                searchResults,
                selectedEntityId: topResult.id
            };
        }
    }

    /**
     * Execute entity search
     */
    async _executeEntitySearch(params, requestId) {
        const { 
            query, 
            language = 'en', 
            limit = 10, 
            type = null,
            includeDescriptions = true 
        } = params;
        
        if (!query) {
            throw new Error('Search query is required');
        }
        
        this.logger.info(`[${requestId}] Searching Wikidata entities for: "${query}"`);
        
        const searchOptions = {
            language,
            limit,
            type,
            includeDescriptions
        };
        
        const results = await this.wikidataSearch.searchEntities(query, searchOptions);
        
        return {
            query,
            results,
            count: results.length,
            searchOptions
        };
    }

    /**
     * Execute SPARQL query against Wikidata
     */
    async _executeSPARQLQuery(params, requestId) {
        const { query, format = 'json', timeout = 30000 } = params;
        
        if (!query) {
            throw new Error('SPARQL query is required');
        }
        
        this.logger.info(`[${requestId}] Executing SPARQL query against Wikidata`);
        
        try {
            const result = await this.wikidataConnector.executeSPARQLQuery(query, {
                format,
                timeout
            });
            
            return {
                query,
                result,
                format,
                executedAt: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`SPARQL query failed: ${error.message}`);
        }
    }

    /**
     * Execute concept discovery from text
     */
    async _executeConceptDiscovery(params, requestId) {
        const { text, options = {} } = params;
        
        if (!text) {
            throw new Error('Text is required for concept discovery');
        }
        
        if (!this.llmHandler) {
            throw new Error('LLM handler is required for concept extraction but not available');
        }
        
        this.logger.info(`[${requestId}] Discovering concepts from text (${text.length} chars)`);
        
        // Extract concepts using LLM
        const concepts = await this.llmHandler.extractConcepts(text);
        
        const result = {
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            concepts,
            conceptCount: concepts.length
        };
        
        // Optionally research concepts using Wikidata
        if (options.researchConcepts !== false && concepts.length > 0 && this.sparqlHelper) {
            try {
                const researchResult = await this._executeConceptResearch({
                    concepts,
                    options: {
                        maxEntitiesPerConcept: options.maxEntitiesPerConcept || 2,
                        storeResults: options.storeResults !== false
                    }
                }, requestId);
                
                result.research = researchResult;
                result.entitiesFound = researchResult.statistics?.entitiesFound || 0;
            } catch (error) {
                this.logger.warn('Concept research failed:', error.message);
                result.researchError = error.message;
            }
        }
        
        return result;
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
                method: 'POST',
                path: '/wikidata/research',
                operation: 'research-concepts',
                description: 'Research concepts using Wikidata knowledge graph',
                schema: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: 'Research question' },
                        concepts: { type: 'array', items: { type: 'string' }, description: 'Pre-extracted concepts' },
                        options: {
                            type: 'object',
                            properties: {
                                maxEntitiesPerConcept: { type: 'number', default: 3 },
                                maxSearchResults: { type: 'number', default: 15 },
                                minConfidence: { type: 'number', default: 0.4 },
                                enableHierarchySearch: { type: 'boolean', default: true },
                                storeResults: { type: 'boolean', default: true },
                                graphURI: { type: 'string' }
                            }
                        }
                    },
                    anyOf: [
                        { required: ['question'] },
                        { required: ['concepts'] }
                    ]
                }
            },
            {
                method: 'POST',
                path: '/wikidata/entity',
                operation: 'entity-lookup',
                description: 'Look up specific Wikidata entity by ID or name',
                schema: {
                    type: 'object',
                    properties: {
                        entityId: { type: 'string', description: 'Wikidata entity ID (e.g., Q42)' },
                        entityName: { type: 'string', description: 'Entity name to search for' },
                        language: { type: 'string', default: 'en', description: 'Language code' },
                        includeRelated: { type: 'boolean', default: false, description: 'Include related entities' }
                    },
                    anyOf: [
                        { required: ['entityId'] },
                        { required: ['entityName'] }
                    ]
                }
            },
            {
                method: 'GET',
                path: '/wikidata/search',
                operation: 'entity-search',
                description: 'Search for Wikidata entities',
                schema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        language: { type: 'string', default: 'en', description: 'Language code' },
                        limit: { type: 'number', default: 10, description: 'Maximum results' },
                        type: { type: 'string', description: 'Entity type filter' },
                        includeDescriptions: { type: 'boolean', default: true, description: 'Include entity descriptions' }
                    },
                    required: ['query']
                }
            },
            {
                method: 'POST',
                path: '/wikidata/sparql',
                operation: 'sparql-query',
                description: 'Execute SPARQL query against Wikidata',
                schema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'SPARQL query' },
                        format: { type: 'string', default: 'json', enum: ['json', 'xml', 'csv'] },
                        timeout: { type: 'number', default: 30000, description: 'Query timeout in milliseconds' }
                    },
                    required: ['query']
                }
            },
            {
                method: 'POST',
                path: '/wikidata/concepts',
                operation: 'concept-discovery',
                description: 'Extract concepts from text and optionally research them',
                schema: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', description: 'Text to analyze for concepts' },
                        options: {
                            type: 'object',
                            properties: {
                                researchConcepts: { type: 'boolean', default: true },
                                maxEntitiesPerConcept: { type: 'number', default: 2 },
                                storeResults: { type: 'boolean', default: true }
                            }
                        }
                    },
                    required: ['text']
                }
            }
        ];
    }
}