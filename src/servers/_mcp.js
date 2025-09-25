// MCP Server implementation for Semem
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import SPARQLHelpers from '../services/sparql/SPARQLHelper.js';
import SearchService from '../services/search/SearchService.js';
import EmbeddingService from '../services/embeddings/EmbeddingService.js';
import SPARQLService from '../services/embeddings/SPARQLService.js';
import { augmentWithAttributes } from '../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../ragno/aggregateCommunities.js';
import Config from '../Config.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import MistralConnector from '../connectors/MistralConnector.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP Protocol Version
const LATEST_PROTOCOL_VERSION = '2025.1.0';

// Load MCP JSON Schema
const schemaPath = path.resolve('src/types/mcp-schema.json');
const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

// Load configuration
const configPath = path.join(process.cwd(), 'config', 'config.json');
console.log('Loading config from:', configPath);
const config = new Config(configPath);
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
let embeddingProvider;
try {
  // Get all configured providers and sort by priority (lower number = higher priority)
  const providers = (config.get('llmProviders') || []).sort((a, b) => (a.priority || 999) - (b.priority || 999));

  console.log('Configured LLM providers:', JSON.stringify(providers, null, 2));
  console.log('Environment variables:', {
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY ? '***' : 'Not set',
    OLLAMA_API_KEY: process.env.OLLAMA_API_KEY ? '***' : 'Not set',
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY ? '***' : 'Not set'
  });

  // Try to initialize each provider in order until one succeeds
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
            generateEmbedding: connector.generateEmbedding.bind(connector)
          };
          console.log('Ollama provider initialized successfully');
          break;

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
            generateEmbedding: connector.generateEmbedding.bind(connector)
          };
          console.log('Claude provider initialized successfully');
          break;

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
            generateEmbedding: connector.generateEmbedding ? connector.generateEmbedding.bind(connector) : null
          };
          console.log('Mistral provider initialized successfully');
          break;

        default:
          console.warn(`Unsupported provider type: ${providerConfig.type}`);
          continue;
      }

      // If we successfully initialized a provider, break the loop
      if (llmProvider) break;

    } catch (error) {
      console.error(`Failed to initialize ${providerConfig.type} provider:`, error);
      continue;
    }
  }

  // If no provider was successfully initialized, use a mock provider
  if (!llmProvider) {
    console.warn('No valid LLM provider found, using mock provider');
    llmProvider = {
      type: 'mock',
      generateChat: async () => 'Mock response: No LLM provider configured',
      generateCompletion: async () => 'Mock response: No LLM provider configured',
      generateEmbedding: async () => Array(1536).fill(0)
    };
  }
} catch (error) {
  console.error('Failed to initialize LLM provider:', error);
  process.exit(1);
}

// Initialize embedding provider using factory
try {
  // Get embedding provider configuration
  const embeddingProviderType = config.get('embeddingProvider') || 'ollama';
  const embeddingModel = config.get('embeddingModel');

  console.log(`Creating embedding connector: ${embeddingProviderType} (${embeddingModel})`);

  // Create embedding connector using factory
  let providerConfig = {};
  if (embeddingProviderType === 'nomic') {
    providerConfig = {
      provider: 'nomic',
      apiKey: process.env.NOMIC_API_KEY,
      model: embeddingModel
    };
  } else if (embeddingProviderType === 'ollama') {
    const ollamaBaseUrl = config.get('ollama.baseUrl');
    providerConfig = {
      provider: 'ollama',
      baseUrl: ollamaBaseUrl,
      model: embeddingModel
    };
  }

  embeddingProvider = EmbeddingConnectorFactory.createConnector(providerConfig);
  console.log('Embedding provider initialized successfully');

} catch (error) {
  console.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
  // Fallback to Ollama for embeddings
  embeddingProvider = EmbeddingConnectorFactory.createConnector({
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text'
  });
}

// Initialize handlers
const llmHandler = new LLMHandler(
  llmProvider,
  config.get('chatModel'),
  config.get('llm.temperature')
);

const embeddingHandler = new EmbeddingHandler(
  embeddingProvider,
  config.get('embeddingModel'),
  ragnoConfig.ragno?.enrichment?.embedding?.dimensions,
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
      id: 'SemanticUnit_js', type: 'code', path: 'src/ragno/SemanticUnit.js', title: 'JS: SemanticUnit Model'
    },
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
