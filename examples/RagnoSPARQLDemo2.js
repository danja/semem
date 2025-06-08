import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import SPARQLStore from '../src/stores/SPARQLStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import { v4 as uuidv4 } from 'uuid'

// Set logging level
logger.setLevel('debug')

let memoryManager = null
let sparqlStore = null

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

// Setup graceful shutdown handlers
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

async function main() {
    // Create and initialize config
    const config = new Config('./config/config.json')
    await config.init()

    logger.info('Loaded configuration')

    // Use the get method to access config values
    const graphName = config.get('graphName') || 'http://danny.ayers.name/content'
    const chatModel = config.get('chatModel') || 'qwen2:1.5b'
    const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text'

    logger.info(`Graph name: ${graphName}`)
    logger.info(`Chat model: ${chatModel}`)
    logger.info(`Embedding model: ${embeddingModel}`)

    // Get SPARQL endpoint from config
    const sparqlEndpoint = config.get('sparqlEndpoints.0')
    if (!sparqlEndpoint) {
        throw new Error('No SPARQL endpoint configured')
    }
    
    logger.info(`Using endpoint: ${sparqlEndpoint.label} at ${sparqlEndpoint.urlBase}`)
    
    // Create SPARQL store using sparqlEndpoints configuration
    const endpoint = {
        query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
        update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
    }
    
    logger.info(`Query endpoint: ${endpoint.query}`)
    logger.info(`Update endpoint: ${endpoint.update}`)
    
    sparqlStore = new SPARQLStore(
        endpoint,
        {
            graphName: graphName,
            user: sparqlEndpoint.user,
            password: sparqlEndpoint.password
        }
    )

    // Initialize Ollama connector
    const ollama = new OllamaConnector()

    // Initialize memory manager
    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: chatModel,
        embeddingModel: embeddingModel,
        storage: sparqlStore
    })

    // Verify SPARQL store connection
    try {
        await sparqlStore.verify()
        logger.info(`SPARQL store verified successfully`)
    } catch (error) {
        logger.error('Failed to verify SPARQL store:', error)
        // Try to provide more debugging info
        logger.info('Store endpoint:', sparqlStore.endpoint)
        logger.info('Store config:', {
            user: sparqlStore.credentials.user,
            graphName: sparqlStore.graphName
        })
        await shutdown('SPARQL verification failed')
        return
    }

    // Demo: Store and retrieve articles with embeddings
    const articles = [
        {
            uri: `http://example.org/articles/${uuidv4()}`,
            title: "Introduction to Semantic Web",
            content: "The Semantic Web is an extension of the World Wide Web through standards set by the World Wide Web Consortium (W3C). The goal of the Semantic Web is to make Internet data machine-readable."
        },
        {
            uri: `http://example.org/articles/${uuidv4()}`,
            title: "RDF and Knowledge Graphs",
            content: "RDF (Resource Description Framework) is a standard model for data interchange on the Web. RDF has features that facilitate data merging even if the underlying schemas differ."
        },
        {
            uri: `http://example.org/articles/${uuidv4()}`,
            title: "SPARQL Query Language",
            content: "SPARQL is a query language for RDF. It allows for a query to consist of triple patterns, conjunctions, disjunctions, and optional patterns."
        }
    ]

    logger.info('\nProcessing articles and generating embeddings...')

    // Process each article
    for (const article of articles) {
        try {
            logger.info(`Processing article: ${article.title}`)

            // Generate embedding for the article content
            const embedding = await memoryManager.generateEmbedding(article.content)

            // Extract concepts from the article
            const concepts = await memoryManager.extractConcepts(article.content)

            // Add to memory manager
            await memoryManager.addInteraction(
                article.title,
                article.content,
                embedding,
                concepts
            )

            logger.info(`Successfully processed article: ${article.title}`)
            logger.info(`Extracted concepts: ${concepts.join(', ')}`)
        } catch (error) {
            logger.error(`Failed to process article ${article.title}:`, error)
        }
    }

    // Demo: Semantic search
    const queries = [
        "What is the Semantic Web?",
        "How does RDF work?",
        "Tell me about SPARQL queries"
    ]

    logger.info('\nPerforming semantic searches...')

    for (const query of queries) {
        try {
            logger.info(`\nSearching for: "${query}"`)

            // Retrieve relevant interactions based on semantic similarity
            const relevantInteractions = await memoryManager.retrieveRelevantInteractions(
                query,
                0.7, // similarity threshold
                0,   // excludeLastN
                5    // limit
            )

            if (relevantInteractions.length > 0) {
                logger.info(`Found ${relevantInteractions.length} relevant results:`)

                relevantInteractions.forEach((result, index) => {
                    const interaction = result.interaction || result
                    logger.info(`  ${index + 1}. ${interaction.prompt} (similarity: ${result.similarity.toFixed(3)})`)
                    logger.info(`     Concepts: ${interaction.concepts.join(', ')}`)
                })

                // Generate a response using the context
                const response = await memoryManager.generateResponse(
                    query,
                    [],
                    relevantInteractions
                )

                logger.info(`\nGenerated response: ${response}`)
            } else {
                logger.info('No relevant results found')
            }
        } catch (error) {
            logger.error(`Error during search for "${query}":`, error)
        }
    }

    // Demo: Direct SPARQL query through the store
    logger.info('\nQuerying stored data via SPARQL...')

    const sparqlQuery = `
        PREFIX semem: <http://purl.org/stuff/semem/>
        SELECT ?id ?prompt ?output ?timestamp
        FROM <${graphName}>
        WHERE {
            ?interaction a semem:Interaction ;
                semem:id ?id ;
                semem:prompt ?prompt ;
                semem:output ?output ;
                semem:timestamp ?timestamp .
        }
        ORDER BY DESC(?timestamp)
        LIMIT 10
    `

    try {
        const results = await sparqlStore._executeSparqlQuery(
            sparqlQuery,
            sparqlStore.endpoint.query
        )

        logger.info(`\nStored interactions in SPARQL store:`)
        results.results.bindings.forEach((binding, index) => {
            logger.info(`  ${index + 1}. ${binding.prompt.value}`)
            logger.info(`     Timestamp: ${new Date(parseInt(binding.timestamp.value)).toISOString()}`)
        })
    } catch (error) {
        logger.error('Error querying SPARQL store:', error)
    }

    logger.info('\nDemo completed successfully!')
}

// Run the demo
main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})