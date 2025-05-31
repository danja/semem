import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import JSONStore from '../src/stores/JSONStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import { fileURLToPath } from 'url';
import path from 'path';

let memoryManager = null

async function shutdown(signal) {
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`)
    if (memoryManager) {
        try {
            await memoryManager.dispose()
            logger.info('Cleanup complete')
            process.exit(0)
        } catch (error) {
            logger.error('Error during cleanup:', error)
            process.exit(1)
        }
    } else {
        process.exit(0)
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error)
    await shutdown('uncaughtException')
})
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
    await shutdown('unhandledRejection')
})

// Function to extract concepts using Ollama
async function extractConcepts(llm, text) {
    const prompt = `Analyze the following text and extract the key concepts, entities, and topics. 
Return the results as a JSON array of concept objects, each with 'name' and 'type' (e.g., 'PERSON', 'LOCATION', 'TOPIC', 'CONCEPT').

Text: "${text}"`;
    
    try {
        const response = await llm.chat({
            messages: [{
                role: 'user',
                content: prompt
            }],
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
    // Get the current directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    
    // Initialize config
    const config = new Config();
    await config.init();
    
    // Get SPARQL endpoint configuration
    const sparqlConfig = config.get('sparqlEndpoints')[0];
    if (!sparqlConfig) {
        throw new Error('No SPARQL endpoints configured in config.json');
    }
    
    const endpointUrl = `${sparqlConfig.urlBase}${sparqlConfig.query}`;
    const updateUrl = `${sparqlConfig.urlBase}${sparqlConfig.update}`;
    
    logger.info('Using SPARQL endpoint:', endpointUrl);
    logger.info('Using SPARQL update endpoint:', updateUrl);
    
    // Set storage configuration
    config.set('storage', {
        type: 'sparql',
        options: {
            endpoint: endpointUrl,
            updateEndpoint: updateUrl,
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: config.get('graphName') || 'http://danny.ayers.name/content',
            dataset: sparqlConfig.dataset
        }
    });
    
    config.set('models', {
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
    })

    // Initialize SPARQL store
    const storageConfig = config.get('storage');
    let storage;
    
    if (storageConfig.type === 'sparql') {
        // Get the first SPARQL endpoint from config
        const sparqlEndpoint = config.get('sparqlEndpoints')[0];
        if (!sparqlEndpoint) {
            throw new Error('No SPARQL endpoints configured');
        }
        
        // Use the exact URL that works with curl
        const queryUrl = 'https://fuseki.hyperdata.it/semem/query';
        const updateUrl = 'https://fuseki.hyperdata.it/semem/update';
        
        logger.info('Using hardcoded SPARQL endpoints:');
        
        logger.info('Initializing SPARQL store with endpoints:', {
            queryUrl,
            updateUrl,
            graphName: storageConfig.options.graphName
        });
        
        // Test the query endpoint with a simple request
        try {
            logger.info('Testing SPARQL query endpoint...');
            const testResponse = await fetch(queryUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1'
            });
            
            if (!testResponse.ok) {
                const errorText = await testResponse.text();
                logger.error(`SPARQL endpoint test failed (${testResponse.status}): ${errorText}`);
            } else {
                const result = await testResponse.json();
                logger.info('SPARQL endpoint test successful, found', result.results.bindings.length, 'results');
            }
        } catch (error) {
            logger.error('SPARQL endpoint test failed:', error);
        }
        
        const { default: SPARQLStore } = await import('../src/stores/SPARQLStore.js');
        storage = new SPARQLStore(queryUrl, {
            updateEndpoint: updateUrl,
            user: sparqlEndpoint.user,
            password: sparqlEndpoint.password,
            graphName: storageConfig.options.graphName,
            dimension: config.get('memory.dimension') || 1536
        });
        
        try {
            // Test connection
            const isConnected = await storage.verify();
            logger.info(`SPARQL store connection verified: ${isConnected}`);
        } catch (error) {
            logger.error('Failed to connect to SPARQL store:', error);
            throw error;
        }
    } else {
        // Fallback to in-memory store
        logger.info('Initializing in-memory store');
        const { default: InMemoryStore } = await import('../src/stores/InMemoryStore.js');
        storage = new InMemoryStore();
        logger.info('In-memory store initialized successfully');
    }
    
    const ollama = new OllamaConnector({
        model: config.get('models.chat.model'),
        options: config.get('models.chat.options')
    });

    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    });
    
    // Verify SPARQL connection
    try {
        const isConnected = await storage.verify();
        logger.info('SPARQL store connection verified:', isConnected);
    } catch (error) {
        logger.error('Failed to connect to SPARQL store:', error);
        throw error;
    }

    // Initialize the LLM connector
    await ollama.initialize();
    logger.info('Ollama connector initialized with model:', config.get('models.chat.model'));

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
    }
}

main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})