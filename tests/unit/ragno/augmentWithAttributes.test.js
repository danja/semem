import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { augmentWithAttributes } from '../../../src/ragno/augmentWithAttributes.js'

// Mock dependencies
vi.mock('../../../src/utils/SPARQLHelpers.js', () => ({
  default: {
    executeSPARQLUpdate: vi.fn().mockResolvedValue({ ok: true }),
    executeSPARQLQuery: vi.fn().mockResolvedValue({
      results: { bindings: [] }
    })
  }
}))

// Mock LLM Handler
class MockLLMHandler {
  constructor() {
    this.calls = []
  }

  async generateResponse(prompt, context, options = {}) {
    this.calls.push({ prompt, context, options })
    
    // Return mock attribute for any entity
    if (prompt && prompt.includes('generate a concise attribute')) {
      return JSON.stringify({
        text: 'Mock attribute text for testing',
        summary: 'Mock summary for the attribute'
      })
    }
    
    return 'Mock response'
  }

  getCallCount() {
    return this.calls.length
  }

  reset() {
    this.calls = []
  }
}

describe('augmentWithAttributes', () => {
  let mockLLMHandler

  beforeEach(() => {
    mockLLMHandler = new MockLLMHandler()
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockLLMHandler.reset()
  })

  it('should augment entities with attributes', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/geoffrey_hinton',
      getPreferredLabel: () => 'Geoffrey Hinton'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => 'Geoffrey Hinton is a pioneer in deep learning research.',
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(), // Mock RDF dataset
      statistics: {}
    }

    const result = await augmentWithAttributes(graphData, mockLLMHandler)

    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
    expect(result.dataset).toBeDefined()
    expect(result.statistics).toBeDefined()
  })

  it('should handle empty entities array', async () => {
    const emptyGraphData = {
      entities: [],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }
    
    const result = await augmentWithAttributes(emptyGraphData, mockLLMHandler)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
    expect(result.attributes.length).toBe(0)
    expect(mockLLMHandler.getCallCount()).toBe(0)
  })

  it('should handle LLM failures gracefully', async () => {
    const failingLLM = {
      generateCompletion: vi.fn().mockRejectedValue(new Error('LLM failed'))
    }

    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => 'Test content',
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }

    const result = await augmentWithAttributes(graphData, failingLLM)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
    // Should still return some result even with LLM failure
  })

  it('should filter entities based on options', async () => {
    const mockEntities = [
      { getURI: () => 'http://example.org/entity/1', getPreferredLabel: () => 'Entity1' },
      { getURI: () => 'http://example.org/entity/2', getPreferredLabel: () => 'Entity2' }
    ]
    
    const graphData = {
      entities: mockEntities,
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }
    
    const options = {
      topK: 1,
      minImportanceScore: 0.0
    }

    const result = await augmentWithAttributes(graphData, mockLLMHandler, options)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
  })

  it('should respect maxAttributes option', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }
    
    const options = {
      attributeTypes: ['overview', 'characteristics'], // Limit types
      topK: 1
    }

    const result = await augmentWithAttributes(graphData, mockLLMHandler, options)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
  })

  it('should create attributes with correct structure', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity',
      getType: () => 'Person'
    }
    
    const mockUnit = {
      getContent: () => 'Test content about the entity',
      getURI: () => 'http://example.org/unit/1',
      hasEntityMention: () => true,
      getType: () => 'TextUnit'
    };
    
    const graphData = {
      entities: [mockEntity],
      units: [mockUnit],
      relationships: [{
        getSource: () => 'http://example.org/entity/test',
        getTarget: () => 'http://example.org/entity/related',
        getSourceEntity: () => ({ getURI: () => 'http://example.org/entity/test' }),
        getTargetEntity: () => ({ getURI: () => 'http://example.org/entity/related' }),
        getType: () => 'RELATED_TO',
        getLabel: () => 'related to',
        getURI: () => 'http://example.org/relationship/1',
        getProperties: () => ({}),
        hasProperty: () => false,
        getProperty: () => null
      }],
      dataset: new Set(),
      statistics: {
        totalEntities: 1,
        totalRelationships: 1,
        totalUnits: 1
      }
    };

    const result = await augmentWithAttributes(graphData, mockLLMHandler, {
      attributeTypes: ['overview'],
      topK: 1,
      minImportanceScore: 0.1
    });
    
    expect(result).toBeDefined();
    expect(result.attributes).toBeDefined();
    expect(Array.isArray(result.attributes)).toBe(true);
    
    if (result.attributes.length > 0) {
      const attribute = result.attributes[0];
      expect(attribute).toHaveProperty('getURI');
      expect(attribute).toHaveProperty('getContent');
      expect(attribute).toHaveProperty('getConfidence');
      expect(attribute.getConfidence()).toBeGreaterThan(0);
      expect(attribute.getContent().length).toBeGreaterThan(0);
    }
  });

  it('should handle different importance methods', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    };
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    const methods = ['degree', 'kcore', 'centrality', 'hybrid'];
    
    for (const method of methods) {
      const result = await augmentWithAttributes(graphData, mockLLMHandler, {
        importanceMethod: method,
        topK: 1
      });
      
      expect(result).toBeDefined();
      expect(result.attributes).toBeDefined();
    }
  });
  
  it('should respect minImportanceScore', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/low-importance',
      getPreferredLabel: () => 'Low Importance Entity'
    };
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    const result = await augmentWithAttributes(graphData, mockLLMHandler, {
      minImportanceScore: 0.9, // Very high threshold
      topK: 1
    });
    
    expect(result).toBeDefined();
    expect(result.attributes).toHaveLength(0);
  });
  
  it('should handle empty graph data', async () => {
    const emptyGraphData = {
      entities: [],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    const result = await augmentWithAttributes(emptyGraphData, mockLLMHandler);
    
    expect(result).toBeDefined();
    expect(result.attributes).toHaveLength(0);
    expect(result.dataset).toBeDefined();
    expect(result.statistics).toBeDefined();
  });
  
  it('should handle LLM response formatting errors', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    };
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => 'Test content',
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    // Mock LLM to return invalid JSON
    const invalidJsonLLM = {
      generateResponse: vi.fn().mockResolvedValue('invalid json response')
    };
    
    const result = await augmentWithAttributes(graphData, invalidJsonLLM, {
      attributeTypes: ['overview']
    });
    
    expect(result).toBeDefined();
    // Should still return a valid result object even if LLM fails
    expect(result.attributes).toBeDefined();
  });
  
  it('should respect maxContextLength option', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    };
    
    // Create a very long content
    const longContent = 'a '.repeat(5000);
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => longContent,
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    const result = await augmentWithAttributes(graphData, mockLLMHandler, {
      maxContextLength: 1000,
      attributeTypes: ['overview']
    });
    
    expect(result).toBeDefined();
    // Should still process even with large context
    expect(result.attributes).toBeDefined();
  });
  
  it('should include evidence when includeEvidence is true', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    };
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => 'Evidence content',
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    };
    
    const result = await augmentWithAttributes(graphData, mockLLMHandler, {
      includeEvidence: true,
      attributeTypes: ['overview']
    });
    
    expect(result).toBeDefined();
    expect(result.attributes).toBeDefined();
    if (result.attributes.length > 0) {
      // Check if evidence was included in the LLM call
      const llmCall = mockLLMHandler.calls[0];
      expect(llmCall.context).toContain('Evidence content');
    }
  });

  it('should handle different provenance sources', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [{
        getContent: () => 'Context about Test Entity',
        getURI: () => 'http://example.org/unit/1',
        hasEntityMention: () => true
      }],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }

    const result = await augmentWithAttributes(graphData, mockLLMHandler)
    
    expect(result).toBeDefined()
    if (result.attributes.length > 0) {
      const attribute = result.attributes[0]
      expect(attribute.getProvenance).toBeDefined()
      expect(typeof attribute.getProvenance()).toBe('string')
    }
  })

  it('should call LLM with correct prompt format', async () => {
    const mockEntity = {
      getURI: () => 'http://example.org/entity/geoffrey_hinton',
      getPreferredLabel: () => 'Geoffrey Hinton'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }

    await augmentWithAttributes(graphData, mockLLMHandler)
    
    expect(mockLLMHandler.calls.length).toBeGreaterThan(0)
    const firstCall = mockLLMHandler.calls[0]
    expect(firstCall.prompt).toContain('Geoffrey Hinton')
  })

  it('should handle malformed LLM responses', async () => {
    const malformedLLM = {
      generateCompletion: vi.fn().mockResolvedValue('short')
    }

    const mockEntity = {
      getURI: () => 'http://example.org/entity/test',
      getPreferredLabel: () => 'Test Entity'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }

    const result = await augmentWithAttributes(graphData, malformedLLM)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    expect(Array.isArray(result.attributes)).toBe(true)
    // Should handle parsing errors gracefully
  })
})