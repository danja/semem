import { mcpDebugger } from '../../../../lib/debug-utils.js';
import {
  calculateCorpuscleCount,
  estimateTokensForQuery,
  suggestOptimalParameters
} from '../helpers/navigation-utils.js';
import { buildTestPreviewResponse } from '../helpers/test-responses.js';

class PreviewHandler {
  constructor(context) {
    this.context = context;
  }

  async preview(query, zoom, pan) {
    try {
      mcpDebugger.debug('ZPT Preview starting', { query, zoom });
      const startTime = Date.now();

      const preview = await this.previewWithRealData(query, zoom, pan);
      preview.processingTime = Date.now() - startTime;

      return {
        success: true,
        preview
      };
    } catch (error) {
      mcpDebugger.error('ZPT Preview failed', error);
      throw error;
    }
  }

  async previewWithRealData(query, zoom, pan) {
    try {
      const queryStr = typeof query === 'string' ? query : '';
      const zoomLevel = typeof zoom === 'string' ? zoom : 'entity';

      if (process.env.NODE_ENV === 'test') {
        return await buildTestPreviewResponse({
          queryStr,
          zoomLevel,
          pan,
          corpuscleSelector: this.context.corpuscleSelector
        });
      }

      const sparqlStore = this.context.memoryManager?.store;
      if (!sparqlStore) {
        throw new Error('Missing SPARQL store for ZPT preview');
      }

      let corpusStats = { valid: true, stats: { entityCount: 100 } };
      let estimatedResults = 100;

      try {
        corpusStats = await sparqlStore.validateCorpus();

        if (corpusStats?.stats?.entityCount) {
          estimatedResults = Number(corpusStats.stats.entityCount);
        }

        if (isNaN(estimatedResults) || estimatedResults <= 0) {
          const defaultCounts = {
            entity: 1000,
            unit: 500,
            text: 250,
            micro: 250,
            community: 100,
            corpus: 1
          };
          estimatedResults = defaultCounts[zoomLevel] || 100;
        }
      } catch (error) {
        mcpDebugger.warn('Failed to validate corpus', error);
      }

      const availableZooms = ['entity', 'unit', 'text', 'community', 'corpus'];
      const contentCounts = {};
      for (const level of availableZooms) {
        try {
          const count = calculateCorpuscleCount(level);
          contentCounts[level] = typeof count === 'number' ? count : 0;
        } catch (error) {
          contentCounts[level] = 0;
          mcpDebugger.warn(`Failed to get count for zoom level ${level}`, error);
        }
      }

      let estimatedTokens = 0;
      let suggestedParams = [];
      try {
        estimatedTokens = estimateTokensForQuery(queryStr, zoomLevel) || 0;
        suggestedParams = Array.isArray(suggestOptimalParameters(queryStr, pan || {}))
          ? suggestOptimalParameters(queryStr, pan || {})
          : [];
      } catch (error) {
        mcpDebugger.warn('Failed to estimate tokens or get suggested params', error);
      }

      return {
        success: true,
        query: queryStr,
        zoom: zoomLevel,
        estimatedResults: Number(estimatedResults),
        suggestions: [],
        corpusHealth: corpusStats || { valid: false, stats: {} },
        availableZooms,
        contentCounts,
        estimatedTokens: Number(estimatedTokens) || 0,
        suggestedParams,
        availableTilts: ['keywords', 'embedding', 'graph', 'temporal'],
        dataSource: 'real-corpus'
      };
    } catch (error) {
      mcpDebugger.error('Failed to generate real preview, no simulation fallback available', error);
      throw error;
    }
  }

  async previewWithSimulation(query, zoom, pan) {
    const availableZooms = ['entity', 'unit', 'text', 'community', 'corpus'];
    const contentCounts = {};

    for (const zoomLevel of availableZooms) {
      contentCounts[zoomLevel] = calculateCorpuscleCount(zoomLevel);
    }

    const estimatedTokens = estimateTokensForQuery(query, zoom || 'entity');
    const suggestedParams = suggestOptimalParameters(query, pan);

    return {
      query,
      availableZooms,
      contentCounts,
      estimatedTokens,
      suggestedParams,
      availableTilts: ['keywords', 'embedding', 'graph', 'temporal'],
      dataSource: 'simulated'
    };
  }
}

export { PreviewHandler };
