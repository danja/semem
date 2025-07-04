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
import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const AskQuestionSchema = z.object({
  question: z.string().describe("Question to ask and store in Document QA format"),
  namespace: z.string().optional().default("http://example.org/docqa/").describe("Base namespace for question URI"),
  autoProcess: z.boolean().optional().default(false).describe("Automatically process the question through the Document QA pipeline")
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
  },
  {
    name: "semem_ask",
    description: "Ask a question that will be stored in Document QA format and optionally processed through the pipeline",
    inputSchema: zodToJsonSchema(AskQuestionSchema)
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
      case 'semem_ask':
        return await handleAskQuestion(args);
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

/**
 * Handle ask question tool - stores questions in Document QA format
 */
async function handleAskQuestion(args) {
  const validatedArgs = AskQuestionSchema.parse(args);
  const { question, namespace = "http://example.org/docqa/", autoProcess = false } = validatedArgs;

  try {
    // Initialize configuration
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '../..');
    const configPath = join(projectRoot, 'config/config.json');
    const config = new Config(configPath);
    await config.init();

    config.namespace = namespace;
    config.graphName = config.get('storage.options.graphName') || 'http://tensegrity.it/semem';

    // Initialize SPARQL helper
    const sparqlHelper = new SPARQLHelper(
      config.get('storage.options.update') || 'http://localhost:3030/semem/update',
      {
        auth: { user: 'admin', password: 'admin123' },
        timeout: 30000
      }
    );

    // Initialize embedding and LLM handlers
    const embeddingHandler = await initializeEmbeddingHandler(config);
    const llmHandler = await initializeLLMHandler(config);

    // Generate unique question ID and URI
    const questionId = Date.now();
    const questionUri = `${namespace}question/${questionId}`;

    // Generate embedding for the question
    const embedding = await embeddingHandler.generateEmbedding(question);
    
    // Extract concepts from the question
    const concepts = await llmHandler.extractConcepts(question);

    // Store question in Document QA format (ragno:Corpuscle)
    await storeQuestionInDocQAFormat(questionUri, question, embedding, concepts, sparqlHelper, config);

    const result = {
      success: true,
      message: `Question stored successfully in Document QA format`,
      questionUri: questionUri,
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      embeddingDimensions: embedding.length,
      conceptsExtracted: concepts.length,
      concepts: concepts.slice(0, 5), // Show first 5 concepts
      autoProcess: autoProcess
    };

    // If autoProcess is enabled, trigger the Document QA pipeline
    if (autoProcess) {
      try {
        result.pipelineStatus = "Pipeline processing not yet implemented - question stored for manual processing";
      } catch (pipelineError) {
        result.pipelineError = pipelineError.message;
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };

  } catch (error) {
    console.error(`❌ [MCP] Error in semem_ask:`, error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error.message,
          question: question.substring(0, 50) + '...'
        }, null, 2)
      }],
      isError: true
    };
  }
}

/**
 * Initialize embedding handler (following working examples pattern)
 */
async function initializeEmbeddingHandler(config) {
  const embeddingConnector = await EmbeddingConnectorFactory.createConnector(config);
  const dimension = config.get('memory.dimension') || 768;
  
  const llmProviders = config.get('llmProviders') || [];
  const embeddingProvider = llmProviders
    .filter(p => p.capabilities?.includes('embedding'))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
  
  const embeddingModel = embeddingProvider?.embeddingModel || 'nomic-embed-text';

  return new EmbeddingHandler(embeddingConnector, embeddingModel, dimension);
}

/**
 * Initialize LLM handler (following working examples pattern)
 */
async function initializeLLMHandler(config) {
  const llmProviders = config.get('llmProviders') || [];
  const chatProvider = llmProviders
    .filter(p => p.capabilities?.includes('chat'))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

  if (!chatProvider) {
    throw new Error('No chat LLM provider configured');
  }

  let llmConnector;
  
  if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
    llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
  } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
    llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
  } else {
    llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
    chatProvider.chatModel = 'qwen2:1.5b';
  }

  return new LLMHandler(llmConnector, chatProvider.chatModel);
}

/**
 * Store question in Document QA format (ragno:Corpuscle with proper attributes)
 */
async function storeQuestionInDocQAFormat(questionUri, questionText, embedding, concepts, sparqlHelper, config) {
  const timestamp = new Date().toISOString();
  const triples = [];
  
  // Main question corpuscle (following Document QA Stage 2 pattern)
  triples.push(`<${questionUri}> a ragno:Corpuscle ;`);
  triples.push(`    rdfs:label "${escapeRDFString(questionText)}" ;`);
  triples.push(`    ragno:content "${escapeRDFString(questionText)}" ;`);
  triples.push(`    ragno:corpuscleType "question" ;`);
  triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime ;`);
  triples.push(`    ragno:processingStage "processed" ;`);
  triples.push(`    ragno:questionLength ${questionText.length} ;`);
  triples.push(`    ragno:source "mcp-bridge" .`);
  
  // Embedding attribute
  const embeddingAttrUri = `${questionUri}/attr/embedding`;
  triples.push(`<${questionUri}> ragno:hasAttribute <${embeddingAttrUri}> .`);
  triples.push(`<${embeddingAttrUri}> a ragno:Attribute ;`);
  triples.push(`    ragno:attributeType "embedding" ;`);
  triples.push(`    ragno:attributeValue "${JSON.stringify(embedding)}" ;`);
  triples.push(`    ragno:embeddingDimensions ${embedding.length} ;`);
  triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
  
  // Concepts attributes
  concepts.forEach((concept, index) => {
    const conceptAttrUri = `${questionUri}/attr/concept_${index}`;
    triples.push(`<${questionUri}> ragno:hasAttribute <${conceptAttrUri}> .`);
    triples.push(`<${conceptAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "concept" ;`);
    triples.push(`    ragno:attributeValue "${escapeRDFString(concept)}" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
  });
  
  // MCP bridge tracking
  const mcpAttrUri = `${questionUri}/attr/mcp_bridge`;
  triples.push(`<${questionUri}> ragno:hasAttribute <${mcpAttrUri}> .`);
  triples.push(`<${mcpAttrUri}> a ragno:Attribute ;`);
  triples.push(`    ragno:attributeType "mcp-bridge" ;`);
  triples.push(`    ragno:attributeValue "semem_ask" ;`);
  triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
  
  const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.graphName}> {
        ${triples.join('\n        ')}
    }
}`;

  const result = await sparqlHelper.executeUpdate(insertQuery);
  
  if (!result.success) {
    throw new Error(`SPARQL storage failed: ${result.error}`);
  }
}

/**
 * Escape special characters in RDF strings
 */
function escapeRDFString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}