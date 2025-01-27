import MemoryManager from '../../src/MemoryManager.js'

describe('MemoryManager', () => {
    let manager
    let mockLLMProvider
    let mockStorage
    let mockEmbedding

    beforeEach(() => {
        mockLLMProvider = {
            generateEmbedding: jasmine.createSpy('generateEmbedding'),
            generateChat: jasmine.createSpy('generateChat'),
            generateCompletion: jasmine.createSpy('generateCompletion')
        }

        mockStorage = {
            loadHistory: jasmine.createSpy('loadHistory').and.resolveTo([[], []]),
            saveMemoryToHistory: jasmine.createSpy('saveMemoryToHistory').and.resolveTo(),
            close: jasmine.createSpy('close').and.resolveTo()
        }

        mockEmbedding = new Array(1536).fill(0)

        manager = new MemoryManager({
            llmProvider: mockLLMProvider,
            storage: mockStorage
        })
    })

    describe('initialization', () => {
        it('should handle string model names', () => {
            const mgr = new MemoryManager({
                llmProvider: mockLLMProvider,
                chatModel: 'test-chat',
                embeddingModel: 'test-embed'
            })

            expect(mgr.chatModel).toBe('test-chat')
            expect(mgr.embeddingModel).toBe('test-embed')
        })

        it('should coerce non-string model names', () => {
            const mgr = new MemoryManager({
                llmProvider: mockLLMProvider,
                chatModel: ['test'],
                embeddingModel: { name: 'test' }
            })

            expect(typeof mgr.chatModel).toBe('string')
            expect(typeof mgr.embeddingModel).toBe('string')
        })

        it('should require llmProvider', () => {
            expect(() => new MemoryManager({}))
                .toThrowError('LLM provider is required')
        })
    })

    describe('memory operations', () => {
        beforeEach(async () => {
            mockLLMProvider.generateEmbedding.and.resolveTo(mockEmbedding)
            mockLLMProvider.generateCompletion.and.resolveTo('["test"]')
            mockLLMProvider.generateChat.and.resolveTo('test response')

            await manager.initialize()
        })

        it('should add interactions', async () => {
            await manager.addInteraction(
                'test prompt',
                'test output',
                mockEmbedding,
                ['test']
            )

            expect(mockStorage.saveMemoryToHistory).toHaveBeenCalled()
            expect(manager.memStore.shortTermMemory.length).toBe(1)
        })

        it('should retrieve relevant interactions', async () => {
            const relevantInteractions = await manager.retrieveRelevantInteractions('test query')

            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalled()
            expect(mockLLMProvider.generateCompletion).toHaveBeenCalled()
        })

        it('should generate responses', async () => {
            const response = await manager.generateResponse('test prompt')

            expect(response).toBe('test response')
            expect(mockLLMProvider.generateChat).toHaveBeenCalled()
        })

        it('should handle embedding generation', async () => {
            const embedding = await manager.generateEmbedding('test text')

            expect(embedding).toEqual(mockEmbedding)
            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalled()
        })
    })

    describe('disposal', () => {
        it('should clean up resources', async () => {
            await expectAsync(manager.dispose()).toBeResolved()

            expect(mockStorage.saveMemoryToHistory).toHaveBeenCalled()
            expect(mockStorage.close).toHaveBeenCalled()
            expect(manager.memStore).toBeNull()
        })

        it('should handle disposal errors', async () => {
            const error = new Error('Save failed')
            mockStorage.saveMemoryToHistory.and.rejectWith(error)

            await expectAsync(manager.dispose()).toBeRejectedWith(error)
            // close() should still be called even if save fails
            expect(mockStorage.close).toHaveBeenCalled()
        })

        afterEach(async () => {
            // Reset mocks to successful state for cleanup
            mockStorage.saveMemoryToHistory.and.resolveTo()
            mockStorage.close.and.resolveTo()

            try {
                await manager?.dispose()
            } catch (error) {
                // Ignore cleanup errors in afterEach
            }
        })
    })
})