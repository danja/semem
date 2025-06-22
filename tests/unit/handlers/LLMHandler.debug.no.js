// tests/unit/handlers/LLMHandler.debug.spec.js
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
        formatConceptPrompt: vi.fn().mockReturnValue('Identify concepts in: test text')
    }
}));

describe('LLMHandler Debug Tests - JSON Parsing Issues', () => {
    let handler;
    let mockProvider;

    beforeEach(() => {
        // Create a mock LLM provider
        mockProvider = {
            generateCompletion: vi.fn()
        };

        // Initialize handler with the mock provider
        handler = new LLMHandler(mockProvider, 'test-model');
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Concept Extraction JSON Parsing Edge Cases', () => {
        it('should handle LLM responses with [JSON] prefix (identified in MCP demo)', async () => {
            // This is the actual format we saw in the MCP demo logs
            mockProvider.generateCompletion.mockResolvedValue('[JSON] ["artificial intelligence", "machine learning", "neural networks"]');
            
            const concepts = await handler.extractConcepts('test text about AI and ML');
            
            // Should extract the JSON array correctly despite the prefix
            expect(concepts).toEqual(["artificial intelligence", "machine learning", "neural networks"]);
        });

        it('should handle LLM responses with various prefixes', async () => {
            const testCases = [
                {
                    response: 'Here are the concepts: ["concept1", "concept2"]',
                    expected: ["concept1", "concept2"]
                },
                {
                    response: 'The concepts I identified are: ["test", "example"]',
                    expected: ["test", "example"]
                },
                {
                    response: 'Response: ["single"]',
                    expected: ["single"]
                },
                {
                    response: '["no prefix"]',
                    expected: ["no prefix"]
                }
            ];

            for (const testCase of testCases) {
                mockProvider.generateCompletion.mockResolvedValue(testCase.response);
                const concepts = await handler.extractConcepts('test text');
                expect(concepts).toEqual(testCase.expected);
            }
        });

        it('should handle malformed JSON arrays', async () => {
            const malformedCases = [
                '["unclosed array"',
                '["missing", "quote]',
                '[invalid, json]',
                '["extra", "comma",]',
                '["mixed" quotes\']'
            ];

            for (const malformed of malformedCases) {
                mockProvider.generateCompletion.mockResolvedValue(malformed);
                const concepts = await handler.extractConcepts('test text');
                expect(concepts).toEqual([]); // Should gracefully return empty array
            }
        });

        it('should handle responses with multiple JSON arrays', async () => {
            // Test case where LLM returns multiple arrays - should pick first one
            mockProvider.generateCompletion.mockResolvedValue(
                'Here are primary concepts: ["primary1", "primary2"] and secondary: ["secondary1"]'
            );
            
            const concepts = await handler.extractConcepts('test text');
            expect(concepts).toEqual(["primary1", "primary2"]);
        });

        it('should handle empty arrays', async () => {
            mockProvider.generateCompletion.mockResolvedValue('No concepts found: []');
            
            const concepts = await handler.extractConcepts('test text');
            expect(concepts).toEqual([]);
        });

        it('should handle nested arrays or objects', async () => {
            const nestedCases = [
                '{"concepts": ["nested1", "nested2"]}', // Object with array
                '[["nested"], ["arrays"]]', // Array of arrays
                '["simple", {"complex": "object"}]' // Mixed types
            ];

            for (const nested of nestedCases) {
                mockProvider.generateCompletion.mockResolvedValue(nested);
                const concepts = await handler.extractConcepts('test text');
                // Should handle these gracefully - might extract what it can or return empty
                expect(Array.isArray(concepts)).toBe(true);
            }
        });

        it('should handle very long responses with buried JSON', async () => {
            const longResponse = `
                Based on my analysis of the provided text, I have identified several key concepts 
                that are central to understanding the content. These concepts represent the main 
                topics, themes, and ideas present in the text. Here is my analysis:
                
                The primary concepts I've extracted are: ["artificial intelligence", "machine learning", "deep learning", "neural networks", "data science"]
                
                These concepts were selected based on their frequency, importance, and relevance 
                to the overall meaning of the text.
            `;
            
            mockProvider.generateCompletion.mockResolvedValue(longResponse);
            
            const concepts = await handler.extractConcepts('test text about AI');
            expect(concepts).toEqual(["artificial intelligence", "machine learning", "deep learning", "neural networks", "data science"]);
        });

        it('should handle unicode and special characters in concepts', async () => {
            mockProvider.generateCompletion.mockResolvedValue('["café", "naïve", "résumé", "machine learning", "AI/ML"]');
            
            const concepts = await handler.extractConcepts('test text with special chars');
            expect(concepts).toEqual(["café", "naïve", "résumé", "machine learning", "AI/ML"]);
        });

        it('should handle responses that look like JSON but are not', async () => {
            const notJsonCases = [
                '[This is not JSON]',
                '["quote in string: "embedded quote""]',
                '[just text that looks array-like]'
            ];

            for (const notJson of notJsonCases) {
                mockProvider.generateCompletion.mockResolvedValue(notJson);
                const concepts = await handler.extractConcepts('test text');
                expect(concepts).toEqual([]); // Should gracefully return empty array
            }
        });
    });

    describe('Real-world LLM Response Patterns', () => {
        it('should handle typical Ollama qwen2 response patterns', async () => {
            // Based on actual Ollama responses we might see
            const ollamaResponses = [
                'Based on the text, I identify these concepts: ["concept1", "concept2", "concept3"]',
                'The key concepts are:\n["item1", "item2", "item3"]',
                'Concepts: ["single concept"]',
                'I found the following concepts in the text: ["analysis", "extraction", "processing"]'
            ];

            for (const response of ollamaResponses) {
                mockProvider.generateCompletion.mockResolvedValue(response);
                const concepts = await handler.extractConcepts('test text');
                expect(Array.isArray(concepts)).toBe(true);
                expect(concepts.length).toBeGreaterThan(0);
            }
        });

        it('should handle Claude-style responses', async () => {
            // Based on potential Claude response patterns
            const claudeResponses = [
                'Here are the key concepts I identified:\n\n["artificial intelligence", "machine learning", "natural language processing"]',
                'After analyzing the text, the main concepts are: ["data", "analysis", "insights"]'
            ];

            for (const response of claudeResponses) {
                mockProvider.generateCompletion.mockResolvedValue(response);
                const concepts = await handler.extractConcepts('test text');
                expect(Array.isArray(concepts)).toBe(true);
                expect(concepts.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Error Recovery and Logging', () => {
        it('should log appropriate warnings for parsing failures', async () => {
            const logger = await import('loglevel');
            
            mockProvider.generateCompletion.mockResolvedValue('invalid response with no array');
            
            await handler.extractConcepts('test text');
            
            expect(logger.default.warn).toHaveBeenCalledWith('No concept array found in LLM response');
        });

        it('should log warnings for responses with no valid JSON arrays', async () => {
            const logger = await import('loglevel');
            
            mockProvider.generateCompletion.mockResolvedValue('["malformed json');
            
            await handler.extractConcepts('test text');
            
            expect(logger.default.warn).toHaveBeenCalledWith('No concept array found in LLM response');
        });
    });
});