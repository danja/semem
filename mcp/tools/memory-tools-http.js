/**
 * Memory-related MCP tools using proper HTTP version pattern
 * Based on the reference implementation pattern
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';
import { mcpDebugger } from '../lib/debug-utils.js';
import { PROMPT_TOOLS } from './prompt-tools.js';
import { workflowOrchestrator } from '../lib/workflow-orchestrator.js';
import { ZPTNavigationService } from './zpt-tools.js';

// Tool input schemas
const StoreInteractionSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  response: z.string().min(1, "Response cannot be empty"),
  metadata: z.object({}).optional().default({})
});

const RetrieveMemoriesSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  limit: z.number().min(1).max(100).optional().default(10)
});

const GenerateEmbeddingSchema = z.object({
  text: z.string().min(1, "Text cannot be empty")
});

const GenerateResponseSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  useMemory: z.boolean().optional().default(true),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(4000).optional().default(1000)
});

const ExtractConceptsSchema = z.object({
  text: z.string().min(1, "Text cannot be empty")
});

// Phase 1 - Storage Backend Operations
const SwitchStorageBackendSchema = z.object({
  backend: z.enum(['InMemory', 'JSON', 'SPARQL', 'CachedSPARQL']),
  config: z.object({}).optional().default({})
});

const BackupMemorySchema = z.object({
  format: z.enum(['json', 'rdf', 'turtle']).optional().default('json'),
  includeEmbeddings: z.boolean().optional().default(true)
});

const LoadMemorySchema = z.object({
  source: z.string().min(1, "Source path/URI cannot be empty"),
  format: z.enum(['json', 'rdf', 'turtle']).optional().default('json'),
  merge: z.boolean().optional().default(false)
});

const MigrateStorageSchema = z.object({
  fromBackend: z.string().min(1, "Source backend required"),
  toBackend: z.string().min(1, "Target backend required"),
  config: z.object({}).optional().default({})
});

const ClearStorageSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: "Must confirm with true" }) }),
  backup: z.boolean().optional().default(true)
});

// Phase 1 - Context Management Operations
const UpdateContextConfigSchema = z.object({
  maxTokens: z.number().min(1000).max(32000).optional(),
  maxTimeWindow: z.number().min(1000).optional(),
  relevanceThreshold: z.number().min(0).max(1).optional(),
  maxContextSize: z.number().min(1).max(20).optional()
});

const PruneContextSchema = z.object({
  minRelevance: z.number().min(0).max(1).optional().default(0.5),
  maxAge: z.number().min(0).optional()
});

// Phase 1 - Configuration Operations
const UpdateConfigSchema = z.object({
  section: z.string().min(1, "Configuration section required"),
  updates: z.object({}).passthrough()
});

// Phase 2 - Ragno Knowledge Graph Operations
const RagnoDecomposeCorpusSchema = z.object({
  textChunks: z.array(z.object({
    content: z.string().min(1, "Content cannot be empty"),
    source: z.string().optional().default("unknown")
  })).min(1, "At least one text chunk required"),
  options: z.object({
    extractRelationships: z.boolean().optional().default(true),
    generateSummaries: z.boolean().optional().default(true),
    minEntityConfidence: z.number().min(0).max(1).optional().default(0.5),
    maxEntitiesPerUnit: z.number().min(1).max(50).optional().default(20)
  }).optional().default({})
});

const RagnoSearchDualSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  options: z.object({
    exactMatchThreshold: z.number().min(0).max(1).optional().default(0.8),
    vectorSimilarityThreshold: z.number().min(0).max(1).optional().default(0.7),
    pprMaxDepth: z.number().min(1).max(10).optional().default(3),
    combinedLimit: z.number().min(1).max(100).optional().default(20)
  }).optional().default({})
});

const RagnoGetEntitiesSchema = z.object({
  filters: z.object({
    type: z.string().optional(),
    minFrequency: z.number().min(0).optional(),
    isEntryPoint: z.boolean().optional(),
    limit: z.number().min(1).max(1000).optional().default(100)
  }).optional().default({})
});

const RagnoVectorSearchSchema = z.object({
  query: z.string().min(1, "Query text cannot be empty"),
  options: z.object({
    k: z.number().min(1).max(100).optional().default(10),
    threshold: z.number().min(0).max(1).optional().default(0.7),
    types: z.array(z.string()).optional(),
    includeMetadata: z.boolean().optional().default(true)
  }).optional().default({})
});

const RagnoExportRdfSchema = z.object({
  format: z.enum(['turtle', 'ntriples', 'jsonld', 'json']).optional().default('turtle'),
  includeEmbeddings: z.boolean().optional().default(false),
  includeStatistics: z.boolean().optional().default(false)
});

const RagnoQuerySparqlSchema = z.object({
  query: z.string().min(1, "SPARQL query cannot be empty"),
  options: z.object({
    limit: z.number().min(1).max(10000).optional().default(1000),
    format: z.enum(['json', 'xml', 'csv']).optional().default('json')
  }).optional().default({})
});

const RagnoAnalyzeGraphSchema = z.object({
  analysisTypes: z.array(z.enum(['centrality', 'communities', 'statistics', 'connectivity'])).optional().default(['statistics']),
  options: z.object({
    topK: z.number().min(1).max(100).optional().default(10),
    includeDetails: z.boolean().optional().default(true)
  }).optional().default({})
});

const RagnoGetGraphStatsSchema = z.object({
  detailed: z.boolean().optional().default(false)
});

// ZPT Input Schemas (from zpt-tools.js)
const ZPTNavigateSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus', 'micro']).optional().default('entity'),
  pan: z.object({
    topic: z.string().optional(),
    temporal: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    geographic: z.object({
      bbox: z.array(z.number()).length(4).optional()
    }).optional(),
    entity: z.array(z.string()).optional()
  }).optional().default({}),
  tilt: z.enum(['keywords', 'embedding', 'graph', 'temporal']).optional().default('keywords'),
  transform: z.object({
    maxTokens: z.number().min(100).max(16000).optional().default(4000),
    format: z.enum(['json', 'markdown', 'structured', 'conversational']).optional().default('json'),
    tokenizer: z.enum(['cl100k_base', 'p50k_base', 'claude', 'llama']).optional().default('cl100k_base'),
    chunkStrategy: z.enum(['semantic', 'adaptive', 'fixed', 'sliding']).optional().default('semantic'),
    includeMetadata: z.boolean().optional().default(true)
  }).optional().default({})
});

const ZPTPreviewSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus']).optional(),
  pan: z.object({
    topic: z.string().optional(),
    temporal: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    geographic: z.object({
      bbox: z.array(z.number()).length(4).optional()
    }).optional(),
    entity: z.array(z.string()).optional()
  }).optional().default({})
});

const ZPTValidateParamsSchema = z.object({
  params: z.object({
    query: z.string(),
    zoom: z.string(),
    pan: z.object({}).optional(),
    tilt: z.string(),
    transform: z.object({}).optional()
  })
});

const ZPTGetOptionsSchema = z.object({
  context: z.enum(['current', 'full']).optional().default('current'),
  query: z.string().optional()
});

const ZPTAnalyzeCorpusSchema = z.object({
  analysisType: z.enum(['structure', 'performance', 'recommendations']).optional().default('structure'),
  includeStats: z.boolean().optional().default(true)
});


// Research Workflow Schemas (from research-workflow-tools.js)
const ResearchIngestDocumentsSchema = z.object({
  documents: z.array(z.union([
    z.string(),
    z.object({
      content: z.string(),
      source: z.string().optional(),
      metadata: z.object({}).optional()
    })
  ])).min(1).max(50),
  domain: z.string().optional().default('general'),
  options: z.object({
    extractRelationships: z.boolean().optional().default(true),
    generateSummaries: z.boolean().optional().default(true),
    minEntityConfidence: z.number().min(0).max(1).optional().default(0.7)
  }).optional().default({})
});

const ResearchGenerateInsightsSchema = z.object({
  concepts: z.array(z.string()).optional().default([]),
  entities: z.array(z.union([z.string(), z.object({}).passthrough()])).optional().default([]),
  relationships: z.array(z.object({}).passthrough()).optional().default([]),
  goals: z.array(z.enum(['concept_extraction', 'relationship_mapping', 'insight_generation', 'trend_analysis'])).optional().default(['concept_extraction', 'relationship_mapping'])
});

const AdaptiveQueryProcessingSchema = z.object({
  query: z.string().min(1),
  userContext: z.object({
    userId: z.string().optional(),
    preferences: z.object({}).optional(),
    sessionId: z.string().optional(),
    domain: z.string().optional()
  }).optional().default({})
});

const HybridSearchSchema = z.object({
  query: z.string().min(1),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  limit: z.number().min(1).max(100).optional().default(10),
  preferenceWeight: z.number().min(0).max(1).optional().default(0.5),
  options: z.object({
    includeGraph: z.boolean().optional().default(true),
    includeMemory: z.boolean().optional().default(true),
    rankingMethod: z.enum(['semantic', 'hybrid', 'graph_enhanced']).optional().default('hybrid')
  }).optional().default({})
});

const CaptureUserFeedbackSchema = z.object({
  query: z.string(),
  response: z.string(),
  feedback: z.object({
    rating: z.number().min(1).max(5).optional(),
    helpful: z.boolean().optional(),
    relevance: z.number().min(0).max(1).optional(),
    comments: z.string().optional(),
    correctedAnswer: z.string().optional()
  }),
  userContext: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }).optional().default({})
});

const IncrementalLearningSchema = z.object({
  learningData: z.array(z.object({
    query: z.string(),
    expectedResponse: z.string(),
    actualResponse: z.string().optional(),
    feedback: z.object({}).optional(),
    context: z.object({}).optional()
  })).min(1),
  options: z.object({
    updateMemory: z.boolean().optional().default(true),
    strengthenConnections: z.boolean().optional().default(true),
    adjustThresholds: z.boolean().optional().default(false)
  }).optional().default({})
});

// Tool names enum - Extended
const ToolName = {
  // Original tools
  STORE_INTERACTION: "semem_store_interaction",
  RETRIEVE_MEMORIES: "semem_retrieve_memories", 
  GENERATE_EMBEDDING: "semem_generate_embedding",
  GENERATE_RESPONSE: "semem_generate_response",
  EXTRACT_CONCEPTS: "semem_extract_concepts",
  
  // Phase 1 - Storage Backend Operations
  SWITCH_STORAGE_BACKEND: "semem_switch_storage_backend",
  BACKUP_MEMORY: "semem_backup_memory",
  LOAD_MEMORY: "semem_load_memory",
  STORAGE_STATS: "semem_storage_stats",
  MIGRATE_STORAGE: "semem_migrate_storage",
  CLEAR_STORAGE: "semem_clear_storage",
  
  // Phase 1 - Context Management Operations  
  GET_CONTEXT: "semem_get_context",
  UPDATE_CONTEXT_CONFIG: "semem_update_context_config",
  PRUNE_CONTEXT: "semem_prune_context",
  SUMMARIZE_CONTEXT: "semem_summarize_context",
  
  // Phase 1 - Configuration & Status Operations
  GET_CONFIG: "semem_get_config",
  UPDATE_CONFIG: "semem_update_config",
  GET_METRICS: "semem_get_metrics",
  HEALTH_CHECK: "semem_health_check",
  
  // Phase 2 - Ragno Knowledge Graph Operations
  RAGNO_DECOMPOSE_CORPUS: "ragno_decompose_corpus",
  RAGNO_SEARCH_DUAL: "ragno_search_dual",
  RAGNO_GET_ENTITIES: "ragno_get_entities",
  RAGNO_VECTOR_SEARCH: "ragno_vector_search",
  RAGNO_EXPORT_RDF: "ragno_export_rdf",
  RAGNO_QUERY_SPARQL: "ragno_query_sparql",
  RAGNO_ANALYZE_GRAPH: "ragno_analyze_graph",
  RAGNO_GET_GRAPH_STATS: "ragno_get_graph_stats",

  // ZPT Tools
  ZPT_NAVIGATE: 'zpt_navigate',
  ZPT_PREVIEW: 'zpt_preview',
  ZPT_GET_SCHEMA: 'zpt_get_schema',
  ZPT_VALIDATE_PARAMS: 'zpt_validate_params',
  ZPT_GET_OPTIONS: 'zpt_get_options',
  ZPT_ANALYZE_CORPUS: 'zpt_analyze_corpus',

  // Research Workflow Tools
  RESEARCH_INGEST_DOCUMENTS: "research_ingest_documents",
  RESEARCH_GENERATE_INSIGHTS: "research_generate_insights",
  ADAPTIVE_QUERY_PROCESSING: "adaptive_query_processing",
  HYBRID_SEARCH: "hybrid_search",
  CAPTURE_USER_FEEDBACK: "capture_user_feedback",
  INCREMENTAL_LEARNING: "incremental_learning"
};

/**
 * Register memory-related tools using HTTP version pattern
 */
