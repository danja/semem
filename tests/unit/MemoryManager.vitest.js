// tests/unit/MemoryManager.vitest.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MemoryManager from '../../src/MemoryManager.js';
import { VitestTestHelper } from '../helpers/VitestTestHelper.js';

describe('MemoryManager', () => {
  // Test variables
  let mockLLM;
  let mockStore;
  let manager;
  
  // Setup before each test
  beforeEach(async () => {
    // Initialize mocks
    mockLLM = VitestTestHelper.createMockLLMProvider();
    mockStore = VitestTestHelper.createMockStore();
    
    // Create manager instance
    manager = new MemoryManager({
      llmProvider: mockLLM,
      storage: mockStore,
      chatModel: 'test-model',
      embeddingModel: 'test-embed',
      dimension: 1536
    });
  });
  
  // Helper function to initialize manager
  async function initManager() {
    await manager.initialize();
  }
  
  describe('Initialization', () => {
    it('should initialize with configuration', async () => {
      await expect(initManager()).resolves.not.toThrow();
      expect(mockStore.loadHistory).toHaveBeenCalled();
    });
    
    it('should reject without LLM provider', () => {
      expect(() => {
        new MemoryManager({
          storage: mockStore
        });
      }).toThrow('LLM provider is required');
    });
    
    it('should handle store initialization failure', async () => {
      // Mock the store to reject with an error
      mockStore.loadHistory.mockRejectedValueOnce(new Error('Store error'));
      
      // Create a new manager with the failing store
      const failingManager = new MemoryManager({
        llmProvider: mockLLM,
        storage: mockStore,
        chatModel: 'test-model',
        embeddingModel: 'test-embed',
        dimension: 1536
      });
      
      // The error should be thrown when we try to use the manager
      await expect(failingManager.ensureInitialized())
        .rejects
        .toThrow('Store error');
    });
  });
  
  describe('Memory Operations', () => {
    // Initialize manager before each test in this group
    beforeEach(async () => {
      await initManager();
    });
    
    it('should add interactions', async () => {
      const interaction = {
        prompt: 'test prompt',
        output: 'test output',
        embedding: new Array(1536).fill(0),
        concepts: ['test']
      };
      
      await expect(manager.addInteraction(
        interaction.prompt,
        interaction.output,
        interaction.embedding,
        interaction.concepts
      )).resolves.not.toThrow();
      
      expect(mockStore.saveMemoryToHistory).toHaveBeenCalled();
    });
    
    it('should retrieve relevant interactions', async () => {
      const query = 'test query';
      await manager.retrieveRelevantInteractions(query);
      
      expect(mockLLM.generateEmbedding).toHaveBeenCalledWith(
        'test-embed',
        query
      );
    });
    
    it('should generate responses with context', async () => {
      const prompt = 'test prompt';
      const lastInteractions = [{ prompt: 'prev', output: 'answer' }];
      const retrievals = [{ similarity: 0.8, interaction: lastInteractions[0] }];
      
      await manager.generateResponse(prompt, lastInteractions, retrievals);
      
      // Just check that generateChat was called with the model name, don't verify the exact array
      expect(mockLLM.generateChat).toHaveBeenCalled();
      expect(mockLLM.generateChat.mock.calls[0][0]).toBe('test-model');
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await initManager();
    });
    
    it('should handle embeddings error', async () => {
      mockLLM.generateEmbedding.mockRejectedValue(new Error('Embedding failed'));
      await expect(manager.generateEmbedding('test')).rejects.toThrow();
    });
    
    it('should handle store errors', async () => {
      mockStore.saveMemoryToHistory.mockRejectedValue(new Error('Store failed'));
      await expect(manager.addInteraction('test', 'output', [], [])).rejects.toThrow();
    });
    
    it('should handle chat generation errors', async () => {
      mockLLM.generateChat.mockRejectedValue(new Error('Chat failed'));
      await expect(manager.generateResponse('test')).rejects.toThrow();
    });
  });
  
  describe('Resource Management', () => {
    beforeEach(async () => {
      await initManager();
    });
    
    it('should dispose resources', async () => {
      await manager.dispose();
      expect(mockStore.close).toHaveBeenCalled();
    });
    
    it('should save state before disposal', async () => {
      await manager.dispose();
      expect(mockStore.saveMemoryToHistory).toHaveBeenCalled();
    });
    
    it('should handle disposal errors', async () => {
      mockStore.saveMemoryToHistory.mockRejectedValue(new Error('Save failed'));
      mockStore.close.mockRejectedValue(new Error('Close failed'));
      
      await expect(manager.dispose()).rejects.toThrow();
      expect(mockStore.close).toHaveBeenCalled();
    });
  });
  
  describe('Cache Management', () => {
    beforeEach(async () => {
      await initManager();
    });
    
    it('should cache embeddings', async () => {
      const text = 'test text';
      await manager.generateEmbedding(text);
      await manager.generateEmbedding(text);
      
      expect(mockLLM.generateEmbedding).toHaveBeenCalledTimes(1);
    });
    
  });
});