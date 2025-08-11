#!/usr/bin/env node

/**
 * Semem MCP HTTP Server
 * 
 * This script starts the Semem MCP server with HTTP/SSE transport
 * for web-based integrations and Claude Desktop.
 */

// Parse command line arguments to set environment variables  
const args = process.argv.slice(2);

// Show usage if --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Semem MCP HTTP Server

Usage:
  semem-mcp-http [options]
  
Options:
  --port=PORT    Set server port (default: 3000)
  --host=HOST    Set server host (default: localhost)
  --help, -h     Show this help message

Environment Variables:
  MCP_PORT       Port for the HTTP server
  MCP_HOST       Host to bind to
  
Example:
  semem-mcp-http --port=3001 --host=0.0.0.0

For Claude Desktop integration:
{
  "mcpServers": {
    "semem": {
      "command": "npx",
      "args": ["semem-mcp-http", "--port=3000"]
    }
  }
}
`);
  process.exit(0);
}

// Set environment variables from command line args
if (args.find(arg => arg.startsWith('--port='))) {
    process.env.MCP_PORT = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
}
if (args.find(arg => arg.startsWith('--host='))) {
    process.env.MCP_HOST = args.find(arg => arg.startsWith('--host='))?.split('=')[1];
}

// Import and start the HTTP server
import '../mcp/http-server.js';