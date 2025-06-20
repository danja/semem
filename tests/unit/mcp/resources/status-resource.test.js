import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerStatusResources } from '../../../../mcp/resources/status-resource.js';

// Mock dependencies
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  getMemoryManager: vi.fn(() => mockMemoryManager),
  getConfig: vi.fn(() => mockConfig),
  isInitialized: vi.fn(() => true)
}));

// Mock objects
const mockMemoryManager = {
  isReady: true,
  version: '1.0.0'
};

const mockConfig = {
  loaded: true,
  version: '1.0.0'
};

// Mock MCP server
const mockServer = {
  resource: vi.fn(),
  resourceHandlers: new Map()
};

describe('Status Resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock server resource registration
    mockServer.resource.mockImplementation((uri, name, description, mimeType, handler) => {
      mockServer.resourceHandlers.set(uri, { name, description, mimeType, handler });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Resource Registration', () => {
    it('should register all status resources with the server', () => {
      registerStatusResources(mockServer);

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://status',
        'System Status',
        'Current system status and service health',
        'application/json',
        expect.any(Function)
      );

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://docs/api',
        'API Documentation',
        'Complete API documentation for Semem MCP integration',
        'text/markdown',
        expect.any(Function)
      );

      expect(mockServer.resource).toHaveBeenCalledWith(
        'semem://graph/schema',
        'RDF Graph Schema',
        'RDF graph schema and ontology documentation',
        'text/turtle',
        expect.any(Function)
      );
    });

    it('should register resources with correct URIs', () => {
      registerStatusResources(mockServer);

      const registeredUris = Array.from(mockServer.resourceHandlers.keys());
      expect(registeredUris).toContain('semem://status');
      expect(registeredUris).toContain('semem://docs/api');
      expect(registeredUris).toContain('semem://graph/schema');
      expect(registeredUris).toContain('semem://config/current');
      expect(registeredUris).toContain('semem://storage/backends');
      expect(registeredUris).toContain('semem://metrics/dashboard');
      expect(registeredUris).toContain('semem://examples/workflows');
    });
  });

  describe('semem://status Resource', () => {
    it('should return system status with correct structure', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://status');
      expect(result.contents[0].mimeType).toBe('application/json');

      const statusData = JSON.parse(result.contents[0].text);
      expect(statusData.server).toBeDefined();
      expect(statusData.server.name).toBe('Semem Integration Server');
      expect(statusData.server.version).toBe('1.0.0');
      expect(statusData.server.transport).toBe('stdio');
      expect(statusData.server.timestamp).toBeDefined();
    });

    it('should report service initialization status', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services).toBeDefined();
      expect(statusData.services.memoryManagerInitialized).toBe(true);
      expect(statusData.services.configInitialized).toBe(true);
      expect(statusData.services.servicesInitialized).toBe(true);
    });

    it('should report system capabilities', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.capabilities).toBeDefined();
      expect(statusData.capabilities.memory_management).toBe(true);
      expect(statusData.capabilities.concept_extraction).toBe(true);
      expect(statusData.capabilities.embedding_generation).toBe(true);
      expect(statusData.capabilities.ragno_knowledge_graph).toBe(true);
      expect(statusData.capabilities.zpt_navigation).toBe(true);
    });

    it('should handle missing memory manager', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockReturnValueOnce(null);

      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services.memoryManagerInitialized).toBe(false);
    });

    it('should handle missing config', async () => {
      const { getConfig } = await import('../../../../mcp/lib/initialization.js');
      getConfig.mockReturnValueOnce(null);

      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services.configInitialized).toBe(false);
    });

    it('should handle uninitialized services', async () => {
      const { isInitialized } = await import('../../../../mcp/lib/initialization.js');
      isInitialized.mockReturnValueOnce(false);

      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      const result = await handler();
      const statusData = JSON.parse(result.contents[0].text);

      expect(statusData.services.servicesInitialized).toBe(false);
    });
  });

  describe('semem://docs/api Resource', () => {
    it('should return API documentation', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/api').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://docs/api');
      expect(result.contents[0].mimeType).toBe('text/markdown');
      expect(result.contents[0].text).toContain('# Semem MCP API Documentation');
      expect(result.contents[0].text).toContain('## Memory Management Tools');
      expect(result.contents[0].text).toContain('## Ragno Knowledge Graph Tools');
      expect(result.contents[0].text).toContain('## ZPT Navigation Tools');
    });

    it('should include tool examples in documentation', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://docs/api').handler;

      const result = await handler();
      const docText = result.contents[0].text;

      expect(docText).toContain('semem_store_interaction');
      expect(docText).toContain('semem_retrieve_memories');
      expect(docText).toContain('ragno_decompose_corpus');
      expect(docText).toContain('zpt_navigate');
    });
  });

  describe('semem://graph/schema Resource', () => {
    it('should return RDF schema in Turtle format', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://graph/schema').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://graph/schema');
      expect(result.contents[0].mimeType).toBe('text/turtle');
      expect(result.contents[0].text).toContain('@prefix');
      expect(result.contents[0].text).toContain('ragno:');
      expect(result.contents[0].text).toContain('rdfs:');
    });

    it('should include Ragno ontology definitions', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://graph/schema').handler;

      const result = await handler();
      const schemaText = result.contents[0].text;

      expect(schemaText).toContain('ragno:Entity');
      expect(schemaText).toContain('ragno:SemanticUnit');
      expect(schemaText).toContain('ragno:Relationship');
      expect(schemaText).toContain('ragno:hasSubject');
      expect(schemaText).toContain('ragno:hasObject');
    });
  });

  describe('semem://config/current Resource', () => {
    it('should return current configuration', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://config/current').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://config/current');
      expect(result.contents[0].mimeType).toBe('application/json');

      const configData = JSON.parse(result.contents[0].text);
      expect(configData.memory).toBeDefined();
      expect(configData.storage).toBeDefined();
      expect(configData.models).toBeDefined();
    });

    it('should handle config retrieval errors', async () => {
      const { getConfig } = await import('../../../../mcp/lib/initialization.js');
      getConfig.mockImplementationOnce(() => {
        throw new Error('Config access failed');
      });

      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://config/current').handler;

      const result = await handler();
      const configData = JSON.parse(result.contents[0].text);

      expect(configData.error).toContain('Config access failed');
      expect(configData.available).toBe(false);
    });
  });

  describe('semem://storage/backends Resource', () => {
    it('should return storage backend information', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://storage/backends').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://storage/backends');
      expect(result.contents[0].mimeType).toBe('application/json');

      const backendData = JSON.parse(result.contents[0].text);
      expect(backendData.available).toBeDefined();
      expect(backendData.available).toContain('InMemoryStore');
      expect(backendData.available).toContain('JSONStore');
      expect(backendData.available).toContain('SPARQLStore');
      expect(backendData.available).toContain('CachedSPARQLStore');
    });

    it('should include backend capabilities', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://storage/backends').handler;

      const result = await handler();
      const backendData = JSON.parse(result.contents[0].text);

      expect(backendData.capabilities).toBeDefined();
      expect(backendData.capabilities.InMemoryStore).toBeDefined();
      expect(backendData.capabilities.SPARQLStore).toBeDefined();
    });
  });

  describe('semem://metrics/dashboard Resource', () => {
    it('should return metrics dashboard', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/dashboard').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://metrics/dashboard');
      expect(result.contents[0].mimeType).toBe('application/json');

      const metricsData = JSON.parse(result.contents[0].text);
      expect(metricsData.performance).toBeDefined();
      expect(metricsData.usage).toBeDefined();
      expect(metricsData.health).toBeDefined();
    });

    it('should include performance metrics', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://metrics/dashboard').handler;

      const result = await handler();
      const metricsData = JSON.parse(result.contents[0].text);

      expect(metricsData.performance.averageResponseTime).toBeDefined();
      expect(metricsData.performance.cacheHitRate).toBeDefined();
      expect(metricsData.performance.memoryUsage).toBeDefined();
    });
  });

  describe('semem://examples/workflows Resource', () => {
    it('should return workflow examples', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://examples/workflows').handler;

      const result = await handler();

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('semem://examples/workflows');
      expect(result.contents[0].mimeType).toBe('text/markdown');
      expect(result.contents[0].text).toContain('# Semem Workflow Examples');
      expect(result.contents[0].text).toContain('## Basic Memory Management');
      expect(result.contents[0].text).toContain('## Knowledge Graph Construction');
      expect(result.contents[0].text).toContain('## 3D Navigation');
    });

    it('should include practical examples', async () => {
      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://examples/workflows').handler;

      const result = await handler();
      const exampleText = result.contents[0].text;

      expect(exampleText).toContain('```javascript');
      expect(exampleText).toContain('semem_store_interaction');
      expect(exampleText).toContain('ragno_decompose_corpus');
      expect(exampleText).toContain('zpt_navigate');
    });
  });

  describe('Error Handling', () => {
    it('should handle resource generation errors gracefully', async () => {
      const { getMemoryManager } = await import('../../../../mcp/lib/initialization.js');
      getMemoryManager.mockImplementationOnce(() => {
        throw new Error('Service access failed');
      });

      registerStatusResources(mockServer);
      const handler = mockServer.resourceHandlers.get('semem://status').handler;

      // Should not throw, should return error information
      const result = await handler();
      expect(result.contents).toHaveLength(1);
      
      const statusData = JSON.parse(result.contents[0].text);
      expect(statusData.server).toBeDefined(); // Basic info should still be available
    });

    it('should handle concurrent resource access', async () => {
      registerStatusResources(mockServer);
      
      const handlers = [
        mockServer.resourceHandlers.get('semem://status').handler,
        mockServer.resourceHandlers.get('semem://docs/api').handler,
        mockServer.resourceHandlers.get('semem://config/current').handler
      ];

      // Should handle concurrent access without errors
      const results = await Promise.all(handlers.map(handler => handler()));
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toMatch(/^semem:\/\//);
      });
    });
  });
});