import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerMemoryToolsHttp } from '../../../../mcp/tools/memory-tools-http.js';

// Mock dependencies
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  initializeServices: vi.fn().mockResolvedValue(true),
  getMemoryManager: vi.fn(() => mockMemoryManager)
}));

vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
  SafeOperations: vi.fn().mockImplementation(() => mockSafeOperations)
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-http-1234')
}));

// Mock memory manager
const mockMemoryManager = {
  addInteraction: vi.fn().mockResolvedValue(true),
  retrieveRelevantInteractions: vi.fn().mockResolvedValue([]),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.2)),
  generateResponse: vi.fn().mockResolvedValue('HTTP Generated response'),
  dispose: vi.fn().mockResolvedValue(true)
};

// Mock safe operations
const mockSafeOperations = {
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.2)),
  extractConcepts: vi.fn().mockResolvedValue(['http-concept1', 'http-concept2']),
  storeInteraction: vi.fn().mockResolvedValue({ id: 'http-test-id', concepts: ['http-concept1'] }),
  retrieveMemories: vi.fn().mockResolvedValue([]),
  generateResponse: vi.fn().mockResolvedValue('HTTP Safe response')
};

// Mock MCP server
const mockServer = {
  tool: vi.fn(),
  toolHandlers: new Map()
};

