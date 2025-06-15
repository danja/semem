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

// Tool names enum
const ToolName = {
  STORE_INTERACTION: "semem_store_interaction",
  RETRIEVE_MEMORIES: "semem_retrieve_memories", 
  GENERATE_EMBEDDING: "semem_generate_embedding",
  GENERATE_RESPONSE: "semem_generate_response",
  EXTRACT_CONCEPTS: "semem_extract_concepts"
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
          // Generate query embedding
          const queryEmbedding = await safeOps.generateEmbedding(query);
          
          // Search for similar memories
          const memories = await memoryManager.searchSimilar(query, queryEmbedding, limit, threshold);
          
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
            // Get relevant memories for context
            const queryEmbedding = await safeOps.generateEmbedding(prompt);
            const memories = await memoryManager.searchSimilar(prompt, queryEmbedding, 3, 0.7);
            
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