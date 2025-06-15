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
  HEALTH_CHECK: "semem_health_check"
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
        const { query, threshold, limit } = RetrieveMemoriesSchema.parse(args);
        
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        if (memoryManager) {
          // Search for similar memories using SafeOperations
          const memories = await safeOps.retrieveMemories(query, threshold, 0);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Found ${memories.length} similar memories`,
                memories: memories.map(m => ({
                  prompt: m.prompt,
                  response: m.response,
                  similarity: m.similarity,
                  concepts: m.concepts?.slice(0, 5) // Limit concepts shown
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
            const memories = await safeOps.retrieveMemories(prompt, 0.7, 0);
            
            if (memories.length > 0) {
              context = memories.map(m => `Previous: ${m.prompt} -> ${m.response}`).join('\n');
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