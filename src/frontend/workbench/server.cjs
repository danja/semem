#!/usr/bin/env node

/**
 * Simple HTTP server for Semantic Memory Workbench
 * Serves static files and proxies API requests to MCP server
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
const MCP_SERVER = process.env.MCP_SERVER || 'http://localhost:3000';

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'text/plain';
}

async function proxyRequest(req, res) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            'host': 'localhost:3000'
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500);
        res.end('Proxy error');
    });

    if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
}

function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Proxy API requests to MCP server
    if (url.pathname.startsWith('/tell') || 
        url.pathname.startsWith('/ask') ||
        url.pathname.startsWith('/augment') ||
        url.pathname.startsWith('/zoom') ||
        url.pathname.startsWith('/pan') ||
        url.pathname.startsWith('/tilt') ||
        url.pathname.startsWith('/state') ||
        url.pathname.startsWith('/api/')) {
        proxyRequest(req, res);
        return;
    }

    // Serve static files
    let filePath;
    
    if (url.pathname === '/' || url.pathname === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else {
        filePath = path.join(__dirname, url.pathname);
    }

    // Security check - ensure we don't serve files outside the workbench directory
    const workbenchDir = __dirname;
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(workbenchDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    serveFile(filePath, res);
});

server.listen(PORT, () => {
    console.log(`🧠 Semantic Memory Workbench server running on http://localhost:${PORT}`);
    console.log(`🔗 Proxying API requests to MCP server at ${MCP_SERVER}`);
    console.log(`📁 Serving files from ${__dirname}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log(`💡 Try: PORT=${PORT + 1} node server.js`);
    } else {
        console.error('❌ Server error:', err);
    }
});