// spec/unit/MemoryManager.spec.js
import MemoryManager from '../../src/MemoryManager.js';
import { MockOllamaConnector } from '../mocks/Ollama.js';
import InMemoryStore from '../../src/stores/InMemoryStore.js';

describe('MemoryManager', () => {
    let manager;
    let mockOllama;

    beforeEach(() => {
        mockOllama = new MockOllamaConnector();
        manager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: 'qwen2:1.5b', // was llama2
            embeddingModel: 'nomic-embed-text',
            storage: new InMemoryStorage()
        });
    });

    it('should generate embeddings', async () => {
        const embedding = await manager.getEmbedding('test text');
        expect(embedding.length).toBe(1536);
        expect(Array.isArray(embedding)).toBe(true);
    });

    it('should extract concepts', async () => {
        const concepts = await manager.extractConcepts('AI and machine learning');
        expect(Array.isArray(concepts)).toBe(true);
        expect(concepts.length).toBeGreaterThan(0);
    });

    it('should add and retrieve interactions', async () => {
        const prompt = 'test prompt';
        const response = 'test response';
        const embedding = new Array(1536).fill(0);
        const concepts = ['test'];

        await manager.addInteraction(prompt, response, embedding, concepts);
        const retrievals = await manager.retrieveRelevantInteractions(prompt);

        expect(retrievals.length).toBeGreaterThan(0);
        expect(retrievals[0].interaction.prompt).toBe(prompt);
    });
});