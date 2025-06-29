/**
 * UnitsToCorpuscles - Converts ragno:Unit instances to ragno:Corpuscle instances with embeddings
 * 
 * This class queries for ragno:Unit instances that are not yet associated with ragno:Corpuscle
 * instances, creates corpuscles for them, establishes relationships, and generates embeddings
 * from text snippets stored as ragno:Attribute instances.
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import logger from 'loglevel';
import SPARQLHelper from '../../../examples/beerqa/SPARQLHelper.js';
import Config from '../../Config.js';
import EmbeddingHandler from '../../handlers/EmbeddingHandler.js';

export default class UnitsToCorpuscles {
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
            batchSize: options.batchSize || 50,
            timeout: options.timeout || 30000,
            generateEmbeddings: options.generateEmbeddings !== false, // Default true
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

        // Initialize embedding handler if embeddings are enabled
        if (this.options.generateEmbeddings) {
            this.initializeEmbeddingHandler();
        }

        // Statistics tracking
        this.stats = {
            totalUnits: 0,
            processedUnits: 0,
            generatedCorpuscles: 0,
            generatedRelationships: 0,
            generatedEmbeddings: 0,
            generatedTriples: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Initialize embedding handler
     */
    async initializeEmbeddingHandler() {
        try {
            const config = new Config();
            await config.init();
            
            this.embeddingHandler = new EmbeddingHandler(config);
            await this.embeddingHandler.initialize();
            
            logger.info('Embedding handler initialized successfully');
        } catch (error) {
            logger.warn('Failed to initialize embedding handler:', error.message);
            logger.warn('Embeddings will be disabled for this session');
            this.options.generateEmbeddings = false;
        }
    }

    /**
     * Main process - find units without corpuscles and create them
     * 
     * @returns {Promise<Object>} - Processing results
     */
    async process() {
        try {
            this.stats.startTime = new Date();
            logger.info('Starting UnitsToCorpuscles process');

            // Find units without associated corpuscles
            const units = await this.findUnitsWithoutCorpuscles();
            logger.info(`Found ${units.length} units without associated corpuscles`);

            if (units.length === 0) {
                logger.info('No units found that need corpuscle creation');
                return {
                    success: true,
                    message: 'No units found that need corpuscle creation',
                    statistics: this.getStatistics()
                };
            }

            // Process units in batches
            const processResults = await this.processUnitsInBatches(units);
            logger.info(`Processed ${processResults.successful}/${processResults.total} batches successfully`);

            this.stats.endTime = new Date();
            this.stats.processingTime = this.stats.endTime - this.stats.startTime;

            return {
                success: true,
                statistics: this.getStatistics(),
                processResults: processResults
            };

        } catch (error) {
            logger.error('UnitsToCorpuscles process failed:', error);
            this.stats.errors.push(error.message);
            this.stats.endTime = new Date();

            return {
                success: false,
                error: error.message,
                statistics: this.getStatistics()
            };
        }
    }

    /**
     * Find units that don't have associated corpuscles
     * 
     * @returns {Promise<Array>} - Array of unit data
     */
    async findUnitsWithoutCorpuscles() {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?unit ?unitLabel ?entity ?textElement ?textContent ?wikipediaURI
FROM <${this.options.graphURI}>
WHERE {
    ?unit a ragno:Unit ;
          rdfs:label ?unitLabel ;
          ragno:hasEntity ?entity .
    
    ?entity ragno:hasTextElement ?textElement ;
            ragno:wikipediaURI ?wikipediaURI .
    
    ?textElement ragno:content ?textContent .
    
    # Filter out units that already have associated corpuscles
    FILTER NOT EXISTS {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:relatedToUnit ?unit .
    }
}
ORDER BY ?unit`;

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
            
            // Transform SPARQL results to unit objects
            const units = results.results.bindings.map(binding => ({
                uri: binding.unit.value,
                label: binding.unitLabel.value,
                entityURI: binding.entity.value,
                textElementURI: binding.textElement.value,
                textContent: binding.textContent.value,
                wikipediaURI: binding.wikipediaURI.value
            }));

            this.stats.totalUnits = units.length;
            return units;

        } catch (error) {
            logger.error('Failed to query units without corpuscles:', error);
            throw error;
        }
    }

    /**
     * Process units in batches
     * 
     * @param {Array} units - Array of unit data
     * @returns {Promise<Object>} - Batch processing results
     */
    async processUnitsInBatches(units) {
        logger.info(`Processing ${units.length} units in batches of ${this.options.batchSize}`);
        
        const batches = this.createBatches(units, this.options.batchSize);
        const results = [];
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} units)`);
            
            try {
                const batchResult = await this.processBatch(batch);
                results.push(batchResult);
                
                if (!batchResult.success) {
                    logger.error(`Batch ${i + 1} failed:`, batchResult.error);
                    this.stats.errors.push(`Batch ${i + 1}: ${batchResult.error}`);
                }
                
            } catch (error) {
                logger.error(`Failed to process batch ${i + 1}:`, error);
                this.stats.errors.push(`Batch ${i + 1}: ${error.message}`);
                results.push({ success: false, error: error.message });
            }
        }
        
        return SPARQLHelper.getExecutionStats(results);
    }

    /**
     * Process a batch of units
     * 
     * @param {Array} batch - Batch of units to process
     * @returns {Promise<Object>} - Batch processing result
     */
    async processBatch(batch) {
        try {
            const corpuscles = [];
            
            // Create corpuscles for each unit in the batch
            for (const unit of batch) {
                const corpuscle = await this.createCorpuscleForUnit(unit);
                corpuscles.push(corpuscle);
                this.stats.processedUnits++;
                this.stats.generatedCorpuscles++;
            }
            
            // Generate combined triples for all corpuscles in the batch
            const allTriples = corpuscles.flatMap(corpuscle => corpuscle.triples);
            const triplesString = allTriples.join('\n        ');
            
            // Insert batch into SPARQL store
            const query = this.sparqlHelper.createInsertDataQuery(this.options.graphURI, triplesString);
            const result = await this.sparqlHelper.executeUpdate(query);
            
            if (result.success) {
                logger.info(`Successfully processed batch of ${batch.length} units`);
            }
            
            return result;
            
        } catch (error) {
            logger.error('Batch processing failed:', error);
            throw error;
        }
    }

    /**
     * Create corpuscle for a unit
     * 
     * @param {Object} unit - Unit data
     * @returns {Promise<Object>} - Corpuscle data with triples
     */
    async createCorpuscleForUnit(unit) {
        // Generate URIs
        const corpuscleId = this.generateCorpuscleId(unit);
        const corpuscleURI = `${this.options.baseURI}corpuscle/${corpuscleId}`;
        const relationshipURI = `${this.options.baseURI}relationship/${corpuscleId}_unit_rel`;
        const attributeURI = `${this.options.baseURI}attribute/${corpuscleId}_embedding`;

        // Generate embedding if enabled
        let embedding = null;
        if (this.options.generateEmbeddings && this.embeddingHandler) {
            try {
                embedding = await this.embeddingHandler.generateEmbedding(unit.textContent);
                this.stats.generatedEmbeddings++;
                logger.debug(`Generated embedding for unit: ${unit.label}`);
            } catch (error) {
                logger.warn(`Failed to generate embedding for unit ${unit.label}:`, error.message);
                this.stats.errors.push(`Embedding for "${unit.label}": ${error.message}`);
            }
        }

        // Create corpuscle structure
        const corpuscle = {
            uri: corpuscleURI,
            unitURI: unit.uri,
            relationshipURI: relationshipURI,
            attributeURI: attributeURI,
            label: unit.label,
            textContent: unit.textContent,
            embedding: embedding,
            metadata: {
                sourceUnit: unit.uri,
                sourceEntity: unit.entityURI,
                sourceTextElement: unit.textElementURI,
                wikipediaURI: unit.wikipediaURI,
                corpuscleId: corpuscleId,
                hasEmbedding: !!embedding
            },
            triples: []
        };

        // Generate RDF triples
        corpuscle.triples = this.generateCorpuscleTriples(corpuscle);
        
        this.stats.generatedTriples += corpuscle.triples.length;
        this.stats.generatedRelationships++;
        
        return corpuscle;
    }

    /**
     * Generate RDF triples for corpuscle
     * 
     * @param {Object} corpuscle - Corpuscle data
     * @returns {Array} - Array of RDF triple strings
     */
    generateCorpuscleTriples(corpuscle) {
        const triples = [];
        const corpuscleURI = `<${corpuscle.uri}>`;
        const unitURI = `<${corpuscle.unitURI}>`;
        const relationshipURI = `<${corpuscle.relationshipURI}>`;
        const attributeURI = `<${corpuscle.attributeURI}>`;

        // Core corpuscle properties
        triples.push(`${corpuscleURI} rdf:type ragno:Corpuscle .`);
        triples.push(`${corpuscleURI} rdfs:label ${SPARQLHelper.createLiteral(corpuscle.label)} .`);
        triples.push(`${corpuscleURI} ragno:corpuscleType ${SPARQLHelper.createLiteral('wikipedia-derived')} .`);
        triples.push(`${corpuscleURI} ragno:content ${SPARQLHelper.createLiteral(corpuscle.textContent)} .`);
        
        // Metadata
        triples.push(`${corpuscleURI} dcterms:created ${SPARQLHelper.createLiteral(new Date().toISOString(), 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
        triples.push(`${corpuscleURI} dcterms:source ${SPARQLHelper.createLiteral('wikipedia-unit-transformation')} .`);
        triples.push(`${corpuscleURI} prov:wasDerivedFrom ${unitURI} .`);
        triples.push(`${corpuscleURI} ragno:contentLength ${SPARQLHelper.createLiteral(corpuscle.textContent.length.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);

        // Relationship between corpuscle and unit
        triples.push(`${relationshipURI} rdf:type ragno:Relationship .`);
        triples.push(`${relationshipURI} rdfs:label ${SPARQLHelper.createLiteral('corpuscle-unit-association')} .`);
        triples.push(`${relationshipURI} ragno:relationshipType ${SPARQLHelper.createLiteral('derived-from')} .`);
        triples.push(`${relationshipURI} ragno:hasSource ${corpuscleURI} .`);
        triples.push(`${relationshipURI} ragno:hasTarget ${unitURI} .`);
        triples.push(`${relationshipURI} dcterms:created ${SPARQLHelper.createLiteral(new Date().toISOString(), 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
        
        // Bidirectional relationship references
        triples.push(`${corpuscleURI} ragno:relatedToUnit ${unitURI} .`);
        triples.push(`${unitURI} ragno:hasCorpuscle ${corpuscleURI} .`);
        triples.push(`${corpuscleURI} ragno:hasRelationship ${relationshipURI} .`);

        // Embedding attribute if available
        if (corpuscle.embedding) {
            triples.push(`${attributeURI} rdf:type ragno:Attribute .`);
            triples.push(`${attributeURI} rdfs:label ${SPARQLHelper.createLiteral('text-embedding')} .`);
            triples.push(`${attributeURI} ragno:attributeType ${SPARQLHelper.createLiteral('vector-embedding')} .`);
            triples.push(`${attributeURI} ragno:attributeValue ${SPARQLHelper.createLiteral(JSON.stringify(corpuscle.embedding))} .`);
            triples.push(`${attributeURI} ragno:embeddingDimensions ${SPARQLHelper.createLiteral(corpuscle.embedding.length.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
            triples.push(`${attributeURI} dcterms:created ${SPARQLHelper.createLiteral(new Date().toISOString(), 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
            triples.push(`${attributeURI} prov:wasGeneratedBy ${SPARQLHelper.createLiteral('embedding-handler')} .`);
            
            // Associate attribute with corpuscle
            triples.push(`${corpuscleURI} ragno:hasAttribute ${attributeURI} .`);
            triples.push(`${attributeURI} ragno:describesCorpuscle ${corpuscleURI} .`);
        }

        return triples;
    }

    /**
     * Generate unique corpuscle ID
     * 
     * @param {Object} unit - Unit data
     * @returns {string} - Unique corpuscle ID
     */
    generateCorpuscleId(unit) {
        // Extract Wikipedia page ID from unit URI or use hash of unit URI
        const unitIdMatch = unit.uri.match(/wp_(\d+)$/);
        if (unitIdMatch) {
            return `corp_wp_${unitIdMatch[1]}`;
        }
        
        // Fallback: create hash-based ID
        const hash = crypto.createHash('md5').update(unit.uri).digest('hex').substring(0, 8);
        return `corp_${hash}`;
    }

    /**
     * Create batches from units array
     * 
     * @param {Array} units - Array of units
     * @param {number} batchSize - Size of each batch
     * @returns {Array} - Array of batches
     */
    createBatches(units, batchSize) {
        const batches = [];
        for (let i = 0; i < units.length; i += batchSize) {
            batches.push(units.slice(i, i + batchSize));
        }
        return batches;
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
            successRate: this.stats.totalUnits > 0 ? (this.stats.processedUnits / this.stats.totalUnits) * 100 : 0,
            avgTriplesPerCorpuscle: this.stats.generatedCorpuscles > 0 ? this.stats.generatedTriples / this.stats.generatedCorpuscles : 0,
            embeddingSuccessRate: this.stats.generatedCorpuscles > 0 ? (this.stats.generatedEmbeddings / this.stats.generatedCorpuscles) * 100 : 0
        };
    }

    /**
     * Query generated corpuscles for verification
     * 
     * @param {number} limit - Maximum number of results to return
     * @returns {Promise<Object>} - Query results
     */
    async queryCorpuscles(limit = 10) {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?label ?unit ?unitLabel ?hasEmbedding
FROM <${this.options.graphURI}>
WHERE {
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?label ;
               ragno:relatedToUnit ?unit ;
               prov:wasDerivedFrom ?unit .
    
    ?unit rdfs:label ?unitLabel .
    
    BIND(EXISTS { ?corpuscle ragno:hasAttribute ?attr . ?attr ragno:attributeType "vector-embedding" } AS ?hasEmbedding)
}
ORDER BY DESC(?corpuscle)
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
            logger.error('Failed to query generated corpuscles:', error);
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
                totalUnits: stats.totalUnits,
                processedUnits: stats.processedUnits,
                generatedCorpuscles: stats.generatedCorpuscles,
                generatedRelationships: stats.generatedRelationships,
                generatedEmbeddings: stats.generatedEmbeddings,
                generatedTriples: stats.generatedTriples,
                successRate: `${stats.successRate.toFixed(2)}%`,
                embeddingSuccessRate: `${stats.embeddingSuccessRate.toFixed(2)}%`,
                processingTime: stats.processingTimeMs ? `${(stats.processingTimeMs / 1000).toFixed(2)}s` : 'N/A',
                avgTriplesPerCorpuscle: stats.avgTriplesPerCorpuscle.toFixed(2)
            },
            configuration: {
                graphURI: this.options.graphURI,
                sparqlEndpoint: this.options.sparqlEndpoint,
                batchSize: this.options.batchSize,
                generateEmbeddings: this.options.generateEmbeddings
            },
            errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : [],
            timestamp: new Date().toISOString()
        };
    }
}