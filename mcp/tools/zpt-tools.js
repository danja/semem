/**
 * ZPT (3-dimensional navigation) MCP tools implementation
 * Provides intuitive knowledge graph exploration through spatial metaphors
 */
import { z } from 'zod';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';
import { mcpDebugger } from '../lib/debug-utils.js';

// ZPT Tool Names
const ZPTToolName = {
  NAVIGATE: 'zpt_navigate',
  PREVIEW: 'zpt_preview', 
  GET_SCHEMA: 'zpt_get_schema',
  VALIDATE_PARAMS: 'zpt_validate_params',
  GET_OPTIONS: 'zpt_get_options',
  ANALYZE_CORPUS: 'zpt_analyze_corpus'
};

// ZPT Input Schemas
const ZPTNavigateSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus']).optional().default('entity'),
  pan: z.object({
    topic: z.string().optional(),
    temporal: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    geographic: z.object({
      bbox: z.array(z.number()).length(4).optional()
    }).optional(),
    entity: z.array(z.string()).optional()
  }).optional().default({}),
  tilt: z.enum(['keywords', 'embedding', 'graph', 'temporal']).optional().default('keywords'),
  transform: z.object({
    maxTokens: z.number().min(100).max(16000).optional().default(4000),
    format: z.enum(['json', 'markdown', 'structured', 'conversational']).optional().default('json'),
    tokenizer: z.enum(['cl100k_base', 'p50k_base', 'claude', 'llama']).optional().default('cl100k_base'),
    chunkStrategy: z.enum(['semantic', 'adaptive', 'fixed', 'sliding']).optional().default('semantic'),
    includeMetadata: z.boolean().optional().default(true)
  }).optional().default({})
});

const ZPTPreviewSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus']).optional(),
  pan: z.object({
    topic: z.string().optional(),
    temporal: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    geographic: z.object({
      bbox: z.array(z.number()).length(4).optional()
    }).optional(),
    entity: z.array(z.string()).optional()
  }).optional().default({})
});

const ZPTValidateParamsSchema = z.object({
  params: z.object({
    query: z.string(),
    zoom: z.string(),
    pan: z.object({}).optional(),
    tilt: z.string(),
    transform: z.object({}).optional()
  })
});

const ZPTGetOptionsSchema = z.object({
  context: z.enum(['current', 'full']).optional().default('current'),
  query: z.string().optional()
});

const ZPTAnalyzeCorpusSchema = z.object({
  analysisType: z.enum(['structure', 'performance', 'recommendations']).optional().default('structure'),
  includeStats: z.boolean().optional().default(true)
});

// ZPT Navigation Service
class ZPTNavigationService {
  constructor(memoryManager, safeOps) {
    this.memoryManager = memoryManager;
    this.safeOps = safeOps;
  }

  async navigate(query, zoom, pan, tilt, transform) {
    try {
      mcpDebugger.debug('ZPT Navigation starting', { query, zoom, tilt });

      // Simulate ZPT navigation process
      const startTime = Date.now();
      
      // Selection phase - simulate corpus selection based on parameters
      const selectionTime = await this.simulateSelection(query, zoom, pan);
      
      // Projection phase - simulate tilt-based content projection
      const projectionTime = await this.simulateProjection(zoom, tilt);
      
      // Transformation phase - simulate content transformation
      const transformationTime = await this.simulateTransformation(transform);
      
      const totalTime = Date.now() - startTime;

      // Generate simulated content based on parameters
      const content = await this.generateNavigationContent(query, zoom, pan, tilt, transform);
      
      // Store navigation result in memory
      await this.storeNavigationResult(query, { zoom, pan, tilt, transform }, content);

      return {
        success: true,
        content: content,
        metadata: {
          pipeline: {
            selectionTime,
            projectionTime,
            transformationTime,
            totalTime
          },
          navigation: {
            query,
            zoom,
            pan,
            tilt,
            transform
          },
          corpuscleCount: this.calculateCorpuscleCount(zoom),
          tokenCount: await this.estimateTokenCount(content, transform.tokenizer)
        }
      };
    } catch (error) {
      mcpDebugger.error('ZPT Navigation failed', error);
      throw error;
    }
  }

