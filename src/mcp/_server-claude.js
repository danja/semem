// MCP Server: JSON-RPC 2.0 implementation for Semem with Claude LLM
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
import ClaudeConnector from '../connectors/ClaudeConnector.js';

dotenv.config({ path: '../../.env.claude' });

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

// Initialize Claude LLM provider
let llmProvider;
try {
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  if (!claudeApiKey) {
    throw new Error('CLAUDE_API_KEY is not set in environment variables');
  }

  const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
  console.log(`Initializing Claude with model: ${claudeModel}`);
  
  const claudeConnector = new ClaudeConnector(claudeApiKey, claudeModel);
  await claudeConnector.initialize();
  
  llmProvider = {
    generateChat: claudeConnector.generateChat.bind(claudeConnector),
    generateCompletion: claudeConnector.generateCompletion.bind(claudeConnector),
    generateEmbedding: claudeConnector.generateEmbedding.bind(claudeConnector),
    complete: claudeConnector.generateCompletion.bind(claudeConnector), // Alias for backward compatibility
    chat: claudeConnector.generateChat.bind(claudeConnector) // Alias for backward compatibility
  };
  
  console.log('Claude LLM provider initialized with methods:', Object.keys(llmProvider));
} catch (error) {
  console.error('Failed to initialize Claude LLM provider:', error);
  process.exit(1);
}

// Initialize handlers
const llmHandler = new LLMHandler(
  llmProvider,
  process.env.CHAT_MODEL || 'claude-3-opus-20240229',
  parseFloat(process.env.LLM_TEMPERATURE || '0.7')
);

const embeddingHandler = new EmbeddingHandler(
  llmProvider,
  process.env.EMBEDDING_MODEL || 'claude-3-opus-20240229',
  parseInt(process.env.EMBEDDING_DIMENSION || '1536'),
  cacheManager
);

// Initialize SPARQL service
const sparqlService = new SPARQLService({
  queryEndpoint: process.env.SPARQL_QUERY_ENDPOINT,
  updateEndpoint: process.env.SPARQL_UPDATE_ENDPOINT,
  user: process.env.SPARQL_USER,
  password: process.env.SPARQL_PASSWORD
});

// Initialize embedding service
const embeddingService = new EmbeddingService({
  embeddingHandler,
  sparqlService,
  graphName: process.env.SPARQL_GRAPH_NAME || 'http://example.org/semem'
});

// Initialize search service
const searchService = new SearchService({
  embeddingService,
  sparqlService,
  graphName: process.env.SPARQL_GRAPH_NAME || 'http://example.org/semem'
});

// Helper function to send JSON responses
function send(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

// JSON-RPC 2.0 Handler
async function handleJSONRPC(req, res, body) {
  // ... (keep the existing handleJSONRPC implementation from server-fixed.js)
  // This function can be copied as-is from the original server-fixed.js
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
        code: -32603,
        message: 'Internal error',
        data: error.message
      },
      id: null
    });
  }
});

// Start server
const port = parseInt(process.env.MCP_PORT || '4100');
server.listen(port, '0.0.0.0', () => {
  console.log(`MCP server running on http://localhost:${port}/ (protocol ${LATEST_PROTOCOL_VERSION})`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

export default server;
