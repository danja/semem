// tests/core/unit/stores/modules/Vectors.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vectors } from '../../../../../src/stores/modules/Vectors.js';

describe('Vectors', () => {
    let vectors;
    let mockFaiss;

    beforeEach(() => {
        // Mock faiss-node
        mockFaiss = {
            IndexFlatL2: vi.fn().mockImplementation((dimension) => ({
                ntotal: vi.fn().mockReturnValue(0),
                add: vi.fn(),
                search: vi.fn().mockReturnValue({
                    distances: [[0.5, 0.7]],
                    labels: [[0, 1]]
                })
            }))
        };

        // Mock faiss import
        vi.doMock('faiss-node', () => mockFaiss);

        vectors = new Vectors(768);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default dimension', () => {
            const v = new Vectors();
            expect(v.dimension).toBe(768);
        });

        it('should initialize with custom dimension', () => {
            const v = new Vectors(1536);
            expect(v.dimension).toBe(1536);
        });

        it('should initialize mapping arrays', () => {
            expect(vectors.faissToMemoryMap).toEqual([]);
            expect(vectors.memoryToFaissMap).toEqual([]);
        });
    });

    describe('calculateCosineSimilarity', () => {
        it('should calculate cosine similarity correctly', () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];
            const similarity = vectors.calculateCosineSimilarity(vecA, vecB);
            expect(similarity).toBe(0);
        });

        it('should handle identical vectors', () => {
            const vecA = [1, 2, 3];
            const vecB = [1, 2, 3];
            const similarity = vectors.calculateCosineSimilarity(vecA, vecB);
            expect(similarity).toBeCloseTo(1, 5);
        });

        it('should handle zero vectors', () => {
            const vecA = [0, 0, 0];
            const vecB = [1, 2, 3];
            const similarity = vectors.calculateCosineSimilarity(vecA, vecB);
            expect(similarity).toBe(0);
        });

        it('should handle different length vectors', () => {
            const vecA = [1, 2];
            const vecB = [1, 2, 3];
            const similarity = vectors.calculateCosineSimilarity(vecA, vecB);
            expect(similarity).toBe(0);
        });
    });

    describe('isValidEmbedding', () => {
        it('should validate correct embedding', () => {
            const embedding = new Array(768).fill(0.5);
            expect(vectors.isValidEmbedding(embedding)).toBe(true);
        });

        it('should reject wrong dimension', () => {
            const embedding = new Array(512).fill(0.5);
            expect(vectors.isValidEmbedding(embedding)).toBe(false);
        });

        it('should reject non-array', () => {
            expect(vectors.isValidEmbedding('not an array')).toBe(false);
        });

        it('should reject null/undefined', () => {
            expect(vectors.isValidEmbedding(null)).toBe(false);
            expect(vectors.isValidEmbedding(undefined)).toBe(false);
        });

        it('should reject invalid numbers', () => {
            const embedding = new Array(768).fill(0.5);
            embedding[0] = NaN;
            expect(vectors.isValidEmbedding(embedding)).toBe(false);
        });
    });

    describe('adjustEmbeddingLength', () => {
        it('should pad shorter embeddings', () => {
            const embedding = [1, 2, 3];
            const adjusted = vectors.adjustEmbeddingLength(embedding);
            expect(adjusted.length).toBe(768);
            expect(adjusted.slice(0, 3)).toEqual([1, 2, 3]);
            expect(adjusted.slice(3)).toEqual(new Array(765).fill(0));
        });

        it('should truncate longer embeddings', () => {
            const embedding = new Array(1000).fill(0.5);
            const adjusted = vectors.adjustEmbeddingLength(embedding);
            expect(adjusted.length).toBe(768);
            expect(adjusted).toEqual(new Array(768).fill(0.5));
        });

        it('should return same array if correct length', () => {
            const embedding = new Array(768).fill(0.5);
            const adjusted = vectors.adjustEmbeddingLength(embedding);
            expect(adjusted).toBe(embedding);
        });
    });

    describe('addEmbedding', () => {
        it('should add valid embedding', () => {
            const embedding = new Array(768).fill(0.5);
            const mockIndex = {
                ntotal: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1),
                add: vi.fn()
            };
            vectors.index = mockIndex;

            const result = vectors.addEmbedding(embedding, 0);

            expect(mockIndex.add).toHaveBeenCalledWith(embedding);
            expect(result).toBe(0);
            expect(vectors.faissToMemoryMap[0]).toBe(0);
            expect(vectors.memoryToFaissMap[0]).toBe(0);
        });

        it('should reject invalid embedding', () => {
            const embedding = [1, 2, 3]; // wrong dimension
            const result = vectors.addEmbedding(embedding, 0);
            expect(result).toBe(-1);
        });

        it('should handle add failure', () => {
            const embedding = new Array(768).fill(0.5);
            const mockIndex = {
                ntotal: vi.fn().mockReturnValue(0), // no increase
                add: vi.fn()
            };
            vectors.index = mockIndex;

            const result = vectors.addEmbedding(embedding, 0);
            expect(result).toBe(-1);
        });
    });

    describe('removeEmbedding', () => {
        beforeEach(() => {
            // Setup some test data
            vectors.faissToMemoryMap = [10, 20, 30];
            vectors.memoryToFaissMap = new Array(50).fill(-1);
            vectors.memoryToFaissMap[10] = 0;
            vectors.memoryToFaissMap[20] = 1;
            vectors.memoryToFaissMap[30] = 2;
        });

        it('should remove embedding by memory index', () => {
            vectors.removeEmbedding(20);

            expect(vectors.memoryToFaissMap[20]).toBe(-1);
            expect(vectors.faissToMemoryMap[1]).toBeUndefined();
        });

        it('should handle non-existent memory index', () => {
            expect(() => vectors.removeEmbedding(999)).not.toThrow();
        });
    });

    describe('searchSimilar', () => {
        it('should search for similar embeddings', () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockIndex = {
                search: vi.fn().mockReturnValue({
                    distances: [[0.1, 0.3, 0.5]],
                    labels: [[0, 1, 2]]
                })
            };
            vectors.index = mockIndex;
            vectors.faissToMemoryMap = [10, 20, 30];

            const results = vectors.searchSimilar(queryEmbedding, 3, 0.6);

            expect(mockIndex.search).toHaveBeenCalledWith(queryEmbedding, 3);
            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({
                memoryIndex: 10,
                faissIndex: 0,
                distance: 0.1,
                similarity: 0.9
            });
        });

        it('should filter by threshold', () => {
            const queryEmbedding = new Array(768).fill(0.5);
            const mockIndex = {
                search: vi.fn().mockReturnValue({
                    distances: [[0.1, 0.8, 0.5]], // 0.8 > 0.7 threshold
                    labels: [[0, 1, 2]]
                })
            };
            vectors.index = mockIndex;
            vectors.faissToMemoryMap = [10, 20, 30];

            const results = vectors.searchSimilar(queryEmbedding, 3, 0.7);

            expect(results).toHaveLength(2); // Only 2 results above threshold
        });

        it('should handle invalid query embedding', () => {
            const invalidEmbedding = [1, 2, 3];
            const results = vectors.searchSimilar(invalidEmbedding, 3);
            expect(results).toEqual([]);
        });
    });

    describe('getIndexStats', () => {
        it('should return index statistics', () => {
            const mockIndex = {
                ntotal: vi.fn().mockReturnValue(100)
            };
            vectors.index = mockIndex;
            vectors.faissToMemoryMap = [1, 2, 3];
            vectors.memoryToFaissMap = new Array(50).fill(-1);

            const stats = vectors.getIndexStats();

            expect(stats).toEqual({
                dimension: 768,
                totalVectors: 100,
                faissToMemoryMappings: 3,
                memoryToFaissMappings: 50
            });
        });
    });

    describe('validateMapping', () => {
        beforeEach(() => {
            vectors.faissToMemoryMap = [10, 20, 30];
            vectors.memoryToFaissMap = new Array(50).fill(-1);
            vectors.memoryToFaissMap[10] = 0;
            vectors.memoryToFaissMap[20] = 1;
            vectors.memoryToFaissMap[30] = 2;
        });

        it('should validate consistent mappings', () => {
            const isValid = vectors.validateMapping();
            expect(isValid).toBe(true);
        });

        it('should detect inconsistent mappings', () => {
            vectors.memoryToFaissMap[10] = 999; // Invalid faiss index
            const isValid = vectors.validateMapping();
            expect(isValid).toBe(false);
        });
    });

    describe('clearIndex', () => {
        it('should clear index and mappings', () => {
            const mockIndex = {
                reset: vi.fn()
            };
            vectors.index = mockIndex;
            vectors.faissToMemoryMap = [1, 2, 3];
            vectors.memoryToFaissMap = [0, 1, 2];

            vectors.clearIndex();

            expect(mockIndex.reset).toHaveBeenCalled();
            expect(vectors.faissToMemoryMap).toEqual([]);
            expect(vectors.memoryToFaissMap).toEqual([]);
        });
    });

    describe('dispose', () => {
        it('should dispose resources', () => {
            const clearSpy = vi.spyOn(vectors, 'clearIndex');
            vectors.dispose();
            expect(clearSpy).toHaveBeenCalled();
        });
    });
});