#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import ServerManager from './server-manager.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Read config file
const configPath = join(projectRoot, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Get server ports from config
const { api, ui, redirect, redirectTarget } = config.servers;

// Create server manager instance
const serverManager = new ServerManager();

// Log the project root and config
console.log(`Project root: ${projectRoot}`);
console.log('Server configuration:', JSON.stringify(config.servers, null, 2));

// Start servers with proper error handling and cleanup
const startServers = async () => {
    try {
        // Start API server
        await serverManager.startServer(
            join(__dirname, 'api-server.js'),
            'API Server',
            api,
            { NODE_ENV: 'production' }
        );

        // Start UI server
        await serverManager.startServer(
            join(__dirname, 'ui-server.js'),
            'UI Server',
            ui,
            { NODE_ENV: 'production' }
        );

        // Start redirect server
        await serverManager.startServer(
            join(__dirname, 'redirect-server.js'),
            'Redirect Server',
            redirect,
            { 
                TARGET_PORT: redirectTarget,
                NODE_ENV: 'production' 
            }
        );

        console.log('\n--- All servers started successfully! ---');
        console.log(`- API Server:      http://localhost:${api}`);
        console.log(`- UI Server:       http://localhost:${ui}`);
        console.log(`- Redirect Server: http://localhost:${redirect} -> http://localhost:${redirectTarget}`);
        console.log('\nPress Ctrl+C to stop all servers');
        
    } catch (error) {
        console.error('\n❌ Error starting servers:', error.message);
        await serverManager.stopAllServers();
        process.exit(1);
    }
};

// Handle manual shutdown via Ctrl+C
process.stdin.setRawMode(true);
process.stdin.on('data', async (data) => {
    // Ctrl+C or 'q' to quit
    if (data.toString() === '\x03' || data.toString().toLowerCase() === 'q') {
        console.log('\nShutting down servers...');
        await serverManager.stopAllServers();
        process.exit(0);
    }
});

// Start all servers
startServers();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    process.exit(0);
});