describe('Memory Tools HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock server tool registration
    mockServer.tool.mockImplementation((name, config, handler) => {
      mockServer.toolHandlers.set(name, { config, handler });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Tool Registration', () => {
    it('should register HTTP memory tools with the server', () => {
      registerMemoryToolsHttp(mockServer);

      // Verify all HTTP tools are registered
      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_store_interaction_http',
        expect.objectContaining({
          description: expect.stringContaining('Store interaction via HTTP'),
          parameters: expect.objectContaining({
            prompt: expect.any(Object),
            response: expect.any(Object),
            metadata: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_retrieve_memories_http',
        expect.objectContaining({
          description: expect.stringContaining('Retrieve memories via HTTP'),
          parameters: expect.objectContaining({
            query: expect.any(Object),
            threshold: expect.any(Object),
            limit: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_generate_embedding_http',
        expect.objectContaining({
          description: expect.stringContaining('Generate embeddings via HTTP'),
          parameters: expect.objectContaining({
            text: expect.any(Object)
          })
        }),
        expect.any(Function)
      );
    });

    it('should register tools with HTTP-specific naming', () => {
      registerMemoryToolsHttp(mockServer);

      const registeredTools = Array.from(mockServer.toolHandlers.keys());
      expect(registeredTools).toContain('semem_store_interaction_http');
      expect(registeredTools).toContain('semem_retrieve_memories_http');
      expect(registeredTools).toContain('semem_generate_embedding_http');
      expect(registeredTools).toContain('semem_extract_concepts_http');
      expect(registeredTools).toContain('semem_generate_response_http');
    });
  });

  describe('HTTP Store Interaction Tool', () => {
    it('should store interaction with HTTP-specific handling', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction_http').handler;

      const result = await handler({
        prompt: 'What is HTTP?',
        response: 'HTTP is a protocol',
        metadata: { transport: 'http', session: 'test-session' }
      });

      expect(mockSafeOperations.generateEmbedding).toHaveBeenCalledWith('What is HTTP? HTTP is a protocol');
      expect(mockSafeOperations.extractConcepts).toHaveBeenCalledWith('What is HTTP? HTTP is a protocol');
      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'What is HTTP?',
        'HTTP is a protocol',
        expect.any(Array),
        ['http-concept1', 'http-concept2'],
        expect.objectContaining({
          id: 'test-uuid-http-1234',
          timestamp: expect.any(Number),
          transport: 'http',
          session: 'test-session'
        })
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('Successfully stored interaction');
      expect(content.transport).toBe('http');
    });

    it('should include HTTP-specific metadata in response', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction_http').handler;

      const result = await handler({
        prompt: 'Test HTTP prompt',
        response: 'Test HTTP response'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.transport).toBe('http');
      expect(content.timestamp).toBeDefined();
      expect(content.sessionId).toBeDefined();
    });

    it('should handle HTTP session management', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction_http').handler;

      // First request creates session
      const result1 = await handler({
        prompt: 'First HTTP request',
        response: 'First HTTP response'
      });

      // Second request should reference session
      const result2 = await handler({
        prompt: 'Second HTTP request',
        response: 'Second HTTP response',
        metadata: { sessionContinuation: true }
      });

      const content1 = JSON.parse(result1.content[0].text);
      const content2 = JSON.parse(result2.content[0].text);
      
      expect(content1.sessionId).toBeDefined();
      expect(content2.sessionId).toBeDefined();
    });
  });

  describe('HTTP Retrieve Memories Tool', () => {
    it('should retrieve memories with HTTP transport metadata', async () => {
      const mockHttpMemories = [
        { 
          prompt: 'HTTP test query', 
          output: 'HTTP test response', 
          similarity: 0.95,
          metadata: { transport: 'http' }
        }
      ];
      mockSafeOperations.retrieveMemories.mockResolvedValueOnce(mockHttpMemories);

      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_retrieve_memories_http').handler;

      const result = await handler({
        query: 'http test query',
        threshold: 0.8,
        limit: 5
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'http test query',
        0.8,
        0
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.memories).toEqual(mockHttpMemories);
      expect(content.transport).toBe('http');
      expect(content.retrievalMethod).toBe('http-optimized');
    });

    it('should handle HTTP-specific query parameters', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_retrieve_memories_http').handler;

      await handler({
        query: 'http query',
        threshold: 0.9,
        limit: 3,
        httpOptimized: true
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'http query',
        0.9,
        0
      );
    });
  });

  describe('HTTP Generate Embedding Tool', () => {
    it('should generate embeddings with HTTP transport info', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_embedding_http').handler;

      const result = await handler({
        text: 'HTTP embedding test text'
      });

      expect(mockSafeOperations.generateEmbedding).toHaveBeenCalledWith('HTTP embedding test text');

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.embedding).toEqual(new Array(1536).fill(0.2));
      expect(content.embeddingLength).toBe(1536);
      expect(content.transport).toBe('http');
      expect(content.processingTime).toBeDefined();
    });

    it('should include HTTP performance metrics', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_embedding_http').handler;

      const result = await handler({
        text: 'Performance test text'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.processingTime).toBeDefined();
      expect(content.transport).toBe('http');
    });
  });

  describe('HTTP Generate Response Tool', () => {
    it('should generate response with HTTP session context', async () => {
      const mockHttpMemories = [
        { prompt: 'HTTP context', output: 'HTTP context response' }
      ];
      mockSafeOperations.retrieveMemories.mockResolvedValueOnce(mockHttpMemories);

      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_response_http').handler;

      const result = await handler({
        prompt: 'Generate HTTP response',
        useMemory: true,
        sessionId: 'test-http-session'
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'Generate HTTP response',
        0.7,
        0
      );
      expect(mockSafeOperations.generateResponse).toHaveBeenCalledWith(
        'Generate HTTP response',
        mockHttpMemories.slice(0, 3),
        { temperature: 0.7, maxTokens: 500 }
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.response).toBe('HTTP Safe response');
      expect(content.transport).toBe('http');
      expect(content.sessionId).toBe('test-http-session');
    });

    it('should handle HTTP streaming response options', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_response_http').handler;

      const result = await handler({
        prompt: 'Streaming test',
        useMemory: false,
        streamingEnabled: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.streamingSupported).toBe(true);
      expect(content.transport).toBe('http');
    });
  });

  describe('HTTP Error Handling', () => {
    it('should handle HTTP-specific connection errors', async () => {
      mockSafeOperations.generateEmbedding.mockRejectedValueOnce(new Error('HTTP connection timeout'));

      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_embedding_http').handler;

      const result = await handler({
        text: 'Test text'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('HTTP connection timeout');
      expect(content.transport).toBe('http');
      expect(content.errorType).toBe('connection');
    });

    it('should handle HTTP session errors', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockReturnValueOnce(null);

      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction_http').handler;

      const result = await handler({
        prompt: 'Test prompt',
        response: 'Test response',
        sessionId: 'invalid-session'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Memory manager not available');
      expect(content.transport).toBe('http');
      expect(content.sessionId).toBe('invalid-session');
    });
  });

  describe('HTTP Transport Features', () => {
    it('should support HTTP-specific metadata tracking', async () => {
      registerMemoryToolsHttp(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction_http').handler;

      const result = await handler({
        prompt: 'Metadata test',
        response: 'Metadata response',
        metadata: {
          httpHeaders: { 'content-type': 'application/json' },
          clientIP: '192.168.1.100',
          userAgent: 'Test-Client/1.0'
        }
      });

      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'Metadata test',
        'Metadata response',
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          httpHeaders: { 'content-type': 'application/json' },
          clientIP: '192.168.1.100',
          userAgent: 'Test-Client/1.0',
          transport: 'http'
        })
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.transport).toBe('http');
    });

    it('should include HTTP performance metrics in all responses', async () => {
      registerMemoryToolsHttp(mockServer);
      
      const tools = [
        'semem_store_interaction_http',
        'semem_retrieve_memories_http', 
        'semem_generate_embedding_http',
        'semem_extract_concepts_http',
        'semem_generate_response_http'
      ];

      for (const toolName of tools) {
        const handler = mockServer.toolHandlers.get(toolName).handler;
        const result = await handler({
          prompt: 'Performance test',
          response: 'Performance response',
          query: 'Performance query',
          text: 'Performance text'
        });

        const content = JSON.parse(result.content[0].text);
        expect(content.transport).toBe('http');
        expect(content.processingTime).toBeDefined();
      }
    });
  });
});