/**
 * Fixed Memory-related MCP tools with proper parameter handling
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';
import { mcpDebugger, debugToolHandler, extractParameters } from '../lib/debug-utils.js';

/**
 * Helper function to properly extract and validate parameters
 */
function validateParameters(args, schema, toolName) {
  mcpDebugger.debug(`Validating parameters for ${toolName}`, {
    argsLength: args.length,
    argsInspection: mcpDebugger.inspectParameters(args)
  });

  if (!args || args.length === 0) {
    throw new Error(`No parameters provided to ${toolName}`);
  }

  // MCP passes parameters as a single object (first argument)
  const params = args[0];
  
  if (typeof params !== 'object' || params === null) {
    throw new Error(`${toolName} expected object parameters, got ${typeof params}`);
  }

  // Validate with Zod schema
  try {
    const validated = schema.parse(params);
    mcpDebugger.debug(`Parameter validation successful for ${toolName}`, {
      validated: mcpDebugger.inspectParameters(validated)
    });
    return validated;
  } catch (error) {
    mcpDebugger.error(`Parameter validation failed for ${toolName}`, {
      error: error.message,
      receivedParams: mcpDebugger.inspectParameters(params)
    });
    throw new Error(`Invalid parameters for ${toolName}: ${error.message}`);
  }
}

/**
 * Register memory-related tools with the MCP server using fixed parameter handling
 */
