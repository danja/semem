// tests/core/unit/stores/modules/Search.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Search } from '../../../../../src/stores/modules/Search.js';

describe('Search', () => {
    let search;
    let mockSparqlExecute;
    let mockQueryService;
    let mockVectors;
    let graphName;

    beforeEach(() => {
        graphName = 'http://test.org/graph';

        mockSparqlExecute = {
            executeSparqlQuery: vi.fn().mockResolvedValue({
                results: { bindings: [] }
            })
        };

        mockVectors = {
            calculateCosineSimilarity: vi.fn().mockReturnValue(0.8)
        };

        search = new Search(mockSparqlExecute, mockVectors, graphName);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with required dependencies', () => {
            expect(search.sparqlExecute).toBe(mockSparqlExecute);
            expect(search.vectors).toBe(mockVectors);
            expect(search.graphName).toBe(graphName);
        });
    });

    describe('findSimilarElements', () => {
        it('should execute similarity search successfully', async () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/item1' },
                            label: { value: 'Test Item 1' },
                            type: { value: 'Entity' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.6)) }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);
            mockVectors.calculateCosineSimilarity.mockReturnValue(0.8);

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            expect(mockSparqlExecute.executeSparqlQuery).toHaveBeenCalled();
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                id: 'http://example.org/item1',
                content: 'Test Item 1',
                similarity: 0.8,
                metadata: {
                    type: 'Entity',
                    timestamp: undefined
                }
            });
        });

        it('should apply similarity threshold filtering', async () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/item1' },
                            label: { value: 'Test Item 1' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.6)) }
                        }
                    ]
                }
            };

            // Mock low similarity that should be filtered out
            mockVectors.calculateCosineSimilarity.mockReturnValue(0.5);
            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            expect(results).toHaveLength(0); // Filtered out due to low similarity
        });

        it('should handle query timeout', async () => {
            const queryEmbedding = new Array(768).fill(0.5);

            // Mock a hanging query
            mockSparqlExecute.executeSparqlQuery.mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 10000))
            );

            vi.useFakeTimers();
            const searchPromise = search.findSimilarElements(queryEmbedding, 10, 0.7);

            // Advance timers to trigger timeout
            vi.advanceTimersByTime(6000); // Assuming 5 second timeout

            const results = await searchPromise;
            expect(results).toEqual([]);

            vi.useRealTimers();
        });

        it('should handle different embedding formats', async () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/item1' },
                            label: { value: 'Ragno Item' },
                            embeddingVector: { value: JSON.stringify(new Array(768).fill(0.6)) }
                        },
                        {
                            uri: { value: 'http://example.org/item2' },
                            label: { value: 'Semem Item' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.7)), type: 'literal' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            expect(results).toHaveLength(2);
            expect(results[0].label).toBe('Ragno Item');
            expect(results[1].label).toBe('Semem Item');
        });

        it('should handle malformed embeddings gracefully', async () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/item1' },
                            label: { value: 'Valid Item' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.6)) }
                        },
                        {
                            uri: { value: 'http://example.org/item2' },
                            label: { value: 'Invalid Item' },
                            embedding: { value: 'invalid json' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            expect(results).toHaveLength(1); // Only valid item should be included
            expect(results[0].label).toBe('Valid Item');
        });

        it('should enforce processing limits', async () => {
            const queryEmbedding = new Array(768).fill(0.5);

            // Create a large number of bindings
            const bindings = [];
            for (let i = 0; i < 200; i++) {
                bindings.push({
                    uri: { value: `http://example.org/item${i}` },
                    label: { value: `Item ${i}` },
                    embedding: { value: JSON.stringify(new Array(768).fill(0.8)) }
                });
            }

            const mockResult = { results: { bindings } };
            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            // Should be limited by processing limits, not just result limit
            expect(results.length).toBeLessThanOrEqual(100); // Assuming max processing limit
        });

        it('should handle query errors gracefully', async () => {
            const queryEmbedding = new Array(768).fill(0.5);

            mockSparqlExecute.executeSparqlQuery.mockRejectedValueOnce(new Error('SPARQL error'));

            const results = await search.findSimilarElements(queryEmbedding, 10, 0.7);

            expect(results).toEqual([]);
        });
    });

    describe('search', () => {
        it('should execute general search query', async () => {
            const searchParams = {
                query: 'test query',
                limit: 20,
                filters: { domains: ['test'] }
            };

            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/item1' },
                            label: { value: 'Test Result' },
                            score: { value: '0.95' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await search.search(searchParams);

            expect(mockSparqlExecute.executeSparqlQuery).toHaveBeenCalled();
            expect(results).toHaveLength(1);
            expect(results[0].label).toBe('Test Result');
        });

        it('should use default parameters', async () => {
            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce({
                results: { bindings: [] }
            });

            await search.search({ query: 'test' });

            const call = mockSparqlExecute.executeSparqlQuery.mock.calls[0];
            const query = call[0];

            expect(query).toContain('LIMIT 25'); // Default limit
        });
    });

    describe('buildFilterClauses', () => {
        it('should build domain filters', () => {
            const filters = { domains: ['science', 'technology'] };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(REGEX(?label');
            expect(clauses).toContain('science');
            expect(clauses).toContain('technology');
        });

        it('should build keyword filters', () => {
            const filters = { keywords: ['test', 'example'] };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(REGEX(?content');
            expect(clauses).toContain('test');
            expect(clauses).toContain('example');
        });

        it('should build entity filters', () => {
            const filters = { entities: ['http://example.org/entity1', 'http://example.org/entity2'] };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('VALUES ?relatedEntity');
            expect(clauses).toContain('<http://example.org/entity1>');
            expect(clauses).toContain('?uri ragno:connectsTo ?relatedEntity');
        });

        it('should build temporal filters', () => {
            const filters = {
                temporal: {
                    start: '2023-01-01T00:00:00Z',
                    end: '2023-12-31T23:59:59Z'
                }
            };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(?timestamp >= "2023-01-01T00:00:00Z"');
            expect(clauses).toContain('FILTER(?timestamp <= "2023-12-31T23:59:59Z"');
        });

        it('should build similarity threshold filters', () => {
            const filters = { similarityThreshold: 0.8 };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(?similarity >= 0.8)');
        });

        it('should combine multiple filters', () => {
            const filters = {
                domains: ['test'],
                keywords: ['example'],
                similarityThreshold: 0.7
            };
            const clauses = search.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(REGEX(?label');
            expect(clauses).toContain('FILTER(REGEX(?content');
            expect(clauses).toContain('FILTER(?similarity >= 0.7)');
        });

        it('should handle empty filters', () => {
            const clauses = search.buildFilterClauses({});
            expect(clauses).toBe('');
        });
    });

    describe('escapeSparqlString', () => {
        it('should escape special characters', () => {
            const input = 'Test "string" with \n newline and \\ backslash';
            const escaped = search.escapeSparqlString(input);

            expect(escaped).toContain('\\"');
            expect(escaped).toContain('\\n');
            expect(escaped).toContain('\\\\');
        });

        it('should handle non-string input', () => {
            expect(search.escapeSparqlString(123)).toBe('123');
            expect(search.escapeSparqlString(null)).toBe('null');
        });
    });

    describe('validateQueryEmbedding', () => {
        it('should validate correct embedding', () => {
            const embedding = new Array(768).fill(0.5);
            expect(search.validateQueryEmbedding(embedding)).toBe(true);
        });

        it('should reject invalid embeddings', () => {
            expect(search.validateQueryEmbedding(null)).toBe(false);
            expect(search.validateQueryEmbedding('not array')).toBe(false);
            expect(search.validateQueryEmbedding([])).toBe(false);
            expect(search.validateQueryEmbedding([1, 2, 3])).toBe(false); // Wrong length
        });
    });

    describe('dispose', () => {
        it('should dispose resources cleanly', () => {
            expect(() => search.dispose()).not.toThrow();
        });
    });
});