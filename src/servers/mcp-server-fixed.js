#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ToolSchema,
  ResourceReferenceSchema
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import express from 'express';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

// Import our existing handlers and services
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import SPARQLHelpers from '../utils/SPARQLHelpers.js';
import SearchService from '../services/search/SearchService.js';
import Config from '../Config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define schemas for our methods using MCP SDK schemas as base
const SearchRequestSchema = z.object({
  method: z.literal('semem/search'),
  params: z.object({
    query: z.string(),
    limit: z.number().optional().default(10)
  })
});

const EmbeddingRequestSchema = z.object({
  method: z.literal('semem/generateEmbedding'),
  params: z.object({
    text: z.string()
  })
});

// Response schemas
const SearchResponseSchema = z.object({
  results: z.array(z.any())
});

const EmbeddingResponseSchema = z.object({
  embedding: z.array(z.number())
});

// Resource schemas matching MCP SDK expectations
const ResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional()
});

// Align with MCP SDK's expected format for resource listing
const ListResourcesResponseSchema = z.object({
  resources: z.array(ResourceSchema)
});

// ListResourcesRequestSchema is imported from @modelcontextprotocol/sdk/types.js

// Create MCP server with handlers
export async function createServer() {
  console.error('Creating MCP server...');

  // Initialize server with basic info and required capabilities
  const serverCapabilities = {
    resources: { list: true, read: true, subscribe: true },
    tools: { list: true, execute: true },
    completions: { complete: true },
    logging: { setLevel: true }
  };

  const serverInfo = {
    name: 'semem/mcp',
    version: '1.0.0',
    description: 'Semem MCP Server'
  };

  console.error('Server capabilities:', JSON.stringify(serverCapabilities, null, 2));
  console.error('Server info:', JSON.stringify(serverInfo, null, 2));

  // Create the MCP server instance
  const server = new Server(serverInfo, {
    capabilities: serverCapabilities
  });

  console.error('MCP server instance created successfully');

  // Register a simple handler for the resources/list method
  server.setRequestHandler({
    method: 'resources/list',
    handler: async () => {
      console.error('Handling resources/list request');
      return {
        resources: [
          {
            uri: 'semem://semem/resources',
            name: 'Semem Resources',
            description: 'Semem knowledge graph resources',
            resourceType: 'semem:KnowledgeGraph',
            access: {
              read: true,
              write: true
            }
          }
        ]
      };
    }
  });

  console.error('Registered resources/list handler');

  // Register a simple handler for search requests
  server.setRequestHandler({
    method: 'semem/search',
    handler: async (params) => {
      console.error('Handling semem/search request with params:', params);
      // Implement search functionality here
      return {
        results: []
      };
    }
  });

  console.error('Registered semem/search handler');

  // Register a simple handler for embedding generation
  server.setRequestHandler({
    method: 'semem/generateEmbedding',
    handler: async (params) => {
      console.error('Handling semem/generateEmbedding request with params:', params);
      // Implement embedding generation here
      return {
        embedding: []
      };
    }
  });

  console.error('Registered semem/generateEmbedding handler');

  // Initialize services
  const config = new Config(path.join(process.cwd(), 'config', 'config.json'));
  await config.init();

  const cacheManager = new CacheManager({
    maxSize: 1000,
    ttl: 3600000 // 1 hour
  });

  // Initialize LLM provider based on config
  const llmProvider = await initializeLLMProvider(config);
  const llmHandler = new LLMHandler(llmProvider, cacheManager);
  const embeddingHandler = new EmbeddingHandler(llmProvider, cacheManager);
  const sparqlHelpers = new SPARQLHelpers(config.get('sparqlEndpoints'));
  const searchService = new SearchService(sparqlHelpers, embeddingHandler);

  // Register methods following the MCP SDK pattern
  // Register search endpoint
  server.setRequestHandler(SearchRequestSchema, async (request) => {
    try {
      const { query, limit } = request.params;
      const results = await searchService.search(query, { limit });
      return SearchResponseSchema.parse({ results });
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  });

  // Register embedding generation endpoint
  server.setRequestHandler(EmbeddingRequestSchema, async (request) => {
    try {
      const { text } = request.params;
      const embedding = await embeddingHandler.generateEmbedding(text);
      return EmbeddingResponseSchema.parse({ embedding });
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  });

  // Register search endpoint
  server.setRequestHandler(SearchRequestSchema, async (request) => {
    try {
      const { query, limit } = request.params;
      const results = await searchService.search(query, { limit });
      return { results };
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  });

  // Register embedding generation endpoint
  server.setRequestHandler(EmbeddingRequestSchema, async (request) => {
    try {
      const { text } = request.params;
      const embedding = await embeddingHandler.generateEmbedding(text);
      return { embedding };
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  });

  // Register resource listing endpoint
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'semem/search',
          name: 'Search',
          description: 'Search the knowledge graph',
          inputSchema: SearchRequestSchema.shape.params,
          outputSchema: SearchResponseSchema.shape
        },
        {
          uri: 'semem/generateEmbedding',
          name: 'Generate Embedding',
          description: 'Generate an embedding for the given text',
          inputSchema: EmbeddingRequestSchema.shape.params,
          outputSchema: EmbeddingResponseSchema.shape
        }
      ]
    };
  });

  return server;
}

