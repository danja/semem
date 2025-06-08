/**
 * RagnoSPARQLDemo2.js - Semantic Memory Processing and Search Demo
 * 
 * This script demonstrates the full Semem (Semantic Memory) system capabilities:
 * 
 * 1. Configuration Loading: Loads configuration from config/config.json
 * 2. SPARQL Store Setup: Connects to a SPARQL endpoint (Fuseki) for RDF storage
 * 3. Memory Processing: Processes sample articles about semantic web technologies
 * 4. Embedding Generation: Creates vector embeddings using Ollama's nomic-embed-text model
 * 5. Concept Extraction: Extracts key concepts from text using LLM
 * 6. Knowledge Storage: Stores articles, embeddings, and concepts as RDF triples
 * 7. Semantic Search: Performs similarity-based retrieval using vector embeddings
 * 8. Response Generation: Uses retrieved context to generate intelligent responses
 * 9. SPARQL Querying: Demonstrates direct SPARQL queries on stored data
 * 
 * The demo showcases how Semem integrates:
 * - Large Language Models (Ollama/Qwen2) for text processing
 * - Vector embeddings for semantic similarity
 * - RDF/SPARQL for structured knowledge storage
 * - Ragno ontology for concept relationships
 * 
 * Prerequisites:
 * - Ollama running with nomic-embed-text and qwen2:1.5b models
 * - SPARQL endpoint (Fuseki) configured and accessible
 * - config/config.json properly configured with endpoints and credentials
 */

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
    logger.info('🚀 Starting Semem Semantic Memory Demo')
    logger.info('=' .repeat(60))
    
    // Create and initialize config
    logger.info('📋 Step 1: Loading configuration from config/config.json...')
    const config = new Config('./config/config.json')
    await config.init()
    logger.info('✅ Configuration loaded successfully')

    // Use the get method to access config values
    const graphName = config.get('graphName') || 'http://danny.ayers.name/content'
    const chatModel = config.get('chatModel') || 'qwen2:1.5b'
    const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text'

    logger.info('🔧 Configuration details:')
    logger.info(`   📊 Target graph: ${graphName}`)
    logger.info(`   🤖 Chat model: ${chatModel}`)
    logger.info(`   🧠 Embedding model: ${embeddingModel}`)

    // Get SPARQL endpoint from config
    logger.info('\n🔗 Step 2: Setting up SPARQL store connection...')
    const sparqlEndpoint = config.get('sparqlEndpoints.0')
    if (!sparqlEndpoint) {
        throw new Error('No SPARQL endpoint configured')
    }
    
    logger.info(`🎯 Using SPARQL endpoint: ${sparqlEndpoint.label}`)
    logger.info(`🌐 Base URL: ${sparqlEndpoint.urlBase}`)
    
    // Create SPARQL store using sparqlEndpoints configuration
    const endpoint = {
        query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
        update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
    }
    
    logger.info(`🔍 Query endpoint: ${endpoint.query}`)
    logger.info(`✏️  Update endpoint: ${endpoint.update}`)
    
    sparqlStore = new SPARQLStore(
        endpoint,
        {
            graphName: graphName,
            user: sparqlEndpoint.user,
            password: sparqlEndpoint.password
        }
    )

    // Initialize Ollama connector
    logger.info('\n🤖 Step 3: Initializing Ollama LLM connector...')
    const ollama = new OllamaConnector()
    logger.info('✅ Ollama connector initialized')

    // Initialize memory manager
    logger.info('🧠 Step 4: Setting up Memory Manager...')
    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: chatModel,
        embeddingModel: embeddingModel,
        storage: sparqlStore
    })
    logger.info('✅ Memory Manager initialized with SPARQL storage')

    // Verify SPARQL store connection
    logger.info('\n🔍 Step 5: Verifying SPARQL store connectivity...')
    try {
        await sparqlStore.verify()
        logger.info('✅ SPARQL store connection verified successfully')
        logger.info(`📊 Connected to graph: ${sparqlStore.graphName}`)
    } catch (error) {
        logger.error('❌ Failed to verify SPARQL store:', error)
        logger.error('🔧 Debug info:')
        logger.error('   Endpoint:', sparqlStore.endpoint)
        logger.error('   User:', sparqlStore.credentials.user)
        logger.error('   Graph:', sparqlStore.graphName)
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

    logger.info('\n📚 Step 6: Processing sample articles and generating embeddings...')
    logger.info('🔄 Creating test articles about semantic web technologies...')

    // Process each article
    for (const article of articles) {
        try {
            logger.info(`\n📄 Processing article: "${article.title}"`)
            logger.info(`📝 Content preview: ${article.content.substring(0, 100)}...`)

            // Generate embedding for the article content
            logger.info('🧠 Generating vector embedding...')
            const startTime = Date.now()
            const embedding = await memoryManager.generateEmbedding(article.content)
            const embeddingTime = Date.now() - startTime
            logger.info(`✅ Embedding generated in ${embeddingTime}ms (${embedding.length} dimensions)`)

            // Extract concepts from the article
            logger.info('🔍 Extracting key concepts using LLM...')
            const conceptStartTime = Date.now()
            const concepts = await memoryManager.extractConcepts(article.content)
            const conceptTime = Date.now() - conceptStartTime
            logger.info(`✅ Concepts extracted in ${conceptTime}ms: [${concepts.join(', ')}]`)

            // Add to memory manager
            logger.info('💾 Storing article with embeddings and concepts in SPARQL store...')
            const storeStartTime = Date.now()
            await memoryManager.addInteraction(
                article.title,
                article.content,
                embedding,
                concepts
            )
            const storeTime = Date.now() - storeStartTime
            logger.info(`✅ Article stored successfully in ${storeTime}ms`)
            logger.info(`📊 Created RDF triples for article, embedding, and ${concepts.length} concepts`)
        } catch (error) {
            logger.error(`❌ Failed to process article "${article.title}":`, error.message)
        }
    }

    // Demo: Semantic search
    const queries = [
        "What is the Semantic Web?",
        "How does RDF work?",
        "Tell me about SPARQL queries"
    ]

    logger.info('\n🔍 Step 7: Performing semantic searches...')
    logger.info('🎯 Testing similarity-based retrieval with sample queries...')

    for (const query of queries) {
        try {
            logger.info(`\n🔍 Query: "${query}"`)
            logger.info('🧠 Generating query embedding for similarity search...')

            // Retrieve relevant interactions based on semantic similarity
            logger.info('📊 Searching for semantically similar content (threshold: 0.7)...')
            const searchStartTime = Date.now()
            const relevantInteractions = await memoryManager.retrieveRelevantInteractions(
                query,
                0.7, // similarity threshold
                0,   // excludeLastN
                5    // limit
            )
            const searchTime = Date.now() - searchStartTime
            logger.info(`⚡ Search completed in ${searchTime}ms`)

            if (relevantInteractions.length > 0) {
                logger.info(`🎯 Found ${relevantInteractions.length} semantically similar results:`)

                relevantInteractions.forEach((result, index) => {
                    const interaction = result.interaction || result
                    logger.info(`   ${index + 1}. "${interaction.prompt}" (similarity: ${result.similarity.toFixed(3)})`)
                    logger.info(`      🏷️  Concepts: [${interaction.concepts.join(', ')}]`)
                })

                // Generate a response using the context
                logger.info('🤖 Generating contextual response using retrieved information...')
                const responseStartTime = Date.now()
                const response = await memoryManager.generateResponse(
                    query,
                    [],
                    relevantInteractions
                )
                const responseTime = Date.now() - responseStartTime
                logger.info(`✅ Response generated in ${responseTime}ms`)
                logger.info(`💬 Generated response: ${response}`)
            } else {
                logger.info('❌ No semantically similar results found above threshold')
            }
        } catch (error) {
            logger.error(`❌ Error during search for "${query}":`, error.message)
        }
    }

    // Demo: Direct SPARQL query through the store
    logger.info('\n📊 Step 8: Demonstrating direct SPARQL queries...')
    logger.info('🔍 Querying stored interactions from RDF graph...')

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
        logger.info('⚡ Executing SPARQL query...')
        const queryStartTime = Date.now()
        const results = await sparqlStore._executeSparqlQuery(
            sparqlQuery,
            sparqlStore.endpoint.query
        )
        const queryTime = Date.now() - queryStartTime
        logger.info(`✅ SPARQL query completed in ${queryTime}ms`)

        logger.info(`\n📋 Retrieved ${results.results.bindings.length} stored interactions:`)
        results.results.bindings.forEach((binding, index) => {
            logger.info(`   ${index + 1}. "${binding.prompt.value}"`)
            logger.info(`      🕒 Stored: ${new Date(parseInt(binding.timestamp.value)).toISOString()}`)
            logger.info(`      🆔 ID: ${binding.id.value}`)
        })
    } catch (error) {
        logger.error('❌ Error querying SPARQL store:', error.message)
    }

    logger.info('\n🎉 Demo completed successfully!')
    logger.info('=' .repeat(60))
    logger.info('✅ Demonstrated:')
    logger.info('   📋 Configuration loading')
    logger.info('   🔗 SPARQL store connectivity')
    logger.info('   🧠 Vector embedding generation')
    logger.info('   🔍 Concept extraction')
    logger.info('   💾 RDF knowledge storage')
    logger.info('   🎯 Semantic similarity search')
    logger.info('   🤖 Contextual response generation')
    logger.info('   📊 Direct SPARQL querying')
    logger.info('\n💡 The semantic memory system is now ready for intelligent applications!')
    logger.info('🔗 You can query the SPARQL endpoint directly to explore the stored knowledge graph.')
}

// Run the demo
main().catch(async (error) => {
    logger.error('💥 Fatal error occurred:', error.message)
    logger.error('🔧 Stack trace:', error.stack)
    await shutdown('fatal error')
})