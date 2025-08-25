import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js'
import SemanticUnit from '../../src/ragno/SemanticUnit.js'
import Entity from '../../src/ragno/Entity.js'
import Relationship from '../../src/ragno/Relationship.js'
import { MockLLMHandler, setupMockEnvironment, testData } from '../helpers/ragnoMocks.js'

// Mock external dependencies with proper dataset.match function
vi.mock('rdf-ext', () => ({
  default: {
    dataset: vi.fn(() => ({
      add: vi.fn(),
      delete: vi.fn(),
      match: vi.fn(() => []), // Add the missing match method
      size: 0,
      toStream: vi.fn(() => [])
    })),
    namedNode: vi.fn(uri => ({ uri, termType: 'NamedNode', value: uri })),
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

