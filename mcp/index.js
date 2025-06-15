#!/usr/bin/env node

/**
 * Semem MCP Integration Server
 * Modular ES6 implementation with enhanced debugging
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import debugging utilities
import { mcpDebugger } from './lib/debug-utils.js';

// Import configuration
import { mcpConfig } from './lib/config.js';
import { initializeServices } from './lib/initialization.js';

// Import tool registrations
import { registerMemoryTools } from './tools/memory-tools.js';
import { registerMemoryToolsFixed } from './tools/memory-tools-fixed.js';
import { registerMemoryToolsHttp } from './tools/memory-tools-http.js';

// Import resource registrations  
import { registerStatusResources } from './resources/status-resource.js';
import { registerStatusResourcesHttp } from './resources/status-resource-http.js';

/**
 * Create and configure MCP server
 */
async function createServer() {
  mcpDebugger.info('Creating MCP server with config', mcpConfig);
  
  // Create MCP server instance using HTTP version pattern
  const server = new Server(mcpConfig, {
    capabilities: {
      tools: {},
      resources: {}
    }
  });

  // Add debugging hooks to server
  const originalSetRequestHandler = server.setRequestHandler;
  server.setRequestHandler = function(schema, handler) {
    const wrappedHandler = async (request) => {
      mcpDebugger.logProtocolMessage('incoming', request.method, request.params);
      try {
        const result = await handler(request);
        mcpDebugger.logProtocolMessage('outgoing', request.method, null, result);
        return result;
      } catch (error) {
        mcpDebugger.logProtocolMessage('outgoing', request.method, null, null, error);
        throw error;
      }
    };
    return originalSetRequestHandler.call(this, schema, wrappedHandler);
  };

  // Initialize services
  mcpDebugger.info('Initializing services...');
  await initializeServices();
  mcpDebugger.info('Services initialized successfully');

  // Register all tools using HTTP pattern
  mcpDebugger.info('Registering memory tools...');
  
  // Choose which tools to register based on environment
  if (process.env.MCP_USE_HTTP_TOOLS !== 'false') {
    registerMemoryToolsHttp(server);
  } else if (process.env.MCP_USE_FIXED_TOOLS !== 'false') {
    registerMemoryToolsFixed(server);
  } else {
    registerMemoryTools(server);
  }

  // Register all resources using HTTP pattern  
  mcpDebugger.info('Registering status resources...');
  if (process.env.MCP_USE_HTTP_TOOLS !== 'false') {
    registerStatusResourcesHttp(server);
  } else {
    registerStatusResources(server);
  }

  mcpDebugger.info('MCP server creation complete');
  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    mcpDebugger.info('🚀 Starting Semem MCP Integration Server...');

    // Create server
    const server = await createServer();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    mcpDebugger.info('✅ Semem MCP server running on stdio transport');

  } catch (error) {
    mcpDebugger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createServer };