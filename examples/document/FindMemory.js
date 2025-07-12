#!/usr/bin/env node

/**
 * FindMemory.js - Document Location Discovery Tool
 * 
 * This script helps locate stored documents in the semem memory system by
 * searching for text elements that match user queries (questions, keywords,
 * or document references) and returning their source document locations.
 * 
 * Processing flow:
 * 1. Receives a text query (question, keywords, or document reference)
 * 2. Uses semantic and exact search to find relevant text elements
 * 3. Traces text elements back to their source documents
 * 4. Returns top 3 results with relevance scores and source information
 * 
 * Features:
 * - Multi-mode search (semantic + exact matching)
 * - Source document traceability via provenance chains
 * - Relevance ranking and filtering
 * - Interactive and single-query modes
 * - Comprehensive progress reporting
 * 
 * Usage: node examples/document/FindMemory.js [query]
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
import DocumentSearchSystem from './Search.js';
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
 * Main FindMemory class for document location discovery
 */
class FindMemory {
    constructor() {
        this.config = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.documentSearchSystem = null;
        this.initialized = false;
        this._cleanupInProgress = false;
        
        // Statistics
        this.stats = {
            totalSearches: 0,
            successfulSearches: 0,
            averageSearchTime: 0,
            lastSearchResults: 0
        };
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
            const llmProviders = config.get('llmProviders') || [];
            const embeddingProviders = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            for (const provider of embeddingProviders) {
                if (provider.type === 'nomic' && provider.apiKey && process.env.NOMIC_API_KEY) {
                    logger.info(`🧠 Using Nomic embedding with model: ${provider.embeddingModel}`);
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'nomic',
                        apiKey: process.env.NOMIC_API_KEY,
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
            
            const embeddingProviders = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            const embeddingProvider = embeddingProviders[0];
            
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
        logger.info('🚀 Initializing FindMemory system...');

        // Initialize configuration using modern pattern
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();

        // Get storage configuration
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('FindMemory requires SPARQL storage configuration');
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
        let embeddingDimension;
        if (modelConfig.embeddingModel.includes('nomic')) {
            embeddingDimension = 768;
        } else {
            embeddingDimension = 1536;
        }
        
        this.embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            embeddingDimension
        );

        this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

        // Initialize document search system
        this.documentSearchSystem = new DocumentSearchSystem(this.config, {
            mode: 'dual',  // Use both semantic and exact search
            limit: 10,     // Search more broadly, then filter
            threshold: 0.5, // Lower threshold for broader search
            format: 'detailed'
        });
        await this.documentSearchSystem.initialize();

        this.initialized = true;
        logger.info('✅ FindMemory system initialized successfully');
    }

    async cleanup() {
        if (this._cleanupInProgress) return;
        this._cleanupInProgress = true;
        
        logger.info('🧹 Cleaning up FindMemory system...');

        if (this.documentSearchSystem) {
            await this.documentSearchSystem.cleanup();
        }

        if (this.embeddingHandler && typeof this.embeddingHandler.cleanup === 'function') {
            await this.embeddingHandler.cleanup();
        }

        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }

        logger.info('✅ Cleanup completed');
    }

    /**
     * Process a query to find document locations
     */
    async processQuery(query) {
        if (!this.initialized) {
            await this.init();
        }

        logger.info(`🔍 Finding document locations for: ${chalk.cyan(query)}`);
        const startTime = Date.now();

        try {
            // Step 1: Use DocumentSearchSystem to find relevant text elements
            logger.info('🔍 Searching for relevant text elements...');
            const searchResponse = await this.documentSearchSystem.processQuery(query);
            const searchResults = searchResponse.results || [];

            logger.info(`✅ Found ${searchResults.length} potential results`);

            // Step 2: Filter and enhance results with document source information
            logger.info('📚 Tracing text elements to source documents...');
            const documentLocations = await this.traceToSourceDocuments(searchResults);

            // Step 3: Rank by relevance and return top 3
            const topResults = this.rankAndFilterResults(documentLocations, 3);

            const processingTime = Date.now() - startTime;
            
            // Update statistics
            this.stats.totalSearches++;
            if (topResults.length > 0) {
                this.stats.successfulSearches++;
            }
            this.stats.lastSearchResults = topResults.length;
            this.stats.averageSearchTime = Math.round(
                (this.stats.averageSearchTime * (this.stats.totalSearches - 1) + processingTime) / 
                this.stats.totalSearches
            );

            logger.info(`✅ Document location search completed in ${processingTime}ms`);

            return {
                query: query,
                results: topResults,
                totalFound: searchResults.length,
                processingTime: processingTime,
                searchStats: { ...this.stats }
            };

        } catch (error) {
            logger.error(`❌ Failed to process query: ${error.message}`);
            throw error;
        }
    }

