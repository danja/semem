// MCP Server: JSON-RPC 2.0 implementation for Semem memory/resource management
import http from 'http';
import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import { SPARQLHelpers } from '../utils/SPARQLHelpers.js';
import SearchService from '../services/search/SearchService.js';
import EmbeddingService from '../services/embeddings/EmbeddingService.js';
import SPARQLService from '../services/embeddings/SPARQLService.js';
import { augmentWithAttributes } from '../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../ragno/aggregateCommunities.js';
import Config from '../Config.js';
import OllamaConnector from '../connectors/OllamaConnector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP Protocol Version
const LATEST_PROTOCOL_VERSION = '2025.1.0';

// JSON-RPC 2.0 Schema
const schema = {
  type: 'object',
  required: ['jsonrpc', 'method'],
  properties: {
    jsonrpc: { type: 'string', enum: ['2.0'] },
    method: { type: 'string' },
    params: { type: ['object', 'array'] },
    id: { type: ['string', 'number', 'null'] }
  }
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

// Load configuration
const config = new Config();
await config.init();

// Initialize cache manager
const cacheManager = new CacheManager({
  maxSize: 1000,
  ttl: 3600000 // 1 hour
});

// Load Ragno config
const ragnoConfigPath = path.resolve(__dirname, '../../docs/ragno/ragno-config.json');
const ragnoConfig = JSON.parse(await fs.readFile(ragnoConfigPath, 'utf-8'));

// Initialize LLM provider based on config
let llmProvider;
try {
  const providerConfig = config.get('llmProviders')?.find(p => p.type === 'ollama');
  if (!providerConfig) {
    console.warn('No Ollama provider configuration found, using defaults');
    const ollamaConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
    await ollamaConnector.initialize();
    llmProvider = {
      generateChat: ollamaConnector.generateChat.bind(ollamaConnector),
      generateCompletion: ollamaConnector.generateCompletion.bind(ollamaConnector),
      generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector),
      complete: ollamaConnector.generateCompletion.bind(ollamaConnector), // Alias for backward compatibility
      chat: ollamaConnector.generateChat.bind(ollamaConnector) // Alias for backward compatibility
    };
    console.log('LLM provider initialized with methods:', Object.keys(llmProvider));
  } else {
    const { baseUrl = 'http://localhost:11434', model = 'qwen2:1.5b' } = providerConfig;
    const ollamaConnector = new OllamaConnector(baseUrl, model);
    await ollamaConnector.initialize();
    
    llmProvider = {
      generateChat: ollamaConnector.generateChat.bind(ollamaConnector),
      generateCompletion: ollamaConnector.generateCompletion.bind(ollamaConnector),
      generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector),
      complete: ollamaConnector.generateCompletion.bind(ollamaConnector), // Alias for backward compatibility
      chat: ollamaConnector.generateChat.bind(ollamaConnector) // Alias for backward compatibility
    };
    console.log('LLM provider initialized with methods:', Object.keys(llmProvider));
  }
} catch (error) {
  console.error('Failed to initialize LLM provider:', error);
  process.exit(1);
}

// Initialize handlers
const llmHandler = new LLMHandler(
  llmProvider,
  config.get('chatModel') || 'qwen2:1.5b',
  config.get('llm.temperature') || 0.7
);

const embeddingHandler = new EmbeddingHandler(
  llmProvider,
  config.get('embeddingModel') || 'nomic-embed-text',
  ragnoConfig.ragno?.enrichment?.embedding?.dimensions || 768,
  cacheManager
);

// Initialize services
const sparqlConfig = config.get('sparqlEndpoints')?.[0] || {};
const sparqlService = new SPARQLService({
  queryEndpoint: process.env.SPARQL_QUERY_ENDPOINT || sparqlConfig.query,
  updateEndpoint: process.env.SPARQL_UPDATE_ENDPOINT || sparqlConfig.update,
  graphName: config.get('graphName') || 'http://danny.ayers.name/content',
  auth: {
    user: process.env.SPARQL_USER || sparqlConfig.user,
    password: process.env.SPARQL_PASSWORD || sparqlConfig.password
  }
});

const embeddingService = new EmbeddingService({
  model: config.get('embeddingModel'),
  dimension: ragnoConfig.ragno?.enrichment?.embedding?.dimensions || 768
});

const searchService = new SearchService({
  embeddingService,
  sparqlService,
  graphName: config.get('graphName') || 'http://danny.ayers.name/content',
  dimension: ragnoConfig.ragno?.enrichment?.embedding?.dimensions || 768
});

const PORT = process.env.MCP_PORT || 4100;

