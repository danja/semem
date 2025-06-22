import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerZPTTools } from '../../../../mcp/tools/zpt-tools.js';

// Mock dependencies
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  initializeServices: vi.fn().mockResolvedValue(true),
  getMemoryManager: vi.fn(() => mockMemoryManager)
}));

vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
  SafeOperations: vi.fn().mockImplementation(() => mockSafeOperations)
}));

vi.mock('../../../../mcp/lib/debug-utils.js', () => ({
  mcpDebugger: {
    info: vi.fn(),
    error: vi.fn(),
    logProtocolMessage: vi.fn()
  }
}));

// Mock memory manager with ZPT capabilities
const mockMemoryManager = {
  zptNavigate: vi.fn().mockResolvedValue({
    success: true,
    navigation: {
      query: 'test query',
      results: [],
      metadata: { zoom: 'entity', tilt: 'keywords' }
    }
  }),
  zptPreview: vi.fn().mockResolvedValue({
    success: true,
    preview: {
      estimatedResults: 42,
      processingTime: '1.2s',
      contentAreas: ['main', 'related']
    }
  }),
  dispose: vi.fn().mockResolvedValue(true)
};

// Mock safe operations
const mockSafeOperations = {
  zptNavigate: vi.fn().mockResolvedValue({
    success: true,
    navigation: { query: 'safe query', results: [] }
  }),
  zptPreview: vi.fn().mockResolvedValue({
    success: true,
    preview: { estimatedResults: 10 }
  }),
  zptValidateParams: vi.fn().mockResolvedValue({
    valid: true,
    errors: []
  }),
  zptAnalyzeCorpus: vi.fn().mockResolvedValue({
    success: true,
    analysis: { entityCount: 100, relationshipCount: 50 }
  })
};

// Mock MCP server
const mockServer = {
  tool: vi.fn(),
  toolHandlers: new Map()
};

