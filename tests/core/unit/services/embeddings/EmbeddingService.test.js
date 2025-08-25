/**
 * @file Unit tests for EmbeddingService with multiple provider support
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EmbeddingService from '../../../../src/services/embeddings/EmbeddingService.js'
import EmbeddingConnectorFactory from '../../../../src/connectors/EmbeddingConnectorFactory.js'

// Mock the factory
vi.mock('../../../../src/connectors/EmbeddingConnectorFactory.js')

describe('EmbeddingService', () => {
  let service
  let mockConnector
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock connector
    mockConnector = {
      generateEmbedding: vi.fn()
    }
    
    // Mock factory to return our mock connector
    EmbeddingConnectorFactory.createConnector.mockReturnValue(mockConnector)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('constructor', () => {
    it('should initialize with default values', () => {
      service = new EmbeddingService()
      
      expect(service.provider).toBe('ollama')
      expect(service.model).toBe('nomic-embed-text')
      expect(service.dimension).toBe(1536)
      expect(EmbeddingConnectorFactory.createConnector).toHaveBeenCalledWith({
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: {}
      })
    })
    
    it('should initialize with custom provider', () => {
      const options = {
        provider: 'nomic',
        model: 'nomic-embed-text-v1.5',
        dimension: 768,
        providerOptions: { apiKey: 'test-key' }
      }
      
      service = new EmbeddingService(options)
      
      expect(service.provider).toBe('nomic')
      expect(service.model).toBe('nomic-embed-text-v1.5')
      expect(service.dimension).toBe(768)
      expect(EmbeddingConnectorFactory.createConnector).toHaveBeenCalledWith({
        provider: 'nomic',
        model: 'nomic-embed-text-v1.5',
        options: { apiKey: 'test-key' }
      })
    })
    
    it('should handle missing provider options', () => {
      const options = {
        provider: 'ollama',
        model: 'custom-model'
      }
      
      service = new EmbeddingService(options)
      
      expect(EmbeddingConnectorFactory.createConnector).toHaveBeenCalledWith({
        provider: 'ollama',
        model: 'custom-model',
        options: {}
      })
    })
  })
  
  describe('generateEmbedding', () => {
    beforeEach(() => {
      service = new EmbeddingService()
    })
    
    it('should generate embedding for valid text', async () => {
      const mockEmbedding = new Array(1536).fill(0.1)
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      const result = await service.generateEmbedding('Hello world')
      
      expect(mockConnector.generateEmbedding).toHaveBeenCalledWith(
        'nomic-embed-text',
        'Hello world'
      )
      expect(result).toEqual(mockEmbedding)
    })
    
    it('should throw error for invalid text input', async () => {
      await expect(service.generateEmbedding(null)).rejects.toThrow(
        'Invalid input text'
      )
      
      await expect(service.generateEmbedding('')).rejects.toThrow(
        'Invalid input text'
      )
      
      await expect(service.generateEmbedding(123)).rejects.toThrow(
        'Invalid input text'
      )
    })
    
    it('should standardize embeddings with wrong dimensions', async () => {
      const shortEmbedding = [0.1, 0.2, 0.3] // Only 3 dimensions
      mockConnector.generateEmbedding.mockResolvedValue(shortEmbedding)
      
      const result = await service.generateEmbedding('Hello world')
      
      expect(result).toHaveLength(1536) // Should be padded to 1536
      expect(result.slice(0, 3)).toEqual([0.1, 0.2, 0.3])
      expect(result.slice(3)).toEqual(new Array(1533).fill(0)) // Rest should be zeros
    })
    
    it('should truncate embeddings that are too long', async () => {
      const longEmbedding = new Array(2000).fill(0.1) // Too many dimensions
      mockConnector.generateEmbedding.mockResolvedValue(longEmbedding)
      
      const result = await service.generateEmbedding('Hello world')
      
      expect(result).toHaveLength(1536) // Should be truncated to 1536
      expect(result.every(x => x === 0.1)).toBe(true)
    })
    
    it('should handle connector errors', async () => {
      mockConnector.generateEmbedding.mockRejectedValue(
        new Error('Connector failed')
      )
      
      await expect(service.generateEmbedding('Hello world')).rejects.toThrow(
        'Connector failed'
      )
    })
    
    it('should use custom model from service configuration', async () => {
      service = new EmbeddingService({ model: 'custom-model' })
      const mockEmbedding = new Array(1536).fill(0.1)
      mockConnector.generateEmbedding.mockResolvedValue(mockEmbedding)
      
      await service.generateEmbedding('Hello world')
      
      expect(mockConnector.generateEmbedding).toHaveBeenCalledWith(
        'custom-model',
        'Hello world'
      )
    })
  })
  
  describe('validateEmbedding', () => {
    beforeEach(() => {
      service = new EmbeddingService()
    })
    
    it('should validate correct embedding', () => {
      const validEmbedding = new Array(1536).fill(0.1)
      
      expect(() => service.validateEmbedding(validEmbedding)).not.toThrow()
    })
    
    it('should throw error for non-array embedding', () => {
      expect(() => service.validateEmbedding('not an array')).toThrow(
        'Embedding must be an array'
      )
    })
    
    it('should throw error for wrong dimension', () => {
      const wrongDimension = [0.1, 0.2, 0.3] // Only 3 dimensions
      
      expect(() => service.validateEmbedding(wrongDimension)).toThrow(
        'Embedding dimension mismatch: expected 1536, got 3'
      )
    })
    
    it('should throw error for invalid numbers', () => {
      const invalidEmbedding = new Array(1536).fill(0.1)
      invalidEmbedding[0] = 'not a number'
      
      expect(() => service.validateEmbedding(invalidEmbedding)).toThrow(
        'Embedding must contain only valid numbers'
      )
      
      invalidEmbedding[0] = NaN
      expect(() => service.validateEmbedding(invalidEmbedding)).toThrow(
        'Embedding must contain only valid numbers'
      )
    })
    
    it('should return true for valid embedding', () => {
      const validEmbedding = new Array(1536).fill(0.1)
      
      const result = service.validateEmbedding(validEmbedding)
      
      expect(result).toBe(true)
    })
  })
  
  describe('standardizeEmbedding', () => {
    beforeEach(() => {
      service = new EmbeddingService()
    })
    
    it('should return embedding unchanged if correct dimension', () => {
      const correctEmbedding = new Array(1536).fill(0.1)
      
      const result = service.standardizeEmbedding(correctEmbedding)
      
      expect(result).toBe(correctEmbedding)
      expect(result).toHaveLength(1536)
    })
    
    it('should pad short embeddings with zeros', () => {
      const shortEmbedding = [0.1, 0.2, 0.3]
      
      const result = service.standardizeEmbedding(shortEmbedding)
      
      expect(result).toHaveLength(1536)
      expect(result.slice(0, 3)).toEqual([0.1, 0.2, 0.3])
      expect(result.slice(3)).toEqual(new Array(1533).fill(0))
    })
    
    it('should truncate long embeddings', () => {
      const longEmbedding = new Array(2000).fill(0.1)
      
      const result = service.standardizeEmbedding(longEmbedding)
      
      expect(result).toHaveLength(1536)
      expect(result.every(x => x === 0.1)).toBe(true)
    })
    
    it('should throw error for non-array input', () => {
      expect(() => service.standardizeEmbedding('not an array')).toThrow(
        'Embedding must be an array'
      )
    })
    
    it('should handle custom dimension', () => {
      service = new EmbeddingService({ dimension: 768 })
      const embedding = new Array(1536).fill(0.1)
      
      const result = service.standardizeEmbedding(embedding)
      
      expect(result).toHaveLength(768)
    })
  })
})