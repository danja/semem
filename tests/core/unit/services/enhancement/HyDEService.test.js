/**
 * @file Unit tests for HyDEService (Hypothetical Document Embeddings)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HyDEService } from '../../../../../src/services/enhancement/HyDEService.js'
import { SPARQLQueryService } from '../../../../../src/services/sparql/SPARQLQueryService.js'

// Mock dependencies
vi.mock('../../../../../src/services/sparql/SPARQLQueryService.js')
vi.mock('loglevel', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('HyDEService', () => {
  let service
  let mockLLMHandler
  let mockEmbeddingHandler
  let mockSPARQLHelper
  let mockQueryService
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock handlers
    mockLLMHandler = {
      generateResponse: vi.fn(),
      extractConcepts: vi.fn()
    }
    
    mockEmbeddingHandler = {
      generateEmbedding: vi.fn()
    }
    
    mockSPARQLHelper = {
      executeUpdate: vi.fn()
    }
    
    mockQueryService = {
      getQuery: vi.fn()
    }
    
    // Mock SPARQLQueryService constructor
    SPARQLQueryService.mockImplementation(() => mockQueryService)
    
    service = new HyDEService({
      llmHandler: mockLLMHandler,
      embeddingHandler: mockEmbeddingHandler,
      sparqlHelper: mockSPARQLHelper
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('constructor', () => {
    it('should initialize with default settings', () => {
      const service = new HyDEService()
      
      expect(service.settings.maxHypotheticalLength).toBe(2000)
      expect(service.settings.conceptExtractionEnabled).toBe(true)
      expect(service.settings.storageGraph).toBe('http://hyperdata.it/content')
      expect(service.settings.maxConcepts).toBe(10)
    })
    
    it('should initialize with custom settings', () => {
      const service = new HyDEService({
        maxHypotheticalLength: 1500,
        conceptExtractionEnabled: false,
        storageGraph: 'http://example.org/graph',
        maxConcepts: 5
      })
      
      expect(service.settings.maxHypotheticalLength).toBe(1500)
      expect(service.settings.conceptExtractionEnabled).toBe(false)
      expect(service.settings.storageGraph).toBe('http://example.org/graph')
      expect(service.settings.maxConcepts).toBe(5)
    })
  })
  
  describe('generateHypotheticalDocument', () => {
    it('should generate hypothetical document successfully', async () => {
      const query = 'What is machine learning?'
      const expectedResponse = 'Machine learning is a subset of artificial intelligence...'
      
      mockLLMHandler.generateResponse.mockResolvedValue(expectedResponse)
      
      const result = await service.generateHypotheticalDocument(query)
      
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining(query)
      )
      expect(result.content).toBe(expectedResponse)
      expect(result.originalQuery).toBe(query)
      expect(result.id).toMatch(/^hyde_\d+_[a-z0-9]+$/)
      expect(result.length).toBe(expectedResponse.length)
      expect(result.timestamp).toBeDefined()
    })
    
    it('should truncate content if it exceeds max length', async () => {
      const query = 'Test query'
      const longResponse = 'A'.repeat(3000)
      
      mockLLMHandler.generateResponse.mockResolvedValue(longResponse)
      
      const result = await service.generateHypotheticalDocument(query)
      
      expect(result.content).toBe('A'.repeat(2000) + '...')
      expect(result.length).toBe(2003) // 2000 + '...'
    })
    
    it('should handle LLM generation errors', async () => {
      const query = 'Test query'
      const error = new Error('LLM generation failed')
      
      mockLLMHandler.generateResponse.mockRejectedValue(error)
      
      await expect(service.generateHypotheticalDocument(query))
        .rejects.toThrow('HyDE generation failed: LLM generation failed')
    })
  })
  
  describe('extractConceptsFromHypothetical', () => {
    const hypotheticalDoc = {
      content: 'Machine learning is a method of data analysis...',
      id: 'hyde_123_abc',
      originalQuery: 'What is ML?',
      timestamp: '2023-01-01T00:00:00.000Z'
    }
    
    it('should extract concepts successfully', async () => {
      const concepts = ['machine learning', 'data analysis', 'artificial intelligence']
      mockLLMHandler.extractConcepts.mockResolvedValue(concepts)
      
      const result = await service.extractConceptsFromHypothetical(hypotheticalDoc)
      
      expect(mockLLMHandler.extractConcepts).toHaveBeenCalledWith(hypotheticalDoc.content)
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        value: 'machine learning',
        source: 'hyde',
        hydeId: 'hyde_123_abc',
        originalQuery: 'What is ML?',
        order: 0,
        confidence: expect.any(Number)
      })
    })
    
    it('should limit concepts to maxConcepts setting', async () => {
      const concepts = Array.from({ length: 15 }, (_, i) => `concept${i}`)
      mockLLMHandler.extractConcepts.mockResolvedValue(concepts)
      
      const result = await service.extractConceptsFromHypothetical(hypotheticalDoc)
      
      expect(result).toHaveLength(10) // maxConcepts default
    })
    
    it('should return empty array when concept extraction disabled', async () => {
      service.settings.conceptExtractionEnabled = false
      
      const result = await service.extractConceptsFromHypothetical(hypotheticalDoc)
      
      expect(result).toEqual([])
      expect(mockLLMHandler.extractConcepts).not.toHaveBeenCalled()
    })
    
    it('should handle concept extraction errors', async () => {
      const error = new Error('Concept extraction failed')
      mockLLMHandler.extractConcepts.mockRejectedValue(error)
      
      await expect(service.extractConceptsFromHypothetical(hypotheticalDoc))
        .rejects.toThrow('HyDE concept extraction failed: Concept extraction failed')
    })
  })
  
  describe('storeHyDEDocument', () => {
    const hypotheticalDoc = {
      content: 'Test content',
      id: 'hyde_123_abc',
      originalQuery: 'Test query',
      timestamp: '2023-01-01T00:00:00.000Z'
    }
    
    it('should store hypothetical document successfully', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const expectedQuery = 'INSERT DATA { ... }'
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockQueryService.getQuery.mockResolvedValue(expectedQuery)
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeHyDEDocument(hypotheticalDoc)
      
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalledWith(hypotheticalDoc.content)
      expect(mockQueryService.getQuery).toHaveBeenCalledWith('store-hyde-hypothetical', expect.any(Object))
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalledWith(expectedQuery)
      expect(result.uri).toContain('hyde-document/hyde_123_abc')
      expect(result.embedding).toEqual(embedding)
    })
    
    it('should handle missing SPARQL helper', async () => {
      service.sparqlHelper = null
      
      const result = await service.storeHyDEDocument(hypotheticalDoc)
      
      expect(result).toBeNull()
    })
    
    it('should use fallback query when template fails', async () => {
      const embedding = [0.1, 0.2, 0.3]
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockQueryService.getQuery.mockRejectedValue(new Error('Template not found'))
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeHyDEDocument(hypotheticalDoc)
      
      expect(result.uri).toContain('hyde-document/hyde_123_abc')
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
    })
    
    it('should handle SPARQL storage errors', async () => {
      const embedding = [0.1, 0.2, 0.3]
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockQueryService.getQuery.mockResolvedValue('INSERT DATA { ... }')
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ 
        success: false, 
        error: 'Storage failed' 
      })
      
      await expect(service.storeHyDEDocument(hypotheticalDoc))
        .rejects.toThrow('Failed to store HyDE document: Storage failed')
    })
  })
  
  describe('enhanceQueryWithHyDE', () => {
    const originalQuery = 'What is AI?'
    const hypotheticalDoc = {
      content: 'Artificial intelligence is...',
      id: 'hyde_123_abc',
      length: 25
    }
    const concepts = [
      { value: 'AI', confidence: 0.9, order: 0 },
      { value: 'intelligence', confidence: 0.8, order: 1 }
    ]
    
    it('should enhance query with HyDE context', async () => {
      const result = await service.enhanceQueryWithHyDE(originalQuery, hypotheticalDoc, concepts)
      
      expect(result.enhancedPrompt).toContain(originalQuery)
      expect(result.enhancedPrompt).toContain(hypotheticalDoc.content)
      expect(result.enhancedPrompt).toContain('AI')
      expect(result.enhancedPrompt).toContain('intelligence')
      
      expect(result.hydeContext.originalQuery).toBe(originalQuery)
      expect(result.hydeContext.concepts).toHaveLength(2)
      expect(result.metadata.hydeId).toBe('hyde_123_abc')
      expect(result.metadata.conceptCount).toBe(2)
    })
  })
  
  describe('processQueryWithHyDE', () => {
    it('should execute full HyDE pipeline successfully', async () => {
      const query = 'What is machine learning?'
      const hypotheticalDoc = {
        content: 'Machine learning is...',
        id: 'hyde_123_abc',
        length: 20,
        originalQuery: query,
        timestamp: '2023-01-01T00:00:00.000Z'
      }
      const concepts = [{ value: 'ML', confidence: 0.9, order: 0 }]
      const storedDocument = { uri: 'http://example.org/doc', id: 'hyde_123_abc' }
      
      // Mock the pipeline methods
      vi.spyOn(service, 'generateHypotheticalDocument').mockResolvedValue(hypotheticalDoc)
      vi.spyOn(service, 'extractConceptsFromHypothetical').mockResolvedValue(concepts)
      vi.spyOn(service, 'storeHyDEDocument').mockResolvedValue(storedDocument)
      vi.spyOn(service, 'enhanceQueryWithHyDE').mockResolvedValue({
        enhancedPrompt: 'Enhanced prompt',
        hydeContext: {},
        metadata: {}
      })
      
      const result = await service.processQueryWithHyDE(query)
      
      expect(result.success).toBe(true)
      expect(result.originalQuery).toBe(query)
      expect(result.hypotheticalDoc).toBe(hypotheticalDoc)
      expect(result.concepts).toBe(concepts)
      expect(result.storedDocument).toBe(storedDocument)
      expect(result.stats.documentLength).toBe(20)
      expect(result.stats.conceptCount).toBe(1)
      expect(result.stats.documentStored).toBe(true)
    })
    
    it('should handle pipeline errors gracefully', async () => {
      const query = 'Test query'
      const error = new Error('Pipeline failed')
      
      vi.spyOn(service, 'generateHypotheticalDocument').mockRejectedValue(error)
      
      const result = await service.processQueryWithHyDE(query)
      
      expect(result.success).toBe(false)
      expect(result.originalQuery).toBe(query)
      expect(result.error).toBe('Pipeline failed')
      expect(result.stats.failed).toBe(true)
    })
  })
  
  describe('calculateConceptConfidence', () => {
    it('should calculate confidence based on concept frequency and position', () => {
      const concept = 'machine learning'
      const document = 'Machine learning is a subset of AI. Machine learning algorithms...'
      
      const confidence = service.calculateConceptConfidence(concept, document)
      
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })
    
    it('should return higher confidence for early-appearing concepts', () => {
      const concept = 'test'
      const earlyDoc = 'Test is important. Some other content here...'
      const lateDoc = 'Some other content here. Test is important.'
      
      const earlyConfidence = service.calculateConceptConfidence(concept, earlyDoc)
      const lateConfidence = service.calculateConceptConfidence(concept, lateDoc)
      
      expect(earlyConfidence).toBeGreaterThan(lateConfidence)
    })
  })
  
  describe('getServiceStats', () => {
    it('should return service statistics', () => {
      const stats = service.getServiceStats()
      
      expect(stats.serviceName).toBe('HyDEService')
      expect(stats.settings).toBeDefined()
      expect(stats.handlers.llm).toBe(true)
      expect(stats.handlers.embedding).toBe(true)
      expect(stats.handlers.sparql).toBe(true)
      expect(stats.capabilities.documentGeneration).toBe(true)
      expect(stats.capabilities.conceptExtraction).toBe(true)
      expect(stats.capabilities.conceptStorage).toBe(true)
    })
  })
})