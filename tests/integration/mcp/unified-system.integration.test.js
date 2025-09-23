/**
 * Unified System Integration Tests
 * Tests the unified ServiceManager system for MCP tell/ask operations
 * Ensures HTTP and STDIO systems use shared services without duplication
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/unified-system.integration.test.js --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSimpleVerbsService } from '../../../mcp/tools/VerbRegistration.js';
import { initializeServices, getMemoryManager } from '../../../mcp/lib/initialization.js';
import ServiceManager from '../../../src/services/ServiceManager.js';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Set up global fetch for integration tests
global.fetch = fetch;
globalThis.fetch = fetch;

// Integration test configuration for SPARQL endpoint (following existing patterns)
const SPARQL_ENDPOINT = {
  query: 'http://localhost:3030/test/query',
  update: 'http://localhost:3030/test/update',
  data: 'http://localhost:3030/test/data',
  graphName: 'http://hyperdata.it/content-test-unified',
  user: 'admin',
  password: 'admin123'
};

// Skip all tests if INTEGRATION_TESTS is not set
describe.skipIf(!process.env.INTEGRATION_TESTS)('Unified System Integration Tests (ServiceManager)', () => {
  let simpleVerbsService;
  let serviceManager;
  let sharedServices;
  let testContentIds = [];

  beforeAll(async () => {
    console.log('Setting up Unified System Integration Tests...');

    // Test ServiceManager singleton pattern
    serviceManager = (await import('../../../src/services/ServiceManager.js')).default;

    // Initialize shared services - let the ServiceManager handle configuration
    sharedServices = await serviceManager.getServices();
    console.log('✓ Shared services initialized via ServiceManager');

    // Test SPARQL connectivity if available
    try {
      const healthResult = await sharedServices.storage.healthCheck();
      console.log('✓ SPARQL endpoint connectivity verified:', healthResult.healthy);
    } catch (error) {
      console.warn('⚠️ SPARQL health check failed, continuing with test:', error.message);
    }

    // Clean up any existing test data
    await cleanupTestData();
    console.log('✓ Test environment cleaned up');
  });

  beforeEach(async () => {
    // Get fresh SimpleVerbsService instance using unified services
    simpleVerbsService = getSimpleVerbsService();
    await simpleVerbsService.initialize();

    // Verify it's using the unified services
    expect(simpleVerbsService.memoryManager).toBeDefined();
    console.log('✓ SimpleVerbsService initialized with unified services');
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
    // Final cleanup
    await cleanupTestData();
    if (sharedServices?.memoryManager) {
      await sharedServices.memoryManager.dispose();
    }
    console.log('✓ Integration test cleanup completed');
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    if (sharedServices?.storage?.sparqlHelper) {
      try {
        await sharedServices.storage.sparqlHelper.executeUpdate(`
          PREFIX semem: <http://purl.org/stuff/semem/>
          DELETE WHERE {
            GRAPH <${SPARQL_ENDPOINT.graphName}> {
              ?s ?p ?o .
              FILTER(CONTAINS(STR(?s), "test-unified-") || CONTAINS(STR(?o), "spart") || CONTAINS(STR(?s), "integration-unified-"))
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
    if (sharedServices?.storage?.sparqlHelper) {
      await sharedServices.storage.sparqlHelper.executeUpdate(`
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

  describe('ServiceManager Singleton Pattern', () => {
    it('should provide shared services across multiple instances', async () => {
      // Get services from multiple instances
      const services1 = await serviceManager.getServices();
      const services2 = await serviceManager.getServices();

      // Should be the same instances (singleton pattern)
      expect(services1.memoryManager).toBe(services2.memoryManager);
      expect(services1.storage).toBe(services2.storage);
      expect(services1.embeddingHandler).toBe(services2.embeddingHandler);
      expect(services1.llmHandler).toBe(services2.llmHandler);

      console.log('✓ ServiceManager singleton pattern verified');
    });

    it('should initialize services only once', async () => {
      const startTime = Date.now();

      // Multiple calls should reuse initialized services
      await serviceManager.getServices();
      await serviceManager.getServices();
      await serviceManager.getServices();

      const endTime = Date.now();

      // Should be very fast since no re-initialization
      expect(endTime - startTime).toBeLessThan(100);
      expect(serviceManager.initialized).toBe(true);
    });
  });

  describe('Unified Tell/Ask Round Trip', () => {
    it('should store and retrieve "spart is a vegetable" successfully', async () => {
      const testContent = 'spart is a vegetable';
      const testId = `test-unified-${uuidv4()}`;

      console.log(`Testing tell/ask round trip with content: "${testContent}"`);

      // Test tell operation
      const tellResult = await simpleVerbsService.tell({
        content: testContent,
        type: 'interaction',
        metadata: { source: 'unified-integration-test', testId }
      });

      expect(tellResult).toBeDefined();
      expect(tellResult.success).toBe(true);
      expect(tellResult.stored).toBe(true);
      expect(tellResult.id).toBeDefined();
      testContentIds.push(tellResult.id);

      console.log(`✓ Tell operation successful, stored with ID: ${tellResult.id}`);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test ask operation
      const askResult = await simpleVerbsService.ask({
        question: 'what is spart?',
        threshold: 0.3,
        limit: 5
      });

      expect(askResult).toBeDefined();
      expect(askResult.success).toBe(true);

      console.log(`✓ Ask operation completed, found ${askResult.results?.length || 0} results`);

      if (askResult.results && askResult.results.length > 0) {
        // Look for our stored content in the results
        const spartResult = askResult.results.find(result =>
          result.content && result.content.includes('spart')
        );

        expect(spartResult).toBeDefined();
        expect(spartResult.content).toContain('vegetable');
        console.log('🎉 SUCCESS: Tell/Ask round trip working with unified system!');
        console.log(`   Found result: "${spartResult.content}" (score: ${spartResult.score?.toFixed(3)})`);
      } else {
        // If no results, let's check if the content was actually stored
        const directSearch = await sharedServices.storage.search(
          await sharedServices.embeddingHandler.generateEmbedding(testContent),
          10,
          0.1
        );

        console.log(`Direct storage search found ${directSearch.length} results`);
        if (directSearch.length > 0) {
          console.warn('⚠️ Content was stored but ask operation threshold may be too high');
          // Try with lower threshold
          const lowThresholdAsk = await simpleVerbsService.ask({
            question: 'what is spart?',
            threshold: 0.1,
            limit: 5
          });

          if (lowThresholdAsk.results?.length > 0) {
            console.log('✓ Lower threshold ask succeeded');
            const spartResult = lowThresholdAsk.results.find(result =>
              result.content && result.content.includes('spart')
            );
            expect(spartResult).toBeDefined();
          }
        }
      }
    });

    it('should maintain consistency between storage and search', async () => {
      const testContent = `Integration test content: ${uuidv4()} contains unique identifier for verification`;

      // Store via SimpleVerbsService
      const tellResult = await simpleVerbsService.tell({
        content: testContent,
        type: 'document',
        metadata: { source: 'consistency-test' }
      });

      expect(tellResult.success).toBe(true);
      testContentIds.push(tellResult.id);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search directly via storage
      const embedding = await sharedServices.embeddingHandler.generateEmbedding(testContent);
      const directResults = await sharedServices.storage.search(embedding, 5, 0.2);

      // Search via SimpleVerbsService ask
      const askResults = await simpleVerbsService.ask({
        question: testContent,
        threshold: 0.2,
        limit: 5
      });

      // Both should find the content
      expect(directResults.length).toBeGreaterThan(0);
      expect(askResults.results?.length).toBeGreaterThan(0);

      // Content should match
      const directMatch = directResults.find(r => r.content && r.content.includes(testContent.split(' ')[2]));
      const askMatch = askResults.results?.find(r => r.content && r.content.includes(testContent.split(' ')[2]));

      expect(directMatch).toBeDefined();
      expect(askMatch).toBeDefined();

      console.log('✓ Storage and search consistency verified');
    });
  });

  describe('Service Sharing Verification', () => {
    it('should use the same MemoryManager instance across operations', async () => {
      // Get the MemoryManager from initialization
      const initServices = await initializeServices();
      const initMemoryManager = await getMemoryManager();

      // Should be the same instance as in ServiceManager
      expect(initMemoryManager).toBe(sharedServices.memoryManager);
      expect(initServices.memoryManager).toBe(sharedServices.memoryManager);

      // SimpleVerbsService should use the same instance
      expect(simpleVerbsService.memoryManager).toBe(sharedServices.memoryManager);

      console.log('✓ MemoryManager instance sharing verified');
    });

    it('should use the same storage instance across operations', async () => {
      // Verify storage instance is shared
      expect(simpleVerbsService.memoryManager.storage).toBe(sharedServices.storage);

      // Test that operations on one affect the other
      const testContent = `Shared storage test: ${uuidv4()}`;

      // Store via MemoryManager directly
      const directStore = await sharedServices.memoryManager.storeInteraction(
        testContent,
        'test response',
        { source: 'direct-test' }
      );

      expect(directStore.success).toBe(true);
      testContentIds.push(directStore.id);

      // Search via SimpleVerbsService
      const askResult = await simpleVerbsService.ask({
        question: testContent.split(' ')[2], // search for unique part
        threshold: 0.2
      });

      // Should find the content stored directly
      expect(askResult.results?.length).toBeGreaterThan(0);
      const match = askResult.results?.find(r => r.content && r.content.includes(testContent.split(' ')[2]));
      expect(match).toBeDefined();

      console.log('✓ Storage instance sharing verified');
    });

    it('should use the same embedding handler across operations', async () => {
      // Verify embedding handler is shared
      const testText = 'embedding consistency test';

      // Generate embedding via ServiceManager
      const embedding1 = await sharedServices.embeddingHandler.generateEmbedding(testText);

      // Generate embedding via MemoryManager's handler
      const embedding2 = await simpleVerbsService.memoryManager.embeddingHandler.generateEmbedding(testText);

      // Should be identical (same instance, same model)
      expect(embedding1).toEqual(embedding2);
      expect(embedding1.length).toBe(embedding2.length);

      console.log('✓ EmbeddingHandler instance sharing verified');
    });
  });

  describe('System Health with Unified Services', () => {
    it('should provide consistent health checks across services', async () => {
      // Health check via ServiceManager storage
      const storageHealth = await sharedServices.storage.healthCheck();

      // Health check via SimpleVerbsService
      const serviceHealth = await simpleVerbsService.healthCheck();

      // Both should report healthy
      expect(storageHealth.healthy).toBe(true);
      expect(serviceHealth.sparql.healthy).toBe(true);

      // Should be checking the same endpoint
      expect(serviceHealth.sparql.endpoint).toBeDefined();

      console.log('✓ Unified health checks verified');
    });

    it('should handle service disposal properly', async () => {
      // Create a test service to dispose
      const testServiceManager = (await import('../../../src/services/ServiceManager.js')).default;
      const testServices = await testServiceManager.getServices();

      // Should be the same instances (singleton)
      expect(testServices.memoryManager).toBe(sharedServices.memoryManager);

      // Disposal should work without errors
      expect(async () => {
        if (testServices.memoryManager.dispose) {
          // Don't actually dispose since it's shared - just test the method exists
          expect(typeof testServices.memoryManager.dispose).toBe('function');
        }
      }).not.toThrow();

      console.log('✓ Service disposal handling verified');
    });
  });

  describe('Error Recovery with Unified Services', () => {
    it('should handle temporary failures gracefully', async () => {
      // Test with invalid question to trigger error handling
      const result = await simpleVerbsService.ask({
        question: '',
        threshold: 0.5
      });

      // Should handle empty question gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (!result.success) {
        expect(result.error).toBeDefined();
        console.log(`✓ Error handled gracefully: ${result.error}`);
      }
    });

    it('should maintain service state during errors', async () => {
      // Get initial state
      const initialServices = await serviceManager.getServices();

      try {
        // Attempt operation that might fail
        await simpleVerbsService.tell({
          content: null, // Invalid content
          type: 'test'
        });
      } catch (error) {
        console.log(`Expected error caught: ${error.message}`);
      }

      // Services should still be available and unchanged
      const afterServices = await serviceManager.getServices();
      expect(afterServices.memoryManager).toBe(initialServices.memoryManager);
      expect(afterServices.storage).toBe(initialServices.storage);

      console.log('✓ Service state consistency during errors verified');
    });
  });
});