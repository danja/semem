import { describe, it, expect } from 'vitest';
import { augmentWithAttributes } from '../../src/ragno/augmentWithAttributes.js';
import Attribute from '../../src/ragno/Attribute.js';

// Mock LLMHandler that returns predictable summaries
class MockLLMHandler {
  async generateResponse(prompt, context) {
    // Return a mock summary based on the entity name in the prompt
    const match = prompt.match(/entity '([^']+)'/);
    return match ? `${match[1]} summary` : 'generic summary';
  }
}

describe('Ragno augmentWithAttributes', () => {
  it('adds attribute summaries to important entities', async () => {
    const G = {
      entities: [
        { name: 'Hinton' },
        { name: 'LeCun' },
        { name: 'Rumelhart' }
      ],
      units: [
        { text: 'Hinton invented backprop.', entities: ['Hinton'] },
        { text: 'LeCun developed convolutional nets.', entities: ['LeCun'] }
      ],
      relationships: [
        { source: 'Hinton', target: 'Rumelhart', description: 'collaborated with' },
        { source: 'LeCun', target: 'Hinton', description: 'inspired by' }
      ]
    };
    const llmHandler = new MockLLMHandler();
    const { attributes } = await augmentWithAttributes(G, llmHandler, { topK: 2 });
    expect(attributes.length).toBe(2);
    expect(attributes[0]).toBeInstanceOf(Attribute);
    expect(attributes[1]).toBeInstanceOf(Attribute);
    const attrEntities = attributes.map(a => a.entity);
    expect(attrEntities).toContain('Hinton');
    expect(attrEntities).toContain('LeCun');
    expect(attributes[0].text).toMatch(/summary$/);
    expect(attributes[1].text).toMatch(/summary$/);
  });
});
