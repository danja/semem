import { mcpDebugger } from '../../../../lib/debug-utils.js';

export function buildSparqlFilters(pan, query) {
  const filters = {};

  if (pan && typeof pan === 'object') {
    if (pan.domains && Array.isArray(pan.domains)) {
      filters.domains = pan.domains;
    }
    if (pan.keywords && Array.isArray(pan.keywords)) {
      filters.keywords = pan.keywords;
    }
    if (pan.entities && Array.isArray(pan.entities)) {
      filters.entities = pan.entities;
    }
    if (pan.temporal) {
      filters.temporal = pan.temporal;
    }
  }

  if (query && query.trim()) {
    filters.textSearch = query.trim();
  }

  return filters;
}

export function convertSparqlToNavigation(sparqlResults, zoom) {
  if (!Array.isArray(sparqlResults)) {
    return [];
  }

  return sparqlResults.map((result, index) => {
    const contentLabel = result.content?.label || result.content?.prefLabel || result.content?.content;
    const contentText = result.content?.content || result.content?.prefLabel || result.content?.label;

    if (result.uri || result.id) {
      return {
        id: result.uri || result.id,
        label: contentLabel || result.label || result.prefLabel || `${zoom} item ${index + 1}`,
        content: contentText || result.content || '',
        type: zoom,
        score: result.similarity || result.score || (1 - index * 0.1).toFixed(2),
        metadata: {
          relevance: result.similarity || result.relevance || '0.500',
          source: result.source || 'sparql',
          timestamp: result.timestamp || new Date().toISOString(),
          type: result.type || zoom
        }
      };
    }

    return {
      id: result.id || `memory_${Math.random().toString(36).substring(2, 10)}`,
      label: contentLabel || result.prompt || result.label || `${zoom} item ${index + 1}`,
      content: contentText || result.response || result.content || '',
      type: zoom,
      score: result.similarity || (1 - index * 0.1).toFixed(2),
      metadata: {
        relevance: result.similarity || '0.500',
        source: 'memory',
        timestamp: result.timestamp || new Date().toISOString(),
        content: result.response || result.content
      }
    };
  });
}

export async function getEstimatedResultCount(sparqlStore, zoom, filters) {
  try {
    if (sparqlStore.getGraphStats) {
      const stats = await sparqlStore.getGraphStats();
      const zoomCounts = {
        entity: stats.entityCount || 0,
        unit: stats.unitCount || 0,
        text: stats.unitCount || 0,
        community: stats.communityCount || 0,
        corpus: stats.corpusCount || 1
      };
      return zoomCounts[zoom] || 0;
    }
    return 0;
  } catch (error) {
    mcpDebugger.warn('Could not get estimated result count', error);
    return 0;
  }
}

export function createEmptyNavigationContent(query, zoom, tilt) {
  return {
    query: query || '',
    zoom: zoom || 'entity',
    tilt: tilt || 'keywords',
    results: [],
    success: true,
    estimatedResults: 0,
    suggestions: [],
    corpusHealth: {}
  };
}
