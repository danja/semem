/**
 * Centralized mock creation utilities
 */
import { vi } from 'vitest';

export class MockFactory {
  static createLLMConnectorMock() {
    return {
      generateResponse: vi.fn().mockResolvedValue('Generated response'),
      generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0).map(() => Math.random())),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
      isAvailable: vi.fn().mockResolvedValue(true),
      dispose: vi.fn()
    };
  }

  static createEmbeddingConnectorMock() {
    return {
      generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0).map(() => Math.random())),
      generateBatchEmbeddings: vi.fn().mockResolvedValue([
        Array(1536).fill(0).map(() => Math.random()),
        Array(1536).fill(0).map(() => Math.random())
      ]),
      isAvailable: vi.fn().mockResolvedValue(true),
      dispose: vi.fn()
    };
  }

  static createStoreMock() {
    const store = new Map();
    return {
      store: vi.fn().mockImplementation((data) => {
        const id = data.id || `test-${Date.now()}`;
        store.set(id, data);
        return Promise.resolve(id);
      }),
      search: vi.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(store.values()).slice(0, 5));
      }),
      retrieve: vi.fn().mockImplementation((id) => {
        return Promise.resolve(store.get(id) || null);
      }),
      dispose: vi.fn(),
      clear: vi.fn().mockImplementation(() => {
        store.clear();
        return Promise.resolve();
      })
    };
  }

  static createSPARQLStoreMock() {
    const data = new Map();
    return {
      store: vi.fn().mockImplementation((item) => {
        const id = item.id || `sparql-${Date.now()}`;
        data.set(id, item);
        return Promise.resolve(id);
      }),
      search: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(true),
      isConnected: vi.fn().mockResolvedValue(true),
      dispose: vi.fn()
    };
  }

  static createMemoryManagerMock() {
    return {
      addInteraction: vi.fn().mockResolvedValue('interaction-id'),
      retrieveInteractions: vi.fn().mockResolvedValue([]),
      generateResponse: vi.fn().mockResolvedValue('Generated response'),
      getStats: vi.fn().mockResolvedValue({
        totalInteractions: 0,
        memoryUsage: '0MB'
      }),
      dispose: vi.fn()
    };
  }

  static createLLMHandlerMock() {
    return {
      generateResponse: vi.fn().mockResolvedValue('Generated response'),
      extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
      summarize: vi.fn().mockResolvedValue('Summary'),
      dispose: vi.fn()
    };
  }

  static createEmbeddingHandlerMock() {
    return {
      generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0).map(() => Math.random())),
      generateBatchEmbeddings: vi.fn().mockResolvedValue([
        Array(1536).fill(0).map(() => Math.random()),
        Array(1536).fill(0).map(() => Math.random())
      ]),
      dispose: vi.fn()
    };
  }

  static createConfigMock() {
    return {
      get: vi.fn().mockImplementation((path) => {
        const config = {
          'storage.type': 'memory',
          'models.chat.model': 'qwen2:1.5b',
          'models.embedding.model': 'nomic-embed-text',
          'memory.dimension': 1536,
          'sparqlEndpoints': [],
          'llmProviders': []
        };
        return config[path];
      }),
      init: vi.fn().mockResolvedValue(true),
      dispose: vi.fn()
    };
  }

  static createHTTPServerMock() {
    return {
      start: vi.fn().mockResolvedValue(true),
      stop: vi.fn().mockResolvedValue(true),
      isRunning: vi.fn().mockReturnValue(false),
      getPort: vi.fn().mockReturnValue(3000),
      getUrl: vi.fn().mockReturnValue('http://localhost:3000')
    };
  }

  static createWSServerMock() {
    return {
      start: vi.fn().mockResolvedValue(true),
      stop: vi.fn().mockResolvedValue(true),
      broadcast: vi.fn(),
      getConnectedClients: vi.fn().mockReturnValue(0)
    };
  }

  static createAPIRegistryMock() {
    return {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      list: vi.fn().mockReturnValue([]),
      dispose: vi.fn()
    };
  }

  // Utility method to reset all mocks
  static resetAllMocks(...mocks) {
    mocks.forEach(mock => {
      Object.values(mock).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockReset();
        }
      });
    });
  }
}

export default MockFactory;