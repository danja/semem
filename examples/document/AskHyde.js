#!/usr/bin/env node

/**
 * AskHyde - HyDE-enhanced question answering for documents
 * 
 * This script applies the HyDE (Hypothetical Document Embeddings) algorithm
 * to enhance question answering by generating hypothetical documents related
 * to the question before searching the knowledge store.
 * 
 * Processing flow:
 * 1. Receives a question and ingests it as a corpuscle
 * 2. Applies Hyde algorithm to generate hypothetical documents
 * 3. Extracts concepts from hypothetical documents
 * 4. Searches the enhanced knowledge store
 * 5. Constructs context and generates LLM response
 * 
 * Usage: node examples/document/AskHyde.js [question]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root FIRST
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { parseArgs } from 'util';
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { TextToCorpuscle } from '../../src/ragno/TextToCorpuscle.js';
import DocumentSearchSystem from './Search.js';
import { CreateConceptsUnified } from '../../src/ragno/CreateConceptsUnified.js';
import { quickStart, PromptContext, PromptOptions } from '../../src/prompts/index.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import logger from 'loglevel';
import chalk from 'chalk';
import readline from 'readline';

// Configure logging
logger.setLevel(process.env.LOG_LEVEL || 'info');

/**
 * HyDE Generator class for creating hypothetical documents
 */
class HyDEGenerator {
    constructor(llmHandler, embeddingHandler, sparqlHelper) {
        this.llmHandler = llmHandler;
        this.embeddingHandler = embeddingHandler;
        this.sparqlHelper = sparqlHelper;
        this.conceptExtractor = new CreateConceptsUnified();
    }

    async init() {
        await this.conceptExtractor.init();
    }

    async cleanup() {
        await this.conceptExtractor.cleanup();
    }

