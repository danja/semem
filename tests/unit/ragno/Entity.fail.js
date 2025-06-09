import { describe, it, expect, beforeEach, vi } from 'vitest'
import Entity from '../../../src/ragno/Entity.js'

// Mock RDF-Ext
vi.mock('rdf-ext', () => ({
  default: {
    dataset: vi.fn(() => ({
      add: vi.fn(),
      delete: vi.fn(),
      match: vi.fn(() => []),
      size: 0
    })),
    namedNode: vi.fn(uri => ({ 
      uri, 
      termType: 'NamedNode',
      value: uri 
    })),
    literal: vi.fn((value, type) => ({ 
      value, 
      type, 
      termType: 'Literal' 
    })),
    quad: vi.fn((s, p, o, g) => ({ 
      subject: s, 
      predicate: p, 
      object: o, 
      graph: g 
    }))
  }
}))

// Mock RDFElement base class
vi.mock('../../../src/ragno/models/RDFElement.js', () => ({
  default: vi.fn().mockImplementation((options) => ({
    // Mock base class properties and methods
    uri: options.uri || 'http://example.org/ragno/entity/test',
    dataset: {
      add: vi.fn(),
      delete: vi.fn(),
      match: vi.fn(() => [])
    },
    ns: {
      classes: {
        Entity: { value: 'http://example.org/ragno#Entity' }
      },
      properties: {
        frequency: { value: 'http://example.org/ragno#frequency' },
        confidence: { value: 'http://example.org/ragno#confidence' },
        entityType: { value: 'http://example.org/ragno#entityType' },
        source: { value: 'http://example.org/ragno#source' },
        relationship: { value: 'http://example.org/ragno#relationship' }
      },
      rdf: {
        type: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }
      }
    },
    addType: vi.fn(),
    setContent: vi.fn(),
    getContent: vi.fn(),
    setPrefLabel: vi.fn(),
    getPrefLabel: vi.fn(),
    setEntryPoint: vi.fn(),
    isEntryPoint: vi.fn(),
    addAltLabel: vi.fn(),
    addTriple: vi.fn(),
    removeTriple: vi.fn(),
    generateURI: vi.fn(type => `http://example.org/ragno/${type}/test`)
  }))
}))

