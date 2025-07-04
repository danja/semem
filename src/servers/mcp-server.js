#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import http from 'http';
import express from 'express';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

// Import our existing handlers and services
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import SPARQLHelpers from '../services/sparql/SPARQLHelper.js';
import SearchService from '../services/search/SearchService.js';
import { augmentWithAttributes } from '../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../ragno/aggregateCommunities.js';
import Config from '../Config.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define schemas for our methods
const SearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(10)
});

const EmbeddingRequestSchema = z.object({
  text: z.string()
});

// Create MCP server with handlers
export function createMCPServer() {
  // Initialize server with basic info
  const server = new Server(
    {
      name: 'semem/mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: { subscribe: true },
        tools: {},
        completions: {}
      }
    }
  );

  // Initialize services
  const config = new Config(path.join(process.cwd(), 'config', 'config.json'));
  await config.init();
  
  const cacheManager = new CacheManager({
    maxSize: 1000,
    ttl: 3600000 // 1 hour
  });

  // Initialize LLM and embedding providers based on config
  const llmProvider = await initializeLLMProvider(config);
  const embeddingProvider = await initializeEmbeddingProvider(config);
  const llmHandler = new LLMHandler(llmProvider, cacheManager);
  const embeddingHandler = new EmbeddingHandler(embeddingProvider, cacheManager);
  const sparqlHelpers = new SPARQLHelpers(config.get('sparqlEndpoints'));
  const searchService = new SearchService(sparqlHelpers, embeddingHandler);

  // Track subscriptions
  const subscriptions = new Set();
  let updateInterval;

  // Register RPC methods with proper schemas
  server.setRequestHandler('semem/search', SearchRequestSchema, async (request) => {
    try {
      const { query, limit } = request.params;
      const results = await searchService.search(query, { limit });
      return { results };
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  });

  server.setRequestHandler('semem/generateEmbedding', EmbeddingRequestSchema, async (request) => {
    try {
      const { text } = request.params;
      const embedding = await embeddingHandler.generateEmbedding(text);
      return { embedding };
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  });

  // Start the update interval
  updateInterval = setInterval(() => {
    for (const uri of subscriptions) {
      server.notification({
        method: 'notifications/resources/updated',
        params: { uri }
      });
    }
  }, 30000);

  // Cleanup function
  async function cleanup() {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  }

  
  return { server, cleanup };
}

/**
 * Initialize the appropriate LLM provider based on config
 */
async function initializeLLMProvider(config) {
  const providers = (config.get('llmProviders') || []).sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  for (const provider of providers) {
    try {
      switch (provider.type.toLowerCase()) {
        case 'ollama':
          const { OllamaConnector } = await import('../connectors/OllamaConnector.js');
          return new OllamaConnector(provider);
          
        case 'claude':
          const { ClaudeConnector } = await import('../connectors/ClaudeConnector.js');
          return new ClaudeConnector(provider);
          
        case 'mistral':
          const { MistralConnector } = await import('../connectors/MistralConnector.js');
          return new MistralConnector(provider);
      }
    } catch (error) {
      console.warn(`Failed to initialize ${provider.type} provider:`, error);
    }
  }
  
  throw new Error('No valid LLM provider could be initialized');
}

/**
 * Initialize embedding provider using factory
 */
async function initializeEmbeddingProvider(config) {
  try {
    // Get embedding provider configuration
    const embeddingProvider = config.get('embeddingProvider') || 'ollama';
    const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
    
    console.log(`Creating embedding connector: ${embeddingProvider} (${embeddingModel})`);
    
    // Create embedding connector using factory
    let providerConfig = {};
    if (embeddingProvider === 'nomic') {
      providerConfig = {
        provider: 'nomic',
        apiKey: process.env.NOMIC_API_KEY,
        model: embeddingModel
      };
    } else if (embeddingProvider === 'ollama') {
      const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
      providerConfig = {
        provider: 'ollama',
        baseUrl: ollamaBaseUrl,
        model: embeddingModel
      };
    }
    
    return EmbeddingConnectorFactory.createConnector(providerConfig);
    
  } catch (error) {
    console.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
    // Fallback to Ollama for embeddings
    return EmbeddingConnectorFactory.createConnector({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'nomic-embed-text'
    });
  }
}

// Start server based on command line arguments
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'http';

  try {
    const { server, cleanup } = await createMCPServer();

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
          const result = await server.handleRequest(req.body);
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

    // Handle process termination
    process.on('SIGINT', async () => {
      await cleanup();
      await server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