/**
 * Initialize the appropriate LLM provider based on config
 */
async function initializeLLMProvider(config) {
  let providers = config.get('llmProviders') || [];

  // If no providers configured, try to create a default one based on environment
  if (providers.length === 0) {
    console.warn('No LLM providers configured in config.json, checking environment...');
    if (process.env.CLAUDE_API_KEY) {
      providers.push({
        type: 'claude',
        model: 'claude-3-opus-20240229',
        priority: 1
      });
    } else if (process.env.OLLAMA_API_KEY || process.env.OLLAMA_HOST) {
      providers.push({
        type: 'ollama',
        model: 'qwen2:1.5b',
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        priority: 2
      });
    }
  }

  // Sort providers by priority
  providers = providers.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  for (const provider of providers) {
    try {
      console.log(`Attempting to initialize ${provider.type} provider...`);

      // Get the provider's API key from environment variables or config
      let apiKey = provider.apiKey || '';

      // Handle environment variable substitution (e.g., ${VARIABLE} syntax)
      if (apiKey.startsWith('${') && apiKey.endsWith('}')) {
        const envVar = apiKey.slice(2, -1); // Remove ${ and }
        apiKey = process.env[envVar] || '';
      }

      // If still no API key, try the conventional environment variable name
      if (!apiKey) {
        apiKey = process.env[`${provider.type.toUpperCase()}_API_KEY`] ||
          process.env[`${provider.type}_api_key`] ||
          '';
      }

      if (!apiKey) {
        console.warn(`No API key found for ${provider.type}. Tried: ${provider.apiKey || 'N/A'}, ${provider.type.toUpperCase()}_API_KEY, ${provider.type}_api_key`);
        continue;
      }

      let connector;
      switch (provider.type.toLowerCase()) {
        case 'ollama':
          const ollamaModule = await import('../connectors/OllamaConnector.js');
          // Check if the module has a default export or is the constructor itself
          connector = ollamaModule.default ?
            new ollamaModule.default(apiKey, provider.model) :
            new ollamaModule(apiKey, provider.model);
          break;

        case 'claude':
          const claudeModule = await import('../connectors/ClaudeConnector.js');
          connector = claudeModule.default ?
            new claudeModule.default(apiKey, provider.model) :
            new claudeModule(apiKey, provider.model);
          break;

        case 'mistral':
          const mistralModule = await import('../connectors/MistralConnector.js');
          connector = mistralModule.default ?
            new mistralModule.default(apiKey, provider.model) :
            new mistralModule(apiKey, provider.model);
          break;

        default:
          console.warn(`Unsupported provider type: ${provider.type}`);
          continue;
      }

      if (connector) {
        console.log(`Successfully initialized ${provider.type} provider`);
        return connector;
      }
    } catch (error) {
      console.warn(`Failed to initialize ${provider.type} provider:`, error);
    }
  }

  const triedProviders = providers.map(p => p.type).join(', ') || 'none';
  console.error('No valid LLM provider could be initialized. Tried providers:', triedProviders);
  console.error('Please check your configuration and environment variables.');
  throw new Error(`No valid LLM provider could be initialized. Tried: ${triedProviders}`);
}