    /**
     * Generate hypothetical document for a given question
     */
    async generateHypotheticalDocument(queryText, attempt = 1) {
        logger.info(`🔮 Generating hypothetical document (attempt ${attempt})...`);

        const prompt = `Given the following question or text, generate a hypothetical document that would be relevant and helpful for answering or understanding it. The document should be informative, detailed, and directly address the key concepts in the question.

Question: ${queryText}

Generate a hypothetical document that would contain the information needed to answer this question:`;

        try {
            const response = await this.llmHandler.generateResponse(prompt);

            // Log trimmed version of hypothetical
            const trimmedHypothetical = response.length > 200 ?
                response.substring(0, 200) + '...' : response;
            logger.info(`📄 Generated hypothetical (trimmed): ${chalk.dim(trimmedHypothetical)}`);
            
            // Also log the full hypothetical document
            console.log(chalk.bold.cyan('\n🔮 FULL HYPOTHETICAL DOCUMENT:'));
            console.log(chalk.yellow('='.repeat(80)));
            console.log(chalk.white(response));
            console.log(chalk.yellow('='.repeat(80)));
            console.log('');

            return {
                content: response,
                attempt: attempt,
                queryText: queryText,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`❌ Failed to generate hypothetical document: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract concepts from hypothetical document
     */
    async extractConceptsFromHypothetical(hypotheticalDoc) {
        logger.info('🧠 Extracting concepts from hypothetical document...');

        try {
            const concepts = await this.llmHandler.extractConcepts(hypotheticalDoc.content);

            // Enhance concepts with Hyde metadata
            const enhancedConcepts = concepts.map(concept => ({
                value: concept,
                source: 'hyde',
                attempt: hypotheticalDoc.attempt,
                originalQuery: hypotheticalDoc.queryText,
                timestamp: hypotheticalDoc.timestamp
            }));

            logger.info(`✅ Extracted ${enhancedConcepts.length} concepts from hypothetical document`);
            return enhancedConcepts;
        } catch (error) {
            logger.error(`❌ Failed to extract concepts from hypothetical: ${error.message}`);
            throw error;
        }
    }

    /**
     * Store concepts with embeddings
     */
    async storeConcepts(concepts, parentCorpuscleURI) {
        logger.info('💾 Storing HyDE concepts with embeddings...');

        try {
            const results = [];

            for (const concept of concepts) {
                // Validate concept value before generating embedding
                if (!concept.value || typeof concept.value !== 'string' || concept.value.trim().length === 0) {
                    logger.warn(`Skipping invalid concept: ${JSON.stringify(concept)}`);
                    continue;
                }
                
                // Generate embedding for concept
                const embedding = await this.embeddingHandler.generateEmbedding(concept.value.trim());

                // Create concept URI
                const conceptURI = `http://purl.org/stuff/instance/hyde-concept/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Store concept data using SPARQL helper with proper escaping
                const triples = `
                    <${conceptURI}> a <http://purl.org/stuff/ragno/Concept> ;
                        <http://purl.org/stuff/ragno/conceptValue> ${SPARQLHelper.createLiteral(concept.value, 'http://www.w3.org/2001/XMLSchema#string')} ;
                        <http://purl.org/stuff/ragno/conceptSource> "hyde" ;
                        <http://purl.org/stuff/ragno/parentCorpuscle> <${parentCorpuscleURI}> ;
                        <http://purl.org/stuff/ragno/timestamp> ${SPARQLHelper.createLiteral(concept.timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} ;
                        <http://purl.org/stuff/ragno/attempt> ${SPARQLHelper.createLiteral(concept.attempt.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} ;
                        <http://purl.org/stuff/ragno/originalQuery> ${SPARQLHelper.createLiteral(concept.originalQuery, 'http://www.w3.org/2001/XMLSchema#string')} .
                `;

                const insertQuery = this.sparqlHelper.createInsertDataQuery('http://tensegrity.it/semem', triples);
                logger.debug('Generated SPARQL query:', insertQuery.substring(0, 200) + '...');
                const result = await this.sparqlHelper.executeUpdate(insertQuery);
                
                if (!result.success) {
                    logger.error('SPARQL execution failed:', result.error);
                    logger.error('Query was:', insertQuery);
                    throw new Error(`Failed to store concept: ${result.error}`);
                }

                results.push({
                    uri: conceptURI,
                    value: concept.value,
                    embedding: embedding,
                    parentCorpuscle: parentCorpuscleURI
                });
            }

            logger.info(`✅ Stored ${results.length} HyDE concepts with embeddings`);
            return results;
        } catch (error) {
            logger.error(`❌ Failed to store HyDE concepts: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Main AskHyde class
 */
class AskHyde {
    constructor() {
        this.config = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.textToCorpuscle = null;
        this.documentSearchSystem = null;
        this.hydeGenerator = null;
        this.promptManager = null;
    }

    /**
     * Create LLM connector based on configuration priority
     */
    async createLLMConnector(config) {
        try {
            // Get llmProviders with priority ordering
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                if (provider.type === 'mistral' && provider.apiKey && process.env.MISTRAL_API_KEY) {
                    logger.info(`🤖 Using Mistral LLM with model: ${provider.chatModel}`);
                    return new MistralConnector(process.env.MISTRAL_API_KEY);
                } else if (provider.type === 'claude' && provider.apiKey && process.env.CLAUDE_API_KEY) {
                    logger.info(`🤖 Using Claude LLM with model: ${provider.chatModel}`);
                    return new ClaudeConnector(process.env.CLAUDE_API_KEY);
                } else if (provider.type === 'ollama') {
                    logger.info(`🤖 Using Ollama LLM with model: ${provider.chatModel}`);
                    return new OllamaConnector();
                }
            }
            
            // Default fallback
            logger.info('🤖 Fallback to Ollama LLM');
            return new OllamaConnector();
            
        } catch (error) {
            logger.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
            return new OllamaConnector();
        }
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
     */
    async createEmbeddingConnector(config) {
        try {
            const embeddingProviders = config.get('embeddingProviders') || [];
            const sortedProviders = embeddingProviders
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            for (const provider of sortedProviders) {
                if (provider.type === 'nomic' && provider.apiKey) {
                    logger.info(`🧠 Using Nomic embedding with model: ${provider.embeddingModel}`);
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'nomic',
                        apiKey: provider.apiKey,
                        model: provider.embeddingModel || 'nomic-embed-text-v1.5'
                    });
                } else if (provider.type === 'ollama') {
                    logger.info(`🧠 Using Ollama embedding with model: ${provider.embeddingModel}`);
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'ollama',
                        baseUrl: provider.baseUrl || 'http://localhost:11434',
                        model: provider.embeddingModel || 'nomic-embed-text'
                    });
                }
            }
            
            // Default fallback
            logger.info('🧠 Fallback to Ollama embedding');
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
            
        } catch (error) {
            logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
        }
    }

    /**
     * Get working model names from configuration
     */
    async getModelConfig(config) {
        try {
            // Get highest priority providers
            const llmProviders = config.get('llmProviders') || [];
            const embeddingProviders = config.get('embeddingProviders') || [];
            
            // Find the chat provider that will actually be used
            const chatProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            let selectedChatProvider = null;
            for (const provider of chatProviders) {
                if (provider.type === 'mistral' && provider.apiKey && process.env.MISTRAL_API_KEY) {
                    selectedChatProvider = provider;
                    break;
                } else if (provider.type === 'claude' && provider.apiKey && process.env.CLAUDE_API_KEY) {
                    selectedChatProvider = provider;
                    break;
                } else if (provider.type === 'ollama') {
                    selectedChatProvider = provider;
                    break;
                }
            }
            
            const embeddingProvider = embeddingProviders
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            
            return {
                chatModel: selectedChatProvider?.chatModel || 'qwen2:1.5b',
                embeddingModel: embeddingProvider?.embeddingModel || 'nomic-embed-text'
            };
        } catch (error) {
            logger.warn('Failed to get model config from configuration, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b',
                embeddingModel: 'nomic-embed-text'
            };
        }
    }

    async init() {
        logger.info('🚀 Initializing AskHyde system...');

        // Initialize configuration using modern pattern
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();

        // Get storage configuration
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('AskHyde requires SPARQL storage configuration');
        }
        
        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });

        // Initialize providers using modern configuration-driven pattern
        const llmProvider = await this.createLLMConnector(this.config);
        const embeddingProvider = await this.createEmbeddingConnector(this.config);
        const modelConfig = await this.getModelConfig(this.config);

        // Initialize handlers with proper configuration
        const dimension = this.config.get('memory.dimension') || 1536;
        
        this.embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            dimension
        );

        this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

        // Initialize text to corpuscle converter
        this.textToCorpuscle = new TextToCorpuscle(this.config);
        await this.textToCorpuscle.init();

        // Initialize document search system
        this.documentSearchSystem = new DocumentSearchSystem(this.config);
        await this.documentSearchSystem.initialize();

        // Initialize HyDE generator
        this.hydeGenerator = new HyDEGenerator(this.llmHandler, this.embeddingHandler, this.sparqlHelper);
        await this.hydeGenerator.init();

        // Initialize prompt manager
        this.promptManager = await quickStart();

        logger.info('✅ AskHyde system initialized successfully');
    }

    async cleanup() {
        logger.info('🧹 Cleaning up AskHyde system...');

        if (this.hydeGenerator) {
            await this.hydeGenerator.cleanup();
        }

        if (this.textToCorpuscle) {
            await this.textToCorpuscle.cleanup();
        }

        if (this.documentSearchSystem) {
            await this.documentSearchSystem.cleanup();
        }

        logger.info('✅ Cleanup completed');
    }

    /**
     * Process a single question through the HyDE-enhanced pipeline
     */
    async processQuestion(question) {
        logger.info(`🔍 Processing question: ${chalk.cyan(question)}`);
        const startTime = Date.now();

        try {
            // Step 1: Create corpuscle for the question
            logger.info('📝 Creating corpuscle for question...');
            const questionCorpuscleURI = await this.textToCorpuscle.processQuestion(question);
            logger.info(`✅ Created question corpuscle: ${questionCorpuscleURI}`);

            // Step 2: Apply HyDE algorithm
            logger.info('🔮 Applying HyDE algorithm...');
            const hypotheticalDoc = await this.hydeGenerator.generateHypotheticalDocument(question);

            // Step 3: Extract concepts from hypothetical document
            const hydeConcepts = await this.hydeGenerator.extractConceptsFromHypothetical(hypotheticalDoc);

            // Step 4: Store HyDE concepts with embeddings
            await this.hydeGenerator.storeConcepts(hydeConcepts, questionCorpuscleURI);

            // Step 5: Search enhanced knowledge store
            logger.info('🔍 Searching enhanced knowledge store...');
            const searchResponse = await this.documentSearchSystem.processQuery(question);
            const searchResults = searchResponse.results || [];

            logger.info(`✅ Found ${searchResults.length} relevant documents`);

            // Step 6: Construct context for LLM
            logger.info('🧠 Constructing context for LLM...');
            const context = this.buildContext(question, searchResults, hydeConcepts);

            // Step 7: Generate final response
            logger.info('💬 Generating final response...');
            const response = await this.generateResponse(context);

            const processingTime = Date.now() - startTime;
            logger.info(`✅ Question processed in ${processingTime}ms`);

            return {
                question: question,
                response: response,
                questionCorpuscleURI: questionCorpuscleURI,
                hypotheticalDoc: hypotheticalDoc,
                hydeConcepts: hydeConcepts,
                searchResults: searchResults,
                processingTime: processingTime
            };

        } catch (error) {
            logger.error(`❌ Failed to process question: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build context for LLM response generation
     */
    buildContext(question, searchResults, hydeConcepts) {
        const relevantTexts = searchResults.map(result => result.content).join('\n\n');
        const conceptSummary = hydeConcepts.map(c => c.value).join(', ');

        return {
            question: question,
            relevantContent: relevantTexts,
            hydeConcepts: conceptSummary,
            searchResultCount: searchResults.length,
            conceptCount: hydeConcepts.length
        };
    }

    /**
     * Generate final response using LLM
     */
    async generateResponse(context) {
        const promptContext = new PromptContext({
            query: context.question,
            context: `Based on the following relevant information and HyDE-generated concepts:

Relevant Information:
${context.relevantContent}

HyDE Concepts: ${context.hydeConcepts}

Please provide a comprehensive answer to the question.`,
            systemPrompt: "You are a helpful assistant that provides accurate, detailed answers based on the provided context. Use the relevant information and concepts to give a thorough response.",
            model: this.config.get('defaultChatModel') || 'qwen2:1.5b',
            temperature: 0.7
        });

        const options = new PromptOptions({
            format: 'structured',
            includeMetadata: true
        });

        const result = await this.promptManager.generatePrompt('chat-default', promptContext, options);

        if (result.success) {
            const response = await this.llmHandler.generateResponse(result.content);
            return response;
        } else {
            throw new Error('Failed to generate prompt for response');
        }
    }

    /**
     * Interactive mode for multiple questions
     */
    async interactiveMode() {
        console.log(chalk.bold.blue('\n🔮 AskHyde Interactive Mode'));
        console.log(chalk.gray('Type "exit" to quit, "help" for commands\n'));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const askQuestion = () => {
            rl.question(chalk.cyan('Ask a question: '), async (question) => {
                if (question.toLowerCase() === 'exit') {
                    rl.close();
                    return;
                }

                if (question.toLowerCase() === 'help') {
                    console.log(chalk.yellow('\nCommands:'));
                    console.log('  exit - Exit interactive mode');
                    console.log('  help - Show this help message');
                    console.log('  Any other text - Ask a question\n');
                    askQuestion();
                    return;
                }

                if (question.trim() === '') {
                    askQuestion();
                    return;
                }

                try {
                    const result = await this.processQuestion(question);

                    console.log(chalk.bold.green('\n📋 Answer:'));
                    console.log(chalk.white(result.response));

                    console.log(chalk.dim(`\n📊 Stats: ${result.hydeConcepts.length} HyDE concepts, ${result.searchResults.length} search results, ${result.processingTime}ms`));

                } catch (error) {
                    console.log(chalk.red(`\n❌ Error: ${error.message}`));
                }

                console.log('');
                askQuestion();
            });
        };

        askQuestion();
    }
}

/**
 * Main function
 */
async function main() {
    const { values: args } = parseArgs({
        options: {
            interactive: {
                type: 'boolean',
                short: 'i',
                default: false
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        },
        allowPositionals: true
    });

    if (args.help) {
        console.log(`
AskHyde - HyDE-enhanced question answering system

Usage: node examples/document/AskHyde.js [options] [question]

Options:
  -i, --interactive    Start in interactive mode
  -h, --help          Show this help message

Examples:
  node examples/document/AskHyde.js "What is machine learning?"
  node examples/document/AskHyde.js -i
  
Features:
  - HyDE (Hypothetical Document Embeddings) algorithm
  - Concept extraction from hypothetical documents
  - Enhanced knowledge store search
  - Interactive question-answering mode
  - Comprehensive progress reporting
        `);
        return;
    }

    const askHyde = new AskHyde();

    // Set up signal handlers for graceful shutdown
    const gracefulShutdown = async (signal) => {
        logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
        if (askHyde) {
            await askHyde.cleanup();
        }
        process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    try {
        await askHyde.init();

        if (args.interactive) {
            await askHyde.interactiveMode();
        } else {
            const question = process.argv.slice(2).join(' ').replace(/^-+\w+\s*/, '').trim();

            if (!question) {
                console.log(chalk.red('❌ Please provide a question or use --interactive mode'));
                console.log(chalk.gray('Use --help for usage information'));
                return;
            }

            const result = await askHyde.processQuestion(question);

            console.log(chalk.bold.green('\n📋 Answer:'));
            console.log(chalk.white(result.response));

            console.log(chalk.dim(`\n📊 Processing completed in ${result.processingTime}ms`));
            console.log(chalk.dim(`🔮 HyDE concepts: ${result.hydeConcepts.length}`));
            console.log(chalk.dim(`🔍 Search results: ${result.searchResults.length}`));
        }

    } catch (error) {
        logger.error(`❌ AskHyde failed: ${error.message}`);

        if (logger.getLevel() <= logger.levels.DEBUG) {
            logger.error('Stack:', error.stack);
        }

        // Ensure cleanup even on error
        if (askHyde) {
            await askHyde.cleanup();
        }
        
        process.exit(1);
    } finally {
        // Always ensure cleanup
        if (askHyde) {
            await askHyde.cleanup();
        }
        
        // Force process termination after cleanup
        setTimeout(() => {
            logger.info('🔚 Process termination timeout reached, forcing exit');
            process.exit(0);
        }, 2000);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

export default AskHyde;