import logger from 'loglevel';
import MemoryManager from '../src/MemoryManager.js';
import JSONStore from '../src/stores/JSONStore.js';
import Config from '../src/Config.js';
import HClientFactory from '../src/common/HClientFactory.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class HHybridClientConnector {
    constructor(claudeApiKey, ollamaBaseUrl = 'http://localhost:11434') {
        if (!claudeApiKey) {
            throw new Error('Claude API key is required');
        }
        
        this.claudeApiKey = claudeApiKey;
        this.ollamaBaseUrl = ollamaBaseUrl;
        this.claudeClient = null;
        this.ollamaClient = null;
        this.initialize();
    }

    async initialize() {
        try {
            // Initialize both clients
            this.claudeClient = await HClientFactory.createAPIClient('claude', {
                apiKey: this.claudeApiKey,
                model: 'claude-3-opus-20240229'
            });
            
            this.ollamaClient = await HClientFactory.createAPIClient('ollama', {
                apiKey: 'NO_KEY_REQUIRED',
                baseUrl: this.ollamaBaseUrl,
                model: 'nomic-embed-text'
            });
            
            logger.debug('Hybrid clients initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize one or more clients:', error);
            throw error;
        }
    }

    async generateEmbedding(model, input) {
        logger.debug(`Generating embedding with model ${model}`);
        
        try {
            if (!this.ollamaClient) {
                await this.initialize();
            }
            
            // Always use Ollama for embeddings
            const embedding = await this.ollamaClient.embedding(input, { model });
            return embedding;
        } catch (error) {
            logger.error('Embedding generation failed:', error);
            throw error;
        }
    }

    async generateChat(model, messages, options = {}) {
        logger.debug(`Generating chat with model ${model}`);
        
        try {
            if (!this.claudeClient) {
                await this.initialize();
            }
            
            // Always use Claude for chat
            const response = await this.claudeClient.chat(messages, {
                model: "claude-3-opus-20240229",
                max_tokens: options.max_tokens || 1024,
                temperature: options.temperature || 0.7,
                ...options
            });
            
            return response;
        } catch (error) {
            logger.error('Chat generation failed:', error);
            throw error;
        }
    }

    async generateCompletion(model, prompt, options = {}) {
        logger.debug(`Generating completion with model ${model}`);
        
        try {
            if (!this.claudeClient) {
                await this.initialize();
            }
            
            // Always use Claude for completion
            return await this.claudeClient.complete(prompt, {
                model: "claude-3-opus-20240229",
                max_tokens: options.max_tokens || 1024,
                temperature: options.temperature || 0.7,
                ...options
            });
        } catch (error) {
            logger.error('Completion generation failed:', error);
            throw error;
        }
    }
}

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
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is required');
    }

    // Create and initialize config
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
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        }
    });
    await config.init();

    const storage = new JSONStore(config.get('storage.options.path'));
    const hybridProvider = new HHybridClientConnector(CLAUDE_API_KEY);

    memoryManager = new MemoryManager({
        llmProvider: hybridProvider,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    });

    const prompt = "How many agents does it take to change a lightbulb?";

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

main().catch(async (error) => {
    console.error('Fatal error:', error);
    await shutdown('fatal error');
});
