import MemoryManager from './memoryManager.js';
import JSONStorage from './jsonStorage.js';
import RemoteStorage from './remoteStorage.js';
import Config from './config.js';

async function main() {
    // Initialize with custom configuration
    const config = new Config({
        storage: {
            type: 'remote',
            options: {
                endpoint: 'https://api.example.com/memory',
                apiKey: process.env.STORAGE_API_KEY
            }
        },
        models: {
            chat: {
                provider: 'openai',
                model: 'gpt-4-turbo-preview'
            },
            embedding: {
                provider: 'openai',
                model: 'text-embedding-3-small'
            }
        }
    });

    // Initialize storage based on configuration
    let storage;
    switch (config.get('storage.type')) {
        case 'json':
            storage = new JSONStorage(config.get('storage.options.path'));
            break;
        case 'remote':
            storage = new RemoteStorage(config.get('storage.options'));
            break;
        default:
            storage = new InMemoryStorage();
    }

    // Initialize memory manager
    const memoryManager = new MemoryManager({
        apiKey: process.env.OPENAI_API_KEY,
        chatModel: config.get('models.chat.provider'),
        chatModelName: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.provider'),
        embeddingModelName: config.get('models.embedding.model'),
        storage
    });

    // Example interaction
    const prompt = "What's the current state of AI technology?";
    
    // Get relevant past interactions
    const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
    
    // Generate response
    const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
    console.log('Response:', response);

    // Store the interaction
    const embedding = await memoryManager.getEmbedding(`${prompt} ${response}`);
    const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
    await memoryManager.addInteraction(prompt, response, embedding, concepts);
}

main().catch(console.error);
