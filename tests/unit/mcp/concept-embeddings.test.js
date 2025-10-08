import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies using factory functions to avoid hoisting issues
vi.mock('../../../src/utils/URIMinter.js', () => ({
  URIMinter: {
    mintURI: vi.fn((base, type, content) => `${base}${type}/${encodeURIComponent(content.replace(/\s+/g, '_'))}`)
  }
}))

vi.mock('../../../src/services/sparql/SPARQLHelper.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    executeUpdate: vi.fn().mockResolvedValue({ success: true })
  }))
}))

vi.mock('../../../src/Utils.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock Config
class MockConfig {
  constructor() {
    this.data = {
      'storage.options': {
        graphName: 'http://hyperdata.it/content',
        update: 'http://localhost:3030/test/update',
        user: 'testuser',
        password: 'testpass'
      },
      'graphName': 'http://hyperdata.it/content'
    }
  }

  get(key) {
    return this.data[key] || (key === 'graphName' ? this.data['graphName'] : undefined)
  }
}

// Mock SafeOperations
class MockSafeOperations {
  constructor() {
    this.extractConceptsCalls = []
    this.generateEmbeddingCalls = []
  }

  async extractConcepts(text) {
    this.extractConceptsCalls.push(text)
    // Return mock concepts based on input text (case insensitive)
    const lowerText = text.toLowerCase()
    if (lowerText.includes('machine learning')) {
      return ['machine learning', 'artificial intelligence', 'algorithms', 'data science']
    } else if (lowerText.includes('climate change')) {
      return ['climate change', 'global warming', 'greenhouse gases', 'carbon emissions']
    }
    return ['concept1', 'concept2', 'concept3']
  }

  async generateEmbedding(text) {
    this.generateEmbeddingCalls.push(text)
    // Return mock embedding vector (1536 dimensions like nomic-embed-text)
    return new Array(1536).fill(0).map(() => Math.random() - 0.5)
  }

  reset() {
    this.extractConceptsCalls = []
    this.generateEmbeddingCalls = []
  }
}

// Mock Memory Manager
class MockMemoryManager {
  constructor() {
    this.config = new MockConfig()
  }
}

// Mock State Manager
class MockZPTStateManager {
  constructor() {
    this.state = {
      sessionId: 'test-session-123',
      zoom: 'entity',
      pan: {},
      tilt: 'keywords'
    }
  }

  getState() {
    return { ...this.state }
  }
}

// Import the SimpleVerbsService after mocks are set up
import { SimpleVerbsService } from '../../../src/mcp/tools/simple-verbs.js'

describe('Concept Embeddings Functionality', () => {
  let simpleVerbsService
  let mockSafeOps
  let mockMemoryManager
  let mockStateManager

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create fresh instances
    mockSafeOps = new MockSafeOperations()
    mockMemoryManager = new MockMemoryManager()
    mockStateManager = new MockZPTStateManager()
    
    simpleVerbsService = new SimpleVerbsService()
    
    // Inject mock dependencies
    simpleVerbsService.safeOps = mockSafeOps
    simpleVerbsService.memoryManager = mockMemoryManager
    simpleVerbsService.stateManager = mockStateManager
  })

  afterEach(() => {
    mockSafeOps.reset()
  })

  describe('concept_embeddings operation', () => {
    it('should extract concepts and generate embeddings using new ragno format', async () => {
      const target = 'Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed.'
      const options = {
        maxConcepts: 10,
        embeddingModel: 'nomic-embed-text',
        batchSize: 2
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      // Verify success
      expect(result.success).toBe(true)
      expect(result.operation).toBe('concept_embeddings')
      expect(result.augmentationType).toBe('concept_embeddings')

      // Verify concepts were extracted
      expect(mockSafeOps.extractConceptsCalls).toHaveLength(1)
      expect(mockSafeOps.extractConceptsCalls[0]).toBe(target)

      // Verify embeddings were generated for concepts
      const expectedConcepts = ['machine learning', 'artificial intelligence', 'algorithms', 'data science']
      expect(mockSafeOps.generateEmbeddingCalls).toHaveLength(expectedConcepts.length)
      
      expectedConcepts.forEach(concept => {
        expect(mockSafeOps.generateEmbeddingCalls).toContain(concept)
      })

      // Verify result structure
      expect(result.conceptsEmbedded).toHaveLength(expectedConcepts.length)
      expect(result.totalConcepts).toBe(expectedConcepts.length)
      expect(result.totalEmbeddings).toBe(expectedConcepts.length)
      expect(result.embeddingModel).toBe('nomic-embed-text')
      expect(result.targetGraph).toBe(mockMemoryManager.config.get('storage.options').graphName)

      // Verify each concept embedding has expected structure
      result.conceptsEmbedded.forEach((conceptEmbed, index) => {
        expect(conceptEmbed.concept).toBe(expectedConcepts[index])
        expect(conceptEmbed.conceptUri).toContain('concept/')
        expect(conceptEmbed.embeddingUri).toContain('embedding/')
        expect(conceptEmbed.embeddingDimension).toBe(1536)
        expect(conceptEmbed.embeddingModel).toBe('nomic-embed-text')
      })
    })

    it('should handle maxConcepts limit correctly', async () => {
      const target = 'Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed.'
      const options = {
        maxConcepts: 2, // Limit to 2 concepts
        embeddingModel: 'nomic-embed-text'
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      
      // Should only process 2 concepts even though 4 were extracted
      expect(result.totalConcepts).toBe(4) // Total extracted
      expect(result.totalProcessed).toBe(2) // Actually processed
      expect(result.totalEmbeddings).toBe(2) // Embeddings generated
      expect(result.conceptsEmbedded).toHaveLength(2)

      // Should only generate embeddings for first 2 concepts
      expect(mockSafeOps.generateEmbeddingCalls).toHaveLength(2)
    })

    it('should process concepts in batches', async () => {
      const target = 'Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed.'
      const options = {
        maxConcepts: 4,
        batchSize: 2 // Process in batches of 2
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      expect(result.totalEmbeddings).toBe(4)
      
      // Verify batch processing doesn't affect the final result
      expect(result.conceptsEmbedded).toHaveLength(4)
    })

    it('should handle empty concept extraction gracefully', async () => {
      // Use a target that doesn't match our mock concept patterns
      const target = 'Simple text with no recognizable patterns.'
      const options = { maxConcepts: 10 }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      expect(result.augmentationType).toBe('concept_embeddings')
      
      // Should handle the 3 default concepts from mock
      expect(result.totalConcepts).toBe(3)
      expect(result.totalEmbeddings).toBe(3)
    })

    it('should handle errors in concept embedding generation gracefully', async () => {
      const target = 'Test content for error handling'
      
      // Mock an error in embedding generation
      mockSafeOps.generateEmbedding = vi.fn().mockRejectedValue(new Error('Embedding service unavailable'))

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options: { maxConcepts: 3 }
      })

      expect(result.success).toBe(true)
      expect(result.totalEmbeddings).toBe(0) // No embeddings generated due to errors
      expect(result.skippedConcepts).toHaveLength(3) // All concepts skipped
      
      // Verify error information is captured
      result.skippedConcepts.forEach(skipped => {
        expect(skipped.error).toContain('Embedding service unavailable')
      })
    })

    it('should include attributes when includeAttributes option is true', async () => {
      const target = 'Machine learning is a subset of artificial intelligence.'
      const options = {
        maxConcepts: 2,
        includeAttributes: true
      }

      // Mock the augmentWithAttributes import
      vi.doMock('../../../src/ragno/augmentWithAttributes.js', () => ({
        augmentWithAttributes: vi.fn().mockResolvedValue({
          attributes: [
            { id: 'attr1', category: 'overview', content: 'Mock attribute 1' },
            { id: 'attr2', category: 'characteristics', content: 'Mock attribute 2' }
          ]
        })
      }))

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      expect(result.attributeCount).toBe(2)
      expect(result.attributes).toHaveLength(2)
    })

    it('should use default graph from config when no graph specified', async () => {
      const target = 'Test content for default graph'
      const options = {
        maxConcepts: 1
        // No graph specified - should use config default
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      expect(result.targetGraph).toBe(mockMemoryManager.config.get('storage.options').graphName)
    })

    it('should use custom graph when specified', async () => {
      const target = 'Test content'
      const customGraph = 'http://custom.test.graph'
      const options = {
        graph: customGraph,
        maxConcepts: 1
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concept_embeddings',
        options
      })

      expect(result.success).toBe(true)
      expect(result.targetGraph).toBe(customGraph)
    })
  })

  describe('concepts operation with includeEmbeddings', () => {
    it('should extract concepts and generate embeddings when includeEmbeddings is true', async () => {
      const target = 'Machine learning enables computers to learn from data.'
      const options = {
        includeEmbeddings: true,
        maxConcepts: 3
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concepts',
        options
      })

      expect(result.success).toBe(true)
      expect(result.augmentationType).toBe('concepts_with_embeddings')
      expect(result.concepts).toHaveLength(4) // All extracted concepts
      expect(result.embeddedConcepts).toHaveLength(3) // Limited by maxConcepts
      expect(result.totalEmbeddings).toBe(3)
      expect(result.embeddingModel).toBe('nomic-embed-text')

      // Verify concepts are still returned
      expect(result.concepts).toEqual(['machine learning', 'artificial intelligence', 'algorithms', 'data science'])
    })

    it('should return only concepts when includeEmbeddings is false', async () => {
      const target = 'Machine learning enables computers to learn from data.'
      const options = {
        includeEmbeddings: false
      }

      const result = await simpleVerbsService.augment({
        target,
        operation: 'concepts',
        options
      })

      expect(result.success).toBe(true)
      expect(Array.isArray(result.concepts)).toBe(true)
      expect(result.concepts).toEqual(['machine learning', 'artificial intelligence', 'algorithms', 'data science'])
      
      // Should not generate any embeddings
      expect(mockSafeOps.generateEmbeddingCalls).toHaveLength(0)
    })

    it.skip('should handle embedding errors gracefully in concepts operation', async () => {
      const target = 'Test content'
      
      // Create a fresh service with error-prone embedding
      const errorService = new SimpleVerbsService()
      const errorSafeOps = new MockSafeOperations()
      
      // Mock embedding to always fail
      errorSafeOps.generateEmbedding = vi.fn().mockRejectedValue(new Error('Network error'))
      
      errorService.safeOps = errorSafeOps
      errorService.memoryManager = mockMemoryManager
      errorService.stateManager = mockStateManager

      const result = await errorService.augment({
        target,
        operation: 'concepts',
        options: { includeEmbeddings: true }
      })

      expect(result.success).toBe(true)
      expect(result.augmentationType).toBe('concepts_embedding_failed')
      expect(result.concepts).toEqual(['concept1', 'concept2', 'concept3'])
      expect(result.embeddingError).toContain('Network error')
    })
  })
})
