#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const PORT = process.env.PORT || 4102;
const MCP_SERVER_URL = process.env.MCP_SERVER || 'http://localhost:4101';

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'workbench',
    timestamp: new Date().toISOString(),
    mcpServer: MCP_SERVER_URL
  });
});

// Proxy API requests to MCP server  
app.use('/api', createProxyMiddleware({
  target: MCP_SERVER_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '' // Remove /api prefix when forwarding
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({
      error: 'MCP server unavailable',
      message: err.message
    });
  }
}));

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`🧠 Semantic Memory Workbench running on http://localhost:${PORT}`);
  console.log(`📡 Proxying API requests to ${MCP_SERVER_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down workbench server...');
  server.close(() => {
    console.log('Workbench server closed');
  });
});

export default app;