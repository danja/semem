/**
 * Optimized MCP (Model Context Protocol) HTTP Server
 * Non-blocking initialization with lazy loading for better startup performance
 */

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = mcpConfig.port || 3000;
let httpTerminator = null;

// Server state management
let mcpServerInstance = null;
let transportInstance = null;
let isInitializing = false;
let initializationError = null;
let initializationPromise = null;

/**
 * Create a minimal MCP server that can start immediately
 */
function createMinimalServer() {
  const server = new Server({
    name: mcpConfig.name || "semem-mcp-server",
    version: mcpConfig.version || "0.1.0",
    instructions: mcpConfig.instructions || "Semem MCP Server - Initializing..."
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
  if (mcpServerInstance || isInitializing) {
    return initializationPromise;
  }

  isInitializing = true;
  initializationError = null;

  initializationPromise = (async () => {
    try {
      mcpDebugger.info('🔄 Starting lazy initialization of full MCP server...');
      
      // Dynamic import to avoid blocking
      const { createServer } = await import('./index.js');
      
      // Initialize with timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Server initialization timeout (30s)')), 30000);
      });
      
      const serverPromise = createServer();
      const fullServer = await Promise.race([serverPromise, timeoutPromise]);
      
      // Replace the minimal server with the full server
      if (transportInstance) {
        // Gracefully disconnect old server
        try {
          await mcpServerInstance?.close?.();
        } catch (e) {
          mcpDebugger.warn('Error closing minimal server:', e.message);
        }
        
        // Connect new server
        await fullServer.connect(transportInstance);
        mcpServerInstance = fullServer;
        
        mcpDebugger.info('✅ Full MCP server initialized and connected');
      } else {
        mcpServerInstance = fullServer;
        mcpDebugger.info('✅ Full MCP server initialized (waiting for transport)');
      }
      
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
 * Request handler that ensures server is ready
 */
async function handleMCPRequest(req, res, body) {
  try {
    // If we don't have a full server yet, try to initialize it
    if (!mcpServerInstance && !isInitializing) {
      // Start initialization in background (non-blocking)
      initializeFullServer().catch(() => {
        // Initialization failed, but we continue with minimal server
      });
    }
    
    // Handle request with current server (minimal or full)
    if (transportInstance) {
      await transportInstance.handleRequest(req, res, body);
    } else {
      res.status(503).json({
        error: "Server transport not ready",
        retry_after: 1
      });
    }
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
    mcpDebugger.info('🚀 Starting Optimized MCP HTTP Server...');

    // Create minimal server immediately
    const minimalServer = createMinimalServer();
    mcpServerInstance = minimalServer;

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: false,
      onsessioninitialized: (sessionId) => {
        mcpDebugger.info(`MCP session initialized: ${sessionId}`);
      }
    });
    transportInstance = transport;

    // Connect minimal server to transport
    await minimalServer.connect(transport);
    
    // Configure Express middleware
    app.use(cors());
    app.use(express.json());

    // Wire up the transport to the /mcp endpoint with lazy loading
    app.post('/mcp', async (req, res) => {
      await handleMCPRequest(req, res, req.body);
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        server_state: {
          initialized: mcpServerInstance !== null,
          initializing: isInitializing,
          error: initializationError?.message || null
        },
        timestamp: new Date().toISOString()
      });
    });

    // Serve MCP Inspector static files
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

    // Start the Express server
    const server = app.listen(port, () => {
      mcpDebugger.info(`✅ Optimized MCP HTTP Server listening on port ${port}`);
      mcpDebugger.info(`Health check: http://localhost:${port}/health`);
      mcpDebugger.info(`MCP endpoint: http://localhost:${port}/mcp`);
      mcpDebugger.info(`Inspector: http://localhost:${port}/inspector`);
      mcpDebugger.info('🔄 Full server initialization will happen on first request or in background...');
      
      // Start background initialization after server is up
      setTimeout(() => {
        initializeFullServer().catch(() => {
          // Background initialization failed, but server continues running
        });
      }, 1000);
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