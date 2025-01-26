// tests/unit/handlers/ActiveHandler.spec.js
import ActiveHandler from '../../../src/api/features/ActiveHandler.js'
import { APIRegistry } from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

describe('ActiveHandler', () => {
    let handler
    let mockMemory
    let mockPassive
    let mockRegistry

    beforeEach(() => {
        mockMemory = new BaseAPI()
        Object.assign(mockMemory, {
            retrieveRelevantInteractions: jasmine.createSpy().and.resolveTo([{
                interaction: { prompt: 'test', output: 'response' },
                similarity: 0.8
            }]),
            generateEmbedding: jasmine.createSpy().and.resolveTo(new Array(1536).fill(0)),
            extractConcepts: jasmine.createSpy().and.resolveTo(['test']),
            addInteraction: jasmine.createSpy().and.resolveTo(true)
        })

        mockPassive = new BaseAPI()
        mockPassive.executeOperation = jasmine.createSpy().and.resolveTo('test response')

        mockRegistry = new APIRegistry()
        const mockGet = jasmine.createSpy('get')
        mockGet.and.callFake(name => {
            if (name === 'memory') return mockMemory
            if (name === 'passive') return mockPassive
            return null
        })
        mockRegistry.get = mockGet

        handler = new ActiveHandler({
            contextWindow: 3,
            similarityThreshold: 0.7
        })
        handler.registry = mockRegistry
    })

    describe('Interaction Management', () => {
        it('should handle complete interaction flow', async () => {
            const result = await handler.executeOperation('interact', {
                prompt: 'test question',
                context: []
            })

            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalled()
            expect(mockPassive.executeOperation).toHaveBeenCalled()
            expect(mockMemory.generateEmbedding).toHaveBeenCalled()
            expect(mockMemory.extractConcepts).toHaveBeenCalled()
            expect(mockMemory.addInteraction).toHaveBeenCalled()

            expect(result.response).toBe('test response')
            expect(result.concepts).toEqual(['test'])
            expect(result.retrievals).toBeDefined()
        })

        it('should apply similarity threshold', async () => {
            await handler.executeOperation('interact', {
                prompt: 'test question'
            })

            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalledWith(
                'test question',
                0.7
            )
        })

        it('should handle interaction errors', async () => {
            mockPassive.executeOperation.and.rejectWith(new Error('Chat failed'))
            spyOn(handler, '_emitMetric')

            await expectAsync(
                handler.executeOperation('interact', { prompt: 'test' })
            ).toBeRejected()

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'interaction.errors',
                1
            )
        })
    })

    describe('Context Management', () => {
        it('should build context with retrievals', async () => {
            const retrievals = [{
                interaction: {
                    prompt: 'previous',
                    output: 'answer'
                },
                similarity: 0.9
            }]
            mockMemory.retrieveRelevantInteractions.and.resolveTo(retrievals)

            const result = await handler.executeOperation('interact', {
                prompt: 'test',
                context: []
            })

            expect(mockPassive.executeOperation).toHaveBeenCalledWith(
                'chat',
                jasmine.objectContaining({
                    context: jasmine.stringContaining('previous')
                })
            )
        })

        it('should respect context window size', async () => {
            const recentInteractions = Array(5).fill().map((_, i) => ({
                prompt: `q${i}`,
                output: `a${i}`
            }))

            await handler.executeOperation('interact', {
                prompt: 'test',
                context: recentInteractions
            })

            const chatCall = mockPassive.executeOperation.calls.mostRecent()
            const context = chatCall.args[1].context
            expect(context.split('Q:').length - 1).toBeLessThanOrEqual(3)
        })
    })

    describe('Search Operations', () => {
        it('should handle semantic search', async () => {
            const result = await handler.executeOperation('search', {
                query: 'test query',
                type: 'semantic',
                limit: 5
            })

            expect(mockMemory.generateEmbedding).toHaveBeenCalledWith('test query')
            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalled()
            expect(result).toBeDefined()
        })

        it('should handle SPARQL search', async () => {
            await handler.executeOperation('search', {
                query: 'test',
                type: 'sparql',
                limit: 5
            })

            expect(mockPassive.executeOperation).toHaveBeenCalledWith(
                'query',
                jasmine.objectContaining({
                    sparql: jasmine.stringMatching(/SELECT.*WHERE/)
                })
            )
        })
    })

    describe('Analysis Operations', () => {
        it('should handle concept extraction', async () => {
            const result = await handler.executeOperation('analyze', {
                content: 'test content',
                type: 'concept'
            })

            expect(mockMemory.extractConcepts).toHaveBeenCalledWith('test content')
            expect(result).toEqual(['test'])
        })

        it('should handle embedding generation', async () => {
            await handler.executeOperation('analyze', {
                content: 'test content',
                type: 'embedding'
            })

            expect(mockMemory.generateEmbedding).toHaveBeenCalledWith('test content')
        })
    })

    describe('Metrics', () => {
        it('should track operation metrics', async () => {
            spyOn(handler, '_emitMetric')

            await handler.executeOperation('interact', {
                prompt: 'test'
            })

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'interaction.count',
                1
            )
        })

        it('should aggregate operation statistics', async () => {
            const metrics = await handler.getMetrics()
            expect(metrics.operations).toBeDefined()
            expect(metrics.operations.interaction).toBeDefined()
            expect(metrics.operations.search).toBeDefined()
            expect(metrics.operations.analysis).toBeDefined()
        })
    })
})