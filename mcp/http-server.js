/**
 * Optimized MCP (Model Context Protocol) HTTP Server
 * Non-blocking initialization with lazy loading for better startup performance
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Load environment variables first, before any other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Debug: Check if API keys are loaded
console.log('🔑 MISTRAL_API_KEY loaded:', process.env.MISTRAL_API_KEY ? 'YES' : 'NO');
console.log('🔑 CLAUDE_API_KEY loaded:', process.env.CLAUDE_API_KEY ? 'YES' : 'NO');

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createHttpTerminator } from 'http-terminator';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpDebugger } from './lib/debug-utils.js';
import { mcpConfig } from './lib/config.js';
import Config from '../src/Config.js';

console.log('🚀 HTTP SERVER: Starting script execution...');

// Initialize config to get port from config.json
let port = process.env.PORT || process.env.MCP_PORT || 3000;
try {
  const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json');
  const config = new Config(configPath);
  await config.init();
  port = process.env.PORT || process.env.MCP_PORT || config.get('servers.mcp') || config.get('port') || 3000;
  console.log(`🔧 HTTP SERVER: Using port ${port} from config`);
} catch (error) {
  console.warn('⚠️ HTTP SERVER: Could not load config, using default port:', error.message);
}

const app = express();
let httpTerminator = null;

console.log(`🚀 HTTP SERVER: Variables initialized, port: ${port}`);

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
              console.warn('Document processing failed, falling back to regular tell:', processingError.message);
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
      console.log('🔄 [FULL] Starting lazy initialization of full MCP server...');
      mcpDebugger.info('🔄 Starting lazy initialization of full MCP server...');
      
      // Dynamic import to avoid blocking
      console.log('📦 [FULL] Importing createServer from index.js...');
      const { createServer } = await import('./index.js');
      console.log('✅ [FULL] createServer imported successfully');
      
      // Initialize with timeout to prevent hanging
      console.log('⏰ [FULL] Setting up timeout promise (30s)...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Server initialization timeout (30s)')), 30000);
      });
      
      console.log('🏃 [FULL] Starting createServer() call...');
      const serverPromise = createServer();
      console.log('🏁 [FULL] Waiting for createServer() to complete...');
      const fullServer = await Promise.race([serverPromise, timeoutPromise]);
      console.log('✅ [FULL] createServer() completed successfully');
      
      // Store the full server instance (transport connections happen per-session)
      mcpServerInstance = fullServer;
      console.log('✅ [FULL] Full server set as instance (per-session transport connections)');
      mcpDebugger.info('✅ Full MCP server initialized (per-session transport)');
      
      isFullyInitialized = true;
      console.log('🎉 [FULL] Full server initialization completed!');
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
      console.log(`🔄 [SESSION-${sessionId}] Reusing existing transport`);
    } else if (!sessionId) {
      // New initialization request (no session ID header)
      console.log('🔧 [INIT] New initialization request - creating server and transport...');
      
      // Create a new server instance for this session
      const { createServer } = await import('./index.js');
      const server = await createServer();
      console.log('✅ [INIT] Server created');
      
      // Create a new transport for this session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          console.log(`🔗 [INIT] Session initialized with ID: ${sid}`);
          sessionTransports.set(sid, transport);
          sessionServers.set(sid, server);
        }
      });
      
      // CRITICAL: Connect server to transport BEFORE handling request
      console.log('🔗 [INIT] Connecting server to transport...');
      await server.connect(transport);
      console.log('✅ [INIT] Server connected to transport');

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
    console.log('🚀 [START] Starting Optimized MCP HTTP Server...');
    mcpDebugger.info('🚀 Starting Optimized MCP HTTP Server...');

    // Session management - we'll create transport instances per request
    console.log('🔧 [START] Setting up session management...');
    const sessionTransports = new Map();
    const sessionServers = new Map();
    
    console.log('✅ [START] Session management configured');
    
    // Server instances will be created per session automatically
    console.log('🔧 [START] Server instances will be created per session...');
    
    // Configure Express middleware
    console.log('🔧 [START] Configuring Express middleware...');
    app.use(cors());
    // Increase JSON payload limit for document uploads (PDFs can be several MB)
    app.use(express.json({ limit: '50mb' }));
    // Also handle URL-encoded data with increased limits
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    console.log('✅ [START] Express middleware configured with 50MB payload limits');

    // Wire up the request handler to the /mcp endpoint
    console.log('🔧 [START] Setting up MCP endpoint...');
    app.post('/mcp', async (req, res) => {
      await handleMCPRequest(req, res, req.body, sessionTransports, sessionServers);
    });
    console.log('✅ [START] MCP endpoint configured');

    // Health check endpoint
    console.log('🔧 [START] Setting up health endpoint...');
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
    console.log('✅ [START] Health endpoint configured');

    // Simple Verbs REST endpoints - simplified MCP interface
    console.log('🔧 [START] Setting up Simple Verbs REST endpoints...');
    
    // Import Simple Verbs Service
    let SimpleVerbsService;
    try {
      const simpleVerbsModule = await import('./tools/simple-verbs.js');
      SimpleVerbsService = simpleVerbsModule.SimpleVerbsService;
    } catch (error) {
      console.log('⚠️ [REST] Simple Verbs module not available:', error.message);
    }

    if (SimpleVerbsService) {
      const simpleVerbsService = new SimpleVerbsService();

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
          console.log('🔥 [HTTP-SERVER] /augment endpoint called with:', { target, operation, options });
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
          
          // Execute navigation
          const result = await zptService.navigate(query, zoom, pan, tilt);
          
          res.json({ 
            success: true, 
            verb: 'zpt_navigate',
            data: result,
            navigation: { query, zoom, pan, tilt }
          });
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
          
          console.log('🚀 [CHAT] Chat endpoint called with message:', message.substring(0, 50) + '...');
          
          if (!message) {
            return res.status(400).json({ error: 'Message is required' });
          }
          
          // Load system prompt
          let systemPrompt = '';
          try {
            const promptPath = path.join(projectRoot, 'prompts/system/chat.md');
            systemPrompt = await fs.readFile(promptPath, 'utf8');
          } catch (error) {
            console.warn('⚠️ Could not load chat system prompt:', error.message);
            systemPrompt = 'You are a helpful assistant for the Semem semantic memory system.';
          }
          
          // Check for slash commands
          const trimmedMessage = message.trim();
          if (trimmedMessage.startsWith('/')) {
            const commandResult = await handleChatCommand(trimmedMessage, simpleVerbsService);
            return res.json(commandResult);
          }
          
          // For natural language, infer intention using LLM
          await simpleVerbsService.initialize();
          const llmHandler = simpleVerbsService.llmHandler;
          
          console.log('🔍 [CHAT] Debug - simpleVerbsService initialized:', !!simpleVerbsService);
          console.log('🔍 [CHAT] Debug - memoryManager exists:', !!simpleVerbsService.memoryManager);
          console.log('🔍 [CHAT] Debug - llmHandler exists:', !!llmHandler);
          console.log('🔍 [CHAT] Debug - llmHandler type:', typeof llmHandler);
          
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

      console.log('✅ [START] Simple Verbs REST endpoints configured:');
      console.log('   POST /tell - Add resources to the system');
      console.log('   POST /ask - Query the system');
      console.log('   POST /augment - Augment content');
      console.log('   POST /upload-document - Upload and process document files');
      console.log('   POST /chat - Interactive chat with slash command support');
      console.log('   POST /zoom - Set abstraction level');
      console.log('   POST /pan - Set domain/filtering');
      console.log('   POST /tilt - Set view filter');
      console.log('   POST /zpt/navigate - Execute ZPT navigation');
      console.log('   POST /inspect - Debug and monitor system state');
      console.log('   GET /state - Get current ZPT state');
    } else {
      console.log('⚠️ [REST] Simple Verbs REST endpoints not available (service not loaded)');
    }

    // Serve MCP Inspector static files
    console.log('🔧 [START] Setting up static file routes...');
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
    console.log('✅ [START] Static file routes configured');

    // Start the Express server
    console.log('🔧 [START] Starting Express server...');
    const server = app.listen(port, () => {
      console.log(`✅ [START] Express server listening on port ${port}`);
      mcpDebugger.info(`✅ Optimized MCP HTTP Server listening on port ${port}`);
      mcpDebugger.info(`Health check: http://localhost:${port}/health`);
      mcpDebugger.info(`MCP endpoint: http://localhost:${port}/mcp`);
      mcpDebugger.info(`Inspector: http://localhost:${port}/inspector`);
      mcpDebugger.info('🌟 Simple Verbs REST API:');
      mcpDebugger.info(`   POST /tell, /ask, /augment, /zoom, /pan, /tilt`);
      mcpDebugger.info(`   GET /state`);
      mcpDebugger.info('🔄 Full server initialization will happen on first request or in background...');
      
      console.log('🔄 [START] Ready to handle MCP sessions...');
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