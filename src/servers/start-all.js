#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import ServerManager from './server-manager.js';
import Config from '../Config.js';

// Load environment variables from .env file
dotenv.config();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__dirname));

// Use consolidated config system
console.log('Current working directory:', process.cwd());
const configPath = join(projectRoot, 'config', 'config.json');
const configInstance = Config.createFromFile(configPath);
await configInstance.init();
const config = configInstance.config;

// Get server ports from config
const { api, workbench, mcp } = config.servers;

// Create server manager instance
const serverManager = new ServerManager();

// Log the project root, config, and config path
console.log(`Project root: ${projectRoot}`);
console.log('Config path used:', configPath);
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

        // Start Workbench server
        await serverManager.startServer(
            join(projectRoot, 'src', 'frontend', 'workbench', 'server.js'),
            'Workbench UI',
            workbench,
            { 
                NODE_ENV: 'production',
                MCP_SERVER: `http://localhost:${mcp}`,
                cwd: join(projectRoot, 'src', 'frontend', 'workbench')
            }
        );

        // Start MCP server (using the http-server.js implementation)
        await serverManager.startServer(
            join(projectRoot, 'mcp', 'http-server.js'),
            'MCP Server',
            mcp,
            { 
                NODE_ENV: 'production',
                cwd: join(projectRoot, 'mcp')
            }
        );

        console.log('\n--- All servers started successfully! ---');
        console.log(`- API Server:      http://localhost:${api}`);
        console.log(`- Workbench UI:    http://localhost:${workbench}`);
        console.log(`- MCP Server:      http://localhost:${mcp}`);
        console.log('\nPress Ctrl+C to stop all servers');

    } catch (error) {
        console.error('\n❌ Error starting servers:', error.message);
        await serverManager.stopAllServers();
        process.exit(1);
    }
};

// Handle manual shutdown via Ctrl+C (only if running interactively)
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', async (data) => {
        // Ctrl+C or 'q' to quit
        if (data.toString() === '\x03' || data.toString().toLowerCase() === 'q') {
            console.log('\nShutting down servers...');
            await serverManager.stopAllServers();
            process.exit(0);
        }
    });
}

// Start all servers
startServers();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    process.exit(0);
});
