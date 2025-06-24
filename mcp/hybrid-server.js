#!/usr/bin/env node

/**
 * Hybrid MCP Server - Supports both STDIO and HTTP transports
 * This allows the inspector to connect via STDIO while also serving HTTP
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './index.js';
import { mcpDebugger } from './lib/debug-utils.js';

/**
 * Check if we're being called for STDIO (inspector) or HTTP
 */
function getTransportMode() {
  // If stdin is a TTY, we're probably being run directly for HTTP
  // If stdin is being piped to, we're probably being called by the inspector
  return process.stdin.isTTY ? 'http' : 'stdio';
}

async function startHybridServer() {
  const mode = getTransportMode();
  mcpDebugger.info(`🚀 Starting Hybrid MCP Server in ${mode.toUpperCase()} mode...`);

  try {
    // Create the MCP server instance
    const mcpServer = await createServer();

    if (mode === 'stdio') {
      // STDIO mode for inspector
      mcpDebugger.info('📡 Starting STDIO transport for MCP Inspector...');
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
      mcpDebugger.info('✅ MCP Server connected to STDIO transport');
      
    } else {
      // HTTP mode for direct access
      mcpDebugger.info('🌐 Starting HTTP transport for direct access...');
      
      // Import HTTP server functionality
      const { startOptimizedServer } = await import('./http-server.js');
      await startOptimizedServer();
    }

  } catch (error) {
    mcpDebugger.error('❌ Failed to start hybrid server:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startHybridServer().catch(console.error);
}

export { startHybridServer };