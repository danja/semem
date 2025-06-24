#!/usr/bin/env node

/**
 * Simple MCP HTTP Server Test
 * Tests basic MCP server functionality over HTTP
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
const port = 3001;

async function createSimpleServer() {
  // Create a minimal MCP server
  const server = new Server({
    name: "semem-test",
    version: "0.1.0",
    instructions: "Test MCP server for Semem"
  });

  // Add a simple tool for testing
  server.tool("test_tool", "A simple test tool", {
    type: "object",
    properties: {
      message: { type: "string", description: "Test message" }
    }
  }, async (args) => {
    return { 
      content: [{ 
        type: "text", 
        text: `Test tool received: ${args.message}` 
      }]
    };
  });

  return server;
}

async function startTestServer() {
  try {
    console.log('🚀 Starting Simple MCP HTTP Server...');

    // Create simple MCP server
    const mcpServer = await createSimpleServer();

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: false,
      onsessioninitialized: (sessionId) => {
        console.log(`MCP session initialized: ${sessionId}`);
      }
    });
    
    // Connect server to transport (this will start the transport automatically)
    await mcpServer.connect(transport);
    
    // Configure Express
    app.use(cors());
    app.use(express.json());

    // MCP endpoint
    app.post('/mcp', (req, res) => {
      transport.handleRequest(req, res, req.body);
    });

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Start server
    const server = app.listen(port, () => {
      console.log(`✅ Test MCP HTTP Server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    });

  } catch (error) {
    console.error('❌ Failed to start test server:', error);
    process.exit(1);
  }
}

startTestServer();