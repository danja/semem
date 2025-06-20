import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  initializeServices, 
  getMemoryManager, 
  getConfig, 
  isInitialized 
} from '../../../../mcp/lib/initialization.js';

// Mock dependencies
vi.mock('../../../../src/MemoryManager.js', () => ({
  default: vi.fn().mockImplementation(() => mockMemoryManager)
}));

vi.mock('../../../../src/Config.js', () => ({
  default: vi.fn().mockImplementation(() => mockConfig)
}));

vi.mock('../../../../mcp/lib/config.js', () => ({
  createLLMConnector: vi.fn(() => mockLLMConnector)
}));

// Mock objects
const mockMemoryManager = {
  initialize: vi.fn().mockResolvedValue(true),
  dispose: vi.fn().mockResolvedValue(true),
  isReady: true,
  version: '1.0.0'
};

const mockConfig = {
  init: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockReturnValue('default-value'),
  isLoaded: true
};

const mockLLMConnector = {
  type: 'ollama',
  initialize: vi.fn().mockResolvedValue(true)
};

describe('MCP Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset global state
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeServices', () => {
    it('should initialize all services successfully', async () => {
      const result = await initializeServices();

      expect(result).toBe(true);
      expect(mockConfig.init).toHaveBeenCalled();
      expect(mockMemoryManager.initialize).toHaveBeenCalled();
    });

    it('should create memory manager with correct configuration', async () => {
      const MemoryManager = await import('../../../../src/MemoryManager.js');
      
      await initializeServices();

      expect(MemoryManager.default).toHaveBeenCalledWith(expect.objectContaining({
        llmProvider: mockLLMConnector,
        chatModel: expect.any(String),
        embeddingModel: expect.any(String),
        storage: null
      }));
    });

    it('should handle config initialization failure', async () => {
      mockConfig.init.mockRejectedValueOnce(new Error('Config init failed'));

      await expect(initializeServices()).rejects.toThrow('Config init failed');
    });

    it('should handle memory manager initialization failure', async () => {
      mockMemoryManager.initialize.mockRejectedValueOnce(new Error('MemoryManager init failed'));

      await expect(initializeServices()).rejects.toThrow('MemoryManager init failed');
    });

    it('should handle LLM connector creation failure', async () => {
      const { createLLMConnector } = await import('../../../../mcp/lib/config.js');
      createLLMConnector.mockImplementationOnce(() => {
        throw new Error('LLM connector creation failed');
      });

      await expect(initializeServices()).rejects.toThrow('LLM connector creation failed');
    });

    it('should initialize services only once', async () => {
      await initializeServices();
      await initializeServices(); // Second call

      // Should only initialize once
      expect(mockConfig.init).toHaveBeenCalledTimes(1);
      expect(mockMemoryManager.initialize).toHaveBeenCalledTimes(1);
    });

    it('should use correct model names', async () => {
      const MemoryManager = await import('../../../../src/MemoryManager.js');
      
      await initializeServices();

      const constructorCall = MemoryManager.default.mock.calls[0][0];
      expect(constructorCall.chatModel).toBe('qwen2:1.5b');
      expect(constructorCall.embeddingModel).toBe('nomic-embed-text');
    });

    it('should set storage to null for default in-memory', async () => {
      const MemoryManager = await import('../../../../src/MemoryManager.js');
      
      await initializeServices();

      const constructorCall = MemoryManager.default.mock.calls[0][0];
      expect(constructorCall.storage).toBeNull();
    });
  });

  describe('getMemoryManager', () => {
    it('should return null before initialization', () => {
      const manager = getMemoryManager();
      expect(manager).toBeNull();
    });

    it('should return memory manager after initialization', async () => {
      await initializeServices();
      
      const manager = getMemoryManager();
      expect(manager).toBe(mockMemoryManager);
    });

    it('should return the same instance on multiple calls', async () => {
      await initializeServices();
      
      const manager1 = getMemoryManager();
      const manager2 = getMemoryManager();
      
      expect(manager1).toBe(manager2);
      expect(manager1).toBe(mockMemoryManager);
    });

    it('should handle disposed memory manager', async () => {
      await initializeServices();
      
      // Simulate disposal
      mockMemoryManager.isReady = false;
      
      const manager = getMemoryManager();
      expect(manager).toBe(mockMemoryManager); // Still returns the instance
    });
  });

  describe('getConfig', () => {
    it('should return null before initialization', () => {
      const config = getConfig();
      expect(config).toBeNull();
    });

    it('should return config after initialization', async () => {
      await initializeServices();
      
      const config = getConfig();
      expect(config).toBe(mockConfig);
    });

    it('should return the same instance on multiple calls', async () => {
      await initializeServices();
      
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
      expect(config1).toBe(mockConfig);
    });

    it('should provide access to config methods', async () => {
      await initializeServices();
      
      const config = getConfig();
      const value = config.get('test-key');
      
      expect(mockConfig.get).toHaveBeenCalledWith('test-key');
      expect(value).toBe('default-value');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(isInitialized()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await initializeServices();
      
      expect(isInitialized()).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      mockConfig.init.mockRejectedValueOnce(new Error('Init failed'));
      
      try {
        await initializeServices();
      } catch (error) {
        // Expected to fail
      }
      
      expect(isInitialized()).toBe(false);
    });

    it('should remain true after multiple successful initializations', async () => {
      await initializeServices();
      await initializeServices(); // Second call
      
      expect(isInitialized()).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial initialization failure', async () => {
      mockMemoryManager.initialize.mockRejectedValueOnce(new Error('Memory init failed'));
      
      await expect(initializeServices()).rejects.toThrow('Memory init failed');
      
      expect(isInitialized()).toBe(false);
      expect(getMemoryManager()).toBeNull();
      expect(getConfig()).toBeNull();
    });

    it('should allow re-initialization after failure', async () => {
      // First attempt fails
      mockConfig.init.mockRejectedValueOnce(new Error('First attempt failed'));
      
      await expect(initializeServices()).rejects.toThrow('First attempt failed');
      expect(isInitialized()).toBe(false);
      
      // Second attempt succeeds
      mockConfig.init.mockResolvedValueOnce(true);
      
      await initializeServices();
      expect(isInitialized()).toBe(true);
      expect(getConfig()).toBe(mockConfig);
    });

    it('should clean up partial state on failure', async () => {
      // Config succeeds, but memory manager fails
      mockMemoryManager.initialize.mockRejectedValueOnce(new Error('Memory failed'));
      
      await expect(initializeServices()).rejects.toThrow('Memory failed');
      
      // State should be clean
      expect(getMemoryManager()).toBeNull();
      expect(getConfig()).toBeNull();
      expect(isInitialized()).toBe(false);
    });
  });

  describe('Concurrent Initialization', () => {
    it('should handle concurrent initialization calls', async () => {
      const promise1 = initializeServices();
      const promise2 = initializeServices();
      const promise3 = initializeServices();
      
      const results = await Promise.all([promise1, promise2, promise3]);
      
      expect(results).toEqual([true, true, true]);
      expect(mockConfig.init).toHaveBeenCalledTimes(1);
      expect(mockMemoryManager.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed success/failure concurrent calls', async () => {
      mockConfig.init.mockRejectedValueOnce(new Error('Concurrent failure'));
      
      const promise1 = initializeServices();
      const promise2 = initializeServices();
      
      await expect(Promise.all([promise1, promise2])).rejects.toThrow('Concurrent failure');
      
      expect(isInitialized()).toBe(false);
    });
  });

  describe('Service Dependencies', () => {
    it('should initialize config before memory manager', async () => {
      const initOrder = [];
      
      mockConfig.init.mockImplementationOnce(async () => {
        initOrder.push('config');
        return true;
      });
      
      mockMemoryManager.initialize.mockImplementationOnce(async () => {
        initOrder.push('memory');
        return true;
      });
      
      await initializeServices();
      
      expect(initOrder).toEqual(['config', 'memory']);
    });

    it('should pass correct configuration to memory manager', async () => {
      const MemoryManager = await import('../../../../src/MemoryManager.js');
      
      await initializeServices();
      
      const constructorArgs = MemoryManager.default.mock.calls[0][0];
      expect(constructorArgs).toHaveProperty('llmProvider');
      expect(constructorArgs).toHaveProperty('chatModel');
      expect(constructorArgs).toHaveProperty('embeddingModel');
      expect(constructorArgs).toHaveProperty('storage');
    });

    it('should validate LLM connector before using', async () => {
      const invalidConnector = null;
      const { createLLMConnector } = await import('../../../../mcp/lib/config.js');
      createLLMConnector.mockReturnValueOnce(invalidConnector);
      
      await expect(initializeServices()).rejects.toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment-specific configuration', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      await initializeServices();
      
      const Config = await import('../../../../src/Config.js');
      expect(Config.default).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle missing config file gracefully', async () => {
      const Config = await import('../../../../src/Config.js');
      Config.default.mockImplementationOnce(() => {
        throw new Error('Config file not found');
      });
      
      await expect(initializeServices()).rejects.toThrow('Config file not found');
    });
  });
});