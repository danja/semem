const normalizeKeywordTokens = (keywords = []) => (
  keywords
    .map(keyword => keyword.replace(/[^\w-]/g, '').trim())
    .filter(Boolean)
);

export function buildSelectionParams({
  safeQuery,
  currentZoom,
  params,
  normalizedParams,
  calculateCorpuscleCount
}) {
  const selectionParams = {
    query: safeQuery,
    zoom: (typeof normalizedParams.zoom === 'object' && normalizedParams.zoom.level)
      ? normalizedParams.zoom.level
      : currentZoom,
    pan: {
      domains: [],
      keywords: [],
      temporal: {},
      entities: [],
      corpuscle: []
    },
    tilt: (typeof normalizedParams.tilt === 'object' && normalizedParams.tilt.representation)
      ? normalizedParams.tilt.representation
      : normalizedParams.tilt || 'keywords',
    maxResults: calculateCorpuscleCount(currentZoom),
    includeMetadata: true
  };

  const panParams = params.pan || {};

  if (panParams.domains) {
    selectionParams.pan.domains = Array.isArray(panParams.domains)
      ? panParams.domains
      : [panParams.domains];
  }

  if (Array.isArray(panParams.keywords) && panParams.keywords.length > 0) {
    selectionParams.pan.keywords = normalizeKeywordTokens(panParams.keywords);
  } else if (typeof panParams.keywords === 'string' && panParams.keywords.trim()) {
    selectionParams.pan.keywords = normalizeKeywordTokens([panParams.keywords.trim()]);
  } else if (selectionParams.pan.keywords.length === 0 && safeQuery) {
    selectionParams.pan.keywords = normalizeKeywordTokens(
      safeQuery.split(' ').filter(word => word && word.length > 2)
    );
  }

  if (panParams.temporal) {
    selectionParams.pan.temporal = { ...panParams.temporal };
  }

  if (panParams.entities) {
    selectionParams.pan.entities = Array.isArray(panParams.entities)
      ? panParams.entities
      : [panParams.entities];
  }

  if (panParams.corpuscle) {
    selectionParams.pan.corpuscle = Array.isArray(panParams.corpuscle)
      ? panParams.corpuscle
      : [panParams.corpuscle];
  }

  selectionParams.pan.domains = Array.isArray(selectionParams.pan.domains)
    ? selectionParams.pan.domains
    : [];
  selectionParams.pan.keywords = Array.isArray(selectionParams.pan.keywords)
    ? selectionParams.pan.keywords
    : [];
  selectionParams.pan.entities = Array.isArray(selectionParams.pan.entities)
    ? selectionParams.pan.entities
    : [];
  selectionParams.pan.corpuscle = Array.isArray(selectionParams.pan.corpuscle)
    ? selectionParams.pan.corpuscle
    : [];
  selectionParams.pan.temporal = selectionParams.pan.temporal || {};

  const numericKeywords = normalizeKeywordTokens(selectionParams.pan.keywords)
    .filter(keyword => /\d/.test(keyword));
  if (numericKeywords.length > 0) {
    selectionParams.pan.keywords = numericKeywords;
  }

  return selectionParams;
}

export { normalizeKeywordTokens };
