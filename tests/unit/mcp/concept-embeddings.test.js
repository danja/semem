import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { LegacyOperationsStrategy } from '../../../src/mcp/tools/verbs/strategies/augment/LegacyOperationsStrategy.js'
import { ConceptsStrategy } from '../../../src/mcp/tools/verbs/strategies/augment/ConceptsStrategy.js'

vi.mock('../../../src/utils/URIMinter.js', () => ({
  URIMinter: {
    mintURI: vi.fn((base, type, content) => `${base}${type}/${encodeURIComponent(content.replace(/\s+/g, '_'))}`)
  }
}))

const executeUpdateMock = vi.fn().mockResolvedValue({ success: true })
vi.mock('../../../src/services/sparql/SPARQLHelper.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    executeUpdate: executeUpdateMock
  }))
}))

import SPARQLTemplateLoader from '../../../src/stores/SPARQLTemplateLoader.js'

describe('Concept Embedding Strategies', () => {
  let safeOps
  let memoryManager
  let templateSpy

  beforeEach(() => {
    executeUpdateMock.mockClear()

    safeOps = {
      extractConcepts: vi.fn(async (text) => {
        if (text.toLowerCase().includes('machine learning')) {
          return ['machine learning', 'artificial intelligence', 'algorithms', 'data science']
        }
        return ['concept1', 'concept2', 'concept3']
      }),
      generateEmbedding: vi.fn(async concept => Array(4).fill(0.1))
    }

    memoryManager = {
      config: {
        get: vi.fn((key) => {
          if (key === 'storage.options') {
            return {
              update: 'http://localhost:3030/test/update',
              user: 'testuser',
              password: 'testpass',
              graphName: 'http://hyperdata.it/content'
            }
          }
          if (key === 'graphName') {
            return 'http://hyperdata.it/content'
          }
          return undefined
        })
      }
    }

    templateSpy = vi.spyOn(SPARQLTemplateLoader.prototype, 'loadAndInterpolate').mockResolvedValue('INSERT DATA {}')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('legacy concept_embeddings stores embeddings and returns metadata', async () => {
    const strategy = new LegacyOperationsStrategy()

    const result = await strategy.execute({
      target: 'Machine learning enables intelligent agents.',
      operation: 'concept_embeddings',
      options: { maxConcepts: 3 }
    }, {
      safeOps,
      memoryManager
    })

    expect(result.success).toBe(true)
    expect(result.augmentationType).toBe('concept_embeddings')
    expect(result.embeddedConcepts.length).toBeGreaterThan(0)
    expect(result.totalEmbeddings).toBe(result.embeddedConcepts.length)
    expect(result.targetGraph).toBe('http://hyperdata.it/content')
    expect(safeOps.generateEmbedding).toHaveBeenCalled()
    expect(templateSpy).toHaveBeenCalled()
    expect(executeUpdateMock).toHaveBeenCalled()
  })

  it('legacy concept_embeddings respects maxConcepts', async () => {
    const strategy = new LegacyOperationsStrategy()

    const result = await strategy.execute({
      target: 'Machine learning enables intelligent agents.',
      operation: 'concept_embeddings',
      options: { maxConcepts: 2 }
    }, {
      safeOps,
      memoryManager
    })

    expect(result.totalProcessed).toBeLessThanOrEqual(2)
    expect(result.embeddedConcepts.length).toBeLessThanOrEqual(2)
  })

  it('concepts strategy returns concepts only when includeEmbeddings=false', async () => {
    const strategy = new ConceptsStrategy()

    const result = await strategy.execute({
      target: 'Machine learning enables intelligent agents.',
      operation: 'concepts',
      options: { includeEmbeddings: false }
    }, {
      safeOps,
      memoryManager
    })

    expect(result.success).toBe(true)
    expect(result.augmentationType).toBe('concepts')
    expect(Array.isArray(result.concepts)).toBe(true)
    expect(result.concepts.length).toBeGreaterThan(0)
    expect(result.embeddedConcepts).toBeUndefined()
  })

  it('concepts strategy returns embeddings when includeEmbeddings=true', async () => {
    const strategy = new ConceptsStrategy()

    const result = await strategy.execute({
      target: 'Machine learning enables intelligent agents.',
      operation: 'concepts',
      options: { includeEmbeddings: true, maxConcepts: 2 }
    }, {
      safeOps,
      memoryManager
    })

    expect(result.success).toBe(true)
    expect(result.augmentationType).toBe('concepts_with_embeddings')
    expect(Array.isArray(result.embeddedConcepts)).toBe(true)
    expect(result.totalEmbeddings).toBe(result.embeddedConcepts.length)
    if (result.totalEmbeddings > 0) {
      expect(templateSpy).toHaveBeenCalled()
      expect(executeUpdateMock).toHaveBeenCalled()
    }
  })
})
