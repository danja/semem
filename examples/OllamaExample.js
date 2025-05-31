import logger from 'loglevel';
import MemoryManager from '../src/MemoryManager.js';
import JSONStore from '../src/stores/JSONStore.js';
import Config from '../src/Config.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import { fileURLToPath } from 'url';
import path from 'path';

// Set a global timeout to prevent hanging (60 seconds for testing)
const GLOBAL_TIMEOUT_MS = 60 * 1000; // 60 seconds
console.log(`[${new Date().toISOString()}] Setting global timeout to ${GLOBAL_TIMEOUT_MS/1000} seconds`);
const timeoutId = setTimeout(() => {
    console.error(`\n[${new Date().toISOString()}] ERROR: Script timed out after ${GLOBAL_TIMEOUT_MS/1000} seconds`);
    console.error('Current memory usage:', process.memoryUsage());
    process.exit(124); // Standard timeout exit code
}, GLOBAL_TIMEOUT_MS);

let memoryManager = null;

async function shutdown(signal, code = 0) {
    clearTimeout(timeoutId);
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);
    
    if (memoryManager) {
        try {
            await memoryManager.dispose();
            logger.info('Cleanup complete');
        } catch (error) {
            logger.error('Error during cleanup:', error);
            code = code || 1;
        }
    }
    
    process.exit(code);
}

// Set up process event handlers
['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'].forEach(event => {
    process.on(event, async (arg) => {
        if (event === 'uncaughtException') {
            logger.error('Uncaught Exception:', arg);
            await shutdown(event, 1);
        } else if (event === 'unhandledRejection') {
            logger.error('Unhandled Rejection at:', arg);
            await shutdown(event, 1);
        } else {
            await shutdown(event);
        }
    });
});

// Function to extract concepts using Ollama
async function extractConcepts(llm, text) {
    const prompt = `Analyze the following text and extract the key concepts, entities, and topics. 
Return the results as a JSON array of concept objects, each with 'name' and 'type' (e.g., 'PERSON', 'LOCATION', 'TOPIC', 'CONCEPT').

Text: "${text}"`;
    
    try {
        // Use the generateChat method from OllamaConnector
        const response = await llm.generateChat(llm.defaultModel, [
            {
                role: 'user',
                content: prompt
            }
        ], {
            temperature: 0.3,
            format: 'json'
        });
        
        // Try to parse the response as JSON
        try {
            const concepts = JSON.parse(response);
            return Array.isArray(concepts) ? concepts : [];
        } catch (e) {
            logger.warn('Failed to parse LLM response as JSON, trying to extract array from text:', response);
            // Try to extract JSON array from the response
            const jsonMatch = response.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        }
    } catch (error) {
        logger.error('Error extracting concepts:', error);
        return [];
    }
}

