#!/usr/bin/env node

/**
 * VSOM Standalone Server
 * Simple static file server for the standalone VSOM page
 * Follows patterns from workbench server
 */

import dotenv from 'dotenv';
import express from 'express';
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

class VSOMStandaloneServer {
    constructor(options = {}) {
        this.config = config; // Use the already initialized config
        this.port = options.port || process.env.PORT || 4103;
        this.app = express();
        this.publicDir = path.join(__dirname, 'public');
        
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        // Static file serving
        this.app.use(express.static(this.publicDir, {
            maxAge: '1h',
            etag: true,
            lastModified: true
        }));
        
        // JSON parsing
        this.app.use(express.json());
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'vsom-standalone',
                timestamp: new Date().toISOString(),
                port: this.port,
                environment: process.env.NODE_ENV || 'development'
            });
        });
        
        // Serve SPARQL query files
        this.app.use('/sparql', express.static(path.join(projectRoot, 'sparql'), {
            maxAge: '1h',
            etag: true,
            setHeaders: (res, path) => {
                if (path.endsWith('.sparql')) {
                    res.setHeader('Content-Type', 'application/sparql-query');
                }
            }
        }));

        // API proxy routes (forward to main MCP server)
        this.setupApiProxy();

        // SPA fallback - serve index.html for any non-API routes
        this.app.get('*', (req, res) => {
            // Skip API routes
            if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            
            res.sendFile(path.join(this.publicDir, 'index.html'));
        });
        
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    setupApiProxy() {
        // Proxy API requests to the main MCP HTTP server
        const mcpPort = this.config.get('servers.mcp') || 4101;
        const mcpServerUrl = process.env.MCP_HTTP_URL || `http://localhost:${mcpPort}`;
        
        this.app.use('/api', async (req, res) => {
            try {
                const url = `${mcpServerUrl}${req.path}`;
                const options = {
                    method: req.method,
                    headers: {
                        'Content-Type': 'application/json',
                        // Filter out content-length to let fetch calculate it correctly
                        ...Object.fromEntries(
                            Object.entries(req.headers).filter(([key]) =>
                                key.toLowerCase() !== 'content-length' &&
                                key.toLowerCase() !== 'host'
                            )
                        )
                    }
                };

                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    options.body = JSON.stringify(req.body);
                }

                const response = await fetch(url, options);
                const data = await response.text();
                
                res.status(response.status);
                
                // Forward response headers
                for (const [key, value] of response.headers.entries()) {
                    if (!key.startsWith(':') && key !== 'content-encoding') {
                        res.set(key, value);
                    }
                }
                
                // Try to parse as JSON, fallback to text
                try {
                    res.json(JSON.parse(data));
                } catch {
                    res.send(data);
                }
                
            } catch (error) {
                console.error(`API proxy error for ${req.path}:`, error);
                res.status(502).json({
                    error: 'Bad Gateway',
                    message: 'Unable to reach MCP server',
                    mcpServerUrl: mcpServerUrl,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    
    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`🗺️  VSOM Standalone Server running at http://localhost:${this.port}`);
                console.log(`📁  Serving files from: ${this.publicDir}`);
                const mcpPort = this.config.get('servers.mcp') || 4101;
                const mcpServerUrl = process.env.MCP_HTTP_URL || `http://localhost:${mcpPort}`;
                console.log(`🔗  API proxy to: ${mcpServerUrl}`);
                resolve();
            });
        });
    }
    
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('🛑 VSOM Standalone Server stopped');
                    resolve();
                });
            });
        }
    }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (global.vsomServer) {
        await global.vsomServer.stop();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (global.vsomServer) {
        await global.vsomServer.stop();
    }
    process.exit(0);
});

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const server = new VSOMStandaloneServer();
        global.vsomServer = server;
        await server.start();
    } catch (error) {
        console.error('Failed to start VSOM Standalone Server:', error);
        process.exit(1);
    }
}

export default VSOMStandaloneServer;