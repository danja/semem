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