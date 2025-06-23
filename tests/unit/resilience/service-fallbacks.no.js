import { describe, it, expect, beforeEach, vi } from 'vitest';
import EmbeddingHandler from '../../../src/handlers/EmbeddingHandler.js';
import LLMHandler from '../../../src/handlers/LLMHandler.js';

/**
 * Tests for service fallback mechanisms
 */
describe('Service Fallback Mechanisms', () => {
    describe('EmbeddingHandler Fallbacks', () => {
        let mockProvider;
        let handler;

        beforeEach(() => {
            mockProvider = {
                generateEmbedding: vi.fn()
            };

            handler = new EmbeddingHandler(mockProvider, 'test-model', 1536, null, {
                enableFallbacks: true,
                maxRetries: 2,
                timeoutMs: 1000,
                fallbackEmbeddingStrategy: 'zero_vector'
            });
        });

        it('should use fallback when provider fails', async () => {
            mockProvider.generateEmbedding.mockRejectedValue(new Error('Service unavailable'));

            const result = await handler.generateEmbedding('test text');

            expect(result).toEqual(new Array(1536).fill(0));
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2); // retries
        });

        it('should use different fallback strategies', async () => {
            const randomHandler = new EmbeddingHandler(mockProvider, 'test-model', 4, null, {
                enableFallbacks: true,
                fallbackEmbeddingStrategy: 'random_vector'
            });

            mockProvider.generateEmbedding.mockRejectedValue(new Error('Service unavailable'));

            const result = await randomHandler.generateEmbedding('test text');

            expect(result).toHaveLength(4);
            expect(result.every(x => typeof x === 'number')).toBe(true);
            expect(result.every(x => x >= -0.5 && x <= 0.5)).toBe(true);
        });

        it('should use text hash fallback strategy', async () => {
            const hashHandler = new EmbeddingHandler(mockProvider, 'test-model', 4, null, {
                enableFallbacks: true,
                fallbackEmbeddingStrategy: 'text_hash',
                maxRetries: 1, // Reduce retries for faster testing
                retryDelayMs: 10 // Reduce delay for faster testing
            });

            mockProvider.generateEmbedding.mockRejectedValue(new Error('Service unavailable'));

            const result1 = await hashHandler.generateEmbedding('test text');
            const result2 = await hashHandler.generateEmbedding('test text');

            expect(result1).toHaveLength(4);
            expect(result1).toEqual(result2); // Same text should produce same hash
        }, 10000); // 10 second timeout

        it('should retry with exponential backoff before fallback', async () => {
            const startTime = Date.now();
            mockProvider.generateEmbedding.mockRejectedValue(new Error('Service unavailable'));

            await handler.generateEmbedding('test text');

            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThan(1000); // Should have waited for retries
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2);
        });

        it('should timeout slow operations', async () => {
            mockProvider.generateEmbedding.mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve([1, 2, 3]), 2000))
            );

            const result = await handler.generateEmbedding('test text', { timeoutMs: 100 });

            expect(result).toEqual(new Array(1536).fill(0)); // fallback
        });

        it('should disable fallbacks when configured', async () => {
            const noFallbackHandler = new EmbeddingHandler(mockProvider, 'test-model', 1536, null, {
                enableFallbacks: false
            });

            mockProvider.generateEmbedding.mockRejectedValue(new Error('Service unavailable'));

            await expect(
                noFallbackHandler.generateEmbedding('test text')
            ).rejects.toThrow('Service unavailable');
        });
    });

    describe('LLMHandler Fallbacks', () => {
        let mockProvider;
        let handler;

        beforeEach(() => {
            mockProvider = {
                generateChat: vi.fn(),
                generateCompletion: vi.fn()
            };

            handler = new LLMHandler(mockProvider, 'test-model', 0.7, {
                enableFallbacks: true,
                timeoutMs: 1000,
                fallbackResponse: 'Service temporarily unavailable.'
            });
        });

        it('should use fallback response when provider fails', async () => {
            mockProvider.generateChat.mockRejectedValue(new Error('API error'));

            const result = await handler.generateResponse('Hello', 'context');

            expect(result).toBe('Service temporarily unavailable.');
        });

        it('should provide timeout-specific fallback message', async () => {
            mockProvider.generateChat.mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('Response'), 2000))
            );

            const result = await handler.generateResponse('Hello', 'context', { timeoutMs: 100 });

            expect(result).toContain('took too long');
        });

        it('should use fallback for concept extraction', async () => {
            mockProvider.generateCompletion.mockRejectedValue(new Error('API error'));

            const result = await handler.extractConcepts('artificial intelligence machine learning');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain('artificial');
            expect(result).toContain('intelligence');
        });

        it('should extract basic concepts from text', () => {
            const concepts = handler.extractBasicConcepts(
                'Artificial intelligence and machine learning are transforming technology.'
            );

            expect(concepts).toContain('artificial');
            expect(concepts).toContain('intelligence');
            expect(concepts).toContain('machine');
            expect(concepts).toContain('learning');
            expect(concepts).not.toContain('and'); // common word filtered
        });

        it('should handle timeout with existing rate limiting', async () => {
            mockProvider.generateChat.mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('Response'), 2000))
            );

            const startTime = Date.now();
            const result = await handler.generateResponse('Hello', 'context', { 
                timeoutMs: 500,
                maxRetries: 1
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // Should timeout quickly
            expect(result).toContain('Service temporarily unavailable');
        });

        it('should disable fallbacks when configured', async () => {
            const noFallbackHandler = new LLMHandler(mockProvider, 'test-model', 0.7, {
                enableFallbacks: false
            });

            mockProvider.generateChat.mockRejectedValue(new Error('API error'));

            await expect(
                noFallbackHandler.generateResponse('Hello', 'context')
            ).rejects.toThrow('API error');
        });
    });
});