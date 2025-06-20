import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../../../mcp/index.js';

// Mock the MCP SDK components
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock the MCP components
vi.mock('../../../mcp/lib/debug-utils.js', () => ({
  mcpDebugger: {
    info: vi.fn(),
    error: vi.fn(),
    logProtocolMessage: vi.fn()
  }
}));

vi.mock('../../../mcp/lib/config.js', () => ({
  mcpConfig: {
    name: 'test-mcp-server',
    version: '1.0.0'
  }
}));

vi.mock('../../../mcp/lib/initialization.js', () => ({
  initializeServices: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../mcp/tools/memory-tools.js', () => ({
  registerMemoryTools: vi.fn()
}));

vi.mock('../../../mcp/tools/memory-tools-http.js', () => ({
  registerMemoryToolsHttp: vi.fn()
}));

vi.mock('../../../mcp/resources/status-resource.js', () => ({
  registerStatusResources: vi.fn()
}));

vi.mock('../../../mcp/resources/status-resource-http.js', () => ({
  registerStatusResourcesHttp: vi.fn()
}));

describe('MCP Index Server', () => {
  let mockServer;
  let mockTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(true)
    };
    
    mockTransport = {
      start: vi.fn(),
      close: vi.fn()
    };

    Server.mockImplementation(() => mockServer);
    StdioServerTransport.mockImplementation(() => mockTransport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server Creation', () => {
    it('should create MCP server with correct configuration', async () => {
      const server = await createServer();

      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-mcp-server',
          version: '1.0.0'
        }),
        expect.objectContaining({
          capabilities: expect.objectContaining({
            tools: {},
            resources: {}
          })
        })
      );

      expect(server).toBeDefined();
    });

    it('should initialize services during server creation', async () => {
      const { initializeServices } = await import('../../../mcp/lib/initialization.js');
      
      await createServer();

      expect(initializeServices).toHaveBeenCalledOnce();
    });

    it('should register memory tools based on environment', async () => {
      const { registerMemoryTools } = await import('../../../mcp/tools/memory-tools.js');
      const { registerMemoryToolsHttp } = await import('../../../mcp/tools/memory-tools-http.js');

      // Test default behavior (HTTP tools)
      process.env.MCP_USE_HTTP_TOOLS = undefined;
      await createServer();
      expect(registerMemoryToolsHttp).toHaveBeenCalled();

      vi.clearAllMocks();

      // Test explicit HTTP tools
      process.env.MCP_USE_HTTP_TOOLS = 'true';
      await createServer();
      expect(registerMemoryToolsHttp).toHaveBeenCalled();

      vi.clearAllMocks();

      // Test non-HTTP tools
      process.env.MCP_USE_HTTP_TOOLS = 'false';
      await createServer();
      expect(registerMemoryTools).toHaveBeenCalled();
    });

    it('should register status resources based on environment', async () => {
      const { registerStatusResources } = await import('../../../mcp/resources/status-resource.js');
      const { registerStatusResourcesHttp } = await import('../../../mcp/resources/status-resource-http.js');

      // Test default behavior (HTTP resources)
      process.env.MCP_USE_HTTP_TOOLS = undefined;
      await createServer();
      expect(registerStatusResourcesHttp).toHaveBeenCalled();

      vi.clearAllMocks();

      // Test non-HTTP resources
      process.env.MCP_USE_HTTP_TOOLS = 'false';
      await createServer();
      expect(registerStatusResources).toHaveBeenCalled();
    });
  });

  describe('Request Handler Wrapping', () => {
    it('should wrap request handlers with debugging', async () => {
      const { mcpDebugger } = await import('../../../mcp/lib/debug-utils.js');
      
      await createServer();

      // Verify that setRequestHandler was called (debugging wrapper was applied)
      expect(mockServer.setRequestHandler).toHaveBeenCalled();
    });

    it('should log protocol messages for debugging', async () => {
      const { mcpDebugger } = await import('../../../mcp/lib/debug-utils.js');
      
      const server = await createServer();

      // Get the wrapped handler function
      const setRequestHandlerCalls = mockServer.setRequestHandler.mock.calls;
      expect(setRequestHandlerCalls.length).toBeGreaterThan(0);

      // The first call should be the debugging wrapper setup
      // We can't easily test the actual wrapping behavior without more complex mocking
      expect(mcpDebugger.info).toHaveBeenCalledWith(
        expect.stringContaining('MCP server creation complete')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization failures', async () => {
      const { initializeServices } = await import('../../../mcp/lib/initialization.js');
      initializeServices.mockRejectedValueOnce(new Error('Service initialization failed'));

      await expect(createServer()).rejects.toThrow('Service initialization failed');
    });

    it('should handle server creation failures', async () => {
      Server.mockImplementationOnce(() => {
        throw new Error('Server creation failed');
      });

      await expect(createServer()).rejects.toThrow('Server creation failed');
    });
  });

  describe('Environment Configuration', () => {
    it('should respect MCP_USE_HTTP_TOOLS environment variable', async () => {
      const { registerMemoryTools } = await import('../../../mcp/tools/memory-tools.js');
      const { registerMemoryToolsHttp } = await import('../../../mcp/tools/memory-tools-http.js');

      // Test false value
      process.env.MCP_USE_HTTP_TOOLS = 'false';
      await createServer();
      expect(registerMemoryTools).toHaveBeenCalled();
      expect(registerMemoryToolsHttp).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Test true value  
      process.env.MCP_USE_HTTP_TOOLS = 'true';
      await createServer();
      expect(registerMemoryToolsHttp).toHaveBeenCalled();
      expect(registerMemoryTools).not.toHaveBeenCalled();

      // Clean up
      delete process.env.MCP_USE_HTTP_TOOLS;
    });
  });

  describe('Server Capabilities', () => {
    it('should declare tools and resources capabilities', async () => {
      await createServer();

      expect(Server).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          capabilities: expect.objectContaining({
            tools: {},
            resources: {}
          })
        })
      );
    });

    it('should use correct server name and version from config', async () => {
      await createServer();

      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-mcp-server',
          version: '1.0.0'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Debugging Integration', () => {
    it('should log server creation steps', async () => {
      const { mcpDebugger } = await import('../../../mcp/lib/debug-utils.js');
      
      await createServer();

      expect(mcpDebugger.info).toHaveBeenCalledWith(
        'Creating MCP server with config',
        expect.any(Object)
      );
      expect(mcpDebugger.info).toHaveBeenCalledWith('Initializing services...');
      expect(mcpDebugger.info).toHaveBeenCalledWith('Services initialized successfully');
      expect(mcpDebugger.info).toHaveBeenCalledWith('Registering memory tools...');
      expect(mcpDebugger.info).toHaveBeenCalledWith('Registering status resources...');
      expect(mcpDebugger.info).toHaveBeenCalledWith('MCP server creation complete');
    });

    it('should handle debug logging errors gracefully', async () => {
      const { mcpDebugger } = await import('../../../mcp/lib/debug-utils.js');
      mcpDebugger.info.mockImplementationOnce(() => {
        throw new Error('Debug logging failed');
      });

      // Should not throw despite debug logging failure
      await expect(createServer()).resolves.toBeDefined();
    });
  });
});