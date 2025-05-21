#!/usr/bin/env node

import express from 'express';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

const app = express();
const PORT = 3000;
const TARGET_PORT = 4100;
const TARGET_HOST = 'localhost';

// Ensure we're in the right directory
process.chdir(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// Set up the redirect middleware
app.use((req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const isApiRequest = req.path.startsWith('/api/');
    
    // Check if it's a browser request
    const isBrowser = userAgent.includes('Mozilla') || 
                     userAgent.includes('Chrome') || 
                     userAgent.includes('Safari') || 
                     userAgent.includes('Edge') || 
                     userAgent.includes('Firefox');
    
    // Only redirect browser requests to the UI, let API requests go through to the API server
    if (isBrowser || !isApiRequest) {
        const targetUrl = `http://${TARGET_HOST}:${TARGET_PORT}${req.originalUrl}`;
        logger.info(`Redirecting browser request from port ${PORT} to ${targetUrl}`);
        return res.redirect(302, targetUrl);
    } else {
        // For API requests, let them go through to the API server
        logger.info(`Allowing API request through: ${req.originalUrl}`);
        res.sendStatus(404); // API server not implemented on this port
    }
});

// Start the server
app.listen(PORT, () => {
    logger.info(`Redirect server running on port ${PORT} -> ${TARGET_PORT}`);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down redirect server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down redirect server...');
    process.exit(0);
});