/**
 * Unit tests for SPARQLStore lazy storage functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import SPARQLStore from '../../../../src/stores/SPARQLStore.js'

// Mock the fetch function globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SPARQLStore Lazy Storage', () => {
  let store

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock successful responses
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
      text: vi.fn().mockResolvedValue('OK')
    })

    // Create SPARQLStore instance
    store = new SPARQLStore('http://localhost:3030/test/query', {
      update: 'http://localhost:3030/test/update',
      user: 'test',
      password: 'test',
      graphName: 'http://test.graph'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('storeLazyContent', () => {
    it('should store content with lazy processing status', async () => {
      const lazyData = {
        id: 'semem:test_123',
        content: 'Test lazy content',
        type: 'concept',
        metadata: { title: 'Test Item' }
      }

      await store.storeLazyContent(lazyData)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/test/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/sparql-update'
          })
        })
      )
      
      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = fetchCall[1].body
      expect(requestBody).toContain('INSERT DATA')
      expect(requestBody).toContain('ragno:content "Test lazy content"')
      expect(requestBody).toContain('semem:processingStatus "lazy"')
      expect(requestBody).toContain('ragno:subType semem:concept')
      expect(requestBody).toContain('ragno:isEntryPoint false')
    })

    it('should handle different content types', async () => {
      const types = ['concept', 'interaction', 'document']
      
      for (const type of types) {
        const lazyData = {
          id: `semem:test_${type}`,
          content: `Test ${type} content`,
          type: type
        }

        await store.storeLazyContent(lazyData)
        
        const fetchCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
        const requestBody = fetchCall[1].body
        expect(requestBody).toContain(`ragno:subType semem:${type}`)
      }
    })

    it('should escape special characters in content', async () => {
      const lazyData = {
        id: 'semem:test_escape',
        content: 'Content with "quotes" and \\backslashes',
        type: 'concept'
      }

      await store.storeLazyContent(lazyData)
      
      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = fetchCall[1].body
      expect(requestBody).toContain('\\"quotes\\"')
      expect(requestBody).toContain('\\\\backslashes')
    })

    it('should throw error if data has no id', async () => {
      const lazyData = {
        content: 'Test content',
        type: 'concept'
      }

      await expect(store.storeLazyContent(lazyData)).rejects.toThrow('Data must have an id field')
    })
  })

  describe('findLazyContent', () => {
    it('should query for lazy content with proper filters', async () => {
      const mockResults = {
        results: {
          bindings: [
            {
              element: { value: 'semem:test_1' },
              content: { value: 'Test content 1' },
              label: { value: 'Test Label' },
              type: { value: 'http://purl.org/stuff/semem/concept' },
              created: { value: '2023-01-01T00:00:00Z' }
            }
          ]
        }
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResults),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResults))
      })

      const results = await store.findLazyContent(5)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/test/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/sparql-query'
          })
        })
      )
      
      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = fetchCall[1].body
      expect(requestBody).toContain('semem:processingStatus "lazy"')
      
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        id: 'semem:test_1',
        content: 'Test content 1',
        label: 'Test Label',
        type: 'http://purl.org/stuff/semem/concept',
        created: '2023-01-01T00:00:00Z'
      })
    })

    it('should respect limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } }),
        text: vi.fn().mockResolvedValue('{"results":{"bindings":[]}}')
      })

      await store.findLazyContent(10)

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = fetchCall[1].body
      expect(requestBody).toContain('LIMIT 10')
    })

    it('should use default limit when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } }),
        text: vi.fn().mockResolvedValue('{"results":{"bindings":[]}}')
      })

      await store.findLazyContent()

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = fetchCall[1].body
      expect(requestBody).toContain('LIMIT 10')
    })
  })

  describe('updateLazyToProcessed', () => {
    it('should update lazy content with embeddings and concepts', async () => {
      const embedding = new Array(1536).fill(0.1)
      const concepts = ['concept1', 'concept2', 'concept3']

      await store.updateLazyToProcessed('semem:test_123', embedding, concepts)

      expect(mockFetch).toHaveBeenCalledTimes(1) // Single DELETE/INSERT call

      const call = mockFetch.mock.calls[0]
      const requestBody = call[1].body

      // Check combined DELETE/INSERT query
      expect(requestBody).toContain('DELETE')
      expect(requestBody).toContain('INSERT')
      expect(requestBody).toContain('semem:processingStatus "lazy"')
      expect(requestBody).toContain('semem:processingStatus "processed"')
      expect(requestBody).toContain('ragno:embedding')
      expect(requestBody).toContain('skos:related')
    })

    it('should handle empty concepts array', async () => {
      const embedding = new Array(1536).fill(0.1)
      const concepts = []

      await store.updateLazyToProcessed('semem:test_123', embedding, concepts)

      const call = mockFetch.mock.calls[0]
      const requestBody = call[1].body
      expect(requestBody).toContain('semem:processingStatus "processed"')
      expect(requestBody).toContain('ragno:embedding')
      // Should not contain skos:related when no concepts
      expect(requestBody).not.toContain('skos:related')
    })

    it('should handle different embedding sizes', async () => {
      const smallEmbedding = new Array(512).fill(0.1) // Different dimension
      const concepts = ['concept1']

      await store.updateLazyToProcessed('semem:test_123', smallEmbedding, concepts)

      const call = mockFetch.mock.calls[0]
      const requestBody = call[1].body
      expect(requestBody).toContain('ragno:embedding')
      expect(requestBody).toContain('semem:processingStatus "processed"')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete lazy workflow', async () => {
      // 1. Store lazy content
      const lazyData = {
        id: 'semem:workflow_test',
        content: 'Complete workflow test',
        type: 'concept',
        metadata: { title: 'Workflow Test' }
      }

      await store.storeLazyContent(lazyData)

      // 2. Find lazy content - setup mock for SELECT query
      const mockLazyResults = {
        results: {
          bindings: [{
            element: { value: 'semem:workflow_test' },
            content: { value: 'Complete workflow test' },
            label: { value: 'Workflow Test' },
            type: { value: 'http://purl.org/stuff/semem/concept' },
            created: { value: '2023-01-01T00:00:00Z' }
          }]
        }
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockLazyResults),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockLazyResults))
      })

      const foundItems = await store.findLazyContent()

      expect(foundItems).toHaveLength(1)
      expect(foundItems[0].id).toBe('semem:workflow_test')

      // 3. Process lazy content
      const embedding = new Array(1536).fill(0.1)
      const concepts = ['workflow', 'test', 'complete']

      await store.updateLazyToProcessed('semem:workflow_test', embedding, concepts)

      // Verify all operations were called
      expect(mockFetch).toHaveBeenCalledTimes(3) // store + select + update
    })
  })
})