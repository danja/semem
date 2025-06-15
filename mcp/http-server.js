#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables from .env file
dotenv.config();

// Import Semem APIs
import MemoryManager from '../src/MemoryManager.js';
import Config from '../src/Config.js';
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js';
import Entity from '../src/ragno/Entity.js';
import SemanticUnit from '../src/ragno/SemanticUnit.js';
import Relationship from '../src/ragno/Relationship.js';
import CorpuscleSelector from '../src/zpt/selection/CorpuscleSelector.js';
import ContentChunker from '../src/zpt/transform/ContentChunker.js';

// Import LLM Connectors
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../src/connectors/ClaudeConnector.js';
import MistralConnector from '../src/connectors/MistralConnector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.MCP_PORT || 3000;
const HOST = process.env.MCP_HOST || 'localhost';

// Global instances for reuse
let memoryManager = null;
let config = null;

// Create LLM connector based on available configuration - following working examples pattern
function createLLMConnector() {
  // Priority: Ollama (no API key needed) > Claude > Mistral
  if (process.env.OLLAMA_HOST || !process.env.CLAUDE_API_KEY) {
    console.log('Creating Ollama connector (preferred for local development)...');
    return new OllamaConnector();
  } else if (process.env.CLAUDE_API_KEY) {
    console.log('Creating Claude connector...');
    return new ClaudeConnector();
  } else if (process.env.MISTRAL_API_KEY) {
    console.log('Creating Mistral connector...');
    return new MistralConnector();
  } else {
    // Fallback to Ollama (most examples use this)
    console.log('Defaulting to Ollama connector...');
    return new OllamaConnector();
  }
}

// Session management for stateful operation
const sessions = new Map();

// Create Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Semem services
async function initializeSemem() {
  try {
    console.log('Initializing Semem services...');
    
    // Initialize config first
    console.log('Initializing config...');
    config = new Config(path.join(process.cwd(), 'config', 'config.json'));
    await config.init();
    console.log('Config initialized successfully');
    
    // Initialize memory manager
    console.log('Initializing memory manager...');
    
    // Create LLM provider (following the working pattern)
    const llmProvider = createLLMConnector();
    
    // Use working model names
    const chatModel = 'qwen2:1.5b';
    const embeddingModel = 'nomic-embed-text';
    
    // Initialize MemoryManager with proper parameters
    memoryManager = new MemoryManager({
      llmProvider,
      chatModel,
      embeddingModel,
      storage: null // Will use default in-memory storage
    });
    
    await memoryManager.initialize();
    console.log('Memory manager initialized successfully');
    
    console.log('Semem services initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Semem services:', error);
    return false;
  }
}

