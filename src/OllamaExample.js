import MemoryManager from './MemoryManager.js';
import JSONStore from './stores/JSONStore.js';
import Config from './Config.js';
import OllamaConnector from './connectors/OllamaConnector.js';

// Handle graceful shutdown
let memoryManager = null;

async function shutdown(signal) {
    console.log(`\nReceived ${signal}, starting graceful shutdown...`);
    if (memoryManager) {
        try {
            await memoryManager.dispose();
            console.log('Cleanup complete');
            process.exit(0);
        } catch (error) {
            console.error('Error during cleanup:', error);
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
    console.error('Uncaught Exception:', error);
    await shutdown('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown('unhandledRejection');
});

async function main() {
    const config = new Config({
        storage: {
            type: 'json',
            options: {
                path: 'data/memory.json'
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
    });

    const storage = new JSONStore(config.get('storage.options.path'));
    const ollama = new OllamaConnector();

    memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    });

    const prompt = "What's the current state of AI technology?";

    try {
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
        console.log('Response:', response);

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
        await memoryManager.addInteraction(prompt, response, embedding, concepts);
    } catch (error) {
        console.error('Error during execution:', error);
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    console.error('Fatal error:', error);
    await shutdown('fatal error');
});