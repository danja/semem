import Config from '../../../src/Config.js'
import MemoryManager from '../../../src/MemoryManager.js'

describe('OllamaExample Integration', () => {
    let config
    let mockOllama
    let mockStorage
    let memoryManager

    beforeEach(() => {
        mockOllama = {
            generateEmbedding: jasmine.createSpy('generateEmbedding')
                .and.resolveTo(new Array(1536).fill(0)),
            generateChat: jasmine.createSpy('generateChat')
                .and.resolveTo('test response'),
            generateCompletion: jasmine.createSpy('generateCompletion')
                .and.resolveTo('["concept"]')
        }

        mockStorage = {
            loadHistory: jasmine.createSpy('loadHistory').and.resolveTo([[], []]),
            saveMemoryToHistory: jasmine.createSpy('saveMemoryToHistory'),
            close: jasmine.createSpy('close')
        }

        config = Config.create({
            storage: {
                type: 'json',
                options: { path: 'test.json' }
            },
            models: {
                chat: {
                    provider: 'ollama',
                    model: 'test-chat'
                },
                embedding: {
                    provider: 'ollama',
                    model: 'test-embed'
                }
            }
        })
    })

    it('should initialize with config values', () => {
        memoryManager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: config.get('models.chat.model'),
            embeddingModel: config.get('models.embedding.model'),
            storage: mockStorage
        })

        expect(memoryManager.chatModel).toBe('test-chat')
        expect(memoryManager.embeddingModel).toBe('test-embed')
    })

    it('should handle full interaction flow', async () => {
        memoryManager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: config.get('models.chat.model'),
            embeddingModel: config.get('models.embedding.model'),
            storage: mockStorage
        })

        const prompt = 'test prompt'

        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt)
        expect(mockOllama.generateEmbedding).toHaveBeenCalled()

        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions)
        expect(mockOllama.generateChat).toHaveBeenCalled()

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`)
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`)

        await memoryManager.addInteraction(prompt, response, embedding, concepts)
        expect(mockStorage.saveMemoryToHistory).toHaveBeenCalled()
    })

    afterEach(async () => {
        if (memoryManager) {
            await memoryManager.dispose()
        }
    })
})