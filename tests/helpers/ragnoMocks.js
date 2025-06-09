/**
 * ragnoMocks.js - Mock utilities for Ragno testing
 * 
 * This module provides mock implementations of LLM handlers, SPARQL endpoints,
 * and other external dependencies for consistent and reliable testing of
 * ragno components.
 */

import { vi } from 'vitest'

/**
 * Mock LLM Handler with predictable, configurable responses
 */
export class MockLLMHandler {
  constructor(responses = {}) {
    this.responses = {
      generateCompletion: responses.generateCompletion || this.defaultCompletionHandler,
      generateChat: responses.generateChat || this.defaultChatHandler,
      generateEmbedding: responses.generateEmbedding || this.defaultEmbeddingHandler,
      ...responses
    }
    this.calls = []
  }

  async generateCompletion(prompt, options = {}) {
    this.calls.push({ method: 'generateCompletion', prompt, options })
    return this.responses.generateCompletion(prompt, options)
  }

  async generateChat(messages, options = {}) {
    this.calls.push({ method: 'generateChat', messages, options })
    return this.responses.generateChat(messages, options)
  }

  async generateEmbedding(text, options = {}) {
    this.calls.push({ method: 'generateEmbedding', text, options })
    return this.responses.generateEmbedding(text, options)
  }

  // Default response handlers
  defaultCompletionHandler(prompt, options) {
    // Handle semantic unit extraction
    if (prompt.includes('Break down the following text into independent semantic units')) {
      const textMatch = prompt.match(/Text: "(.*?)"/s)
      if (textMatch) {
        const text = textMatch[1]
        // Split by sentences as a simple fallback
        const units = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
        return JSON.stringify(units.map(s => s.trim()))
      }
      return '[]'
    }
    
    // Handle entity extraction
    if (prompt.includes('Extract the key entities')) {
      const textMatch = prompt.match(/Text: "(.*?)"/s)
      if (textMatch) {
        const text = textMatch[1]
        const entities = []
        
        // Simple entity detection based on capitalized words
        const words = text.match(/[A-Z][a-z]+/g) || []
        for (const word of words) {
          entities.push({
            name: word,
            type: 'general',
            relevance: 0.8,
            isEntryPoint: false,
            confidence: 0.7
          })
        }
        
        return JSON.stringify(entities)
      }
      return '[]'
    }
    
    // Handle relationship extraction
    if (prompt.includes('Identify relationships between these entities')) {
      return '[]' // No relationships by default
    }
    
    // Handle summary generation
    if (prompt.includes('Provide a concise 1-2 sentence summary')) {
      const textMatch = prompt.match(/"(.*?)"/s)
      if (textMatch) {
        const text = textMatch[1]
        return text.length > 50 ? text.substring(0, 50) + '...' : text
      }
      return 'Summary not available'
    }
    
    return 'Mock LLM response'
  }

  defaultChatHandler(messages, options) {
    return 'Mock chat response'
  }

  defaultEmbeddingHandler(text, options) {
    // Generate a mock embedding vector
    const dimension = options.dimension || 768
    return Array.from({ length: dimension }, () => Math.random() - 0.5)
  }

  // Utility methods for testing
  getCallCount(method = null) {
    if (method) {
      return this.calls.filter(call => call.method === method).length
    }
    return this.calls.length
  }

  getLastCall(method = null) {
    const filteredCalls = method 
      ? this.calls.filter(call => call.method === method)
      : this.calls
    return filteredCalls[filteredCalls.length - 1]
  }

  reset() {
    this.calls = []
  }
}

/**
 * Mock SPARQL Helpers for testing SPARQL operations
 */
export class MockSPARQLHelpers {
  constructor() {
    this.queries = []
    this.updates = []
  }

  static createAuthHeader(user, password) {
    return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
  }

  static async executeSPARQLUpdate(endpoint, query, auth) {
    // Record the update for testing
    MockSPARQLHelpers.instance?.updates?.push({ endpoint, query, auth })
    return { ok: true }
  }

