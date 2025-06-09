import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import RDFElement from '../../../../src/ragno/models/RDFElement.js'

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

// Mock NamespaceManager
vi.mock('../../../../src/ragno/core/NamespaceManager.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    classes: {
      Element: { value: 'http://example.org/ragno#Element' },
      Unit: { value: 'http://example.org/ragno#Unit' },
      Entity: { value: 'http://example.org/ragno#Entity' }
    },
    properties: {
      content: { value: 'http://example.org/ragno#content' },
      isEntryPoint: { value: 'http://example.org/ragno#isEntryPoint' },
      subType: { value: 'http://example.org/ragno#subType' },
      connectsTo: { value: 'http://example.org/ragno#connectsTo' },
      hasWeight: { value: 'http://example.org/ragno#hasWeight' }
    },
    skos: {
      Concept: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
    },
    skosProperties: {
      prefLabel: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
      altLabel: { value: 'http://www.w3.org/2004/02/skos/core#altLabel' }
    },
    dcProperties: {
      created: { value: 'http://purl.org/dc/terms/created' }
    },
    xsd: {
      dateTime: { value: 'http://www.w3.org/2001/XMLSchema#dateTime' }
    },
    rdf: {
      type: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
      subject: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#subject' },
      predicate: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate' },
      object: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#object' }
    },
    uriBase: 'http://example.org/ragno/',
    ex: vi.fn(term => ({ value: `http://example.org/ragno#${term}` }))
  }))
}))

describe('RDFElement', () => {
  let element

  beforeEach(() => {
    element = new RDFElement({ type: 'test' })
  })

  describe('constructor', () => {
    it('should create an RDFElement with basic properties', () => {
      expect(element).toBeDefined()
      expect(element.uri).toBeDefined()
      expect(element.node).toBeDefined()
      expect(element.dataset).toBeDefined()
      expect(element.created).toBeInstanceOf(Date)
      expect(element.modified).toBeInstanceOf(Date)
    })

    it('should use provided URI if given', () => {
      const customURI = 'http://example.org/custom-element'
      const customElement = new RDFElement({ uri: customURI })
      expect(customElement.uri).toBe(customURI)
    })

    it('should generate unique URIs for different elements', () => {
      const element1 = new RDFElement({ type: 'test1' })
      const element2 = new RDFElement({ type: 'test2' })
      expect(element1.uri).not.toBe(element2.uri)
    })
  })

  describe('content management', () => {
    it('should set and get content', () => {
      const content = 'Test content for RDF element'
      element.setContent(content)
      
      // Mock the dataset.match to return our content
      element.dataset.match = vi.fn(() => [{
        object: { value: content }
      }])
      
      expect(element.getContent()).toBe(content)
    })

    it('should return null for missing content', () => {
      element.dataset.match = vi.fn(() => [])
      expect(element.getContent()).toBe(null)
    })
  })

  describe('SKOS label management', () => {
    it('should set and get preferred label', () => {
      const label = 'Test Element'
      element.setPrefLabel(label)
      
      // Mock the dataset.match to return our label
      element.dataset.match = vi.fn(() => [{
        object: { value: label }
      }])
      
      expect(element.getPrefLabel()).toBe(label)
    })

    it('should return null for missing preferred label', () => {
      element.dataset.match = vi.fn(() => [])
      expect(element.getPrefLabel()).toBe(null)
    })

    it('should add alternative labels', () => {
      element.addAltLabel('Alternative Label')
      expect(element.addTriple).toHaveBeenCalled()
    })
  })

  describe('entry point management', () => {
    it('should set entry point status', () => {
      element.setEntryPoint(true)
      expect(element.addTriple).toHaveBeenCalled()
    })

    it('should get entry point status', () => {
      // Mock true response
      element.dataset.match = vi.fn(() => [{
        object: { value: 'true' }
      }])
      expect(element.isEntryPoint()).toBe(true)

      // Mock false response
      element.dataset.match = vi.fn(() => [{
        object: { value: 'false' }
      }])
      expect(element.isEntryPoint()).toBe(false)

      // Mock no response (default false)
      element.dataset.match = vi.fn(() => [])
      expect(element.isEntryPoint()).toBe(false)
    })
  })

  describe('sub-type management', () => {
    it('should set and get sub-type', () => {
      const subType = 'TestSubType'
      element.setSubType(subType)
      
      // Mock the dataset.match to return our sub-type
      element.dataset.match = vi.fn(() => [{
        object: { value: `http://example.org/ragno/${subType}` }
      }])
      
      expect(element.getSubType()).toBe(subType)
    })

    it('should return null for missing sub-type', () => {
      element.dataset.match = vi.fn(() => [])
      expect(element.getSubType()).toBe(null)
    })
  })

  describe('RDF triple management', () => {
    it('should add triples to dataset', () => {
      const predicate = { value: 'http://example.org/test' }
      const object = { value: 'test value' }
      
      element.addTriple(predicate, object)
      expect(element.dataset.add).toHaveBeenCalled()
    })

    it('should remove triples from dataset', () => {
      const predicate = { value: 'http://example.org/test' }
      
      element.removeTriple(predicate)
      expect(element.dataset.match).toHaveBeenCalled()
    })

    it('should add RDF types', () => {
      const type = { value: 'http://example.org/TestType' }
      element.addType(type)
      expect(element.addTriple).toHaveBeenCalled()
    })
  })

  describe('connection management', () => {
    it('should connect to another element', () => {
      const targetElement = new RDFElement({ type: 'target' })
      element.connectTo(targetElement)
      expect(element.addTriple).toHaveBeenCalled()
    })

    it('should connect with weight', () => {
      const targetElement = new RDFElement({ type: 'target' })
      element.connectTo(targetElement, 0.8)
      expect(element.addTriple).toHaveBeenCalled()
      expect(element.dataset.add).toHaveBeenCalled()
    })
  })

  describe('URI generation', () => {
    it('should generate URIs with correct format', () => {
      const uri = element.generateURI('test')
      expect(uri).toContain('http://example.org/ragno/')
      expect(uri).toContain('test/')
    })

    it('should generate unique URIs', () => {
      const uri1 = element.generateURI('test')
      const uri2 = element.generateURI('test')
      expect(uri1).not.toBe(uri2)
    })
  })

  describe('modification tracking', () => {
    it('should update modified timestamp on changes', () => {
      const initialModified = element.modified
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        element.setContent('new content')
        expect(element.modified.getTime()).toBeGreaterThan(initialModified.getTime())
      }, 10)
    })
  })
})