/**
 * Memorise.js - Integrated Memory Ingestion Module for Semem
 * 
 * This module provides a unified interface for ingesting text into the semem
 * memory system by orchestrating the complete document processing pipeline:
 * 
 * Text Input → ragno:Unit → ragno:TextElement → Chunking → Embeddings 
 * → Concept Extraction → Enhancement → Decomposition → SPARQL Storage
 * 
 * Based on the patterns from:
 * - examples/document/LoadPDFs.js
 * - examples/document/ChunkDocuments.js  
 * - examples/document/MakeEmbeddings.js
 * - examples/document/ExtractConcepts.js
 * - examples/document/EnhanceCorpuscles.js
 * - examples/document/Decompose.js
 * 
 * Follows infrastructure patterns from docs/manual/infrastructure.md
 * Uses SPARQL service layer as described in docs/manual/sparql-service.md
 */

import Config from '../Config.js';
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import MistralConnector from '../connectors/MistralConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import Chunker from '../services/document/Chunker.js';
import { URIMinter } from '../utils/URIMinter.js';
import { decomposeCorpus } from './decomposeCorpus.js';
import { CreateConceptsUnified } from './CreateConceptsUnified.js';
import logger from 'loglevel';
import crypto from 'crypto';

export default class Memorise {
    constructor(configPath = null) {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.chunker = null;
        this.conceptExtractor = null;
        this.initialized = false;
        this.configPath = configPath;
        
        // Statistics tracking
        this.stats = {
            textLength: 0,
            unitsCreated: 0,
            textElementsCreated: 0,
            chunksCreated: 0,
            embeddingsCreated: 0,
            conceptsExtracted: 0,
            entitiesCreated: 0,
            relationshipsCreated: 0,
            processingTimeMs: 0,
            errors: []
        };
    }

    /**
     * Initialize all required services and handlers
     */
    async init() {
        if (this.initialized) return;

        logger.info('🚀 Initializing Memorise module...');
        
        try {
            // 1. Initialize configuration
            await this.initializeConfig();
            
            // 2. Initialize SPARQL services
            await this.initializeSPARQLServices();
            
            // 3. Initialize LLM and embedding handlers
            await this.initializeLLMHandler();
            await this.initializeEmbeddingHandler();
            
            // 4. Initialize document processing components
            await this.initializeDocumentProcessing();
            
            this.initialized = true;
            logger.info('✅ Memorise module initialized successfully');
            
        } catch (error) {
            logger.error('❌ Failed to initialize Memorise module:', error.message);
            throw error;
        }
    }

    /**
     * Initialize configuration following semem patterns
     */
    async initializeConfig() {
        const configPath = this.configPath || 
            (process.cwd().endsWith('/examples/document') 
                ? '../../config/config.json' 
                : 'config/config.json');
        
        this.config = new Config(configPath);
        await this.config.init();
        
        logger.debug(`Configuration loaded from: ${configPath}`);
    }

