// tests/unit/MemoryManager.spec.js
import { BaseTest } from '../helpers/BaseTest.js'
import { TestHelper } from '../helpers/TestHelper.js'
import MemoryManager from '../../src/MemoryManager.js'

class MemoryManagerTest extends BaseTest {
    beforeEach() {
        super.beforeEach()

        // Initialize mocks
        this.mockLLM = this.addMock(TestHelper.createMockLLMProvider())
        this.mockStore = this.addMock(TestHelper.createMockStore())

        // Create manager instance
        this.manager = new MemoryManager({
            llmProvider: this.mockLLM,
            storage: this.mockStore,
            chatModel: 'test-model',
            embeddingModel: 'test-embed',
            dimension: 1536
        })
    }

    async initManager() {
        await this.manager.initialize()
    }
}

describe('MemoryManager', () => {
    let test

    beforeEach(() => {
        test = new MemoryManagerTest()
    })

    describe('Initialization', () => {
        it('should initialize with configuration', async () => {
            await test.expectSuccess(test.initManager())
            expect(test.mockStore.loadHistory).toHaveBeenCalled()
        })

        it('should reject without LLM provider', async () => {
            const invalidManager = new MemoryManager({
                storage: test.mockStore
            })
            await test.expectFailure(invalidManager.initialize())
        })

        it('should handle store initialization failure', async () => {
            test.mockStore.loadHistory.and.rejectWith(new Error('Store error'))
            await test.expectFailure(test.initManager())
        })
    })

    describe('Memory Operations', () => {
        beforeEach(async () => {
            await test.initManager()
        })

        it('should add interactions', async () => {
            const interaction = {
                prompt: 'test prompt',
                output: 'test output',
                embedding: new Array(1536).fill(0),
                concepts: ['test']
            }

            await test.expectSuccess(test.manager.addInteraction(
                interaction.prompt,
                interaction.output,
                interaction.embedding,
                interaction.concepts
            ))

            expect(test.mockStore.saveMemoryToHistory).toHaveBeenCalled()
        })

        it('should retrieve relevant interactions', async () => {
            const query = 'test query'
            await test.manager.retrieveRelevantInteractions(query)

            expect(test.mockLLM.generateEmbedding).toHaveBeenCalledWith(
                'test-embed',
                query
            )
        })

        it('should generate responses with context', async () => {
            const prompt = 'test prompt'
            const lastInteractions = [{ prompt: 'prev', output: 'answer' }]
            const retrievals = [{ similarity: 0.8, interaction: lastInteractions[0] }]

            await test.manager.generateResponse(prompt, lastInteractions, retrievals)

            expect(test.mockLLM.generateChat).toHaveBeenCalledWith(
                'test-model',
                jasmine.any(Array)
            )
        })
    })

    describe('Error Handling', () => {
        beforeEach(async () => {
            await test.initManager()
        })

        it('should handle embeddings error', async () => {
            test.mockLLM.generateEmbedding.and.rejectWith(new Error('Embedding failed'))
            await test.expectFailure(
                test.manager.generateEmbedding('test'),
                Error
            )
        })

        it('should handle store errors', async () => {
            test.mockStore.saveMemoryToHistory.and.rejectWith(new Error('Store failed'))
            await test.expectFailure(
                test.manager.addInteraction('test', 'output', [], []),
                Error
            )
        })

        it('should handle chat generation errors', async () => {
            test.mockLLM.generateChat.and.rejectWith(new Error('Chat failed'))
            await test.expectFailure(
                test.manager.generateResponse('test'),
                Error
            )
        })
    })

    describe('Resource Management', () => {
        beforeEach(async () => {
            await test.initManager()
        })

        it('should dispose resources', async () => {
            await test.manager.dispose()
            expect(test.mockStore.close).toHaveBeenCalled()
        })

        it('should save state before disposal', async () => {
            await test.manager.dispose()
            expect(test.mockStore.saveMemoryToHistory).toHaveBeenCalled()
        })

        it('should handle disposal errors', async () => {
            test.mockStore.saveMemoryToHistory.and.rejectWith(new Error('Save failed'))
            test.mockStore.close.and.rejectWith(new Error('Close failed'))

            await test.expectFailure(test.manager.dispose())
            expect(test.mockStore.close).toHaveBeenCalled()
        })
    })

    describe('Cache Management', () => {
        beforeEach(async () => {
            await test.initManager()
        })

        it('should cache embeddings', async () => {
            const text = 'test text'
            await test.manager.generateEmbedding(text)
            await test.manager.generateEmbedding(text)

            expect(test.mockLLM.generateEmbedding).toHaveBeenCalledTimes(1)
        })

        it('should cache concept extractions', async () => {
            const text = 'test concepts'
            await test.manager.extractConcepts(text)
            await test.manager.extractConcepts(text)

            expect(test.mockLLM.generateCompletion).toHaveBeenCalledTimes(1)
        })
    })
})