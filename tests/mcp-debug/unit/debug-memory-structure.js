// Debug memory structure
import MemoryManager from '../../../src/MemoryManager.js';
import InMemoryStore from '../../../src/stores/InMemoryStore.js';

const mockLLMProvider = {
    generateEmbedding: () => Promise.resolve(new Array(1536).fill(0.1)),
    generateChat: () => Promise.resolve('Test response'),
    generateCompletion: () => Promise.resolve('["test", "concepts"]')
};

const storage = new InMemoryStore();
const memoryManager = new MemoryManager({
    llmProvider: mockLLMProvider,
    chatModel: 'qwen2:1.5b',
    embeddingModel: 'nomic-embed-text',
    storage
});

async function debugStructure() {
    console.log('Adding interaction...');
    
    const prompt = 'Test prompt';
    const response = 'Test response';
    const concepts = ['test', 'concept'];
    const embedding = new Array(1536).fill(0.1);
    
    await memoryManager.addInteraction(prompt, response, embedding, concepts);
    
    console.log('Retrieving interactions...');
    const relevantMemories = await memoryManager.retrieveRelevantInteractions('test');
    
    console.log('Retrieved memories:', JSON.stringify(relevantMemories, null, 2));
    
    if (relevantMemories.length > 0) {
        console.log('First memory keys:', Object.keys(relevantMemories[0]));
        if (relevantMemories[0].interaction) {
            console.log('Interaction keys:', Object.keys(relevantMemories[0].interaction));
        }
    }
    
    await memoryManager.dispose();
}

debugStructure().catch(console.error);