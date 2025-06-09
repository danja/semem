import { describe, it, expect, beforeEach, vi } from 'vitest'
import SemanticUnit from '../../../src/ragno/SemanticUnit.js'

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
    uri: options.uri || 'http://example.org/ragno/unit/test',
    dataset: {
      add: vi.fn(),
      delete: vi.fn(),
      match: vi.fn(() => [])
    },
    ns: {
      classes: {
        Unit: { value: 'http://example.org/ragno#Unit' }
      },
      properties: {
        content: { value: 'http://example.org/ragno#content' },
        summary: { value: 'http://example.org/ragno#summary' },
        sourceDocument: { value: 'http://example.org/ragno#sourceDocument' },
        position: { value: 'http://example.org/ragno#position' },
        entityMention: { value: 'http://example.org/ragno#entityMention' }
      },
      skosProperties: {
        definition: { value: 'http://www.w3.org/2004/02/skos/core#definition' }
      },
      rdf: {
        type: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }
      }
    },
    addType: vi.fn(),
    setContent: vi.fn(),
    getContent: vi.fn(),
    addTriple: vi.fn(),
    removeTriple: vi.fn(),
    generateURI: vi.fn(type => `http://example.org/ragno/${type}/test`)
  }))
}))

describe('SemanticUnit', () => {
  let unit

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create a SemanticUnit with basic properties', () => {
      unit = new SemanticUnit({
        text: 'Test semantic unit content',
        source: 'test.txt'
      })

      expect(unit).toBeDefined()
      expect(unit.addType).toHaveBeenCalledWith(unit.ns.classes.Unit)
    })

    it('should set content from text option', () => {
      const content = 'Test content for semantic unit'
      unit = new SemanticUnit({ text: content })
      
      expect(unit.setContent).toHaveBeenCalledWith(content)
    })

    it('should set content from content option', () => {
      const content = 'Test content for semantic unit'
      unit = new SemanticUnit({ content: content })
      
      expect(unit.setContent).toHaveBeenCalledWith(content)
    })

    it('should set summary if provided', () => {
      const summary = 'Test summary'
      unit = new SemanticUnit({ 
        text: 'content',
        summary: summary 
      })
      
      expect(unit.setSummary).toBeDefined()
    })

    it('should set source document if provided', () => {
      const source = 'test-document.txt'
      unit = new SemanticUnit({ 
        text: 'content',
        source: source 
      })
      
      expect(unit.setSourceDocument).toBeDefined()
    })
  })

  describe('summary management', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
    })

    it('should set summary as SKOS definition', () => {
      const summary = 'This is a summary of the semantic unit'
      unit.setSummary(summary)
      
      expect(unit.removeTriple).toHaveBeenCalledWith(unit.ns.skosProperties.definition)
      expect(unit.addTriple).toHaveBeenCalled()
    })

    it('should get summary from dataset', () => {
      const summary = 'Retrieved summary'
      unit.dataset.match = vi.fn(() => [{
        object: { value: summary }
      }])
      
      expect(unit.getSummary()).toBe(summary)
    })

    it('should return null for missing summary', () => {
      unit.dataset.match = vi.fn(() => [])
      expect(unit.getSummary()).toBe(null)
    })
  })

  describe('source document management', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
    })

    it('should set source document', () => {
      const source = 'document.pdf'
      unit.setSourceDocument(source)
      
      expect(unit.addTriple).toHaveBeenCalled()
    })

    it('should get source document', () => {
      const source = 'retrieved-document.pdf'
      unit.dataset.match = vi.fn(() => [{
        object: { value: source }
      }])
      
      expect(unit.getSourceDocument()).toBe(source)
    })

    it('should return null for missing source document', () => {
      unit.dataset.match = vi.fn(() => [])
      expect(unit.getSourceDocument()).toBe(null)
    })
  })

  describe('position management', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
    })

    it('should set position with all properties', () => {
      const position = {
        chunkIndex: 0,
        unitIndex: 1,
        startChar: 10,
        endChar: 50
      }
      
      unit.setPosition(position)
      expect(unit.addTriple).toHaveBeenCalled()
    })

    it('should handle partial position data', () => {
      const position = {
        chunkIndex: 0,
        unitIndex: 1
      }
      
      unit.setPosition(position)
      expect(unit.addTriple).toHaveBeenCalled()
    })
  })

  describe('entity mention management', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
    })

    it('should add entity mention', () => {
      const entityURI = 'http://example.org/entity/test'
      const relevance = 0.8
      
      unit.addEntityMention(entityURI, relevance)
      expect(unit.addTriple).toHaveBeenCalled()
    })

    it('should handle entity mention without relevance', () => {
      const entityURI = 'http://example.org/entity/test'
      
      unit.addEntityMention(entityURI)
      expect(unit.addTriple).toHaveBeenCalled()
    })

    it('should get entity mentions from dataset', () => {
      const mentions = [
        { object: { value: 'http://example.org/entity/1' } },
        { object: { value: 'http://example.org/entity/2' } }
      ]
      unit.dataset.match = vi.fn(() => mentions)
      
      const result = unit.getEntityMentions()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })
  })

  describe('RDF export', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
    })

    it('should export to RDF dataset', () => {
      const targetDataset = {
        add: vi.fn()
      }
      
      unit.exportToDataset(targetDataset)
      expect(targetDataset.add).toHaveBeenCalled()
    })

    it('should export to serialized RDF', () => {
      const result = unit.exportToRDF('turtle')
      expect(typeof result).toBe('string')
    })
  })

  describe('URI and identity', () => {
    it('should return the URI', () => {
      unit = new SemanticUnit({ text: 'test content' })
      expect(unit.getURI()).toBe(unit.uri)
    })

    it('should return the RDF node', () => {
      unit = new SemanticUnit({ text: 'test content' })
      expect(unit.getNode()).toBe(unit.node)
    })
  })

  describe('content retrieval methods', () => {
    beforeEach(() => {
      unit = new SemanticUnit({ text: 'test content' })
      unit.getContent = vi.fn(() => 'Test semantic unit content')
    })

    it('should get text content', () => {
      expect(unit.getText()).toBe('Test semantic unit content')
      expect(unit.getContent).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should validate required properties', () => {
      unit = new SemanticUnit({ text: 'test content' })
      
      const isValid = unit.validate()
      expect(typeof isValid).toBe('boolean')
    })

    it('should detect invalid units', () => {
      unit = new SemanticUnit({}) // No content
      
      const isValid = unit.validate()
      expect(isValid).toBe(false)
    })
  })
})