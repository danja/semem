/**
 * @file Integration tests for Enhancement Services
 * Tests the full enhancement pipeline from MCP interface through to SPARQL storage
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { EnhancementCoordinator } from '../../../../src/services/enhancement/EnhancementCoordinator.js'
import { HyDEService } from '../../../../src/services/enhancement/HyDEService.js'
import { WikipediaService } from '../../../../src/services/enhancement/WikipediaService.js'
import { WikidataService } from '../../../../src/services/enhancement/WikidataService.js'
import { LLMHandler } from '../../../../src/handlers/LLMHandler.js'
import { EmbeddingHandler } from '../../../../src/handlers/EmbeddingHandler.js'
import Config from '../../../../src/Config.js'

// Mock external dependencies but keep real service logic
vi.mock('node-fetch')
vi.mock('../../../../src/handlers/LLMHandler.js')
vi.mock('../../../../src/handlers/EmbeddingHandler.js')

const fetch = vi.hoisted(() => vi.fn())

describe('Enhancement Services Integration', () => {
  let coordinator
  let mockLLMHandler
  let mockEmbeddingHandler
  let mockSPARQLHelper
  let config
  
  beforeAll(async () => {
    // Initialize real config
    config = new Config()
    
    // Mock global fetch
    global.fetch = fetch
  })
  
  beforeEach(() => {
    vi.clearAllMocks()
    
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
    
    // Mock LLMHandler and EmbeddingHandler constructors
    LLMHandler.mockImplementation(() => mockLLMHandler)
    EmbeddingHandler.mockImplementation(() => mockEmbeddingHandler)
    
    coordinator = new EnhancementCoordinator({
      llmHandler: mockLLMHandler,
      embeddingHandler: mockEmbeddingHandler,
      sparqlHelper: mockSPARQLHelper,
      config: config
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Full Enhancement Pipeline', () => {
    it('should execute complete HyDE enhancement pipeline', async () => {
      const query = 'What is machine learning?'
      const hypotheticalDoc = 'Machine learning is a method of data analysis that automates analytical model building. It is a branch of artificial intelligence based on the idea that systems can learn from data, identify patterns and make decisions with minimal human intervention.'
      const concepts = ['machine learning', 'artificial intelligence', 'data analysis']
      const embedding = new Array(1536).fill(0.1)
      
      // Setup realistic mocks
      mockLLMHandler.generateResponse
        .mockResolvedValueOnce(hypotheticalDoc) // For hypothetical document generation
        .mockResolvedValueOnce('Enhanced answer based on HyDE context') // For final response
      mockLLMHandler.extractConcepts.mockResolvedValue(concepts)
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      
      const result = await coordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.enhancedAnswer).toContain('Enhanced answer')
      expect(result.metadata.servicesUsed).toContain('hyde')
      expect(result.stats.successfulServices).toBe(1)
      
      // Verify pipeline steps were called
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledTimes(2)
      expect(mockLLMHandler.extractConcepts).toHaveBeenCalledWith(hypotheticalDoc)
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalledWith(hypotheticalDoc)
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
    })
    
    it('should execute complete Wikipedia enhancement pipeline', async () => {
      const query = 'artificial intelligence'
      const mockWikipediaResponse = {
        query: {
          search: [
            {
              title: 'Artificial intelligence',
              snippet: 'AI is the simulation of human intelligence in machines...',
              size: 50000,
              wordcount: 8000,
              timestamp: '2023-01-01T00:00:00Z',
              pageid: 11660
            }
          ],
          searchinfo: { totalhits: 1000 }
        }
      }
      const mockContentResponse = {
        query: {
          pages: {
            11660: {
              extract: 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals.',
              fullurl: 'https://en.wikipedia.org/wiki/Artificial_intelligence'
            }
          }
        }
      }
      const embedding = new Array(1536).fill(0.2)
      
      // Setup Wikipedia API mocks
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWikipediaResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockContentResponse)
        })
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer with Wikipedia context')
      
      const result = await coordinator.enhanceQuery(query, { useWikipedia: true })
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.metadata.servicesUsed).toContain('wikipedia')
      
      // Verify Wikipedia API calls
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('en.wikipedia.org/w/api.php'),
        expect.any(Object)
      )
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalled()
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
    })
    
    it('should execute complete Wikidata enhancement pipeline', async () => {
      const query = 'machine learning'
      const mockWikidataSearchResponse = {
        search: [
          {
            id: 'Q2539',
            label: 'machine learning',
            description: 'study of algorithms and statistical models',
            concepturi: 'http://www.wikidata.org/entity/Q2539'
          }
        ]
      }
      const mockWikidataSPARQLResponse = {
        results: {
          bindings: [
            {
              entity: { value: 'http://www.wikidata.org/entity/Q2539' },
              entityLabel: { value: 'machine learning' },
              entityDescription: { value: 'study of algorithms and statistical models' },
              property: { value: 'http://www.wikidata.org/prop/direct/P31' },
              propertyLabel: { value: 'instance of' },
              value: { value: 'http://www.wikidata.org/entity/Q336' },
              valueLabel: { value: 'science' }
            }
          ]
        }
      }
      
      // Setup Wikidata API mocks
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWikidataSearchResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWikidataSPARQLResponse)
        })
      
      mockLLMHandler.generateResponse.mockResolvedValue('Enhanced answer with Wikidata context')
      
      const result = await coordinator.enhanceQuery(query, { useWikidata: true })
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.metadata.servicesUsed).toContain('wikidata')
      
      // Verify Wikidata API calls
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikidata.org/w/api.php'),
        expect.any(Object)
      )
      expect(fetch).toHaveBeenCalledWith(
        'https://query.wikidata.org/sparql',
        expect.any(Object)
      )
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
    })
    
    it('should execute multi-service enhancement pipeline concurrently', async () => {
      const query = 'What is artificial intelligence?'
      
      // Setup all service mocks
      const hypotheticalDoc = 'AI is the simulation of human intelligence...'
      const concepts = ['artificial intelligence', 'machine learning']
      const embedding = new Array(1536).fill(0.3)
      
      mockLLMHandler.generateResponse
        .mockResolvedValue(hypotheticalDoc)
        .mockResolvedValue('Comprehensive enhanced answer')
      mockLLMHandler.extractConcepts.mockResolvedValue(concepts)
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      
      // Setup Wikipedia mock
      fetch.mockImplementation((url) => {
        if (url.includes('wikipedia.org/w/api.php')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              query: {
                search: [{ title: 'AI', snippet: 'AI...', pageid: 1 }],
                searchinfo: { totalhits: 1 }
              }
            })
          })
        }
        if (url.includes('wikidata.org/w/api.php')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              search: [{ id: 'Q11660', label: 'AI' }]
            })
          })
        }
        if (url.includes('query.wikidata.org/sparql')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: { bindings: [] }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        })
      })
      
      const startTime = Date.now()
      const result = await coordinator.enhanceQuery(query, {
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      })
      const endTime = Date.now()
      
      expect(result.success).toBe(true)
      expect(result.enhancementType).toBe('combined')
      expect(result.metadata.servicesUsed).toEqual(['hyde', 'wikipedia', 'wikidata'])
      expect(result.individualResults.executionMode).toBe('concurrent')
      expect(result.stats.successfulServices).toBe(3)
      
      // Verify concurrent execution (should be faster than sequential)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete quickly with mocks
    })
  })
  
  describe('Error Handling and Resilience', () => {
    it('should handle partial service failures gracefully', async () => {
      const query = 'test query'
      
      // Setup HyDE to succeed, Wikipedia to fail
      mockLLMHandler.generateResponse.mockResolvedValue('Hypothetical doc')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      fetch.mockImplementation((url) => {
        if (url.includes('wikipedia.org')) {
          return Promise.reject(new Error('Wikipedia API error'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ search: [] })
        })
      })
      
      const result = await coordinator.enhanceQuery(query, {
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      })
      
      expect(result.success).toBe(true)
      expect(result.individualResults.successful).toHaveLength(2) // HyDE and Wikidata
      expect(result.individualResults.failed).toHaveLength(1) // Wikipedia
      expect(result.stats.successfulServices).toBe(2)
      expect(result.stats.failedServices).toBe(1)
    })
    
    it('should handle SPARQL storage failures without breaking pipeline', async () => {
      const query = 'test query'
      
      // Make SPARQL fail but other services succeed
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: false, error: 'SPARQL error' })
      mockLLMHandler.generateResponse.mockResolvedValue('Hypothetical doc')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      const result = await coordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result.success).toBe(true) // Pipeline should still succeed
      expect(result.enhancementType).toBe('combined')
      // Storage failure shouldn't prevent answer generation
    })
    
    it('should handle network timeouts gracefully', async () => {
      const query = 'test query'
      
      // Simulate network timeout
      fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100)
        })
      })
      
      const result = await coordinator.enhanceQuery(query, { useWikipedia: true })
      
      expect(result.success).toBe(true)
      expect(result.individualResults.failed).toHaveLength(1)
      expect(result.individualResults.failed[0].error).toContain('timeout')
    })
  })
  
  describe('Performance and Scalability', () => {
    it('should complete enhancement within reasonable time limits', async () => {
      const query = 'performance test query'
      
      // Setup fast mock responses
      mockLLMHandler.generateResponse.mockResolvedValue('Quick response')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ search: [] })
      })
      
      const startTime = Date.now()
      const result = await coordinator.enhanceQuery(query, {
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      })
      const endTime = Date.now()
      
      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(2000) // Should complete in under 2 seconds with mocks
    })
    
    it('should handle context length limits properly', async () => {
      const query = 'context length test'
      const longContent = 'A'.repeat(10000) // Very long content
      
      mockLLMHandler.generateResponse.mockResolvedValue(longContent)
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      // Set a small context limit
      coordinator.settings.maxCombinedContextLength = 1000
      
      const result = await coordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result.success).toBe(true)
      expect(result.enhancedPrompt.length).toBeLessThanOrEqual(1050) // Limit + truncation message
    })
  })
  
  describe('Data Quality and Consistency', () => {
    it('should maintain consistent URI generation across services', async () => {
      const query = 'consistency test'
      
      mockLLMHandler.generateResponse.mockResolvedValue('Test content')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      // Run enhancement twice
      const result1 = await coordinator.enhanceQuery(query, { useHyDE: true })
      const result2 = await coordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      
      // URIs should be different (include timestamps)
      expect(result1.metadata).not.toEqual(result2.metadata)
    })
    
    it('should generate proper embeddings for all content types', async () => {
      const query = 'embedding test'
      
      // Test different content types
      const contents = [
        'Short text',
        'A'.repeat(1000), // Medium text
        'A'.repeat(5000)  // Long text
      ]
      
      for (const content of contents) {
        mockLLMHandler.generateResponse.mockResolvedValueOnce(content)
        mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
        mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
        
        const result = await coordinator.enhanceQuery(query, { useHyDE: true })
        
        expect(result.success).toBe(true)
        expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalledWith(
          expect.any(String)
        )
      }
    })
  })
  
  describe('Configuration and Customization', () => {
    it('should respect custom enhancement settings', async () => {
      const customCoordinator = new EnhancementCoordinator({
        llmHandler: mockLLMHandler,
        embeddingHandler: mockEmbeddingHandler,
        sparqlHelper: mockSPARQLHelper,
        config: config,
        maxCombinedContextLength: 500,
        enableConcurrentProcessing: false,
        hydeWeight: 0.6,
        wikipediaWeight: 0.3,
        wikidataWeight: 0.1
      })
      
      const query = 'custom settings test'
      
      mockLLMHandler.generateResponse.mockResolvedValue('Test content')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      const result = await customCoordinator.enhanceQuery(query, { useHyDE: true })
      
      expect(result.success).toBe(true)
      expect(customCoordinator.settings.maxCombinedContextLength).toBe(500)
      expect(customCoordinator.settings.enableConcurrentProcessing).toBe(false)
      expect(customCoordinator.settings.contextWeights.hyde).toBe(0.6)
    })
  })
  
  describe('Statistics and Monitoring', () => {
    it('should track comprehensive enhancement statistics', async () => {
      const query = 'statistics test'
      
      mockLLMHandler.generateResponse.mockResolvedValue('Test content')
      mockLLMHandler.extractConcepts.mockResolvedValue(['concept'])
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
      
      // Reset stats
      coordinator.resetStats()
      
      await coordinator.enhanceQuery(query, { useHyDE: true })
      await coordinator.enhanceQuery(query, { useWikipedia: false }) // No enhancement
      
      const stats = coordinator.stats
      
      expect(stats.totalEnhancements).toBe(2)
      expect(stats.successfulEnhancements).toBe(2)
      expect(stats.serviceUsage.hyde).toBe(1)
      expect(stats.averageResponseTime).toBeGreaterThan(0)
    })
  })
})