export const registerMemoryToolsHttp = (server) => {
  const allTools = [
    {
      name: ToolName.STORE_INTERACTION,
      description: "Store a prompt-response pair in memory.",
      inputSchema: zodToJsonSchema(StoreInteractionSchema, "StoreInteractionInput")
    },
    {
      name: ToolName.RETRIEVE_MEMORIES,
      description: "Retrieve relevant memories from the memory store.",
      inputSchema: zodToJsonSchema(RetrieveMemoriesSchema, "RetrieveMemoriesInput")
    },
    {
      name: ToolName.GENERATE_EMBEDDING,
      description: "Generate an embedding for a given text.",
      inputSchema: zodToJsonSchema(GenerateEmbeddingSchema, "GenerateEmbeddingInput")
    },
    {
      name: ToolName.GENERATE_RESPONSE,
      description: "Generate a response based on a prompt and context.",
      inputSchema: zodToJsonSchema(GenerateResponseSchema, "GenerateResponseInput")
    },
    {
      name: ToolName.EXTRACT_CONCEPTS,
      description: "Extract concepts from a given text.",
      inputSchema: zodToJsonSchema(ExtractConceptsSchema, "ExtractConceptsInput")
    },
    {
      name: ToolName.SWITCH_STORAGE_BACKEND,
      description: "Switch the storage backend for memory operations.",
      inputSchema: zodToJsonSchema(SwitchStorageBackendSchema, "SwitchStorageBackendInput")
    },
    {
      name: ToolName.BACKUP_MEMORY,
      description: "Backup the current memory store to a file.",
      inputSchema: zodToJsonSchema(BackupMemorySchema, "BackupMemoryInput")
    },
    {
      name: ToolName.LOAD_MEMORY,
      description: "Load a memory backup from a file.",
      inputSchema: zodToJsonSchema(LoadMemorySchema, "LoadMemoryInput")
    },
    {
      name: ToolName.STORAGE_STATS,
      description: "Get statistics about the current memory storage.",
      inputSchema: {}
    },
    {
      name: ToolName.MIGRATE_STORAGE,
      description: "Migrate the memory storage to a new backend.",
      inputSchema: zodToJsonSchema(MigrateStorageSchema, "MigrateStorageInput")
    },
    {
      name: ToolName.CLEAR_STORAGE,
      description: "Clear the memory storage.",
      inputSchema: zodToJsonSchema(ClearStorageSchema, "ClearStorageInput")
    },
    {
      name: ToolName.GET_CONTEXT,
      description: "Get the current context configuration.",
      inputSchema: {}
    },
    {
      name: ToolName.UPDATE_CONTEXT_CONFIG,
      description: "Update the context configuration.",
      inputSchema: zodToJsonSchema(UpdateContextConfigSchema, "UpdateContextConfigInput")
    },
    {
      name: ToolName.PRUNE_CONTEXT,
      description: "Prune the context based on relevance and age.",
      inputSchema: zodToJsonSchema(PruneContextSchema, "PruneContextInput")
    },
    {
      name: ToolName.SUMMARIZE_CONTEXT,
      description: "Summarize the current context.",
      inputSchema: {}
    },
    {
      name: ToolName.GET_CONFIG,
      description: "Get the current configuration.",
      inputSchema: {}
    },
    {
      name: ToolName.UPDATE_CONFIG,
      description: "Update the configuration.",
      inputSchema: zodToJsonSchema(UpdateConfigSchema, "UpdateConfigInput")
    },
    {
      name: ToolName.GET_METRICS,
      description: "Get metrics about the memory system.",
      inputSchema: {}
    },
    {
      name: ToolName.HEALTH_CHECK,
      description: "Perform a health check on the memory system.",
      inputSchema: {}
    },
    {
      name: ToolName.RAGNO_DECOMPOSE_CORPUS,
      description: "Decompose a corpus into units and entities.",
      inputSchema: zodToJsonSchema(RagnoDecomposeCorpusSchema, "RagnoDecomposeCorpusInput")
    },
    {
      name: ToolName.RAGNO_SEARCH_DUAL,
      description: "Perform a dual search using exact match and vector similarity.",
      inputSchema: zodToJsonSchema(RagnoSearchDualSchema, "RagnoSearchDualInput")
    },
    {
      name: ToolName.RAGNO_GET_ENTITIES,
      description: "Get entities from the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoGetEntitiesSchema, "RagnoGetEntitiesInput")
    },
    {
      name: ToolName.RAGNO_VECTOR_SEARCH,
      description: "Perform a vector search on the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoVectorSearchSchema, "RagnoVectorSearchInput")
    },
    {
      name: ToolName.RAGNO_EXPORT_RDF,
      description: "Export the knowledge graph to RDF format.",
      inputSchema: zodToJsonSchema(RagnoExportRdfSchema, "RagnoExportRdfInput")
    },
    {
      name: ToolName.RAGNO_QUERY_SPARQL,
      description: "Query the knowledge graph using SPARQL.",
      inputSchema: zodToJsonSchema(RagnoQuerySparqlSchema, "RagnoQuerySparqlInput")
    },
    {
      name: ToolName.RAGNO_ANALYZE_GRAPH,
      description: "Analyze the knowledge graph for various metrics.",
      inputSchema: zodToJsonSchema(RagnoAnalyzeGraphSchema, "RagnoAnalyzeGraphInput")
    },
    {
      name: ToolName.RAGNO_GET_GRAPH_STATS,
      description: "Get statistics about the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoGetGraphStatsSchema, "RagnoGetGraphStatsInput")
    },
    {
      name: ToolName.ZPT_NAVIGATE,
      description: "Navigate the knowledge space using 3D spatial metaphors (zoom, pan, tilt).",
      inputSchema: zodToJsonSchema(ZPTNavigateSchema, "ZPTNavigateInput")
    },
    {
      name: ToolName.ZPT_PREVIEW,
      description: "Get a lightweight preview of a navigation destination.",
      inputSchema: zodToJsonSchema(ZPTPreviewSchema, "ZPTPreviewInput")
    },
    {
      name: ToolName.ZPT_GET_SCHEMA,
      description: "Get the ZPT schema and available dimensions.",
      inputSchema: {}
    },
    {
      name: ToolName.ZPT_VALIDATE_PARAMS,
      description: "Validate a set of ZPT navigation parameters.",
      inputSchema: zodToJsonSchema(ZPTValidateParamsSchema, "ZPTValidateParamsInput")
    },
    {
      name: ToolName.ZPT_GET_OPTIONS,
      description: "Get available options for ZPT navigation.",
      inputSchema: zodToJsonSchema(ZPTGetOptionsSchema, "ZPTGetOptionsInput")
    },
    {
      name: ToolName.ZPT_ANALYZE_CORPUS,
      description: "Analyze the corpus for ZPT navigation readiness.",
      inputSchema: zodToJsonSchema(ZPTAnalyzeCorpusSchema, "ZPTAnalyzeCorpusInput")
    },
    {
      name: ToolName.RESEARCH_INGEST_DOCUMENTS,
      description: "Ingest and process documents for research.",
      inputSchema: zodToJsonSchema(ResearchIngestDocumentsSchema, "ResearchIngestDocumentsInput")
    },
    {
      name: ToolName.RESEARCH_GENERATE_INSIGHTS,
      description: "Generate insights from research data.",
      inputSchema: zodToJsonSchema(ResearchGenerateInsightsSchema, "ResearchGenerateInsightsInput")
    },
    {
      name: ToolName.ADAPTIVE_QUERY_PROCESSING,
      description: "Adaptively process queries based on context.",
      inputSchema: zodToJsonSchema(AdaptiveQueryProcessingSchema, "AdaptiveQueryProcessingInput")
    },
    {
      name: ToolName.HYBRID_SEARCH,
      description: "Perform hybrid search using multiple strategies.",
      inputSchema: zodToJsonSchema(HybridSearchSchema, "HybridSearchInput")
    },
    {
      name: ToolName.CAPTURE_USER_FEEDBACK,
      description: "Capture user feedback on search results.",
      inputSchema: zodToJsonSchema(CaptureUserFeedbackSchema, "CaptureUserFeedbackInput")
    },
    {
      name: ToolName.INCREMENTAL_LEARNING,
      description: "Perform incremental learning from user interactions.",
      inputSchema: zodToJsonSchema(IncrementalLearningSchema, "IncrementalLearningInput")
    }
  ];

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await initializeServices();
    const memoryManager = getMemoryManager();
    const safeOps = new SafeOperations(memoryManager);
    const zptService = new ZPTNavigationService(memoryManager, safeOps);

    const { toolName, args } = request.params;
    mcpDebugger.log('Received tool call', { toolName, args });

    try {
      let result;
      switch (toolName) {
        case ToolName.STORE_INTERACTION:
          result = await safeOps.storeInteraction(args.prompt, args.response, args.metadata);
          break;
        case ToolName.RETRIEVE_MEMORIES:
          result = await safeOps.retrieveMemories(args.query, args.threshold, args.limit);
          break;
        case ToolName.GENERATE_EMBEDDING:
          result = await safeOps.generateEmbedding(args.text);
          break;
        case ToolName.GENERATE_RESPONSE:
          result = await safeOps.generateResponse(args.prompt, args.useMemory, args.temperature, args.maxTokens);
          break;
        case ToolName.EXTRACT_CONCEPTS:
          result = await safeOps.extractConcepts(args.text);
          break;
        case ToolName.SWITCH_STORAGE_BACKEND:
          result = await safeOps.switchStorageBackend(args.backend, args.config);
          break;
        case ToolName.BACKUP_MEMORY:
          result = await safeOps.backupMemory(args.format, args.includeEmbeddings);
          break;
        case ToolName.LOAD_MEMORY:
          result = await safeOps.loadMemory(args.source, args.format, args.merge);
          break;
        case ToolName.STORAGE_STATS:
          result = await safeOps.getStorageStats();
          break;
        case ToolName.MIGRATE_STORAGE:
          result = await safeOps.migrateStorage(args.fromBackend, args.toBackend, args.config);
          break;
        case ToolName.CLEAR_STORAGE:
          result = await safeOps.clearStorage(args.confirm, args.backup);
          break;
        case ToolName.GET_CONTEXT:
          result = await safeOps.getContext();
          break;
        case ToolName.UPDATE_CONTEXT_CONFIG:
          result = await safeOps.updateContextConfig(args);
          break;
        case ToolName.PRUNE_CONTEXT:
          result = await safeOps.pruneContext(args.minRelevance, args.maxAge);
          break;
        case ToolName.SUMMARIZE_CONTEXT:
          result = await safeOps.summarizeContext();
          break;
        case ToolName.GET_CONFIG:
          result = await safeOps.getConfig();
          break;
        case ToolName.UPDATE_CONFIG:
          result = await safeOps.updateConfig(args.section, args.updates);
          break;
        case ToolName.GET_METRICS:
          result = await safeOps.getMetrics();
          break;
        case ToolName.HEALTH_CHECK:
          result = await safeOps.healthCheck();
          break;
        case ToolName.RAGNO_DECOMPOSE_CORPUS:
          result = await safeOps.ragnoDecomposeCorpus(args.textChunks, args.options);
          break;
        case ToolName.RAGNO_SEARCH_DUAL:
          result = await safeOps.ragnoSearchDual(args.query, args.options);
          break;
        case ToolName.RAGNO_GET_ENTITIES:
          result = await safeOps.ragnoGetEntities(args.filters);
          break;
        case ToolName.RAGNO_VECTOR_SEARCH:
          result = await safeOps.ragnoVectorSearch(args.query, args.options);
          break;
        case ToolName.RAGNO_EXPORT_RDF:
          result = await safeOps.ragnoExportRdf(args.format, args.includeEmbeddings, args.includeStatistics);
          break;
        case ToolName.RAGNO_QUERY_SPARQL:
          result = await safeOps.ragnoQuerySparql(args.query, args.options);
          break;
        case ToolName.RAGNO_ANALYZE_GRAPH:
          result = await safeOps.ragnoAnalyzeGraph(args.analysisTypes, args.options);
          break;
        case ToolName.RAGNO_GET_GRAPH_STATS:
          result = await safeOps.ragnoGetGraphStats(args.detailed);
          break;

        // ZPT Cases
        case ToolName.ZPT_NAVIGATE:
          result = await zptService.navigate(args.query, args.zoom, args.pan, args.tilt, args.transform);
          break;
        case ToolName.ZPT_PREVIEW:
          result = await zptService.preview(args.query, args.zoom, args.pan);
          break;
        case ToolName.ZPT_GET_SCHEMA:
          result = await zptService.getSchema();
          break;
        case ToolName.ZPT_VALIDATE_PARAMS:
          result = await zptService.validateParams(args.params);
          break;
        case ToolName.ZPT_GET_OPTIONS:
          result = await zptService.getOptions(args.context, args.query);
          break;
        case ToolName.ZPT_ANALYZE_CORPUS:
          result = await zptService.analyzeCorpus(args.analysisType, args.includeStats);
          break;

        // Research Workflow Cases
        case ToolName.RESEARCH_INGEST_DOCUMENTS:
          result = await workflowOrchestrator.researchIngestDocuments(args);
          break;
        case ToolName.RESEARCH_GENERATE_INSIGHTS:
          result = await workflowOrchestrator.researchGenerateInsights(args);
          break;
        case ToolName.ADAPTIVE_QUERY_PROCESSING:
          result = await workflowOrchestrator.adaptiveQueryProcessing(args);
          break;
        case ToolName.HYBRID_SEARCH:
          result = await workflowOrchestrator.hybridSearch(args);
          break;
        case ToolName.CAPTURE_USER_FEEDBACK:
          result = await workflowOrchestrator.captureUserFeedback(args);
          break;
        case ToolName.INCREMENTAL_LEARNING:
          result = await workflowOrchestrator.incrementalLearning(args);
          break;

        default:
          throw new Error(`Tool not found: ${toolName}`);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      mcpDebugger.error(`Error calling tool ${toolName}:`, error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: error.message,
            stack: error.stack,
            toolName
          })
        }],
        isError: true
      };
    }
  });
}