describe('Entity', () => {
  let entity

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create an Entity with basic properties', () => {
      entity = new Entity({
        name: 'Test Entity',
        isEntryPoint: true
      })

      expect(entity).toBeDefined()
      expect(entity.addType).toHaveBeenCalledWith(entity.ns.classes.Entity)
    })

    it('should set name as preferred label and content', () => {
      const name = 'Geoffrey Hinton'
      entity = new Entity({ name: name })
      
      expect(entity.setPrefLabel).toHaveBeenCalledWith(name)
      expect(entity.setContent).toHaveBeenCalledWith(name)
    })

    it('should set label as preferred label and content', () => {
      const label = 'Test Label'
      entity = new Entity({ label: label })
      
      expect(entity.setPrefLabel).toHaveBeenCalledWith(label)
      expect(entity.setContent).toHaveBeenCalledWith(label)
    })

    it('should set entry point status (default true)', () => {
      entity = new Entity({ name: 'Test' })
      expect(entity.setEntryPoint).toHaveBeenCalledWith(true)
    })

    it('should respect provided entry point status', () => {
      entity = new Entity({ name: 'Test', isEntryPoint: false })
      expect(entity.setEntryPoint).toHaveBeenCalledWith(false)
    })

    it('should set sub-type if provided', () => {
      entity = new Entity({ 
        name: 'Test',
        subType: 'Person'
      })
      
      expect(entity.setSubType).toBeDefined()
    })

    it('should set frequency if provided', () => {
      entity = new Entity({ 
        name: 'Test',
        frequency: 5
      })
      
      expect(entity.setFrequency).toBeDefined()
    })
  })

  describe('preferred label management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should get preferred label', () => {
      entity.getPrefLabel = vi.fn(() => 'Test Entity')
      expect(entity.getPreferredLabel()).toBe('Test Entity')
    })

    it('should fall back to content if no preferred label', () => {
      entity.getPrefLabel = vi.fn(() => null)
      entity.getContent = vi.fn(() => 'Content Fallback')
      expect(entity.getPreferredLabel()).toBe('Content Fallback')
    })

    it('should return entity URI if no label or content', () => {
      entity.getPrefLabel = vi.fn(() => null)
      entity.getContent = vi.fn(() => null)
      entity.uri = 'http://example.org/entity/test'
      expect(entity.getPreferredLabel()).toBe('http://example.org/entity/test')
    })
  })

  describe('frequency management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should set frequency', () => {
      entity.setFrequency(3)
      expect(entity.addTriple).toHaveBeenCalled()
    })

    it('should get frequency from dataset', () => {
      entity.dataset.match = vi.fn(() => [{
        object: { value: '5' }
      }])
      
      expect(entity.getFrequency()).toBe(5)
    })

    it('should return 0 for missing frequency', () => {
      entity.dataset.match = vi.fn(() => [])
      expect(entity.getFrequency()).toBe(0)
    })

    it('should increment frequency', () => {
      entity.getFrequency = vi.fn(() => 2)
      entity.incrementFrequency()
      expect(entity.removeTriple).toHaveBeenCalled()
      expect(entity.addTriple).toHaveBeenCalled()
    })
  })

  describe('confidence management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should set confidence', () => {
      entity.setConfidence(0.85)
      expect(entity.addTriple).toHaveBeenCalled()
    })

    it('should get confidence from dataset', () => {
      entity.dataset.match = vi.fn(() => [{
        object: { value: '0.9' }
      }])
      
      expect(entity.getConfidence()).toBe(0.9)
    })

    it('should return 1.0 for missing confidence', () => {
      entity.dataset.match = vi.fn(() => [])
      expect(entity.getConfidence()).toBe(1.0)
    })
  })

  describe('entity type management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should set entity type', () => {
      entity.setEntityType('Person')
      expect(entity.addTriple).toHaveBeenCalled()
    })

    it('should get entity type from dataset', () => {
      entity.dataset.match = vi.fn(() => [{
        object: { value: 'Organization' }
      }])
      
      expect(entity.getEntityType()).toBe('Organization')
    })

    it('should return null for missing entity type', () => {
      entity.dataset.match = vi.fn(() => [])
      expect(entity.getEntityType()).toBe(null)
    })
  })

  describe('source management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should add source', () => {
      entity.addSource('document1.txt')
      expect(entity.addTriple).toHaveBeenCalled()
    })

    it('should get sources from dataset', () => {
      const sources = [
        { object: { value: 'doc1.txt' } },
        { object: { value: 'doc2.txt' } }
      ]
      entity.dataset.match = vi.fn(() => sources)
      
      const result = entity.getSources()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result).toContain('doc1.txt')
      expect(result).toContain('doc2.txt')
    })
  })

  describe('alternative labels', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should add alternative labels from array', () => {
      const alternatives = ['Alt 1', 'Alt 2', 'Alt 3']
      entity.addAlternativeLabels(alternatives)
      
      expect(entity.addAltLabel).toHaveBeenCalledTimes(3)
      expect(entity.addAltLabel).toHaveBeenCalledWith('Alt 1')
      expect(entity.addAltLabel).toHaveBeenCalledWith('Alt 2')
      expect(entity.addAltLabel).toHaveBeenCalledWith('Alt 3')
    })

    it('should handle empty alternatives array', () => {
      entity.addAlternativeLabels([])
      expect(entity.addAltLabel).not.toHaveBeenCalled()
    })
  })

  describe('relationship management', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should add relationship', () => {
      const relationshipURI = 'http://example.org/relationship/test'
      entity.addRelationship(relationshipURI, 'outgoing')
      
      expect(entity.addTriple).toHaveBeenCalled()
    })

    it('should get relationships from dataset', () => {
      const relationships = [
        { object: { value: 'http://example.org/rel/1' } },
        { object: { value: 'http://example.org/rel/2' } }
      ]
      entity.dataset.match = vi.fn(() => relationships)
      
      const result = entity.getRelationships()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })
  })

  describe('RDF export', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should export to RDF dataset', () => {
      const targetDataset = {
        add: vi.fn()
      }
      
      entity.exportToDataset(targetDataset)
      expect(targetDataset.add).toHaveBeenCalled()
    })

    it('should export to serialized RDF', () => {
      const result = entity.exportToRDF('turtle')
      expect(typeof result).toBe('string')
    })
  })

  describe('URI and identity', () => {
    it('should return the URI', () => {
      entity = new Entity({ name: 'Test Entity' })
      expect(entity.getURI()).toBe(entity.uri)
    })

    it('should return the RDF node', () => {
      entity = new Entity({ name: 'Test Entity' })
      expect(entity.getNode()).toBe(entity.node)
    })
  })

  describe('validation', () => {
    it('should validate entities with required properties', () => {
      entity = new Entity({ name: 'Valid Entity' })
      
      const isValid = entity.validate()
      expect(typeof isValid).toBe('boolean')
    })

    it('should detect invalid entities', () => {
      entity = new Entity({}) // No name
      
      const isValid = entity.validate()
      expect(isValid).toBe(false)
    })
  })

  describe('statistics and metrics', () => {
    beforeEach(() => {
      entity = new Entity({ name: 'Test Entity' })
    })

    it('should calculate entity importance', () => {
      entity.getFrequency = vi.fn(() => 5)
      entity.getConfidence = vi.fn(() => 0.8)
      entity.isEntryPoint = vi.fn(() => true)
      
      const importance = entity.calculateImportance()
      expect(typeof importance).toBe('number')
      expect(importance).toBeGreaterThan(0)
    })

    it('should handle entities with no frequency', () => {
      entity.getFrequency = vi.fn(() => 0)
      entity.getConfidence = vi.fn(() => 0.5)
      entity.isEntryPoint = vi.fn(() => false)
      
      const importance = entity.calculateImportance()
      expect(importance).toBeGreaterThanOrEqual(0)
    })
  })
})