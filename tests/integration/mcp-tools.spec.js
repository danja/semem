// tests/integration/mcp-tools.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MemoryManager from '../../src/MemoryManager.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';

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

// Mock Ollama connector to simulate responses without needing real Ollama
vi.mock('../../src/connectors/OllamaConnector.js', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
            generateChat: vi.fn().mockResolvedValue('This is a mocked response from Ollama'),
            generateCompletion: vi.fn().mockResolvedValue('["artificial intelligence", "machine learning", "technology"]')
        }))
    };
});

describe('MCP Tools Integration Tests', () => {
    let memoryManager;
    let mockConnector;

    beforeEach(async () => {
        // Create a real MemoryManager instance like the MCP server does
        mockConnector = new OllamaConnector();
        
        memoryManager = new MemoryManager({
            llmProvider: mockConnector,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage: null // Default in-memory storage like MCP server
        });
        
        await memoryManager.initialize();
    });

    afterEach(async () => {
        if (memoryManager) {
            await memoryManager.dispose();
        }
        vi.clearAllMocks();
    });

    describe('semem_store_interaction tool simulation', () => {
        it('should mimic the exact MCP tool workflow for storing interactions', async () => {
            // This simulates the exact workflow from the MCP semem_store_interaction tool
            const prompt = "What is artificial intelligence?";
            const response = "Artificial intelligence (AI) is the simulation of human intelligence in machines.";
            
            // Step 1: Extract concepts (as done by MCP tool)
            const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
            
            // Step 2: Generate embedding (as done by MCP tool)
            const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
            
            // Step 3: Store interaction (as done by MCP tool)
            await memoryManager.addInteraction(prompt, response, embedding, concepts);
            
            // Verify that all operations complete without throwing errors
            expect(concepts).toBeDefined();
            expect(Array.isArray(concepts)).toBe(true);
            expect(embedding).toBeDefined();
            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBe(1536);
        });
    });

    describe('semem_retrieve_memories tool simulation', () => {
        it('should mimic the exact MCP tool workflow for retrieving memories', async () => {
            // First store some interactions
            const interactions = [
                {
                    prompt: "What is machine learning?",
                    response: "Machine learning is a subset of AI that enables computers to learn patterns."
                },
                {
                    prompt: "Explain neural networks",
                    response: "Neural networks are computational models inspired by biological neurons."
                }
            ];
            
            // Store the interactions
            for (const interaction of interactions) {
                const concepts = await memoryManager.extractConcepts(`${interaction.prompt} ${interaction.response}`);
                const embedding = await memoryManager.generateEmbedding(`${interaction.prompt} ${interaction.response}`);
                await memoryManager.addInteraction(interaction.prompt, interaction.response, embedding, concepts);
            }
            
            // Now retrieve memories (as done by MCP tool)
            const query = "Tell me about AI and machine learning";
            const memories = await memoryManager.retrieveRelevantInteractions(query);
            
            // Verify the structure and content
            expect(Array.isArray(memories)).toBe(true);
            
            // If memories are found, verify their structure
            if (memories.length > 0) {
                const memory = memories[0];
                expect(memory).toHaveProperty('prompt');
                expect(memory).toHaveProperty('output'); // MemoryManager uses 'output' not 'response'
                expect(typeof memory.prompt).toBe('string');
                expect(typeof memory.output).toBe('string');
            }
        });
    });

    describe('semem_generate_response tool simulation', () => {
        it('should mimic the exact MCP tool workflow for generating responses', async () => {
            // Store some context first
            const prompt = "Explain deep learning";
            const response = "Deep learning uses neural networks with multiple layers.";
            const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
            const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
            await memoryManager.addInteraction(prompt, response, embedding, concepts);
            
            // Retrieve relevant memories
            const query = "What is deep learning?";
            const relevantMemories = await memoryManager.retrieveRelevantInteractions(query);
            
            // Generate response with context (as done by MCP tool)
            const generatedResponse = await memoryManager.generateResponse(query, [], relevantMemories);
            
            // Verify response is generated
            expect(typeof generatedResponse).toBe('string');
            expect(generatedResponse.length).toBeGreaterThan(0);
        });
    });

    describe('Error scenarios that might cause null values', () => {
        it('should handle empty string inputs without returning null', async () => {
            // Test the problematic scenario from the MCP demo
            const memories = await memoryManager.retrieveRelevantInteractions("");
            expect(memories).toBeDefined();
            expect(Array.isArray(memories)).toBe(true);
        });

        it('should handle concept extraction failures gracefully', async () => {
            // Mock concept extraction to fail
            mockConnector.generateCompletion.mockRejectedValueOnce(new Error('API Error'));
            
            const concepts = await memoryManager.extractConcepts("Test text");
            
            // Should not return null, should return empty array or handle gracefully
            expect(concepts).toBeDefined();
        });

        it('should handle embedding generation failures gracefully', async () => {
            // Mock embedding generation to fail
            mockConnector.generateEmbedding.mockRejectedValueOnce(new Error('Embedding API Error'));
            
            // Should throw error, not return null
            await expect(memoryManager.generateEmbedding("Test text")).rejects.toThrow();
        });
    });

    describe('Data integrity through full workflow', () => {
        it('should maintain proper data types through the complete MCP workflow', async () => {
            const prompt = "Test prompt";
            const response = "Test response";
            
            // Complete workflow
            const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
            const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
            await memoryManager.addInteraction(prompt, response, embedding, concepts);
            
            const memories = await memoryManager.retrieveRelevantInteractions(prompt);
            const generatedResponse = await memoryManager.generateResponse("Related query", [], memories);
            
            // Verify no null/undefined values at any step
            expect(concepts).not.toBeNull();
            expect(concepts).not.toBeUndefined();
            expect(embedding).not.toBeNull();
            expect(embedding).not.toBeUndefined();
            expect(memories).not.toBeNull();
            expect(memories).not.toBeUndefined();
            expect(generatedResponse).not.toBeNull();
            expect(generatedResponse).not.toBeUndefined();
            
            // Verify proper types
            expect(Array.isArray(concepts)).toBe(true);
            expect(Array.isArray(embedding)).toBe(true);
            expect(Array.isArray(memories)).toBe(true);
            expect(typeof generatedResponse).toBe('string');
        });
    });
});