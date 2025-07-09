/**
 * RAG.js - Retrieval Augmented Generation System
 * 
 * This script demonstrates naive retrieval augmented generation by:
 * 1. Loading configuration from config/config.json
 * 2. Connecting to a SPARQL endpoint for data retrieval
 * 3. Loading embeddings from the SPARQL store that correspond to document chunks
 * 4. Building a FAISS index for similarity search
 * 5. Performing semantic search query using the question over the FAISS index
 * 6. Formatting the question together with the top 3 matches from the index as context
 * 7. Preparing an LLM as determined by the config
 * 8. Calling the LLM with the augmented question and returning the result
 * 
 * Prerequisites:
 * - SPARQL endpoint (Fuseki) with document chunks and embeddings
 * - config/config.json properly configured
 * - Document chunks with embeddings already stored (run document pipeline first)
 * - LLM and embedding providers configured
 * 
 * Usage:
 * - node RAG.js "What is machine learning?"
 * - node RAG.js "How does beer brewing work?" --graph http://purl.org/stuff/beerqa
 * - node RAG.js --interactive
 * - node RAG.js --help
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });
import faiss from 'faiss-node';
const { IndexFlatIP } = faiss;
import readline from 'readline';
import logger from 'loglevel';

import Config from '../../src/Config.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Configure logging
logger.setLevel('debug');

// Debug: Check if API keys are loaded
logger.debug('🔍 Environment variables loaded:');
logger.debug(`   MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET'}`);
logger.debug(`   CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? 'SET' : 'NOT SET'}`);
logger.debug(`   NOMIC_API_KEY: ${process.env.NOMIC_API_KEY ? 'SET' : 'NOT SET'}`);

class RAGSystem {
    constructor(config, options = {}) {
        this.config = config;
        this.options = options;

        // Core components
        this.embeddingConnector = null;
        this.llmHandler = null;
        this.initialized = false;
        this._cleanupInProgress = false;

        // Search components
        this.index = null;
        this.chunks = [];
        this.chunkMap = new Map(); // Map from index to chunk URI
        this.embeddingDimension = 1536; // Default, will be adjusted

        // Configuration
        this.sparqlEndpoint = null;
        this.graphName = options.graphName || null;
        this.auth = null;
        
        // SPARQL services
        this.queryService = null;
        this.sparqlHelper = null;

        this.setupConfiguration();
    }

    setupConfiguration() {
        // Get SPARQL endpoint from storage configuration (same as ChunkDocuments.js)
        const storageConfig = this.config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('No SPARQL storage configuration found');
        }

        // Use the configured SPARQL query endpoint
        this.sparqlEndpoint = storageConfig.options.query;

        // Get graph name from config (unless overridden)
        if (!this.graphName) {
            this.graphName = storageConfig.options.graphName ||
                this.config.get('graphName') ||
                'http://tensegrity.it/semem';
        }

        // Set up authentication
        this.auth = {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        };

        // Initialize SPARQL services with correct paths
        this.queryService = new SPARQLQueryService();
        
        this.sparqlHelper = new SPARQLHelper(this.sparqlEndpoint, {
            user: this.auth.user,
            password: this.auth.password
        });

        logger.info(`🔧 RAG System configured:`);
        logger.info(`   📊 SPARQL endpoint: ${this.sparqlEndpoint}`);
        logger.info(`   🗃️  Graph: ${this.graphName}`);
    }

    /**
     * Create LLM connector based on configuration priority (following ExtractConcepts.js pattern)
     */
    async createLLMConnector(config) {
        try {
            // Get LLM providers from config and find chat-capable one
            const llmProviders = config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            // Sort by priority and use the highest priority chat provider
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            // Try providers in priority order
            for (const provider of sortedProviders) {
                try {
                    chatModel = provider.chatModel || config.get('chatModel') || 'qwen2:1.5b';

                    logger.debug(`🔍 Trying provider: ${provider.type}, apiKey: ${provider.apiKey ? 'SET' : 'NOT SET'}`);
                    
                    if (provider.type === 'mistral' && provider.apiKey) {
                        logger.debug(`🔍 Initializing Mistral with env key: ${process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET'}`);
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        return { provider: llmProvider, model: chatModel };
                    } else if (provider.type === 'claude' && provider.apiKey) {
                        logger.debug(`🔍 Initializing Claude with env key: ${process.env.CLAUDE_API_KEY ? 'SET' : 'NOT SET'}`);
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

            // Fallback to Ollama if no providers worked
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
     * Create embedding connector using configuration-driven factory pattern (following MakeEmbeddings.js pattern)
     */
    async createEmbeddingConnector(config) {
        try {
            // Get embedding configuration from config, following MakeEmbeddings.js patterns
            const embeddingProvider = config.get('embeddingProvider') || 'ollama';
            const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';

            logger.info(`🧠 Using embedding provider: ${embeddingProvider}`);
            logger.info(`🧠 Embedding model: ${embeddingModel}`);

            // Create embedding connector using configuration patterns from reference
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
                // Default to ollama for any other provider
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
                embeddingDimension = 768; // Nomic embedding dimension
            } else if (embeddingModel.includes('text-embedding')) {
                embeddingDimension = 1536; // OpenAI text-embedding models
            } else {
                embeddingDimension = 1536; // Default dimension for most models
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
     * Initialize the RAG system
     */
    async initialize() {
        if (this.initialized) {
            logger.debug('🔄 RAG System already initialized, skipping...');
            return;
        }

        logger.info('🚀 Initializing RAG System...');
        logger.info('='.repeat(50));

        try {
            // Initialize providers
            const llmResult = await this.createLLMConnector(this.config);
            const embeddingResult = await this.createEmbeddingConnector(this.config);

            // Initialize handlers
            this.embeddingConnector = embeddingResult.connector;
            this.llmHandler = new LLMHandler(llmResult.provider, llmResult.model);

            // Set the correct embedding dimension
            this.embeddingDimension = embeddingResult.dimension;

            // Create the FAISS index
            logger.info(`🧠 Creating FAISS index with dimension ${this.embeddingDimension}...`);
            this.index = new IndexFlatIP(this.embeddingDimension);
            logger.info('✅ FAISS index created successfully');

            // Load document chunks with embeddings from SPARQL store
            await this.loadEmbeddings();

            this.initialized = true;
            logger.info('🎉 RAG SYSTEM INITIALIZED!');
            logger.info('='.repeat(50));
            logger.info(`📊 Summary:`);
            logger.info(`   ✅ Document chunks loaded: ${this.chunks.length}`);
            logger.info(`   🔍 RAG system ready for questions`);

        } catch (error) {
            logger.error('❌ Failed to initialize RAG System:', error.message);
            throw error;
        }
    }

    /**
     * Load document chunks with embeddings from the SPARQL store using template
     */
    async loadEmbeddings() {
        logger.info('📥 Loading document chunks with embeddings from SPARQL store...');

        try {
            // Use the SPARQL template service to get the query
            const query = await this.queryService.getQuery('rag-document-chunks', {
                graphURI: this.graphName,
                additionalFilters: '',
                limitClause: ''
            });

            logger.debug('🔍 Executing SPARQL query for document chunks...');
            logger.debug(`📋 Query: ${query}`);

            const result = await this.sparqlHelper.executeSelect(query);
            
            if (!result.success) {
                throw new Error(`SPARQL query failed: ${result.error}`);
            }

            const chunks = result.data.results.bindings;

            logger.info(`📚 Found ${chunks.length} document chunks with embeddings in SPARQL store`);

            if (chunks.length === 0) {
                logger.warn('⚠️  No document chunks with embeddings found!');
                logger.warn('💡 Hint: Run the document processing pipeline first:');
                logger.warn('   1. LoadPDFs.js - Load documents');
                logger.warn('   2. ChunkDocuments.js - Create chunks');
                logger.warn('   3. MakeEmbeddings.js - Generate embeddings');
                return;
            }

            this.chunks = [];
            this.chunkMap = new Map();

            let validEmbeddings = 0;
            let invalidEmbeddings = 0;

            logger.info('🔄 Processing embeddings and building search index...');

            // Process each chunk and add to the index
            chunks.forEach((chunk, i) => {
                try {
                    const uri = chunk.chunk.value;
                    const content = chunk.content.value;
                    const embeddingStr = chunk.embedding.value;
                    const extent = chunk.extent ? parseInt(chunk.extent.value) : content.length;
                    const sourceUnit = chunk.sourceUnit?.value || 'Unknown';

                    logger.debug(`📄 Processing ${i + 1}/${chunks.length}: ${uri}`);

                    // Parse the embedding vector (stored as comma-separated string)
                    const embedding = embeddingStr.split(',').map(x => parseFloat(x.trim()));

                    if (Array.isArray(embedding)) {
                        // Log the actual dimensions we're seeing
                        if (i === 0) {
                            logger.info(`📏 Detected embedding dimension from stored data: ${embedding.length}`);
                            if (embedding.length !== this.embeddingDimension) {
                                logger.warn(`⚠️  Stored embeddings have dimension ${embedding.length}, but expected ${this.embeddingDimension}`);
                                logger.warn('🔄 Adjusting FAISS index to match stored embeddings...');

                                // Recreate the index with the correct dimension
                                this.index = new IndexFlatIP(embedding.length);
                                this.embeddingDimension = embedding.length;
                            }
                        }

                        if (embedding.length > 0) {
                            // Add embedding to the index
                            this.index.add(embedding);

                            // Store chunk data
                            const title = this.extractTitle(uri, content);
                            this.chunks.push({
                                uri,
                                content: this.truncateContent(content, 300),
                                fullContent: content,
                                title: title,
                                extent: extent,
                                sourceUnit: sourceUnit
                            });

                            // Map the index to the chunk
                            this.chunkMap.set(validEmbeddings, uri);
                            validEmbeddings++;

                            logger.debug(`   ✅ Added: "${title}" (${extent} chars)`);
                        } else {
                            logger.warn(`   ❌ Invalid embedding (empty array): ${uri}`);
                            invalidEmbeddings++;
                        }
                    } else {
                        logger.warn(`   ❌ Invalid embedding (not an array): ${uri}`);
                        invalidEmbeddings++;
                    }
                } catch (error) {
                    logger.error(`   ❌ Error processing chunk: ${error.message}`);
                    invalidEmbeddings++;
                }
            });

            logger.info('📊 Embedding processing completed:');
            logger.info(`   ✅ Valid embeddings: ${validEmbeddings}`);
            logger.info(`   ❌ Invalid embeddings: ${invalidEmbeddings}`);
            logger.info(`   📈 Success rate: ${((validEmbeddings / chunks.length) * 100).toFixed(1)}%`);

        } catch (error) {
            logger.error('❌ Error loading embeddings:', error.message);
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
            const embeddingModel = this.config.get('embeddingModel') || 'nomic-embed-text';
            const embedding = await this.embeddingConnector.generateEmbedding(embeddingModel, text);
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
     * Search for chunks similar to the query text
     */
    async searchChunks(queryText, limit = 3) {
        if (!queryText || queryText.trim().length === 0) {
            logger.warn('⚠️  Empty query provided, returning no results');
            return [];
        }

        // Check if we have any chunks loaded
        if (this.chunks.length === 0) {
            logger.warn('⚠️  No document chunks with embeddings found in SPARQL store');
            logger.warn('💡 Hint: Run the document processing pipeline first');
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
            const searchLimit = Math.min(limit, this.chunks.length);

            // Search the index
            logger.info(`🔎 Searching FAISS index (${searchLimit} of ${this.chunks.length} available)...`);
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

            // Map results to chunks
            const results = resultsArray.map((result, i) => {
                const uri = this.chunkMap.get(result.id);
                const chunk = this.chunks.find(c => c.uri === uri);

                const mappedResult = {
                    rank: i + 1,
                    uri,
                    title: chunk?.title || this.getFilenameFromUri(uri),
                    content: chunk?.content || '',
                    fullContent: chunk?.fullContent || '',
                    extent: chunk?.extent || 0,
                    sourceUnit: chunk?.sourceUnit || 'Unknown',
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
            logger.error('❌ Error searching chunks:', error.message);
            throw error;
        }
    }

    /**
     * Generate an augmented response using RAG
     */
    async generateResponse(question, searchResults) {
        logger.info('🧠 GENERATING AUGMENTED RESPONSE');
        logger.info('='.repeat(40));

        try {
            // Format the context from search results
            const context = searchResults.map((result, i) => {
                return `[Context ${i + 1}] ${result.title}:\n${result.fullContent}\n`;
            }).join('\n');

            // Create the augmented prompt
            const augmentedPrompt = `You are an AI assistant that answers questions based on provided context. Use the following context to answer the question. If the context doesn't contain relevant information, say so.

Context:
${context}

Question: ${question}

Answer:`;

            logger.info(`📝 Augmented prompt created (${augmentedPrompt.length} characters)`);
            logger.debug(`🔍 Full prompt: ${augmentedPrompt}`);

            // Generate response using LLM
            const response = await this.llmHandler.generateResponse(
                augmentedPrompt,
                "",
                { temperature: 0.7, max_tokens: 1000 }
            );

            logger.info('✅ Response generated successfully');
            return response;

        } catch (error) {
            logger.error('❌ Error generating response:', error.message);
            throw error;
        }
    }

    /**
     * Main RAG processing function
     */
    async processQuestion(question) {
        if (!this.initialized) {
            logger.info('🔄 RAG system not initialized, initializing now...');
            await this.initialize();
        }

        logger.info('🤖 PROCESSING RAG QUESTION');
        logger.info('='.repeat(60));
        logger.info(`❓ Question: "${question}"`);

        try {
            // Step 1: Search for relevant chunks
            const searchResults = await this.searchChunks(question, 3);

            if (searchResults.length === 0) {
                logger.warn('⚠️  No relevant context found for the question');
                return "I couldn't find any relevant information in the document collection to answer your question.";
            }

            // Step 2: Generate augmented response
            const response = await this.generateResponse(question, searchResults);

            logger.info('🎉 RAG PROCESSING COMPLETED!');
            logger.info('='.repeat(60));

            return response;

        } catch (error) {
            logger.error('❌ Error processing question:', error.message);
            throw error;
        }
    }

    /**
     * Extract a title from the chunk content or URI
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

    /**
     * Clean up all connections and resources
     */
    async cleanup() {
        // Prevent multiple cleanup calls
        if (this._cleanupInProgress || !this.initialized) {
            return;
        }
        this._cleanupInProgress = true;
        
        logger.info('🧹 Cleaning up RAG system resources...');
        
        try {
            // Clear large data structures
            if (this.chunks) {
                this.chunks.length = 0;
                this.chunks = null;
            }
            
            if (this.chunkMap) {
                this.chunkMap.clear();
                this.chunkMap = null;
            }
            
            // Clear FAISS index
            if (this.index) {
                this.index = null;
            }
            
            // Clean up connectors if they have cleanup methods
            if (this.embeddingConnector && typeof this.embeddingConnector.cleanup === 'function') {
                await this.embeddingConnector.cleanup();
            }
            
            if (this.llmHandler && typeof this.llmHandler.cleanup === 'function') {
                await this.llmHandler.cleanup();
            }
            
            // Clean up SPARQL services if they have cleanup methods
            if (this.sparqlHelper && typeof this.sparqlHelper.cleanup === 'function') {
                await this.sparqlHelper.cleanup();
            }
            
            if (this.queryService && typeof this.queryService.cleanup === 'function') {
                await this.queryService.cleanup();
            }
            
            // Mark as not initialized
            this.initialized = false;
            
            logger.info('✅ RAG system cleanup completed');
            
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
        question: null,
        graphName: null,
        interactive: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--graph':
                options.graphName = args[++i];
                break;
            case '--interactive':
                options.interactive = true;
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
    console.log('Usage: node RAG.js [question] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  question         Question to ask (required unless --interactive)');
    console.log('');
    console.log('Options:');
    console.log('  --graph <uri>    Named graph URI to search (default: from config)');
    console.log('  --interactive    Interactive mode for multiple questions');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node RAG.js "What is machine learning?"');
    console.log('  node RAG.js "How does beer brewing work?" --graph http://purl.org/stuff/beerqa');
    console.log('  node RAG.js --interactive');
    console.log('');
    console.log('Prerequisites:');
    console.log('  1. Run document processing pipeline:');
    console.log('     - node examples/document/LoadPDFs.js');
    console.log('     - node examples/document/ChunkDocuments.js');
    console.log('     - node examples/document/MakeEmbeddings.js');
    console.log('  2. Configure config/config.json with SPARQL and LLM providers');
    console.log('  3. Set API keys in .env file');
    console.log('');
}

/**
 * Interactive mode for multiple questions
 */
async function interactiveMode(ragSystem) {
    console.log('🤖 RAG Interactive Mode');
    console.log('Type your questions, or "quit" to exit.');
    console.log('='.repeat(50));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Handle Ctrl+C and other close events in interactive mode
    rl.on('close', async () => {
        console.log('\n👋 Goodbye!');
        await ragSystem.cleanup();
        process.exit(0);
    });

    rl.on('SIGINT', async () => {
        console.log('\n🛑 Interrupted, cleaning up...');
        rl.close(); // This will trigger the 'close' event above
    });

    const askQuestion = () => {
        rl.question('\n❓ Your question: ', async (question) => {
            if (question.toLowerCase() === 'quit' || question.toLowerCase() === 'exit') {
                rl.close(); // This will trigger the 'close' event which handles cleanup
                return;
            }

            if (question.trim() === '') {
                console.log('⚠️  Please enter a question.');
                askQuestion();
                return;
            }

            try {
                const response = await ragSystem.processQuestion(question);
                console.log('\n🤖 Response:');
                console.log(response);
            } catch (error) {
                console.error('❌ Error:', error.message);
            }

            askQuestion();
        });
    };

    askQuestion();
}

// Main function
async function main() {
    const options = parseArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    if (!options.interactive && !options.question) {
        console.error('❌ Error: Please provide a question or use --interactive mode');
        showUsage();
        process.exit(1);
    }

    logger.info('🚀 Starting RAG System');
    logger.info('='.repeat(60));

    let ragSystem = null;

    try {
        // Load configuration
        logger.info('⚙️  Loading configuration from config file...');
        // Config path relative to project root
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        const config = new Config(configPath);
        await config.init();
        logger.info('✅ Configuration loaded successfully');

        // Create RAG system with optional graph override
        const ragOptions = {};
        if (options.graphName) {
            ragOptions.graphName = options.graphName;
            logger.info(`🎯 Using custom graph: ${options.graphName}`);
        }

        ragSystem = new RAGSystem(config, ragOptions);

        // Set up signal handlers for graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
            if (ragSystem) {
                await ragSystem.cleanup();
            }
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        // Initialize the system
        await ragSystem.initialize();

        if (options.interactive) {
            // Interactive mode
            await interactiveMode(ragSystem);
        } else {
            // Single question mode
            const response = await ragSystem.processQuestion(options.question);

            console.log('\n🎉 RAG RESPONSE:');
            console.log('='.repeat(50));
            console.log(response);
            console.log('='.repeat(50));
        }

    } catch (error) {
        logger.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        if (ragSystem) {
            await ragSystem.cleanup();
        }
        
        // Force exit after a short delay to ensure cleanup completes
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

export default RAGSystem;