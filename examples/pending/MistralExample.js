import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import JSONStore from '../src/stores/JSONStore.js'
import Config from '../src/Config.js'
import ClientConnector from '../src/connectors/ClientConnector.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

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

// Handle different termination signals
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
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info')

    // Initialize configuration
    const config = Config.create({
        storage: {
            type: 'json',
            options: {
                path: 'data/memory.json'
            }
        },
        models: {
            chat: {
                provider: 'mistral',
                model: 'open-codestral-mamba'
            },
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        }
    })

    const storage = new JSONStore(config.get('storage.options.path'))

    // Use the new HOllamaClientConnector that leverages hyperdata-clients
    const p = config.get('models.chat.provider')
    const m = config.get('models.chat.model')
    const connector = new ClientConnector(p, m)

    memoryManager = new MemoryManager({
        llmProvider: connector,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    })

    const prompt = "How many LLMs does it take to change a lightbulb?"

    try {
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt)
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions)
        logger.info('Response:', response)

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`)
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`)
        await memoryManager.addInteraction(prompt, response, embedding, concepts)
    } catch (error) {
        logger.error('Error during execution:', error)
        await shutdown('error')
    }
}

main().catch(async (error) => {
    logger.error('Fatal error:', error)
    await shutdown('fatal error')
})
