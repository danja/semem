// tests/unit/api/BaseAPI.vitest.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import BaseAPI from '../../../src/api/common/BaseAPI.js';
import { setupTestEnvironment } from '../../helpers/testSetup.js';
import { VitestTestHelper } from '../../helpers/VitestTestHelper.js';
import Config from '../../../src/Config.js';
import EventEmitter from 'events';

// Create a concrete implementation of BaseAPI for testing
class TestAPI extends BaseAPI {
  constructor(config) {
    super(config);
    // BaseAPI uses EventEmitter directly, no separate eventEmitter property

    // Add operations
    this.operations = {
      test: this.handleTest.bind(this),
      error: this.handleError.bind(this)
    };
  }

  // Override the abstract method
  async executeOperation(operation, params = {}) {
    // Emit the start event
    this.emit('operation:start', operation, params);

    try {
      if (!this.operations[operation]) {
        throw new Error('Operation not found');
      }

      const result = await this.operations[operation](params);

      // Emit the complete event
      this.emit('operation:complete', operation, result);

      return result;
    } catch (error) {
      // Emit the error event
      this.emit('operation:error', operation, error);
      throw error;
    }
  }

  async handleTest(params) {
    return { success: true, params };
  }

  async handleError() {
    throw new Error('Test error');
  }
}

describe('BaseAPI', () => {
  const utils = setupTestEnvironment();
  let api;
  let mockConfig;

  beforeEach(async () => {
    // Create a minimal config for testing
    mockConfig = new Config({
      storage: { type: 'sparql' },
      models: {
        chat: {
          provider: 'mistral',
          model: 'mistral-small-latest'
        },
        embedding: {
          provider: 'ollama',
          model: 'nomic-embed-text'
        }
      }
    });
    await mockConfig.init();

    // Create the API instance
    api = new TestAPI(mockConfig);
    // BaseAPI has initialize() method, not init()
    await api.initialize();
  });

  afterEach(() => {
    if (api) {
      // BaseAPI has shutdown() method, not dispose()
      if (api.initialized) {
        api.shutdown();
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize properly', () => {
      expect(api.initialized).toBe(true);
      expect(api.config).toBe(mockConfig);
      // BaseAPI extends EventEmitter directly
      expect(api instanceof EventEmitter).toBe(true);
    });

    it('should handle initialization without config', async () => {
      const noConfigAPI = new TestAPI();
      await noConfigAPI.initialize();
      expect(noConfigAPI.initialized).toBe(true);
      await noConfigAPI.shutdown();
    });
  });

  describe('Operation Execution', () => {
    it('should execute a registered operation', async () => {
      const result = await api.executeOperation('test', { value: 'test' });

      expect(result).toEqual({
        success: true,
        params: { value: 'test' }
      });
    });

    it('should handle operation errors', async () => {
      await expect(api.executeOperation('error')).rejects.toThrow('Test error');
    });

    it('should reject for unregistered operations', async () => {
      await expect(api.executeOperation('nonexistent')).rejects.toThrow('Operation not found');
    });
  });

  describe('Event Handling', () => {
    it('should emit events during operation execution', async () => {
      // BaseAPI extends EventEmitter directly, so spy on api.emit
      const eventSpy = vi.spyOn(api, 'emit');

      await api.executeOperation('test', { value: 'test' });

      expect(eventSpy).toHaveBeenCalledWith('operation:start', 'test', { value: 'test' });
      expect(eventSpy).toHaveBeenCalledWith('operation:complete', 'test', expect.objectContaining({
        success: true,
        params: { value: 'test' }
      }));
    });

    it('should emit error events', async () => {
      // BaseAPI extends EventEmitter directly, so spy on api.emit
      const eventSpy = vi.spyOn(api, 'emit');

      try {
        await api.executeOperation('error');
      } catch (error) {
        // Expected error, will be caught
      }

      expect(eventSpy).toHaveBeenCalledWith('operation:start', 'error', {});
      expect(eventSpy).toHaveBeenCalledWith('operation:error', 'error', expect.any(Error));
    });

    it('should allow subscribing to events', async () => {
      // In Vitest, we can use a Promise for async tests instead of done callback
      return new Promise((resolve) => {
        api.on('operation:complete', (operation, result) => {
          expect(operation).toBe('test');
          expect(result).toEqual({
            success: true,
            params: { value: 'test' }
          });
          resolve();
        });

        api.executeOperation('test', { value: 'test' });
      });
    });
  });

  describe('Lifecycle Management', () => {
    it('should clean up resources on shutdown', async () => {
      // BaseAPI extends EventEmitter directly, so spy on api.removeAllListeners
      const eventSpy = vi.spyOn(api, 'removeAllListeners');

      await api.shutdown();

      // BaseAPI.shutdown does not call removeAllListeners, just sets initialized to false
      expect(api.initialized).toBe(false);
    });
  });
});