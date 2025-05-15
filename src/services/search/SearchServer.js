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
import OllamaConnector from '../../connectors/OllamaConnector.js';

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
        this.graphName = options.graphName || 'http://danny.ayers.name/content';
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
            
            logger.info(`Search request for: "${query}" with limit: ${limit}`);
            
            if (!query.trim()) {
                return res.json({ results: [] });
            }
            
            // Perform search
            const results = await this.searchService.search(query, limit);
            
            logger.info(`Found ${results.length} results for query: "${query}"`);
            
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
     * Initialize chat features and register API
     */
    async initializeChatFeatures() {
        try {
            // Create Ollama connector for LLM access
            logger.info('Initializing Ollama connector...');
            this.ollamaConnector = new OllamaConnector({
                baseUrl: 'http://localhost:11434',
                chatModel: this.chatModel,
                embeddingModel: this.embeddingModel
            });
            
            // Create memory manager for semantic memory
            logger.info('Initializing memory manager...');
            this.memoryManager = new MemoryManager({
                llmProvider: this.ollamaConnector,
                chatModel: this.chatModel,
                embeddingModel: this.embeddingModel
            });
            
            // Create LLM handler for direct LLM requests
            logger.info('Initializing LLM handler...');
            this.llmHandler = new LLMHandler(
                this.ollamaConnector,
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