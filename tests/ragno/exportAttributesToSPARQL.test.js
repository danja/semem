import { describe, it, expect, vi } from 'vitest';
import exportAttributesToSPARQL from '../../src/ragno/exportAttributesToSPARQL.js';

// Mock SPARQLHelpers
vi.mock('../../src/utils/SPARQLHelpers.js', () => ({
  default: {
    executeSPARQLUpdate: vi.fn(async (endpoint, query, auth) => {
      return { ok: true };
    })
  }
}));

import SPARQLHelpers from '../../src/utils/SPARQLHelpers.js';

describe('exportAttributesToSPARQL', () => {
  it('calls SPARQLHelpers.executeSPARQLUpdate for each attribute', async () => {
    const attributes = [
      { text: 'Pioneer in deep learning research', summary: 'AI researcher', entity: 'Hinton', provenance: 'LLM' },
      { text: 'Computer vision expert', summary: 'CNN developer', entity: 'LeCun', provenance: 'LLM' }
    ];
    const endpoint = 'http://example.org/sparql';
    const auth = 'Bearer token';
    
    await exportAttributesToSPARQL(attributes, endpoint, auth);
    
    expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(2);
    
    const calls = SPARQLHelpers.executeSPARQLUpdate.mock.calls;
    expect(calls[0][0]).toBe(endpoint);
    expect(calls[0][2]).toBe(auth);
    expect(calls[0][1]).toMatch(/INSERT DATA/);
    expect(calls[0][1]).toMatch(/Hinton/);
    expect(calls[1][1]).toMatch(/LeCun/);
  });
});
