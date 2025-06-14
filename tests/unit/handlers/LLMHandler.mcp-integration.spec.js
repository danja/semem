// tests/unit/handlers/LLMHandler.mcp-integration.spec.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import LLMHandler from '../../../src/handlers/LLMHandler.js';

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
        formatConceptPrompt: vi.fn().mockReturnValue('Extract concepts from this text: {{TEXT}}')
    }
}));

describe('LLMHandler MCP Integration Scenarios', () => {
    let handler;
    let mockProvider;

    beforeEach(() => {
        // Create a mock LLM provider
        mockProvider = {
            generateCompletion: vi.fn()
        };

        // Initialize handler with the mock provider
        handler = new LLMHandler(mockProvider, 'qwen2:1.5b');
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Real MCP Demo Scenarios', () => {
        it('should handle the specific [JSON] prefix format seen in MCP demo', async () => {
            // This is the exact format that was causing issues in the MCP demo
            mockProvider.generateCompletion.mockResolvedValue('[JSON] ["artificial intelligence", "machine learning", "technology", "innovation"]');
            
            const concepts = await handler.extractConcepts('What is artificial intelligence and how does it relate to modern technology?');
            
            expect(concepts).toEqual(["artificial intelligence", "machine learning", "technology", "innovation"]);
            expect(concepts.length).toBe(4);
        });

        it('should handle memory storage scenarios from MCP demo', async () => {
            // Test the scenario where we store a conversation about AI
            mockProvider.generateCompletion.mockResolvedValue('Based on the conversation about AI, the key concepts are: ["artificial intelligence", "conversation", "memory", "storage"]');
            
            const concepts = await handler.extractConcepts('User asked about AI and I provided a detailed explanation about artificial intelligence capabilities');
            
            expect(concepts).toEqual(["artificial intelligence", "conversation", "memory", "storage"]);
        });

        it('should handle document management scenarios', async () => {
            // Test document-related concept extraction
            mockProvider.generateCompletion.mockResolvedValue('Document analysis reveals: ["document management", "file storage", "content analysis", "metadata"]');
            
            const concepts = await handler.extractConcepts('Store this document about file management systems in our semantic memory');
            
            expect(concepts).toEqual(["document management", "file storage", "content analysis", "metadata"]);
        });

        it('should handle relationship extraction scenarios', async () => {
            // Test relationship-related concepts
            mockProvider.generateCompletion.mockResolvedValue('The relationship concepts are: ["entity relationships", "graph connections", "semantic links", "knowledge graph"]');
            
            const concepts = await handler.extractConcepts('Create relationships between these entities in the knowledge graph');
            
            expect(concepts).toEqual(["entity relationships", "graph connections", "semantic links", "knowledge graph"]);
        });

        it('should handle hybrid search scenarios', async () => {
            // Test hybrid search concepts
            mockProvider.generateCompletion.mockResolvedValue('Hybrid search involves: ["vector search", "graph traversal", "semantic similarity", "knowledge retrieval"]');
            
            const concepts = await handler.extractConcepts('Use hybrid search to find relevant information from both embeddings and knowledge graph');
            
            expect(concepts).toEqual(["vector search", "graph traversal", "semantic similarity", "knowledge retrieval"]);
        });
    });

    describe('Empty String and Edge Cases from MCP', () => {
        it('should handle empty string inputs gracefully', async () => {
            // This was causing issues in the MCP demo when tools passed empty strings
            const concepts = await handler.extractConcepts('');
            
            // Should return empty array for empty input
            expect(concepts).toEqual([]);
            
            // Should not call the LLM provider for empty input
            expect(mockProvider.generateCompletion).not.toHaveBeenCalled();
        });

        it('should handle whitespace-only inputs', async () => {
            const concepts = await handler.extractConcepts('   \n\t   ');
            
            // Should return empty array for whitespace-only input
            expect(concepts).toEqual([]);
            
            // Should not call the LLM provider for whitespace-only input
            expect(mockProvider.generateCompletion).not.toHaveBeenCalled();
        });

        it('should handle undefined and null inputs', async () => {
            const concepts1 = await handler.extractConcepts(undefined);
            const concepts2 = await handler.extractConcepts(null);
            
            expect(concepts1).toEqual([]);
            expect(concepts2).toEqual([]);
            
            // Should not call the LLM provider for invalid inputs
            expect(mockProvider.generateCompletion).not.toHaveBeenCalled();
        });
    });

    describe('LLM Response Format Variations', () => {
        it('should handle Ollama qwen2 typical response patterns', async () => {
            const responses = [
                'Based on the analysis, I identify these concepts: ["analysis", "identification", "processing"]',
                'The main topics in this text are:\\n\\n["main topics", "text analysis", "content extraction"]',
                'Here are the key concepts I found: ["key concepts", "discovery", "extraction"]'
            ];

            for (const response of responses) {
                mockProvider.generateCompletion.mockResolvedValue(response);
                const concepts = await handler.extractConcepts('Test text for concept extraction');
                
                expect(Array.isArray(concepts)).toBe(true);
                expect(concepts.length).toBeGreaterThan(0);
            }
        });

        it('should handle responses with extra formatting', async () => {
            // Test responses with markdown, extra spaces, etc.
            const formattedResponse = `
                ## Concept Analysis
                
                After analyzing the provided text, I have identified the following concepts:
                
                **Primary Concepts:**
                ["primary analysis", "concept identification", "text processing"]
                
                These concepts represent the main themes in the text.
            `;
            
            mockProvider.generateCompletion.mockResolvedValue(formattedResponse);
            const concepts = await handler.extractConcepts('Analyze this text for key concepts');
            
            expect(concepts).toEqual(["primary analysis", "concept identification", "text processing"]);
        });
    });
});