// Map to store active sessions and their transports
const sessions = new Map();

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActive > timeout) {
      console.log(`Cleaning up inactive session: ${sessionId}`);
      if (session.transport && typeof session.transport.close === 'function') {
        session.transport.close().catch(error => {
          console.error(`Error closing transport for session ${sessionId}:`, error);
        });
      }
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Handle MCP HTTP requests
async function handleMcpRequest(req, res) {
  try {
    const sessionId = req.headers['mcp-session-id'];
    let session = sessionId ? sessions.get(sessionId) : null;

    // Handle new session initialization
    if (!session && req.body?.method === 'initialize') {
      const newSessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create a new transport for this session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (sid) => {
          console.log(`Session initialized: ${sid}`);
        },
        onerror: (error) => {
          console.error(`Transport error for session ${newSessionId}:`, error);
        }
      });

      // Create MCP server instance
      const server = await createServer();
      await server.connect(transport);

      // Store the session
      session = {
        transport,
        lastActive: Date.now(),
        id: newSessionId
      };
      sessions.set(newSessionId, session);

      // Set session ID in response header
      res.setHeader('mcp-session-id', newSessionId);
    }
    // Handle existing session
    else if (session) {
      session.lastActive = Date.now();
    }
    // Invalid request - no session ID and not an initialization request
    else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid session. Please initialize a new session first.'
        },
        id: req.body?.id || null
      });
      return;
    }

    // Handle the request with the transport
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error.message
        },
        id: req.body?.id || null
      });
    }
  }
}

// Start server based on command line arguments
async function main() {
  const mode = process.argv[2] || 'http';

  try {
    if (mode === 'http') {
      console.log('Starting MCP HTTP server...');

      const app = express();
      app.use(express.json());

      // Handle MCP requests
      app.post('/mcp', handleMcpRequest);

      // Handle SSE connections
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId || !sessions.has(sessionId)) {
          return res.status(400).send('Invalid or missing session ID');
        }

        const session = sessions.get(sessionId);
        session.lastActive = Date.now();

        try {
          await session.transport.handleRequest(req, res);
        } catch (error) {
          console.error('Error handling SSE request:', error);
          if (!res.headersSent) {
            res.status(500).send('Internal server error');
          }
        }
      });

      // Handle session termination
      app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId || !sessions.has(sessionId)) {
          return res.status(400).send('Invalid or missing session ID');
        }

        console.log(`Terminating session: ${sessionId}`);
        const session = sessions.get(sessionId);

        try {
          await session.transport.handleRequest(req, res);
          sessions.delete(sessionId);
        } catch (error) {
          console.error('Error terminating session:', error);
          if (!res.headersSent) {
            res.status(500).send('Error terminating session');
          }
        }
      });

      const port = process.env.MCP_PORT || 4100;
      app.listen(port, () => {
        console.log(`MCP HTTP server listening on port ${port}`);
        console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      });

    } else if (mode === 'stdio') {
      console.log('Starting MCP server in stdio mode...');

      const server = await createServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);

      console.log('MCP server running in stdio mode');

    } else if (mode === 'sse') {
      console.log('Starting MCP server in SSE mode...');

      const app = express();
      const httpServer = http.createServer(app);
      const port = process.env.MCP_PORT || 4100;

      const server = await createServer();
      const transport = new SSEServerTransport({
        server: httpServer,
        path: '/mcp'
      });

      await server.connect(transport);

      httpServer.listen(port, () => {
        console.log(`MCP SSE server listening on port ${port}`);
        console.log(`MCP SSE endpoint: http://localhost:${port}/mcp`);
      });

    } else {
      console.error(`Unknown mode: ${mode}`);
      console.error('Usage: node mcp-server-fixed.js [http|stdio|sse]');
      process.exit(1);
    }

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
