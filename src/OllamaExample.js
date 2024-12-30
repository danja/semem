// src/ollama-example.js
import MemoryManager from './MemoryManager.js';
import JSONStore from './stores/JSONStore.js';
import Config from './Config.js';
import OllamaConnector from './connectors/OllamaConnector.js';

async function main() {
    const config = new Config({
        storage: {
            type: 'json',
            options: {
                path: 'memory.json'
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

    const memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    });

    const prompt = "What's the current state of AI technology?";

    const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
    const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
    console.log('Response:', response);

    const embedding = await memoryManager.getEmbedding(`${prompt} ${response}`);
    const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
    await memoryManager.addInteraction(prompt, response, embedding, concepts);
}

main().catch(console.error);
