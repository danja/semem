// Debug concepts flow to understand where null comes from
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

async function debugConceptsFlow() {
    console.log('Adding interaction with null concepts...');
    
    const embedding = new Array(1536).fill(0.1);
    await memoryManager.addInteraction(
        'test prompt',
        'test response',
        embedding,
        null // null concepts
    );
    
    console.log('Checking memory store state...');
    console.log('MemoryStore conceptsList:', memoryManager.memStore.conceptsList);
    
    console.log('Retrieving with threshold 1...');
    const retrieved = await memoryManager.retrieveRelevantInteractions('test', 1);
    
    console.log('Retrieved result:', JSON.stringify(retrieved, null, 2));
    
    if (retrieved.length > 0) {
        console.log('First result concepts:', retrieved[0].concepts);
        console.log('Type of concepts:', typeof retrieved[0].concepts);
        console.log('Is concepts null?', retrieved[0].concepts === null);
        console.log('Is concepts undefined?', retrieved[0].concepts === undefined);
    }
    
    await memoryManager.dispose();
}

debugConceptsFlow().catch(console.error);