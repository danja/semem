// tests/unit/stores/SPARQLStore.zpt.test.js
// Tests for ZPT-enhanced SPARQLStore functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

describe('SPARQLStore ZPT Extensions', () => {
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

  beforeEach(() => {
    // Mock fetch to avoid real network calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    store = new SPARQLStore(mockEndpoint, mockOptions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('Ragno Entity Storage', () => {
    it('should store ragno Entity with required fields', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const entity = {
        id: 'http://example.org/entity/test',
        name: 'Test Entity',
        isEntryPoint: true,
        subType: 'concept'
      };

      await expect(store.storeEntity(entity)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error for entity without required id', async () => {
      const entity = {
        name: 'Test Entity',
        isEntryPoint: true
      };

      await expect(store.storeEntity(entity)).rejects.toThrow('Entity must have an id field');
    });

    it('should store entity with optional metadata', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const entity = {
        id: 'http://example.org/entity/test',
        name: 'Test Entity',
        isEntryPoint: false,
        subType: 'person',
        frequency: 42,
        centrality: 0.85
      };

      await expect(store.storeEntity(entity)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Ragno SemanticUnit Storage', () => {
    it('should store semantic unit with content', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const unit = {
        id: 'http://example.org/unit/test',
        content: 'This is test content for the semantic unit.',
        sourceText: 'Original source text'
      };

      await expect(store.storeSemanticUnit(unit)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error for unit without id', async () => {
      const unit = {
        content: 'Test content without id'
      };

      await expect(store.storeSemanticUnit(unit)).rejects.toThrow('SemanticUnit must have an id field');
    });
  });

  describe('Ragno Relationship Storage', () => {
    it('should store relationship with source and target', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const relationship = {
        id: 'http://example.org/rel/test',
        source: 'http://example.org/entity/source',
        target: 'http://example.org/entity/target',
        type: 'relatedTo',
        weight: 0.7
      };

      await expect(store.storeRelationship(relationship)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error for relationship missing source or target', async () => {
      const relationship = {
        id: 'http://example.org/rel/test',
        source: 'http://example.org/entity/source'
        // missing target
      };

      await expect(store.storeRelationship(relationship)).rejects.toThrow('Relationship must have id, source, and target fields');
    });
  });

  describe('ZPT Query Templates', () => {
    it('should execute entity-level query', async () => {
      const mockBindings = [
        {
          uri: { value: 'http://example.org/entity/ai' },
          label: { value: 'Artificial Intelligence' },
          type: { value: 'http://example.org/concept' },
          frequency: { value: '10' }
        }
      ];

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockBindings } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const options = {
        zoomLevel: 'entity',
        limit: 10,
        filters: { domain: ['technology'] }
      };

      const results = await store.queryByZoomLevel(options);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'http://example.org/entity/ai',
        label: 'Artificial Intelligence',
        type: 'entity',
        frequency: 10
      });
    });

    it('should execute micro-level (unit) query', async () => {
      const mockBindings = [
        {
          uri: { value: 'http://example.org/unit/test' },
          content: { value: 'Test content about AI' },
          similarity: { value: '0.85' }
        }
      ];

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockBindings } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const options = {
        zoomLevel: 'micro',
        limit: 5
      };

      const results = await store.queryByZoomLevel(options);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'http://example.org/unit/test',
        content: 'Test content about AI',
        type: 'micro',
        similarity: 0.85
      });
    });

    it('should throw error for unknown zoom level', async () => {
      const options = {
        zoomLevel: 'invalid-zoom',
        limit: 10
      };

      await expect(store.queryByZoomLevel(options)).rejects.toThrow('Unknown zoom level');
    });
  });

  describe('Advanced Similarity Search', () => {
    it('should find similar elements with threshold', async () => {
      const mockBindings = [
        {
          uri: { value: 'http://example.org/entity/ai' },
          embedding: { value: '[0.1, 0.2, 0.3]' },
          label: { value: 'AI' },
          type: { value: 'ragno:Entity' }
        }
      ];

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockBindings } }),
        text: () => Promise.resolve('')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const queryEmbedding = [0.1, 0.2, 0.3]; // Mock embedding
      const results = await store.findSimilarElements(queryEmbedding, 1, 0.9);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id', 'http://example.org/entity/ai');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });
  });

  describe('Filter Building', () => {
    it('should build domain filter clauses', () => {
      const filters = { domains: ['technology', 'science'] };
      const clauses = store._buildFilterClauses(filters);
      
      expect(clauses).toContain('technology');
      expect(clauses).toContain('science');
      expect(clauses).toContain('FILTER(REGEX(?label,');
    });

    it('should build keyword filter clauses', () => {
      const filters = { keywords: ['artificial', 'intelligence'] };
      const clauses = store._buildFilterClauses(filters);
      
      expect(clauses).toMatch(/FILTER.*artificial.*intelligence/);
    });

    it('should build temporal filter clauses', () => {
      const filters = { 
        temporal: { 
          start: '2020-01-01T00:00:00Z',
          end: '2023-12-31T23:59:59Z'
        }
      };
      const clauses = store._buildFilterClauses(filters);
      
      expect(clauses).toContain('FILTER(?timestamp >= "2020-01-01T00:00:00Z"^^xsd:dateTime)');
      expect(clauses).toContain('FILTER(?timestamp <= "2023-12-31T23:59:59Z"^^xsd:dateTime)');
    });

    it('should build entity filter clauses', () => {
      const filters = { 
        entities: ['http://example.org/entity/ai', 'http://example.org/entity/ml']
      };
      const clauses = store._buildFilterClauses(filters);
      
      expect(clauses).toContain('http://example.org/entity/ai');
      expect(clauses).toContain('http://example.org/entity/ml');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network errors during entity storage', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const entity = {
        id: 'http://example.org/entity/test',
        name: 'Test Entity'
      };

      await expect(store.storeEntity(entity)).rejects.toThrow('Network error');
    });
  });
});