import { describe, it, expect } from 'vitest';
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js';
import SemanticUnit from '../../src/ragno/SemanticUnit.js';
import Entity from '../../src/ragno/Entity.js';

// Mock LLMHandler with predictable outputs
class MockLLMHandler {
  constructor() {
    this.calls = {};
  }
  async extractConcepts(text) {
    this.calls[text] = (this.calls[text] || 0) + 1;
    // First call: semantic unit extraction
    if (this.calls[text] === 1) {
      return [text];
    }
    // Second call: entity extraction
    if (text === 'Hinton invented backprop.') return ['Hinton'];
    if (text === 'LeCun developed convolutional nets.') return ['LeCun'];
    return [];
  }
}

describe('Ragno decomposeCorpus', () => {
  it('extracts semantic units and entities from text chunks', async () => {
    const llmHandler = new MockLLMHandler();
    const textChunks = [
      { content: 'Hinton invented backprop.', source: 'doc1.txt' },
      { content: 'LeCun developed convolutional nets.', source: 'doc2.txt' }
    ];
    const result = await decomposeCorpus(textChunks, llmHandler);

    // Check semantic units
    expect(result.units.length).toBe(2);
    expect(result.units[0]).toBeInstanceOf(SemanticUnit);
    expect(result.units[1]).toBeInstanceOf(SemanticUnit);
    expect(result.units[0].text).toBe('Hinton invented backprop.');
    expect(result.units[1].text).toBe('LeCun developed convolutional nets.');

    // Check entities
    expect(result.entities.length).toBe(2);
    expect(result.entities[0]).toBeInstanceOf(Entity);
    expect(result.entities[1]).toBeInstanceOf(Entity);
    const entityNames = result.entities.map(e => e.name);
    expect(entityNames).toContain('Hinton');
    expect(entityNames).toContain('LeCun');

    // Relationships are empty in this mock
    expect(Array.isArray(result.relationships)).toBe(true);
    expect(result.relationships.length).toBe(0);
  });
});
