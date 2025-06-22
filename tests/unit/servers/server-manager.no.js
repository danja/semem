import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import http from 'http';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn()
}));

// Mock http module
vi.mock('http', () => ({
  default: {
    createServer: vi.fn()
  },
  createServer: vi.fn()
}));

// Mock fs
vi.mock('fs', () => ({
  default: {}
}));

// Mock readline
vi.mock('readline', () => ({
  default: {}
}));

describe('ServerManager', () => {
  let ServerManager;
  let serverManager;
  let mockChild;
  let mockServer;

  beforeEach(async () => {
    // Setup mocks
    mockChild = new EventEmitter();
    mockChild.pid = 12345;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();
    mockChild.exitCode = null;

    mockServer = new EventEmitter();
    mockServer.listen = vi.fn((port, host) => {
      mockServer.emit('listening');
      return mockServer;
    });
    mockServer.close = vi.fn((callback) => callback && callback());

    spawn.mockReturnValue(mockChild);
    http.default.createServer.mockReturnValue(mockServer);

    // Import after mocking
    const module = await import('../../../src/servers/server-manager.js');
    ServerManager = module.default;
    serverManager = new ServerManager();

    // Mock console output
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with empty child processes array', () => {
      expect(serverManager.childProcesses).toEqual([]);
    });

    it('should setup process handlers', () => {
      const signalListeners = process.listenerCount('SIGINT');
      expect(signalListeners).toBeGreaterThan(0);
    });
  });

  describe('Logging', () => {
    it('should log messages with timestamp', () => {
      const message = 'Test message';
      serverManager.log(message);
      
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('should include timestamp in log messages', () => {
      const message = 'Test message';
      serverManager.log(message);
      
      const logCall = process.stdout.write.mock.calls[0][0];
      expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('Port Management', () => {
    it('should check if port is in use', async () => {
      // Mock port as available
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('listening'), 10);
        return mockServer;
      });

      const result = await serverManager.isPortInUse(3000);
      expect(result).toBe(false);
    });

    it('should detect port in use', async () => {
      // Mock port as in use
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('error', new Error('EADDRINUSE')), 10);
        return mockServer;
      });

      const result = await serverManager.isPortInUse(3000);
      expect(result).toBe(true);
    });

    it('should kill process on port', () => {
      const { execSync } = require('child_process');
      execSync.mockReturnValue('');

      const result = serverManager.killProcessOnPort(3000);
      
      expect(execSync).toHaveBeenCalledWith(
        'lsof -ti:3000 | xargs kill -9 2>/dev/null || true'
      );
      expect(result).toBe(true);
    });

    it('should handle errors when killing process', () => {
      const { execSync } = require('child_process');
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = serverManager.killProcessOnPort(3000);
      expect(result).toBe(false);
    });
  });

  describe('Server Starting', () => {
    it('should start server successfully', async () => {
      // Mock port as available
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('listening'), 10);
        return mockServer;
      });

      const promise = serverManager.startServer(
        'test-script.js',
        'Test Server',
        3000,
        { TEST: 'value' }
      );

      // Simulate server startup
      setTimeout(() => {
        mockServer.emit('listening');
      }, 20);

      const result = await promise;
      
      expect(spawn).toHaveBeenCalledWith(
        'node',
        ['test-script.js'],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 3000,
            TEST: 'value',
            NODE_ENV: 'production'
          })
        })
      );
      expect(result).toBe(mockChild);
      expect(serverManager.childProcesses).toHaveLength(1);
    });

    it('should handle port already in use', async () => {
      // Mock port as in use initially
      let portCheckCount = 0;
      mockServer.listen.mockImplementation((port, host) => {
        portCheckCount++;
        if (portCheckCount === 1) {
          setTimeout(() => mockServer.emit('error', new Error('EADDRINUSE')), 10);
        } else {
          setTimeout(() => mockServer.emit('listening'), 10);
        }
        return mockServer;
      });

      // Mock successful port freeing
      const { execSync } = require('child_process');
      execSync.mockReturnValue('');

      const result = await serverManager.startServer(
        'test-script.js',
        'Test Server',
        3000
      );

      expect(result).toBe(mockChild);
    });

    it('should handle server startup failure', async () => {
      // Mock port freeing failure
      const { execSync } = require('child_process');
      execSync.mockImplementation(() => {
        throw new Error('Failed to free port');
      });

      // Mock port as always in use
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('error', new Error('EADDRINUSE')), 10);
        return mockServer;
      });

      await expect(
        serverManager.startServer('test-script.js', 'Test Server', 3000)
      ).rejects.toThrow('Failed to free port 3000');
    });

    it('should handle child process output', async () => {
      // Mock port as available
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('listening'), 10);
        return mockServer;
      });

      const promise = serverManager.startServer('test-script.js', 'Test Server', 3000);

      // Simulate child process output
      setTimeout(() => {
        mockChild.stdout.emit('data', Buffer.from('Server started'));
        mockChild.stderr.emit('data', Buffer.from('Warning message'));
        mockServer.emit('listening');
      }, 10);

      await promise;

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('[Test Server] Server started')
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('[Test Server-ERROR] Warning message')
      );
    });

    it('should handle child process exit', async () => {
      // Mock port as available
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('listening'), 10);
        return mockServer;
      });

      const promise = serverManager.startServer('test-script.js', 'Test Server', 3000);

      setTimeout(() => {
        mockServer.emit('listening');
      }, 10);

      await promise;

      // Simulate child process exit
      mockChild.emit('exit', 1, 'SIGTERM');

      expect(serverManager.childProcesses).toHaveLength(0);
    });
  });

  describe('Port Waiting', () => {
    it('should wait for port to become available', async () => {
      let callCount = 0;
      mockServer.listen.mockImplementation((port, host) => {
        callCount++;
        if (callCount < 3) {
          setTimeout(() => mockServer.emit('error', new Error('EADDRINUSE')), 10);
        } else {
          setTimeout(() => mockServer.emit('listening'), 10);
        }
        return mockServer;
      });

      const result = await serverManager.waitForPort(3000, 1000, 100);
      expect(result).toBeUndefined(); // Promise resolves without value
    });

    it('should timeout waiting for port', async () => {
      // Mock port as always in use
      mockServer.listen.mockImplementation((port, host) => {
        setTimeout(() => mockServer.emit('error', new Error('EADDRINUSE')), 10);
        return mockServer;
      });

      await expect(
        serverManager.waitForPort(3000, 100, 50)
      ).rejects.toThrow('Server did not start within 100ms');
    });
  });

  describe('Server Stopping', () => {
    beforeEach(async () => {
      // Add a mock server to the child processes
      const mockProcess = {
        name: 'Test Server',
        port: 3000,
        process: mockChild,
        startTime: new Date()
      };
      serverManager.childProcesses.push(mockProcess);
    });

    it('should stop server by port', async () => {
      const promise = serverManager.stopServer(3000);

      // Simulate process close
      setTimeout(() => {
        mockChild.emit('close');
      }, 10);

      await promise;

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(serverManager.childProcesses).toHaveLength(0);
    });

    it('should handle non-existent server', async () => {
      const result = await serverManager.stopServer(9999);
      expect(result).toBeUndefined();
    });

    it('should force kill after timeout', async () => {
      const promise = serverManager.stopServer(3000);

      // Don't emit close event to simulate hanging process
      setTimeout(() => {
        // Check if force kill was called after timeout
        expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL');
      }, 5100); // Just after the 5 second timeout

      // Simulate close after force kill
      setTimeout(() => {
        mockChild.emit('close');
      }, 5200);

      await promise;
    });

    it('should stop all servers', async () => {
      // Add multiple servers
      const mockChild2 = new EventEmitter();
      mockChild2.kill = vi.fn();
      
      serverManager.childProcesses.push({
        name: 'Test Server 2',
        port: 3001,
        process: mockChild2,
        startTime: new Date()
      });

      const promise = serverManager.stopAllServers();

      // Simulate both processes closing
      setTimeout(() => {
        mockChild.emit('close');
        mockChild2.emit('close');
      }, 10);

      await promise;

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockChild2.kill).toHaveBeenCalledWith('SIGTERM');
      expect(serverManager.childProcesses).toHaveLength(0);
    });
  });

  describe('Process Signal Handling', () => {
    it('should handle SIGTERM signal', async () => {
      const mockProcess = {
        name: 'Test Server',
        port: 3000,
        process: mockChild,
        startTime: new Date()  
      };
      serverManager.childProcesses.push(mockProcess);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Simulate SIGTERM
      process.emit('SIGTERM');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Restore process.exit
      process.exit = originalExit;

      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle uncaught exceptions', async () => {
      const mockProcess = {
        name: 'Test Server',
        port: 3000,
        process: mockChild,
        startTime: new Date()
      };
      serverManager.childProcesses.push(mockProcess);

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = vi.fn();

      // Simulate uncaught exception
      const testError = new Error('Test uncaught exception');
      process.emit('uncaughtException', testError);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Restore process.exit
      process.exit = originalExit;

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Uncaught Exception: Test uncaught exception')
      );
    });

    it('should handle unhandled promise rejections', () => {
      const testReason = new Error('Test rejection');
      const testPromise = Promise.reject(testReason);

      process.emit('unhandledRejection', testReason, testPromise);

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled Rejection')
      );
    });
  });
});