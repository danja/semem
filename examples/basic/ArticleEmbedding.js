/**
 * ArticleEmbedding.js - Semantic Article Processing System
 * 
 * This script demonstrates how to:
 * 1. Load configuration from config/config.json
 * 2. Connect to a SPARQL endpoint for data storage
 * 3. Insert test articles if none exist in the database
 * 4. Generate vector embeddings for article content using Ollama
 * 5. Store the embeddings back into the SPARQL store
 * 
 * The script processes articles with schema:articleBody content and creates
 * embedding vectors that can be used for semantic search and similarity matching.
 * 
 * Prerequisites:
 * - Ollama running with nomic-embed-text model
 * - SPARQL endpoint (Fuseki) configured and accessible
 * - config/config.json properly configured
 */

import path from 'path'
import logger from 'loglevel'
import MemoryManager from '../../src/MemoryManager.js'
import SPARQLStore from '../../src/stores/SPARQLStore.js'
import Config from '../../src/Config.js'
import OllamaConnector from '../../src/connectors/OllamaConnector.js'
import { v4 as uuidv4 } from 'uuid'

// Configure logging
logger.setLevel('debug') // Set to debug for more verbose output

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

async function executeQuery(sparqlStore, query) {
    try {
        logger.debug(`🔍 Executing SPARQL query to endpoint: ${sparqlStore.endpoint.query}`)
        //   logger.debug(`📋 Query: ${query}`)
        const result = await sparqlStore._executeSparqlQuery(query, sparqlStore.endpoint.query)
        logger.debug(`✅ Query executed successfully, returned ${result.results?.bindings?.length || 0} results`)
        return result
    } catch (error) {
        logger.error('❌ Error executing SPARQL query:', error.message, query)
        logger.error('🔧 This might be due to connectivity issues or incorrect endpoint configuration.')
        logger.error('📝 Please ensure that:')
        logger.error('   1. The SPARQL endpoint is running')
        logger.error('   2. The endpoint URL is correct')
        logger.error('   3. Authentication credentials are valid')
        logger.error('   4. The graph exists in the SPARQL store')
        throw error
    }
}

async function storeEmbedding(sparqlStore, articleUri, embedding) {
    try {
        // Create a transaction to safely update the data
        logger.debug(`🔄 Beginning transaction for storing embedding for article: ${articleUri}`)
        await sparqlStore.beginTransaction()

        // Prepare the embedding to be stored as a JSON string
        const embeddingStr = JSON.stringify(embedding)
        logger.debug(`📦 Serialized embedding to JSON (${embeddingStr.length} characters)`)

        // SPARQL update query to add the embedding to the article
        const updateQuery = `
            PREFIX schema: <http://schema.org/>
            PREFIX emb: <http://example.org/embedding/>
            
            INSERT DATA {
                GRAPH <${sparqlStore.graphName}> {
                    <${articleUri}> emb:vector """${embeddingStr}""" .
                }
            }
        `

        logger.debug(`💾 Executing SPARQL update to endpoint: ${sparqlStore.endpoint.update}`)
        logger.debug(`📝 Update query prepared for article: ${articleUri}`)

        // Execute the update
        await sparqlStore._executeSparqlUpdate(updateQuery, sparqlStore.endpoint.update)

        // Commit the transaction
        await sparqlStore.commitTransaction()
        logger.debug(`✅ Successfully stored embedding vector for article: ${articleUri}`)
        return true
    } catch (error) {
        // Roll back in case of errors
        logger.error(`❌ Failed to store embedding for article ${articleUri}:`, error.message)

        try {
            if (sparqlStore.inTransaction) {
                logger.debug('🔄 Rolling back transaction due to error')
                await sparqlStore.rollbackTransaction()
            }
        } catch (rollbackError) {
            logger.error('❌ Failed to roll back transaction:', rollbackError.message)
        }

        throw error
    }
}

