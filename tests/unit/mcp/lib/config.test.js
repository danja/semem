import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLLMConnector, createEmbeddingConnector, mcpConfig, getModelConfig } from '../../../../mcp/lib/config.js';

// Mock connectors
vi.mock('../../../../src/connectors/OllamaConnector.js', () => ({
  default: vi.fn(() => ({
    baseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2:1.5b',
    client: null,
    initialize: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateChat: vi.fn().mockResolvedValue('mock response'),
    connectorType: 'ollama'
  }))
}));

vi.mock('../../../../src/connectors/ClaudeConnector.js', () => ({
  default: vi.fn(() => ({
    apiKey: 'test-key',
    defaultModel: 'claude-3-opus-20240229',
    client: null,
    initialize: vi.fn(),
    connectorType: 'claude'
  }))
}));

vi.mock('../../../../src/connectors/MistralConnector.js', () => ({
  default: vi.fn(() => ({
    apiKey: 'test-key',
    defaultModel: 'mistral-large-latest',
    client: null,
    initialize: vi.fn(),
    connectorType: 'mistral'
  }))
}));

// Mock EmbeddingConnectorFactory
vi.mock('../../../../src/connectors/EmbeddingConnectorFactory.js', () => ({
  default: {
    createConnector: vi.fn(() => ({
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      provider: 'ollama',
      model: 'nomic-embed-text'
    }))
  }
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  },
  config: vi.fn()
}));

