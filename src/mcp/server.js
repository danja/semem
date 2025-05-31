// MCP Server: JSON-RPC 2.0 implementation for Semem memory/resource management
import http from 'http';
import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { LATEST_PROTOCOL_VERSION } from '../types/mcp-schema.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import { SPARQLHelpers } from '../utils/SPARQLHelpers.js';
import SearchService from '../services/search/SearchService.js';
import EmbeddingService from '../services/embeddings/EmbeddingService.js';
import SPARQLService from '../services/embeddings/SPARQLService.js';
import { augmentWithAttributes } from '../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../ragno/aggregateCommunities.js';

// Load MCP JSON Schema
const schemaPath = path.resolve('src/types/mcp-schema.json');
const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

// Load Ragno config and instantiate LLMHandler
const ragnoConfigPath = path.resolve('docs/ragno/ragno-config.json');
const ragnoConfig = JSON.parse(await fs.readFile(ragnoConfigPath, 'utf-8'));
const llmProvider = {
  async generateChat(model, messages, options) {
    // Dummy provider: echo prompt for dev/test; replace with real provider
    return `LLM(${model}): ${messages.map(m => m.content).join(' ')}`;
  }
};
const llmHandler = new LLMHandler(
  llmProvider,
  ragnoConfig.ragno.decomposition.llm.model,
  ragnoConfig.ragno.decomposition.llm.temperature
);

// EmbeddingHandler setup
const embeddingProvider = {
  async generateEmbedding(model, text) {
    // Dummy: returns a fixed vector for dev/test; replace with real provider
    return Array(ragnoConfig.ragno.enrichment.embedding.dimensions).fill(text.length % 7);
  }
};
const cacheManager = { get: () => undefined, set: () => {} };
const embeddingHandler = new EmbeddingHandler(
  embeddingProvider,
  ragnoConfig.ragno.enrichment.embedding.model,
  ragnoConfig.ragno.enrichment.embedding.dimensions,
  cacheManager
);

// Set up real embedding and SPARQL services for search
const embeddingService = new EmbeddingService({
  model: ragnoConfig.ragno.enrichment.embedding.model,
  dimension: ragnoConfig.ragno.enrichment.embedding.dimensions
});
const sparqlService = new SPARQLService({
  queryEndpoint: process.env.SPARQL_QUERY_ENDPOINT || 'http://localhost:4030/semem/query',
  updateEndpoint: process.env.SPARQL_UPDATE_ENDPOINT || 'http://localhost:4030/semem/update',
  graphName: ragnoConfig.ragno.graphName || 'http://danny.ayers.name/content',
  auth: {
    user: process.env.SPARQL_USER || 'admin',
    password: process.env.SPARQL_PASSWORD || 'admin123'
  }
});
const searchService = new SearchService({
  embeddingService,
  sparqlService,
  graphName: ragnoConfig.ragno.graphName || 'http://danny.ayers.name/content',
  dimension: ragnoConfig.ragno.enrichment.embedding.dimensions
});

