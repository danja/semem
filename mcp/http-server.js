#!/usr/bin/env node

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from './index.js';

// Load environment variables from .env file
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.MCP_PORT || 3000;
const HOST = process.env.MCP_HOST || 'localhost';

// Session management for stateful operation
const sessions = new Map();

// Create Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Main function to start the server
 */
async function startServer() {
  console.log('Starting Semem HTTP server...');

  try {
    // Create and initialize the MCP server using the centralized factory
    const server = await createServer();

    // Create a transport for the server
    const transport = new StreamableHTTPServerTransport(server, {
      path: '/mcp'
    });

    // Attach MCP transport handler to Express app
    app.use('/mcp', transport.createRequestHandler());

    // Simple status endpoint
    app.get('/status', (req, res) => {
      res.json({
        status: 'ok',
        name: server.name,
        version: server.version,
        sessions: sessions.size,
        timestamp: new Date().toISOString()
      });
    });

    // Serve MCP Inspector static files
    const inspectorPath = path.join(__dirname, '../../node_modules/@modelcontextprotocol/inspector/dist');
    app.use('/inspector', express.static(inspectorPath));

    // Redirect root to inspector
    app.get('/', (req, res) => {
      res.redirect('/inspector');
    });

    // Start listening
    const httpServer = app.listen(PORT, HOST, () => {
      console.log(`✅ Semem HTTP server running on http://${HOST}:${PORT}`);
      console.log(`MCP endpoint available at http://${HOST}:${PORT}/mcp`);
      console.log(`MCP Inspector available at http://${HOST}:${PORT}/inspector`);
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      httpServer.close(() => {
        console.log('HTTP server closed');
        server.close();
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();