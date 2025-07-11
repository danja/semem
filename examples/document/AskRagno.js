#!/usr/bin/env node

/**
 * AskRagno.js - Question Answering System with Ragno Integration
 * 
 * This script allows users to enter a question and get an answer by:
 * 1. Processing the question using ConsumeQuestion.js patterns to create a corpuscle
 * 2. Searching for relevant information using Search.js patterns
 * 3. Formulating retrieved context into a chat completion prompt
 * 4. Returning the LLM response to the user
 * 
 * Features:
 * - Question storage as corpuscles for future reference
 * - Semantic search using existing search infrastructure
 * - Context augmentation with search results
 * - Multi-provider LLM support with fallback chain
 * - Interactive mode for multiple questions
 * - Comprehensive error handling and logging
 * 
 * Usage:
 * - node examples/document/AskRagno.js "What is machine learning?"
 * - node examples/document/AskRagno.js --interactive
 * - node examples/document/AskRagno.js "How does neural network training work?" --graph "http://example.org/my-docs"
 * - node examples/document/AskRagno.js --help
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import logger from 'loglevel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Core infrastructure imports
import Config from '../../src/Config.js';
import ContextManager from '../../src/ContextManager.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { TextToCorpuscle } from '../../src/ragno/TextToCorpuscle.js';
import DocumentSearchSystem from './Search.js';

// LLM and embedding providers
import MistralConnector from '../../src/connectors/MistralConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';

// Configure logging
logger.setLevel(process.env.LOG_LEVEL || 'info');

class AskRagnoSystem {
    constructor(configPath = null, options = {}) {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.textToCorpuscle = null;
        this.searchSystem = null;
        this.contextManager = null;
        this.llmHandler = null;
        this.initialized = false;
        this._cleanupInProgress = false;
        
        // Configuration
        this.configPath = configPath;
        this.sparqlEndpoint = null;
        this.graphName = null;
        this.auth = null;
        
        // Search options (can be overridden via command line)
        this.searchOptions = {
            threshold: options.threshold,
            mode: options.mode,
            limit: options.limit,
            graphName: options.graphName
        };
        
        // Statistics
        this.stats = {
            totalQuestions: 0,
            successfulAnswers: 0,
            averageResponseTime: 0,
            lastResponseTime: null
        };
    }

    /**
     * Initialize the AskRagno system
     */
    async init() {
        if (this.initialized) {
            logger.debug('🔄 AskRagno system already initialized, skipping...');
            return;
        }

        logger.info('🚀 Initializing AskRagno Question Answering System...');
        logger.info('='.repeat(60));

        try {
            // 1. Initialize configuration
            await this.initializeConfig();
            
            // 2. Initialize SPARQL services
            await this.initializeSPARQLServices();
            
            // 3. Initialize question processing
            await this.initializeQuestionProcessing();
            
            // 4. Initialize search system
            await this.initializeSearchSystem();
            
            // 5. Initialize context management
            await this.initializeContextManagement();
            
            // 6. Initialize LLM handler
            await this.initializeLLMHandler();

            this.initialized = true;
            logger.info('🎉 ASKRAGNO SYSTEM INITIALIZED!');
            logger.info('='.repeat(60));

        } catch (error) {
            logger.error('❌ Failed to initialize AskRagno system:', error.message);
            throw error;
        }
    }

    /**
     * Initialize configuration following infrastructure patterns
     */
    async initializeConfig() {
        const configPath = this.configPath || 
            (process.cwd().endsWith('/examples/document') 
                ? '../../config/config.json' 
                : 'config/config.json');
        
        this.config = new Config(configPath);
        await this.config.init();
        
        // Set up SPARQL configuration
        const storageConfig = this.config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('AskRagno requires SPARQL storage configuration');
        }
        
        this.sparqlEndpoint = storageConfig.options.query;
        this.graphName = storageConfig.options.graphName || 
                        this.config.get('graphName') || 
                        'http://tensegrity.it/semem';
        this.auth = {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        };
        
        logger.info(`📊 Configuration loaded:`);
        logger.info(`   🗃️  Graph: ${this.graphName}`);
        logger.info(`   📊 SPARQL endpoint: ${this.sparqlEndpoint}`);
    }

    /**
     * Initialize SPARQL services
     */
    async initializeSPARQLServices() {
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });

        this.sparqlHelper = new SPARQLHelper(this.sparqlEndpoint, this.auth);
        
        logger.info('✅ SPARQL services initialized');
    }

    /**
     * Initialize question processing using TextToCorpuscle
     */
    async initializeQuestionProcessing() {
        this.textToCorpuscle = new TextToCorpuscle(this.config);
        await this.textToCorpuscle.init();
        
        logger.info('✅ Question processing initialized');
    }

    /**
     * Initialize search system
     */
    async initializeSearchSystem() {
        this.searchSystem = new DocumentSearchSystem(this.config, {
            // Use config defaults for mode, threshold, and other options
            // Override with command-line options if provided
            mode: this.searchOptions.mode,
            threshold: this.searchOptions.threshold,
            limit: this.searchOptions.limit || 5, // Default to 5 for focused question answering
            includeContext: true,
            includeProvenance: true,
            graphName: this.searchOptions.graphName || this.graphName
        });
        
        await this.searchSystem.initialize();
        
        logger.info('✅ Search system initialized');
    }

    /**
     * Initialize context management
     */
    async initializeContextManagement() {
        this.contextManager = new ContextManager({
            maxTokens: 8192,
            maxTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
            relevanceThreshold: 0.6,
            maxContextSize: 10,
            overlapRatio: 0.1
        }, this.config);
        
        logger.info('✅ Context management initialized');
    }

    /**
     * Initialize LLM handler with priority-based provider selection
     */
    async initializeLLMHandler() {
        const llmResult = await this.createLLMConnector();
        this.llmHandler = new LLMHandler(llmResult.provider, llmResult.model);
        
        logger.info(`✅ LLM handler initialized with ${llmResult.provider.constructor.name}`);
    }

    /**
     * Create LLM connector based on configuration priority
     */
    async createLLMConnector() {
        try {
            const llmProviders = this.config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            for (const provider of sortedProviders) {
                try {
                    chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';
                    
                    if (provider.type === 'mistral' && provider.apiKey) {
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    } else if (provider.type === 'claude' && provider.apiKey) {
                        llmProvider = new ClaudeConnector(process.env.CLAUDE_API_KEY);
                        logger.info(`🤖 Using Claude LLM with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    } else if (provider.type === 'ollama') {
                        const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                        llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                        logger.info(`🤖 Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    }
                } catch (error) {
                    logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                    continue;
                }
            }

            // Fallback to Ollama
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
            llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            logger.info(`🤖 Fallback to Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
            return { provider: llmProvider, model: chatModel };

        } catch (error) {
            logger.warn('Failed to load LLM provider configuration, defaulting to Ollama:', error.message);
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
            return { provider: new OllamaConnector(ollamaBaseUrl, chatModel), model: chatModel };
        }
    }

    /**
     * Process a question and generate an answer
     */
    async processQuestion(questionText, options = {}) {
        if (!this.initialized) {
            logger.info('🔄 System not initialized, initializing now...');
            await this.init();
        }

        const startTime = Date.now();
        this.stats.totalQuestions++;

        logger.info('🔍 PROCESSING QUESTION');
        logger.info('='.repeat(60));
        logger.info(`❓ Question: "${questionText}"`);

        try {
            // Step 1: Store question as corpuscle
            logger.info('\n📝 Step 1: Storing question as corpuscle...');
            const corpuscleURI = await this.textToCorpuscle.processQuestion(questionText, {
                graphName: options.graphName || this.graphName
            });
            logger.info(`✅ Question stored: ${corpuscleURI}`);

            // Step 2: Search for relevant information
            logger.info('\n🔍 Step 2: Searching for relevant information...');
            const searchResults = await this.searchSystem.processQuery(questionText);
            logger.info(`✅ Found ${searchResults.results.length} relevant results`);

            // Step 3: Build context from search results
            logger.info('\n🧠 Step 3: Building context from search results...');
            const context = this.buildContextFromResults(questionText, searchResults);
            logger.info(`✅ Context built (${context.length} characters)`);

            // Step 4: Generate answer using LLM
            logger.info('\n💬 Step 4: Generating answer with LLM...');
            const answer = await this.generateAnswer(questionText, context);
            logger.info(`✅ Answer generated (${answer.length} characters)`);

            // Calculate response time
            const responseTime = Date.now() - startTime;
            this.stats.lastResponseTime = responseTime;
            this.stats.averageResponseTime = (this.stats.averageResponseTime * (this.stats.totalQuestions - 1) + responseTime) / this.stats.totalQuestions;
            this.stats.successfulAnswers++;

            logger.info('\n🎉 QUESTION PROCESSING COMPLETED!');
            logger.info(`⏱️  Response time: ${responseTime}ms`);
            logger.info('='.repeat(60));

            return {
                question: questionText,
                answer: answer,
                corpuscleURI: corpuscleURI,
                searchResults: searchResults,
                context: context,
                responseTime: responseTime
            };

        } catch (error) {
            logger.error('❌ Error processing question:', error.message);
            throw error;
        }
    }

    /**
     * Build context from search results
     */
    buildContextFromResults(question, searchResults) {
        if (!searchResults.results || searchResults.results.length === 0) {
            return '';
        }

        // Convert search results to context format
        const retrievals = searchResults.results.map(result => ({
            interaction: {
                prompt: `Context from: ${result.type || 'document'}`,
                output: result.content || result.summary || 'No content available',
                concepts: result.concepts || []
            },
            similarity: result.score || 0.5
        }));

        // Use ContextManager to build comprehensive context
        const context = this.contextManager.buildContext(
            question,
            retrievals,
            [],
            { 
                systemContext: "You are answering a question based on the provided context from documents and knowledge graphs." 
            }
        );

        return context;
    }

    /**
     * Generate answer using LLM with context
     */
    async generateAnswer(question, context) {
        const prompt = this.buildAnswerPrompt(question, context);
        
        try {
            const response = await this.llmHandler.generateResponse(prompt, "", {
                temperature: 0.7,
                max_tokens: 1000
            });
            
            return response.trim();
        } catch (error) {
            logger.error('Failed to generate answer:', error.message);
            throw new Error(`Failed to generate answer: ${error.message}`);
        }
    }

    /**
     * Build the prompt for answer generation
     */
    buildAnswerPrompt(question, context) {
        return `You are a knowledgeable assistant that answers questions based on the provided context. Use the context to provide accurate, informative answers.

Context:
${context}

Question: ${question}

Please provide a comprehensive answer based on the context above. If the context doesn't contain enough information to fully answer the question, acknowledge this and provide what information you can.

Answer:`;
    }

    /**
     * Get system statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            initialized: this.initialized,
            configuration: {
                graphName: this.graphName,
                sparqlEndpoint: this.sparqlEndpoint
            }
        };
    }

    /**
     * Clean up all resources
     */
    async cleanup() {
        if (this._cleanupInProgress || !this.initialized) {
            return;
        }
        this._cleanupInProgress = true;
        
        logger.info('🧹 Cleaning up AskRagno system resources...');
        
        try {
            // Clean up search system
            if (this.searchSystem) {
                await this.searchSystem.cleanup();
                this.searchSystem = null;
            }

            // Clean up question processing
            if (this.textToCorpuscle) {
                await this.textToCorpuscle.cleanup();
                this.textToCorpuscle = null;
            }

            // Clean up LLM handler
            if (this.llmHandler && typeof this.llmHandler.cleanup === 'function') {
                await this.llmHandler.cleanup();
                this.llmHandler = null;
            }

            // Clean up SPARQL services
            if (this.sparqlHelper && typeof this.sparqlHelper.cleanup === 'function') {
                await this.sparqlHelper.cleanup();
                this.sparqlHelper = null;
            }

            if (this.queryService && typeof this.queryService.cleanup === 'function') {
                this.queryService.cleanup();
                this.queryService = null;
            }
            
            this.initialized = false;
            
            logger.info('✅ AskRagno system cleanup completed');
            
        } catch (error) {
            logger.warn('⚠️  Error during cleanup:', error.message);
        } finally {
            this._cleanupInProgress = false;
        }
    }
}

/**
 * Parse command line arguments
 */
function parseCommandArgs() {
    const args = process.argv.slice(2);
    const options = {
        question: null,
        graphName: null,
        interactive: false,
        verbose: false,
        help: false,
        // Search options
        threshold: null,
        mode: null,
        limit: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--graph':
                options.graphName = args[++i];
                break;
            case '--threshold':
                options.threshold = parseFloat(args[++i]);
                break;
            case '--mode':
                options.mode = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i]);
                break;
            case '--interactive':
            case '-i':
                options.interactive = true;
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                if (!arg.startsWith('--') && !options.question) {
                    options.question = arg;
                } else if (!arg.startsWith('--')) {
                    console.log(`Unknown argument: ${arg}`);
                    process.exit(1);
                } else {
                    console.log(`Unknown option: ${arg}`);
                    process.exit(1);
                }
        }
    }

    return options;
}

/**
 * Show usage information
 */
function showUsage() {
    console.log('Usage: node examples/document/AskRagno.js [question] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  question         Question to ask (required unless --interactive)');
    console.log('');
    console.log('Options:');
    console.log('  --graph <uri>    Named graph URI to use (default: from config)');
    console.log('  --threshold <n>  Search relevance threshold 0.0-1.0 (default: from config)');
    console.log('  --mode <mode>    Search mode: dual, exact, similarity, traversal (default: from config)');
    console.log('  --limit <n>      Maximum search results (default: 5)');
    console.log('  --interactive    Interactive mode for multiple questions');
    console.log('  --verbose        Enable verbose logging');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node examples/document/AskRagno.js "What is machine learning?"');
    console.log('  node examples/document/AskRagno.js "What is musique?" --threshold 0.3');
    console.log('  node examples/document/AskRagno.js "How does neural network training work?" --graph "http://example.org/my-docs"');
    console.log('  node examples/document/AskRagno.js --interactive');
    console.log('  node examples/document/AskRagno.js --interactive --verbose');
    console.log('');
    console.log('Features:');
    console.log('  - Stores questions as corpuscles for future reference');
    console.log('  - Searches knowledge graph for relevant context');
    console.log('  - Generates contextually augmented answers');
    console.log('  - Supports multiple LLM providers with fallback');
    console.log('  - Interactive mode for continuous Q&A sessions');
    console.log('');
    console.log('Prerequisites:');
    console.log('  1. Document processing pipeline completed (LoadPDFs, ChunkDocuments, etc.)');
    console.log('  2. SPARQL endpoint running and accessible');
    console.log('  3. LLM providers configured in config.json');
    console.log('  4. API keys set in .env file');
    console.log('');
}

/**
 * Interactive mode for multiple questions
 */
async function interactiveMode(askRagnoSystem) {
    console.log('🤖 AskRagno Interactive Mode');
    console.log('Ask your questions and get contextually augmented answers!');
    console.log('Type "quit" to exit, "stats" for statistics, "help" for commands.');
    console.log('='.repeat(60));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Handle Ctrl+C and other close events
    rl.on('close', async () => {
        console.log('\n👋 Goodbye!');
        await askRagnoSystem.cleanup();
        process.exit(0);
    });

    rl.on('SIGINT', async () => {
        console.log('\n🛑 Interrupted, cleaning up...');
        rl.close();
    });

    const askQuestion = () => {
        rl.question('\n❓ Your question: ', async (input) => {
            const question = input.trim();
            
            if (question.toLowerCase() === 'quit' || question.toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            if (question.toLowerCase() === 'stats') {
                console.log('\n📊 System Statistics:');
                console.log(JSON.stringify(askRagnoSystem.getStatistics(), null, 2));
                askQuestion();
                return;
            }

            if (question.toLowerCase() === 'help') {
                console.log('\n🔧 Available Commands:');
                console.log('  quit/exit - Exit the interactive mode');
                console.log('  stats     - Show system statistics');
                console.log('  help      - Show this help message');
                console.log('  [question] - Ask any question');
                askQuestion();
                return;
            }

            if (question === '') {
                console.log('⚠️  Please enter a question.');
                askQuestion();
                return;
            }

            try {
                const result = await askRagnoSystem.processQuestion(question);
                console.log('\n🤖 Answer:');
                console.log('='.repeat(60));
                console.log(result.answer);
                console.log('='.repeat(60));
                console.log(`📊 Response time: ${result.responseTime}ms | Context sources: ${result.searchResults.results.length}`);
            } catch (error) {
                console.error('❌ Error:', error.message);
                logger.debug('Error details:', error.stack);
            }

            askQuestion();
        });
    };

    askQuestion();
}

// Main function
async function main() {
    const options = parseCommandArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    if (!options.interactive && !options.question) {
        console.error('❌ Error: Please provide a question or use --interactive mode');
        showUsage();
        process.exit(1);
    }

    // Set logging level
    if (options.verbose) {
        logger.setLevel('debug');
    }

    logger.info('🚀 Starting AskRagno Question Answering System');
    logger.info('='.repeat(60));

    let askRagnoSystem = null;

    try {
        // Create AskRagno system with search options
        askRagnoSystem = new AskRagnoSystem(null, options);

        // Set up signal handlers for graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
            if (askRagnoSystem) {
                await askRagnoSystem.cleanup();
            }
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        // Initialize the system
        await askRagnoSystem.init();

        if (options.interactive) {
            // Interactive mode
            await interactiveMode(askRagnoSystem);
        } else {
            // Single question mode
            const result = await askRagnoSystem.processQuestion(options.question, {
                graphName: options.graphName
            });

            console.log('\n🤖 ANSWER:');
            console.log('='.repeat(60));
            console.log(result.answer);
            console.log('='.repeat(60));
            console.log(`📊 Response time: ${result.responseTime}ms | Context sources: ${result.searchResults.results.length}`);
            console.log(`🔗 Question stored: ${result.corpuscleURI}`);
        }

    } catch (error) {
        logger.error('❌ Fatal error:', error.message);
        if (options.verbose) {
            logger.error(error.stack);
        }
        process.exit(1);
    } finally {
        if (askRagnoSystem) {
            await askRagnoSystem.cleanup();
        }
        
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default AskRagnoSystem;