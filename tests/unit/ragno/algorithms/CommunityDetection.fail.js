import { describe, it, expect, beforeEach, vi } from 'vitest'
import CommunityDetection from '../../../../src/ragno/algorithms/CommunityDetection.js'

// Mock graphology
vi.mock('graphology', () => ({
  default: vi.fn().mockImplementation(() => ({
    addNode: vi.fn(),
    addEdge: vi.fn(),
    hasNode: vi.fn(() => false),
    hasEdge: vi.fn(() => false),
    nodes: vi.fn(() => []),
    edges: vi.fn(() => []),
    order: 0,
    size: 0,
    getNodeAttributes: vi.fn(() => ({})),
    setNodeAttribute: vi.fn(),
    getEdgeAttributes: vi.fn(() => ({})),
    setEdgeAttribute: vi.fn(),
    forEachNode: vi.fn(),
    forEachEdge: vi.fn()
  }))
}))

// Mock graphology-communities-leiden
vi.mock('graphology-communities-leiden', () => ({
  default: vi.fn(() => ({
    community_0: ['node1', 'node2'],
    community_1: ['node3', 'node4']
  }))
}))

describe('CommunityDetection', () => {
  let communityDetection
  let mockGraph

  beforeEach(() => {
    vi.clearAllMocks()
    communityDetection = new CommunityDetection()
    mockGraph = {
      addNode: vi.fn(),
      addEdge: vi.fn(),
      hasNode: vi.fn(() => false),
      hasEdge: vi.fn(() => false),
      nodes: vi.fn(() => ['node1', 'node2', 'node3', 'node4']),
      edges: vi.fn(() => []),
      order: 4,
      size: 0,
      getNodeAttributes: vi.fn(() => ({ type: 'entity' })),
      setNodeAttribute: vi.fn(),
      getEdgeAttributes: vi.fn(() => ({ weight: 1.0 })),
      setEdgeAttribute: vi.fn(),
      forEachNode: vi.fn(),
      forEachEdge: vi.fn()
    }
  })

  describe('constructor', () => {
    it('should create CommunityDetection with default options', () => {
      expect(communityDetection).toBeDefined()
      expect(communityDetection.options).toBeDefined()
      expect(communityDetection.options.algorithm).toBe('leiden')
    })

    it('should accept custom options', () => {
      const customOptions = {
        algorithm: 'louvain',
        resolution: 0.5,
        randomState: 42
      }
      
      const detector = new CommunityDetection(customOptions)
      expect(detector.options.algorithm).toBe('louvain')
      expect(detector.options.resolution).toBe(0.5)
      expect(detector.options.randomState).toBe(42)
    })
  })

  describe('detectCommunities', () => {
    it('should detect communities using Leiden algorithm', async () => {
      const result = await communityDetection.detectCommunities(mockGraph)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.communities).toBeDefined()
      expect(result.statistics).toBeDefined()
    })

    it('should return community assignments', async () => {
      const result = await communityDetection.detectCommunities(mockGraph)
      
      expect(result.communities).toBeDefined()
      expect(typeof result.communities).toBe('object')
    })

    it('should include statistics in result', async () => {
      const result = await communityDetection.detectCommunities(mockGraph)
      
      expect(result.statistics).toBeDefined()
      expect(result.statistics.totalCommunities).toBeDefined()
      expect(result.statistics.totalNodes).toBeDefined()
      expect(typeof result.statistics.totalCommunities).toBe('number')
      expect(typeof result.statistics.totalNodes).toBe('number')
    })

    it('should handle empty graphs', async () => {
      const emptyGraph = {
        ...mockGraph,
        nodes: vi.fn(() => []),
        order: 0
      }
      
      const result = await communityDetection.detectCommunities(emptyGraph)
      
      expect(result).toBeDefined()
      expect(result.communities).toBeDefined()
      expect(result.statistics.totalNodes).toBe(0)
    })

    it('should handle graphs with no edges', async () => {
      const noEdgesGraph = {
        ...mockGraph,
        size: 0,
        edges: vi.fn(() => [])
      }
      
      const result = await communityDetection.detectCommunities(noEdgesGraph)
      
      expect(result).toBeDefined()
      expect(result.communities).toBeDefined()
    })
  })

  describe('analyzeCommunities', () => {
    it('should analyze community structure', () => {
      const communities = {
        community_0: ['node1', 'node2'],
        community_1: ['node3', 'node4', 'node5']
      }
      
      const analysis = communityDetection.analyzeCommunities(communities, mockGraph)
      
      expect(analysis).toBeDefined()
      expect(analysis.communitySizes).toBeDefined()
      expect(analysis.averageSize).toBeDefined()
      expect(analysis.largestCommunity).toBeDefined()
      expect(analysis.smallestCommunity).toBeDefined()
    })

    it('should calculate correct community sizes', () => {
      const communities = {
        community_0: ['node1', 'node2'],
        community_1: ['node3', 'node4', 'node5']
      }
      
      const analysis = communityDetection.analyzeCommunities(communities, mockGraph)
      
      expect(analysis.communitySizes).toEqual({
        community_0: 2,
        community_1: 3
      })
      expect(analysis.averageSize).toBe(2.5)
      expect(analysis.largestCommunity).toBe('community_1')
      expect(analysis.smallestCommunity).toBe('community_0')
    })

    it('should handle single-node communities', () => {
      const communities = {
        community_0: ['node1'],
        community_1: ['node2']
      }
      
      const analysis = communityDetection.analyzeCommunities(communities, mockGraph)
      
      expect(analysis.communitySizes.community_0).toBe(1)
      expect(analysis.communitySizes.community_1).toBe(1)
      expect(analysis.averageSize).toBe(1)
    })
  })

  describe('getCommunityByNode', () => {
    it('should return community for a given node', () => {
      communityDetection.lastResult = {
        communities: {
          community_0: ['node1', 'node2'],
          community_1: ['node3', 'node4']
        }
      }
      
      expect(communityDetection.getCommunityByNode('node1')).toBe('community_0')
      expect(communityDetection.getCommunityByNode('node3')).toBe('community_1')
      expect(communityDetection.getCommunityByNode('nonexistent')).toBe(null)
    })

    it('should return null if no communities detected yet', () => {
      expect(communityDetection.getCommunityByNode('node1')).toBe(null)
    })
  })

  describe('getNodesInCommunity', () => {
    it('should return nodes in a given community', () => {
      communityDetection.lastResult = {
        communities: {
          community_0: ['node1', 'node2'],
          community_1: ['node3', 'node4']
        }
      }
      
      expect(communityDetection.getNodesInCommunity('community_0')).toEqual(['node1', 'node2'])
      expect(communityDetection.getNodesInCommunity('community_1')).toEqual(['node3', 'node4'])
      expect(communityDetection.getNodesInCommunity('nonexistent')).toEqual([])
    })

    it('should return empty array if no communities detected yet', () => {
      expect(communityDetection.getNodesInCommunity('community_0')).toEqual([])
    })
  })

  describe('getCommunityList', () => {
    it('should return list of all communities', () => {
      communityDetection.lastResult = {
        communities: {
          community_0: ['node1', 'node2'],
          community_1: ['node3', 'node4']
        }
      }
      
      const communities = communityDetection.getCommunityList()
      expect(Array.isArray(communities)).toBe(true)
      expect(communities.length).toBe(2)
      expect(communities).toContain('community_0')
      expect(communities).toContain('community_1')
    })

    it('should return empty array if no communities detected yet', () => {
      expect(communityDetection.getCommunityList()).toEqual([])
    })
  })

  describe('exportCommunities', () => {
    it('should export communities in specified format', () => {
      communityDetection.lastResult = {
        communities: {
          community_0: ['node1', 'node2'],
          community_1: ['node3', 'node4']
        },
        statistics: {
          totalCommunities: 2,
          totalNodes: 4
        }
      }
      
      const exported = communityDetection.exportCommunities('json')
      expect(typeof exported).toBe('string')
      
      const parsed = JSON.parse(exported)
      expect(parsed.communities).toBeDefined()
      expect(parsed.statistics).toBeDefined()
    })

    it('should handle different export formats', () => {
      communityDetection.lastResult = {
        communities: {
          community_0: ['node1', 'node2']
        },
        statistics: {
          totalCommunities: 1,
          totalNodes: 2
        }
      }
      
      expect(() => communityDetection.exportCommunities('json')).not.toThrow()
      expect(() => communityDetection.exportCommunities('csv')).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle invalid graph input', async () => {
      const invalidGraph = null
      
      await expect(communityDetection.detectCommunities(invalidGraph)).rejects.toThrow()
    })

    it('should handle algorithm failures gracefully', async () => {
      // Mock the leiden algorithm to throw an error
      vi.doMock('graphology-communities-leiden', () => ({
        default: vi.fn(() => {
          throw new Error('Algorithm failed')
        })
      }))
      
      const detector = new CommunityDetection()
      await expect(detector.detectCommunities(mockGraph)).rejects.toThrow()
    })
  })
})