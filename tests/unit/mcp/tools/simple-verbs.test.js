// tests/unit/mcp/tools/simple-verbs.test.js
// Comprehensive tests for SimpleVerbsService and ZPTStateManager

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

// Mock node-fetch to avoid actual network requests
vi.mock('node-fetch', async () => {
  const actual = await vi.importActual('node-fetch');
  
  return {
    ...actual,
    default: vi.fn()
  };
});

// Import fetch after mocking
import fetch from 'node-fetch';

import { SimpleVerbsService, ZPTStateManager } from '../../../../mcp/tools/simple-verbs.js';
import SPARQLStore from '../../../../src/stores/SPARQLStore.js';
import MemoryManager from '../../../../src/MemoryManager.js';
import Config from '../../../../src/Config.js';
import { v4 as uuidv4 } from 'uuid';

// Test configuration for SPARQL endpoint
const SPARQL_ENDPOINT = {
  query: 'http://localhost:3030/test/query',
  update: 'http://localhost:3030/test/update',
  data: 'http://localhost:3030/test/data',
  graphName: 'http://hyperdata.it/content-test',
  user: 'admin',
  password: 'admin123'
};

describe('SimpleVerbsService Integration Tests', () => {
  let service;
  let memoryManager;
  let config;
  let store;

  beforeAll(async () => {
    // Set up test configuration
    config = new Config({
      sparql: SPARQL_ENDPOINT,
      llmProviders: [{
        name: 'test-provider',
        type: 'mock',
        chatModel: 'test-model',
        capabilities: ['chat']
      }],
      embeddingProviders: [{
        name: 'test-embedding',
        type: 'mock',
        embeddingModel: 'test-embedding-model'
      }]
    });

    // Create SPARQL store
    store = new SPARQLStore(SPARQL_ENDPOINT, {
      user: SPARQL_ENDPOINT.user,
      password: SPARQL_ENDPOINT.password,
      graphName: SPARQL_ENDPOINT.graphName,
      dimension: 1536
    });

    // Create mock LLM provider
    const mockLLMProvider = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      generateChat: vi.fn().mockResolvedValue('test response'),
      generateCompletion: vi.fn().mockResolvedValue('concept1, concept2'),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
      generateResponse: vi.fn().mockResolvedValue({
        response: 'test response',
        usage: { promptTokens: 10, completionTokens: 20 }
      })
    };

    // Create memory manager with proper LLM provider
    memoryManager = new MemoryManager({
      llmProvider: mockLLMProvider,
      storage: store,
      chatModel: 'test-model',
      embeddingModel: 'test-embed',
      dimension: 1536
    });
    
    // Mock handlers for testing
    memoryManager.llmHandler = {
      generateResponse: vi.fn().mockResolvedValue({
        response: 'Test LLM response',
        usage: { promptTokens: 10, completionTokens: 20 }
      }),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2'])
    };

    memoryManager.embeddingHandler = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      standardizeEmbedding: vi.fn(embedding => embedding || new Array(1536).fill(0.1))
    };

    // Setup fetch mock before initialization
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(''),
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    };

    // Reset and configure the fetch mock
    fetch.mockReset();
    fetch.mockResolvedValue(mockResponse);

    // Also set up global.fetch for compatibility
    global.fetch = fetch;

    await memoryManager.initialize();
  });

  beforeEach(async () => {
    // Reset fetch mock for each test
    fetch.mockClear();
    
    // Create fresh service instance for each test
    service = new SimpleVerbsService();
    await service.initialize({
      memoryManager,
      sparqlHelper: store.sparqlHelper,
      config
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (store && store.sparqlHelper) {
      try {
        await store.sparqlHelper.executeUpdate(`
          PREFIX semem: <http://purl.org/stuff/semem/>
          DELETE WHERE {
            GRAPH <${SPARQL_ENDPOINT.graphName}> {
              ?s ?p ?o .
              FILTER(CONTAINS(STR(?s), "test-") || CONTAINS(STR(?o), "test-"))
            }
          }
        `);
      } catch (error) {
        console.warn('Cleanup warning:', error.message);
      }
    }
  });

  afterAll(async () => {
    if (memoryManager) {
      await memoryManager.dispose();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with required dependencies', async () => {
      expect(service).toBeDefined();
      expect(service.memoryManager).toBe(memoryManager);
      expect(service.stateManager).toBeDefined();
      expect(service.stateManager).toBeInstanceOf(ZPTStateManager);
    });

    it('should throw error when initialized without required dependencies', async () => {
      const newService = new SimpleVerbsService();
      await expect(newService.initialize({})).rejects.toThrow();
    });
  });

  describe('tell() method', () => {
    it('should store content successfully', async () => {
      const testContent = 'This is test content about machine learning and AI concepts.';
      
      const result = await service.tell({
        content: testContent,
        type: 'interaction',
        metadata: { testId: 'test-tell-1' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.conceptsExtracted).toBeGreaterThan(0);
    });

    it('should handle lazy storage correctly', async () => {
      const testContent = 'Lazy storage test content for machine learning.';
      
      const result = await service.tell({
        content: testContent,
        lazy: true,
        metadata: { testId: 'test-lazy-1' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.status).toBe('lazy');
    });

    it('should extract concepts from content', async () => {
      const testContent = 'Natural language processing and machine learning are core AI technologies.';
      
      const result = await service.tell({
        content: testContent,
        metadata: { testId: 'test-concepts-1' }
      });

      expect(result.success).toBe(true);
      expect(result.conceptsExtracted).toBeGreaterThan(0);
      // Mock should return ['concept1', 'concept2']
      expect(result.conceptsExtracted).toBe(2);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in the LLM handler
      service.memoryManager.llmHandler.extractConcepts.mockRejectedValueOnce(
        new Error('Test LLM error')
      );

      const result = await service.tell({
        content: 'Test content that will cause an error',
        metadata: { testId: 'test-error-1' }
      });

      // Should still succeed but with reduced functionality
      expect(result).toBeDefined();
    });
  });

  describe('ask() method', () => {
    beforeEach(async () => {
      // Pre-populate some test data
      await service.tell({
        content: 'Machine learning is a subset of artificial intelligence.',
        metadata: { testId: 'test-ask-data-1' }
      });
      
      await service.tell({
        content: 'Neural networks are computational models inspired by biological networks.',
        metadata: { testId: 'test-ask-data-2' }
      });
    });

    it('should answer questions using stored context', async () => {
      const question = 'What is machine learning?';
      
      const result = await service.ask({
        question,
        mode: 'standard',
        useContext: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.answer).toBe('Test LLM response'); // From mock
      expect(result.contextUsed).toBeDefined();
    });

    it('should work in hybrid mode with external sources', async () => {
      const question = 'What are the latest developments in AI?';
      
      const result = await service.ask({
        question,
        mode: 'hybrid',
        useWikipedia: true,
        useWikidata: false
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sources).toBeDefined();
    });

    it('should use HyDE enhancement when requested', async () => {
      const question = 'Explain deep learning architectures';
      
      const result = await service.ask({
        question,
        useHyDE: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.hydeEnhanced).toBe(true);
    });

    it('should respect similarity threshold', async () => {
      const question = 'What is quantum computing?';
      
      const result = await service.ask({
        question,
        threshold: 0.9 // Very high threshold
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Should still work but may have less context
    });
  });

  describe('augment() method', () => {
    beforeEach(async () => {
      // Add some test data for augmentation
      await service.tell({
        content: 'Transformer architecture revolutionized natural language processing.',
        metadata: { testId: 'test-augment-data-1' }
      });
    });

    it('should augment content with context', async () => {
      const target = 'Explain attention mechanisms';
      
      const result = await service.augment({
        target,
        operation: 'enrich'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.augmentedContent).toBeDefined();
    });

    it('should summarize content when requested', async () => {
      const target = 'Long content about machine learning that needs summarization...';
      
      const result = await service.augment({
        target,
        operation: 'summarize'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });

    it('should expand content with additional details', async () => {
      const target = 'AI ethics';
      
      const result = await service.augment({
        target,
        operation: 'expand',
        options: { expandBy: 'examples' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.expandedContent).toBeDefined();
    });
  });

  describe('ZPT Navigation Methods', () => {
    describe('zoom() method', () => {
      it('should handle entity-level zoom', async () => {
        const result = await service.zoom({
          level: 'entity',
          query: 'machine learning'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.level).toBe('entity');
        expect(result.elements).toBeDefined();
      });

      it('should handle concept-level zoom', async () => {
        const result = await service.zoom({
          level: 'concept',
          query: 'artificial intelligence'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.level).toBe('concept');
      });

      it('should handle document-level zoom', async () => {
        const result = await service.zoom({
          level: 'document',
          query: 'research papers'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.level).toBe('document');
      });
    });

    describe('pan() method', () => {
      it('should move navigation focus', async () => {
        const panParams = {
          direction: 'semantic',
          distance: 0.5,
          anchor: 'current'
        };
        
        const result = await service.pan(panParams);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.newPosition).toBeDefined();
      });

      it('should handle temporal panning', async () => {
        const result = await service.pan({
          direction: 'temporal',
          distance: 0.3,
          anchor: 'latest'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    describe('tilt() method', () => {
      it('should change presentation style to keywords', async () => {
        const result = await service.tilt({
          style: 'keywords',
          query: 'neural networks'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.style).toBe('keywords');
        expect(result.content).toBeDefined();
      });

      it('should change presentation style to summary', async () => {
        const result = await service.tilt({
          style: 'summary',
          query: 'deep learning'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.style).toBe('summary');
      });

      it('should change presentation style to detailed', async () => {
        const result = await service.tilt({
          style: 'detailed',
          query: 'transformer architecture'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.style).toBe('detailed');
      });
    });
  });

  describe('inspect() method - Enhanced Analytics', () => {
    beforeEach(async () => {
      // Add test data for analytics
      for (let i = 0; i < 5; i++) {
        await service.tell({
          content: `Test interaction ${i} about machine learning and AI concepts.`,
          metadata: { testId: `test-inspect-data-${i}` }
        });
      }
    });

    it('should provide session analytics', async () => {
      const result = await service.inspect({
        what: 'session',
        details: false
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sessionAnalytics).toBeDefined();
      expect(result.sessionAnalytics.overview).toBeDefined();
      expect(result.sessionAnalytics.overview.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(result.sessionAnalytics.memoryUtilization).toBeDefined();
      expect(result.sessionAnalytics.sessionHealth).toBeDefined();
    });

    it('should provide concept analytics', async () => {
      const result = await service.inspect({
        what: 'concepts',
        details: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.conceptAnalytics).toBeDefined();
      expect(result.conceptAnalytics.overview).toBeDefined();
      expect(result.conceptAnalytics.topConcepts).toBeDefined();
      expect(result.conceptAnalytics.distribution).toBeDefined();
    });

    it('should provide comprehensive system analytics', async () => {
      const result = await service.inspect({
        what: 'all',
        details: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.systemHealth).toBeDefined();
      expect(result.systemHealth.overall).toBeDefined();
      expect(result.systemHealth.components).toBeDefined();
      expect(result.systemHealth.componentsHealthy).toBeGreaterThanOrEqual(0);
      expect(result.systemHealth.componentsTotal).toBeGreaterThan(0);
    });

    it('should include recommendations', async () => {
      const result = await service.inspect({
        what: 'all',
        details: true
      });

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle errors in analytics gracefully', async () => {
      // Mock a SPARQL error
      const originalExecuteQuery = service.memoryManager.store.sparqlHelper.executeQuery;
      service.memoryManager.store.sparqlHelper.executeQuery = vi.fn().mockRejectedValue(
        new Error('SPARQL connection error')
      );

      const result = await service.inspect({
        what: 'session'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Should fallback to cache data
      expect(result.sessionAnalytics).toBeDefined();

      // Restore original method
      service.memoryManager.store.sparqlHelper.executeQuery = originalExecuteQuery;
    });
  });

  describe('Memory Management Methods', () => {
    describe('remember() method', () => {
      it('should store important memories', async () => {
        const result = await service.remember({
          content: 'Important research finding about neural plasticity',
          domain: 'research',
          domainId: 'test-research-1',
          importance: 0.9,
          metadata: { category: 'breakthrough' }
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.memoryId).toBeDefined();
        expect(result.importance).toBe(0.9);
      });

      it('should handle different domains', async () => {
        const result = await service.remember({
          content: 'User preference for morning notifications',
          domain: 'user_preferences',
          importance: 0.7
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    describe('forget() method', () => {
      let memoryId;

      beforeEach(async () => {
        const result = await service.remember({
          content: 'Memory to be forgotten',
          domain: 'test',
          metadata: { testId: 'forget-test-1' }
        });
        memoryId = result.memoryId;
      });

      it('should fade memories gradually', async () => {
        const result = await service.forget({
          target: memoryId,
          strategy: 'fade',
          fadeFactor: 0.5
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('fade');
        expect(result.fadeFactor).toBe(0.5);
      });

      it('should remove memories completely', async () => {
        const result = await service.forget({
          target: memoryId,
          strategy: 'remove'
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('remove');
      });
    });

    describe('recall() method', () => {
      beforeEach(async () => {
        // Add some memories to recall
        await service.remember({
          content: 'Machine learning model training completed successfully',
          domain: 'ml_training',
          importance: 0.8,
          metadata: { timestamp: Date.now() - 86400000 } // 1 day ago
        });

        await service.remember({
          content: 'Deep learning architecture optimization results',
          domain: 'ml_training',
          importance: 0.9,
          metadata: { timestamp: Date.now() - 3600000 } // 1 hour ago
        });
      });

      it('should recall relevant memories', async () => {
        const result = await service.recall({
          query: 'machine learning training',
          domains: ['ml_training'],
          maxResults: 5
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.memories).toBeDefined();
        expect(Array.isArray(result.memories)).toBe(true);
      });

      it('should filter by time range', async () => {
        const result = await service.recall({
          query: 'training',
          timeRange: {
            start: Date.now() - 7200000, // 2 hours ago
            end: Date.now()
          },
          maxResults: 10
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });

      it('should respect relevance threshold', async () => {
        const result = await service.recall({
          query: 'completely unrelated topic',
          relevanceThreshold: 0.9,
          maxResults: 5
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        // May return fewer or no results due to high threshold
      });
    });
  });

  describe('System Health Checks', () => {
    it('should check memory health', async () => {
      const health = await service._checkMemoryHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.message).toBeDefined();
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should check SPARQL health', async () => {
      const health = await service._checkSPARQLHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.message).toBeDefined();
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should check embedding health', async () => {
      const health = await service._checkEmbeddingHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.message).toBeDefined();
    });

    it('should check LLM health', async () => {
      const health = await service._checkLLMHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.message).toBeDefined();
    });
  });
});

describe('ZPTStateManager Unit Tests', () => {
  let stateManager;
  let mockMemoryManager;

  beforeEach(() => {
    // Mock memory manager
    mockMemoryManager = {
      addInteraction: vi.fn().mockResolvedValue({ id: 'test-id' }),
      config: { get: vi.fn().mockReturnValue({}) }
    };

    stateManager = new ZPTStateManager(mockMemoryManager);
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
      await stateManager.setZoom('concept', 'test query');
      
      expect(stateManager.state.zoom).toBe('concept');
      expect(stateManager.state.lastQuery).toBe('test query');
    });

    it('should update pan position', async () => {
      const newPan = { x: 10, y: 20 };
      await stateManager.setPan(newPan);
      
      expect(stateManager.state.pan).toEqual(newPan);
    });

    it('should update tilt style', async () => {
      await stateManager.setTilt('summary', 'test query');
      
      expect(stateManager.state.tilt).toBe('summary');
      expect(stateManager.state.lastQuery).toBe('test query');
    });

    it('should reset state to defaults', async () => {
      // Modify state
      await stateManager.setZoom('concept');
      await stateManager.setPan({ x: 100, y: 100 });
      await stateManager.setTilt('detailed');
      
      // Reset
      await stateManager.resetState();
      
      expect(stateManager.state.zoom).toBe('entity');
      expect(stateManager.state.pan).toEqual({});
      expect(stateManager.state.tilt).toBe('keywords');
    });
  });

  describe('Session Cache', () => {
    it('should add items to session cache', async () => {
      const testData = {
        id: 'test-1',
        prompt: 'test prompt',
        response: 'test response',
        embedding: new Array(1536).fill(0.1),
        concepts: ['concept1', 'concept2']
      };

      await stateManager.addToSessionCache(
        testData.id,
        testData.prompt,
        testData.response,
        testData.embedding,
        testData.concepts
      );

      expect(stateManager.sessionCache.interactions.has(testData.id)).toBe(true);
      expect(stateManager.sessionCache.concepts.has('concept1')).toBe(true);
      expect(stateManager.sessionCache.concepts.has('concept2')).toBe(true);
    });

    it('should search session cache', async () => {
      // Add test data
      await stateManager.addToSessionCache(
        'test-1',
        'machine learning algorithms',
        'ML is a subset of AI',
        new Array(1536).fill(0.1),
        ['machine_learning', 'algorithms']
      );

      const results = await stateManager.searchSessionCache(
        'machine learning',
        new Array(1536).fill(0.1),
        5,
        0.1
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should provide cache statistics', () => {
      const stats = stateManager.getSessionCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.interactions).toBeDefined();
      expect(stats.concepts).toBeDefined();
      expect(stats.embeddings).toBeDefined();
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
        await stateManager.persistState({});
      }
      
      expect(stateManager.stateHistory.length).toBeLessThanOrEqual(stateManager.maxHistorySize);
    });
  });
});