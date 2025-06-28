/**
 * BeerETL - Extract, Transform, Load for BeerQA Dataset
 * 
 * Reads BeerQA JSON data and converts it to RDF representations using
 * the Ragno vocabulary as instances of ragno:Corpuscle with associated properties.
 */

import fs from 'fs';
import path from 'path';
import rdfExt from 'rdf-ext';
import { DataFactory } from 'rdf-ext';
import logger from 'loglevel';
import SPARQLHelper from './SPARQLHelper.js';

const { namedNode, literal, quad } = DataFactory;

export default class BeerETL {
    /**
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.options = {
            batchSize: options.batchSize || 100,
            sparqlEndpoint: options.sparqlEndpoint || 'http://localhost:3030/beerqa/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            graphURI: options.graphURI || 'http://purl.org/stuff/beerqa',
            dataPath: options.dataPath || 'data/beerqa/beerqa_dev_v1.0.json',
            baseURI: options.baseURI || 'http://purl.org/stuff/beerqa/',
            ragnoBaseURI: options.ragnoBaseURI || 'http://purl.org/stuff/ragno/',
            includeContext: options.includeContext !== false, // Default true
            generateEmbeddings: options.generateEmbeddings || false,
            ...options
        };

        // Initialize RDF namespaces
        this.namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            dcterms: 'http://purl.org/dc/terms/',
            beerqa: this.options.baseURI
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: 60000,
            continueOnError: false,
            delay: 100 // Small delay between requests
        });

        // Statistics tracking
        this.stats = {
            totalRecords: 0,
            processedRecords: 0,
            generatedCorpuscles: 0,
            generatedTriples: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Main ETL process - read, transform, and load BeerQA data
     * 
     * @param {string} inputFile - Path to BeerQA JSON file (optional, uses configured path)
     * @returns {Promise<Object>} - Processing statistics and results
     */
    async process(inputFile = null) {
        const filePath = inputFile || this.options.dataPath;
        
        try {
            this.stats.startTime = new Date();
            logger.info(`Starting BeerQA ETL process for file: ${filePath}`);
            
            // Extract: Read and parse JSON data
            const data = await this.extractData(filePath);
            logger.info(`Extracted ${data.length} records from BeerQA dataset`);
            
            // Transform: Convert to RDF corpuscles
            const corpuscles = await this.transformToCorpuscles(data);
            logger.info(`Transformed ${corpuscles.length} records to RDF corpuscles`);
            
            // Load: Insert into SPARQL store
            const loadResults = await this.loadToSPARQL(corpuscles);
            logger.info(`Loaded data to SPARQL store: ${loadResults.successful}/${loadResults.total} batches successful`);
            
            this.stats.endTime = new Date();
            this.stats.processingTime = this.stats.endTime - this.stats.startTime;
            
            return {
                success: true,
                statistics: this.stats,
                loadResults: loadResults
            };
            
        } catch (error) {
            logger.error('ETL process failed:', error);
            this.stats.errors.push(error.message);
            this.stats.endTime = new Date();
            
            return {
                success: false,
                error: error.message,
                statistics: this.stats
            };
        }
    }

    /**
     * Extract data from BeerQA JSON file
     * 
     * @param {string} filePath - Path to JSON file
     * @returns {Promise<Array>} - Parsed BeerQA records
     */
    async extractData(filePath) {
        try {
            // Resolve file path relative to project root
            const resolvedPath = path.resolve(filePath);
            logger.info(`Reading BeerQA data from: ${resolvedPath}`);
            
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`BeerQA data file not found: ${resolvedPath}`);
            }
            
            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            
            // Validate JSON structure
            if (!jsonData.data || !Array.isArray(jsonData.data)) {
                throw new Error('Invalid BeerQA JSON structure: missing or invalid "data" array');
            }
            
            this.stats.totalRecords = jsonData.data.length;
            logger.info(`BeerQA dataset version: ${jsonData.version}, split: ${jsonData.split}`);
            
