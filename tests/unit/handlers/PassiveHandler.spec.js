// tests/unit/handlers/PassiveHandler.spec.js
import PassiveHandler from '../../../src/api/features/PassiveHandler.js'
import { APIRegistry } from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

describe('PassiveHandler', () => {
    let handler
    let mockLLMProvider
    let mockStorage
    let mockRegistry

    beforeEach(() => {
        mockLLMProvider = {
            generateChat: jasmine.createSpy('generateChat')
                .and.resolveTo('test response'),
            generateCompletion: jasmine.createSpy('generateCompletion')
                .and.resolveTo('test completion')
        }

        mockStorage = new BaseAPI()
        spyOn(mockStorage, 'executeOperation').and.resolveTo({ success: true })
        spyOn(mockStorage, 'storeInteraction').and.resolveTo({ success: true })

        mockRegistry = new APIRegistry()
        spyOn(mockRegistry, 'get').and.returnValue(mockStorage)

        handler = new PassiveHandler({
            llmProvider: mockLLMProvider,
            sparqlEndpoint: 'http://test.endpoint'
        })
        handler.registry = mockRegistry
    })

    describe('Chat Operations', () => {
        it('should handle chat requests', async () => {
            const result = await handler.executeOperation('chat', {
                prompt: 'test prompt',
                model: 'test-model'
            })

            expect(mockLLMProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                [{
                    role: 'user',
                    content: 'test prompt'
                }],
                jasmine.any(Object)
            )
            expect(result).toBe('test response')
        })

        it('should emit chat metrics', async () => {
            spyOn(handler, '_emitMetric')

            await handler.executeOperation('chat', {
                prompt: 'test',
                model: 'test-model'
            })

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'chat.requests',
                1
            )
        })

        it('should handle chat errors', async () => {
            mockLLMProvider.generateChat.and.rejectWith(new Error('Chat failed'))
            spyOn(handler, '_emitMetric')

            await expectAsync(
                handler.executeOperation('chat', {
                    prompt: 'test',
                    model: 'test-model'
                })
            ).toBeRejected()

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'chat.errors',
                1
            )
        })
    })

    describe('Query Operations', () => {
        it('should execute SPARQL queries', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'
            await handler.executeOperation('query', {
                sparql: query,
                format: 'json'
            })

            expect(mockStorage.executeOperation).toHaveBeenCalledWith(
                'query',
                {
                    sparql: query,
                    format: 'json'
                }
            )
        })

        it('should emit query metrics', async () => {
            spyOn(handler, '_emitMetric')

            await handler.executeOperation('query', {
                sparql: 'SELECT * WHERE { ?s ?p ?o }',
                format: 'json'
            })

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'query.requests',
                1
            )
        })

        it('should handle query errors', async () => {
            mockStorage.executeOperation.and.rejectWith(new Error('Query failed'))
            spyOn(handler, '_emitMetric')

            await expectAsync(
                handler.executeOperation('query', {
                    sparql: 'INVALID QUERY',
                    format: 'json'
                })
            ).toBeRejected()

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'query.errors',
                1
            )
        })
    })

    describe('Storage Operations', () => {
        it('should store interactions', async () => {
            const content = 'test content'
            await handler.executeOperation('store', {
                content,
                format: 'text'
            })

            expect(mockStorage.storeInteraction).toHaveBeenCalledWith({
                content,
                format: 'text',
                timestamp: jasmine.any(Number)
            })
        })

        it('should emit storage metrics', async () => {
            spyOn(handler, '_emitMetric')

            await handler.executeOperation('store', {
                content: 'test',
                format: 'text'
            })

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'store.requests',
                1
            )
        })

        it('should handle storage errors', async () => {
            mockStorage.storeInteraction.and.rejectWith(new Error('Store failed'))
            spyOn(handler, '_emitMetric')

            await expectAsync(
                handler.executeOperation('store', {
                    content: 'test',
                    format: 'text'
                })
            ).toBeRejected()

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'store.errors',
                1
            )
        })
    })

    describe('Metrics Collection', () => {
        it('should collect operation metrics', async () => {
            const metrics = await handler.getMetrics()

            expect(metrics.operations).toBeDefined()
            expect(metrics.operations.chat).toBeDefined()
            expect(metrics.operations.query).toBeDefined()
            expect(metrics.operations.store).toBeDefined()
        })

        it('should aggregate metrics by operation', async () => {
            await handler.executeOperation('chat', {
                prompt: 'test',
                model: 'test-model'
            })

            const metrics = await handler.getMetrics()
            expect(metrics.operations.chat.requests).toBe(1)
        })

        it('should track operation latency', async () => {
            spyOn(handler, '_getMetricValue').and.resolveTo(100)

            const metrics = await handler.getMetrics()
            expect(metrics.operations.chat.latency).toBe(100)
        })
    })
})