async function insertTestData(sparqlStore) {
    const testArticles = [
        {
            uri: 'http://example.org/article/1',
            title: 'Introduction to Semantic Web',
            content: 'The Semantic Web is a vision of the World Wide Web where data is machine-readable and can be processed by computers. It uses technologies like RDF, SPARQL, and ontologies to create a web of linked data that enables intelligent applications and services.'
        },
        {
            uri: 'http://example.org/article/2',
            title: 'Understanding Vector Embeddings',
            content: 'Vector embeddings are dense numerical representations of text that capture semantic meaning. They are created by neural networks and allow computers to understand the similarity between different pieces of text based on their vector distances in high-dimensional space.'
        },
        {
            uri: 'http://example.org/article/3',
            title: 'SPARQL Query Language Basics',
            content: 'SPARQL is a query language for RDF data that allows you to retrieve and manipulate graph-structured data. It provides powerful pattern matching capabilities and supports operations like SELECT, INSERT, UPDATE, and DELETE on RDF triples.'
        },
        {
            uri: 'http://example.org/article/4',
            title: 'Machine Learning and AI Applications',
            content: 'Machine learning enables computers to learn patterns from data without explicit programming. Applications include natural language processing, computer vision, recommendation systems, and autonomous vehicles. Deep learning using neural networks has revolutionized many AI tasks.'
        }
    ]

    logger.info('🔄 Inserting test data into SPARQL store...')

    for (const article of testArticles) {
        try {
            const insertQuery = `
                PREFIX schema: <http://schema.org/>
                
                INSERT DATA {
                    GRAPH <${sparqlStore.graphName}> {
                        <${article.uri}> a schema:Article ;
                            schema:headline "${article.title}" ;
                            schema:articleBody """${article.content}""" .
                    }
                }
            `

            logger.debug(`📝 Inserting article: ${article.title}`)
            await sparqlStore._executeSparqlUpdate(insertQuery, sparqlStore.endpoint.update)
            logger.debug(`✅ Successfully inserted: ${article.uri}`)

        } catch (error) {
            logger.error(`❌ Failed to insert article ${article.uri}:`, error.message)
        }
    }

    logger.info(`✅ Test data insertion completed - added ${testArticles.length} articles`)
}

async function checkExistingData(sparqlStore) {
    logger.info('🔍 Checking for existing articles in SPARQL store...')

    const countQuery = `
        SELECT (COUNT(?article) as ?count) WHERE {
            GRAPH <${sparqlStore.graphName}> {
                ?article <http://schema.org/articleBody> ?content
            } 
        }
    `

    try {
        const result = await executeQuery(sparqlStore, countQuery)
        const count = parseInt(result.results.bindings[0]?.count?.value || '0')
        logger.info(`📊 Found ${count} existing articles in the database`)
        return count
    } catch (error) {
        logger.error('❌ Error checking existing data:', error.message)
        return 0
    }
}

