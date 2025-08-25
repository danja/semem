/**
 * @file Unit tests for NomicConnector
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import NomicConnector from '../../../../src/connectors/NomicConnector.js'

// Mock hyperdata-clients
vi.mock('hyperdata-clients', () => ({
  createEmbeddingClient: vi.fn()
}))

describe('NomicConnector', () => {
  let connector
  let mockClient
  let mockCreateEmbeddingClient
  
  beforeEach(async () => {
    // Mock environment variable
    process.env.NOMIC_API_KEY = 'test-api-key'
    
    // Create mock client
    mockClient = {
      embed: vi.fn(),
      embedSingle: vi.fn()
    }
    
    // Get the mocked function
    const { createEmbeddingClient } = await import('hyperdata-clients')
    mockCreateEmbeddingClient = createEmbeddingClient
    mockCreateEmbeddingClient.mockResolvedValue(mockClient)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.NOMIC_API_KEY
  })
  
  describe('constructor', () => {
    it('should initialize with default model', () => {
      connector = new NomicConnector()
      
      expect(connector.defaultModel).toBe('nomic-embed-text-v1.5')
      expect(connector.apiKey).toBe('test-api-key')
    })
    
    it('should use provided API key', () => {
      connector = new NomicConnector('custom-key')
      
      expect(connector.apiKey).toBe('custom-key')
    })
    
    it('should use custom default model', () => {
      connector = new NomicConnector(null, 'custom-model')
      
      expect(connector.defaultModel).toBe('custom-model')
    })
  })
  
  describe('initialize', () => {
    it('should initialize client with correct parameters', async () => {
      connector = new NomicConnector()
      await connector.initialize()
      
      expect(mockCreateEmbeddingClient).toHaveBeenCalledWith('nomic', {
        apiKey: 'test-api-key',
        model: 'nomic-embed-text-v1.5'
      })
    })
    
    it('should throw error when API key is missing', async () => {
      delete process.env.NOMIC_API_KEY
      connector = new NomicConnector()
      
      await expect(connector.initialize()).rejects.toThrow(
        'Nomic API key is required'
      )
    })
  })
  
  describe('generateEmbedding', () => {
    beforeEach(async () => {
      connector = new NomicConnector()
      await connector.initialize()
    })
    
    it('should generate embedding for single text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      mockClient.embedSingle.mockResolvedValue(mockEmbedding)
      
      const result = await connector.generateEmbedding('test-model', 'Hello world')
      
      expect(mockClient.embedSingle).toHaveBeenCalledWith('Hello world')
      expect(result).toEqual(mockEmbedding)
    })
    
    it('should generate embeddings for array of texts', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
      mockClient.embed.mockResolvedValue(mockEmbeddings)
      
      const texts = ['Hello world', 'Goodbye world']
      const result = await connector.generateEmbedding('test-model', texts)
      
      expect(mockClient.embed).toHaveBeenCalledWith(texts)
      expect(result).toEqual(mockEmbeddings)
    })
    
    it('should use default model when not specified', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      mockClient.embedSingle.mockResolvedValue(mockEmbedding)
      
      await connector.generateEmbedding(undefined, 'Hello world')
      
      expect(mockClient.embedSingle).toHaveBeenCalledWith('Hello world')
    })
    
    it('should initialize client if not already initialized', async () => {
      connector.client = null
      const mockEmbedding = [0.1, 0.2, 0.3]
      mockClient.embedSingle.mockResolvedValue(mockEmbedding)
      
      await connector.generateEmbedding('test-model', 'Hello world')
      
      expect(mockCreateEmbeddingClient).toHaveBeenCalled()
    })
    
    it('should handle embedding generation errors', async () => {
      mockClient.embedSingle.mockRejectedValue(new Error('API Error'))
      
      await expect(
        connector.generateEmbedding('test-model', 'Hello world')
      ).rejects.toThrow('Nomic embedding generation failed: API Error')
    })
  })
  
  describe('generateCompletion', () => {
    it('should throw error for unsupported operation', async () => {
      connector = new NomicConnector()
      
      await expect(connector.generateCompletion()).rejects.toThrow(
        'Chat completion not supported by Nomic embedding API'
      )
    })
  })
  
  describe('isAvailable', () => {
    it('should return true when API key is available', () => {
      connector = new NomicConnector()
      
      expect(connector.isAvailable()).toBe(true)
    })
    
    it('should return false when API key is not available', () => {
      delete process.env.NOMIC_API_KEY
      connector = new NomicConnector()
      
      expect(connector.isAvailable()).toBe(false)
    })
  })
  
  describe('getInfo', () => {
    it('should return connector information', () => {
      connector = new NomicConnector()
      
      const info = connector.getInfo()
      
      expect(info).toEqual({
        provider: 'nomic',
        type: 'embedding',
        model: 'nomic-embed-text-v1.5',
        available: true,
        capabilities: ['embedding']
      })
    })
  })
})