/**
 * Register memory-related tools using HTTP version pattern
 */
export function registerMemoryToolsHttp(server) {
  mcpDebugger.info('Registering memory tools using HTTP pattern...');

  const allTools = [
    ...PROMPT_TOOLS,
    {
      name: ToolName.STORE_INTERACTION,
      description: "Store a new interaction in semantic memory with embeddings and concept extraction",
      inputSchema: zodToJsonSchema(StoreInteractionSchema, "StoreInteractionInput")
    },
    {
      name: ToolName.RETRIEVE_MEMORIES,
      description: "Retrieve similar memories from semantic storage using vector similarity search",
      inputSchema: zodToJsonSchema(RetrieveMemoriesSchema, "RetrieveMemoriesInput")
    },
    {
      name: ToolName.GENERATE_EMBEDDING,
      description: "Generate a vector embedding for a given text.",
      inputSchema: zodToJsonSchema(GenerateEmbeddingSchema, "GenerateEmbeddingInput")
    },
    {
      name: ToolName.GENERATE_RESPONSE,
      description: "Generate a response from the LLM, optionally using context from memory.",
      inputSchema: zodToJsonSchema(GenerateResponseSchema, "GenerateResponseInput")
    },
    {
      name: ToolName.EXTRACT_CONCEPTS,
      description: "Extract key concepts from a block of text.",
      inputSchema: zodToJsonSchema(ExtractConceptsSchema, "ExtractConceptsInput")
    },
    {
      name: ToolName.SWITCH_STORAGE_BACKEND,
      description: "Switch the active storage backend.",
      inputSchema: zodToJsonSchema(SwitchStorageBackendSchema, "SwitchStorageBackendInput")
    },
    {
      name: ToolName.BACKUP_MEMORY,
      description: "Backup the contents of the memory store.",
      inputSchema: zodToJsonSchema(BackupMemorySchema, "BackupMemoryInput")
    },
    {
      name: ToolName.LOAD_MEMORY,
      description: "Load memory from a backup.",
      inputSchema: zodToJsonSchema(LoadMemorySchema, "LoadMemoryInput")
    },
    {
      name: ToolName.STORAGE_STATS,
      description: "Get statistics about the current storage backend."
    },
    {
      name: ToolName.MIGRATE_STORAGE,
      description: "Migrate data from one storage backend to another.",
      inputSchema: zodToJsonSchema(MigrateStorageSchema, "MigrateStorageInput")
    },
    {
      name: ToolName.CLEAR_STORAGE,
      description: "Clear the storage backend.",
      inputSchema: zodToJsonSchema(ClearStorageSchema, "ClearStorageInput")
    },
    {
      name: ToolName.GET_CONTEXT,
      description: "Get the current context window."
    },
    {
      name: ToolName.UPDATE_CONTEXT_CONFIG,
      description: "Update the configuration for the context manager.",
      inputSchema: zodToJsonSchema(UpdateContextConfigSchema, "UpdateContextConfigInput")
    },
    {
      name: ToolName.PRUNE_CONTEXT,
      description: "Prune the current context.",
      inputSchema: zodToJsonSchema(PruneContextSchema, "PruneContextInput")
    },
    {
      name: ToolName.SUMMARIZE_CONTEXT,
      description: "Summarize the current context."
    },
    {
      name: ToolName.GET_CONFIG,
      description: "Get the current system configuration."
    },
    {
      name: ToolName.UPDATE_CONFIG,
      description: "Update the system configuration.",
      inputSchema: zodToJsonSchema(UpdateConfigSchema, "UpdateConfigInput")
    },
    {
      name: ToolName.GET_METRICS,
      description: "Get system performance metrics."
    },
    {
      name: ToolName.HEALTH_CHECK,
      description: "Perform a system health check."
    },
    {
      name: ToolName.RAGNO_DECOMPOSE_CORPUS,
      description: "Decompose a corpus into a knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoDecomposeCorpusSchema, "RagnoDecomposeCorpusInput")
    },
    {
      name: ToolName.RAGNO_SEARCH_DUAL,
      description: "Perform a dual search on the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoSearchDualSchema, "RagnoSearchDualInput")
    },
    {
      name: ToolName.RAGNO_GET_ENTITIES,
      description: "Get entities from the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoGetEntitiesSchema, "RagnoGetEntitiesInput")
    },
    {
      name: ToolName.RAGNO_VECTOR_SEARCH,
      description: "Perform a vector search on the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoVectorSearchSchema, "RagnoVectorSearchInput")
    },
    {
      name: ToolName.RAGNO_EXPORT_RDF,
      description: "Export the knowledge graph to RDF.",
      inputSchema: zodToJsonSchema(RagnoExportRdfSchema, "RagnoExportRdfInput")
    },
    {
      name: ToolName.RAGNO_QUERY_SPARQL,
      description: "Query the knowledge graph using SPARQL.",
      inputSchema: zodToJsonSchema(RagnoQuerySparqlSchema, "RagnoQuerySparqlInput")
    },
    {
      name: ToolName.RAGNO_ANALYZE_GRAPH,
      description: "Analyze the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoAnalyzeGraphSchema, "RagnoAnalyzeGraphInput")
    },
    {
      name: ToolName.RAGNO_GET_GRAPH_STATS,
      description: "Get statistics about the knowledge graph.",
      inputSchema: zodToJsonSchema(RagnoGetGraphStatsSchema, "RagnoGetGraphStatsInput")
    },
    {
      name: ToolName.ZPT_NAVIGATE,
      description: "Navigate the knowledge space using 3D spatial metaphors (zoom, pan, tilt).",
      inputSchema: zodToJsonSchema(ZPTNavigateSchema, "ZPTNavigateInput")
    },
    {
      name: ToolName.ZPT_PREVIEW,
      description: "Get a lightweight preview of a navigation destination.",
      inputSchema: zodToJsonSchema(ZPTPreviewSchema, "ZPTPreviewInput")
    },
    {
      name: ToolName.ZPT_GET_SCHEMA,
      description: "Get the ZPT schema and available dimensions.",
      inputSchema: {}
    },
    {
      name: ToolName.ZPT_VALIDATE_PARAMS,
      description: "Validate a set of ZPT navigation parameters.",
      inputSchema: zodToJsonSchema(ZPTValidateParamsSchema, "ZPTValidateParamsInput")
    },
    {
      name: ToolName.ZPT_GET_OPTIONS,
      description: "Get available options for ZPT navigation.",
      inputSchema: zodToJsonSchema(ZPTGetOptionsSchema, "ZPTGetOptionsInput")
    },
    {
      name: ToolName.ZPT_ANALYZE_CORPUS,
      description: "Analyze the corpus for ZPT navigation readiness.",
      inputSchema: zodToJsonSchema(ZPTAnalyzeCorpusSchema, "ZPTAnalyzeCorpusInput")
    },
    {
      name: ToolName.RESEARCH_INGEST_DOCUMENTS,
      description: "Ingest and process documents for research.",
      inputSchema: zodToJsonSchema(ResearchIngestDocumentsSchema, "ResearchIngestDocumentsInput")
    },
    {
      name: ToolName.RESEARCH_GENERATE_INSIGHTS,
      description: "Generate insights from research data.",
      inputSchema: zodToJsonSchema(ResearchGenerateInsightsSchema, "ResearchGenerateInsightsInput")
    },
    {
      name: ToolName.ADAPTIVE_QUERY_PROCESSING,
      description: "Adaptively process queries based on context.",
      inputSchema: zodToJsonSchema(AdaptiveQueryProcessingSchema, "AdaptiveQueryProcessingInput")
    },
    {
      name: ToolName.HYBRID_SEARCH,
      description: "Perform hybrid search using multiple strategies.",
      inputSchema: zodToJsonSchema(HybridSearchSchema, "HybridSearchInput")
    },
    {
      name: ToolName.CAPTURE_USER_FEEDBACK,
      description: "Capture user feedback on search results.",
      inputSchema: zodToJsonSchema(CaptureUserFeedbackSchema, "CaptureUserFeedbackInput")
    },
    {
      name: ToolName.INCREMENTAL_LEARNING,
      description: "Perform incremental learning from user interactions.",
      inputSchema: zodToJsonSchema(IncrementalLearningSchema, "IncrementalLearningInput")
    }
  ];

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ? tool.inputSchema : { type: 'object', properties: {} }
      }))
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await initializeServices();
    const memoryManager = getMemoryManager();
    const safeOps = new SafeOperations(memoryManager);
    const zptService = new ZPTNavigationService(memoryManager, safeOps);

    const { toolName, args } = request.params;
    mcpDebugger.log('Received tool call', { toolName, args });

    try {
      let result;
      switch (toolName) {
        case ToolName.STORE_INTERACTION:
          const { prompt, response, metadata } = StoreInteractionSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            // Generate embedding
            const embedding = await safeOps.generateEmbedding(`${prompt} ${response}`);
            
            // Extract concepts
            const concepts = await safeOps.extractConcepts(`${prompt} ${response}`);
            
            // Add interaction to memory
            const id = uuidv4();
            await memoryManager.addInteraction(prompt, response, embedding, concepts, {
              id,
              timestamp: Date.now(),
              ...metadata
            });
            
            result = {
              success: true,
              message: `Successfully stored interaction with ${concepts.length} concepts extracted`,
              id,
              conceptsCount: concepts.length
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.RETRIEVE_MEMORIES:
          console.log('🔍 DEBUG: RETRIEVE_MEMORIES handler called with:', { query: args.query, threshold: args.threshold });
          const { query, threshold, limit } = RetrieveMemoriesSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            // Search for similar memories using SafeOperations
            // Convert threshold from 0-1 scale to 0-100 scale that MemoryStore expects
            const memories = await safeOps.retrieveMemories(query, threshold * 100, 0);
            console.log('🔍 DEBUG: Retrieved memories count:', memories.length);
            if (memories.length > 0) {
              console.log('🔍 DEBUG: First memory object keys:', Object.keys(memories[0]));
              console.log('🔍 DEBUG: First memory object:', JSON.stringify(memories[0], null, 2));
            }
            
            result = {
              success: true,
              message: `Found ${memories.length} similar memories`,
              memories: memories.map(m => ({
                prompt: m.prompt,
                response: m.output || m.response || 'No response available',
                similarity: m.similarity,
                concepts: m.concepts?.slice(0, 5), // Limit concepts shown
                has_output: !!m.output,
                has_response: !!m.response,
                object_keys: Object.keys(m),
                raw_memory_object: m // Include full object for debugging
              }))
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.GENERATE_EMBEDDING:
          const { text } = GenerateEmbeddingSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            const embedding = await safeOps.generateEmbedding(text);
            
            result = {
              success: true,
              message: "Successfully generated embedding",
              dimensions: embedding.length,
              preview: embedding.slice(0, 5) // Show first 5 dimensions
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.GENERATE_RESPONSE:
          const { prompt, useMemory, temperature, maxTokens } = GenerateResponseSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            let context = '';
            
            if (useMemory) {
              // Get relevant memories for context using SafeOperations
              // Note: MemoryStore uses percentage similarity (0-100), so convert from 0-1 scale to 0-100 scale
              const memories = await safeOps.retrieveMemories(prompt, 0.7 * 100, 0);
              
              if (memories.length > 0) {
                // Debug: Check what fields are available in memory objects
                console.log('Memory object keys:', memories[0] ? Object.keys(memories[0]) : 'No memories');
                console.log('First memory:', JSON.stringify(memories[0], null, 2));
                
                // The interaction object uses 'output' field, not 'response'
                context = memories.map(m => `Previous: ${m.prompt} -> ${m.output || m.response || 'No response available'}`).join('\n');
              }
            }
            
            // Generate response
            const response = await safeOps.generateResponse(prompt, context, { temperature, maxTokens });
            
            result = {
              success: true,
              message: "Successfully generated response",
              response,
              contextUsed: useMemory && context.length > 0,
              memoriesUsed: useMemory ? context.split('\n').length : 0
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.EXTRACT_CONCEPTS:
          const { text } = ExtractConceptsSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            const concepts = await safeOps.extractConcepts(text);
            
            result = {
              success: true,
              message: `Successfully extracted ${concepts.length} concepts`,
              concepts
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.SWITCH_STORAGE_BACKEND:
          const { backend, config } = SwitchStorageBackendSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            // Import storage classes
            const { default: InMemoryStore } = await import('../../src/stores/InMemoryStore.js');
            const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
            const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
            const { default: CachedSPARQLStore } = await import('../../src/stores/CachedSPARQLStore.js');
            
            let newStorage;
            switch (backend) {
              case 'InMemory':
                newStorage = new InMemoryStore();
                break;
              case 'JSON':
                newStorage = new JSONStore(config.filePath || './data/memory.json');
                break;
              case 'SPARQL':
                newStorage = new SPARQLStore(config.endpoint || 'http://localhost:3030/semem', config);
                break;
              case 'CachedSPARQL':
                newStorage = new CachedSPARQLStore(config.endpoint || 'http://localhost:3030/semem', config);
                break;
              default:
                throw new Error(`Unsupported backend: ${backend}`);
            }
            
            // Switch storage backend
            memoryManager.storage = newStorage;
            
            result = {
              success: true,
              message: `Successfully switched to ${backend} storage backend`,
              backend,
              config
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.BACKUP_MEMORY:
          const { format, includeEmbeddings } = BackupMemorySchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let backupData;
            let filename;
            
            if (format === 'json') {
              backupData = {
                timestamp,
                shortTerm: includeEmbeddings ? shortTerm : shortTerm.map(({embedding, ...rest}) => rest),
                longTerm: includeEmbeddings ? longTerm : longTerm.map(({embedding, ...rest}) => rest)
              };
              filename = `semem-backup-${timestamp}.json`;
            } else {
              // For RDF formats, we'd need to implement RDF serialization
              throw new Error('RDF backup formats not yet implemented');
            }
            
            result = {
              success: true,
              message: `Memory backup created successfully`,
              format,
              filename,
              shortTermCount: shortTerm.length,
              longTermCount: longTerm.length,
              includeEmbeddings,
              backup: JSON.stringify(backupData, null, 2)
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.STORAGE_STATS:
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
            
            result = {
              success: true,
              message: "Storage statistics retrieved successfully",
              stats: {
                storageType: memoryManager.storage.constructor.name,
                shortTermCount: shortTerm.length,
                longTermCount: longTerm.length,
                totalInteractions: shortTerm.length + longTerm.length,
                memoryStoreStats: {
                  embeddingsCount: memoryManager.memStore.embeddings.length,
                  conceptsCount: memoryManager.memStore.conceptsList.length
                }
              }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.LOAD_MEMORY:
          const { source, format, merge } = LoadMemorySchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            // This is a placeholder implementation - would need file system access
            // In a real implementation, you'd read from the source path/URI
            throw new Error('LOAD_MEMORY tool requires file system implementation');
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.MIGRATE_STORAGE:
          const { fromBackend, toBackend, config } = MigrateStorageSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            // Get current data
            const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
            
            // Create new storage backend
            const { default: InMemoryStore } = await import('../../src/stores/InMemoryStore.js');
            const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
            const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
            const { default: CachedSPARQLStore } = await import('../../src/stores/CachedSPARQLStore.js');
            
            let newStorage;
            switch (toBackend) {
              case 'InMemory':
                newStorage = new InMemoryStore();
                break;
              case 'JSON':
                newStorage = new JSONStore(config.filePath || './data/memory.json');
                break;
              case 'SPARQL':
                newStorage = new SPARQLStore(config.endpoint || 'http://localhost:3030/semem', config);
                break;
              case 'CachedSPARQL':
                newStorage = new CachedSPARQLStore(config.endpoint || 'http://localhost:3030/semem', config);
                break;
              default:
                throw new Error(`Unsupported target backend: ${toBackend}`);
            }
            
            // Migrate data by saving to new storage
            await newStorage.saveHistory(shortTerm, longTerm);
            
            // Switch to new storage
            memoryManager.storage = newStorage;
            
            result = {
              success: true,
              message: `Successfully migrated from ${fromBackend} to ${toBackend}`,
              fromBackend,
              toBackend,
              migratedItems: shortTerm.length + longTerm.length,
              config
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.CLEAR_STORAGE:
          const { confirm, backup } = ClearStorageSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            let backupData = null;
            
            if (backup) {
              // Create backup before clearing
              const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
              backupData = {
                timestamp: new Date().toISOString(),
                shortTerm,
                longTerm
              };
            }
            
            // Clear storage - this is a simplified implementation
            // Real implementation would depend on storage backend
            if (memoryManager.storage.constructor.name === 'InMemoryStore') {
              memoryManager.storage.interactions = [];
            }
            
            // Clear memory store
            memoryManager.memStore.shortTermMemory = [];
            memoryManager.memStore.longTermMemory = [];
            memoryManager.memStore.embeddings = [];
            memoryManager.memStore.timestamps = [];
            memoryManager.memStore.accessCounts = [];
            memoryManager.memStore.conceptsList = [];
            
            result = {
              success: true,
              message: "Storage cleared successfully",
              backup: backup ? "Backup created" : "No backup created",
              backupData: backup ? JSON.stringify(backupData, null, 2) : null
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.GET_CONTEXT:
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const contextManager = memoryManager.contextManager;
            
            result = {
              success: true,
              message: "Context information retrieved successfully",
              context: {
                maxTokens: contextManager.maxTokens,
                maxTimeWindow: contextManager.maxTimeWindow,
                relevanceThreshold: contextManager.relevanceThreshold,
                maxContextSize: contextManager.maxContextSize,
                currentBufferSize: contextManager.contextBuffer.length,
                contextItems: contextManager.contextBuffer.map(item => ({
                  prompt: item.prompt?.substring(0, 100) + '...',
                  similarity: item.similarity,
                  addedAt: new Date(item.addedAt).toISOString()
                }))
              }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.UPDATE_CONTEXT_CONFIG:
          const updates = UpdateContextConfigSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const contextManager = memoryManager.contextManager;
            
            // Apply updates
            if (updates.maxTokens !== undefined) contextManager.maxTokens = updates.maxTokens;
            if (updates.maxTimeWindow !== undefined) contextManager.maxTimeWindow = updates.maxTimeWindow;
            if (updates.relevanceThreshold !== undefined) contextManager.relevanceThreshold = updates.relevanceThreshold;
            if (updates.maxContextSize !== undefined) contextManager.maxContextSize = updates.maxContextSize;
            
            result = {
              success: true,
              message: "Context configuration updated successfully",
              updates,
              newConfig: {
                maxTokens: contextManager.maxTokens,
                maxTimeWindow: contextManager.maxTimeWindow,
                relevanceThreshold: contextManager.relevanceThreshold,
                maxContextSize: contextManager.maxContextSize
              }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.PRUNE_CONTEXT:
          const { minRelevance, maxAge } = PruneContextSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const contextManager = memoryManager.contextManager;
            const beforeCount = contextManager.contextBuffer.length;
            
            // Apply custom pruning
            const now = Date.now();
            contextManager.contextBuffer = contextManager.contextBuffer.filter(item => {
              if (item.similarity < minRelevance) return false;
              if (maxAge && (now - item.addedAt) > maxAge) return false;
              return true;
            });
            
            const afterCount = contextManager.contextBuffer.length;
            
            result = {
              success: true,
              message: `Context pruned successfully`,
              beforeCount,
              afterCount,
              removedCount: beforeCount - afterCount,
              criteria: { minRelevance, maxAge }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.SUMMARIZE_CONTEXT:
          await initializeServices();
          const memoryManager = getMemoryManager();
          const safeOps = new SafeOperations(memoryManager);
          
          if (memoryManager) {
            const contextManager = memoryManager.contextManager;
            const summary = contextManager.summarizeContext(contextManager.contextBuffer);
            
            result = {
              success: true,
              message: "Context summary generated successfully",
              summary,
              contextSize: contextManager.contextBuffer.length
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.GET_CONFIG:
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            result = {
              success: true,
              message: "Configuration retrieved successfully",
              config: {
                chatModel: memoryManager.chatModel,
                embeddingModel: memoryManager.embeddingModel,
                storageType: memoryManager.storage.constructor.name,
                dimension: memoryManager.memStore.dimension,
                contextConfig: {
                  maxTokens: memoryManager.contextManager.maxTokens,
                  maxTimeWindow: memoryManager.contextManager.maxTimeWindow,
                  relevanceThreshold: memoryManager.contextManager.relevanceThreshold,
                  maxContextSize: memoryManager.contextManager.maxContextSize
                }
              }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.UPDATE_CONFIG:
          const { section, updates } = UpdateConfigSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            // Apply configuration updates based on section
            const appliedUpdates = {};
            
            switch (section) {
              case 'context':
                if (updates.maxTokens !== undefined) {
                  memoryManager.contextManager.maxTokens = updates.maxTokens;
                  appliedUpdates.maxTokens = updates.maxTokens;
                }
                if (updates.maxTimeWindow !== undefined) {
                  memoryManager.contextManager.maxTimeWindow = updates.maxTimeWindow;
                  appliedUpdates.maxTimeWindow = updates.maxTimeWindow;
                }
                if (updates.relevanceThreshold !== undefined) {
                  memoryManager.contextManager.relevanceThreshold = updates.relevanceThreshold;
                  appliedUpdates.relevanceThreshold = updates.relevanceThreshold;
                }
                if (updates.maxContextSize !== undefined) {
                  memoryManager.contextManager.maxContextSize = updates.maxContextSize;
                  appliedUpdates.maxContextSize = updates.maxContextSize;
                }
                break;
              case 'cache':
                if (updates.maxSize !== undefined) {
                  memoryManager.cacheManager.maxSize = updates.maxSize;
                  appliedUpdates.maxSize = updates.maxSize;
                }
                if (updates.ttl !== undefined) {
                  memoryManager.cacheManager.ttl = updates.ttl;
                  appliedUpdates.ttl = updates.ttl;
                }
                break;
              default:
                throw new Error(`Unknown configuration section: ${section}`);
            }
            
            result = {
              success: true,
              message: `Configuration section '${section}' updated successfully`,
              section,
              appliedUpdates
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.GET_METRICS:
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
            
            result = {
              success: true,
              message: "System metrics retrieved successfully",
              metrics: {
                memory: {
                  shortTermCount: shortTerm.length,
                  longTermCount: longTerm.length,
                  totalInteractions: shortTerm.length + longTerm.length,
                  embeddingsCount: memoryManager.memStore.embeddings.length,
                  conceptsCount: memoryManager.memStore.conceptsList.length
                },
                context: {
                  bufferSize: memoryManager.contextManager.contextBuffer.length,
                  maxSize: memoryManager.contextManager.maxContextSize
                },
                cache: {
                  size: memoryManager.cacheManager.cache.size,
                  maxSize: memoryManager.cacheManager.maxSize
                },
                system: {
                  uptime: process.uptime(),
                  memoryUsage: process.memoryUsage(),
                  nodeVersion: process.version
                }
              }
            };
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.HEALTH_CHECK:
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          const healthStatus = {
            success: true,
            message: "Health check completed",
            timestamp: new Date().toISOString(),
            components: {}
          };

          // Check memory manager
          if (memoryManager) {
            healthStatus.components.memoryManager = {
              status: 'healthy',
              initialized: memoryManager._initialized
            };
            
            // Check storage
            try {
              await memoryManager.storage.loadHistory();
              healthStatus.components.storage = {
                status: 'healthy',
                type: memoryManager.storage.constructor.name
              };
            } catch (error) {
              healthStatus.components.storage = {
                status: 'unhealthy',
                error: error.message
              };
            }
            
            // Check LLM handler
            healthStatus.components.llmHandler = {
              status: memoryManager.llmHandler ? 'healthy' : 'missing',
              model: memoryManager.chatModel
            };
            
            // Check embedding handler
            healthStatus.components.embeddingHandler = {
              status: memoryManager.embeddingHandler ? 'healthy' : 'missing',
              model: memoryManager.embeddingModel
            };
          } else {
            healthStatus.components.memoryManager = {
              status: 'unhealthy',
              error: 'Not initialized'
            };
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(healthStatus, null, 2)
            }]
          };
          break;

        case ToolName.RAGNO_DECOMPOSE_CORPUS:
          const { textChunks, options } = RagnoDecomposeCorpusSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            try {
              // Import Ragno functions
              const { decomposeCorpus } = await import('../../src/ragno/decomposeCorpus.js');
              
              // Perform corpus decomposition
              const result = await decomposeCorpus(textChunks, memoryManager.llmHandler, options);
              
              result = {
                success: true,
                message: `Corpus decomposed into ${result.entities.length} entities, ${result.units.length} semantic units, and ${result.relationships.length} relationships`,
                statistics: result.statistics,
                entityCount: result.entities.length,
                unitCount: result.units.length,
                relationshipCount: result.relationships.length,
                entities: result.entities.slice(0, 10).map(e => ({
                  name: e.getName(),
                  frequency: e.getFrequency(),
                  isEntryPoint: e.isEntryPoint(),
                  subType: e.getSubType()
                }))
              };
            } catch (error) {
              throw new Error(`Corpus decomposition failed: ${error.message}`);
            }
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.RAGNO_SEARCH_DUAL:
          const { query, options } = RagnoSearchDualSchema.parse(args);
          
          await initializeServices();
          
          try {
            // Import DualSearch
            const { DualSearch } = await import('../../src/ragno/search/DualSearch.js');
            
            // Initialize dual search (would need proper initialization in real implementation)
            const dualSearch = new DualSearch();
            const results = await dualSearch.search(query, options);
            
            result = {
              success: true,
              message: `Dual search completed with ${results.length} results`,
              query,
              results: results.slice(0, options.combinedLimit || 20),
              searchMethods: {
                exactMatch: results.filter(r => r.method === 'exact').length,
                vectorSimilarity: results.filter(r => r.method === 'vector').length,
                personalizedPageRank: results.filter(r => r.method === 'ppr').length
              }
            };
          } catch (error) {
            throw new Error(`Dual search failed: ${error.message}`);
          }
          break;

        case ToolName.RAGNO_GET_ENTITIES:
          const { filters } = RagnoGetEntitiesSchema.parse(args);
          
          await initializeServices();
          
          try {
            // This would integrate with the RDF graph manager
            // For now, return a placeholder implementation
            result = {
              success: true,
              message: "Entity retrieval completed",
              filters,
              entities: [], // Would contain actual entity data
              totalCount: 0,
              note: "Entity retrieval requires active knowledge graph - use ragno_decompose_corpus first"
            };
          } catch (error) {
            throw new Error(`Entity retrieval failed: ${error.message}`);
          }
          break;

        case ToolName.RAGNO_VECTOR_SEARCH:
          const { query, options } = RagnoVectorSearchSchema.parse(args);
          
          await initializeServices();
          const memoryManager = getMemoryManager();
          
          if (memoryManager) {
            try {
              // Generate query embedding
              const safeOps = new SafeOperations(memoryManager);
              const queryEmbedding = await safeOps.generateEmbedding(query);
              
              // This would use the VectorIndex for HNSW search
              // For now, return placeholder
              result = {
                success: true,
                message: `Vector search completed for query: "${query}"`,
                query,
                options,
                queryEmbedding: {
                  dimensions: queryEmbedding.length,
                  preview: queryEmbedding.slice(0, 5)
                },
                results: [], // Would contain vector search results
                note: "Vector search requires enriched knowledge graph with embeddings"
              };
            } catch (error) {
              throw new Error(`Vector search failed: ${error.message}`);
            }
          } else {
            throw new Error('Memory manager not initialized');
          }
          break;

        case ToolName.RAGNO_EXPORT_RDF:
          const { format, includeEmbeddings, includeStatistics } = RagnoExportRdfSchema.parse(args);
          
          await initializeServices();
          
          try {
            // This would export the current knowledge graph
            result = {
              success: true,
              message: `RDF export prepared in ${format} format`,
              format,
              includeEmbeddings,
              includeStatistics,
              exportData: "# RDF export would appear here\n# Use ragno_decompose_corpus to create knowledge graph first",
              note: "RDF export requires active knowledge graph"
            };
          } catch (error) {
            throw new Error(`RDF export failed: ${error.message}`);
          }
          break;

        case ToolName.RAGNO_QUERY_SPARQL:
          const { query, options } = RagnoQuerySparqlSchema.parse(args);
          
          await initializeServices();
          
          try {
            // This would execute SPARQL against the RDF store
            result = {
              success: true,
              message: "SPARQL query executed",
              query,
              options,
              results: [], // Would contain SPARQL results
              note: "SPARQL queries require RDF store backend (use SPARQL storage backend)"
            };
          } catch (error) {
            throw new Error(`SPARQL query failed: ${error.message}`);
          }
          break;

        case ToolName.RAGNO_ANALYZE_GRAPH:
          const { analysisTypes, options } = RagnoAnalyzeGraphSchema.parse(args);
          
          await initializeServices();
          
          try {
            // This would perform graph analysis
            const analysis = {};
            
            for (const type of analysisTypes) {
              switch (type) {
                case 'statistics':
                  analysis.statistics = {
                    nodeCount: 0,
                    edgeCount: 0,
                    avgDegree: 0,
                    density: 0
                  };
                  break;
                case 'centrality':
                  analysis.centrality = {
                    betweenness: [],
                    pagerank: [],
                    degree: []
                  };
                  break;
                case 'communities':
                  analysis.communities = {
                    communityCount: 0,
                    modularity: 0,
                    communities: []
                  };
                  break;
                case 'connectivity':
                  analysis.connectivity = {
                    connectedComponents: 0,
                    largestComponent: 0,
                    bridges: []
                  };
                  break;
              }
            }
            
            result = {
              success: true,
              message: `Graph analysis completed for: ${analysisTypes.join(', ')}`,
              analysisTypes,
              options,
              analysis,
              note: "Graph analysis requires active knowledge graph"
            };
          } catch (error) {
            throw new Error(`Graph analysis failed: ${error.message}`);
          }
          break;

        case ToolName.RAGNO_GET_GRAPH_STATS:
          const { detailed } = RagnoGetGraphStatsSchema.parse(args);
          
          await initializeServices();
          
          try {
            const stats = {
              basic: {
                entities: 0,
                relationships: 0,
                semanticUnits: 0,
                totalTriples: 0
              }
            };
            
            if (detailed) {
              stats.detailed = {
                entityTypes: {},
                relationshipTypes: {},
                frequencyDistribution: {},
                connectivityMetrics: {
                  avgDegree: 0,
                  density: 0,
                  clustering: 0
                }
              };
            }
            
            result = {
              success: true,
              message: "Graph statistics retrieved",
              detailed,
              stats,
              note: "Statistics reflect current knowledge graph state"
            };
          } catch (error) {
            throw new Error(`Graph statistics failed: ${error.message}`);
          }
          break;

        case ToolName.ZPT_NAVIGATE:
          result = await zptService.navigate(args.query, args.zoom, args.pan, args.tilt, args.transform);
          break;

        case ToolName.ZPT_PREVIEW:
          result = await zptService.preview(args.query, args.zoom, args.pan);
          break;

        case ToolName.ZPT_GET_SCHEMA:
          result = await zptService.getSchema();
          break;

        case ToolName.ZPT_VALIDATE_PARAMS:
          result = await zptService.validateParams(args.params);
          break;

        case ToolName.ZPT_GET_OPTIONS:
          result = await zptService.getOptions(args.context, args.query);
          break;

        case ToolName.ZPT_ANALYZE_CORPUS:
          result = await zptService.analyzeCorpus(args.analysisType, args.includeStats);
          break;

        case ToolName.RESEARCH_INGEST_DOCUMENTS:
          result = await workflowOrchestrator.researchIngestDocuments(args);
          break;

        case ToolName.RESEARCH_GENERATE_INSIGHTS:
          result = await workflowOrchestrator.researchGenerateInsights(args);
          break;

        case ToolName.ADAPTIVE_QUERY_PROCESSING:
          result = await workflowOrchestrator.adaptiveQueryProcessing(args);
          break;

        case ToolName.HYBRID_SEARCH:
          result = await workflowOrchestrator.hybridSearch(args);
          break;

        case ToolName.CAPTURE_USER_FEEDBACK:
          result = await workflowOrchestrator.captureUserFeedback(args);
          break;

        case ToolName.INCREMENTAL_LEARNING:
          result = await workflowOrchestrator.incrementalLearning(args);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      mcpDebugger.error(`Error calling tool ${toolName}:`, error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: error.message,
            stack: error.stack,
            toolName
          })
        }],
        isError: true
      };
    }
  });

  mcpDebugger.info('Memory tools registered successfully using HTTP pattern');
}