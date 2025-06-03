import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import http from 'http';
import express from 'express';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

// Import services and handlers
import Config from '../Config.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import MistralConnector from '../connectors/MistralConnector.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import SPARQLService from '../services/embeddings/SPARQLService.js';
import EmbeddingService from '../services/embeddings/EmbeddingService.js';
import SearchService from '../services/search/SearchService.js';
import { augmentWithAttributes } from '../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../ragno/aggregateCommunities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Service instances
let config;
let cacheManager;
let llmProvider;
let llmHandler;
let embeddingHandler;
let sparqlService;
let embeddingService;
let searchService;

// Initialize configuration
async function initializeConfig() {
  const configPath = path.join(process.cwd(), 'config', 'config.json');
  console.log('Loading config from:', configPath);
  config = new Config(configPath);
  await config.init();

  // Initialize cache manager
  cacheManager = new CacheManager({
    maxSize: 1000,
    ttl: 3600000 // 1 hour
  });
}

// Initialize LLM provider
async function initializeLLMProvider() {
  try {
    // Get all configured providers and sort by priority
    const providers = (config.get('llmProviders') || []).sort((a, b) => 
      (a.priority || 999) - (b.priority || 999)
    );

    console.log('Configured LLM providers:', JSON.stringify(providers, null, 2));
    
    for (const providerConfig of providers) {
      try {
        let connector;
        
        switch (providerConfig.type) {
          case 'ollama':
            console.log(`Initializing Ollama provider with model: ${providerConfig.chatModel}`);
            const { baseUrl = 'http://localhost:11434', chatModel = 'qwen2:1.5b' } = providerConfig;
            connector = new OllamaConnector({
              baseUrl,
              chatModel,
              embeddingModel: providerConfig.embeddingModel
            });
            await connector.initialize();
            
            llmProvider = {
              type: 'ollama',
              generateChat: connector.generateChat.bind(connector),
              generateCompletion: connector.generateCompletion.bind(connector),
              generateEmbedding: connector.generateEmbedding?.bind(connector) || (() => Promise.resolve([]))
            };
            console.log('Ollama provider initialized successfully');
            return;
            
          case 'claude':
            console.log(`Initializing Claude provider with model: ${providerConfig.chatModel}`);
            if (!providerConfig.apiKey) {
              console.warn('Skipping Claude provider: Missing API key');
              continue;
            }
            
            connector = new ClaudeConnector(
              providerConfig.apiKey,
              providerConfig.chatModel || 'claude-3-opus-20240229'
            );
            await connector.initialize();
            
            llmProvider = {
              type: 'claude',
              generateChat: connector.generateChat.bind(connector),
              generateCompletion: connector.generateCompletion.bind(connector),
              generateEmbedding: connector.generateEmbedding?.bind(connector) || (() => Promise.resolve([]))
            };
            console.log('Claude provider initialized successfully');
            return;
            
          case 'mistral':
            console.log(`Initializing Mistral provider with model: ${providerConfig.chatModel}`);
            if (!providerConfig.apiKey) {
              console.warn('Skipping Mistral provider: Missing API key');
              continue;
            }
            
            connector = new MistralConnector(
              providerConfig.apiKey,
              providerConfig.baseUrl || 'https://api.mistral.ai/v1',
              providerConfig.chatModel || 'mistral-medium'
            );
            await connector.initialize();
            
            llmProvider = {
              type: 'mistral',
              generateChat: connector.generateChat.bind(connector),
              generateCompletion: connector.generateCompletion.bind(connector),
              generateEmbedding: connector.generateEmbedding?.bind(connector) || (() => Promise.resolve([]))
            };
            console.log('Mistral provider initialized successfully');
            return;
        }
      } catch (error) {
        console.error(`Failed to initialize ${providerConfig.type} provider:`, error);
        continue;
      }
    }
    
    // Fallback to mock provider if no providers were successfully initialized
    console.warn('No valid LLM provider found, using mock provider');
    llmProvider = {
      type: 'mock',
      generateChat: async () => 'Mock response: No LLM provider configured',
      generateCompletion: async () => 'Mock response: No LLM provider configured',
      generateEmbedding: async () => Array(1536).fill(0)
    };
  } catch (error) {
    console.error('Failed to initialize LLM provider:', error);
    throw error;
  }
}

