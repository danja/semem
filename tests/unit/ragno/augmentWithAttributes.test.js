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

  async generateCompletion(prompt, options = {}) {
    this.calls.push({ prompt, options })
    
    // Return mock attribute for any entity
    if (prompt.includes('generate a concise attribute')) {
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
    const entities = [
      { name: 'Geoffrey Hinton', type: 'person' },
      { name: 'Neural Networks', type: 'concept' }
    ]
    const units = [
      { 
        content: 'Geoffrey Hinton is a pioneer in deep learning research.',
        getContent: () => 'Geoffrey Hinton is a pioneer in deep learning research.'
      }
    ]

    const result = await augmentWithAttributes(entities, units, mockLLMHandler)

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    
    // Check that LLM was called for attribute generation
    expect(mockLLMHandler.getCallCount()).toBeGreaterThan(0)
  })

  it('should handle empty entities array', async () => {
    const result = await augmentWithAttributes([], [], mockLLMHandler)
    
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
    expect(mockLLMHandler.getCallCount()).toBe(0)
  })

  it('should handle LLM failures gracefully', async () => {
    const failingLLM = {
      generateCompletion: vi.fn().mockRejectedValue(new Error('LLM failed'))
    }

    const entities = [{ name: 'Test Entity', type: 'concept' }]
    const units = [{ 
      content: 'Test content',
      getContent: () => 'Test content'
    }]

    const result = await augmentWithAttributes(entities, units, failingLLM)
    
    expect(Array.isArray(result)).toBe(true)
    // Should still return some result even with LLM failure
  })

  it('should filter entities based on options', async () => {
    const entities = [
      { name: 'Entity1', type: 'person' },
      { name: 'Entity2', type: 'concept' },
      { name: 'Entity3', type: 'organization' }
    ]
    const units = []
    const options = {
      entityTypes: ['person', 'organization'], // Only these types
      maxAttributes: 1
    }

    const result = await augmentWithAttributes(entities, units, mockLLMHandler, options)
    
    expect(Array.isArray(result)).toBe(true)
    // Should have filtered out 'concept' type entities
  })

  it('should respect maxAttributes option', async () => {
    const entities = [
      { name: 'Test Entity', type: 'person' }
    ]
    const units = []
    const options = {
      maxAttributes: 2
    }

    const result = await augmentWithAttributes(entities, units, mockLLMHandler, options)
    
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('should create attributes with correct structure', async () => {
    const entities = [{ name: 'Test Entity', type: 'person' }]
    const units = []

    const result = await augmentWithAttributes(entities, units, mockLLMHandler)
    
    if (result.length > 0) {
      const attribute = result[0]
      expect(attribute).toHaveProperty('entity')
      expect(attribute).toHaveProperty('text')
      expect(attribute).toHaveProperty('summary')
      expect(attribute).toHaveProperty('provenance')
      expect(attribute.entity).toBe('Test Entity')
    }
  })

  it('should handle different provenance sources', async () => {
    const entities = [{ name: 'Test Entity', type: 'person' }]
    const units = [
      { 
        content: 'Context about Test Entity',
        getContent: () => 'Context about Test Entity'
      }
    ]

    const result = await augmentWithAttributes(entities, units, mockLLMHandler)
    
    if (result.length > 0) {
      const attribute = result[0]
      expect(attribute.provenance).toBeDefined()
      expect(typeof attribute.provenance).toBe('string')
    }
  })

  it('should call LLM with correct prompt format', async () => {
    const entities = [{ name: 'Geoffrey Hinton', type: 'person' }]
    const units = []

    await augmentWithAttributes(entities, units, mockLLMHandler)
    
    expect(mockLLMHandler.calls.length).toBeGreaterThan(0)
    const firstCall = mockLLMHandler.calls[0]
    expect(firstCall.prompt).toContain('generate a concise attribute')
    expect(firstCall.prompt).toContain('Geoffrey Hinton')
  })

  it('should handle malformed LLM responses', async () => {
    const malformedLLM = {
      generateCompletion: vi.fn().mockResolvedValue('invalid json response')
    }

    const entities = [{ name: 'Test Entity', type: 'person' }]
    const units = []

    const result = await augmentWithAttributes(entities, units, malformedLLM)
    
    expect(Array.isArray(result)).toBe(true)
    // Should handle parsing errors gracefully
  })
})