import { describe, it, expect } from 'vitest';
import { aggregateCommunities } from '../../src/ragno/aggregateCommunities.js';
import Attribute from '../../src/ragno/Attribute.js';

// Mock LLMHandler for community summary
class MockLLMHandler {
  async generateResponse(prompt, context) {
    return 'community summary';
  }
}

describe('Ragno aggregateCommunities', () => {
  it('clusters entities into communities and summarizes them', async () => {
    const G = {
      entities: [
        { name: 'Hinton' },
        { name: 'LeCun' },
        { name: 'Rumelhart' },
        { name: 'Goodfellow' }
      ],
      units: [
        { text: 'Hinton and Rumelhart collaborated.', entities: ['Hinton', 'Rumelhart'] },
        { text: 'LeCun and Goodfellow worked together.', entities: ['LeCun', 'Goodfellow'] }
      ],
      relationships: [
        { source: 'Hinton', target: 'Rumelhart', description: 'collaborated with' },
        { source: 'LeCun', target: 'Goodfellow', description: 'worked with' }
      ]
    };
    const llmHandler = new MockLLMHandler();
    const { communities, attributes } = await aggregateCommunities(G, llmHandler, { minCommunitySize: 2 });
    expect(communities.length).toBe(2);
    expect(communities[0].members.length).toBeGreaterThanOrEqual(2);
    expect(communities[1].members.length).toBeGreaterThanOrEqual(2);
    expect(attributes.length).toBe(2);
    expect(attributes[0]).toBeInstanceOf(Attribute);
    expect(attributes[1]).toBeInstanceOf(Attribute);
    expect(attributes[0].text).toBe('community summary');
  });
});
