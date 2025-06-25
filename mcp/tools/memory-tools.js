/**
 * Memory-related MCP tools - FIXED VERSION
 * Using working setRequestHandler pattern instead of broken server.tool()
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

// Define schemas for memory tools
const ExtractConceptsSchema = z.object({
  text: z.string().describe("Text to extract concepts from")
});

const GenerateEmbeddingSchema = z.object({
  text: z.string().describe("Text to generate embedding for")
});

const StoreInteractionSchema = z.object({
  prompt: z.string().describe("The user prompt or question"),
  response: z.string().describe("The response or answer"),
  metadata: z.object({}).optional().describe("Optional metadata for the interaction")
});

const RetrieveMemoriesSchema = z.object({
  query: z.string().describe("Query to search for similar memories"),
  limit: z.number().optional().default(5).describe("Maximum number of memories to retrieve"),
  threshold: z.number().optional().default(0.7).describe("Similarity threshold for filtering results")
});

const GenerateResponseSchema = z.object({
  prompt: z.string().describe("The prompt to generate a response for"),
  context: z.string().optional().describe("Optional context for the response"),
  maxTokens: z.number().optional().default(1000).describe("Maximum tokens in response")
});

// Memory tools list
const MEMORY_TOOLS = [
  {
    name: "semem_extract_concepts",
    description: "Extract semantic concepts from text using LLM analysis",
    inputSchema: zodToJsonSchema(ExtractConceptsSchema)
  },
  {
    name: "semem_generate_embedding", 
    description: "Generate vector embedding for given text",
    inputSchema: zodToJsonSchema(GenerateEmbeddingSchema)
  },
  {
    name: "semem_store_interaction",
    description: "Store a new interaction in semantic memory with embeddings and concept extraction",
    inputSchema: zodToJsonSchema(StoreInteractionSchema)
  },
  {
    name: "semem_retrieve_memories",
    description: "Retrieve similar memories from semantic memory using vector search", 
    inputSchema: zodToJsonSchema(RetrieveMemoriesSchema)
  },
  {
    name: "semem_generate_response",
    description: "Generate a response using the LLM with optional context",
    inputSchema: zodToJsonSchema(GenerateResponseSchema)
  }
];

/**
 * Register memory-related tools with the MCP server using working pattern
 */
export function registerMemoryTools(server) {
  console.log('🧠 Registering memory tools using FIXED pattern...');

  // Store tools for retrieval by other handlers
  if (!server._registeredTools) {
    server._registeredTools = [];
  }
  server._registeredTools = server._registeredTools.concat(MEMORY_TOOLS);

  // Register or update the tools list handler
  const existingListHandler = server._listToolsHandler;
  server._listToolsHandler = async () => {
    const allTools = server._registeredTools || [];
    return { tools: allTools };
  };
  
  // Register the list tools handler
  server.setRequestHandler(ListToolsRequestSchema, server._listToolsHandler);

  // Register or chain the tool call handler
  const existingCallHandler = server._toolCallHandler;
  server._toolCallHandler = async (request) => {
    const { name, arguments: args } = request.params;
    
    // Handle memory tools
    const memoryToolNames = MEMORY_TOOLS.map(t => t.name);
    if (memoryToolNames.includes(name)) {
      return await handleMemoryTool(name, args);
    }
    
    // Chain to existing handler
    if (existingCallHandler) {
      return await existingCallHandler(request);
    }
    
    throw new Error(`Unknown tool: ${name}`);
  };
  
  // Register the tool call handler  
  server.setRequestHandler(CallToolRequestSchema, server._toolCallHandler);

  console.log('✅ Memory tools registered with FIXED pattern');
}

/**
 * Handle memory tool calls with proper argument parsing
 */
async function handleMemoryTool(name, args) {
  try {
    console.log(`🧠 [MEMORY] Handling tool: ${name}`);
    console.log(`🧠 [MEMORY] Arguments:`, JSON.stringify(args, null, 2));

    switch (name) {
      case 'semem_extract_concepts':
        return await handleExtractConcepts(args);
      case 'semem_generate_embedding':
        return await handleGenerateEmbedding(args);
      case 'semem_store_interaction':
        return await handleStoreInteraction(args);
      case 'semem_retrieve_memories':
        return await handleRetrieveMemories(args);
      case 'semem_generate_response':
        return await handleGenerateResponse(args);
      default:
        throw new Error(`Unknown memory tool: ${name}`);
    }
  } catch (error) {
    console.error(`❌ [MEMORY] Error in ${name}:`, error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error.message,
          tool: name
        }, null, 2)
      }],
      isError: true
    };
  }
}

/**
 * Handle extract concepts tool
 */
async function handleExtractConcepts(args) {
  const validatedArgs = ExtractConceptsSchema.parse(args);
  const { text } = validatedArgs;

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
        text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }, null, 2)
    }]
  };
}

/**
 * Handle generate embedding tool
 */
async function handleGenerateEmbedding(args) {
  const validatedArgs = GenerateEmbeddingSchema.parse(args);
  const { text } = validatedArgs;

  await initializeServices();
  const memoryManager = getMemoryManager();
  const safeOps = new SafeOperations(memoryManager);

  const embedding = await safeOps.generateEmbedding(text);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        embeddingDimension: embedding.length,
        embeddingPreview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
      }, null, 2)
    }]
  };
}

/**
 * Handle store interaction tool
 */
async function handleStoreInteraction(args) {
  const validatedArgs = StoreInteractionSchema.parse(args);
  const { prompt, response, metadata = {} } = validatedArgs;

  await initializeServices();
  const memoryManager = getMemoryManager();
  const safeOps = new SafeOperations(memoryManager);

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
        prompt: prompt.substring(0, 50) + "...",
        conceptCount: concepts.length,
        id: id
      }, null, 2)
    }]
  };
}

/**
 * Handle retrieve memories tool
 */
async function handleRetrieveMemories(args) {
  const validatedArgs = RetrieveMemoriesSchema.parse(args);
  const { query, limit = 5, threshold = 0.7 } = validatedArgs;

  await initializeServices();
  const memoryManager = getMemoryManager();
  const safeOps = new SafeOperations(memoryManager);

  // Generate embedding for query
  const queryEmbedding = await safeOps.generateEmbedding(query);

  // Search for similar memories
  const memories = await safeOps.searchSimilar(queryEmbedding, limit, threshold);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        query: query,
        memoriesFound: memories.length,
        memories: memories.map(memory => ({
          id: memory.id,
          prompt: memory.prompt?.substring(0, 100) + (memory.prompt?.length > 100 ? '...' : ''),
          response: memory.response?.substring(0, 100) + (memory.response?.length > 100 ? '...' : ''),
          similarity: memory.similarity,
          concepts: memory.concepts?.slice(0, 3) || []
        }))
      }, null, 2)
    }]
  };
}

/**
 * Handle generate response tool
 */
async function handleGenerateResponse(args) {
  const validatedArgs = GenerateResponseSchema.parse(args);
  const { prompt, context, maxTokens = 1000 } = validatedArgs;

  await initializeServices();
  const memoryManager = getMemoryManager();
  const safeOps = new SafeOperations(memoryManager);

  const response = await safeOps.generateResponse(prompt, context, { maxTokens });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        response: response,
        responseLength: response.length
      }, null, 2)
    }]
  };
}