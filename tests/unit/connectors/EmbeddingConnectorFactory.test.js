/**
 * @file Unit tests for EmbeddingConnectorFactory
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EmbeddingConnectorFactory from '../../../src/connectors/EmbeddingConnectorFactory.js'
import OllamaConnector from '../../../src/connectors/OllamaConnector.js'
import NomicConnector from '../../../src/connectors/NomicConnector.js'

// Mock the connector classes
vi.mock('../../../src/connectors/OllamaConnector.js')
vi.mock('../../../src/connectors/NomicConnector.js')

describe('EmbeddingConnectorFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('createConnector', () => {
    it('should create OllamaConnector for ollama provider', () => {
      const mockConnector = { provider: 'ollama' }
      OllamaConnector.mockImplementation(() => mockConnector)
      
      const config = {
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: { baseUrl: 'http://localhost:11434' }
      }
      
      const result = EmbeddingConnectorFactory.createConnector(config)
      
      expect(OllamaConnector).toHaveBeenCalledWith(
        'http://localhost:11434',
        'nomic-embed-text'
      )
      expect(result).toBe(mockConnector)
    })
    
    it('should create NomicConnector for nomic provider', () => {
      const mockConnector = { provider: 'nomic' }
      NomicConnector.mockImplementation(() => mockConnector)
      
      const config = {
        provider: 'nomic',
        model: 'nomic-embed-text-v1.5',
        options: { apiKey: 'test-key' }
      }
      
      const result = EmbeddingConnectorFactory.createConnector(config)
      
      expect(NomicConnector).toHaveBeenCalledWith(
        'test-key',
        'nomic-embed-text-v1.5'
      )
      expect(result).toBe(mockConnector)
    })
    
    it('should use default values when config is minimal', () => {
      const mockConnector = { provider: 'ollama' }
      OllamaConnector.mockImplementation(() => mockConnector)
      
      const result = EmbeddingConnectorFactory.createConnector({})
      
      expect(OllamaConnector).toHaveBeenCalledWith(
        'http://localhost:11434',
        'nomic-embed-text'
      )
      expect(result).toBe(mockConnector)
    })
    
    it('should fall back to Ollama for unknown provider', () => {
      const mockConnector = { provider: 'ollama' }
      OllamaConnector.mockImplementation(() => mockConnector)
      
      const config = {
        provider: 'unknown-provider',
        model: 'test-model'
      }
      
      const result = EmbeddingConnectorFactory.createConnector(config)
      
      expect(OllamaConnector).toHaveBeenCalledWith(
        'http://localhost:11434',
        'test-model'
      )
      expect(result).toBe(mockConnector)
    })
    
    it('should handle case-insensitive provider names', () => {
      const mockConnector = { provider: 'nomic' }
      NomicConnector.mockImplementation(() => mockConnector)
      
      const config = {
        provider: 'NOMIC',
        model: 'test-model'
      }
      
      const result = EmbeddingConnectorFactory.createConnector(config)
      
      expect(NomicConnector).toHaveBeenCalledWith(
        process.env.NOMIC_API_KEY,
        'test-model'
      )
      expect(result).toBe(mockConnector)
    })
    
    it('should use environment variable for Nomic API key', () => {
      process.env.NOMIC_API_KEY = 'env-api-key'
      
      const mockConnector = { provider: 'nomic' }
      NomicConnector.mockImplementation(() => mockConnector)
      
      const config = { provider: 'nomic' }
      
      const result = EmbeddingConnectorFactory.createConnector(config)
      
      expect(NomicConnector).toHaveBeenCalledWith(
        'env-api-key',
        'nomic-embed-text-v1.5'
      )
      
      delete process.env.NOMIC_API_KEY
    })
  })
  
  describe('getSupportedProviders', () => {
    it('should return array of supported providers', () => {
      const providers = EmbeddingConnectorFactory.getSupportedProviders()
      
      expect(providers).toEqual(['ollama', 'nomic'])
      expect(Array.isArray(providers)).toBe(true)
    })
  })
  
  describe('isProviderSupported', () => {
    it('should return true for supported providers', () => {
      expect(EmbeddingConnectorFactory.isProviderSupported('ollama')).toBe(true)
      expect(EmbeddingConnectorFactory.isProviderSupported('nomic')).toBe(true)
      expect(EmbeddingConnectorFactory.isProviderSupported('OLLAMA')).toBe(true)
    })
    
    it('should return false for unsupported providers', () => {
      expect(EmbeddingConnectorFactory.isProviderSupported('openai')).toBe(false)
      expect(EmbeddingConnectorFactory.isProviderSupported('unknown')).toBe(false)
    })
  })
  
  describe('getDefaultConfig', () => {
    beforeEach(() => {
      process.env.NOMIC_API_KEY = 'test-env-key'
    })
    
    afterEach(() => {
      delete process.env.NOMIC_API_KEY
    })
    
    it('should return default config for ollama', () => {
      const config = EmbeddingConnectorFactory.getDefaultConfig('ollama')
      
      expect(config).toEqual({
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: {
          baseUrl: 'http://localhost:11434'
        }
      })
    })
    
    it('should return default config for nomic', () => {
      const config = EmbeddingConnectorFactory.getDefaultConfig('nomic')
      
      expect(config).toEqual({
        provider: 'nomic',
        model: 'nomic-embed-text-v1.5',
        options: {
          apiKey: 'test-env-key'
        }
      })
    })
    
    it('should fall back to ollama config for unknown provider', () => {
      const config = EmbeddingConnectorFactory.getDefaultConfig('unknown')
      
      expect(config).toEqual({
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: {
          baseUrl: 'http://localhost:11434'
        }
      })
    })
    
    it('should handle case-insensitive provider names', () => {
      const config = EmbeddingConnectorFactory.getDefaultConfig('NOMIC')
      
      expect(config.provider).toBe('nomic')
    })
  })
})