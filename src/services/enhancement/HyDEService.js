/**
 * HyDE (Hypothetical Document Embeddings) Service
 * 
 * Implements HyDE algorithm for enhanced question answering by generating
 * hypothetical documents related to queries before searching the knowledge store.
 * 
 * Extracted and refactored from examples/document/AskHyde.js into core service
 * following structured patterns and using SPARQL template system.
 */

import logger from 'loglevel';
import { SPARQLQueryService } from '../sparql/index.js';
import SPARQLHelper from '../sparql/SPARQLHelper.js';

export class HyDEService {
    constructor(options = {}) {
        this.llmHandler = options.llmHandler;
        this.embeddingHandler = options.embeddingHandler;
        this.sparqlHelper = options.sparqlHelper;
        this.config = options.config;

        // Default configuration
        this.settings = {
            maxHypotheticalLength: options.maxHypotheticalLength || 2000,
            conceptExtractionEnabled: options.conceptExtractionEnabled !== false,
            storageGraph: options.storageGraph,
            maxConcepts: options.maxConcepts || 10,
            ...options.settings
        };

        // Initialize SPARQL query service for template management
        this.queryService = new SPARQLQueryService({
            queryPath: options.queryPath || 'sparql'
        });
    }

    /**
     * Generate hypothetical document for a given query
     * 
     * @param {string} queryText - The original query
     * @param {Object} options - Generation options
     * @returns {Object} Generated hypothetical document
     */
    async generateHypotheticalDocument(queryText, options = {}) {
        logger.info('🔮 Generating HyDE hypothetical document...');

        const prompt = this.buildHyDEPrompt(queryText, options);

        try {
            const response = await this.llmHandler.generateResponse(prompt);

            // Trim to max length if specified
            const content = this.settings.maxHypotheticalLength && response.length > this.settings.maxHypotheticalLength
                ? response.substring(0, this.settings.maxHypotheticalLength) + '...'
                : response;

            const hypotheticalDoc = {
                content,
                originalQuery: queryText,
                timestamp: new Date().toISOString(),
                id: `hyde_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                length: content.length
            };

            logger.info(`✅ Generated HyDE document (${content.length} chars)`);
            return hypotheticalDoc;

        } catch (error) {
            logger.error('❌ Failed to generate HyDE document:', error.message);
            throw new Error(`HyDE generation failed: ${error.message}`);
        }
    }

    /**
     * Extract concepts from hypothetical document
     * 
     * @param {Object} hypotheticalDoc - The generated hypothetical document
     * @returns {Array} Array of extracted concepts with metadata
     */
    async extractConceptsFromHypothetical(hypotheticalDoc) {
        if (!this.settings.conceptExtractionEnabled) {
            logger.info('Concept extraction disabled, skipping...');
            return [];
        }

        logger.info('🧠 Extracting concepts from HyDE document...');

        try {
            const concepts = await this.llmHandler.extractConcepts(hypotheticalDoc.content);

            // Enhance concepts with HyDE metadata
            const enhancedConcepts = concepts
                .slice(0, this.settings.maxConcepts)
                .map((concept, index) => ({
                    value: concept,
                    source: 'hyde',
                    hydeId: hypotheticalDoc.id,
                    originalQuery: hypotheticalDoc.originalQuery,
                    timestamp: hypotheticalDoc.timestamp,
                    order: index,
                    confidence: this.calculateConceptConfidence(concept, hypotheticalDoc.content)
                }));

            logger.info(`✅ Extracted ${enhancedConcepts.length} concepts from HyDE document`);
            return enhancedConcepts;

        } catch (error) {
            logger.error('❌ Failed to extract HyDE concepts:', error.message);
            throw new Error(`HyDE concept extraction failed: ${error.message}`);
        }
    }

    /**
     * Store HyDE hypothetical document with embedding using SPARQL templates
     * 
     * @param {Object} hypotheticalDoc - The hypothetical document to store
     * @param {Array} concepts - Array of extracted concepts
     * @returns {Object} Stored document result
     */
    async storeHyDEDocument(hypotheticalDoc, concepts = []) {
        if (!this.sparqlHelper) {
            logger.warn('No SPARQL helper provided for HyDE document storage');
            return null;
        }

        logger.info('💾 Storing HyDE hypothetical document...');

        try {
            // Generate embedding for the hypothetical document
            const embedding = this.embeddingHandler
                ? await this.embeddingHandler.generateEmbedding(hypotheticalDoc.content)
                : null;

            // Create document URI
            const hypotheticalDocURI = `http://purl.org/stuff/instance/hyde-document/${hypotheticalDoc.id}`;

            // Use SPARQL template for document storage
            const insertQuery = await this.buildHypotheticalDocStorageQuery(hypotheticalDocURI, hypotheticalDoc, embedding);

            const result = await this.sparqlHelper.executeUpdate(insertQuery);

            if (!result.success) {
                logger.error('SPARQL HyDE document storage failed:', result.error);
                throw new Error(`Failed to store HyDE document: ${result.error}`);
            }

            const storedDocument = {
                uri: hypotheticalDocURI,
                id: hypotheticalDoc.id,
                content: hypotheticalDoc.content,
                embedding: embedding,
                conceptCount: concepts.length,
                originalQuery: hypotheticalDoc.originalQuery
            };

            logger.info(`✅ Stored HyDE hypothetical document: ${hypotheticalDoc.id}`);
            return storedDocument;

        } catch (error) {
            logger.error('❌ Failed to store HyDE document:', error.message);
            throw error;
        }
    }

    /**
     * Enhance a query with HyDE-generated context
     * 
     * @param {string} originalQuery - The original query
     * @param {Object} hypotheticalDoc - Generated hypothetical document
     * @param {Array} concepts - Extracted concepts
     * @returns {Object} Enhanced query context
     */
    async enhanceQueryWithHyDE(originalQuery, hypotheticalDoc, concepts = []) {
        logger.info('🔍 Enhancing query with HyDE context...');

        // Build enhanced context
        const hydeContext = {
            originalQuery,
            hypotheticalDocument: {
                content: hypotheticalDoc.content,
                id: hypotheticalDoc.id,
                length: hypotheticalDoc.length
            },
            concepts: concepts.map(c => ({
                value: c.value,
                confidence: c.confidence,
                order: c.order
            })),
            enhancement: {
                type: 'hyde',
                timestamp: new Date().toISOString(),
                conceptCount: concepts.length
            }
        };

        // Create enhanced prompt
        const enhancedPrompt = this.buildEnhancedPrompt(originalQuery, hydeContext);

        logger.info(`✅ Enhanced query with HyDE context (${concepts.length} concepts)`);

        return {
            enhancedPrompt,
            hydeContext,
            metadata: {
                hydeId: hypotheticalDoc.id,
                conceptCount: concepts.length,
                documentLength: hypotheticalDoc.length,
                enhancementType: 'hyde'
            }
        };
    }

    /**
     * Execute full HyDE pipeline for query enhancement
     * 
     * @param {string} query - Original query
     * @param {Object} options - Pipeline options
     * @returns {Object} Complete HyDE enhancement result
     */
    async processQueryWithHyDE(query, options = {}) {
        logger.info(`🔮 Processing query with full HyDE pipeline: "${query}"`);

        try {
            // Step 1: Generate hypothetical document
            const hypotheticalDoc = await this.generateHypotheticalDocument(query, options);

            // Step 2: Extract concepts (if enabled)
            const concepts = await this.extractConceptsFromHypothetical(hypotheticalDoc);

            // Step 3: Store hypothetical document (if SPARQL helper available)
            let storedDocument = null;
            if (this.sparqlHelper && options.storeDocument !== false) {
                storedDocument = await this.storeHyDEDocument(hypotheticalDoc, concepts);
            }

            // Step 4: Create enhanced query context
            const enhancement = await this.enhanceQueryWithHyDE(query, hypotheticalDoc, concepts);

            return {
                success: true,
                originalQuery: query,
                hypotheticalDoc,
                concepts,
                storedDocument,
                enhancement,
                stats: {
                    documentLength: hypotheticalDoc.length,
                    conceptCount: concepts.length,
                    documentStored: !!storedDocument,
                    processingTime: Date.now() - Date.parse(hypotheticalDoc.timestamp)
                }
            };

        } catch (error) {
            logger.error('❌ HyDE pipeline processing failed:', error.message);
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
     * Build HyDE generation prompt
     * 
     * @private
     * @param {string} queryText - Original query
     * @param {Object} options - Generation options
     * @returns {string} HyDE generation prompt
     */
    buildHyDEPrompt(queryText, options = {}) {
        return `Given the following question or text, generate a hypothetical document that would be relevant and helpful for answering or understanding it. The document should be informative, detailed, and directly address the key concepts in the question.

Question: ${queryText}

Generate a hypothetical document that would contain the information needed to answer this question. Focus on:
- Providing specific facts and details
- Using relevant terminology and concepts
- Including examples or explanations where appropriate
- Maintaining factual accuracy while being comprehensive

Hypothetical Document:`;
    }

    /**
     * Build enhanced prompt with HyDE context
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} hydeContext - HyDE context
     * @returns {string} Enhanced prompt
     */
    buildEnhancedPrompt(originalQuery, hydeContext) {
        const conceptList = hydeContext.concepts
            .map(c => `• ${c.value} (confidence: ${c.confidence.toFixed(2)})`)
            .join('\n');

        return `You are answering a question using HyDE (Hypothetical Document Embeddings) enhancement. Use the provided hypothetical document and extracted concepts to inform your response.

ORIGINAL QUESTION: ${originalQuery}

HYPOTHETICAL DOCUMENT:
${hydeContext.hypotheticalDocument.content}

EXTRACTED CONCEPTS:
${conceptList}

Please provide a comprehensive answer to the original question, incorporating insights from the hypothetical document and focusing on the extracted concepts where relevant.

ANSWER:`;
    }

    /**
     * Build SPARQL query for HyDE hypothetical document storage using template system
     * 
     * @private
     * @param {string} hypotheticalDocURI - URI for the hypothetical document
     * @param {Object} hypotheticalDoc - Document data
     * @param {Array} embedding - Embedding vector
     * @returns {string} SPARQL update query
     */
    async buildHypotheticalDocStorageQuery(hypotheticalDocURI, hypotheticalDoc, embedding) {
        try {
            const embeddingString = embedding ? embedding.map(x => x.toString()).join(',') : '';

            return await this.queryService.getQuery('store-hyde-hypothetical', {
                storageGraph: this.settings.storageGraph,
                hypotheticalDocURI: hypotheticalDocURI,
                originalQuery: this.escapeForSparql(hypotheticalDoc.originalQuery),
                hypotheticalContent: this.escapeForSparql(hypotheticalDoc.content),
                sessionId: hypotheticalDoc.id,
                llmModel: 'configured_llm',
                embedding: embeddingString,
                timestamp: hypotheticalDoc.timestamp
            });
        } catch (error) {
            // Fallback to direct query if template not available
            logger.warn('Using fallback query for HyDE storage:', error.message);
            return this.buildFallbackHypotheticalDocQuery(hypotheticalDocURI, hypotheticalDoc, embedding);
        }
    }

    /**
     * Build fallback SPARQL query for concept storage
     * 
     * @private
     * @param {string} conceptURI - URI for the concept
     * @param {Object} concept - Concept data
     * @param {Array} embedding - Embedding vector
     * @param {Object} hypotheticalDoc - Source document
     * @returns {string} SPARQL update query
     */
    buildFallbackHypotheticalDocQuery(hypotheticalDocURI, hypotheticalDoc, embedding) {
        const embeddingString = embedding ? embedding.map(x => x.toString()).join(',') : '';

        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.settings.storageGraph}> {
                    <${hypotheticalDocURI}> a ragno:HypotheticalDocument ;
                        ragno:originalQuery "${this.escapeForSparql(hypotheticalDoc.originalQuery)}" ;
                        ragno:content "${this.escapeForSparql(hypotheticalDoc.content)}" ;
                        ragno:hydeSessionId "${hypotheticalDoc.id}" ;
                        ragno:enhancementSource "hyde" ;
                        ragno:generatedBy "configured_llm" ;
                        ragno:hasEmbedding "${embeddingString}" ;
                        dcterms:created "${hypotheticalDoc.timestamp}"^^xsd:dateTime ;
                        ragno:status "active" .
                }
            }
        `;
    }

    /**
     * Calculate confidence score for a concept based on its relevance to the document
     * 
     * @private
     * @param {string} concept - The concept text
     * @param {string} documentContent - The source document content
     * @returns {number} Confidence score between 0 and 1
     */
    calculateConceptConfidence(concept, documentContent) {
        // Simple confidence calculation based on concept frequency and position
        const conceptLower = concept.toLowerCase();
        const documentLower = documentContent.toLowerCase();

        // Count occurrences
        const occurrences = (documentLower.match(new RegExp(conceptLower, 'g')) || []).length;

        // Check if concept appears early in document (higher confidence)
        const firstOccurrence = documentLower.indexOf(conceptLower);
        const earlyBonus = firstOccurrence >= 0 && firstOccurrence < documentContent.length * 0.3 ? 0.2 : 0;

        // Base confidence from frequency (max 0.8) + early occurrence bonus
        const baseConfidence = Math.min(0.8, occurrences * 0.2);

        return Math.min(1.0, baseConfidence + earlyBonus);
    }

    /**
     * Escape string for SPARQL literal
     * 
     * @private
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeForSparql(str) {
        return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    /**
     * Get service statistics and health information
     * 
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            serviceName: 'HyDEService',
            settings: this.settings,
            handlers: {
                llm: !!this.llmHandler,
                embedding: !!this.embeddingHandler,
                sparql: !!this.sparqlHelper
            },
            capabilities: {
                documentGeneration: !!this.llmHandler,
                conceptExtraction: !!this.llmHandler && this.settings.conceptExtractionEnabled,
                conceptStorage: !!this.sparqlHelper,
                embeddingGeneration: !!this.embeddingHandler
            }
        };
    }
}

export default HyDEService;