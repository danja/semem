/**
 * @file Unit tests for EnhancementCoordinator
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EnhancementCoordinator } from '../../../../src/services/enhancement/EnhancementCoordinator.js'
import HyDEService from '../../../../src/services/enhancement/HyDEService.js'
import WikipediaService from '../../../../src/services/enhancement/WikipediaService.js'
import WikidataService from '../../../../src/services/enhancement/WikidataService.js'

// Mock dependencies
vi.mock('../../../../src/services/enhancement/HyDEService.js')
vi.mock('../../../../src/services/enhancement/WikipediaService.js')
vi.mock('../../../../src/services/enhancement/WikidataService.js')
vi.mock('loglevel', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('EnhancementCoordinator', () => {
  let coordinator
  let mockLLMHandler
  let mockEmbeddingHandler
  let mockSPARQLHelper
  let mockConfig
  let mockHyDEService
  let mockWikipediaService
  let mockWikidataService
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock handlers
    mockLLMHandler = {
      generateResponse: vi.fn()
    }
    
    mockEmbeddingHandler = {
      generateEmbedding: vi.fn()
    }
    
    mockSPARQLHelper = {
      executeUpdate: vi.fn()
    }
    
    mockConfig = {
      get: vi.fn()
    }
    
    // Create mock services
    mockHyDEService = {
      processQueryWithHyDE: vi.fn(),
      getServiceStats: vi.fn().mockReturnValue({ serviceName: 'HyDEService', healthy: true })
    }
    
    mockWikipediaService = {
      processQueryWithWikipedia: vi.fn(),
      getServiceStats: vi.fn().mockReturnValue({ serviceName: 'WikipediaService', healthy: true })
    }
    
    mockWikidataService = {
      processQueryWithWikidata: vi.fn(),
      getServiceStats: vi.fn().mockReturnValue({ serviceName: 'WikidataService', healthy: true })
    }
    
    // Mock service constructors
    HyDEService.mockImplementation(() => mockHyDEService)
    WikipediaService.mockImplementation(() => mockWikipediaService)
    WikidataService.mockImplementation(() => mockWikidataService)
    
    coordinator = new EnhancementCoordinator({
      llmHandler: mockLLMHandler,
      embeddingHandler: mockEmbeddingHandler,
      sparqlHelper: mockSPARQLHelper,
      config: mockConfig
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('constructor', () => {
    it('should initialize with default settings', () => {
      const coordinator = new EnhancementCoordinator()
      
      expect(coordinator.settings.maxCombinedContextLength).toBe(8000)
      expect(coordinator.settings.enableConcurrentProcessing).toBe(true)
      expect(coordinator.settings.contextWeights.hyde).toBe(0.3)
      expect(coordinator.settings.contextWeights.wikipedia).toBe(0.4)
      expect(coordinator.settings.contextWeights.wikidata).toBe(0.3)
      expect(coordinator.settings.fallbackOnError).toBe(true)
    })
    
    it('should initialize with custom settings', () => {
      const coordinator = new EnhancementCoordinator({
        maxCombinedContextLength: 10000,
        enableConcurrentProcessing: false,
        hydeWeight: 0.5,
        wikipediaWeight: 0.3,
        wikidataWeight: 0.2,
        fallbackOnError: false
      })
      
      expect(coordinator.settings.maxCombinedContextLength).toBe(10000)
      expect(coordinator.settings.enableConcurrentProcessing).toBe(false)
      expect(coordinator.settings.contextWeights.hyde).toBe(0.5)
      expect(coordinator.settings.contextWeights.wikipedia).toBe(0.3)
      expect(coordinator.settings.contextWeights.wikidata).toBe(0.2)
      expect(coordinator.settings.fallbackOnError).toBe(false)
    })
    
    it('should initialize all enhancement services', () => {
      expect(HyDEService).toHaveBeenCalledWith(expect.objectContaining({
        llmHandler: mockLLMHandler,
        embeddingHandler: mockEmbeddingHandler,
        sparqlHelper: mockSPARQLHelper,
        config: mockConfig
      }))
      
      expect(WikipediaService).toHaveBeenCalledWith(expect.objectContaining({
        embeddingHandler: mockEmbeddingHandler,
        sparqlHelper: mockSPARQLHelper,
        config: mockConfig
      }))
      
      expect(WikidataService).toHaveBeenCalledWith(expect.objectContaining({
        sparqlHelper: mockSPARQLHelper,
        config: mockConfig
      }))
    })
  })
  
  describe('enhanceQuery', () => {
    const query = 'What is machine learning?'
    
    it('should return no enhancement when no services requested', async () => {
      const options = {}
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('none')
      expect(result.metadata.servicesUsed).toEqual([])
    })
    
    it('should enhance query with single service (HyDE)', async () => {
      const options = { useHyDE: true }
      const hydeResult = {
        success: true,
        hypotheticalDoc: { content: 'ML is...' },
        concepts: [{ value: 'machine learning' }]
      }
      
      mockHyDEService.processQueryWithHyDE.mockResolvedValue(hydeResult)
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer')
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(mockHyDEService.processQueryWithHyDE).toHaveBeenCalledWith(query, {})
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.metadata.servicesUsed).toEqual(['hyde'])
      expect(result.enhancedAnswer).toBe('Enhanced answer')
    })
    
    it('should enhance query with multiple services concurrently', async () => {
      const options = { useHyDE: true, useWikipedia: true, useWikidata: true }
      
      mockHyDEService.processQueryWithHyDE.mockResolvedValue({ success: true, hypotheticalDoc: { content: 'HyDE content' } })
      mockWikipediaService.processQueryWithWikipedia.mockResolvedValue({ success: true, searchResults: { results: [] } })
      mockWikidataService.processQueryWithWikidata.mockResolvedValue({ success: true, entitySearchResults: { entities: [] } })
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer')
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(result.success).toBe(true)
      expect(result.metadata.servicesUsed).toEqual(['hyde', 'wikipedia', 'wikidata'])
      expect(result.individualResults.successful).toHaveLength(3)
      expect(result.individualResults.executionMode).toBe('concurrent')
    })
    
    it('should enhance query with multiple services sequentially when concurrent processing disabled', async () => {
      coordinator.settings.enableConcurrentProcessing = false
      const options = { useHyDE: true, useWikipedia: true }
      
      mockHyDEService.processQueryWithHyDE.mockResolvedValue({ success: true, hypotheticalDoc: { content: 'HyDE content' } })
      mockWikipediaService.processQueryWithWikipedia.mockResolvedValue({ success: true, searchResults: { results: [] } })
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer')
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(result.success).toBe(true)
      expect(result.individualResults.executionMode).toBe('sequential')
    })
    
    it('should handle service failures gracefully', async () => {
      const options = { useHyDE: true, useWikipedia: true }
      
      mockHyDEService.processQueryWithHyDE.mockResolvedValue({ success: true, hypotheticalDoc: { content: 'HyDE content' } })
      mockWikipediaService.processQueryWithWikipedia.mockRejectedValue(new Error('Wikipedia failed'))
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer')
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(result.success).toBe(true)
      expect(result.individualResults.successful).toHaveLength(1)
      expect(result.individualResults.failed).toHaveLength(1)
      expect(result.stats.successfulServices).toBe(1)
      expect(result.stats.failedServices).toBe(1)
    })
    
    it('should fallback to original query on complete failure when fallbackOnError enabled', async () => {
      const options = { useHyDE: true }
      
      mockHyDEService.processQueryWithHyDE.mockRejectedValue(new Error('Complete failure'))
      
      const result = await coordinator.enhanceQuery(query, options)
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('fallback')
      expect(result.enhancedPrompt).toBe(query)
      expect(result.metadata.fallback).toBe(true)
    })
    
    it('should throw error when fallbackOnError disabled', async () => {
      coordinator.settings.fallbackOnError = false
      const options = { useHyDE: true }
      
      mockHyDEService.processQueryWithHyDE.mockRejectedValue(new Error('Service failed'))
      
      await expect(coordinator.enhanceQuery(query, options))
        .rejects.toThrow('Service failed')
    })
  })
  
  describe('combineEnhancedContext', () => {
    const originalQuery = 'What is AI?'
    const enhancementResults = {
      successful: [
        {
          serviceName: 'hyde',
          result: {
            success: true,
            hypotheticalDoc: { content: 'AI is artificial intelligence...' },
            concepts: [{ value: 'AI' }, { value: 'intelligence' }]
          }
        },
        {
          serviceName: 'wikipedia',
          result: {
            success: true,
            searchResults: {
              results: [
                { title: 'Artificial Intelligence', snippet: 'AI is the simulation...', content: 'Full AI content' }
              ]
            }
          }
        },
        {
          serviceName: 'wikidata',
          result: {
            success: true,
            entitySearchResults: {
              entities: [
                { label: 'artificial intelligence', wikidataId: 'Q11660', description: 'intelligence by machines' }
              ]
            },
            entityDetails: {
              relationships: [
                { sourceEntityLabel: 'AI', propertyLabel: 'instance of', targetEntityLabel: 'technology' }
              ]
            }
          }
        }
      ],
      failed: []
    }
    
    it('should combine contexts from multiple services', async () => {
      const result = await coordinator.combineEnhancedContext(originalQuery, enhancementResults)
      
      expect(result.originalQuery).toBe(originalQuery)
      expect(result.enhancements.hyde).toBeDefined()
      expect(result.enhancements.wikipedia).toBeDefined()
      expect(result.enhancements.wikidata).toBeDefined()
      
      expect(result.combinedPrompt).toContain('ORIGINAL QUESTION: What is AI?')
      expect(result.combinedPrompt).toContain('HyDE HYPOTHETICAL DOCUMENT')
      expect(result.combinedPrompt).toContain('WIKIPEDIA CONTEXT')
      expect(result.combinedPrompt).toContain('WIKIDATA ENTITIES')
      expect(result.combinedPrompt).toContain('WIKIDATA RELATIONSHIPS')
      
      expect(result.metadata.servicesUsed).toEqual(['hyde', 'wikipedia', 'wikidata'])
      expect(result.metadata.combinationMethod).toBe('weighted')
    })
    
    it('should truncate context if too long', async () => {
      coordinator.settings.maxCombinedContextLength = 100
      
      const result = await coordinator.combineEnhancedContext(originalQuery, enhancementResults)
      
      expect(result.combinedPrompt.length).toBeLessThanOrEqual(100 + 50) // +50 for truncation message
      expect(result.metadata.truncated).toBe(true)
    })
  })
  
  describe('generateEnhancedResponse', () => {
    const originalQuery = 'What is AI?'
    const combinedContext = {
      combinedPrompt: 'Enhanced context prompt',
      metadata: { totalLength: 500 }
    }
    
    it('should generate enhanced response successfully', async () => {
      const expectedAnswer = 'AI is artificial intelligence...'
      mockLLMHandler.generateResponse.mockResolvedValue(expectedAnswer)
      
      const result = await coordinator.generateEnhancedResponse(originalQuery, combinedContext)
      
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining(originalQuery)
      )
      expect(result.answer).toBe(expectedAnswer)
      expect(result.generationSuccessful).toBe(true)
      expect(result.contextLength).toBe(500)
    })
    
    it('should handle missing LLM handler', async () => {
      coordinator.llmHandler = null
      
      const result = await coordinator.generateEnhancedResponse(originalQuery, combinedContext)
      
      expect(result.answer).toContain('no LLM handler available')
      expect(result.generationSuccessful).toBeUndefined()
    })
    
    it('should handle LLM generation errors', async () => {
      mockLLMHandler.generateResponse.mockRejectedValue(new Error('LLM failed'))
      
      const result = await coordinator.generateEnhancedResponse(originalQuery, combinedContext)
      
      expect(result.answer).toContain('Error generating enhanced response')
      expect(result.generationSuccessful).toBe(false)
      expect(result.error).toBe('LLM failed')
    })
  })
  
  describe('updateStats', () => {
    it('should update success statistics', () => {
      const servicesUsed = ['hyde', 'wikipedia']
      const responseTime = 1500
      
      coordinator.updateStats(servicesUsed, responseTime, true)
      
      expect(coordinator.stats.successfulEnhancements).toBe(1)
      expect(coordinator.stats.totalEnhancements).toBe(1)
      expect(coordinator.stats.averageResponseTime).toBe(1500)
      expect(coordinator.stats.lastEnhancementTime).toBeDefined()
    })
    
    it('should update failure statistics', () => {
      const servicesUsed = []
      const responseTime = 500
      
      coordinator.updateStats(servicesUsed, responseTime, false)
      
      expect(coordinator.stats.failedEnhancements).toBe(1)
      expect(coordinator.stats.totalEnhancements).toBe(1)
      expect(coordinator.stats.averageResponseTime).toBe(500)
    })
    
    it('should calculate running average correctly', () => {
      coordinator.updateStats(['hyde'], 1000, true)
      coordinator.updateStats(['wikipedia'], 2000, true)
      
      expect(coordinator.stats.averageResponseTime).toBe(1500)
      expect(coordinator.stats.totalEnhancements).toBe(2)
    })
  })
  
  describe('getServiceHealth', () => {
    it('should return health information for all services', () => {
      const health = coordinator.getServiceHealth()
      
      expect(health.coordinator.serviceName).toBe('EnhancementCoordinator')
      expect(health.coordinator.healthy).toBe(true)
      expect(health.coordinator.handlers.llm).toBe(true)
      expect(health.coordinator.handlers.embedding).toBe(true)
      expect(health.coordinator.handlers.sparql).toBe(true)
      
      expect(health.services.hyde.serviceName).toBe('HyDEService')
      expect(health.services.wikipedia.serviceName).toBe('WikipediaService')
      expect(health.services.wikidata.serviceName).toBe('WikidataService')
      
      expect(health.overall.totalServices).toBe(3)
      expect(health.overall.healthyServices).toBe(3)
    })
    
    it('should handle service health check errors', () => {
      mockHyDEService.getServiceStats.mockImplementation(() => {
        throw new Error('Health check failed')
      })
      
      const health = coordinator.getServiceHealth()
      
      expect(health.services.hyde.error).toBe('Health check failed')
      expect(health.services.hyde.healthy).toBe(false)
      expect(health.overall.healthyServices).toBe(2) // wikipedia and wikidata still healthy
    })
  })
  
  describe('resetStats', () => {
    it('should reset all statistics', () => {
      // First add some stats
      coordinator.updateStats(['hyde'], 1000, true)
      coordinator.updateStats(['wikipedia'], 2000, false)
      
      // Then reset
      coordinator.resetStats()
      
      expect(coordinator.stats.totalEnhancements).toBe(0)
      expect(coordinator.stats.successfulEnhancements).toBe(0)
      expect(coordinator.stats.failedEnhancements).toBe(0)
      expect(coordinator.stats.averageResponseTime).toBe(0)
      expect(coordinator.stats.lastEnhancementTime).toBeNull()
      expect(coordinator.stats.serviceUsage.hyde).toBe(0)
      expect(coordinator.stats.serviceUsage.wikipedia).toBe(0)
      expect(coordinator.stats.serviceUsage.wikidata).toBe(0)
    })
  })
  
  describe('clearCaches', () => {
    it('should clear caches for all services that support it', () => {
      mockHyDEService.clearCache = vi.fn()
      mockWikipediaService.clearCache = vi.fn()
      mockWikidataService.clearCache = vi.fn()
      
      coordinator.clearCaches()
      
      expect(mockHyDEService.clearCache).toHaveBeenCalled()
      expect(mockWikipediaService.clearCache).toHaveBeenCalled()
      expect(mockWikidataService.clearCache).toHaveBeenCalled()
    })
    
    it('should handle services without clearCache method', () => {
      // Don't add clearCache method to services
      
      expect(() => coordinator.clearCaches()).not.toThrow()
    })
  })
})