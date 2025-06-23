import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'loglevel';

import SearchService from './SearchService.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import SPARQLService from '../embeddings/SPARQLService.js';
import APIRegistry from '../../api/common/APIRegistry.js';
import ChatAPI from '../../api/features/ChatAPI.js';
import MemoryManager from '../../MemoryManager.js';
import LLMHandler from '../../handlers/LLMHandler.js';
import EmbeddingConnectorFactory from '../../connectors/EmbeddingConnectorFactory.js';
import Config from '../../Config.js';

/**
 * Search server application
 */
class SearchServer {
    /**
     * Creates a new SearchServer
     * @param {Object} options - Configuration options
     * @param {number} options.port - The port to listen on
     * @param {string} options.graphName - The graph name to search in
     */
    constructor(options = {}) {
        this.port = options.port || 4100;
        this.graphName = options.graphName || 'http://hyperdata.it/content';
        this.chatModel = options.chatModel || 'qwen2:1.5b';
        this.embeddingModel = options.embeddingModel || 'nomic-embed-text';

        // Initialize services
        this.embeddingService = new EmbeddingService();
        this.sparqlService = new SPARQLService({
            queryEndpoint: 'http://localhost:4030/semem/query',
            updateEndpoint: 'http://localhost:4030/semem/update',
            graphName: this.graphName,
            auth: {
                user: 'admin',
                password: 'admin123'
            }
        });

        this.searchService = new SearchService({
            embeddingService: this.embeddingService,
            sparqlService: this.sparqlService,
            graphName: this.graphName
        });

        // Initialize API registry
        this.apiRegistry = new APIRegistry();

        // Create Express app
        this.app = express();

        // Get directory name for ES modules
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Calculate paths for project root and public directory
        this.projectRoot = path.resolve(__dirname, '..', '..', '..');
        this.publicDir = path.join(this.projectRoot, 'public');

        logger.info(`SearchServer initialized with port: ${this.port}, graph: ${this.graphName}`);
    }

    /**
     * Configure the Express app
     */
    configureApp() {
        // Middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(this.publicDir));

        // API endpoint for searching
        this.app.get('/api/search', this.handleSearch.bind(this));

        // HTML route for the search form
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.publicDir, 'index.html'));
        });
    }

    /**
     * Handle search API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSearch(req, res) {
        try {
            const query = req.query.q || '';
            const limit = parseInt(req.query.limit) || 5;
            const graph = req.query.graph || this.graphName;

            logger.info(`Search request for: "${query}" with limit: ${limit}, graph: ${graph}`);

            if (!query.trim()) {
                return res.json({ results: [] });
            }

            // If the requested graph is different from the current one, create a new search service
            let searchService = this.searchService;
            if (graph !== this.graphName) {
                logger.info(`Using different graph: ${graph} (current: ${this.graphName})`);
                
                // Create a new SPARQLService with the requested graph
                const sparqlService = new SPARQLService({
                    queryEndpoint: 'http://localhost:4030/semem/query',
                    updateEndpoint: 'http://localhost:4030/semem/update',
                    graphName: graph,
                    auth: {
                        user: 'admin',
                        password: 'admin123'
                    }
                });

                // Create a new SearchService with the requested graph
                searchService = new SearchService({
                    embeddingService: this.embeddingService,
                    sparqlService: sparqlService,
                    graphName: graph
                });

                // Initialize the new search service
                await searchService.initialize();
            }

            // Perform search
            const results = await searchService.search(query, limit);

            logger.info(`Found ${results.length} results for query: "${query}" in graph: ${graph}`);

            res.json({ results });
        } catch (error) {
            logger.error('Search error:', error);
            res.status(500).json({
                error: 'Search failed',
                message: error.message
            });
        }
    }

    /**
     * Start the server
     * @returns {Promise<void>}
     */
    async start() {
        try {
            // Configure the app
            this.configureApp();

            // Initialize the search service
            logger.info('Initializing search service...');
            await this.searchService.initialize();

            // Initialize LLM and chat features
            logger.info('Initializing LLM and chat features...');
            await this.initializeChatFeatures();

            // Start the Express server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Search server running at http://localhost:${this.port}`);
            });
        } catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }

    /**
     * Create embedding connector using factory
     */
    async createEmbeddingConnector() {
        try {
            // Load system configuration
            const config = new Config();
            await config.init();
            
            // Get embedding provider configuration
            const embeddingProvider = config.get('embeddingProvider') || 'ollama';
            const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
            
            logger.info(`Creating embedding connector: ${embeddingProvider} (${embeddingModel})`);
            
            // Create embedding connector using factory
            let providerConfig = {};
            if (embeddingProvider === 'nomic') {
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
            }
            
            return EmbeddingConnectorFactory.createConnector(providerConfig);
            
        } catch (error) {
            logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            // Fallback to Ollama for embeddings
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
        }
    }

    /**
     * Initialize chat features and register API
     */
    async initializeChatFeatures() {
        try {
            // Create embedding connector using configuration
            logger.info('Initializing embedding connector...');
            const embeddingConnector = await this.createEmbeddingConnector();

            // Create memory manager for semantic memory
            logger.info('Initializing memory manager...');
            this.memoryManager = new MemoryManager({
                llmProvider: embeddingConnector, // Use embedding connector as LLM provider
                embeddingProvider: embeddingConnector,
                chatModel: this.chatModel,
                embeddingModel: this.embeddingModel
            });

            // Create LLM handler for direct LLM requests
            logger.info('Initializing LLM handler...');
            this.llmHandler = new LLMHandler(
                embeddingConnector,
                this.chatModel
            );

            // Register core services with API registry
            logger.info('Registering core services with API registry...');
            this.apiRegistry.register('memory', this.memoryManager);
            this.apiRegistry.register('llm', this.llmHandler);

            // Register the chat API
            logger.info('Registering Chat API...');
            await this.apiRegistry.register('chat', ChatAPI, {
                registry: this.apiRegistry,
                similarityThreshold: 0.7,
                contextWindow: 5
            });

            logger.info('Chat features initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize chat features:', error);
            throw error;
        }
    }

    /**
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        try {
            // Shutdown API services first
            if (this.apiRegistry) {
                logger.info('Shutting down API services...');
                await this.apiRegistry.shutdownAll();
            }

            // Clean up memory manager if needed
            if (this.memoryManager) {
                logger.info('Disposing memory manager...');
                await this.memoryManager.dispose();
            }

            // Stop the HTTP server
            if (this.server) {
                logger.info('Stopping HTTP server...');
                await new Promise((resolve, reject) => {
                    this.server.close((err) => {
                        if (err) {
                            logger.error('Error shutting down server:', err);
                            reject(err);
                        } else {
                            logger.info('Server shut down successfully');
                            resolve();
                        }
                    });
                });
            }
        } catch (error) {
            logger.error('Error during server shutdown:', error);
            throw error;
        }
    }
}

export default SearchServer;