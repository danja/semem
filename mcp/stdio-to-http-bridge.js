#!/usr/bin/env node

/**
 * Stdio to HTTP Bridge for Semem MCP
 * Bridges Claude Desktop's stdio transport to our HTTP MCP server
 */

import http from 'http';

const HTTP_SERVER_URL = 'http://localhost:3002/mcp';

// Read from stdin, forward to HTTP server, write response to stdout
process.stdin.on('data', async (data) => {
  try {
    const jsonData = data.toString().trim();
    if (!jsonData) return;
    
    // Forward request to HTTP server
    const postData = jsonData;
    
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        // Parse SSE response and extract JSON data
        try {
          const lines = responseData.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonData = line.substring(6); // Remove 'data: ' prefix
              process.stdout.write(jsonData + '\n');
              break;
            }
          }
        } catch (error) {
          console.error('SSE parse error:', error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Bridge error:', error);
      process.exit(1);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('JSON parse error:', error);
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Handle cleanup
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});