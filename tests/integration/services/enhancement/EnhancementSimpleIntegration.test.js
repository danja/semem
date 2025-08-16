/**
 * @file Simple Integration tests for Enhancement Services
 * Tests core enhancement functionality with minimal dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EnhancementCoordinator } from '../../../../src/services/enhancement/EnhancementCoordinator.js'

// Mock external dependencies
vi.mock('node-fetch')

const fetch = vi.hoisted(() => vi.fn())

describe('Enhancement Services Simple Integration', () => {
  let coordinator
  let mockLLMHandler
  let mockEmbeddingHandler
  let mockSPARQLHelper
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock global fetch
    global.fetch = fetch
    
    // Create mock handlers with realistic responses
    mockLLMHandler = {
      generateResponse: vi.fn(),
      extractConcepts: vi.fn()
    }
    
    mockEmbeddingHandler = {
      generateEmbedding: vi.fn()
    }
    
    mockSPARQLHelper = {
      executeUpdate: vi.fn().mockResolvedValue({ success: true })
    }
    
    coordinator = new EnhancementCoordinator({
      llmHandler: mockLLMHandler,
      embeddingHandler: mockEmbeddingHandler,
      sparqlHelper: mockSPARQLHelper
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Core Integration Tests', () => {
    it('should instantiate enhancement coordinator with all services', () => {
      expect(coordinator).toBeDefined()
      expect(coordinator.services.hyde).toBeDefined()
      expect(coordinator.services.wikipedia).toBeDefined()
      expect(coordinator.services.wikidata).toBeDefined()
    })
    
    it('should provide service health information', () => {
      const health = coordinator.getServiceHealth()
      
      expect(health).toBeDefined()
      expect(health.coordinator).toBeDefined()
      expect(health.services).toBeDefined()
      expect(health.overall).toBeDefined()
      
      expect(health.coordinator.serviceName).toBe('EnhancementCoordinator')
      expect(health.services.hyde).toBeDefined()
      expect(health.services.wikipedia).toBeDefined()
      expect(health.services.wikidata).toBeDefined()
    })
    
    it('should handle no enhancement requests', async () => {
      const query = 'What is machine learning?'
      
      const result = await coordinator.enhanceQuery(query, {})
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('none')
      expect(result.metadata.servicesUsed).toEqual([])
    })
    
    it('should execute HyDE enhancement pipeline', async () => {
      const query = 'What is machine learning?'
      const hypotheticalDoc = 'Machine learning is a method of data analysis...'
      const concepts = ['machine learning', 'data analysis']
      const embedding = new Array(1536).fill(0.1)
      
      // Setup mocks
      mockLLMHandler.generateResponse
        .mockResolvedValueOnce(hypotheticalDoc)
        .mockResolvedValueOnce('Enhanced answer with HyDE context')
      mockLLMHandler.extractConcepts.mockResolvedValue(concepts)
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      
      const result = await coordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.metadata.servicesUsed).toContain('hyde')
      expect(result.enhancedAnswer).toContain('Enhanced answer')
      
      // Verify pipeline steps
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledTimes(2)
      expect(mockLLMHandler.extractConcepts).toHaveBeenCalled()
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalled()
    })
    
    it('should execute Wikipedia enhancement pipeline', async () => {
      const query = 'artificial intelligence'
      const mockWikipediaResponse = {
        query: {
          search: [{
            title: 'Artificial intelligence',
            snippet: 'AI is the simulation...',
            size: 50000,
            wordcount: 8000,
            pageid: 11660
          }],
          searchinfo: { totalhits: 1000 }
        }
      }
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWikipediaResponse)
      })
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.2))
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer with Wikipedia context')
      
      const result = await coordinator.enhanceQuery(query, { useWikipedia: true })
      
      expect(result.success).toBe(true)
      expect(result.metadata.servicesUsed).toContain('wikipedia')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikipedia.org'),
        expect.any(Object)
      )
    })
    
    it('should execute Wikidata enhancement pipeline', async () => {
      const query = 'machine learning'
      const mockWikidataResponse = {
        search: [{
          id: 'Q2539',
          label: 'machine learning',
          description: 'study of algorithms',
          concepturi: 'http://www.wikidata.org/entity/Q2539'
        }]
      }
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWikidataResponse)
      })
      
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer with Wikidata context')
      
      const result = await coordinator.enhanceQuery(query, { useWikidata: true })
      
      expect(result.success).toBe(true)
      expect(result.metadata.servicesUsed).toContain('wikidata')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikidata.org'),
        expect.any(Object)
      )
    })
    
    it('should handle multiple enhancements concurrently', async () => {
      const query = 'What is AI?'
      
      // Setup all mocks
      mockLLMHandler.generateResponse
        .mockResolvedValue('AI is the simulation...')
        .mockResolvedValue('Comprehensive answer')
      mockLLMHandler.extractConcepts.mockResolvedValue(['AI', 'intelligence'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.3))
      
      fetch.mockImplementation((url) => {
        if (url.includes('wikipedia.org')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              query: { search: [{ title: 'AI', pageid: 1 }], searchinfo: { totalhits: 1 } }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ search: [{ id: 'Q11660', label: 'AI' }] })
        })
      })
      
      const result = await coordinator.enhanceQuery(query, {
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      })
      
      expect(result.success).toBe(true)
      expect(result.metadata.servicesUsed).toEqual(['hyde', 'wikipedia', 'wikidata'])
      expect(result.individualResults.executionMode).toBe('concurrent')
    })
  })
  
  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      const query = 'test query'
      
      // Make one service fail
      mockLLMHandler.generateResponse.mockRejectedValue(new Error('LLM failed'))
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ search: [] })
      })
      
      const result = await coordinator.enhanceQuery(query, {
        useHyDE: true,
        useWikidata: true
      })
      
      expect(result.success).toBe(true)
      expect(result.individualResults.failed).toHaveLength(1)
      expect(result.individualResults.successful).toHaveLength(1)
    })
    
    it('should handle network failures', async () => {
      const query = 'network test'
      
      fetch.mockRejectedValue(new Error('Network error'))
      
      const result = await coordinator.enhanceQuery(query, { useWikipedia: true })
      
      expect(result.success).toBe(true)
      expect(result.individualResults.failed).toHaveLength(1)
    })
  })
  
  describe('Statistics and Monitoring', () => {
    it('should track enhancement statistics', async () => {
      const query = 'stats test'
      
      mockLLMHandler.generateResponse.mockResolvedValue('Test response')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      coordinator.resetStats()
      
      await coordinator.enhanceQuery(query, { useHyDE: true })
      
      const stats = coordinator.stats
      expect(stats.totalEnhancements).toBe(1)
      expect(stats.successfulEnhancements).toBe(1)
      expect(stats.serviceUsage.hyde).toBe(1)
    })
    
    it('should provide service health monitoring', () => {
      const health = coordinator.getServiceHealth()
      
      expect(health.overall.totalServices).toBe(3)
      expect(health.overall.healthyServices).toBe(3)
      expect(health.coordinator.healthy).toBe(true)
    })
  })
  
  describe('Configuration', () => {
    it('should respect custom configuration', () => {
      const customCoordinator = new EnhancementCoordinator({
        maxCombinedContextLength: 500,
        enableConcurrentProcessing: false
      })
      
      expect(customCoordinator.settings.maxCombinedContextLength).toBe(500)
      expect(customCoordinator.settings.enableConcurrentProcessing).toBe(false)
    })
    
    it('should provide default configuration when none specified', () => {
      const defaultCoordinator = new EnhancementCoordinator()
      
      expect(defaultCoordinator.settings.maxCombinedContextLength).toBe(8000)
      expect(defaultCoordinator.settings.enableConcurrentProcessing).toBe(true)
    })
  })
})