  async preview(query, zoom, pan) {
    try {
      mcpDebugger.debug('ZPT Preview starting', { query, zoom });

      // Quick analysis without full processing
      const availableZooms = ['entity', 'unit', 'text', 'community', 'corpus'];
      const contentCounts = {};
      
      for (const zoomLevel of availableZooms) {
        contentCounts[zoomLevel] = this.calculateCorpuscleCount(zoomLevel);
      }

      const estimatedTokens = this.estimateTokensForQuery(query, zoom || 'entity');
      const suggestedParams = this.suggestOptimalParameters(query, pan);

      return {
        success: true,
        preview: {
          query,
          availableZooms,
          contentCounts,
          estimatedTokens,
          suggestedParams,
          availableTilts: ['keywords', 'embedding', 'graph', 'temporal'],
          processingTime: Math.floor(Math.random() * 500) + 200 // Simulate quick processing
        }
      };
    } catch (error) {
      mcpDebugger.error('ZPT Preview failed', error);
      throw error;
    }
  }

  getSchema() {
    return {
      success: true,
      schema: {
        parameters: {
          query: {
            type: "string",
            required: true,
            description: "Navigation query for corpus exploration"
          },
          zoom: {
            type: "string",
            enum: ["entity", "unit", "text", "community", "corpus"],
            default: "entity",
            description: "Level of abstraction for content selection",
            details: {
              entity: "Individual entities and their properties",
              unit: "Semantic units containing related entities",
              text: "Raw text elements and content",
              community: "Community-level aggregations",
              corpus: "Corpus-wide summaries and overviews"
            }
          },
          pan: {
            type: "object",
            description: "Content filtering parameters",
            properties: {
              topic: { type: "string", description: "Topic-based filtering" },
              temporal: {
                type: "object",
                properties: {
                  start: { type: "string", format: "date", description: "Start date for temporal filtering" },
                  end: { type: "string", format: "date", description: "End date for temporal filtering" }
                }
              },
              geographic: {
                type: "object",
                properties: {
                  bbox: { 
                    type: "array",
                    items: { type: "number" },
                    minItems: 4,
                    maxItems: 4,
                    description: "Geographic bounding box [minLon, minLat, maxLon, maxLat]"
                  }
                }
              },
              entity: {
                type: "array",
                items: { type: "string" },
                description: "Specific entities to focus on"
              }
            }
          },
          tilt: {
            type: "string",
            enum: ["keywords", "embedding", "graph", "temporal"],
            default: "keywords",
            description: "Representation style for content",
            details: {
              keywords: "Keyword-based content representation",
              embedding: "Vector embedding-based similarity representation",
              graph: "Graph connectivity-based representation",
              temporal: "Temporal sequence-based representation"
            }
          },
          transform: {
            type: "object",
            description: "Output transformation options",
            properties: {
              maxTokens: { type: "number", min: 100, max: 16000, default: 4000 },
              format: { type: "string", enum: ["json", "markdown", "structured", "conversational"] },
              tokenizer: { type: "string", enum: ["cl100k_base", "p50k_base", "claude", "llama"] },
              chunkStrategy: { type: "string", enum: ["semantic", "adaptive", "fixed", "sliding"] },
              includeMetadata: { type: "boolean", default: true }
            }
          }
        },
        errorCodes: {
          ZPT_VALIDATION_ERROR: "Parameter validation failed",
          ZPT_CORPUS_ERROR: "Corpus access or processing error",
          ZPT_SELECTION_ERROR: "Content selection failed",
          ZPT_TRANSFORMATION_ERROR: "Content transformation failed",
          ZPT_MEMORY_ERROR: "Memory storage failed"
        }
      }
    };
  }

