/**
 * Optimized MCP (Model Context Protocol) HTTP Server
 * Non-blocking initialization with lazy loading for better startup performance
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const configPath = process.env.SEMEM_CONFIG_PATH || path.join(process.cwd(), 'config/config.json');
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
    app.use(express.json());
    console.log('✅ [START] Express middleware configured');

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
        try {
          const { content, type = 'interaction', metadata = {}, lazy = false } = req.body;
          if (!content) {
            return res.status(400).json({ error: 'Content is required' });
          }
          
          const result = await simpleVerbsService.tell({ content, type, metadata, lazy });
          res.json(result);
        } catch (error) {
          res.status(500).json({ 
            success: false, 
            verb: 'tell', 
            error: error.message 
          });
        }
      });

      // ASK endpoint - Query the system
      app.post('/ask', async (req, res) => {
        try {
          const { question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false } = req.body;
          if (!question) {
            return res.status(400).json({ error: 'Question is required' });
          }
          
          const result = await simpleVerbsService.ask({ question, mode, useContext, useHyDE, useWikipedia, useWikidata });
          res.json(result);
        } catch (error) {
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
          if (!target) {
            return res.status(400).json({ error: 'Target content is required' });
          }
          
          const result = await simpleVerbsService.augment({ target, operation, options });
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
          
          const processor = new DocumentProcessor(config, sparqlHelper);
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

      console.log('✅ [START] Simple Verbs REST endpoints configured:');
      console.log('   POST /tell - Add resources to the system');
      console.log('   POST /ask - Query the system');
      console.log('   POST /augment - Augment content');
      console.log('   POST /upload-document - Upload and process document files');
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