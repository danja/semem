// tests/unit/handlers/ActiveHandler.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import ActiveHandler from '../../../../src/api/features/ActiveHandler.js';
import APIRegistry from '../../../../src/api/common/APIRegistry.js';
import BaseAPI from '../../../../src/api/common/BaseAPI.js';

describe('ActiveHandler', () => {
    let handler;
    let mockMemory;
    let mockPassive;
    let mockRegistry;

    beforeEach(() => {
        mockMemory = new BaseAPI();
        Object.assign(mockMemory, {
            retrieveRelevantInteractions: vi.fn().mockResolvedValue([{
                interaction: { prompt: 'test', output: 'response' },
                similarity: 0.8
            }]),
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
            extractConcepts: vi.fn().mockResolvedValue(['test']),
            addInteraction: vi.fn().mockResolvedValue(true)
        });

        mockPassive = new BaseAPI();
        mockPassive.executeOperation = vi.fn().mockResolvedValue('test response');

        mockRegistry = new APIRegistry();
        const mockGet = vi.fn();
        mockGet.mockImplementation(name => {
            if (name === 'memory') return mockMemory;
            if (name === 'passive') return mockPassive;
            return null;
        });
        mockRegistry.get = mockGet;

        handler = new ActiveHandler({
            contextWindow: 3,
            similarityThreshold: 0.7
        });
        handler.registry = mockRegistry;
        
        // Mock the _emitMetric method to avoid undefined issues
        handler._emitMetric = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Interaction Management', () => {
        it('should handle complete interaction flow', async () => {
            const result = await handler.executeOperation('interact', {
                prompt: 'test question',
                context: []
            });

            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalled();
            expect(mockPassive.executeOperation).toHaveBeenCalled();
            expect(mockMemory.generateEmbedding).toHaveBeenCalled();
            expect(mockMemory.extractConcepts).toHaveBeenCalled();
            expect(mockMemory.addInteraction).toHaveBeenCalled();

            expect(result.response).toBe('test response');
            expect(result.concepts).toEqual(['test']);
            expect(result.retrievals).toBeDefined();
        });

        it('should apply similarity threshold', async () => {
            await handler.executeOperation('interact', {
                prompt: 'test question'
            });

            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalledWith(
                'test question',
                0.7
            );
        });

        it('should handle interaction errors', async () => {
            mockPassive.executeOperation.mockRejectedValue(new Error('Chat failed'));

            await expect(
                handler.executeOperation('interact', { prompt: 'test' })
            ).rejects.toThrow('Chat failed');

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'interaction.errors',
                1
            );
        });
    });

    describe('Context Management', () => {
        it('should build context with retrievals', async () => {
            const retrievals = [{
                interaction: {
                    prompt: 'previous',
                    output: 'answer'
                },
                similarity: 0.9
            }];
            mockMemory.retrieveRelevantInteractions.mockResolvedValue(retrievals);

            await handler.executeOperation('interact', {
                prompt: 'test',
                context: []
            });

            expect(mockPassive.executeOperation).toHaveBeenCalledWith(
                'chat',
                expect.objectContaining({
                    context: expect.anything()
                })
            );
            
            // Get the call arguments
            const callArgs = mockPassive.executeOperation.mock.calls[0][1];
            
            // Check if the context contains the expected previous message
            expect(callArgs.context.relevant[0].prompt).toBe('previous');
        });

        it('should respect context window size', async () => {
            const recentInteractions = Array(5).fill().map((_, i) => ({
                prompt: `q${i}`,
                output: `a${i}`
            }));

            await handler.executeOperation('interact', {
                prompt: 'test',
                context: recentInteractions
            });

            const callArgs = mockPassive.executeOperation.mock.calls[0][1];
            expect(callArgs.context.previous.length).toBeLessThanOrEqual(3);
        });
    });

    describe('Search Operations', () => {
        it('should handle semantic search', async () => {
            const result = await handler.executeOperation('search', {
                query: 'test query',
                type: 'semantic',
                limit: 5
            });

            expect(mockMemory.generateEmbedding).toHaveBeenCalledWith('test query');
            expect(mockMemory.retrieveRelevantInteractions).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should handle SPARQL search', async () => {
            await handler.executeOperation('search', {
                query: 'test',
                type: 'sparql',
                limit: 5
            });

            expect(mockPassive.executeOperation).toHaveBeenCalledWith(
                'query',
                expect.objectContaining({
                    sparql: expect.stringContaining('SELECT')
                })
            );
        });
    });

    describe('Analysis Operations', () => {
        it('should handle concept extraction', async () => {
            const result = await handler.executeOperation('analyze', {
                content: 'test content',
                type: 'concept'
            });

            expect(mockMemory.extractConcepts).toHaveBeenCalledWith('test content');
            expect(result).toEqual(['test']);
        });

        it('should handle embedding generation', async () => {
            await handler.executeOperation('analyze', {
                content: 'test content',
                type: 'embedding'
            });

            expect(mockMemory.generateEmbedding).toHaveBeenCalledWith('test content');
        });
    });

    describe('Metrics', () => {
        it('should track operation metrics', async () => {
            await handler.executeOperation('interact', {
                prompt: 'test'
            });

            expect(handler._emitMetric).toHaveBeenCalledWith(
                'interaction.count',
                1
            );
        });

        it('should aggregate operation statistics', async () => {
            // Mock the _getMetricValue method to return test values
            handler._getMetricValue = vi.fn().mockResolvedValue(1);
            
            const metrics = await handler.getMetrics();
            expect(metrics.operations).toBeDefined();
            expect(metrics.operations.interaction).toBeDefined();
            expect(metrics.operations.search).toBeDefined();
            expect(metrics.operations.analysis).toBeDefined();
        });
    });
});