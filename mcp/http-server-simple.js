/**
 * Simple MCP HTTP Server
 * Uses the same createServer function as the STDIO server
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

console.log('🚀 Starting Simple MCP HTTP Server...');

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Static file serving for MCP Inspector
const inspectorPath = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist');
console.log('📁 Inspector path:', inspectorPath);
app.use(express.static(inspectorPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'semem-mcp-http-server'
  });
});

// Main server setup
async function main() {
  try {
    console.log('🔧 Creating MCP server...');
    const server = await createServer();
    console.log('✅ MCP server created');

    console.log('🔧 Creating HTTP transport...');
    const transport = new StreamableHTTPServerTransport(app, '/mcp');
    console.log('✅ HTTP transport created');

    console.log('🔧 Connecting server to transport...');
    await server.connect(transport);
    console.log('✅ Server connected to transport');

    // Start Express server
    app.listen(port, () => {
      console.log(`🚀 MCP HTTP Server running on http://localhost:${port}`);
      console.log(`📊 MCP Inspector available at http://localhost:${port}`);
      console.log(`🔗 MCP endpoint at http://localhost:${port}/mcp`);
      console.log(`❤️ Health check at http://localhost:${port}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);