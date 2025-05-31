import { describe, it, expect } from 'vitest';
import { enrichWithEmbeddings } from '../../src/ragno/enrichWithEmbeddings.js';

function mockEmbeddingFn(text) {
  // Simple deterministic mock embedding: vector of char codes
  return Promise.resolve(Array.from(text).map(c => c.charCodeAt(0) % 5));
}

describe('Ragno enrichWithEmbeddings', () => {
  it('generates embeddings and similarity links for retrievable nodes', async () => {
    const G = {
      units: [
        { text: 'foo', id: 'unit1' },
        { text: 'bar', id: 'unit2' }
      ],
      attributes: [
        { text: 'baz', id: 'attr1' }
      ],
      communities: [
        { text: 'community', id: 'comm1' }
      ]
    };
    const { embeddings, similarityLinks } = await enrichWithEmbeddings(G, mockEmbeddingFn, { similarityThreshold: 0 });
    expect(Object.keys(embeddings)).toHaveLength(4);
    expect(similarityLinks.length).toBeGreaterThan(0);
    expect(similarityLinks[0]).toHaveProperty('source');
    expect(similarityLinks[0]).toHaveProperty('target');
    expect(similarityLinks[0]).toHaveProperty('similarity');
  });
});