async function main() {
    logger.info('🚀 Starting ArticleEmbedding.js - Semantic Article Processing System')
    logger.info('='.repeat(70))

    // Initialize configuration from config file
    logger.info('⚙️  Initializing configuration from config file...')
    const configPath = 'config/config.json'
    const config = new Config(configPath)
    // logger.log(process.cwd())
    // logger.log(path.join(process.cwd(), configPath))
    await config.init()
    logger.info('✅ Configuration loaded successfully')

    // Get SPARQL endpoint from config
    logger.info('🔗 Loading SPARQL endpoint configuration...')
    const allEndpoints = config.get('sparqlEndpoints')
    logger.info(`📋 Available SPARQL endpoints: ${allEndpoints.length}`)
    allEndpoints.forEach((ep, idx) => {
        logger.info(`   ${idx}: ${ep.label} - ${ep.urlBase}`)
    })

    const sparqlEndpoint = config.get('sparqlEndpoints.0')
    if (!sparqlEndpoint) {
        throw new Error('No SPARQL endpoint configured')
    }

    logger.info(`🎯 Using endpoint: ${sparqlEndpoint.label} at ${sparqlEndpoint.urlBase}`)

    // Create SPARQL store using sparqlEndpoints configuration
    const endpoint = {
        query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
        update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
    }

    logger.info(`🗄️  Connecting to SPARQL endpoint: ${sparqlEndpoint.urlBase}`)
    logger.info(`🔍 Query endpoint: ${endpoint.query}`)
    logger.info(`✏️  Update endpoint: ${endpoint.update}`)
    // Get graph name from config
    const graphName = config.get('graphName') || config.get('storage.options.graphName') || 'http://danny.ayers.name/content'
    logger.info(`📊 Target graph: ${graphName}`)

    const sparqlStore = new SPARQLStore(
        endpoint,
        {
            graphName: graphName,
            user: sparqlEndpoint.user,
            password: sparqlEndpoint.password
        }
    )

    // Create Ollama connector for embeddings
    logger.info('🤖 Initializing Ollama connector for embeddings...')
    const ollama = new OllamaConnector()

    // Initialize memory manager
    logger.info(`🧠 Setting up MemoryManager with embedding model: ${config.get('embeddingModel')}`)
    memoryManager = new MemoryManager({
        llmProvider: ollama,
        embeddingModel: config.get('embeddingModel'),
        storage: sparqlStore
    })

    // Verify SPARQL store is accessible
    logger.info('🔍 Verifying SPARQL store connectivity...')
    try {
        await sparqlStore.verify()
        logger.info('✅ SPARQL store connection verified successfully')
    } catch (error) {
        logger.error('❌ Failed to verify SPARQL store:', error)
        await shutdown('SPARQL verification failed')
        return
    }

    // Check for existing data and insert test data if needed
    const existingCount = await checkExistingData(sparqlStore)
    if (existingCount === 0) {
        logger.info('📝 No existing articles found - inserting test data...')
        await insertTestData(sparqlStore)
    } else {
        logger.info(`📚 Using ${existingCount} existing articles from the database`)
    }

    // SPARQL query to retrieve articles
    logger.info('🔍 Querying for articles to process...')
    const query = `
        SELECT * WHERE {
            GRAPH <${graphName}> {
                ?article <http://schema.org/articleBody> ?content
            } 
        }
    `

    try {
        // Execute query to get articles
        logger.info('📋 Executing SPARQL query to retrieve articles...')
        const results = await executeQuery(sparqlStore, query)
        const articles = results.results.bindings

        logger.info(`📚 Found ${articles.length} articles to process for embedding generation`)
        logger.info('='.repeat(50))

        if (articles.length === 0) {
            logger.warn('⚠️  No articles found to process. The script will exit.')
            await shutdown('No articles to process')
            return
        }

        let successCount = 0
        let errorCount = 0

        // Process each article
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i]
            const articleUri = article.article.value
            const content = article.content.value

            logger.info(`🔄 Processing article ${i + 1}/${articles.length}`)
            logger.info(`📄 Article URI: ${articleUri}`)
            logger.info(`📝 Content length: ${content.length} characters`)
            logger.info(`🧾 Content preview: ${content.substring(0, 100)}...`)

            // Generate embedding for content
            try {
                logger.info('🤖 Generating embedding using Ollama...')
                const startTime = Date.now()
                const embedding = await memoryManager.generateEmbedding(content)
                const endTime = Date.now()

                logger.info(`✅ Embedding generated successfully in ${endTime - startTime}ms`)
                logger.info(`📊 Embedding dimensions: ${embedding.length}`)
                logger.info(`🔢 Sample embedding values: [${embedding.slice(0, 3).map(x => x.toFixed(4)).join(', ')}...]`)

                // Store the embedding in the SPARQL store
                logger.info('💾 Storing embedding in SPARQL store...')
                await storeEmbedding(sparqlStore, articleUri, embedding)
                successCount++

                logger.info(`✅ Article ${i + 1} processed successfully`)

                // Space out requests to avoid overloading the embedding service
                if (i < articles.length - 1) {
                    logger.info('⏱️  Waiting 500ms before processing next article...')
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
            } catch (error) {
                logger.error(`❌ Failed to process article ${articleUri}:`, error.message)
                errorCount++
                // Continue with next article despite the error
                continue
            }

            logger.info('-'.repeat(40))
        }

        logger.info('🎉 EMBEDDING GENERATION COMPLETED!')
        logger.info('='.repeat(50))
        logger.info(`📊 Summary:`)
        logger.info(`   ✅ Successfully processed: ${successCount} articles`)
        logger.info(`   ❌ Failed to process: ${errorCount} articles`)
        logger.info(`   📈 Success rate: ${((successCount / articles.length) * 100).toFixed(1)}%`)

        if (successCount > 0) {
            logger.info('🔍 You can now query the SPARQL store to retrieve articles with their embeddings!')
            logger.info('💡 Example: Look for triples with predicate <http://example.org/embedding/vector>')
        }

    } catch (error) {
        logger.error('❌ Error during execution:', error)
    } finally {
        await shutdown('Finished')
    }
}

main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})