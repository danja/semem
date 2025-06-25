/**
 * Optimized MCP (Model Context Protocol) HTTP Server
 * Non-blocking initialization with lazy loading for better startup performance
 */

import dotenv from 'dotenv';

// Load environment variables first, before any other imports
dotenv.config();

// Debug: Check if API keys are loaded
console.log('🔑 MISTRAL_API_KEY loaded:', process.env.MISTRAL_API_KEY ? 'YES' : 'NO');
console.log('🔑 CLAUDE_API_KEY loaded:', process.env.CLAUDE_API_KEY ? 'YES' : 'NO');

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createHttpTerminator } from 'http-terminator';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpDebugger } from './lib/debug-utils.js';
import { mcpConfig } from './lib/config.js';

console.log('🚀 HTTP SERVER: Starting script execution...');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = mcpConfig.port || 3000;
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
      const { createHttpServer } = await import('./http-only-server.js');
      const server = await createHttpServer();
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