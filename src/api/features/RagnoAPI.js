import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import { decomposeCorpus } from '../../ragno/decomposeCorpus.js';
import { enrichWithEmbeddings } from '../../ragno/enrichWithEmbeddings.js';
import { augmentWithAttributes } from '../../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../../ragno/aggregateCommunities.js';
import GraphAnalytics from '../../ragno/algorithms/GraphAnalytics.js';
import CommunityDetection from '../../ragno/algorithms/CommunityDetection.js';
import PersonalizedPageRank from '../../ragno/algorithms/PersonalizedPageRank.js';
import Hyde from '../../ragno/algorithms/Hyde.js';
import DualSearch from '../../ragno/search/DualSearch.js';
import RDFGraphManager from '../../ragno/core/RDFGraphManager.js';
import NamespaceManager from '../../ragno/core/NamespaceManager.js';
import SPARQLHelpers from '../../services/sparql/SPARQLHelper.js';

/**
 * Ragno API handler for knowledge graph operations
 * Integrates Ragno services into the main API server following BaseAPI patterns
 */
export default class RagnoAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        
        // Configuration
        this.maxTextLength = config.maxTextLength || 50000;
        this.maxBatchSize = config.maxBatchSize || 10;
        this.requestTimeout = config.requestTimeout || 300000; // 5 minutes
        this.supportedFormats = config.supportedFormats || ['turtle', 'ntriples', 'jsonld', 'json'];
        
        // Core dependencies (will be injected)
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.sparqlEndpoint = null;
        this.sparqlStore = null;
        
        // Ragno components
        this.namespaceManager = new NamespaceManager();
        this.rdfManager = new RDFGraphManager({ namespace: this.namespaceManager });
        this.graphAnalytics = null;
        this.communityDetection = null;
        this.dualSearch = null;
        this.hyde = null;
        
        // Metrics tracking
        this.metrics = {
            decompositions: 0,
            entities: 0,
            relationships: 0,
            searches: 0,
            exports: 0,
            errors: 0
        };
    }

    async initialize() {
        await super.initialize();
        
        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for RagnoAPI');
        }
        
        try {
            // Get core handlers
            this.llmHandler = registry.get('llm');
            this.embeddingHandler = registry.get('embedding');
            
            // Get storage - try to get SPARQL store if available
            try {
                const memoryManager = registry.get('memory');
                if (memoryManager && memoryManager.storage) {
                    this.sparqlStore = memoryManager.storage;
                    if (this.sparqlStore.endpoint) {
                        this.sparqlEndpoint = this.sparqlStore.endpoint;
                    }
                }
            } catch (error) {
                this.logger.warn('SPARQL store not available, some features will be limited');
            }
            
            // Initialize analytics components
            if (this.sparqlEndpoint) {
                this.graphAnalytics = new GraphAnalytics({
                    sparqlEndpoint: this.sparqlEndpoint,
                    namespaceManager: this.namespaceManager
                });
                
                this.communityDetection = new CommunityDetection({
                    sparqlEndpoint: this.sparqlEndpoint,
                    graphAnalytics: this.graphAnalytics
                });
                
                this.dualSearch = new DualSearch({
                    sparqlEndpoint: this.sparqlEndpoint,
                    embeddingHandler: this.embeddingHandler,
                    textAnalyzer: this.llmHandler
                });
            }
            
            // Initialize Hyde algorithm
            this.hyde = new Hyde({
                uriBase: this.namespaceManager.uriBase,
                maxTokens: 512,
                temperature: 0.7,
                hypothesesPerQuery: 3,
                extractEntities: true,
                maxEntitiesPerHypothesis: 10
            });
            
            this.logger.info('RagnoAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize RagnoAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a ragno operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        const requestId = uuidv4();
        
        try {
            let result;
            
            switch (operation) {
                case 'decompose':
                    result = await this.decomposeText(params, requestId);
                    break;
                case 'stats':
                    result = await this.getGraphStats(params, requestId);
                    break;
                case 'entities':
                    result = await this.getEntities(params, requestId);
                    break;
                case 'search':
                    result = await this.searchGraph(params, requestId);
                    break;
                case 'export':
                    result = await this.exportGraph(params, requestId);
                    break;
                case 'enrich':
                    result = await this.enrichGraph(params, requestId);
                    break;
                case 'communities':
                    result = await this.getCommunities(params, requestId);
                    break;
                case 'pipeline':
                    result = await this.runFullPipeline(params, requestId);
                    break;
                case 'hyde-generate':
                    result = await this.generateHypotheses(params, requestId);
                    break;
                case 'hyde-query':
                    result = await this.queryHypotheses(params, requestId);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            this._emitMetric(`ragno.operation.${operation}.duration`, duration);
            this._emitMetric(`ragno.operation.${operation}.count`, 1);
            
            return {
                ...result,
                requestId,
                processingTime: duration
            };
        } catch (error) {
            this.metrics.errors++;
            this._emitMetric(`ragno.operation.${operation}.errors`, 1);
            this.logger.error(`Ragno operation ${operation} failed:`, error);
            throw error;
        }
    }

    /**
     * Decompose text into knowledge graph entities and relationships
     */
    async decomposeText({ text, chunks, options = {} }, requestId) {
        if (!text && !chunks) {
            throw new Error('Either text or chunks must be provided');
        }
        
        if (text && text.length > this.maxTextLength) {
            throw new Error(`Text length exceeds maximum of ${this.maxTextLength} characters`);
        }
        
        // Convert text to chunks if needed
        let textChunks;
        if (text) {
            textChunks = [{ content: text, source: `request-${requestId}` }];
        } else {
            textChunks = chunks;
        }
        
        if (textChunks.length > this.maxBatchSize) {
            throw new Error(`Batch size exceeds maximum of ${this.maxBatchSize} chunks`);
        }
        
        this.logger.info(`Decomposing corpus: ${textChunks.length} chunks`, { requestId });
        
        try {
            const result = await decomposeCorpus(textChunks, this.llmHandler, {
                extractRelationships: options.extractRelationships !== false,
                generateSummaries: options.generateSummaries !== false,
                minEntityConfidence: options.minEntityConfidence || 0.3,
                maxEntitiesPerUnit: options.maxEntitiesPerUnit || 10,
                ...options
            });
            
            // Store in SPARQL if available
            if (this.sparqlStore && options.store !== false) {
                try {
                    await this.sparqlStore.storeDataset(result.dataset);
                    this.logger.info(`Stored decomposition results in SPARQL`, { requestId });
                } catch (error) {
                    this.logger.warn('Failed to store in SPARQL:', error.message);
                }
            }
            
            this.metrics.decompositions++;
            this.metrics.entities += result.entities.length;
            this.metrics.relationships += result.relationships.length;
            
            return {
                success: true,
                units: result.units.map(unit => this._formatSemanticUnit(unit)),
                entities: result.entities.map(entity => this._formatEntity(entity)),
                relationships: result.relationships.map(rel => this._formatRelationship(rel)),
                statistics: {
                    unitsCount: result.units.length,
                    entitiesCount: result.entities.length,
                    relationshipsCount: result.relationships.length
                }
            };
        } catch (error) {
            this.logger.error('Corpus decomposition failed:', error);
            throw new Error(`Decomposition failed: ${error.message}`);
        }
    }

    /**
     * Get graph statistics
     */
    async getGraphStats(params = {}, requestId) {
        if (!this.sparqlEndpoint) {
            throw new Error('SPARQL endpoint not available for statistics');
        }
        
        try {
            const queries = {
                entities: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://purl.org/stuff/ragno/Entity> }',
                units: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://purl.org/stuff/ragno/SemanticUnit> }',
                relationships: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://purl.org/stuff/ragno/Relationship> }',
                triples: 'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }'
            };
            
            const results = {};
            for (const [key, query] of Object.entries(queries)) {
                try {
                    const result = await SPARQLHelpers.executeSPARQLQuery(this.sparqlEndpoint, query);
                    results[key] = parseInt(result[0]?.count?.value || 0);
                } catch (error) {
                    this.logger.warn(`Failed to get ${key} count:`, error.message);
                    results[key] = 0;
                }
            }
            
            // Get additional analytics if available
            let analytics = {};
            if (this.graphAnalytics) {
                try {
                    analytics = await this.graphAnalytics.getGraphStatistics();
                } catch (error) {
                    this.logger.warn('Failed to get graph analytics:', error.message);
                }
            }
            
            return {
                success: true,
                statistics: results,
                analytics,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Failed to get graph stats:', error);
            throw new Error(`Statistics retrieval failed: ${error.message}`);
        }
    }

    /**
     * Get entities with optional filtering
     */
    async getEntities({ limit = 50, offset = 0, type, name } = {}, requestId) {
        if (!this.sparqlEndpoint) {
            throw new Error('SPARQL endpoint not available for entity retrieval');
        }
        
        try {
            let query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                SELECT ?entity ?name ?type ?confidence WHERE {
                    ?entity a ragno:Entity ;
                            ragno:prefLabel ?name .
                    OPTIONAL { ?entity ragno:subType ?type }
                    OPTIONAL { ?entity ragno:confidence ?confidence }
            `;
            
            // Add filters
            if (type) {
                query += ` FILTER(CONTAINS(LCASE(?type), LCASE("${type}")))`;
            }
            if (name) {
                query += ` FILTER(CONTAINS(LCASE(?name), LCASE("${name}")))`;
            }
            
            query += ` } ORDER BY DESC(?confidence) LIMIT ${limit} OFFSET ${offset}`;
            
            const results = await SPARQLHelpers.executeSPARQLQuery(this.sparqlEndpoint, query);
            
            const entities = results.map(row => ({
                uri: row.entity.value,
                name: row.name.value,
                type: row.type?.value || 'unknown',
                confidence: parseFloat(row.confidence?.value || 0)
            }));
            
            return {
                success: true,
                entities,
                count: entities.length,
                pagination: { limit, offset }
            };
        } catch (error) {
            this.logger.error('Failed to get entities:', error);
            throw new Error(`Entity retrieval failed: ${error.message}`);
        }
    }

    /**
     * Search the knowledge graph
     */
    async searchGraph({ query, type = 'dual', limit = 10, threshold = 0.7 } = {}, requestId) {
        if (!query) {
            throw new Error('Search query is required');
        }
        
        try {
            let results;
            
            if (type === 'dual' && this.dualSearch) {
                results = await this.dualSearch.search(query, {
                    limit,
                    semanticThreshold: threshold,
                    includeMetadata: true
                });
            } else if (type === 'entities') {
                results = await this._searchEntities(query, limit, threshold);
            } else if (type === 'semantic' && this.embeddingHandler) {
                results = await this._searchSemantic(query, limit, threshold);
            } else {
                throw new Error(`Unsupported search type: ${type}`);
            }
            
            this.metrics.searches++;
            
            return {
                success: true,
                query,
                type,
                results: results || [],
                count: results?.length || 0
            };
        } catch (error) {
            this.logger.error('Graph search failed:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Export graph data in specified format
     */
    async exportGraph({ format = 'turtle', filter, limit } = {}, requestId) {
        if (!this.supportedFormats.includes(format)) {
            throw new Error(`Unsupported export format: ${format}. Supported: ${this.supportedFormats.join(', ')}`);
        }
        
        if (!this.sparqlEndpoint) {
            throw new Error('SPARQL endpoint not available for export');
        }
        
        try {
            let query = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }';
            
            // Add filters if specified
            if (filter) {
                if (filter.entityType) {
                    query = `CONSTRUCT { ?s ?p ?o } WHERE { 
                        ?s ?p ?o . 
                        ?s a <http://purl.org/stuff/ragno/Entity> ;
                           <http://purl.org/stuff/ragno/subType> "${filter.entityType}" 
                    }`;
                }
            }
            
            if (limit) {
                query += ` LIMIT ${limit}`;
            }
            
            const triples = await SPARQLHelpers.executeSPARQLConstruct(this.sparqlEndpoint, query);
            
            let exportData;
            if (format === 'json') {
                exportData = this._triplesToJSON(triples);
            } else {
                exportData = await this._serializeTriples(triples, format);
            }
            
            this.metrics.exports++;
            
            return {
                success: true,
                format,
                data: exportData,
                tripleCount: triples.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Graph export failed:', error);
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    /**
     * Enrich graph with embeddings and attributes
     */
    async enrichGraph({ options = {} } = {}, requestId) {
        if (!this.sparqlEndpoint) {
            throw new Error('SPARQL endpoint not available for enrichment');
        }
        
        try {
            const results = {
                embeddings: null,
                attributes: null,
                communities: null
            };
            
            // Enrich with embeddings if embedding handler available
            if (this.embeddingHandler && options.embeddings !== false) {
                try {
                    results.embeddings = await enrichWithEmbeddings(
                        this.sparqlEndpoint,
                        this.embeddingHandler,
                        options.embeddingOptions || {}
                    );
                    this.logger.info('Graph enriched with embeddings', { requestId });
                } catch (error) {
                    this.logger.warn('Failed to enrich with embeddings:', error.message);
                }
            }
            
            // Augment with attributes if LLM handler available
            if (this.llmHandler && options.attributes !== false) {
                try {
                    results.attributes = await augmentWithAttributes(
                        this.sparqlEndpoint,
                        this.llmHandler,
                        options.attributeOptions || {}
                    );
                    this.logger.info('Graph augmented with attributes', { requestId });
                } catch (error) {
                    this.logger.warn('Failed to augment with attributes:', error.message);
                }
            }
            
            // Detect communities if analytics available
            if (this.communityDetection && options.communities !== false) {
                try {
                    const communities = await this.communityDetection.detectCommunities(
                        options.communityOptions || {}
                    );
                    results.communities = await aggregateCommunities(
                        this.sparqlEndpoint,
                        communities,
                        this.llmHandler
                    );
                    this.logger.info('Communities detected and aggregated', { requestId });
                } catch (error) {
                    this.logger.warn('Failed to detect communities:', error.message);
                }
            }
            
            return {
                success: true,
                enrichment: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Graph enrichment failed:', error);
            throw new Error(`Enrichment failed: ${error.message}`);
        }
    }

    /**
     * Get communities from the graph
     */
    async getCommunities({ algorithm = 'louvain', limit = 50 } = {}, requestId) {
        if (!this.communityDetection) {
            throw new Error('Community detection not available without SPARQL endpoint');
        }
        
        try {
            const communities = await this.communityDetection.detectCommunities({
                algorithm,
                limit
            });
            
            return {
                success: true,
                communities: communities.map(community => ({
                    id: community.id,
                    members: community.members,
                    size: community.members.length,
                    cohesion: community.cohesion || 0
                })),
                algorithm,
                count: communities.length
            };
        } catch (error) {
            this.logger.error('Community detection failed:', error);
            throw new Error(`Community detection failed: ${error.message}`);
        }
    }

    /**
     * Run full ragno pipeline
     */
    async runFullPipeline({ text, chunks, options = {} }, requestId) {
        this.logger.info('Running full Ragno pipeline', { requestId });
        
        try {
            const pipeline = {
                decomposition: null,
                enrichment: null,
                communities: null,
                statistics: null
            };
            
            // Step 1: Decompose corpus
            pipeline.decomposition = await this.decomposeText({ text, chunks, options }, requestId);
            
            // Step 2: Enrich if requested
            if (options.enrich !== false) {
                pipeline.enrichment = await this.enrichGraph({ options: options.enrichOptions }, requestId);
            }
            
            // Step 3: Detect communities if requested
            if (options.communities !== false) {
                pipeline.communities = await this.getCommunities(options.communityOptions || {}, requestId);
            }
            
            // Step 4: Get final statistics
            pipeline.statistics = await this.getGraphStats({}, requestId);
            
            return {
                success: true,
                pipeline,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Full pipeline failed:', error);
            throw new Error(`Pipeline failed: ${error.message}`);
        }
    }

    /**
     * Generate hypotheses using HyDE algorithm
     */
    async generateHypotheses({ queries, options = {} }, requestId) {
        if (!queries) {
            throw new Error('Queries are required for hypothesis generation');
        }
        
        if (!this.llmHandler) {
            throw new Error('LLM handler not available for hypothesis generation');
        }
        
        try {
            const queryArray = Array.isArray(queries) ? queries : [queries];
            const dataset = this.rdfManager.dataset || require('rdf-ext').dataset();
            
            this.logger.info(`Generating hypotheses for ${queryArray.length} queries`, { requestId });
            
            const results = await this.hyde.generateHypotheses(
                queryArray,
                this.llmHandler,
                dataset,
                {
                    hypothesesPerQuery: options.hypothesesPerQuery || 3,
                    temperature: options.temperature || 0.7,
                    maxTokens: options.maxTokens || 512,
                    extractEntities: options.extractEntities !== false,
                    maxEntitiesPerHypothesis: options.maxEntitiesPerHypothesis || 10,
                    ...options
                }
            );
            
            // Store results in SPARQL if available
            if (this.sparqlStore && options.store !== false) {
                try {
                    await this.sparqlStore.storeDataset(dataset);
                    this.logger.info('Stored hypotheses in SPARQL', { requestId });
                } catch (error) {
                    this.logger.warn('Failed to store hypotheses in SPARQL:', error.message);
                }
            }
            
            return {
                success: true,
                queries: queryArray,
                hypotheses: results.hypotheses.map(h => this._formatSemanticUnit(h)),
                entities: results.entities.map(e => this._formatEntity(e)),
                relationships: results.relationships.map(r => this._formatRelationship(r)),
                statistics: {
                    queriesProcessed: queryArray.length,
                    hypothesesGenerated: results.hypotheses.length,
                    entitiesExtracted: results.entities.length,
                    relationshipsCreated: results.relationships.length,
                    rdfTriplesAdded: results.rdfTriples
                },
                processingTime: results.processingTime
            };
        } catch (error) {
            this.logger.error('Hypothesis generation failed:', error);
            throw new Error(`Hypothesis generation failed: ${error.message}`);
        }
    }

    /**
     * Query hypothetical content from the knowledge graph
     */
    async queryHypotheses({ filters = {}, limit = 50 } = {}, requestId) {
        if (!this.sparqlEndpoint && !this.rdfManager.dataset) {
            throw new Error('No RDF data source available for querying hypotheses');
        }
        
        try {
            let dataset;
            if (this.rdfManager.dataset && this.rdfManager.dataset.size > 0) {
                dataset = this.rdfManager.dataset;
            } else if (this.sparqlEndpoint) {
                // If no local dataset, we'd need to fetch from SPARQL
                // For now, return empty results with a note
                this.logger.warn('No local RDF dataset available for hypothesis querying');
                return {
                    success: true,
                    hypotheses: [],
                    count: 0,
                    message: 'No hypothetical content available in local dataset'
                };
            }
            
            this.logger.info('Querying hypothetical content', { requestId, filters });
            
            const hypotheses = this.hyde.queryHypotheticalContent(dataset, filters);
            
            // Apply limit
            const limitedResults = hypotheses.slice(0, limit);
            
            return {
                success: true,
                hypotheses: limitedResults,
                count: limitedResults.length,
                totalFound: hypotheses.length,
                filters
            };
        } catch (error) {
            this.logger.error('Hypothesis querying failed:', error);
            throw new Error(`Hypothesis querying failed: ${error.message}`);
        }
    }

    /**
     * Format semantic unit for API response
     */
    _formatSemanticUnit(unit) {
        return {
            uri: unit.uri,
            content: unit.content,
            summary: unit.summary,
            entities: unit.entities || [],
            metadata: unit.metadata || {}
        };
    }

    /**
     * Format entity for API response
     */
    _formatEntity(entity) {
        return {
            uri: entity.uri,
            name: entity.getPrefLabel(),
            type: entity.getSubType(),
            confidence: entity.confidence || 0,
            isEntryPoint: entity.isEntryPoint(),
            metadata: entity.metadata || {}
        };
    }

    /**
     * Format relationship for API response
     */
    _formatRelationship(relationship) {
        return {
            uri: relationship.uri,
            subject: relationship.subject,
            predicate: relationship.predicate,
            object: relationship.object,
            confidence: relationship.confidence || 0,
            metadata: relationship.metadata || {}
        };
    }

    /**
     * Search entities by name/type
     */
    async _searchEntities(query, limit, threshold) {
        const sparqlQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            SELECT ?entity ?name ?type ?confidence WHERE {
                ?entity a ragno:Entity ;
                        ragno:prefLabel ?name .
                OPTIONAL { ?entity ragno:subType ?type }
                OPTIONAL { ?entity ragno:confidence ?confidence }
                FILTER(CONTAINS(LCASE(?name), LCASE("${query}")))
            } ORDER BY DESC(?confidence) LIMIT ${limit}
        `;
        
        const results = await SPARQLHelpers.executeSPARQLQuery(this.sparqlEndpoint, sparqlQuery);
        return results.map(row => ({
            uri: row.entity.value,
            name: row.name.value,
            type: row.type?.value || 'unknown',
            confidence: parseFloat(row.confidence?.value || 0),
            score: parseFloat(row.confidence?.value || 0)
        }));
    }

    /**
     * Semantic search using embeddings
     */
    async _searchSemantic(query, limit, threshold) {
        // Generate embedding for query
        const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
        
        // Search in SPARQL store if it supports similarity search
        if (this.sparqlStore && typeof this.sparqlStore.search === 'function') {
            const results = await this.sparqlStore.search(queryEmbedding, limit, threshold);
            return results.map(result => ({
                ...result,
                score: result.similarity
            }));
        }
        
        throw new Error('Semantic search requires SPARQL store with similarity search support');
    }

    /**
     * Convert triples to JSON format
     */
    _triplesToJSON(triples) {
        return triples.map(triple => ({
            subject: triple.subject.value,
            predicate: triple.predicate.value,
            object: triple.object.value,
            objectType: triple.object.termType
        }));
    }

    /**
     * Serialize triples to specified format
     */
    async _serializeTriples(triples, format) {
        // This would use rdf-ext serializers in real implementation
        // For now, return basic serialization
        if (format === 'turtle') {
            return triples.map(t => 
                `<${t.subject.value}> <${t.predicate.value}> <${t.object.value}> .`
            ).join('\n');
        }
        
        throw new Error(`Serialization for ${format} not yet implemented`);
    }

    /**
     * Store interaction (inherited from BaseAPI)
     */
    async storeInteraction(interaction) {
        // Ragno doesn't directly store interactions, but can process them
        throw new Error('Use decompose operation to process text into knowledge graph');
    }

    /**
     * Retrieve interactions (inherited from BaseAPI)
     */
    async retrieveInteractions(query) {
        // Use search instead
        return this.searchGraph(query);
    }

    /**
     * Get Ragno API metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();
        
        return {
            ...baseMetrics,
            ragno: this.metrics,
            components: {
                sparqlEndpoint: !!this.sparqlEndpoint,
                graphAnalytics: !!this.graphAnalytics,
                communityDetection: !!this.communityDetection,
                dualSearch: !!this.dualSearch
            }
        };
    }

    async shutdown() {
        this.logger.info('Shutting down RagnoAPI');
        
        // Cleanup components
        if (this.dualSearch && typeof this.dualSearch.shutdown === 'function') {
            await this.dualSearch.shutdown();
        }
        
        if (this.graphAnalytics && typeof this.graphAnalytics.shutdown === 'function') {
            await this.graphAnalytics.shutdown();
        }
        
        await super.shutdown();
    }
}