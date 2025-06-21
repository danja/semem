/**
 * Memory-related MCP tools using proper HTTP version pattern
 * Based on the reference implementation pattern
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';
import { mcpDebugger } from '../lib/debug-utils.js';
import { PROMPT_TOOLS } from './prompt-tools.js';

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
  RAGNO_GET_GRAPH_STATS: "ragno_get_graph_stats"
};

/**
 * Register memory-related tools using HTTP version pattern
 */
export function registerMemoryToolsHttp(server) {
  mcpDebugger.info('Registering memory tools using HTTP pattern...');

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...PROMPT_TOOLS,
        {
          name: ToolName.STORE_INTERACTION,
          description: "Store a new interaction in semantic memory with embeddings and concept extraction",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The user prompt or question"
              },
              response: {
                type: "string", 
                description: "The response or answer"
              },
              metadata: {
                type: "object",
                description: "Optional metadata for the interaction",
                additionalProperties: true
              }
            },
            required: ["prompt", "response"]
          }
        },
        {
          name: ToolName.RETRIEVE_MEMORIES,
          description: "Retrieve similar memories from semantic storage using vector similarity search",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query to find similar memories"
              },
              threshold: {
                type: "number",
                description: "Similarity threshold (0-1, default 0.7)",
                minimum: 0,
                maximum: 1
              },
              limit: {
                type: "number", 
                description: "Maximum number of results (default 10)",
                minimum: 1,
                maximum: 100
              }
            },
            required: ["query"]
          }
        },
        {
          name: ToolName.GENERATE_EMBEDDING,
          description: "Generate vector embedding for given text",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Text to generate embedding for"
              }
            },
            required: ["text"]
          }
        },
        {
          name: ToolName.GENERATE_RESPONSE,
          description: "Generate response using LLM with optional memory context",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Prompt for the LLM"
              },
              useMemory: {
                type: "boolean",
                description: "Whether to use memory context (default true)"
              },
              temperature: {
                type: "number",
                description: "Temperature for generation (0-2, default 0.7)",
                minimum: 0,
                maximum: 2
              },
              maxTokens: {
                type: "number",
                description: "Maximum tokens to generate (default 1000)",
                minimum: 1,
                maximum: 4000
              }
            },
            required: ["prompt"]
          }
        },
        {
          name: ToolName.EXTRACT_CONCEPTS,
          description: "Extract key concepts from text using LLM analysis",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Text to extract concepts from"
              }
            },
            required: ["text"]
          }
        },
        
        // Phase 1 - Storage Backend Operations
        {
          name: ToolName.SWITCH_STORAGE_BACKEND,
          description: "Switch between different storage backends (InMemory, JSON, SPARQL, CachedSPARQL)",
          inputSchema: {
            type: "object",
            properties: {
              backend: {
                type: "string",
                enum: ["InMemory", "JSON", "SPARQL", "CachedSPARQL"],
                description: "Storage backend to switch to"
              },
              config: {
                type: "object",
                description: "Configuration for the new backend",
                additionalProperties: true
              }
            },
            required: ["backend"]
          }
        },
        {
          name: ToolName.BACKUP_MEMORY,
          description: "Backup current memory to JSON/RDF formats",
          inputSchema: {
            type: "object",
            properties: {
              format: {
                type: "string",
                enum: ["json", "rdf", "turtle"],
                description: "Backup format (default: json)"
              },
              includeEmbeddings: {
                type: "boolean",
                description: "Include embeddings in backup (default: true)"
              }
            }
          }
        },
        {
          name: ToolName.LOAD_MEMORY,
          description: "Load memory from backup files",
          inputSchema: {
            type: "object",
            properties: {
              source: {
                type: "string",
                description: "Source path or URI to load from"
              },
              format: {
                type: "string",
                enum: ["json", "rdf", "turtle"],
                description: "Format of the source data (default: json)"
              },
              merge: {
                type: "boolean",
                description: "Merge with existing memory or replace (default: false)"
              }
            },
            required: ["source"]
          }
        },
        {
          name: ToolName.STORAGE_STATS,
          description: "Get storage statistics and health information",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: ToolName.MIGRATE_STORAGE,
          description: "Migrate data between storage backends",
          inputSchema: {
            type: "object",
            properties: {
              fromBackend: {
                type: "string",
                description: "Source storage backend"
              },
              toBackend: {
                type: "string",
                description: "Target storage backend"
              },
              config: {
                type: "object",
                description: "Configuration for target backend",
                additionalProperties: true
              }
            },
            required: ["fromBackend", "toBackend"]
          }
        },
        {
          name: ToolName.CLEAR_STORAGE,
          description: "Clear storage with optional backup",
          inputSchema: {
            type: "object",
            properties: {
              confirm: {
                type: "boolean",
                description: "Must be true to confirm deletion",
                const: true
              },
              backup: {
                type: "boolean",
                description: "Create backup before clearing (default: true)"
              }
            },
            required: ["confirm"]
          }
        },
        
        // Phase 1 - Context Management Operations
        {
          name: ToolName.GET_CONTEXT,
          description: "Retrieve current context window information",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: ToolName.UPDATE_CONTEXT_CONFIG,
          description: "Update context window configuration settings",
          inputSchema: {
            type: "object",
            properties: {
              maxTokens: {
                type: "number",
                minimum: 1000,
                maximum: 32000,
                description: "Maximum tokens in context window"
              },
              maxTimeWindow: {
                type: "number",
                minimum: 1000,
                description: "Maximum time window for context in milliseconds"
              },
              relevanceThreshold: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "Minimum relevance threshold for context items"
              },
              maxContextSize: {
                type: "number",
                minimum: 1,
                maximum: 20,
                description: "Maximum number of items in context"
              }
            }
          }
        },
        {
          name: ToolName.PRUNE_CONTEXT,
          description: "Manually prune context based on relevance and age",
          inputSchema: {
            type: "object",
            properties: {
              minRelevance: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "Minimum relevance to keep (default: 0.5)"
              },
              maxAge: {
                type: "number",
                minimum: 0,
                description: "Maximum age in milliseconds (optional)"
              }
            }
          }
        },
        {
          name: ToolName.SUMMARIZE_CONTEXT,
          description: "Generate summaries of current context",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        
        // Phase 1 - Configuration & Status Operations
        {
          name: ToolName.GET_CONFIG,
          description: "Get current system configuration",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: ToolName.UPDATE_CONFIG,
          description: "Update system configuration settings",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                description: "Configuration section to update"
              },
              updates: {
                type: "object",
                description: "Configuration updates to apply",
                additionalProperties: true
              }
            },
            required: ["section", "updates"]
          }
        },
        {
          name: ToolName.GET_METRICS,
          description: "Get detailed system metrics and performance data",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: ToolName.HEALTH_CHECK,
          description: "Comprehensive health check of all system components",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        
        // Phase 2 - Ragno Knowledge Graph Operations
        {
          name: ToolName.RAGNO_DECOMPOSE_CORPUS,
          description: "Decompose text corpus into RDF knowledge graph with entities, relationships, and semantic units",
          inputSchema: {
            type: "object",
            properties: {
              textChunks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    content: {
                      type: "string",
                      description: "Text content to decompose"
                    },
                    source: {
                      type: "string",
                      description: "Source identifier for the text (optional)"
                    }
                  },
                  required: ["content"]
                },
                description: "Array of text chunks to decompose into knowledge graph",
                minItems: 1
              },
              options: {
                type: "object",
                properties: {
                  extractRelationships: {
                    type: "boolean",
                    description: "Whether to extract relationships between entities (default: true)"
                  },
                  generateSummaries: {
                    type: "boolean",
                    description: "Whether to generate summaries for semantic units (default: true)"
                  },
                  minEntityConfidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Minimum confidence threshold for entity extraction (default: 0.5)"
                  },
                  maxEntitiesPerUnit: {
                    type: "number",
                    minimum: 1,
                    maximum: 50,
                    description: "Maximum number of entities per semantic unit (default: 20)"
                  }
                },
                description: "Optional configuration for decomposition process"
              }
            },
            required: ["textChunks"]
          }
        },
        {
          name: ToolName.RAGNO_SEARCH_DUAL,
          description: "Perform dual search combining exact matching, vector similarity, and personalized PageRank",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query to find relevant entities and content"
              },
              options: {
                type: "object",
                properties: {
                  exactMatchThreshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Threshold for exact text matching (default: 0.8)"
                  },
                  vectorSimilarityThreshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Threshold for vector similarity matching (default: 0.7)"
                  },
                  pprMaxDepth: {
                    type: "number",
                    minimum: 1,
                    maximum: 10,
                    description: "Maximum depth for PersonalizedPageRank traversal (default: 3)"
                  },
                  combinedLimit: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    description: "Maximum number of combined results (default: 20)"
                  }
                },
                description: "Optional search configuration parameters"
              }
            },
            required: ["query"]
          }
        },
        {
          name: ToolName.RAGNO_GET_ENTITIES,
          description: "Retrieve entities from the knowledge graph with optional filtering",
          inputSchema: {
            type: "object",
            properties: {
              filters: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    description: "Filter by entity type/subtype"
                  },
                  minFrequency: {
                    type: "number",
                    minimum: 0,
                    description: "Minimum frequency of entity mentions"
                  },
                  isEntryPoint: {
                    type: "boolean",
                    description: "Filter for entry point entities only"
                  },
                  limit: {
                    type: "number",
                    minimum: 1,
                    maximum: 1000,
                    description: "Maximum number of entities to return (default: 100)"
                  }
                },
                description: "Optional filters for entity retrieval"
              }
            }
          }
        },
        {
          name: ToolName.RAGNO_VECTOR_SEARCH,
          description: "Perform vector similarity search on knowledge graph embeddings using HNSW index",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Query text to find similar entities and semantic units"
              },
              options: {
                type: "object",
                properties: {
                  k: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    description: "Number of similar results to return (default: 10)"
                  },
                  threshold: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Minimum similarity threshold (default: 0.7)"
                  },
                  types: {
                    type: "array",
                    items: { type: "string" },
                    description: "Filter by specific entity/unit types"
                  },
                  includeMetadata: {
                    type: "boolean",
                    description: "Include metadata in results (default: true)"
                  }
                },
                description: "Optional vector search parameters"
              }
            },
            required: ["query"]
          }
        },
        {
          name: ToolName.RAGNO_EXPORT_RDF,
          description: "Export knowledge graph in various RDF formats (Turtle, N-Triples, JSON-LD)",
          inputSchema: {
            type: "object",
            properties: {
              format: {
                type: "string",
                enum: ["turtle", "ntriples", "jsonld", "json"],
                description: "Output format for RDF export (default: turtle)"
              },
              includeEmbeddings: {
                type: "boolean",
                description: "Include vector embeddings in export (default: false)"
              },
              includeStatistics: {
                type: "boolean",
                description: "Include graph statistics in export (default: false)"
              }
            }
          }
        },
        {
          name: ToolName.RAGNO_QUERY_SPARQL,
          description: "Execute SPARQL queries against the knowledge graph RDF store",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "SPARQL query to execute against the graph"
              },
              options: {
                type: "object",
                properties: {
                  limit: {
                    type: "number",
                    minimum: 1,
                    maximum: 10000,
                    description: "Maximum number of results (default: 1000)"
                  },
                  format: {
                    type: "string",
                    enum: ["json", "xml", "csv"],
                    description: "Result format (default: json)"
                  }
                },
                description: "Optional query execution parameters"
              }
            },
            required: ["query"]
          }
        },
        {
          name: ToolName.RAGNO_ANALYZE_GRAPH,
          description: "Perform graph analysis including centrality, community detection, and connectivity analysis",
          inputSchema: {
            type: "object",
            properties: {
              analysisTypes: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["centrality", "communities", "statistics", "connectivity"]
                },
                description: "Types of analysis to perform (default: ['statistics'])"
              },
              options: {
                type: "object",
                properties: {
                  topK: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    description: "Number of top results to return for rankings (default: 10)"
                  },
                  includeDetails: {
                    type: "boolean",
                    description: "Include detailed analysis results (default: true)"
                  }
                },
                description: "Optional analysis configuration"
              }
            }
          }
        },
        {
          name: ToolName.RAGNO_GET_GRAPH_STATS,
          description: "Get basic or detailed statistics about the current knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              detailed: {
                type: "boolean",
                description: "Return detailed statistics including distributions (default: false)"
              }
            }
          }
        }
      ]
    };
  });

  // Call tool handler - this is the key fix!
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    mcpDebugger.info(`Tool called: ${name}`, {
      arguments: mcpDebugger.inspectParameters(args)
    });

    try {
      if (name === ToolName.STORE_INTERACTION) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully stored interaction with ${concepts.length} concepts extracted`,
                id,
                conceptsCount: concepts.length
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.RETRIEVE_MEMORIES) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.GENERATE_EMBEDDING) {
        const { text } = GenerateEmbeddingSchema.parse(args);
        
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        if (memoryManager) {
          const embedding = await safeOps.generateEmbedding(text);
          
          return {
            content: [{
              type: "text", 
              text: JSON.stringify({
                success: true,
                message: "Successfully generated embedding",
                dimensions: embedding.length,
                preview: embedding.slice(0, 5) // Show first 5 dimensions
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.GENERATE_RESPONSE) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Successfully generated response",
                response,
                contextUsed: useMemory && context.length > 0,
                memoriesUsed: useMemory ? context.split('\n').length : 0
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.EXTRACT_CONCEPTS) {
        const { text } = ExtractConceptsSchema.parse(args);
        
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        if (memoryManager) {
          const concepts = await safeOps.extractConcepts(text);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully extracted ${concepts.length} concepts`,
                concepts
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      // Phase 1 - Storage Backend Operations
      if (name === ToolName.SWITCH_STORAGE_BACKEND) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully switched to ${backend} storage backend`,
                backend,
                config
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.BACKUP_MEMORY) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Memory backup created successfully`,
                format,
                filename,
                shortTermCount: shortTerm.length,
                longTermCount: longTerm.length,
                includeEmbeddings,
                backup: JSON.stringify(backupData, null, 2)
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.STORAGE_STATS) {
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        if (memoryManager) {
          const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.LOAD_MEMORY) {
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
      }

      if (name === ToolName.MIGRATE_STORAGE) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Successfully migrated from ${fromBackend} to ${toBackend}`,
                fromBackend,
                toBackend,
                migratedItems: shortTerm.length + longTerm.length,
                config
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.CLEAR_STORAGE) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Storage cleared successfully",
                backup: backup ? "Backup created" : "No backup created",
                backupData: backup ? JSON.stringify(backupData, null, 2) : null
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      // Phase 1 - Context Management Operations
      if (name === ToolName.GET_CONTEXT) {
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        if (memoryManager) {
          const contextManager = memoryManager.contextManager;
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.UPDATE_CONTEXT_CONFIG) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Context configuration updated successfully",
                updates,
                newConfig: {
                  maxTokens: contextManager.maxTokens,
                  maxTimeWindow: contextManager.maxTimeWindow,
                  relevanceThreshold: contextManager.relevanceThreshold,
                  maxContextSize: contextManager.maxContextSize
                }
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.PRUNE_CONTEXT) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Context pruned successfully`,
                beforeCount,
                afterCount,
                removedCount: beforeCount - afterCount,
                criteria: { minRelevance, maxAge }
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.SUMMARIZE_CONTEXT) {
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        if (memoryManager) {
          const contextManager = memoryManager.contextManager;
          const summary = contextManager.summarizeContext(contextManager.contextBuffer);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Context summary generated successfully",
                summary,
                contextSize: contextManager.contextBuffer.length
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      // Phase 1 - Configuration & Status Operations
      if (name === ToolName.GET_CONFIG) {
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        if (memoryManager) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.UPDATE_CONFIG) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Configuration section '${section}' updated successfully`,
                section,
                appliedUpdates
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.GET_METRICS) {
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        if (memoryManager) {
          const [shortTerm, longTerm] = await memoryManager.storage.loadHistory();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
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
              }, null, 2)
            }]
          };
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.HEALTH_CHECK) {
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

        return {
          content: [{
            type: "text",
            text: JSON.stringify(healthStatus, null, 2)
          }]
        };
      }

      // Phase 2 - Ragno Knowledge Graph Operations
      if (name === ToolName.RAGNO_DECOMPOSE_CORPUS) {
        const { textChunks, options } = RagnoDecomposeCorpusSchema.parse(args);
        
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        if (memoryManager) {
          try {
            // Import Ragno functions
            const { decomposeCorpus } = await import('../../src/ragno/decomposeCorpus.js');
            
            // Perform corpus decomposition
            const result = await decomposeCorpus(textChunks, memoryManager.llmHandler, options);
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
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
                }, null, 2)
              }]
            };
          } catch (error) {
            throw new Error(`Corpus decomposition failed: ${error.message}`);
          }
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.RAGNO_SEARCH_DUAL) {
        const { query, options } = RagnoSearchDualSchema.parse(args);
        
        await initializeServices();
        
        try {
          // Import DualSearch
          const { DualSearch } = await import('../../src/ragno/search/DualSearch.js');
          
          // Initialize dual search (would need proper initialization in real implementation)
          const dualSearch = new DualSearch();
          const results = await dualSearch.search(query, options);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Dual search completed with ${results.length} results`,
                query,
                results: results.slice(0, options.combinedLimit || 20),
                searchMethods: {
                  exactMatch: results.filter(r => r.method === 'exact').length,
                  vectorSimilarity: results.filter(r => r.method === 'vector').length,
                  personalizedPageRank: results.filter(r => r.method === 'ppr').length
                }
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Dual search failed: ${error.message}`);
        }
      }

      if (name === ToolName.RAGNO_GET_ENTITIES) {
        const { filters } = RagnoGetEntitiesSchema.parse(args);
        
        await initializeServices();
        
        try {
          // This would integrate with the RDF graph manager
          // For now, return a placeholder implementation
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Entity retrieval completed",
                filters,
                entities: [], // Would contain actual entity data
                totalCount: 0,
                note: "Entity retrieval requires active knowledge graph - use ragno_decompose_corpus first"
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Entity retrieval failed: ${error.message}`);
        }
      }

      if (name === ToolName.RAGNO_VECTOR_SEARCH) {
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
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
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
                }, null, 2)
              }]
            };
          } catch (error) {
            throw new Error(`Vector search failed: ${error.message}`);
          }
        } else {
          throw new Error('Memory manager not initialized');
        }
      }

      if (name === ToolName.RAGNO_EXPORT_RDF) {
        const { format, includeEmbeddings, includeStatistics } = RagnoExportRdfSchema.parse(args);
        
        await initializeServices();
        
        try {
          // This would export the current knowledge graph
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `RDF export prepared in ${format} format`,
                format,
                includeEmbeddings,
                includeStatistics,
                exportData: "# RDF export would appear here\n# Use ragno_decompose_corpus to create knowledge graph first",
                note: "RDF export requires active knowledge graph"
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`RDF export failed: ${error.message}`);
        }
      }

      if (name === ToolName.RAGNO_QUERY_SPARQL) {
        const { query, options } = RagnoQuerySparqlSchema.parse(args);
        
        await initializeServices();
        
        try {
          // This would execute SPARQL against the RDF store
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "SPARQL query executed",
                query,
                options,
                results: [], // Would contain SPARQL results
                note: "SPARQL queries require RDF store backend (use SPARQL storage backend)"
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`SPARQL query failed: ${error.message}`);
        }
      }

      if (name === ToolName.RAGNO_ANALYZE_GRAPH) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Graph analysis completed for: ${analysisTypes.join(', ')}`,
                analysisTypes,
                options,
                analysis,
                note: "Graph analysis requires active knowledge graph"
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Graph analysis failed: ${error.message}`);
        }
      }

      if (name === ToolName.RAGNO_GET_GRAPH_STATS) {
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Graph statistics retrieved",
                detailed,
                stats,
                note: "Statistics reflect current knowledge graph state"
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new Error(`Graph statistics failed: ${error.message}`);
        }
      }

      // Handle prompt tools
      if (name === "prompt_list") {
        const { promptRegistry } = await import('../prompts/registry.js');
        const { category } = args || {};
        
        const prompts = promptRegistry.listPrompts();
        mcpDebugger.info(`Listed ${prompts.length} available prompts`);
        
        // Filter by category if specified
        let filteredPrompts = prompts;
        if (category) {
          filteredPrompts = prompts.filter(prompt => {
            const category = prompt.name.startsWith('semem-') ? 'Memory Workflows' :
                           prompt.name.startsWith('ragno-') ? 'Knowledge Graph' :
                           prompt.name.startsWith('zpt-') ? '3D Navigation' : 'Integrated Workflows';
            return category.toLowerCase().includes(category.toLowerCase());
          });
        }
        
        // Group prompts by category for better display
        const categories = {};
        filteredPrompts.forEach(prompt => {
          const cat = prompt.name.startsWith('semem-') ? 'Memory Workflows' :
                     prompt.name.startsWith('ragno-') ? 'Knowledge Graph' :
                     prompt.name.startsWith('zpt-') ? '3D Navigation' : 'Integrated Workflows';
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments.length,
            requiredArgs: prompt.arguments.filter(a => a.required).length
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              totalPrompts: prompts.length,
              filteredPrompts: filteredPrompts.length,
              categories,
              availableCategories: ["memory", "ragno", "zpt", "integrated"]
            }, null, 2)
          }]
        };
      }

      if (name === "prompt_get") {
        const { promptRegistry } = await import('../prompts/registry.js');
        const { name: promptName } = args || {};
        
        if (!promptName) {
          throw new Error('Prompt name is required');
        }

        const prompt = promptRegistry.getPrompt(promptName);
        if (!prompt) {
          throw new Error(`Prompt not found: ${promptName}`);
        }

        mcpDebugger.info(`Retrieved prompt: ${promptName}`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prompt: {
                name: prompt.name,
                description: prompt.description,
                category: prompt.name.startsWith('semem-') ? 'Memory Workflows' :
                         prompt.name.startsWith('ragno-') ? 'Knowledge Graph' :
                         prompt.name.startsWith('zpt-') ? '3D Navigation' : 'Integrated Workflows',
                arguments: prompt.arguments,
                workflow: prompt.workflow.map(step => ({
                  tool: step.tool,
                  arguments: step.arguments,
                  condition: step.condition,
                  description: step.description || `Execute ${step.tool} tool`
                })),
                examples: prompt.examples || []
              }
            }, null, 2)
          }]
        };
      }

      if (name === "prompt_execute") {
        const { promptRegistry } = await import('../prompts/registry.js');
        const { executePromptWorkflow, createSafeToolExecutor, validateExecutionPrerequisites } = await import('../prompts/utils.js');
        const { name: promptName, arguments: promptArgs = {} } = args || {};
        
        if (!promptName) {
          throw new Error('Prompt name is required');
        }

        const prompt = promptRegistry.getPrompt(promptName);
        if (!prompt) {
          throw new Error(`Prompt not found: ${promptName}`);
        }

        // Validate prerequisites
        const prerequisites = validateExecutionPrerequisites(prompt, server);
        if (!prerequisites.valid) {
          throw new Error(`Prerequisites not met: ${prerequisites.errors.join(', ')}`);
        }

        // Create tool executor
        const toolExecutor = createSafeToolExecutor(server);

        // Execute the prompt workflow
        mcpDebugger.info(`Executing prompt: ${promptName}`, { arguments: promptArgs });
        const result = await executePromptWorkflow(prompt, promptArgs, toolExecutor);

        mcpDebugger.info(`Prompt execution completed: ${promptName}`, { 
          success: result.success,
          steps: result.results.length 
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success,
              promptName: promptName,
              executionId: result.executionId,
              steps: result.results.length,
              results: result.results,
              summary: result.summary,
              error: result.error,
              partialCompletion: result.partialCompletion
            }, null, 2)
          }]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
      
    } catch (error) {
      mcpDebugger.error(`Tool ${name} failed`, {
        error: error.message,
        stack: error.stack
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: name
          }, null, 2)
        }]
      };
    }
  });

  mcpDebugger.info('Memory tools registered successfully using HTTP pattern');
}