// Helper function to send JSON responses
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// JSON-RPC 2.0 Handler
async function handleJSONRPC(req, res, body) {
  try {
    // Validate JSON-RPC 2.0 request
    const valid = validate(body);
    if (!valid) {
      return send(res, 400, {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: validate.errors
        },
        id: null
      });
    }

    const { method, params = {}, id } = body;
    let result;

    // Handle different methods
    switch (method) {
      case 'listResources':
        result = [
          // SemanticUnit model
          {
            id: 'SemanticUnit_js',
            type: 'code',
            title: 'JS: SemanticUnit Model'
          },
          // LLM Handler
          {
            id: 'callLLM',
            type: 'service',
            title: 'Call LLMHandler',
            description: 'Call LLM for completions, summaries, or concept extraction. Params: {prompt, context, systemPrompt}'
          },
          // Embedding Handler
          {
            id: 'embedText',
            type: 'service',
            title: 'Generate Embedding',
            description: 'Generate embedding for text using EmbeddingHandler. Params: {text}'
          },
          // SPARQL Helpers
          {
            id: 'sparqlQuery',
            type: 'service',
            title: 'SPARQL SELECT Query',
            description: 'Run SPARQL SELECT query via SPARQLHelpers. Params: {endpoint, query, auth}'
          },
          {
            id: 'sparqlUpdate',
            type: 'service',
            title: 'SPARQL UPDATE',
            description: 'Run SPARQL UPDATE via SPARQLHelpers. Params: {endpoint, query, auth}'
          },
          // Search Service
          {
            id: 'searchGraph',
            type: 'service',
            title: 'Semantic Search',
            description: 'Semantic search using embeddings and Faiss. Params: {queryText, limit}'
          },
          // Ragno Pipeline
          {
            id: 'augmentGraph',
            type: 'service',
            title: 'Graph Attribute Augmentation',
            description: 'Augment a graph with LLM-generated attribute summaries. Params: {graph, options}'
          },
          {
            id: 'discoverCommunities',
            type: 'service',
            title: 'Community Detection',
            description: 'Detect and summarize communities in a graph. Params: {graph, options}'
          }
        ];
        break;

      case 'callLLM':
        try {
          const { prompt, context, systemPrompt } = params;
          if (!prompt) throw new Error('Missing required parameter: prompt');
          
          result = await llmHandler.generateResponse(
            prompt,
            context || '',
            systemPrompt || 'You are a helpful assistant.'
          );
        } catch (error) {
          console.error('Error in callLLM:', error);
          throw {
            code: -32000,
            message: 'LLM processing error',
            data: error.message
          };
        }
        break;

      case 'embedText':
        try {
          const { text } = params;
          if (!text) throw new Error('Missing required parameter: text');
          
          result = await embeddingHandler.generateEmbedding(text);
        } catch (error) {
          console.error('Error in embedText:', error);
          throw {
            code: -32001,
            message: 'Embedding generation error',
            data: error.message
          };
        }
        break;

      case 'sparqlQuery':
        try {
          const { endpoint, query, auth } = params;
          if (!endpoint || !query) throw new Error('Missing required parameters: endpoint, query');
          
          const headers = auth ? { 'Authorization': SPARQLHelpers.createAuthHeader(auth.user, auth.password) } : {};
          result = await SPARQLHelpers.executeSPARQLQuery(endpoint, query, headers);
        } catch (error) {
          console.error('Error in sparqlQuery:', error);
          throw {
            code: -32002,
            message: 'SPARQL query error',
            data: error.message
          };
        }
        break;

      case 'sparqlUpdate':
        try {
          const { endpoint, query, auth } = params;
          if (!endpoint || !query) throw new Error('Missing required parameters: endpoint, query');
          
          const headers = auth ? { 'Authorization': SPARQLHelpers.createAuthHeader(auth.user, auth.password) } : {};
          result = await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, headers);
        } catch (error) {
          console.error('Error in sparqlUpdate:', error);
          throw {
            code: -32003,
            message: 'SPARQL update error',
            data: error.message
          };
        }
        break;

      case 'searchGraph':
        try {
          const { queryText, limit = 5 } = params;
          if (!queryText) throw new Error('Missing required parameter: queryText');
          
          result = await searchService.search(queryText, { limit });
        } catch (error) {
          console.error('Error in searchGraph:', error);
          throw {
            code: -32004,
            message: 'Graph search error',
            data: error.message
          };
        }
        break;

      case 'augmentGraph':
        try {
          const { graph, options = {} } = params;
          if (!graph) throw new Error('Missing required parameter: graph');
          
          result = await augmentWithAttributes(
            graph,
            async (text) => await embeddingHandler.generateEmbedding(text),
            options
          );
        } catch (error) {
          console.error('Error in augmentGraph:', error);
          throw {
            code: -32005,
            message: 'Graph augmentation error',
            data: error.message
          };
        }
        break;

      case 'discoverCommunities':
        try {
          const { graph, options = {} } = params;
          if (!graph) throw new Error('Missing required parameter: graph');
          
          result = await aggregateCommunities(
            graph,
            async (text) => await embeddingHandler.generateEmbedding(text),
            options
          );
        } catch (error) {
          console.error('Error in discoverCommunities:', error);
          throw {
            code: -32006,
            message: 'Community detection error',
            data: error.message
          };
        }
        break;

      default:
        throw {
          code: -32601,
          message: 'Method not found',
          data: `Unknown method: ${method}`
        };
    }

    // Send successful response
    send(res, 200, {
      jsonrpc: '2.0',
      result,
      id
    });

  } catch (error) {
    // Handle errors
    console.error('Error handling request:', error);
    send(res, 200, {
      jsonrpc: '2.0',
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data
      },
      id: body?.id || null
    });
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body);
    await handleJSONRPC(req, res, data);
  } catch (error) {
    console.error('Error processing request:', error);
    send(res, 500, {
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
        data: error.message
      },
      id: null
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}/ (protocol ${LATEST_PROTOCOL_VERSION})`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
