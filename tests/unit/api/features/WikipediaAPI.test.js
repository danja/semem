// tests/unit/api/features/WikipediaAPI.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import WikipediaAPI from '../../../../src/api/features/WikipediaAPI.js';
import { setupTestEnvironment } from '../../../helpers/testSetup.js';
import { VitestTestHelper } from '../../../helpers/VitestTestHelper.js';

// Mock the Wikipedia search service
vi.mock('../../../../src/aux/wikipedia/Search.js', () => ({
    default: class MockWikipediaSearch {
        constructor(options) {
            this.options = options;
            this.search = vi.fn();
            this.getArticle = vi.fn();
            this.ingestArticle = vi.fn();
            this.searchCategory = vi.fn();
        }
    }
}));

describe('WikipediaAPI', () => {
    const utils = setupTestEnvironment();
    let api;
    let mockRegistry;
    let mockMemoryManager;
    let mockConfig;

    beforeEach(async () => {
        // Create mock dependencies
        mockMemoryManager = {
            initialized: true,
            search: vi.fn(),
            store: vi.fn()
        };

        mockConfig = {
            get: vi.fn((key) => {
                switch (key) {
                    case 'sparqlUpdateEndpoint':
                        return 'http://localhost:3030/test/update';
                    case 'sparqlAuth':
                        return { user: 'test', password: 'test' };
                    default:
                        return null;
                }
            })
        };

        mockRegistry = {
            get: vi.fn((service) => {
                switch (service) {
                    case 'memory':
                        return mockMemoryManager;
                    case 'config':
                        return mockConfig;
                    default:
                        throw new Error(`Service ${service} not found`);
                }
            })
        };

        // Create API instance
        api = new WikipediaAPI({
            registry: mockRegistry,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            defaultLimit: 10,
            maxLimit: 50,
            requestTimeout: 30000,
            defaultGraphURI: 'http://test.org/wikipedia'
        });

        await api.initialize();
    });

    afterEach(async () => {
        if (api && api.initialized) {
            await api.shutdown();
        }
    });

    describe('Initialization', () => {
        it('should initialize properly with all dependencies', () => {
            expect(api.initialized).toBe(true);
            expect(api.memoryManager).toBe(mockMemoryManager);
            expect(api.wikipediaSearch).toBeDefined();
            expect(api.wikipediaSearch.options.sparqlEndpoint).toBe('http://localhost:3030/test/update');
            expect(api.wikipediaSearch.options.graphURI).toBe('http://test.org/wikipedia');
        });

        it('should fail initialization without registry', async () => {
            const noRegistryAPI = new WikipediaAPI({});
            await expect(noRegistryAPI.initialize()).rejects.toThrow('Registry is required for WikipediaAPI');
        });

        it('should use default configuration when config not available', async () => {
            const noConfigRegistry = {
                get: vi.fn((service) => {
                    if (service === 'memory') return mockMemoryManager;
                    throw new Error(`Service ${service} not found`);
                })
            };

            const noConfigAPI = new WikipediaAPI({
                registry: noConfigRegistry,
                logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
            });

            await noConfigAPI.initialize();
            expect(noConfigAPI.initialized).toBe(true);
            expect(noConfigAPI.wikipediaSearch.options.sparqlEndpoint).toBe('http://localhost:3030/semem/update');
        });
    });

    describe('Search Operations', () => {
        describe('search', () => {
            it('should search Wikipedia articles successfully', async () => {
                const mockSearchResult = {
                    results: [
                        {
                            title: 'Quantum computing',
                            snippet: 'Quantum computing is the use of quantum-mechanical phenomena...',
                            pageid: 25678
                        },
                        {
                            title: 'Quantum mechanics',
                            snippet: 'Quantum mechanics is a fundamental theory in physics...',
                            pageid: 25579
                        }
                    ],
                    totalResults: 150
                };

                api.wikipediaSearch.search.mockResolvedValue(mockSearchResult);

                const result = await api.executeOperation('search', {
                    query: 'quantum computing',
                    limit: 5,
                    offset: 0
                });

                expect(result.success).toBe(true);
                expect(result.result.query).toBe('quantum computing');
                expect(result.result.results).toEqual(mockSearchResult.results);
                expect(result.result.resultCount).toBe(2);
                expect(api.wikipediaSearch.search).toHaveBeenCalledWith('quantum computing', {
                    limit: 5,
                    offset: 0,
                    namespace: '0',
                    format: 'json',
                    ingestResults: false,
                    language: 'en'
                });
            });

            it('should fail when no query provided', async () => {
                const result = await api.executeOperation('search', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Search query is required');
            });

            it('should fail when limit exceeds maximum', async () => {
                const result = await api.executeOperation('search', {
                    query: 'test',
                    limit: 100
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Limit cannot exceed 50');
            });

            it('should use default parameters when not specified', async () => {
                api.wikipediaSearch.search.mockResolvedValue({ results: [] });

                await api.executeOperation('search', {
                    query: 'test'
                });

                expect(api.wikipediaSearch.search).toHaveBeenCalledWith('test', {
                    limit: 10,
                    offset: 0,
                    namespace: '0',
                    format: 'json',
                    ingestResults: false,
                    language: 'en'
                });
            });
        });

        describe('batch-search', () => {
            it('should perform batch search successfully in parallel', async () => {
                const queries = ['machine learning', 'artificial intelligence'];
                const mockResults = [
                    { results: [{ title: 'Machine learning', pageid: 1 }] },
                    { results: [{ title: 'Artificial intelligence', pageid: 2 }] }
                ];

                api.wikipediaSearch.search
                    .mockResolvedValueOnce(mockResults[0])
                    .mockResolvedValueOnce(mockResults[1]);

                const result = await api.executeOperation('batch-search', {
                    queries,
                    limit: 3,
                    parallel: true,
                    batchSize: 2
                });

                expect(result.success).toBe(true);
                expect(result.result.summary.totalQueries).toBe(2);
                expect(result.result.summary.successfulQueries).toBe(2);
                expect(result.result.summary.failedQueries).toBe(0);
                expect(result.result.results).toHaveLength(2);
                expect(result.result.results[0].success).toBe(true);
                expect(result.result.results[1].success).toBe(true);
            });

            it('should perform batch search sequentially when parallel disabled', async () => {
                const queries = ['test1', 'test2'];
                api.wikipediaSearch.search.mockResolvedValue({ results: [] });

                const result = await api.executeOperation('batch-search', {
                    queries,
                    parallel: false
                });

                expect(result.success).toBe(true);
                expect(result.result.batchOptions.parallel).toBe(false);
            });

            it('should handle partial failures in batch search', async () => {
                const queries = ['valid query', 'invalid query'];
                
                api.wikipediaSearch.search
                    .mockResolvedValueOnce({ results: [{ title: 'Test' }] })
                    .mockRejectedValueOnce(new Error('Search failed'));

                const result = await api.executeOperation('batch-search', {
                    queries,
                    parallel: true
                });

                expect(result.success).toBe(true);
                expect(result.result.summary.successfulQueries).toBe(1);
                expect(result.result.summary.failedQueries).toBe(1);
            });

            it('should fail when no queries provided', async () => {
                const result = await api.executeOperation('batch-search', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Queries array is required');
            });

            it('should fail when too many queries provided', async () => {
                const queries = Array(25).fill('test query');

                const result = await api.executeOperation('batch-search', {
                    queries
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Maximum 20 queries allowed');
            });
        });
    });

    describe('Article Operations', () => {
        describe('article', () => {
            it('should get article by title successfully', async () => {
                const mockArticle = {
                    title: 'Artificial Intelligence',
                    pageid: 1008,
                    length: 150000,
                    extract: 'Artificial intelligence (AI) is intelligence demonstrated by machines...',
                    content: 'Full article content here...',
                    categories: ['Computer science', 'AI'],
                    links: ['Machine learning', 'Neural network']
                };

                api.wikipediaSearch.getArticle.mockResolvedValue(mockArticle);

                const result = await api.executeOperation('article', {
                    title: 'Artificial Intelligence',
                    includeContent: true,
                    includeSummary: true
                });

                expect(result.success).toBe(true);
                expect(result.result.article).toEqual(mockArticle);
                expect(result.result.lookupMethod).toBe('title');
                expect(result.result.requestedTitle).toBe('Artificial Intelligence');
                expect(api.wikipediaSearch.getArticle).toHaveBeenCalledWith({
                    title: 'Artificial Intelligence',
                    pageId: undefined,
                    includeContent: true,
                    includeSummary: true,
                    includeMetadata: true,
                    language: 'en'
                });
            });

            it('should get article by page ID successfully', async () => {
                const mockArticle = {
                    title: 'Test Article',
                    pageid: 1234,
                    extract: 'Test content'
                };

                api.wikipediaSearch.getArticle.mockResolvedValue(mockArticle);

                const result = await api.executeOperation('article', {
                    pageId: 1234
                });

                expect(result.success).toBe(true);
                expect(result.result.lookupMethod).toBe('pageId');
                expect(result.result.requestedPageId).toBe(1234);
            });

            it('should ingest article when requested', async () => {
                const mockArticle = { title: 'Test', pageid: 1 };
                const mockIngestionResult = { success: true, triplesCreated: 50 };

                api.wikipediaSearch.getArticle.mockResolvedValue(mockArticle);
                api.wikipediaSearch.ingestArticle.mockResolvedValue(mockIngestionResult);

                const result = await api.executeOperation('article', {
                    title: 'Test',
                    ingestArticle: true
                });

                expect(result.success).toBe(true);
                expect(result.result.article.ingestionResult).toEqual(mockIngestionResult);
                expect(api.wikipediaSearch.ingestArticle).toHaveBeenCalledWith(mockArticle);
            });

            it('should fail when neither title nor pageId provided', async () => {
                const result = await api.executeOperation('article', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Either title or pageId must be provided');
            });

            it('should handle article lookup errors', async () => {
                api.wikipediaSearch.getArticle.mockRejectedValue(new Error('Article not found'));

                const result = await api.executeOperation('article', {
                    title: 'Nonexistent Article'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Article lookup failed: Article not found');
            });
        });

        describe('ingest', () => {
            it('should ingest articles by titles successfully', async () => {
                const mockArticles = [
                    { title: 'Article 1', pageid: 1 },
                    { title: 'Article 2', pageid: 2 }
                ];
                const mockIngestionResults = [
                    { success: true, triplesCreated: 30 },
                    { success: true, triplesCreated: 45 }
                ];

                api.wikipediaSearch.getArticle
                    .mockResolvedValueOnce(mockArticles[0])
                    .mockResolvedValueOnce(mockArticles[1]);
                api.wikipediaSearch.ingestArticle
                    .mockResolvedValueOnce(mockIngestionResults[0])
                    .mockResolvedValueOnce(mockIngestionResults[1]);

                const result = await api.executeOperation('ingest', {
                    titles: ['Article 1', 'Article 2']
                });

                expect(result.success).toBe(true);
                expect(result.result.summary.totalArticles).toBe(2);
                expect(result.result.summary.successfulIngestions).toBe(2);
                expect(result.result.summary.failedIngestions).toBe(0);
                expect(result.result.ingestionResults).toHaveLength(2);
            });

            it('should ingest articles from search queries', async () => {
                const mockSearchResult = {
                    results: [{ title: 'Found Article', pageid: 123 }]
                };
                const mockArticle = { title: 'Found Article', pageid: 123 };
                const mockIngestionResult = { success: true, triplesCreated: 25 };

                api.wikipediaSearch.search.mockResolvedValue(mockSearchResult);
                api.wikipediaSearch.getArticle.mockResolvedValue(mockArticle);
                api.wikipediaSearch.ingestArticle.mockResolvedValue(mockIngestionResult);

                const result = await api.executeOperation('ingest', {
                    searchQueries: ['renewable energy'],
                    options: { searchLimit: 1 }
                });

                expect(result.success).toBe(true);
                expect(result.result.summary.totalArticles).toBe(1);
                expect(result.result.summary.successfulIngestions).toBe(1);
            });

            it('should handle ingestion failures gracefully', async () => {
                const mockArticle = { title: 'Test Article', pageid: 1 };

                api.wikipediaSearch.getArticle.mockResolvedValue(mockArticle);
                api.wikipediaSearch.ingestArticle.mockRejectedValue(new Error('Ingestion failed'));

                const result = await api.executeOperation('ingest', {
                    titles: ['Test Article']
                });

                expect(result.success).toBe(true);
                expect(result.result.summary.totalArticles).toBe(1);
                expect(result.result.summary.successfulIngestions).toBe(0);
                expect(result.result.summary.failedIngestions).toBe(1);
            });

            it('should fail when no articles provided', async () => {
                const result = await api.executeOperation('ingest', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Must provide articles, titles, pageIds, or searchQueries');
            });
        });
    });

    describe('Category Operations', () => {
        describe('categories', () => {
            it('should search categories successfully', async () => {
                const mockCategoryResult = {
                    pages: [
                        { title: 'Physics Article 1', extract: 'About physics...' },
                        { title: 'Physics Article 2', extract: 'More physics...' }
                    ],
                    totalPages: 500
                };

                api.wikipediaSearch.searchCategory.mockResolvedValue(mockCategoryResult);

                const result = await api.executeOperation('categories', {
                    category: 'Physics',
                    limit: 5,
                    recursive: false
                });

                expect(result.success).toBe(true);
                expect(result.result.category).toBe('Physics');
                expect(result.result.pages).toEqual(mockCategoryResult.pages);
                expect(result.result.resultCount).toBe(2);
                expect(api.wikipediaSearch.searchCategory).toHaveBeenCalledWith('Physics', {
                    limit: 5,
                    recursive: false,
                    ingestResults: false
                });
            });

            it('should fail when no category provided', async () => {
                const result = await api.executeOperation('categories', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Category is required');
            });

            it('should handle category search errors', async () => {
                api.wikipediaSearch.searchCategory.mockRejectedValue(new Error('Category not found'));

                const result = await api.executeOperation('categories', {
                    category: 'Invalid Category'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Category search failed: Category not found');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle unknown operations', async () => {
            const result = await api.executeOperation('unknown-operation', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown Wikipedia operation: unknown-operation');
        });

        it('should handle invalid parameters', async () => {
            const result = await api.executeOperation('search', null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Parameters object is required');
        });

        it('should include timing information in results', async () => {
            api.wikipediaSearch.search.mockResolvedValue({ results: [] });

            const result = await api.executeOperation('search', {
                query: 'test'
            });

            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.requestId).toBeDefined();
        });
    });

    describe('Configuration', () => {
        it('should use default configuration values', () => {
            expect(api.defaultLimit).toBe(10);
            expect(api.maxLimit).toBe(50);
            expect(api.requestTimeout).toBe(30000);
            expect(api.defaultGraphURI).toBe('http://test.org/wikipedia');
            expect(api.defaultNamespace).toBe('0');
        });

        it('should provide endpoint configuration', () => {
            const endpoints = api.getEndpoints();

            expect(endpoints).toBeInstanceOf(Array);
            expect(endpoints.length).toBeGreaterThan(0);
            
            const searchEndpoint = endpoints.find(e => e.operation === 'search');
            expect(searchEndpoint).toBeDefined();
            expect(searchEndpoint.method).toBe('GET');
            expect(searchEndpoint.path).toBe('/wikipedia/search');
            expect(searchEndpoint.schema).toBeDefined();
        });
    });
});