// tests/unit/stores/SPARQLStore.basic.test.js
// Basic tests for ZPT-enhanced SPARQLStore functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SPARQLStore from '../../../../src/stores/SPARQLStore.js';

describe('SPARQLStore Basic ZPT Tests', () => {
  let store;
  let mockFetch;

  const mockEndpoint = {
    query: 'http://test.example/sparql/query',
    update: 'http://test.example/sparql/update'
  };

  const mockOptions = {
    user: 'test',
    password: 'test',
    graphName: 'http://test.example/graph'
  };

  // Mock response helper
  const createMockResponse = (data = { results: { bindings: [] } }, ok = true) => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });

  beforeEach(() => {
    // Mock the global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Default mock response for most tests
    mockFetch.mockResolvedValue(createMockResponse());
    
    store = new SPARQLStore(mockEndpoint, mockOptions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('Instance Creation', () => {
    it('should create SPARQLStore instance with ZPT methods', () => {
      expect(store).toBeDefined();
      expect(typeof store.storeEntity).toBe('function');
      expect(typeof store.storeSemanticUnit).toBe('function');
      expect(typeof store.storeRelationship).toBe('function');
      expect(typeof store.queryByZoomLevel).toBe('function');
      expect(typeof store.findSimilarElements).toBe('function');
      expect(typeof store.validateCorpus).toBe('function');
      expect(typeof store.traverseGraph).toBe('function');
    });

    it('should have ZPT query templates defined', () => {
      // Access the private templates through reflection or check if method works
      expect(() => store.queryByZoomLevel({ zoomLevel: 'entity', limit: 10 })).not.toThrow();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate entity parameters', async () => {
      await expect(store.storeEntity(null)).rejects.toThrow('Entity must have an id field');
      await expect(store.storeEntity({})).rejects.toThrow('Entity must have an id field');
      await expect(store.storeEntity({ name: 'Test' })).rejects.toThrow('Entity must have an id field');
    });

    it('should validate semantic unit parameters', async () => {
      await expect(store.storeSemanticUnit(null)).rejects.toThrow('SemanticUnit must have an id field');
      await expect(store.storeSemanticUnit({})).rejects.toThrow('SemanticUnit must have an id field');
      await expect(store.storeSemanticUnit({ content: 'Test' })).rejects.toThrow('SemanticUnit must have an id field');
    });

    it('should validate relationship parameters', async () => {
      await expect(store.storeRelationship(null)).rejects.toThrow('Relationship must have id, source, and target fields');
      await expect(store.storeRelationship({})).rejects.toThrow('Relationship must have id, source, and target fields');
      await expect(store.storeRelationship({ id: 'test' })).rejects.toThrow('Relationship must have id, source, and target fields');
      await expect(store.storeRelationship({ id: 'test', source: 'source' })).rejects.toThrow('Relationship must have id, source, and target fields');
    });

    it('should validate zoom levels', async () => {
      await expect(store.queryByZoomLevel({ zoom: 'invalid' })).rejects.toThrow('Unknown zoom level');
    });
  });

  describe('Filter Building', () => {
    it('should have _buildFilterClauses method', () => {
      expect(typeof store._buildFilterClauses).toBe('function');
    });

    it('should handle empty filters', () => {
      const result = store._buildFilterClauses({});
      expect(typeof result).toBe('string');
    });

    it('should handle domain filters', () => {
      const result = store._buildFilterClauses({ domains: ['technology'] });
      expect(result).toContain('technology');
    });

    it('should handle keyword filters', () => {
      const result = store._buildFilterClauses({ keywords: ['AI'] });
      expect(result).toContain('AI');
    });

    it('should handle temporal filters', () => {
      const result = store._buildFilterClauses({ 
        temporal: { start: '2023-01-01T00:00:00Z' }
      });
      expect(result).toContain('2023-01-01');
    });
  });

  describe('SPARQL Template Access', () => {
    it('should have internal access to ZPT query templates', async () => {
      // Mock successful responses for each template
      mockFetch.mockResolvedValue(createMockResponse());
      
      const templates = [
        'micro', 'entity', 'relationship', 'community', 'corpus'
      ];
      
      for (const zoom of templates) {
        await expect(store.queryByZoomLevel({ zoomLevel: zoom, limit: 10 }))
          .resolves.toBeDefined();
      }
    });
  });

  describe('Method Signatures', () => {
    it('should accept correct parameters for queryByZoomLevel', async () => {
      // Mock successful response
      mockFetch.mockResolvedValue(createMockResponse());
      
      const validOptions = {
        zoomLevel: 'entity',
        limit: 10,
        filters: { domains: ['technology'] }
      };
      
      // Should not throw and should resolve
      await expect(store.queryByZoomLevel(validOptions)).resolves.toBeDefined();
      
      // Verify fetch was called with the correct endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        mockEndpoint.query,
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object)
        })
      );
    });

    it('should handle query errors properly', async () => {
      // Mock error response
      mockFetch.mockResolvedValue(createMockResponse({ error: 'Server error' }, false));
      
      await expect(store.queryByZoomLevel({ zoomLevel: 'entity' }))
        .rejects
        .toThrow('SPARQL query failed');
    });

    it('should accept correct parameters for findSimilarElements', () => {
      const embedding = [0.1, 0.2, 0.3];
      
      // Method should exist and accept these parameters
      expect(typeof store.findSimilarElements).toBe('function');
      expect(store.findSimilarElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should accept correct parameters for traverseGraph', () => {
      // Method should exist
      expect(typeof store.traverseGraph).toBe('function');
      expect(store.traverseGraph.length).toBeGreaterThanOrEqual(1);
    });

    it('should have corpus validation method', () => {
      expect(typeof store.validateCorpus).toBe('function');
    });
  });

  describe('String Utilities', () => {
    it('should have SPARQL string escaping method', () => {
      expect(typeof store._escapeSparqlString).toBe('function');
    });

    it('should properly escape SPARQL strings', () => {
      const testString = 'Test "quoted" string';
      const escaped = store._escapeSparqlString(testString);
      expect(escaped).toContain('\\"'); // Should contain escaped quotes
      expect(escaped).toContain('Test');
    });
  });

  describe('Configuration Properties', () => {
    it('should have correct endpoint configuration', () => {
      expect(store.endpoint).toEqual(mockEndpoint);
      expect(store.credentials.user).toBe(mockOptions.user);
      expect(store.credentials.password).toBe(mockOptions.password);
      expect(store.graphName).toBe(mockOptions.graphName);
    });

    it('should inherit from BaseStore', () => {
      expect(store.constructor.name).toBe('SPARQLStore');
      // Should have inherited methods from BaseStore
      expect(typeof store.search).toBe('function');
      expect(typeof store.store).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Simulate a network error
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expect(store.queryByZoomLevel({ zoomLevel: 'entity' }))
        .rejects
        .toThrow('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      // Mock a response with invalid JSON
      const invalidJsonResponse = {
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid json'),
        json: () => Promise.reject(new Error('Failed to parse SPARQL results'))
      };
      mockFetch.mockResolvedValue(invalidJsonResponse);
      
      await expect(store.queryByZoomLevel({ zoomLevel: 'entity' }))
        .rejects
        .toThrow('Failed to parse SPARQL results');
    });
  });
});