/**
 * Search.js - Document Search System
 * 
 * This script provides a unified search interface for finding nodes in the knowledge graph
 * related to questions, ranked and filtered according to relevance. It supports both string
 * queries and URI-based node queries using the existing src/ragno/search/ system.
 * 
 * Features:
 * - String query processing with entity extraction
 * - URI-based search starting from existing nodes
 * - Multiple search modes (dual, exact, similarity, traversal)
 * - Relevance filtering and ranking
 * - Result explanation and provenance
 * - Integration with existing RAG system
 * 
 * Prerequisites:
 * - SPARQL endpoint (Fuseki) with knowledge graph data
 * - config/config.json properly configured
 * - LLM and embedding providers configured
 * - Document corpus processed and indexed
 * 
 * Usage:
 * - node Search.js "What is machine learning?"
 * - node Search.js "http://example.org/question/ml-basics"
 * - node Search.js "beer brewing" --limit 5 --mode similarity --threshold 0.8
 * - node Search.js --interactive
 * - node Search.js --help
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import readline from 'readline';
import logger from 'loglevel';

import Config from '../../src/Config.js';
import RagnoSearch from '../../src/ragno/search/index.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SearchFilters from '../../src/ragno/search/SearchFilters.js';

// Configure logging
logger.setLevel('info');

// Debug: Check if API keys are loaded
logger.debug('🔍 Environment variables loaded:');
logger.debug(`   MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET'}`);
logger.debug(`   CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? 'SET' : 'NOT SET'}`);
logger.debug(`   NOMIC_API_KEY: ${process.env.NOMIC_API_KEY ? 'SET' : 'NOT SET'}`);

class DocumentSearchSystem {
    constructor(config, options = {}) {
        this.config = config;
        // Get search defaults from config
        const searchConfig = this.config.get('search') || {};
        
        this.options = {
            // Start with passed options
            ...options,
            
            // Override with computed values from config
            mode: options.mode || searchConfig.defaultMode || 'dual',              // dual, exact, similarity, traversal
            limit: options.limit != null ? options.limit : (searchConfig.defaultLimit || 10),                // Number of results to return
            threshold: options.threshold != null ? options.threshold : (searchConfig.defaultThreshold || 0.7),       // Relevance threshold
            includeContext: options.includeContext !== false && (searchConfig.enableContextEnrichment !== false), // Include relationship context
            includeProvenance: options.includeProvenance !== false && (searchConfig.enableProvenance !== false), // Include search method info
            
            // Output formatting options (can be overridden by options)
            format: options.format || 'detailed',      // detailed, summary, uris
            sortBy: options.sortBy || 'relevance',     // relevance, type, score
            
            // Graph and configuration options
            graphName: options.graphName || null,
            verbose: options.verbose || false
        };

        // Core components
        this.ragnoSearch = null;
        this.searchFilters = null;
        this.embeddingConnector = null;
        this.embeddingHandler = null;
        this.llmHandler = null;
        this.initialized = false;
        this._cleanupInProgress = false;

        // Configuration
        this.sparqlEndpoint = null;
        this.graphName = null;
        this.auth = null;

        // Statistics
        this.stats = {
            totalSearches: 0,
            successfulSearches: 0,
            averageSearchTime: 0,
            lastSearchTime: null
        };

        this.setupConfiguration();
    }

    setupConfiguration() {
        // Get SPARQL endpoint from storage configuration
        const storageConfig = this.config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('No SPARQL storage configuration found');
        }

        // Use the configured SPARQL query endpoint
        this.sparqlEndpoint = storageConfig.options.query;

        // Get graph name from config (unless overridden)
        if (!this.options.graphName) {
            this.graphName = storageConfig.options.graphName ||
                this.config.get('graphName') ||
                'http://tensegrity.it/semem';
        } else {
            this.graphName = this.options.graphName;
        }

        // Set up authentication
        this.auth = {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        };

        logger.info(`🔧 Document Search System configured:`);
        logger.info(`   📊 SPARQL endpoint: ${this.sparqlEndpoint}`);
        logger.info(`   🗃️  Graph: ${this.graphName}`);
        logger.info(`   🔍 Search mode: ${this.options.mode}`);
        logger.info(`   📏 Result limit: ${this.options.limit}`);
        logger.info(`   🎯 Relevance threshold: ${this.options.threshold}`);
    }

    /**
     * Create LLM connector based on configuration priority
     */
    async createLLMConnector(config) {
        try {
            const llmProviders = config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            for (const provider of sortedProviders) {
                try {
                    chatModel = provider.chatModel || config.get('chatModel') || 'qwen2:1.5b';
                    
                    if (provider.type === 'mistral' && provider.apiKey) {
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    } else if (provider.type === 'claude' && provider.apiKey) {
                        llmProvider = new ClaudeConnector(process.env.CLAUDE_API_KEY);
                        logger.info(`🤖 Using Claude LLM with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    } else if (provider.type === 'ollama') {
                        const ollamaBaseUrl = provider.baseUrl || config.get('ollama.baseUrl') || 'http://localhost:11434';
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
            const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
            chatModel = config.get('chatModel') || 'qwen2:1.5b';
            llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            logger.info(`🤖 Fallback to Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
            return { provider: llmProvider, model: chatModel };

        } catch (error) {
            logger.warn('Failed to load LLM provider configuration, defaulting to Ollama:', error.message);
            const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
            const chatModel = config.get('chatModel') || 'qwen2:1.5b';
            return { provider: new OllamaConnector(ollamaBaseUrl, chatModel), model: chatModel };
        }
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
     */
    async createEmbeddingConnector(config) {
        try {
            const embeddingProvider = config.get('embeddingProvider') || 'ollama';
            const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';

            logger.info(`🧠 Using embedding provider: ${embeddingProvider}`);
            logger.info(`🧠 Embedding model: ${embeddingModel}`);

            let providerConfig = {};
            if (embeddingProvider === 'nomic' && process.env.NOMIC_API_KEY) {
                providerConfig = {
                    provider: 'nomic',
                    apiKey: process.env.NOMIC_API_KEY,
                    model: embeddingModel
                };
            } else if (embeddingProvider === 'ollama') {
                const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
                providerConfig = {
                    provider: 'ollama',
                    baseUrl: ollamaBaseUrl,
                    model: embeddingModel
                };
                logger.info(`🧠 Using Ollama at: ${ollamaBaseUrl}`);
            } else {
                // Default to ollama
                const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
                providerConfig = {
                    provider: 'ollama',
                    baseUrl: ollamaBaseUrl,
                    model: embeddingModel
                };
                logger.info(`🧠 Defaulting to Ollama at: ${ollamaBaseUrl}`);
            }

            const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);

            // Determine embedding dimension based on provider/model
            let embeddingDimension;
            if (embeddingProvider === 'nomic' || embeddingModel.includes('nomic')) {
                embeddingDimension = 768;
            } else if (embeddingModel.includes('text-embedding')) {
                embeddingDimension = 1536;
            } else {
                embeddingDimension = 1536;
            }

            return { connector: embeddingConnector, model: embeddingModel, dimension: embeddingDimension };

        } catch (error) {
            logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            return {
                connector: EmbeddingConnectorFactory.createConnector({
                    provider: 'ollama',
                    baseUrl: 'http://localhost:11434',
                    model: 'nomic-embed-text'
                }),
                model: 'nomic-embed-text',
                dimension: 1536
            };
        }
    }

    /**
     * Initialize the search system
     */
    async initialize() {
        if (this.initialized) {
            logger.debug('🔄 Search System already initialized, skipping...');
            return;
        }

        logger.info('🚀 Initializing Document Search System...');
        logger.info('='.repeat(60));

        try {
            // Initialize providers
            const llmResult = await this.createLLMConnector(this.config);
            const embeddingResult = await this.createEmbeddingConnector(this.config);

            // Initialize handlers
            this.embeddingConnector = embeddingResult.connector;
            this.embeddingHandler = new Embeddings(
                this.embeddingConnector, 
                embeddingResult.model, 
                embeddingResult.dimension
            );
            this.llmHandler = new LLMHandler(llmResult.provider, llmResult.model);

            // Initialize RagnoSearch system
            logger.info('🔧 Initializing RagnoSearch system...');
            this.ragnoSearch = new RagnoSearch({
                vectorIndex: {
                    dimension: embeddingResult.dimension,
                    maxElements: 100000,
                    efConstruction: 200,
                    mMax: 16,
                    efSearch: 100
                },
                dualSearch: {
                    exactMatchTypes: ['ragno:Entity', 'ragno:Attribute'],
                    vectorSimilarityTypes: [
                        'http://purl.org/stuff/ragno/Unit', 
                        'http://purl.org/stuff/ragno/Attribute', 
                        'http://purl.org/stuff/ragno/CommunityElement',
                        'http://purl.org/stuff/ragno/TextElement'
                    ],
                    vectorSimilarityK: this.options.limit * 2, // Get more candidates for filtering
                    similarityThreshold: this.options.threshold,
                    pprAlpha: 0.15,
                    pprIterations: 2,
                    topKPerType: Math.max(5, Math.ceil(this.options.limit / 2))
                },
                sparqlEndpoint: this.sparqlEndpoint,
                sparqlAuth: this.auth,
                graphName: this.graphName, // Add graph name for SPARQL queries
                llmHandler: this.llmHandler,
                embeddingHandler: this.embeddingHandler
            });

            await this.ragnoSearch.initialize();

            // Initialize search filters
            logger.info('🔧 Initializing search filters...');
            this.searchFilters = new SearchFilters({
                relevanceThreshold: this.options.threshold,
                documentTypes: ['http://purl.org/stuff/ragno/Entity', 'http://purl.org/stuff/ragno/Unit', 'http://purl.org/stuff/ragno/TextElement', 'http://purl.org/stuff/ragno/CommunityElement'],
                enableDeduplication: true,
                enableContextEnrichment: this.options.includeContext,
                maxResults: this.options.limit
            });

            this.initialized = true;
            logger.info('🎉 DOCUMENT SEARCH SYSTEM INITIALIZED!');
            logger.info('='.repeat(60));

        } catch (error) {
            logger.error('❌ Failed to initialize Document Search System:', error.message);
            throw error;
        }
    }

    /**
     * Detect if input is a URI or a string query
     */
    detectQueryType(input) {
        // Simple URI detection - check if it starts with http:// or https://
        const uriPattern = /^https?:\/\/.+/;
        return uriPattern.test(input.trim()) ? 'uri' : 'string';
    }

    /**
     * Process string query using RagnoSearch
     */
    async processStringQuery(query) {
        logger.info(`🔍 Processing string query: "${query}"`);
        
        const searchOptions = {
            mode: this.options.mode,
            limit: this.options.limit * 2, // Get more results for filtering
            threshold: this.options.threshold,
            includeContext: this.options.includeContext,
            includeProvenance: this.options.includeProvenance
        };

        let searchResults;
        
        switch (this.options.mode) {
            case 'exact':
                searchResults = await this.ragnoSearch.searchExact(query, searchOptions);
                break;
            case 'similarity':
                searchResults = await this.ragnoSearch.searchSimilarity(query, searchOptions);
                break;
            case 'traversal':
                // For traversal, we need to extract entities first
                const entities = await this.extractEntitiesFromQuery(query);
                searchResults = await this.ragnoSearch.searchTraversal(entities, searchOptions);
                break;
            case 'dual':
            default:
                searchResults = await this.ragnoSearch.search(query, searchOptions);
                break;
        }

        return searchResults;
    }

    /**
     * Process URI query using RagnoSearch traversal
     */
    async processURIQuery(uri) {
        logger.info(`🔍 Processing URI query: "${uri}"`);
        
        const searchOptions = {
            limit: this.options.limit * 2,
            threshold: this.options.threshold,
            includeContext: this.options.includeContext,
            includeProvenance: this.options.includeProvenance
        };

        // Use traversal search starting from the given URI
        const searchResults = await this.ragnoSearch.searchTraversal([uri], searchOptions);
        return searchResults;
    }

    /**
     * Extract entities from query using LLM
     */
    async extractEntitiesFromQuery(query) {
        try {
            logger.debug(`🤖 Extracting entities from query: "${query}"`);
            
            const prompt = `Extract the main entities, concepts, and topics from this query. Return them as a simple comma-separated list.
            
Query: ${query}

Entities:`;

            const response = await this.llmHandler.generateResponse(prompt, "", { temperature: 0.3, max_tokens: 200 });
            
            // Simple entity extraction - split by comma and clean up
            const entities = response.split(',')
                .map(entity => entity.trim())
                .filter(entity => entity.length > 0)
                .slice(0, 5); // Limit to top 5 entities

            logger.debug(`🎯 Extracted entities: ${entities.join(', ')}`);
            return entities;

        } catch (error) {
            logger.warn(`⚠️  Failed to extract entities from query: ${error.message}`);
            return [query]; // Fallback to using the query itself
        }
    }

    /**
     * Filter and rank search results
     */
    async filterAndRankResults(results, originalQuery) {
        // Handle undefined/null results
        const safeResults = Array.isArray(results) ? results : [];
        logger.debug(`🔧 Filtering and ranking ${safeResults.length} results...`);
        
        try {
            // Apply search filters
            const filteredResults = await this.searchFilters.applyFilters(safeResults, {
                query: originalQuery,
                threshold: this.options.threshold,
                limit: this.options.limit,
                sortBy: this.options.sortBy
            });

            logger.debug(`✅ Filtered to ${filteredResults.length} results`);
            return filteredResults;

        } catch (error) {
            logger.warn(`⚠️  Failed to filter results: ${error.message}`);
            // Return original results if filtering fails
            return results.slice(0, this.options.limit);
        }
    }

    /**
     * Format search results for output
     */
    formatResults(results, query, metadata = {}) {
        const output = {
            query: query,
            results: results,
            metadata: {
                totalResults: results.length,
                searchTime: metadata.searchTime || 0,
                searchMode: this.options.mode,
                relevanceThreshold: this.options.threshold,
                ...metadata
            }
        };

        // Apply output formatting based on format option
        switch (this.options.format) {
            case 'summary':
                output.results = results.map(result => ({
                    uri: result.uri,
                    type: result.type,
                    score: result.score,
                    summary: result.content ? result.content.substring(0, 100) + '...' : 'No content'
                }));
                break;
            case 'uris':
                output.results = results.map(result => result.uri);
                break;
            case 'detailed':
            default:
                // Keep full results
                break;
        }

        return output;
    }

    /**
     * Main search processing function
     */
    async processQuery(query) {
        if (!this.initialized) {
            logger.info('🔄 Search system not initialized, initializing now...');
            await this.initialize();
        }

        const startTime = Date.now();
        this.stats.totalSearches++;

        logger.info('🔍 PROCESSING SEARCH QUERY');
        logger.info('='.repeat(60));
        logger.info(`❓ Query: "${query}"`);
        logger.info(`🔧 Mode: ${this.options.mode}`);
        logger.info(`📏 Limit: ${this.options.limit}`);
        logger.info(`🎯 Threshold: ${this.options.threshold}`);

        try {
            // Detect query type
            const queryType = this.detectQueryType(query);
            logger.info(`📋 Query type: ${queryType}`);

            // Process query based on type
            let searchResults;
            if (queryType === 'uri') {
                searchResults = await this.processURIQuery(query);
            } else {
                searchResults = await this.processStringQuery(query);
            }

            // Handle DualSearch return format - extract results array from object
            let safeSearchResults = [];
            if (searchResults && typeof searchResults === 'object' && searchResults.results) {
                // DualSearch returns {results: [...], totalResults: N, ...}
                safeSearchResults = Array.isArray(searchResults.results) ? searchResults.results : [];
            } else if (Array.isArray(searchResults)) {
                // Direct array format
                safeSearchResults = searchResults;
            }
            
            // Filter and rank results
            const filteredResults = await this.filterAndRankResults(safeSearchResults, query);

            // Calculate search time
            const searchTime = Date.now() - startTime;
            this.stats.lastSearchTime = searchTime;
            this.stats.averageSearchTime = (this.stats.averageSearchTime * (this.stats.totalSearches - 1) + searchTime) / this.stats.totalSearches;

            if (filteredResults.length > 0) {
                this.stats.successfulSearches++;
            }

            // Format results
            const formattedResults = this.formatResults(filteredResults, query, { searchTime });

            logger.info('🎉 SEARCH PROCESSING COMPLETED!');
            logger.info(`⏱️  Search time: ${searchTime}ms`);
            logger.info(`📊 Results found: ${filteredResults.length}`);
            logger.info('='.repeat(60));

            return formattedResults;

        } catch (error) {
            logger.error('❌ Error processing search query:', error.message);
            throw error;
        }
    }

    /**
     * Get search statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            initialized: this.initialized,
            configuration: {
                mode: this.options.mode,
                limit: this.options.limit,
                threshold: this.options.threshold,
                format: this.options.format,
                graphName: this.graphName
            }
        };
    }

    /**
     * Clean up all connections and resources
     */
    async cleanup() {
        if (this._cleanupInProgress || !this.initialized) {
            return;
        }
        this._cleanupInProgress = true;
        
        logger.info('🧹 Cleaning up search system resources...');
        
        try {
            // Clean up RagnoSearch system
            if (this.ragnoSearch) {
                await this.ragnoSearch.shutdown();
                this.ragnoSearch = null;
            }

            // Clean up search filters
            if (this.searchFilters && typeof this.searchFilters.cleanup === 'function') {
                await this.searchFilters.cleanup();
                this.searchFilters = null;
            }
            
            // Clean up connectors
            if (this.embeddingHandler && typeof this.embeddingHandler.cleanup === 'function') {
                await this.embeddingHandler.cleanup();
            }
            
            if (this.embeddingConnector && typeof this.embeddingConnector.cleanup === 'function') {
                await this.embeddingConnector.cleanup();
            }
            
            if (this.llmHandler && typeof this.llmHandler.cleanup === 'function') {
                await this.llmHandler.cleanup();
            }
            
            this.initialized = false;
            
            logger.info('✅ Search system cleanup completed');
            
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
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        query: null,
        mode: null,      // Will use config default
        limit: null,     // Will use config default
        threshold: null, // Will use config default
        format: 'detailed',
        sortBy: 'relevance',
        graphName: null,
        interactive: false,
        verbose: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--mode':
                options.mode = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i]);
                break;
            case '--threshold':
                options.threshold = parseFloat(args[++i]);
                break;
            case '--format':
                options.format = args[++i];
                break;
            case '--sort':
                options.sortBy = args[++i];
                break;
            case '--graph':
                options.graphName = args[++i];
                break;
            case '--interactive':
                options.interactive = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                if (!arg.startsWith('--') && !options.query) {
                    options.query = arg;
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
    console.log('Usage: node Search.js [query] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  query                Question or URI to search for (required unless --interactive)');
    console.log('');
    console.log('Options:');
    console.log('  --mode <mode>        Search mode: dual, exact, similarity, traversal (default: dual)');
    console.log('  --limit <n>          Maximum number of results (default: 10)');
    console.log('  --threshold <n>      Relevance threshold 0.0-1.0 (default: from config, fallback 0.7)');
    console.log('  --format <format>    Output format: detailed, summary, uris (default: detailed)');
    console.log('  --sort <sort>        Sort results by: relevance, type, score (default: relevance)');
    console.log('  --graph <uri>        Named graph URI to search (default: from config)');
    console.log('  --interactive        Interactive mode for multiple queries');
    console.log('  --verbose            Enable verbose logging');
    console.log('  --help, -h           Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node Search.js "What is machine learning?"');
    console.log('  node Search.js "http://example.org/question/ml-basics"');
    console.log('  node Search.js "beer brewing" --limit 5 --mode similarity --threshold 0.8');
    console.log('  node Search.js "neural networks" --format summary --sort score');
    console.log('  node Search.js --interactive');
    console.log('');
    console.log('Search Modes:');
    console.log('  dual        Combined exact matching, vector similarity, and graph traversal');
    console.log('  exact       Exact text matching against entity names and attributes');
    console.log('  similarity  Vector similarity search using embeddings');
    console.log('  traversal   Graph traversal using Personalized PageRank');
    console.log('');
    console.log('Prerequisites:');
    console.log('  1. SPARQL endpoint running (Apache Fuseki)');
    console.log('  2. Knowledge graph data loaded');
    console.log('  3. Document corpus processed and indexed');
    console.log('  4. config/config.json configured with providers');
    console.log('  5. API keys set in .env file');
    console.log('');
}

/**
 * Interactive mode for multiple queries
 */
async function interactiveMode(searchSystem) {
    console.log('🔍 Document Search Interactive Mode');
    console.log('Type your queries (strings or URIs), or "quit" to exit.');
    console.log('Commands: "stats" for statistics, "config" for configuration');
    console.log('='.repeat(60));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Handle Ctrl+C and other close events
    rl.on('close', async () => {
        console.log('\n👋 Goodbye!');
        await searchSystem.cleanup();
        process.exit(0);
    });

    rl.on('SIGINT', async () => {
        console.log('\n🛑 Interrupted, cleaning up...');
        rl.close();
    });

    const askQuery = () => {
        rl.question('\n🔍 Search query: ', async (input) => {
            const query = input.trim();
            
            if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            if (query.toLowerCase() === 'stats') {
                console.log('\n📊 Search Statistics:');
                console.log(JSON.stringify(searchSystem.getStatistics(), null, 2));
                askQuery();
                return;
            }

            if (query.toLowerCase() === 'config') {
                console.log('\n⚙️  Configuration:');
                console.log(JSON.stringify(searchSystem.options, null, 2));
                askQuery();
                return;
            }

            if (query === '') {
                console.log('⚠️  Please enter a search query.');
                askQuery();
                return;
            }

            try {
                const results = await searchSystem.processQuery(query);
                console.log('\n🎯 Search Results:');
                console.log(JSON.stringify(results, null, 2));
            } catch (error) {
                console.error('❌ Error:', error.message);
                if (searchSystem.options.verbose) {
                    console.error(error.stack);
                }
            }

            askQuery();
        });
    };

    askQuery();
}

// Main function
async function main() {
    const options = parseArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    if (!options.interactive && !options.query) {
        console.error('❌ Error: Please provide a query or use --interactive mode');
        showUsage();
        process.exit(1);
    }

    // Set logging level
    if (options.verbose) {
        logger.setLevel('debug');
    }

    logger.info('🚀 Starting Document Search System');
    logger.info('='.repeat(60));

    let searchSystem = null;

    try {
        // Load configuration
        logger.info('⚙️  Loading configuration from config file...');
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        const config = new Config(configPath);
        await config.init();
        logger.info('✅ Configuration loaded successfully');

        // Create search system
        searchSystem = new DocumentSearchSystem(config, options);

        // Set up signal handlers for graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
            if (searchSystem) {
                await searchSystem.cleanup();
            }
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        // Initialize the system
        await searchSystem.initialize();

        if (options.interactive) {
            // Interactive mode
            await interactiveMode(searchSystem);
        } else {
            // Single query mode
            const results = await searchSystem.processQuery(options.query);

            console.log('\n🎯 SEARCH RESULTS:');
            console.log('='.repeat(60));
            console.log(JSON.stringify(results, null, 2));
            console.log('='.repeat(60));
        }

    } catch (error) {
        logger.error('❌ Fatal error:', error.message);
        if (options.verbose) {
            logger.error(error.stack);
        }
        process.exit(1);
    } finally {
        if (searchSystem) {
            await searchSystem.cleanup();
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

export default DocumentSearchSystem;