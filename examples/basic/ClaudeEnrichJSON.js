import logger from 'loglevel';
import MemoryManager from '../../src/MemoryManager.js';
import JSONStore from '../../src/stores/JSONStore.js';
import Config from '../../src/Config.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
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
    // Initialize config
    const config = new Config();
    await config.init();

    // Get chat provider and model from config (override for Claude)
    const chatProvider = 'claude';
    const chatModelName = 'claude-3-5-haiku-latest';

    // Get embedding provider and model from config
    const embeddingProviderType = config.get('models.embedding.provider') || 'ollama';
    const embeddingModelName = config.get('models.embedding.model') || 'nomic-embed-text';

    // Get API key mapping from config
    const apiKeyVars = config.get('API_KEYS') || {};
    
    // Get the appropriate API key from environment variables for chat
    const chatApiKeyVar = apiKeyVars[chatProvider] || 'CLAUDE_API_KEY';
    const chatApiKey = process.env[chatApiKeyVar];

    if (!chatApiKey) {
        throw new Error(`API key not found in environment variables. Please set ${chatApiKeyVar}`);
    }

    // Create chat client using ClaudeConnector
    const chatClient = new ClaudeConnector(chatApiKey, chatModelName);

    // Create embedding provider (Ollama)
    const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
    const embeddingProvider = new OllamaConnector(ollamaBaseUrl, embeddingModelName);

    const storage = new JSONStore(config.get('storage.options.path'));

    memoryManager = new MemoryManager({
        llmProvider: chatClient,
        embeddingProvider: embeddingProvider,
        chatModel: chatModelName,
        embeddingModel: embeddingModelName,
        storage
    });

    const prompt = "What's the current state of AI technology?";

    try {
        console.log('\n=== Processing Query ===');
        console.log('Prompt:', prompt);
        
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
        console.log('Retrieved relevant interactions:', relevantInteractions.length);
        
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
        console.log('\n=== AI Response ===');
        console.log(response);

        console.log('\n=== Extracting Concepts ===');
        // Extract content from response object if needed
        const responseText = typeof response === 'object' && response.content ? response.content : response;
        const concepts = await memoryManager.extractConcepts(`${prompt} ${responseText}`);
        console.log('Discovered concepts:', JSON.stringify(concepts, null, 2));
        console.log('Number of concepts extracted:', concepts.length);

        console.log('\n=== Generating Embedding ===');
        const embedding = await memoryManager.generateEmbedding(`${prompt} ${responseText}`);
        console.log('Embedding dimensions:', embedding ? embedding.length : 'null');

        console.log('\n=== Saving Interaction ===');
        await memoryManager.addInteraction(prompt, responseText, embedding, concepts);
        
        console.log('\n=== Interaction Summary ===');
        console.log('✓ Query processed successfully');
        console.log('✓ Response generated');
        
        // Display concepts properly
        if (concepts.length > 0) {
            const conceptDisplay = concepts.map(concept => {
                if (typeof concept === 'string') {
                    return concept;
                } else if (concept && typeof concept === 'object') {
                    // Try different ways to extract meaningful content
                    if (concept.name) return concept.name;
                    if (concept.concept) return concept.concept;
                    if (concept.title) return concept.title;
                    if (concept.text) return concept.text;
                    return JSON.stringify(concept);
                } else {
                    return String(concept);
                }
            });
            console.log('✓ Concepts extracted:', conceptDisplay.join(', '));
        } else {
            console.log('✓ Concepts extracted: none');
        }
        
        console.log('✓ Embedding created');
        console.log('✓ Interaction saved to memory');
        
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
