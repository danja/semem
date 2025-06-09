import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js'
import SemanticUnit from '../../src/ragno/SemanticUnit.js'
import Entity from '../../src/ragno/Entity.js'
import Relationship from '../../src/ragno/Relationship.js'
import { MockLLMHandler, setupMockEnvironment, testData } from '../helpers/ragnoMocks.js'

// Mock external dependencies
vi.mock('rdf-ext', () => ({
  default: {
    dataset: vi.fn(() => ({
      add: vi.fn(),
      delete: vi.fn(),
      size: 0,
      toStream: vi.fn(() => [])
    })),
    namedNode: vi.fn(uri => ({ uri, termType: 'NamedNode' })),
    literal: vi.fn((value, type) => ({ value, type, termType: 'Literal' })),
    quad: vi.fn((s, p, o, g) => ({ subject: s, predicate: p, object: o, graph: g }))
  }
}))

describe('Ragno decomposeCorpus', () => {
  let mockEnv
  
  beforeEach(() => {
    mockEnv = setupMockEnvironment()
  })
  
  afterEach(() => {
    mockEnv.cleanup()
  })

  it('should decompose text chunks into semantic units and entities', async () => {
    const textChunks = [
      { content: 'Geoffrey Hinton invented backpropagation.', source: 'doc1.txt' },
      { content: 'Yann LeCun developed convolutional nets.', source: 'doc2.txt' }
    ]
    
    const result = await decomposeCorpus(textChunks, mockEnv.llmHandler)

    // Check that we got results
    expect(result).toBeDefined()
    expect(result.units).toBeDefined()
    expect(result.entities).toBeDefined()
    expect(result.relationships).toBeDefined()
    expect(result.dataset).toBeDefined()
    expect(result.statistics).toBeDefined()

    // Check semantic units
    expect(Array.isArray(result.units)).toBe(true)
    expect(result.units.length).toBeGreaterThan(0)
    
    // Check that units are SemanticUnit instances
    result.units.forEach(unit => {
      expect(unit).toBeInstanceOf(SemanticUnit)
    })

    // Check entities
    expect(Array.isArray(result.entities)).toBe(true)
    expect(result.entities.length).toBeGreaterThan(0)
    
    // Check that entities are Entity instances
    result.entities.forEach(entity => {
      expect(entity).toBeInstanceOf(Entity)
    })

    // Check relationships array
    expect(Array.isArray(result.relationships)).toBe(true)
    
    // Check statistics
    expect(result.statistics.totalChunks).toBe(2)
    expect(result.statistics.totalUnits).toBe(result.units.length)
    expect(result.statistics.totalEntities).toBe(result.entities.length)
    expect(result.statistics.processingTime).toBeGreaterThan(0)
  })

  it('should handle empty text chunks', async () => {
    const result = await decomposeCorpus([], mockEnv.llmHandler)
    
    expect(result.units).toHaveLength(0)
    expect(result.entities).toHaveLength(0)
    expect(result.relationships).toHaveLength(0)
    expect(result.statistics.totalChunks).toBe(0)
  })

  it('should handle LLM failures gracefully', async () => {
    // Create a handler that throws errors
    const failingHandler = new MockLLMHandler({
      generateCompletion: () => {
        throw new Error('LLM service unavailable')
      }
    })
    
    const textChunks = [
      { content: 'Some text content', source: 'test.txt' }
    ]
    
    const result = await decomposeCorpus(textChunks, failingHandler)
    
    // Should still return results using fallback methods
    expect(result).toBeDefined()
    expect(result.units.length).toBeGreaterThan(0)
    expect(result.statistics.totalChunks).toBe(1)
  })

  it('should call LLM handler with correct parameters', async () => {
    const textChunks = [{ content: 'Test content', source: 'test.txt' }]
    
    await decomposeCorpus(textChunks, mockEnv.llmHandler)
    
    // Verify LLM was called
    expect(mockEnv.llmHandler.getCallCount('generateCompletion')).toBeGreaterThan(0)
    
    // Check that the first call was for semantic unit extraction
    const firstCall = mockEnv.llmHandler.getLastCall('generateCompletion')
    expect(firstCall.prompt).toContain('Break down the following text')
  })

  it('should respect decomposition options', async () => {
    const textChunks = [{ content: 'Test content', source: 'test.txt' }]
    const options = {
      extractRelationships: false,
      generateSummaries: false,
      minEntityConfidence: 0.8
    }
    
    const result = await decomposeCorpus(textChunks, mockEnv.llmHandler, options)
    
    expect(result).toBeDefined()
    // With extractRelationships: false, should have no relationships
    expect(result.relationships).toHaveLength(0)
  })

  it('should create proper RDF dataset structure', async () => {
    const textChunks = [{ content: 'Geoffrey Hinton', source: 'test.txt' }]
    
    const result = await decomposeCorpus(textChunks, mockEnv.llmHandler)
    
    expect(result.dataset).toBeDefined()
    expect(typeof result.dataset.add).toBe('function')
    expect(typeof result.dataset.size).toBe('number')
  })
})
