import logger from 'loglevel';
import faiss from 'faiss-node';
const { IndexFlatIP } = faiss;

import EmbeddingService from '../embeddings/EmbeddingService.js';
import SPARQLService from '../embeddings/SPARQLService.js';

/**
 * Service for semantic search using Faiss and embeddings
 */
class SearchService {
    /**
     * Creates a new SearchService
     * @param {Object} options - Configuration options
     * @param {EmbeddingService} options.embeddingService - The embedding service to use
     * @param {SPARQLService} options.sparqlService - The SPARQL service to use
     * @param {string} options.graphName - The graph name to search in
     * @param {number} options.dimension - The embedding dimension
     */
    constructor(options = {}) {
        this.embeddingService = options.embeddingService || new EmbeddingService();
        this.sparqlService = options.sparqlService || new SPARQLService();
        this.graphName = options.graphName || 'http://hyperdata.it/content';
        this.dimension = options.dimension || 1536;

        this.initialized = false;
        this.index = null;
        this.resources = [];
        this.resourceMap = new Map(); // Map from index to resource URI

        logger.info(`SearchService initialized with graph: ${this.graphName}`);
    }

    /**
     * Initialize the search service
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing SearchService...');

        try {
            // Create the Faiss index
            this.index = new IndexFlatIP(this.dimension);

            // Check if the graph exists
            const graphExists = await this.sparqlService.graphExists(this.graphName);

            if (!graphExists) {
                throw new Error(`Graph ${this.graphName} does not exist or is empty`);
            }

            // Load embeddings from SPARQL store
            await this.loadEmbeddings();

            this.initialized = true;
            logger.info(`SearchService initialized with ${this.resources.length} resources`);
        } catch (error) {
            logger.error('Failed to initialize SearchService:', error);
            throw error;
        }
    }

    /**
     * Load embeddings from the SPARQL store
     * @returns {Promise<void>}
     */
    async loadEmbeddings() {
        logger.info('Loading embeddings from SPARQL store...');

        try {
            // Fetch resources with their embeddings
            const resources = await this.sparqlService.fetchResourcesWithEmbeddings(
                null, // No specific resource class
                'http://schema.org/articleBody', // Content predicate
                'http://purl.org/stuff/ragno/hasEmbedding', // Embedding predicate (Ragno namespace)
                this.graphName
            );

            logger.info(`Found ${resources.length} resources with embeddings`);

            this.resources = [];
            this.resourceMap = new Map();

            let validEmbeddings = 0;

            // Process each resource and add to the index
            resources.forEach((resource) => {
                try {
                    const uri = resource.resource.value;
                    const content = resource.content.value;
                    const embeddingStr = resource.embedding.value;

                    // Parse the embedding vector
                    const embedding = JSON.parse(embeddingStr);

                    if (Array.isArray(embedding) && embedding.length === this.dimension) {
                        // Add embedding to the index
                        this.index.add(embedding);

                        // Store resource data
                        this.resources.push({
                            uri,
                            content: this.truncateContent(content),
                            title: this.extractTitle(uri, content)
                        });

                        // Map the index to the resource
                        this.resourceMap.set(validEmbeddings, uri);
                        validEmbeddings++;
                    } else {
                        logger.warn(`Skipping resource with invalid embedding: ${uri}`);
                    }
                } catch (error) {
                    logger.error(`Error processing resource embedding: ${error.message}`);
                }
            });

            logger.info(`Added ${validEmbeddings} valid embeddings to the index`);
        } catch (error) {
            logger.error('Error loading embeddings:', error);
            throw error;
        }
    }

    /**
     * Search for resources similar to the query text
     * @param {string} queryText - The search query text
     * @param {number} limit - Maximum number of results to return
     * @returns {Promise<Array>} The search results
     */
    async search(queryText, limit = 5) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!queryText || queryText.trim().length === 0) {
            return [];
        }

        try {
            // Check if we have any embeddings in the index
            if (this.index.ntotal() === 0) {
                logger.warn('No embeddings available in search index - returning empty results');
                return [];
            }

            // Generate embedding for the query
            const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);

            // Ensure we don't request more results than we have embeddings
            const actualLimit = Math.min(limit, this.index.ntotal());

            // Search the index
            const searchResults = this.index.search(queryEmbedding, actualLimit);

            // Faiss-node returns an object with labels and distances
            const results = [];

            // Process the faiss search results
            for (let i = 0; i < searchResults.labels.length; i++) {
                const id = searchResults.labels[i];
                const score = searchResults.distances[i];

                const uri = this.resourceMap.get(id);
                const resource = this.resources.find(r => r.uri === uri);

                if (uri) {
                    // Normalize the score to be between 0 and 1
                    // Inner product can be > 1, so we'll clamp it
                    const normalizedScore = Math.min(1, Math.max(0, score));

                    results.push({
                        uri,
                        title: resource?.title || this.getFilenameFromUri(uri),
                        content: resource?.content || '',
                        score: normalizedScore // Normalized similarity score
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error searching resources:', error);
            throw error;
        }
    }

    /**
     * Extract a title from the content or URI
     * @param {string} uri - The resource URI
     * @param {string} content - The resource content
     * @returns {string} The extracted title
     */
    extractTitle(uri, content) {
        // Try to extract title from content (first line if it looks like a title)
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.startsWith('# ')) {
            return firstLine.substring(2).trim();
        }

        // Otherwise get filename from URI
        return this.getFilenameFromUri(uri);
    }

    /**
     * Extract filename from URI
     * @param {string} uri - The resource URI
     * @returns {string} The extracted filename
     */
    getFilenameFromUri(uri) {
        const parts = uri.split('/');
        return parts[parts.length - 1];
    }

    /**
     * Truncate content for display
     * @param {string} content - The content to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} The truncated content
     */
    truncateContent(content, maxLength = 200) {
        if (!content || content.length <= maxLength) {
            return content;
        }

        return content.substring(0, maxLength) + '...';
    }
}

export default SearchService;