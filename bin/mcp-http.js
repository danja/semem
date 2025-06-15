#!/usr/bin/env node

/**
 * Semem MCP HTTP Server
 * 
 * This script starts the Semem MCP server with HTTP/SSE transport
 * for web-based integrations and Claude Desktop.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from '../mcp/http-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const port = args.find(arg => arg.startsWith('--port='))?.split('=')[1] || process.env.MCP_PORT || 3000;
const host = args.find(arg => arg.startsWith('--host='))?.split('=')[1] || process.env.MCP_HOST || 'localhost';

// Set environment variables
process.env.MCP_PORT = port;
process.env.MCP_HOST = host;

// Show usage if --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Semem MCP HTTP Server

Usage:
  semem-mcp-http [options]

Options:
  --port=<port>    Port to run the HTTP server on (default: 3000)
  --host=<host>    Host to bind to (default: localhost)
  --help, -h       Show this help message

Environment Variables:
  MCP_PORT         Port for the HTTP server
  MCP_HOST         Host to bind to
  
Integration URL:
  http://<host>:<port>/mcp

Example:
  semem-mcp-http --port=4000 --host=127.0.0.1
  
For Claude Desktop configuration, add to your config:
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["${__dirname}/../mcp/http-server.js"],
      "env": {
        "MCP_PORT": "3000",
        "MCP_HOST": "localhost"
      }
    }
  }
}
`);
  process.exit(0);
}

console.log(`🚀 Starting Semem MCP HTTP Server on http://${host}:${port}`);
startServer().catch(console.error);