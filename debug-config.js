import Config from './src/Config.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set the config path explicitly
const configPath = path.join(__dirname, 'config', 'config.json');
console.log('Looking for config at:', configPath);

async function debugConfig() {
    try {
        // Initialize config with explicit path
        const config = new Config(configPath);
        
        // Initialize the config (load from file, apply overrides, etc.)
        await config.init();
        
        // Log configuration details
        console.log('=== Loaded Configuration ===');
        console.log('Storage Config:', JSON.stringify(config.get('storage'), null, 2));
        
        // Log other relevant config sections
        console.log('\nServer Config:', JSON.stringify({
            port: config.get('port'),
            graphName: config.get('graphName')
        }, null, 2));
        
        console.log('\nModel Config:', JSON.stringify({
            chatModel: config.get('chatModel'),
            embeddingModel: config.get('embeddingModel')
        }, null, 2));
        
        console.log('\nConfig file used:', config.configFilePath || 'Using default config');
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        process.exit(1);
    }
}

debugConfig();
