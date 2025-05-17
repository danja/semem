#!/usr/bin/env node

import logger from 'loglevel';
import { EmbeddingService, SPARQLService } from './src/services/embeddings/index.js';
import EmbeddingCreator from './src/services/embeddings/EmbeddingCreator.js';

// Configure logging
logger.setLevel('info');

// Parse command line arguments
const args = process.argv.slice(2);
let limit = 0;
let graphName = 'http://hyperdata.it/content';
// let graphName = 'http://danny.ayers.name/content';
// Simple argument parsing
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && i + 1 < args.length) {
        limit = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--graph' && i + 1 < args.length) {
        graphName = args[i + 1];
        i++;
    } else if (args[i] === '--help') {
        console.log(`
Embedding Creator - Generate and store embeddings for articles in a SPARQL store

Usage:
  node embedding-creator.js [options]

Options:
  --limit <number>  Limit the number of articles to process (0 for all)
  --graph <uri>     URI of the graph to process (default: http://danny.ayers.name/content)
  --help            Show this help message

Example:
  node embedding-creator.js --limit 10
  node embedding-creator.js --graph http://example.org/articles
        `);
        process.exit(0);
    }
}

// Initialize services
const embeddingService = new EmbeddingService();
const sparqlService = new SPARQLService({
    queryEndpoint: 'http://localhost:4030/semem/query',
    updateEndpoint: 'http://localhost:4030/semem/update',
    graphName: graphName,
    auth: {
        user: 'admin',
        password: 'admin123'
    }
});

const creator = new EmbeddingCreator({
    embeddingService,
    sparqlService,
    graphName
});

// Handle shutdown
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    process.exit(0);
});

// Run the embedding creator
logger.info(`Starting embedding creation for graph: ${graphName}${limit ? ` (limit: ${limit})` : ''}`);

creator.run({ limit })
    .then(() => {
        logger.info('Embedding creation completed successfully');
        process.exit(0);
    })
    .catch(error => {
        logger.error('Embedding creation failed:', error);
        process.exit(1);
    });