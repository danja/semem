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

async function main() {
    logger.setLevel('info')

    // Create configuration for SPARQL storage
    const config = Config.create({
        storage: {
            type: 'sparql',
            options: {
                endpoint: {
                    query: 'http://localhost:4030/semem/query',
                    update: 'http://localhost:4030/semem/update'
                },
                graphName: 'http://danny.ayers.name/content',
                user: 'admin',
                password: 'admin123'
            }
        },
        models: {
            chat: {
                provider: 'ollama',
                model: 'qwen2:1.5b'
            },
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

    // Create Ollama connector
    const ollama = new OllamaConnector()

    // Create memory manager with SPARQL backend
    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage: sparqlStore
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