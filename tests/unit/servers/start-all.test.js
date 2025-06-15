import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Mock dependencies
vi.mock('url', () => ({
  fileURLToPath: vi.fn().mockReturnValue('/mock/path/start-all.js')
}));

vi.mock('path', () => ({
  dirname: vi.fn().mockImplementation((path) => {
    if (path === '/mock/path/start-all.js') return '/mock/path';
    if (path === '/mock/path') return '/mock/project';
    return path;
  }),
  join: vi.fn().mockImplementation((...args) => args.join('/'))
}));

vi.mock('../../../src/servers/server-manager.js', () => ({
  default: class MockServerManager {
    constructor() {
      this.startServer = vi.fn();
      this.stopAllServers = vi.fn();
    }
  }
}));

vi.mock('../../../src/Config.js', () => ({
  default: class MockConfig {
    constructor() {
      this.config = {
        servers: {
          api: 4100,
          ui: 4120
        }
      };
    }
    async init() {}
    static createFromFile(path) {
      return new this();
    }
  }
}));

describe('start-all.js', () => {
  let mockServerManager;
  let mockConfig;
  let originalConsoleLog;
  let originalConsoleError;
  let originalStdin;
  let originalProcessExit;

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn();
    console.error = vi.fn();

    // Mock process.stdin
    originalStdin = process.stdin;
    process.stdin = {
      setRawMode: vi.fn(),
      on: vi.fn()
    };

    // Mock process.exit
    originalProcessExit = process.exit;
    process.exit = vi.fn();

    // Mock process.on
    vi.spyOn(process, 'on').mockImplementation(() => {});

    // Clear module cache to ensure fresh import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.stdin = originalStdin;
    process.exit = originalProcessExit;
    
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Module Initialization', () => {
    it('should set up correct paths and configuration', async () => {
      // Import the module to trigger initialization
      await import('../../../src/servers/start-all.js');

      expect(fileURLToPath).toHaveBeenCalled();
      expect(dirname).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Current working directory:', expect.any(String));
    });

    it('should create ServerManager instance', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      
      // Import the module
      await import('../../../src/servers/start-all.js');

      // ServerManager should have been instantiated
      expect(ServerManager).toHaveBeenCalled();
    });

    it('should load and initialize config', async () => {
      const Config = (await import('../../../src/Config.js')).default;
      
      await import('../../../src/servers/start-all.js');

      expect(Config.createFromFile).toHaveBeenCalled();
    });
  });

  describe('Server Configuration', () => {
    it('should use correct server ports from config', async () => {
      await import('../../../src/servers/start-all.js');

      expect(console.log).toHaveBeenCalledWith(
        'Server configuration:',
        expect.stringContaining('4100')
      );
      expect(console.log).toHaveBeenCalledWith(
        'Server configuration:',
        expect.stringContaining('4120')
      );
    });

    it('should set correct project root path', async () => {
      await import('../../../src/servers/start-all.js');

      expect(console.log).toHaveBeenCalledWith(
        'Project root:',
        expect.any(String)
      );
    });
  });

  describe('Server Starting Process', () => {
    it('should start both API and UI servers', async () => {
      // Mock successful server starts
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      // Import and let it execute
      await import('../../../src/servers/start-all.js');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockInstance.startServer).toHaveBeenCalledTimes(2);
      
      // Check API server call
      expect(mockInstance.startServer).toHaveBeenCalledWith(
        expect.stringContaining('api-server.js'),
        'API Server',
        4100,
        { NODE_ENV: 'production' }
      );

      // Check UI server call
      expect(mockInstance.startServer).toHaveBeenCalledWith(
        expect.stringContaining('ui-server.js'),
        'UI Server',
        4120,
        { NODE_ENV: 'production' }
      );
    });

    it('should log success message when servers start', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('All servers started successfully!')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4100')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4120')
      );
    });

    it('should handle server startup errors', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockRejectedValue(new Error('Server start failed')),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error starting servers:'),
        'Server start failed'
      );
      expect(mockInstance.stopAllServers).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Input Handling', () => {
    it('should setup stdin for raw mode', async () => {
      await import('../../../src/servers/start-all.js');

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(process.stdin.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should handle Ctrl+C input', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');

      // Get the stdin data handler
      const dataHandler = process.stdin.on.mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate Ctrl+C
      await dataHandler(Buffer.from('\x03'));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down servers...')
      );
      expect(mockInstance.stopAllServers).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle "q" input', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');

      // Get the stdin data handler
      const dataHandler = process.stdin.on.mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate 'q' key
      await dataHandler(Buffer.from('q'));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down servers...')
      );
      expect(mockInstance.stopAllServers).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should ignore other input', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');

      // Get the stdin data handler
      const dataHandler = process.stdin.on.mock.calls.find(
        call => call[0] === 'data'
      )[1];

      // Simulate other key
      await dataHandler(Buffer.from('a'));

      // Should not trigger shutdown
      expect(mockInstance.stopAllServers).not.toHaveBeenCalled();
    });
  });

  describe('Signal Handling', () => {
    it('should handle SIGINT signal', async () => {
      await import('../../../src/servers/start-all.js');

      // Check that SIGINT handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Get the SIGINT handler
      const sigintHandler = process.on.mock.calls.find(
        call => call[0] === 'SIGINT'
      )[1];

      // Execute the handler
      sigintHandler();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down servers...')
      );
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('Configuration Paths', () => {
    it('should use correct config file path', async () => {
      const Config = (await import('../../../src/Config.js')).default;
      
      await import('../../../src/servers/start-all.js');

      expect(Config.createFromFile).toHaveBeenCalledWith(
        expect.stringContaining('config/config.json')
      );
    });

    it('should use correct server script paths', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify script paths
      const apiCall = mockInstance.startServer.mock.calls.find(
        call => call[1] === 'API Server'
      );
      const uiCall = mockInstance.startServer.mock.calls.find(
        call => call[1] === 'UI Server'
      );

      expect(apiCall[0]).toContain('api-server.js');
      expect(uiCall[0]).toContain('ui-server.js');
    });
  });

  describe('Environment Configuration', () => {
    it('should set NODE_ENV to production for servers', async () => {
      const ServerManager = (await import('../../../src/servers/server-manager.js')).default;
      const mockInstance = {
        startServer: vi.fn().mockResolvedValue({}),
        stopAllServers: vi.fn().mockResolvedValue()
      };
      ServerManager.mockImplementation(() => mockInstance);

      await import('../../../src/servers/start-all.js');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Both server calls should have NODE_ENV: production
      expect(mockInstance.startServer).toHaveBeenCalledWith(
        expect.any(String),
        'API Server',
        4100,
        { NODE_ENV: 'production' }
      );

      expect(mockInstance.startServer).toHaveBeenCalledWith(
        expect.any(String),
        'UI Server',
        4120,
        { NODE_ENV: 'production' }
      );
    });
  });
});