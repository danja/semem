import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'loglevel';
import ArticleSearchService from './ArticleSearchService.js';

// Configure logging
logger.setLevel('info');

// Create Express app
const app = express();
const PORT = process.env.PORT || 4100;

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate paths for project root and public directory
const projectRoot = path.resolve(__dirname, '..', '..');
const publicDir = path.join(projectRoot, 'public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

// Initialize search service
const searchService = new ArticleSearchService();

// API endpoint for searching
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const limit = parseInt(req.query.limit) || 5;
        
        logger.info(`Search request for: "${query}" with limit: ${limit}`);
        
        if (!query.trim()) {
            return res.json({ results: [] });
        }
        
        // Perform search
        const results = await searchService.search(query, limit);
        
        logger.info(`Found ${results.length} results for query: "${query}"`);
        
        res.json({ results });
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({ 
            error: 'Search failed', 
            message: error.message 
        });
    }
});

// HTML route for the search form
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// Start the server
async function startServer() {
    try {
        // Initialize the search service
        logger.info('Initializing search service...');
        await searchService.initialize();
        
        // Start the Express server
        app.listen(PORT, () => {
            logger.info(`Search server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Export function to start server
export default startServer;

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer();
}