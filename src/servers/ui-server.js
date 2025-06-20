#!/usr/bin/env node

import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();
import UIServer from '../services/search/UIServer.js';
import Config from '../Config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure logging
const logLevel = process.env.LOG_LEVEL || 'info';
logger.setLevel(logLevel);

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(path.dirname(__filename))); // Go up two levels to project root

// Load configuration using Config.js (which includes SPARQL endpoints)
let config = {
    port: parseInt(process.env.PORT) || 4120, // Updated port to 4120
    graphName: process.env.GRAPH_NAME || 'http://hyperdata.it/content',
    chatModel: process.env.CHAT_MODEL || 'qwen2:1.5b',
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text'
};

// Initialize Config.js to get SPARQL endpoints and other settings  
async function loadConfig() {
    try {
        const configPath = process.argv[2] || process.env.CONFIG_FILE;
        const configInstance = new Config(configPath);
        await configInstance.init();
        
        // Extract SPARQL endpoints from Config.js
        config.sparqlEndpoints = configInstance.config.sparqlEndpoints;
        
        // Extract graph name from Config.js if available
        if (configInstance.config.graphName) {
            config.graphName = configInstance.config.graphName;
        }
        
        // Extract other relevant config
        if (configInstance.config.models) {
            config.chatModel = configInstance.config.models.chat?.model || config.chatModel;
            config.embeddingModel = configInstance.config.models.embedding?.model || config.embeddingModel;
        }
        
        logger.info('Loaded Config.js with SPARQL endpoints:', config.sparqlEndpoints?.map(e => e.label));
        
    } catch (error) {
        logger.warn(`Failed to load Config.js: ${error.message}, using defaults`);
        
        // Fallback: try to load from JSON file if Config.js fails
        const configPath = process.argv[2] || process.env.CONFIG_FILE;
        if (configPath) {
            try {
                const configFile = path.resolve(__dirname, configPath);
                logger.info(`Loading configuration from ${configFile}`);
                const configData = fs.readFileSync(configFile, 'utf8');
                const fileConfig = JSON.parse(configData);
                config = { ...config, ...fileConfig };
            } catch (error) {
                logger.error(`Failed to load configuration file: ${error.message}`);
            }
        }
    }
}

await loadConfig();

// Add SPARQL endpoints from environment if provided
if (process.env.SPARQL_ENDPOINTS) {
    try {
        config.sparqlEndpoints = JSON.parse(process.env.SPARQL_ENDPOINTS);
    } catch (error) {
        logger.error(`Failed to parse SPARQL_ENDPOINTS: ${error.message}`);
    }
}

// Add LLM providers from environment if provided
if (process.env.LLM_PROVIDERS) {
    try {
        config.llmProviders = JSON.parse(process.env.LLM_PROVIDERS);
    } catch (error) {
        logger.error(`Failed to parse LLM_PROVIDERS: ${error.message}`);
    }
}

logger.info('Using configuration:', config);

// Create and start the server
const server = new UIServer(config);

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
logger.info('Starting UI Server...');
server.start().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});