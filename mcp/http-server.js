/**
 * Optimized MCP (Model Context Protocol) HTTP Server
 * Non-blocking initialization with lazy loading for better startup performance
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { mcpDebugger } from './lib/debug-utils.js';

// Load environment variables first, before any other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Debug: Check if API keys are loaded
mcpDebugger.info('🔑 MISTRAL_API_KEY loaded:', process.env.MISTRAL_API_KEY ? 'YES' : 'NO');
mcpDebugger.info('🔑 CLAUDE_API_KEY loaded:', process.env.CLAUDE_API_KEY ? 'YES' : 'NO');

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { randomUUID } from 'crypto';
import { createHttpTerminator } from 'http-terminator';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpConfig } from './lib/config.js';
import Config from '../src/Config.js';
import { PromptSynthesis } from './lib/PromptSynthesis.js';
import { SearchService } from '../src/services/SearchService.js';

mcpDebugger.info('🚀 HTTP SERVER: Starting script execution...');

// Initialize config to get port from config.json
let port = process.env.PORT || process.env.MCP_PORT || 3000;
try {
  const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json');
  const config = new Config(configPath);
  await config.init();
  port = process.env.PORT || process.env.MCP_PORT || config.get('servers.mcp') || config.get('port') || 3000;
  mcpDebugger.info(`🔧 HTTP SERVER: Using port ${port} from config`);
} catch (error) {
  mcpDebugger.warn('⚠️ HTTP SERVER: Could not load config, using default port:', error.message);
}

const app = express();
let httpTerminator = null;

mcpDebugger.info(`🚀 HTTP SERVER: Variables initialized, port: ${port}`);

// Server state management
let mcpServerInstance = null;
let isInitializing = false;
let initializationError = null;
let initializationPromise = null;
let isFullyInitialized = false;

/**
 * Create a minimal MCP server that can start immediately
 */
