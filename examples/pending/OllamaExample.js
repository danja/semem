import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import SPARQLStore from '../src/stores/SPARQLStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'

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

// === Easily switchable SPARQL endpoint config ===
const sparqlEndpoints = {
    local: {
        query: 'http://localhost:4030/semem/query',
        update: 'http://localhost:4030/semem/update'
    },
    remote: {
        query: 'http://fuseki.hyperdata.it/semem/query',
        update: 'http://fuseki.hyperdata.it/semem/update'
    }
}

// Choose which endpoint to use here:
let activeEndpoint = sparqlEndpoints.local

async function trySparqlEndpoint(endpoint) {
    const testStore = new SPARQLStore(endpoint, {
        user: 'admin',
        password: 'admin123',
        graphName: 'http://danny.ayers.name/content'
    })
    try {
        const ok = await testStore.verify()
        logger.info(`[SPARQL TEST] Endpoint ${JSON.stringify(endpoint)} is reachable: ${ok}`)
        return ok
    } catch (e) {
        logger.error(`[SPARQL TEST] Endpoint ${JSON.stringify(endpoint)} failed:`, e)
        return false
    }
}

async function main() {
    logger.setLevel('info')

    // Try local endpoint first, fallback to remote if needed
    let ok = await trySparqlEndpoint(sparqlEndpoints.local)
    if (ok) {
        activeEndpoint = sparqlEndpoints.local
        logger.info('Using LOCAL SPARQL endpoint')
    } else {
        ok = await trySparqlEndpoint(sparqlEndpoints.remote)
        if (ok) {
            activeEndpoint = sparqlEndpoints.remote
            logger.info('Using REMOTE SPARQL endpoint')
        } else {
            throw new Error('No working SPARQL endpoint found!')
        }
    }

    logger.info(`[SPARQLStore] Using endpoint: ${JSON.stringify(activeEndpoint)}`)
    const store = new SPARQLStore(activeEndpoint, {
        user: 'admin',
        password: 'admin123',
        graphName: 'http://danny.ayers.name/content'
    })

    const ollama = new OllamaConnector({
        model: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text',
        apiBase: 'http://localhost:11434'
    })

    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text',
        storage: store
    })

    const prompt = "What are the benefits of semantic web technologies for AI applications?"

    try {
        logger.info('Generating response...')
        
        // Retrieve relevant interactions from memory
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt)
        logger.info(`Found ${relevantInteractions.length} relevant interactions`)

        // Generate response using chat functionality
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions)
        logger.info('Response generated:', response)

        // Generate embedding for the interaction
        logger.info('Generating embedding...')
        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`)
        logger.info(`Generated embedding with ${embedding.length} dimensions`)

        // Extract concepts using the LLM
        logger.info('Extracting concepts...')
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`)
        logger.info('Extracted concepts:', concepts)

        // Store the interaction with concepts in SPARQL store
        logger.info('Storing interaction in SPARQL store...')
        await memoryManager.addInteraction(prompt, response, embedding, concepts)
        logger.info('Successfully stored interaction with concepts in SPARQL store')

        // Demonstrate retrieval of stored concepts
        logger.info('Testing retrieval of stored data...')
        const retrievedInteractions = await memoryManager.retrieveRelevantInteractions(prompt, 30)
        logger.info(`Retrieved ${retrievedInteractions.length} interactions from SPARQL store`)
        
        if (retrievedInteractions.length > 0) {
            logger.info('Sample retrieved interaction concepts:', retrievedInteractions[0].concepts)
        }

    } catch (error) {
        logger.error('Error during execution:', error)
        await shutdown('error')
    }
}

main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})