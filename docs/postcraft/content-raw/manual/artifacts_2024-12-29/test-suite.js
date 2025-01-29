// spec/unit/memoryManager.spec.js
import MemoryManager from '../../src/memoryManager.js';
import { MockOllamaAPI } from '../mocks/ollama.js';
import InMemoryStorage from '../../src/inMemoryStorage.js';

describe('MemoryManager', () => {
    let manager;
    let mockOllama;
    
    beforeEach(() => {
        mockOllama = new MockOllamaAPI();
        manager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: 'llama2',
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

// spec/unit/contextWindow.spec.js
import ContextWindowManager from '../../src/contextWindow.js';

describe('ContextWindowManager', () => {
    let windowManager;
    
    beforeEach(() => {
        windowManager = new ContextWindowManager({
            maxWindowSize: 1000,
            minWindowSize: 250,
            overlapRatio: 0.1
        });
    });

    it('should calculate correct window size', () => {
        const size = windowManager.calculateWindowSize('x'.repeat(1000));
        expect(size).toBeLessThanOrEqual(1000);
        expect(size).toBeGreaterThanOrEqual(250);
    });

    it('should create overlapping windows', () => {
        const text = 'x'.repeat(2000);
        const windows = windowManager.createWindows(text, 1000);
        expect(windows.length).toBeGreaterThan(1);
        expect(windows[0].text.length).toBeLessThanOrEqual(1000);
    });

    it('should merge overlapping content', () => {
        const windows = [
            { text: 'Hello world' },
            { text: 'world and universe' }
        ];
        const merged = windowManager.mergeOverlappingContent(windows);
        expect(merged).toBe('Hello world and universe');
    });
});

// spec/integration/ollama.spec.js
import OllamaAPI from './ollama-api.js';

describe('OllamaAPI Integration', () => {
    let api;
    
    beforeEach(() => {
        api = new OllamaAPI('http://localhost:11434');
    });

    it('should generate chat response', async () => {
        const messages = [{
            role: 'user',
            content: 'Hello, how are you?'
        }];
        
        const response = await api.generateChat('llama2', messages);
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });

    it('should generate embeddings', async () => {
        const embedding = await api.generateEmbedding(
            'nomic-embed-text',
            'Test text for embedding'
        );
        
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1536);
    });

    it('should handle API errors gracefully', async () => {
        try {
            await api.generateChat('nonexistent-model', []);
            fail('Should have thrown an error');
        } catch (error) {
            expect(error.message).toContain('Ollama API error');
        }
    });
});

// spec/mocks/ollama.js
export class MockOllamaAPI {
    async generateEmbedding(model, input) {
        return new Array(1536).fill(0).map(() => Math.random());
    }

    async generateChat(model, messages) {
        return 'Mock response';
    }

    async generateCompletion(model, prompt) {
        return 'Mock completion';
    }
}