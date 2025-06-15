#!/usr/bin/env node

/**
 * Simple Stdio to HTTP Bridge for Semem MCP
 * Processes one request at a time from stdin to HTTP server
 */

import http from 'http';
import { createReadStream } from 'fs';

let inputBuffer = '';

// Read all input from stdin
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
  let chunk;
  while (null !== (chunk = process.stdin.read())) {
    inputBuffer += chunk;
  }
});

process.stdin.on('end', async () => {
  const lines = inputBuffer.trim().split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      await processRequest(line.trim());
    }
  }
});

async function processRequest(jsonData) {
  return new Promise((resolve, reject) => {
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
          resolve();
        } catch (error) {
          console.error('SSE parse error:', error);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Bridge error:', error);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Handle cleanup
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});