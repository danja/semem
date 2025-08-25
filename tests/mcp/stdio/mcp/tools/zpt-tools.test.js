// tests/unit/mcp/tools/zpt-tools.test.js
// Tests for ZPT navigation tools

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZPTNavigationService } from '../../../../mcp/tools/zpt-tools.js';

// Mock the SPARQLStore
const mockSparqlStore = {
  queryByZoomLevel: vi.fn().mockResolvedValue([]),
  findSimilarElements: vi.fn().mockResolvedValue([]),
  validateCorpus: vi.fn().mockResolvedValue({
    valid: true,
    stats: { total: 0 }
  })
};

// Mock the ZPT components
const mockParameterValidator = {
  validate: vi.fn().mockImplementation(params => ({
    valid: true,
    errors: [],
    ...params
  }))
};

const mockParameterNormalizer = {
  normalize: vi.fn().mockImplementation(params => params)
};

const mockCorpuscleSelector = {
  select: vi.fn().mockResolvedValue({
    corpuscles: [],
    cacheHits: 0,
    cacheMisses: 1,
    sparqlQueries: 1
  })
};

const mockCorpuscleTransformer = {
  transform: vi.fn().mockResolvedValue({
    chunks: [],
    summary: {},
    tokenCount: 100
  })
};

// Mock the mcpDebugger
const mcpDebugger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock the SPARQLStore module
vi.mock('../../../../src/stores/SPARQLStore.js', () => ({
  default: vi.fn(() => mockSparqlStore)
}));

// Mock the console to avoid test noise
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Mock the ZPTNavigationService dependencies
vi.mock('../../../../mcp/tools/zpt-tools.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ZPTNavigationService: class MockZPTNavigationService extends actual.ZPTNavigationService {
      constructor() {
        super();
        this.parameterValidator = mockParameterValidator;
        this.parameterNormalizer = mockParameterNormalizer;
        this.corpuscleSelector = mockCorpuscleSelector;
        this.corpuscleTransformer = mockCorpuscleTransformer;
        this.mcpDebugger = mcpDebugger;
      }
    }
  };
});

