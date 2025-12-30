import { describe, it, expect } from 'vitest';
import { buildSelectionParams } from '../../../../src/mcp/tools/modules/zpt/helpers/selection-utils.js';
import {
  calculateCorpuscleCount,
  estimateTokensForQuery,
  suggestOptimalParameters,
  validateNavigationParams
} from '../../../../src/mcp/tools/modules/zpt/helpers/navigation-utils.js';
import {
  buildSparqlFilters,
  convertSparqlToNavigation
} from '../../../../src/mcp/tools/modules/zpt/helpers/sparql-utils.js';

const makeNormalizedParams = (overrides = {}) => ({
  zoom: 'entity',
  tilt: 'keywords',
  transform: {},
  ...overrides
});

describe('ZPT helper utilities', () => {
  it('buildSelectionParams normalizes pan keyword input', () => {
    const params = {
      pan: {
        keywords: ['AI', 'research!']
      }
    };
    const selection = buildSelectionParams({
      safeQuery: 'AI research',
      currentZoom: 'entity',
      params,
      normalizedParams: makeNormalizedParams(),
      calculateCorpuscleCount
    });

    expect(selection.pan.keywords).toEqual(['AI', 'research']);
  });

  it('buildSelectionParams falls back to query terms when keywords missing', () => {
    const selection = buildSelectionParams({
      safeQuery: 'AI research',
      currentZoom: 'entity',
      params: { pan: {} },
      normalizedParams: makeNormalizedParams(),
      calculateCorpuscleCount
    });

    expect(selection.pan.keywords).toEqual(['research']);
  });

  it('buildSelectionParams prefers numeric keywords when present', () => {
    const selection = buildSelectionParams({
      safeQuery: 'version 2 release',
      currentZoom: 'entity',
      params: { pan: { keywords: ['alpha', 'v2', 'beta'] } },
      normalizedParams: makeNormalizedParams(),
      calculateCorpuscleCount
    });

    expect(selection.pan.keywords).toEqual(['v2']);
  });

  it('estimateTokensForQuery returns expected ranges', () => {
    const microTokens = estimateTokensForQuery('test query', 'micro');
    const entityTokens = estimateTokensForQuery('test query', 'entity');
    const communityTokens = estimateTokensForQuery('test query', 'community');

    expect(microTokens).toBeGreaterThanOrEqual(800);
    expect(microTokens).toBeLessThanOrEqual(1200);
    expect(entityTokens).toBeGreaterThanOrEqual(400);
    expect(entityTokens).toBeLessThanOrEqual(800);
    expect(communityTokens).toBeGreaterThanOrEqual(600);
    expect(communityTokens).toBeLessThanOrEqual(1000);
  });

  it('validateNavigationParams returns errors for invalid input', () => {
    const result = validateNavigationParams({
      query: '',
      zoom: 'invalid',
      tilt: 'unknown',
      pan: 'bad'
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Query cannot be empty/);
    expect(result.errors.join(' ')).toMatch(/Invalid zoom level/);
    expect(result.errors.join(' ')).toMatch(/Invalid tilt option/);
    expect(result.errors.join(' ')).toMatch(/Pan must be an object/);
  });

  it('suggestOptimalParameters reacts to query size and pan', () => {
    const shortSuggestions = suggestOptimalParameters('AI', {});
    const longSuggestions = suggestOptimalParameters(
      'artificial intelligence and machine learning applications in healthcare',
      { temporal: { start: '2024-01-01' } }
    );

    expect(shortSuggestions.recommendedZoom).toBe('entity');
    expect(longSuggestions.recommendedZoom).toBe('unit');
    expect(longSuggestions.recommendedTilt).toBe('temporal');
  });

  it('buildSparqlFilters composes pan and query filters', () => {
    const filters = buildSparqlFilters({
      domains: ['science'],
      keywords: ['ai'],
      entities: ['entity-1'],
      temporal: { start: '2024-01-01' }
    }, 'AI research');

    expect(filters).toEqual({
      domains: ['science'],
      keywords: ['ai'],
      entities: ['entity-1'],
      temporal: { start: '2024-01-01' },
      textSearch: 'AI research'
    });
  });

  it('convertSparqlToNavigation maps results to navigation items', () => {
    const results = convertSparqlToNavigation([
      { id: 'r1', label: 'Result 1', content: 'Text' },
      { uri: 'r2', content: { prefLabel: 'Result 2', content: 'Body' }, similarity: 0.9 }
    ], 'entity');

    expect(results[0]).toMatchObject({
      id: 'r1',
      label: 'Result 1',
      content: 'Text',
      type: 'entity'
    });
    expect(results[1]).toMatchObject({
      id: 'r2',
      label: 'Result 2',
      content: 'Body',
      type: 'entity'
    });
  });
});
