/**
 * Memory-related MCP tools
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';

/**
 * Register memory-related tools with the MCP server
 */
export function registerMemoryTools(server) {
  // Store interaction tool
  server.tool(
    "semem_store_interaction",
    "Store a new interaction in semantic memory with embeddings and concept extraction",
    z.object({
      prompt: z.string().describe("The user prompt or question"),
      response: z.string().describe("The response or answer"),
      metadata: z.object({}).optional().describe("Optional metadata for the interaction")
    }),
    async ({ prompt, response, metadata = {} }) => {
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
                prompt: prompt ? prompt.substring(0, 50) + "..." : "undefined",
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
        console.error('Error in semem_store_interaction:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error storing interaction: ${error.message}`,
              prompt: prompt ? prompt.substring(0, 50) + "..." : "undefined"
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );

  // Retrieve memories tool
  server.tool(
    "semem_retrieve_memories",
    "Search for relevant memories based on semantic similarity",
    z.object({
      query: z.string().describe("The query to search for"),
      threshold: z.number().optional().default(0.7).describe("Similarity threshold (0-1)"),
      limit: z.number().optional().default(10).describe("Maximum number of results"),
      excludeLastN: z.number().optional().default(0).describe("Exclude last N interactions")
    }),
    async ({ query, threshold = 0.7, limit = 10, excludeLastN = 0 }) => {
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
              memories: memories.slice(0, limit)
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in semem_retrieve_memories:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error retrieving memories: ${error.message}`,
              query: query ? query.substring(0, 50) + "..." : "undefined"
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );

  // Generate embedding tool
  server.tool(
    "semem_generate_embedding",
    "Generate vector embeddings for text",
    z.object({
      text: z.string().describe("Text to generate embeddings for")
    }),
    async ({ text }) => {
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
              text: text ? text.substring(0, 100) + (text.length > 100 ? '...' : '') : 'undefined'
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in semem_generate_embedding:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error generating embedding: ${error.message}`,
              text: text ? text.substring(0, 50) + "..." : "undefined"
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );

  // Generate response tool
  server.tool(
    "semem_generate_response",
    "Generate LLM response with optional memory context",
    z.object({
      prompt: z.string().describe("The prompt to generate response for"),
      useMemory: z.boolean().optional().default(false).describe("Whether to use memory context"),
      temperature: z.number().optional().default(0.7).describe("Response temperature"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens in response")
    }),
    async ({ prompt, useMemory = false, temperature = 0.7, maxTokens = 500 }) => {
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
              retrievalCount: context.length,
              contextCount: context.length
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in semem_generate_response:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error generating response: ${error.message}`,
              prompt: prompt ? prompt.substring(0, 50) + "..." : "undefined"
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );

  // Extract concepts tool
  server.tool(
    "semem_extract_concepts",
    "Extract semantic concepts from text using LLM analysis",
    z.object({
      text: z.string().describe("Text to extract concepts from")
    }),
    async ({ text }) => {
      try {
        if (!text || typeof text !== 'string' || !text.trim()) {
          throw new Error('Invalid text parameter. It must be a non-empty string.');
        }

        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);

        const concepts = await safeOps.extractConcepts(text);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              conceptCount: concepts.length,
              concepts: concepts,
              text: text ? text.substring(0, 100) + (text.length > 100 ? '...' : '') : 'undefined'
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in semem_extract_concepts:', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Error extracting concepts: ${error.message}`,
              text: text ? text.substring(0, 50) + "..." : "undefined"
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  );
}