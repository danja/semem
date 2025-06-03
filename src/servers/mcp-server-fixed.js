#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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
import { SPARQLHelpers } from '../utils/SPARQLHelpers.js';
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
  // Initialize server with basic info and required capabilities
  const server = new Server({
    name: 'semem/mcp',
    version: '1.0.0',
    description: 'Semem MCP Server',
    capabilities: {
      resources: { 
        list: true,
        read: true,
        subscribe: true
      },
      tools: {
        list: true,
        execute: true
      },
      completions: {
        complete: true
      },
      logging: {
        setLevel: true
      }
    }
  });

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

  // Register resource listing endpoint first, before other methods
  server.setRequestHandler('resources/list', ListResourcesRequestSchema, async () => {
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

// Start server based on command line arguments
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'http';

  try {
    const server = await createServer();

    // Handle different transport modes
    if (mode === 'stdio') {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('MCP server running in STDIO mode');
    } 
    else if (mode === 'sse') {
      const app = express();
      const httpServer = http.createServer(app);
      const port = process.env.MCP_PORT || 4100;
      
      app.use(express.json());
      
      const transport = new SSEServerTransport({
        server: httpServer,
        path: '/mcp'
      });
      
      await server.connect(transport);
      
      httpServer.listen(port, () => {
        console.error(`MCP server running in SSE mode on port ${port}`);
      });
    }
    else { // HTTP mode (default)
      const app = express();
      const port = process.env.MCP_PORT || 4100;
      
      app.use(express.json());
      
      app.post('/', async (req, res) => {
        try {
          const result = await server.handleRequest({
            jsonrpc: '2.0',
            id: req.body?.id || Date.now().toString(),
            method: req.body?.method,
            params: req.body?.params || {}
          });
          res.json(result);
        } catch (error) {
          console.error('Request error:', error);
          res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error.message
            }
          });
        }
      });
      
      app.listen(port, () => {
        console.error(`MCP server running in HTTP mode on port ${port}`);
      });
    }

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
