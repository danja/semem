import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import exportAttributesToSPARQL from '../../../src/ragno/exportAttributesToSPARQL.js'
import exportCommunityAttributesToSPARQL from '../../../src/ragno/exportCommunityAttributesToSPARQL.js'
import exportSimilarityLinksToSPARQL from '../../../src/ragno/exportSimilarityLinksToSPARQL.js'

// Mock SPARQLHelpers with proper default export
vi.mock('../../../src/utils/SPARQLHelpers.js', () => ({
  default: {
    executeSPARQLUpdate: vi.fn().mockResolvedValue({ ok: true })
  }
}))

import SPARQLHelpers from '../../../src/utils/SPARQLHelpers.js'

describe('Ragno SPARQL Export Functions', () => {
  const mockEndpoint = 'http://localhost:3030/test/update'
  const mockAuth = 'Basic dGVzdDp0ZXN0'
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportAttributesToSPARQL', () => {
    it('should export attributes to SPARQL endpoint', async () => {
      const attributes = [
        {
          entity: 'Geoffrey Hinton',
          text: 'Pioneer in deep learning and neural networks',
          summary: 'AI researcher and Turing Award winner',
          provenance: 'academic-papers'
        },
        {
          entity: 'Neural Networks',
          text: 'Computational models inspired by biological neural networks',
          summary: 'Machine learning foundation technology',
          provenance: 'textbooks'
        }
      ]

      await exportAttributesToSPARQL(attributes, mockEndpoint, mockAuth)

      // Verify SPARQLHelpers was called for each attribute
      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(2)
      
      // Verify endpoint and auth were passed correctly
      const calls = SPARQLHelpers.executeSPARQLUpdate.mock.calls
      calls.forEach(call => {
        expect(call[0]).toBe(mockEndpoint)
        expect(call[2]).toBe(mockAuth)
        expect(call[1]).toContain('INSERT DATA')
        expect(call[1]).toContain('ragno:Attribute')
      })
    })

    it('should handle empty attributes array', async () => {
      await exportAttributesToSPARQL([], mockEndpoint, mockAuth)
      
      expect(SPARQLHelpers.executeSPARQLUpdate).not.toHaveBeenCalled()
    })

    it('should generate valid SPARQL for attributes', async () => {
      const attributes = [{
        entity: 'Test Entity',
        text: 'Test attribute text',
        summary: 'Test summary',
        provenance: 'test-source'
      }]

      await exportAttributesToSPARQL(attributes, mockEndpoint, mockAuth)

      const query = SPARQLHelpers.executeSPARQLUpdate.mock.calls[0][1]
      expect(query).toContain('PREFIX ragno:')
      expect(query).toContain('PREFIX skos:')
      expect(query).toContain('ragno:attributeText')
      expect(query).toContain('Test attribute text')
      expect(query).toContain('Test Entity')
    })
  })

  describe('exportCommunityAttributesToSPARQL', () => {
    it('should export community attributes to SPARQL endpoint', async () => {
      const communityAttributes = [
        {
          text: 'Group of pioneering AI researchers',
          summary: 'Academic community focused on neural networks',
          provenance: 'community-detection'
        }
      ]

      await exportCommunityAttributesToSPARQL(communityAttributes, mockEndpoint, mockAuth)

      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(1)
      
      const query = SPARQLHelpers.executeSPARQLUpdate.mock.calls[0][1]
      expect(query).toContain('ragno:CommunityAttribute')
      expect(query).toContain('Group of pioneering AI researchers')
      expect(query).toContain('community-detection')
    })

    it('should handle multiple community attributes', async () => {
      const communityAttributes = [
        { text: 'text1', summary: 'summary1', provenance: 'src1' },
        { text: 'text2', summary: 'summary2', provenance: 'src2' },
        { text: 'text3', summary: 'summary3', provenance: 'src3' }
      ]

      await exportCommunityAttributesToSPARQL(communityAttributes, mockEndpoint, mockAuth)

      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(3)
    })
  })

  describe('exportSimilarityLinksToSPARQL', () => {
    it('should export similarity links to SPARQL endpoint', async () => {
      const similarityLinks = [
        {
          source: 'entity1',
          target: 'entity2', 
          similarity: 0.85
        },
        {
          source: 'entity2',
          target: 'entity3',
          similarity: 0.72
        }
      ]

      await exportSimilarityLinksToSPARQL(similarityLinks, mockEndpoint, mockAuth)

      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(2)
      
      // Check that similarity values are included
      const calls = SPARQLHelpers.executeSPARQLUpdate.mock.calls
      expect(calls[0][1]).toContain('0.85')
      expect(calls[1][1]).toContain('0.72')
    })

    it('should generate valid similarity link SPARQL', async () => {
      const similarityLinks = [{
        source: 'Geoffrey Hinton',
        target: 'Yann LeCun',
        similarity: 0.9
      }]

      await exportSimilarityLinksToSPARQL(similarityLinks, mockEndpoint, mockAuth)

      const query = SPARQLHelpers.executeSPARQLUpdate.mock.calls[0][1]
      expect(query).toContain('ragno:SimilarityLink')
      expect(query).toContain('ragno:source')
      expect(query).toContain('ragno:target')
      expect(query).toContain('ragno:similarity')
      expect(query).toContain('Geoffrey Hinton')
      expect(query).toContain('Yann LeCun')
      expect(query).toContain('0.9')
    })

    it('should handle high precision similarity scores', async () => {
      const similarityLinks = [{
        source: 'entity1',
        target: 'entity2',
        similarity: 0.123456789
      }]

      await exportSimilarityLinksToSPARQL(similarityLinks, mockEndpoint, mockAuth)

      const query = SPARQLHelpers.executeSPARQLUpdate.mock.calls[0][1]
      expect(query).toContain('0.123456789')
    })
  })

  describe('error handling', () => {
    it('should handle SPARQL execution errors in attribute export', async () => {
      SPARQLHelpers.executeSPARQLUpdate.mockRejectedValueOnce(new Error('SPARQL error'))

      const attributes = [{ entity: 'test', text: 'test', summary: 'test', provenance: 'test' }]

      await expect(exportAttributesToSPARQL(attributes, mockEndpoint, mockAuth))
        .rejects.toThrow('SPARQL error')
    })

    it('should handle SPARQL execution errors in similarity export', async () => {
      SPARQLHelpers.executeSPARQLUpdate.mockRejectedValueOnce(new Error('Network error'))

      const links = [{ source: 'a', target: 'b', similarity: 0.5 }]

      await expect(exportSimilarityLinksToSPARQL(links, mockEndpoint, mockAuth))
        .rejects.toThrow('Network error')
    })
  })

  describe('data validation', () => {
    it('should handle special characters in entity names', async () => {
      const attributes = [{
        entity: 'Entity with "quotes" and \\backslashes',
        text: 'Text with special chars: <>&"\'',
        summary: 'Summary with unicode: 🔬🧠',
        provenance: 'test-source'
      }]

      await exportAttributesToSPARQL(attributes, mockEndpoint, mockAuth)

      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(1)
      const query = SPARQLHelpers.executeSPARQLUpdate.mock.calls[0][1]
      expect(query).toBeDefined()
    })

    it('should handle edge case similarity values', async () => {
      const similarityLinks = [
        { source: 'a', target: 'b', similarity: 0.0 },
        { source: 'c', target: 'd', similarity: 1.0 },
        { source: 'e', target: 'f', similarity: 0.999999 }
      ]

      await exportSimilarityLinksToSPARQL(similarityLinks, mockEndpoint, mockAuth)

      expect(SPARQLHelpers.executeSPARQLUpdate).toHaveBeenCalledTimes(3)
    })
  })
})