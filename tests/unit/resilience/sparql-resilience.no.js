import { describe, it, expect, beforeEach, vi } from 'vitest';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

/**
 * Tests for SPARQL backend resilience improvements
 */
describe('SPARQLStore Resilience', () => {
    let store;
    let mockEndpoint;

    beforeEach(() => {
        mockEndpoint = {
            query: 'http://localhost:3030/test/query',
            update: 'http://localhost:3030/test/update'
        };

        store = new SPARQLStore(mockEndpoint, {
            graphName: 'http://test.org/graph',
            enableResilience: true, // Enable resilience features for testing
            maxRetries: 2,
            timeoutMs: 5000,
            retryDelayMs: 100,
            enableFallbacks: true
        });

        // Mock fetch globally
        global.fetch = vi.fn();
    });

    describe('executeWithResilience', () => {
        it('should retry failed operations with exponential backoff', async () => {
            const mockOperation = vi.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValueOnce('Success');

            const result = await store.executeWithResilience(mockOperation, 'test');

            expect(mockOperation).toHaveBeenCalledTimes(3);
            expect(result).toBe('Success');
        });

        it('should provide fallback for failed queries', async () => {
            const mockOperation = vi.fn()
                .mockRejectedValue(new Error('Persistent failure'));

            const result = await store.executeWithResilience(mockOperation, 'query');

            expect(result).toEqual({
                results: {
                    bindings: []
                }
            });
        });

        it('should throw error for failed updates after retries', async () => {
            const mockOperation = vi.fn()
                .mockRejectedValue(new Error('Persistent failure'));

            await expect(
                store.executeWithResilience(mockOperation, 'update')
            ).rejects.toThrow('SPARQL update failed after 2 attempts');
        });
    });

    describe('withTimeout', () => {
        it('should resolve normally for quick operations', async () => {
            const quickOperation = Promise.resolve('Quick result');
            
            const result = await store.withTimeout(quickOperation, 1000);
            
            expect(result).toBe('Quick result');
        });

        it('should timeout slow operations', async () => {
            const slowOperation = new Promise(resolve => 
                setTimeout(() => resolve('Slow result'), 2000)
            );

            await expect(
                store.withTimeout(slowOperation, 100)
            ).rejects.toThrow('SPARQL operation timed out');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy status for working endpoint', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    results: {
                        bindings: [{ count: { value: '5' } }]
                    }
                })
            });

            const health = await store.healthCheck();

            expect(health.healthy).toBe(true);
            expect(health.endpoint).toBe(mockEndpoint.query);
        });

        it('should return unhealthy status for failing endpoint', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

            const health = await store.healthCheck();

            expect(health.healthy).toBe(false);
            expect(health.error).toContain('Connection refused');
        });
    });

    describe('SPARQL query execution', () => {
        it('should execute queries with resilience wrapper', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    results: {
                        bindings: [
                            { entity: { value: 'http://test.org/entity1' } }
                        ]
                    }
                })
            };

            global.fetch.mockResolvedValueOnce(mockResponse);

            const result = await store._executeSparqlQuery(
                'SELECT * WHERE { ?s ?p ?o }',
                mockEndpoint.query
            );

            expect(result.results.bindings).toHaveLength(1);
            expect(global.fetch).toHaveBeenCalledWith(
                mockEndpoint.query,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/sparql-query'
                    })
                })
            );
        });

        it('should handle network errors with retry mechanism', async () => {
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ results: { bindings: [] } })
                });

            const result = await store._executeSparqlQuery(
                'SELECT * WHERE { ?s ?p ?o }',
                mockEndpoint.query
            );

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(result.results.bindings).toEqual([]);
        });
    });

    describe('SPARQL update execution', () => {
        it('should execute updates with resilience wrapper', async () => {
            const mockResponse = {
                ok: true
            };

            global.fetch.mockResolvedValueOnce(mockResponse);

            const result = await store._executeSparqlUpdate(
                'INSERT DATA { <s> <p> <o> }',
                mockEndpoint.update
            );

            expect(result.ok).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                mockEndpoint.update,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/sparql-update'
                    })
                })
            );
        });

        it('should retry failed updates', async () => {
            global.fetch
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce({ ok: true });

            const result = await store._executeSparqlUpdate(
                'INSERT DATA { <s> <p> <o> }',
                mockEndpoint.update
            );

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(result.ok).toBe(true);
        });
    });

    describe('configuration', () => {
        it('should accept resilience configuration options', () => {
            const customStore = new SPARQLStore(mockEndpoint, {
                maxRetries: 5,
                timeoutMs: 10000,
                retryDelayMs: 500,
                enableFallbacks: false
            });

            expect(customStore.resilience.maxRetries).toBe(5);
            expect(customStore.resilience.timeoutMs).toBe(10000);
            expect(customStore.resilience.retryDelayMs).toBe(500);
            expect(customStore.resilience.enableFallbacks).toBe(false);
        });

        it('should use default resilience configuration', () => {
            const defaultStore = new SPARQLStore(mockEndpoint);

            expect(defaultStore.resilience.maxRetries).toBe(3);
            expect(defaultStore.resilience.timeoutMs).toBe(30000);
            expect(defaultStore.resilience.retryDelayMs).toBe(1000);
            expect(defaultStore.resilience.enableFallbacks).toBe(true);
        });
    });
});