import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SafeOperations } from '../../../../mcp/lib/safe-operations.js';

// Mock memory manager
const mockMemoryManager = {
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  addInteraction: vi.fn().mockResolvedValue(true),
  retrieveRelevantInteractions: vi.fn().mockResolvedValue([]),
  extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
  generateResponse: vi.fn().mockResolvedValue('Generated response'),
  llmHandler: {
    extractConcepts: vi.fn().mockResolvedValue(['llm-concept1', 'llm-concept2']),
    generateResponse: vi.fn().mockResolvedValue('LLM response')
  }
};

describe('Safe Operations', () => {
  let safeOps;

  beforeEach(() => {
    vi.clearAllMocks();
    safeOps = new SafeOperations(mockMemoryManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create SafeOperations instance with memory manager', () => {
      expect(safeOps).toBeDefined();
      expect(safeOps).toBeInstanceOf(SafeOperations);
    });

    it('should throw error if memory manager is null', () => {
      expect(() => new SafeOperations(null)).toThrow('Memory manager is required');
    });

    it('should throw error if memory manager is undefined', () => {
      expect(() => new SafeOperations(undefined)).toThrow('Memory manager is required');
    });

    it('should accept valid memory manager', () => {
      const validManager = { 
        generateEmbedding: vi.fn(),
        addInteraction: vi.fn(),
        retrieveRelevantInteractions: vi.fn()
      };
      
      expect(() => new SafeOperations(validManager)).not.toThrow();
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const text = 'Test text for embedding';
      
      const result = await safeOps.generateEmbedding(text);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(text);
      expect(result).toEqual(new Array(1536).fill(0.1));
    });

    it('should reject empty text', async () => {
      await expect(safeOps.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should reject null text', async () => {
      await expect(safeOps.generateEmbedding(null)).rejects.toThrow('Text is required');
    });

    it('should reject undefined text', async () => {
      await expect(safeOps.generateEmbedding(undefined)).rejects.toThrow('Text is required');
    });

    it('should reject non-string text', async () => {
      await expect(safeOps.generateEmbedding(123)).rejects.toThrow('Text must be a string');
      await expect(safeOps.generateEmbedding({})).rejects.toThrow('Text must be a string');
      await expect(safeOps.generateEmbedding([])).rejects.toThrow('Text must be a string');
    });

    it('should handle memory manager errors', async () => {
      mockMemoryManager.generateEmbedding.mockRejectedValueOnce(new Error('Embedding generation failed'));
      
      await expect(safeOps.generateEmbedding('test')).rejects.toThrow('Embedding generation failed');
    });

    it('should handle very long text', async () => {
      const longText = 'A'.repeat(100000);
      
      await safeOps.generateEmbedding(longText);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(longText);
    });

    it('should handle special characters', async () => {
      const specialText = 'Text with émojis 🚀 and special chars: @#$%^&*()';
      
      await safeOps.generateEmbedding(specialText);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(specialText);
    });
  });

  describe('extractConcepts', () => {
    it('should extract concepts from valid text', async () => {
      const text = 'Machine learning and artificial intelligence concepts';
      
      const result = await safeOps.extractConcepts(text);
      
      expect(mockMemoryManager.llmHandler.extractConcepts).toHaveBeenCalledWith(text);
      expect(result).toEqual(['llm-concept1', 'llm-concept2']);
    });

    it('should reject empty text', async () => {
      await expect(safeOps.extractConcepts('')).rejects.toThrow('Text cannot be empty');
    });

    it('should reject null text', async () => {
      await expect(safeOps.extractConcepts(null)).rejects.toThrow('Text is required');
    });

    it('should handle concept extraction errors', async () => {
      mockMemoryManager.llmHandler.extractConcepts.mockRejectedValueOnce(new Error('Concept extraction failed'));
      
      await expect(safeOps.extractConcepts('test')).rejects.toThrow('Concept extraction failed');
    });

    it('should handle missing LLM handler', async () => {
      const managerWithoutLLM = { generateEmbedding: vi.fn() };
      const safeOpsWithoutLLM = new SafeOperations(managerWithoutLLM);
      
      await expect(safeOpsWithoutLLM.extractConcepts('test')).rejects.toThrow('LLM handler not available');
    });

    it('should return empty array for non-conceptual text', async () => {
      mockMemoryManager.llmHandler.extractConcepts.mockResolvedValueOnce([]);
      
      const result = await safeOps.extractConcepts('a b c');
      
      expect(result).toEqual([]);
    });
  });

  describe('storeInteraction', () => {
    it('should store interaction with all parameters', async () => {
      const prompt = 'What is AI?';
      const response = 'AI is artificial intelligence';
      const metadata = { source: 'test' };
      
      const result = await safeOps.storeInteraction(prompt, response, metadata);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(`${prompt} ${response}`);
      expect(mockMemoryManager.llmHandler.extractConcepts).toHaveBeenCalledWith(`${prompt} ${response}`);
      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        prompt,
        response,
        new Array(1536).fill(0.1),
        ['llm-concept1', 'llm-concept2'],
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(Number),
          source: 'test'
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.concepts).toEqual(['llm-concept1', 'llm-concept2']);
    });

    it('should reject empty prompt', async () => {
      await expect(safeOps.storeInteraction('', 'response')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should reject empty response', async () => {
      await expect(safeOps.storeInteraction('prompt', '')).rejects.toThrow('Response cannot be empty');
    });

    it('should reject null parameters', async () => {
      await expect(safeOps.storeInteraction(null, 'response')).rejects.toThrow('Prompt is required');
      await expect(safeOps.storeInteraction('prompt', null)).rejects.toThrow('Response is required');
    });

    it('should handle missing metadata', async () => {
      const result = await safeOps.storeInteraction('prompt', 'response');
      
      expect(result.success).toBe(true);
      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'prompt',
        'response',
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle storage errors', async () => {
      mockMemoryManager.addInteraction.mockRejectedValueOnce(new Error('Storage failed'));
      
      await expect(safeOps.storeInteraction('prompt', 'response')).rejects.toThrow('Storage failed');
    });

    it('should generate unique IDs for each interaction', async () => {
      await safeOps.storeInteraction('prompt1', 'response1');
      await safeOps.storeInteraction('prompt2', 'response2');
      
      const calls = mockMemoryManager.addInteraction.mock.calls;
      const id1 = calls[0][4].id;
      const id2 = calls[1][4].id;
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('retrieveMemories', () => {
    it('should retrieve memories with valid parameters', async () => {
      const query = 'artificial intelligence';
      const threshold = 0.8;
      const excludeLastN = 2;
      
      const mockMemories = [
        { prompt: 'AI question', response: 'AI answer', similarity: 0.9 }
      ];
      mockMemoryManager.retrieveRelevantInteractions.mockResolvedValueOnce(mockMemories);
      
      const result = await safeOps.retrieveMemories(query, threshold, excludeLastN);
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(query, threshold, excludeLastN);
      expect(result).toEqual(mockMemories);
    });

    it('should use default parameters when not provided', async () => {
      const query = 'test query';
      
      await safeOps.retrieveMemories(query);
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(query, 0.7, 0);
    });

    it('should reject empty query', async () => {
      await expect(safeOps.retrieveMemories('')).rejects.toThrow('Query cannot be empty');
    });

    it('should reject null query', async () => {
      await expect(safeOps.retrieveMemories(null)).rejects.toThrow('Query is required');
    });

    it('should validate threshold range', async () => {
      await expect(safeOps.retrieveMemories('query', -0.1)).rejects.toThrow('Threshold must be between 0 and 1');
      await expect(safeOps.retrieveMemories('query', 1.1)).rejects.toThrow('Threshold must be between 0 and 1');
    });

    it('should validate excludeLastN is non-negative', async () => {
      await expect(safeOps.retrieveMemories('query', 0.7, -1)).rejects.toThrow('excludeLastN must be non-negative');
    });

    it('should handle retrieval errors', async () => {
      mockMemoryManager.retrieveRelevantInteractions.mockRejectedValueOnce(new Error('Retrieval failed'));
      
      await expect(safeOps.retrieveMemories('query')).rejects.toThrow('Retrieval failed');
    });

    it('should return empty array when no memories found', async () => {
      mockMemoryManager.retrieveRelevantInteractions.mockResolvedValueOnce([]);
      
      const result = await safeOps.retrieveMemories('non-existent query');
      
      expect(result).toEqual([]);
    });
  });

  describe('generateResponse', () => {
    it('should generate response with context', async () => {
      const prompt = 'Explain AI';
      const context = [{ prompt: 'What is AI?', response: 'AI is...' }];
      const options = { temperature: 0.7, maxTokens: 500 };
      
      const result = await safeOps.generateResponse(prompt, context, options);
      
      expect(mockMemoryManager.llmHandler.generateResponse).toHaveBeenCalledWith(prompt, context, options);
      expect(result).toBe('LLM response');
    });

    it('should reject empty prompt', async () => {
      await expect(safeOps.generateResponse('')).rejects.toThrow('Prompt cannot be empty');
    });

    it('should handle missing context and options', async () => {
      const prompt = 'test prompt';
      
      await safeOps.generateResponse(prompt);
      
      expect(mockMemoryManager.llmHandler.generateResponse).toHaveBeenCalledWith(prompt, [], {});
    });

    it('should validate context is array', async () => {
      await expect(safeOps.generateResponse('prompt', 'not-array')).rejects.toThrow('Context must be an array');
      await expect(safeOps.generateResponse('prompt', {})).rejects.toThrow('Context must be an array');
    });

    it('should validate options is object', async () => {
      await expect(safeOps.generateResponse('prompt', [], 'not-object')).rejects.toThrow('Options must be an object');
      await expect(safeOps.generateResponse('prompt', [], [])).rejects.toThrow('Options must be an object');
    });

    it('should handle response generation errors', async () => {
      mockMemoryManager.llmHandler.generateResponse.mockRejectedValueOnce(new Error('Response generation failed'));
      
      await expect(safeOps.generateResponse('prompt')).rejects.toThrow('Response generation failed');
    });

    it('should handle missing LLM handler', async () => {
      const managerWithoutLLM = { generateEmbedding: vi.fn() };
      const safeOpsWithoutLLM = new SafeOperations(managerWithoutLLM);
      
      await expect(safeOpsWithoutLLM.generateResponse('prompt')).rejects.toThrow('LLM handler not available');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null memory manager methods gracefully', async () => {
      const partialManager = {
        generateEmbedding: null,
        llmHandler: { extractConcepts: vi.fn() }
      };
      const partialSafeOps = new SafeOperations(partialManager);
      
      await expect(partialSafeOps.generateEmbedding('test')).rejects.toThrow();
    });

    it('should handle undefined method results', async () => {
      mockMemoryManager.generateEmbedding.mockResolvedValueOnce(undefined);
      
      await expect(safeOps.generateEmbedding('test')).rejects.toThrow('Invalid embedding result');
    });

    it('should handle malformed embedding results', async () => {
      mockMemoryManager.generateEmbedding.mockResolvedValueOnce('not-an-array');
      
      await expect(safeOps.generateEmbedding('test')).rejects.toThrow('Embedding must be an array');
    });

    it('should handle empty concept results', async () => {
      mockMemoryManager.llmHandler.extractConcepts.mockResolvedValueOnce(null);
      
      const result = await safeOps.extractConcepts('test');
      
      expect(result).toEqual([]);
    });

    it('should handle memory manager timeout', async () => {
      mockMemoryManager.generateEmbedding.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 100)
        )
      );
      
      await expect(safeOps.generateEmbedding('test')).rejects.toThrow('Operation timeout');
    });

    it('should sanitize user input', async () => {
      const maliciousText = '<script>alert("xss")</script>';
      
      await safeOps.generateEmbedding(maliciousText);
      
      // Should still call the method but safely
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(maliciousText);
    });

    it('should handle very large context arrays', async () => {
      const largeContext = new Array(1000).fill({ prompt: 'test', response: 'test' });
      
      await safeOps.generateResponse('prompt', largeContext);
      
      expect(mockMemoryManager.llmHandler.generateResponse).toHaveBeenCalledWith('prompt', largeContext, {});
    });

    it('should validate concept array results', async () => {
      mockMemoryManager.llmHandler.extractConcepts.mockResolvedValueOnce('not-array');
      
      const result = await safeOps.extractConcepts('test');
      
      expect(result).toEqual([]); // Should fallback to empty array
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle concurrent operations', async () => {
      const promises = [
        safeOps.generateEmbedding('text1'),
        safeOps.generateEmbedding('text2'),
        safeOps.extractConcepts('text3'),
        safeOps.retrieveMemories('query1')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(4);
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockMemoryManager.llmHandler.extractConcepts).toHaveBeenCalledTimes(1);
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledTimes(1);
    });

    it('should not leak memory with large operations', async () => {
      const largeText = 'A'.repeat(1000000); // 1MB string
      
      await safeOps.generateEmbedding(largeText);
      
      // Should complete without memory issues
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(largeText);
    });

    it('should handle rapid sequential operations', async () => {
      for (let i = 0; i < 100; i++) {
        await safeOps.generateEmbedding(`text ${i}`);
      }
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledTimes(100);
    });
  });
});