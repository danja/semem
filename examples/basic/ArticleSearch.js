/**
 * ArticleSearch.js - Semantic Article Search System
 * 
 * This script demonstrates how to:
 * 1. Load configuration from config/config.json
 * 2. Connect to a SPARQL endpoint for data retrieval
 * 3. Load article embeddings from the SPARQL store
 * 4. Build a FAISS index for similarity search
 * 5. Perform semantic search queries on articles
 * 
 * The service loads pre-computed embeddings and provides semantic search
 * functionality for finding articles similar to a query text.
 * 
 * Prerequisites:
 * - Ollama running with nomic-embed-text model
 * - SPARQL endpoint (Fuseki) with article embeddings
 * - config/config.json properly configured
 * - Articles with embeddings already stored (run ArticleEmbedding.js first)
 * 
 * Usage:
 * - node ArticleSearch.js                                    # Use default graph
 * - node ArticleSearch.js --graph http://purl.org/stuff/beerqa  # Use custom graph
 * - node ArticleSearch.js --help                             # Show usage info
 */

import fetch from 'node-fetch';
import faiss from 'faiss-node';
const { IndexFlatIP } = faiss;
import Config from '../../src/Config.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import logger from 'loglevel';

// Configure logging
logger.setLevel('debug') // Set to debug for more verbose output

class ArticleSearchService {
    constructor(config, options = {}) {
        this.config = config;
        this.embeddingConnector = null; // Will be initialized in setupConfiguration
        this.initialized = false;
        this.index = null;
        this.articles = [];
        this.articleMap = new Map(); // Map from index to article URI
        this.embeddingDimension = 1536; // Default, will be adjusted based on stored data

        // Get configuration values
        this.sparqlEndpoint = null;
        this.graphName = options.graphName || null; // Allow override via options
        this.embeddingProvider = null;
        this.embeddingModel = null;
        this.auth = null;

        this.setupConfiguration();
    }

    setupConfiguration() {
        // Get SPARQL endpoint from config
        const sparqlEndpointConfig = this.config.get('sparqlEndpoints.0');
        if (!sparqlEndpointConfig) {
            throw new Error('No SPARQL endpoint configured');
        }

        // Construct endpoint URLs
        this.sparqlEndpoint = `${sparqlEndpointConfig.urlBase}${sparqlEndpointConfig.query}`;

        // Get graph name from config (unless overridden in constructor)
        if (!this.graphName) {
            this.graphName = this.config.get('graphName') || this.config.get('storage.options.graphName') || 'http://danny.ayers.name/content';
        }

        // Get embedding configuration
        this.embeddingProvider = this.config.get('embeddingProvider') || 'ollama';
        this.embeddingModel = this.config.get('embeddingModel') || 'nomic-embed-text';

        // Create embedding connector using configuration (like BeerEmbedding.js)
        let providerConfig = {};
        if (this.embeddingProvider === 'nomic') {
            providerConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: this.embeddingModel
            };
        } else if (this.embeddingProvider === 'ollama') {
            providerConfig = {
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: this.embeddingModel
            };
        }
        
