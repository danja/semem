#!/usr/bin/env node

/**
 * HTTP to Stdio Bridge for MCP
 * This bridges Claude Desktop (stdio) to our HTTP MCP server
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const HTTP_SERVER_URL = 'http://localhost:3002/mcp';

async function main() {
  // Create stdio transport for Claude Desktop
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['-e', `
      const http = require('http');
      const https = require('https');
      
      process.stdin.on('data', (data) => {
        const request = JSON.parse(data.toString());
        
        const options = {
          hostname: 'localhost',
          port: 3002,
          path: '/mcp',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };
        
        const req = http.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            process.stdout.write(responseData);
          });
        });
        
        req.on('error', (error) => {
          console.error('Error:', error);
          process.exit(1);
        });
        
        req.write(data);
        req.end();
      });
    `]
  });

  // Connect to the HTTP server via the bridge
  const client = new Client(
    {
      name: "semem-bridge",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  
  // Keep the bridge alive
  process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
  });
}

main().catch(console.error);