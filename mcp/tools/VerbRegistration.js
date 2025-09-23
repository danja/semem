/**
 * MCP Registration Functions for Simple Verbs
 * Handles tool definitions and service exports for the MCP server
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { SimpleVerbToolNames } from './VerbSchemas.js';
import {
  TellSchema,
  AskSchema,
  AugmentSchema,
  ZoomSchema,
  PanSchema,
  TiltSchema,
  InspectSchema,
  RememberSchema,
  ForgetSchema,
  RecallSchema,
  ProjectContextSchema,
  FadeMemorySchema
} from './VerbSchemas.js';
import { SimpleVerbsService } from './SimpleVerbsService.js';
import { logOperation } from './VerbsLogger.js';
import { mcpDebugger } from '../lib/debug-utils.js';
import { createUnifiedLogger } from '../../src/utils/LoggingConfig.js';

// Create shared service instance for HTTP (working)
const simpleVerbsService = new SimpleVerbsService();

// Unified logger for STDIO-specific operations
const stdioLogger = createUnifiedLogger('stdio-verbs');


/**
 * Register Simple Verbs with MCP Server
 */
export function registerSimpleVerbs(server) {
  mcpDebugger.debug('Simple MCP Verbs service initialized for centralized handler');
  // Simple Verbs are now handled by the centralized tool call handler in index.js
  // This function now just initializes the service - tool registration happens centrally
}

// STDIO-compatible service that uses SearchService like HTTP MCP does
async function createSTDIOSearchService() {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../..');

  // Import classes like HTTP MCP does
  const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
  const { default: EmbeddingService } = await import('../../src/services/embeddings/EmbeddingService.js');
  const { SearchService } = await import('../../src/services/SearchService.js');
  const Config = (await import('../../src/Config.js')).default;

  // Initialize config like HTTP MCP
  const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json');
  const config = new Config(configPath);
  await config.init();

  const storageOptions = config.get('storage.options') || {};
  const llmProviders = config.get('llmProviders') || [];
  const embeddingProvider = llmProviders
    .filter(p => p.capabilities?.includes('embedding'))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

  const dimension = embeddingProvider?.embeddingDimension;
  if (!dimension) {
    throw new Error('Embedding dimension not configured');
  }

  // Initialize services like HTTP MCP
  const embeddingService = new EmbeddingService({
    provider: embeddingProvider?.type || 'ollama',
    model: embeddingProvider?.embeddingModel || 'nomic-embed-text',
    dimension: dimension,
    providerOptions: {
      baseUrl: embeddingProvider?.baseUrl,
      apiKey: embeddingProvider?.apiKey
    }
  });

  const storage = new SPARQLStore(storageOptions, { dimension }, config);
  // SPARQLStore doesn't have initialize method, it's ready to use

  const searchService = new SearchService(storage, storage.index);

  // Return HTTP MCP-compatible service
  return {
    async ask({ question, threshold = 0.3 }) {
      // Just use SearchService directly but make sure storage.search method exists
      const questionEmbedding = await embeddingService.generateEmbedding(question);

      // Try storage.search first, fallback to searchService if storage doesn't have search method
      let results;
      if (typeof storage.search === 'function') {
        results = await storage.search(questionEmbedding, 10, threshold);
      } else {
        results = await searchService.search(questionEmbedding, 10, threshold);
      }

      // Return in compatible format
      return {
        success: true,
        verb: 'ask',
        question,
        answer: results.length > 0 ? `Found ${results.length} relevant memories.` : null,
        memories: results.length,
        contextItems: results.length,
        results: results.map(r => ({
          type: 'memory',
          id: r.id,
          title: r.prompt?.substring(0, 50) || 'Memory',
          score: r.similarity,
          metadata: r.metadata || {}
        }))
      };
    },

    async recall({ query, domain = 'user', limit = 10, threshold = 0.3 }) {
      // Generate embedding for query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      // Search using SearchService
      const results = await searchService.search(queryEmbedding, limit, threshold);

      return {
        success: true,
        verb: 'recall',
        query,
        domain,
        memories: results.length,
        results: results.map(r => ({
          type: 'memory',
          id: r.id,
          content: r.prompt || 'No content',
          score: r.similarity,
          metadata: r.metadata || {}
        }))
      };
    },

    async augment({ target, operations = ['extract_concepts'], threshold = 0.3 }) {
      // For augment, use SearchService to find related content for concept extraction
      const targetEmbedding = await embeddingService.generateEmbedding(target);
      const relatedResults = await searchService.search(targetEmbedding, 5, threshold);

      return {
        success: true,
        verb: 'augment',
        target,
        operations,
        relatedContent: relatedResults.length,
        results: relatedResults.map(r => ({
          id: r.id,
          content: r.prompt?.substring(0, 100) || 'Content',
          similarity: r.similarity
        }))
      };
    }
  };
}

