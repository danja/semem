import { describe, it, expect, vi } from 'vitest';
import exportCommunityAttributesToSPARQL from '../../src/ragno/exportCommunityAttributesToSPARQL.js';
import Attribute from '../../src/ragno/Attribute.js';

// Mock SPARQLHelpers
vi.mock('../../src/utils/SPARQLHelpers.js', () => ({
  default: {
    executeSPARQLUpdate: vi.fn(async (endpoint, query, auth) => {
      return { ok: true, query };
    })
  }
}));

import SPARQLHelpers from '../../src/utils/SPARQLHelpers.js';

describe('exportCommunityAttributesToSPARQL', () => {
  it('calls SPARQLHelpers.executeSPARQLUpdate for each community attribute', async () => {
    const attributes = [
      new Attribute({ text: 'summary1', summary: 'summary1', entity: null, provenance: 'community summary' }),
      new Attribute({ text: 'summary2', summary: 'summary2', entity: null, provenance: 'community summary' })
    ];
    const endpoint = 'http://example.org/sparql';
    const auth = 'Bearer token';
    await exportCommunityAttributesToSPARQL(attributes, endpoint, auth);
    expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(2);
    const calls = SPARQLHelpers.executeSPARQLUpdate.mock.calls;
    expect(calls[0][0]).toBe(endpoint);
    expect(calls[0][2]).toBe(auth);
    expect(calls[0][1]).toMatch(/INSERT DATA/);
    expect(calls[0][1]).toMatch(/CommunityAttribute/);
    expect(calls[1][1]).toMatch(/CommunityAttribute/);
  });
});
