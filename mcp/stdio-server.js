#!/usr/bin/env node

/**
 * STDIO MCP Server for Inspector Integration
 * This server runs in STDIO mode for the MCP Inspector to connect to
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './index.js';
import { mcpDebugger } from './lib/debug-utils.js';

async function startStdioServer() {
  try {
    mcpDebugger.info('🚀 Starting MCP Server in STDIO mode for Inspector...');

    // Create the MCP server instance
    const mcpServer = await createServer();

    // Create STDIO transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await mcpServer.connect(transport);

    mcpDebugger.info('✅ MCP Server connected to STDIO transport');

  } catch (error) {
    mcpDebugger.error('❌ Failed to start STDIO server:', error);
    process.exit(1);
  }
}

// Start the server
startStdioServer().catch(console.error);