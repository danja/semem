/**
 * MCP (Model Context Protocol) HTTP Server
 * Connects an MCP server to an HTTP transport for use with web clients.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createHttpTerminator } from 'http-terminator';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './index.js'; // Import the centralized server factory
import { mcpDebugger } from './lib/debug-utils.js';
import { mcpConfig } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = mcpConfig.port || 3000;
let httpTerminator = null;

async function startServer() {
  try {
    mcpDebugger.info('🚀 Starting MCP HTTP Server...');

    // Create the fully-configured MCP server instance
    const mcpServer = await createServer();

    // Create the Streamable HTTP transport with proper configuration
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: false, // Use SSE streams
      onsessioninitialized: (sessionId) => {
        mcpDebugger.info(`MCP session initialized: ${sessionId}`);
      }
    });
    
    // Connect the transport to the MCP server (this will start the transport automatically)
    await mcpServer.connect(transport);
    
    // Configure Express middleware
    app.use(cors()); // Enable CORS for inspector
    app.use(express.json());

    // Wire up the transport to the /mcp endpoint
    app.post('/mcp', (req, res) => {
      transport.handleRequest(req, res, req.body);
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
      mcpDebugger.info(`✅ MCP HTTP Server listening on port ${port}`);
      mcpDebugger.info(`MCP endpoint available at http://localhost:${port}/mcp`);
      mcpDebugger.info(`Inspector available at http://localhost:${port}/inspector`);
    });

    httpTerminator = createHttpTerminator({ server });

    // Graceful shutdown handling
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    mcpDebugger.error('❌ Failed to start HTTP server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

async function shutdown() {
  mcpDebugger.info('SIGTERM/SIGINT signal received: closing HTTP server');
  if (httpTerminator) {
    await httpTerminator.terminate();
    mcpDebugger.info('HTTP server closed');
  }
  process.exit(0);
}

// Start the server
startServer();