describe('ZPT Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock server tool registration
    mockServer.tool.mockImplementation((name, config, handler) => {
      mockServer.toolHandlers.set(name, { config, handler });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ZPT Tool Registration', () => {
    it('should register all ZPT tools with the server', () => {
      registerZPTTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_navigate',
        expect.objectContaining({
          description: expect.stringContaining('3-dimensional knowledge graph navigation'),
          parameters: expect.objectContaining({
            query: expect.any(Object),
            zoom: expect.any(Object),
            pan: expect.any(Object),
            tilt: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_preview',
        expect.objectContaining({
          description: expect.stringContaining('Preview ZPT navigation options'),
          parameters: expect.objectContaining({
            query: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_get_schema',
        expect.objectContaining({
          description: expect.stringContaining('Get complete ZPT parameter schema'),
          parameters: expect.any(Object)
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_validate_params',
        expect.objectContaining({
          description: expect.stringContaining('Validate ZPT parameters'),
          parameters: expect.objectContaining({
            params: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_get_options',
        expect.objectContaining({
          description: expect.stringContaining('Get available parameter values'),
          parameters: expect.any(Object)
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'zpt_analyze_corpus',
        expect.objectContaining({
          description: expect.stringContaining('Analyze corpus structure'),
          parameters: expect.any(Object)
        }),
        expect.any(Function)
      );
    });
  });

  describe('zpt_navigate Tool', () => {
    it('should navigate with basic parameters', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'artificial intelligence',
        zoom: 'entity',
        tilt: 'keywords'
      });

      expect(mockSafeOperations.zptNavigate).toHaveBeenCalledWith({
        query: 'artificial intelligence',
        zoom: 'entity',
        pan: {},
        tilt: 'keywords',
        transform: expect.objectContaining({
          maxTokens: 4000,
          format: 'json',
          includeMetadata: true
        })
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.navigation).toBeDefined();
    });

    it('should handle complex navigation parameters', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const complexParams = {
        query: 'machine learning',
        zoom: 'community',
        pan: {
          topic: 'neural networks',
          temporal: {
            start: '2020-01-01',
            end: '2023-12-31'
          },
          geographic: {
            bbox: [-122.5, 37.2, -121.9, 37.6]
          },
          entity: ['tensorflow', 'pytorch']
        },
        tilt: 'embedding',
        transform: {
          maxTokens: 8000,
          format: 'markdown',
          chunkStrategy: 'adaptive',
          includeMetadata: false
        }
      };

      const result = await handler(complexParams);

      expect(mockSafeOperations.zptNavigate).toHaveBeenCalledWith(complexParams);

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
    });

    it('should validate zoom parameter values', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'test query',
        zoom: 'invalid_zoom'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('zoom');
    });

    it('should validate tilt parameter values', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'test query',
        tilt: 'invalid_tilt'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('tilt');
    });

    it('should handle empty query', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: ''
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Query cannot be empty');
    });
  });

  describe('zpt_preview Tool', () => {
    it('should preview navigation options', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_preview').handler;

      const result = await handler({
        query: 'preview test query',
        zoom: 'unit'
      });

      expect(mockSafeOperations.zptPreview).toHaveBeenCalledWith({
        query: 'preview test query',
        zoom: 'unit',
        includeOptions: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.preview).toBeDefined();
    });

    it('should handle preview with filters', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_preview').handler;

      const result = await handler({
        query: 'filtered preview',
        zoom: 'entity',
        filters: {
          entityTypes: ['Person', 'Organization'],
          dateRange: { start: '2023-01-01', end: '2023-12-31' }
        }
      });

      expect(mockSafeOperations.zptPreview).toHaveBeenCalledWith({
        query: 'filtered preview',
        zoom: 'entity',
        filters: {
          entityTypes: ['Person', 'Organization'],
          dateRange: { start: '2023-01-01', end: '2023-12-31' }
        },
        includeOptions: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
    });
  });

  describe('zpt_get_schema Tool', () => {
    it('should return complete ZPT schema', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_get_schema').handler;

      const result = await handler({
        includeExamples: true,
        includeValidation: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.schema).toBeDefined();
      expect(content.schema.parameters).toBeDefined();
      expect(content.schema.zoomLevels).toBeDefined();
      expect(content.schema.tiltStyles).toBeDefined();
      expect(content.examples).toBeDefined();
      expect(content.validation).toBeDefined();
    });

    it('should return minimal schema when options are false', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_get_schema').handler;

      const result = await handler({
        includeExamples: false,
        includeValidation: false
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.schema).toBeDefined();
      expect(content.examples).toBeUndefined();
      expect(content.validation).toBeUndefined();
    });
  });

  describe('zpt_validate_params Tool', () => {
    it('should validate correct parameters', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_validate_params').handler;

      const validParams = {
        query: 'neural networks',
        zoom: 'entity',
        pan: { topic: 'machine learning' },
        tilt: 'embedding'
      };

      const result = await handler({
        params: validParams
      });

      expect(mockSafeOperations.zptValidateParams).toHaveBeenCalledWith(validParams);

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.valid).toBe(true);
      expect(content.errors).toEqual([]);
    });

    it('should detect invalid parameters', async () => {
      mockSafeOperations.zptValidateParams.mockResolvedValueOnce({
        valid: false,
        errors: ['Invalid zoom level: invalid_zoom', 'Query cannot be empty']
      });

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_validate_params').handler;

      const invalidParams = {
        query: '',
        zoom: 'invalid_zoom'
      };

      const result = await handler({
        params: invalidParams
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.valid).toBe(false);
      expect(content.errors).toHaveLength(2);
    });
  });

  describe('zpt_get_options Tool', () => {
    it('should return available options for current corpus', async () => {
      mockSafeOperations.zptGetOptions = vi.fn().mockResolvedValue({
        success: true,
        options: {
          availableZoomLevels: ['entity', 'unit', 'text'],
          availableTiltStyles: ['keywords', 'embedding', 'graph'],
          entityTypes: ['Person', 'Organization', 'Location'],
          topicDomains: ['technology', 'science', 'politics'],
          temporalRange: { earliest: '2020-01-01', latest: '2024-01-01' }
        }
      });

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_get_options').handler;

      const result = await handler({
        query: 'artificial intelligence',
        includeContext: true
      });

      expect(mockSafeOperations.zptGetOptions).toHaveBeenCalledWith({
        query: 'artificial intelligence',
        includeContext: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.options).toBeDefined();
      expect(content.options.availableZoomLevels).toBeDefined();
      expect(content.options.entityTypes).toBeDefined();
    });
  });

  describe('zpt_analyze_corpus Tool', () => {
    it('should analyze corpus structure', async () => {
      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_analyze_corpus').handler;

      const result = await handler({
        includeRecommendations: true,
        includePerformance: true
      });

      expect(mockSafeOperations.zptAnalyzeCorpus).toHaveBeenCalledWith({
        includeRecommendations: true,
        includePerformance: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.analysis).toBeDefined();
    });

    it('should provide optimization recommendations', async () => {
      mockSafeOperations.zptAnalyzeCorpus.mockResolvedValueOnce({
        success: true,
        analysis: {
          entityCount: 1000,
          relationshipCount: 500,
          recommendations: [
            'Consider using community zoom for large datasets',
            'Enable caching for repeated navigation patterns'
          ],
          performance: {
            avgNavigationTime: '2.3s',
            memoryUsage: '45MB',
            indexingEfficiency: 0.85
          }
        }
      });

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_analyze_corpus').handler;

      const result = await handler({
        includeRecommendations: true,
        includePerformance: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.analysis.recommendations).toHaveLength(2);
      expect(content.analysis.performance).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle memory manager not available', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockReturnValueOnce(null);

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'test query'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Memory manager not available');
    });

    it('should handle ZPT navigation failures', async () => {
      mockSafeOperations.zptNavigate.mockRejectedValueOnce(new Error('Navigation failed'));

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'failing query'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Navigation failed');
    });

    it('should handle service initialization failures', async () => {
      const { initializeServices } = await import('../../../../mcp/lib/initialization.js');
      initializeServices.mockRejectedValueOnce(new Error('ZPT service init failed'));

      registerZPTTools(mockServer);
      const handler = mockServer.toolHandlers.get('zpt_navigate').handler;

      const result = await handler({
        query: 'test query'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('ZPT service init failed');
    });
  });
});