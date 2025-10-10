#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../../Config.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Initialize config
const config = new Config(process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json'));
await config.init();

const app = express();
const PORT = process.env.PORT || config.get('servers.workbench');
const API_PORT = config.get('servers.api');
const MCP_PORT = config.get('servers.mcp');
const API_SERVER_URL = process.env.API_SERVER || `http://localhost:${API_PORT}`;
const MCP_SERVER_URL = process.env.MCP_SERVER || `http://localhost:${MCP_PORT}`;

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

// Configuration endpoint for frontend
app.get('/config', (req, res) => {
  res.json({
    apiUrl: '/api', // Use relative URL through proxy
    apiKey: process.env.SEMEM_API_KEY,
    mcpServer: MCP_SERVER_URL
  });
});

// Proxy workflow logs to API server (different path to avoid conflicts)
app.use('/workflow-logs/stream', createProxyMiddleware({
  target: `${API_SERVER_URL}/api/logs/stream`,
  changeOrigin: true,
  ws: false, // Server-sent events use HTTP, not WebSocket
  pathRewrite: {
    '^/workflow-logs/stream': '' // Remove /workflow-logs/stream prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 [WORKFLOW LOGS PROXY] ${req.method} ${req.originalUrl} -> ${API_SERVER_URL}/api/logs/stream${req.url.replace('/workflow-logs/stream', '')}`);
  }
}));

// Proxy document upload API requests to API server
app.use('/api/documents', createProxyMiddleware({
  target: `${API_SERVER_URL}`,
  changeOrigin: true,
  pathRewrite: (path) => {
    const PREFIX = '/api/documents';
    const [pathname, search = ''] = path.split('?');
    let suffix = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : pathname;
    if (suffix && !suffix.startsWith('/')) {
      suffix = `/${suffix}`;
    }
    if (suffix === '/') {
      suffix = '';
    }
    const rewrittenPath = `${PREFIX}${suffix}`;
    return search ? `${rewrittenPath}?${search}` : rewrittenPath;
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`🔄 [WORKBENCH DOC PROXY] ${req.method} ${req.originalUrl} -> ${API_SERVER_URL}${req.url}`);
  },
  onProxyRes: (proxyRes, req) => {
    console.log(`📡 [WORKBENCH DOC PROXY] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
  }
}));

// Proxy remaining /api requests to MCP server (Tell/Ask operations)
app.use('/api', createProxyMiddleware({
  target: MCP_SERVER_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '' // Remove /api prefix when forwarding to MCP server
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 [WORKBENCH PROXY] ${req.method} ${req.originalUrl} -> ${MCP_SERVER_URL}${req.url.replace('/api', '')}`);
    if (req.body) {
      console.log('📤 [WORKBENCH PROXY] Request body length:', JSON.stringify(req.body).length);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📡 [WORKBENCH PROXY] Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);

    let responseBody = '';
    proxyRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    proxyRes.on('end', () => {
      console.log(`📡 [WORKBENCH PROXY] Response body: ${responseBody}`);
    });
  },
  onError: (err, req, res) => {
    console.error('❌ [WORKBENCH PROXY] Proxy error:', err.message);
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
