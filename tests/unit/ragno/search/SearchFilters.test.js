/**
 * SearchFilters.test.js - Unit Tests for Search Result Filtering and Ranking
 * 
 * Comprehensive test suite for the SearchFilters class covering:
 * - Relevance threshold filtering
 * - Document type filtering
 * - Result deduplication strategies
 * - Context enrichment
 * - Ranking algorithms
 * - Score normalization
 * - Result limiting
 * - Statistical tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SearchFilters from '../../../../src/ragno/search/SearchFilters.js';

// Mock logger
vi.mock('../../../../src/Utils.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('SearchFilters', () => {
    let searchFilters;
    let mockResults;

    beforeEach(() => {
        // Create SearchFilters instance with default options
        searchFilters = new SearchFilters();

        // Setup mock search results
        mockResults = [
            {
                uri: 'http://test.com/1',
                type: 'ragno:Entity',
                score: 0.9,
                content: 'This is the first test result with some content',
                source: ['exact']
            },
            {
                uri: 'http://test.com/2',
                type: 'ragno:Unit',
                score: 0.8,
                content: 'This is the second test result with different content',
                source: ['vector']
            },
            {
                uri: 'http://test.com/3',
                type: 'ragno:TextElement',
                score: 0.75,
                content: 'This is the third test result',
                source: ['traversal']
            },
            {
                uri: 'http://test.com/4',
                type: 'ragno:CommunityElement',
                score: 0.6,
                content: 'This is the fourth test result with low score',
                source: ['vector', 'exact']
            },
            {
                uri: 'http://test.com/5',
                type: 'ragno:Attribute',
                score: 0.5,
                content: 'This is the fifth test result below threshold',
                source: ['exact']
            }
        ];
    });

    afterEach(async () => {
        if (searchFilters) {
            await searchFilters.cleanup();
        }
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default options', () => {
            expect(searchFilters.options.relevanceThreshold).toBe(0.7);
            expect(searchFilters.options.enableRelevanceFiltering).toBe(true);
            expect(searchFilters.options.enableDeduplication).toBe(true);
            expect(searchFilters.options.rankingStrategy).toBe('weighted');
            expect(searchFilters.options.maxResults).toBe(50);
        });

        it('should initialize with custom options', () => {
            const customOptions = {
                relevanceThreshold: 0.8,
                enableRelevanceFiltering: false,
                rankingStrategy: 'score',
                maxResults: 10
            };
            
            const customFilters = new SearchFilters(customOptions);
            
            expect(customFilters.options.relevanceThreshold).toBe(0.8);
            expect(customFilters.options.enableRelevanceFiltering).toBe(false);
            expect(customFilters.options.rankingStrategy).toBe('score');
            expect(customFilters.options.maxResults).toBe(10);
        });

        it('should initialize statistics correctly', () => {
            expect(searchFilters.statistics.totalProcessed).toBe(0);
            expect(searchFilters.statistics.filtered).toBe(0);
            expect(searchFilters.statistics.deduplicated).toBe(0);
            expect(searchFilters.statistics.enriched).toBe(0);
            expect(searchFilters.statistics.ranked).toBe(0);
        });
    });

    describe('Score Extraction', () => {
        it('should extract score from result', () => {
            expect(searchFilters.extractScore({ score: 0.9 })).toBe(0.9);
            expect(searchFilters.extractScore({ relevance: 0.8 })).toBe(0.8);
            expect(searchFilters.extractScore({ similarity: 0.7 })).toBe(0.7);
            expect(searchFilters.extractScore({ weight: 0.6 })).toBe(0.6);
            expect(searchFilters.extractScore({})).toBe(0);
        });
    });

    describe('Relevance Filtering', () => {
        it('should filter results by relevance threshold', async () => {
            const filtered = await searchFilters.applyRelevanceFiltering(mockResults);
            
            expect(filtered).toHaveLength(3); // 0.9, 0.8, 0.75 >= 0.7
            expect(filtered.every(result => searchFilters.extractScore(result) >= 0.7)).toBe(true);
        });

        it('should use custom threshold from options', async () => {
            const filtered = await searchFilters.applyRelevanceFiltering(mockResults, { threshold: 0.8 });
            
            expect(filtered).toHaveLength(2); // 0.9, 0.8 >= 0.8
        });

        it('should update statistics', async () => {
            await searchFilters.applyRelevanceFiltering(mockResults);
            
            expect(searchFilters.statistics.filtered).toBe(2); // 2 results filtered out
        });
    });

    describe('Type Filtering', () => {
        it('should filter results by document types', async () => {
            const allowedTypes = ['ragno:Entity', 'ragno:Unit'];
            const filtered = await searchFilters.applyTypeFiltering(mockResults, { documentTypes: allowedTypes });
            
            expect(filtered).toHaveLength(2);
            expect(filtered.every(result => allowedTypes.includes(result.type))).toBe(true);
        });

        it('should use default allowed types', async () => {
            const filtered = await searchFilters.applyTypeFiltering(mockResults);
            
            // All test results have types in the default list
            expect(filtered).toHaveLength(mockResults.length);
        });
    });

    describe('Deduplication', () => {
        beforeEach(() => {
            // Add duplicate results for testing
            mockResults.push(
                {
                    uri: 'http://test.com/1', // Duplicate URI
                    type: 'ragno:Entity',
                    score: 0.85,
                    content: 'Duplicate URI content'
                },
                {
                    uri: 'http://test.com/6',
                    type: 'ragno:Unit',
                    score: 0.7,
                    content: 'This is the first test result with some content' // Duplicate content
                }
            );
        });

        it('should deduplicate by URI', async () => {
            const deduplicated = searchFilters.deduplicateByURI(mockResults);
            
            expect(deduplicated).toHaveLength(mockResults.length - 1); // One URI duplicate removed
            
            const uris = deduplicated.map(result => result.uri);
            const uniqueUris = new Set(uris);
            expect(uris.length).toBe(uniqueUris.size);
        });

        it('should deduplicate by content', async () => {
            const deduplicated = await searchFilters.deduplicateByContent(mockResults);
            
            expect(deduplicated.length).toBeLessThan(mockResults.length);
        });

        it('should apply hybrid deduplication', async () => {
            const deduplicated = await searchFilters.deduplicateHybrid(mockResults);
            
            expect(deduplicated.length).toBeLessThan(mockResults.length);
        });

        it('should use specified deduplication strategy', async () => {
            const filtered = await searchFilters.applyDeduplication(mockResults, { deduplicationStrategy: 'uri' });
            
            expect(filtered.length).toBeLessThan(mockResults.length);
        });
    });

    describe('Content Similarity', () => {
        it('should calculate content similarity correctly', () => {
            const content1 = 'machine learning artificial intelligence';
            const content2 = 'artificial intelligence machine learning';
            const content3 = 'completely different content here';
            
            const similarity1 = searchFilters.calculateContentSimilarity(content1, content2);
            const similarity2 = searchFilters.calculateContentSimilarity(content1, content3);
            
            expect(similarity1).toBe(1.0); // Identical words
            expect(similarity2).toBeLessThan(0.5); // Different words
        });

        it('should check content similarity against existing results', async () => {
            const testResult = {
                uri: 'http://test.com/new',
                content: 'This is the first test result with some content'
            };
            
            const isDuplicate = await searchFilters.checkContentSimilarity(testResult, mockResults.slice(0, 1), 0.8);
            
            expect(isDuplicate).toBe(true);
        });
    });

    describe('Context Enrichment', () => {
        it('should enrich results with context', async () => {
            const enriched = await searchFilters.enrichWithContext(mockResults.slice(0, 2));
            
            expect(enriched).toHaveLength(2);
            expect(enriched[0]).toHaveProperty('relationships');
            expect(enriched[0]).toHaveProperty('sourceContext');
            expect(enriched[0]).toHaveProperty('provenance');
        });

        it('should handle custom context types', async () => {
            const enriched = await searchFilters.enrichWithContext(
                mockResults.slice(0, 1),
                { contextTypes: ['relationship'] }
            );
            
            expect(enriched[0]).toHaveProperty('relationships');
            expect(enriched[0]).not.toHaveProperty('sourceContext');
        });

        it('should update enrichment statistics', async () => {
            await searchFilters.enrichWithContext(mockResults.slice(0, 2));
            
            expect(searchFilters.statistics.enriched).toBe(2);
        });
    });

    describe('Ranking Algorithms', () => {
        it('should rank by weighted score', () => {
            const ranked = searchFilters.rankByWeightedScore([...mockResults]);
            
            // Should be sorted by weighted score (score * type weight) descending
            expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
        });

        it('should rank by raw score', () => {
            const ranked = searchFilters.rankByScore([...mockResults]);
            
            // Should be sorted by score descending
            for (let i = 0; i < ranked.length - 1; i++) {
                expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
            }
        });

        it('should rank by type priority', () => {
            const ranked = searchFilters.rankByType([...mockResults]);
            
            // Entity should come before Unit (higher type weight)
            const entityIndex = ranked.findIndex(r => r.type === 'ragno:Entity');
            const unitIndex = ranked.findIndex(r => r.type === 'ragno:Unit');
            
            expect(entityIndex).toBeLessThan(unitIndex);
        });

        it('should apply hybrid ranking', () => {
            const ranked = searchFilters.rankHybrid([...mockResults]);
            
            expect(ranked).toHaveLength(mockResults.length);
            // Should be sorted by hybrid score
        });
    });

    describe('Score Calculation', () => {
        it('should calculate weighted score correctly', () => {
            const result = { type: 'ragno:Entity', score: 0.8 };
            const weightedScore = searchFilters.calculateWeightedScore(result);
            
            expect(weightedScore).toBe(0.8 * 1.0); // Entity weight is 1.0
        });

        it('should calculate hybrid score correctly', () => {
            const result = { type: 'ragno:Unit', score: 0.8 };
            const hybridScore = searchFilters.calculateHybridScore(result);
            
            expect(hybridScore).toBeCloseTo((0.8 * 0.7) + (0.9 * 0.3), 2); // Unit weight is 0.9
        });
    });

    describe('Score Normalization', () => {
        const testScores = [0.9, 0.8, 0.7, 0.6, 0.5];

        it('should normalize scores using min-max', () => {
            const normalized = searchFilters.normalizeMinMax(testScores);
            
            expect(normalized[0]).toBe(1.0); // Max value
            expect(normalized[4]).toBe(0.0); // Min value
            expect(normalized.every(score => score >= 0 && score <= 1)).toBe(true);
        });

        it('should normalize scores using z-score', () => {
            const normalized = searchFilters.normalizeZScore(testScores);
            
            // Z-score should have mean ≈ 0
            const mean = normalized.reduce((sum, score) => sum + score, 0) / normalized.length;
            expect(Math.abs(mean)).toBeLessThan(0.01);
        });

        it('should normalize scores using sigmoid', () => {
            const normalized = searchFilters.normalizeSigmoid(testScores);
            
            expect(normalized.every(score => score > 0 && score < 1)).toBe(true);
        });

        it('should handle edge cases in normalization', () => {
            const constantScores = [0.5, 0.5, 0.5];
            
            const minMaxNorm = searchFilters.normalizeMinMax(constantScores);
            expect(minMaxNorm.every(score => score === 1.0)).toBe(true);
            
            const zScoreNorm = searchFilters.normalizeZScore(constantScores);
            expect(zScoreNorm.every(score => score === 0.0)).toBe(true);
        });
    });

    describe('Full Filter Pipeline', () => {
        it('should apply all filters in sequence', async () => {
            const filtered = await searchFilters.applyFilters(mockResults);
            
            expect(filtered.length).toBeLessThanOrEqual(mockResults.length);
            expect(searchFilters.statistics.totalProcessed).toBe(mockResults.length);
        });

        it('should respect filter options', async () => {
            const options = {
                threshold: 0.8,
                limit: 2,
                documentTypes: ['ragno:Entity', 'ragno:Unit']
            };
            
            const filtered = await searchFilters.applyFilters(mockResults, options);
            
            expect(filtered.length).toBeLessThanOrEqual(2);
            expect(filtered.every(result => result.score >= 0.8)).toBe(true);
        });

        it('should handle empty results', async () => {
            const filtered = await searchFilters.applyFilters([]);
            
            expect(filtered).toEqual([]);
        });

        it('should handle errors gracefully', async () => {
            // Simulate error in one of the filtering steps
            vi.spyOn(searchFilters, 'applyRelevanceFiltering').mockRejectedValue(new Error('Filter error'));
            
            await expect(searchFilters.applyFilters(mockResults)).rejects.toThrow('Filter error');
        });
    });

    describe('Result Limiting', () => {
        it('should limit results to maximum number', async () => {
            const limited = await searchFilters.limitResults(mockResults, { limit: 3 });
            
            expect(limited).toHaveLength(3);
        });

        it('should not limit if results are fewer than limit', async () => {
            const limited = await searchFilters.limitResults(mockResults.slice(0, 2), { limit: 5 });
            
            expect(limited).toHaveLength(2);
        });
    });

    describe('Score Normalization Integration', () => {
        it('should add normalized scores to results', async () => {
            const normalized = await searchFilters.normalizeScores(mockResults);
            
            expect(normalized.every(result => result.hasOwnProperty('normalizedScore'))).toBe(true);
            expect(normalized.every(result => result.hasOwnProperty('originalScore'))).toBe(true);
        });

        it('should use custom normalization method', async () => {
            const normalized = await searchFilters.normalizeScores(mockResults, { normalizationMethod: 'zscore' });
            
            expect(normalized.every(result => result.hasOwnProperty('normalizedScore'))).toBe(true);
        });
    });

    describe('Statistics and Monitoring', () => {
        it('should track processing statistics', async () => {
            await searchFilters.applyFilters(mockResults);
            
            const stats = searchFilters.getStatistics();
            
            expect(stats.totalProcessed).toBeGreaterThan(0);
            expect(stats.configuration).toBeDefined();
            expect(stats.configuration.relevanceThreshold).toBe(0.7);
        });

        it('should reset statistics', () => {
            searchFilters.statistics.totalProcessed = 10;
            searchFilters.resetStatistics();
            
            expect(searchFilters.statistics.totalProcessed).toBe(0);
        });
    });

    describe('Configuration Options', () => {
        it('should disable specific filters when configured', async () => {
            const customFilters = new SearchFilters({
                enableRelevanceFiltering: false,
                enableTypeFiltering: false,
                enableDeduplication: false
            });
            
            const filtered = await customFilters.applyFilters(mockResults);
            
            // Should skip disabled filters
            expect(filtered.length).toBe(mockResults.length);
        });

        it('should use custom type weights', () => {
            const customFilters = new SearchFilters({
                typeWeights: {
                    'ragno:Entity': 0.5,
                    'ragno:Unit': 1.0
                }
            });
            
            const result1 = { type: 'ragno:Entity', score: 0.8 };
            const result2 = { type: 'ragno:Unit', score: 0.8 };
            
            expect(customFilters.calculateWeightedScore(result1)).toBe(0.4);
            expect(customFilters.calculateWeightedScore(result2)).toBe(0.8);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing result properties gracefully', async () => {
            const incompleteResults = [
                { uri: 'http://test.com/1' }, // Missing score, type, content
                { score: 0.8 }, // Missing URI, type, content
                { type: 'ragno:Entity', content: 'test' } // Missing URI, score
            ];
            
            const filtered = await searchFilters.applyFilters(incompleteResults);
            
            expect(filtered).toBeDefined();
        });

        it('should handle null and undefined inputs', async () => {
            expect(await searchFilters.applyFilters(null)).toEqual([]);
            expect(await searchFilters.applyFilters(undefined)).toEqual([]);
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources', async () => {
            await searchFilters.cleanup();
            
            // Should complete without errors
            expect(true).toBe(true);
        });
    });
});