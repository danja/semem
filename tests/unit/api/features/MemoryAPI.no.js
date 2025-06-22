// tests/unit/api/features/MemoryAPI.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MemoryAPI from '../../../../src/api/features/MemoryAPI.js';
import { testUtils } from '../../../helpers/testUtils.js';

// Mock UUID for predictable test output
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}));

describe('MemoryAPI', () => {
  let api;
  let registry;
  let mockMemoryManager;
  
  beforeEach(() => {
    // Create mock memory manager
    mockMemoryManager = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
      addInteraction: vi.fn().mockResolvedValue(),
      retrieveRelevantInteractions: vi.fn().mockResolvedValue([
        {
          interaction: {
            id: 'test-id-1',
            prompt: 'Test prompt 1',
            output: 'Test output 1',
            concepts: ['concept1'],
            timestamp: Date.now() - 1000,
            accessCount: 2
          },
          similarity: 0.85
        },
        {
          interaction: {
            id: 'test-id-2',
            prompt: 'Test prompt 2',
            output: 'Test output 2',
            concepts: ['concept2'],
            timestamp: Date.now(),
            accessCount: 1
          },
          similarity: 0.75
        }
      ])
    };
    
    // Create mock registry
    registry = {
      get: vi.fn().mockReturnValue(mockMemoryManager)
    };
    
    // Initialize API with mock registry
    api = new MemoryAPI({
      registry,
      similarityThreshold: 0.7,
      defaultLimit: 5
    });
  });
  
  afterEach(async () => {
    // Clean up after each test
    if (api.initialized) {
      try {
        await api.shutdown();
      } catch (error) {
        // Ignore shutdown errors during cleanup
      }
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with provided config', async () => {
      await api.initialize();
      
      expect(api.initialized).toBeTruthy();
      expect(api.similarityThreshold).toBe(0.7);
      expect(api.defaultLimit).toBe(5);
      expect(registry.get).toHaveBeenCalledWith('memory');
      expect(api.memoryManager).toBe(mockMemoryManager);
    });
    
    it('should throw if registry is not provided', async () => {
      api = new MemoryAPI({});
      
      await expect(api.initialize())
        .rejects.toThrow('Registry is required for MemoryAPI');
    });
    
    it('should throw if memory manager is not found', async () => {
      const failRegistry = {
        get: vi.fn().mockImplementation(() => {
          throw new Error('Memory manager not found');
        })
      };
      
      api = new MemoryAPI({ registry: failRegistry });
      
      await expect(api.initialize())
        .rejects.toThrow('Memory manager not found');
    });
  });
  
  describe('Operation Execution', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should execute store operation', async () => {
      const params = {
        prompt: 'Test prompt',
        response: 'Test response',
        metadata: { tag: 'test' }
      };
      
      const result = await api.executeOperation('store', params);
      
      expect(result.id).toBe('test-uuid-123');
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      expect(result.success).toBeTruthy();
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(
        'Test prompt Test response'
      );
      expect(mockMemoryManager.extractConcepts).toHaveBeenCalledWith(
        'Test prompt Test response'
      );
      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'Test prompt',
        'Test response',
        expect.any(Array),
        ['concept1', 'concept2'],
        expect.objectContaining({ 
          id: 'test-uuid-123',
          tag: 'test'
        })
      );
    });
    
    it('should execute search operation', async () => {
      const params = {
        query: 'Test search',
        threshold: 0.8,
        limit: 3
      };
      
      const result = await api.executeOperation('search', params);
      
      expect(result.results.length).toBe(2);
      expect(result.count).toBe(2);
      expect(result.results[0].id).toBe('test-id-1');
      expect(result.results[0].similarity).toBe(0.85);
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(
        'Test search', 0.8, 0, 3
      );
    });
    
    it('should execute embedding operation', async () => {
      const params = {
        text: 'Test text for embedding',
        model: 'custom-model'
      };
      
      const result = await api.executeOperation('embedding', params);
      
      expect(result.embedding.length).toBe(1536);
      expect(result.model).toBe('custom-model');
      expect(result.dimension).toBe(1536);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(
        'Test text for embedding', 'custom-model'
      );
    });
    
    it('should execute concepts operation', async () => {
      const params = {
        text: 'Test text for concept extraction'
      };
      
      const result = await api.executeOperation('concepts', params);
      
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      expect(result.text).toBe('Test text for concept extraction');
      
      expect(mockMemoryManager.extractConcepts).toHaveBeenCalledWith(
        'Test text for concept extraction'
      );
    });
    
    it('should throw for unknown operation', async () => {
      await expect(api.executeOperation('unknown', {}))
        .rejects.toThrow('Unknown operation: unknown');
    });
  });
  
  describe('Store Interaction', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should store an interaction', async () => {
      const result = await api.storeInteraction({
        prompt: 'Test prompt',
        response: 'Test response'
      });
      
      expect(result.id).toBe('test-uuid-123');
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      expect(result.success).toBeTruthy();
      
      expect(mockMemoryManager.addInteraction).toHaveBeenCalled();
    });
    
    it('should require prompt and response', async () => {
      await expect(api.storeInteraction({
        prompt: 'Test prompt'
      })).rejects.toThrow('Prompt and response are required');
      
      await expect(api.storeInteraction({
        response: 'Test response'
      })).rejects.toThrow('Prompt and response are required');
    });
    
    it('should handle errors during storage', async () => {
      mockMemoryManager.addInteraction.mockRejectedValueOnce(
        new Error('Storage error')
      );
      
      await expect(api.storeInteraction({
        prompt: 'Test prompt',
        response: 'Test response'
      })).rejects.toThrow('Storage error');
    });
  });
  
  describe('Retrieve Interactions', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should retrieve interactions', async () => {
      const result = await api.retrieveInteractions({
        query: 'Test search',
        threshold: 0.8,
        limit: 3
      });
      
      expect(result.results.length).toBe(2);
      expect(result.count).toBe(2);
      expect(result.results[0].prompt).toBe('Test prompt 1');
      expect(result.results[0].output).toBe('Test output 1');
      expect(result.results[0].similarity).toBe(0.85);
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(
        'Test search', 0.8, 0, 3
      );
    });
    
    it('should use default threshold and limit if not provided', async () => {
      await api.retrieveInteractions({
        query: 'Test search'
      });
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(
        'Test search', 0.7, 0, 5
      );
    });
    
    it('should require query parameter', async () => {
      await expect(api.retrieveInteractions({}))
        .rejects.toThrow('Query is required');
    });
    
    it('should handle errors during retrieval', async () => {
      mockMemoryManager.retrieveRelevantInteractions.mockRejectedValueOnce(
        new Error('Retrieval error')
      );
      
      await expect(api.retrieveInteractions({
        query: 'Test search'
      })).rejects.toThrow('Retrieval error');
    });
    
    it('should format the results correctly', async () => {
      // Add an interaction with missing fields to test defaults
      mockMemoryManager.retrieveRelevantInteractions.mockResolvedValueOnce([
        {
          interaction: {
            prompt: 'Test prompt missing fields'
          },
          similarity: 0.9
        }
      ]);
      
      const result = await api.retrieveInteractions({
        query: 'Test search'
      });
      
      expect(result.results[0].id).toBe('test-uuid-123');
      expect(result.results[0].prompt).toBe('Test prompt missing fields');
      expect(result.results[0].output).toBeUndefined();
      expect(result.results[0].concepts).toEqual([]);
      expect(result.results[0].timestamp).toBeDefined();
      expect(result.results[0].accessCount).toBe(1);
      expect(result.results[0].similarity).toBe(0.9);
    });
  });
  
  describe('Generate Embedding', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should generate an embedding', async () => {
      const result = await api.generateEmbedding({
        text: 'Test text',
        model: 'custom-model'
      });
      
      expect(result.embedding.length).toBe(1536);
      expect(result.model).toBe('custom-model');
      expect(result.dimension).toBe(1536);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(
        'Test text', 'custom-model'
      );
    });
    
    it('should use default model if not provided', async () => {
      const result = await api.generateEmbedding({
        text: 'Test text'
      });
      
      expect(result.model).toBe('default');
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(
        'Test text', undefined
      );
    });
    
    it('should require text parameter', async () => {
      await expect(api.generateEmbedding({}))
        .rejects.toThrow('Text is required');
    });
    
    it('should handle errors during embedding generation', async () => {
      mockMemoryManager.generateEmbedding.mockRejectedValueOnce(
        new Error('Embedding error')
      );
      
      await expect(api.generateEmbedding({
        text: 'Test text'
      })).rejects.toThrow('Embedding error');
    });
  });
  
  describe('Extract Concepts', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should extract concepts from text', async () => {
      const result = await api.extractConcepts({
        text: 'Test text for concept extraction'
      });
      
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      expect(result.text).toBe('Test text for concept extraction');
      
      expect(mockMemoryManager.extractConcepts).toHaveBeenCalledWith(
        'Test text for concept extraction'
      );
    });
    
    it('should require text parameter', async () => {
      await expect(api.extractConcepts({}))
        .rejects.toThrow('Text is required');
    });
    
    it('should handle errors during concept extraction', async () => {
      mockMemoryManager.extractConcepts.mockRejectedValueOnce(
        new Error('Concept extraction error')
      );
      
      await expect(api.extractConcepts({
        text: 'Test text'
      })).rejects.toThrow('Concept extraction error');
    });
  });
  
  describe('Metrics', () => {
    beforeEach(async () => {
      await api.initialize();
    });
    
    it('should return metrics', async () => {
      // Force emit some metrics
      api._emitMetric('memory.store.count', 5);
      api._emitMetric('memory.search.errors', 2);
      
      // Mock the _getMetricValue method to return meaningful values
      api._getMetricValue = vi.fn().mockImplementation((name) => {
        if (name === 'memory.store.count') return 5;
        if (name === 'memory.search.errors') return 2;
        return 0;
      });
      
      const metrics = await api.getMetrics();
      
      expect(metrics.operations.store.count).toBe(5);
      expect(metrics.operations.search.errors).toBe(2);
      expect(metrics.status).toBe('active');
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});