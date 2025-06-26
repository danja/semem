import { vi, expect, Mock, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';

// Types for mocks
type MockLLMProvider = {
  generateEmbedding: Mock;
  generateChat: Mock;
  generateCompletion: Mock;
};

type MockStore = {
  loadHistory: Mock;
  saveMemoryToHistory: Mock;
  close: Mock;
  beginTransaction: Mock;
  commitTransaction: Mock;
  rollbackTransaction: Mock;
};

type MockSPARQLService = {
  executeQuery: Mock;
  executeUpdate: Mock;
  graphExists: Mock;
  storeEmbedding: Mock;
  fetchResourcesWithEmbeddings: Mock;
};

/**
 * Test utilities for Vitest tests with TypeScript support
 */
export const testUtils = {
  /**
   * Creates a mock LLM provider for testing
   */
  createMockLLMProvider(): MockLLMProvider {
    return {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
      generateChat: vi.fn().mockResolvedValue('test response'),
      generateCompletion: vi.fn().mockResolvedValue('["test"]'),
    };
  },

  /**
   * Creates a mock storage for testing
   */
  createMockStore(): MockStore {
    return {
      loadHistory: vi.fn().mockResolvedValue([[], []]),
      saveMemoryToHistory: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };
  },

  /**
   * Creates a mock SPARQL service
   */
  createMockSPARQLService(): MockSPARQLService {
    return {
      executeQuery: vi.fn().mockResolvedValue({
        results: { bindings: [] },
      }),
      executeUpdate: vi.fn().mockResolvedValue({}),
      graphExists: vi.fn().mockResolvedValue(true),
      storeEmbedding: vi.fn().mockResolvedValue(true),
      fetchResourcesWithEmbeddings: vi.fn().mockResolvedValue([]),
    };
  },

  /**
   * Creates a mock event emitter
   */
  createMockEventEmitter(): EventEmitter {
    const emitter = new EventEmitter();
    vi.spyOn(emitter, 'on');
    vi.spyOn(emitter, 'emit');
    vi.spyOn(emitter, 'removeListener');
    return emitter;
  },

  /**
   * Simulates a network error
   */
  simulateNetworkError(): Error {
    return new Error('Network error: Failed to fetch');
  },

  /**
   * Simulates a timeout error
   */
  simulateTimeoutError(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 100);
    });
  },

  /**
   * Isolates and mocks a method temporarily
   */
  isolateMethod<T extends object, K extends keyof T>(
    object: T,
    method: K,
    mock: T[K] extends (...args: any[]) => any ? jest.Mock : T[K]
  ): () => void {
    const original = object[method];
    object[method] = mock as T[K];
    return () => {
      object[method] = original;
    };
  },

  /**
   * Wraps a promise to catch errors
   */
  async wrapPromise<T>(promise: Promise<T>): Promise<[T | null, any]> {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      return [null, error];
    }
  },

  /**
   * Custom matcher to check if a value is within a range
   */
  toBeWithinRange(
    received: number,
    floor: number,
    ceiling: number
  ): { pass: boolean; message: () => string } {
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
  toHaveBeenCalledWithError(
    received: jest.Mock,
    expectedErrorMessage: string | RegExp
  ): { pass: boolean; message: () => string } {
    const calls = received.mock.calls;
    const errorMatch = calls.some(args =>
      args.some(
        arg =>
          arg instanceof Error &&
          (typeof expectedErrorMessage === 'string'
            ? arg.message.includes(expectedErrorMessage)
            : expectedErrorMessage.test(arg.message))
      )
    );

    if (errorMatch) {
      return {
        message: () =>
          `expected spy not to have been called with an error matching ${expectedErrorMessage}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected spy to have been called with an error matching ${expectedErrorMessage}.\n` +
          `Received calls: ${JSON.stringify(calls, null, 2)}`,
        pass: false,
      };
    }
  },
};

// Extend Vitest's expect with custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeWithinRange(floor: number, ceiling: number): T;
      toHaveBeenCalledWithError(expected: string | RegExp): T;
    }
  }
}

expect.extend({
  toBeWithinRange: testUtils.toBeWithinRange,
  toHaveBeenCalledWithError: testUtils.toHaveBeenCalledWithError,
});

export type { MockLLMProvider, MockStore, MockSPARQLService };
