/**
 * Simple Verbs Integration Tests
 * Tests that assume SPARQL store is available at localhost:3030
 * 
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs.integration.test.js --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fetch from 'node-fetch';
import { SimpleVerbsService } from '../../../src/mcp/tools/SimpleVerbsService.js';
import { ZptStateManager } from '../../../src/mcp/tools/ZptStateManager.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import MemoryManager from '../../../src/MemoryManager.js';
import Config from '../../../src/Config.js';
import { v4 as uuidv4 } from 'uuid';

// Set up global fetch for integration tests
global.fetch = fetch;
globalThis.fetch = fetch;

// Integration test configuration for SPARQL endpoint
const SPARQL_ENDPOINT = {
  query: 'http://localhost:3030/test/query',
  update: 'http://localhost:3030/test/update',
  data: 'http://localhost:3030/test/data',
  graphName: 'http://hyperdata.it/content-test-integration',
  user: 'admin',
  password: 'admin123'
};

// Skip all tests if INTEGRATION_TESTS is not set
describe.skipIf(!process.env.INTEGRATION_TESTS)('Simple Verbs Integration Tests (Live SPARQL)', () => {
  let service;
  let memoryManager;
  let config;
  let store;
  let mockLLMProvider;
  let testContentIds = [];

  beforeAll(async () => {
    console.log('Setting up Simple Verbs Integration Tests with live SPARQL...');

    // Create mock LLM provider that generates realistic responses
    mockLLMProvider = {
      generateEmbedding: vi.fn().mockImplementation(async (text) => {
        // Generate deterministic but varied embeddings based on text content
        const hash = text.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        return new Array(1536).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
      }),
      generateChat: vi.fn().mockResolvedValue('test response'),
      generateCompletion: vi.fn().mockResolvedValue('concept1, concept2'),
      extractConcepts: vi.fn().mockImplementation(async (text) => {
        // Extract realistic concepts based on text content
        const concepts = [];
        if (text.includes('machine learning') || text.includes('AI')) concepts.push('artificial intelligence', 'machine learning');
        if (text.includes('data') || text.includes('analysis')) concepts.push('data analysis', 'information');
        if (text.includes('quantum') || text.includes('physics')) concepts.push('quantum physics', 'science');
        if (text.includes('climate') || text.includes('environment')) concepts.push('climate change', 'environment');
        return concepts.length > 0 ? concepts.slice(0, 5) : ['general concept', 'information'];
      }),
      generateResponse: vi.fn().mockImplementation(async (prompt, context) => {
        // Generate contextual responses based on prompt content
        let response = 'This is a test response';
        if (prompt.includes('quantum')) {
          response = 'Quantum mechanics describes the behavior of matter and energy at the molecular, atomic, nuclear, and even smaller particle levels.';
        } else if (prompt.includes('climate')) {
          response = 'Climate change refers to long-term shifts in global temperatures and weather patterns, primarily driven by human activities.';
        } else if (prompt.includes('machine learning')) {
          response = 'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.';
        }
        
        return {
          response,
          usage: { promptTokens: prompt.length / 4, completionTokens: response.length / 4 }
        };
      })
    };

    // Create SPARQL store with live endpoint
    const endpoints = {
      query: SPARQL_ENDPOINT.query,
      update: SPARQL_ENDPOINT.update
    };
    
    store = new SPARQLStore(endpoints, {
      user: SPARQL_ENDPOINT.user,
      password: SPARQL_ENDPOINT.password,
      graphName: SPARQL_ENDPOINT.graphName,
      dimension: 1536
    });

    // Create memory manager with live store
    memoryManager = new MemoryManager({
      llmProvider: mockLLMProvider,
      storage: store,
      chatModel: 'test-model',
      embeddingModel: 'test-embed',
      dimension: 1536
    });

    await memoryManager.initialize();
    console.log('✓ Memory manager initialized with live SPARQL store');

    // Clean up any existing test data
    await cleanupTestData();
    console.log('✓ Test environment cleaned up');
  });

  beforeEach(async () => {
    // Create fresh service instance for each test
    service = new SimpleVerbsService();
    await service.initialize({
      memoryManager,
      sparqlHelper: store.sparqlHelper,
      config: new Config()
    });
    
    // Reset mocks for clean state
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any data created during the test
    if (testContentIds.length > 0) {
      for (const id of testContentIds) {
        try {
          await cleanupTestContent(id);
        } catch (error) {
          console.warn(`Warning: Could not clean up test content ${id}:`, error.message);
        }
      }
      testContentIds = [];
    }
  });

  afterAll(async () => {
    // Final cleanup and disposal
    await cleanupTestData();
    if (memoryManager) {
      await memoryManager.dispose();
    }
    console.log('✓ Integration test cleanup completed');
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    if (store && store.sparqlHelper) {
      try {
        await store.sparqlHelper.executeUpdate(`
          PREFIX semem: <http://purl.org/stuff/semem/>
          DELETE WHERE {
            GRAPH <${SPARQL_ENDPOINT.graphName}> {
              ?s ?p ?o .
              FILTER(CONTAINS(STR(?s), "test-") || CONTAINS(STR(?o), "test-") || CONTAINS(STR(?s), "integration-"))
            }
          }
        `);
      } catch (error) {
        console.warn('Warning during cleanup:', error.message);
      }
    }
  }

  // Helper function to clean up specific test content
  async function cleanupTestContent(contentId) {
    if (store && store.sparqlHelper) {
      await store.sparqlHelper.executeUpdate(`
        PREFIX semem: <http://purl.org/stuff/semem/>
        DELETE WHERE {
          GRAPH <${SPARQL_ENDPOINT.graphName}> {
            <${contentId}> ?p ?o .
            ?s ?p <${contentId}> .
          }
        }
      `);
    }
  }

  describe('Service Initialization Integration', () => {
    it('should initialize with live SPARQL store', async () => {
      expect(service).toBeDefined();
      expect(service.memoryManager).toBeDefined();
      expect(service.stateManager).toBeDefined();
      expect(service.sparqlHelper).toBeDefined();
      
      // Test actual SPARQL connectivity
      const healthResult = await store.healthCheck();
      expect(healthResult.healthy).toBe(true);
    });

    it('should handle SPARQL store health check', async () => {
      const result = await service.healthCheck();
      expect(result).toBeDefined();
      expect(result.sparql).toBeDefined();
      expect(result.sparql.healthy).toBe(true);
    });
  });

  describe('Content Storage Integration (tell)', () => {
    it('should store and retrieve content with real SPARQL', async () => {
      const testContent = 'Integration test: Machine learning algorithms can process vast amounts of data to identify patterns and make predictions.';
      
      const result = await service.tell({
        content: testContent,
        type: 'interaction',
        metadata: { source: 'integration-test', testId: 'tell-storage-1' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      testContentIds.push(result.id);

      // Verify content was actually stored in SPARQL
      const searchResults = await store.search(
        await mockLLMProvider.generateEmbedding(testContent),
        5,
        0.1
      );
      
      expect(searchResults.length).toBeGreaterThan(0);
      const stored = searchResults.find(r => r.content && r.content.includes('Machine learning algorithms'));
      expect(stored).toBeDefined();
    });

    it('should extract and store concepts with real SPARQL', async () => {
      const testContent = 'Climate change represents one of the most pressing challenges of our time, requiring immediate action.';
      
      const result = await service.tell({
        content: testContent,
        type: 'document',
        metadata: { source: 'integration-test', testId: 'tell-concepts-1' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      testContentIds.push(result.id);

      // Verify concepts were extracted and stored
      expect(mockLLMProvider.extractConcepts).toHaveBeenCalledWith(testContent);
      
      // Search for content by concepts
      const conceptEmbedding = await mockLLMProvider.generateEmbedding('climate change environment');
      const searchResults = await store.search(conceptEmbedding, 5, 0.3);
      
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should handle lazy storage correctly', async () => {
      const testContent = 'Lazy storage test: Quantum computing leverages quantum mechanical phenomena to process information.';
      
      const result = await service.tell({
        content: testContent,
        lazy: true,
        metadata: { source: 'integration-test', testId: 'tell-lazy-1' }
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe('lazy');
      testContentIds.push(result.id);

      // Verify lazy content is marked properly
      const lazyContent = await store.findLazyContent(10);
      const ourLazy = lazyContent.find(item => item.content && item.content.includes('Quantum computing'));
      expect(ourLazy).toBeDefined();
    });
  });

  describe('Question Answering Integration (ask)', () => {
    it('should answer questions using stored context from SPARQL', async () => {
      // First store some content
      const contextContent = 'Renewable energy sources like solar and wind power are becoming increasingly cost-effective and environmentally friendly.';
      const storeResult = await service.tell({
        content: contextContent,
        type: 'document',
        metadata: { source: 'integration-test', testId: 'ask-context-1' }
      });
      
      testContentIds.push(storeResult.id);

      // Now ask a related question
      const result = await service.ask({
        question: 'What are the benefits of renewable energy?',
        mode: 'stored',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.contextUsed).toBeGreaterThan(0);

      // Verify LLM was called with appropriate context
      expect(mockLLMProvider.generateResponse).toHaveBeenCalled();
    });

    it('should work in hybrid mode with external sources', async () => {
      const result = await service.ask({
        question: 'What is quantum entanglement?',
        mode: 'hybrid',
        limit: 3,
        threshold: 0.5
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.mode).toBe('hybrid');

      // In hybrid mode, should still generate a response even without stored context
      expect(mockLLMProvider.generateResponse).toHaveBeenCalled();
    });
  });

  describe('Content Augmentation Integration (augment)', () => {
    it('should augment content with stored context', async () => {
      // Store relevant context first
      const contextContent = 'Artificial intelligence systems require large datasets for training and continuous learning to improve accuracy.';
      const storeResult = await service.tell({
        content: contextContent,
        type: 'document',
        metadata: { source: 'integration-test', testId: 'augment-context-1' }
      });
      
      testContentIds.push(storeResult.id);

      // Augment related content
      const result = await service.augment({
        content: 'AI models need training data.',
        operation: 'expand',
        contextLimit: 3
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.augmentedContent).toBeDefined();
      expect(result.augmentedContent.length).toBeGreaterThan('AI models need training data.'.length);
      expect(result.contextUsed).toBeGreaterThan(0);
    });

    it('should summarize content when requested', async () => {
      const longContent = 'This is a long piece of content about various topics including technology, science, and innovation. It contains multiple sentences and detailed information that could be condensed.';
      
      const result = await service.augment({
        content: longContent,
        operation: 'summarize',
        targetLength: 50
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.augmentedContent).toBeDefined();
      expect(result.augmentedContent.length).toBeLessThan(longContent.length);
    });
  });

  describe('ZPT Navigation Integration', () => {
    it('should handle zoom operations with state persistence', async () => {
      const result = await service.zoom({
        level: 'concept',
        query: 'machine learning algorithms'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.level).toBe('concept');
      expect(result.zptState).toBeDefined();
      expect(result.zptState.zoom).toBe('concept');
      expect(result.zptState.lastQuery).toBe('machine learning algorithms');

      // Verify state was persisted
      expect(service.stateManager.stateHistory.length).toBeGreaterThan(0);
    });

    it('should handle pan operations with contextual filtering', async () => {
      const result = await service.pan({
        direction: 'temporal',
        timeRange: '2023-2024',
        domain: 'technology'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.zptState.pan.direction).toBe('temporal');
      expect(result.zptState.pan.timeRange).toBe('2023-2024');
      expect(result.zptState.pan.domain).toBe('technology');
    });

    it('should handle tilt operations for presentation changes', async () => {
      const result = await service.tilt({
        style: 'summary'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.style).toBe('summary');
      expect(result.zptState.tilt).toBe('summary');
    });
  });

  describe('Memory Management Integration', () => {
    it('should store and recall important memories', async () => {
      // Store an important memory
      const memoryResult = await service.remember({
        content: 'Important discovery: New quantum algorithm shows 100x speedup for optimization problems.',
        importance: 'high',
        domain: 'quantum-computing',
        tags: ['breakthrough', 'optimization', 'algorithm']
      });

      expect(memoryResult).toBeDefined();
      expect(memoryResult.success).toBe(true);
      testContentIds.push(memoryResult.id);

      // Recall memories related to quantum computing
      const recallResult = await service.recall({
        query: 'quantum optimization algorithms',
        domain: 'quantum-computing',
        limit: 5
      });

      expect(recallResult).toBeDefined();
      expect(recallResult.success).toBe(true);
      expect(recallResult.memories.length).toBeGreaterThan(0);
      
      const relevantMemory = recallResult.memories.find(m => 
        m.content && m.content.includes('quantum algorithm')
      );
      expect(relevantMemory).toBeDefined();
    });

    it('should handle memory fading operations', async () => {
      // Store a memory
      const memoryResult = await service.remember({
        content: 'Test memory for fading: Temporary information about outdated technology.',
        importance: 'low',
        domain: 'test'
      });

      testContentIds.push(memoryResult.id);

      // Fade the memory gradually
      const fadeResult = await service.forget({
        target: memoryResult.id,
        method: 'fade',
        intensity: 0.5
      });

      expect(fadeResult).toBeDefined();
      expect(fadeResult.success).toBe(true);
      expect(fadeResult.method).toBe('fade');
    });
  });

  describe('System Health and Analytics Integration', () => {
    it('should provide comprehensive system analytics', async () => {
      // Store some test data first
      await service.tell({
        content: 'Analytics test data: Machine learning in healthcare applications.',
        metadata: { source: 'integration-test', testId: 'analytics-1' }
      });

      const result = await service.inspect({
        type: 'system',
        includeRecommendations: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.analytics).toBeDefined();
      expect(result.analytics.system).toBeDefined();
      expect(result.analytics.system.health).toBeDefined();
      
      // Verify SPARQL health is included
      expect(result.analytics.system.health.sparql).toBeDefined();
      expect(result.analytics.system.health.sparql.healthy).toBe(true);
    });

    it('should provide session analytics with real data', async () => {
      // Perform some operations to generate session data
      await service.tell({ content: 'Session test: AI research progress.' });
      await service.ask({ question: 'What is AI research?' });
      await service.zoom({ level: 'entity' });

      const result = await service.inspect({
        type: 'session',
        timeRange: '1h'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.analytics.session).toBeDefined();
      expect(result.analytics.session.interactions).toBeGreaterThan(0);
      expect(result.analytics.session.zptOperations).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience Integration', () => {
    it('should handle SPARQL temporary failures gracefully', async () => {
      // Simulate a scenario where SPARQL might have issues
      // but the system should still respond appropriately
      const result = await service.ask({
        question: 'What happens during SPARQL issues?',
        mode: 'stored',
        fallback: true
      });

      expect(result).toBeDefined();
      // Should either succeed or fail gracefully with meaningful error
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should maintain state consistency during operations', async () => {
      // Perform multiple state-changing operations
      await service.zoom({ level: 'concept' });
      await service.pan({ direction: 'semantic' });
      await service.tilt({ style: 'detailed' });

      const finalState = service.stateManager.getState();
      expect(finalState.zoom).toBe('concept');
      expect(finalState.pan.direction).toBe('semantic');
      expect(finalState.tilt).toBe('detailed');
      expect(finalState.sessionId).toBeDefined();
    });
  });
});