export function registerMemoryToolsFixed(server) {
  mcpDebugger.info('Registering fixed memory tools...');

  // Store interaction tool with fixed parameter handling
  server.tool(
    "semem_store_interaction",
    {
      description: "Store a new interaction in semantic memory with embeddings and concept extraction",
      parameters: {
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
    debugToolHandler("semem_store_interaction", async (...args) => {
      const schema = z.object({
        prompt: z.string().min(1, "Prompt cannot be empty"),
        response: z.string().min(1, "Response cannot be empty"),
        metadata: z.object({}).optional().default({})
      });

      const { prompt, response, metadata } = validateParameters(args, schema, "semem_store_interaction");

      try {
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
                prompt: prompt.substring(0, 50) + "...",
                conceptCount: concepts.length,
                metadata
              }, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Memory manager not initialized"
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        mcpDebugger.error('Error in semem_store_interaction', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error storing interaction: ${error.message}`,
              prompt: prompt.substring(0, 50) + "..."
            }, null, 2)
          }],
          isError: true
        };
      }
    })
  );

  // Retrieve memories tool with fixed parameter handling
  server.tool(
    "semem_retrieve_memories",
    {
      description: "Search for relevant memories based on semantic similarity",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query to search for"
          },
          threshold: {
            type: "number",
            description: "Similarity threshold (0-1)",
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: "number", 
            description: "Maximum number of results",
            minimum: 1,
            maximum: 100
          },
          excludeLastN: {
            type: "number",
            description: "Exclude last N interactions",
            minimum: 0
          }
        },
        required: ["query"]
      }
    },
    debugToolHandler("semem_retrieve_memories", async (...args) => {
      const schema = z.object({
        query: z.string().min(1, "Query cannot be empty"),
        threshold: z.number().min(0).max(1).optional().default(0.7),
        limit: z.number().int().min(1).max(100).optional().default(10),
        excludeLastN: z.number().int().min(0).optional().default(0)
      });

      const { query, threshold, limit, excludeLastN } = validateParameters(args, schema, "semem_retrieve_memories");

      try {
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        const memories = await safeOps.retrieveMemories(query, threshold, excludeLastN);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: memories.length,
              query: query.substring(0, 50) + (query.length > 50 ? "..." : ""),
              threshold,
              limit,
              memories: memories.slice(0, limit)
            }, null, 2)
          }]
        };
      } catch (error) {
        mcpDebugger.error('Error in semem_retrieve_memories', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error retrieving memories: ${error.message}`,
              query: query.substring(0, 50) + "..."
            }, null, 2)
          }],
          isError: true
        };
      }
    })
  );

  // Generate embedding tool with fixed parameter handling
  server.tool(
    "semem_generate_embedding",
    {
      description: "Generate vector embeddings for text",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to generate embeddings for"
          }
        },
        required: ["text"]
      }
    },
    debugToolHandler("semem_generate_embedding", async (...args) => {
      const schema = z.object({
        text: z.string().min(1, "Text cannot be empty")
      });

      const { text } = validateParameters(args, schema, "semem_generate_embedding");

      try {
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        const embedding = await safeOps.generateEmbedding(text);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              embedding: embedding,
              embeddingLength: embedding.length,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
            }, null, 2)
          }]
        };
      } catch (error) {
        mcpDebugger.error('Error in semem_generate_embedding', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error generating embedding: ${error.message}`,
              text: text.substring(0, 50) + "..."
            }, null, 2)
          }],
          isError: true
        };
      }
    })
  );

  // Generate response tool with fixed parameter handling
  server.tool(
    "semem_generate_response",
    {
      description: "Generate LLM response with optional memory context",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The prompt to generate response for"
          },
          useMemory: {
            type: "boolean",
            description: "Whether to use memory context"
          },
          temperature: {
            type: "number",
            description: "Response temperature",
            minimum: 0,
            maximum: 2
          },
          maxTokens: {
            type: "number",
            description: "Maximum tokens in response",
            minimum: 1,
            maximum: 4000
          }
        },
        required: ["prompt"]
      }
    },
    debugToolHandler("semem_generate_response", async (...args) => {
      const schema = z.object({
        prompt: z.string().min(1, "Prompt cannot be empty"),
        useMemory: z.boolean().optional().default(false),
        temperature: z.number().min(0).max(2).optional().default(0.7),
        maxTokens: z.number().int().min(1).max(4000).optional().default(500)
      });

      const { prompt, useMemory, temperature, maxTokens } = validateParameters(args, schema, "semem_generate_response");

      try {
        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);
        
        let context = [];
        if (useMemory) {
          const relevantMemories = await safeOps.retrieveMemories(prompt, 0.7, 0);
          context = relevantMemories.slice(0, 3);
        }
        
        const response = await safeOps.generateResponse(prompt, context, { temperature, maxTokens });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              response: response,
              prompt: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""),
              retrievalCount: context.length,
              contextCount: context.length,
              parameters: { useMemory, temperature, maxTokens }
            }, null, 2)
          }]
        };
      } catch (error) {
        mcpDebugger.error('Error in semem_generate_response', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error generating response: ${error.message}`,
              prompt: prompt.substring(0, 50) + "..."
            }, null, 2)
          }],
          isError: true
        };
      }
    })
  );

  // Extract concepts tool with fixed parameter handling
  server.tool(
    "semem_extract_concepts",
    {
      description: "Extract semantic concepts from text using LLM analysis",
      parameters: {
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
    debugToolHandler("semem_extract_concepts", async (...args) => {
      const schema = z.object({
        text: z.string().min(1, "Text cannot be empty")
      });

      const { text } = validateParameters(args, schema, "semem_extract_concepts");

      try {
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
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                conceptCount: concepts.length,
                concepts
              }, null, 2)
            }]
          };
        } else {
          // Demo fallback - simple keyword extraction
          const words = text.toLowerCase().match(/\b\w+\b/g) || [];
          const concepts = [...new Set(words)]
            .filter(word => word.length > 4)
            .slice(0, 8)
            .sort();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                conceptCount: concepts.length,
                concepts,
                note: "Demo mode - using simple keyword extraction"
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        mcpDebugger.error('Error in semem_extract_concepts', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error extracting concepts: ${error.message}`,
              text: text.substring(0, 50) + "..."
            }, null, 2)
          }],
          isError: true
        };
      }
    })
  );

  mcpDebugger.info('Fixed memory tools registered successfully');
}