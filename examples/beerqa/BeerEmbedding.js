#!/usr/bin/env node

/**
 * BeerEmbedding.js - BeerQA Corpuscle Embedding Generation System
 * 
 * This script demonstrates how to:
 * 1. Load configuration from config/config.json
 * 2. Connect to the SPARQL endpoint containing BeerQA data
 * 3. Query for ragno:Corpuscle instances from http://purl.org/stuff/beerqa graph
 * 4. Generate vector embeddings for corpuscle content using configured provider
 * 5. Store the embeddings back into the SPARQL store
 * 
 * The script processes BeerQA corpuscles (question-answer pairs) and creates
 * embedding vectors that can be used for semantic search and similarity matching.
 * 
 * Prerequisites:
 * - BeerQA data loaded via BeerETL.js (ragno:Corpuscle instances)
 * - Configured embedding provider (Nomic, Ollama, etc.) with API keys in .env
 * - SPARQL endpoint (Fuseki) configured and accessible
 * - config/config.json properly configured with embeddingProvider setting
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import MemoryManager from '../../src/MemoryManager.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import Config from '../../src/Config.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';

// Configure logging
logger.setLevel('info'); // Set to debug for more verbose output

let memoryManager = null;

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('                🍺 BEER QA EMBEDDING GENERATOR                ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('        Generate embeddings for BeerQA ragno:Corpuscles      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
    logger.info(chalk.yellow(`\nReceived ${signal}, starting graceful shutdown...`));
    if (memoryManager) {
        try {
            await memoryManager.dispose();
            logger.info(chalk.green('Cleanup complete'));
            process.exit(0);
        } catch (error) {
            logger.error(chalk.red('Error during cleanup:'), error);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

// Process signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', async (error) => {
    logger.error(chalk.red('Uncaught Exception:'), error);
    await shutdown('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
    logger.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
    await shutdown('unhandledRejection');
});

/**
 * Execute SPARQL query with error handling
 */
async function executeQuery(sparqlStore, query) {
    try {
        logger.debug(chalk.blue(`🔍 Executing SPARQL query to endpoint: ${sparqlStore.endpoint.query}`));
        const result = await sparqlStore._executeSparqlQuery(query, sparqlStore.endpoint.query);
        logger.debug(chalk.green(`✅ Query executed successfully, returned ${result.results?.bindings?.length || 0} results`));
        return result;
    } catch (error) {
        logger.error(chalk.red('❌ Error executing SPARQL query:'), error.message);
        logger.error(chalk.yellow('🔧 Troubleshooting tips:'));
        logger.error(chalk.white('   1. Ensure the SPARQL endpoint is running'));
        logger.error(chalk.white('   2. Verify the endpoint URL is correct'));
        logger.error(chalk.white('   3. Check authentication credentials'));
        logger.error(chalk.white('   4. Ensure the BeerQA graph exists'));
        throw error;
    }
}

/**
 * Store embedding for a corpuscle
 */
async function storeCorpuscleEmbedding(sparqlStore, corpuscleUri, embedding) {
    try {
        logger.debug(chalk.blue(`🔄 Storing embedding for corpuscle: ${corpuscleUri}`));

        // Prepare the embedding as a JSON string
        const embeddingStr = JSON.stringify(embedding);
        logger.debug(chalk.gray(`📦 Serialized embedding to JSON (${embeddingStr.length} characters)`));

        // SPARQL update query to add the embedding to the corpuscle
        const updateQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            INSERT DATA {
                GRAPH <${sparqlStore.graphName}> {
                    <${corpuscleUri}> ragno:hasEmbedding """${embeddingStr}""" .
                }
            }
        `;

        logger.debug(chalk.blue(`💾 Executing SPARQL update to endpoint: ${sparqlStore.endpoint.update}`));

        // Execute the update
        await sparqlStore._executeSparqlUpdate(updateQuery, sparqlStore.endpoint.update);
        
        logger.debug(chalk.green(`✅ Successfully stored embedding for corpuscle: ${corpuscleUri}`));
        return true;
    } catch (error) {
        logger.error(chalk.red(`❌ Failed to store embedding for corpuscle ${corpuscleUri}:`), error.message);
        throw error;
    }
}

/**
 * Check for existing corpuscles in the BeerQA graph
 */
async function checkExistingCorpuscles(sparqlStore) {
    logger.info(chalk.yellow('🔍 Checking for existing BeerQA corpuscles...'));

    const countQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        
        SELECT (COUNT(?corpuscle) as ?count) WHERE {
            GRAPH <${sparqlStore.graphName}> {
                ?corpuscle a ragno:Corpuscle .
            } 
        }
    `;

    try {
        const result = await executeQuery(sparqlStore, countQuery);
        const count = parseInt(result.results.bindings[0]?.count?.value || '0');
        logger.info(chalk.cyan(`📊 Found ${count} existing corpuscles in the BeerQA graph`));
        return count;
    } catch (error) {
        logger.error(chalk.red('❌ Error checking existing corpuscles:'), error.message);
        return 0;
    }
}

/**
 * Check for corpuscles that already have embeddings
 */
async function checkExistingEmbeddings(sparqlStore) {
    logger.info(chalk.yellow('🔍 Checking for corpuscles with existing embeddings...'));

    const embeddingCountQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        
        SELECT (COUNT(?corpuscle) as ?count) WHERE {
            GRAPH <${sparqlStore.graphName}> {
                ?corpuscle a ragno:Corpuscle ;
                          ragno:hasEmbedding ?embedding .
            } 
        }
    `;

    try {
        const result = await executeQuery(sparqlStore, embeddingCountQuery);
        const count = parseInt(result.results.bindings[0]?.count?.value || '0');
        logger.info(chalk.cyan(`📊 Found ${count} corpuscles with existing embeddings`));
        return count;
    } catch (error) {
        logger.error(chalk.red('❌ Error checking existing embeddings:'), error.message);
        return 0;
    }
}

/**
 * Display configuration information
 */
function displayConfiguration(config, sparqlStore, embeddingProvider, embeddingModel) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(sparqlStore.endpoint.query)}`);
    console.log(`   ${chalk.cyan('Target Graph:')} ${chalk.white(sparqlStore.graphName)}`);
    console.log(`   ${chalk.cyan('Embedding Provider:')} ${chalk.white(embeddingProvider)}`);
    console.log(`   ${chalk.cyan('Embedding Model:')} ${chalk.white(embeddingModel)}`);
    console.log('');
}

