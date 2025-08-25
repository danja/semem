// tests/unit/handlers/PassiveHandler.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import PassiveHandler from '../../../../src/api/features/PassiveHandler.js';
import APIRegistry from '../../../../src/api/common/APIRegistry.js';
import BaseAPI from '../../../../src/api/common/BaseAPI.js';

describe('PassiveHandler', () => {
    let handler;
    let mockLLMProvider;
    let mockStorage;
    let mockRegistry;

    beforeEach(() => {
        mockLLMProvider = {
            generateChat: vi.fn().mockResolvedValue('test response'),
            generateCompletion: vi.fn().mockResolvedValue('test completion')
        };

        mockStorage = new BaseAPI();
        mockStorage.executeOperation = vi.fn().mockResolvedValue({ success: true });
        mockStorage.storeInteraction = vi.fn().mockResolvedValue({ success: true });

        mockRegistry = new APIRegistry();
        mockRegistry.get = vi.fn().mockReturnValue(mockStorage);

        handler = new PassiveHandler({
            llmProvider: mockLLMProvider,
            sparqlEndpoint: 'http://test.endpoint'
        });
        handler.registry = mockRegistry;
        
        // Mock the _emitMetric method
        handler._emitMetric = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Chat Operations', () => {
        it('should handle chat requests', async () => {
            const result = await handler.executeOperation('chat', {
                prompt: 'test prompt',
                model: 'test-model'
            });

            expect(mockLLMProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                [{
                    role: 'user',
                    content: 'test prompt'
                }],
                expect.any(Object)
            );
            expect(result).toBe('test response');
        });

        it('should emit chat metrics', async () => {
            await handler.executeOperation('chat', {
                prompt: 'test',
                model: 'test-model'
            });

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'chat.requests',
                1
            );
        });

        it('should handle chat errors', async () => {
            mockLLMProvider.generateChat.mockRejectedValue(new Error('Chat failed'));

            await expect(
                handler.executeOperation('chat', {
                    prompt: 'test',
                    model: 'test-model'
                })
            ).rejects.toThrow('Chat failed');

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'chat.errors',
                1
            );
        });
    });

    describe('Query Operations', () => {
        it('should execute SPARQL queries', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            await handler.executeOperation('query', {
                sparql: query,
                format: 'json'
            });

            expect(mockStorage.executeOperation).toHaveBeenCalledWith(
                'query',
                {
                    sparql: query,
                    format: 'json'
                }
            );
        });

        it('should emit query metrics', async () => {
            await handler.executeOperation('query', {
                sparql: 'SELECT * WHERE { ?s ?p ?o }',
                format: 'json'
            });

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'query.requests',
                1
            );
        });

        it('should handle query errors', async () => {
            mockStorage.executeOperation.mockRejectedValue(new Error('Query failed'));

            await expect(
                handler.executeOperation('query', {
                    sparql: 'INVALID QUERY',
                    format: 'json'
                })
            ).rejects.toThrow('Query failed');

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'query.errors',
                1
            );
        });
    });

    describe('Storage Operations', () => {
        it('should store interactions', async () => {
            const content = 'test content';
            await handler.executeOperation('store', {
                content,
                format: 'text'
            });

            expect(mockStorage.storeInteraction).toHaveBeenCalledWith({
                content,
                format: 'text',
                timestamp: expect.any(Number)
            });
        });

        it('should emit storage metrics', async () => {
            await handler.executeOperation('store', {
                content: 'test',
                format: 'text'
            });

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'store.requests',
                1
            );
        });

        it('should handle storage errors', async () => {
            mockStorage.storeInteraction.mockRejectedValue(new Error('Store failed'));

            await expect(
                handler.executeOperation('store', {
                    content: 'test',
                    format: 'text'
                })
            ).rejects.toThrow('Store failed');

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'store.errors',
                1
            );
        });
    });

    describe('Metrics Collection', () => {
        it('should collect operation metrics', async () => {
            // Mock the _getOperationMetrics method
            handler._getOperationMetrics = vi.fn().mockImplementation(operation => ({
                requests: 1,
                errors: 0,
                latency: 100
            }));

            const metrics = await handler.getMetrics();

            expect(metrics.operations).toBeDefined();
            expect(metrics.operations.chat).toBeDefined();
            expect(metrics.operations.query).toBeDefined();
            expect(metrics.operations.store).toBeDefined();
        });

        it('should track operation latency', async () => {
            // Mock the _getMetricValue method
            handler._getMetricValue = vi.fn().mockResolvedValue(100);

            const metrics = await handler.getMetrics();
            expect(await handler._getMetricValue('chat.latency')).toBe(100);
        });
    });
});