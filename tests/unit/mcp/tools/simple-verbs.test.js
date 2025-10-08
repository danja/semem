// tests/unit/mcp/tools/simple-verbs.test.js
// Unit tests for SimpleVerbsService and ZPTStateManager

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimpleVerbsService, ZPTStateManager } from '../../../../src/mcp/tools/simple-verbs.js';

describe('ZPTStateManager Unit Tests', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new ZPTStateManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('State Management', () => {
    it('should initialize with default state', () => {
      expect(stateManager.state).toBeDefined();
      expect(stateManager.state.sessionId).toBeDefined();
      expect(stateManager.state.zoom).toBe('entity');
      expect(stateManager.state.pan).toEqual({});
      expect(stateManager.state.tilt).toBe('keywords');
    });

    it('should update zoom level', async () => {
      await stateManager.setZoom('concept');
      expect(stateManager.state.zoom).toBe('concept');
      expect(stateManager.stateHistory.length).toBe(1);
    });

    it('should update pan position', async () => {
      const newPan = { direction: 'semantic', domain: 'science' };
      await stateManager.setPan(newPan);
      
      expect(stateManager.state.pan).toEqual(newPan);
    });

    it('should update tilt style', async () => {
      await stateManager.setTilt('summary');
      expect(stateManager.state.tilt).toBe('summary');
      expect(stateManager.stateHistory.length).toBe(1);
    });

    it('should reset state to defaults', async () => {
      // Change some state first
      await stateManager.setZoom('concept');
      await stateManager.setPan({ x: 100, y: 200 });
      await stateManager.setTilt('detailed');
      
      // Reset to defaults
      await stateManager.resetState();
      
      expect(stateManager.state.zoom).toBe('entity');
      expect(stateManager.state.pan).toEqual({});
      expect(stateManager.state.tilt).toBe('keywords');
    });
  });

  describe('Session Cache', () => {
    it('should add items to session cache', async () => {
      await stateManager.addToSessionCache('test-1', 'test prompt', 'test response', [0.1, 0.2, 0.3], ['concept1'], {});
      
      expect(stateManager.sessionCache.interactions.size).toBe(1);
      expect(stateManager.sessionCache.interactions.has('test-1')).toBe(true);
      expect(stateManager.sessionCache.concepts.has('concept1')).toBe(true);
    });

    it('should search session cache', async () => {
      // Add test items to cache
      await stateManager.addToSessionCache('test-1', 'machine learning content', 'response 1', [0.9, 0.1, 0.1], ['machine learning'], {});
      await stateManager.addToSessionCache('test-2', 'quantum physics content', 'response 2', [0.1, 0.9, 0.1], ['physics'], {});
      await stateManager.addToSessionCache('test-3', 'biology content', 'response 3', [0.1, 0.1, 0.9], ['biology'], {});
      
      // Search for machine learning related content
      const queryEmbedding = [0.8, 0.1, 0.1]; // Similar to first item
      const results = await stateManager.searchSessionCache('machine learning', queryEmbedding, 5, 0.3);
      
      expect(results.length).toBeGreaterThan(0);
      // Should find the machine learning content with high similarity
      const mlResult = results.find(r => r.id === 'test-1');
      expect(mlResult).toBeDefined();
      expect(mlResult.similarity).toBeGreaterThan(0.3);
    });

    it('should provide cache statistics', async () => {
      // Add some test items
      await stateManager.addToSessionCache('test-1', 'test prompt 1', 'test response 1', [0.1, 0.2], ['concept1'], {});
      await stateManager.addToSessionCache('test-2', 'test prompt 2', 'test response 2', [0.3, 0.4], ['concept2'], {});
      
      const stats = stateManager.getSessionCacheStats();
      expect(stats).toBeDefined();
      expect(stats.interactions).toBe(2);
      expect(stats.embeddings).toBe(2);
      expect(stats.concepts).toBe(2);
      expect(stats.sessionId).toBeDefined();
    });
  });

  describe('State Persistence', () => {
    it('should persist state changes', async () => {
      const previousState = { ...stateManager.state };
      
      // setZoom already calls persistState internally
      await stateManager.setZoom('concept');
      
      expect(stateManager.stateHistory).toHaveLength(1);
      expect(stateManager.stateHistory[0].previous).toEqual(previousState);
    });

    it('should limit history size', async () => {
      // Add many state changes
      for (let i = 0; i < 25; i++) {
        await stateManager.setZoom(i % 2 === 0 ? 'concept' : 'entity');
      }
      
      // Should be limited to maxHistorySize (default 20)
      expect(stateManager.stateHistory.length).toBeLessThanOrEqual(20);
    });
  });
});

