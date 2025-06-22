import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('loglevel', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn()
  }
}));

vi.mock('dotenv', () => ({
  config: vi.fn()
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    dirname: vi.fn().mockReturnValue('/mock/path'),
    resolve: vi.fn().mockImplementation((...args) => args.join('/')),
    join: vi.fn().mockImplementation((...args) => args.join('/'))
  }
}));

vi.mock('url', () => ({
  fileURLToPath: vi.fn().mockReturnValue('/mock/path/ui-server.js')
}));

vi.mock('../../../src/services/search/UIServer.js', () => ({
  default: class MockUIServer {
    constructor(config) {
      this.config = config;
      this.server = null;
      this.start = vi.fn().mockResolvedValue();
      this.stop = vi.fn().mockResolvedValue();
    }
  }
}));

describe('ui-server.js', () => {
  let originalEnv;
  let originalArgv;
  let originalConsoleLog;
  let originalConsoleError;
  let originalProcessExit;

  beforeEach(() => {
    // Store original values
    originalEnv = process.env;
    originalArgv = process.argv;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    // Mock environment variables
    process.env = {
      ...originalEnv,
      LOG_LEVEL: 'info',
      PORT: '4120',
      GRAPH_NAME: 'http://test-graph',
      CHAT_MODEL: 'test-chat',
      EMBEDDING_MODEL: 'test-embedding'
    };

    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();

    // Mock process.exit
    process.exit = vi.fn();

    // Mock process signal handlers
    vi.spyOn(process, 'on').mockImplementation(() => {});

    // Clear module cache
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    process.argv = originalArgv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;

    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Environment Configuration', () => {
    it('should use environment variables for configuration', async () => {
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 4120,
          graphName: 'http://test-graph',
          chatModel: 'test-chat',
          embeddingModel: 'test-embedding'
        })
      );
    });

    it('should use default values when environment variables are not set', async () => {
      // Remove environment variables
      delete process.env.PORT;
      delete process.env.GRAPH_NAME;
      delete process.env.CHAT_MODEL;
      delete process.env.EMBEDDING_MODEL;

      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 4120, // Default port
          graphName: 'http://danny.ayers.name/content', // Default graph
          chatModel: 'qwen2:1.5b', // Default chat model
          embeddingModel: 'nomic-embed-text' // Default embedding model
        })
      );
    });

    it('should parse PORT environment variable as integer', async () => {
      process.env.PORT = '5000';
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5000
        })
      );
    });
  });

  describe('Configuration File Loading', () => {
    it('should load configuration from file when provided as argument', async () => {
      process.argv = ['node', 'ui-server.js', 'test-config.json'];
      
      const mockConfig = {
        port: 3000,
        customSetting: 'test'
      };
      
      fs.default.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(fs.default.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-config.json'),
        'utf8'
      );
      
      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3000,
          customSetting: 'test'
        })
      );
    });

    it('should load configuration from CONFIG_FILE environment variable', async () => {
      process.env.CONFIG_FILE = 'env-config.json';
      
      const mockConfig = {
        port: 3500,
        envSetting: 'test'
      };
      
      fs.default.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(fs.default.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('env-config.json'),
        'utf8'
      );
      
      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3500,
          envSetting: 'test'
        })
      );
    });

    it('should handle config file loading errors gracefully', async () => {
      process.argv = ['node', 'ui-server.js', 'nonexistent-config.json'];
      
      fs.default.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load configuration file: File not found')
      );
      
      // Should still create UIServer with default config
      expect(UIServer).toHaveBeenCalled();
    });

    it('should handle invalid JSON in config file', async () => {
      process.argv = ['node', 'ui-server.js', 'invalid-config.json'];
      
      fs.default.readFileSync.mockReturnValue('{ invalid json }');
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load configuration file:')
      );
    });
  });

  describe('SPARQL Endpoints Configuration', () => {
    it('should parse SPARQL_ENDPOINTS from environment', async () => {
      const sparqlEndpoints = [
        { endpoint: 'http://localhost:3030/test/query' }
      ];
      
      process.env.SPARQL_ENDPOINTS = JSON.stringify(sparqlEndpoints);
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          sparqlEndpoints
        })
      );
    });

    it('should handle invalid SPARQL_ENDPOINTS JSON', async () => {
      process.env.SPARQL_ENDPOINTS = '{ invalid json }';
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse SPARQL_ENDPOINTS:')
      );
    });
  });

  describe('LLM Providers Configuration', () => {
    it('should parse LLM_PROVIDERS from environment', async () => {
      const llmProviders = [
        { type: 'ollama', baseUrl: 'http://localhost:11434' }
      ];
      
      process.env.LLM_PROVIDERS = JSON.stringify(llmProviders);
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          llmProviders
        })
      );
    });

    it('should handle invalid LLM_PROVIDERS JSON', async () => {
      process.env.LLM_PROVIDERS = '{ invalid json }';
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse LLM_PROVIDERS:')
      );
    });
  });

  describe('Server Lifecycle', () => {
    it('should create and start UIServer', async () => {
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalled();
      
      // Get the created instance
      const serverInstance = UIServer.mock.results[0].value;
      expect(serverInstance.start).toHaveBeenCalled();
    });

    it('should log configuration before starting', async () => {
      await import('../../../src/servers/ui-server.js');

      expect(console.log).toHaveBeenCalledWith(
        'Using configuration:',
        expect.any(Object)
      );
    });

    it('should log startup message', async () => {
      await import('../../../src/servers/ui-server.js');

      expect(console.log).toHaveBeenCalledWith('Starting UI Server...');
    });

    it('should handle server startup failure', async () => {
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      // Mock start method to reject
      UIServer.mockImplementation(() => ({
        start: vi.fn().mockRejectedValue(new Error('Server start failed')),
        stop: vi.fn()
      }));
      
      await import('../../../src/servers/ui-server.js');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(console.error).toHaveBeenCalledWith(
        'Failed to start server:',
        expect.any(Error)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Signal Handling', () => {
    it('should handle SIGTERM signal', async () => {
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      // Verify SIGTERM handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      // Get the SIGTERM handler
      const sigTermHandler = process.on.mock.calls.find(
        call => call[0] === 'SIGTERM'
      )[1];

      // Get the server instance
      const serverInstance = UIServer.mock.results[0].value;

      // Execute the handler
      await sigTermHandler();

      expect(console.log).toHaveBeenCalledWith('Received SIGTERM, shutting down...');
      expect(serverInstance.stop).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal', async () => {
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      // Verify SIGINT handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Get the SIGINT handler
      const sigIntHandler = process.on.mock.calls.find(
        call => call[0] === 'SIGINT'
      )[1];

      // Get the server instance
      const serverInstance = UIServer.mock.results[0].value;

      // Execute the handler
      await sigIntHandler();

      expect(console.log).toHaveBeenCalledWith('Received SIGINT, shutting down...');
      expect(serverInstance.stop).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('Logging Configuration', () => {
    it('should configure logging level from environment', async () => {
      process.env.LOG_LEVEL = 'debug';
      
      const logger = (await import('loglevel')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(logger.setLevel).toHaveBeenCalledWith('debug');
    });

    it('should use default log level when not specified', async () => {
      delete process.env.LOG_LEVEL;
      
      const logger = (await import('loglevel')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(logger.setLevel).toHaveBeenCalledWith('info');
    });
  });

  describe('Path Resolution', () => {
    it('should resolve paths correctly', async () => {
      await import('../../../src/servers/ui-server.js');

      expect(fileURLToPath).toHaveBeenCalled();
      expect(path.default.dirname).toHaveBeenCalled();
    });

    it('should resolve config file path relative to project root', async () => {
      process.argv = ['node', 'ui-server.js', 'config/test.json'];
      
      fs.default.readFileSync.mockReturnValue('{}');
      
      await import('../../../src/servers/ui-server.js');

      expect(path.default.resolve).toHaveBeenCalledWith(
        expect.any(String),
        'config/test.json'
      );
    });
  });

  describe('Configuration Merging', () => {
    it('should merge file config with environment config', async () => {
      process.argv = ['node', 'ui-server.js', 'test-config.json'];
      
      const fileConfig = {
        port: 3000,
        customSetting: 'file-value',
        fileOnlySetting: 'file-only'
      };
      
      fs.default.readFileSync.mockReturnValue(JSON.stringify(fileConfig));
      
      const UIServer = (await import('../../../src/services/search/UIServer.js')).default;
      
      await import('../../../src/servers/ui-server.js');

      expect(UIServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3000, // From file (overrides env)
          graphName: 'http://test-graph', // From env
          chatModel: 'test-chat', // From env
          customSetting: 'file-value', // From file
          fileOnlySetting: 'file-only' // From file only
        })
      );
    });
  });
});