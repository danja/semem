/**
 * TextToCorpuscle.js - Convert text questions into SPARQL corpuscles
 * 
 * This module provides functionality to convert text questions into structured
 * corpuscles in the SPARQL store, including embeddings and concept extraction.
 * 
 * Features:
 * - Mint URIs for questions using content-based hashing
 * - Create ragno:Corpuscle and ragno:TextElement structures
 * - Generate embeddings for question text
 * - Extract concepts using configured LLM providers
 * - Store all data in SPARQL store following Ragno ontology
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

export class TextToCorpuscle {
    constructor(config = null) {
        this.config = config;
        this.sparqlHelper = null;
        this.queryService = null;
        this.embeddingHandler = null;
        this.llmHandler = null;
        this.initialized = false;
    }

    /**
     * Initialize the TextToCorpuscle system
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
            throw new Error('TextToCorpuscle requires SPARQL storage configuration');
        }

        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService();
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });

        // Initialize embedding handler
        await this.initializeEmbeddingHandler();

        // Initialize LLM handler
        await this.initializeLLMHandler();

        this.initialized = true;
        logger.info('✅ TextToCorpuscle system initialized');
    }

    /**
     * Initialize embedding handler based on configuration
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
     * Process a question text and create a corpuscle with all associated data
     * 
     * @param {string} questionText - The question text to process
     * @param {Object} options - Optional parameters
     * @param {string} options.graphName - Target graph URI (default: from config)
     * @returns {string} URI of the created corpuscle
     */
    async processQuestion(questionText, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
            throw new Error('Question text is required and must be a non-empty string');
        }

        const cleanQuestion = questionText.trim();
        const storageConfig = this.config.get('storage');
        const graphName = options.graphName || storageConfig.options.graphName || this.config.get('graphName') || 'http://tensegrity.it/semem';

        logger.info('🔄 Processing question to corpuscle...');
        logger.info(`📝 Question: "${cleanQuestion}"`);
        logger.info(`🗃️  Target graph: ${graphName}`);

        try {
            // Step 1: Mint URIs for the question
            const questionURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'question', cleanQuestion);
            const textElementURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'text', cleanQuestion);
            const corpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'corpuscle', cleanQuestion);

            logger.info(`🔗 Generated URIs:`);
            logger.info(`   Question: ${questionURI}`);
            logger.info(`   TextElement: ${textElementURI}`);
            logger.info(`   Corpuscle: ${corpuscleURI}`);

            // Step 2: Create basic RDF structure for question and text element
            await this.createBasicStructure(graphName, questionURI, textElementURI, corpuscleURI, cleanQuestion);

            // Step 3: Generate and store embedding for the question
            await this.createEmbedding(graphName, textElementURI, cleanQuestion);

            // Step 4: Extract concepts from the question
            await this.extractConcepts(graphName, textElementURI, corpuscleURI, cleanQuestion);

            logger.info(`✅ Successfully created corpuscle: ${corpuscleURI}`);
            return corpuscleURI;

        } catch (error) {
            logger.error('❌ Error processing question to corpuscle:', error.message);
            throw error;
        }
    }

    /**
     * Create basic RDF structure for question, text element, and corpuscle
     */
    async createBasicStructure(graphName, questionURI, textElementURI, corpuscleURI, questionText) {
        logger.info('📊 Creating basic RDF structure...');

        const now = new Date().toISOString();

        const triples = `
        # Question as Unit
        <${questionURI}> a ragno:Unit ;
            rdfs:label ${SPARQLHelper.createLiteral(questionText)} ;
            dcterms:created "${now}"^^xsd:dateTime ;
            ragno:hasTextElement <${textElementURI}> .

        # Question text as TextElement
        <${textElementURI}> a ragno:TextElement ;
            rdfs:label ${SPARQLHelper.createLiteral(questionText + ' text')} ;
            dcterms:created "${now}"^^xsd:dateTime ;
            ragno:content ${SPARQLHelper.createLiteral(questionText)} ;
            dcterms:extent ${questionText.length} ;
            prov:wasDerivedFrom <${questionURI}> .

        # Corpuscle for the question
        <${corpuscleURI}> a ragno:Corpuscle ;
            rdfs:label ${SPARQLHelper.createLiteral('Concepts from ' + questionText)} ;
            dcterms:created "${now}"^^xsd:dateTime ;
            prov:wasDerivedFrom <${textElementURI}> .
        `;

        const query = this.sparqlHelper.createInsertDataQuery(graphName, triples);
        const result = await this.sparqlHelper.executeUpdate(query);

        if (!result.success) {
            throw new Error(`Failed to create basic structure: ${result.error}`);
        }

        logger.info('✅ Basic RDF structure created successfully');
    }

    /**
     * Generate and store embedding for the question text
     */
    async createEmbedding(graphName, textElementURI, questionText) {
        logger.info('🧠 Generating embedding for question...');

        try {
            // Generate embedding using the configured embedding handler
            const embedding = await this.embeddingHandler.generateEmbedding(questionText);
            
            if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                throw new Error('Failed to generate valid embedding');
            }

            logger.info(`✅ Generated embedding with ${embedding.length} dimensions`);

            // Convert embedding to comma-separated string for storage
            const embeddingString = embedding.join(',');

            // Store embedding in SPARQL store
            const triples = `
            <${textElementURI}> ragno:embedding ${SPARQLHelper.createLiteral(embeddingString)} .
            `;

            const query = this.sparqlHelper.createInsertDataQuery(graphName, triples);
            const result = await this.sparqlHelper.executeUpdate(query);

            if (!result.success) {
                throw new Error(`Failed to store embedding: ${result.error}`);
            }

            logger.info('✅ Embedding stored successfully');

        } catch (error) {
            logger.error('❌ Error generating/storing embedding:', error.message);
            throw error;
        }
    }

    /**
     * Extract concepts from the question and create associated structures
     */
    async extractConcepts(graphName, textElementURI, corpuscleURI, questionText) {
        logger.info('🧠 Extracting concepts from question...');

        try {
            // Extract concepts using LLM handler
            const concepts = await this.llmHandler.extractConcepts(questionText);
            
            if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
                logger.warn('⚠️  No concepts extracted from question');
                return;
            }

            logger.info(`✅ Extracted ${concepts.length} concepts`);

            const now = new Date().toISOString();
            let conceptTriples = '';
            const conceptURIs = [];

            // Create concept units and add them to the corpuscle
            for (let i = 0; i < concepts.length; i++) {
                const concept = concepts[i];
                const conceptURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
                conceptURIs.push(conceptURI);

                conceptTriples += `
                # Concept unit
                <${conceptURI}> a ragno:Unit ;
                    rdfs:label ${SPARQLHelper.createLiteral(concept)} ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:inCorpuscle <${corpuscleURI}> .

                # Add concept to corpuscle
                <${corpuscleURI}> skos:member <${conceptURI}> .
                `;
            }

            // Mark text element as having concepts extracted
            conceptTriples += `
            <${textElementURI}> semem:hasConcepts true ;
                semem:hasCorpuscle <${corpuscleURI}> .
            `;

            const query = this.sparqlHelper.createInsertDataQuery(graphName, conceptTriples);
            const result = await this.sparqlHelper.executeUpdate(query);

            if (!result.success) {
                throw new Error(`Failed to store concepts: ${result.error}`);
            }

            logger.info(`✅ Successfully stored ${concepts.length} concepts`);
            logger.info(`📝 Concepts: ${concepts.join(', ')}`);

        } catch (error) {
            logger.error('❌ Error extracting/storing concepts:', error.message);
            throw error;
        }
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
        logger.info('✅ TextToCorpuscle cleanup completed');
    }
}