function createMinimalServer() {
  const server = new Server({
    name: mcpConfig.name || "semem-mcp-server",
    version: mcpConfig.version || "0.1.0",
    instructions: mcpConfig.instructions || "Semem MCP Server - Initializing...",
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  // Add a status tool to show initialization state
  server.tool("server_status", "Get server initialization status", {
    type: "object",
    properties: {}
  }, async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          initialized: mcpServerInstance !== null,
          initializing: isInitializing,
          error: initializationError?.message || null,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  });

  return server;
}

/**
 * Handle slash commands in chat
 */
async function handleChatCommand(command, simpleVerbsService) {
  const commandParts = command.split(' ');
  const cmd = commandParts[0].toLowerCase();
  const args = commandParts.slice(1).join(' ').trim();

  switch (cmd) {
    case '/help':
      return {
        success: true,
        messageType: 'help',
        content: `Available Commands:
/help          - Show this help message
/ask [query]   - Search your semantic memory for information
/tell [info]   - Store new information in your semantic memory

Examples:
/ask What did I learn about machine learning?
/tell The meeting is scheduled for tomorrow at 2pm

You can also chat naturally - I'll understand your intentions and route appropriately.`,
        timestamp: new Date().toISOString()
      };

    case '/ask':
      if (!args) {
        return {
          success: false,
          messageType: 'error',
          content: 'Please provide a question after /ask. Example: /ask What is machine learning?',
          timestamp: new Date().toISOString()
        };
      }
      
      try {
        await simpleVerbsService.initialize();
        const result = await simpleVerbsService.ask({ 
          question: args,
          mode: 'standard',
          useContext: true
        });
        
        return {
          success: true,
          messageType: 'ask_result',
          content: result.answer || 'No answer found for your question.',
          originalMessage: command,
          routing: 'ask_command',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          messageType: 'error',
          content: `Error processing ask command: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

    case '/tell':
      if (!args) {
        return {
          success: false,
          messageType: 'error',
          content: 'Please provide information after /tell. Example: /tell The project deadline is next Friday.',
          timestamp: new Date().toISOString()
        };
      }
      
      try {
        await simpleVerbsService.initialize();
        
        // Check if the content contains URLs or file paths for automatic routing to ingest
        const urlPattern = /https?:\/\/[^\s]+/gi;
        const hasUrls = urlPattern.test(args);
        
        // Check for file paths only after removing URLs to avoid conflicts
        const textWithoutUrls = args.replace(/https?:\/\/[^\s]+/gi, '');
        const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
        const hasFilePaths = filePathPattern.test(textWithoutUrls);
        
        // If URLs or file paths are detected, route to document processing
        if (hasUrls || hasFilePaths) {
          const urlPattern2 = /https?:\/\/[^\s]+/gi;
          const urls = args.match(urlPattern2) || [];
          const filePathPattern2 = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
          const filePaths = textWithoutUrls.match(filePathPattern2) || [];
          
          // For now, handle the first detected URL or file path
          const target = urls[0] || filePaths[0];
          
          if (target) {
            try {
              // Import DocumentProcessor for handling URLs/files
              const { DocumentProcessor } = await import('./tools/document-tools.js');
              const SPARQLHelper = (await import('../src/services/sparql/SPARQLHelper.js')).default;
              const Config = (await import('../src/Config.js')).default;
              
              // Initialize components  
              const config = new Config(process.env.SEMEM_CONFIG_PATH || 'config/config.json');
              await config.init();
              
              const storageConfig = config.get('storage.options');
              const sparqlHelper = new SPARQLHelper(storageConfig.update, {
                user: storageConfig.user,
                password: storageConfig.password
              });
              
              const processor = new DocumentProcessor(config, sparqlHelper, simpleVerbsService);
              
              // Determine if it's a URL or file path and process accordingly
              if (urls.length > 0) {
                // Process as URL
                const result = await processor.processUploadedDocument({
                  fileUrl: target,
                  filename: target.split('/').pop() || 'document',
                  mediaType: 'application/octet-stream',
                  documentType: 'url',
                  metadata: { 
                    source: 'chat_tell_command',
                    originalMessage: args,
                    detectionType: 'url'
                  }
                });
                
                return {
                  success: true,
                  messageType: 'tell_ingest_result',
                  content: `URL processed and content ingested: "${target}"`,
                  originalMessage: command,
                  routing: 'tell_ingest_url',
                  target: target,
                  processingResult: result,
                  timestamp: new Date().toISOString()
                };
              } else if (filePaths.length > 0) {
                // Process as file path
                const fs = await import('fs');
                const path = await import('path');
                
                // Check if file exists
                if (!fs.existsSync(target)) {
                  return {
                    success: false,
                    messageType: 'error',
                    content: `File not found: "${target}"`,
                    originalMessage: command,
                    routing: 'tell_ingest_error',
                    timestamp: new Date().toISOString()
                  };
                }
                
                // For file paths, we need to convert to a URL or handle differently
                // For now, store the file path information
                const result = await simpleVerbsService.tell({ 
                  content: `File reference: ${target}\nContext: ${args}`,
                  type: 'file_reference',
                  metadata: { 
                    source: 'chat_command', 
                    command: '/tell',
                    detectionType: 'file_path',
                    filePath: target,
                    originalMessage: args
                  }
                });
                
                return {
                  success: true,
                  messageType: 'tell_ingest_result',
                  content: `File path detected and referenced: "${target}"`,
                  originalMessage: command,
                  routing: 'tell_ingest_file',
                  target: target,
                  note: 'File path stored as reference. Use upload-document endpoint for full file processing.',
                  timestamp: new Date().toISOString()
                };
              }
            } catch (processingError) {
              // Fall back to regular tell if document processing fails
              mcpDebugger.warn('Document processing failed, falling back to regular tell:', processingError.message);
            }
          }
        }
        
        // Default behavior: regular tell command
        const result = await simpleVerbsService.tell({ 
          content: args,
          type: 'interaction',
          metadata: { source: 'chat_command', command: '/tell' }
        });
        
        return {
          success: true,
          messageType: 'tell_result',
          content: `Information stored successfully: "${args}"`,
          originalMessage: command,
          routing: 'tell_command',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          messageType: 'error',
          content: `Error storing information: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

    default:
      return {
        success: false,
        messageType: 'error',
        content: `Unknown command: ${cmd}. Type /help to see available commands.`,
        timestamp: new Date().toISOString()
      };
  }
}

/**
 * Lazy initialization of the full MCP server
 */
async function initializeFullServer() {
  if (isFullyInitialized || isInitializing) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationError = null;

  initializationPromise = (async () => {
    try {
      mcpDebugger.info('🔄 [FULL] Starting lazy initialization of full MCP server...');
      mcpDebugger.info('🔄 Starting lazy initialization of full MCP server...');
      
      // Dynamic import to avoid blocking
      mcpDebugger.info('📦 [FULL] Importing createServer from index.js...');
      const { createServer } = await import('./index.js');
      mcpDebugger.info('✅ [FULL] createServer imported successfully');
      
      // Initialize with timeout to prevent hanging
      mcpDebugger.info('⏰ [FULL] Setting up timeout promise (30s)...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Server initialization timeout (30s)')), 30000);
      });
      
      mcpDebugger.info('🏃 [FULL] Starting createServer() call...');
      const serverPromise = createServer();
      mcpDebugger.info('🏁 [FULL] Waiting for createServer() to complete...');
      const fullServer = await Promise.race([serverPromise, timeoutPromise]);
      mcpDebugger.info('✅ [FULL] createServer() completed successfully');
      
      // Store the full server instance (transport connections happen per-session)
      mcpServerInstance = fullServer;
      mcpDebugger.info('✅ [FULL] Full server set as instance (per-session transport connections)');
      mcpDebugger.info('✅ Full MCP server initialized (per-session transport)');
      
      isFullyInitialized = true;
      mcpDebugger.info('🎉 [FULL] Full server initialization completed!');
      return fullServer;
      
    } catch (error) {
      initializationError = error;
      mcpDebugger.error('❌ Failed to initialize full MCP server:', error.message);
      mcpDebugger.info('🔄 Continuing with minimal server...');
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Request handler that creates a new transport for each request
 */
async function handleMCPRequest(req, res, body, sessionTransports, sessionServers) {
  try {
    // Check for existing session ID (following reference pattern)
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionTransports.get(sessionId);

    if (sessionId && transport) {
      // Reuse existing transport for this session
      mcpDebugger.info(`🔄 [SESSION-${sessionId}] Reusing existing transport`);
    } else if (!sessionId) {
      // New initialization request (no session ID header)
      mcpDebugger.info('🔧 [INIT] New initialization request - creating server and transport...');
      
      // Create a new server instance for this session
      const { createServer } = await import('./index.js');
      const server = await createServer();
      mcpDebugger.info('✅ [INIT] Server created');
      
      // Create a new transport for this session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          mcpDebugger.info(`🔗 [INIT] Session initialized with ID: ${sid}`);
          sessionTransports.set(sid, transport);
          sessionServers.set(sid, server);
        }
      });
      
      // CRITICAL: Connect server to transport BEFORE handling request
      mcpDebugger.info('🔗 [INIT] Connecting server to transport...');
      await server.connect(transport);
      mcpDebugger.info('✅ [INIT] Server connected to transport');

      await transport.handleRequest(req, res, body);
      return; // Already handled
    } else {
      // Invalid request - session ID provided but no transport found
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Invalid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }
    
    // Handle the request with the session-specific transport
    await transport.handleRequest(req, res, body);
    
  } catch (error) {
    mcpDebugger.error('Error handling MCP request:', error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
}

async function startOptimizedServer() {
  try {
    mcpDebugger.info('🚀 [START] Starting Optimized MCP HTTP Server...');
    mcpDebugger.info('🚀 Starting Optimized MCP HTTP Server...');

    // Session management - we'll create transport instances per request
    mcpDebugger.info('🔧 [START] Setting up session management...');
    const sessionTransports = new Map();
    const sessionServers = new Map();
    
    mcpDebugger.info('✅ [START] Session management configured');
    
    // Server instances will be created per session automatically
    mcpDebugger.info('🔧 [START] Server instances will be created per session...');
    
    // Configure Express middleware
    mcpDebugger.info('🔧 [START] Configuring Express middleware...');
    app.use(cors());
    
    // Session middleware for tracking conversation context
    app.use(session({
      secret: process.env.SESSION_SECRET || 'semem-chat-session-' + randomUUID(),
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 1000 * 60 * 60 } // 1 hour
    }));
    
    // Increase JSON payload limit for document uploads (PDFs can be several MB)
    app.use(express.json({ limit: '50mb' }));
    // Also handle URL-encoded data with increased limits
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    mcpDebugger.info('✅ [START] Express middleware configured with 50MB payload limits');

    // Wire up the request handler to the /mcp endpoint
    mcpDebugger.info('🔧 [START] Setting up MCP endpoint...');
    app.post('/mcp', async (req, res) => {
      await handleMCPRequest(req, res, req.body, sessionTransports, sessionServers);
    });
    mcpDebugger.info('✅ [START] MCP endpoint configured');

    // Health check endpoint
    mcpDebugger.info('🔧 [START] Setting up health endpoint...');
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        server_state: {
          active_sessions: sessionTransports.size,
          session_based: true,
          architecture: 'per-request-isolation'
        },
        timestamp: new Date().toISOString()
      });
    });
    mcpDebugger.info('✅ [START] Health endpoint configured');

    // Simple Verbs REST endpoints - simplified MCP interface
    mcpDebugger.info('🔧 [START] Setting up Simple Verbs REST endpoints...');
    
    // Import Simple Verbs Service
    let SimpleVerbsService;
    try {
      const simpleVerbsModule = await import('./tools/simple-verbs.js');
      SimpleVerbsService = simpleVerbsModule.SimpleVerbsService;
    } catch (error) {
      mcpDebugger.info('⚠️ [REST] Simple Verbs module not available:', error.message);
    }

    if (SimpleVerbsService) {
      // MIGRATION: Use Enhanced SPARQLStore for unified storage with API server
      mcpDebugger.info('🔄 [MCP] Initializing Enhanced SPARQLStore for unified storage...');
      const { default: SPARQLStore } = await import('../src/stores/SPARQLStore.js');
      const { default: EmbeddingService } = await import('../src/services/embeddings/EmbeddingService.js');
      const { default: LLMHandler } = await import('../src/handlers/LLMHandler.js');
      const Config = (await import('../src/Config.js')).default;

      // Initialize config and storage to match API server configuration
      const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json');
      const config = new Config(configPath);
      await config.init();

      const storageOptions = config.get('storage.options') || {};

      // Get embedding dimension from the embedding provider configuration
      const llmProviders = config.get('llmProviders') || [];
      const embeddingProvider = llmProviders
        .filter(p => p.capabilities?.includes('embedding'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

      const dimension = embeddingProvider?.embeddingDimension;
      if (!dimension) {
        throw new Error('Embedding dimension not configured in config.json - check embeddingDimension in llmProviders');
      }

      // Initialize EmbeddingService with config-based settings
      const embeddingService = new EmbeddingService({
        provider: embeddingProvider?.type || 'ollama',
        model: embeddingProvider?.embeddingModel || 'nomic-embed-text',
        dimension: dimension,
        providerOptions: {
          baseUrl: embeddingProvider?.baseUrl,
          apiKey: embeddingProvider?.apiKey
        }
      });

      // Initialize LLM handler for chat functionality
      const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

      let llmHandler = null;
      if (chatProvider) {
        // Import the appropriate connector based on provider type
        if (chatProvider.type === 'ollama') {
          const { default: OllamaConnector } = await import('../src/connectors/OllamaConnector.js');
          const llmConnector = new OllamaConnector({
            baseUrl: chatProvider.baseUrl || 'http://localhost:11434',
            apiKey: chatProvider.apiKey
          });
          llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel || 'qwen2:1.5b');
        } else if (chatProvider.type === 'groq') {
          const { default: GroqConnector } = await import('../src/connectors/GroqConnector.js');
          const llmConnector = new GroqConnector({
            apiKey: chatProvider.apiKey
          });
          llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel || 'llama-3.1-8b-instant');
        }
        // Add other providers as needed (mistral, claude, etc.)
        mcpDebugger.info(`✅ [MCP] LLM handler initialized with ${chatProvider.type} provider`);
      } else {
        mcpDebugger.warn('⚠️ [MCP] No chat provider configured - chat functionality disabled');
      }

      // Initialize PromptSynthesis for ask operations
      const promptSynthesis = llmHandler ? new PromptSynthesis(llmHandler) : null;
      mcpDebugger.info(`✅ [MCP] PromptSynthesis initialized: ${promptSynthesis ? 'enabled' : 'disabled'}`);

      const enhancedOptions = {
        ...storageOptions,
        dimension,
        memoryManagement: true,
        conceptGraphs: true,
        semanticClustering: true
      };

      mcpDebugger.info('💾 [MCP] Creating Enhanced SPARQLStore with same config as API server');
      const storage = new SPARQLStore(storageOptions.endpoint || storageOptions, enhancedOptions, config);
      mcpDebugger.info('✅ [MCP] Enhanced SPARQLStore initialized for unified storage');

      // Initialize SearchService for unified search across SPARQL and FAISS
      const searchService = new SearchService(storage, storage.index);
      mcpDebugger.info('✅ [MCP] SearchService initialized for unified search');

      // Create a compatibility wrapper that mimics SimpleVerbsService interface
      const simpleVerbsService = {
        async initialize() {
          // Storage is already initialized
          return true;
        },

        async tell({ content, type = 'interaction', metadata = {}, lazy = false }) {
          try {
            // Generate embedding for the content using the configured embedding service
            const contentEmbedding = await embeddingService.generateEmbedding(content);

            // Store using Enhanced SPARQLStore
            mcpDebugger.info('🔥 MCP DEBUG: About to call storage.storeWithMemory, storage type:', storage.constructor.name);
            const { randomUUID } = await import('crypto');
            const result = await storage.storeWithMemory({
              id: randomUUID(), // Generate unique ID for the record
              prompt: content,
              response: '', // Tell operations don't have responses
              embedding: contentEmbedding, // Use generated embedding
              concepts: [],
              metadata: { ...metadata, type, lazy }
            });

            return {
              success: true,
              stored: true,
              concepts: result?.concepts?.length || result?.extractedConcepts?.length || 0,
              contentLength: content.length,
              metadata,
              result // Include the raw result for debugging
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Tell operation failed:', error);
            throw error;
          }
        },

        async ask({ question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false, useWebSearch = false, threshold = 0.3 }) {
          try {
            // Generate embedding for the question using the configured embedding service
            const questionEmbedding = await embeddingService.generateEmbedding(question);

            // Search using SearchService for unified SPARQL + FAISS search
            const results = await searchService.search(questionEmbedding, 10, threshold);

            // Debug: Log search results to understand what we're getting
            mcpDebugger.info(`🔍 [DEBUG] Search results for "${question}":`, {
              resultsCount: results.length,
              results: results.map(r => ({
                prompt: r.prompt?.substring(0, 100),
                response: r.response?.substring(0, 100),
                content: r.content?.substring(0, 100),
                similarity: r.similarity,
                keys: Object.keys(r)
              }))
            });

            // Use PromptSynthesis to generate a proper LLM response instead of raw search results
            let answer;
            if (promptSynthesis && useContext) {
              answer = await promptSynthesis.synthesizeResponse(question, results, { mode, useContext });
            } else {
              // Fallback to raw search results (the old redundant approach)
              answer = results.length > 0 ?
                `Based on stored information: ${results[0].prompt || results[0].response || results[0].content}` :
                `I'm sorry, but I don't have any information about "${question}" in the provided context or my current knowledge base.`;
            }

            // Format response to match SimpleVerbsService interface
            return {
              success: true,
              question,
              answer,
              contextItems: results.length,
              sessionResults: results.length,
              persistentResults: results.length,
              memories: results.length,
              enhancements: [],
              contextAnalysis: {
                hasPersonalContext: results.length > 0,
                hasEnhancementContext: false,
                personalRelevance: results.length > 0 ? 0.8 : 0,
                enhancementQuality: 0,
                personalWeight: 0.5,
                enhancementWeight: 0.5,
                selectedStrategy: results.length > 0 ? "personal_context" : "no_context"
              },
              // DEBUG: Include search results to debug content mapping
              debugSearchResults: results.slice(0, 3).map(r => ({
                id: r.id,
                prompt: r.prompt,
                response: r.response,
                content: r.content,
                similarity: r.similarity,
                source: r.source,
                metadata: r.metadata
              }))
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Ask operation failed:', error);
            throw error;
          }
        },

        async chat({ message, context = [], options = {} }) {
          try {
            if (!llmHandler) {
              throw new Error('LLM service not available - handler not initialized');
            }

            // Use the LLM handler to generate a response
            const response = await llmHandler.generateResponse(message, context, options);

            return {
              success: true,
              response: response,
              message: message,
              contextLength: context.length,
              options
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Chat operation failed:', error);
            throw error;
          }
        },

        // ZPT navigation methods for VSOM compatibility
        async zoom({ level = 'entity', query }) {
          try {
            mcpDebugger.info('🔍 [ZOOM] Zoom method called with:', { level, query });

            // Simple zoom implementation - return basic navigation data
            return {
              success: true,
              verb: 'zoom',
              level: level,
              query: query,
              navigation: {
                success: true,
                data: [],
                message: `Zoomed to ${level} level${query ? ` with query: ${query}` : ''}`
              },
              zptState: {
                zoom: level,
                pan: {},
                tilt: 'keywords',
                sessionId: Date.now().toString()
              }
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Zoom operation failed:', error);
            throw error;
          }
        },

        async pan(panParams) {
          try {
            mcpDebugger.info('🔍 [PAN] Pan method called with:', panParams);

            return {
              success: true,
              verb: 'pan',
              panParams: panParams,
              navigation: {
                success: true,
                data: [],
                message: 'Pan operation completed'
              },
              zptState: {
                zoom: 'entity',
                pan: panParams || {},
                tilt: 'keywords',
                sessionId: Date.now().toString()
              }
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Pan operation failed:', error);
            throw error;
          }
        },

        async tilt({ style = 'keywords', query }) {
          try {
            mcpDebugger.info('🔍 [TILT] Tilt method called with:', { style, query });

            return {
              success: true,
              verb: 'tilt',
              style: style,
              query: query,
              navigation: {
                success: true,
                data: [],
                message: `Tilted to ${style} style${query ? ` with query: ${query}` : ''}`
              },
              zptState: {
                zoom: 'entity',
                pan: {},
                tilt: style,
                sessionId: Date.now().toString()
              }
            };
          } catch (error) {
            mcpDebugger.error('❌ [MCP] Tilt operation failed:', error);
            throw error;
          }
        },

        // State management for VSOM
        stateManager: {
          getState() {
            return {
              zoom: 'entity',
              pan: {},
              tilt: 'keywords',
              sessionId: Date.now().toString(),
              lastQuery: null
            };
          }
        },

        // Expose the llmHandler for compatibility
        get llmHandler() {
          return llmHandler;
        }
      };

      // TELL endpoint - Add resources to the system
      app.post('/tell', async (req, res) => {
        const requestId = Date.now().toString(36);
        mcpDebugger.info(`HTTP Tell Request Started [${requestId}]`, {
          contentLength: req.body?.content?.length || 0,
          hasMetadata: !!req.body?.metadata,
          type: req.body?.type || 'interaction',
          lazy: req.body?.lazy || false
        });
        
        try {
          const { content, type = 'interaction', metadata = {}, lazy = false } = req.body;
          if (!content) {
            mcpDebugger.warn(`HTTP Tell Request Failed - No content [${requestId}]`);
            return res.status(400).json({ error: 'Content is required' });
          }
          
          const startTime = Date.now();
          const result = await simpleVerbsService.tell({ content, type, metadata, lazy });
          const duration = Date.now() - startTime;
          
          mcpDebugger.info(`HTTP Tell Request Completed [${requestId}]`, {
            success: result?.success,
            stored: result?.stored,
            concepts: result?.concepts,
            duration: duration + 'ms',
            contentLength: content.length
          });
          
          res.json(result);
        } catch (error) {
          mcpDebugger.error(`HTTP Tell Request Error [${requestId}]`, {
            error: error.message,
            stack: error.stack,
            requestBody: req.body
          });
          res.status(500).json({ 
            success: false, 
            verb: 'tell', 
            error: error.message 
          });
        }
      });

      // ASK endpoint - Query the system
      app.post('/ask', async (req, res) => {
        const requestId = Date.now().toString(36);
        mcpDebugger.info(`HTTP Ask Request Started [${requestId}]`, {
          questionLength: req.body?.question?.length || 0,
          mode: req.body?.mode || 'standard',
          useContext: req.body?.useContext !== false,
          threshold: req.body?.threshold
        });
        
        try {
          const { question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false, threshold } = req.body;
          if (!question) {
            mcpDebugger.warn(`HTTP Ask Request Failed - No question [${requestId}]`);
            return res.status(400).json({ error: 'Question is required' });
          }
          
          const startTime = Date.now();
          const result = await simpleVerbsService.ask({ question, mode, useContext, useHyDE, useWikipedia, useWikidata, threshold });
          const duration = Date.now() - startTime;
          
          mcpDebugger.info(`HTTP Ask Request Completed [${requestId}]`, {
            success: result?.success,
            contextItems: result?.contextItems,
            memories: result?.memories,
            answerLength: result?.answer?.length || 0,
            duration: duration + 'ms'
          });
          
          res.json(result);
        } catch (error) {
          mcpDebugger.error(`HTTP Ask Request Error [${requestId}]`, {
            error: error.message,
            stack: error.stack,
            question: req.body?.question?.substring(0, 100)
          });
          res.status(500).json({ 
            success: false, 
            verb: 'ask', 
            question: req.body.question,
            error: error.message 
          });
        }
      });

      // AUGMENT endpoint - Run operations on content
      app.post('/augment', async (req, res) => {
        try {
          const { target, operation = 'auto', options = {} } = req.body;
          mcpDebugger.info('🔥 [HTTP-SERVER] /augment endpoint called with:', { target, operation, options });
          // Allow empty target for certain operations that work on "all" content
          const allowEmptyTarget = ['process_lazy', 'chunk_documents'].includes(operation);
          if (!target && !allowEmptyTarget) {
            return res.status(400).json({ error: 'Target content is required' });
          }
          
          const result = await simpleVerbsService.augment({ 
            target: target || 'all', 
            operation, 
            options 
          });
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'augment', 
            target: req.body.target?.substring(0, 100) + '...',
            error: error.message 
          });
        }
      });

      // ZOOM endpoint - Set abstraction level
      app.post('/zoom', async (req, res) => {
        try {
          const { level = 'entity', query } = req.body;
          const result = await simpleVerbsService.zoom({ level, query });
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'zoom', 
            level: req.body.level,
            error: error.message 
          });
        }
      });

      // PAN endpoint - Set domain/filtering
      app.post('/pan', async (req, res) => {
        try {
          // Extract all pan parameters from request body
          const panParams = { ...req.body };
          const result = await simpleVerbsService.pan(panParams);
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'pan', 
            panParams: req.body,
            error: error.message 
          });
        }
      });

      // TILT endpoint - Set view filter
      app.post('/tilt', async (req, res) => {
        try {
          const { style = 'keywords', query } = req.body;
          const result = await simpleVerbsService.tilt({ style, query });
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'tilt', 
            style: req.body.style,
            error: error.message 
          });
        }
      });

      // ZPT NAVIGATE endpoint - Execute navigation with zoom/pan/tilt
      app.post('/zpt/navigate', async (req, res) => {
        try {
          const { query = 'Navigate knowledge space', zoom = 'entity', pan = {}, tilt = 'keywords' } = req.body;
          
          // Use the ZPT navigation service from simple verbs
          await simpleVerbsService.initialize();
          
          // Get the ZPT service from simple verbs
          const zptService = simpleVerbsService.zptService;
          if (!zptService) {
            throw new Error('ZPT navigation service not available');
          }
          
          // Execute navigation with complete params object
          const params = { query, zoom, pan, tilt, transform: {} };
          const result = await zptService.navigate(params);
          
          // Return the result directly to match test expectations
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'zpt_navigate', 
            navigation: req.body,
            error: error.message 
          });
        }
      });

      // GET endpoints for reading state
      app.get('/state', async (req, res) => {
        try {
          await simpleVerbsService.initialize();
          const state = simpleVerbsService.stateManager?.getState();
          res.json({ 
            success: true, 
            state: state || { message: 'State not available' } 
          });
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            error: error.message 
          });
        }
      });

      // DEBUG endpoint - Quick memory inspection
      app.get('/debug/memory', async (req, res) => {
        try {
          res.json({
            success: true,
            shortTermMemoryCount: storage.shortTermMemory?.length || 0,
            shortTermMemoryItems: storage.shortTermMemory?.slice(-5).map((item, index) => ({
              index,
              id: item.id,
              prompt: (item.prompt || '').substring(0, 100),
              response: (item.response || '').substring(0, 100),
              content: (item.content || '').substring(0, 100),
              embedding: item.embedding ? `${item.embedding.length}D vector` : 'no embedding'
            })) || [],
            faissIndexSize: storage.index?.ntotal() || 0,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      });

      // INSPECT endpoint - Debug and monitor system state
      app.post('/inspect', async (req, res) => {
        try {
          const { what = 'session', details = true } = req.body;
          
          // Call the MCP inspect tool
          const result = await simpleVerbsService.inspect({ what, details });
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'inspect', 
            what: req.body.what,
            error: error.message 
          });
        }
      });

      // UPLOAD-DOCUMENT endpoint - Upload and process document files
      app.post('/upload-document', async (req, res) => {
        try {
          const { fileUrl, filename, mediaType, documentType, metadata = {} } = req.body;
          
          if (!fileUrl || !filename || !documentType) {
            return res.status(400).json({ 
              error: 'fileUrl, filename, and documentType are required' 
            });
          }
          
          
          // Import and use DocumentProcessor directly (similar to other endpoints)
          const { DocumentProcessor } = await import('./tools/document-tools.js');
          const SPARQLHelper = (await import('../src/services/sparql/SPARQLHelper.js')).default;
          const Config = (await import('../src/Config.js')).default;
          
          // Initialize components
          const config = new Config(process.env.SEMEM_CONFIG_PATH || 'config/config.json');
          await config.init();
          
          const storageConfig = config.get('storage.options');
          const sparqlHelper = new SPARQLHelper(storageConfig.update, {
            user: storageConfig.user,
            password: storageConfig.password
          });
          
          // Pass simpleVerbsService for memory integration
          const processor = new DocumentProcessor(config, sparqlHelper, simpleVerbsService);
          const result = await processor.processUploadedDocument({
            fileUrl,
            filename,
            mediaType,
            documentType,
            metadata
          });
          
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'uploadDocument', 
            filename: req.body.filename,
            error: error.message 
          });
        }
      });

      // CHAT endpoint - Interactive chat with slash command support
      app.post('/chat', async (req, res) => {
        try {
          const { message, context = {} } = req.body;
          
          mcpDebugger.info('🚀 [CHAT] Chat endpoint called with message:', message.substring(0, 50) + '...');
          
          if (!message) {
            return res.status(400).json({ error: 'Message is required' });
          }
          
          // Load system prompt
          let systemPrompt = '';
          try {
            const promptPath = path.join(projectRoot, 'prompts/system/chat.md');
            systemPrompt = await fs.readFile(promptPath, 'utf8');
          } catch (error) {
            mcpDebugger.warn('⚠️ Could not load chat system prompt:', error.message);
            systemPrompt = 'You are a helpful assistant for the Semem semantic memory system.';
          }
          
          // Check for slash commands
          const trimmedMessage = message.trim();
          if (trimmedMessage.startsWith('/')) {
            const commandResult = await handleChatCommand(trimmedMessage, simpleVerbsService);
            return res.json(commandResult);
          }
          
          // Check if user is responding to a previous no-context query with a positive response
          if (req.session && req.session.lastFailedQuery) {
            const positiveResponses = ['yes', 'yeah', 'sure', 'ok', 'okay', 'please', 'do it', 'go ahead', 'search', 'try it'];
            const messageWords = trimmedMessage.toLowerCase().split(/\s+/);
            
            // Check if message contains positive response words
            const isPositiveResponse = positiveResponses.some(response => 
              messageWords.some(word => word.includes(response) || response.includes(word))
            );
            
            if (isPositiveResponse) {
              mcpDebugger.info('🔍 [CHAT] Detected positive response for enhanced search:', req.session.lastFailedQuery);
              
              // Store the query before clearing it
              const queryToEnhance = req.session.lastFailedQuery;
              
              // Clear the session query
              delete req.session.lastFailedQuery;
              
              // Run enhanced ask with all enhancements enabled
              const enhancedResult = await simpleVerbsService.ask({ 
                question: queryToEnhance,
                mode: 'standard',
                useContext: true,
                useHyDE: true,
                useWikipedia: true,
                useWikidata: true
              });
              
              return res.json({
                success: true,
                messageType: 'enhanced_result',
                content: enhancedResult.answer || 'No enhanced results found.',
                originalMessage: message,
                originalQuery: queryToEnhance,
                routing: 'enhanced_search',
                enhancementsUsed: ['HyDE', 'Wikipedia', 'Wikidata'],
                contextItems: enhancedResult.contextItems || 0,
                timestamp: new Date().toISOString()
              });
            }
          }
          
          // For natural language, infer intention using LLM
          await simpleVerbsService.initialize();
          const llmHandler = simpleVerbsService.llmHandler;
          
          mcpDebugger.info('🔍 [CHAT] Debug - simpleVerbsService initialized:', !!simpleVerbsService);
          mcpDebugger.info('🔍 [CHAT] Debug - memoryManager exists:', !!simpleVerbsService.memoryManager);
          mcpDebugger.info('🔍 [CHAT] Debug - llmHandler exists:', !!llmHandler);
          mcpDebugger.info('🔍 [CHAT] Debug - llmHandler type:', typeof llmHandler);
          
          if (!llmHandler) {
            return res.json({
              success: false,
              messageType: 'error',
              content: 'LLM service not available. Please check configuration.',
              timestamp: new Date().toISOString()
            });
          }
          
          // Use LLM to determine intent and generate response
          const chatPrompt = `${systemPrompt}

User Message: ${message}
Context: ${JSON.stringify(context, null, 2)}

Based on the user's message, determine if this should be routed to:
1. ASK endpoint (if asking for information/querying knowledge)
2. TELL endpoint (if providing information to store)  
3. Direct chat response (if general conversation/help)

Respond with a JSON object containing:
- action: "ask", "tell", or "chat"
- content: the response content
- reasoning: brief explanation of why you chose this action

If action is "ask" or "tell", also include:
- extractedQuery: the query/content to send to the endpoint`;

          const llmResponse = await llmHandler.generateResponse(chatPrompt);
          let parsedResponse;
          
          try {
            // Extract JSON from the response
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
              // Fallback: treat as direct chat
              parsedResponse = {
                action: 'chat',
                content: llmResponse,
                reasoning: 'Could not parse structured response'
              };
            }
          } catch (parseError) {
            parsedResponse = {
              action: 'chat',
              content: llmResponse,
              reasoning: 'JSON parse error, treating as direct response'
            };
          }
          
          // Route based on inferred action
          if (parsedResponse.action === 'ask' && parsedResponse.extractedQuery) {
            const askResult = await simpleVerbsService.ask({ 
              question: parsedResponse.extractedQuery,
              mode: 'standard',
              useContext: true
            });
            
            // Check if context was found - be more explicit about no-context scenarios
            const hasContext = (askResult.contextItems && askResult.contextItems > 0) || 
                              (askResult.usedContext === true) || 
                              (askResult.memories && askResult.memories > 0);
            
            mcpDebugger.info('🔍 [CHAT] Context analysis:', {
              contextItems: askResult.contextItems,
              usedContext: askResult.usedContext,
              memories: askResult.memories,
              hasContext,
              answer: askResult.answer?.substring(0, 100) + '...'
            });
            
            if (!hasContext || !askResult.answer || 
                askResult.answer.includes('No relevant information found') || 
                askResult.answer.includes('No answer found') ||
                askResult.answer.includes('I don\'t have information') ||
                askResult.answer.includes('cannot provide') ||
                askResult.answer.includes('does not contain relevant information') ||
                askResult.answer.includes('provided context does not contain') ||
                (askResult.contextItems === 0 && askResult.memories === 0)) {
              // No context found - provide fallback LLM response and ask about enhanced search
              const fallbackPrompt = `Please answer the following question using your general knowledge: ${parsedResponse.extractedQuery}`;
              const fallbackResponse = await llmHandler.generateResponse(fallbackPrompt);
              
              // Store the query for potential enhanced search
              req.session = req.session || {};
              req.session.lastFailedQuery = parsedResponse.extractedQuery;
              
              return res.json({
                success: true,
                messageType: 'no_context_fallback',
                content: `Based on my general knowledge: ${fallbackResponse}

**I couldn't find relevant information in your personal knowledge base for this query.** Would you like me to search external sources (Wikipedia, Wikidata, and enhanced search methods) for more comprehensive information?`,
                fallbackUsed: true,
                originalMessage: message,
                originalQuery: parsedResponse.extractedQuery,
                routing: 'ask_fallback',
                reasoning: parsedResponse.reasoning,
                timestamp: new Date().toISOString()
              });
            }
            
            return res.json({
              success: true,
              messageType: 'ask_result',
              content: askResult.answer || 'No answer found.',
              originalMessage: message,
              routing: 'ask',
              reasoning: parsedResponse.reasoning,
              timestamp: new Date().toISOString()
            });
            
          } else if (parsedResponse.action === 'tell' && parsedResponse.extractedQuery) {
            const tellResult = await simpleVerbsService.tell({ 
              content: parsedResponse.extractedQuery,
              type: 'interaction',
              metadata: { source: 'chat', originalMessage: message }
            });
            
            return res.json({
              success: true,
              messageType: 'tell_result',
              content: `Information stored successfully. ${parsedResponse.content}`,
              originalMessage: message,
              routing: 'tell',
              reasoning: parsedResponse.reasoning,
              timestamp: new Date().toISOString()
            });
            
          } else {
            // Direct chat response
            return res.json({
              success: true,
              messageType: 'chat',
              content: parsedResponse.content,
              originalMessage: message,
              routing: 'direct',
              reasoning: parsedResponse.reasoning,
              timestamp: new Date().toISOString()
            });
          }
          
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'chat', 
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      // ENHANCED CHAT endpoint - For when user wants enhanced query with HyDE, Wikipedia, Wikidata
      app.post('/chat/enhanced', async (req, res) => {
        try {
          const { query, useHyDE = false, useWikipedia = false, useWikidata = false } = req.body;
          
          mcpDebugger.info('🚀 [ENHANCED-CHAT] Enhanced chat endpoint called with query:', query.substring(0, 50) + '...');
          
          if (!query) {
            return res.status(400).json({ error: 'Query is required' });
          }
          
          // Run enhanced ask with all requested enhancements
          await simpleVerbsService.initialize();
          const enhancedResult = await simpleVerbsService.ask({ 
            question: query,
            mode: 'standard',
            useContext: true,
            useHyDE,
            useWikipedia,
            useWikidata
          });
          
          return res.json({
            success: true,
            messageType: 'enhanced_result',
            content: enhancedResult.answer || 'No enhanced answer found.',
            originalQuery: query,
            routing: 'enhanced_ask',
            enhancementsUsed: {
              hyde: useHyDE,
              wikipedia: useWikipedia,
              wikidata: useWikidata
            },
            contextItems: enhancedResult.contextItems || 0,
            enhancementStats: enhancedResult.enhancementStats,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'enhanced_chat', 
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      mcpDebugger.info('✅ [START] Simple Verbs REST endpoints configured:');
      mcpDebugger.info('   POST /tell - Add resources to the system');
      mcpDebugger.info('   POST /ask - Query the system');
      mcpDebugger.info('   POST /augment - Augment content');
      mcpDebugger.info('   POST /upload-document - Upload and process document files');
      mcpDebugger.info('   POST /chat - Interactive chat with slash command support');
      mcpDebugger.info('   POST /chat/enhanced - Enhanced chat with HyDE, Wikipedia, Wikidata');
      mcpDebugger.info('   POST /zoom - Set abstraction level');
      mcpDebugger.info('   POST /pan - Set domain/filtering');
      mcpDebugger.info('   POST /tilt - Set view filter');
      mcpDebugger.info('   POST /zpt/navigate - Execute ZPT navigation');
      mcpDebugger.info('   POST /inspect - Debug and monitor system state');
      mcpDebugger.info('   GET /state - Get current ZPT state');
    } else {
      mcpDebugger.info('⚠️ [REST] Simple Verbs REST endpoints not available (service not loaded)');
    }

    // Serve MCP Inspector static files
    mcpDebugger.info('🔧 [START] Setting up static file routes...');
    const inspectorPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/inspector/client/dist');
    app.use('/inspector', express.static(inspectorPath));
    
    // Serve assets at root level to match HTML references
    const assetsPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/inspector/client/dist/assets');
    app.use('/assets', express.static(assetsPath));
    
    // Serve the MCP SVG icon at root level
    app.use('/mcp.svg', express.static(path.resolve(__dirname, '../node_modules/@modelcontextprotocol/inspector/client/dist/mcp.svg')));

    // Redirect root to inspector for convenience
    app.get('/', (req, res) => {
      res.redirect('/inspector');
    });
    mcpDebugger.info('✅ [START] Static file routes configured');

    // Start the Express server
    mcpDebugger.info('🔧 [START] Starting Express server...');
    const server = app.listen(port, () => {
      mcpDebugger.info(`✅ [START] Express server listening on port ${port}`);
      mcpDebugger.info(`✅ Optimized MCP HTTP Server listening on port ${port}`);
      mcpDebugger.info(`Health check: http://localhost:${port}/health`);
      mcpDebugger.info(`MCP endpoint: http://localhost:${port}/mcp`);
      mcpDebugger.info(`Inspector: http://localhost:${port}/inspector`);
      mcpDebugger.info('🌟 Simple Verbs REST API:');
      mcpDebugger.info(`   POST /tell, /ask, /augment, /zoom, /pan, /tilt`);
      mcpDebugger.info(`   GET /state`);
      mcpDebugger.info('🔄 Full server initialization will happen on first request or in background...');
      
      mcpDebugger.info('🔄 [START] Ready to handle MCP sessions...');
    });

    httpTerminator = createHttpTerminator({ server });

    // Graceful shutdown handling
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    mcpDebugger.error('❌ Failed to start optimized HTTP server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

async function shutdown() {
  mcpDebugger.info('SIGTERM/SIGINT signal received: closing HTTP server');
  
  try {
    if (mcpServerInstance) {
      await mcpServerInstance.close?.();
    }
  } catch (error) {
    mcpDebugger.warn('Error closing MCP server:', error.message);
  }
  
  if (httpTerminator) {
    await httpTerminator.terminate();
    mcpDebugger.info('HTTP server closed');
  }
  
  process.exit(0);
}

// Start the optimized server
startOptimizedServer();