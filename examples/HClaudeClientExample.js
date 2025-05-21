import logger from 'loglevel';
import MemoryManager from '../src/MemoryManager.js';
import JSONStore from '../src/stores/JSONStore.js';
import Config from '../src/Config.js';
import HClaudeClientConnector from '../src/connectors/ClaudeConnector.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    // Load environment variables
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is required');
    }

    const config = new Config({
        storage: {
            type: 'json',
            options: {
                path: 'data/memory.json'
            }
        },
        models: {
            chat: {
                provider: 'claude',
                model: 'claude-3-opus-20240229'
            },
            embedding: {
                provider: 'claude',
                model: 'claude-3-opus-20240229'
            }
        }
    });

    await config.init();

    const storage = new JSONStore(config.get('storage.options.path'));
    const claude = new HClaudeClientConnector(CLAUDE_API_KEY);

    memoryManager = new MemoryManager({
        llmProvider: claude,
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
