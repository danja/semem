import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer, initializeSemem } from '../../mcp/http-server.js';
import fetch from 'node-fetch';

describe('Semem MCP HTTP Transport', () => {
  let serverProcess = null;
  let client = null;
  let transport = null;
  const baseUrl = 'http://localhost:3001'; // Use different port for tests
  const mcpUrl = `${baseUrl}/mcp`;
  
  // Set test environment
  process.env.MCP_PORT = '3001';
  process.env.MCP_HOST = 'localhost';
  process.env.NODE_ENV = 'test';

  beforeAll(async () => {
    // Initialize Semem services
    const initialized = await initializeSemem();
    expect(initialized).toBe(true);

    // Start the HTTP server
    await startServer();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if server is running
    try {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.ok).toBe(true);
    } catch (error) {
      throw new Error(`Server not ready: ${error.message}`);
    }
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    // Server cleanup would happen via process signals in real usage
  });

  beforeEach(async () => {
    // Create fresh client for each test
    client = new Client({ 
      name: "semem-test-client", 
      version: "1.0.0" 
    });
    
    transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    await client.connect(transport);
  });

  describe('Server Health', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.services.memoryManager).toBe(true);
      expect(data.services.config).toBe(true);
    });

    it('should provide server info', async () => {
      const response = await fetch(`${baseUrl}/info`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.name).toBe('Semem HTTP MCP Server');
      expect(data.transport).toBe('StreamableHTTP');
      expect(data.integrationUrl).toBe(mcpUrl);
    });
  });

  describe('MCP Protocol', () => {
    it('should list available tools', async () => {
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.tools.map(tool => tool.name);
      expect(toolNames).toContain('semem_store_interaction');
      expect(toolNames).toContain('semem_retrieve_memories');
      expect(toolNames).toContain('semem_generate_embedding');
      expect(toolNames).toContain('semem_extract_concepts');
      expect(toolNames).toContain('semem_generate_response');
    });

    it('should list available resources', async () => {
      const resources = await client.listResources();
      expect(resources.resources.length).toBeGreaterThan(0);
      
      const resourceUris = resources.resources.map(r => r.uri);
      expect(resourceUris).toContain('semem://status');
    });

    it('should read system status resource', async () => {
      const status = await client.readResource({ uri: 'semem://status' });
      expect(status.contents.length).toBe(1);
      
      const statusData = JSON.parse(status.contents[0].text);
      expect(statusData.server.name).toBe('Semem HTTP MCP Server');
      expect(statusData.server.transport).toBe('StreamableHTTP');
      expect(statusData.services.memoryManagerInitialized).toBe(true);
      expect(statusData.services.configInitialized).toBe(true);
    });
  });

  describe('Semem Core Tools', () => {
    it('should extract concepts from text', async () => {
      const result = await client.callTool({
        name: 'semem_extract_concepts',
        arguments: {
          text: 'HTTP transport enables web-based MCP integration with server-sent events.'
        }
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.concepts).toBeInstanceOf(Array);
      expect(data.conceptCount).toBeGreaterThan(0);
    });

    it('should generate embeddings for text', async () => {
      const result = await client.callTool({
        name: 'semem_generate_embedding',
        arguments: {
          text: 'Test embedding generation for HTTP MCP transport'
        }
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.embedding).toBeInstanceOf(Array);
      expect(data.embeddingLength).toBeGreaterThan(0);
      expect(data.embedding.length).toBe(data.embeddingLength);
    });

    it('should store and retrieve interactions', async () => {
      // Store an interaction
      const storeResult = await client.callTool({
        name: 'semem_store_interaction',
        arguments: {
          prompt: 'What is HTTP MCP transport?',
          response: 'HTTP MCP transport uses StreamableHTTP for web-based integration.',
          metadata: { test: true, transport: 'http' }
        }
      });

      expect(storeResult.content.length).toBe(1);
      const storeData = JSON.parse(storeResult.content[0].text);
      expect(storeData.success).toBe(true);
      expect(storeData.hasEmbedding).toBe(true);

      // Retrieve the interaction
      const retrieveResult = await client.callTool({
        name: 'semem_retrieve_memories',
        arguments: {
          query: 'HTTP MCP transport',
          threshold: 0.5,
          limit: 1
        }
      });

      expect(retrieveResult.content.length).toBe(1);
      const retrieveData = JSON.parse(retrieveResult.content[0].text);
      expect(retrieveData.success).toBe(true);
      expect(retrieveData.count).toBeGreaterThan(0);
      expect(retrieveData.memories).toBeInstanceOf(Array);
    });

    it('should generate responses with memory context', async () => {
      // First store some context
      await client.callTool({
        name: 'semem_store_interaction',
        arguments: {
          prompt: 'What are the benefits of HTTP transport?',
          response: 'HTTP transport provides web accessibility, session management, and real-time streaming.',
          metadata: { context: 'benefits' }
        }
      });

      // Generate response with memory
      const result = await client.callTool({
        name: 'semem_generate_response',
        arguments: {
          prompt: 'Explain HTTP transport benefits',
          useMemory: true,
          temperature: 0.7
        }
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.response).toBeTruthy();
      expect(typeof data.response).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool calls gracefully', async () => {
      const result = await client.callTool({
        name: 'nonexistent_tool',
        arguments: {}
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('should handle missing required parameters', async () => {
      const result = await client.callTool({
        name: 'semem_extract_concepts',
        arguments: {} // Missing required 'text' parameter
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should handle empty text parameters', async () => {
      const result = await client.callTool({
        name: 'semem_extract_concepts',
        arguments: { text: '' }
      });

      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });

  describe('Session Management', () => {
    it('should maintain session across requests', async () => {
      // Make first request
      const result1 = await client.callTool({
        name: 'semem_extract_concepts',
        arguments: { text: 'Session test message' }
      });

      expect(result1.content.length).toBe(1);
      const data1 = JSON.parse(result1.content[0].text);
      expect(data1.success).toBe(true);

      // Make second request with same client
      const result2 = await client.callTool({
        name: 'semem_generate_embedding',
        arguments: { text: 'Another session test' }
      });

      expect(result2.content.length).toBe(1);
      const data2 = JSON.parse(result2.content[0].text);
      expect(data2.success).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const promises = [];
      const testTexts = [
        'Concurrent request test 1',
        'Concurrent request test 2', 
        'Concurrent request test 3'
      ];

      for (const text of testTexts) {
        promises.push(
          client.callTool({
            name: 'semem_extract_concepts',
            arguments: { text }
          })
        );
      }

      const results = await Promise.all(promises);
      
      for (const result of results) {
        expect(result.content.length).toBe(1);
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
      }
    }, 30000);
  });
});