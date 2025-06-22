import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerMemoryTools } from '../../../../mcp/tools/memory-tools.js';

// Mock dependencies
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  initializeServices: vi.fn().mockResolvedValue(true),
  getMemoryManager: vi.fn(() => mockMemoryManager)
}));

vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
  SafeOperations: vi.fn().mockImplementation(() => mockSafeOperations)
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234')
}));

// Mock memory manager
const mockMemoryManager = {
  addInteraction: vi.fn().mockResolvedValue(true),
  retrieveRelevantInteractions: vi.fn().mockResolvedValue([]),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  generateResponse: vi.fn().mockResolvedValue('Generated response'),
  dispose: vi.fn().mockResolvedValue(true)
};

// Mock safe operations
const mockSafeOperations = {
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
  storeInteraction: vi.fn().mockResolvedValue({ id: 'test-id', concepts: ['concept1'] }),
  retrieveMemories: vi.fn().mockResolvedValue([]),
  generateResponse: vi.fn().mockResolvedValue('Safe response')
};

// Mock MCP server
const mockServer = {
  tool: vi.fn(),
  toolHandlers: new Map()
};

describe('Memory Tools', () => {
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

  describe('Tool Registration', () => {
    it('should register all memory tools with the server', () => {
      registerMemoryTools(mockServer);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_store_interaction',
        expect.objectContaining({
          description: expect.stringContaining('Store a new interaction'),
          parameters: expect.objectContaining({
            prompt: expect.any(Object),
            response: expect.any(Object),
            metadata: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_retrieve_memories',
        expect.objectContaining({
          description: expect.stringContaining('Search for relevant memories'),
          parameters: expect.objectContaining({
            query: expect.any(Object),
            threshold: expect.any(Object),
            limit: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_generate_embedding',
        expect.objectContaining({
          description: expect.stringContaining('Generate vector embeddings'),
          parameters: expect.objectContaining({
            text: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_extract_concepts',
        expect.objectContaining({
          description: expect.stringContaining('Extract semantic concepts'),
          parameters: expect.objectContaining({
            text: expect.any(Object)
          })
        }),
        expect.any(Function)
      );

      expect(mockServer.tool).toHaveBeenCalledWith(
        'semem_generate_response',
        expect.objectContaining({
          description: expect.stringContaining('Generate LLM response'),
          parameters: expect.objectContaining({
            prompt: expect.any(Object),
            useMemory: expect.any(Object),
            temperature: expect.any(Object)
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('semem_store_interaction Tool', () => {
    it('should store interaction with all required fields', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction').handler;

      const result = await handler({
        prompt: 'What is AI?',
        response: 'AI is artificial intelligence',
        metadata: { source: 'test' }
      });

      expect(mockSafeOperations.generateEmbedding).toHaveBeenCalledWith('What is AI? AI is artificial intelligence');
      expect(mockSafeOperations.extractConcepts).toHaveBeenCalledWith('What is AI? AI is artificial intelligence');
      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'What is AI?',
        'AI is artificial intelligence',
        expect.any(Array),
        ['concept1', 'concept2'],
        expect.objectContaining({
          id: 'test-uuid-1234',
          timestamp: expect.any(Number),
          source: 'test'
        })
      );

      expect(result.content).toHaveLength(1);
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('Successfully stored interaction');
    });

    it('should handle missing optional metadata', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction').handler;

      const result = await handler({
        prompt: 'Test prompt',
        response: 'Test response'
      });

      expect(mockMemoryManager.addInteraction).toHaveBeenCalledWith(
        'Test prompt',
        'Test response',
        expect.any(Array),
        ['concept1', 'concept2'],
        expect.objectContaining({
          id: 'test-uuid-1234',
          timestamp: expect.any(Number)
        })
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockSafeOperations.generateEmbedding.mockRejectedValueOnce(new Error('Embedding failed'));
      
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction').handler;

      const result = await handler({
        prompt: 'Test prompt',
        response: 'Test response'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Embedding failed');
    });
  });

  describe('semem_retrieve_memories Tool', () => {
    it('should retrieve memories with default parameters', async () => {
      const mockMemories = [
        { prompt: 'Test query', output: 'Test response', similarity: 0.9 }
      ];
      mockSafeOperations.retrieveMemories.mockResolvedValueOnce(mockMemories);

      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_retrieve_memories').handler;

      const result = await handler({
        query: 'test query'
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'test query',
        0.7, // default threshold
        0    // default excludeLastN
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.memories).toEqual(mockMemories.slice(0, 10)); // default limit
    });

    it('should respect custom parameters', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_retrieve_memories').handler;

      await handler({
        query: 'custom query',
        threshold: 0.8,
        limit: 5,
        excludeLastN: 2
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'custom query',
        0.8,
        2
      );
    });

    it('should handle empty query', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_retrieve_memories').handler;

      const result = await handler({
        query: ''
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Query cannot be empty');
    });
  });

  describe('semem_generate_embedding Tool', () => {
    it('should generate embeddings for text', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_embedding').handler;

      const result = await handler({
        text: 'Sample text for embedding'
      });

      expect(mockSafeOperations.generateEmbedding).toHaveBeenCalledWith('Sample text for embedding');

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.embedding).toEqual(new Array(1536).fill(0.1));
      expect(content.embeddingLength).toBe(1536);
    });

    it('should handle empty text', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_embedding').handler;

      const result = await handler({
        text: ''
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Text cannot be empty');
    });
  });

  describe('semem_extract_concepts Tool', () => {
    it('should extract concepts from text', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_extract_concepts').handler;

      const result = await handler({
        text: 'Artificial intelligence and machine learning concepts'
      });

      expect(mockSafeOperations.extractConcepts).toHaveBeenCalledWith('Artificial intelligence and machine learning concepts');

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.concepts).toEqual(['concept1', 'concept2']);
      expect(content.conceptCount).toBe(2);
    });

    it('should handle concept extraction errors', async () => {
      mockSafeOperations.extractConcepts.mockRejectedValueOnce(new Error('Concept extraction failed'));

      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_extract_concepts').handler;

      const result = await handler({
        text: 'Test text'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Concept extraction failed');
    });
  });

  describe('semem_generate_response Tool', () => {
    it('should generate response without memory', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_response').handler;

      const result = await handler({
        prompt: 'What is the weather like?',
        useMemory: false,
        temperature: 0.7,
        maxTokens: 100
      });

      expect(mockSafeOperations.generateResponse).toHaveBeenCalledWith(
        'What is the weather like?',
        [],
        { temperature: 0.7, maxTokens: 100 }
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.response).toBe('Safe response');
      expect(content.retrievalCount).toBe(0);
    });

    it('should generate response with memory context', async () => {
      const mockMemories = [
        { prompt: 'Weather question', output: 'Weather response' }
      ];
      mockSafeOperations.retrieveMemories.mockResolvedValueOnce(mockMemories);

      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_response').handler;

      const result = await handler({
        prompt: 'What is the weather like?',
        useMemory: true
      });

      expect(mockSafeOperations.retrieveMemories).toHaveBeenCalledWith(
        'What is the weather like?',
        0.7,
        0
      );
      expect(mockSafeOperations.generateResponse).toHaveBeenCalledWith(
        'What is the weather like?',
        mockMemories.slice(0, 3), // Limited to 3 context items
        { temperature: 0.7, maxTokens: 500 }
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.retrievalCount).toBe(1);
    });

    it('should use default parameters', async () => {
      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_generate_response').handler;

      await handler({
        prompt: 'Test prompt'
      });

      expect(mockSafeOperations.generateResponse).toHaveBeenCalledWith(
        'Test prompt',
        [],
        { temperature: 0.7, maxTokens: 500 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle memory manager not available', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockReturnValueOnce(null);

      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction').handler;

      const result = await handler({
        prompt: 'Test prompt',
        response: 'Test response'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Memory manager not available');
    });

    it('should handle service initialization failure', async () => {
      const { initializeServices } = await import('../../../../mcp/lib/initialization.js');
      initializeServices.mockRejectedValueOnce(new Error('Service init failed'));

      registerMemoryTools(mockServer);
      const handler = mockServer.toolHandlers.get('semem_store_interaction').handler;

      const result = await handler({
        prompt: 'Test prompt',
        response: 'Test response'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Service init failed');
    });
  });
});