        this.embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);

        // Set up authentication
        this.auth = {
            user: sparqlEndpointConfig.user,
            password: sparqlEndpointConfig.password
        };

        logger.info(`🔧 Search service configured:`);
        logger.info(`   📊 SPARQL endpoint: ${this.sparqlEndpoint}`);
        logger.info(`   🗃️  Graph: ${this.graphName}`);
        logger.info(`   🤖 Embedding provider: ${this.embeddingProvider}`);
        logger.info(`   🎯 Embedding model: ${this.embeddingModel}`);
    }

    /**
     * Initialize the search service by loading embeddings
     */
    async initialize() {
        if (this.initialized) {
            logger.debug('🔄 Service already initialized, skipping...');
            return;
        }

        logger.info('🚀 Initializing ArticleSearchService...');
        logger.info('='.repeat(50));

        try {
            // Create the Faiss index
            logger.info(`🧠 Creating FAISS index with dimension ${this.embeddingDimension}...`);
            this.index = new IndexFlatIP(this.embeddingDimension);
            logger.info('✅ FAISS index created successfully');

            // Load article embeddings from SPARQL store
            await this.loadEmbeddings();

            this.initialized = true;
            logger.info('🎉 INITIALIZATION COMPLETED!');
            logger.info('='.repeat(50));
            logger.info(`📊 Summary:`);
            logger.info(`   ✅ Articles with embeddings: ${this.articles.length}`);
            logger.info(`   🔍 Search service ready for queries`);

        } catch (error) {
            logger.error('❌ Failed to initialize ArticleSearchService:', error.message);
            throw error;
        }
    }

    /**
     * Load article embeddings from the SPARQL store
     */
    async loadEmbeddings() {
        logger.info('📥 Loading article embeddings from SPARQL store...');

        // Use appropriate content predicate based on graph
        const contentPredicate = this.graphName === 'http://purl.org/stuff/beerqa' ? 
            'ragno:content' : 
            '<http://schema.org/articleBody>';

        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            SELECT ?article ?content ?embedding WHERE {
                GRAPH <${this.graphName}> {
                    ?article ${contentPredicate} ?content .
                    ?article ragno:hasEmbedding ?embedding .
                }
            }
        `;

        logger.debug('🔍 Executing SPARQL query for embeddings...');
        logger.debug(`📋 Query: ${query}`);

        try {
            const results = await this.executeSparqlQuery(query);
            const articles = results.results.bindings;

            logger.info(`📚 Found ${articles.length} articles with embeddings in SPARQL store`);

            if (articles.length === 0) {
                logger.warn('⚠️  No articles with embeddings found!');
                logger.warn('💡 Hint: Run ArticleEmbedding.js first to generate embeddings');
                return;
            }

            this.articles = [];
            this.articleMap = new Map();

            let validEmbeddings = 0;
            let invalidEmbeddings = 0;

            logger.info('🔄 Processing embeddings and building search index...');

            // Process each article and add to the index
            articles.forEach((article, i) => {
                try {
                    const uri = article.article.value;
                    const content = article.content.value;
                    const embeddingStr = article.embedding.value;

                    logger.debug(`📄 Processing ${i + 1}/${articles.length}: ${uri}`);

                    // Parse the embedding vector
                    const embedding = JSON.parse(embeddingStr);

                    if (Array.isArray(embedding)) {
                        // Log the actual dimensions we're seeing
                        if (i === 0) {
                            logger.info(`📏 Detected embedding dimension from stored data: ${embedding.length}`);
                            if (embedding.length !== this.embeddingDimension) {
                                logger.warn(`⚠️  Stored embeddings have dimension ${embedding.length}, but expected ${this.embeddingDimension}`);
                                logger.warn('🔄 Adjusting FAISS index to match stored embeddings...');

                                // Recreate the index with the correct dimension
                                this.index = new IndexFlatIP(embedding.length);
                                // Update our dimension for consistency
                                this.embeddingDimension = embedding.length;
                            }
                        }

                        if (embedding.length > 0) {
                            // Add embedding to the index
                            this.index.add(embedding);

                            // Store article data
                            const title = this.extractTitle(uri, content);
                            this.articles.push({
                                uri,
                                content: this.truncateContent(content),
                                title: title
                            });

                            // Map the index to the article
                            this.articleMap.set(validEmbeddings, uri);
                            validEmbeddings++;

                            logger.debug(`   ✅ Added: "${title}"`);
                        } else {
                            logger.warn(`   ❌ Invalid embedding (empty array): ${uri}`);
                            invalidEmbeddings++;
                        }
                    } else {
                        logger.warn(`   ❌ Invalid embedding (not an array): ${uri}`);
                        invalidEmbeddings++;
                    }
                } catch (error) {
                    logger.error(`   ❌ Error processing article: ${error.message}`);
                    invalidEmbeddings++;
                }
            });

            logger.info('📊 Embedding processing completed:');
            logger.info(`   ✅ Valid embeddings: ${validEmbeddings}`);
            logger.info(`   ❌ Invalid embeddings: ${invalidEmbeddings}`);
            logger.info(`   📈 Success rate: ${((validEmbeddings / articles.length) * 100).toFixed(1)}%`);

        } catch (error) {
            logger.error('❌ Error loading embeddings:', error.message);
            throw error;
        }
    }

    /**
     * Execute a SPARQL query against the endpoint
     */
    async executeSparqlQuery(query) {
        const auth = Buffer.from(`${this.auth.user}:${this.auth.password}`).toString('base64');

        logger.debug(`🔍 Executing SPARQL query to: ${this.sparqlEndpoint}`);

        try {
            const response = await fetch(this.sparqlEndpoint, {
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
                logger.error(`❌ SPARQL query failed: ${response.status} - ${errorText}`);
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            logger.debug(`✅ Query successful, returned ${result.results?.bindings?.length || 0} results`);
            return result;
        } catch (error) {
            logger.error('❌ Error executing SPARQL query:', error.message);
            throw error;
        }
    }

    /**
     * Generate an embedding for the search query
     */
    async generateEmbedding(text) {
        logger.debug(`🤖 Generating embedding for query: "${text.substring(0, 50)}..."`);
        try {
            const startTime = Date.now();
            const embedding = await this.embeddingConnector.generateEmbedding(this.embeddingModel, text);
            const endTime = Date.now();

            logger.debug(`✅ Embedding generated in ${endTime - startTime}ms, dimension: ${embedding.length}`);

            // Check dimension mismatch and handle it
            if (embedding.length !== this.embeddingDimension) {
                logger.warn(`⚠️  Dimension mismatch! Expected ${this.embeddingDimension}, got ${embedding.length}`);
                logger.warn('🔄 This may be due to different model versions. Attempting to handle...');

                if (embedding.length < this.embeddingDimension) {
                    // Pad with zeros if too short
                    const paddedEmbedding = [...embedding, ...new Array(this.embeddingDimension - embedding.length).fill(0)];
                    logger.warn(`📏 Padded embedding from ${embedding.length} to ${paddedEmbedding.length} dimensions`);
                    return paddedEmbedding;
                } else {
                    // Truncate if too long
                    const truncatedEmbedding = embedding.slice(0, this.embeddingDimension);
                    logger.warn(`✂️  Truncated embedding from ${embedding.length} to ${truncatedEmbedding.length} dimensions`);
                    return truncatedEmbedding;
                }
            }

            return embedding;
        } catch (error) {
            logger.error('❌ Error generating embedding:', error.message);
            throw error;
        }
    }

    /**
     * Search for articles similar to the query text
     */
    async search(queryText, limit = 5) {
        if (!this.initialized) {
            logger.info('🔄 Search service not initialized, initializing now...');
            await this.initialize();
        }

        if (!queryText || queryText.trim().length === 0) {
            logger.warn('⚠️  Empty query provided, returning no results');
            return [];
        }

        // Check if we have any articles loaded
        if (this.articles.length === 0) {
            logger.warn('⚠️  No articles with embeddings found in SPARQL store');
            logger.warn('💡 Hint: Run ArticleEmbedding.js first to generate embeddings');
            return [];
        }

        logger.info('🔍 PERFORMING SEMANTIC SEARCH');
        logger.info('='.repeat(40));
        logger.info(`📝 Query: "${queryText}"`);
        logger.info(`🎯 Limit: ${limit} results`);

        try {
            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(queryText);

            // Ensure we don't search for more results than we have
            const searchLimit = Math.min(limit, this.articles.length);
            
            // Search the index
            logger.info(`🔎 Searching FAISS index (${searchLimit} of ${this.articles.length} available)...`);
            const searchResults = this.index.search(queryEmbedding, searchLimit);
            logger.debug('🔍 Raw search results:', searchResults);

            // Handle FAISS search results format
            let resultsArray = [];
            if (searchResults && typeof searchResults === 'object') {
                if (Array.isArray(searchResults)) {
                    resultsArray = searchResults;
                } else if (searchResults.labels && searchResults.distances) {
                    // Convert FAISS format to our expected format
                    resultsArray = searchResults.labels.map((id, i) => ({
                        id: id,
                        score: searchResults.distances[i]
                    }));
                }
            }

            logger.info(`✅ Found ${resultsArray.length} results`);

            // Map results to articles
            const results = resultsArray.map((result, i) => {
                const uri = this.articleMap.get(result.id);
                const article = this.articles.find(a => a.uri === uri);

                const mappedResult = {
                    rank: i + 1,
                    uri,
                    title: article?.title || this.getFilenameFromUri(uri),
                    content: article?.content || '',
                    score: result.score.toFixed(4)
                };

                logger.info(`${i + 1}. "${mappedResult.title}" (score: ${mappedResult.score})`);
                logger.debug(`   📄 Content: ${mappedResult.content.substring(0, 100)}...`);

                return mappedResult;
            });

            logger.info('='.repeat(40));
            logger.info(`🎉 Search completed successfully with ${results.length} results`);

            return results;
        } catch (error) {
            logger.error('❌ Error searching articles:', error.message);
            throw error;
        }
    }

    /**
     * Extract a title from the article content or URI
     */
    extractTitle(uri, content) {
        // Try to extract title from content (first line if it looks like a title)
        const firstLine = content.split('\\n')[0].trim();
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

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        graphName: null,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--graph':
                options.graphName = args[++i];
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                console.log(`Unknown option: ${arg}`);
                process.exit(1);
        }
    }

    return options;
}

/**
 * Show usage information
 */
function showUsage() {
    console.log('Usage: node ArticleSearch.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --graph <uri>    Named graph URI to search (default: from config)');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node ArticleSearch.js');
    console.log('  node ArticleSearch.js --graph http://purl.org/stuff/beerqa');
    console.log('  node ArticleSearch.js --graph http://danny.ayers.name/content');
    console.log('');
}

// Main function to demonstrate the search service
async function main() {
    const options = parseArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    logger.info('🚀 Starting ArticleSearchService Demo');
    logger.info('='.repeat(60));

    try {
        // Load configuration
        logger.info('⚙️  Loading configuration from config file...');
        const config = new Config('config/config.json');
        await config.init();
        logger.info('✅ Configuration loaded successfully');

        // Create search service with optional graph override
        const searchOptions = {};
        if (options.graphName) {
            searchOptions.graphName = options.graphName;
            logger.info(`🎯 Using custom graph: ${options.graphName}`);
        }
        
        const searchService = new ArticleSearchService(config, searchOptions);

        // Initialize the service
        await searchService.initialize();

        // Test queries - adapt based on graph content
        let testQueries;
        if (options.graphName === 'http://purl.org/stuff/beerqa') {
            testQueries = [
                'beer brewing process',
                'different types of beer',
                'alcohol content in beer',
                'beer ingredients and recipes',
                'beer history and culture'
            ];
        } else {
            testQueries = [
                'semantic web technologies',
                'machine learning applications',
                'vector embeddings neural networks',
                'SPARQL query language',
                'artificial intelligence'
            ];
        }

        logger.info('🧪 Running test queries...');
        logger.info('='.repeat(60));

        for (const query of testQueries) {
            try {
                const results = await searchService.search(query, 3);

                if (results.length === 0) {
                    logger.warn(`⚠️  No results found for: "${query}"`);
                } else {
                    logger.info(`\n📊 Top results for: "${query}"`);
                    results.forEach(result => {
                        logger.info(`   ${result.rank}. ${result.title} (${result.score})`);
                        logger.info(`      📄 ${result.content}`);
                        logger.info(`      🔗 ${result.uri}`);
                    });
                }

                // Wait between queries
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                logger.error(`❌ Error searching for "${query}":`, error.message);
            }
        }

        logger.info('\n🎉 Demo completed successfully!');
        logger.info('💡 The search service is ready for use in your applications');

    } catch (error) {
        logger.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default ArticleSearchService;