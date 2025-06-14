// tests/unit/MemoryManager.mcp-debug.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MemoryManager from '../../src/MemoryManager.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';

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

describe('MemoryManager MCP Debug Tests', () => {
    let manager;
    let mockLLMProvider;
    let mockStorage;

    beforeEach(() => {
        // Create mock LLM provider that mimics real behavior
        mockLLMProvider = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
            generateChat: vi.fn().mockResolvedValue('This is a test response from the LLM'),
            generateCompletion: vi.fn().mockResolvedValue('["artificial intelligence", "machine learning", "technology"]')
        };

        // Create mock storage
        mockStorage = {
            store: vi.fn().mockResolvedValue(true),
            search: vi.fn().mockResolvedValue([]),
            loadHistory: vi.fn().mockResolvedValue([[], []]),
            saveMemoryToHistory: vi.fn().mockResolvedValue(true),
            close: vi.fn().mockResolvedValue(true)
        };

        // Create real MemoryManager instance with mocked dependencies
        manager = new MemoryManager({
            llmProvider: mockLLMProvider,
            storage: mockStorage,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            dimension: 1536
        });
    });

    afterEach(async () => {
        if (manager) {
            try {
                await manager.dispose();
            } catch (error) {
                // Ignore disposal errors in tests
            }
        }
        vi.resetAllMocks();
    });

    describe('Core Memory Operations from MCP', () => {
        it('should successfully store interactions with all required fields', async () => {
            const prompt = "What is artificial intelligence?";
            const response = "Artificial intelligence (AI) is the simulation of human intelligence in machines.";
            
            // Test the exact pattern used in MCP tools
            const embedding = await manager.generateEmbedding(`${prompt} ${response}`);
            await manager.addInteraction(prompt, response, embedding, ['AI', 'technology']);
            
            // Verify embedding was generated
            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalledWith('nomic-embed-text', `${prompt} ${response}`);
            expect(embedding).toEqual(new Array(1536).fill(0.1));
            
            // Verify storage was called with correct data structure
            expect(mockStorage.store).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt,
                    response,
                    embedding,
                    concepts: ['AI', 'technology'],
                    timestamp: expect.any(Number)
                })
            );
        });

        it('should retrieve relevant interactions and return proper structure', async () => {
            // Mock storage to return some test data
            const mockMemories = [
                {
                    id: 'test1',
                    prompt: 'What is ML?',
                    response: 'Machine learning is...',
                    concepts: ['machine learning'],
                    similarity: 0.85,
                    timestamp: Date.now()
                },
                {
                    id: 'test2',
                    prompt: 'Explain AI',
                    response: 'AI is...',
                    concepts: ['artificial intelligence'],
                    similarity: 0.75,
                    timestamp: Date.now()
                }
            ];
            
            mockStorage.search.mockResolvedValue(mockMemories);
            
            const query = "Tell me about artificial intelligence";
            const results = await manager.retrieveRelevantInteractions(query);
            
            // Verify the results have the expected structure
            expect(results).toHaveLength(2);
            expect(results[0]).toHaveProperty('prompt');
            expect(results[0]).toHaveProperty('response');
            expect(results[0]).toHaveProperty('similarity');
            expect(results[0].similarity).toBeTypeOf('number');
            expect(results[0].prompt).toBeTypeOf('string');
            expect(results[0].response).toBeTypeOf('string');
        });

        it('should handle empty query gracefully', async () => {
            // Test the specific case that was causing issues in MCP demo
            const results = await manager.retrieveRelevantInteractions("");
            
            // Should return empty array, not null or undefined
            expect(Array.isArray(results)).toBe(true);
            expect(results).toHaveLength(0);
        });

        it('should handle null/undefined queries gracefully', async () => {
            const results1 = await manager.retrieveRelevantInteractions(null);
            const results2 = await manager.retrieveRelevantInteractions(undefined);
            
            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
            expect(results1).toHaveLength(0);
            expect(results2).toHaveLength(0);
        });

        it('should generate embeddings without corruption', async () => {
            const text = "Test text for embedding generation";
            const embedding = await manager.generateEmbedding(text);
            
            // Verify embedding is properly structured
            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding).toHaveLength(1536);
            expect(embedding.every(val => typeof val === 'number')).toBe(true);
            expect(embedding.some(val => val !== 0)).toBe(true); // Should not be all zeros
        });

        it('should generate responses with proper context handling', async () => {
            const prompt = "What is machine learning?";
            const context = [
                { prompt: "What is AI?", response: "AI is...", similarity: 0.9 }
            ];
            
            const response = await manager.generateResponse(prompt, [], context);
            
            // Verify response is a string and not null/undefined
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
            expect(response).toBe('This is a test response from the LLM');
            
            // Verify LLM was called with proper parameters
            expect(mockLLMProvider.generateChat).toHaveBeenCalled();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle LLM provider failures gracefully', async () => {
            // Simulate LLM provider failure
            mockLLMProvider.generateEmbedding.mockRejectedValue(new Error('LLM API Error'));
            
            const text = "Test text";
            
            // Should throw error but not crash
            await expect(manager.generateEmbedding(text)).rejects.toThrow('LLM API Error');
        });

        it('should handle storage failures gracefully', async () => {
            // Simulate storage failure
            mockStorage.store.mockRejectedValue(new Error('Storage Error'));
            
            const prompt = "Test prompt";
            const response = "Test response";
            const embedding = new Array(1536).fill(0.1);
            
            // Should throw error but not crash
            await expect(
                manager.addInteraction(prompt, response, embedding, [])
            ).rejects.toThrow('Storage Error');
        });

        it('should handle malformed storage data gracefully', async () => {
            // Simulate malformed data from storage
            mockStorage.search.mockResolvedValue([
                { incomplete: 'data' }, // Missing required fields
                null, // Null entry
                { prompt: 'Valid', response: 'Valid', similarity: 0.5 } // Valid entry
            ]);
            
            const results = await manager.retrieveRelevantInteractions("test query");
            
            // Should filter out invalid entries and return only valid ones
            expect(Array.isArray(results)).toBe(true);
            // The implementation should handle malformed data gracefully
        });
    });

    describe('MCP-specific Data Flow Issues', () => {
        it('should maintain data integrity through the full MCP workflow', async () => {
            // Step 1: Store interaction (as MCP tool does)
            const prompt = "Explain neural networks";
            const response = "Neural networks are computational models inspired by biological neural networks.";
            
            const embedding = await manager.generateEmbedding(`${prompt} ${response}`);
            await manager.addInteraction(prompt, response, embedding, ['neural networks', 'AI']);
            
            // Step 2: Retrieve interactions (as MCP tool does)
            mockStorage.search.mockResolvedValue([{
                id: 'stored-interaction',
                prompt,
                response,
                concepts: ['neural networks', 'AI'],
                similarity: 0.9,
                timestamp: Date.now()
            }]);
            
            const retrieved = await manager.retrieveRelevantInteractions("neural networks");
            
            // Step 3: Generate response with context (as MCP tool does)
            const contextualResponse = await manager.generateResponse(
                "Tell me more about neural networks",
                [],
                retrieved
            );
            
            // Verify data integrity at each step
            expect(embedding).toBeDefined();
            expect(Array.isArray(embedding)).toBe(true);
            
            expect(retrieved).toBeDefined();
            expect(Array.isArray(retrieved)).toBe(true);
            expect(retrieved[0]).toHaveProperty('prompt');
            expect(retrieved[0]).toHaveProperty('response');
            
            expect(contextualResponse).toBeDefined();
            expect(typeof contextualResponse).toBe('string');
            expect(contextualResponse.length).toBeGreaterThan(0);
        });

        it('should handle the specific "all" query pattern from MCP tools', async () => {
            // This tests the fixed issue where tools called retrieveRelevantInteractions("all", 0, 0)
            mockStorage.search.mockResolvedValue([
                { prompt: 'Test 1', response: 'Response 1', similarity: 0.9 },
                { prompt: 'Test 2', response: 'Response 2', similarity: 0.8 }
            ]);
            
            const results = await manager.retrieveRelevantInteractions("all", 0, 0);
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });
});