/**
 * Display processing statistics
 */
function displayStatistics(processed, successful, failed, totalTime) {
    console.log(chalk.bold.white('📊 Processing Statistics:'));
    console.log(`   ${chalk.cyan('Total Processed:')} ${chalk.bold.green(processed.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Successful:')} ${chalk.bold.green(successful.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Failed:')} ${chalk.bold.red(failed.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.bold.green(((successful / processed) * 100).toFixed(1) + '%')}`);
    console.log(`   ${chalk.cyan('Total Time:')} ${chalk.bold.green((totalTime / 1000).toFixed(2) + 's')}`);
    console.log(`   ${chalk.cyan('Avg Time/Corpuscle:')} ${chalk.bold.green((totalTime / processed).toFixed(0) + 'ms')}`);
    console.log('');
}

/**
 * Main function
 */
async function main() {
    displayHeader();

    try {
        // Initialize configuration from config file
        logger.info(chalk.yellow('⚙️  Initializing configuration...'));
        const configPath = 'config/config.json';
        const config = new Config(configPath);
        await config.init();
        logger.info(chalk.green('✅ Configuration loaded successfully'));

        // Get SPARQL endpoint from config
        logger.info(chalk.yellow('🔗 Loading SPARQL endpoint configuration...'));
        const sparqlEndpoint = config.get('sparqlEndpoints.0');
        if (!sparqlEndpoint) {
            throw new Error('No SPARQL endpoint configured');
        }

        // Create SPARQL store for BeerQA graph
        const endpoint = {
            query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
            update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
        };

        const beerQAGraphName = 'http://purl.org/stuff/beerqa'; // BeerQA specific graph
        
        const sparqlStore = new SPARQLStore(
            endpoint,
            {
                graphName: beerQAGraphName,
                user: sparqlEndpoint.user,
                password: sparqlEndpoint.password
            }
        );

        // Create embedding connector using configuration
        logger.info(chalk.yellow('🤖 Initializing embedding connector...'));
        const embeddingProvider = config.get('embeddingProvider') || 'ollama';
        const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
        
        // Get provider-specific configuration
        let providerConfig = {};
        if (embeddingProvider === 'nomic') {
            providerConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: embeddingModel
            };
        } else if (embeddingProvider === 'ollama') {
            providerConfig = {
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: embeddingModel
            };
        }
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
        logger.info(chalk.green(`✅ Created ${embeddingProvider} embedding connector`));

        // Initialize memory manager
        logger.info(chalk.yellow(`🧠 Setting up MemoryManager...`));
        memoryManager = new MemoryManager({
            llmProvider: embeddingConnector,
            embeddingProvider: embeddingConnector,
            embeddingModel: embeddingModel,
            storage: sparqlStore
        });

        // Display configuration
        displayConfiguration(config, sparqlStore, embeddingProvider, embeddingModel);

        // Verify SPARQL store connectivity
        logger.info(chalk.yellow('🔍 Verifying SPARQL store connectivity...'));
        try {
            await sparqlStore.verify();
            logger.info(chalk.green('✅ SPARQL store connection verified'));
        } catch (error) {
            logger.error(chalk.red('❌ Failed to verify SPARQL store:'), error);
            await shutdown('SPARQL verification failed');
            return;
        }

        // Check for existing data
        const existingCount = await checkExistingCorpuscles(sparqlStore);
        if (existingCount === 0) {
            logger.error(chalk.red('❌ No BeerQA corpuscles found in the graph!'));
            logger.info(chalk.yellow('💡 Please run BeerETL.js first to load BeerQA data'));
            await shutdown('No corpuscles found');
            return;
        }

        const existingEmbeddings = await checkExistingEmbeddings(sparqlStore);
        if (existingEmbeddings === existingCount) {
            logger.info(chalk.green('✅ All corpuscles already have embeddings!'));
            logger.info(chalk.yellow('💡 Use --force flag to regenerate embeddings (not implemented)'));
            await shutdown('All embeddings exist');
            return;
        }

        // Query for corpuscles without embeddings
        logger.info(chalk.yellow('🔍 Querying for corpuscles to process...'));
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?corpuscle ?content WHERE {
                GRAPH <${beerQAGraphName}> {
                    ?corpuscle a ragno:Corpuscle ;
                              ragno:content ?content .
                    FILTER NOT EXISTS {
                        ?corpuscle ragno:hasEmbedding ?existing .
                    }
                } 
            }
        `;

        const results = await executeQuery(sparqlStore, query);
        const corpuscles = results.results.bindings;

        logger.info(chalk.cyan(`📚 Found ${corpuscles.length} corpuscles to process for embedding generation`));
        
        if (corpuscles.length === 0) {
            logger.info(chalk.green('✅ All corpuscles already have embeddings!'));
            await shutdown('No corpuscles to process');
            return;
        }

        console.log(chalk.bold.yellow('🚀 Starting embedding generation...'));
        console.log('');

        let successCount = 0;
        let errorCount = 0;
        const startTime = Date.now();

        // Process each corpuscle
        for (let i = 0; i < corpuscles.length; i++) {
            const corpuscle = corpuscles[i];
            const corpuscleUri = corpuscle.corpuscle.value;
            const content = corpuscle.content.value;

            console.log(chalk.bold.cyan(`📄 Processing corpuscle ${i + 1}/${corpuscles.length}`));
            console.log(`   ${chalk.gray('URI:')} ${chalk.white(corpuscleUri)}`);
            console.log(`   ${chalk.gray('Content length:')} ${chalk.white(content.length + ' characters')}`);
            console.log(`   ${chalk.gray('Preview:')} ${chalk.dim(content.substring(0, 80) + '...')}`);

            try {
                // Generate embedding for content
                console.log(`   ${chalk.yellow('🤖 Generating embedding...')}`);
                const embeddingStartTime = Date.now();
                const embedding = await memoryManager.generateEmbedding(content);
                const embeddingTime = Date.now() - embeddingStartTime;

                console.log(`   ${chalk.green('✅ Embedding generated')} ${chalk.gray(`(${embeddingTime}ms, ${embedding.length}D)`)}`);

                // Store the embedding
                console.log(`   ${chalk.yellow('💾 Storing embedding...')}`);
                await storeCorpuscleEmbedding(sparqlStore, corpuscleUri, embedding);
                successCount++;

                console.log(`   ${chalk.bold.green('✅ Corpuscle processed successfully')}`);

                // Rate limiting between requests
                if (i < corpuscles.length - 1) {
                    console.log(`   ${chalk.dim('⏱️  Waiting 500ms...')}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (error) {
                logger.error(chalk.red(`❌ Failed to process corpuscle ${corpuscleUri}:`), error.message);
                errorCount++;
                // Continue with next corpuscle
            }

            console.log('');
        }

        const totalTime = Date.now() - startTime;

        // Display final results
        console.log(chalk.bold.green('🎉 EMBEDDING GENERATION COMPLETED!'));
        console.log('');
        
        displayStatistics(corpuscles.length, successCount, errorCount, totalTime);

        if (successCount > 0) {
            console.log(chalk.bold.green('🔍 Success! You can now perform semantic search on BeerQA corpuscles'));
            console.log(chalk.white('💡 Embeddings are stored with predicate ragno:hasEmbedding'));
            console.log(chalk.white('🎯 Use the embeddings for similarity search and clustering'));
            console.log('');
            
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • ${chalk.white('Query embeddings:')} SELECT ?corpuscle ?embedding WHERE { ?corpuscle ragno:hasEmbedding ?embedding }`);
            console.log(`   • ${chalk.white('Use semantic search:')} Find similar questions using vector similarity`);
            console.log(`   • ${chalk.white('Cluster corpuscles:')} Group by embedding similarity`);
        }

    } catch (error) {
        logger.error(chalk.red('❌ Error during execution:'), error);
    } finally {
        await shutdown('Finished');
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(async (error) => {
        logger.error(chalk.red('Fatal error:'), error);
        await shutdown('fatal error');
    });
}

export { main as runBeerEmbedding };