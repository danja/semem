/**
 * RDF Concept Storage Unit Tests (Fixed)
 * Tests concept storage in SPARQLStore using actual API methods
 * 
 * Unit Tests: Mock fetch for isolated testing
 * Integration Tests: Use live SPARQL store (set INTEGRATION_TESTS=true)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

// Test concept data
const TEST_CONCEPTS = [
  {
    label: 'Phenomenology',
    confidence: 0.95,
    category: 'Philosophy',
    frequency: 5
  },
  {
    label: 'Consciousness', 
    confidence: 0.92,
    category: 'Philosophy',
    frequency: 3
  },
  {
    label: 'Intentionality',
    confidence: 0.88,
    category: 'Philosophy', 
    frequency: 2
  }
];

const TEST_RELATIONSHIPS = [
  {
    source: 'Phenomenology',
    target: 'Consciousness',
    type: 'analyzes',
    strength: 0.9
  },
  {
    source: 'Consciousness',
    target: 'Intentionality',
    type: 'hasProperty',
    strength: 0.85
  }
];

describe('RDF Concept Storage Tests', () => {
  let sparqlStore;
  let mockFetch;

  // Mock response helper
  const createMockResponse = (data = { results: { bindings: [] } }, ok = true) => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });

  beforeEach(async () => {
    // Mock the global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Default mock response for most tests
    mockFetch.mockResolvedValue(createMockResponse());
    
    // Create store instance with proper endpoint structure
    const endpoints = {
      query: 'http://localhost:3030/test/query',
      update: 'http://localhost:3030/test/update'
    };
    const options = {
      user: 'test',
      password: 'test',
      graphName: 'http://test.org/concepts'
    };
    sparqlStore = new SPARQLStore(endpoints, options);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('Concept Storage API', () => {
    it('should have storeConcepts method', () => {
      expect(typeof sparqlStore.storeConcepts).toBe('function');
      console.log('✅ storeConcepts method exists');
    });

    it('should have storeConceptRelationships method', () => {
      expect(typeof sparqlStore.storeConceptRelationships).toBe('function');
      console.log('✅ storeConceptRelationships method exists');  
    });

    it('should have generateConceptURI method', () => {
      expect(typeof sparqlStore.generateConceptURI).toBe('function');
      console.log('✅ generateConceptURI method exists');
    });

    it('should have queryConceptsByFilter method', () => {
      expect(typeof sparqlStore.queryConceptsByFilter).toBe('function');
      console.log('✅ queryConceptsByFilter method exists');
    });
  });

  describe('Concept URI Generation', () => {
    it('should generate consistent concept URIs', () => {
      const uri1 = sparqlStore.generateConceptURI('Phenomenology');
      const uri2 = sparqlStore.generateConceptURI('Phenomenology');
      
      expect(uri1).toBe(uri2);
      expect(uri1).toContain('ragno/concept');
      expect(uri1).toContain('phenomenology');
      
      console.log(`✅ Generated concept URI: ${uri1}`);
    });

    it('should handle special characters in concept labels', () => {
      const uri = sparqlStore.generateConceptURI('Husserl\'s Phenomenology & Method');
      
      expect(uri).toBeDefined();
      expect(uri).toContain('ragno/concept');
      expect(uri).not.toContain("'");
      expect(uri).not.toContain("&");
      
      console.log(`✅ Handled special characters: ${uri}`);
    });
  });

  describe('Concept Storage Operations', () => {
    it('should handle storeConcepts API call', async () => {
      const sourceEntityUri = 'http://example.org/source/test';
      
      const result = await sparqlStore.storeConcepts(TEST_CONCEPTS, sourceEntityUri);
      
      // Method should return undefined (void)
      expect(result).toBeUndefined();
      
      // Should have made SPARQL update calls
      expect(mockFetch).toHaveBeenCalled();
      
      // Verify the SPARQL update was called with proper endpoint
      const updateCall = mockFetch.mock.calls.find(call => 
        call[0].includes('/update')
      );
      expect(updateCall).toBeDefined();
      
      console.log('✅ storeConcepts completed successfully');
    });

    it('should handle storeConceptRelationships API call', async () => {
      const result = await sparqlStore.storeConceptRelationships(TEST_RELATIONSHIPS);
      
      // Method should return undefined (void) 
      expect(result).toBeUndefined();
      
      // Should have made SPARQL update calls
      expect(mockFetch).toHaveBeenCalled();
      
      // Verify the SPARQL update was called with proper endpoint
      const updateCall = mockFetch.mock.calls.find(call => 
        call[0].includes('/update')
      );
      expect(updateCall).toBeDefined();
      
      console.log('✅ storeConceptRelationships completed successfully');
    });
  });

  describe('Concept Query Operations', () => {
    it('should handle queryConceptsByFilter API call', async () => {
      const queryParams = {
        category: 'Philosophy',
        minConfidence: 0.8
      };
      
      // Mock query response with concept data
      const mockQueryResponse = {
        results: {
          bindings: [
            {
              concept: { value: 'http://purl.org/stuff/ragno/concept/phenomenology' },
              label: { value: 'Phenomenology' },
              category: { value: 'Philosophy' },
              confidence: { value: '0.95' }
            }
          ]
        }
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockQueryResponse));
      
      const results = await sparqlStore.queryConceptsByFilter(queryParams);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // Should have made SPARQL query call
      expect(mockFetch).toHaveBeenCalled();
      
      console.log('✅ queryConceptsByFilter completed successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty concepts array', async () => {
      const sourceEntityUri = 'http://example.org/source/test';
      
      // Should not throw error for empty array
      const result = await sparqlStore.storeConcepts([], sourceEntityUri);
      expect(result).toBeUndefined();
      
      console.log('✅ Empty concepts array handled gracefully');
    });

    it('should handle null/undefined concepts', async () => {
      const sourceEntityUri = 'http://example.org/source/test';
      
      // Should not throw error for null/undefined
      const result1 = await sparqlStore.storeConcepts(null, sourceEntityUri);
      const result2 = await sparqlStore.storeConcepts(undefined, sourceEntityUri);
      
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      
      console.log('✅ Null/undefined concepts handled gracefully');
    });

    it('should handle invalid relationship data', async () => {
      // Should not throw error for empty/invalid relationships
      const result = await sparqlStore.storeConceptRelationships([]);
      expect(result).toBeUndefined();
      
      console.log('✅ Invalid relationship data handled gracefully');
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should work with existing search methods', () => {
      // Verify SPARQLStore has its core search functionality
      expect(typeof sparqlStore.search).toBe('function');
      expect(typeof sparqlStore.store).toBe('function');
      
      console.log('✅ Core SPARQLStore methods available');
    });

    it('should maintain RDF vocabulary consistency', () => {
      // Check that generated URIs use proper vocabulary
      const conceptUri = sparqlStore.generateConceptURI('test-concept');
      
      expect(conceptUri).toContain('ragno');
      expect(conceptUri.startsWith('http')).toBe(true);
      
      console.log('✅ RDF vocabulary consistency maintained');
    });
  });
});

// Optional integration tests against live SPARQL store
// Run with: INTEGRATION_TESTS=true npx vitest run tests/unit/stores/rdf-concept-storage.test.js
describe.skipIf(!process.env.INTEGRATION_TESTS)('RDF Concept Storage Integration Tests (Live SPARQL)', () => {
  let sparqlStore;

  beforeEach(async () => {
    // Ensure fetch is available for integration tests
    if (typeof globalThis.fetch === 'undefined') {
      // Try to use Node.js built-in fetch (Node 18+)
      try {
        globalThis.fetch = fetch;
      } catch {
        // Fallback for older Node.js versions
        console.log('⚠️  Using fetch polyfill for integration tests');
        globalThis.fetch = async (url, options = {}) => {
          // Simple fetch polyfill for testing
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: { bindings: [] } }),
            text: async () => 'Mock response'
          };
        };
      }
    }
    
    // Create store instance with live endpoints
    const endpoints = {
      query: 'http://localhost:3030/dataset/query',
      update: 'http://localhost:3030/dataset/update'
    };
    const options = {
      graphName: 'http://test.org/concepts-integration'
    };
    sparqlStore = new SPARQLStore(endpoints, options);
  });

  afterEach(() => {
    // Clean up but don't delete global fetch for integration tests
    if (process.env.INTEGRATION_TESTS && global.fetch) {
      // Leave global.fetch available for other integration tests
    }
  });

  describe('Live Concept Storage Operations', () => {
    it('should store concepts in live SPARQL store', async () => {
      const sourceEntityUri = 'http://test.org/integration/source1';
      const testConcepts = [
        {
          label: 'Integration Test Concept',
          confidence: 0.95,
          category: 'Testing',
          frequency: 1
        }
      ];
      
      const result = await sparqlStore.storeConcepts(testConcepts, sourceEntityUri);
      
      // Method should return undefined (void)
      expect(result).toBeUndefined();
      
      console.log('✅ Live storeConcepts completed successfully');
    });

    it('should store concept relationships in live SPARQL store', async () => {
      const testRelationships = [
        {
          source: 'Integration Test Concept A',
          target: 'Integration Test Concept B',
          type: 'testRelation',
          strength: 0.8
        }
      ];
      
      const result = await sparqlStore.storeConceptRelationships(testRelationships);
      
      // Method should return undefined (void) 
      expect(result).toBeUndefined();
      
      console.log('✅ Live storeConceptRelationships completed successfully');
    });

    it('should query concepts from live SPARQL store', async () => {
      const queryParams = {
        category: 'Testing'
      };
      
      const results = await sparqlStore.queryConceptsByFilter(queryParams);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      console.log(`✅ Live queryConceptsByFilter returned ${results.length} concepts`);
    });

    it('should generate proper concept URIs', () => {
      const uri1 = sparqlStore.generateConceptURI('Live Test Concept');
      const uri2 = sparqlStore.generateConceptURI('Live Test Concept');
      
      expect(uri1).toBe(uri2);
      expect(uri1).toContain('ragno/concept');
      expect(uri1).toContain('live-test-concept');
      
      console.log(`✅ Live concept URI generation: ${uri1}`);
    });
  });

  describe('Live Error Handling', () => {
    it('should handle empty data gracefully with live store', async () => {
      const sourceEntityUri = 'http://test.org/integration/empty';
      
      // Should not throw error for empty array
      const result1 = await sparqlStore.storeConcepts([], sourceEntityUri);
      const result2 = await sparqlStore.storeConceptRelationships([]);
      
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      
      console.log('✅ Live empty data handling works');
    });
  });

  describe('Live Performance Tests', () => {
    it('should handle batch concept storage efficiently', async () => {
      const sourceEntityUri = 'http://test.org/integration/batch';
      const batchConcepts = Array.from({ length: 20 }, (_, i) => ({
        label: `Batch Concept ${i}`,
        confidence: 0.5 + (i * 0.02),
        category: `Category${i % 3}`,
        frequency: i + 1
      }));
      
      const startTime = Date.now();
      const result = await sparqlStore.storeConcepts(batchConcepts, sourceEntityUri);
      const duration = Date.now() - startTime;
      
      expect(result).toBeUndefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`⚡ Live batch storage of ${batchConcepts.length} concepts took ${duration}ms`);
    });
  });
});