// Initialize services
async function initializeServices() {
  await initializeConfig();
  await initializeLLMProvider();
  
  // Initialize handlers
  llmHandler = new LLMHandler(
    llmProvider,
    config.get('chatModel') || 'qwen2:1.5b',
    config.get('llm.temperature') || 0.7
  );

  embeddingHandler = new EmbeddingHandler(
    llmProvider,
    config.get('embeddingModel') || 'nomic-embed-text',
    768, // Default dimension
    cacheManager
  );

  // Initialize SPARQL service
  const sparqlConfig = config.get('sparqlEndpoints')?.[0] || {};
  sparqlService = new SPARQLService({
    queryEndpoint: process.env.SPARQL_QUERY_ENDPOINT || sparqlConfig.query,
    updateEndpoint: process.env.SPARQL_UPDATE_ENDPOINT || sparqlConfig.update,
    graphName: config.get('graphName') || 'http://danny.ayers.name/content',
    auth: {
      user: process.env.SPARQL_USER || sparqlConfig.user,
      password: process.env.SPARQL_PASSWORD || sparqlConfig.password
    }
  });

  embeddingService = new EmbeddingService({
    model: config.get('embeddingModel'),
    dimension: 768 // Default dimension
  });

  searchService = new SearchService({
    embeddingService,
    sparqlService,
    graphName: config.get('graphName') || 'http://danny.ayers.name/content',
    dimension: 768 // Default dimension
  });
}

// Create MCP server with handlers
export function createMCPServer() {
  const server = new Server(
    {
      name: "semem/mcp-server",
      version: "1.0.0",
      description: "Semantic Memory MCP Server"
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
        completions: {}
      }
    }
  );

  // Track subscriptions
  const subscriptions = new Set();
  let updateInterval;

  // Set up periodic updates for subscribed resources
  function startUpdateInterval() {
    updateInterval = setInterval(() => {
      for (const uri of subscriptions) {
        server.notification({
          method: "notifications/resources/updated",
          params: { uri },
        });
      }
    }, 30000); // Update every 30 seconds
  }

  // Cleanup function
  async function cleanup() {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  }

  // Define schemas for our methods
  const SearchRequestSchema = z.object({
    query: z.string(),
    limit: z.number().optional().default(10)
  });

  const EmbeddingRequestSchema = z.object({
    text: z.string()
  });

  // Register RPC methods with proper schemas
  server.setRequestHandler({
    method: 'semem/search',
    handler: async (request) => {
      try {
        const { query, limit } = request.params;
        const results = await searchService.search(query, { limit });
        return { results };
      } catch (error) {
        console.error('Search error:', error);
        throw new Error(`Search failed: ${error.message}`);
      }
    },
    params: SearchRequestSchema
  });

  server.setRequestHandler({
    method: 'semem/generateEmbedding',
    handler: async (request) => {
      try {
        const { text } = request.params;
        const embedding = await embeddingHandler.generateEmbedding(text);
        return { embedding };
      } catch (error) {
        console.error('Embedding generation error:', error);
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
    },
    params: EmbeddingRequestSchema
  });

  // Start the update interval
  startUpdateInterval();

  return { server, cleanup };
}

// Start server based on command line arguments
async function main() {
  try {
    // Initialize services
    await initializeServices();

    const args = process.argv.slice(2);
    const mode = args[0] || 'http';

    const { server, cleanup } = createMCPServer();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down MCP server...');
      await cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    if (mode === 'stdio') {
      // Start in STDIO mode
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.log('MCP Server running in STDIO mode');
    } else if (mode === 'sse') {
      // Start in SSE mode
      const app = express();
      const PORT = process.env.PORT || 4100;
      const transports = new Map();

      app.get("/sse", async (req, res) => {
        const transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
        transports.set(transport.sessionId, transport);

        transport.onClose = () => {
          transports.delete(transport.sessionId);
        };
      });

      app.post("/message", express.json(), async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = transports.get(sessionId);
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(404).send("Session not found");
        }
      });

      app.listen(PORT, () => {
        console.log(`MCP Server running in SSE mode on port ${PORT}`);
      });
    } else {
      // Default to HTTP mode
      const PORT = process.env.MCP_PORT || 4100;
      const httpServer = http.createServer(async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const response = await server.request(request);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            console.error('Error handling request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Internal Server Error',
              message: error.message 
            }));
          }
        });
      });

      httpServer.on('error', (err) => {
        console.error('HTTP server error:', err);
      });

      httpServer.listen(PORT, () => {
        console.log(`MCP Server running in HTTP mode on port ${PORT}`);
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
