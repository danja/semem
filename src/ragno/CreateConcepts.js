/**
 * deprecated - TODO replace with CreateConceptsUnified.js which has better prompt handling
 * 
 * CreateConcepts.js - Enhanced concept extraction with corpuscle creation and embeddings
 * 
 * This module provides enhanced functionality for concept extraction that:
 * 1. Uses SPARQL templates and service layer from docs/manual/sparql-service.md
 * 2. Creates ragno:Corpuscle instances for individual concepts
 * 3. Generates embeddings for concept text values
 * 4. Associates embeddings with corpuscles
 * 5. Maintains backward compatibility with existing ExtractConcepts.js patterns
 * 
 * Features:
 * - Template-based SPARQL queries for better maintainability
 * - Individual corpuscles for each concept with embeddings
 * - Collection corpuscles that group concepts from text elements
 * - Comprehensive error handling and cleanup
 * - Configuration-driven provider selection
 */

import Config from '../Config.js';
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import MistralConnector from '../connectors/MistralConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import LLMHandler from '../handlers/LLMHandler.js';
import { URIMinter } from '../utils/URIMinter.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class CreateConcepts {
    constructor(config = null) {
        this.config = config;
        this.sparqlHelper = null;
        this.queryService = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.initialized = false;
    }

    /**
     * Initialize the CreateConcepts system
     */
    async init() {
        if (this.initialized) {
            return;
        }

        // Initialize configuration if not provided
        if (!this.config) {
            const configPath = process.cwd().endsWith('/examples/document')
                ? '../../config/config.json'
                : 'config/config.json';
            this.config = new Config(configPath);
            await this.config.init();
        }

        const storageConfig = this.config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('CreateConcepts requires SPARQL storage configuration');
        }

        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService();
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            auth: {
                user: storageConfig.options.user,
                password: storageConfig.options.password
            }
        });

        // Initialize LLM handler
        await this.initializeLLMHandler();

        // Initialize embedding handler
        await this.initializeEmbeddingHandler();

        this.initialized = true;
        logger.info('✅ CreateConcepts system initialized');
    }

    /**
     * Initialize LLM handler for concept extraction
     */
    async initializeLLMHandler() {
        try {
            // Get LLM providers from config and find chat-capable one
            const llmProviders = this.config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            // Sort by priority and use the highest priority chat provider
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            // Try providers in priority order
            for (const provider of sortedProviders) {
                try {
                    chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';

                    if (provider.type === 'mistral' && provider.apiKey) {
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'claude' && provider.apiKey) {
                        llmProvider = new ClaudeConnector(process.env.CLAUDE_API_KEY);
                        logger.info(`🤖 Using Claude LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'ollama') {
                        const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                        llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                        logger.info(`🤖 Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                        break;
                    }
                } catch (error) {
                    logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                    continue;
                }
            }

            // Fallback to Ollama if no providers worked
            if (!llmProvider) {
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
                llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                logger.info(`🤖 Fallback to Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
            }

            this.llmHandler = new LLMHandler(llmProvider, chatModel);

        } catch (error) {
            logger.warn('Failed to load LLM provider configuration, defaulting to Ollama:', error.message);
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
            const llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            this.llmHandler = new LLMHandler(llmProvider, chatModel);
        }
    }

    /**
     * Initialize embedding handler for concept embeddings
     */
    async initializeEmbeddingHandler() {
        try {
            // Get embedding configuration from config
            const embeddingProvider = this.config.get('embeddingProvider') || 'ollama';
            const embeddingModel = this.config.get('embeddingModel') || 'nomic-embed-text';

            logger.info(`🧠 Using embedding provider: ${embeddingProvider}`);
            logger.info(`🧠 Embedding model: ${embeddingModel}`);

            // Create embedding connector using configuration patterns
            let providerConfig = {};
            if (embeddingProvider === 'nomic' && process.env.NOMIC_API_KEY) {
                providerConfig = {
                    provider: 'nomic',
                    apiKey: process.env.NOMIC_API_KEY,
                    model: embeddingModel
                };
            } else if (embeddingProvider === 'ollama') {
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                providerConfig = {
                    provider: 'ollama',
                    baseUrl: ollamaBaseUrl,
                    model: embeddingModel
                };
            } else {
                // Default to ollama for any other provider
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                providerConfig = {
                    provider: 'ollama',
                    baseUrl: ollamaBaseUrl,
                    model: embeddingModel
                };
            }

            const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);

            // Determine embedding dimension based on provider/model
            let embeddingDimension;
            if (embeddingProvider === 'nomic' || embeddingModel.includes('nomic')) {
                embeddingDimension = 768; // Nomic embedding dimension
            } else if (embeddingModel.includes('text-embedding')) {
                embeddingDimension = 1536; // OpenAI text-embedding models
            } else {
                embeddingDimension = 1536; // Default dimension for most models
            }

            this.embeddingHandler = new EmbeddingHandler(embeddingConnector, embeddingModel, embeddingDimension);

        } catch (error) {
            logger.warn('Failed to create configured embedding handler, falling back to Ollama:', error.message);
            const embeddingConnector = EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
            this.embeddingHandler = new EmbeddingHandler(embeddingConnector, 'nomic-embed-text', 1536);
        }
    }

    /**
     * Find TextElements without concepts using SPARQL template
     */
    async findTextElementsWithoutConcepts(targetGraph, limit = 0) {
        try {
            // Use SPARQL template for finding TextElements without concepts
            const query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX olo: <http://purl.org/ontology/olo/core#>
                PREFIX semem: <http://semem.hyperdata.it/>

                SELECT ?textElement ?content WHERE {
                    GRAPH <${targetGraph}> {
                        ?textElement a ragno:TextElement ;
                                     ragno:content ?content .
                        
                        # Only process chunks (which have olo:index) to avoid original documents that are too large
                        OPTIONAL { ?textElement olo:index ?index }
                        FILTER (BOUND(?index))
                        
                        # Filter out TextElements that already have concepts extracted
                        FILTER NOT EXISTS {
                            ?textElement semem:hasConcepts true .
                        }
                    }
                }
                ${limit > 0 ? `LIMIT ${limit}` : ''}
            `;

            const storageConfig = this.config.get('storage');
            const result = await this.sparqlHelper.executeSelect(query);

            if (!result.success) {
                throw new Error(`SPARQL query failed: ${result.error}`);
            }

            return result.data.results.bindings;

        } catch (error) {
            logger.error(`Error finding TextElements without concepts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract concepts from text element content
     */
    async extractConcepts(content) {
        try {
            logger.info(`🧠 Extracting concepts from content (${content.length} characters)...`);
            const concepts = await this.llmHandler.extractConcepts(content);
            logger.info(`✅ Extracted ${concepts.length} concepts`);
            return concepts;
        } catch (error) {
            logger.error('❌ Error extracting concepts:', error.message);
            throw error;
        }
    }

    /**
     * Create embeddings for concept text values
     */
    async createConceptEmbeddings(concepts) {
        logger.info(`🧠 Generating embeddings for ${concepts.length} concepts...`);

        const conceptEmbeddings = [];

        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            try {
                logger.info(`   📝 Processing concept ${i + 1}/${concepts.length}: "${concept}"`);

                // Generate embedding for the concept text
                const embedding = await this.embeddingHandler.generateEmbedding(concept);

                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    logger.warn(`   ⚠️  Failed to generate valid embedding for concept: "${concept}"`);
                    continue;
                }

                conceptEmbeddings.push({
                    concept: concept,
                    embedding: embedding
                });

                logger.info(`   ✅ Generated embedding with ${embedding.length} dimensions`);

            } catch (error) {
                logger.error(`   ❌ Error generating embedding for concept "${concept}": ${error.message}`);
                // Continue with other concepts even if one fails
            }
        }

        logger.info(`✅ Successfully generated ${conceptEmbeddings.length} concept embeddings`);
        return conceptEmbeddings;
    }

    /**
     * Create concept corpuscles with embeddings and store in SPARQL
     */
    async createConceptCorpuscles(textElementURI, conceptEmbeddings, targetGraph) {
        logger.info(`📦 Creating concept corpuscles for ${conceptEmbeddings.length} concepts...`);

        const now = new Date().toISOString();
        const conceptCorpuscleURIs = [];
        const conceptURIs = [];

        // Create individual concept corpuscles and units
        let conceptTriples = '';

        for (let i = 0; i < conceptEmbeddings.length; i++) {
            const { concept, embedding } = conceptEmbeddings[i];

            // Generate URIs for concept unit and corpuscle
            const conceptURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
            const conceptCorpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept-corpuscle', concept);

            conceptURIs.push(conceptURI);
            conceptCorpuscleURIs.push(conceptCorpuscleURI);

            // Convert embedding to comma-separated string
            const embeddingString = embedding.join(',');

            conceptTriples += `
                # Concept unit
                <${conceptURI}> a ragno:Unit ;
                    rdfs:label ${SPARQLHelper.createLiteral(concept)} ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:inCorpuscle <${conceptCorpuscleURI}> .
                
                # Individual concept corpuscle with embedding
                <${conceptCorpuscleURI}> a ragno:Corpuscle ;
                    rdfs:label ${SPARQLHelper.createLiteral('Concept: ' + concept)} ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:content ${SPARQLHelper.createLiteral(concept)} ;
                    ragno:embedding ${SPARQLHelper.createLiteral(embeddingString)} ;
                    skos:member <${conceptURI}> .
            `;
        }

        return {
            conceptURIs,
            conceptCorpuscleURIs,
            conceptTriples
        };
    }

    /**
     * Create collection corpuscle that groups all concepts from a text element
     */
    async createCollectionCorpuscle(textElementURI, conceptURIs, targetGraph) {
        logger.info(`📦 Creating collection corpuscle for ${conceptURIs.length} concepts...`);

        const now = new Date().toISOString();
        const collectionCorpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'corpuscle', textElementURI);

        const conceptMembers = conceptURIs.map(uri => `<${uri}>`).join(', ');

        const collectionTriples = `
            # Collection corpuscle that groups all concepts from this text element
            <${collectionCorpuscleURI}> a ragno:Corpuscle ;
                rdfs:label ${SPARQLHelper.createLiteral('Concepts from ' + textElementURI.split('/').pop())} ;
                dcterms:created "${now}"^^xsd:dateTime ;
                prov:wasDerivedFrom <${textElementURI}> ;
                skos:member ${conceptMembers} .
        `;

        return {
            collectionCorpuscleURI,
            collectionTriples
        };
    }

    /**
     * Store all concept-related data in SPARQL store
     */
    async storeConceptData(textElementURI, conceptTriples, collectionTriples, collectionCorpuscleURI, targetGraph) {
        logger.info(`💾 Storing concept data in SPARQL store...`);

        const updateTriples = `
            # Mark TextElement as having concepts extracted
            <${textElementURI}> semem:hasConcepts true ;
                               semem:hasCorpuscle <${collectionCorpuscleURI}> .
            
            ${conceptTriples}
            
            ${collectionTriples}
        `;

        const query = this.sparqlHelper.createInsertDataQuery(targetGraph, updateTriples);
        const result = await this.sparqlHelper.executeUpdate(query);

        if (!result.success) {
            throw new Error(`Failed to store concept data: ${result.error}`);
        }

        logger.info(`✅ Successfully stored concept data in SPARQL store`);
    }

    /**
     * Process a single text element and extract concepts with embeddings
     */
    async processTextElement(textElement, targetGraph) {
        const textElementURI = textElement.textElement.value;
        const content = textElement.content.value;

        logger.info(`📄 Processing TextElement: ${textElementURI}`);
        logger.info(`   📏 Content length: ${content.length} characters`);

        try {
            // Step 1: Extract concepts using LLM
            const concepts = await this.extractConcepts(content);

            if (concepts.length === 0) {
                logger.info(`   ⚠️  No concepts extracted, marking as processed`);

                // Mark as processed even if no concepts found
                const markProcessedTriples = `
                    <${textElementURI}> semem:hasConcepts true .
                `;

                const query = this.sparqlHelper.createInsertDataQuery(targetGraph, markProcessedTriples);
                await this.sparqlHelper.executeUpdate(query);

                return {
                    textElementURI,
                    conceptCount: 0,
                    collectionCorpuscleURI: null,
                    conceptCorpuscleURIs: [],
                    concepts: []
                };
            }

            // Step 2: Create embeddings for concepts
            const conceptEmbeddings = await this.createConceptEmbeddings(concepts);

            if (conceptEmbeddings.length === 0) {
                logger.warn(`   ⚠️  No embeddings generated for concepts, marking as processed`);

                // Mark as processed even if no embeddings generated
                const markProcessedTriples = `
                    <${textElementURI}> semem:hasConcepts true .
                `;

                const query = this.sparqlHelper.createInsertDataQuery(targetGraph, markProcessedTriples);
                await this.sparqlHelper.executeUpdate(query);

                return {
                    textElementURI,
                    conceptCount: concepts.length,
                    collectionCorpuscleURI: null,
                    conceptCorpuscleURIs: [],
                    concepts: concepts
                };
            }

            // Step 3: Create concept corpuscles with embeddings
            const { conceptURIs, conceptCorpuscleURIs, conceptTriples } =
                await this.createConceptCorpuscles(textElementURI, conceptEmbeddings, targetGraph);

            // Step 4: Create collection corpuscle
            const { collectionCorpuscleURI, collectionTriples } =
                await this.createCollectionCorpuscle(textElementURI, conceptURIs, targetGraph);

            // Step 5: Store all data in SPARQL store
            await this.storeConceptData(
                textElementURI,
                conceptTriples,
                collectionTriples,
                collectionCorpuscleURI,
                targetGraph
            );

            logger.info(`   ✅ Successfully processed with ${conceptEmbeddings.length} concept corpuscles`);
            logger.info(`   📝 Concepts: ${concepts.slice(0, 5).join(', ')}${concepts.length > 5 ? '...' : ''}`);

            return {
                textElementURI,
                conceptCount: conceptEmbeddings.length,
                collectionCorpuscleURI,
                conceptCorpuscleURIs,
                concepts
            };

        } catch (error) {
            logger.error(`   ❌ Error processing ${textElementURI}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Main processing method
     */
    async processTextElements(options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const { limit = 0, graph } = options;

        const storageConfig = this.config.get('storage');
        const targetGraph = graph || storageConfig.options.graphName ||
            this.config.get('graphName') ||
            'http://tensegrity.it/semem';

        logger.info(`🔍 Finding TextElements without concepts in graph: ${targetGraph}`);
        logger.info(`📏 Limit: ${limit === 0 ? 'No limit (process all)' : limit}`);

        const textElementsWithoutConcepts = await this.findTextElementsWithoutConcepts(targetGraph, limit);
        logger.info(`📋 Found ${textElementsWithoutConcepts.length} TextElements without concepts`);

        if (textElementsWithoutConcepts.length === 0) {
            logger.info('✅ All TextElements already have concepts extracted.');
            return [];
        }

        const results = [];
        let processed = 0;
        let failed = 0;
        let totalConcepts = 0;
        let totalCorpuscles = 0;

        for (const textElement of textElementsWithoutConcepts) {
            try {
                const result = await this.processTextElement(textElement, targetGraph);
                results.push(result);
                processed++;
                totalConcepts += result.conceptCount;
                totalCorpuscles += result.conceptCorpuscleURIs.length;
                if (result.collectionCorpuscleURI) {
                    totalCorpuscles += 1; // Add collection corpuscle
                }
            } catch (error) {
                logger.error(`Failed to process TextElement: ${error.message}`);
                failed++;
            }
        }

        logger.info(`\n📊 Enhanced Concept Extraction Summary:`);
        logger.info(`   ✅ Successfully processed: ${processed} TextElements`);
        logger.info(`   ❌ Failed: ${failed} TextElements`);
        logger.info(`   🧠 Total concepts extracted: ${totalConcepts}`);
        logger.info(`   📦 Total corpuscles created: ${totalCorpuscles}`);
        logger.info(`   🔗 Collection corpuscles: ${results.filter(r => r.collectionCorpuscleURI).length}`);
        logger.info(`   🎯 Graph: ${targetGraph}`);

        return results;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.embeddingHandler && typeof this.embeddingHandler.cleanup === 'function') {
            await this.embeddingHandler.cleanup();
        }

        if (this.llmHandler && typeof this.llmHandler.cleanup === 'function') {
            await this.llmHandler.cleanup();
        }

        if (this.sparqlHelper && typeof this.sparqlHelper.cleanup === 'function') {
            await this.sparqlHelper.cleanup();
        }

        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }

        this.initialized = false;
        logger.info('✅ CreateConcepts cleanup completed');
    }
}