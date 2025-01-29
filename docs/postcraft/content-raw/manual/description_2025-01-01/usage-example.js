// Import core components
import MemoryManager from './src/MemoryManager.js';
import JSONStore from './src/stores/JSONStore.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';
import Config from './src/Config.js';

async function main() {
    // Initialize configuration
    const config = new Config({
        storage: {
            type: 'json',
            options: { path: 'memory.json' }
        },
        models: {
            chat: {
                provider: 'ollama',
                model: 'llama2'  // Or any other Ollama model
            },
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        }
    });

    // Set up storage and LLM connector
    const storage = new JSONStore(config.get('storage.options.path'));
    const llmProvider = new OllamaConnector();

    // Initialize the memory manager
    const memoryManager = new MemoryManager({
        llmProvider,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    });

    try {
        // Example interaction
        const prompt = "What's the weather like today?";
        
        // Retrieve relevant past interactions
        const relevantMemories = await memoryManager.retrieveRelevantInteractions(prompt);
        
        // Generate response using context
        const response = await memoryManager.generateResponse(
            prompt, 
            [], // recent interactions
            relevantMemories
        );

        // Store the interaction
        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
        await memoryManager.addInteraction(prompt, response, embedding, concepts);

        console.log('Response:', response);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Clean up
        await memoryManager.dispose();
    }
}

main().catch(console.error);
