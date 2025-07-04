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
import HClaudeClientConnector from '../../connectors/ClaudeConnector.js';
import MistralConnector from '../../connectors/MistralConnector.js';

/**
 * UI server application that serves the web interface and API endpoints
 */
class UIServer {
    /**
     * Creates a new UIServer
     * @param {Object} options - Configuration options
     * @param {number} options.port - The port to listen on
     * @param {string} options.graphName - The graph name to search in
     */
    constructor(options = {}) {
        this.port = options.port || 4100;
        this.graphName = options.graphName || 'http://hyperdata.it/content';
        this.chatModel = options.chatModel || 'qwen2:1.5b';
        this.embeddingModel = options.embeddingModel || 'nomic-embed-text';

        // Configure SPARQL endpoints (list of servers to try in order)
        // Support both old format (queryEndpoint/updateEndpoint) and new Config.js format (urlBase/query/update)
        this.sparqlEndpoints = this.transformEndpoints(options.sparqlEndpoints) || [
            {
                queryEndpoint: 'http://localhost:4030/semem/query',
                updateEndpoint: 'http://localhost:4030/semem/update',
                auth: {
                    user: 'admin',
                    password: 'admin123'
                }
            },
            {
                queryEndpoint: 'http://localhost:3030/semem/query',
                updateEndpoint: 'http://localhost:3030/semem/update',
                auth: {
                    user: 'admin',
                    password: 'admin'
                }
            }
        ];

        // Configure LLM provider endpoints
        this.llmProviders = options.llmProviders || [
            {
                type: 'mistral',
                apiKey: process.env.MISTRAL_API_KEY || '',
                baseUrl: process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1',
                chatModel: process.env.MISTRAL_MODEL || 'mistral-medium',
                priority: 1
            },
            {
                type: 'claude',
                implementation: 'hyperdata', // Uses hyperdata-clients library
                apiKey: process.env.CLAUDE_API_KEY || '',
                chatModel: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
                priority: 2
            },
            {
                type: 'ollama',
                baseUrl: 'http://localhost:11434',
                chatModel: this.chatModel,
                embeddingModel: this.embeddingModel,
                priority: 3
            },
            {
                type: 'claude',
                implementation: 'direct', // Uses direct API connection
                apiKey: process.env.CLAUDE_API_KEY || '',
                baseUrl: process.env.CLAUDE_API_BASE || 'https://api.anthropic.com',
                chatModel: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
                priority: 4
            },
            {
                type: 'openai',
                apiKey: process.env.OPENAI_API_KEY || '',
                chatModel: 'gpt-3.5-turbo',
                embeddingModel: 'text-embedding-3-small',
                priority: 5
            }
        ];

        // Separate default providers for chat and embedding
        this.defaultChatProvider = this.llmProviders.find(p => p.type === 'mistral') ||
            this.llmProviders.find(p => p.type === 'claude' && p.implementation === 'direct') ||
            this.llmProviders.find(p => p.type === 'claude' && p.implementation === 'hyperdata') ||
            this.llmProviders.find(p => p.type === 'ollama') ||
            this.llmProviders[0];

        this.defaultEmbeddingProvider = this.llmProviders.find(p => p.type === 'ollama') ||
            this.llmProviders.find(p => p.type === 'openai') ||
            this.llmProviders[0];

        // Initialize services
        this.embeddingService = new EmbeddingService();

        // Initialize SPARQL service with first endpoint, others will be tried if this fails
        this.sparqlService = new SPARQLService({
            queryEndpoint: this.sparqlEndpoints[0].queryEndpoint,
            updateEndpoint: this.sparqlEndpoints[0].updateEndpoint,
            graphName: this.graphName,
            auth: this.sparqlEndpoints[0].auth
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
        this.publicDir = path.join(this.projectRoot, 'dist');

        logger.info(`UIServer initialized with port: ${this.port}, graph: ${this.graphName}`);
    }

    /**
     * Configure the Express app
     */
    configureApp() {
        // Middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Add timing middleware for performance tracking
        this.app.use((req, res, next) => {
            req.startTime = Date.now();
            next();
        });

        // Serve webpack dist files with /dist path
        this.app.use('/dist', express.static(this.publicDir));

        // Also serve from root for main page
        this.app.use(express.static(this.publicDir));

        // Serve node_modules for Atuin CSS and other dependencies
        this.app.use('/node_modules', express.static(path.join(this.projectRoot, 'node_modules')));

        // API endpoint for searching
        this.app.get('/api/search', this.handleSearch.bind(this));

        // Add health check endpoint
        this.app.get('/api/health', this.handleHealthCheck.bind(this));

        // Chat endpoints
        this.app.post('/api/chat', this.handleChat.bind(this));
        this.app.post('/api/chat/stream', this.handleChatStream.bind(this));
        this.app.post('/api/chat/completion', this.handleChatCompletion.bind(this));

        // Memory endpoints
        this.app.post('/api/memory', this.handleMemoryStore.bind(this));
        this.app.get('/api/memory/search', this.handleMemorySearch.bind(this));
        this.app.post('/api/memory/embedding', this.handleEmbedding.bind(this));
        this.app.post('/api/memory/concepts', this.handleConcepts.bind(this));

        // Memory visualization endpoints
        this.app.post('/api/memory/graph', this.handleMemoryGraph.bind(this));
        this.app.post('/api/memory/timeline', this.handleMemoryTimeline.bind(this));
        this.app.post('/api/memory/clusters', this.handleMemoryClusters.bind(this));
        this.app.post('/api/memory/search/advanced', this.handleAdvancedMemorySearch.bind(this));

        // Provider endpoints
        this.app.get('/api/providers', this.handleListProviders.bind(this));

        // SPARQL Browser endpoints
        this.app.get('/api/sparql/endpoints', this.handleSparqlEndpoints.bind(this));
        this.app.post('/api/sparql/query', this.handleSparqlQuery.bind(this));
        this.app.post('/api/sparql/construct', this.handleSparqlConstruct.bind(this));
        this.app.post('/api/sparql/validate', this.handleSparqlValidate.bind(this));
        this.app.post('/api/sparql/insert', this.handleSparqlInsert.bind(this));
        this.app.post('/api/sparql/test', this.handleSparqlTest.bind(this));

        // HTML route for the UI
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

            // Check if search service is available
            if (!this.searchService) {
                logger.warn('Search service not available, returning empty results');
                return res.json({
                    results: [],
                    error: 'Search service not available (SPARQL endpoints unreachable)'
                });
            }
            
            logger.info(`Search service available, initialized: ${this.searchService.initialized}`);
            
            // Check if search service is properly initialized
            if (!this.searchService.initialized) {
                logger.warn('Search service not initialized, returning empty results');
                return res.json({
                    results: [],
                    error: 'Search service not initialized (still loading embeddings)'
                });
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
     * Handle health check requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleHealthCheck(req, res) {
        try {
            // Check services status safely
            let chatStatus = 'offline';
            let memoryStatus = 'offline';

            try {
                if (this.chatAPI) {
                    chatStatus = 'online';
                }
            } catch (e) {
                logger.warn('Error checking chat API status:', e);
            }

            try {
                if (this.memoryManager) {
                    memoryStatus = 'online';
                }
            } catch (e) {
                logger.warn('Error checking memory API status:', e);
            }

            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                services: {
                    search: this.searchService ? 'online' : 'offline',
                    chat: chatStatus,
                    memory: memoryStatus
                }
            };

            res.json(health);
        } catch (error) {
            logger.error('Health check error:', error);
            res.status(500).json({
                status: 'degraded',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    /**
     * Handle chat API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
    }
    /**
     * Handle chat API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleChat(req, res) {
        try {
            // Validate request
            const {
                prompt,
                conversationId,
                useMemory,
                temperature,
                useSearchInterjection,
                providerId
            } = req.body;

            if (!prompt) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Prompt is required'
                });
            }

            logger.info(`🔍 [CHAT DEBUG] Chat request with prompt: "${prompt.slice(0, 30)}..."`);
            logger.info(`🔍 [CHAT DEBUG] Request providerId: "${providerId}"`);

            try {
                logger.info(`🔍 [CHAT DEBUG] Entering try block for chat processing`);
                // Optionally enrich the prompt with search results if requested
                let enrichedPrompt = prompt;
                let searchResults = [];

                // If search interjection is requested, find relevant content
                if (useSearchInterjection) {
                    try {
                        logger.info('Searching for relevant content to interject...');
                        searchResults = await this.performEmbeddingSearch(prompt);

                        if (searchResults && searchResults.length > 0) {
                            // Format search results as context
                            const contextBlocks = searchResults.map((result, index) =>
                                `[DOCUMENT ${index + 1}]\nTitle: ${result.title || 'Untitled'}\nContent: ${result.content}\nScore: ${result.score}\n`
                            ).join('\n');

                            // Append context to prompt with instructions
                            enrichedPrompt = `I found some relevant information that might help answer your question. Please consider this information when formulating your response:

${contextBlocks}

Based on the above information and your knowledge, here is the user's question: ${prompt}`;

                            logger.info(`Enriched prompt with ${searchResults.length} search results`);
                        }
                    } catch (searchError) {
                        logger.warn('Failed to enrich prompt with search results:', searchError);
                        // Continue with original prompt if search fails
                    }
                }

                // DEBUG: Log the provider selection process
                logger.info(`🔍 [CHAT DEBUG] Received provider ID: "${providerId}"`);
                logger.info(`🔍 [CHAT DEBUG] Available chatProviders: ${this.chatProviders?.map(p => `${p.id}:${p.type}`).join(', ')}`);

                // Get the selected provider by ID or use the default (use chatProviders like streaming)
                const selectedProvider = this.chatProviders?.find(p => p.id === providerId) || this.chatProviders?.[0];

                if (!selectedProvider) {
                    throw new Error('No chat provider available');
                }

                logger.info(`🚀 [CHAT DEBUG] Selected provider: ${selectedProvider.type}${selectedProvider.implementation ? ` (${selectedProvider.implementation})` : ''} with ID: ${selectedProvider.id}`);

                // Ensure the provider has a connector (chatProviders should already be initialized)
                if (!selectedProvider.connector) {
                    logger.error(`🚨 [CHAT DEBUG] Provider ${selectedProvider.type} has no connector! This should not happen with chatProviders.`);
                    throw new Error(`Provider ${selectedProvider.type} is not properly initialized`);
                }

                logger.info(`✅ [CHAT DEBUG] Provider ${selectedProvider.type} has connector: ${selectedProvider.connector.constructor.name}`);

                // Use the model from the request or fall back to the provider's default
                const modelToUse = req.body.model || selectedProvider.chatModel;
                logger.info(`🎯 [CHAT DEBUG] Using model: ${modelToUse} for provider: ${selectedProvider.type}`);

                // Create chat API with selected provider and model
                const chatAPI = await this.createChatAPI(selectedProvider, modelToUse);
                logger.info(`🔧 [CHAT DEBUG] Created ChatAPI with provider: ${selectedProvider.type}, connector: ${selectedProvider.connector.constructor.name}`);

                // Generate response with the selected model
                logger.info(`🚀 [CHAT DEBUG] About to execute chat operation with provider: ${selectedProvider.type}`);
                const result = await chatAPI.executeOperation('chat', {
                    prompt: enrichedPrompt, // Use the potentially enriched prompt
                    conversationId,
                    useMemory: useMemory !== false, // Default to true if not specified
                    temperature: temperature || 0.7,
                    model: modelToUse // Use the selected model
                });
                logger.info(`✅ [CHAT DEBUG] Chat operation completed with provider: ${selectedProvider.type}`);

                // Add search results to the response
                if (searchResults && searchResults.length > 0) {
                    result.searchResults = searchResults.map(r => ({
                        title: r.title || 'Untitled',
                        content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
                        score: r.score
                    }));
                }

                // Return response
                res.json(result);
            } catch (apiError) {
                logger.error('🚨 [CHAT DEBUG] Chat API error:', apiError);
                logger.error('🚨 [CHAT DEBUG] Error stack:', apiError.stack);

                // Fallback: Use direct LLM if chatAPI fails
                if (this.llmHandler) {
                    logger.info('Using LLM fallback for chat request');

                    const response = await this.llmHandler.generateResponse(
                        prompt,
                        "", // No context in fallback mode
                        "I'm an AI assistant. How can I help you today?"
                    );

                    res.json({
                        response,
                        conversationId: null,
                        fallback: true
                    });
                } else {
                    throw apiError;
                }
            }
        } catch (error) {
            logger.error('Chat error:', error);
            res.status(500).json({
                error: 'Chat request failed',
                message: error.message
            });
        }
    }

    /**
     * Perform embedding search to find relevant content
     * @param {string} query - The search query
     * @param {number} limit - Maximum number of results to return (default: 3)
     * @param {number} threshold - Similarity threshold (default: 0.6)
     * @returns {Promise<Array>} - Array of search results with content and scores
     */
    async performEmbeddingSearch(query, limit = 3, threshold = 0.6) {
        try {
            logger.info(`Performing embedding search for: "${query.slice(0, 30)}..."`);

            // Check if search service is available
            if (!this.searchService) {
                logger.warn('Search service not available for embedding search');
                return []; // Return empty array if search service is not available
            }

            // Use the search service to find relevant content
            const results = await this.searchService.search(query, limit, threshold);

            // Return formatted results
            return results.map(result => ({
                title: result.title || '',
                content: result.content || '',
                type: result.type || 'unknown',
                score: result.score || 0
            }));
        } catch (error) {
            logger.error('Embedding search error:', error);
            return []; // Return empty array on error
        }
    }

    /**
     * Handle streaming chat API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleChatStream(req, res) {
        try {
            // Validate request
            const {
                prompt,
                conversationId,
                useMemory,
                temperature,
                useSearchInterjection,
                providerId
            } = req.body;

            if (!prompt) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Prompt is required'
                });
            }

            logger.info(`Chat stream request with prompt: "${prompt.slice(0, 30)}..."`);

            // Set up SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            try {
                // Optionally enrich the prompt with search results if requested
                let enrichedPrompt = prompt;
                let searchResults = [];

                // If search interjection is requested, find relevant content
                if (useSearchInterjection) {
                    try {
                        logger.info('Searching for relevant content to interject...');

                        // Send event about searching
                        res.write(`data: ${JSON.stringify({ info: "Searching for relevant content..." })}\n\n`);

                        searchResults = await this.performEmbeddingSearch(prompt);

                        if (searchResults && searchResults.length > 0) {
                            // Format search results as context
                            const contextBlocks = searchResults.map((result, index) =>
                                `[DOCUMENT ${index + 1}]\nTitle: ${result.title || 'Untitled'}\nContent: ${result.content}\nScore: ${result.score}\n`
                            ).join('\n');

                            // Append context to prompt with instructions
                            enrichedPrompt = `I found some relevant information that might help answer your question. Please consider this information when formulating your response:

${contextBlocks}

Based on the above information and your knowledge, here is the user's question: ${prompt}`;

                            logger.info(`Enriched prompt with ${searchResults.length} search results`);

                            // Send event about found results
                            res.write(`data: ${JSON.stringify({
                                info: `Found ${searchResults.length} relevant documents`,
                                searchResults: searchResults.map(r => ({
                                    title: r.title || 'Untitled',
                                    snippet: r.content.substring(0, 150) + (r.content.length > 150 ? '...' : ''),
                                    score: r.score
                                }))
                            })}\n\n`);
                        } else {
                            res.write(`data: ${JSON.stringify({ info: "No relevant content found, using general knowledge" })}\n\n`);
                        }
                    } catch (searchError) {
                        logger.warn('Failed to enrich prompt with search results:', searchError);
                        // Continue with original prompt if search fails
                        res.write(`data: ${JSON.stringify({ info: "Search failed, using general knowledge" })}\n\n`);
                    }
                }

                // Get the selected provider or use the default
                const selectedProvider = this.chatProviders?.find(p => p.id === providerId) || this.chatProviders?.[0];

                if (!selectedProvider) {
                    throw new Error('No chat provider available');
                }

                logger.info(`Using provider: ${selectedProvider.type}${selectedProvider.implementation ? ` (${selectedProvider.implementation})` : ''}`);

                // Create chat API with selected provider
                const chatAPI = this.createChatAPI(selectedProvider, selectedProvider.chatModel);

                // Send event that we're generating a response
                res.write(`data: ${JSON.stringify({ info: "Generating response..." })}\n\n`);

                // Generate streaming response
                const stream = await chatAPI.executeOperation('stream', {
                    prompt: enrichedPrompt, // Use the potentially enriched prompt
                    conversationId,
                    useMemory: useMemory !== false,
                    temperature: temperature || 0.7
                });

                // Handle stream events
                stream.on('data', (data) => {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                });

                stream.on('error', (error) => {
                    logger.error('Chat stream error:', error);
                    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                    res.end();
                });

                stream.on('end', () => {
                    if (searchResults && searchResults.length > 0) {
                        // Send final message with sources
                        res.write(`data: ${JSON.stringify({
                            sources: searchResults.map(r => ({
                                title: r.title || 'Untitled',
                                snippet: r.content.substring(0, 150) + (r.content.length > 150 ? '...' : ''),
                                score: r.score
                            }))
                        })}\n\n`);
                    }

                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                });

                // Handle client disconnect
                req.on('close', () => {
                    stream.removeAllListeners();
                    res.end();
                });
            } catch (apiError) {
                logger.error('Chat API streaming error:', apiError);

                // Fallback: Use direct LLM if chatAPI fails and simulate streaming
                if (this.llmHandler) {
                    logger.info('Using LLM fallback for chat stream request');

                    // Use non-streaming response in fallback mode
                    try {
                        res.write(`data: ${JSON.stringify({ info: "Using fallback response generation..." })}\n\n`);

                        const response = await this.llmHandler.generateResponse(
                            prompt,
                            "", // No context in fallback mode
                            "I'm an AI assistant. How can I help you today?"
                        );

                        // Simulate streaming by sending the whole response at once
                        res.write(`data: ${JSON.stringify({ chunk: response })}\n\n`);
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                        res.end();
                    } catch (fallbackError) {
                        logger.error('Fallback LLM error:', fallbackError);
                        res.write(`data: ${JSON.stringify({ error: 'Fallback LLM failed: ' + fallbackError.message })}\n\n`);
                        res.end();
                    }
                } else {
                    res.write(`data: ${JSON.stringify({ error: 'Chat API unavailable: ' + apiError.message })}\n\n`);
                    res.end();
                }
            }
        } catch (error) {
            logger.error('Chat stream error:', error);
            // For non-SSE requests that error out before headers are sent
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Chat stream request failed',
                    message: error.message
                });
            } else {
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
        }
    }

    /**
     * Handle chat completion API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleChatCompletion(req, res) {
        try {
            // Validate request
            const {
                prompt,
                max_tokens,
                temperature,
                providerId
            } = req.body;

            if (!prompt) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Prompt is required'
                });
            }

            logger.info(`Chat completion request with prompt: "${prompt.slice(0, 30)}..."`);

            // Get the selected provider or use the default
            const selectedProvider = this.chatProviders?.find(p => p.id === providerId) || this.chatProviders?.[0];

            if (!selectedProvider) {
                throw new Error('No chat provider available');
            }

            logger.info(`Using provider: ${selectedProvider.type}${selectedProvider.implementation ? ` (${selectedProvider.implementation})` : ''}`);

            // Create chat API with selected provider
            const chatAPI = this.createChatAPI(selectedProvider, selectedProvider.chatModel);

            // Generate completion
            const result = await chatAPI.executeOperation('completion', {
                prompt,
                max_tokens: max_tokens || 100,
                temperature: temperature || 0.7
            });

            // Return response
            res.json(result);
        } catch (error) {
            logger.error('Chat completion error:', error);
            res.status(500).json({
                error: 'Chat completion request failed',
                message: error.message
            });
        }
    }

    /**
     * Handle memory store API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleMemoryStore(req, res) {
        try {
            // Validate request
            const { prompt, response, metadata } = req.body;

            if (!prompt || !response) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Both prompt and response are required'
                });
            }

            logger.info('Memory store request received');

            // Get memory manager
            const memoryManager = this.apiRegistry.get('memory');

            // Generate embedding and concepts
            const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
            const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);

            // Store in memory
            await memoryManager.addInteraction(prompt, response, embedding, concepts);

            // Return response
            res.json({
                id: memoryManager.memStore.shortTermMemory[memoryManager.memStore.shortTermMemory.length - 1].id,
                timestamp: Date.now(),
                concepts
            });
        } catch (error) {
            logger.error('Memory store error:', error);
            res.status(500).json({
                error: 'Memory store failed',
                message: error.message
            });
        }
    }

    /**
     * Handle memory search API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleMemorySearch(req, res) {
        try {
            // Get query parameters
            const query = req.query.query || '';
            const limit = parseInt(req.query.limit) || 5;
            const threshold = parseFloat(req.query.threshold) || 0.7;

            if (!query.trim()) {
                return res.json({ results: [] });
            }

            logger.info(`Memory search request for: "${query}" with threshold: ${threshold}`);

            // Get memory manager
            const memoryManager = this.apiRegistry.get('memory');

            // Retrieve memories
            const memories = await memoryManager.retrieveRelevantInteractions(query, threshold);

            // Limit results and format response
            const results = memories.slice(0, limit).map(memory => ({
                id: memory.interaction.id,
                prompt: memory.interaction.prompt,
                output: memory.interaction.output,
                score: memory.similarity,
                timestamp: memory.interaction.timestamp,
                concepts: memory.interaction.concepts
            }));

            res.json({ results });
        } catch (error) {
            logger.error('Memory search error:', error);
            res.status(500).json({
                error: 'Memory search failed',
                message: error.message
            });
        }
    }

    /**
     * Handle embedding generation API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleEmbedding(req, res) {
        try {
            // Validate request
            const { text, model } = req.body;

            if (!text) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Text is required'
                });
            }

            logger.info('Embedding generation request received');

            // Get memory manager
            const memoryManager = this.apiRegistry.get('memory');

            // Generate embedding
            const embedding = await memoryManager.generateEmbedding(text);

            // Return response
            res.json({
                embedding,
                dimension: embedding.length,
                model: model || memoryManager.embeddingModel
            });
        } catch (error) {
            logger.error('Embedding generation error:', error);
            res.status(500).json({
                error: 'Embedding generation failed',
                message: error.message
            });
        }
    }

    /**
     * Handle concept extraction API requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleConcepts(req, res) {
        try {
            // Validate request
            const { text } = req.body;

            if (!text) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Text is required'
                });
            }

            logger.info('Concept extraction request received');

            // Get memory manager
            const memoryManager = this.apiRegistry.get('memory');

            // Extract concepts
            const concepts = await memoryManager.extractConcepts(text);

            // Return response
            res.json({ concepts });
        } catch (error) {
            logger.error('Concept extraction error:', error);
            res.status(500).json({
                error: 'Concept extraction failed',
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

            // Initialize the search service with fallback capability
            logger.info('Initializing search service...');
            await this.initializeSearchServiceWithFallback();

            // Initialize LLM and chat features with fallback capability
            logger.info('Initializing LLM and chat features...');
            await this.initializeChatFeatures();

            // Start the Express server
            this.server = this.app.listen(this.port, () => {
                logger.info(`UI server running at http://localhost:${this.port}`);
            });
        } catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }

    /**
     * Initialize search service with fallback to alternative SPARQL endpoints if needed
     */
    async initializeSearchServiceWithFallback() {
        let lastError = null;

        // Try each SPARQL endpoint in order until one works
        for (let i = 0; i < this.sparqlEndpoints.length; i++) {
            const endpoint = this.sparqlEndpoints[i];

            try {
                logger.info(`Trying SPARQL endpoint ${i + 1}/${this.sparqlEndpoints.length}: ${endpoint.queryEndpoint}`);

                // If not the first endpoint, create a new SPARQL service with this endpoint
                if (i > 0) {
                    this.sparqlService = new SPARQLService({
                        queryEndpoint: endpoint.queryEndpoint,
                        updateEndpoint: endpoint.updateEndpoint,
                        graphName: this.graphName,
                        auth: endpoint.auth
                    });

                    // Update the search service with the new SPARQL service
                    this.searchService = new SearchService({
                        embeddingService: this.embeddingService,
                        sparqlService: this.sparqlService,
                        graphName: this.graphName
                    });
                }

                // Try to initialize with this endpoint
                await this.searchService.initialize();

                // If we get here, initialization succeeded
                logger.info(`Successfully connected to SPARQL endpoint: ${endpoint.queryEndpoint}`);
                return;
            } catch (error) {
                lastError = error;
                logger.warn(`Failed to connect to SPARQL endpoint ${endpoint.queryEndpoint}:`, error.message);
            }
        }

        // If we get here, all endpoints failed
        logger.warn(`All SPARQL endpoints failed, but continuing without search service. Last error:`, lastError?.message);
        // Don't throw error - allow server to start without SPARQL connectivity
        this.searchService = null;
    }

    /**
     * Initialize chat features and register API
     */
    async initializeChatFeatures() {
        try {
            // Try each LLM provider in priority order
            const availableProviders = await this.initializeLLMProvidersWithFallback();

            if (availableProviders.length === 0) {
                throw new Error('No LLM providers available. Unable to initialize chat features.');
            }

            // Select the best provider for each capability
            const chatProvider = this.chatProviders.find(p => p.type === 'claude') || this.chatProviders[0];
            const embeddingProvider = this.embeddingProviders.find(p => p.type === 'ollama') || this.embeddingProviders[0];

            if (!chatProvider) {
                logger.error('No chat provider available');
                throw new Error('No chat provider available. Unable to initialize chat features.');
            }

            if (!embeddingProvider) {
                logger.error('No embedding provider available');
                throw new Error('No embedding provider available. Unable to initialize memory features.');
            }

            logger.info(`Using ${chatProvider.type}${chatProvider.implementation ? ` (${chatProvider.implementation})` : ''} for chat`);
            logger.info(`Using ${embeddingProvider.type} for embeddings`);

            // Create memory manager for semantic memory with separate providers for different functions
            logger.info('Initializing memory manager...');
            this.memoryManager = new MemoryManager({
                llmProvider: chatProvider.connector,
                embeddingProvider: embeddingProvider.connector,
                chatModel: chatProvider.chatModel,
                embeddingModel: embeddingProvider.embeddingModel
            });

            // Create LLM handler for direct LLM requests
            logger.info('Initializing LLM handler...');
            this.llmHandler = new LLMHandler(
                chatProvider.connector,
                chatProvider.chatModel
            );

            // Create a custom registry for passing dependencies
            logger.info('Creating custom registry for chat API...');
            try {
                // Create a custom registry object instead of using APIRegistry
                const chatRegistry = {
                    get: (name) => {
                        if (name === 'memory') return this.memoryManager;
                        if (name === 'llm') return this.llmHandler;
                        throw new Error(`API ${name} not found`);
                    }
                };

                // Register only the chat API
                logger.info('Registering Chat API...');
                this.chatAPI = new ChatAPI({
                    registry: chatRegistry,
                    similarityThreshold: 0.7,
                    contextWindow: 5
                });

                // Initialize the chat API
                await this.chatAPI.initialize();

                // Store in apiRegistry (not using register method)
                this.apiRegistry.apis = this.apiRegistry.apis || new Map();
                this.apiRegistry.apis.set('chat', this.chatAPI);

                // Store all available providers for later use
                this.availableLLMProviders = availableProviders;

                logger.info('Chat features initialized successfully');
            } catch (error) {
                logger.error('Failed to initialize chat API:', error);
                throw error;
            }
        } catch (error) {
            logger.error('Failed to initialize chat features:', error);
            throw error;
        }
    }

    /**
     * Handle listing available providers
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleListProviders(req, res) {
        try {
            // Ensure providers are initialized by checking chatProviders
            if (!this.chatProviders || this.chatProviders.length === 0) {
                logger.warn('No chat providers available, trying to initialize...');
                await this.initializeLLMProvidersWithFallback();

                if (!this.chatProviders || this.chatProviders.length === 0) {
                    logger.warn('Still no chat providers available after initialization');
                    return res.json({ providers: [] });
                }
            }

            // Define available models for each provider type
            const providerModels = {
                'mistral': ['mistral-medium', 'mistral-small', 'mistral-tiny'],
                'claude': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
                'ollama': ['llama3', 'mistral', 'mixtral', 'qwen2:1.5b'],
                'openai': ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
            };

            // Use initialized chatProviders instead of raw llmProviders
            const providers = this.chatProviders.map(p => {
                const models = providerModels[p.type] || [p.chatModel || 'default'];

                // Add MCP capability if available (for now, mark all as MCP-capable for demo)
                const capabilities = p.capabilities || [];

                // Check if MCP server is running and add MCP capability
                const hasMCPSupport = true; // All providers can potentially use MCP tools
                if (hasMCPSupport && !capabilities.includes('mcp')) {
                    capabilities.push('mcp');
                }

                return {
                    id: p.id,  // Use the actual provider ID from chatProviders
                    type: p.type,
                    name: `${p.type}${p.implementation ? ` (${p.implementation})` : ''}`,
                    model: p.chatModel || 'default',
                    models: models,  // Include available models
                    capabilities: capabilities,
                    implementation: p.implementation || 'default',
                    mcpSupported: hasMCPSupport,
                    isInitialized: !!p.connector // Show if the provider has a working connector
                };
            });

            logger.info(`Returning ${providers.length} available chat providers`);
            res.json({ providers });
        } catch (error) {
            logger.error('Error listing providers:', error);
            res.status(500).json({
                error: 'Failed to list providers',
                message: error.message
            });
        }
    }

    /**
     * Create a chat API instance with the specified provider
     * @param {Object} provider - The provider configuration
     * @param {string} model - The model to use
     * @returns {Promise<Object>} Configured ChatAPI instance
     */
    async createChatAPI(provider, model) {
        if (!provider.connector) {
            throw new Error(`Provider ${provider.type} has no connector`);
        }

        // Ensure the provider's connector is initialized
        try {
            await provider.connector.initialize();
            logger.debug(`Successfully initialized ${provider.type} connector`);
        } catch (error) {
            logger.error(`Failed to initialize ${provider.type} connector:`, error);
            throw new Error(`Failed to initialize ${provider.type} provider: ${error.message}`);
        }

        // Verify the connector is properly initialized
        if (!provider.connector.client) {
            throw new Error(`${provider.type} connector client is not initialized`);
        }

        try {
            const memoryManager = new MemoryManager({
                llmProvider: provider.connector,
                chatModel: model || provider.chatModel,
                embeddingProvider: this.embeddingProviders[0]?.connector,
                embeddingModel: this.embeddingProviders[0]?.embeddingModel
            });

            const llmHandler = new LLMHandler(provider.connector, model || provider.chatModel);

            const registry = {
                get: (name) => {
                    if (name === 'memory') return memoryManager;
                    if (name === 'llm') return llmHandler;
                    throw new Error(`API ${name} not found`);
                }
            };

            return new ChatAPI({
                registry,
                similarityThreshold: 0.7,
                contextWindow: 5
            });
        } catch (error) {
            logger.error(`Error creating chat API for ${provider.type}:`, error);
            throw new Error(`Failed to create chat API: ${error.message}`);
        }
    }

    async initializeLLMProvidersWithFallback() {
        const availableProviders = [];
        const embeddingProviders = [];
        const chatProviders = [];
        let providerCounter = 0;

        // Try each provider and categorize them based on capabilities
        const sortedProviders = [...this.llmProviders].sort((a, b) => a.priority - b.priority);

        for (const provider of sortedProviders) {
            try {
                logger.info(`Trying LLM provider: ${provider.type}`);

                // Initialize the appropriate connector based on provider type
                let connector;

                switch (provider.type) {
                    case 'mistral':
                        if (!provider.apiKey) {
                            logger.warn('Skipping Mistral provider - no API key provided');
                            continue;
                        }
                        // Create and attach the connector to the provider
                        provider.connector = new MistralConnector(
                            provider.apiKey,
                            provider.baseUrl,
                            provider.chatModel
                        );
                        logger.info('Mistral AI connector created and attached to provider');
                        connector = provider.connector; // Set the local connector variable as well
                        break;

                    case 'ollama':
                        // Create and attach the connector to the provider
                        provider.connector = new OllamaConnector({
                            baseUrl: provider.baseUrl,
                            chatModel: provider.chatModel,
                            embeddingModel: provider.embeddingModel
                        });
                        logger.info('Ollama connector created and attached to provider');
                        connector = provider.connector; // Set the local connector variable as well
                        break;

                    case 'claude':
                        if (!provider.apiKey) {
                            logger.warn('Skipping Claude provider - no API key provided');
                            continue;
                        }

                        // Use hyperdata-clients implementation for Claude
                        provider.connector = new HClaudeClientConnector(
                            provider.apiKey,
                            provider.chatModel
                        );
                        logger.info('Claude connector created and attached to provider');
                        connector = provider.connector; // Set the local connector variable as well
                        break;

                    case 'openai':
                        // Placeholder for OpenAI connector - you'll need to implement or import this
                        if (!provider.apiKey) {
                            logger.warn('Skipping OpenAI provider - no API key provided');
                            continue;
                        }
                        // For now, we'll skip OpenAI since we don't have the connector implementation
                        logger.warn('OpenAI provider not yet implemented, skipping');
                        continue;

                    default:
                        logger.warn(`Unknown provider type: ${provider.type}, skipping`);
                        continue;
                }

                // Test the connector for chat capabilities
                try {
                    // Try a simple chat test if possible
                    if (typeof connector.generateChat === 'function') {
                        // Just check if the function exists, no need to actually call it
                        logger.info(`${provider.type} provider has chat capabilities`);

                        // Add to chat providers with unique ID
                        chatProviders.push({
                            ...provider,
                            id: `provider-${providerCounter}`,
                            connector,
                            capabilities: ['chat']
                        });
                        providerCounter++;
                    }
                } catch (chatError) {
                    logger.warn(`Provider ${provider.type} chat capability check failed:`, chatError.message);
                }

                // Test the connector for embedding capabilities
                try {
                    // Only test Ollama for embeddings
                    if (provider.type === 'ollama') {
                        await connector.generateEmbedding(
                            provider.embeddingModel,
                            'Test embedding generation'
                        );

                        logger.info(`${provider.type} provider has embedding capabilities`);

                        // Add to embedding providers with unique ID
                        embeddingProviders.push({
                            ...provider,
                            id: `provider-${providerCounter}`,
                            connector,
                            capabilities: ['embedding']
                        });
                        providerCounter++;
                    }
                } catch (embeddingError) {
                    logger.warn(`Provider ${provider.type} embedding test failed:`, embeddingError.message);
                }

                // Add to available providers if it has any capabilities
                if (
                    chatProviders.some(p => p.connector === connector) ||
                    embeddingProviders.some(p => p.connector === connector)
                ) {
                    // Determine capabilities
                    const capabilities = [];
                    if (chatProviders.some(p => p.connector === connector)) capabilities.push('chat');
                    if (embeddingProviders.some(p => p.connector === connector)) capabilities.push('embedding');

                    availableProviders.push({
                        ...provider,
                        connector,
                        capabilities
                    });

                    logger.info(`Successfully connected to ${provider.type} provider with capabilities: ${capabilities.join(', ')}`);
                }

            } catch (error) {
                logger.warn(`Failed to initialize ${provider.type} provider:`, error.message);
            }
        }

        // Log providers by capability
        logger.info(`Found ${chatProviders.length} providers with chat capabilities`);
        logger.info(`Found ${embeddingProviders.length} providers with embedding capabilities`);

        // Store providers by capability for easier access
        this.chatProviders = [...new Map(chatProviders.map(p => [p.id, p])).values()]; // Deduplicate
        this.embeddingProviders = [...new Map(embeddingProviders.map(p => [p.id, p])).values()]; // Deduplicate

        // Log available providers
        logger.info(`Available chat providers: ${this.chatProviders.map(p => `${p.type} (${p.id})`).join(', ')}`);
        logger.info(`Available embedding providers: ${this.embeddingProviders.map(p => `${p.type} (${p.id})`).join(', ')}`);

        return availableProviders;
    }

    /**
     * Transform SPARQL endpoints from Config.js format to UIServer format
     * @param {Array} endpoints - Array of endpoint configurations
     * @returns {Array} Transformed endpoints
     */
    transformEndpoints(endpoints) {
        if (!endpoints || !Array.isArray(endpoints)) {
            return null;
        }

        return endpoints.map(endpoint => {
            // If already in old format, return as-is
            if (endpoint.queryEndpoint && endpoint.updateEndpoint) {
                return endpoint;
            }

            // If in new Config.js format, transform it
            if (endpoint.urlBase && endpoint.query && endpoint.update) {
                return {
                    queryEndpoint: `${endpoint.urlBase}${endpoint.query}`,
                    updateEndpoint: `${endpoint.urlBase}${endpoint.update}`,
                    auth: {
                        user: endpoint.user || 'admin',
                        password: endpoint.password || 'admin'
                    },
                    label: endpoint.label || 'Config Endpoint',
                    dataset: endpoint.dataset
                };
            }

            // Fallback: try to construct from available properties
            console.warn('Unrecognized endpoint format:', endpoint);
            return endpoint;
        });
    }

    /**
     * Handle SPARQL endpoints listing
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlEndpoints(req, res) {
        try {
            // Return configured SPARQL endpoints
            const endpoints = this.sparqlEndpoints.map((endpoint, index) => ({
                id: `endpoint-${index}`,
                name: endpoint.label || `SPARQL Endpoint ${index + 1}`,
                label: endpoint.label || `SPARQL Endpoint ${index + 1}`,
                queryUrl: endpoint.queryEndpoint,
                queryEndpoint: endpoint.queryEndpoint, // For backward compatibility
                updateUrl: endpoint.updateEndpoint,
                updateEndpoint: endpoint.updateEndpoint, // For backward compatibility
                defaultGraph: this.graphName,
                dataset: endpoint.dataset,
                auth: endpoint.auth ? { username: endpoint.auth.user } : null // Don't expose password
            }));

            res.json({ endpoints });
        } catch (error) {
            logger.error('Error listing SPARQL endpoints:', error);
            res.status(500).json({
                error: 'Failed to list SPARQL endpoints',
                message: error.message
            });
        }
    }

    /**
     * Handle SPARQL SELECT queries
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlQuery(req, res) {
        try {
            const { query, endpoint, limit } = req.body;

            if (!query) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'SPARQL query is required'
                });
            }

            logger.info(`Executing SPARQL query: ${query.substring(0, 100)}...`);

            // Use provided endpoint or default to the first configured one
            const targetEndpoint = endpoint || this.sparqlService.queryEndpoint;

            // Apply limit if requested
            let finalQuery = query;
            if (limit && !query.toUpperCase().includes('LIMIT')) {
                finalQuery += ` LIMIT ${limit}`;
            }

            const results = await this.sparqlService.executeQuery(finalQuery);

            logger.info('SPARQL query executed successfully');
            res.json(results);
        } catch (error) {
            logger.error('SPARQL query error:', error);
            res.status(500).json({
                error: 'SPARQL query failed',
                message: error.message
            });
        }
    }

    /**
     * Handle SPARQL CONSTRUCT queries
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlConstruct(req, res) {
        try {
            const { query, endpoint, format = 'turtle' } = req.body;

            if (!query) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'SPARQL CONSTRUCT query is required'
                });
            }

            logger.info(`Executing SPARQL CONSTRUCT query: ${query.substring(0, 100)}...`);

            // Use provided endpoint or default to the first configured one
            const targetEndpoint = endpoint || this.sparqlService.queryEndpoint;

            // Execute CONSTRUCT query - this should return RDF data
            const results = await this.sparqlService.executeQuery(query);

            // For CONSTRUCT queries, we want to return the RDF data as text
            // The format depends on the SPARQL service implementation
            let rdfData;
            if (typeof results === 'string') {
                rdfData = results;
            } else if (results.results && results.results.bindings) {
                // Convert results to simple Turtle format
                rdfData = this.convertBindingsToTurtle(results.results.bindings);
            } else {
                rdfData = '';
            }

            // Analyze RDF data to extract graph information for visualization
            const graphInfo = this.analyzeRdfForVisualization(rdfData, results);

            logger.info('SPARQL CONSTRUCT query executed successfully');

            // Return JSON response with RDF data and metadata for frontend
            res.json({
                success: true,
                query: query,
                endpoint: targetEndpoint,
                rdf: {
                    data: rdfData,
                    format: format,
                    size: rdfData.length,
                    encoding: 'utf-8'
                },
                graph: {
                    nodes: graphInfo.nodes,
                    edges: graphInfo.edges,
                    nodeCount: graphInfo.nodeCount,
                    edgeCount: graphInfo.edgeCount,
                    namespaces: graphInfo.namespaces
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    executionTime: Date.now() - req.startTime || 0,
                    queryType: 'CONSTRUCT',
                    resultFormat: format
                },
                events: {
                    // Event bus configuration for frontend
                    triggerTurtleEditor: {
                        type: 'rdf-data-loaded',
                        data: {
                            content: rdfData,
                            format: format,
                            source: 'sparql-construct'
                        }
                    },
                    triggerGraphVisualization: {
                        type: 'graph-data-updated',
                        data: {
                            nodes: graphInfo.nodes,
                            edges: graphInfo.edges,
                            layout: 'force-directed',
                            source: 'sparql-construct'
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('SPARQL CONSTRUCT query error:', error);
            res.status(500).json({
                success: false,
                error: 'SPARQL CONSTRUCT query failed',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle RDF validation requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlValidate(req, res) {
        try {
            const { content, format } = req.body;

            if (!content) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'RDF content is required'
                });
            }

            logger.info('Validating RDF content...');

            // Simple validation - in a real implementation, you'd use an RDF parser
            let valid = true;
            let errors = [];

            try {
                // Basic syntax checks for Turtle format
                if (format === 'turtle' || !format) {
                    // Check for basic Turtle syntax
                    if (!content.includes('.') && !content.includes(';')) {
                        valid = false;
                        errors.push('Missing statement terminators (. or ;)');
                    }

                    // Check for balanced angle brackets
                    const openBrackets = (content.match(/</g) || []).length;
                    const closeBrackets = (content.match(/>/g) || []).length;
                    if (openBrackets !== closeBrackets) {
                        valid = false;
                        errors.push('Unbalanced angle brackets in URIs');
                    }
                }
            } catch (parseError) {
                valid = false;
                errors.push(`Parse error: ${parseError.message}`);
            }

            res.json({
                valid,
                errors: valid ? [] : errors,
                format: format || 'turtle'
            });
        } catch (error) {
            logger.error('RDF validation error:', error);
            res.status(500).json({
                error: 'RDF validation failed',
                message: error.message
            });
        }
    }

    /**
     * Handle RDF insertion requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlInsert(req, res) {
        try {
            const { content, endpoint, graph, format } = req.body;

            if (!content) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'RDF content is required'
                });
            }

            logger.info('Inserting RDF data into SPARQL store...');

            // Use provided endpoint or default to the first configured one
            const targetEndpoint = endpoint || this.sparqlService.updateEndpoint;
            const targetGraph = graph || this.graphName;

            // Create SPARQL UPDATE query to insert the data
            const insertQuery = `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                
                INSERT DATA {
                    GRAPH <${targetGraph}> {
                        ${content}
                    }
                }
            `;

            // Execute the insert query
            await this.sparqlService.executeUpdate(insertQuery);

            logger.info('RDF data inserted successfully');
            res.json({
                success: true,
                message: 'RDF data inserted successfully',
                graph: targetGraph
            });
        } catch (error) {
            logger.error('RDF insertion error:', error);
            res.status(500).json({
                error: 'RDF insertion failed',
                message: error.message
            });
        }
    }

    /**
     * Handle SPARQL endpoint testing
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleSparqlTest(req, res) {
        try {
            const { endpoint } = req.body;

            if (!endpoint) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Endpoint URL is required'
                });
            }

            logger.info(`Testing SPARQL endpoint: ${endpoint}`);

            // Test with a simple ASK query
            const testQuery = 'ASK { ?s ?p ?o }';

            try {
                // Create a temporary SPARQL service for testing
                const testService = new (await import('../embeddings/SPARQLService.js')).default({
                    queryEndpoint: endpoint,
                    graphName: this.graphName
                });

                const result = await testService.executeQuery(testQuery);

                logger.info(`SPARQL endpoint test successful: ${endpoint}`);
                res.json({
                    success: true,
                    message: 'Endpoint is accessible',
                    endpoint: endpoint
                });
            } catch (testError) {
                logger.warn(`SPARQL endpoint test failed: ${endpoint} - ${testError.message}`);
                res.json({
                    success: false,
                    error: testError.message,
                    endpoint: endpoint
                });
            }
        } catch (error) {
            logger.error('SPARQL endpoint test error:', error);
            res.status(500).json({
                error: 'Endpoint test failed',
                message: error.message
            });
        }
    }

    /**
     * Analyze RDF data to extract graph information for visualization
     * @param {string} rdfData - RDF data in Turtle format
     * @param {Object} rawResults - Raw results from SPARQL service
     * @returns {Object} Graph information with nodes, edges, and metadata
     */
    analyzeRdfForVisualization(rdfData, rawResults) {
        const nodes = new Map();
        const edges = [];
        const namespaces = new Set();

        try {
            // Parse RDF data to extract graph structure
            const lines = rdfData.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('@prefix') || trimmedLine.startsWith('PREFIX')) {
                    // Extract namespace prefixes
                    const nsMatch = trimmedLine.match(/@prefix\s+(\w+):\s+<([^>]+)>/);
                    if (nsMatch) {
                        namespaces.add({
                            prefix: nsMatch[1],
                            uri: nsMatch[2]
                        });
                    }
                    return;
                }

                // Parse triple statements (basic implementation)
                const tripleMatch = trimmedLine.match(/(<[^>]+>|\w+:\w+)\s+(<[^>]+>|\w+:\w+)\s+(<[^>]+>|"[^"]*"|\w+:\w+)/);
                if (tripleMatch) {
                    const subject = tripleMatch[1];
                    const predicate = tripleMatch[2];
                    const object = tripleMatch[3];

                    // Add subject node
                    if (!nodes.has(subject)) {
                        nodes.set(subject, {
                            id: subject,
                            label: this.extractLabelFromUri(subject),
                            type: this.determineNodeType(subject),
                            uri: subject.startsWith('<') ? subject.slice(1, -1) : subject,
                            properties: {}
                        });
                    }

                    // Add object node if it's a URI (not a literal)
                    if (object.startsWith('<') || (object.includes(':') && !object.startsWith('"'))) {
                        if (!nodes.has(object)) {
                            nodes.set(object, {
                                id: object,
                                label: this.extractLabelFromUri(object),
                                type: this.determineNodeType(object),
                                uri: object.startsWith('<') ? object.slice(1, -1) : object,
                                properties: {}
                            });
                        }

                        // Add edge between subject and object
                        edges.push({
                            id: `edge-${edges.length}`,
                            source: subject,
                            target: object,
                            predicate: predicate,
                            label: this.extractLabelFromUri(predicate),
                            uri: predicate.startsWith('<') ? predicate.slice(1, -1) : predicate
                        });
                    } else {
                        // Add literal value as property
                        const subjectNode = nodes.get(subject);
                        if (subjectNode) {
                            const propertyName = this.extractLabelFromUri(predicate);
                            subjectNode.properties[propertyName] = object.startsWith('"') ?
                                object.slice(1, -1) : object;
                        }
                    }
                }
            });
        } catch (parseError) {
            logger.warn('Error parsing RDF for visualization:', parseError);
        }

        // Convert Maps to Arrays for JSON serialization
        const nodeArray = Array.from(nodes.values());
        const namespaceArray = Array.from(namespaces);

        return {
            nodes: nodeArray,
            edges: edges,
            nodeCount: nodeArray.length,
            edgeCount: edges.length,
            namespaces: namespaceArray
        };
    }

    /**
     * Extract a readable label from a URI
     * @param {string} uri - The URI to extract label from
     * @returns {string} Readable label
     */
    extractLabelFromUri(uri) {
        if (!uri) return 'Unknown';

        // Remove angle brackets if present
        const cleanUri = uri.startsWith('<') ? uri.slice(1, -1) : uri;

        // Handle prefixed names
        if (cleanUri.includes(':') && !cleanUri.startsWith('http')) {
            return cleanUri.split(':').pop();
        }

        // Extract last part of URI path
        const parts = cleanUri.split(/[/#]/);
        const lastPart = parts[parts.length - 1];

        // Clean up the label
        return lastPart
            .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
            .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
            .trim()
            .toLowerCase()
            .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
    }

    /**
     * Determine node type based on URI patterns
     * @param {string} uri - The URI to analyze
     * @returns {string} Node type
     */
    determineNodeType(uri) {
        if (!uri) return 'unknown';

        const cleanUri = uri.startsWith('<') ? uri.slice(1, -1) : uri;

        // Common RDF/RDFS/OWL patterns
        if (cleanUri.includes('rdf-schema') || cleanUri.includes('rdfs')) return 'schema';
        if (cleanUri.includes('rdf-syntax') || cleanUri.includes('rdf#')) return 'rdf';
        if (cleanUri.includes('owl')) return 'ontology';
        if (cleanUri.includes('foaf')) return 'person';
        if (cleanUri.includes('dc') || cleanUri.includes('dublin')) return 'metadata';
        if (cleanUri.includes('skos')) return 'concept';

        // Ragno-specific patterns
        if (cleanUri.includes('ragno')) {
            if (cleanUri.includes('Entity')) return 'entity';
            if (cleanUri.includes('SemanticUnit')) return 'semantic-unit';
            if (cleanUri.includes('Relationship')) return 'relationship';
        }

        // Default classification
        if (cleanUri.includes('#type') || cleanUri.includes('type')) return 'type';
        if (cleanUri.includes('Class')) return 'class';
        if (cleanUri.includes('Property')) return 'property';

        return 'resource';
    }

    /**
     * Convert SPARQL bindings to simple Turtle format
     * @param {Array} bindings - SPARQL query bindings
     * @returns {string} Turtle-formatted RDF
     */
    convertBindingsToTurtle(bindings) {
        if (!bindings || bindings.length === 0) {
            return '';
        }

        const triples = bindings.map(binding => {
            const s = binding.s ? (binding.s.type === 'uri' ? `<${binding.s.value}>` : binding.s.value) : '';
            const p = binding.p ? (binding.p.type === 'uri' ? `<${binding.p.value}>` : binding.p.value) : '';
            const o = binding.o ? (
                binding.o.type === 'uri' ? `<${binding.o.value}>` :
                    binding.o.type === 'literal' ? `"${binding.o.value}"` :
                        binding.o.value
            ) : '';

            if (s && p && o) {
                return `${s} ${p} ${o} .`;
            }
            return '';
        }).filter(triple => triple);

        return triples.join('\n');
    }

    /**
     * Handle memory graph visualization requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleMemoryGraph(req, res) {
        try {
            const { limit = 50, threshold = 0.7 } = req.body;

            if (!this.chatAPI) {
                return res.status(503).json({
                    error: 'Memory system not available',
                    memories: [],
                    concepts: []
                });
            }

            // Get memory data from the memory manager
            const memoryManager = this.chatAPI.memoryManager;
            if (!memoryManager || !memoryManager.memStore) {
                return res.status(503).json({
                    error: 'Memory store not available',
                    memories: [],
                    concepts: []
                });
            }

            const memStore = memoryManager.memStore;

            // Get memories from both short-term and long-term memory
            const shortTermMemories = memStore.shortTermMemory || [];
            const longTermMemories = memStore.longTermMemory || [];
            const allMemories = [...shortTermMemories, ...longTermMemories];

            // Limit the number of memories
            const limitedMemories = allMemories.slice(0, parseInt(limit));

            // Extract concepts from memories
            const conceptMap = new Map();
            limitedMemories.forEach(memory => {
                const concepts = memory.concepts || [];
                concepts.forEach(concept => {
                    if (!conceptMap.has(concept)) {
                        conceptMap.set(concept, {
                            id: concept,
                            name: concept,
                            weight: 1,
                            memories: []
                        });
                    }
                    conceptMap.get(concept).memories.push(memory.id);
                    conceptMap.get(concept).weight += 1;
                });
            });

            const concepts = Array.from(conceptMap.values());

            // Format memories for graph visualization
            const formattedMemories = limitedMemories.map(memory => ({
                id: memory.id,
                prompt: memory.prompt || '',
                response: memory.output || memory.response || '',
                timestamp: memory.timestamp || Date.now(),
                concepts: memory.concepts || [],
                accessCount: memory.accessCount || 0,
                decayFactor: memory.decayFactor || 1.0,
                type: memory.type || (memory.prompt ? 'user' : 'assistant'),
                embedding: memory.embedding ? memory.embedding.slice(0, 10) : [] // First 10 dimensions for preview
            }));

            res.json({
                memories: formattedMemories,
                concepts: concepts,
                stats: {
                    totalMemories: allMemories.length,
                    shortTermCount: shortTermMemories.length,
                    longTermCount: longTermMemories.length,
                    conceptCount: concepts.length
                }
            });

        } catch (error) {
            console.error('Error in handleMemoryGraph:', error);
            res.status(500).json({
                error: 'Failed to generate memory graph data',
                memories: [],
                concepts: []
            });
        }
    }

    /**
     * Handle memory timeline visualization requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleMemoryTimeline(req, res) {
        try {
            const { period = 'week', grouping = 'day', showAccess = true } = req.body;

            if (!this.chatAPI || !this.chatAPI.memoryManager || !this.chatAPI.memoryManager.memStore) {
                return res.status(503).json({
                    error: 'Memory system not available',
                    timeline: []
                });
            }

            const memStore = this.chatAPI.memoryManager.memStore;
            const allMemories = [...(memStore.shortTermMemory || []), ...(memStore.longTermMemory || [])];

            // Calculate time range
            const now = new Date();
            let startTime;
            switch (period) {
                case 'day':
                    startTime = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                default: // 'all'
                    startTime = new Date(0);
            }

            // Filter memories by time range
            const filteredMemories = allMemories.filter(memory =>
                new Date(memory.timestamp) >= startTime
            );

            // Group memories by time period
            const timelineData = new Map();

            filteredMemories.forEach(memory => {
                const date = new Date(memory.timestamp);
                let groupKey;

                switch (grouping) {
                    case 'hour':
                        groupKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();
                        break;
                    case 'day':
                        groupKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
                        break;
                    case 'week':
                        const weekStart = new Date(date);
                        weekStart.setDate(date.getDate() - date.getDay());
                        groupKey = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).toISOString();
                        break;
                    case 'month':
                        groupKey = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
                        break;
                    default:
                        groupKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
                }

                if (!timelineData.has(groupKey)) {
                    timelineData.set(groupKey, {
                        date: new Date(groupKey),
                        memoryCount: 0,
                        accessCount: 0,
                        memories: []
                    });
                }

                const entry = timelineData.get(groupKey);
                entry.memoryCount += 1;
                entry.accessCount += memory.accessCount || 0;
                entry.memories.push({
                    id: memory.id,
                    prompt: memory.prompt || '',
                    timestamp: memory.timestamp
                });
            });

            // Convert to array and sort by date
            const timeline = Array.from(timelineData.values()).sort((a, b) => a.date - b.date);

            res.json({
                timeline: timeline,
                period: period,
                grouping: grouping,
                showAccess: showAccess,
                stats: {
                    totalPeriods: timeline.length,
                    totalMemories: filteredMemories.length,
                    avgMemoriesPerPeriod: timeline.length > 0 ? filteredMemories.length / timeline.length : 0
                }
            });

        } catch (error) {
            console.error('Error in handleMemoryTimeline:', error);
            res.status(500).json({
                error: 'Failed to generate timeline data',
                timeline: []
            });
        }
    }

    /**
     * Handle memory clusters visualization requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleMemoryClusters(req, res) {
        try {
            const { clusterCount = 5, method = 'kmeans' } = req.body;

            if (!this.chatAPI || !this.chatAPI.memoryManager || !this.chatAPI.memoryManager.memStore) {
                return res.status(503).json({
                    error: 'Memory system not available',
                    clusters: []
                });
            }

            const memStore = this.chatAPI.memoryManager.memStore;
            const allMemories = [...(memStore.shortTermMemory || []), ...(memStore.longTermMemory || [])];

            if (allMemories.length === 0) {
                return res.json({
                    clusters: [],
                    method: method,
                    stats: { totalClusters: 0, totalMemories: 0 }
                });
            }

            // Simple clustering based on concepts
            const clusters = [];
            const conceptClusters = new Map();

            // Group memories by their primary concepts
            allMemories.forEach(memory => {
                const concepts = memory.concepts || [];
                const primaryConcept = concepts.length > 0 ? concepts[0] : 'uncategorized';

                if (!conceptClusters.has(primaryConcept)) {
                    conceptClusters.set(primaryConcept, []);
                }
                conceptClusters.get(primaryConcept).push(memory);
            });

            // Convert to cluster format
            let clusterId = 0;
            for (const [concept, memories] of conceptClusters.entries()) {
                if (clusterId >= parseInt(clusterCount)) break;

                clusters.push({
                    id: clusterId,
                    label: `Cluster ${clusterId + 1}: ${concept}`,
                    concept: concept,
                    memories: memories.map(memory => ({
                        id: memory.id,
                        prompt: memory.prompt || '',
                        response: memory.output || memory.response || '',
                        timestamp: memory.timestamp,
                        similarity: Math.random() * 0.5 + 0.5 // Mock similarity for now
                    })),
                    centroid: [Math.random() * 100, Math.random() * 100], // Mock centroid
                    size: memories.length
                });
                clusterId++;
            }

            // Calculate statistics
            const stats = {
                totalClusters: clusters.length,
                totalMemories: allMemories.length,
                largestCluster: Math.max(...clusters.map(c => c.size), 0),
                smallestCluster: Math.min(...clusters.map(c => c.size), 0),
                avgClusterSize: clusters.length > 0 ? allMemories.length / clusters.length : 0
            };

            res.json({
                clusters: clusters,
                method: method,
                clusterCount: parseInt(clusterCount),
                stats: stats
            });

        } catch (error) {
            console.error('Error in handleMemoryClusters:', error);
            res.status(500).json({
                error: 'Failed to generate cluster data',
                clusters: []
            });
        }
    }

    /**
     * Handle advanced memory search requests
     * @param {Request} req - The Express request
     * @param {Response} res - The Express response
     */
    async handleAdvancedMemorySearch(req, res) {
        try {
            const {
                query = '',
                searchIn = ['prompt', 'response'],
                dateFrom = null,
                dateTo = null,
                accessCountMin = 0,
                similarityThreshold = 0.7,
                highFrequencyOnly = false,
                recentOnly = false
            } = req.body;

            if (!this.chatAPI || !this.chatAPI.memoryManager || !this.chatAPI.memoryManager.memStore) {
                return res.status(503).json({
                    error: 'Memory system not available',
                    results: [],
                    totalCount: 0
                });
            }

            const startTime = Date.now();
            const memStore = this.chatAPI.memoryManager.memStore;
            let allMemories = [...(memStore.shortTermMemory || []), ...(memStore.longTermMemory || [])];

            // Apply filters
            let filteredMemories = allMemories;

            // Date range filter
            if (dateFrom || dateTo) {
                const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
                const toDate = dateTo ? new Date(dateTo) : new Date();

                filteredMemories = filteredMemories.filter(memory => {
                    const memoryDate = new Date(memory.timestamp);
                    return memoryDate >= fromDate && memoryDate <= toDate;
                });
            }

            // Access count filter
            if (accessCountMin > 0) {
                filteredMemories = filteredMemories.filter(memory =>
                    (memory.accessCount || 0) >= accessCountMin
                );
            }

            // High frequency filter
            if (highFrequencyOnly) {
                const avgAccess = allMemories.reduce((sum, m) => sum + (m.accessCount || 0), 0) / allMemories.length;
                filteredMemories = filteredMemories.filter(memory =>
                    (memory.accessCount || 0) > avgAccess
                );
            }

            // Recent filter (last 24 hours)
            if (recentOnly) {
                const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
                filteredMemories = filteredMemories.filter(memory =>
                    memory.timestamp > dayAgo
                );
            }

            // Text search filter
            if (query) {
                const queryLower = query.toLowerCase();
                filteredMemories = filteredMemories.filter(memory => {
                    let matches = false;

                    if (searchIn.includes('prompt') && memory.prompt) {
                        matches = matches || memory.prompt.toLowerCase().includes(queryLower);
                    }

                    if (searchIn.includes('response') && (memory.output || memory.response)) {
                        const response = memory.output || memory.response;
                        matches = matches || response.toLowerCase().includes(queryLower);
                    }

                    if (searchIn.includes('concepts') && memory.concepts) {
                        matches = matches || memory.concepts.some(concept =>
                            concept.toLowerCase().includes(queryLower)
                        );
                    }

                    return matches;
                });
            }

            // Add similarity scores (mock for now)
            const results = filteredMemories.map(memory => ({
                ...memory,
                score: Math.random() * 0.5 + 0.5, // Mock similarity score
                response: memory.output || memory.response || '' // Normalize response field
            }));

            // Sort by relevance (score) descending
            results.sort((a, b) => (b.score || 0) - (a.score || 0));

            const executionTime = Date.now() - startTime;

            res.json({
                results: results,
                totalCount: results.length,
                executionTime: executionTime,
                filters: {
                    query,
                    searchIn,
                    dateFrom,
                    dateTo,
                    accessCountMin,
                    similarityThreshold,
                    highFrequencyOnly,
                    recentOnly
                }
            });

        } catch (error) {
            console.error('Error in handleAdvancedMemorySearch:', error);
            res.status(500).json({
                error: 'Failed to execute advanced search',
                results: [],
                totalCount: 0
            });
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

export default UIServer;