// Create MCP server factory
function createMCPServer() {
  const server = new McpServer({
    name: "Semem HTTP Integration Server",
    version: "1.0.0",
    instructions: "Provides HTTP access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing"
  });

  // Import tool definitions from the original server
  // Safe operation wrappers for MCP tools
  const safeOperations = {
    async retrieveMemories(query, threshold = 0.7, excludeLastN = 0) {
      if (!query || typeof query !== 'string' || !query.trim()) {
        return [];
      }
      return await memoryManager.retrieveRelevantInteractions(query.trim(), threshold, excludeLastN);
    },

    async storeInteraction(prompt, response, metadata = {}) {
      if (!prompt || !response) {
        throw new Error('Both prompt and response are required');
      }
      return await memoryManager.storeInteraction(prompt, response, metadata);
    },

    async generateEmbedding(text) {
      if (!text || typeof text !== 'string') {
        throw new Error('Text is required for embedding generation');
      }
      return await memoryManager.generateEmbedding(text);
    },

    async extractConcepts(text) {
      if (!text || typeof text !== 'string') {
        throw new Error('Text is required for concept extraction');
      }
      return await memoryManager.llmHandler.extractConcepts(text);
    },

    async generateResponse(prompt, context = [], options = {}) {
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt is required for response generation');
      }
      return await memoryManager.llmHandler.generateResponse(prompt, context, options);
    }
  };

  // Register tools using new SDK API
  server.tool("semem_extract_concepts", "Extract semantic concepts from text using LLM", {
    text: z.string().describe("Text to extract concepts from")
  }, async ({ text }) => {
    const concepts = await safeOperations.extractConcepts(text);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          concepts: concepts,
          conceptCount: concepts.length,
          text: text
        })
      }]
    };
  });

  server.tool("semem_store_interaction", "Store a new interaction in semantic memory with embeddings and concept extraction", {
    prompt: z.string().describe("The user prompt or question"),
    response: z.string().describe("The response or answer"),
    metadata: z.object({}).optional().describe("Optional metadata for the interaction")
  }, async ({ prompt, response, metadata = {} }) => {
    const storeResult = await safeOperations.storeInteraction(prompt, response, metadata);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: "Interaction stored successfully",
          id: storeResult.id || 'generated',
          conceptCount: storeResult.concepts?.length || 0,
          hasEmbedding: !!storeResult.embedding
        })
      }]
    };
  });

  server.tool("semem_retrieve_memories", "Search for relevant memories based on semantic similarity", {
    query: z.string().describe("The query to search for"),
    threshold: z.number().optional().default(0.7).describe("Similarity threshold (0-1)"),
    limit: z.number().optional().default(5).describe("Maximum number of results"),
    excludeLastN: z.number().optional().default(0).describe("Exclude last N interactions")
  }, async ({ query, threshold = 0.7, limit = 5, excludeLastN = 0 }) => {
    const memories = await safeOperations.retrieveMemories(query, threshold, excludeLastN);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          count: memories.length,
          memories: memories.slice(0, limit)
        })
      }]
    };
  });

  server.tool("semem_generate_embedding", "Generate vector embeddings for text", {
    text: z.string().describe("Text to generate embeddings for")
  }, async ({ text }) => {
    const embedding = await safeOperations.generateEmbedding(text);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          embedding: embedding,
          embeddingLength: embedding.length,
          text: text
        })
      }]
    };
  });

  server.tool("semem_generate_response", "Generate LLM response with optional memory context", {
    prompt: z.string().describe("The prompt to generate response for"),
    useMemory: z.boolean().optional().default(false).describe("Whether to use memory context"),
    temperature: z.number().optional().default(0.7).describe("Response temperature"),
    maxTokens: z.number().optional().default(500).describe("Maximum tokens in response")
  }, async ({ prompt, useMemory = false, temperature = 0.7, maxTokens = 500 }) => {
    let context = [];
    if (useMemory) {
      const relevantMemories = await safeOperations.retrieveMemories(prompt, 0.7, 0);
      context = relevantMemories.slice(0, 3);
    }
    
    const response = await safeOperations.generateResponse(prompt, context, { temperature, maxTokens });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          response: response,
          retrievalCount: context.length,
          contextCount: context.length
        })
      }]
    };
  });


  // Register resources using new SDK API
  server.resource("semem://status", "System Status", "Current system status and service health", "application/json", async () => {
    return {
      contents: [{
        uri: "semem://status",
        mimeType: "application/json",
        text: JSON.stringify({
          server: {
            name: "Semem HTTP MCP Server",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            transport: "StreamableHTTP",
            port: PORT,
            host: HOST
          },
          services: {
            memoryManagerInitialized: !!memoryManager,
            configInitialized: !!config
          },
          stats: {
            activeSessions: sessions.size
          }
        }, null, 2)
      }]
    };
  });

  return server;
}

// Session ID generator
function generateSessionId() {
  return crypto.randomUUID();
}

// MCP endpoint handler
app.post('/mcp', async (req, res) => {
  try {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'];
    let transport;
    
    if (sessionId && sessions.has(sessionId)) {
      // Reuse existing transport
      transport = sessions.get(sessionId).transport;
    } else if (!sessionId && req.body?.method === 'initialize') {
      // New initialization request
      const newSessionId = generateSessionId();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized with ID: ${sessionId}`);
        }
      });
      
      // Set up onclose handler
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          console.log(`Transport closed for session ${sid}, removing from sessions`);
          sessions.delete(sid);
        }
      };
      
      // Connect the transport to the MCP server
      const server = createMCPServer();
      await server.connect(transport);
      sessions.set(newSessionId, { server, transport });
      
      // Handle the request
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      throw new Error('No valid session found and not an initialize request');
    }
    
    // Handle the request for existing session
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      memoryManager: !!memoryManager,
      config: !!config
    },
    sessions: sessions.size
  });
});

// Info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'Semem HTTP MCP Server',
    version: '1.0.0',
    transport: 'StreamableHTTP',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      info: '/info'
    },
    integrationUrl: `http://${HOST}:${PORT}/mcp`
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down HTTP MCP server...');
  
  // Close all sessions
  for (const [sessionId, { server, transport }] of sessions) {
    try {
      await server.close();
      console.log(`Closed session: ${sessionId}`);
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  
  // Dispose of global resources
  if (memoryManager) {
    try {
      await memoryManager.dispose();
    } catch (error) {
      console.error('Error disposing memory manager:', error);
    }
  }
  
  process.exit(0);
});

// Start server
async function startServer() {
  console.log('🚀 Starting Semem HTTP MCP Server...');
  
  // Initialize Semem services
  const initialized = await initializeSemem();
  if (!initialized) {
    console.error('❌ Failed to initialize Semem services');
    process.exit(1);
  }
  
  // Start HTTP server
  app.listen(PORT, HOST, () => {
    console.log(`✅ Semem HTTP MCP Server running on http://${HOST}:${PORT}`);
    console.log(`📡 MCP Endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`💚 Health Check: http://${HOST}:${PORT}/health`);
    console.log(`📊 Server Info: http://${HOST}:${PORT}/info`);
    console.log('');
    console.log('Integration URL for MCP clients:');
    console.log(`  http://${HOST}:${PORT}/mcp`);
  });
}

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(console.error);
}

export { app, startServer, initializeSemem };