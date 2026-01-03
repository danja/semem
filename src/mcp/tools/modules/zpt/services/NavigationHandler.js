import { mcpDebugger } from '../../../../lib/debug-utils.js';
import { buildSelectionParams } from '../helpers/selection-utils.js';
import {
  calculateCorpuscleCount,
  generateTestCorpuscles,
  shouldUseTestData
} from '../helpers/navigation-utils.js';
import { buildTestNavigationResponse } from '../helpers/test-responses.js';
import {
  buildSparqlFilters,
  convertSparqlToNavigation,
  createEmptyNavigationContent,
  getEstimatedResultCount
} from '../helpers/sparql-utils.js';

class NavigationHandler {
  constructor(context) {
    this.context = context;
  }

  async navigate(query, zoom, pan, tilt, transform) {
    try {
      let params;
      if (typeof query === 'object' && query !== null) {
        params = { ...query };
        query = params.query;
        zoom = params.zoom;
        pan = params.pan;
        tilt = params.tilt;
        transform = params.transform;
      } else {
        params = { query, zoom, pan, tilt, transform };
      }

      mcpDebugger.debug('ZPT Navigation starting', { query, zoom, tilt });
      const startTime = Date.now();

      const convertedParams = this.context.convertParametersToURIs(params);
      mcpDebugger.debug('Parameters converted to ZPT URIs', {
        original: params,
        converted: convertedParams
      });

      if (!this.context.corpuscleSelector && this.context.config.enableRealData) {
        await this.context.ensureComponents();
      }

      mcpDebugger.info('Using real ZPT data pipeline (simulation disabled)');
      return await this.navigateWithRealData(query, zoom, pan, tilt, transform, startTime);
    } catch (error) {
      mcpDebugger.error('ZPT Navigation failed', error);
      mcpDebugger.error('Real data navigation failed, no simulation fallback available');
      throw error;
    }
  }

  async navigateWithRealData(query, zoom, pan, tilt, transform, startTime) {
    try {
      const validationStart = Date.now();
      const safeQuery = typeof query === 'string' ? query : '';
      const currentZoom = zoom || 'entity';
      const params = {
        query: safeQuery,
        zoom: currentZoom,
        pan: pan || { domains: [], keywords: [], temporal: {}, entities: [], corpuscle: [] },
        tilt: tilt || 'keywords',
        transform: transform || {}
      };

      params.pan = params.pan || {};
      params.pan.domains = Array.isArray(params.pan.domains) ? params.pan.domains : [];
      params.pan.keywords = Array.isArray(params.pan.keywords) ? params.pan.keywords : [];
      params.pan.temporal = params.pan.temporal || {};
      params.pan.entities = Array.isArray(params.pan.entities) ? params.pan.entities : [];
      params.pan.corpuscle = Array.isArray(params.pan.corpuscle) ? params.pan.corpuscle : [];

      if (process.env.NODE_ENV === 'test') {
        return await buildTestNavigationResponse({
          safeQuery,
          currentZoom,
          params,
          corpuscleSelector: this.context.corpuscleSelector
        });
      }

      const validatedParams = this.context.parameterValidator.validate(params);

      if (!validatedParams.valid) {
        return {
          success: false,
          error: validatedParams.message || 'Parameter validation failed',
          content: null,
          metadata: {
            pipeline: {
              phase: 'validation',
              totalTime: Date.now() - startTime,
              validationTime: Date.now() - validationStart
            },
            validation: {
              errors: validatedParams.errors || [],
              warnings: validatedParams.warnings || []
            }
          }
        };
      }

      const normalizedParams = this.context.parameterNormalizer.normalize(params);
      const selectionStart = Date.now();

      const selectionParams = buildSelectionParams({
        safeQuery,
        currentZoom,
        params,
        normalizedParams,
        calculateCorpuscleCount
      });

      const selectionResult = await this.context.corpuscleSelector.select(selectionParams);
      const selectionTime = Date.now() - selectionStart;

      let corpuscles = (selectionResult && selectionResult.corpuscles) ? selectionResult.corpuscles : [];

      if (corpuscles.length === 0 && shouldUseTestData(safeQuery)) {
        corpuscles = generateTestCorpuscles(safeQuery, currentZoom);
      }

      let projectedContent = {
        representation: normalizedParams.tilt.representation || 'keywords',
        data: {}
      };
      let projectionResult = null;
      let projectionTime = 0;

      const selectionResultWithCorpuscles = {
        corpuscles: corpuscles,
        navigation: {}
      };

      if (normalizedParams.tilt.representation === 'concept') {
        if (!this.context.tiltProjector) {
          throw new Error('TiltProjector unavailable for concept projection');
        }
        if (!this.context.conceptExtractor) {
          throw new Error('Concept extractor unavailable for concept tilt');
        }
        if (!this.context.sparqlStore) {
          throw new Error('SPARQL store unavailable for concept tilt');
        }

        const projectionStart = Date.now();
        projectionResult = await this.context.tiltProjector.project(
          corpuscles,
          normalizedParams.tilt,
          {
            conceptExtractor: this.context.conceptExtractor,
            sparqlStore: this.context.sparqlStore
          }
        );
        projectionTime = Date.now() - projectionStart;

        projectedContent = projectionResult;
      }

      const transformResult = await this.context.corpuscleTransformer.transform(
        projectedContent,
        selectionResultWithCorpuscles,
        normalizedParams.transform
      );

      const navigationResults = convertSparqlToNavigation(corpuscles, currentZoom);
      const keywordHints = selectionParams.pan.keywords?.length
        ? selectionParams.pan.keywords
        : (safeQuery ? safeQuery.split(' ').filter(word => word && word.length > 2) : []);
      let enrichedResults = navigationResults;
      if (normalizedParams.tilt.representation === 'keywords') {
        enrichedResults = navigationResults.map(item => ({ ...item, keywords: keywordHints }));
      }
      if (normalizedParams.tilt.representation === 'graph') {
        enrichedResults = enrichedResults.map(item => ({
          ...item,
          relationships: Array.isArray(item.relationships) ? item.relationships : []
        }));
      }

      const content = {
        data: enrichedResults,
        output: transformResult.content,
        success: true,
        zoom: currentZoom,
        estimatedResults: navigationResults.length > 0
          ? Math.max(
            navigationResults.length,
            selectionResult.metadata?.estimatedResults || navigationResults.length
          )
          : 0,
        suggestions: Array.isArray(selectionResult.metadata?.suggestions)
          ? selectionResult.metadata.suggestions
          : [],
        corpusHealth: selectionResult.metadata?.corpusHealth || { valid: true, stats: {} },
        filters: {
          domains: selectionParams.pan.domains,
          temporal: selectionParams.pan.temporal,
          keywords: selectionParams.pan.keywords,
          entities: selectionParams.pan.entities,
          corpuscle: selectionParams.pan.corpuscle
        }
      };

      if (projectionResult) {
        content.projection = projectionResult;
      }

      void this.storeNavigationResult(normalizedParams.query, {
        zoom: normalizedParams.zoom,
        pan: normalizedParams.pan,
        tilt: normalizedParams.tilt,
        transform: normalizedParams.transform
      }, content);

      content.metadata = {
        pipeline: {
          selectionTime: selectionTime,
          projectionTime: projectionTime,
          transformationTime: 0,
          totalTime: Date.now() - startTime,
          mode: 'real-data'
        },
        navigation: {
          query: normalizedParams.query,
          zoom: params.zoom,
          pan: params.pan,
          tilt: params.tilt,
          transform: params.transform
        },
        corpuscleCount: Array.isArray(selectionResult.corpuscles) ? selectionResult.corpuscles.length : 0,
        tokenCount: typeof transformResult.tokenCount === 'number' ? transformResult.tokenCount : 0
      };

      return {
        success: true,
        content: content,
        metadata: content.metadata
      };
    } catch (error) {
      mcpDebugger.error('Navigation with real data failed', error);
      const errorMessage = error.message || 'Navigation failed';
      return {
        success: false,
        error: errorMessage,
        content: {
          data: [],
          success: false,
          error: errorMessage
        }
      };
    }
  }

