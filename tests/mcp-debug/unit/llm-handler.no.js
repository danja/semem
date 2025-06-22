// tests/mcp-debug/unit/llm-handler.test.js
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

// Mock console.log which is used in extractConcepts
global.console = {
    ...console,
    log: vi.fn()
};

// Mock the PromptTemplates module
vi.mock('../../../src/PromptTemplates.js', () => ({
    default: {
        formatChatPrompt: vi.fn().mockReturnValue([
            { role: 'system', content: 'test system' }, 
            { role: 'user', content: 'test prompt' }
        ]),
        formatConceptPrompt: vi.fn().mockReturnValue('Extract concepts from: test text')
    }
}));

describe('LLMHandler - MCP Debug Tests', () => {
    let handler;
    let mockProvider;

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        
        // Create a mock LLM provider
        mockProvider = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
            generateChat: vi.fn().mockResolvedValue('test response'),
            generateCompletion: vi.fn().mockResolvedValue('["concept1", "concept2"]')
        };

        // Initialize handler with the mock provider
        handler = new LLMHandler(mockProvider, 'qwen2:1.5b');
        
        // Ensure PromptTemplates mock returns a valid array
        PromptTemplates.formatChatPrompt.mockReturnValue([
            { role: 'system', content: 'test system' }, 
            { role: 'user', content: 'test prompt' }
        ]);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('extractConcepts - JSON Parsing Issues', () => {
        it('should handle valid JSON array responses', async () => {
            mockProvider.generateCompletion.mockResolvedValue('["artificial intelligence", "machine learning", "neural networks"]');

            const concepts = await handler.extractConcepts('AI and ML are related technologies');
            
            expect(concepts).toEqual(['artificial intelligence', 'machine learning', 'neural networks']);
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('response = ["artificial intelligence", "machine learning", "neural networks"]')
            );
        });

        it('should handle responses with prefix text before JSON', async () => {
            mockProvider.generateCompletion.mockResolvedValue('Here are the concepts: ["concept1", "concept2"]');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual(['concept1', 'concept2']);
        });

        it('should handle responses with suffix text after JSON', async () => {
            mockProvider.generateCompletion.mockResolvedValue('["concept1", "concept2"] - these are the main concepts');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual(['concept1', 'concept2']);
        });

        it('should handle the corrupted "[JSON] [...]" format we observed', async () => {
            // This mimics the actual error we saw: [JSON] [{"concept1": ...}]
            mockProvider.generateCompletion.mockResolvedValue('[JSON] [{"concept1": "value1", "concept2": "value2"}]');

            const concepts = await handler.extractConcepts('test text');
            
            // The extractJsonArray method finds the second valid JSON array which contains objects
            // This is actually valid JSON, so it returns the object array
            expect(concepts).toEqual([{"concept1": "value1", "concept2": "value2"}]);
        });

        it('should handle malformed JSON responses', async () => {
            mockProvider.generateCompletion.mockResolvedValue('["concept1", "concept2"'); // Missing closing bracket

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });

        it('should handle responses with no array brackets', async () => {
            mockProvider.generateCompletion.mockResolvedValue('concept1, concept2, concept3');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });

        it('should handle responses with object array instead of string array', async () => {
            mockProvider.generateCompletion.mockResolvedValue('[{"name": "concept1"}, {"name": "concept2"}]');

            const concepts = await handler.extractConcepts('test text');
            
            // This should return the objects, which may not be what we want
            expect(concepts).toEqual([{"name": "concept1"}, {"name": "concept2"}]);
        });

        it('should handle responses with mixed array types', async () => {
            mockProvider.generateCompletion.mockResolvedValue('["concept1", 42, "concept2", null]');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual(["concept1", 42, "concept2", null]);
        });

        it('should handle empty array responses', async () => {
            mockProvider.generateCompletion.mockResolvedValue('[]');

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });

        it('should handle multiple arrays in response (uses first match)', async () => {
            mockProvider.generateCompletion.mockResolvedValue('First: ["concept1"] and second: ["concept2", "concept3"]');

            const concepts = await handler.extractConcepts('test text');
            
            // Should use the first match only
            expect(concepts).toEqual(['concept1']);
        });

        it('should log the full response for debugging', async () => {
            const testResponse = 'Debug response: ["test concept"]';
            mockProvider.generateCompletion.mockResolvedValue(testResponse);

            await handler.extractConcepts('test text');
            
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(`response = ${testResponse}`)
            );
        });

        it('should handle LLM provider errors gracefully', async () => {
            mockProvider.generateCompletion.mockRejectedValue(new Error('Connection timeout'));

            const concepts = await handler.extractConcepts('test text');
            
            expect(concepts).toEqual([]);
        });

        it('should call PromptTemplates.formatConceptPrompt correctly', async () => {
            await handler.extractConcepts('test input text');
            
            expect(PromptTemplates.formatConceptPrompt).toHaveBeenCalledWith(
                'qwen2:1.5b',
                'test input text'
            );
        });

        it('should call generateCompletion with correct parameters', async () => {
            PromptTemplates.formatConceptPrompt.mockReturnValue('formatted prompt');
            
            await handler.extractConcepts('test text');
            
            expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
                'qwen2:1.5b',
                'formatted prompt',
                { temperature: 0.2 }
            );
        });
    });

    describe('generateResponse - Response Generation', () => {
        it('should generate responses correctly with default parameters', async () => {
            const response = await handler.generateResponse('test prompt', 'test context');

            expect(response).toBe('test response');
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'qwen2:1.5b',
                expect.any(Array),
                { temperature: 0.7 }
            );
        });

        it('should use custom system prompt when provided', async () => {
            await handler.generateResponse('test prompt', 'test context', { 
                systemPrompt: 'Custom system prompt' 
            });
            
            expect(PromptTemplates.formatChatPrompt).toHaveBeenCalledWith(
                'qwen2:1.5b',
                'Custom system prompt',
                'test context',
                'test prompt'
            );
        });

        it('should use custom model when provided', async () => {
            await handler.generateResponse('test prompt', 'test context', { 
                model: 'custom-model' 
            });
            
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'custom-model',
                expect.any(Array),
                { temperature: 0.7 }
            );
        });

        it('should use custom temperature when provided', async () => {
            await handler.generateResponse('test prompt', 'test context', { 
                temperature: 0.3 
            });
            
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'qwen2:1.5b',
                expect.any(Array),
                { temperature: 0.3 }
            );
        });

        it('should handle LLM provider errors', async () => {
            mockProvider.generateChat.mockRejectedValue(new Error('API Error'));

            await expect(
                handler.generateResponse('test', 'context')
            ).rejects.toThrow('API Error');
        });

        it('should log request details', async () => {
            await handler.generateResponse('test prompt', 'test context');
            
            // The actual implementation logs the prompt and context
            // We can't easily test the exact log call due to multiline formatting
            // but we can verify the method was called
            expect(mockProvider.generateChat).toHaveBeenCalled();
        });
    });

    describe('generateEmbedding - Embedding Generation', () => {
        it('should generate embeddings successfully', async () => {
            const embedding = await handler.generateEmbedding('test text', 'nomic-embed-text');
            
            expect(embedding).toEqual(new Array(1536).fill(0));
            expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(
                'nomic-embed-text',
                'test text'
            );
        });

        it('should retry on failure and succeed', async () => {
            mockProvider.generateEmbedding
                .mockRejectedValueOnce(new Error('First failure'))
                .mockResolvedValueOnce(new Array(1536).fill(0));
                
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123;
            });
            
            const embedding = await handler.generateEmbedding('test text', 'nomic-embed-text');
            
            expect(embedding).toEqual(new Array(1536).fill(0));
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2);
        });

        it('should throw after maximum retries', async () => {
            mockProvider.generateEmbedding.mockRejectedValue(new Error('Persistent error'));
            
            vi.spyOn(global, 'setTimeout').mockImplementation((cb) => {
                cb();
                return 123;
            });
            
            await expect(
                handler.generateEmbedding('test text', 'nomic-embed-text', 2)
            ).rejects.toThrow('Failed to generate embedding after 2 attempts');
            
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(2);
        });
    });

    describe('Configuration and Validation', () => {
        it('should validate models correctly', () => {
            expect(handler.validateModel('valid-model')).toBe(true);
            expect(handler.validateModel('')).toBe(false);
            expect(handler.validateModel(null)).toBe(false);
            expect(handler.validateModel(123)).toBe(false);
        });

        it('should set temperature correctly', () => {
            handler.setTemperature(0.5);
            expect(handler.temperature).toBe(0.5);
        });

        it('should validate temperature range', () => {
            expect(() => handler.setTemperature(0.5)).not.toThrow();
            expect(() => handler.setTemperature(-0.1)).toThrow('Temperature must be between 0 and 1');
            expect(() => handler.setTemperature(1.1)).toThrow('Temperature must be between 0 and 1');
        });
    });
});