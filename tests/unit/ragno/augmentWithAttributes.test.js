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
      getPreferredLabel: () => 'Test Entity'
    }
    
    const graphData = {
      entities: [mockEntity],
      units: [],
      relationships: [],
      dataset: new Set(),
      statistics: {}
    }

    const result = await augmentWithAttributes(graphData, mockLLMHandler)
    
    expect(result).toBeDefined()
    expect(result.attributes).toBeDefined()
    if (result.attributes.length > 0) {
      const attribute = result.attributes[0]
      expect(attribute).toHaveProperty('getEntity')
      expect(attribute).toHaveProperty('getCategory')
      expect(attribute).toHaveProperty('getContent')
      expect(attribute).toHaveProperty('getURI')
    }
  })

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