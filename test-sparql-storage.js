import Config from './src/Config.js';
import MemoryManager from './src/MemoryManager.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';
import InMemoryStore from './src/stores/InMemoryStore.js';
import logger from 'loglevel';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
logger.setLevel('debug');

async function testSparqlStorage() {
    try {
        // Set the config path explicitly
        const configPath = path.join(__dirname, 'config', 'config.json');
        console.log('Using config file:', configPath);
        
        // Load configuration
        const config = new Config(configPath);
        await config.init();
        
        // Get storage configuration
        const storageConfig = config.get('storage');
        const dimension = config.get('memory.dimension') || 1536;
        
        console.log('Storage config:', JSON.stringify(storageConfig, null, 2));
        
        logger.info('Testing SPARQL storage configuration...');
        logger.info(`Storage type: ${storageConfig.type}`);
        logger.info(`Endpoint: ${storageConfig.options.endpoint}`);
        
        // Initialize storage based on config
        let storage;
        if (storageConfig.type === 'sparql') {
            const { default: SPARQLStore } = await import('./src/stores/SPARQLStore.js');
            
            // Get the first SPARQL endpoint from config
            const sparqlEndpoint = config.get('sparqlEndpoints')[0];
            if (!sparqlEndpoint) {
                throw new Error('No SPARQL endpoints configured');
            }
            
            // Construct the full endpoint URLs
            const endpoint = {
                query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
                update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
            };
            
            console.log('Using SPARQL endpoints:', JSON.stringify(endpoint, null, 2));
            
            storage = new SPARQLStore(endpoint, {
                user: sparqlEndpoint.user,
                password: sparqlEndpoint.password,
                graphName: storageConfig.options.graphName,
                dimension: dimension
            });
            logger.info('Initialized SPARQL store');
            
            // Test connection
            const isConnected = await storage.verify();
            logger.info(`SPARQL store connection verified: ${isConnected}`);
            
            // Test save and load
            const testMemory = {
                shortTermMemory: [{
                    id: 'test-1',
                    prompt: 'Test prompt',
                    output: 'Test output',
                    embedding: new Array(dimension).fill(0.1),
                    timestamp: Date.now(),
                    accessCount: 1,
                    concepts: ['test'],
                    decayFactor: 1.0
                }],
                longTermMemory: [],
                embeddings: [new Array(dimension).fill(0.1)],
                timestamps: [Date.now()],
                accessCounts: [1],
                conceptsList: [['test']]
            };
            
            logger.info('Saving test memory...');
            await storage.saveMemoryToHistory(testMemory);
            
            logger.info('Loading memory history...');
            const [shortTerm, longTerm] = await storage.loadHistory();
            logger.info(`Loaded ${shortTerm.length} short-term and ${longTerm.length} long-term memories`);
            
            if (shortTerm.length > 0) {
                logger.info('First memory:', {
                    id: shortTerm[0].id,
                    prompt: shortTerm[0].prompt,
                    output: shortTerm[0].output
                });
            }
            
        } else {
            logger.warn('SPARQL storage not configured. Set storage.type to "sparql" in config.json');
        }
        
    } catch (error) {
        logger.error('Error testing SPARQL storage:', error);
        process.exit(1);
    }
}

testSparqlStorage();