async function main() {
    console.log(`[${new Date().toISOString()}] Starting OllamaExample.js`);
    
    try {
        // Initialize configuration
        console.log(`[${new Date().toISOString()}] Initializing configuration...`);
        // Use absolute path to config file
        const configPath = '/home/danny/hyperdata/semem/config/config.json';
        console.log(`[${new Date().toISOString()}] Loading config from: ${configPath}`);
        
        const config = new Config({ configPath });
        console.log(`[${new Date().toISOString()}] Configuration object created`);
        
        // Initialize config
        console.log(`[${new Date().toISOString()}] Initializing config...`);
        await config.init();
        console.log(`[${new Date().toISOString()}] Config initialized`);
        
        // Get SPARQL endpoint configuration
        console.log(`[${new Date().toISOString()}] Getting SPARQL config...`);
        const sparqlConfigs = config.get('sparqlEndpoints');
        console.log(`[${new Date().toISOString()}] Found ${sparqlConfigs ? sparqlConfigs.length : 0} SPARQL endpoints in config`);
        
        if (!sparqlConfigs || sparqlConfigs.length === 0) {
            throw new Error('No SPARQL endpoints configured in config.json');
        }
        
        const sparqlConfig = sparqlConfigs[0];
        console.log(`[${new Date().toISOString()}] Using SPARQL config:`, {
            urlBase: sparqlConfig.urlBase,
            query: sparqlConfig.query,
            update: sparqlConfig.update,
            dataset: sparqlConfig.dataset,
            user: sparqlConfig.user ? '***' : 'not set'
        });
        
        // Ensure we're using the correct endpoint paths
        const endpointUrl = `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`;
        const updateUrl = `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`;
        
        console.log(`[${new Date().toISOString()}] Using SPARQL endpoint: ${endpointUrl}`);
        console.log(`[${new Date().toISOString()}] Using SPARQL update endpoint: ${updateUrl}`);
        
        // Set storage configuration
        console.log(`[${new Date().toISOString()}] Setting up storage configuration...`);
        const storageConfig = {
            type: 'sparql',
            options: {
                endpoint: endpointUrl,
                updateEndpoint: updateUrl,
                user: sparqlConfig.user,
                password: sparqlConfig.password,
                graphName: config.get('graphName') || 'http://danny.ayers.name/content',
                dataset: sparqlConfig.dataset,
                dimension: 1536
            }
        };
        
        console.log(`[${new Date().toISOString()}] Storage config:`, {
            ...storageConfig,
            options: {
                ...storageConfig.options,
                user: storageConfig.options.user ? '***' : 'not set',
                password: storageConfig.options.password ? '***' : 'not set'
            }
        });
        
        config.set('storage', storageConfig);
        
        // Set model configuration
        console.log(`[${new Date().toISOString()}] Setting up model configuration...`);
        const modelsConfig = {
            chat: {
                provider: 'ollama',
                model: 'qwen2:1.5b',
                options: {
                    baseUrl: 'http://localhost:11434'
                }
            },
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text',
                options: {
                    baseUrl: 'http://localhost:11434'
                }
            }
        };
        
        console.log(`[${new Date().toISOString()}] Model config:`, modelsConfig);
        config.set('models', modelsConfig);

        // Initialize storage
        console.log(`[${new Date().toISOString()}] Initializing storage...`);
        let storage;
        
        if (storageConfig.type === 'sparql') {
            try {
                // Use the working configuration from our test script
                const { default: SPARQLStore } = await import('../src/stores/SPARQLStore.js');
                
                // Create the SPARQL store with explicit configuration
                storage = new SPARQLStore(
                    'https://fuseki.hyperdata.it/semem/query',
                    {
                        updateEndpoint: 'https://fuseki.hyperdata.it/semem/update',
                        user: 'admin',
                        password: 'admin123',
                        graphName: 'http://danny.ayers.name/content',
                        dataset: 'semem',
                        dimension: 1536
                    }
                );
                
                // Verify the store connection
                console.log(`[${new Date().toISOString()}] Verifying SPARQL store connection...`);
                const isConnected = await storage.verify();
                console.log(`[${new Date().toISOString()}] SPARQL store verification result:`, isConnected);
                
                if (!isConnected) {
                    throw new Error('Failed to connect to SPARQL store');
                }
                
                console.log(`[${new Date().toISOString()}] Successfully connected to SPARQL store`);
                
                // Test a simple query
                console.log(`[${new Date().toISOString()}] Testing SPARQL query...`);
                const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
                const results = await storage._executeSparqlQuery(testQuery, 'https://fuseki.hyperdata.it/semem/query');
                console.log(`[${new Date().toISOString()}] SPARQL test query results:`, JSON.stringify(results, null, 2));
                
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error initializing SPARQL store:`, error);
                
                // Fallback to JSONStore if SPARQL is not configured
                console.log(`[${new Date().toISOString()}] Using JSONStore as fallback`);
                const { default: JSONStore } = await import('../src/stores/JSONStore.js');
                storage = new JSONStore({ filePath: 'memories.json' });
            }
        } else {
            // Fallback to in-memory store
            console.log(`[${new Date().toISOString()}] Initializing in-memory store`);
            const { default: InMemoryStore } = await import('../src/stores/InMemoryStore.js');
            storage = new InMemoryStore();
            console.log(`[${new Date().toISOString()}] In-memory store initialized successfully`);
        }
        
        const ollama = new OllamaConnector({
            model: config.get('models.chat.model'),
            options: config.get('models.chat.options')
        });

        // Initialize MemoryManager with the storage and models
        console.log('Initializing MemoryManager...');
        memoryManager = new MemoryManager({
            storage,
            models: config.get('models')
        });
        
        // Log successful initialization
        console.log('MemoryManager initialized successfully');
        
        try {
            console.log(`[${new Date().toISOString()}] Initializing Ollama connector...`);
            await ollama.initialize();
            console.log(`[${new Date().toISOString()}] Ollama connector initialized with model:`, config.get('models.chat.model'));
            
            // Verify storage connection one more time
            const isConnected = await storage.verify();
            console.log(`[${new Date().toISOString()}] Final storage connection verified:`, isConnected);
            
            if (!isConnected) {
                throw new Error('Failed to verify final storage connection');
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error during initialization:`, error);
            throw error;
        }

        // Example 1: Simple text concept extraction
        const example1 = "Quantum computing uses quantum bits or qubits to perform calculations. It's being developed by companies like IBM and Google.";
        logger.info('\n=== Example 1: Simple Text ===');
        logger.info('Text:', example1);
        
        const concepts1 = await extractConcepts(ollama, example1);
        logger.info('\nExtracted concepts:');
        concepts1.forEach((concept, i) => {
            logger.info(`${i + 1}. ${concept.name} (${concept.type || 'CONCEPT'})`);
        });

        // Example 2: More complex text with multiple entities and concepts
        const example2 = `The Eiffel Tower, built in 1889, is a wrought-iron lattice tower on the Champ de Mars in Paris, France. 
    // Example 1: Simple text concept extraction
    const example1 = "Quantum computing uses quantum bits or qubits to perform calculations. It's being developed by companies like IBM and Google.";
    logger.info('\n=== Example 1: Simple Text ===');
    logger.info('Text:', example1);
    
    const concepts1 = await extractConcepts(ollama, example1);
    logger.info('\nExtracted concepts:');
    concepts1.forEach((concept, i) => {
        logger.info(`${i + 1}. ${concept.name} (${concept.type || 'CONCEPT'})`);
    });

    // Example 2: More complex text with multiple entities and concepts
    const example2 = `The Eiffel Tower, built in 1889, is a wrought-iron lattice tower on the Champ de Mars in Paris, France. 
    It's named after Gustave Eiffel, whose company designed and built the tower. The tower is 330 meters tall and 
    is one of the most visited monuments in the world, with nearly 7 million visitors annually.`;
    
    logger.info('\n=== Example 2: Complex Text ===');
    logger.info('Text:', example2);
    
    const concepts2 = await extractConcepts(ollama, example2);
    logger.info('\nExtracted concepts:');
    concepts2.forEach((concept, i) => {
        logger.info(`${i + 1}. ${concept.name} (${concept.type || 'CONCEPT'})`);
    });

            // Example 3: Using the MemoryManager's built-in concept extraction
        try {
            logger.info('\n=== Example 3: Using MemoryManager ===');
            const prompt = "What are the main concepts in quantum computing?";
            logger.info('Prompt:', prompt);
            
            const response = await memoryManager.generateResponse(prompt);
            logger.info('Response:', response);
            
            // Extract and log concepts from the response
            const concepts = await extractConcepts(ollama, `${prompt} ${response}`);
            logger.info('\nExtracted concepts from conversation:');
            concepts.forEach((concept, i) => {
                logger.info(`${i + 1}. ${concept.name} (${concept.type || 'CONCEPT'})`);
            });
            
            // Store the interaction with concepts
            const embedding = await memoryManager.generateEmbedding(response);
            await memoryManager.addInteraction(prompt, response, embedding, concepts);
            logger.info('\nInteraction stored with concepts');
                
        } catch (error) {
            logger.error('Error in MemoryManager example:', error);
            throw error;
        }
    } catch (error) {
        logger.error('Error in main function:', error);
        throw error;
    }
}

// Main execution with timeout
(async () => {
    console.log(`[${new Date().toISOString()}] Starting main execution`);
    try {
        await main();
        console.log(`[${new Date().toISOString()}] Main execution completed successfully`);
        await shutdown('success');
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Fatal error in main execution:`, error);
        await shutdown('error', 1);
    }
})();