    /**
     * Trace search results back to their source documents
     */
    async traceToSourceDocuments(searchResults) {
        const documented = [];

        for (const result of searchResults) {
            try {
                // Get source document information via SPARQL
                const sourceInfo = await this.getSourceDocumentInfo(result.uri);
                
                if (sourceInfo) {
                    documented.push({
                        ...result,
                        sourceDocument: sourceInfo
                    });
                }
            } catch (error) {
                logger.warn(`Failed to trace source for ${result.uri}: ${error.message}`);
                // Include result even without source info
                documented.push({
                    ...result,
                    sourceDocument: null
                });
            }
        }

        return documented;
    }

    /**
     * Get source document information for a text element URI
     */
    async getSourceDocumentInfo(textElementURI) {
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX semem: <http://semem.hyperdata.it/>

            SELECT DISTINCT ?sourceUnit ?sourceFile ?title ?created ?unitType
            WHERE {
                GRAPH <${this.config.get('storage.options.graphName')}> {
                    # Direct derivation from source unit
                    <${textElementURI}> prov:wasDerivedFrom ?sourceUnit .
                    
                    # Get source unit information
                    ?sourceUnit a ?unitType .
                    OPTIONAL { ?sourceUnit rdfs:label ?title }
                    OPTIONAL { ?sourceUnit dcterms:created ?created }
                    OPTIONAL { ?sourceUnit semem:sourceFile ?sourceFile }
                    
                    # Filter for document units (not chunk units)
                    FILTER(?unitType = ragno:Unit)
                }
            }
            ORDER BY ?sourceUnit
            LIMIT 1
        `;

        try {
            const result = await this.sparqlHelper.executeSelect(query);
            
            if (result.success && result.data.results.bindings.length > 0) {
                const binding = result.data.results.bindings[0];
                
                return {
                    uri: binding.sourceUnit?.value,
                    title: binding.title?.value || 'Untitled Document',
                    sourceFile: binding.sourceFile?.value || 'Unknown Source',
                    created: binding.created?.value,
                    type: binding.unitType?.value
                };
            }
            
            return null;
        } catch (error) {
            logger.warn(`SPARQL query failed for source tracing: ${error.message}`);
            return null;
        }
    }

    /**
     * Rank and filter results, returning top N
     */
    rankAndFilterResults(results, maxResults = 3) {
        // Sort by relevance score (higher is better)
        const sortedResults = results.sort((a, b) => {
            const scoreA = a.score || a.relevance || 0;
            const scoreB = b.score || b.relevance || 0;
            return scoreB - scoreA;
        });

        // Separate results with and without source document info
        const withSourceInfo = sortedResults.filter(result => result.sourceDocument !== null);
        const withoutSourceInfo = sortedResults.filter(result => result.sourceDocument === null);

        logger.info(`📊 Result breakdown: ${withSourceInfo.length} with source info, ${withoutSourceInfo.length} without source info`);

        // Prefer results with source info, but include others if needed
        const finalResults = withSourceInfo.length > 0 ? withSourceInfo : withoutSourceInfo;
        
        return finalResults.slice(0, maxResults);
    }

    /**
     * Format and display results
     */
    formatResults(results) {
        if (!results.results || results.results.length === 0) {
            console.log(chalk.yellow('\n📭 No document locations found for your query.'));
            console.log(chalk.gray('Try using different keywords or a more general query.'));
            return;
        }

        console.log(chalk.bold.blue('\n🔍 Document Location Results:'));
        console.log(chalk.blue('='.repeat(50)));

        results.results.forEach((result, index) => {
            const score = result.score || result.relevance || 0;
            const scoreColor = score > 0.8 ? chalk.green : score > 0.6 ? chalk.yellow : chalk.red;
            
            console.log(chalk.bold(`\n${index + 1}. Text Element ${scoreColor(`(Relevance: ${score.toFixed(2)})`)}`));
            console.log(chalk.gray(`   📍 URI: ${result.uri}`));
            
            // Show content preview (truncated)
            const content = result.content || result.text || 'No content available';
            const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
            console.log(chalk.white(`   📄 Content: "${preview}"`));
            
            // Show source document info
            if (result.sourceDocument) {
                console.log(chalk.cyan(`   📚 Source: "${result.sourceDocument.title}"`));
                if (result.sourceDocument.sourceFile) {
                    console.log(chalk.gray(`   📁 File: ${result.sourceDocument.sourceFile}`));
                }
                console.log(chalk.gray(`   🔗 Unit: ${result.sourceDocument.uri}`));
                if (result.sourceDocument.created) {
                    const date = new Date(result.sourceDocument.created).toLocaleDateString();
                    console.log(chalk.gray(`   📅 Created: ${date}`));
                }
            } else {
                console.log(chalk.yellow(`   📚 Source: Document provenance not available`));
                console.log(chalk.gray(`   ℹ️  This result was found in the knowledge graph but source document tracing failed`));
            }
        });

        // Show statistics
        console.log(chalk.bold.blue('\n📊 Search Statistics:'));
        console.log(chalk.gray(`   🔍 Total searches: ${results.searchStats.totalSearches}`));
        console.log(chalk.gray(`   ✅ Successful searches: ${results.searchStats.successfulSearches}`));
        console.log(chalk.gray(`   ⏱️  Average search time: ${results.searchStats.averageSearchTime}ms`));
        console.log(chalk.gray(`   📋 Last search: ${results.results.length} results from ${results.totalFound} candidates`));
    }

    /**
     * Interactive mode for multiple queries
     */
    async interactiveMode() {
        console.log(chalk.bold.blue('\n🔍 FindMemory Interactive Mode'));
        console.log(chalk.gray('Find stored document locations using questions, keywords, or references'));
        console.log(chalk.gray('Type "exit" to quit, "help" for commands, "stats" for statistics\n'));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const askQuery = () => {
            rl.question(chalk.cyan('Enter search query: '), async (query) => {
                if (query.toLowerCase() === 'exit') {
                    rl.close();
                    return;
                }

                if (query.toLowerCase() === 'help') {
                    console.log(chalk.yellow('\nCommands:'));
                    console.log('  exit - Exit interactive mode');
                    console.log('  help - Show this help message');
                    console.log('  stats - Show search statistics');
                    console.log('  Any other text - Search for document locations\n');
                    askQuery();
                    return;
                }

                if (query.toLowerCase() === 'stats') {
                    console.log(chalk.bold.blue('\n📊 FindMemory Statistics:'));
                    console.log(chalk.gray(`   Total searches performed: ${this.stats.totalSearches}`));
                    console.log(chalk.gray(`   Successful searches: ${this.stats.successfulSearches}`));
                    console.log(chalk.gray(`   Success rate: ${this.stats.totalSearches > 0 ? Math.round(this.stats.successfulSearches / this.stats.totalSearches * 100) : 0}%`));
                    console.log(chalk.gray(`   Average search time: ${this.stats.averageSearchTime}ms`));
                    console.log(chalk.gray(`   Last search results: ${this.stats.lastSearchResults}`));
                    console.log('');
                    askQuery();
                    return;
                }

                if (query.trim() === '') {
                    askQuery();
                    return;
                }

                try {
                    const results = await this.processQuery(query);
                    this.formatResults(results);

                } catch (error) {
                    console.log(chalk.red(`\n❌ Error: ${error.message}`));
                    if (logger.getLevel() <= logger.levels.DEBUG) {
                        console.log(chalk.gray(`Debug: ${error.stack}`));
                    }
                }

                console.log('');
                askQuery();
            });
        };

        askQuery();
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
            verbose: {
                type: 'boolean',
                short: 'v',
                default: false
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        },
        allowPositionals: true
    });

    if (args.verbose) {
        logger.setLevel('debug');
    }

    if (args.help) {
        console.log(`
FindMemory - Document Location Discovery Tool

Usage: node examples/document/FindMemory.js [options] [query]

Options:
  -i, --interactive    Start in interactive mode for multiple searches
  -v, --verbose        Enable verbose logging for debugging
  -h, --help          Show this help message

Arguments:
  query               Search query (question, keywords, or document reference)

Examples:
  node examples/document/FindMemory.js "machine learning algorithms"
  node examples/document/FindMemory.js "What is neural network training?"
  node examples/document/FindMemory.js "AI research paper" -v
  node examples/document/FindMemory.js -i
  
Features:
  - Semantic and exact text matching
  - Source document traceability
  - Relevance ranking and scoring
  - Interactive search mode
  - Comprehensive progress reporting
  
Output:
  Returns top 3 most relevant text elements with:
  - Text element URI and content preview
  - Relevance score and ranking
  - Source document title and file path
  - Original document unit URI
  - Creation date and metadata
        `);
        return;
    }

    const findMemory = new FindMemory();

    // Set up signal handlers for graceful shutdown
    const gracefulShutdown = async (signal) => {
        logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
        if (findMemory && !findMemory._cleanupInProgress) {
            await findMemory.cleanup();
        }
        process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    try {
        await findMemory.init();

        if (args.interactive) {
            await findMemory.interactiveMode();
        } else {
            const query = process.argv.slice(2)
                .filter(arg => !arg.startsWith('-'))
                .join(' ')
                .trim();

            if (!query) {
                console.log(chalk.red('❌ Please provide a search query or use --interactive mode'));
                console.log(chalk.gray('Use --help for usage information'));
                return;
            }

            const results = await findMemory.processQuery(query);
            findMemory.formatResults(results);
        }

    } catch (error) {
        logger.error(`❌ FindMemory failed: ${error.message}`);

        if (logger.getLevel() <= logger.levels.DEBUG) {
            logger.error('Stack:', error.stack);
        }

        // Ensure cleanup even on error
        if (findMemory && !findMemory._cleanupInProgress) {
            await findMemory.cleanup();
        }
        
        process.exit(1);
    } finally {
        // Always ensure cleanup
        if (findMemory && !findMemory._cleanupInProgress) {
            await findMemory.cleanup();
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

export default FindMemory;