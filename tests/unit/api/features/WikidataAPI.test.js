// tests/unit/api/features/WikidataAPI.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import WikidataAPI from '../../../../src/api/features/WikidataAPI.js';
import { setupTestEnvironment } from '../../../helpers/testSetup.js';
import { VitestTestHelper } from '../../../helpers/VitestTestHelper.js';

// Mock the aux services
vi.mock('../../../../src/aux/wikidata/WikidataResearcher.js', () => ({
    default: class MockWikidataResearcher {
        constructor() {
            this.executeResearch = vi.fn();
        }
    }
}));

vi.mock('../../../../src/aux/wikidata/WikidataSearch.js', () => ({
    default: class MockWikidataSearch {
        constructor() {
            this.searchEntities = vi.fn();
        }
    }
}));

vi.mock('../../../../src/aux/wikidata/WikidataConnector.js', () => ({
    default: class MockWikidataConnector {
        constructor() {
            this.getEntityDetails = vi.fn();
            this.executeSPARQLQuery = vi.fn();
        }
    }
}));

describe('WikidataAPI', () => {
    const utils = setupTestEnvironment();
    let api;
    let mockRegistry;
    let mockMemoryManager;
    let mockLLMHandler;
    let mockSparqlHelper;

    beforeEach(async () => {
        // Create mock dependencies
        mockMemoryManager = {
            initialized: true,
            search: vi.fn(),
            store: vi.fn()
        };

        mockLLMHandler = {
            extractConcepts: vi.fn()
        };

        mockSparqlHelper = {
            executeQuery: vi.fn(),
            executeUpdate: vi.fn()
        };

        mockRegistry = {
            get: vi.fn((service) => {
                switch (service) {
                    case 'memory':
                        return mockMemoryManager;
                    case 'llm':
                        return mockLLMHandler;
                    case 'sparql':
                        return mockSparqlHelper;
                    default:
                        throw new Error(`Service ${service} not found`);
                }
            })
        };

        // Create API instance
        api = new WikidataAPI({
            registry: mockRegistry,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            maxEntitiesPerConcept: 3,
            maxSearchResults: 15,
            minConfidence: 0.4,
            requestTimeout: 30000,
            defaultGraphURI: 'http://test.org/wikidata'
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
            expect(api.llmHandler).toBe(mockLLMHandler);
            expect(api.sparqlHelper).toBe(mockSparqlHelper);
            expect(api.wikidataResearcher).toBeDefined();
            expect(api.wikidataSearch).toBeDefined();
            expect(api.wikidataConnector).toBeDefined();
        });

        it('should fail initialization without registry', async () => {
            const noRegistryAPI = new WikidataAPI({});
            await expect(noRegistryAPI.initialize()).rejects.toThrow('Registry is required for WikidataAPI');
        });

        it('should initialize with missing optional dependencies', async () => {
            const limitedRegistry = {
                get: vi.fn((service) => {
                    if (service === 'memory') return mockMemoryManager;
                    if (service === 'llm') return mockLLMHandler;
                    throw new Error(`Service ${service} not found`);
                })
            };

            const limitedAPI = new WikidataAPI({
                registry: limitedRegistry,
                logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
            });

            await limitedAPI.initialize();
            expect(limitedAPI.initialized).toBe(true);
            expect(limitedAPI.sparqlHelper).toBeNull();
        });
    });

    describe('Entity Lookup Operations', () => {
        describe('entity-lookup by ID', () => {
            it('should lookup entity by Wikidata ID successfully', async () => {
                const mockEntity = {
                    id: 'Q42',
                    labels: { en: { value: 'Douglas Adams' } },
                    descriptions: { en: { value: 'English writer' } }
                };

                api.wikidataConnector.getEntityDetails.mockResolvedValue(mockEntity);

                const result = await api.executeOperation('entity-lookup', {
                    entityId: 'Q42',
                    language: 'en'
                });

                expect(result.success).toBe(true);
                expect(result.result.entity).toEqual(mockEntity);
                expect(result.result.lookupMethod).toBe('direct');
                expect(result.result.entityId).toBe('Q42');
                expect(api.wikidataConnector.getEntityDetails).toHaveBeenCalledWith('Q42', {
                    language: 'en',
                    includeRelated: false
                });
            });

            it('should lookup entity by name successfully', async () => {
                const mockSearchResults = [
                    { id: 'Q1754', label: 'Stockholm', description: 'capital of Sweden' }
                ];
                const mockEntity = {
                    id: 'Q1754',
                    labels: { en: { value: 'Stockholm' } },
                    descriptions: { en: { value: 'capital and largest city of Sweden' } }
                };

                api.wikidataSearch.searchEntities.mockResolvedValue(mockSearchResults);
                api.wikidataConnector.getEntityDetails.mockResolvedValue(mockEntity);

                const result = await api.executeOperation('entity-lookup', {
                    entityName: 'Stockholm',
                    language: 'en'
                });

                expect(result.success).toBe(true);
                expect(result.result.entity).toEqual(mockEntity);
                expect(result.result.lookupMethod).toBe('search');
                expect(result.result.searchResults).toEqual(mockSearchResults);
                expect(result.result.selectedEntityId).toBe('Q1754');
            });

            it('should fail when entity not found by name', async () => {
                api.wikidataSearch.searchEntities.mockResolvedValue([]);

                const result = await api.executeOperation('entity-lookup', {
                    entityName: 'NonexistentEntity'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('No entity found with name');
            });

            it('should fail when neither entityId nor entityName provided', async () => {
                const result = await api.executeOperation('entity-lookup', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Either entityId or entityName must be provided');
            });
        });

        describe('entity-search', () => {
            it('should search entities successfully', async () => {
                const mockSearchResults = [
                    { id: 'Q11660', label: 'artificial intelligence', description: 'intelligence demonstrated by machines' },
                    { id: 'Q2539', label: 'machine learning', description: 'field of computer science' }
                ];

                api.wikidataSearch.searchEntities.mockResolvedValue(mockSearchResults);

                const result = await api.executeOperation('entity-search', {
                    query: 'artificial intelligence',
                    limit: 5,
                    language: 'en'
                });

                expect(result.success).toBe(true);
                expect(result.result.query).toBe('artificial intelligence');
                expect(result.result.results).toEqual(mockSearchResults);
                expect(result.result.count).toBe(2);
                expect(api.wikidataSearch.searchEntities).toHaveBeenCalledWith('artificial intelligence', {
                    language: 'en',
                    limit: 5,
                    type: null,
                    includeDescriptions: true
                });
            });

            it('should fail when no query provided', async () => {
                const result = await api.executeOperation('entity-search', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Search query is required');
            });
        });
    });

    describe('Research Operations', () => {
        describe('research-concepts', () => {
            it('should research concepts successfully', async () => {
                const mockResearchResult = {
                    statistics: {
                        conceptsExtracted: 3,
                        entitiesFound: 15,
                        totalResearchQuestions: 5
                    },
                    conceptResults: [
                        { concept: 'artificial intelligence', entities: ['Q11660', 'Q2539'] }
                    ]
                };

                api.wikidataResearcher.executeResearch.mockResolvedValue(mockResearchResult);

                const result = await api.executeOperation('research-concepts', {
                    question: 'What is artificial intelligence?',
                    options: {
                        maxEntitiesPerConcept: 2,
                        storeResults: false
                    }
                });

                expect(result.success).toBe(true);
                expect(result.result).toEqual(mockResearchResult);
                expect(api.wikidataResearcher.executeResearch).toHaveBeenCalledWith(
                    { question: 'What is artificial intelligence?', concepts: undefined },
                    {
                        llmHandler: mockLLMHandler,
                        sparqlHelper: mockSparqlHelper,
                        config: { wikidataGraphURI: 'http://test.org/wikidata' }
                    },
                    expect.objectContaining({
                        maxEntitiesPerConcept: 2,
                        storeResults: false
                    })
                );
            });

            it('should fail when SPARQL helper not available', async () => {
                // Create API without SPARQL helper
                const noSparqlRegistry = {
                    get: vi.fn((service) => {
                        if (service === 'memory') return mockMemoryManager;
                        if (service === 'llm') return mockLLMHandler;
                        throw new Error(`Service ${service} not found`);
                    })
                };

                const noSparqlAPI = new WikidataAPI({
                    registry: noSparqlRegistry,
                    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
                });
                await noSparqlAPI.initialize();

                const result = await noSparqlAPI.executeOperation('research-concepts', {
                    question: 'test question'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('SPARQL helper is required');
            });

            it('should fail when neither question nor concepts provided', async () => {
                const result = await api.executeOperation('research-concepts', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Either question or concepts must be provided');
            });
        });

        describe('concept-discovery', () => {
            it('should extract and research concepts successfully', async () => {
                const mockConcepts = ['artificial intelligence', 'machine learning', 'neural networks'];
                const mockResearchResult = {
                    statistics: { entitiesFound: 5 }
                };

                mockLLMHandler.extractConcepts.mockResolvedValue(mockConcepts);
                api.wikidataResearcher.executeResearch.mockResolvedValue(mockResearchResult);

                const result = await api.executeOperation('concept-discovery', {
                    text: 'Artificial intelligence and machine learning are revolutionizing technology.',
                    options: {
                        researchConcepts: true,
                        maxEntitiesPerConcept: 2
                    }
                });

                expect(result.success).toBe(true);
                expect(result.result.concepts).toEqual(mockConcepts);
                expect(result.result.conceptCount).toBe(3);
                expect(result.result.research).toEqual(mockResearchResult);
                expect(result.result.entitiesFound).toBe(5);
                expect(mockLLMHandler.extractConcepts).toHaveBeenCalled();
            });

            it('should extract concepts without research when disabled', async () => {
                const mockConcepts = ['test concept'];
                mockLLMHandler.extractConcepts.mockResolvedValue(mockConcepts);

                const result = await api.executeOperation('concept-discovery', {
                    text: 'Test text for concept extraction.',
                    options: {
                        researchConcepts: false
                    }
                });

                expect(result.success).toBe(true);
                expect(result.result.concepts).toEqual(mockConcepts);
                expect(result.result.conceptCount).toBe(1);
                expect(result.result.research).toBeUndefined();
                expect(result.result.entitiesFound).toBeUndefined();
            });

            it('should fail when no text provided', async () => {
                const result = await api.executeOperation('concept-discovery', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('Text is required for concept discovery');
            });

            it('should fail when LLM handler not available', async () => {
                const noLLMRegistry = {
                    get: vi.fn((service) => {
                        if (service === 'memory') return mockMemoryManager;
                        throw new Error(`Service ${service} not found`);
                    })
                };

                const noLLMAPI = new WikidataAPI({
                    registry: noLLMRegistry,
                    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
                });
                await noLLMAPI.initialize();

                const result = await noLLMAPI.executeOperation('concept-discovery', {
                    text: 'test text'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('LLM handler is required');
            });
        });
    });

    describe('SPARQL Operations', () => {
        describe('sparql-query', () => {
            it('should execute SPARQL query successfully', async () => {
                const mockQueryResult = {
                    results: {
                        bindings: [
                            { country: { value: 'Sweden' }, capital: { value: 'Stockholm' } }
                        ]
                    }
                };

                api.wikidataConnector.executeSPARQLQuery.mockResolvedValue(mockQueryResult);

                const sparqlQuery = 'SELECT ?country ?capital WHERE { ?country wdt:P36 ?capital }';
                const result = await api.executeOperation('sparql-query', {
                    query: sparqlQuery,
                    format: 'json'
                });

                expect(result.success).toBe(true);
                expect(result.result.query).toBe(sparqlQuery);
                expect(result.result.result).toEqual(mockQueryResult);
                expect(result.result.format).toBe('json');
                expect(api.wikidataConnector.executeSPARQLQuery).toHaveBeenCalledWith(sparqlQuery, {
                    format: 'json',
                    timeout: 30000
                });
            });

            it('should fail when no query provided', async () => {
                const result = await api.executeOperation('sparql-query', {});

                expect(result.success).toBe(false);
                expect(result.error).toContain('SPARQL query is required');
            });

            it('should handle SPARQL query execution errors', async () => {
                api.wikidataConnector.executeSPARQLQuery.mockRejectedValue(new Error('Query syntax error'));

                const result = await api.executeOperation('sparql-query', {
                    query: 'INVALID SPARQL'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('SPARQL query failed: Query syntax error');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle unknown operations', async () => {
            const result = await api.executeOperation('unknown-operation', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown Wikidata operation: unknown-operation');
        });

        it('should handle invalid parameters', async () => {
            const result = await api.executeOperation('entity-lookup', null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Parameters object is required');
        });

        it('should include timing information in results', async () => {
            api.wikidataSearch.searchEntities.mockResolvedValue([]);

            const result = await api.executeOperation('entity-search', {
                query: 'test'
            });

            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.requestId).toBeDefined();
        });
    });

    describe('Configuration', () => {
        it('should use default configuration values', () => {
            expect(api.maxEntitiesPerConcept).toBe(3);
            expect(api.maxSearchResults).toBe(15);
            expect(api.minConfidence).toBe(0.4);
            expect(api.requestTimeout).toBe(30000);
            expect(api.defaultGraphURI).toBe('http://test.org/wikidata');
        });

        it('should provide endpoint configuration', () => {
            const endpoints = api.getEndpoints();

            expect(endpoints).toBeInstanceOf(Array);
            expect(endpoints.length).toBeGreaterThan(0);
            
            const researchEndpoint = endpoints.find(e => e.operation === 'research-concepts');
            expect(researchEndpoint).toBeDefined();
            expect(researchEndpoint.method).toBe('POST');
            expect(researchEndpoint.path).toBe('/wikidata/research');
            expect(researchEndpoint.schema).toBeDefined();
        });
    });
});