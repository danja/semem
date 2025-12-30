import { initializeServices, getMemoryManager } from '../../../lib/initialization.js';
import { SafeOperations } from '../../../lib/safe-operations.js';
import { mcpDebugger } from '../../../lib/debug-utils.js';
import { ZPTContext } from './context/ZPTContext.js';
import { NavigationHandler } from './services/NavigationHandler.js';
import { PreviewHandler } from './services/PreviewHandler.js';
import { AnalysisHandler } from './services/AnalysisHandler.js';
import {
  getAvailableEntities,
  getTiltRecommendations,
  getZoomRecommendations,
  validateNavigationParams
} from './helpers/navigation-utils.js';

class ZPTNavigationService {
  constructor(memoryManager, safeOps) {
    this.context = new ZPTContext({ memoryManager, safeOps });
    this.navigationHandler = new NavigationHandler(this.context);
    this.previewHandler = new PreviewHandler(this.context);
    this.analysisHandler = new AnalysisHandler(this.context);
  }

  get memoryManager() {
    return this.context.memoryManager;
  }

  set memoryManager(memoryManager) {
    this.context.setMemoryManager(memoryManager);
  }

  get safeOps() {
    return this.context.safeOps;
  }

  set safeOps(safeOps) {
    this.context.setSafeOps(safeOps);
  }

  async navigate(query, zoom, pan, tilt, transform) {
    return this.navigationHandler.navigate(query, zoom, pan, tilt, transform);
  }

  async navigateWithRealData(query, zoom, pan, tilt, transform, startTime) {
    return this.navigationHandler.navigateWithRealData(query, zoom, pan, tilt, transform, startTime);
  }

  async queryRealNavigationContent(query, zoom, pan, tilt, transform = {}) {
    return this.navigationHandler.queryRealNavigationContent(query, zoom, pan, tilt, transform);
  }

  async estimateTokenCount(content, tokenizer) {
    return this.navigationHandler.estimateTokenCount(content, tokenizer);
  }

  async storeNavigationResult(query, params, content) {
    return this.navigationHandler.storeNavigationResult(query, params, content);
  }

  async preview(query, zoom, pan) {
    return this.previewHandler.preview(query, zoom, pan);
  }

  async previewWithRealData(query, zoom, pan) {
    return this.previewHandler.previewWithRealData(query, zoom, pan);
  }

  async previewWithSimulation(query, zoom, pan) {
    return this.previewHandler.previewWithSimulation(query, zoom, pan);
  }

  async analyzeCorpus(analysisType, includeStats) {
    return this.analysisHandler.analyzeCorpus(analysisType, includeStats);
  }

  async analyzeCorpusWithRealData(analysisType, includeStats) {
    return this.analysisHandler.analyzeCorpusWithRealData(analysisType, includeStats);
  }

  async analyzeCorpusWithSimulation(analysisType, includeStats) {
    return this.analysisHandler.analyzeCorpusWithSimulation(analysisType, includeStats);
  }

  getSchema() {
    return {
      success: true,
      schema: {
        parameters: {
          query: {
            type: 'string',
            required: true,
            description: 'Navigation query for corpus exploration'
          },
          zoom: {
            type: 'string',
            enum: ['entity', 'unit', 'text', 'community', 'corpus'],
            default: 'entity',
            description: 'Level of abstraction for content selection',
            details: {
              entity: 'Individual entities and their properties',
              unit: 'Semantic units containing related entities',
              text: 'Raw text elements and content',
              community: 'Community-level aggregations',
              corpus: 'Corpus-wide summaries and overviews'
            }
          },
          pan: {
            type: 'object',
            description: 'Content filtering parameters',
            properties: {
              topic: { type: 'string', description: 'Topic-based filtering' },
              temporal: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date', description: 'Start date for temporal filtering' },
                  end: { type: 'string', format: 'date', description: 'End date for temporal filtering' }
                }
              },
              geographic: {
                type: 'object',
                properties: {
                  bbox: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 4,
                    maxItems: 4,
                    description: 'Geographic bounding box [minLon, minLat, maxLon, maxLat]'
                  }
                }
              },
              entity: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific entities to focus on'
              }
            }
          },
          tilt: {
            type: 'string',
            enum: ['keywords', 'embedding', 'graph', 'temporal'],
            default: 'keywords',
            description: 'Representation style for content',
            details: {
              keywords: 'Keyword-based content representation',
              embedding: 'Vector embedding-based similarity representation',
              graph: 'Graph connectivity-based representation',
              temporal: 'Temporal sequence-based representation'
            }
          },
          transform: {
            type: 'object',
            description: 'Output transformation options',
            properties: {
              maxTokens: { type: 'number', min: 100, max: 16000, default: 4000 },
              format: { type: 'string', enum: ['json', 'markdown', 'structured', 'conversational'] },
              tokenizer: { type: 'string', enum: ['cl100k_base', 'p50k_base', 'claude', 'llama'] },
              chunkStrategy: { type: 'string', enum: ['semantic', 'adaptive', 'fixed', 'sliding'] },
              includeMetadata: { type: 'boolean', default: true }
            }
          }
        },
        errorCodes: {
          ZPT_VALIDATION_ERROR: 'Parameter validation failed',
          ZPT_CORPUS_ERROR: 'Corpus access or processing error',
          ZPT_SELECTION_ERROR: 'Content selection failed',
          ZPT_TRANSFORMATION_ERROR: 'Content transformation failed',
          ZPT_MEMORY_ERROR: 'Memory storage failed'
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

      if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'query',
          message: 'Query is required and must be a non-empty string',
          code: 'MISSING_QUERY'
        });
      }

      const validZooms = ['entity', 'unit', 'text', 'community', 'corpus'];
      if (params.zoom && !validZooms.includes(params.zoom)) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'zoom',
          message: `Invalid zoom level. Must be one of: ${validZooms.join(', ')}`,
          code: 'INVALID_ZOOM'
        });
      }

      const validTilts = ['keywords', 'embedding', 'graph', 'temporal'];
      if (params.tilt && !validTilts.includes(params.tilt)) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'tilt',
          message: `Invalid tilt style. Must be one of: ${validTilts.join(', ')}`,
          code: 'INVALID_TILT'
        });
      }

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
      const options = {
        zoom: {
          levels: ['entity', 'unit', 'text', 'community', 'corpus'],
          recommendations: getZoomRecommendations(query)
        },
        pan: {
          availableDomains: ['technology', 'science', 'business', 'health', 'education'],
          availableEntities: getAvailableEntities(query),
          temporalRange: {
            earliest: '2020-01-01',
            latest: new Date().toISOString().split('T')[0],
            suggestions: ['last-year', 'last-month', 'last-week']
          }
        },
        tilt: {
          styles: ['keywords', 'embedding', 'graph', 'temporal'],
          recommendations: getTiltRecommendations(query)
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

  validateNavigationParams(params = {}) {
    return validateNavigationParams(params);
  }
}

export { ZPTNavigationService };

export async function buildZPTService() {
  await initializeServices();
  const memoryManager = getMemoryManager();
  const safeOps = new SafeOperations(memoryManager);
  const service = new ZPTNavigationService();
  service.memoryManager = memoryManager;
  service.safeOps = safeOps;
  return service;
}
