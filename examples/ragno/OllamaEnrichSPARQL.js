import logger from 'loglevel';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js';
import Entity from '../../src/ragno/Entity.js';
import RDFGraphManager from '../../src/ragno/core/RDFGraphManager.js';
import NamespaceManager from '../../src/ragno/core/NamespaceManager.js';
import rdf from 'rdf-ext';
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

    logger.info('🚀 Starting Ollama Example with SPARQL Store and Ragno Vocabulary');

    // Initialize configuration
    const config = new Config();
    await config.init();

    // Get SPARQL endpoint configuration
    const sparqlEndpoints = config.get('sparqlEndpoints');
    if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
        throw new Error('No SPARQL endpoints configured. Please check your config.');
    }

    const endpoint = sparqlEndpoints[0];
    const sparqlConfig = {
        query: `${endpoint.urlBase}${endpoint.query}`,
        update: `${endpoint.urlBase}${endpoint.update}`
    };

    logger.info(`Using SPARQL endpoint: ${sparqlConfig.query}`);

    // Initialize SPARQL store with Ragno graph
    const storage = new SPARQLStore(sparqlConfig, {
        user: endpoint.user || 'admin',
        password: endpoint.password || 'admin123',
        graphName: 'http://purl.org/stuff/ragno/corpus/ollama-example',
        dimension: 1536
    });

    // Initialize Ollama connector for embeddings
    const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
    const embeddingModel = 'nomic-embed-text';
    const chatModel = 'qwen2:1.5b'; // Use a commonly available small model

    logger.info(`Using Ollama at: ${ollamaBaseUrl}`);
    logger.info(`Embedding model: ${embeddingModel}`);
    logger.info(`Chat model: ${chatModel}`);

    const ollamaConnector = new OllamaConnector(ollamaBaseUrl, chatModel);

    // Initialize cache manager
    const cacheManager = new CacheManager({
        maxSize: 1000,
        ttl: 3600000 // 1 hour
    });

    // Initialize handlers
    const embeddingHandler = new EmbeddingHandler(
        ollamaConnector,
        embeddingModel,
        1536,
        cacheManager
    );

    const llmHandler = new LLMHandler(ollamaConnector, chatModel);

    // Initialize RDF infrastructure for Ragno
    const namespaceManager = new NamespaceManager();
    const rdfManager = new RDFGraphManager({ namespace: namespaceManager });
    const dataset = rdf.dataset();

    // Set up cleanup function
    globalCleanup = async () => {
        // No specific cleanup needed for these components
        logger.info('Cleaning up resources...');
    };

    try {
        logger.info('\n=== Processing Sample Content ===');

        // Sample content to process
        const textChunks = [
            {
                content: "Artificial Intelligence has revolutionized many industries. Machine Learning algorithms enable computers to learn from data without explicit programming. Deep Learning, a subset of ML, uses neural networks with multiple layers. Geoffrey Hinton is often called the 'Godfather of AI' for his pioneering work in deep learning.",
                source: "ai_overview.txt",
                metadata: { topic: "AI", author: "Example", year: 2024 }
            },
            {
                content: "Large Language Models like GPT and Claude have transformed natural language processing. These models are trained on vast amounts of text data and can generate human-like responses. They use transformer architectures with attention mechanisms.",
                source: "llm_overview.txt",
                metadata: { topic: "LLM", author: "Example", year: 2024 }
            }
        ];

        logger.info(`Processing ${textChunks.length} text chunks...`);

        // Decompose corpus into Ragno RDF entities and semantic units
        logger.info('\n=== Decomposing Corpus into Ragno Elements ===');
        const decompositionResult = await decomposeCorpus(textChunks, llmHandler, {
            extractRelationships: true,
            generateSummaries: true,
            minEntityConfidence: 0.3,
            maxEntitiesPerUnit: 10
        });

        const { units, entities, relationships, dataset: ragnoDataset } = decompositionResult;

        logger.info(`✓ Created ${units.length} semantic units`);
        logger.info(`✓ Extracted ${entities.length} entities`);
        logger.info(`✓ Found ${relationships.length} relationships`);

        // Display extracted entities
        if (entities.length > 0) {
            logger.info('\n=== Extracted Entities ===');
            entities.forEach((entity, index) => {
                const label = entity.getPrefLabel();
                const isEntryPoint = entity.isEntryPoint();
                const subType = entity.getSubType();
                logger.info(`${index + 1}. ${label} (Entry Point: ${isEntryPoint}, Type: ${subType || 'general'})`);
            });
        }

        // Generate embeddings for entities and store in SPARQL
        logger.info('\n=== Generating Embeddings and Storing in SPARQL ===');

        for (const entity of entities) {
            try {
                const entityLabel = entity.getPrefLabel();
                const entityContent = entity.getContent() || entityLabel;

                logger.info(`Generating embedding for: ${entityLabel}`);

                // Generate embedding using Ollama
                const embedding = await embeddingHandler.generateEmbedding(entityContent);

                if (embedding && embedding.length === 1536) {
                    // Store entity with embedding in SPARQL store
                    const entityData = {
                        id: entity.getURI(),
                        prompt: entityLabel,
                        response: entityContent,
                        embedding: embedding,
                        concepts: [entityLabel], // Use entity label as concept
                        timestamp: new Date().toISOString(),
                        metadata: {
                            type: 'ragno:Entity',
                            subType: entity.getSubType(),
                            isEntryPoint: entity.isEntryPoint(),
                            ragnoGraph: 'http://purl.org/stuff/ragno/corpus/ollama-example'
                        }
                    };

                    await storage.store(entityData);
                    logger.info(`✓ Stored entity: ${entityLabel} with ${embedding.length}D embedding`);
                } else {
                    logger.warn(`Failed to generate valid embedding for: ${entityLabel}`);
                }

            } catch (error) {
                logger.error(`Error processing entity ${entity.getPrefLabel()}:`, error.message);
            }
        }

        // Store semantic units as well
        logger.info('\n=== Storing Semantic Units ===');

        for (const unit of units) {
            try {
                const unitContent = unit.getContent();
                const unitSummary = unit.getSummary();

                if (unitContent) {
                    logger.info(`Generating embedding for semantic unit...`);

                    // Generate embedding for the unit
                    const embedding = await embeddingHandler.generateEmbedding(unitContent);

                    if (embedding && embedding.length === 1536) {
                        const unitData = {
                            id: unit.getURI(),
                            prompt: unitSummary || unitContent.substring(0, 100) + '...',
                            response: unitContent,
                            embedding: embedding,
                            concepts: [unitSummary || 'semantic_unit'],
                            timestamp: new Date().toISOString(),
                            metadata: {
                                type: 'ragno:Unit',
                                summary: unitSummary,
                                source: unit.getSourceDocument(),
                                ragnoGraph: 'http://purl.org/stuff/ragno/corpus/ollama-example'
                            }
                        };

                        await storage.store(unitData);
                        logger.info(`✓ Stored semantic unit with ${embedding.length}D embedding`);
                    }
                }

            } catch (error) {
                logger.error(`Error processing semantic unit:`, error.message);
            }
        }

        // Test retrieval functionality
        logger.info('\n=== Testing Retrieval ===');

        const testQuery = "What is artificial intelligence?";
        logger.info(`Query: ${testQuery}`);

        // Generate query embedding
        const queryEmbedding = await embeddingHandler.generateEmbedding(testQuery);

        if (queryEmbedding) {
            // Search for similar items
            const searchResults = await storage.search(queryEmbedding, 5, 0.3);

            logger.info(`Found ${searchResults.length} similar items:`);
            searchResults.forEach((result, index) => {
                logger.info(`${index + 1}. Score: ${result.similarity.toFixed(3)} - ${result.prompt}`);
                if (result.metadata?.type) {
                    logger.info(`   Type: ${result.metadata.type}`);
                }
            });
        }

        logger.info('\n=== Ragno-Enhanced Processing Complete ===');
        logger.info('✓ Text corpus decomposed into RDF semantic elements');
        logger.info('✓ Entities extracted using Ragno vocabulary');
        logger.info('✓ Embeddings generated with Ollama nomic-embed-text');
        logger.info('✓ Data stored in SPARQL triplestore');
        logger.info('✓ Retrieval functionality tested');

        // Final statistics
        logger.info('\n=== Final Statistics ===');
        logger.info(`Semantic Units: ${units.length}`);
        logger.info(`Entities: ${entities.length}`);
        logger.info(`Relationships: ${relationships.length}`);
        logger.info(`SPARQL Graph: http://purl.org/stuff/ragno/corpus/ollama-example`);

    } catch (error) {
        logger.error('Error during execution:', error);
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});