            return jsonData.data;
            
        } catch (error) {
            logger.error('Failed to extract BeerQA data:', error);
            throw error;
        }
    }

    /**
     * Transform BeerQA records to RDF corpuscles using Ragno vocabulary
     * 
     * @param {Array} records - BeerQA records
     * @returns {Promise<Array>} - Array of RDF corpuscle data
     */
    async transformToCorpuscles(records) {
        const corpuscles = [];
        let processedCount = 0;
        
        logger.info(`Transforming ${records.length} BeerQA records to RDF corpuscles`);
        
        for (const record of records) {
            try {
                const corpuscle = await this.createCorpuscle(record);
                corpuscles.push(corpuscle);
                
                processedCount++;
                this.stats.processedRecords = processedCount;
                
                if (processedCount % 1000 === 0) {
                    logger.info(`Processed ${processedCount}/${records.length} records`);
                }
                
            } catch (error) {
                logger.warn(`Failed to transform record ${record.id}:`, error.message);
                this.stats.errors.push(`Record ${record.id}: ${error.message}`);
            }
        }
        
        this.stats.generatedCorpuscles = corpuscles.length;
        logger.info(`Successfully transformed ${corpuscles.length} records to corpuscles`);
        
        return corpuscles;
    }

    /**
     * Create RDF corpuscle from BeerQA record
     * 
     * @param {Object} record - BeerQA record
     * @returns {Object} - RDF corpuscle data
     */
    async createCorpuscle(record) {
        // Generate URIs
        const corpuscleURI = `${this.options.baseURI}corpuscle/${record.id}`;
        const questionURI = `${this.options.baseURI}question/${record.id}`;
        
        // Create main corpuscle
        const corpuscle = {
            uri: corpuscleURI,
            type: 'question-answer',
            content: this.extractFullContent(record),
            metadata: {
                id: record.id,
                source: record.src,
                questionURI: questionURI,
                answers: record.answers,
                question: record.question,
                contextCount: record.context ? record.context.length : 0
            },
            triples: []
        };

        // Generate RDF triples for the corpuscle
        corpuscle.triples = this.generateCorpuscleTriples(corpuscle, record);
        
        this.stats.generatedTriples += corpuscle.triples.length;
        
        return corpuscle;
    }

    /**
     * Extract full content from BeerQA record
     * 
     * @param {Object} record - BeerQA record
     * @returns {string} - Combined content text
     */
    extractFullContent(record) {
        let content = `Question: ${record.question}\n`;
        
        if (record.answers && record.answers.length > 0) {
            content += `Answer: ${record.answers.join(', ')}\n`;
        }
        
        if (this.options.includeContext && record.context) {
            content += '\nContext:\n';
            for (const contextItem of record.context) {
                if (Array.isArray(contextItem) && contextItem.length >= 2) {
                    content += `- ${contextItem[0]}: ${contextItem[1]}\n`;
                }
            }
        }
        
        return content.trim();
    }

    /**
     * Generate RDF triples for a corpuscle
     * 
     * @param {Object} corpuscle - Corpuscle data
     * @param {Object} record - Original BeerQA record
     * @returns {string[]} - Array of RDF triple strings
     */
    generateCorpuscleTriples(corpuscle, record) {
        const triples = [];
        const corpuscleURI = SPARQLHelper.createURI(corpuscle.uri);
        
        // Basic corpuscle type and properties
        triples.push(`${corpuscleURI} rdf:type ragno:Corpuscle .`);
        triples.push(`${corpuscleURI} rdfs:label ${SPARQLHelper.createLiteral(record.question)} .`);
        triples.push(`${corpuscleURI} ragno:content ${SPARQLHelper.createLiteral(corpuscle.content)} .`);
        triples.push(`${corpuscleURI} ragno:corpuscleType ${SPARQLHelper.createLiteral(corpuscle.type)} .`);
        
        // Metadata properties
        triples.push(`${corpuscleURI} dcterms:identifier ${SPARQLHelper.createLiteral(record.id)} .`);
        triples.push(`${corpuscleURI} dcterms:source ${SPARQLHelper.createLiteral(record.src)} .`);
        triples.push(`${corpuscleURI} dcterms:created ${SPARQLHelper.createLiteral(new Date().toISOString(), 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
        
        // Question-specific properties
        const questionURI = SPARQLHelper.createURI(corpuscle.metadata.questionURI);
        triples.push(`${questionURI} rdf:type ragno:Question .`);
        triples.push(`${questionURI} rdfs:label ${SPARQLHelper.createLiteral(record.question)} .`);
        triples.push(`${corpuscleURI} ragno:hasQuestion ${questionURI} .`);
        
        // Answer properties
        if (record.answers && record.answers.length > 0) {
            for (let i = 0; i < record.answers.length; i++) {
                const answerURI = SPARQLHelper.createURI(`${this.options.baseURI}answer/${record.id}/${i}`);
                triples.push(`${answerURI} rdf:type ragno:Answer .`);
                triples.push(`${answerURI} rdfs:label ${SPARQLHelper.createLiteral(record.answers[i])} .`);
                triples.push(`${corpuscleURI} ragno:hasAnswer ${answerURI} .`);
                triples.push(`${questionURI} ragno:hasAnswer ${answerURI} .`);
            }
        }
        
        // Context properties
        if (this.options.includeContext && record.context) {
            for (let i = 0; i < record.context.length; i++) {
                const contextItem = record.context[i];
                if (Array.isArray(contextItem) && contextItem.length >= 2) {
                    const contextURI = SPARQLHelper.createURI(`${this.options.baseURI}context/${record.id}/${i}`);
                    triples.push(`${contextURI} rdf:type ragno:ContextItem .`);
                    triples.push(`${contextURI} rdfs:label ${SPARQLHelper.createLiteral(contextItem[0])} .`);
                    triples.push(`${contextURI} ragno:content ${SPARQLHelper.createLiteral(contextItem[1])} .`);
                    triples.push(`${corpuscleURI} ragno:hasContext ${contextURI} .`);
                }
            }
        }
        
        // Statistics and metrics
        triples.push(`${corpuscleURI} ragno:answerCount ${SPARQLHelper.createLiteral(record.answers ? record.answers.length : 0, 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        triples.push(`${corpuscleURI} ragno:contextCount ${SPARQLHelper.createLiteral(record.context ? record.context.length : 0, 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        triples.push(`${corpuscleURI} ragno:contentLength ${SPARQLHelper.createLiteral(corpuscle.content.length, 'http://www.w3.org/2001/XMLSchema#integer')} .`);
        
        return triples;
    }

    /**
     * Load corpuscles to SPARQL store in batches
     * 
     * @param {Array} corpuscles - Array of corpuscle data
     * @returns {Promise<Object>} - Load operation results
     */
    async loadToSPARQL(corpuscles) {
        logger.info(`Loading ${corpuscles.length} corpuscles to SPARQL store in batches of ${this.options.batchSize}`);
        
        // Clear existing data in the graph
        await this.clearGraph();
        
        const batches = this.createBatches(corpuscles, this.options.batchSize);
        const results = [];
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} corpuscles)`);
            
            try {
                const batchTriples = this.combineBatchTriples(batch);
                const query = this.sparqlHelper.createInsertDataQuery(this.options.graphURI, batchTriples);
                
                const result = await this.sparqlHelper.executeUpdate(query);
                results.push(result);
                
                if (!result.success) {
                    logger.error(`Batch ${i + 1} failed:`, result.error);
                    this.stats.errors.push(`Batch ${i + 1}: ${result.error}`);
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
     * Clear the target graph before loading new data
     * 
     * @returns {Promise<Object>} - Clear operation result
     */
    async clearGraph() {
        logger.info(`Clearing graph: ${this.options.graphURI}`);
        const query = this.sparqlHelper.createClearGraphQuery(this.options.graphURI);
        const result = await this.sparqlHelper.executeUpdate(query);
        
        if (!result.success) {
            logger.warn('Failed to clear graph:', result.error);
        }
        
        return result;
    }

    /**
     * Create batches from corpuscles array
     * 
     * @param {Array} corpuscles - Array of corpuscles
     * @param {number} batchSize - Size of each batch
     * @returns {Array} - Array of batches
     */
    createBatches(corpuscles, batchSize) {
        const batches = [];
        for (let i = 0; i < corpuscles.length; i += batchSize) {
            batches.push(corpuscles.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Combine triples from a batch of corpuscles
     * 
     * @param {Array} batch - Batch of corpuscles
     * @returns {string} - Combined RDF triples
     */
    combineBatchTriples(batch) {
        const allTriples = [];
        
        for (const corpuscle of batch) {
            allTriples.push(...corpuscle.triples);
        }
        
        return allTriples.join('\n        ');
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
            successRate: this.stats.totalRecords > 0 ? (this.stats.processedRecords / this.stats.totalRecords) * 100 : 0,
            avgTriplesPerCorpuscle: this.stats.generatedCorpuscles > 0 ? this.stats.generatedTriples / this.stats.generatedCorpuscles : 0
        };
    }

    /**
     * Query the loaded data for verification
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

SELECT ?corpuscle ?label ?source ?answerCount ?contextCount
FROM <${this.options.graphURI}>
WHERE {
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?label ;
               dcterms:source ?source ;
               ragno:answerCount ?answerCount ;
               ragno:contextCount ?contextCount .
}
ORDER BY ?corpuscle
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
            logger.error('Failed to query corpuscles:', error);
            throw error;
        }
    }

    /**
     * Generate summary report of the ETL process
     * 
     * @returns {Object} - Summary report
     */
    generateReport() {
        const stats = this.getStatistics();
        
        return {
            summary: {
                totalRecords: stats.totalRecords,
                processedRecords: stats.processedRecords,
                generatedCorpuscles: stats.generatedCorpuscles,
                generatedTriples: stats.generatedTriples,
                successRate: `${stats.successRate.toFixed(2)}%`,
                processingTime: `${(stats.processingTimeMs / 1000).toFixed(2)}s`,
                avgTriplesPerCorpuscle: stats.avgTriplesPerCorpuscle.toFixed(2)
            },
            configuration: {
                dataPath: this.options.dataPath,
                graphURI: this.options.graphURI,
                sparqlEndpoint: this.options.sparqlEndpoint,
                batchSize: this.options.batchSize,
                includeContext: this.options.includeContext
            },
            errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : [], // First 10 errors
            timestamp: new Date().toISOString()
        };
    }
}