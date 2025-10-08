#!/usr/bin/env node

/**
 * Semem MCP Integration Server
 * Simplified entry point using refactored architecture
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure .env is loaded from the project root, regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..'); // Resolve to 'src/mcp' -> 'semem'
dotenv.config({ path: path.join(projectRoot, '.env') });

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpDebugger } from './lib/debug-utils.js';
import { createMCPServer } from './server/server-factory.js';

/**
 * Main entry point
 */
async function main() {
  try {
    mcpDebugger.info('🚀 Starting Semem MCP Server...');

    // Create the MCP server with all handlers configured
    const server = await createMCPServer();

    // Create STDIO transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    mcpDebugger.info('✅ Semem MCP Server started successfully on STDIO transport');

    // Handle graceful shutdown
    const shutdown = async (signal) => {
      mcpDebugger.info(`📤 Received ${signal}, shutting down gracefully...`);
      try {
        await server.close();
        mcpDebugger.info('✅ Server closed successfully');
        process.exit(0);
      } catch (error) {
        mcpDebugger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      mcpDebugger.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      mcpDebugger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    mcpDebugger.error('💥 Failed to start Semem MCP Server:', error);
    process.exit(1);
  }
}

// Export server creation function for testing
export { createMCPServer };

export async function startMCPServer() {
  return main();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    mcpDebugger.error('💥 Fatal error in main:', error);
    process.exit(1);
  });
}
