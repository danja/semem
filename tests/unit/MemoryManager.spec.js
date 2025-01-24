import MemoryManager from '../../src/MemoryManager.js'
import { MockOllamaConnector } from '../mocks/Ollama.js'
import InMemoryStore from '../../src/stores/InMemoryStore.js'

describe('MemoryManager', () => {
    let manager
    let mockOllama
    let store

    beforeEach(async () => {
        mockOllama = new MockOllamaConnector()
        store = new InMemoryStore()
        manager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage: store,
            dimension: 1536
        })
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should generate embeddings', async () => {
        const embedding = await manager.generateEmbedding('test text')
        expect(embedding.length).toBe(1536)
        expect(Array.isArray(embedding)).toBe(true)
    })

    it('should extract concepts', async () => {
        const concepts = await manager.extractConcepts('AI and machine learning')
        expect(Array.isArray(concepts)).toBe(true)
        expect(concepts.length).toBeGreaterThan(0)
    })

    it('should add and retrieve interactions', async () => {
        // Create unique test data
        const prompt = 'unique test prompt ' + Date.now()
        const response = 'test response'
        const embedding = await manager.generateEmbedding(prompt)
        const concepts = ['test']

        // Add interaction
        await manager.addInteraction(prompt, response, embedding, concepts)

        // Retrieve with same prompt to ensure embedding similarity
        const retrievals = await manager.retrieveRelevantInteractions(prompt)

        expect(retrievals.length).toBeGreaterThan(0)
        const firstResult = retrievals[0].interaction
        expect(firstResult.prompt).toBe(prompt)
        expect(firstResult.output).toBe(response)
    })
})