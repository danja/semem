import fetch from 'node-fetch'
import OllamaConnector from '../../../src/connectors/OllamaConnector.js'
import { EmbeddingValidator } from '../../../src/utils/EmbeddingValidator.js'

globalThis.fetch = fetch

describe('OllamaConnector Integration', () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000 // 30 second timeout
    let api
    let validator
    let ollamaAvailable = false

    beforeAll(async () => {
        try {
            const response = await fetch('http://localhost:11434/api/tags')
            ollamaAvailable = response.ok
        } catch (e) {
            console.warn('Ollama server not available - skipping integration tests')
        }
    })

    beforeEach(() => {
        api = new OllamaConnector('http://localhost:11434')
        validator = new EmbeddingValidator({
            dimensions: {
                'nomic-embed-text': 768
            }
        })
    })

    it('should generate chat response', async () => {
        if (!ollamaAvailable) pending('Ollama server not available')

        const messages = [{
            role: 'user',
            content: 'Hello, how are you?'
        }]

        const response = await api.generateChat('qwen2:1.5b', messages)
        expect(typeof response).toBe('string')
        expect(response.length).toBeGreaterThan(0)
    })

    it('should generate embeddings', async () => {
        if (!ollamaAvailable) pending('Ollama server not available')

        const embedding = await api.generateEmbedding(
            'nomic-embed-text',
            'Test text for embedding'
        )

        expect(Array.isArray(embedding)).toBe(true)
        expect(embedding.length).toBe(768)
        expect(validator.validateEmbedding(embedding, 768)).toBe(true)
    })
})