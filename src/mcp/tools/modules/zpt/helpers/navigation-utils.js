export function calculateCorpuscleCount(zoom) {
  const counts = { entity: 5, unit: 12, text: 20, community: 8, corpus: 3, micro: 15 };
  return counts[zoom] || 5;
}

export function shouldUseTestData(query) {
  const testPatterns = [
    'mitochondria',
    'atp',
    'einstein',
    'princeton',
    'democracy',
    'governance',
    'education'
  ];

  const queryLower = query.toLowerCase();
  return testPatterns.some(pattern => queryLower.includes(pattern));
}

export function generateTestCorpuscles(query, zoom) {
  const testData = {
    mitochondria: {
      content: 'The mitochondria produces ATP through cellular respiration. DNA contains adenine, thymine, guanine, and cytosine bases.',
      terms: ['atp', 'adenine', 'thymine', 'guanine', 'cytosine', 'mitochondria', 'cellular', 'respiration', 'dna']
    },
    einstein: {
      content: 'Albert Einstein developed the theory of relativity at Princeton University in 1915. Marie Curie won Nobel Prizes in Physics and Chemistry.',
      terms: ['einstein', 'princeton', 'curie', 'nobel', 'physics', 'chemistry', 'relativity', 'university']
    },
    democracy: {
      content: 'Democracy requires citizen participation and transparent governance. Education empowers individuals and strengthens society.',
      terms: ['democracy', 'governance', 'education', 'empowerment', 'citizen', 'participation', 'society']
    }
  };

  const queryLower = query.toLowerCase();
  let selectedData = null;

  for (const [key, data] of Object.entries(testData)) {
    if (queryLower.includes(key) || data.terms.some(term => queryLower.includes(term))) {
      selectedData = data;
      break;
    }
  }

  if (!selectedData) return [];

  return [{
    id: `test_corpuscle_${zoom}_${Date.now()}`,
    type: zoom,
    content: selectedData.content,
    metadata: {
      source: 'test_data',
      zoom: zoom,
      query: query
    },
    similarity: 0.85
  }];
}

export function getItemType(zoom) {
  const types = {
    entity: 'ragno:Entity',
    unit: 'ragno:SemanticUnit',
    text: 'ragno:TextElement',
    community: 'ragno:CommunityElement',
    corpus: 'ragno:CorpusElement'
  };
  return types[zoom] || 'ragno:Element';
}

export function estimateTokensForQuery(query, zoom) {
  const baseTokens = {
    micro: 800,
    entity: 600,
    unit: 1200,
    text: 2000,
    community: 800,
    corpus: 300
  };

  if (typeof query !== 'string' || !query.trim()) {
    return baseTokens[zoom] || 500;
  }

  const wordCount = query.trim().split(/\s+/).length;
  const complexity = Math.min(wordCount / 10, 1);
  const tokens = Math.floor(baseTokens[zoom] * (1 + complexity));

  const maxTokens = {
    micro: 1200,
    entity: 800,
    community: 1000
  };

  return Math.min(tokens, maxTokens[zoom] || tokens);
}

export function validateNavigationParams(params = {}) {
  const errors = [];
  const validTilts = ['keywords', 'temporal', 'similarity', 'frequency'];
  const validZooms = ['entity', 'unit', 'text', 'micro', 'community', 'corpus'];

  if (params.query === undefined || params.query === null ||
    typeof params.query !== 'string' || !params.query.trim()) {
    errors.push('Query cannot be empty');
  }

  if (params.zoom === undefined || params.zoom === null) {
    errors.push('Zoom level is required');
  } else if (!validZooms.includes(params.zoom)) {
    errors.push('Invalid zoom level');
  }

  if (params.tilt !== undefined && params.tilt !== null) {
    if (typeof params.tilt !== 'string' || !validTilts.includes(params.tilt)) {
      errors.push(`Invalid tilt option. Must be one of: ${validTilts.join(', ')}`);
    }
  }

  if (params.pan !== undefined && params.pan !== null) {
    if (typeof params.pan !== 'object' || Array.isArray(params.pan)) {
      errors.push('Pan must be an object');
    } else {
      const allowedPanKeys = ['domains', 'keywords', 'entities', 'temporal', 'corpuscle'];
      const panKeys = Object.keys(params.pan);
      const invalidKeys = panKeys.filter(key => !allowedPanKeys.includes(key));

      if (invalidKeys.length > 0) {
        errors.push(`Invalid pan properties: ${invalidKeys.join(', ')}. Allowed: ${allowedPanKeys.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

export function suggestOptimalParameters(query, pan = {}) {
  return {
    recommendedZoom: query.length > 50 ? 'unit' : 'entity',
    recommendedTilt: pan?.temporal ? 'temporal' : 'keywords',
    recommendedMaxTokens: 4000,
    reasoning: 'Based on query complexity and filtering parameters'
  };
}

export function getZoomRecommendations() {
  return {
    entity: 'Best for specific entity information and properties',
    unit: 'Recommended for contextual understanding',
    text: 'Use for detailed textual content',
    community: 'Good for topic-level insights',
    corpus: 'Use for high-level overviews'
  };
}

export function getAvailableEntities(query) {
  const entities = ['artificial-intelligence', 'machine-learning', 'neural-networks', 'deep-learning'];
  return entities.filter(entity => !query || entity.includes(query.toLowerCase().replace(/\s+/g, '-')));
}

export function getTiltRecommendations() {
  return ['keywords', 'embedding', 'temporal'];
}
