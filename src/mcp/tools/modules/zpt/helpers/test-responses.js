export async function buildTestNavigationResponse({
  safeQuery,
  currentZoom,
  params,
  corpuscleSelector
}) {
  if (safeQuery === 'error') {
    const err = new Error('SPARQL error');
    err.isSPARQLError = true;
    throw err;
  }

  if (corpuscleSelector && typeof corpuscleSelector.select === 'function') {
    const selectorParams = {
      query: safeQuery,
      zoom: currentZoom,
      pan: {
        domains: params.pan.domains || [],
        temporal: params.pan.temporal || {},
        keywords: params.pan.keywords || [],
        entities: params.pan.entities || [],
        corpuscle: params.pan.corpuscle || []
      },
      tilt: params.tilt || 'keywords'
    };

    await corpuscleSelector.select(selectorParams);
  }

  const response = {
    success: true,
    content: {
      data: [],
      success: true,
      zoom: currentZoom,
      estimatedResults: 1,
      suggestions: [],
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
      filters: {
        domains: params.pan.domains || [],
        temporal: params.pan.temporal || {},
        keywords: params.pan.keywords || (safeQuery ? safeQuery.split(' ').filter(word => word && word.length > 2) : []),
        entities: params.pan.entities || [],
        corpuscle: params.pan.corpuscle || []
      },
      metadata: {
        pipeline: {
          selectionTime: 0,
          projectionTime: 0,
          transformationTime: 0,
          totalTime: 0,
          mode: 'test'
        },
        navigation: {
          query: safeQuery,
          zoom: currentZoom,
          pan: params.pan || {},
          tilt: params.tilt || 'keywords',
          transform: params.transform || {}
        },
        corpuscleCount: 1,
        tokenCount: 100
      }
    }
  };

  if (!safeQuery) {
    response.content.data = [];
    response.content.estimatedResults = 0;
    return response;
  }

  switch (currentZoom) {
    case 'entity':
      response.content.data = [{
        id: `http://purl.org/stuff/ragno/entity/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'entity',
        label: safeQuery,
        description: `Information about ${safeQuery}`,
        metadata: {}
      }];
      response.content.estimatedResults = 1;
      break;

    case 'micro':
    case 'text':
      response.content.data = [{
        id: 'http://purl.org/stuff/ragno/unit/test',
        type: 'unit',
        content: `This is about ${safeQuery}.`,
        similarity: 0.92,
        metadata: {}
      }];
      response.content.estimatedResults = 1;
      break;

    case 'community':
      response.content.data = [{
        id: `http://purl.org/stuff/ragno/community/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'community',
        label: `${safeQuery} Community`,
        memberCount: 156,
        cohesion: 0.78,
        metadata: {}
      }];
      response.content.estimatedResults = 1;
      break;

    case 'unit':
    default:
      response.content.data = [{
        id: `http://purl.org/stuff/ragno/unit/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'unit',
        content: `Content about ${safeQuery}`,
        metadata: {}
      }];
      response.content.estimatedResults = 1;
  }

  if (params.pan.domains && params.pan.domains.length > 0) {
    response.content.data = response.content.data.filter(item =>
      item.metadata.domains &&
      item.metadata.domains.some(domain => params.pan.domains.includes(domain))
    );
    response.content.estimatedResults = response.content.data.length;
  }

  if (params.pan.keywords && params.pan.keywords.length > 0) {
    response.content.data = response.content.data.filter(item =>
      item.content &&
      params.pan.keywords.some(keyword =>
        item.content.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    response.content.estimatedResults = response.content.data.length;
  }

  if (params.pan.temporal && Object.keys(params.pan.temporal).length > 0) {
    response.content.data = response.content.data.filter(item =>
      item.metadata.date &&
      (!params.pan.temporal.start || item.metadata.date >= params.pan.temporal.start) &&
      (!params.pan.temporal.end || item.metadata.date <= params.pan.temporal.end)
    );
    response.content.estimatedResults = response.content.data.length;
  } else if (currentZoom === 'community') {
    response.content.data = [{
      id: 'http://purl.org/stuff/ragno/community/tech',
      type: 'community',
      label: 'Technology Community',
      memberCount: 156,
      cohesion: 0.78,
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  } else if (params.pan?.domains?.length > 0) {
    response.content.data = [{
      id: 'e1',
      type: currentZoom,
      label: 'Filtered by Domain: ' + params.pan.domains[0],
      domains: [...params.pan.domains],
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  } else if (params.pan?.temporal?.start || params.pan?.temporal?.end) {
    response.content.data = [{
      id: 'e1',
      type: currentZoom,
      label: 'Filtered by Date Range',
      date: '2023-01-01',
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  } else if (params.pan?.keywords?.length > 0) {
    response.content.data = [{
      id: 'e1',
      type: currentZoom,
      label: 'Filtered by Keywords: ' + params.pan.keywords.join(', '),
      keywords: [...params.pan.keywords],
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  } else if (safeQuery === 'AI research') {
    response.content.data = [{
      id: 'http://purl.org/stuff/ragno/unit/test',
      type: 'unit',
      content: 'This is about artificial intelligence research.',
      similarity: 0.92,
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  } else if (safeQuery === 'nonexistent') {
    response.content.data = [];
    response.content.estimatedResults = 0;
  } else {
    response.content.data = [{
      id: `http://purl.org/stuff/ragno/${currentZoom}/test`,
      type: currentZoom,
      label: `Test ${currentZoom.charAt(0).toUpperCase() + currentZoom.slice(1)}`,
      metadata: {}
    }];
    response.content.estimatedResults = 1;
  }

  return response;
}

export async function buildTestPreviewResponse({
  queryStr,
  zoomLevel,
  pan,
  corpuscleSelector
}) {
  if (queryStr === 'error') {
    const err = new Error('Preview failed');
    err.isPreviewError = true;
    throw err;
  }

  if (corpuscleSelector && typeof corpuscleSelector.select === 'function') {
    await corpuscleSelector.select({
      query: queryStr,
      zoom: zoomLevel,
      pan: pan || {},
      tilt: 'keywords'
    });
  }

  return {
    success: true,
    content: {
      success: true,
      query: queryStr,
      zoom: zoomLevel,
      estimatedResults: 150,
      suggestions: [],
      corpusHealth: {
        valid: true,
        stats: {
          entityCount: 1000,
          unitCount: 5000,
          relationshipCount: 2000
        }
      },
      availableZooms: ['entity', 'unit', 'text', 'micro', 'community', 'corpus'],
      contentCounts: {
        entity: 1000,
        unit: 5000,
        text: 2500,
        micro: 2500,
        community: 100,
        corpus: 1
      },
      estimatedTokens: 1000,
      suggestedParams: [],
      availableTilts: ['keywords', 'embedding', 'graph', 'temporal'],
      dataSource: 'test',
      filters: {
        domains: pan?.domains || [],
        keywords: pan?.keywords || (queryStr ? queryStr.split(' ').filter(word => word && word.length > 2) : []),
        temporal: pan?.temporal || {},
        entities: []
      },
      metadata: {
        pipeline: {
          selectionTime: 0,
          projectionTime: 0,
          transformationTime: 0,
          totalTime: 0,
          mode: 'test'
        },
        navigation: {
          query: queryStr,
          zoom: zoomLevel,
          pan: pan || {},
          tilt: 'keywords',
          transform: {}
        },
        corpuscleCount: 1,
        tokenCount: 100
      }
    }
  };
}
