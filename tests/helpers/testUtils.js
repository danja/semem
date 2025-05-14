import { EventEmitter } from 'events';

/**
 * Test utilities for Vitest tests
 */
export const testUtils = {
  /**
   * Creates a mock LLM provider for testing
   */
  createMockLLMProvider() {
    return {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
      generateChat: vi.fn().mockResolvedValue('test response'),
      generateCompletion: vi.fn().mockResolvedValue('["test"]')
    };
  },

  /**
   * Creates a mock storage for testing
   */
  createMockStore() {
    return {
      loadHistory: vi.fn().mockResolvedValue([[], []]),
      saveMemoryToHistory: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue(),
      beginTransaction: vi.fn().mockResolvedValue(),
      commitTransaction: vi.fn().mockResolvedValue(),
      rollbackTransaction: vi.fn().mockResolvedValue()
    };
  },

  /**
   * Creates a mock SPARQL service
   */
  createMockSPARQLService() {
    return {
      executeQuery: vi.fn().mockResolvedValue({
        results: { bindings: [] }
      }),
      executeUpdate: vi.fn().mockResolvedValue({}),
      graphExists: vi.fn().mockResolvedValue(true),
      storeEmbedding: vi.fn().mockResolvedValue(true),
      fetchResourcesWithEmbeddings: vi.fn().mockResolvedValue([])
    };
  },

  /**
   * Creates a mock EmbeddingService
   */
  createMockEmbeddingService() {
    return {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0)),
      validateEmbedding: vi.fn().mockReturnValue(true),
      standardizeEmbedding: vi.fn().mockImplementation(emb => emb)
    };
  },

  /**
   * Creates a mock event emitter
   */
  createMockEventEmitter() {
    const emitter = new EventEmitter();
    vi.spyOn(emitter, 'emit');
    vi.spyOn(emitter, 'on');
    return emitter;
  },

  /**
   * Simulates a network error
   */
  simulateNetworkError() {
    return Promise.reject(new Error('Network error'));
  },

  /**
   * Simulates a timeout error
   */
  simulateTimeoutError() {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 100)
    );
  },

  /**
   * Isolates and mocks a method temporarily
   */
  isolateMethod(object, method, mock) {
    const original = object[method];
    object[method] = mock;
    return () => { object[method] = original; };
  },

  /**
   * Wraps a promise to catch errors
   */
  async wrapPromise(promise) {
    try {
      const value = await promise;
      return { success: true, value };
    } catch (error) {
      return { success: false, error };
    }
  },

  /**
   * Custom matcher to check if a value is within a range
   */
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  /**
   * Custom matcher to check if a spy was called with an error
   */
  toHaveBeenCalledWithError(received, expectedErrorMessage) {
    const calls = received.mock.calls;
    const pass = calls.some(call => 
      call.some(arg => 
        arg instanceof Error && 
        (!expectedErrorMessage || arg.message.includes(expectedErrorMessage))
      )
    );
    
    if (pass) {
      return {
        message: () => `expected spy not to have been called with error ${expectedErrorMessage || 'any'}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected spy to have been called with error ${expectedErrorMessage || 'any'}`,
        pass: false,
      };
    }
  }
};

// Add custom matchers to extend Vitest's expect
expect.extend({
  toBeWithinRange: testUtils.toBeWithinRange,
  toHaveBeenCalledWithError: testUtils.toHaveBeenCalledWithError
});