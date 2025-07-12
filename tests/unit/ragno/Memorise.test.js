/**
 * Unit tests for Memorise.js
 * 
 * Tests the core memory ingestion module functionality including:
 * - Configuration and service initialization
 * - Text processing pipeline
 * - SPARQL operations
 * - Error handling and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Memorise from '../../../src/ragno/Memorise.js';
import Config from '../../../src/Config.js';
import { SPARQLQueryService } from '../../../src/services/sparql/index.js';
import SPARQLHelper from '../../../src/services/sparql/SPARQLHelper.js';
import LLMHandler from '../../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../../src/connectors/EmbeddingConnectorFactory.js';
import Chunker from '../../../src/services/document/Chunker.js';
import { CreateConceptsUnified } from '../../../src/ragno/CreateConceptsUnified.js';
import { decomposeCorpus } from '../../../src/ragno/decomposeCorpus.js';
import { URIMinter } from '../../../src/utils/URIMinter.js';
import OllamaConnector from '../../../src/connectors/OllamaConnector.js';

// Mock all external dependencies
vi.mock('../../../src/Config.js');
vi.mock('../../../src/services/sparql/index.js');
vi.mock('../../../src/services/sparql/SPARQLHelper.js');
vi.mock('../../../src/handlers/LLMHandler.js');
vi.mock('../../../src/handlers/EmbeddingHandler.js');
vi.mock('../../../src/connectors/EmbeddingConnectorFactory.js');
vi.mock('../../../src/services/document/Chunker.js');
vi.mock('../../../src/ragno/CreateConceptsUnified.js');
vi.mock('../../../src/ragno/decomposeCorpus.js');
vi.mock('../../../src/utils/URIMinter.js');
vi.mock('../../../src/connectors/OllamaConnector.js');
vi.mock('../../../src/connectors/MistralConnector.js');
vi.mock('../../../src/connectors/ClaudeConnector.js');

describe('Memorise', () => {
    let memorise;
    let mockConfig;
    let mockSparqlHelper;
    let mockQueryService;
    let mockLLMHandler;
    let mockEmbeddingHandler;
    let mockChunker;
    let mockConceptExtractor;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Setup mock config
        mockConfig = {
            init: vi.fn(),
            get: vi.fn((key) => {
                switch (key) {
                    case 'storage':
                        return {
                            type: 'sparql',
                            options: {
                                update: 'http://localhost:3030/dataset/update',
                                user: 'admin',
                                password: 'admin123',
                                graphName: 'http://test.graph'
                            }
                        };
                    case 'llmProviders':
                        return [
                            {
                                type: 'ollama',
                                capabilities: ['chat'],
                                chatModel: 'qwen2:1.5b',
                                baseUrl: 'http://localhost:11434',
                                priority: 2
                            }
                        ];
                    case 'storage.options.graphName':
                        return 'http://test.graph';
                    case 'ollama.baseUrl':
                        return 'http://localhost:11434';
                    default:
                        return null;
                }
            })
        };
        Config.mockImplementation(() => mockConfig);

        // Setup mock SPARQL services
        mockSparqlHelper = {
            executeUpdate: vi.fn().mockResolvedValue({ success: true }),
            createInsertDataQuery: vi.fn().mockReturnValue('INSERT DATA {}')
        };
        SPARQLHelper.mockImplementation(() => mockSparqlHelper);

        mockQueryService = {
            getQuery: vi.fn(),
            cleanup: vi.fn()
        };
        SPARQLQueryService.mockImplementation(() => mockQueryService);

        // Setup mock handlers
        mockLLMHandler = {
            generateResponse: vi.fn()
        };
        LLMHandler.mockImplementation(() => mockLLMHandler);

        mockEmbeddingHandler = {
            generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
            dispose: vi.fn()
        };
        EmbeddingHandler.mockImplementation(() => mockEmbeddingHandler);

        EmbeddingConnectorFactory.createConnector = vi.fn().mockReturnValue({});

        // Setup mock chunker
        mockChunker = {
            chunk: vi.fn().mockResolvedValue({
                chunks: [
                    {
                        uri: 'http://test.chunk/1',
                        content: 'Test chunk 1 content',
                        size: 20,
                        index: 0
                    },
                    {
                        uri: 'http://test.chunk/2', 
                        content: 'Test chunk 2 content',
                        size: 20,
                        index: 1
                    }
                ],
                metadata: {
                    chunking: {
                        avgChunkSize: 20
                    }
                }
            })
        };
        Chunker.mockImplementation(() => mockChunker);

        // Setup mock concept extractor
        mockConceptExtractor = {
            init: vi.fn(),
            processTextElements: vi.fn().mockResolvedValue([
                {
                    conceptCount: 5,
                    concepts: ['concept1', 'concept2', 'concept3', 'concept4', 'concept5']
                }
            ]),
            cleanup: vi.fn()
        };
        CreateConceptsUnified.mockImplementation(() => mockConceptExtractor);

        // Setup mock decomposition
        decomposeCorpus.mockResolvedValue({
            units: [{ uri: 'http://test.unit/1' }],
            entities: [
                { uri: 'http://test.entity/1' },
                { uri: 'http://test.entity/2' }
            ],
            relationships: [
                { uri: 'http://test.rel/1' }
            ],
            dataset: new Map([
                ['quad1', { size: 10 }]
            ])
        });

        // Setup URI minter
        URIMinter.mintURI = vi.fn()
            .mockReturnValueOnce('http://test.unit/1')
            .mockReturnValueOnce('http://test.textelement/1')
            .mockReturnValue('http://test.chunk/1');

        // Create fresh instance
        memorise = new Memorise();
    });

    afterEach(async () => {
        if (memorise) {
            await memorise.cleanup();
        }
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(memorise.config).toBeNull();
            expect(memorise.initialized).toBe(false);
            expect(memorise.stats).toEqual({
                textLength: 0,
                unitsCreated: 0,
                textElementsCreated: 0,
                chunksCreated: 0,
                embeddingsCreated: 0,
                conceptsExtracted: 0,
                entitiesCreated: 0,
                relationshipsCreated: 0,
                processingTimeMs: 0,
                errors: []
            });
        });

        it('should accept custom config path', () => {
            const customMemoriseInstance = new Memorise('/custom/config.json');
            expect(customMemoriseInstance.configPath).toBe('/custom/config.json');
        });
    });

    describe('init', () => {
        it('should initialize all services correctly', async () => {
            await memorise.init();

            expect(Config).toHaveBeenCalledWith('config/config.json');
            expect(mockConfig.init).toHaveBeenCalled();
            expect(SPARQLQueryService).toHaveBeenCalled();
            expect(SPARQLHelper).toHaveBeenCalledWith(
                'http://localhost:3030/dataset/update',
                { user: 'admin', password: 'admin123' }
            );
            expect(memorise.initialized).toBe(true);
        });

        it('should handle document context path correctly', async () => {
            const originalCwd = process.cwd;
            process.cwd = vi.fn().mockReturnValue('/path/to/semem/examples/document');

            const docMemoriseInstance = new Memorise();
            await docMemoriseInstance.init();

            expect(Config).toHaveBeenCalledWith('../../config/config.json');
            
            process.cwd = originalCwd;
        });

        it('should throw error for non-SPARQL storage', async () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'storage') {
                    return { type: 'memory' };
                }
                return null;
            });

            await expect(memorise.init()).rejects.toThrow('Memorise requires SPARQL storage configuration');
        });

        it('should not re-initialize if already initialized', async () => {
            await memorise.init();
            const configCallCount = Config.mock.calls.length;
            
            await memorise.init();
            
            expect(Config.mock.calls.length).toBe(configCallCount);
        });
    });

    describe('memorize', () => {
        const testText = 'This is a test text for memorization. It contains multiple sentences.';
        
        beforeEach(async () => {
            await memorise.init();
        });

        it('should process text successfully through complete pipeline', async () => {
            const result = await memorise.memorize(testText);

            expect(result.success).toBe(true);
            expect(result.unitURI).toBe('http://test.unit/1');
            expect(result.textElementURI).toBe('http://test.textelement/1');
            expect(result.chunks).toBe(2);
            expect(result.statistics.textLength).toBe(testText.length);
            expect(result.statistics.unitsCreated).toBe(1);
            expect(result.statistics.textElementsCreated).toBe(1);
            expect(result.statistics.chunksCreated).toBe(2);
            expect(result.statistics.embeddingsCreated).toBe(2);
            expect(result.statistics.conceptsExtracted).toBe(5);
            expect(result.statistics.entitiesCreated).toBe(2);
            expect(result.statistics.relationshipsCreated).toBe(1);
        });

        it('should handle custom options correctly', async () => {
            const options = {
                title: 'Custom Title',
                source: 'custom-source.txt',
                graph: 'http://custom.graph'
            };

            const result = await memorise.memorize(testText, options);

            expect(result.success).toBe(true);
            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
                expect.stringContaining('http://custom.graph')
            );
        });

        it('should auto-initialize if not already initialized', async () => {
            const uninitializedMemoriseInstance = new Memorise();
            const result = await uninitializedMemoriseInstance.memorize(testText);

            expect(result.success).toBe(true);
            expect(uninitializedMemoriseInstance.initialized).toBe(true);
        });

        it('should handle SPARQL failures gracefully', async () => {
            mockSparqlHelper.executeUpdate.mockResolvedValueOnce({ success: false, error: 'SPARQL error' });

            await expect(memorise.memorize(testText)).rejects.toThrow();
        });

        it('should handle embedding failures gracefully', async () => {
            mockEmbeddingHandler.generateEmbedding.mockRejectedValueOnce(new Error('Embedding failed'));

            const result = await memorise.memorize(testText);

            expect(result.statistics.errors).toContain(expect.stringContaining('Embedding failed'));
            expect(result.statistics.embeddingsCreated).toBe(1); // Only one successful
        });

        it('should handle decomposition failures', async () => {
            decomposeCorpus.mockRejectedValueOnce(new Error('Decomposition failed'));

            await expect(memorise.memorize(testText)).rejects.toThrow('Decomposition failed');
        });
    });

    describe('createTextUnit', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should create Unit and TextElement with correct triples', async () => {
            const result = await memorise.createTextUnit('Test text', 'http://test.graph');

            expect(result.unitURI).toBe('http://test.unit/1');
            expect(result.textElementURI).toBe('http://test.textelement/1');
            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
                expect.stringContaining('ragno:Unit')
            );
            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
                expect.stringContaining('ragno:TextElement')
            );
        });

        it('should handle custom options', async () => {
            const options = { title: 'Custom Title', source: 'custom.txt' };
            const result = await memorise.createTextUnit('Test text', 'http://test.graph', options);

            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
                expect.stringContaining('Custom Title')
            );
        });
    });

    describe('chunkText', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should chunk text and store with OLO structure', async () => {
            const chunks = await memorise.chunkText('http://test.textelement', 'Test text', 'http://test.graph');

            expect(mockChunker.chunk).toHaveBeenCalledWith('Test text', {
                title: expect.stringContaining('TextElement'),
                sourceUri: 'http://test.textelement'
            });
            expect(chunks).toHaveLength(2);
            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
                expect.stringContaining('olo:OrderedList')
            );
        });
    });

    describe('createEmbeddings', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should create embeddings for all chunks', async () => {
            const chunks = [
                { uri: 'http://test.chunk/1', content: 'Chunk 1' },
                { uri: 'http://test.chunk/2', content: 'Chunk 2' }
            ];

            await memorise.createEmbeddings(chunks, 'http://test.graph');

            expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalledTimes(2);
            expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledTimes(2);
        });

        it('should handle embedding failures for individual chunks', async () => {
            const chunks = [
                { uri: 'http://test.chunk/1', content: 'Chunk 1' },
                { uri: 'http://test.chunk/2', content: 'Chunk 2' }
            ];

            mockEmbeddingHandler.generateEmbedding
                .mockResolvedValueOnce([0.1, 0.2, 0.3])
                .mockRejectedValueOnce(new Error('Embedding failed'));

            await memorise.createEmbeddings(chunks, 'http://test.graph');

            expect(memorise.stats.embeddingsCreated).toBe(1);
            expect(memorise.stats.errors).toContain(expect.stringContaining('Embedding failed'));
        });
    });

    describe('extractConcepts', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should extract concepts using concept extractor', async () => {
            const chunks = [{ uri: 'http://test.chunk/1' }];
            
            const result = await memorise.extractConcepts(chunks, 'http://test.graph');

            expect(mockConceptExtractor.processTextElements).toHaveBeenCalledWith({
                limit: 0,
                graph: 'http://test.graph'
            });
            expect(result).toHaveLength(1);
        });
    });

    describe('decomposeText', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should decompose text and store results', async () => {
            const chunks = [
                { uri: 'http://test.chunk/1', content: 'Chunk 1' },
                { uri: 'http://test.chunk/2', content: 'Chunk 2' }
            ];

            const result = await memorise.decomposeText(chunks, 'http://test.graph');

            expect(decomposeCorpus).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ content: 'Chunk 1', source: 'http://test.chunk/1' }),
                    expect.objectContaining({ content: 'Chunk 2', source: 'http://test.chunk/2' })
                ]),
                mockLLMHandler,
                expect.objectContaining({
                    extractRelationships: true,
                    generateSummaries: true,
                    minEntityConfidence: 0.4,
                    maxEntitiesPerUnit: 15
                })
            );
            expect(result.entities).toHaveLength(2);
            expect(result.relationships).toHaveLength(1);
        });

        it('should handle decomposition failures', async () => {
            decomposeCorpus.mockRejectedValueOnce(new Error('Decomposition failed'));
            const chunks = [{ uri: 'http://test.chunk/1', content: 'Chunk 1' }];

            await expect(memorise.decomposeText(chunks, 'http://test.graph')).rejects.toThrow('Decomposition failed');
        });
    });

    describe('cleanup', () => {
        it('should cleanup all resources', async () => {
            await memorise.init();
            await memorise.cleanup();

            expect(mockConceptExtractor.cleanup).toHaveBeenCalled();
            expect(mockEmbeddingHandler.dispose).toHaveBeenCalled();
            expect(mockQueryService.cleanup).toHaveBeenCalled();
        });

        it('should handle cleanup when services are not initialized', async () => {
            await expect(memorise.cleanup()).resolves.not.toThrow();
        });
    });

    describe('error handling', () => {
        it('should handle config initialization failure', async () => {
            mockConfig.init.mockRejectedValueOnce(new Error('Config failed'));

            await expect(memorise.init()).rejects.toThrow('Config failed');
        });

        it('should handle LLM handler initialization failure', async () => {
            LLMHandler.mockImplementation(() => {
                throw new Error('LLM init failed');
            });

            await memorise.init();
            // Should fall back to emergency Ollama connector
            expect(memorise.llmHandler).toBeDefined();
        });

        it('should handle embedding handler initialization failure', async () => {
            EmbeddingConnectorFactory.createConnector.mockImplementation(() => {
                throw new Error('Embedding connector failed');
            });

            await expect(memorise.init()).rejects.toThrow();
        });
    });

    describe('logging and statistics', () => {
        beforeEach(async () => {
            await memorise.init();
        });

        it('should track processing statistics correctly', async () => {
            const testText = 'Test text for statistics tracking';
            
            const result = await memorise.memorize(testText);

            expect(result.statistics.textLength).toBe(testText.length);
            expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
            expect(result.statistics.unitsCreated).toBe(1);
            expect(result.statistics.textElementsCreated).toBe(1);
        });

        it('should track errors in statistics', async () => {
            mockEmbeddingHandler.generateEmbedding.mockRejectedValue(new Error('Test error'));
            
            const result = await memorise.memorize('Test text');

            expect(result.statistics.errors.length).toBeGreaterThan(0);
            expect(result.statistics.errors[0]).toContain('Test error');
        });
    });
});