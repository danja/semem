/**
 * @file Unit tests for WikipediaService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WikipediaService } from '../../../../src/services/enhancement/WikipediaService.js'
import { SPARQLQueryService } from '../../../../src/services/sparql/SPARQLQueryService.js'

// Mock dependencies
vi.mock('../../../../src/services/sparql/SPARQLQueryService.js')
vi.mock('node-fetch')
vi.mock('loglevel', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

const fetch = vi.hoisted(() => vi.fn())
vi.mocked(fetch)

describe('WikipediaService', () => {
  let service
  let mockEmbeddingHandler
  let mockSPARQLHelper
  let mockQueryService
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock handlers
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
    
    service = new WikipediaService({
      embeddingHandler: mockEmbeddingHandler,
      sparqlHelper: mockSPARQLHelper
    })
    
    // Mock global fetch
    global.fetch = fetch
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('constructor', () => {
    it('should initialize with default settings', () => {
      const service = new WikipediaService()
      
      expect(service.settings.apiEndpoint).toBe('https://en.wikipedia.org/api/rest_v1')
      expect(service.settings.searchEndpoint).toBe('https://en.wikipedia.org/w/api.php')
      expect(service.settings.maxResults).toBe(5)
      expect(service.settings.rateLimit).toBe(200)
      expect(service.settings.storageGraph).toBe('http://hyperdata.it/content')
    })
    
    it('should initialize with custom settings', () => {
      const service = new WikipediaService({
        maxResults: 10,
        rateLimit: 500,
        storageGraph: 'http://example.org/graph'
      })
      
      expect(service.settings.maxResults).toBe(10)
      expect(service.settings.rateLimit).toBe(500)
      expect(service.settings.storageGraph).toBe('http://example.org/graph')
    })
  })
  
  describe('searchWikipedia', () => {
    const mockSearchResponse = {
      query: {
        search: [
          {
            title: 'Machine learning',
            snippet: 'Machine learning is a method of data analysis...',
            size: 50000,
            wordcount: 8000,
            timestamp: '2023-01-01T00:00:00Z',
            pageid: 123456
          },
          {
            title: 'Artificial intelligence',
            snippet: 'AI is the simulation of human intelligence...',
            size: 75000,
            wordcount: 12000,
            timestamp: '2023-01-02T00:00:00Z',
            pageid: 789012
          }
        ],
        searchinfo: { totalhits: 1000 }
      }
    }
    
    it('should search Wikipedia successfully', async () => {
      const query = 'machine learning'
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      })
      
      const result = await service.searchWikipedia(query)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('en.wikipedia.org/w/api.php'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String)
          })
        })
      )
      
      expect(result.query).toBe(query)
      expect(result.results).toHaveLength(2)
      expect(result.totalHits).toBe(1000)
      expect(result.searchId).toMatch(/^wiki_\d+_[a-z0-9]+$/)
      
      const firstResult = result.results[0]
      expect(firstResult.title).toBe('Machine learning')
      expect(firstResult.snippet).toContain('data analysis')
      expect(firstResult.pageId).toBe(123456)
      expect(firstResult.url).toContain('Machine_learning')
      expect(firstResult.relevanceScore).toBeGreaterThan(0)
    })
    
    it('should use cached results when available', async () => {
      const query = 'test query'
      
      // First call
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      })
      
      await service.searchWikipedia(query)
      await service.searchWikipedia(query) // Second call should use cache
      
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    
    it('should handle API errors', async () => {
      const query = 'test query'
      
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      
      await expect(service.searchWikipedia(query))
        .rejects.toThrow('Wikipedia search failed: Wikipedia API error: 500 Internal Server Error')
    })
    
    it('should handle network errors', async () => {
      const query = 'test query'
      
      fetch.mockRejectedValue(new Error('Network error'))
      
      await expect(service.searchWikipedia(query))
        .rejects.toThrow('Wikipedia search failed: Network error')
    })
    
    it('should handle invalid response format', async () => {
      const query = 'test query'
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })
      
      await expect(service.searchWikipedia(query))
        .rejects.toThrow('Wikipedia search failed: Invalid Wikipedia API response format')
    })
  })
  
  describe('fetchArticleContent', () => {
    const mockArticles = [
      {
        title: 'Machine learning',
        pageId: 123456,
        url: 'https://en.wikipedia.org/wiki/Machine_learning'
      }
    ]
    
    const mockContentResponse = {
      query: {
        pages: {
          123456: {
            extract: 'Machine learning is a method of data analysis that automates analytical model building...',
            fullurl: 'https://en.wikipedia.org/wiki/Machine_learning'
          }
        }
      }
    }
    
    it('should fetch article content successfully', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockContentResponse)
      })
      
      const result = await service.fetchArticleContent(mockArticles)
      
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Machine learning')
      expect(result[0].content).toContain('data analysis')
      expect(result[0].hasContent).toBe(true)
      expect(result[0].contentLength).toBeGreaterThan(0)
    })
    
    it('should truncate content if too long', async () => {
      const longContent = 'A'.repeat(3000)
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          query: {
            pages: {
              123456: {
                extract: longContent,
                fullurl: 'https://en.wikipedia.org/wiki/Test'
              }
            }
          }
        })
      })
      
      const result = await service.fetchArticleContent(mockArticles)
      
      expect(result[0].content).toBe('A'.repeat(2000) + '...')
      expect(result[0].contentLength).toBe(2003)
    })
    
    it('should handle articles without content', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          query: {
            pages: {
              123456: {} // No extract
            }
          }
        })
      })
      
      const result = await service.fetchArticleContent(mockArticles)
      
      expect(result[0].hasContent).toBe(false)
      expect(result[0].content).toBe('')
    })
    
    it('should handle fetch errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'))
      
      const result = await service.fetchArticleContent(mockArticles)
      
      expect(result[0].hasContent).toBe(false)
      expect(result[0].error).toBe('Network error')
    })
  })
  
  describe('storeWikipediaContext', () => {
    const mockSearchResults = {
      results: [
        {
          title: 'Test Article',
          content: 'Test content',
          snippet: 'Test snippet',
          pageId: 123,
          url: 'https://en.wikipedia.org/wiki/Test',
          relevanceScore: 0.8
        }
      ],
      searchId: 'wiki_123_abc'
    }
    
    it('should store Wikipedia context successfully', async () => {
      const embedding = [0.1, 0.2, 0.3]
      const expectedQuery = 'INSERT DATA { ... }'
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockQueryService.getQuery.mockResolvedValue(expectedQuery)
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeWikipediaContext(mockSearchResults, 'test query')
      
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalledWith('Test content')
      expect(mockQueryService.getQuery).toHaveBeenCalledWith('store-wikipedia-article', expect.any(Object))
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalledWith(expectedQuery)
      expect(result).toHaveLength(1)
      expect(result[0].uri).toContain('wikipedia-article/Test')
      expect(result[0].embedding).toEqual(embedding)
    })
    
    it('should handle missing SPARQL helper', async () => {
      service.sparqlHelper = null
      
      const result = await service.storeWikipediaContext(mockSearchResults, 'test query')
      
      expect(result).toEqual([])
    })
    
    it('should use fallback query when template fails', async () => {
      const embedding = [0.1, 0.2, 0.3]
      
      mockEmbeddingHandler.generateEmbedding.mockResolvedValue(embedding)
      mockQueryService.getQuery.mockRejectedValue(new Error('Template not found'))
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeWikipediaContext(mockSearchResults, 'test query')
      
      expect(result).toHaveLength(1)
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
    })
  })
  
  describe('enhanceQueryWithWikipedia', () => {
    const originalQuery = 'What is AI?'
    const searchResults = {
      totalHits: 1000,
      searchId: 'wiki_123_abc',
      results: [
        {
          title: 'Artificial Intelligence',
          content: 'AI is the simulation of human intelligence...',
          url: 'https://en.wikipedia.org/wiki/AI',
          relevanceScore: 0.9,
          hasContent: true,
          wordcount: 5000
        }
      ]
    }
    
    it('should enhance query with Wikipedia context', async () => {
      const result = await service.enhanceQueryWithWikipedia(originalQuery, searchResults)
      
      expect(result.enhancedPrompt).toContain(originalQuery)
      expect(result.enhancedPrompt).toContain('Artificial Intelligence')
      expect(result.enhancedPrompt).toContain('simulation of human intelligence')
      
      expect(result.wikipediaContext.originalQuery).toBe(originalQuery)
      expect(result.wikipediaContext.articles).toHaveLength(1)
      expect(result.metadata.searchId).toBe('wiki_123_abc')
      expect(result.metadata.articleCount).toBe(1)
    })
  })
  
  describe('processQueryWithWikipedia', () => {
    it('should execute full Wikipedia pipeline successfully', async () => {
      const query = 'artificial intelligence'
      const searchResults = {
        results: [{ title: 'AI', content: 'AI content' }],
        searchId: 'wiki_123'
      }
      const articlesWithContent = [{ title: 'AI', content: 'Full AI content', hasContent: true }]
      const storedContext = [{ uri: 'http://example.org/article', title: 'AI' }]
      
      // Mock the pipeline methods
      vi.spyOn(service, 'searchWikipedia').mockResolvedValue(searchResults)
      vi.spyOn(service, 'fetchArticleContent').mockResolvedValue(articlesWithContent)
      vi.spyOn(service, 'storeWikipediaContext').mockResolvedValue(storedContext)
      vi.spyOn(service, 'enhanceQueryWithWikipedia').mockResolvedValue({
        enhancedPrompt: 'Enhanced prompt',
        wikipediaContext: {},
        metadata: {}
      })
      
      const result = await service.processQueryWithWikipedia(query)
      
      expect(result.success).toBe(true)
      expect(result.originalQuery).toBe(query)
      expect(result.searchResults).toBe(searchResults)
      expect(result.articlesWithContent).toBe(articlesWithContent)
      expect(result.storedContext).toBe(storedContext)
      expect(result.stats.articlesFound).toBe(1)
      expect(result.stats.articlesWithContent).toBe(1)
    })
    
    it('should handle pipeline errors gracefully', async () => {
      const query = 'test query'
      const error = new Error('Pipeline failed')
      
      vi.spyOn(service, 'searchWikipedia').mockRejectedValue(error)
      
      const result = await service.processQueryWithWikipedia(query)
      
      expect(result.success).toBe(false)
      expect(result.originalQuery).toBe(query)
      expect(result.error).toBe('Pipeline failed')
      expect(result.stats.failed).toBe(true)
    })
  })
  
  describe('calculateRelevanceScore', () => {
    const searchResult = {
      title: 'Machine Learning',
      snippet: 'Machine learning is a method of data analysis...',
      wordcount: 5000
    }
    
    it('should calculate relevance score based on title and content match', () => {
      const score = service.calculateRelevanceScore(searchResult, 'machine learning')
      
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(1)
    })
    
    it('should give higher scores for exact title matches', () => {
      const exactMatch = service.calculateRelevanceScore(searchResult, 'Machine Learning')
      const partialMatch = service.calculateRelevanceScore(searchResult, 'learning')
      
      expect(exactMatch).toBeGreaterThan(partialMatch)
    })
    
    it('should include size bonus for larger articles', () => {
      const largeArticle = { ...searchResult, wordcount: 10000 }
      const smallArticle = { ...searchResult, wordcount: 1000 }
      
      const largeScore = service.calculateRelevanceScore(largeArticle, 'test')
      const smallScore = service.calculateRelevanceScore(smallArticle, 'test')
      
      expect(largeScore).toBeGreaterThan(smallScore)
    })
  })
  
  describe('getServiceStats', () => {
    it('should return service statistics', () => {
      const stats = service.getServiceStats()
      
      expect(stats.serviceName).toBe('WikipediaService')
      expect(stats.settings).toBeDefined()
      expect(stats.handlers.embedding).toBe(true)
      expect(stats.handlers.sparql).toBe(true)
      expect(stats.capabilities.search).toBe(true)
      expect(stats.capabilities.contentFetch).toBe(true)
      expect(stats.capabilities.contextStorage).toBe(true)
    })
  })
})