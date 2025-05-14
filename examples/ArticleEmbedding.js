import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import SPARQLStore from '../src/stores/SPARQLStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
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
        logger.debug(`Executing SPARQL query to endpoint: ${sparqlStore.endpoint.query}`)
        logger.debug(`Query: ${query}`)
        const result = await sparqlStore._executeSparqlQuery(query, sparqlStore.endpoint.query)
        return result
    } catch (error) {
        logger.error('Error executing SPARQL query:', error)
        logger.error('This might be due to connectivity issues or incorrect endpoint configuration.')
        logger.error('Please ensure that:')
        logger.error('1. The SPARQL endpoint is running')
        logger.error('2. The endpoint URL is correct')
        logger.error('3. Authentication credentials are valid')
        logger.error('4. The graph exists in the SPARQL store')
        throw error
    }
}

async function storeEmbedding(sparqlStore, articleUri, embedding) {
    try {
        // Create a transaction to safely update the data
        logger.debug(`Beginning transaction for storing embedding for article: ${articleUri}`)
        await sparqlStore.beginTransaction()
        
        // Prepare the embedding to be stored as a JSON string
        const embeddingStr = JSON.stringify(embedding)
        
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
        
        logger.debug(`Executing SPARQL update to endpoint: ${sparqlStore.endpoint.update}`)
        logger.debug(`Update query: ${updateQuery}`)
        
        // Execute the update
        await sparqlStore._executeSparqlUpdate(updateQuery, sparqlStore.endpoint.update)
        
        // Commit the transaction
        await sparqlStore.commitTransaction()
        logger.info(`Successfully stored embedding for article: ${articleUri}`)
        return true
    } catch (error) {
        // Roll back in case of errors
        logger.error(`Failed to store embedding for article ${articleUri}:`, error)
        
        try {
            if (sparqlStore.inTransaction) {
                logger.debug('Rolling back transaction')
                await sparqlStore.rollbackTransaction()
            }
        } catch (rollbackError) {
            logger.error('Failed to roll back transaction:', rollbackError)
        }
        
        throw error
    }
}

async function main() {
    // Initialize configuration
    const config = Config.create({
        storage: {
            type: 'sparql',
            options: {
                endpoint: {
                    query: 'http://localhost:4030/semem',
                    update: 'http://localhost:4030/semem'
                },
                graphName: 'http://danny.ayers.name/content',
                user: 'admin',
                password: 'admin123'
            }
        },
        models: {
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        }
    })
    
    // Create SPARQL store
    const sparqlStore = new SPARQLStore(
        config.get('storage.options.endpoint'),
        config.get('storage.options')
    )
    
    // Create Ollama connector for embeddings
    const ollama = new OllamaConnector()
    
    // Initialize memory manager
    memoryManager = new MemoryManager({
        llmProvider: ollama,
        embeddingModel: config.get('models.embedding.model'),
        storage: sparqlStore
    })
    
    // Verify SPARQL store is accessible
    try {
        await sparqlStore.verify()
    } catch (error) {
        logger.error('Failed to verify SPARQL store:', error)
        await shutdown('SPARQL verification failed')
        return
    }
    
    // SPARQL query to retrieve articles
    const query = `
        SELECT * WHERE {
            GRAPH <http://danny.ayers.name/content> {
                ?article <http://schema.org/articleBody> ?content
            } 
        }
    `
    
    try {
        // Execute query to get articles
        const results = await executeQuery(sparqlStore, query)
        const articles = results.results.bindings
        
        logger.info(`Found ${articles.length} articles to process`)
        
        // Process each article
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i]
            const articleUri = article.article.value
            const content = article.content.value
            
            logger.info(`Processing article ${i+1}/${articles.length}: ${articleUri}`)
            
            // Generate embedding for content
            try {
                const embedding = await memoryManager.generateEmbedding(content)
                
                // Store the embedding in the SPARQL store
                await storeEmbedding(sparqlStore, articleUri, embedding)
                
                // Space out requests to avoid overloading the embedding service
                if (i < articles.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
            } catch (error) {
                logger.error(`Failed to process article ${articleUri}:`, error)
                // Continue with next article despite the error
                continue
            }
        }
        
        logger.info('Completed embedding generation for all articles')
    } catch (error) {
        logger.error('Error during execution:', error)
    } finally {
        await shutdown('Finished')
    }
}

main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})