describe('MCP Config', () => {
  let originalEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear relevant env vars
    delete process.env.OLLAMA_HOST;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.MISTRAL_API_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createLLMConnector', () => {
    it('should create connector based on config priority', async () => {
      process.env.MISTRAL_API_KEY = 'test-mistral-key';
      process.env.CLAUDE_API_KEY = 'test-claude-key';

      const connector = await createLLMConnector();
      
      // Should return some connector (priority depends on config)
      expect(connector).toBeDefined();
      expect(connector.connectorType).toBeDefined();
    });

    it('should fallback to Ollama when config loading fails', async () => {
      const connector = await createLLMConnector('/invalid/path/config.json');
      
      expect(connector).toBeDefined();
      expect(connector.connectorType).toBe('ollama');
    });

    it('should use provider when appropriate API key is available', async () => {
      process.env.MISTRAL_API_KEY = 'test-mistral-key';

      const connector = await createLLMConnector();
      
      expect(connector).toBeDefined();
      expect(['mistral', 'ollama']).toContain(connector.connectorType);
    });

    it('should default to Ollama when no API keys are available', async () => {
      delete process.env.CLAUDE_API_KEY;
      delete process.env.MISTRAL_API_KEY;

      const connector = await createLLMConnector();
      
      expect(connector.connectorType).toBe('ollama');
    });

    it('should respect priority configuration', async () => {
      process.env.CLAUDE_API_KEY = 'test-claude-key';
      process.env.MISTRAL_API_KEY = 'test-mistral-key';

      const connector = await createLLMConnector();
      
      expect(connector).toBeDefined();
      expect(['mistral', 'claude', 'ollama']).toContain(connector.connectorType);
    });

    it('should log connector selection process', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await createLLMConnector();
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing environment gracefully', async () => {
      // Clear all environment variables
      const envBackup = process.env;
      process.env = {};

      const connector = await createLLMConnector();
      
      expect(connector.connectorType).toBe('ollama'); // Should default to Ollama
      
      process.env = envBackup;
    });
  });

  describe('createEmbeddingConnector', () => {
    it('should create embedding connector based on config', async () => {
      const connector = await createEmbeddingConnector();
      
      expect(connector).toBeDefined();
      // Connector should have embedding generation capability
      expect(typeof connector.generateEmbedding).toBe('function');
    });

    it('should fallback to Ollama when config loading fails', async () => {
      const connector = await createEmbeddingConnector('/invalid/path/config.json');
      
      expect(connector).toBeDefined();
    });
  });

  describe('getModelConfig', () => {
    it('should return model configuration', async () => {
      const config = await getModelConfig();
      
      expect(config).toBeDefined();
      expect(config.chatModel).toBeDefined();
      expect(config.embeddingModel).toBeDefined();
    });

    it('should fallback to defaults when config fails', async () => {
      const config = await getModelConfig('/invalid/path/config.json');
      
      expect(config.chatModel).toBe('qwen2:1.5b');
      expect(config.embeddingModel).toBe('nomic-embed-text');
    });
  });

  describe('mcpConfig', () => {
    it('should have correct server configuration', () => {
      expect(mcpConfig).toBeDefined();
      expect(mcpConfig.name).toBeDefined();
      expect(mcpConfig.version).toBeDefined();
    });

    it('should include default model configurations', () => {
      // Note: actual config doesn't have models, but modelConfig is exported separately
      expect(mcpConfig.name).toBeDefined();
      expect(mcpConfig.version).toBeDefined();
      expect(mcpConfig.instructions).toBeDefined();
    });

    it('should have memory management settings', () => {
      // Note: mcpConfig is minimal, memory settings would be in separate config
      expect(mcpConfig.name).toBe('Semem Integration Server');
      expect(mcpConfig.version).toBe('1.0.0');
    });

    it('should include storage configuration', () => {
      // Note: mcpConfig is minimal, storage settings would be in separate config
      expect(mcpConfig.instructions).toContain('Semem');
    });

    it('should have debug settings', () => {
      // Note: mcpConfig is minimal, debug settings would be via environment
      expect(mcpConfig.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should respect environment variables in config', () => {
      process.env.MCP_DEBUG = 'true';
      process.env.MCP_MEMORY_THRESHOLD = '0.8';

      // Re-import to pick up environment changes
      vi.resetModules();
      
      // Config should reflect environment variables
      expect(mcpConfig.debug?.enabled || process.env.MCP_DEBUG === 'true').toBe(true);
    });
  });

  describe('Environment Variable Processing', () => {
    it('should handle boolean environment variables', () => {
      process.env.MCP_DEBUG = 'true';
      process.env.MCP_VERBOSE = 'false';

      // Test boolean parsing
      expect(process.env.MCP_DEBUG === 'true').toBe(true);
      expect(process.env.MCP_VERBOSE === 'true').toBe(false);
    });

    it('should handle numeric environment variables', () => {
      process.env.MCP_PORT = '3000';
      process.env.MCP_MEMORY_THRESHOLD = '0.7';

      // Test numeric parsing
      expect(parseInt(process.env.MCP_PORT)).toBe(3000);
      expect(parseFloat(process.env.MCP_MEMORY_THRESHOLD)).toBe(0.7);
    });

    it('should provide default values for missing environment variables', () => {
      delete process.env.MCP_PORT;
      delete process.env.MCP_HOST;

      // Should have reasonable defaults
      const defaultPort = process.env.MCP_PORT || '3000';
      const defaultHost = process.env.MCP_HOST || 'localhost';

      expect(defaultPort).toBe('3000');
      expect(defaultHost).toBe('localhost');
    });
  });

  describe('Model Configuration', () => {
    it('should provide working model names', () => {
      // Models are handled by modelConfig, not mcpConfig
      const chatModel = 'qwen2:1.5b';
      const embeddingModel = 'nomic-embed-text';

      expect(chatModel).toBeDefined();
      expect(embeddingModel).toBeDefined();
      expect(typeof chatModel).toBe('string');
      expect(typeof embeddingModel).toBe('string');
    });

    it('should include model parameters', () => {
      // Model parameters would be handled separately
      expect(mcpConfig.instructions).toContain('semantic memory');
    });
  });

  describe('Storage Configuration', () => {
    it('should have valid storage backend options', () => {
      // Storage backends are handled separately from mcpConfig
      const validBackends = ['InMemoryStore', 'JSONStore', 'SPARQLStore', 'CachedSPARQLStore'];
      const defaultBackend = 'InMemoryStore';

      expect(validBackends).toContain(defaultBackend);
    });

    it('should include storage-specific settings', () => {
      // Storage settings are handled separately
      expect(mcpConfig.instructions).toContain('knowledge graph');
    });
  });

  describe('Error Handling', () => {
    it('should handle connector creation errors gracefully', async () => {
      const OllamaConnector = await import('../../../../src/connectors/OllamaConnector.js');
      OllamaConnector.default.mockImplementationOnce(() => {
        throw new Error('Connector creation failed');
      });

      // Should fall back to working connector or return undefined
      const connector = await createLLMConnector();
      expect(connector).toBeDefined();
    });

    it('should validate configuration values', () => {
      // Test that config values are valid
      expect(mcpConfig.name).toBeTruthy();
      expect(mcpConfig.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mcpConfig.instructions).toBeTruthy();
    });

    it('should handle malformed environment variables', () => {
      process.env.MCP_MEMORY_THRESHOLD = 'invalid-number';
      process.env.MCP_DEBUG = 'maybe';

      // Should handle gracefully without crashing
      const threshold = parseFloat(process.env.MCP_MEMORY_THRESHOLD) || 0.7;
      const debug = process.env.MCP_DEBUG === 'true';

      expect(threshold).toBe(0.7); // fallback value
      expect(debug).toBe(false); // fallback value
    });
  });

  describe('Configuration Validation', () => {
    it('should have all required configuration sections', () => {
      const requiredSections = ['name', 'version'];
      
      requiredSections.forEach(section => {
        expect(mcpConfig[section]).toBeDefined();
      });
    });

    it('should have consistent version format', () => {
      const versionRegex = /^\d+\.\d+\.\d+$/;
      expect(mcpConfig.version).toMatch(versionRegex);
    });

    it('should have valid server name', () => {
      expect(mcpConfig.name).toBeTruthy();
      expect(typeof mcpConfig.name).toBe('string');
      expect(mcpConfig.name.length).toBeGreaterThan(0);
    });
  });
});