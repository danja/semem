/**
 * Memory Embedding SPARQL Example
 * 
 * This example demonstrates SPARQL store integration for semantic memory
 * management with RDF/SPARQL storage backend functionality.
 * 
 * Key features demonstrated:
 * - SPARQL endpoint connectivity and authentication
 * - RDF triple storage for semantic memory
 * - Semantic querying with vector similarity
 * - Data persistence across sessions
 * - Integration with semantic web standards
 * - Memory initialization with SPARQL backend
 * - Embedding generation and RDF storage
 */

import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global cleanup reference
let globalCleanup = null;

async function shutdown(signal) {
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);
    if (globalCleanup) {
        try {
            await globalCleanup();
            logger.info('Cleanup complete');
            process.exit(0);
        } catch (error) {
            logger.error('Error during cleanup:', error);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    await shutdown('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown('unhandledRejection');
});

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');

    logger.info('🚀 Starting Memory Embedding SPARQL Integration Example');

    // Initialize configuration
    const config = new Config();
    await config.init();

    // Get SPARQL endpoint configuration
    const sparqlEndpoints = config.get('sparqlEndpoints');
    if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
        throw new Error('No SPARQL endpoints configured. Please check your config.');
    }

    let memoryManager = null;
    
    try {
        logger.info('\n=== Testing SPARQL Endpoint Connectivity ===');
        
        let workingEndpoint = null;
        let sparqlConfig = null;
        
        // Test endpoints from configuration
        for (const endpoint of sparqlEndpoints) {
            try {
                sparqlConfig = {
                    query: `${endpoint.urlBase}${endpoint.query}`,
                    update: `${endpoint.urlBase}${endpoint.update}`
                };
                
                logger.info(`Testing: ${sparqlConfig.query}`);
                
                const testStore = new SPARQLStore(sparqlConfig, {
                    user: endpoint.user || 'admin',
                    password: endpoint.password || 'admin123',
                    graphName: 'http://purl.org/stuff/semem/test-connectivity',
                    dimension: 1536
                });
                
                await testStore.verify();
                logger.info('✓ Connection successful');
                workingEndpoint = endpoint;
                break;
                
            } catch (error) {
                logger.warn(`✗ Failed: ${error.message}`);
            }
        }
        
        if (!workingEndpoint) {
            throw new Error('No working SPARQL endpoints found. Please check your configuration.');
        }
        
        logger.info('\n=== Initializing Memory Manager with SPARQL Store ===');
        
        // Create SPARQL store with working endpoint
        const sparqlStore = new SPARQLStore(sparqlConfig, {
            user: workingEndpoint.user || 'admin',
            password: workingEndpoint.password || 'admin123',
            graphName: 'http://purl.org/stuff/semem/memory-demo',
            dimension: 1536
        });
        
        // Initialize embedding connector using configuration
        const embeddingProvider = config.get('embeddingProvider') || 'ollama';
        const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
        const chatModel = config.get('chatModel') || 'qwen2:1.5b';
        
        logger.info(`Using embedding provider: ${embeddingProvider}`);
        logger.info(`Embedding model: ${embeddingModel}`);
        logger.info(`Chat model: ${chatModel}`);
        
        // Create embedding connector using configuration
        let providerConfig = {};
        if (embeddingProvider === 'nomic') {
            providerConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: embeddingModel
            };
        } else if (embeddingProvider === 'ollama') {
            const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
            providerConfig = {
                provider: 'ollama',
                baseUrl: ollamaBaseUrl,
                model: embeddingModel
            };
            logger.info(`Using Ollama at: ${ollamaBaseUrl}`);
        }
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
        
        memoryManager = new MemoryManager({
            llmProvider: embeddingConnector, // Use embedding connector as primary provider
            embeddingProvider: embeddingConnector,
            chatModel,
            embeddingModel,
            storage: sparqlStore
        });
        
        logger.info(`✓ SPARQL-backed memory manager initialized with ${embeddingProvider} connector`);
        
        // Set up cleanup function
        globalCleanup = async () => {
            if (memoryManager) {
                try {
                    await memoryManager.dispose();
                    logger.info('Memory manager disposed cleanly');
                } catch (disposeError) {
                    logger.error('Error disposing memory manager:', disposeError);
                }
            }
        };
        
        // Store semantic data
        logger.info('\n=== Storing Semantic Data in RDF Store ===');
        
        const semanticInteractions = [
            {
                prompt: "What is RDF?",
                response: "RDF (Resource Description Framework) is a standard model for data interchange on the Web using subject-predicate-object triples.",
                concepts: ["RDF", "semantic web", "triples", "W3C"]
            },
            {
                prompt: "How does SPARQL work?",
                response: "SPARQL is a query language for RDF data that allows pattern matching against graph data using triple patterns.",
                concepts: ["SPARQL", "query language", "RDF", "graph patterns"]
            },
            {
                prompt: "What are knowledge graphs?",
                response: "Knowledge graphs are structured representations of knowledge using entities, relationships, and semantic metadata.",
                concepts: ["knowledge graphs", "entities", "relationships", "semantic data"]
            },
            {
                prompt: "What is a triplestore?",
                response: "A triplestore is a database designed specifically for storing and querying RDF triples, the fundamental unit of semantic web data.",
                concepts: ["triplestore", "database", "RDF", "storage"]
            }
        ];
        
        for (const interaction of semanticInteractions) {
            logger.info(`Storing: "${interaction.prompt}"`);
            
            const embedding = await memoryManager.generateEmbedding(
                `${interaction.prompt} ${interaction.response}`
            );
            
            await memoryManager.addInteraction(
                interaction.prompt,
                interaction.response,
                embedding,
                interaction.concepts
            );
            
            logger.info('✓ Stored in RDF triple store');
        }
        
        // Test semantic querying
        logger.info('\n=== Testing Semantic Memory Retrieval ===');
        
        const semanticQueries = [
            "Tell me about semantic web technologies",
            "How do I query RDF data?",
            "What's the structure of knowledge representation?",
            "How are triples stored in databases?"
        ];
        
        for (const query of semanticQueries) {
            logger.info(`\nQuery: "${query}"`);
            
            const memories = await memoryManager.retrieveRelevantInteractions(query);
            
            logger.info(`Retrieved ${memories.length} relevant memories:`);
            
            memories.slice(0, 2).forEach((memory, idx) => {
                const interaction = memory.interaction || memory;
                const similarity = memory.similarity?.toFixed(3) || 'N/A';
                const concepts = (interaction.concepts || []).join(', ');
                
                logger.info(`  ${idx + 1}. Similarity: ${similarity}`);
                logger.info(`     Subject: "${interaction.prompt}"`);
                logger.info(`     Concepts: [${concepts}]`);
            });
        }
        
        // Test response generation with memory context
        logger.info('\n=== Testing Response Generation with Memory Context ===');
        
        const testPrompt = "Explain how semantic web technologies work together";
        logger.info(`Prompt: "${testPrompt}"`);
        
        const relevantContext = await memoryManager.retrieveRelevantInteractions(testPrompt);
        const response = await memoryManager.generateResponse(testPrompt, [], relevantContext);
        
        logger.info(`Response: "${response}"`);
        logger.info(`Used ${relevantContext.length} memories for context`);
        
        // Test persistence verification
        logger.info('\n=== Verifying RDF Persistence ===');
        
        // Create a new memory manager to test loading from SPARQL
        const newMemoryManager = new MemoryManager({
            llmProvider,
            chatModel,
            embeddingModel,
            storage: new SPARQLStore(sparqlConfig, {
                user: workingEndpoint.user || 'admin',
                password: workingEndpoint.password || 'admin123',
                graphName: 'http://purl.org/stuff/semem/memory-demo',
                dimension: 1536
            })
        });
        
        const persistedMemories = await newMemoryManager.retrieveRelevantInteractions("RDF and SPARQL");
        logger.info(`✓ Successfully loaded ${persistedMemories.length} memories from RDF store`);
        
        await newMemoryManager.dispose();
        
        logger.info('\n=== Example Completed Successfully ===');
        logger.info('\nWhat was demonstrated:');
        logger.info('✓ SPARQL endpoint connectivity and authentication');
        logger.info('✓ RDF triple storage for semantic memory');
        logger.info('✓ Semantic querying with vector similarity');
        logger.info('✓ Data persistence across sessions');
        logger.info('✓ Integration with semantic web standards');
        logger.info('✓ Response generation using memory context');
        logger.info('✓ Configuration-driven endpoint management');
        
    } catch (error) {
        logger.error('\n❌ Example failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running (e.g., Apache Fuseki)');
        logger.info('- Check endpoint URLs and authentication in config.json');
        logger.info('- Verify network connectivity to SPARQL server');
        logger.info('- Ensure Ollama is running for embedding generation');
        logger.info('- Check that required models are available: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});