// Cache for STDIO services
let stdioSearchServicePromise = null;
let stdioRegularServicePromise = null;

// Methods that require SearchService for optimal performance
const SEARCH_HEAVY_METHODS = ['ask', 'recall', 'augment'];

// Create regular SimpleVerbsService for non-search operations
async function createSTDIORegularService() {
  return new SimpleVerbsService();
}

// Export function to get the Simple Verbs service instance for centralized handler
export function getSimpleVerbsService() {
  // STDIO FIX: Use hybrid approach - SearchService for search operations, regular service for others
  if (process.env.MCP_INSPECTOR_MODE === 'true' ||
      process.argv.some(arg => arg.includes('mcp/index.js')) ||
      process.stdin.isTTY !== true) {
    stdioLogger.info('🔍 STDIO FIX: Creating hybrid service (SearchService + regular) with method forwarding');

    // Initialize both services lazily
    if (!stdioSearchServicePromise) {
      stdioSearchServicePromise = createSTDIOSearchService();
    }
    if (!stdioRegularServicePromise) {
      stdioRegularServicePromise = createSTDIORegularService();
    }

    // Return a Proxy that automatically forwards method calls to appropriate service
    return new Proxy({}, {
      get(target, method) {
        return async (args) => {
          if (SEARCH_HEAVY_METHODS.includes(method)) {
            stdioLogger.debug(`🔍 STDIO: Using SearchService for method: ${method}`);
            const service = await stdioSearchServicePromise;
            return await service[method](args);
          } else {
            stdioLogger.debug(`🔧 STDIO: Using regular service for method: ${method}`);
            const service = await stdioRegularServicePromise;
            return await service[method](args);
          }
        };
      }
    });
  }

  // HTTP path: return shared singleton (working)
  return simpleVerbsService;
}

// Export Simple Verbs tool definitions for centralized handler
export function getSimpleVerbsToolDefinitions() {
  return [
    {
      name: SimpleVerbToolNames.tell,
      description: "Add resources to the system with minimal processing. Supports interaction, document, and concept types.",
      inputSchema: zodToJsonSchema(TellSchema)
    },
    {
      name: SimpleVerbToolNames.ask,
      description: "Query the system using current ZPT context for enhanced answers.",
      inputSchema: zodToJsonSchema(AskSchema)
    },
    {
      name: SimpleVerbToolNames.augment,
      description: "Run operations like concept extraction on relevant knowledgebase parts.",
      inputSchema: zodToJsonSchema(AugmentSchema)
    },
    {
      name: SimpleVerbToolNames.zoom,
      description: "Set the abstraction level for navigation (entity, unit, text, community, corpus).",
      inputSchema: zodToJsonSchema(ZoomSchema)
    },
    {
      name: SimpleVerbToolNames.pan,
      description: "Set subject domain filters (temporal, keywords, entities, domains).",
      inputSchema: zodToJsonSchema(PanSchema)
    },
    {
      name: SimpleVerbToolNames.tilt,
      description: "Set the view filter/representation style (keywords, embedding, graph, temporal).",
      inputSchema: zodToJsonSchema(TiltSchema)
    },
    {
      name: SimpleVerbToolNames.inspect,
      description: "Inspect stored memories and session cache for debugging purposes.",
      inputSchema: zodToJsonSchema(InspectSchema)
    },
    {
      name: SimpleVerbToolNames.remember,
      description: "Store content in specific memory domain with importance weighting. Supports user, project, session, and instruction domains.",
      inputSchema: zodToJsonSchema(RememberSchema)
    },
    {
      name: SimpleVerbToolNames.forget,
      description: "Fade memory visibility using navigation rather than deletion. Supports fade, context_switch, and temporal_decay strategies.",
      inputSchema: zodToJsonSchema(ForgetSchema)
    },
    {
      name: SimpleVerbToolNames.recall,
      description: "Retrieve memories based on query and domain filters with relevance scoring.",
      inputSchema: zodToJsonSchema(RecallSchema)
    },
    {
      name: SimpleVerbToolNames.project_context,
      description: "Manage project-specific memory domains. Create, switch, list, or archive project contexts.",
      inputSchema: zodToJsonSchema(ProjectContextSchema)
    },
    {
      name: SimpleVerbToolNames.fade_memory,
      description: "Gradually reduce memory visibility for smooth context transitions.",
      inputSchema: zodToJsonSchema(FadeMemorySchema)
    }
  ];
}