  static async executeSPARQLQuery(endpoint, query, auth) {
    // Record the query for testing
    MockSPARQLHelpers.instance?.queries?.push({ endpoint, query, auth })
    return {
      results: {
        bindings: []
      }
    }
  }

  static getDatasetEndpoint(baseUrl, dataset, operation) {
    return `${baseUrl}/${dataset}/${operation}`
  }

  // Instance methods for testing utilities
  getUpdateCount() {
    return this.updates.length
  }

  getQueryCount() {
    return this.queries.length
  }

  getLastUpdate() {
    return this.updates[this.updates.length - 1]
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1]
  }

  reset() {
    this.queries = []
    this.updates = []
  }
}

/**
 * Mock Embedding Handler for vector operations
 */
export class MockEmbeddingHandler {
  constructor(dimension = 768) {
    this.dimension = dimension
    this.embeddings = new Map()
  }

  async generateEmbedding(text) {
    // Return consistent embeddings for the same text
    if (this.embeddings.has(text)) {
      return this.embeddings.get(text)
    }
    
    // Generate a deterministic embedding based on text content
    const embedding = Array.from({ length: this.dimension }, (_, i) => {
      return (text.charCodeAt(i % text.length) / 255) - 0.5
    })
    
    this.embeddings.set(text, embedding)
    return embedding
  }

  async validateEmbedding(embedding) {
    return Array.isArray(embedding) && embedding.length === this.dimension
  }
}

/**
 * Test data generators for ragno components
 */
export const testData = {
  sampleTextChunks: [
    {
      content: 'Geoffrey Hinton is a pioneering researcher in artificial neural networks and deep learning.',
      source: 'ai_pioneers.txt'
    },
    {
      content: 'Yann LeCun developed convolutional neural networks and is a key figure in computer vision.',
      source: 'ai_pioneers.txt'
    },
    {
      content: 'The transformer architecture revolutionized natural language processing through attention mechanisms.',
      source: 'transformers.txt'
    }
  ],

  sampleEntities: [
    { name: 'Geoffrey Hinton', type: 'person', confidence: 0.9 },
    { name: 'Yann LeCun', type: 'person', confidence: 0.9 },
    { name: 'neural networks', type: 'concept', confidence: 0.8 },
    { name: 'deep learning', type: 'concept', confidence: 0.8 }
  ],

  sampleRelationships: [
    {
      source: 'Geoffrey Hinton',
      target: 'neural networks',
      type: 'researches',
      weight: 0.9
    },
    {
      source: 'Yann LeCun',
      target: 'convolutional neural networks',
      type: 'developed',
      weight: 0.9
    }
  ]
}

/**
 * Setup a complete mock environment for ragno testing
 */
export function setupMockEnvironment() {
  const llmHandler = new MockLLMHandler()
  const embeddingHandler = new MockEmbeddingHandler()
  const sparqlMock = new MockSPARQLHelpers()
  
  // Set up the SPARQL helpers mock instance
  MockSPARQLHelpers.instance = sparqlMock
  
  return {
    llmHandler,
    embeddingHandler,
    sparqlMock,
    cleanup: () => {
      llmHandler.reset()
      embeddingHandler.embeddings.clear()
      sparqlMock.reset()
      MockSPARQLHelpers.instance = null
    }
  }
}

/**
 * Vitest helper for mocking external modules
 */
export function mockExternalModules() {
  // Mock the hnswlib-node module
  vi.mock('hnswlib-node', () => ({
    default: {
      HierarchicalNSW: vi.fn().mockImplementation(() => ({
        initIndex: vi.fn(),
        addPoint: vi.fn(),
        searchKnn: vi.fn(() => ({ neighbors: [], distances: [] })),
        getMaxElements: vi.fn(() => 1000),
        getCurrentCount: vi.fn(() => 0),
        saveIndex: vi.fn(),
        loadIndex: vi.fn()
      }))
    }
  }))
  
  // Mock the SPARQLHelpers
  vi.mock('../../src/utils/SPARQLHelpers.js', () => ({
    default: MockSPARQLHelpers
  }))
}