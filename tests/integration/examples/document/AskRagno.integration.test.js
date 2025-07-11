// tests/integration/examples/document/AskRagno.integration.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import AskRagnoSystem from '../../../../examples/document/AskRagno.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('AskRagno Integration Tests', () => {
    let askRagnoSystem;
    let testConfig;
    let originalEnv;

    beforeAll(() => {
        // Save original environment
        originalEnv = { ...process.env };
        
        // Set up test environment
        process.env.LOG_LEVEL = 'warn'; // Reduce log noise in tests
        process.env.MISTRAL_API_KEY = 'test-key';
        process.env.CLAUDE_API_KEY = 'test-key';
        process.env.NOMIC_API_KEY = 'test-key';
        
        // Set up test configuration path
        testConfig = path.join(__dirname, '../../../fixtures/test-config.json');
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    beforeEach(() => {
        askRagnoSystem = new AskRagnoSystem();
    });

    afterEach(async () => {
        if (askRagnoSystem) {
            await askRagnoSystem.cleanup();
        }
        vi.clearAllMocks();
    });

    describe('System Initialization', () => {
        it('should initialize system with configuration', { timeout: 10000 }, async () => {
            // Mock the config to avoid requiring real SPARQL endpoint
            const mockConfig = {
                storage: {
                    type: 'sparql',
                    options: {
                        query: 'http://localhost:3030/semem/query',
                        update: 'http://localhost:3030/semem/update',
                        graphName: 'http://tensegrity.it/semem-test',
                        user: 'testuser',
                        password: 'testpass'
                    }
                },
                llmProviders: [
                    {
                        type: 'ollama',
                        baseUrl: 'http://localhost:11434',
                        chatModel: 'qwen2:1.5b',
                        priority: 1,
                        capabilities: ['chat']
                    }
                ]
            };

            // Mock the config loading
            vi.spyOn(askRagnoSystem, 'initializeConfig').mockImplementation(async () => {
                askRagnoSystem.config = {
                    init: vi.fn(),
                    get: vi.fn((key) => {
                        switch (key) {
                            case 'storage':
                                return mockConfig.storage;
                            case 'llmProviders':
                                return mockConfig.llmProviders;
                            case 'chatModel':
                                return 'qwen2:1.5b';
                            case 'graphName':
                                return 'http://tensegrity.it/semem-test';
                            case 'ollama.baseUrl':
                                return 'http://localhost:11434';
                            default:
                                return null;
                        }
                    })
                };
                askRagnoSystem.sparqlEndpoint = mockConfig.storage.options.query;
                askRagnoSystem.graphName = mockConfig.storage.options.graphName;
                askRagnoSystem.auth = {
                    user: mockConfig.storage.options.user,
                    password: mockConfig.storage.options.password
                };
            });

            // Mock SPARQL services to avoid real connection
            vi.spyOn(askRagnoSystem, 'initializeSPARQLServices').mockImplementation(async () => {
                askRagnoSystem.queryService = {
                    getQuery: vi.fn(),
                    cleanup: vi.fn()
                };
                askRagnoSystem.sparqlHelper = {
                    executeSelect: vi.fn(),
                    executeUpdate: vi.fn(),
                    cleanup: vi.fn()
                };
            });

            // Mock TextToCorpuscle
            vi.spyOn(askRagnoSystem, 'initializeQuestionProcessing').mockImplementation(async () => {
                askRagnoSystem.textToCorpuscle = {
                    init: vi.fn(),
                    processQuestion: vi.fn().mockResolvedValue('http://example.org/corpuscle-123'),
                    cleanup: vi.fn()
                };
            });

            // Mock search system
            vi.spyOn(askRagnoSystem, 'initializeSearchSystem').mockImplementation(async () => {
                askRagnoSystem.searchSystem = {
                    initialize: vi.fn(),
                    processQuery: vi.fn().mockResolvedValue({
                        results: [
                            {
                                uri: 'http://example.org/result-1',
                                type: 'ragno:Entity',
                                content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.',
                                score: 0.9
                            }
                        ]
                    }),
                    cleanup: vi.fn()
                };
            });

            // Mock LLM handler
            vi.spyOn(askRagnoSystem, 'initializeLLMHandler').mockImplementation(async () => {
                askRagnoSystem.llmHandler = {
                    generateResponse: vi.fn().mockResolvedValue('Machine learning is a method of data analysis that automates analytical model building. It uses algorithms that iteratively learn from data, allowing computers to find insights without being explicitly programmed where to look.'),
                    cleanup: vi.fn()
                };
            });

            await askRagnoSystem.init();

            expect(askRagnoSystem.initialized).toBe(true);
            expect(askRagnoSystem.config).toBeDefined();
            expect(askRagnoSystem.sparqlEndpoint).toBe('http://localhost:3030/semem/query');
            expect(askRagnoSystem.graphName).toBe('http://tensegrity.it/semem-test');
        });

        it('should handle configuration errors gracefully', async () => {
            // Mock config initialization to fail
            vi.spyOn(askRagnoSystem, 'initializeConfig').mockImplementation(async () => {
                throw new Error('Configuration file not found');
            });

            await expect(askRagnoSystem.init()).rejects.toThrow('Failed to initialize AskRagno system');
        });

        it('should validate SPARQL configuration', async () => {
            vi.spyOn(askRagnoSystem, 'initializeConfig').mockImplementation(async () => {
                askRagnoSystem.config = {
                    init: vi.fn(),
                    get: vi.fn((key) => {
                        if (key === 'storage') {
                            return { type: 'memory' }; // Invalid for AskRagno
                        }
                        return null;
                    })
                };
            });

            await expect(askRagnoSystem.init()).rejects.toThrow('AskRagno requires SPARQL storage configuration');
        });
    });

    describe('End-to-End Question Processing', () => {
        beforeEach(async () => {
            // Set up fully mocked system
            await setupMockedSystem();
        });

        it('should process a question end-to-end', { timeout: 15000 }, async () => {
            const question = 'What is machine learning?';
            
            const result = await askRagnoSystem.processQuestion(question);

            expect(result).toEqual({
                question: question,
                answer: expect.stringContaining('Machine learning'),
                corpuscleURI: 'http://example.org/corpuscle-123',
                searchResults: expect.objectContaining({
                    results: expect.arrayContaining([
                        expect.objectContaining({
                            uri: 'http://example.org/result-1',
                            type: 'ragno:Entity',
                            content: expect.stringContaining('Machine learning'),
                            score: 0.9
                        })
                    ])
                }),
                context: expect.any(String),
                responseTime: expect.any(Number)
            });

            expect(result.responseTime).toBeGreaterThan(0);
        });

        it('should handle questions with no search results', async () => {
            askRagnoSystem.searchSystem.processQuery.mockResolvedValue({
                results: []
            });

            const question = 'What is quantum computing?';
            const result = await askRagnoSystem.processQuestion(question);

            expect(result.answer).toBeDefined();
            expect(result.searchResults.results).toHaveLength(0);
        });

        it('should handle multiple questions in sequence', async () => {
            const questions = [
                'What is machine learning?',
                'How do neural networks work?',
                'What is deep learning?'
            ];

            const results = [];
            for (const question of questions) {
                const result = await askRagnoSystem.processQuestion(question);
                results.push(result);
            }

            expect(results).toHaveLength(3);
            expect(askRagnoSystem.getStatistics().totalQuestions).toBe(3);
            expect(askRagnoSystem.getStatistics().successfulAnswers).toBe(3);
        });

        it('should handle custom graph name in options', async () => {
            const question = 'What is machine learning?';
            const customGraph = 'http://example.org/custom-graph';
            
            await askRagnoSystem.processQuestion(question, { graphName: customGraph });

            expect(askRagnoSystem.textToCorpuscle.processQuestion).toHaveBeenCalledWith(
                question,
                { graphName: customGraph }
            );
        });

        it('should update statistics correctly', async () => {
            const initialStats = askRagnoSystem.getStatistics();
            
            await askRagnoSystem.processQuestion('Test question');
            
            const finalStats = askRagnoSystem.getStatistics();
            expect(finalStats.totalQuestions).toBe(initialStats.totalQuestions + 1);
            expect(finalStats.successfulAnswers).toBe(initialStats.successfulAnswers + 1);
            expect(finalStats.lastResponseTime).toBeGreaterThan(0);
            expect(finalStats.averageResponseTime).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Resilience', () => {
        beforeEach(async () => {
            await setupMockedSystem();
        });

        it('should handle TextToCorpuscle service failures', async () => {
            askRagnoSystem.textToCorpuscle.processQuestion.mockRejectedValue(
                new Error('SPARQL connection failed')
            );

            const question = 'What is machine learning?';
            
            await expect(askRagnoSystem.processQuestion(question)).rejects.toThrow('SPARQL connection failed');
        });

        it('should handle search system failures', async () => {
            askRagnoSystem.searchSystem.processQuery.mockRejectedValue(
                new Error('Search index unavailable')
            );

            const question = 'What is machine learning?';
            
            await expect(askRagnoSystem.processQuestion(question)).rejects.toThrow('Search index unavailable');
        });

        it('should handle LLM generation failures', async () => {
            askRagnoSystem.llmHandler.generateResponse.mockRejectedValue(
                new Error('LLM API rate limit exceeded')
            );

            const question = 'What is machine learning?';
            
            await expect(askRagnoSystem.processQuestion(question)).rejects.toThrow('Failed to generate answer');
        });

        it('should handle partial failures gracefully', async () => {
            // Mock search to return partial results
            askRagnoSystem.searchSystem.processQuery.mockResolvedValue({
                results: [
                    {
                        uri: 'http://example.org/result-1',
                        type: 'ragno:Entity',
                        // Missing content field
                        score: 0.9
                    }
                ]
            });

            const question = 'What is machine learning?';
            const result = await askRagnoSystem.processQuestion(question);

            expect(result.answer).toBeDefined();
            expect(result.searchResults.results).toHaveLength(1);
        });
    });

    describe('Resource Management', () => {
        beforeEach(async () => {
            await setupMockedSystem();
        });

        it('should cleanup resources properly', async () => {
            await askRagnoSystem.cleanup();

            expect(askRagnoSystem.searchSystem.cleanup).toHaveBeenCalled();
            expect(askRagnoSystem.textToCorpuscle.cleanup).toHaveBeenCalled();
            expect(askRagnoSystem.llmHandler.cleanup).toHaveBeenCalled();
            expect(askRagnoSystem.initialized).toBe(false);
        });

        it('should handle cleanup errors gracefully', async () => {
            askRagnoSystem.searchSystem.cleanup.mockRejectedValue(new Error('Cleanup failed'));

            await expect(askRagnoSystem.cleanup()).resolves.not.toThrow();
            expect(askRagnoSystem.initialized).toBe(false);
        });

        it('should prevent double cleanup', async () => {
            await askRagnoSystem.cleanup();
            const firstCleanupCalls = askRagnoSystem.searchSystem.cleanup.mock.calls.length;
            
            await askRagnoSystem.cleanup();
            
            expect(askRagnoSystem.searchSystem.cleanup.mock.calls.length).toBe(firstCleanupCalls);
        });
    });

    describe('Performance and Scalability', () => {
        beforeEach(async () => {
            await setupMockedSystem();
        });

        it('should handle concurrent questions', async () => {
            const questions = [
                'What is machine learning?',
                'How do neural networks work?',
                'What is deep learning?',
                'Explain artificial intelligence',
                'What are transformers in ML?'
            ];

            // Process questions concurrently
            const promises = questions.map(q => askRagnoSystem.processQuestion(q));
            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            expect(askRagnoSystem.getStatistics().totalQuestions).toBe(5);
            expect(askRagnoSystem.getStatistics().successfulAnswers).toBe(5);
        });

        it('should maintain performance statistics', async () => {
            await askRagnoSystem.processQuestion('Test question 1');
            await askRagnoSystem.processQuestion('Test question 2');
            
            const stats = askRagnoSystem.getStatistics();
            expect(stats.totalQuestions).toBe(2);
            expect(stats.successfulAnswers).toBe(2);
            expect(stats.averageResponseTime).toBeGreaterThan(0);
            expect(stats.lastResponseTime).toBeGreaterThan(0);
        });
    });

    // Helper function to set up mocked system
    async function setupMockedSystem() {
        // Mock all system components
        vi.spyOn(askRagnoSystem, 'initializeConfig').mockImplementation(async () => {
            askRagnoSystem.config = {
                init: vi.fn(),
                get: vi.fn((key) => {
                    switch (key) {
                        case 'storage':
                            return {
                                type: 'sparql',
                                options: {
                                    query: 'http://localhost:3030/semem/query',
                                    graphName: 'http://tensegrity.it/semem-test',
                                    user: 'testuser',
                                    password: 'testpass'
                                }
                            };
                        case 'llmProviders':
                            return [{
                                type: 'ollama',
                                baseUrl: 'http://localhost:11434',
                                chatModel: 'qwen2:1.5b',
                                priority: 1,
                                capabilities: ['chat']
                            }];
                        case 'chatModel':
                            return 'qwen2:1.5b';
                        case 'graphName':
                            return 'http://tensegrity.it/semem-test';
                        case 'ollama.baseUrl':
                            return 'http://localhost:11434';
                        default:
                            return null;
                    }
                })
            };
            askRagnoSystem.sparqlEndpoint = 'http://localhost:3030/semem/query';
            askRagnoSystem.graphName = 'http://tensegrity.it/semem-test';
            askRagnoSystem.auth = { user: 'testuser', password: 'testpass' };
        });

        vi.spyOn(askRagnoSystem, 'initializeSPARQLServices').mockImplementation(async () => {
            askRagnoSystem.queryService = {
                getQuery: vi.fn(),
                cleanup: vi.fn()
            };
            askRagnoSystem.sparqlHelper = {
                executeSelect: vi.fn(),
                executeUpdate: vi.fn(),
                cleanup: vi.fn()
            };
        });

        vi.spyOn(askRagnoSystem, 'initializeQuestionProcessing').mockImplementation(async () => {
            askRagnoSystem.textToCorpuscle = {
                init: vi.fn(),
                processQuestion: vi.fn().mockResolvedValue('http://example.org/corpuscle-123'),
                cleanup: vi.fn()
            };
        });

        vi.spyOn(askRagnoSystem, 'initializeSearchSystem').mockImplementation(async () => {
            askRagnoSystem.searchSystem = {
                initialize: vi.fn(),
                processQuery: vi.fn().mockResolvedValue({
                    results: [
                        {
                            uri: 'http://example.org/result-1',
                            type: 'ragno:Entity',
                            content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.',
                            score: 0.9
                        }
                    ]
                }),
                cleanup: vi.fn()
            };
        });

        vi.spyOn(askRagnoSystem, 'initializeContextManagement').mockImplementation(async () => {
            askRagnoSystem.contextManager = {
                buildContext: vi.fn().mockReturnValue('Built context from search results about machine learning and artificial intelligence.')
            };
        });

        vi.spyOn(askRagnoSystem, 'initializeLLMHandler').mockImplementation(async () => {
            askRagnoSystem.llmHandler = {
                generateResponse: vi.fn().mockResolvedValue('Machine learning is a method of data analysis that automates analytical model building. It uses algorithms that iteratively learn from data, allowing computers to find insights without being explicitly programmed where to look.'),
                cleanup: vi.fn()
            };
        });

        await askRagnoSystem.init();
    }
});