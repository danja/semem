// Debug null concepts issue
import MemoryManager from '../../../src/MemoryManager.js';
import InMemoryStore from '../../../src/stores/InMemoryStore.js';

const mockLLMProvider = {
    generateEmbedding: () => Promise.resolve(new Array(1536).fill(0)),
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

async function debugNullConcepts() {
    console.log('Adding interaction with null concepts...');
    
    await memoryManager.addInteraction(
        'test prompt',
        'test response',
        new Array(1536).fill(0),
        null // null concepts
    );
    
    console.log('Retrieving with different thresholds...');
    
    for (const threshold of [1, 10, 40, 70]) {
        const retrieved = await memoryManager.retrieveRelevantInteractions('test', threshold);
        console.log(`Threshold ${threshold}: Found ${retrieved.length} interactions`);
        
        if (retrieved.length > 0) {
            console.log('  First result:', {
                prompt: retrieved[0].prompt,
                concepts: retrieved[0].concepts,
                totalScore: retrieved[0].totalScore
            });
        }
    }
    
    await memoryManager.dispose();
}

debugNullConcepts().catch(console.error);