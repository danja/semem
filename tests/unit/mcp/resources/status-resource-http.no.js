import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerStatusResourcesHttp } from '../../../../mcp/resources/status-resource-http.js';

// Mock dependencies
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  getMemoryManager: vi.fn(() => mockMemoryManager),
  getConfig: vi.fn(() => mockConfig),
  isInitialized: vi.fn(() => true)
}));

// Mock objects
const mockMemoryManager = {
  isReady: true,
  version: '1.0.0',
  httpSupport: true
};

const mockConfig = {
  loaded: true,
  version: '1.0.0',
  transport: 'http'
};

// Mock MCP server
const mockServer = {
  resource: vi.fn(),
  resourceHandlers: new Map()
};

describe('Status Resources HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock server resource registration
    mockServer.resource.mockImplementation((uri, name, description, mimeType, handler) => {
      mockServer.resourceHandlers.set(uri, { name, description, mimeType, handler });
      return Promise.resolve();
    });

    // Mock environment for HTTP
    process.env.MCP_PORT = '3000';
    process.env.MCP_HOST = 'localhost';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_PORT;
    delete process.env.MCP_HOST;
  });

  describe('HTTP Resource Registration', () => {
    it('should register HTTP-specific status resources', () => {
      registerStatusResourcesHttp(mockServer);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://status/http',
        'HTTP System Status',
        'HTTP transport system status and service health',
        'application/json',
        expect.any(Function)
      );

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://docs/http-api',
        'HTTP API Documentation',
        'HTTP-specific API documentation and endpoints',
        'text/markdown',
        expect.any(Function)
      );

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://sessions/active',
        'Active HTTP Sessions',
        'Currently active HTTP MCP sessions',
        'application/json',
        expect.any(Function)
      );
    });

    it('should register resources with HTTP-specific URIs', () => {
      registerStatusResourcesHttp(mockServer);

      const registeredUris = Array.from(mockServer.resourceHandlers.keys());
      expect(registeredUris).toContain('semem://status/http');
      expect(registeredUris).toContain('semem://docs/http-api');
      expect(registeredUris).toContain('semem://sessions/active');
      expect(registeredUris).toContain('semem://config/http');
      expect(registeredUris).toContain('semem://metrics/http');
    });
  });

  describe('semem://status/http Resource', () => {
    it('should return HTTP system status', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://status/http');
      expect(result.contents[0].mimeType).toBe('application/json');

      const statusData = JSON.parse(result.contents[0].text);
      expect(statusData.server).toBeDefined();
      expect(statusData.server.name).toBe('Semem HTTP MCP Server');
      expect(statusData.server.transport).toBe('StreamableHTTP');
      expect(statusData.server.port).toBe('3000');
      expect(statusData.server.host).toBe('localhost');
    });

    it('should report HTTP-specific service status', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services).toBeDefined();
      expect(statusData.services.memoryManagerInitialized).toBe(true);
      expect(statusData.services.configInitialized).toBe(true);
      expect(statusData.services.httpTransportReady).toBe(true);
    });

    it('should include HTTP-specific capabilities', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.capabilities).toBeDefined();
      expect(statusData.capabilities.http_streaming).toBe(true);
      expect(statusData.capabilities.session_management).toBe(true);
      expect(statusData.capabilities.concurrent_requests).toBe(true);
      expect(statusData.capabilities.real_time_updates).toBe(true);
    });

    it('should include HTTP performance metrics', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.performance).toBeDefined();
      expect(statusData.performance.activeConnections).toBeDefined();
      expect(statusData.performance.requestsPerSecond).toBeDefined();
      expect(statusData.performance.averageResponseTime).toBeDefined();
    });

    it('should handle missing HTTP environment variables', async () => {
      delete process.env.MCP_PORT;
      delete process.env.MCP_HOST;

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.server.port).toBe('3000'); // default
      expect(statusData.server.host).toBe('localhost'); // default
    });
  });

  describe('semem://docs/http-api Resource', () => {
    it('should return HTTP API documentation', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/http-api').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://docs/http-api');
      expect(result.contents[0].mimeType).toBe('text/markdown');
      expect(result.contents[0].text).toContain('# Semem HTTP MCP API Documentation');
      expect(result.contents[0].text).toContain('## HTTP Transport Features');
      expect(result.contents[0].text).toContain('## Session Management');
      expect(result.contents[0].text).toContain('## Streaming Responses');
    });

    it('should include HTTP-specific endpoints', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/http-api').handler;

      const result = await handler();
      const docText = result.contents[0].text;

      expect(docText).toContain('/mcp');
      expect(docText).toContain('/health');
      expect(docText).toContain('/info');
      expect(docText).toContain('POST /mcp');
      expect(docText).toContain('GET /health');
    });

    it('should include HTTP tool examples', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/http-api').handler;

      const result = await handler();
      const docText = result.contents[0].text;

      expect(docText).toContain('semem_store_interaction_http');
      expect(docText).toContain('semem_retrieve_memories_http');
      expect(docText).toContain('Content-Type: application/json');
      expect(docText).toContain('mcp-session-id');
    });
  });

  describe('semem://sessions/active Resource', () => {
    it('should return active HTTP sessions', async () => {
      // Mock active sessions
      global.mockActiveSessions = new Map([
        ['session-1', { created: Date.now(), lastActivity: Date.now(), requests: 5 }],
        ['session-2', { created: Date.now() - 30000, lastActivity: Date.now() - 5000, requests: 12 }]
      ]);

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://sessions/active').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://sessions/active');
      expect(result.contents[0].mimeType).toBe('application/json');

      const sessionData = JSON.parse(result.contents[0].text);
      expect(sessionData.totalSessions).toBe(2);
      expect(sessionData.sessions).toHaveLength(2);
      expect(sessionData.sessions[0]).toHaveProperty('sessionId');
      expect(sessionData.sessions[0]).toHaveProperty('created');
      expect(sessionData.sessions[0]).toHaveProperty('lastActivity');
      expect(sessionData.sessions[0]).toHaveProperty('requests');

      // Cleanup
      delete global.mockActiveSessions;
    });

    it('should handle no active sessions', async () => {
      global.mockActiveSessions = new Map();

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://sessions/active').handler;

      const result = await handler();
      const sessionData = JSON.parse(result.contents[0].text);

      expect(sessionData.totalSessions).toBe(0);
      expect(sessionData.sessions).toHaveLength(0);

      // Cleanup
      delete global.mockActiveSessions;
    });

    it('should include session statistics', async () => {
      global.mockActiveSessions = new Map([
        ['session-1', { created: Date.now(), lastActivity: Date.now(), requests: 5 }]
      ]);

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://sessions/active').handler;

      const result = await handler();
      const sessionData = JSON.parse(result.contents[0].text);

      expect(sessionData.statistics).toBeDefined();
      expect(sessionData.statistics.totalRequests).toBeDefined();
      expect(sessionData.statistics.averageRequestsPerSession).toBeDefined();
      expect(sessionData.statistics.averageSessionDuration).toBeDefined();

      // Cleanup
      delete global.mockActiveSessions;
    });
  });

  describe('semem://config/http Resource', () => {
    it('should return HTTP-specific configuration', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://config/http').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://config/http');
      expect(result.contents[0].mimeType).toBe('application/json');

      const configData = JSON.parse(result.contents[0].text);
      expect(configData.transport).toBeDefined();
      expect(configData.transport.type).toBe('http');
      expect(configData.transport.port).toBe('3000');
      expect(configData.transport.host).toBe('localhost');
    });

    it('should include HTTP-specific settings', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://config/http').handler;

      const result = await handler();
      const configData = JSON.parse(result.contents[0].text);

      expect(configData.http).toBeDefined();
      expect(configData.http.maxRequestSize).toBeDefined();
      expect(configData.http.sessionTimeout).toBeDefined();
      expect(configData.http.enableCompression).toBeDefined();
      expect(configData.http.cors).toBeDefined();
    });

    it('should include security settings', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://config/http').handler;

      const result = await handler();
      const configData = JSON.parse(result.contents[0].text);

      expect(configData.security).toBeDefined();
      expect(configData.security.helmet).toBeDefined();
      expect(configData.security.rateLimit).toBeDefined();
      expect(configData.security.contentSecurityPolicy).toBeDefined();
    });
  });

  describe('semem://metrics/http Resource', () => {
    it('should return HTTP-specific metrics', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/http').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://metrics/http');
      expect(result.contents[0].mimeType).toBe('application/json');

      const metricsData = JSON.parse(result.contents[0].text);
      expect(metricsData.http).toBeDefined();
      expect(metricsData.http.totalRequests).toBeDefined();
      expect(metricsData.http.successfulRequests).toBeDefined();
      expect(metricsData.http.errorRequests).toBeDefined();
      expect(metricsData.http.averageResponseTime).toBeDefined();
    });

    it('should include session metrics', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/http').handler;

      const result = await handler();
      const metricsData = JSON.parse(result.contents[0].text);

      expect(metricsData.sessions).toBeDefined();
      expect(metricsData.sessions.total).toBeDefined();
      expect(metricsData.sessions.active).toBeDefined();
      expect(metricsData.sessions.averageDuration).toBeDefined();
    });

    it('should include performance metrics', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/http').handler;

      const result = await handler();
      const metricsData = JSON.parse(result.contents[0].text);

      expect(metricsData.performance).toBeDefined();
      expect(metricsData.performance.memoryUsage).toBeDefined();
      expect(metricsData.performance.cpuUsage).toBeDefined();
      expect(metricsData.performance.throughput).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP service unavailable', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockReturnValueOnce(null);

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services.memoryManagerInitialized).toBe(false);
      expect(statusData.services.httpTransportReady).toBe(false);
    });

    it('should handle session access errors', async () => {
      // Mock session access failure
      global.mockActiveSessions = {
        size: 0,
        forEach: () => { throw new Error('Session access failed'); }
      };

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://sessions/active').handler;

      const result = await handler();
      const sessionData = JSON.parse(result.contents[0].text);

      expect(sessionData.error).toContain('Session access failed');
      expect(sessionData.totalSessions).toBe(0);

      // Cleanup
      delete global.mockActiveSessions;
    });

    it('should handle metrics collection errors', async () => {
      // Mock metrics collection to throw error
      vi.spyOn(process, 'memoryUsage').mockImplementationOnce(() => {
        throw new Error('Memory metrics unavailable');
      });

      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/http').handler;

      const result = await handler();
      const metricsData = JSON.parse(result.contents[0].text);

      expect(metricsData.error).toBeDefined();
      expect(metricsData.http).toBeDefined(); // Basic metrics should still be available
    });
  });

  describe('HTTP Transport Features', () => {
    it('should support real-time status updates', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result1 = await handler();
      const result2 = await handler();

      const status1 = JSON.parse(result1.contents[0].text);
      const status2 = JSON.parse(result2.contents[0].text);

      // Timestamps should be different for real-time updates
      expect(status1.server.timestamp).not.toBe(status2.server.timestamp);
    });

    it('should include streaming capability information', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status/http').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.capabilities.http_streaming).toBe(true);
      expect(statusData.capabilities.server_sent_events).toBe(true);
      expect(statusData.streaming).toBeDefined();
      expect(statusData.streaming.enabled).toBe(true);
      expect(statusData.streaming.maxConnections).toBeDefined();
    });

    it('should provide integration examples', async () => {
      registerStatusResourcesHttp(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/http-api').handler;

      const result = await handler();
      const docText = result.contents[0].text;

      expect(docText).toContain('## Integration Examples');
      expect(docText).toContain('### Claude Desktop');
      expect(docText).toContain('### cURL Examples');
      expect(docText).toContain('### JavaScript Client');
      expect(docText).toContain('http://localhost:3000/mcp');
    });
  });
});