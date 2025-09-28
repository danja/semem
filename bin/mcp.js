#!/usr/bin/env node

/**
 * Semem MCP Server Binary
 * 
 * This is the main entry point for the MCP (Model Context Protocol) server.
 * It's designed to be used with Claude's MCP integration:
 * 
 * Usage: claude mcp add semem npx semem-mcp
 */

import { createServer } from '../_mcp/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  try {
    // Parse command line arguments/mcp
    const args = process.argv.slice(2);
    const transport = args.includes('--http') ? 'http' :
      args.includes('--sse') ? 'sse' : 'stdio';

    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 && args[portIndex + 1] ?
      parseInt(args[portIndex + 1]) : 3000;

    const configIndex = args.indexOf('--config');
    const configPath = configIndex !== -1 && args[configIndex + 1] ?
      args[configIndex + 1] : undefined;

    // Start the MCP server
    const server = await createServer();

    // Create and connect transport
    const serverTransport = new StdioServerTransport();
    await server.connect(serverTransport);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down MCP server...');
      if (server && server.close) {
        await server.close();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down MCP server...');
      if (server && server.close) {
        await server.close();
      }
      process.exit(0);
    });

    // For stdio transport, the server runs until the connection closes
    if (transport === 'stdio') {
      // Keep the process alive for stdio transport
      process.stdin.resume();
    } else {
      console.log(`Semem MCP server running on ${transport}${port ? `:${port}` : ''}`);
      console.log('Press Ctrl+C to stop');
    }

  } catch (error) {
    console.error('Failed to start Semem MCP server:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main();