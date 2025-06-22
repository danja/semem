/**
 * @file Integration tests based on ArticleEmbedding.js example
 * Tests the complete embedding workflow with different providers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MemoryManager from '../../../src/MemoryManager.js'
import Config from '../../../src/Config.js'
import EmbeddingConnectorFactory from '../../../src/connectors/EmbeddingConnectorFactory.js'
import { InMemoryStore } from '../../../src/stores/index.js'

// Mock external dependencies
vi.mock('../../../src/Config.js')
vi.mock('../../../src/connectors/EmbeddingConnectorFactory.js')

describe('ArticleEmbedding Integration', () => {
  let config
  let memoryManager
  let mockConnector
  
  const sampleArticles = [
    {
      title: 'Introduction to Semantic Web',
      content: 'The Semantic Web is a vision of the World Wide Web where data is machine-readable and can be processed by computers. It uses technologies like RDF, SPARQL, and ontologies to create a web of linked data that enables intelligent applications and services.'
    },
    {
      title: 'Understanding Vector Embeddings',
      content: 'Vector embeddings are dense numerical representations of text that capture semantic meaning. They are created by neural networks and allow computers to understand the similarity between different pieces of text based on their vector distances in high-dimensional space.'
    },
    {
      title: 'SPARQL Query Language Basics',
      content: 'SPARQL is a query language for RDF data that allows you to retrieve and manipulate graph-structured data. It provides powerful pattern matching capabilities and supports operations like SELECT, INSERT, UPDATE, and DELETE on RDF triples.'
    }
  ]
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock config
    config = {
      init: vi.fn(),
      get: vi.fn((key) => {
        const configData = {
          'models.embedding.provider': 'ollama',
          'models.embedding.model': 'nomic-embed-text',
          'models.embedding.options': { baseUrl: 'http://localhost:11434' },
          'embeddingModel': 'nomic-embed-text',
          'memory.dimension': 1536
        }
        return configData[key]
      })
    }
    Config.mockImplementation(() => config)
    
    // Mock connector
    mockConnector = {
      generateEmbedding: vi.fn()
    }
    EmbeddingConnectorFactory.createConnector.mockReturnValue(mockConnector)
  })
  
  afterEach(() => {
    if (memoryManager) {
      memoryManager.dispose?.()
    }
    vi.clearAllMocks()
  })
  
  describe('Embedding Generation Workflow', () => {
    it('should generate embeddings for articles using Ollama provider', async () => {
      // Setup
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      // Test embedding generation for each article
      const embeddings = []
      for (const article of sampleArticles) {
        const embedding = await memoryManager.generateEmbedding(article.content)
        embeddings.push(embedding)
        
        expect(embedding).toHaveLength(1536)
        expect(embedding.every(x => typeof x === 'number' && !isNaN(x))).toBe(true)
      }
      
      expect(mockConnector.generateEmbedding).toHaveBeenCalledTimes(3)
      expect(embeddings).toHaveLength(3)
    })
    
    it('should generate embeddings using Nomic provider', async () => {
      // Mock Nomic connector
      const nomicConnector = {
        generateEmbedding: vi.fn()
      }
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      nomicConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      EmbeddingConnectorFactory.createConnector.mockReturnValue(nomicConnector)
      
      memoryManager = new MemoryManager({
        llmProvider: nomicConnector,
        embeddingModel: 'nomic-embed-text-v1.5',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      // Generate embedding
      const embedding = await memoryManager.generateEmbedding(sampleArticles[0].content)
      
      expect(nomicConnector.generateEmbedding).toHaveBeenCalledWith(
        'nomic-embed-text-v1.5',
        sampleArticles[0].content
      )
      expect(embedding).toHaveLength(1536)
    })
    
    it('should handle embedding standardization', async () => {
      // Mock connector that returns different dimension
      const shortEmbedding = [0.1, 0.2, 0.3] // Only 3 dimensions
      mockConnector.generateEmbedding.mockResolvedValue(shortEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      const embedding = await memoryManager.generateEmbedding(sampleArticles[0].content)
      
      // Should be standardized to 1536 dimensions
      expect(embedding).toHaveLength(1536)
      expect(embedding.slice(0, 3)).toEqual([0.1, 0.2, 0.3])
      expect(embedding.slice(3)).toEqual(new Array(1533).fill(0))
    })
    
    it('should handle memory storage and retrieval', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      // Store memories for articles
      const memories = []
      for (const article of sampleArticles) {
        const memory = await memoryManager.storeInteraction(
          `What is ${article.title}?`,
          article.content
        )
        memories.push(memory)
      }
      
      expect(memories).toHaveLength(3)
      memories.forEach(memory => {
        expect(memory).toHaveProperty('success')
        expect(memory).toHaveProperty('concepts')
        expect(memory).toHaveProperty('timestamp')
        expect(memory.success).toBe(true)
      })
      
      // Test semantic search - may return empty if similarity threshold is too high
      const searchResults = await memoryManager.retrieveRelevantInteractions('semantic web technologies', 10, 0)
      expect(Array.isArray(searchResults)).toBe(true)
    })
    
    it('should handle embedding errors gracefully', async () => {
      mockConnector.generateEmbedding.mockRejectedValue(
        new Error('API rate limit exceeded')
      )
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      await expect(
        memoryManager.generateEmbedding(sampleArticles[0].content)
      ).rejects.toThrow('API rate limit exceeded')
    })
    
    it('should validate embedding dimensions', async () => {
      // Mock connector that returns invalid embedding
      mockConnector.generateEmbedding.mockResolvedValue('not an array')
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      await expect(
        memoryManager.generateEmbedding(sampleArticles[0].content)
      ).rejects.toThrow()
    })
  })
  
  describe('Provider Configuration', () => {
    it('should use configuration-based provider selection', async () => {
      // Mock config to return Nomic provider
      config.get.mockImplementation((key) => {
        const configData = {
          'models.embedding.provider': 'nomic',
          'models.embedding.model': 'nomic-embed-text-v1.5',
          'models.embedding.options': { apiKey: 'test-key' },
          'embeddingModel': 'nomic-embed-text-v1.5',
          'memory.dimension': 1536
        }
        return configData[key]
      })
      
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: config.get('embeddingModel'),
        storage: new InMemoryStore(),
        dimension: config.get('memory.dimension')
      })
      
      await memoryManager.ensureInitialized()
      
      const embedding = await memoryManager.generateEmbedding(sampleArticles[0].content)
      
      expect(embedding).toHaveLength(1536)
      expect(mockConnector.generateEmbedding).toHaveBeenCalledWith(
        'nomic-embed-text-v1.5',
        sampleArticles[0].content
      )
    })
    
    it('should handle missing API keys for cloud providers', async () => {
      // Test Nomic without API key
      const nomicConnector = {
        generateEmbedding: vi.fn().mockRejectedValue(
          new Error('API key is required')
        )
      }
      
      EmbeddingConnectorFactory.createConnector.mockReturnValue(nomicConnector)
      
      memoryManager = new MemoryManager({
        llmProvider: nomicConnector,
        embeddingModel: 'nomic-embed-text-v1.5',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      await expect(
        memoryManager.generateEmbedding(sampleArticles[0].content)
      ).rejects.toThrow('API key is required')
    })
  })
  
  describe('Performance and Caching', () => {
    it('should cache embeddings for repeated text', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      const text = sampleArticles[0].content
      
      // Generate embedding twice for same text
      const embedding1 = await memoryManager.generateEmbedding(text)
      const embedding2 = await memoryManager.generateEmbedding(text)
      
      // Should return same result
      expect(embedding1).toEqual(embedding2)
      
      // But connector should be called only once due to caching
      expect(mockConnector.generateEmbedding).toHaveBeenCalledTimes(1)
    })
    
    it('should handle batch processing of articles', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      memoryManager = new MemoryManager({
        llmProvider: mockConnector,
        embeddingModel: 'nomic-embed-text',
        storage: new InMemoryStore(),
        dimension: 1536
      })
      
      await memoryManager.ensureInitialized()
      
      // Process articles in batch
      const embeddings = await Promise.all(
        sampleArticles.map(article => 
          memoryManager.generateEmbedding(article.content)
        )
      )
      
      expect(embeddings).toHaveLength(3)
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(1536)
      })
      
      expect(mockConnector.generateEmbedding).toHaveBeenCalledTimes(3)
    })
  })
})