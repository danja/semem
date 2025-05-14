// tests/unit/handlers/LLMHandler.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import LLMHandler from '../../../src/handlers/LLMHandler.js';
import PromptTemplates from '../../../src/PromptTemplates.js';

// Mock the logger to prevent console output during tests
vi.mock('loglevel', () => ({
    default: {
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock the PromptTemplates module
vi.mock('../../../src/PromptTemplates.js', () => ({
    default: {
        formatChatPrompt: vi.fn().mockReturnValue([{ role: 'system', content: 'test system' }, { role: 'user', content: 'test prompt' }]),
        formatConceptPrompt: vi.fn().mockReturnValue('Identify concepts in: test text')
    }
}));

describe('LLMHandler', () => {
    let handler;
    let mockProvider;

    beforeEach(() => {
        // Create a mock LLM provider
        mockProvider = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
            generateChat: vi.fn().mockResolvedValue('test response'),
            generateCompletion: vi.fn().mockResolvedValue('["test concept"]')
        };

        // Initialize handler with the mock provider
        handler = new LLMHandler(mockProvider, 'test-model');
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Response Generation', () => {
        it('should generate chat response', async () => {
            const response = await handler.generateResponse('test prompt', 'test context');

            expect(response).toBe('test response');
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                expect.any(Array),
                expect.objectContaining({ temperature: expect.any(Number) })
            );
            
            // Verify that PromptTemplates was used
            expect(PromptTemplates.formatChatPrompt).toHaveBeenCalledWith(
                'test-model',
                expect.any(String),
                'test context',
                'test prompt'
            );
        });

        it('should handle chat errors', async () => {
            mockProvider.generateChat.mockRejectedValue(new Error('API Error'));

            await expect(
                handler.generateResponse('test', 'context')
            ).rejects.toThrow('API Error');
        });
        
        it('should use custom system prompt when provided', async () => {
            await handler.generateResponse('test prompt', 'test context', 'Custom system prompt');
            
            expect(PromptTemplates.formatChatPrompt).toHaveBeenCalledWith(
                'test-model',
                'Custom system prompt',
                'test context',
                'test prompt'
            );
        });
    });

    describe('Concept Extraction', () => {
        it('should extract concepts', async () => {
            // First set up our mocks for the test
            PromptTemplates.formatConceptPrompt.mockReturnValue('mock concept prompt');
            
            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual(['test concept']);
            
            // Check that mocked functions were called with correct parameters
            expect(PromptTemplates.formatConceptPrompt).toHaveBeenCalledWith(
                'test-model', 
                'test text'
            );
            
            expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
                'test-model',
                'mock concept prompt',
                { temperature: 0.2 }
            );
        });

        it('should handle invalid JSON responses', async () => {
            mockProvider.generateCompletion.mockResolvedValue('invalid json');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });
        
        it('should handle responses with no array', async () => {
            mockProvider.generateCompletion.mockResolvedValue('The text discusses various topics');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });
        
        it('should handle LLM errors gracefully', async () => {
            mockProvider.generateCompletion.mockRejectedValue(new Error('API Error'));

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });
    });
    
    describe('Embedding Generation', () => {
        it('should generate embeddings', async () => {
            const embedding = await handler.generateEmbedding('test text', 'embedding-model');
            
            expect(embedding).toEqual(new Array(1536).fill(0));
            expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(
                'embedding-model',
                'test text'
            );
        });
        
        it('should retry on failure', async () => {
            // Fail twice, succeed on third attempt
            mockProvider.generateEmbedding
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValueOnce(new Array(1536).fill(0));
                
            // Mock setTimeout to avoid actual waiting in tests
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123; // fake timer ID
            });
            
            const embedding = await handler.generateEmbedding('test text', 'embedding-model');
            
            expect(embedding).toEqual(new Array(1536).fill(0));
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(3);
        });
        
        it('should throw after maximum retries', async () => {
            // Always fail
            mockProvider.generateEmbedding.mockRejectedValue(new Error('API Error'));
            
            // Mock setTimeout to avoid actual waiting in tests
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123; // fake timer ID
            });
            
            await expect(
                handler.generateEmbedding('test text', 'embedding-model', 2)
            ).rejects.toThrow('Failed to generate embedding after 2 attempts');
            
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2);
        });
    });

    describe('Temperature Control', () => {
        it('should validate temperature range', () => {
            expect(() => handler.setTemperature(0.5)).not.toThrow();
            
            expect(() => handler.setTemperature(-0.1))
                .toThrow('Temperature must be between 0 and 1');
                
            expect(() => handler.setTemperature(1.1))
                .toThrow('Temperature must be between 0 and 1');
        });
        
        it('should update temperature value', () => {
            handler.setTemperature(0.3);
            expect(handler.temperature).toBe(0.3);
        });
    });
    
    describe('Model Validation', () => {
        it('should validate model names', () => {
            expect(handler.validateModel('valid-model')).toBe(true);
            expect(handler.validateModel('')).toBe(false);
            expect(handler.validateModel(null)).toBe(false);
            expect(handler.validateModel(123)).toBe(false);
        });
    });
});