#!/usr/bin/env node

/**
 * Semem MCP Integration Server
 * Modular ES6 implementation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import configuration
import { mcpConfig } from './lib/config.js';
import { initializeServices } from './lib/initialization.js';

// Import tool registrations
import { registerMemoryTools } from './tools/memory-tools.js';

// Import resource registrations  
import { registerStatusResources } from './resources/status-resource.js';

/**
 * Create and configure MCP server
 */
async function createServer() {
  // Create MCP server instance
  const server = new McpServer(mcpConfig);

  // Initialize services
  await initializeServices();

  // Register all tools
  registerMemoryTools(server);

  // Register all resources
  registerStatusResources(server);

  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log('🚀 Starting Semem MCP Integration Server...');

    // Create server
    const server = await createServer();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.log('✅ Semem MCP server running on stdio transport');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createServer };