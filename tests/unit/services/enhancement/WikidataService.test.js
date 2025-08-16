/**
 * @file Unit tests for WikidataService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WikidataService } from '../../../../src/services/enhancement/WikidataService.js'
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

describe('WikidataService', () => {
  let service
  let mockSPARQLHelper
  let mockQueryService
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock handlers
    mockSPARQLHelper = {
      executeUpdate: vi.fn()
    }
    
    mockQueryService = {
      getQuery: vi.fn()
    }
    
    // Mock SPARQLQueryService constructor
    SPARQLQueryService.mockImplementation(() => mockQueryService)
    
    service = new WikidataService({
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
      const service = new WikidataService()
      
      expect(service.settings.wikidataEndpoint).toBe('https://query.wikidata.org/sparql')
      expect(service.settings.searchEndpoint).toBe('https://www.wikidata.org/w/api.php')
      expect(service.settings.maxEntities).toBe(10)
      expect(service.settings.maxRelationships).toBe(20)
      expect(service.settings.rateLimit).toBe(500)
      expect(service.settings.storageGraph).toBe('http://hyperdata.it/content')
    })
    
    it('should initialize with custom settings', () => {
      const service = new WikidataService({
        maxEntities: 20,
        maxRelationships: 50,
        rateLimit: 1000,
        storageGraph: 'http://example.org/graph'
      })
      
      expect(service.settings.maxEntities).toBe(20)
      expect(service.settings.maxRelationships).toBe(50)
      expect(service.settings.rateLimit).toBe(1000)
      expect(service.settings.storageGraph).toBe('http://example.org/graph')
    })
  })
  
  describe('searchWikidataEntities', () => {
    const mockEntitySearchResponse = {
      search: [
        {
          id: 'Q11660',
          label: 'artificial intelligence',
          description: 'intelligence exhibited by machines',
          concepturi: 'http://www.wikidata.org/entity/Q11660',
          match: { type: 'label', language: 'en', text: 'artificial intelligence' }
        },
        {
          id: 'Q2539',
          label: 'machine learning',
          description: 'study of algorithms and statistical models',
          concepturi: 'http://www.wikidata.org/entity/Q2539',
          aliases: ['ML', 'statistical learning']
        }
      ]
    }
    
    it('should search Wikidata entities successfully', async () => {
      const query = 'artificial intelligence'
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEntitySearchResponse)
      })
      
      const result = await service.searchWikidataEntities(query)
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('wikidata.org/w/api.php'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String)
          })
        })
      )
      
      expect(result.query).toBe(query)
      expect(result.entities).toHaveLength(2)
      expect(result.totalFound).toBe(2)
      expect(result.searchId).toMatch(/^wikidata_\d+_[a-z0-9]+$/)
      
      const firstEntity = result.entities[0]
      expect(firstEntity.wikidataId).toBe('Q11660')
      expect(firstEntity.label).toBe('artificial intelligence')
      expect(firstEntity.description).toContain('intelligence exhibited')
      expect(firstEntity.url).toBe('http://www.wikidata.org/entity/Q11660')
      expect(firstEntity.relevanceScore).toBeGreaterThan(0)
    })
    
    it('should use cached results when available', async () => {
      const query = 'test query'
      
      // First call
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEntitySearchResponse)
      })
      
      await service.searchWikidataEntities(query)
      await service.searchWikidataEntities(query) // Second call should use cache
      
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    
    it('should handle API errors', async () => {
      const query = 'test query'
      
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      
      await expect(service.searchWikidataEntities(query))
        .rejects.toThrow('Wikidata entity search failed: Wikidata search API error: 500 Internal Server Error')
    })
    
    it('should handle invalid response format', async () => {
      const query = 'test query'
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })
      
      await expect(service.searchWikidataEntities(query))
        .rejects.toThrow('Wikidata entity search failed: Invalid Wikidata search API response format')
    })
  })
  
  describe('getEntityDetails', () => {
    const mockSPARQLResponse = {
      results: {
        bindings: [
          {
            entity: { value: 'http://www.wikidata.org/entity/Q11660' },
            entityLabel: { value: 'artificial intelligence' },
            entityDescription: { value: 'intelligence exhibited by machines' },
            property: { value: 'http://www.wikidata.org/prop/direct/P31' },
            propertyLabel: { value: 'instance of' },
            value: { value: 'http://www.wikidata.org/entity/Q11660' },
            valueLabel: { value: 'academic discipline' },
            valueType: { value: 'entity' }
          }
        ]
      }
    }
    
    it('should get entity details successfully', async () => {
      const entityIds = ['Q11660', 'Q2539']
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSPARQLResponse)
      })
      
      const result = await service.getEntityDetails(entityIds)
      
      expect(fetch).toHaveBeenCalledWith(
        'https://query.wikidata.org/sparql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      )
      
      expect(result.entityIds).toEqual(entityIds)
      expect(result.entities).toBeDefined()
      expect(result.relationships).toBeDefined()
      expect(result.detailsId).toMatch(/^details_\d+_[a-z0-9]+$/)
    })
    
    it('should use cached results when available', async () => {
      const entityIds = ['Q11660']
      
      // First call
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSPARQLResponse)
      })
      
      await service.getEntityDetails(entityIds)
      await service.getEntityDetails(entityIds) // Second call should use cache
      
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    
    it('should handle SPARQL errors', async () => {
      const entityIds = ['Q11660']
      
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'SPARQL Error'
      })
      
      await expect(service.getEntityDetails(entityIds))
        .rejects.toThrow('Wikidata entity details fetch failed: Wikidata SPARQL error: 500 SPARQL Error')
    })
    
    it('should limit entities to maxEntities setting', async () => {
      const entityIds = Array.from({ length: 15 }, (_, i) => `Q${i}`)
      
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSPARQLResponse)
      })
      
      const result = await service.getEntityDetails(entityIds)
      
      expect(result.entityIds).toHaveLength(10) // maxEntities default
    })
  })
  
  describe('storeWikidataContext', () => {
    const mockEntityDetails = {
      entities: [
        {
          wikidataId: 'Q11660',
          label: 'artificial intelligence',
          description: 'intelligence exhibited by machines',
          url: 'http://www.wikidata.org/entity/Q11660',
          relevanceScore: 0.9
        }
      ],
      relationships: [
        {
          relationshipId: 'rel_123',
          sourceEntity: 'Q11660',
          sourceEntityLabel: 'artificial intelligence',
          property: 'P31',
          propertyLabel: 'instance of',
          targetEntity: 'Q336',
          targetEntityLabel: 'science',
          valueType: 'entity',
          confidence: 1.0
        }
      ],
      detailsId: 'details_123'
    }
    
    it('should store Wikidata context successfully', async () => {
      const entityQuery = 'INSERT DATA { ... entity ... }'
      const relationshipQuery = 'INSERT DATA { ... relationship ... }'
      
      mockQueryService.getQuery
        .mockResolvedValueOnce(entityQuery)
        .mockResolvedValueOnce(relationshipQuery)
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeWikidataContext(mockEntityDetails, 'test query')
      
      expect(mockQueryService.getQuery).toHaveBeenCalledWith('store-wikidata-entity', expect.any(Object))
      expect(mockQueryService.getQuery).toHaveBeenCalledWith('store-wikidata-relationship', expect.any(Object))
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2) // 1 entity + 1 relationship
      
      const entityResult = result.find(r => r.type === 'entity')
      const relationshipResult = result.find(r => r.type === 'relationship')
      
      expect(entityResult.wikidataId).toBe('Q11660')
      expect(relationshipResult.sourceEntity).toBe('Q11660')
    })
    
    it('should handle missing SPARQL helper', async () => {
      service.sparqlHelper = null
      
      const result = await service.storeWikidataContext(mockEntityDetails, 'test query')
      
      expect(result).toEqual([])
    })
    
    it('should use fallback queries when templates fail', async () => {
      mockQueryService.getQuery.mockRejectedValue(new Error('Template not found'))
      mockSPARQLHelper.executeUpdate.mockResolvedValue({ success: true })
      
      const result = await service.storeWikidataContext(mockEntityDetails, 'test query')
      
      expect(result).toHaveLength(2)
      expect(mockSPARQLHelper.executeUpdate).toHaveBeenCalledTimes(2)
    })
  })
  
  describe('enhanceQueryWithWikidata', () => {
    const originalQuery = 'What is AI?'
    const entitySearchResults = {
      totalFound: 5,
      searchId: 'wikidata_123_abc',
      entities: [
        {
          wikidataId: 'Q11660',
          label: 'artificial intelligence',
          description: 'intelligence exhibited by machines',
          url: 'http://www.wikidata.org/entity/Q11660',
          relevanceScore: 0.95
        }
      ]
    }
    const entityDetails = {
      relationships: [
        {
          sourceEntityLabel: 'artificial intelligence',
          propertyLabel: 'instance of',
          targetEntityLabel: 'academic discipline',
          confidence: 1.0
        }
      ],
      detailsId: 'details_123'
    }
    
    it('should enhance query with Wikidata context', async () => {
      const result = await service.enhanceQueryWithWikidata(originalQuery, entitySearchResults, entityDetails)
      
      expect(result.enhancedPrompt).toContain(originalQuery)
      expect(result.enhancedPrompt).toContain('artificial intelligence')
      expect(result.enhancedPrompt).toContain('Q11660')
      expect(result.enhancedPrompt).toContain('instance of')
      
      expect(result.wikidataContext.originalQuery).toBe(originalQuery)
      expect(result.wikidataContext.entities).toHaveLength(1)
      expect(result.wikidataContext.relationships).toHaveLength(1)
      expect(result.metadata.searchId).toBe('wikidata_123_abc')
      expect(result.metadata.detailsId).toBe('details_123')
    })
    
    it('should handle missing entity details', async () => {
      const result = await service.enhanceQueryWithWikidata(originalQuery, entitySearchResults)
      
      expect(result.wikidataContext.relationships).toEqual([])
      expect(result.metadata.detailsId).toBeUndefined()
    })
  })
  
  describe('processQueryWithWikidata', () => {
    it('should execute full Wikidata pipeline successfully', async () => {
      const query = 'artificial intelligence'
      const entitySearchResults = {
        entities: [{ wikidataId: 'Q11660', label: 'AI' }],
        searchId: 'wikidata_123'
      }
      const entityDetails = {
        entities: [{ wikidataId: 'Q11660' }],
        relationships: [{ sourceEntity: 'Q11660' }],
        detailsId: 'details_123'
      }
      const storedContext = [{ uri: 'http://example.org/entity', wikidataId: 'Q11660' }]
      
      // Mock the pipeline methods
      vi.spyOn(service, 'searchWikidataEntities').mockResolvedValue(entitySearchResults)
      vi.spyOn(service, 'getEntityDetails').mockResolvedValue(entityDetails)
      vi.spyOn(service, 'storeWikidataContext').mockResolvedValue(storedContext)
      vi.spyOn(service, 'enhanceQueryWithWikidata').mockResolvedValue({
        enhancedPrompt: 'Enhanced prompt',
        wikidataContext: {},
        metadata: {}
      })
      
      const result = await service.processQueryWithWikidata(query)
      
      expect(result.success).toBe(true)
      expect(result.originalQuery).toBe(query)
      expect(result.entitySearchResults).toBe(entitySearchResults)
      expect(result.entityDetails).toBe(entityDetails)
      expect(result.storedContext).toBe(storedContext)
      expect(result.stats.entitiesFound).toBe(1)
      expect(result.stats.relationshipsFound).toBe(1)
    })
    
    it('should handle pipeline errors gracefully', async () => {
      const query = 'test query'
      const error = new Error('Pipeline failed')
      
      vi.spyOn(service, 'searchWikidataEntities').mockRejectedValue(error)
      
      const result = await service.processQueryWithWikidata(query)
      
      expect(result.success).toBe(false)
      expect(result.originalQuery).toBe(query)
      expect(result.error).toBe('Pipeline failed')
      expect(result.stats.failed).toBe(true)
    })
  })
  
  describe('calculateEntityRelevance', () => {
    it('should calculate relevance based on label and description match', () => {
      const entity = {
        label: 'machine learning',
        description: 'study of algorithms and statistical models'
      }
      
      const exactMatch = service.calculateEntityRelevance(entity, 'machine learning')
      const partialMatch = service.calculateEntityRelevance(entity, 'learning')
      const descMatch = service.calculateEntityRelevance(entity, 'algorithms')
      
      expect(exactMatch).toBe(1.0)
      expect(partialMatch).toBeGreaterThan(0)
      expect(partialMatch).toBeLessThan(exactMatch)
      expect(descMatch).toBeGreaterThan(0)
      expect(descMatch).toBeLessThan(partialMatch)
    })
  })
  
  describe('buildEntityDetailsQuery', () => {
    it('should build proper SPARQL query for entity details', () => {
      const entityIds = ['Q11660', 'Q2539']
      const query = service.buildEntityDetailsQuery(entityIds)
      
      expect(query).toContain('wd:Q11660')
      expect(query).toContain('wd:Q2539')
      expect(query).toContain('rdfs:label')
      expect(query).toContain('schema:description')
      expect(query).toContain('LIMIT')
    })
  })
  
  describe('processEntityDetails', () => {
    const mockBindings = [
      {
        entity: { value: 'http://www.wikidata.org/entity/Q11660' },
        entityLabel: { value: 'artificial intelligence' },
        entityDescription: { value: 'intelligence exhibited by machines' },
        property: { value: 'http://www.wikidata.org/prop/direct/P31' },
        propertyLabel: { value: 'instance of' },
        value: { value: 'http://www.wikidata.org/entity/Q336' },
        valueLabel: { value: 'science' },
        valueType: { value: 'entity' }
      }
    ]
    
    it('should process entity details correctly', () => {
      const result = service.processEntityDetails(mockBindings, ['Q11660'])
      
      expect(result.entities).toHaveLength(1)
      expect(result.relationships).toHaveLength(1)
      
      const entity = result.entities[0]
      expect(entity.wikidataId).toBe('Q11660')
      expect(entity.label).toBe('artificial intelligence')
      expect(entity.properties).toHaveLength(1)
      
      const relationship = result.relationships[0]
      expect(relationship.sourceEntity).toBe('Q11660')
      expect(relationship.property).toBe('P31')
      expect(relationship.targetEntity).toContain('Q336')
    })
  })
  
  describe('clearCache', () => {
    it('should clear all caches', () => {
      service.entityCache.set('test', 'value')
      service.relationshipCache.set('test', 'value')
      
      service.clearCache()
      
      expect(service.entityCache.size).toBe(0)
      expect(service.relationshipCache.size).toBe(0)
    })
  })
  
  describe('getServiceStats', () => {
    it('should return service statistics', () => {
      const stats = service.getServiceStats()
      
      expect(stats.serviceName).toBe('WikidataService')
      expect(stats.settings).toBeDefined()
      expect(stats.handlers.sparql).toBe(true)
      expect(stats.capabilities.entitySearch).toBe(true)
      expect(stats.capabilities.entityDetails).toBe(true)
      expect(stats.capabilities.relationshipExtraction).toBe(true)
      expect(stats.capabilities.contextStorage).toBe(true)
    })
  })
})