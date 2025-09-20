#!/usr/bin/env node

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up paths and load environment variables with explicit path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Debug: Check if API keys are loaded
console.log('🔑 MISTRAL_API_KEY loaded:', process.env.MISTRAL_API_KEY ? 'YES' : 'NO');
console.log('🔑 CLAUDE_API_KEY loaded:', process.env.CLAUDE_API_KEY ? 'YES' : 'NO');

import { setupDefaultLogging } from '../utils/LoggingConfig.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import Config from '../Config.js';
import MemoryManager from '../MemoryManager.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import MistralConnector from '../connectors/MistralConnector.js';
import GroqConnector from '../connectors/GroqConnector.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import APIRegistry from '../api/common/APIRegistry.js';
import { workflowLoggerRegistry } from '../utils/WorkflowLogger.js';
// MIGRATION: InMemoryStore removed - using enhanced SPARQLStore exclusively
import { createAuthenticateRequest } from '../api/http/middleware/auth.js';
import { errorHandler, NotFoundError } from '../api/http/middleware/error.js';
import { requestLogger } from '../api/http/middleware/logging.js';
import MemoryAPI from '../api/features/MemoryAPI.js';
import ChatAPI from '../api/features/ChatAPI.js';
import SearchAPI from '../api/features/SearchAPI.js';
import RagnoAPI from '../api/features/RagnoAPI.js';
import ZptAPI from '../api/features/ZptAPI.js';
import VSOMAPI from '../api/features/VSOMAPI.js';
import UnifiedSearchAPI from '../api/features/UnifiedSearchAPI.js';
import WikidataAPI from '../api/features/WikidataAPI.js';
import WikipediaAPI from '../api/features/WikipediaAPI.js';
import DocumentAPI from '../api/features/DocumentAPI.js';


// Note: Logging is now configured in the APIServer constructor

// Use the already declared __dirname from above

/**
 * APIServer class that encapsulates the entire API server functionality
 */
class APIServer {
    constructor() {
        // Initialize logging first
        const loggers = setupDefaultLogging();
        this.logger = loggers.server;
        this.apiLogger = loggers.api;
        this.memoryLogger = loggers.memory;
        
        this.port = process.env.PORT || 4100; // Updated port to 4100
        this.publicDir = path.join(__dirname, 'public');
        this.distDir = path.join(__dirname, 'public/dist');
        this.app = express();
        this.server = null;
        this.apiContext = {};
        this.registry = new APIRegistry();
        
        this.logger.info('APIServer constructor initialized');
        this.initializeMiddleware();
    }

