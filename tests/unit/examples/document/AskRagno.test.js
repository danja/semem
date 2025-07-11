// tests/unit/examples/document/AskRagno.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AskRagnoSystem from '../../../../examples/document/AskRagno.js';
import Config from '../../../../src/Config.js';
import { TextToCorpuscle } from '../../../../src/ragno/TextToCorpuscle.js';
import DocumentSearchSystem from '../../../../examples/document/Search.js';
import ContextManager from '../../../../src/ContextManager.js';
import LLMHandler from '../../../../src/handlers/LLMHandler.js';

// Mock dependencies
vi.mock('../../../../src/Config.js');
vi.mock('../../../../src/ragno/TextToCorpuscle.js');
vi.mock('../../../../examples/document/Search.js');
vi.mock('../../../../src/ContextManager.js');
vi.mock('../../../../src/handlers/LLMHandler.js');
vi.mock('../../../../src/services/sparql/index.js');
vi.mock('../../../../src/services/sparql/SPARQLHelper.js');
vi.mock('../../../../src/connectors/MistralConnector.js');
vi.mock('../../../../src/connectors/ClaudeConnector.js');
vi.mock('../../../../src/connectors/OllamaConnector.js');

describe('AskRagnoSystem', () => {
    let askRagnoSystem;
    let mockConfig;
    let mockTextToCorpuscle;
    let mockSearchSystem;
    let mockContextManager;
    let mockLLMHandler;

    beforeEach(() => {
        // Setup mock config
        mockConfig = {
            init: vi.fn(),
            get: vi.fn((key) => {
                switch (key) {
                    case 'storage':
                        return {
                            type: 'sparql',
                            options: {
                                query: 'http://localhost:3030/semem/query',
                                graphName: 'http://tensegrity.it/semem',
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
                        return 'http://tensegrity.it/semem';
                    case 'ollama.baseUrl':
                        return 'http://localhost:11434';
                    default:
                        return null;
                }
            })
        };
        Config.mockReturnValue(mockConfig);

        // Setup mock TextToCorpuscle
        mockTextToCorpuscle = {
            init: vi.fn(),
            processQuestion: vi.fn().mockResolvedValue('http://example.org/corpuscle-123'),
            cleanup: vi.fn()
        };
        TextToCorpuscle.mockReturnValue(mockTextToCorpuscle);

        // Setup mock DocumentSearchSystem
        mockSearchSystem = {
            initialize: vi.fn(),
            processQuery: vi.fn().mockResolvedValue({
                results: [
                    {
                        uri: 'http://example.org/result-1',
                        type: 'ragno:Entity',
                        content: 'Machine learning is a subset of artificial intelligence...',
                        score: 0.9
                    },
                    {
                        uri: 'http://example.org/result-2',
                        type: 'ragno:TextElement',
                        content: 'Neural networks are computational models...',
                        score: 0.8
                    }
                ]
            }),
            cleanup: vi.fn()
        };
        DocumentSearchSystem.mockReturnValue(mockSearchSystem);

        // Setup mock ContextManager
        mockContextManager = {
            buildContext: vi.fn().mockReturnValue('Built context from search results')
        };
        ContextManager.mockReturnValue(mockContextManager);

        // Setup mock LLMHandler
        mockLLMHandler = {
            generateResponse: vi.fn().mockResolvedValue('This is a generated answer based on the context.'),
            cleanup: vi.fn()
        };
        LLMHandler.mockReturnValue(mockLLMHandler);

        // Create AskRagnoSystem instance
        askRagnoSystem = new AskRagnoSystem();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize correctly with all components', async () => {
            await askRagnoSystem.init();

            expect(askRagnoSystem.initialized).toBe(true);
            expect(mockConfig.init).toHaveBeenCalled();
            expect(mockTextToCorpuscle.init).toHaveBeenCalled();
            expect(mockSearchSystem.initialize).toHaveBeenCalled();
            expect(Config).toHaveBeenCalledWith('config/config.json');
        });

        it('should handle configuration path correctly for examples/document', async () => {
            const originalCwd = process.cwd;
            process.cwd = vi.fn().mockReturnValue('/some/path/examples/document');

            await askRagnoSystem.init();

            expect(Config).toHaveBeenCalledWith('../../config/config.json');
            
            process.cwd = originalCwd;
        });

        it('should throw error if SPARQL storage is not configured', async () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'storage') {
                    return { type: 'memory' };
                }
                return null;
            });

            await expect(askRagnoSystem.init()).rejects.toThrow('AskRagno requires SPARQL storage configuration');
        });

        it('should not reinitialize if already initialized', async () => {
            await askRagnoSystem.init();
            const firstInitCall = mockConfig.init.mock.calls.length;
            
            await askRagnoSystem.init();
            
            expect(mockConfig.init.mock.calls.length).toBe(firstInitCall);
        });
    });

    describe('Question Processing', () => {
        beforeEach(async () => {
            await askRagnoSystem.init();
        });

        it('should process a question successfully', async () => {
            const question = 'What is machine learning?';
            const result = await askRagnoSystem.processQuestion(question);

            expect(result).toEqual({
                question: question,
                answer: 'This is a generated answer based on the context.',
                corpuscleURI: 'http://example.org/corpuscle-123',
                searchResults: expect.any(Object),
                context: 'Built context from search results',
                responseTime: expect.any(Number)
            });

            expect(mockTextToCorpuscle.processQuestion).toHaveBeenCalledWith(question, {
                graphName: 'http://tensegrity.it/semem'
            });
            expect(mockSearchSystem.processQuery).toHaveBeenCalledWith(question);
            expect(mockContextManager.buildContext).toHaveBeenCalled();
            expect(mockLLMHandler.generateResponse).toHaveBeenCalled();
        });

        it('should handle custom graph name in options', async () => {
            const question = 'What is machine learning?';
            const customGraph = 'http://example.org/custom-graph';
            
            await askRagnoSystem.processQuestion(question, { graphName: customGraph });

            expect(mockTextToCorpuscle.processQuestion).toHaveBeenCalledWith(question, {
                graphName: customGraph
            });
        });

        it('should update statistics after successful processing', async () => {
            const question = 'What is machine learning?';
            const initialStats = askRagnoSystem.getStatistics();
            
            await askRagnoSystem.processQuestion(question);
            
            const finalStats = askRagnoSystem.getStatistics();
            expect(finalStats.totalQuestions).toBe(initialStats.totalQuestions + 1);
            expect(finalStats.successfulAnswers).toBe(initialStats.successfulAnswers + 1);
            expect(finalStats.lastResponseTime).toBeGreaterThan(0);
        });

        it('should handle search results with no content', async () => {
            mockSearchSystem.processQuery.mockResolvedValue({
                results: []
            });

            const question = 'What is machine learning?';
            const result = await askRagnoSystem.processQuestion(question);

            expect(result.answer).toBe('This is a generated answer based on the context.');
            expect(mockContextManager.buildContext).toHaveBeenCalledWith(
                question,
                [],
                [],
                expect.any(Object)
            );
        });

        it('should handle LLM generation errors', async () => {
            mockLLMHandler.generateResponse.mockRejectedValue(new Error('LLM API error'));

            const question = 'What is machine learning?';
            
            await expect(askRagnoSystem.processQuestion(question)).rejects.toThrow('Failed to generate answer');
        });

        it('should auto-initialize if not initialized', async () => {
            const freshSystem = new AskRagnoSystem();
            expect(freshSystem.initialized).toBe(false);

            await freshSystem.processQuestion('Test question');
            
            expect(freshSystem.initialized).toBe(true);
        });
    });

    describe('Context Building', () => {
        beforeEach(async () => {
            await askRagnoSystem.init();
        });

        it('should build context correctly from search results', () => {
            const question = 'What is machine learning?';
            const searchResults = {
                results: [
                    {
                        uri: 'http://example.org/result-1',
                        type: 'ragno:Entity',
                        content: 'Machine learning content',
                        score: 0.9
                    }
                ]
            };

            const context = askRagnoSystem.buildContextFromResults(question, searchResults);

            expect(mockContextManager.buildContext).toHaveBeenCalledWith(
                question,
                expect.arrayContaining([
                    expect.objectContaining({
                        interaction: expect.objectContaining({
                            prompt: 'Context from: ragno:Entity',
                            output: 'Machine learning content'
                        }),
                        similarity: 0.9
                    })
                ]),
                [],
                expect.objectContaining({
                    systemContext: expect.stringContaining('answering a question')
                })
            );
        });

        it('should handle empty search results', () => {
            const question = 'What is machine learning?';
            const searchResults = { results: [] };

            const context = askRagnoSystem.buildContextFromResults(question, searchResults);

            expect(context).toBe('Built context from search results');
        });

        it('should handle search results without content', () => {
            const question = 'What is machine learning?';
            const searchResults = {
                results: [
                    {
                        uri: 'http://example.org/result-1',
                        type: 'ragno:Entity',
                        score: 0.9
                        // No content field
                    }
                ]
            };

            askRagnoSystem.buildContextFromResults(question, searchResults);

            expect(mockContextManager.buildContext).toHaveBeenCalledWith(
                question,
                expect.arrayContaining([
                    expect.objectContaining({
                        interaction: expect.objectContaining({
                            output: 'No content available'
                        })
                    })
                ]),
                [],
                expect.any(Object)
            );
        });
    });

    describe('LLM Provider Selection', () => {
        it('should select Mistral provider when available', async () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'llmProviders') {
                    return [{
                        type: 'mistral',
                        apiKey: 'test-key',
                        chatModel: 'mistral-small-latest',
                        priority: 1,
                        capabilities: ['chat']
                    }];
                }
                return mockConfig.get.mockReturnValue(null);
            });

            // Mock environment variable
            process.env.MISTRAL_API_KEY = 'test-key';

            const result = await askRagnoSystem.createLLMConnector();

            expect(result).toEqual({
                provider: expect.any(Object),
                model: 'mistral-small-latest'
            });

            delete process.env.MISTRAL_API_KEY;
        });

        it('should fallback to Ollama when other providers fail', async () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'llmProviders') {
                    return [{
                        type: 'mistral',
                        apiKey: 'invalid-key',
                        chatModel: 'mistral-small-latest',
                        priority: 1,
                        capabilities: ['chat']
                    }];
                }
                if (key === 'chatModel') return 'qwen2:1.5b';
                if (key === 'ollama.baseUrl') return 'http://localhost:11434';
                return null;
            });

            const result = await askRagnoSystem.createLLMConnector();

            expect(result).toEqual({
                provider: expect.any(Object),
                model: 'qwen2:1.5b'
            });
        });

        it('should handle empty provider configuration', async () => {
            mockConfig.get.mockImplementation((key) => {
                if (key === 'llmProviders') return [];
                if (key === 'chatModel') return 'qwen2:1.5b';
                if (key === 'ollama.baseUrl') return 'http://localhost:11434';
                return null;
            });

            const result = await askRagnoSystem.createLLMConnector();

            expect(result).toEqual({
                provider: expect.any(Object),
                model: 'qwen2:1.5b'
            });
        });
    });

    describe('Answer Prompt Building', () => {
        it('should build proper answer prompt', () => {
            const question = 'What is machine learning?';
            const context = 'Machine learning is a subset of AI that enables computers to learn from data.';
            
            const prompt = askRagnoSystem.buildAnswerPrompt(question, context);

            expect(prompt).toContain('You are a knowledgeable assistant');
            expect(prompt).toContain(context);
            expect(prompt).toContain(question);
            expect(prompt).toContain('Answer:');
        });

        it('should handle empty context', () => {
            const question = 'What is machine learning?';
            const context = '';
            
            const prompt = askRagnoSystem.buildAnswerPrompt(question, context);

            expect(prompt).toContain(question);
            expect(prompt).toContain('Context:\n');
        });
    });

    describe('Statistics', () => {
        it('should return correct statistics', () => {
            const stats = askRagnoSystem.getStatistics();

            expect(stats).toEqual({
                totalQuestions: 0,
                successfulAnswers: 0,
                averageResponseTime: 0,
                lastResponseTime: null,
                initialized: false,
                configuration: {
                    graphName: null,
                    sparqlEndpoint: null
                }
            });
        });

        it('should update statistics after initialization', async () => {
            await askRagnoSystem.init();
            
            const stats = askRagnoSystem.getStatistics();

            expect(stats.initialized).toBe(true);
            expect(stats.configuration.graphName).toBe('http://tensegrity.it/semem');
            expect(stats.configuration.sparqlEndpoint).toBe('http://localhost:3030/semem/query');
        });
    });

    describe('Cleanup', () => {
        beforeEach(async () => {
            await askRagnoSystem.init();
        });

        it('should cleanup all resources', async () => {
            await askRagnoSystem.cleanup();

            expect(mockSearchSystem.cleanup).toHaveBeenCalled();
            expect(mockTextToCorpuscle.cleanup).toHaveBeenCalled();
            expect(mockLLMHandler.cleanup).toHaveBeenCalled();
            expect(askRagnoSystem.initialized).toBe(false);
        });

        it('should not cleanup if already in progress', async () => {
            askRagnoSystem._cleanupInProgress = true;
            
            await askRagnoSystem.cleanup();

            expect(mockSearchSystem.cleanup).not.toHaveBeenCalled();
        });

        it('should not cleanup if not initialized', async () => {
            const freshSystem = new AskRagnoSystem();
            
            await freshSystem.cleanup();

            // Should not throw and should not call cleanup methods
            expect(mockSearchSystem.cleanup).not.toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            mockSearchSystem.cleanup.mockRejectedValue(new Error('Cleanup error'));
            
            await expect(askRagnoSystem.cleanup()).resolves.not.toThrow();
            expect(askRagnoSystem.initialized).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle TextToCorpuscle errors', async () => {
            await askRagnoSystem.init();
            mockTextToCorpuscle.processQuestion.mockRejectedValue(new Error('TextToCorpuscle error'));

            await expect(askRagnoSystem.processQuestion('Test question')).rejects.toThrow('TextToCorpuscle error');
        });

        it('should handle SearchSystem errors', async () => {
            await askRagnoSystem.init();
            mockSearchSystem.processQuery.mockRejectedValue(new Error('Search error'));

            await expect(askRagnoSystem.processQuestion('Test question')).rejects.toThrow('Search error');
        });

        it('should handle initialization errors', async () => {
            mockConfig.init.mockRejectedValue(new Error('Config error'));

            await expect(askRagnoSystem.init()).rejects.toThrow('Failed to initialize AskRagno system');
        });
    });
});