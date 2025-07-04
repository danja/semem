import { describe, it, expect, vi } from 'vitest';
import exportSimilarityLinksToSPARQL from '../../src/ragno/exportSimilarityLinksToSPARQL.js';

// Mock SPARQLHelpers
vi.mock('../../src/services/sparql/SPARQLHelper.js', () => ({
  default: {
    executeSPARQLUpdate: vi.fn(async (endpoint, query, auth) => {
      return { ok: true, query };
    })
  }
}));

import SPARQLHelpers from '../../src/services/sparql/SPARQLHelper.js';

describe('exportSimilarityLinksToSPARQL', () => {
  it('calls SPARQLHelpers.executeSPARQLUpdate for each similarity link', async () => {
    const similarityLinks = [
      { source: 'unit1', target: 'unit2', similarity: 0.92 },
      { source: 'attr1', target: 'comm1', similarity: 0.85 }
    ];
    const endpoint = 'http://example.org/sparql';
    const auth = 'Bearer token';
    await exportSimilarityLinksToSPARQL(similarityLinks, endpoint, auth);
    expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(2);
    const calls = SPARQLHelpers.executeSPARQLUpdate.mock.calls;
    expect(calls[0][0]).toBe(endpoint);
    expect(calls[0][2]).toBe(auth);
    expect(calls[0][1]).toMatch(/SimilarityLink/);
    expect(calls[1][1]).toMatch(/SimilarityLink/);
  });
});