describe('SimpleVerbsService Unit Tests', () => {
  let service;
  let mockMemoryManager;
  let mockSparqlHelper;
  let mockConfig;

  beforeEach(() => {
    // Create minimal mocks for dependencies
    mockMemoryManager = {
      store: vi.fn().mockResolvedValue({ id: 'test-id', success: true }),
      search: vi.fn().mockResolvedValue([{ id: 'result-1', content: 'test content', similarity: 0.8 }]),
      llmHandler: {
        generateResponse: vi.fn().mockResolvedValue({
          response: 'Test LLM response',
          usage: { promptTokens: 10, completionTokens: 20 }
        }),
        extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2'])
      },
      embeddingHandler: {
        generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
      }
    };

    mockSparqlHelper = {
      executeQuery: vi.fn().mockResolvedValue({ results: { bindings: [] } }),
      executeUpdate: vi.fn().mockResolvedValue(true)
    };

    mockConfig = {
      get: vi.fn().mockReturnValue('mock-value')
    };

    service = new SimpleVerbsService();
    
    // Manually set up the service without calling initialize
    service.memoryManager = mockMemoryManager;
    service.sparqlHelper = mockSparqlHelper;
    service.config = mockConfig;
    service.stateManager = new ZPTStateManager();
    service.initialized = true;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Service Initialization', () => {
    it('should have required dependencies set up', () => {
      expect(service.memoryManager).toBe(mockMemoryManager);
      expect(service.stateManager).toBeDefined();
      expect(service.stateManager).toBeInstanceOf(ZPTStateManager);
      expect(service.sparqlHelper).toBe(mockSparqlHelper);
      expect(service.config).toBe(mockConfig);
    });

    it('should be marked as initialized', () => {
      expect(service.initialized).toBe(true);
    });
  });

  describe('Method Validation', () => {
    it('should have all expected verb methods', () => {
      expect(typeof service.tell).toBe('function');
      expect(typeof service.ask).toBe('function');
      expect(typeof service.augment).toBe('function');
      expect(typeof service.zoom).toBe('function');
      expect(typeof service.pan).toBe('function');
      expect(typeof service.tilt).toBe('function');
      expect(typeof service.inspect).toBe('function');
      expect(typeof service.remember).toBe('function');
      expect(typeof service.forget).toBe('function');
      expect(typeof service.recall).toBe('function');
    });

    it('should handle tell method calls', async () => {
      // Should return a result object with expected structure
      const result = await service.tell({ content: 'Valid test content' });
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.verb).toBe('tell');
    });

    it('should handle zoom method calls', async () => {
      // Should accept valid zoom levels
      const validLevels = ['entity', 'concept', 'document', 'community'];
      for (const level of validLevels) {
        const result = await service.zoom({ level });
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.level).toBe(level);
      }
    });

    it('should handle tilt method calls', async () => {
      // Should accept valid tilt styles
      const validStyles = ['keywords', 'summary', 'detailed'];
      for (const style of validStyles) {
        const result = await service.tilt({ style });
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.style).toBe(style);
      }
    });

    it('should maintain state consistency across operations', async () => {
      // Perform state changes
      await service.zoom({ level: 'concept' });
      const state1 = service.stateManager.getState();
      expect(state1.zoom).toBe('concept');

      await service.tilt({ style: 'summary' });
      const state2 = service.stateManager.getState();
      expect(state2.zoom).toBe('concept'); // Should remain unchanged
      expect(state2.tilt).toBe('summary');

      await service.pan({ direction: 'temporal', timeRange: '2023' });
      const state3 = service.stateManager.getState();
      expect(state3.zoom).toBe('concept');
      expect(state3.tilt).toBe('summary');
      expect(state3.pan.direction).toBe('temporal');
    });
  });

  describe('Error Handling', () => {

    it('should handle memory manager errors gracefully', async () => {
      // Mock memory manager to throw error
      mockMemoryManager.store.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await service.tell({ content: 'Test content' });
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle inspect method calls', async () => {
      // Test inspect method without complex dependencies
      const result = await service.inspect({ type: 'session' });
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle SPARQL errors gracefully', async () => {
      // Mock SPARQL helper to throw error
      mockSparqlHelper.executeQuery.mockRejectedValueOnce(new Error('SPARQL error'));
      
      const result = await service.inspect({ type: 'system' });
      expect(result).toBeDefined();
      // Should either succeed with partial data or fail gracefully
      expect(typeof result.success).toBe('boolean');
    });
  });
});

describe('Integration Test Placeholder', () => {
  it('should direct users to integration tests', () => {
    const message = `
      For comprehensive integration tests that use live SPARQL store, run:
      INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs.integration.test.js --reporter=verbose
      
      These tests require a SPARQL store running at localhost:3030
    `;
    
    expect(message).toContain('integration tests');
    expect(message).toContain('localhost:3030');
  });
});