    /**
     * Initialize SPARQL services following infrastructure patterns
     */
    async initializeSPARQLServices() {
        // Initialize query service
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });

        // Initialize SPARQL helper
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('Memorise requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            auth: {
                user: storageConfig.options.user,
                password: storageConfig.options.password
            }
        });
        
        logger.debug('SPARQL services initialized');
    }

    /**
     * Initialize LLM handler with priority-based provider selection
     */
    async initializeLLMHandler() {
        try {
            const llmProviders = this.config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            // Try providers in priority order
            for (const provider of sortedProviders) {
                try {
                    if (provider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                        chatModel = provider.chatModel || 'mistral-small-latest';
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`Using Mistral LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'claude' && process.env.ANTHROPIC_API_KEY) {
                        chatModel = provider.chatModel || 'claude-3-haiku-20240307';
                        llmProvider = new ClaudeConnector(process.env.ANTHROPIC_API_KEY);
                        logger.info(`Using Claude LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'ollama') {
                        chatModel = provider.chatModel || 'qwen2:1.5b';
                        const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                        llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                        logger.info(`Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                        break;
                    }
                } catch (error) {
                    logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                    continue;
                }
            }

            // Fallback to Ollama if no other provider works
            if (!llmProvider) {
                logger.warn('No configured LLM provider available, falling back to Ollama');
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                chatModel = 'qwen2:1.5b';
                llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            }

            this.llmHandler = new LLMHandler(llmProvider, chatModel);
            logger.debug(`LLM handler initialized with ${chatModel}`);
            
        } catch (error) {
            logger.error('Failed to initialize LLM handler:', error.message);
            // Emergency fallback
            this.llmHandler = new LLMHandler(new OllamaConnector('http://localhost:11434'), 'qwen2:1.5b');
            logger.warn('Using emergency fallback to Ollama');
        }
    }

    /**
     * Initialize embedding handler with provider selection
     */
    async initializeEmbeddingHandler() {
        try {
            const embeddingProviders = this.config.get('llmProviders') || [];
            const sortedProviders = embeddingProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let providerConfig = null;
            let embeddingDimension = 1536; // Default

            // Try providers in priority order
            for (const provider of sortedProviders) {
                if (provider.type === 'nomic' && process.env.NOMIC_API_KEY) {
                    providerConfig = {
                        provider: 'nomic',
                        apiKey: process.env.NOMIC_API_KEY,
                        model: provider.embeddingModel || 'nomic-embed-text'
                    };
                    embeddingDimension = 768;
                    logger.info(`Using Nomic embedding provider`);
                    break;
                } else if (provider.type === 'ollama') {
                    const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                    providerConfig = {
                        provider: 'ollama',
                        baseUrl: ollamaBaseUrl,
                        model: provider.embeddingModel || 'nomic-embed-text'
                    };
                    embeddingDimension = 1536;
                    logger.info(`Using Ollama embedding provider at: ${ollamaBaseUrl}`);
                    break;
                }
            }

            // Fallback to Ollama
            if (!providerConfig) {
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                providerConfig = {
                    provider: 'ollama',
                    baseUrl: ollamaBaseUrl,
                    model: 'nomic-embed-text'
                };
                logger.info(`Defaulting to Ollama embedding provider`);
            }

            const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
            this.embeddingHandler = new EmbeddingHandler(embeddingConnector, providerConfig.model, embeddingDimension);
            
            logger.debug(`Embedding handler initialized with ${providerConfig.provider} connector`);
            
        } catch (error) {
            logger.error('Failed to initialize embedding handler:', error.message);
            throw error;
        }
    }

    /**
     * Initialize document processing components
     */
    async initializeDocumentProcessing() {
        // Initialize chunker
        this.chunker = new Chunker({
            maxChunkSize: 2000,
            minChunkSize: 100,
            overlapSize: 100,
            strategy: 'semantic',
            baseNamespace: 'http://purl.org/stuff/instance/'
        });

        // Initialize concept extractor
        this.conceptExtractor = new CreateConceptsUnified();
        await this.conceptExtractor.init();
        
        logger.debug('Document processing components initialized');
    }

    /**
     * Main method to ingest text into memory system
     * @param {string} text - Text content to memorize
     * @param {Object} options - Processing options
     * @returns {Object} Processing results and statistics
     */
    async memorize(text, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        // Input validation
        if (typeof text !== 'string') {
            throw new Error('Text input must be a string');
        }
        
        if (text.trim().length === 0) {
            throw new Error('Text input cannot be empty');
        }

        const startTime = Date.now();
        this.stats = { ...this.stats, textLength: text.length, processingTimeMs: 0, errors: [] };
        
        logger.info(`🧠 Starting memory ingestion for ${text.length} characters of text...`);
        
        try {
            const targetGraph = options.graph || this.config.get('storage.options.graphName') || 
                               this.config.get('graphName') || 'http://hyperdata.it/content';

            // Step 1: Create ragno:Unit and ragno:TextElement
            logger.info('📄 Step 1: Creating ragno:Unit and ragno:TextElement...');
            const { unitURI, textElementURI } = await this.createTextUnit(text, targetGraph, options);
            
            // Step 2: Chunk the text
            logger.info('✂️  Step 2: Chunking text...');
            const chunks = await this.chunkText(textElementURI, text, targetGraph);
            
            // Step 3: Create embeddings for chunks
            logger.info('🔢 Step 3: Creating embeddings...');
            await this.createEmbeddings(chunks, targetGraph);
            
            // Step 4: Extract concepts (optional, controlled by extractConcepts option)
            let decompositionResults = null;
            if (options.extractConcepts) {
                logger.info('🧠 Step 4: Extracting concepts...');
                await this.extractConcepts(chunks, targetGraph);
                
                // Step 5: Decompose into entities and relationships
                logger.info('🕸️  Step 5: Decomposing into entities and relationships...');
                decompositionResults = await this.decomposeText(chunks, targetGraph);
            } else {
                logger.info('⏭️  Step 4: Skipping concept extraction (--augment not specified)');
                logger.info('⏭️  Step 5: Skipping entity decomposition (--augment not specified)');
            }
            
            // Calculate final statistics
            this.stats.processingTimeMs = Date.now() - startTime;
            
            logger.info('✅ Memory ingestion completed successfully');
            this.logProcessingSummary();
            
            return {
                success: true,
                unitURI,
                textElementURI,
                chunks: chunks.length,
                decompositionResults,
                statistics: { ...this.stats }
            };
            
        } catch (error) {
            this.stats.errors.push(error.message);
            this.stats.processingTimeMs = Date.now() - startTime;
            logger.error('❌ Memory ingestion failed:', error.message);
            throw error;
        }
    }

    /**
     * Create ragno:Unit and ragno:TextElement from input text
     */
    async createTextUnit(text, targetGraph, options = {}) {
        const title = options.title || `Memory ingestion ${new Date().toISOString()}`;
        const source = options.source || 'direct-input';
        
        // Generate URIs
        const unitURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'unit', text.substring(0, 100));
        const textElementURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'text', text);
        
        const now = new Date().toISOString();
        
        // Create SPARQL INSERT query for Unit and TextElement
        const updateQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX semem: <http://semem.hyperdata.it/>

            INSERT DATA {
                GRAPH <${targetGraph}> {
                    # Store ragno:Unit
                    <${unitURI}> a ragno:Unit ;
                        rdfs:label """${title.replace(/"/g, '\\"')}""" ;
                        dcterms:created "${now}"^^xsd:dateTime ;
                        semem:sourceFile "${source}" ;
                        ragno:hasTextElement <${textElementURI}> .
                    
                    # Store ragno:TextElement
                    <${textElementURI}> a ragno:TextElement ;
                        rdfs:label """${title} text content""" ;
                        dcterms:created "${now}"^^xsd:dateTime ;
                        ragno:content """${text.replace(/"/g, '\\"')}""" ;
                        dcterms:extent ${text.length} ;
                        prov:wasDerivedFrom <${unitURI}> .
                }
            }
        `;
        
        await this.sparqlHelper.executeUpdate(updateQuery);
        
        this.stats.unitsCreated = 1;
        this.stats.textElementsCreated = 1;
        
        logger.debug(`Created ragno:Unit: ${unitURI}`);
        logger.debug(`Created ragno:TextElement: ${textElementURI}`);
        
        return { unitURI, textElementURI };
    }

    /**
     * Chunk text using the document Chunker
     */
    async chunkText(textElementURI, text, targetGraph) {
        const chunkingResult = await this.chunker.chunk(text, {
            title: `TextElement ${textElementURI.split('/').pop()}`,
            sourceUri: textElementURI
        });
        
        logger.info(`Created ${chunkingResult.chunks.length} chunks`);
        
        // Generate URIs and store chunks using OLO structure (following ChunkDocuments.js pattern)
        const chunkListURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'chunklist', textElementURI);
        
        const chunkTriples = [];
        const slotTriples = [];
        
        chunkingResult.chunks.forEach((chunk, index) => {
            const chunkURI = chunk.uri;
            const slotURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'slot', `${textElementURI}-${index}`);
            
            // Chunk as both ragno:Unit and ragno:TextElement for embeddings
            chunkTriples.push(`
    <${chunkURI}> a ragno:Unit, ragno:TextElement ;
                  ragno:content """${chunk.content.replace(/"/g, '\\"')}""" ;
                  dcterms:extent ${chunk.size} ;
                  olo:index ${chunk.index} ;
                  prov:wasDerivedFrom <${textElementURI}> ;
                  dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .`);
            
            // OLO slot structure
            slotTriples.push(`
    <${slotURI}> a olo:Slot ;
                 olo:index ${index + 1} ;
                 olo:item <${chunkURI}> ;
                 olo:ordered_list <${chunkListURI}> .
    
    <${chunkListURI}> olo:slot <${slotURI}> .`);
        });
        
        // Store chunks with OLO indexing
        const chunksUpdateQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX olo: <http://purl.org/ontology/olo/core#>
            PREFIX semem: <http://semem.hyperdata.it/>

            INSERT DATA {
                GRAPH <${targetGraph}> {
                    # Mark original TextElement as having chunks
                    <${textElementURI}> semem:hasChunks true .
                    
                    # Create chunk list
                    <${chunkListURI}> a olo:OrderedList ;
                                      rdfs:label "Chunks for ${textElementURI.split('/').pop()}" ;
                                      olo:length ${chunkingResult.chunks.length} ;
                                      dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                    
                    # Store chunks
                    ${chunkTriples.join('\n')}
                    
                    # Store OLO slots
                    ${slotTriples.join('\n')}
                }
            }
        `;
        
        await this.sparqlHelper.executeUpdate(chunksUpdateQuery);
        
        this.stats.chunksCreated = chunkingResult.chunks.length;
        
        return chunkingResult.chunks;
    }

    /**
     * Create embeddings for all chunks
     */
    async createEmbeddings(chunks, targetGraph) {
        let embeddingsCreated = 0;
        
        for (const chunk of chunks) {
            try {
                // Generate embedding
                const embedding = await this.embeddingHandler.generateEmbedding(chunk.content);
                const embeddingString = embedding.join(',');
                
                // Store embedding
                const embeddingUpdateQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    
                    INSERT DATA {
                        GRAPH <${targetGraph}> {
                            <${chunk.uri}> ragno:embedding "${embeddingString}" .
                        }
                    }
                `;
                
                await this.sparqlHelper.executeUpdate(embeddingUpdateQuery);
                embeddingsCreated++;
                
            } catch (error) {
                logger.warn(`Failed to create embedding for chunk ${chunk.uri}: ${error.message}`);
                this.stats.errors.push(`Embedding failed for chunk: ${error.message}`);
            }
        }
        
        this.stats.embeddingsCreated = embeddingsCreated;
        logger.info(`Created ${embeddingsCreated} embeddings`);
    }

    /**
     * Extract concepts from specific chunks
     */
    async extractConcepts(chunks, targetGraph) {
        logger.info(`Processing concepts for ${chunks.length} specific chunks from current ingestion`);
        
        let conceptsExtracted = 0;
        const conceptResults = [];
        
        for (const chunk of chunks) {
            try {
                // Create a mock textElement object for the conceptExtractor
                const textElement = {
                    textElement: { value: chunk.uri },
                    content: { value: chunk.content }
                };
                
                const result = await this.conceptExtractor.processTextElement(textElement, targetGraph);
                conceptResults.push(result);
                conceptsExtracted += result.conceptCount;
                
                logger.debug(`Extracted ${result.conceptCount} concepts from chunk: ${chunk.uri}`);
                
            } catch (error) {
                logger.warn(`Failed to extract concepts from chunk ${chunk.uri}: ${error.message}`);
                this.stats.errors.push(`Concept extraction failed for chunk: ${error.message}`);
            }
        }
        
        this.stats.conceptsExtracted = conceptsExtracted;
        logger.info(`Extracted ${conceptsExtracted} concepts from ${chunks.length} chunks`);
        
        return conceptResults;
    }

    /**
     * Decompose text into entities and relationships using ragno
     */
    async decomposeText(chunks, targetGraph) {
        const textChunks = chunks.map(chunk => ({
            content: chunk.content,
            source: chunk.uri,
            metadata: {
                sourceUnit: chunk.uri
            }
        }));
        
        try {
            const decompositionResults = await decomposeCorpus(textChunks, this.llmHandler, {
                extractRelationships: true,
                generateSummaries: true,
                minEntityConfidence: 0.4,
                maxEntitiesPerUnit: 15
            });
            
            // Store the RDF dataset from decomposition results
            if (decompositionResults.dataset && decompositionResults.dataset.size > 0) {
                logger.info(`Storing decomposition results: ${decompositionResults.dataset.size} triples`);
                
                // Convert dataset to properly escaped SPARQL triples
                const quads = Array.from(decompositionResults.dataset);
                const triples = quads.map(quad => {
                    const subject = quad.subject.termType === 'NamedNode' ? `<${quad.subject.value}>` : quad.subject.value;
                    const predicate = `<${quad.predicate.value}>`;
                    
                    let object;
                    if (quad.object.termType === 'NamedNode') {
                        object = `<${quad.object.value}>`;
                    } else if (quad.object.termType === 'Literal') {
                        // Use SPARQLHelper for proper literal escaping
                        if (quad.object.datatype) {
                            object = SPARQLHelper.createLiteral(quad.object.value, quad.object.datatype.value);
                        } else if (quad.object.language) {
                            object = SPARQLHelper.createLiteral(quad.object.value, null, quad.object.language);
                        } else {
                            object = SPARQLHelper.createLiteral(quad.object.value);
                        }
                    } else {
                        object = quad.object.value;
                    }
                    
                    return `${subject} ${predicate} ${object} .`;
                }).join('\n');
                
                // Use SPARQLHelper to create and execute the insert query
                const insertQuery = this.sparqlHelper.createInsertDataQuery(targetGraph, triples);
                const result = await this.sparqlHelper.executeUpdate(insertQuery);
                
                if (!result.success) {
                    throw new Error(`SPARQL insert failed: ${result.error}`);
                }
            }
            
            this.stats.entitiesCreated = decompositionResults.entities?.length || 0;
            this.stats.relationshipsCreated = decompositionResults.relationships?.length || 0;
            
            logger.info(`Created ${this.stats.entitiesCreated} entities and ${this.stats.relationshipsCreated} relationships`);
            
            return decompositionResults;
            
        } catch (error) {
            logger.error(`Decomposition failed: ${error.message}`);
            this.stats.errors.push(`Decomposition failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Log processing summary
     */
    logProcessingSummary() {
        logger.info('\n📊 Memory Ingestion Summary:');
        logger.info(`   📄 Text length: ${this.stats.textLength} characters`);
        logger.info(`   🏗️  Units created: ${this.stats.unitsCreated}`);
        logger.info(`   📝 Text elements: ${this.stats.textElementsCreated}`);
        logger.info(`   ✂️  Chunks created: ${this.stats.chunksCreated}`);
        logger.info(`   🔢 Embeddings: ${this.stats.embeddingsCreated}`);
        logger.info(`   💡 Concepts extracted: ${this.stats.conceptsExtracted}`);
        logger.info(`   🎯 Entities created: ${this.stats.entitiesCreated}`);
        logger.info(`   🔗 Relationships: ${this.stats.relationshipsCreated}`);
        logger.info(`   ⏱️  Processing time: ${(this.stats.processingTimeMs / 1000).toFixed(2)}s`);
        
        if (this.stats.errors.length > 0) {
            logger.warn(`   ⚠️  Errors: ${this.stats.errors.length}`);
            this.stats.errors.forEach(error => {
                logger.warn(`     • ${error}`);
            });
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.conceptExtractor) {
            await this.conceptExtractor.cleanup();
        }
        
        if (this.embeddingHandler && typeof this.embeddingHandler.dispose === 'function') {
            await this.embeddingHandler.dispose();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            this.queryService.cleanup();
        }
        
        logger.debug('Memorise module cleaned up');
    }
}