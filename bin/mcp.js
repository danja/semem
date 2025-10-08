#!/usr/bin/env node

/**
 * Semem MCP STDIO entrypoint (refactored architecture)
 *
 * This binary delegates to the new `src/mcp` implementation and ensures
 * we don't accidentally fall back to the deprecated `_mcp` tree.
 */

import { startMCPServer } from '../src/mcp/index.js';
import { mcpDebugger } from '../src/mcp/lib/debug-utils.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    mcpDebugger.info(`Semem MCP STDIO Server

Usage:
  semem-mcp             # Start STDIO transport (default)

For HTTP/SSE transport, use:
  semem-mcp-http --port=4101
`);
    return;
  }

  if (args.some(option => option === '--http' || option === '--sse')) {
    mcpDebugger.warn('HTTP/SSE transports moved to `semem-mcp-http`. Ignoring deprecated flag.');
  }

  try {
    await startMCPServer();
    mcpDebugger.info('✅ Semem MCP STDIO server started');
  } catch (error) {
    mcpDebugger.error('💥 Failed to start Semem MCP server', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

main();