const PORT = process.env.MCP_PORT || 4100;

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function handleJSONRPC(req, res, body) {
  let msg;
  try {
    msg = JSON.parse(body);
  } catch (e) {
    return send(res, 400, { error: 'Invalid JSON' });
  }
  if (!validate(msg)) {
    return send(res, 400, { error: 'Schema validation failed', details: validate.errors });
  }

  // Resource registry: map resource IDs to files
  // MCP resource registry: advertise all available Ragno/Semem facilities
  const resources = {
    // Core documentation ... (as before)
    // ...
    SemanticUnit_js: {
      id: 'SemanticUnit_js', type: 'code', path: 'src/ragno/SemanticUnit.js', title: 'JS: SemanticUnit Model' },
    // Live services
    callLLM: {
      id: 'callLLM', type: 'service', title: 'Call LLMHandler',
      description: 'Call LLM for completions, summaries, or concept extraction. Params: {prompt, context, systemPrompt}'
    },
    embedText: {
      id: 'embedText', type: 'service', title: 'Generate Embedding',
      description: 'Generate embedding for text using EmbeddingHandler. Params: {text}'
    },
    sparqlQuery: {
      id: 'sparqlQuery', type: 'service', title: 'SPARQL SELECT Query',
      description: 'Run SPARQL SELECT query via SPARQLHelpers. Params: {endpoint, query, auth}'
    },
    sparqlUpdate: {
      id: 'sparqlUpdate', type: 'service', title: 'SPARQL UPDATE',
      description: 'Run SPARQL UPDATE via SPARQLHelpers. Params: {endpoint, query, auth}'
    },
    searchGraph: {
      id: 'searchGraph', type: 'service', title: 'Semantic Search',
      description: 'Semantic search using embeddings and Faiss. Params: {queryText, limit}'
    },
    augmentGraph: {
      id: 'augmentGraph', type: 'service', title: 'Graph Attribute Augmentation',
      description: 'Augment a graph with LLM-generated attribute summaries. Params: {graph, options}'
    },
    discoverCommunities: {
      id: 'discoverCommunities', type: 'service', title: 'Community Detection',
      description: 'Detect and summarize communities in a graph. Params: {graph, options}'
    }
  };

  // List all available resource metadata
  if (msg.method === 'listResources') {
    const result = Object.values(resources).map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description || undefined
    }));
    // Validate outgoing response (MCP schema expects JSON-RPC response)
    const response = { jsonrpc: '2.0', id: msg.id, result };
    if (!validate(response)) {
      return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
    }
    return send(res, 200, response);
  }

  // Read a specific resource by id
  if (msg.method === 'readResource') {
    const { id } = msg.params || {};
    const resource = resources[id];
    if (!resource) {
      return send(res, 404, { error: 'Resource not found', id: msg.id });
    }
    try {
      const content = await fs.readFile(resource.path, 'utf-8');
      const result = {
        id: resource.id,
        type: resource.type,
        title: resource.title,
        content
      };
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Failed to read resource', details: e.message });
    }
  }

  // Live LLM service endpoint
  if (msg.method === 'callLLM') {
    const { prompt, context, systemPrompt } = msg.params || {};
    try {
      const result = await llmHandler.generateResponse(prompt, context, systemPrompt);
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'LLM call failed', details: e.message });
    }
  }

  // Live embedding service endpoint
  if (msg.method === 'embedText') {
    const { text } = msg.params || {};
    try {
      const result = await embeddingHandler.generateEmbedding(text);
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Embedding call failed', details: e.message });
    }
  }

  // SPARQL SELECT query endpoint
  if (msg.method === 'sparqlQuery') {
    const { endpoint, query, auth } = msg.params || {};
    try {
      const result = await SPARQLHelpers.executeSPARQLQuery(endpoint, query, auth);
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'SPARQL query failed', details: e.message });
    }
  }

  // SPARQL UPDATE endpoint
  if (msg.method === 'sparqlUpdate') {
    const { endpoint, query, auth } = msg.params || {};
    try {
      const result = await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, auth);
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'SPARQL update failed', details: e.message });
    }
  }

  // searchGraph endpoint (live semantic search)
  if (msg.method === 'searchGraph') {
    const { queryText, limit } = msg.params || {};
    try {
      const results = await searchService.search(queryText, limit || 5);
      const response = { jsonrpc: '2.0', id: msg.id, result: results };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Search call failed', details: e.message });
    }
  }

  // augmentGraph endpoint
  if (msg.method === 'augmentGraph') {
    const { graph, options } = msg.params || {};
    try {
      const result = await augmentWithAttributes(graph, llmHandler, options || {});
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Graph augmentation failed', details: e.message });
    }
  }

  // discoverCommunities endpoint
  if (msg.method === 'discoverCommunities') {
    const { graph, options } = msg.params || {};
    try {
      const result = await aggregateCommunities(graph, llmHandler, options || {});
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Community detection failed', details: e.message });
    }
  }

  // ... add more methods as needed
  send(res, 404, { error: 'Method not found', id: msg.id });
}


const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Only POST supported' });
    return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => handleJSONRPC(req, res, body));
});

server.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}/ (protocol ${LATEST_PROTOCOL_VERSION})`);
});