  validateParams(params) {
    try {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      // Validate query
      if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'query',
          message: 'Query is required and must be a non-empty string',
          code: 'MISSING_QUERY'
        });
      }

      // Validate zoom
      const validZooms = ['entity', 'unit', 'text', 'community', 'corpus'];
      if (params.zoom && !validZooms.includes(params.zoom)) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'zoom',
          message: `Invalid zoom level. Must be one of: ${validZooms.join(', ')}`,
          code: 'INVALID_ZOOM'
        });
      }

      // Validate tilt
      const validTilts = ['keywords', 'embedding', 'graph', 'temporal'];
      if (params.tilt && !validTilts.includes(params.tilt)) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'tilt',
          message: `Invalid tilt style. Must be one of: ${validTilts.join(', ')}`,
          code: 'INVALID_TILT'
        });
      }

      // Validate temporal range
      if (params.pan?.temporal) {
        const { start, end } = params.pan.temporal;
        if (start && end) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (startDate > endDate) {
            validationResult.valid = false;
            validationResult.errors.push({
              field: 'pan.temporal',
              message: 'Start date must be before end date',
              code: 'INVALID_TEMPORAL_RANGE'
            });
          }
        }
      }

      // Add suggestions
      if (params.zoom === 'corpus' && params.transform?.maxTokens > 8000) {
        validationResult.warnings.push({
          field: 'transform.maxTokens',
          message: 'High token count with corpus zoom may result in very general content',
          suggestion: 'Consider using a more focused zoom level for detailed content'
        });
      }

      return {
        success: true,
        validation: validationResult
      };
    } catch (error) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: error.message
      };
    }
  }

  async getOptions(context, query) {
    try {
      // Simulate corpus analysis to determine available options
      const options = {
        zoom: {
          levels: ['entity', 'unit', 'text', 'community', 'corpus'],
          recommendations: this.getZoomRecommendations(query)
        },
        pan: {
          availableDomains: ['technology', 'science', 'business', 'health', 'education'],
          availableEntities: this.getAvailableEntities(query),
          temporalRange: {
            earliest: '2020-01-01',
            latest: new Date().toISOString().split('T')[0],
            suggestions: ['last-year', 'last-month', 'last-week']
          }
        },
        tilt: {
          styles: ['keywords', 'embedding', 'graph', 'temporal'],
          recommendations: this.getTiltRecommendations(query)
        },
        transform: {
          tokenLimits: [1000, 2000, 4000, 8000, 16000],
          formats: ['json', 'markdown', 'structured', 'conversational'],
          tokenizers: ['cl100k_base', 'p50k_base', 'claude', 'llama'],
          chunkStrategies: ['semantic', 'adaptive', 'fixed', 'sliding']
        }
      };

      return {
        success: true,
        options,
        context: context,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      mcpDebugger.error('ZPT GetOptions failed', error);
      throw error;
    }
  }

  async analyzeCorpus(analysisType, includeStats) {
    try {
      const analysis = {
        analysisType,
        timestamp: new Date().toISOString(),
        structure: {},
        performance: {},
        recommendations: []
      };

      if (analysisType === 'structure' || analysisType === 'all') {
        analysis.structure = {
          totalEntities: Math.floor(Math.random() * 10000) + 1000,
          totalUnits: Math.floor(Math.random() * 5000) + 500,
          totalRelationships: Math.floor(Math.random() * 15000) + 2000,
          entityTypes: ['Person', 'Organization', 'Location', 'Concept', 'Event'],
          averageConnectivity: (Math.random() * 10 + 2).toFixed(2),
          clusteringCoefficient: (Math.random() * 0.5 + 0.3).toFixed(3)
        };
      }

      if (analysisType === 'performance' || analysisType === 'all') {
        analysis.performance = {
          averageSelectionTime: Math.floor(Math.random() * 200) + 100,
          averageTransformationTime: Math.floor(Math.random() * 300) + 150,
          cacheHitRate: (Math.random() * 0.4 + 0.6).toFixed(3),
          recommendedConcurrency: Math.floor(Math.random() * 4) + 2,
          optimalTokenRange: '2000-6000'
        };
      }

      if (analysisType === 'recommendations' || analysisType === 'all') {
        analysis.recommendations = [
          {
            category: 'Navigation',
            suggestion: 'Use entity zoom for specific information, unit zoom for contextual understanding',
            impact: 'medium'
          },
          {
            category: 'Performance',
            suggestion: 'Enable caching for repeated navigation patterns',
            impact: 'high'
          },
          {
            category: 'Content Quality',
            suggestion: 'Use semantic chunking for better content coherence',
            impact: 'medium'
          }
        ];
      }

      return {
        success: true,
        analysis,
        includeStats,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      mcpDebugger.error('ZPT AnalyzeCorpus failed', error);
      throw error;
    }
  }

  // Helper methods for simulation and content generation
  async simulateSelection(query, zoom, pan) {
    // Simulate selection time based on complexity
    const baseTime = 100;
    const complexityFactor = pan.entity?.length || 1;
    const zoomFactor = { entity: 1, unit: 1.5, text: 2, community: 1.2, corpus: 0.8 }[zoom] || 1;
    
    return Math.floor(baseTime * complexityFactor * zoomFactor + Math.random() * 50);
  }

  async simulateProjection(zoom, tilt) {
    const tiltComplexity = { keywords: 0.8, embedding: 1.5, graph: 2.0, temporal: 1.2 };
    const baseTime = 80;
    
    return Math.floor(baseTime * (tiltComplexity[tilt] || 1) + Math.random() * 40);
  }

  async simulateTransformation(transform) {
    const formatComplexity = { json: 0.5, markdown: 1.0, structured: 1.2, conversational: 1.8 };
    const tokenFactor = Math.log(transform.maxTokens / 1000);
    const baseTime = 120;
    
    return Math.floor(baseTime * (formatComplexity[transform.format] || 1) * tokenFactor + Math.random() * 60);
  }

  async generateNavigationContent(query, zoom, pan, tilt, transform) {
    // Generate realistic navigation content based on parameters
    const content = {
      query,
      zoom,
      tilt,
      results: []
    };

    const count = this.calculateCorpuscleCount(zoom);
    
    for (let i = 0; i < count; i++) {
      const item = {
        id: `item_${i + 1}`,
        type: this.getItemType(zoom),
        title: `${query} - ${zoom} result ${i + 1}`,
        content: this.generateItemContent(query, zoom, tilt),
        metadata: {
          relevance: (Math.random() * 0.3 + 0.7).toFixed(3),
          source: `corpus_${Math.floor(Math.random() * 100)}`,
          timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      if (transform.includeMetadata) {
        item.navigation = { zoom, pan, tilt };
      }

      content.results.push(item);
    }

    return content;
  }

  calculateCorpuscleCount(zoom) {
    const counts = { entity: 5, unit: 12, text: 20, community: 8, corpus: 3 };
    return counts[zoom] || 5;
  }

  getItemType(zoom) {
    const types = {
      entity: 'ragno:Entity',
      unit: 'ragno:SemanticUnit', 
      text: 'ragno:TextElement',
      community: 'ragno:CommunityElement',
      corpus: 'ragno:CorpusElement'
    };
    return types[zoom] || 'ragno:Element';
  }

  generateItemContent(query, zoom, tilt) {
    const templates = {
      keywords: `Keywords related to "${query}": artificial intelligence, machine learning, neural networks, deep learning, natural language processing`,
      embedding: `Vector representation of "${query}" with high similarity to: computational intelligence, algorithmic learning, pattern recognition`,
      graph: `Graph connectivity for "${query}": connected to AI research (strength: 0.85), machine learning (0.92), cognitive science (0.73)`,
      temporal: `Temporal context for "${query}": significant developments in 2010s-2020s, peak interest 2017-2019, ongoing evolution`
    };
    
    return templates[tilt] || `Content for "${query}" at ${zoom} level`;
  }

  async estimateTokenCount(content, tokenizer) {
    // Rough token estimation
    const jsonStr = JSON.stringify(content);
    const estimatedTokens = Math.floor(jsonStr.length / 4); // Rough approximation
    return estimatedTokens;
  }

  async storeNavigationResult(query, params, content) {
    try {
      // Store the navigation result as a memory item
      const memoryItem = {
        prompt: `ZPT Navigation: ${query}`,
        response: JSON.stringify(content),
        metadata: {
          type: 'zpt_navigation',
          zoom: params.zoom,
          pan: params.pan,
          tilt: params.tilt,
          transform: params.transform,
          timestamp: new Date().toISOString(),
          corpuscleCount: content.results?.length || 0
        }
      };

      await this.safeOps.storeInteraction(
        memoryItem.prompt,
        memoryItem.response,
        memoryItem.metadata
      );
    } catch (error) {
      mcpDebugger.warn('Failed to store navigation result in memory', error);
      // Don't throw - navigation can succeed even if storage fails
    }
  }

  estimateTokensForQuery(query, zoom) {
    const baseTokens = { entity: 500, unit: 1200, text: 2000, community: 800, corpus: 300 };
    const queryComplexity = Math.min(query.split(' ').length / 5, 2);
    return Math.floor((baseTokens[zoom] || 500) * (1 + queryComplexity));
  }

  suggestOptimalParameters(query, pan) {
    return {
      recommendedZoom: query.length > 50 ? 'unit' : 'entity',
      recommendedTilt: pan.temporal ? 'temporal' : 'keywords',
      recommendedMaxTokens: 4000,
      reasoning: 'Based on query complexity and filtering parameters'
    };
  }

  getZoomRecommendations(query) {
    return {
      entity: 'Best for specific entity information and properties',
      unit: 'Recommended for contextual understanding',
      text: 'Use for detailed textual content',
      community: 'Good for topic-level insights',
      corpus: 'Use for high-level overviews'
    };
  }

  getAvailableEntities(query) {
    // Simulate entity suggestions based on query
    const entities = ['artificial-intelligence', 'machine-learning', 'neural-networks', 'deep-learning'];
    return entities.filter(e => !query || e.includes(query.toLowerCase().replace(/\s+/g, '-')));
  }

  getTiltRecommendations(query) {
    return {
      keywords: 'Fast keyword-based representation',
      embedding: 'Best for semantic similarity',
      graph: 'Use for relationship exploration',
      temporal: 'Recommended for time-based analysis'
    };
  }
}

/**
 * Register ZPT tools using HTTP version pattern
 */
export function registerZPTTools(server) {
  mcpDebugger.info('Registering ZPT tools...');

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: ZPTToolName.NAVIGATE,
          description: "3-dimensional knowledge graph navigation using Zoom/Pan/Tilt spatial metaphors",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Navigation query for corpus exploration"
              },
              zoom: {
                type: "string",
                enum: ["entity", "unit", "text", "community", "corpus"],
                description: "Level of abstraction for content selection (default: entity)"
              },
              pan: {
                type: "object",
                properties: {
                  topic: { type: "string", description: "Topic-based filtering" },
                  temporal: {
                    type: "object",
                    properties: {
                      start: { type: "string", description: "Start date for temporal filtering" },
                      end: { type: "string", description: "End date for temporal filtering" }
                    }
                  },
                  geographic: {
                    type: "object",
                    properties: {
                      bbox: { 
                        type: "array",
                        items: { type: "number" },
                        description: "Geographic bounding box [minLon, minLat, maxLon, maxLat]"
                      }
                    }
                  },
                  entity: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific entities to focus on"
                  }
                },
                description: "Content filtering parameters"
              },
              tilt: {
                type: "string",
                enum: ["keywords", "embedding", "graph", "temporal"],
                description: "Representation style for content (default: keywords)"
              },
              transform: {
                type: "object",
                properties: {
                  maxTokens: { 
                    type: "number", 
                    minimum: 100, 
                    maximum: 16000,
                    description: "Token budget for output (default: 4000)"
                  },
                  format: { 
                    type: "string", 
                    enum: ["json", "markdown", "structured", "conversational"],
                    description: "Output format (default: json)"
                  },
                  tokenizer: { 
                    type: "string", 
                    enum: ["cl100k_base", "p50k_base", "claude", "llama"],
                    description: "Tokenizer for counting (default: cl100k_base)"
                  },
                  chunkStrategy: { 
                    type: "string", 
                    enum: ["semantic", "adaptive", "fixed", "sliding"],
                    description: "Chunking strategy (default: semantic)"
                  },
                  includeMetadata: { 
                    type: "boolean",
                    description: "Include navigation metadata (default: true)"
                  }
                },
                description: "Output transformation options"
              }
            },
            required: ["query"]
          }
        },
        {
          name: ZPTToolName.PREVIEW,
          description: "Preview ZPT navigation options and estimated results without full processing",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Navigation query for preview analysis"
              },
              zoom: {
                type: "string",
                enum: ["entity", "unit", "text", "community", "corpus"],
                description: "Optional zoom level for preview"
              },
              pan: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  temporal: { type: "object" },
                  geographic: { type: "object" },
                  entity: { type: "array", items: { type: "string" } }
                },
                description: "Optional filtering parameters for preview"
              }
            },
            required: ["query"]
          }
        },
        {
          name: ZPTToolName.GET_SCHEMA,
          description: "Get complete ZPT parameter schema and documentation",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: ZPTToolName.VALIDATE_PARAMS,
          description: "Validate ZPT parameters with detailed error reporting and suggestions",
          inputSchema: {
            type: "object",
            properties: {
              params: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  zoom: { type: "string" },
                  pan: { type: "object" },
                  tilt: { type: "string" },
                  transform: { type: "object" }
                },
                description: "ZPT parameters to validate"
              }
            },
            required: ["params"]
          }
        },
        {
          name: ZPTToolName.GET_OPTIONS,
          description: "Get available parameter values for current corpus state",
          inputSchema: {
            type: "object",
            properties: {
              context: {
                type: "string",
                enum: ["current", "full"],
                description: "Context scope for options (default: current)"
              },
              query: {
                type: "string",
                description: "Optional query for contextual options"
              }
            }
          }
        },
        {
          name: ZPTToolName.ANALYZE_CORPUS,
          description: "Analyze corpus structure for ZPT navigation optimization",
          inputSchema: {
            type: "object",
            properties: {
              analysisType: {
                type: "string",
                enum: ["structure", "performance", "recommendations"],
                description: "Type of analysis to perform (default: structure)"
              },
              includeStats: {
                type: "boolean",
                description: "Include detailed statistics (default: true)"
              }
            }
          }
        }
      ]
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const zptService = new ZPTNavigationService(memoryManager, safeOps);

      if (name === ZPTToolName.NAVIGATE) {
        const { query, zoom, pan, tilt, transform } = ZPTNavigateSchema.parse(args);
        
        const result = await zptService.navigate(query, zoom, pan, tilt, transform);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      if (name === ZPTToolName.PREVIEW) {
        const { query, zoom, pan } = ZPTPreviewSchema.parse(args);
        
        const result = await zptService.preview(query, zoom, pan);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      if (name === ZPTToolName.GET_SCHEMA) {
        const result = zptService.getSchema();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      if (name === ZPTToolName.VALIDATE_PARAMS) {
        const { params } = ZPTValidateParamsSchema.parse(args);
        
        const result = zptService.validateParams(params);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      if (name === ZPTToolName.GET_OPTIONS) {
        const { context, query } = ZPTGetOptionsSchema.parse(args);
        
        const result = await zptService.getOptions(context, query);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      if (name === ZPTToolName.ANALYZE_CORPUS) {
        const { analysisType, includeStats } = ZPTAnalyzeCorpusSchema.parse(args);
        
        const result = await zptService.analyzeCorpus(analysisType, includeStats);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      throw new Error(`Unknown ZPT tool: ${name}`);

    } catch (error) {
      mcpDebugger.error(`ZPT tool ${name} failed:`, error);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.name || 'UNKNOWN_ERROR',
            message: error.message,
            tool: name
          }, null, 2)
        }]
      };
    }
  });

  mcpDebugger.info('ZPT tools registered successfully');
}

export { ZPTToolName };