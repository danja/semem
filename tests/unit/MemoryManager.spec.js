import { TestHelper } from '../helpers/TestHelper.js'
import MemoryManager from '../../src/MemoryManager.js'

describe('MemoryManager', () => {
    let manager
    let mockLLM
    let mockStore
    let cleanupFns = []

    beforeAll(() => {
        jasmine.addMatchers(TestHelper.jasmineMatchers)
    })

    beforeEach(async () => {
        // Setup mocks
        mockLLM = {
            generateEmbedding: jasmine.createSpy('generateEmbedding')
                .and.resolveTo(new Array(1536).fill(0)),
            generateChat: jasmine.createSpy('generateChat')
                .and.resolveTo('test response'),
            generateCompletion: jasmine.createSpy('generateCompletion')
                .and.resolveTo('["test"]')
        }

        mockStore = {
            loadHistory: jasmine.createSpy('loadHistory').and.resolveTo([[], []]),
            saveMemoryToHistory: jasmine.createSpy('saveMemoryToHistory'),
            close: jasmine.createSpy('close'),
            beginTransaction: jasmine.createSpy('beginTransaction'),
            commitTransaction: jasmine.createSpy('commitTransaction'),
            rollbackTransaction: jasmine.createSpy('rollbackTransaction')
        }

        // Create manager instance
        manager = new MemoryManager({
            llmProvider: mockLLM,
            storage: mockStore,
            chatModel: 'test-model',
            embeddingModel: 'test-embed'
        })

        // Install spies
        spyOn(console, 'error')
        spyOn(console, 'log')
        jasmine.clock().install()
    })

    afterEach(() => {
        jasmine.clock().uninstall()
        cleanupFns.forEach(fn => fn())
        cleanupFns = []
    })

    describe('Initialization', () => {
        it('should initialize with provided configuration', async () => {
            await expectAsync(manager.initialize()).toBeResolved()
            expect(mockStore.loadHistory).toHaveBeenCalled()
        })

        it('should handle initialization errors', async () => {
            mockStore.loadHistory.and.rejectWith(new Error('Load failed'))
            await expectAsync(manager.initialize())
                .toBeRejectedWith(jasmine.objectContaining({
                    message: jasmine.stringContaining('Load failed')
                }))
        })
    })

    describe('Memory Operations', () => {
        beforeEach(async () => {
            await manager.initialize()
        })

        it('should add interactions', async () => {
            await expectAsync(manager.addInteraction(
                'test prompt',
                'test output',
                [0, 1, 2],
                ['test']
            )).toBeResolved()

            expect(mockStore.saveMemoryToHistory).toHaveBeenCalled()
        })

        it('should retrieve relevant interactions', async () => {
            const retrievals = await manager.retrieveRelevantInteractions('test query')
            expect(mockLLM.generateEmbedding).toHaveBeenCalled()
            expect(retrievals).toBeDefined()
        })
    })

    describe('Error Handling', () => {
        it('should handle provider errors', async () => {
            mockLLM.generateEmbedding.and.rejectWith(new Error('Network error'))

            await expectAsync(manager.generateEmbedding('test'))
                .toBeRejectedWith(jasmine.objectContaining({
                    message: jasmine.stringContaining('Network error')
                }))
        })

        it('should handle timeouts', async () => {
            mockLLM.generateChat.and.rejectWith(new Error('Timeout'))

            await expectAsync(manager.generateResponse('test'))
                .toBeRejectedWith(jasmine.objectContaining({
                    message: jasmine.stringContaining('Timeout')
                }))
        })
    })

    describe('Resource Management', () => {
        it('should clean up resources on disposal', async () => {
            await manager.dispose()
            expect(mockStore.close).toHaveBeenCalled()
        })
    })
})