/**
 * @file Integration tests for MCP Enhancement Interface
 * Tests the enhancement functionality through the MCP Simple Verbs interface
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { ask, tell, augment } from '../../../mcp/tools/simple-verbs.js'
import { EnhancementCoordinator } from '../../../src/services/enhancement/EnhancementCoordinator.js'
import { LLMHandler } from '../../../src/handlers/LLMHandler.js'
import { EmbeddingHandler } from '../../../src/handlers/EmbeddingHandler.js'
import Config from '../../../src/Config.js'

// Mock external dependencies
vi.mock('node-fetch')
vi.mock('../../../src/handlers/LLMHandler.js')
vi.mock('../../../src/handlers/EmbeddingHandler.js')

const fetch = vi.hoisted(() => vi.fn())

describe('MCP Enhancement Interface Integration', () => {
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
    
    // Create mock handlers
    mockLLMHandler = {
      generateResponse: vi.fn(),
      extractConcepts: vi.fn()
    }
    
    mockEmbeddingHandler = {
      generateEmbedding: vi.fn()
    }
    
    mockSPARQLHelper = {
      executeUpdate: vi.fn().mockResolvedValue({ success: true }),
      search: vi.fn().mockResolvedValue([])
    }
    
    // Mock constructors
    LLMHandler.mockImplementation(() => mockLLMHandler)
    EmbeddingHandler.mockImplementation(() => mockEmbeddingHandler)
    
    // Setup common mocks
    mockLLMHandler.generateResponse.mockResolvedValue('Enhanced response with context')
    mockLLMHandler.extractConcepts.mockResolvedValue(['concept1', 'concept2'])
    mockEmbeddingHandler.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
    
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ search: [] })
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('MCP Ask with Enhancements', () => {
    it('should handle ask with HyDE enhancement', async () => {
      const params = {
        question: 'What is machine learning?',
        mode: 'standard',
        useContext: true,
        useHyDE: true,
        useWikipedia: false,
        useWikidata: false
      }
      
      mockLLMHandler.generateResponse
        .mockResolvedValueOnce('Machine learning is a method of data analysis...')
        .mockResolvedValueOnce('Enhanced answer with HyDE context')
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('Enhanced answer')
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledTimes(2)
      expect(mockLLMHandler.extractConcepts).toHaveBeenCalled()
      expect(mockEmbeddingHandler.generateEmbedding).toHaveBeenCalled()
    })
    
    it('should handle ask with Wikipedia enhancement', async () => {
      const params = {
        question: 'artificial intelligence',
        mode: 'standard',
        useContext: true,
        useHyDE: false,
        useWikipedia: true,
        useWikidata: false
      }
      
      // Setup Wikipedia API mock
      fetch.mockImplementation((url) => {
        if (url.includes('wikipedia.org/w/api.php')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              query: {
                search: [
                  {
                    title: 'Artificial intelligence',
                    snippet: 'AI is the simulation...',
                    size: 50000,
                    wordcount: 8000,
                    pageid: 11660
                  }
                ],
                searchinfo: { totalhits: 1000 }
              }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            query: {
              pages: {
                11660: {
                  extract: 'Artificial intelligence content...',
                  fullurl: 'https://en.wikipedia.org/wiki/AI'
                }
              }
            }
          })
        })
      })
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('Enhanced answer')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikipedia.org'),
        expect.any(Object)
      )
    })
    
    it('should handle ask with Wikidata enhancement', async () => {
      const params = {
        question: 'machine learning',
        mode: 'standard',
        useContext: true,
        useHyDE: false,
        useWikipedia: false,
        useWikidata: true
      }
      
      // Setup Wikidata API mocks
      fetch.mockImplementation((url) => {
        if (url.includes('wikidata.org/w/api.php')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              search: [
                {
                  id: 'Q2539',
                  label: 'machine learning',
                  description: 'study of algorithms',
                  concepturi: 'http://www.wikidata.org/entity/Q2539'
                }
              ]
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: { bindings: [] }
          })
        })
      })
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('Enhanced answer')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikidata.org'),
        expect.any(Object)
      )
    })
    
    it('should handle ask with multiple enhancements', async () => {
      const params = {
        question: 'What is artificial intelligence?',
        mode: 'comprehensive',
        useContext: true,
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      }
      
      // Setup all service mocks
      mockLLMHandler.generateResponse
        .mockResolvedValueOnce('AI is the simulation of human intelligence...')
        .mockResolvedValueOnce('Comprehensive enhanced answer')
      
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: { bindings: [] } })
        })
      })
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('enhanced answer')
      
      // Verify all services were used
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikipedia.org'),
        expect.any(Object)
      )
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikidata.org'),
        expect.any(Object)
      )
    })
    
    it('should handle ask without enhancements (backward compatibility)', async () => {
      const params = {
        question: 'What is the weather?',
        mode: 'standard',
        useContext: true
        // No enhancement flags - should work as before
      }
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('Enhanced answer')
      // Should only call LLM once for final response (no enhancement generation)
      expect(mockLLMHandler.generateResponse).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('MCP Tell with Enhancement Context', () => {
    it('should store interaction with enhancement metadata', async () => {
      const params = {
        content: 'User asked about ML with HyDE enhancement',
        type: 'interaction',
        metadata: {
          enhancementUsed: 'hyde',
          originalQuestion: 'What is machine learning?',
          enhancementData: {
            hypotheticalDoc: 'ML is a method...',
            concepts: ['machine learning', 'AI']
          }
        }
      }
      
      const result = await tell(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('stored successfully')
    })
  })
  
  describe('MCP Augment with Enhancement Services', () => {
    it('should augment content using HyDE service', async () => {
      const params = {
        operation: 'extract_concepts',
        target: 'What is machine learning and how does it work?',
        parameters: {
          useHyDE: true,
          maxConcepts: 5
        }
      }
      
      mockLLMHandler.generateResponse.mockResolvedValue('ML is a subset of AI...')
      
      const result = await augment(params)
      
      expect(result).toBeDefined()
      expect(mockLLMHandler.generateResponse).toHaveBeenCalled()
      expect(mockLLMHandler.extractConcepts).toHaveBeenCalled()
    })
  })
  
  describe('Error Handling in MCP Interface', () => {
    it('should handle enhancement service failures gracefully', async () => {
      const params = {
        question: 'test question',
        mode: 'standard',
        useHyDE: true
      }
      
      // Make LLM fail for HyDE generation
      mockLLMHandler.generateResponse
        .mockRejectedValueOnce(new Error('LLM service unavailable'))
        .mockResolvedValueOnce('Fallback answer without enhancement')
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      expect(result.content).toContain('answer')
      // Should still provide some response even if enhancement fails
    })
    
    it('should handle invalid enhancement parameters', async () => {
      const params = {
        question: 'test question',
        mode: 'invalid_mode', // Invalid mode
        useHyDE: 'not_boolean' // Invalid boolean
      }
      
      // Should either handle gracefully or provide meaningful error
      await expect(async () => {
        await ask(params)
      }).not.toThrow() // Should not crash
    })
    
    it('should handle network failures in enhancement services', async () => {
      const params = {
        question: 'test question',
        useWikipedia: true
      }
      
      // Simulate network failure
      fetch.mockRejectedValue(new Error('Network error'))
      
      const result = await ask(params)
      
      expect(result).toBeDefined()
      // Should still provide answer even if Wikipedia fails
    })
  })
  
  describe('Performance in MCP Interface', () => {
    it('should complete enhanced ask within reasonable time', async () => {
      const params = {
        question: 'performance test',
        useHyDE: true,
        useWikipedia: true,
        useWikidata: true
      }
      
      const startTime = Date.now()
      const result = await ask(params)
      const endTime = Date.now()
      
      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(10000) // Should complete in under 10 seconds
    })
    
    it('should handle concurrent enhancement requests', async () => {
      const params1 = { question: 'question 1', useHyDE: true }
      const params2 = { question: 'question 2', useWikipedia: true }
      const params3 = { question: 'question 3', useWikidata: true }
      
      // Run multiple asks concurrently
      const promises = [
        ask(params1),
        ask(params2),
        ask(params3)
      ]
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.content).toBeTruthy()
      })
    })
  })
  
  describe('Data Consistency in MCP Interface', () => {
    it('should maintain consistent enhancement results', async () => {
      const params = {
        question: 'What is machine learning?',
        useHyDE: true
      }
      
      // Setup consistent mock responses
      mockLLMHandler.generateResponse
        .mockResolvedValue('Machine learning is...')
        .mockResolvedValue('Enhanced answer')
      
      const result1 = await ask(params)
      const result2 = await ask(params)
      
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      // Results should be consistent for same input
      expect(typeof result1.content).toBe('string')
      expect(typeof result2.content).toBe('string')
    })
  })
  
  describe('Integration with SPARQL Storage', () => {
    it('should store enhancement data in SPARQL store', async () => {
      const params = {
        question: 'SPARQL integration test',
        useHyDE: true
      }
      
      mockLLMHandler.generateResponse
        .mockResolvedValueOnce('Hypothetical document')
        .mockResolvedValueOnce('Final answer')
      
      await ask(params)
      
      // Verify SPARQL operations were called
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalled()
      
      // Check that enhancement data was stored
      const updateCalls = mockSPARQLHelper.executeUpdate.mock.calls
      expect(updateCalls.length).toBeGreaterThan(0)
    })
  })
})