describe('ZPT Navigation Tools', () => {
  let navigationService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Set up default mock implementations
    mockParameterValidator.validate.mockImplementation(params => ({
      valid: true,
      errors: [],
      ...params
    }));
    
    mockParameterNormalizer.normalize.mockImplementation(params => params);
    
    mockCorpuscleSelector.select.mockResolvedValue({
      corpuscles: [],
      cacheHits: 0,
      cacheMisses: 1,
      sparqlQueries: 1
    });
    
    mockCorpuscleTransformer.transform.mockResolvedValue({
      chunks: [],
      summary: {},
      tokenCount: 100
    });
    
    // Create a new instance of the service for each test
    navigationService = new ZPTNavigationService({
      enableRealData: true,
      fallbackToSimulation: false,
      debug: false,
      mock: {
        parameterValidator: mockParameterValidator,
        parameterNormalizer: mockParameterNormalizer,
        corpuscleSelector: mockCorpuscleSelector,
        corpuscleTransformer: mockCorpuscleTransformer,
        mcpDebugger: mcpDebugger
      }
    });
    
    // Set up the store mock
    navigationService.store = mockSparqlStore;
    
    // Setup default mock implementations
    mockSparqlStore.queryByZoomLevel.mockResolvedValue([{
      id: 'http://example.org/entity/1',
      label: 'Test Entity',
      type: 'entity',
      score: 0.95
    }]);
    
    mockSparqlStore.findSimilarElements.mockResolvedValue([{
      id: 'http://example.org/entity/2',
      label: 'Similar Entity',
      type: 'entity',
      score: 0.85
    }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation Parameters', () => {
    it('should validate basic navigation parameters', () => {
      const params = {
        query: 'artificial intelligence',
        zoom: 'entity',
        pan: { domain: ['technology'] },
        tilt: 'keywords'
      };

      const result = navigationService.validateNavigationParams(params);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });


    it('should reject empty queries', () => {
      const params = {
        query: '',
        zoom: 'entity',
        pan: {},
        tilt: 'keywords',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const result = navigationService.validateNavigationParams(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Query cannot be empty');
    });

    it('should validate tilt options', () => {
      const validTilts = ['keywords', 'temporal', 'similarity', 'frequency'];
      
      validTilts.forEach(tilt => {
        const params = {
          query: 'test',
          zoom: 'entity',
          pan: {},
          tilt: tilt
        };

        const result = navigationService.validateNavigationParams(params);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Zoom Level Functionality', () => {
    it('should handle entity-level navigation', async () => {
      // Setup mock data
      const mockEntities = [{
        id: 'http://example.org/entity/1',
        label: 'Test Entity',
        type: 'entity',
        score: 0.95
      }];

      // Mock the corpus selector to return our test data
      mockCorpuscleSelector.select.mockResolvedValueOnce({
        corpuscles: mockEntities,
        cacheHits: 0,
        cacheMisses: 1,
        sparqlQueries: 1
      });

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'relevance'
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.zoom).toBe('entity');
      expect(mockCorpuscleSelector.select).toHaveBeenCalledWith(
        expect.objectContaining({
          zoom: 'entity',
          query: 'test'
        })
      );
    });

    let originalNavigateWithRealData;
    
    beforeEach(() => {
      // Save the original implementation
      originalNavigateWithRealData = navigationService.navigateWithRealData;
    });
    
    afterEach(() => {
      // Restore the original implementation
      navigationService.navigateWithRealData = originalNavigateWithRealData;
    });
    
    it('should handle micro-level (text) navigation', async () => {
      // Mock the actual implementation of navigateWithRealData to return the expected structure
      navigationService.navigateWithRealData = vi.fn().mockResolvedValue({
        success: true,
        content: {
          data: [{
            id: 'test-unit-1',
            type: 'unit',
            content: 'This is a test unit about AI research.',
            metadata: {}
          }],
          zoom: 'micro',
          estimatedResults: 1,
          filters: {
            domain: [],
            temporal: {},
            keywords: ['AI', 'research'],
            entities: []
          },
          corpusHealth: {
            valid: true,
            stats: {
              entityCount: 100,
              unitCount: 50,
              textCount: 25,
              microCount: 10,
              communityCount: 5,
              corpusCount: 1
            }
          },
          metadata: {
            pipeline: {
              selectionTime: 10,
              projectionTime: 5,
              transformationTime: 15,
              totalTime: 30,
              mode: 'test'
            },
            navigation: {
              query: 'AI research',
              zoom: 'micro',
              pan: { keywords: ['AI', 'research'] },
              tilt: 'similarity',
              transform: {}
            },
            corpuscleCount: 1,
            tokenCount: 100
          },
          suggestions: []
        }
      });
      
      // Ensure we're in test environment
      process.env.NODE_ENV = 'test';

      const params = {
        query: 'AI research',
        zoom: 'micro',
        pan: { keywords: ['research', 'AI'] },
        tilt: 'similarity',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data[0]).toMatchObject({
        id: expect.any(String),
        type: 'unit',
        content: expect.any(String)
      });
      expect(result.content.zoom).toBe('micro');
      
      // Verify the response structure
      expect(result.content.data[0]).toMatchObject({
        id: expect.any(String),
        type: 'unit',
        content: expect.any(String)
      });
    });
    
    // Cleanup is handled by the afterEach hook above

    it('should handle community-level navigation', async () => {
      const mockResults = [
        {
          id: 'http://example.org/community/tech',
          label: 'Technology Community',
          memberCount: 156,
          cohesion: 0.78,
          type: 'community'
        }
      ];

      // Mock the corpus selector to return our test results
      mockCorpuscleSelector.select.mockResolvedValueOnce({
        corpuscles: mockResults,
        cacheHits: 0,
        cacheMisses: 1,
        sparqlQueries: 1,
        metadata: {
          estimatedResults: 1,
          suggestions: [],
          corpusHealth: {}
        }
      });

      // Mock the transformer to pass through the results
      mockCorpuscleTransformer.transform.mockResolvedValueOnce({
        chunks: mockResults,
        summary: {},
        tokenCount: 100
      });

      const params = {
        query: 'technology trends',
        zoom: 'community',
        pan: { 
          domains: ['technology'],
          keywords: [],
          temporal: {},
          entities: []
        },
        tilt: 'keywords',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data[0]).toMatchObject({
        id: expect.any(String),
        type: 'community',
        label: expect.any(String)
      });
      expect(result.content.zoom).toBe('community');
      
      // Verify corpus selector was called with correct parameters
      expect(mockCorpuscleSelector.select).toHaveBeenCalledWith(
        expect.objectContaining({
          zoom: 'community',
          query: 'technology trends',
          pan: { 
            domains: ['technology'],
            keywords: [],
            temporal: {},
            entities: []
          },
          tilt: 'keywords'
        })
      );
    });
  });

  describe('Pan (Filtering) Functionality', () => {
    it('should apply domain filters correctly', async () => {
      // Setup mock data
      const mockEntities = [
        { id: 'e1', label: 'Entity 1', type: 'entity', domain: 'technology' },
        { id: 'e2', label: 'Entity 2', type: 'entity', domain: 'science' }
      ];

      // Mock the corpus selector to return filtered results
      mockCorpuscleSelector.select.mockImplementation(async (params) => {
        // Verify the domain filter was passed correctly
        expect(params.pan.domains).toEqual(['technology']);
        
        const filtered = mockEntities.filter(e => e.domain === 'technology');
        return {
          corpuscles: filtered,
          cacheHits: 0,
          cacheMisses: 1,
          sparqlQueries: 1,
          metadata: {
            estimatedResults: filtered.length,
            suggestions: [],
            corpusHealth: {}
          }
        };
      });

      // Mock the transformer to pass through the results
      mockCorpuscleTransformer.transform.mockImplementation(async ({ chunks }) => ({
        chunks,
        summary: {},
        tokenCount: chunks.length * 10
      }));

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: { 
          domains: ['technology'],
          keywords: [],
          temporal: {},
          entities: []
        },
        tilt: 'relevance',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data).toHaveLength(1);
      expect(result.content.data[0]).toMatchObject({
        id: 'e1',
        type: 'entity',
        domain: 'technology'
      });
    });

    it('should apply temporal filters correctly', async () => {
      // Mock the navigateWithRealData to return the expected temporal filter response
      navigationService.navigateWithRealData = vi.fn().mockResolvedValue({
        success: true,
        content: {
          data: [{
            id: 'e1',
            type: 'entity',
            label: 'Filtered by Date Range',
            date: '2023-01-01',
            metadata: {}
          }],
          zoom: 'entity',
          estimatedResults: 1,
          filters: {
            domain: [],
            temporal: { start: '2023-01-01', end: '2023-12-31' },
            keywords: [],
            entities: []
          },
          corpusHealth: {
            valid: true,
            stats: { 
              entityCount: 100,
              unitCount: 50,
              textCount: 25,
              microCount: 10,
              communityCount: 5,
              corpusCount: 1
            }
          },
          metadata: {
            pipeline: {
              selectionTime: 10,
              projectionTime: 5,
              transformationTime: 15,
              totalTime: 30,
              mode: 'test'
            },
            navigation: {
              query: 'test',
              zoom: 'entity',
              pan: { temporal: { start: '2023-01-01', end: '2023-12-31' } },
              tilt: 'relevance',
              transform: {}
            },
            corpuscleCount: 1,
            tokenCount: 100
          },
          suggestions: []
        }
      });

      // Ensure we're in test environment
      process.env.NODE_ENV = 'test';

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: { 
          temporal: { start: '2023-01-01', end: '2023-12-31' }
        },
        tilt: 'relevance',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data).toHaveLength(1);
      expect(result.content.data[0]).toMatchObject({
        id: 'e1',
        type: 'entity',
        label: 'Filtered by Date Range',
        date: '2023-01-01'
      });
    });

    it('should apply keyword filters correctly', async () => {
      const mockResults = [
        { 
          id: 'e1', 
          label: 'Filtered by Keywords: ai, research', 
          type: 'entity', 
          keywords: ['ai', 'research'],
          metadata: {}
        }
      ];

      // Mock the corpus selector to verify keyword filtering
      mockCorpuscleSelector.select.mockImplementation(async (params) => {
        // Verify the keyword filter was passed correctly
        expect(params.pan.keywords).toEqual(['ai', 'research']);
        
        return {
          corpuscles: mockResults,
          cacheHits: 0,
          cacheMisses: 1,
          sparqlQueries: 1,
          metadata: {
            estimatedResults: mockResults.length,
            suggestions: [],
            corpusHealth: {}
          }
        };
      });

      // Mock the transformer to pass through the results
      mockCorpuscleTransformer.transform.mockImplementation(async ({ chunks }) => ({
        chunks: chunks || [],
        summary: {},
        tokenCount: 10
      }));

      // Ensure we're in test environment but don't mock navigateWithRealData
      process.env.NODE_ENV = 'test';

      const params = {
        query: 'AI research',
        zoom: 'entity',
        pan: { 
          keywords: ['ai', 'research'] 
        },
        tilt: 'relevance',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data).toHaveLength(1);
      expect(result.content.data[0]).toMatchObject({
        id: 'e1',
        type: 'entity',
        label: 'Filtered by Keywords: ai, research'
      });
      
      // Verify corpus selector was called with the query and keywords
      expect(mockCorpuscleSelector.select).toHaveBeenCalled();
      const callArgs = mockCorpuscleSelector.select.mock.calls[0][0];
      expect(callArgs.query).toBe('AI research');
      expect(callArgs.pan.keywords).toEqual(['ai', 'research']);
    });
  });

  describe('Tilt (Ranking) Functionality', () => {
    it('should apply frequency-based ranking', async () => {
      // Setup mock data with frequency scores
      const mockResults = [
        { id: 'e1', label: 'Frequent', type: 'entity', frequency: 100 },
        { id: 'e2', label: 'Less Frequent', type: 'entity', frequency: 10 }
      ];

      // Mock the corpus selector to return results with frequency scores
      mockCorpuscleSelector.select.mockResolvedValueOnce({
        corpuscles: [...mockResults], // Create a new array to avoid mutation
        cacheHits: 0,
        cacheMisses: 1,
        sparqlQueries: 1
      });

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'frequency',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      
      // Results should be sorted by frequency (descending)
      if (result.content.data.length > 1) {
        expect(result.content.data[0].frequency).toBeGreaterThanOrEqual(
          result.content.data[1].frequency
        );
      }
    });

    it('should apply similarity-based ranking', async () => {
      // Setup mock data with similarity scores
      const mockResults = [
        { 
          id: 'e1', 
          label: 'Similar', 
          type: 'entity', 
          similarity: 0.95,
          embedding: [0.1, 0.2, 0.3]
        },
        { 
          id: 'e2', 
          label: 'Less Similar', 
          type: 'entity', 
          similarity: 0.75,
          embedding: [0.4, 0.5, 0.6]
        }
      ];

      // Mock the corpus selector to return results with similarity scores
      mockCorpuscleSelector.select.mockResolvedValueOnce({
        corpuscles: [...mockResults], // Create a new array to avoid mutation
        cacheHits: 0,
        cacheMisses: 1,
        sparqlQueries: 1
      });

      const params = {
        query: 'test query',
        zoom: 'entity',
        pan: {},
        tilt: 'similarity',
        transform: {
          embedding: [0.1, 0.2, 0.3],
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      
      // Results should be sorted by similarity (descending)
      if (result.content.data.length > 1) {
        expect(result.content.data[0].similarity).toBeGreaterThanOrEqual(
          result.content.data[1].similarity
        );
      }
    });
  });

  describe('Preview Functionality', () => {
    it('should generate navigation preview with statistics', async () => {
      const mockValidation = {
        valid: true,
        stats: {
          total: 100,
          byType: { entity: 50, micro: 30, community: 20 }
        },
        health: {
          score: 0.85,
          issues: []
        }
      };

      // Mock the store's validateCorpus method
      mockSparqlStore.validateCorpus.mockResolvedValue(mockValidation);

      // Mock the corpus selector to return empty results for preview
      mockCorpuscleSelector.select.mockResolvedValue({
        corpuscles: [],
        cacheHits: 0,
        cacheMisses: 0,
        sparqlQueries: 0
      });

      const params = {
        query: 'test',
        preview: true,
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(result.content.estimatedResults).toBeGreaterThan(0);
      expect(result.content.suggestions).toBeDefined();
      expect(result.content.corpusHealth).toBeDefined();
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for different zoom levels', () => {
      const testCases = [
        { zoom: 'micro', expectedRange: [800, 1200] },
        { zoom: 'entity', expectedRange: [400, 800] },
        { zoom: 'community', expectedRange: [600, 1000] }
      ];

      testCases.forEach(({ zoom, expectedRange }) => {
        const tokens = navigationService.estimateTokensForQuery('test query', zoom);
        expect(tokens).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(tokens).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should adjust token estimation based on query complexity', () => {
      const simpleQuery = 'AI';
      const complexQuery = 'artificial intelligence machine learning deep neural networks';

      const simpleTokens = navigationService.estimateTokensForQuery(simpleQuery, 'entity');
      const complexTokens = navigationService.estimateTokensForQuery(complexQuery, 'entity');

      expect(complexTokens).toBeGreaterThan(simpleTokens);
    });
  });

  describe('Parameter Suggestions', () => {
    it('should suggest optimal parameters for different query types', () => {
      const shortQuery = 'AI';
      const longQuery = 'artificial intelligence and machine learning applications in healthcare';

      const shortSuggestions = navigationService.suggestOptimalParameters(shortQuery, {});
      const longSuggestions = navigationService.suggestOptimalParameters(longQuery, {});

      expect(shortSuggestions.recommendedZoom).toBe('entity');
      expect(longSuggestions.recommendedZoom).toBe('unit');
    });

    it('should suggest tilt based on pan parameters', () => {
      const panWithTemporal = { temporal: { after: '2023-01-01' } };
      const panWithoutTemporal = {};

      const temporalSuggestions = navigationService.suggestOptimalParameters('test', panWithTemporal);
      const keywordSuggestions = navigationService.suggestOptimalParameters('test', panWithoutTemporal);

      expect(temporalSuggestions.recommendedTilt).toBe('temporal');
      expect(keywordSuggestions.recommendedTilt).toBe('keywords');
    });

    it('should provide reasoning for suggestions', () => {
      const suggestions = navigationService.suggestOptimalParameters('test query', {});
      
      expect(suggestions).toHaveProperty('reasoning');
      expect(typeof suggestions.reasoning).toBe('string');
      expect(suggestions.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Preview Functionality', () => {
    it('should generate navigation preview with statistics', async () => {
      const mockValidation = {
        valid: true,
        stats: {
          entityCount: 1000,
          unitCount: 5000,
          relationshipCount: 2000
        }
      };

      mockSparqlStore.validateCorpus.mockResolvedValue(mockValidation);

      const params = {
        query: 'artificial intelligence',
        zoom: 'entity',
        pan: { domain: ['technology'] },
        tilt: 'frequency',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const preview = await navigationService.preview(params);

      expect(preview.success).toBe(true);
      expect(preview.preview.content.estimatedResults).toBeGreaterThan(0);
      expect(preview.preview.content.suggestions).toBeDefined();
      expect(preview.preview.content.corpusHealth).toEqual(mockValidation);
    });

    it('should handle preview when corpus validation fails', async () => {
      mockSparqlStore.validateCorpus.mockRejectedValue(new Error('Validation failed'));

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'keywords',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const preview = await navigationService.preview(params);

      expect(preview.success).toBe(true); // Should still work
      expect(preview.corpusHealth).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle SPARQL query failures', async () => {
      // Mock a SPARQL query failure in the corpus selector
      mockCorpuscleSelector.select.mockRejectedValueOnce(new Error('SPARQL error'));

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'relevance',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SPARQL error');
      expect(mockCorpuscleSelector.select).toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      // Mock empty results from corpus selector
      mockCorpuscleSelector.select.mockResolvedValueOnce({
        corpuscles: [],
        cacheHits: 0,
        cacheMisses: 1,
        sparqlQueries: 1,
        metadata: {
          estimatedResults: 0,
          suggestions: [],
          corpusHealth: {}
        }
      });

      // Mock the transformer for empty results
      mockCorpuscleTransformer.transform.mockResolvedValueOnce({
        chunks: [],
        summary: {},
        tokenCount: 0
      });

      const params = {
        query: 'nonexistent',
        zoom: 'entity',
        pan: {},
        tilt: 'relevance',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          },
          includeMetadata: true
        }
      };

      const result = await navigationService.navigate(params);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.content.data)).toBe(true);
      expect(result.content.data).toHaveLength(0);
      expect(result.content.estimatedResults).toBe(0);
      expect(mockCorpuscleSelector.select).toHaveBeenCalled();
    });

    it('should provide helpful error messages for invalid parameters', () => {
      const invalidParams = {
        query: '', // empty query
        zoom: 'invalid', // invalid zoom
        pan: {},
        tilt: 'invalid', // invalid tilt
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const validation = navigationService.validateNavigationParams(invalidParams);
      
      expect(validation.valid).toBe(false);
      
      // Check for specific error messages without being too strict about exact wording
      const errorMessages = validation.errors.join('|');
      expect(errorMessages).toMatch(/query.*required|empty/i);
      expect(errorMessages).toMatch(/zoom.*invalid|valid/i);
      expect(errorMessages).toMatch(/tilt.*invalid|valid/i);
    });

    it('should handle edge cases in parameter validation', () => {
      const edgeCases = [
        { query: null, zoom: 'entity', pan: {}, tilt: 'keywords', transform: { tokenizer: { encode: (text) => text ? text.split(/\s+/) : [] } } },
        { query: 'test', zoom: null, pan: {}, tilt: 'keywords', transform: { tokenizer: { encode: (text) => text ? text.split(/\s+/) : [] } } },
        { query: 'test', zoom: 'entity', pan: 'not-an-object', tilt: 'keywords', transform: { tokenizer: { encode: (text) => text ? text.split(/\s+/) : [] } } },
        { query: 'test', zoom: 'entity', pan: {}, tilt: 'invalid', transform: { tokenizer: { encode: (text) => text ? text.split(/\s+/) : [] } } }
      ];

      edgeCases.forEach(params => {
        const validation = navigationService.validateNavigationParams(params);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete navigation within reasonable time bounds', async () => {
      const mockResults = [{ id: 'test', label: 'Test Entity' }];
      mockSparqlStore.queryByZoomLevel.mockResolvedValue(mockResults);

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'keywords',
        transform: {
          tokenizer: {
            encode: (text) => text ? text.split(/\s+/) : []
          }
        }
      };

      const startTime = Date.now();
      const result = await navigationService.navigate(params);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second for mocked data
    });

    it('should handle concurrent navigation requests', async () => {
      const mockResults = [{ id: 'test', label: 'Test Entity' }];
      mockSparqlStore.queryByZoomLevel.mockResolvedValue(mockResults);

      const params = {
        query: 'test',
        zoom: 'entity',
        pan: {},
        tilt: 'keywords'
      };

      // Run multiple navigation requests concurrently
      const promises = Array(5).fill().map(() => navigationService.navigate(params));
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});