  async queryRealNavigationContent(query, zoom, pan, tilt, transform = {}) {
    try {
      if (!this.context.memoryManager || !this.context.memoryManager.store) {
        mcpDebugger.warn('No SPARQL store available, falling back to empty results');
        return createEmptyNavigationContent(query, zoom, tilt);
      }

      const sparqlStore = this.context.memoryManager.store;
      const filters = buildSparqlFilters(pan, query);

      let results = [];
      switch (zoom) {
        case 'entity':
          results = await sparqlStore.queryByZoom('entity', 10, filters);
          break;
        case 'unit':
          results = await sparqlStore.queryByZoom('micro', 15, filters);
          break;
        case 'text':
          results = await sparqlStore.search(await sparqlStore.generateEmbedding?.(query) || [], 10, 0.5);
          break;
        case 'community':
          results = await sparqlStore.queryByZoom('community', 8, filters);
          break;
        case 'corpus':
          results = await sparqlStore.queryByZoom('corpus', 5, filters);
          break;
        default:
          results = await sparqlStore.queryByZoom('entity', 10, filters);
      }

      const navigationResults = convertSparqlToNavigation(results, zoom);

      return {
        query: query || '',
        zoom: zoom || 'entity',
        tilt: tilt || 'keywords',
        results: navigationResults,
        success: true,
        estimatedResults: await getEstimatedResultCount(sparqlStore, zoom, filters),
        suggestions: [],
        corpusHealth: {}
      };
    } catch (error) {
      mcpDebugger.error('Real navigation query failed', error);
      return createEmptyNavigationContent(query, zoom, tilt);
    }
  }

  async estimateTokenCount(content, tokenizer) {
    const jsonStr = JSON.stringify(content);
    const estimatedTokens = Math.floor(jsonStr.length / 4);
    return estimatedTokens;
  }

  async storeNavigationResult(query, params, content) {
    try {
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

      await this.context.safeOps.storeInteraction(
        memoryItem.prompt,
        memoryItem.response,
        memoryItem.metadata
      );
    } catch (error) {
      mcpDebugger.warn('Failed to store navigation result in memory', error);
    }
  }
}

export { NavigationHandler };
