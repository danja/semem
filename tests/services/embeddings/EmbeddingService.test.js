import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUtils } from '../../helpers/testUtils.js';
import EmbeddingService from '../../../src/services/embeddings/EmbeddingService.js';

describe('EmbeddingService', () => {
  let embeddingService;
  let mockOllama;
  
  beforeEach(() => {
    // Create mock Ollama provider
    mockOllama = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1))
    };
    
    // Create the embedding service with mocked provider
    embeddingService = new EmbeddingService({
      model: 'test-model',
      dimension: 768
    });
    
    // Replace the Ollama instance with our mock
    embeddingService.ollama = mockOllama;
  });
  
  describe('generateEmbedding', () => {
    it('should call the provider to generate an embedding', async () => {
      const text = 'test text';
      const embedding = await embeddingService.generateEmbedding(text);
      
      expect(mockOllama.generateEmbedding).toHaveBeenCalledWith('test-model', text);
      expect(embedding).toHaveLength(768);
    });
    
    it('should throw an error for invalid input text', async () => {
      await expect(embeddingService.generateEmbedding(null))
        .rejects.toThrowError('Invalid input text');
      
      await expect(embeddingService.generateEmbedding(''))
        .rejects.toThrowError('Invalid input text');
      
      await expect(embeddingService.generateEmbedding(123))
        .rejects.toThrowError('Invalid input text');
    });
    
    it('should handle provider errors', async () => {
      const errorMsg = 'Provider error';
      mockOllama.generateEmbedding = vi.fn().mockRejectedValue(new Error(errorMsg));
      
      await expect(embeddingService.generateEmbedding('test'))
        .rejects.toThrowError(/Provider error/);
    });
    
    it('should handle invalid provider responses', async () => {
      mockOllama.generateEmbedding = vi.fn().mockResolvedValue('not an array');
      
      await expect(embeddingService.generateEmbedding('test'))
        .rejects.toThrowError(/Invalid embedding format/);
    });
  });
  
  describe('validateEmbedding', () => {
    it('should pass validation for valid embeddings', () => {
      const validEmbedding = new Array(768).fill(0.1);
      expect(embeddingService.validateEmbedding(validEmbedding)).toBe(true);
    });
    
    it('should throw for non-array embeddings', () => {
      expect(() => embeddingService.validateEmbedding('not an array'))
        .toThrowError(/Embedding must be an array/);
      
      expect(() => embeddingService.validateEmbedding(123))
        .toThrowError(/Embedding must be an array/);
      
      expect(() => embeddingService.validateEmbedding({}))
        .toThrowError(/Embedding must be an array/);
    });
    
    it('should throw for wrong dimension embeddings', () => {
      const wrongSizeEmbedding = new Array(256).fill(0.1);
      
      expect(() => embeddingService.validateEmbedding(wrongSizeEmbedding))
        .toThrowError(/Embedding dimension mismatch/);
    });
    
    it('should throw for embeddings with invalid values', () => {
      const invalidEmbedding = new Array(768).fill(0.1);
      invalidEmbedding[100] = 'not a number';
      
      expect(() => embeddingService.validateEmbedding(invalidEmbedding))
        .toThrowError(/Embedding must contain only valid numbers/);
      
      const nanEmbedding = new Array(768).fill(0.1);
      nanEmbedding[50] = NaN;
      
      expect(() => embeddingService.validateEmbedding(nanEmbedding))
        .toThrowError(/Embedding must contain only valid numbers/);
    });
  });
  
  describe('standardizeEmbedding', () => {
    it('should return the same embedding if dimensions match', () => {
      const embedding = new Array(768).fill(0.1);
      const result = embeddingService.standardizeEmbedding(embedding);
      
      expect(result).toEqual(embedding);
      expect(result).toHaveLength(768);
    });
    
    it('should pad shorter embeddings with zeros', () => {
      const shortEmbedding = new Array(500).fill(0.2);
      const result = embeddingService.standardizeEmbedding(shortEmbedding);
      
      expect(result).toHaveLength(768);
      expect(result.slice(0, 500)).toEqual(shortEmbedding);
      expect(result.slice(500)).toEqual(new Array(768 - 500).fill(0));
    });
    
    it('should truncate longer embeddings', () => {
      const longEmbedding = new Array(1000).fill(0.3);
      const result = embeddingService.standardizeEmbedding(longEmbedding);
      
      expect(result).toHaveLength(768);
      expect(result).toEqual(longEmbedding.slice(0, 768));
    });
    
    it('should throw for non-array inputs', () => {
      expect(() => embeddingService.standardizeEmbedding('not an array'))
        .toThrowError(/Input must be an array/);
      
      expect(() => embeddingService.standardizeEmbedding(123))
        .toThrowError(/Input must be an array/);
    });
  });
});