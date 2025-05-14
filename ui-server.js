#!/usr/bin/env node

import logger from 'loglevel';
import SearchServer from './src/services/search/SearchServer.js';

// Configure logging
logger.setLevel('info');

// Create and start the server
const server = new SearchServer({
    port: 4100,
    graphName: 'http://danny.ayers.name/content'
});

// Handle shutdown
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
});

// Start the server
logger.info('Starting Article Search Server...');
server.start().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});