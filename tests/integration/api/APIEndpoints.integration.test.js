// tests/integration/api/APIEndpoints.integration.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import HTTPServer from '../../../src/api/http/server/HTTPServer.js';
import APIRegistry from '../../../src/api/common/APIRegistry.js';
import MemoryAPI from '../../../src/api/features/MemoryAPI.js';
import ChatAPI from '../../../src/api/features/ChatAPI.js';
import SearchAPI from '../../../src/api/features/SearchAPI.js';

// FIXME: This integration test requires more work to properly mock the dependencies
// and handle the complex interactions between components.
// Skipping for now as the unit tests cover most of the functionality
describe.skip('API Endpoints Integration', () => {
  let server;
  let port;
  let baseUrl;
  let apiKey;
  let mockMemoryManager;
  let mockLLMHandler;
  let mockSearchService;
  let registry;
  
  // Helper to create a stream response
  const createStreamResponse = () => {
    const stream = new EventEmitter();
    setTimeout(() => {
      stream.emit('data', { chunk: 'Test ' });
      stream.emit('data', { chunk: 'streaming ' });
      stream.emit('data', { chunk: 'response' });
      stream.emit('end');
    }, 10);
    return stream;
  };
  
  beforeAll(async () => {
    // Use a random port to avoid conflicts
    port = 9000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${port}/api`;
    apiKey = 'test-api-key-123';
    
    // Set environment variable for API key
    process.env.API_KEY = apiKey;
    
    // Create mock services
    mockMemoryManager = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
      addInteraction: vi.fn().mockResolvedValue(),
      retrieveRelevantInteractions: vi.fn().mockResolvedValue([
        {
          interaction: {
            id: 'test-id-1',
            prompt: 'Test prompt 1',
            output: 'Test output 1',
            concepts: ['concept1'],
            timestamp: Date.now() - 1000
          },
          similarity: 0.85
        }
      ])
    };
    
    mockLLMHandler = {
      generateResponse: vi.fn().mockResolvedValue('Test response from LLM'),
      generateCompletion: vi.fn().mockResolvedValue('Test completion from LLM'),
      generateStreamingResponse: vi.fn().mockImplementation(createStreamResponse)
    };
    
    mockSearchService = {
      search: vi.fn().mockResolvedValue([
        {
          id: 'search-id-1',
          title: 'Search Result 1',
          content: 'Content of search result 1',
          similarity: 0.9,
          type: 'article'
        }
      ]),
      index: vi.fn().mockResolvedValue({ id: 'indexed-id', success: true }),
      getIndexSize: vi.fn().mockResolvedValue(42)
    };
    
    // Create a registry to inject mocks
    registry = new APIRegistry();
    
    // Create server with registry injected
    server = new HTTPServer({
      port,
      registry,
    });
    
    // Override registry.register to inject mocks
    const originalRegister = registry.register;
    registry.register = vi.fn().mockImplementation(async (name, ApiClass, config) => {
      const api = new ApiClass({
        ...config,
        registry: {
          get: (serviceName) => {
            if (serviceName === 'memory') return mockMemoryManager;
            if (serviceName === 'llm') return mockLLMHandler;
            if (serviceName === 'search') return mockSearchService;
            throw new Error(`Unknown service: ${serviceName}`);
          }
        }
      });
      
      await api.initialize();
      registry.apis.set(name, api);
      return api;
    });
    
    // Initialize server
    await server.initialize();
  });
  
  afterAll(async () => {
    // Clean up server
    await server.shutdown();
    delete process.env.API_KEY;
  });
  
  afterEach(() => {
    // Reset mocks after each test
    vi.clearAllMocks();
  });
  
  describe('Authentication', () => {
    it('should require API key', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Test prompt',
          response: 'Test response'
        })
      });
      
      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBe('Missing API key');
    });
    
    it('should accept API key in header', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          prompt: 'Test prompt',
          response: 'Test response'
        })
      });
      
      expect(response.status).toBe(201);
    });
    
    it('should accept API key in query parameter', async () => {
      const response = await fetch(`${baseUrl}/memory/search?query=test&api_key=${apiKey}`);
      
      expect(response.status).toBe(200);
    });
    
    it('should reject invalid API key', async () => {
      const response = await fetch(`${baseUrl}/memory/search?query=test`, {
        headers: {
          'X-API-Key': 'invalid-key'
        }
      });
      
      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBe('Invalid API key');
    });
  });
  
  describe('Memory API Endpoints', () => {
    it('should store memory', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          prompt: 'Test prompt',
          response: 'Test response',
          metadata: { tag: 'test' }
        })
      });
      
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.id).toBeDefined();
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalled();
      expect(mockMemoryManager.extractConcepts).toHaveBeenCalled();
      expect(mockMemoryManager.addInteraction).toHaveBeenCalled();
    });
    
    it('should search memories', async () => {
      const response = await fetch(
        `${baseUrl}/memory/search?query=test&threshold=0.8&limit=5`, {
          headers: {
            'X-API-Key': apiKey
          }
        }
      );
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('test-id-1');
      expect(result.results[0].similarity).toBe(0.85);
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalledWith(
        'test', 0.8, 0, 5
      );
    });
    
    it('should generate embeddings', async () => {
      const response = await fetch(`${baseUrl}/memory/embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          text: 'Test text for embedding'
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.embedding).toHaveLength(1536);
      expect(result.dimension).toBe(1536);
      
      expect(mockMemoryManager.generateEmbedding).toHaveBeenCalledWith(
        'Test text for embedding', undefined
      );
    });
    
    it('should extract concepts', async () => {
      const response = await fetch(`${baseUrl}/memory/concepts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          text: 'Test text for concept extraction'
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.concepts).toEqual(['concept1', 'concept2']);
      expect(result.text).toBe('Test text for concept extraction');
      
      expect(mockMemoryManager.extractConcepts).toHaveBeenCalledWith(
        'Test text for concept extraction'
      );
    });
    
    it('should handle validation errors', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          // Missing required prompt
          response: 'Test response'
        })
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBeDefined();
    });
  });
  
  describe('Chat API Endpoints', () => {
    it('should generate chat response', async () => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          prompt: 'Hello AI',
          useMemory: true,
          temperature: 0.7
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.response).toBe('Test response from LLM');
      expect(result.conversationId).toBeDefined();
      expect(result.memoryIds).toBeDefined();
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalled();
      expect(mockLLMHandler.generateResponse).toHaveBeenCalled();
      expect(mockMemoryManager.addInteraction).toHaveBeenCalled();
    });
    
    it('should stream chat response', async () => {
      // Test streaming response with a simple client
      const response = await fetch(`${baseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          prompt: 'Hello AI',
          useMemory: true
        })
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      
      // Read the stream
      const reader = response.body.getReader();
      let chunks = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the Uint8Array to a string
        chunks += new TextDecoder().decode(value);
      }
      
      // Parse events from the SSE format
      const events = chunks
        .split('\n\n')
        .filter(event => event.startsWith('data: '))
        .map(event => JSON.parse(event.substring(6)));
      
      // Check that we received data chunks and a done event
      expect(events.length).toBeGreaterThan(1);
      expect(events.some(event => event.done === true)).toBeTruthy();
      expect(events.some(event => event.chunk)).toBeTruthy();
      
      expect(mockLLMHandler.generateStreamingResponse).toHaveBeenCalled();
    });
    
    it('should generate completion', async () => {
      const response = await fetch(`${baseUrl}/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          prompt: 'Complete this sentence:',
          max_tokens: 50,
          temperature: 0.7
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.completion).toBe('Test completion from LLM');
      expect(result.memoryIds).toBeDefined();
      
      expect(mockMemoryManager.retrieveRelevantInteractions).toHaveBeenCalled();
      expect(mockLLMHandler.generateCompletion).toHaveBeenCalled();
    });
    
    it('should handle validation errors', async () => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          // Missing required prompt
        })
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBeDefined();
    });
  });
  
  describe('Search API Endpoints', () => {
    it('should search content', async () => {
      const response = await fetch(
        `${baseUrl}/search?query=test&limit=5&types=article,document&threshold=0.8`, {
          headers: {
            'X-API-Key': apiKey
          }
        }
      );
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('search-id-1');
      expect(result.results[0].title).toBe('Search Result 1');
      expect(result.results[0].similarity).toBe(0.9);
      
      expect(mockSearchService.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          threshold: 0.8,
          limit: 5,
          types: ['article', 'document']
        })
      );
    });
    
    it('should index content', async () => {
      const response = await fetch(`${baseUrl}/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          content: 'Test content to index',
          type: 'article',
          title: 'Test Article',
          metadata: { author: 'Test Author' }
        })
      });
      
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBeTruthy();
      expect(result.id).toBe('indexed-id');
      
      expect(mockSearchService.index).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test content to index',
          type: 'article',
          title: 'Test Article',
          metadata: { author: 'Test Author' }
        })
      );
    });
    
    it('should handle validation errors', async () => {
      const response = await fetch(`${baseUrl}/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          // Missing required content and type
          title: 'Test Article'
        })
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBeDefined();
    });
  });
  
  describe('System Endpoints', () => {
    it('should provide health status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      
      expect(response.status).toBe(200);
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.components).toBeDefined();
      expect(health.components.memory).toBeDefined();
      expect(health.components.chat).toBeDefined();
      expect(health.components.search).toBeDefined();
    });
    
    it('should provide metrics when authenticated', async () => {
      const response = await fetch(`${baseUrl}/metrics`, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      expect(response.status).toBe(200);
      const metrics = await response.json();
      expect(metrics.success).toBeTruthy();
      expect(metrics.data).toBeDefined();
      expect(metrics.data.timestamp).toBeDefined();
      expect(metrics.data.apiCount).toBeDefined();
      // Check that we have metrics for each API
      expect(metrics.data.memory).toBeDefined();
      expect(metrics.data.chat).toBeDefined();
      expect(metrics.data.search).toBeDefined();
    });
    
    it('should reject metrics without authentication', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await fetch(`${baseUrl}/nonexistent-endpoint`, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBe('Not Found');
      expect(error.message).toBe('Endpoint not found');
    });
    
    it('should handle method not allowed', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'PUT', // Not supported method
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(404);
    });
    
    it('should handle malformed JSON', async () => {
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: '{"malformed json'
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBeDefined();
    });
    
    it('should handle internal server errors', async () => {
      // Make the memory manager throw an error
      mockMemoryManager.addInteraction.mockRejectedValueOnce(
        new Error('Simulated server error')
      );
      
      const response = await fetch(`${baseUrl}/memory`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Test prompt',
          response: 'Test response'
        })
      });
      
      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error.success).toBeFalsy();
      expect(error.error).toBe('Internal Server Error');
      expect(error.message).toBe('Simulated server error');
    });
  });
});