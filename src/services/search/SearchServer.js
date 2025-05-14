import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'loglevel';

import SearchService from './SearchService.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import SPARQLService from '../embeddings/SPARQLService.js';

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
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve, reject) => {
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
    }
}

export default SearchServer;