    /**
     * Initialize all middleware
     */
    initializeMiddleware() {
        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = uuidv4();
            next();
        });

        // Security and performance middleware
        this.app.use(helmet({
            contentSecurityPolicy: false // Disable for development
        }));

        this.app.use(cors({
            origin: '*', // For development
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));

        this.app.use(compression());
        this.app.use(express.json({ limit: '1mb' }));

        // File upload middleware
        const upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB limit
                files: 1 // Single file upload
            },
            fileFilter: (req, file, cb) => {
                const allowedMimeTypes = [
                    'application/pdf',
                    'text/html',
                    'text/plain',
                    'application/octet-stream'
                ];
                if (allowedMimeTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
                }
            }
        });
        this.upload = upload;

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests, please try again later.'
        });
        this.app.use('/api/', limiter);

        // Request logging (commented out for cleaner logs)
        // this.app.use(requestLogger(this.logger));
    }

    /**
     * Initialize API components
     */
    async initializeComponents() {
        // Load configuration from config.json explicitly
        const configPath = path.join(projectRoot, 'config/config.json');
        this.config = new Config(configPath);
        await this.config.init();
        
        // Create config-aware authentication middleware
        this.authenticateRequest = createAuthenticateRequest(this.config);
        
        // Use new configuration-driven provider selection (like MCP server)
        this.logger.info('Creating providers using configuration-driven selection...');
        
        // Create LLM connector for chat operations
        const llmProvider = await this.createLLMConnector(this.config);
        
        // Create embedding connector for embedding operations  
        const embeddingProvider = await this.createEmbeddingConnector(this.config);
        
        // Get model configuration
        const modelConfig = await this.getModelConfig(this.config);
        this.logger.info('Using model configuration:', modelConfig);
        
        // Get embedding dimension from the embedding provider configuration
        const llmProviders = this.config.get('llmProviders') || [];
        const embeddingProviderConfig = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        const dimension = embeddingProviderConfig?.embeddingDimension;
        if (!dimension) {
            throw new Error('Embedding dimension not configured in config.json - check embeddingDimension in llmProviders');
        }

        // Store dimension for use in other methods
        this.embeddingDimension = dimension;

        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers
        const embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            dimension,
            cacheManager
        );

        const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

        // MIGRATION: Initialize enhanced SPARQLStore exclusively
        // Legacy JSON and InMemory storage are no longer supported
        const storageType = this.config.get('storage.type');
        this.logger.info(`💾 [STORAGE] Storage type: ${storageType}`);

        let storage;
        if (storageType === 'sparql') {
            this.logger.info('💾 [STORAGE] Importing Enhanced SPARQLStore...');
            const { default: SPARQLStore } = await import('../stores/SPARQLStore.js');

            const storageOptions = this.config.get('storage.options') || {};

            // Enhanced SPARQLStore configuration with in-memory capabilities
            const enhancedOptions = {
                ...storageOptions,
                dimension, // Pass embedding dimension for FAISS index
                enableResilience: true, // Enable retry and timeout features
                maxRetries: 3,
                timeoutMs: 30000,
                cacheTimeoutMs: 300000, // 5 minute cache timeout
                maxConceptsPerInteraction: 10,
                maxConnectionsPerEntity: 100
            };

            this.logger.info('💾 [STORAGE] Creating Enhanced SPARQLStore with in-memory capabilities:', {
                endpoint: storageOptions.endpoint || 'configured',
                dimension,
                features: ['FAISS indexing', 'Concept graphs', 'Memory classification', 'Semantic clustering']
            });

            storage = new SPARQLStore(storageOptions.endpoint || storageOptions, enhancedOptions, this.config);
            this.logger.info('✅ [STORAGE] Enhanced SPARQLStore created with unified memory + persistence');
        } else {
            // MIGRATION: No fallback to legacy storage - SPARQL is now required
            throw new Error(`Unsupported storage type: ${storageType}. Only 'sparql' storage is supported. Legacy 'json' and 'memory' storage have been removed in favor of enhanced SPARQLStore.`);
        }

        // Initialize memory manager with the configured storage
        const memoryManager = new MemoryManager({
            llmProvider,
            embeddingProvider,
            chatModel: modelConfig.chatModel,
            embeddingModel: modelConfig.embeddingModel,
            dimension,
            storage,
            config: this.config
        });

        // Store components in context
        this.apiContext = {
            memory: memoryManager,
            embedding: embeddingHandler,
            llm: llmHandler,
            storage: storage,
            sparqlStore: storage, // Alias for backwards compatibility
            search: memoryManager, // SearchAPI expects this for search functionality
            sparql: storage, // WikidataAPI expects this for SPARQL helper
            apis: {}
        };

        // Create API registry
        this.apiRegistry = {
            get: (key) => {
                if (key in this.apiContext) {
                    return this.apiContext[key];
                }
                if (key === 'apis') {
                    return this.apiContext.apis;
                }
                if (key === 'config') {
                    return this.config;
                }
                throw new Error(`Unknown component: ${key}`);
            }
        };

        return { memoryManager, embeddingHandler, llmHandler };
    }

    /**
     * Create LLM connector based on configuration priority
     */
    async createLLMConnector(config) {
        try {
            // Get llmProviders with priority ordering
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            this.logger.info('Available chat providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                this.logger.info(`Trying LLM provider: ${provider.type} (priority: ${provider.priority})`);
                
                if (provider.type === 'groq' && provider.apiKey) {
                    this.logger.info('✅ Creating Groq connector (highest priority)...');
                    return new GroqConnector(provider.apiKey);
                } else if (provider.type === 'mistral' && provider.apiKey) {
                    this.logger.info('✅ Creating Mistral connector...');
                    return new MistralConnector(provider.apiKey);
                } else if (provider.type === 'claude' && provider.apiKey) {
                    this.logger.info('✅ Creating Claude connector...');
                    return new ClaudeConnector(provider.apiKey);
                } else if (provider.type === 'ollama') {
                    this.logger.info('✅ Creating Ollama connector (fallback)...');
                    return new OllamaConnector();
                } else {
                    this.logger.info(`❌ Provider ${provider.type} not available (missing API key or implementation)`);
                }
            }
            
            this.logger.info('⚠️ No configured providers available, defaulting to Ollama');
            return new OllamaConnector();
            
        } catch (error) {
            this.logger.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
            return new OllamaConnector();
        }
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
     */
    async createEmbeddingConnector(config) {
        try {
            // Get llmProviders with priority ordering for embeddings
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            this.logger.info('Available embedding providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                this.logger.info(`Trying embedding provider: ${provider.type} (priority: ${provider.priority})`);
                
                if (provider.type === 'nomic' && provider.apiKey) {
                    this.logger.info('✅ Creating Nomic embedding connector (highest priority)...');
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'nomic',
                        apiKey: provider.apiKey,
                        model: provider.embeddingModel || 'nomic-embed-text-v1.5'
                    });
                } else if (provider.type === 'ollama') {
                    this.logger.info('✅ Creating Ollama embedding connector (fallback)...');
                    const ollamaBaseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'ollama',
                        baseUrl: ollamaBaseUrl,
                        model: provider.embeddingModel || 'nomic-embed-text'
                    });
                } else {
                    this.logger.info(`❌ Embedding provider ${provider.type} not available (missing API key or implementation)`);
                }
            }
            
            this.logger.info('⚠️ No configured embedding providers available, defaulting to Ollama');
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
            
        } catch (error) {
            this.logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            // Fallback to Ollama for embeddings
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
        }
    }

    /**
     * Get working model names from configuration
     */
    async getModelConfig(config) {
        try {
            // Get highest priority providers
            const llmProviders = config.get('llmProviders') || [];
            const chatProvider = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            const embeddingProvider = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            
            return {
                chatModel: chatProvider?.chatModel || 'qwen2:1.5b',
                embeddingModel: embeddingProvider?.embeddingModel || 'nomic-embed-text'
            };
        } catch (error) {
            this.logger.warn('Failed to get model config from configuration, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b',
                embeddingModel: 'nomic-embed-text'
            };
        }
    }

    /**
     * Initialize API endpoints
     */
    async initializeAPIs() {
        // Initialize Memory API
        const memoryApi = new MemoryAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            similarityThreshold: 0.7,
            defaultLimit: 10
        });
        await memoryApi.initialize();

        // Initialize Chat API
        const chatApi = new ChatAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            similarityThreshold: 0.7,
            contextWindow: 5
        });
        await chatApi.initialize();

        // Initialize Search API
        const searchApi = new SearchAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            similarityThreshold: 0.7,
            defaultLimit: 5
        });
        await searchApi.initialize();

        // Initialize Ragno API
        const ragnoApi = new RagnoAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            maxTextLength: 50000,
            maxBatchSize: 10,
            requestTimeout: 300000
        });
        await ragnoApi.initialize();

        // Initialize ZPT API
        const zptApi = new ZptAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            maxConcurrentRequests: 10,
            requestTimeoutMs: 120000,
            defaultMaxTokens: 4000
        });
        await zptApi.initialize();

        // Initialize VSOM API
        // Use the same dimension as already determined above
        const vsomApi = new VSOMAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            maxInstancesPerSession: 5,
            defaultMapSize: [20, 20],
            defaultEmbeddingDim: this.embeddingDimension
        });
        await vsomApi.initialize();

        // Get performance configuration
        const performanceConfig = this.config.get('performance') || {};
        const wikidataPerf = performanceConfig.wikidata || {};
        const wikipediaPerf = performanceConfig.wikipedia || {};
        
        // Initialize Wikidata API with performance config
        const wikidataApi = new WikidataAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            maxEntitiesPerConcept: wikidataPerf.maxEntitiesPerConcept || 3,
            maxSearchResults: wikidataPerf.maxWikidataSearchResults || 15,
            minConfidence: wikidataPerf.minConfidence || 0.4,
            requestTimeout: wikidataPerf.timeout || 30000,
            defaultGraphURI: 'http://purl.org/stuff/wikidata'
        });
        await wikidataApi.initialize();

        // Initialize Wikipedia API with performance config
        const wikipediaApi = new WikipediaAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            defaultLimit: wikipediaPerf.defaultLimit || 10,
            maxLimit: wikipediaPerf.maxLimit || 50,
            requestTimeout: wikipediaPerf.timeout || 30000,
            defaultGraphURI: 'http://purl.org/stuff/wikipedia'
        });
        await wikipediaApi.initialize();

        // Initialize Document API
        const documentApi = new DocumentAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            tempDir: '/tmp/semem-documents',
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedMimeTypes: ['application/pdf', 'text/html', 'text/plain', 'application/octet-stream']
        });
        await documentApi.initialize();

        // Store API handlers first
        this.apiContext.apis = {
            'memory-api': memoryApi,
            'chat-api': chatApi,
            'search-api': searchApi,
            'ragno-api': ragnoApi,
            'zpt-api': zptApi,
            'vsom-api': vsomApi,
            'wikidata-api': wikidataApi,
            'wikipedia-api': wikipediaApi,
            'document-api': documentApi
        };

        // Initialize Unified Search API (depends on other APIs being available)
        const unifiedSearchApi = new UnifiedSearchAPI({
            registry: this.apiRegistry,
            logger: this.logger,
            defaultLimit: 20,
            enableParallelSearch: true,
            enableResultRanking: true,
            searchTimeout: 30000
        });
        await unifiedSearchApi.initialize();

        // Update API handlers with unified search
        this.apiContext.apis['unified-search-api'] = unifiedSearchApi;

        return { memoryApi, chatApi, searchApi, ragnoApi, zptApi, vsomApi, wikidataApi, wikipediaApi, documentApi, unifiedSearchApi };
    }

    /**
     * Set up API routes
     */
    setupRoutes() {
        const apiRouter = express.Router();

        // Memory API routes
        apiRouter.post('/memory', this.authenticateRequest, this.createHandler('memory-api', 'store'));
        apiRouter.get('/memory/search', this.authenticateRequest, this.createHandler('memory-api', 'search'));
        apiRouter.post('/memory/embedding', this.authenticateRequest, this.createHandler('memory-api', 'embedding'));
        apiRouter.post('/memory/concepts', this.authenticateRequest, this.createHandler('memory-api', 'concepts'));

        // Chat API routes
        apiRouter.post('/chat', this.authenticateRequest, this.createHandler('chat-api', 'chat'));
        apiRouter.post('/chat/stream', this.authenticateRequest, this.createStreamHandler('chat-api', 'stream'));
        apiRouter.post('/completion', this.authenticateRequest, this.createHandler('chat-api', 'completion'));

        // Search API routes
        apiRouter.get('/search', this.authenticateRequest, this.createHandler('search-api', 'search'));
        apiRouter.post('/index', this.authenticateRequest, this.createHandler('search-api', 'index'));

        // Ragno API routes
        apiRouter.post('/graph/decompose', this.authenticateRequest, this.createHandler('ragno-api', 'decompose'));
        apiRouter.get('/graph/stats', this.authenticateRequest, this.createHandler('ragno-api', 'stats'));
        apiRouter.get('/graph/entities', this.authenticateRequest, this.createHandler('ragno-api', 'entities'));
        apiRouter.post('/graph/search', this.authenticateRequest, this.createHandler('ragno-api', 'search'));
        apiRouter.get('/graph/export/:format', this.authenticateRequest, this.createHandler('ragno-api', 'export'));
        apiRouter.post('/graph/enrich', this.authenticateRequest, this.createHandler('ragno-api', 'enrich'));
        apiRouter.get('/graph/communities', this.authenticateRequest, this.createHandler('ragno-api', 'communities'));
        apiRouter.post('/graph/pipeline', this.authenticateRequest, this.createHandler('ragno-api', 'pipeline'));

        // ZPT API routes
        apiRouter.post('/navigate', this.authenticateRequest, this.createHandler('zpt-api', 'navigate'));
        apiRouter.post('/navigate/preview', this.authenticateRequest, this.createHandler('zpt-api', 'preview'));
        apiRouter.get('/navigate/options', this.createHandler('zpt-api', 'options'));
        apiRouter.get('/navigate/schema', this.createHandler('zpt-api', 'schema'));
        apiRouter.get('/navigate/health', this.createHandler('zpt-api', 'health'));
        
        // ZPT Ontology Integration routes
        apiRouter.post('/navigate/convert-params', this.authenticateRequest, this.createHandler('zpt-api', 'convertParams'));
        apiRouter.post('/navigate/store-session', this.authenticateRequest, this.createHandler('zpt-api', 'storeSession'));
        apiRouter.get('/navigate/sessions', this.authenticateRequest, this.createHandler('zpt-api', 'getSessions'));
        apiRouter.get('/navigate/sessions/:sessionId', this.authenticateRequest, this.createHandler('zpt-api', 'getSession'));
        apiRouter.get('/navigate/views', this.authenticateRequest, this.createHandler('zpt-api', 'getViews'));
        apiRouter.get('/navigate/views/:viewId', this.authenticateRequest, this.createHandler('zpt-api', 'getView'));
        apiRouter.post('/navigate/analyze', this.authenticateRequest, this.createHandler('zpt-api', 'analyzeNavigation'));
        apiRouter.get('/navigate/ontology/terms', this.createHandler('zpt-api', 'getOntologyTerms'));
        apiRouter.post('/navigate/validate-ontology', this.createHandler('zpt-api', 'validateOntology'));

        // VSOM API routes
        apiRouter.post('/vsom/create', this.authenticateRequest, this.createHandler('vsom-api', 'create'));
        apiRouter.post('/vsom/load-data', this.authenticateRequest, this.createHandler('vsom-api', 'load-data'));
        apiRouter.post('/vsom/load-docqa', this.authenticateRequest, this.createHandler('vsom-api', 'load-docqa'));
        apiRouter.post('/vsom/generate-sample-data', this.authenticateRequest, this.createHandler('vsom-api', 'generate-sample-data'));
        apiRouter.post('/vsom/train', this.authenticateRequest, this.createHandler('vsom-api', 'train'));
        apiRouter.post('/vsom/stop-training', this.authenticateRequest, this.createHandler('vsom-api', 'stop-training'));
        apiRouter.get('/vsom/grid', this.authenticateRequest, this.createHandler('vsom-api', 'grid'));
        apiRouter.get('/vsom/features', this.authenticateRequest, this.createHandler('vsom-api', 'features'));
        apiRouter.post('/vsom/cluster', this.authenticateRequest, this.createHandler('vsom-api', 'cluster'));
        apiRouter.get('/vsom/training-status', this.authenticateRequest, this.createHandler('vsom-api', 'training-status'));
        apiRouter.get('/vsom/instances', this.authenticateRequest, this.createHandler('vsom-api', 'instances'));
        apiRouter.delete('/vsom/instances/:instanceId', this.authenticateRequest, this.createHandler('vsom-api', 'delete'));

        // Wikidata API routes
        apiRouter.post('/wikidata/research', this.authenticateRequest, this.createHandler('wikidata-api', 'research-concepts'));
        apiRouter.post('/wikidata/entity', this.authenticateRequest, this.createHandler('wikidata-api', 'entity-lookup'));
        apiRouter.get('/wikidata/search', this.authenticateRequest, this.createHandler('wikidata-api', 'entity-search'));
        apiRouter.post('/wikidata/sparql', this.authenticateRequest, this.createHandler('wikidata-api', 'sparql-query'));
        apiRouter.post('/wikidata/concepts', this.authenticateRequest, this.createHandler('wikidata-api', 'concept-discovery'));

        // Wikipedia API routes
        apiRouter.get('/wikipedia/search', this.authenticateRequest, this.createHandler('wikipedia-api', 'search'));
        apiRouter.get('/wikipedia/article', this.authenticateRequest, this.createHandler('wikipedia-api', 'article'));
        apiRouter.post('/wikipedia/batch-search', this.authenticateRequest, this.createHandler('wikipedia-api', 'batch-search'));
        apiRouter.post('/wikipedia/ingest', this.authenticateRequest, this.createHandler('wikipedia-api', 'ingest'));
        apiRouter.get('/wikipedia/categories', this.authenticateRequest, this.createHandler('wikipedia-api', 'categories'));

        // Document API routes
        apiRouter.post('/documents/upload', this.authenticateRequest, this.upload.single('file'), this.createDocumentHandler('document-api', 'upload'));
        apiRouter.post('/documents/convert', this.authenticateRequest, this.createHandler('document-api', 'convert'));
        apiRouter.post('/documents/chunk', this.authenticateRequest, this.createHandler('document-api', 'chunk'));
        apiRouter.post('/documents/ingest', this.authenticateRequest, this.createHandler('document-api', 'ingest'));
        apiRouter.get('/documents', this.authenticateRequest, this.createHandler('document-api', 'list'));
        apiRouter.get('/documents/:id', this.authenticateRequest, this.createHandler('document-api', 'get'));
        apiRouter.delete('/documents/:id', this.authenticateRequest, this.createHandler('document-api', 'delete'));
        apiRouter.get('/documents/:id/status', this.authenticateRequest, this.createHandler('document-api', 'status'));

        // Unified Search API routes
        apiRouter.post('/search/unified', this.authenticateRequest, this.createHandler('unified-search-api', 'unified'));
        apiRouter.post('/search/analyze', this.authenticateRequest, this.createHandler('unified-search-api', 'analyze'));
        apiRouter.get('/search/services', this.createHandler('unified-search-api', 'services'));
        apiRouter.get('/search/strategies', this.createHandler('unified-search-api', 'strategies'));

        // Workbench API routes (bridging to existing functionality)
        // TELL endpoint - bridges to memory API
        apiRouter.post('/tell', this.authenticateRequest, async (req, res, next) => {
            const startTime = Date.now();
            this.logger.info(`🔵 [API] POST /tell - Starting request`);

            try {
                const { content, type = 'interaction', lazy = false, metadata = {} } = req.body;

                if (!content) {
                    this.logger.warn(`🔴 [API] POST /tell - Error: Content is required`);
                    return res.status(400).json({
                        success: false,
                        error: 'Content is required'
                    });
                }

                // Create interaction object for memory storage
                const interaction = {
                    prompt: content,
                    response: `Stored ${type}`, // Simple response for storage
                    concepts: [], // Will be extracted by memory API
                    timestamp: Date.now(),
                    metadata: { ...metadata, type, lazy }
                };

                // Store using memory API
                const memoryApi = this.apiContext.apis['memory-api'];
                const result = await memoryApi.storeInteraction(interaction);

                const duration = Date.now() - startTime;
                this.logger.info(`🟢 [API] POST /tell - Success (${duration}ms)`);

                res.json({
                    success: true,
                    result,
                    message: 'Content stored successfully'
                });
            } catch (error) {
                const duration = Date.now() - startTime;
                this.logger.error(`🔴 [API] POST /tell - Error (${duration}ms):`, error.message);
                next(error);
            }
        });

        // ASK endpoint - bridges to unified search API
        apiRouter.post('/ask', this.authenticateRequest, async (req, res, next) => {
            const startTime = Date.now();
            this.logger.info(`🔵 [API] POST /ask - Starting request`);

            try {
                const {
                    question,
                    mode = 'standard',
                    useContext = true,
                    useHyDE = false,
                    useWikipedia = false,
                    useWikidata = false,
                    useWebSearch = false,
                    threshold = 0.1
                } = req.body;

                if (!question) {
                    this.logger.warn(`🔴 [API] POST /ask - Error: Question is required`);
                    return res.status(400).json({
                        success: false,
                        error: 'Question is required'
                    });
                }

                this.logger.info(`🔵 [API] POST /ask - Question: "${question.substring(0, 50)}..."`);

                // Use unified search API for comprehensive search
                const searchApi = this.apiContext.apis['unified-search-api'];
                const searchOptions = {
                    query: question,
                    threshold,
                    useContext,
                    enhancementOptions: {
                        useHyDE,
                        useWikipedia,
                        useWikidata,
                        useWebSearch
                    },
                    mode
                };

                const searchResult = await searchApi.unifiedSearch(searchOptions);

                const duration = Date.now() - startTime;
                this.logger.info(`🟢 [API] POST /ask - Success (${duration}ms) - ${searchResult.results?.length || 0} results`);

                // Format response for workbench
                res.json({
                    success: true,
                    answer: searchResult.answer || 'Based on the provided memory context, there is no specific information available about your question. The context does not mention relevant details. Therefore, I cannot provide an informed answer to your question. If you have any other questions or need information on a different topic, feel free to ask!',
                    results: searchResult.results || [],
                    context: searchResult.context || [],
                    metadata: {
                        mode,
                        searchDuration: searchResult.duration,
                        resultsCount: searchResult.results?.length || 0
                    }
                });
            } catch (error) {
                const duration = Date.now() - startTime;
                this.logger.error(`🔴 [API] POST /ask - Error (${duration}ms):`, error.message);
                next(error);
            }
        });

        // Real-time log streaming endpoint (SSE) - auth via query param for EventSource compatibility
        apiRouter.get('/logs/stream', (req, res) => {
            // Check authentication via query parameter since EventSource can't send custom headers
            const apiKey = req.query.api_key;
            if (!apiKey || apiKey !== process.env.SEMEM_API_KEY) {
                res.status(401).json({ error: 'Unauthorized - API key required' });
                return;
            }
            // Set up Server-Sent Events headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Send initial connection event
            res.write(`data: ${JSON.stringify({
                type: 'connection',
                message: 'Connected to workflow log stream',
                timestamp: new Date().toISOString(),
                serverId: process.pid
            })}\n\n`);

            // Use the global workflow logger registry
            workflowLoggerRegistry.addGlobalStream(res);

            // Handle client disconnect
            req.on('close', () => {
                workflowLoggerRegistry.removeGlobalStream(res);
            });

            // Send periodic heartbeat to keep connection alive
            const heartbeat = setInterval(() => {
                try {
                    res.write(`data: ${JSON.stringify({
                        type: 'heartbeat',
                        timestamp: new Date().toISOString()
                    })}\n\n`);
                } catch (error) {
                    clearInterval(heartbeat);
                }
            }, 30000); // Every 30 seconds

            // Clean up heartbeat on disconnect
            req.on('close', () => {
                clearInterval(heartbeat);
            });
        });

        // Service Discovery endpoint
        apiRouter.get('/services', (req, res) => {
            try {
                const services = {
                    basic: {
                        memory: {
                            name: 'Memory API',
                            description: 'Semantic memory management and retrieval',
                            endpoints: [
                                'POST /api/memory - Store interactions',
                                'GET /api/memory/search - Search memories',
                                'POST /api/memory/embedding - Generate embeddings',
                                'POST /api/memory/concepts - Extract concepts'
                            ],
                            status: this.apiContext.apis['memory-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        chat: {
                            name: 'Chat API', 
                            description: 'Conversational AI and completion',
                            endpoints: [
                                'POST /api/chat - Chat completion',
                                'POST /api/chat/stream - Streaming chat',
                                'POST /api/completion - Text completion'
                            ],
                            status: this.apiContext.apis['chat-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        search: {
                            name: 'Search API',
                            description: 'Content search and indexing',
                            endpoints: [
                                'GET /api/search - Search content',
                                'POST /api/index - Index content'
                            ],
                            status: this.apiContext.apis['search-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        document: {
                            name: 'Document API',
                            description: 'Document processing, conversion, chunking, and ingestion',
                            endpoints: [
                                'POST /api/documents/upload - Upload and process documents',
                                'POST /api/documents/convert - Convert documents to markdown',
                                'POST /api/documents/chunk - Chunk documents into semantic units',
                                'POST /api/documents/ingest - Ingest chunks into SPARQL store',
                                'GET /api/documents - List processed documents',
                                'GET /api/documents/{id} - Get document details',
                                'DELETE /api/documents/{id} - Delete document',
                                'GET /api/documents/{id}/status - Get processing status'
                            ],
                            status: this.apiContext.apis['document-api']?.initialized ? 'healthy' : 'unavailable'
                        }
                    },
                    advanced: {
                        ragno: {
                            name: 'Ragno Knowledge Graph API',
                            description: 'Knowledge graph operations and entity management',
                            endpoints: [
                                'POST /api/graph/decompose - Decompose text to entities',
                                'GET /api/graph/stats - Graph statistics',
                                'GET /api/graph/entities - Get entities',
                                'POST /api/graph/search - Search knowledge graph',
                                'GET /api/graph/export/{format} - Export graph data',
                                'POST /api/graph/enrich - Enrich graph with embeddings',
                                'GET /api/graph/communities - Get communities',
                                'POST /api/graph/pipeline - Full ragno pipeline'
                            ],
                            status: this.apiContext.apis['ragno-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        zpt: {
                            name: 'ZPT Navigation API',
                            description: 'Zero-Point Traversal corpus navigation with ontology integration',
                            endpoints: [
                                'POST /api/navigate - Main navigation',
                                'POST /api/navigate/preview - Navigation preview',
                                'GET /api/navigate/options - Navigation options',
                                'GET /api/navigate/schema - Parameter schema',
                                'GET /api/navigate/health - ZPT health check',
                                'POST /api/navigate/convert-params - Convert string params to URIs',
                                'POST /api/navigate/store-session - Store navigation session',
                                'GET /api/navigate/sessions - List navigation sessions',
                                'GET /api/navigate/sessions/{id} - Get navigation session',
                                'GET /api/navigate/views - List navigation views',
                                'GET /api/navigate/views/{id} - Get navigation view',
                                'POST /api/navigate/analyze - Analyze navigation patterns',
                                'GET /api/navigate/ontology/terms - Get ZPT ontology terms',
                                'POST /api/navigate/validate-ontology - Validate ontology parameters'
                            ],
                            status: this.apiContext.apis['zpt-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        vsom: {
                            name: 'VSOM Visualization API',
                            description: 'Vector Self-Organizing Map for knowledge graph visualization',
                            endpoints: [
                                'POST /api/vsom/create - Create SOM instance',
                                'POST /api/vsom/load-data - Load entity data',
                                'POST /api/vsom/load-docqa - Load Document-QA data',
                                'POST /api/vsom/generate-sample-data - Generate sample data',
                                'POST /api/vsom/train - Train SOM',
                                'POST /api/vsom/stop-training - Stop training',
                                'GET /api/vsom/grid - Get grid state',
                                'GET /api/vsom/features - Get feature maps',
                                'POST /api/vsom/cluster - Perform clustering',
                                'GET /api/vsom/training-status - Get training status',
                                'GET /api/vsom/instances - List instances',
                                'DELETE /api/vsom/instances/{id} - Delete instance'
                            ],
                            status: this.apiContext.apis['vsom-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        wikidata: {
                            name: 'Wikidata API',
                            description: 'Wikidata knowledge graph research and entity lookup',
                            endpoints: [
                                'POST /api/wikidata/research - Research concepts using Wikidata',
                                'POST /api/wikidata/entity - Look up specific entities',
                                'GET /api/wikidata/search - Search for entities',
                                'POST /api/wikidata/sparql - Execute SPARQL queries',
                                'POST /api/wikidata/concepts - Extract and research concepts from text'
                            ],
                            status: this.apiContext.apis['wikidata-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        wikipedia: {
                            name: 'Wikipedia API',
                            description: 'Wikipedia article search and content retrieval',
                            endpoints: [
                                'GET /api/wikipedia/search - Search Wikipedia articles',
                                'GET /api/wikipedia/article - Get specific articles',
                                'POST /api/wikipedia/batch-search - Batch search multiple queries',
                                'POST /api/wikipedia/ingest - Ingest articles to knowledge graph',
                                'GET /api/wikipedia/categories - Search by category'
                            ],
                            status: this.apiContext.apis['wikipedia-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        unified: {
                            name: 'Unified Search API',
                            description: 'Cross-service intelligent search',
                            endpoints: [
                                'POST /api/search/unified - Unified search across all services',
                                'POST /api/search/analyze - Analyze search query',
                                'GET /api/search/services - Get available services',
                                'GET /api/search/strategies - Get search strategies'
                            ],
                            status: this.apiContext.apis['unified-search-api']?.initialized ? 'healthy' : 'unavailable'
                        }
                    },
                    system: {
                        config: 'GET /api/config - Get system configuration',
                        health: 'GET /api/health - System health check',
                        metrics: 'GET /api/metrics - System metrics',
                        services: 'GET /api/services - This service discovery endpoint'
                    }
                };

                const summary = {
                    totalServices: Object.keys(services.basic).length + Object.keys(services.advanced).length,
                    healthyServices: Object.values({...services.basic, ...services.advanced})
                        .filter(service => service.status === 'healthy').length,
                    totalEndpoints: Object.values({...services.basic, ...services.advanced})
                        .reduce((total, service) => total + service.endpoints.length, 0) + 4 // system endpoints
                };

                res.json({
                    success: true,
                    summary,
                    services,
                    timestamp: new Date().toISOString(),
                    serverVersion: process.env.npm_package_version || '1.0.0'
                });
            } catch (error) {
                this.logger.error('Service discovery error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve service information'
                });
            }
        });

        // Config endpoint
        apiRouter.get('/config', (req, res) => {
            try {
                const config = Config.createFromFile();
                config.init().then(() => {
                    // Send sanitized config (no passwords)
                    const safeConfig = {
                        storage: {
                            availableTypes: ['memory', 'json', 'sparql', 'inmemory'],
                            current: config.get('storage.type') || 'memory'
                        },
                        models: {
                            chat: config.get('models.chat') || {},
                            embedding: config.get('models.embedding') || {}
                        },
                        sparqlEndpoints: (() => {
                            const endpoints = [];
                            
                            // Add endpoints from Config.js defaults (urlBase format)
                            const configEndpoints = config.get('sparqlEndpoints');
                            if (configEndpoints && configEndpoints.length > 0) {
                                configEndpoints.forEach(ep => {
                                    if (ep.urlBase) {
                                        endpoints.push({
                                            label: ep.label,
                                            urlBase: ep.urlBase,
                                            dataset: ep.dataset,
                                            queryEndpoint: `${ep.urlBase}${ep.query}`,
                                            updateEndpoint: `${ep.urlBase}${ep.update}`
                                        });
                                    }
                                });
                            }
                            
                            // Add endpoints from config.json (queryEndpoint format)
                            const fileEndpoints = config.config.sparqlEndpoints;
                            if (fileEndpoints && fileEndpoints.length > 0) {
                                fileEndpoints.forEach((ep, index) => {
                                    if (ep.queryEndpoint) {
                                        const urlBase = ep.queryEndpoint.replace('/semem/query', '');
                                        endpoints.push({
                                            label: `JSON Config Endpoint ${index + 1}`,
                                            urlBase: urlBase,
                                            dataset: 'semem',
                                            queryEndpoint: ep.queryEndpoint,
                                            updateEndpoint: ep.updateEndpoint,
                                            auth: ep.auth ? {
                                                user: ep.auth.user
                                            } : null
                                        });
                                    }
                                });
                            }
                            
                            return endpoints;
                        })(),
                        llmProviders: config.config.llmProviders ? 
                            config.config.llmProviders.map(p => ({
                                type: p.type,
                                implementation: p.implementation,
                                capabilities: p.capabilities,
                                description: p.description,
                                priority: p.priority,
                                chatModel: p.chatModel,
                                embeddingModel: p.embeddingModel
                            })) : [],
                        // Add top-level model defaults from file config
                        defaultChatModel: config.config.chatModel,
                        defaultEmbeddingModel: config.config.embeddingModel
                    };
                    
                    res.json({
                        success: true,
                        data: safeConfig
                    });
                }).catch(error => {
                    this.logger.error('Config initialization error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to load configuration'
                    });
                });
            } catch (error) {
                this.logger.error('Config endpoint error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        });

        // Health check endpoint
        apiRouter.get('/health', (req, res) => {
            const components = {
                memory: { status: 'healthy' },
                embedding: { status: 'healthy' },
                llm: { status: 'healthy' }
            };

            // Add API handlers status
            Object.entries(this.apiContext.apis).forEach(([name, api]) => {
                components[name] = {
                    status: api.initialized ? 'healthy' : 'degraded'
                };
            });

            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                components
            });
        });

        // Inspect endpoint for VSOM - returns session data with test interactions
        apiRouter.post('/inspect', (req, res) => {
            const { what = 'session', details = false } = req.body;

            // Create test interactions for VSOM visualization
            const testInteractions = [
                {
                    id: 'interaction_1',
                    type: 'tell',
                    content: 'The weather is sunny today and perfect for outdoor activities.',
                    prompt: 'The weather is sunny today and perfect for outdoor activities.',
                    response: 'Weather information stored successfully.',
                    concepts: ['weather', 'sunny', 'outdoor', 'activities'],
                    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
                    embedding: Array(1536).fill(0).map(() => Math.random() - 0.5)
                },
                {
                    id: 'interaction_2',
                    type: 'augment',
                    content: 'Machine learning algorithms are transforming various industries and applications.',
                    prompt: 'Machine learning algorithms are transforming various industries and applications.',
                    response: 'ML concepts analyzed and stored.',
                    concepts: ['machine-learning', 'algorithms', 'industries', 'applications', 'technology'],
                    timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
                    embedding: Array(1536).fill(0).map(() => Math.random() - 0.5)
                },
                {
                    id: 'interaction_3',
                    type: 'ask',
                    content: 'Quantum computing represents a paradigm shift in computational capabilities and problem solving.',
                    prompt: 'Quantum computing represents a paradigm shift in computational capabilities and problem solving.',
                    response: 'Quantum computing concepts stored.',
                    concepts: ['quantum-computing', 'paradigm-shift', 'computational', 'problem-solving'],
                    timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
                    embedding: Array(1536).fill(0).map(() => Math.random() - 0.5)
                }
            ];

            if (what === 'session') {
                const result = {
                    success: true,
                    verb: 'inspect',
                    what,
                    timestamp: new Date().toISOString(),
                    sessionAnalytics: {
                        overview: {
                            totalInteractions: testInteractions.length,
                            recentActivity: testInteractions.length,
                            memoryEfficiency: 0.85,
                            conceptDensity: 0.75,
                            avgResponseTime: 1200
                        },
                        interactions: testInteractions
                    }
                };

                if (details) {
                    result.detailedInteractions = testInteractions;
                }

                res.json(result);
            } else {
                res.status(400).json({
                    success: false,
                    error: `Unknown inspect type: ${what}`
                });
            }
        });

        // Metrics endpoint
        apiRouter.get('/metrics', this.authenticateRequest, async (req, res, next) => {
            try {
                const metrics = {
                    timestamp: Date.now(),
                    apiCount: Object.keys(this.apiContext.apis).length
                };

                // Get metrics from API handlers
                for (const [name, api] of Object.entries(this.apiContext.apis)) {
                    if (typeof api.getMetrics === 'function') {
                        metrics[name] = await api.getMetrics();
                    }
                }

                res.json({
                    success: true,
                    data: metrics
                });
            } catch (error) {
                this.logger.error('Error fetching metrics:', error);
                next(error);
            }
        });

        // Storage statistics endpoint - focused on SPARQL/RDF content
        apiRouter.get('/stats', async (req, res, next) => {
            try {
                const stats = {
                    timestamp: Date.now(),
                    lastUpdated: new Date().toISOString()
                };

                // Get SPARQL store statistics (main focus)
                if (this.apiContext.memory && this.apiContext.memory.storage) {
                    const storageType = this.apiContext.memory.storage.constructor.name;
                    stats.storage = { type: storageType };

                    if (storageType === 'SPARQLStore') {
                        const sparqlStats = await this.getSPARQLStatistics();
                        stats.sparql = sparqlStats;
                    }
                }

                // Get basic search index info if available
                try {
                    const searchService = this.apiContext.registry?.get('search');
                    if (searchService && searchService.index) {
                        stats.search = {
                            indexedItems: searchService.index.ntotal ? searchService.index.ntotal() : 0,
                            indexType: 'faiss',
                            dimension: searchService.dimension || this.embeddingDimension
                        };
                    }
                } catch (error) {
                    // Search service not available or no index
                    stats.search = { indexedItems: 0, available: false };
                }

                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                this.logger.error('Error fetching storage statistics:', error);
                next(error);
            }
        });

        // Mount API router
        this.app.use('/api', apiRouter);

        // Serve webpack-built static files
        this.logger.info(`Serving static files from: ${this.distDir}`);
        this.app.use(express.static(this.distDir));

        // Root route for web UI (webpack-built index.html)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.distDir, 'index.html'));
        });

        // Handle 404 errors
        this.app.use((req, res, next) => {
            next(new NotFoundError('Endpoint not found'));
        });

        // Error handling
        this.app.use(errorHandler(this.logger));
    }

    /**
     * Helper function to create route handlers
     */
    createHandler(apiName, operation) {
        return async (req, res, next) => {
            const requestId = uuidv4();
            this.apiLogger.info(`[${requestId}] Starting ${req.method} ${req.path} -> ${apiName}.${operation}`);
            
            try {
                const api = this.apiContext.apis[apiName];
                if (!api) {
                    this.apiLogger.error(`[${requestId}] API handler not found: ${apiName}`);
                    throw new Error(`API handler not found: ${apiName}`);
                }

                this.apiLogger.info(`[${requestId}] API handler found: ${apiName}, initialized: ${api.initialized}`);

                // Get parameters from appropriate source
                const params = req.method === 'GET' ? req.query : req.body;
                
                // Include route parameters if they exist
                if (req.params && Object.keys(req.params).length > 0) {
                    Object.assign(params, req.params);
                }

                // Detailed parameter logging (commented out for cleaner logs)
                // this.apiLogger.info(`[${requestId}] Parameters received:`, {
                //     method: req.method,
                //     params: params,
                //     paramKeys: Object.keys(params),
                //     query: req.query,
                //     body: req.body
                // });

                // Execute operation
                this.apiLogger.info(`[${requestId}] Executing ${apiName}.executeOperation('${operation}', params)`);
                const result = await api.executeOperation(operation, params);
                
                // this.apiLogger.info(`[${requestId}] Operation completed successfully, result type: ${typeof result}`);

                // Determine status code based on operation
                let statusCode = 200;
                if (operation === 'store' || operation === 'index') {
                    statusCode = 201; // Created
                }

                const response = {
                    success: true,
                    ...result
                };
                
                // this.apiLogger.info(`[${requestId}] Sending response with status ${statusCode}`);
                
                res.status(statusCode).json(response);
            } catch (error) {
                this.apiLogger.error(`[${requestId}] Error in ${apiName}.${operation}:`, {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                next(error);
            }
        };
    }

    /**
     * Helper function to create document upload handlers
     */
    createDocumentHandler(apiName, operation) {
        return async (req, res, next) => {
            const requestId = uuidv4();
            this.apiLogger.info(`[${requestId}] Starting ${req.method} ${req.path} -> ${apiName}.${operation} (file upload)`);
            
            try {
                const api = this.apiContext.apis[apiName];
                if (!api) {
                    this.apiLogger.error(`[${requestId}] API handler not found: ${apiName}`);
                    throw new Error(`API handler not found: ${apiName}`);
                }

                // Get parameters from body and route params
                const params = { ...req.body };
                
                // Include route parameters if they exist
                if (req.params && Object.keys(req.params).length > 0) {
                    Object.assign(params, req.params);
                }

                // Parse options if provided as JSON string
                if (params.options && typeof params.options === 'string') {
                    try {
                        params.options = JSON.parse(params.options);
                    } catch (error) {
                        this.apiLogger.warn(`[${requestId}] Failed to parse options JSON:`, error.message);
                    }
                }

                this.apiLogger.info(`[${requestId}] File upload info:`, {
                    hasFile: !!req.file,
                    filename: req.file?.originalname,
                    size: req.file?.size,
                    mimetype: req.file?.mimetype
                });

                // Execute operation with files
                this.apiLogger.info(`[${requestId}] Executing ${apiName}.executeOperation('${operation}', params, files)`);
                const result = await api.executeOperation(operation, params, { file: req.file });
                
                // Determine status code - uploads are created
                const statusCode = 201;

                const response = {
                    success: true,
                    ...result
                };
                
                this.apiLogger.info(`[${requestId}] Document operation completed successfully`);
                res.status(statusCode).json(response);
            } catch (error) {
                this.apiLogger.error(`[${requestId}] Error in ${apiName}.${operation}:`, {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                next(error);
            }
        };
    }

    /**
     * Helper function to create streaming route handlers
     */
    createStreamHandler(apiName, operation) {
        return async (req, res, next) => {
            try {
                const api = this.apiContext.apis[apiName];
                if (!api) {
                    throw new Error(`API handler not found: ${apiName}`);
                }

                // Set response headers for streaming
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // Execute streaming operation
                const stream = await api.executeOperation(operation, req.body);

                // Handle stream events
                stream.on('data', chunk => {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                });

                stream.on('end', () => {
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                });

                stream.on('error', error => {
                    this.logger.error(`Stream error in ${apiName}.${operation}:`, error);
                    next(error);
                });

                // Handle client disconnect
                req.on('close', () => {
                    if (typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });
            } catch (error) {
                this.logger.error(`Error in ${apiName}.${operation}:`, error);
                next(error);
            }
        };
    }

    /**
     * Setup signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        const shutdown = async (signal) => {
            this.logger.info(`Received ${signal}, shutting down...`);

            // Close the HTTP server
            if (this.server) {
                this.server.close(() => {
                    this.logger.info('HTTP server shut down');
                });
            }

            // Shutdown API handlers
            if (this.apiContext.apis) {
                for (const api of Object.values(this.apiContext.apis)) {
                    if (typeof api.shutdown === 'function') {
                        try {
                            await api.shutdown();
                        } catch (error) {
                            this.logger.error('Error shutting down API:', error);
                        }
                    }
                }
            }

            // Dispose memory manager if it exists
            if (this.apiContext.memory && typeof this.apiContext.memory.dispose === 'function') {
                try {
                    await this.apiContext.memory.dispose();
                    this.logger.info('Memory manager disposed');
                } catch (error) {
                    this.logger.error('Error disposing memory manager:', error);
                }
            }

            process.exit(0);
        };

        // Register signal handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Get SPARQL store statistics focusing on ragno: and zpt: vocabularies
     */
    async getSPARQLStatistics() {
        const stats = {};
        
        try {
            const sparqlStore = this.apiContext.memory.storage;
            const endpoint = sparqlStore.endpoint;
            
            if (!endpoint) {
                return { error: 'No SPARQL endpoint available' };
            }

            // SPARQL queries to get vocabulary-specific statistics
            const queries = {
                // Total triples
                totalTriples: `SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }`,
                
                // Named graphs
                namedGraphs: `SELECT (COUNT(DISTINCT ?g) as ?count) WHERE { GRAPH ?g { ?s ?p ?o } }`,
                
                // Ragno entities
                ragnoEntities: `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    SELECT (COUNT(DISTINCT ?entity) as ?count) 
                    WHERE { 
                        ?entity a ?type . 
                        FILTER(STRSTARTS(STR(?type), "http://purl.org/stuff/ragno/"))
                    }`,
                
                // Ragno relationships  
                ragnoRelationships: `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    SELECT (COUNT(DISTINCT ?rel) as ?count) 
                    WHERE { 
                        ?rel a ragno:Relationship 
                    }`,
                
                // ZPT navigation sessions
                zptNavigationSessions: `
                    PREFIX zpt: <http://purl.org/stuff/zpt/>
                    SELECT (COUNT(DISTINCT ?session) as ?count) 
                    WHERE { 
                        ?session a zpt:NavigationSession 
                    }`,
                
                // ZPT navigation views
                zptNavigationViews: `
                    PREFIX zpt: <http://purl.org/stuff/zpt/>
                    SELECT (COUNT(DISTINCT ?view) as ?count) 
                    WHERE { 
                        ?view a zpt:NavigationView 
                    }`,
                
                // Resources with embeddings
                resourcesWithEmbeddings: `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    SELECT (COUNT(DISTINCT ?resource) as ?count) 
                    WHERE { 
                        ?resource ragno:embedding ?embedding 
                    }`,
                
                // Memory items (conversations)
                memoryItems: `
                    PREFIX schema: <http://schema.org/>
                    SELECT (COUNT(DISTINCT ?item) as ?count) 
                    WHERE { 
                        ?item schema:text ?text 
                    }`
            };

            // Get credentials from config
            const storageOptions = this.config.get('storage.options');
            const credentials = storageOptions && storageOptions.user && storageOptions.password 
                ? { user: storageOptions.user, password: storageOptions.password }
                : null;

            // Execute queries
            for (const [key, query] of Object.entries(queries)) {
                try {
                    const result = await this.executeSPARQLQuery(endpoint, query, credentials);
                    if (result && result.results && result.results.bindings && result.results.bindings[0]) {
                        stats[key] = parseInt(result.results.bindings[0].count.value) || 0;
                    } else {
                        stats[key] = 0;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to get ${key} statistics:`, error.message);
                    stats[key] = 0;
                }
            }

            // Get recent activity (last 24 hours)
            try {
                const recentActivityQuery = `
                    PREFIX dcterms: <http://purl.org/dc/terms/>
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    SELECT ?type (COUNT(*) as ?count) (MAX(?created) as ?lastUpdated)
                    WHERE {
                        ?item a ?type ;
                              dcterms:created ?created .
                        FILTER(?created > "${new Date(Date.now() - 24*60*60*1000).toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime>)
                    }
                    GROUP BY ?type
                    ORDER BY DESC(?count)
                `;
                
                const activityResult = await this.executeSPARQLQuery(endpoint, recentActivityQuery, credentials);
                stats.recentActivity = [];
                
                if (activityResult && activityResult.results && activityResult.results.bindings) {
                    stats.recentActivity = activityResult.results.bindings.map(binding => ({
                        type: binding.type.value.split('/').pop(), // Get local name
                        count: parseInt(binding.count.value),
                        lastUpdated: binding.lastUpdated.value
                    }));
                }
            } catch (error) {
                this.logger.warn('Failed to get recent activity:', error.message);
                stats.recentActivity = [];
            }

        } catch (error) {
            this.logger.error('Error getting SPARQL statistics:', error);
            stats.error = error.message;
        }

        return stats;
    }

    /**
     * Execute a SPARQL query
     */
    async executeSPARQLQuery(endpoint, query, credentials = null) {
        const headers = {
            'Content-Type': 'application/sparql-query',
            'Accept': 'application/sparql-results+json'
        };

        // Add authentication header if credentials are provided
        if (credentials && credentials.user && credentials.password) {
            const auth = btoa(`${credentials.user}:${credentials.password}`);
            headers['Authorization'] = `Basic ${auth}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: query
        });

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Start the API server
     */
    async start() {
        try {
            this.logger.info('Initializing Semem API Server...');

            // Initialize components and APIs
            await this.initializeComponents();
            await this.initializeAPIs();

            // Set up routes
            await this.setupRoutes();

            // Set up signal handlers for graceful shutdown
            this.setupSignalHandlers();

            // Start the server
            this.server = this.app.listen(this.port, () => {
                this.logger.info(`Semem API Server is running at http://localhost:${this.port}`);
            });

            return this.server;
        } catch (error) {
            this.logger.error('Failed to start Semem API Server:', error);
            process.exit(1);
        }
    }
}

// Create and start the server
const apiServer = new APIServer();
apiServer.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});