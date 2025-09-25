import fetch from 'node-fetch';
import faiss from 'faiss-node';
const { IndexFlatIP } = faiss;
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import Config from '../Config.js';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

// SPARQL endpoint details
const SPARQL_QUERY_ENDPOINT = 'http://localhost:4030/semem/query';
const SPARQL_AUTH = {
    user: 'admin',
    password: 'admin123'
};
const GRAPH_NAME = 'http://danny.ayers.name/content';
const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_DIMENSION = 768; // nomic-embed-text dimension

class ArticleSearchService {
    constructor() {
        this.embeddingConnector = null;
        this.initialized = false;
        this.index = null;
        this.articles = [];
        this.articleMap = new Map(); // Map from index to article URI
    }

    /**
     * Initialize the search service by loading embeddings
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing ArticleSearchService...');

        try {
            // Initialize embedding connector using configuration
            await this.initializeEmbeddingConnector();

            // Create the Faiss index
            this.index = new IndexFlatIP(EMBEDDING_DIMENSION);

            // Load article embeddings from SPARQL store
            await this.loadEmbeddings();

            this.initialized = true;
            logger.info(`ArticleSearchService initialized with ${this.articles.length} articles`);
        } catch (error) {
            logger.error('Failed to initialize ArticleSearchService:', error);
            throw error;
        }
    }

    /**
     * Initialize embedding connector using factory
     */
    async initializeEmbeddingConnector() {
        try {
            // Load system configuration
            const config = new Config();
            await config.init();

            // Get embedding provider configuration
            const embeddingProvider = config.get('embeddingProvider') || 'ollama';
            const embeddingModel = config.get('embeddingModel');

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

            this.embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
            logger.info('Embedding connector initialized successfully');

        } catch (error) {
            logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            // Fallback to Ollama for embeddings
            this.embeddingConnector = EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
        }
    }

    /**
     * Load article embeddings from the SPARQL store
     */
    async loadEmbeddings() {
        logger.info('Loading article embeddings from SPARQL store...');

        const query = `
            SELECT ?article ?content ?embedding WHERE {
                GRAPH <${GRAPH_NAME}> {
                    ?article <http://schema.org/articleBody> ?content .
                    ?article <http://example.org/embedding/vector> ?embedding .
                }
            }
        `;

        try {
            const results = await this.executeSparqlQuery(query);
            const articles = results.results.bindings;

            logger.info(`Found ${articles.length} articles with embeddings`);

            this.articles = [];
            this.articleMap = new Map();

            let validEmbeddings = 0;

            // Process each article and add to the index
            articles.forEach((article, i) => {
                try {
                    const uri = article.article.value;
                    const content = article.content.value;
                    const embeddingStr = article.embedding.value;

                    // Parse the embedding vector
                    const embedding = JSON.parse(embeddingStr);

                    if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSION) {
                        // Add embedding to the index
                        this.index.add(embedding);

                        // Store article data
                        this.articles.push({
                            uri,
                            content: this.truncateContent(content),
                            title: this.extractTitle(uri, content)
                        });

                        // Map the index to the article
                        this.articleMap.set(validEmbeddings, uri);
                        validEmbeddings++;
                    } else {
                        logger.warn(`Skipping article with invalid embedding: ${uri}`);
                    }
                } catch (error) {
                    logger.error(`Error processing article embedding: ${error.message}`);
                }
            });

            logger.info(`Added ${validEmbeddings} valid embeddings to the index`);
        } catch (error) {
            logger.error('Error loading embeddings:', error);
            throw error;
        }
    }

    /**
     * Execute a SPARQL query against the endpoint
     */
    async executeSparqlQuery(query) {
        const auth = Buffer.from(`${SPARQL_AUTH.user}:${SPARQL_AUTH.password}`).toString('base64');

        try {
            const response = await fetch(SPARQL_QUERY_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: query
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            logger.error('Error executing SPARQL query:', error);
            throw error;
        }
    }

    /**
     * Generate an embedding for the search query
     */
    async generateEmbedding(text) {
        try {
            return await this.embeddingConnector.generateEmbedding(EMBEDDING_MODEL, text);
        } catch (error) {
            logger.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Search for articles similar to the query text
     */
    async search(queryText, limit = 5) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!queryText || queryText.trim().length === 0) {
            return [];
        }

        try {
            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(queryText);

            // Search the index
            const searchResults = this.index.search(queryEmbedding, limit);

            // Faiss-node returns an object with labels and distances
            const results = [];

            // Process the faiss search results
            for (let i = 0; i < searchResults.labels.length; i++) {
                const id = searchResults.labels[i];
                const score = searchResults.distances[i];

                const uri = this.articleMap.get(id);
                const article = this.articles.find(a => a.uri === uri);

                if (uri) {
                    results.push({
                        uri,
                        title: article?.title || this.getFilenameFromUri(uri),
                        content: article?.content || '',
                        score: score // Similarity score
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Error searching articles:', error);
            throw error;
        }
    }

    /**
     * Extract a title from the article content or URI
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
     */
    getFilenameFromUri(uri) {
        const parts = uri.split('/');
        return parts[parts.length - 1];
    }

    /**
     * Truncate content for display
     */
    truncateContent(content, maxLength = 200) {
        if (content.length <= maxLength) {
            return content;
        }

        return content.substring(0, maxLength) + '...';
    }
}

export default ArticleSearchService;