#!/usr/bin/env node
/**
 * Semem MCP Server
 * 
 * This file implements an MCP (Model Context Protocol) server for Semem
 * according to the Anthropic specification.
 * 
 * The server exposes Semem's APIs as MCP primitives (Tools, Resources, and Prompts)
 * and allows LLM clients to interact with the semantic memory system.
 */

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import MemoryManager from './src/MemoryManager.js';
import Config from './src/Config.js';
import loglevel from 'loglevel';

// Initialize environment variables and logging
dotenv.config();
const log = loglevel.getLogger('mcp-server');
log.setLevel(process.env.LOG_LEVEL || 'info');

// Initialize server
const app = express();
const port = process.env.MCP_PORT || 4040;

// MCP server configuration
const MCP_SERVER_CONFIG = {
  id: 'semem-mcp-server',
  name: 'Semem Memory Server',
  version: '1.0.0',
  vendor: 'Semem',
  protocol_version: '2025-03-26'
};

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Initialize Semem services
const config = new Config();
let memoryManager;

// Initialize memory manager on startup
async function initializeMemoryManager() {
  try {
    await config.init();
    
    // Create a minimal mock provider for MCP server
    const dimension = config.get('memory.dimension') || 1536;
    const llmProvider = {
      generateChat: async (prompt) => `This is a mock response for: ${prompt}`,
      generateEmbedding: async (text) => new Array(dimension).fill(0.1),
      // Add necessary methods that might be called
      initialize: async () => true,
      dispose: async () => true,
      getModelInfo: () => ({ 
        name: 'mcp-mock-provider',
        context_length: 8192, 
        embedding_dimension: dimension
      })
    };
    
    // Create memory manager with the provider
    memoryManager = new MemoryManager({
      llmProvider,
      chatModel: config.get('models.chat.model'),
      embeddingModel: config.get('models.embedding.model'),
      dimension: config.get('memory.dimension')
    });
    
    // The MemoryManager is initialized in the constructor
    log.info('Memory manager initialized successfully');
  } catch (error) {
    log.error('Failed to initialize memory manager:', error);
    process.exit(1);
  }
}

// Session management
const sessions = new Map();

/**
 * Create a new session with the given parameters
 */
function createSession(sessionId) {
  const session = {
    id: sessionId || uuidv4(),
    created_at: new Date().toISOString(),
    calls: []
  };
  sessions.set(session.id, session);
  return session;
}

/**
 * Get an existing session or create a new one
 */
function getOrCreateSession(sessionId) {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }
  return createSession(sessionId);
}

/**
 * MCP Tools - Functions the model can call
 */
const MCPTools = {
  // Memory tools
  'memory.add': async (params) => {
    const { user_input, assistant_response } = params;
    
    if (!user_input || !assistant_response) {
      throw new Error('Both user_input and assistant_response are required');
    }
    
    await memoryManager.addInteraction(user_input, assistant_response);
    
    return {
      status: 'success',
      message: 'Interaction added to memory'
    };
  },
  
  'memory.retrieve': async (params) => {
    const { query, limit = 5 } = params;
    
    if (!query) {
      throw new Error('Query parameter is required');
    }
    
    const memories = await memoryManager.retrieveRelevantInteractions(query, limit);
    
    return {
      memories
    };
  },
  
  'memory.search': async (params) => {
    const { query, threshold = 0.7, limit = 10 } = params;
    
    if (!query) {
      throw new Error('Query parameter is required');
    }
    
    // Use retrieveRelevantInteractions as a fallback if searchMemory doesn't exist
    const searchMethod = memoryManager.searchMemory || memoryManager.retrieveRelevantInteractions;
    
    if (!searchMethod) {
      throw new Error('Search functionality is not available');
    }
    
    const results = await searchMethod.call(memoryManager, query, { threshold, limit });
    
    return {
      results
    };
  },
  
  // Embedding tools
  'embeddings.create': async (params) => {
    const { text } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    const embedding = await memoryManager.generateEmbedding(text);
    
    return {
      embedding
    };
  },
  
  // Concept extraction
  'concepts.extract': async (params) => {
    const { text } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    // Check if extractConcepts method exists, otherwise use LLM to extract concepts
    if (typeof memoryManager.extractConcepts === 'function') {
      const concepts = await memoryManager.extractConcepts(text);
      return { concepts };
    } else {
      // Fallback implementation using the LLM to extract concepts
      try {
        const prompt = `Extract the key concepts from the following text. Return only a JSON array of strings with the concepts.\n\nText: ${text}\n\nConcepts:`;
        const response = await memoryManager.llmHandler.generateChat(prompt);
        
        // Try to parse the response as JSON
        try {
          const conceptsJson = response.replace(/```json|```/g, '').trim();
          const concepts = JSON.parse(conceptsJson);
          return { concepts };
        } catch (parseError) {
          // If parsing fails, do simple extraction
          const concepts = response
            .split('\n')
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(line => line.length > 0);
          return { concepts };
        }
      } catch (error) {
        log.error('Error extracting concepts:', error);
        return { 
          concepts: [],
          error: 'Failed to extract concepts'
        };
      }
    }
  }
};

/**
 * MCP Resources - Data sources that the model can access
 */
const MCPResources = {
  'memory.stats': async () => {
    // Gather basic stats from memory manager
    const stats = {
      embeddingDimension: memoryManager.dimension,
      initialized: memoryManager.initialized || false,
      embeddingModel: memoryManager.embeddingModel,
      chatModel: memoryManager.chatModel,
      similarityThreshold: memoryManager.similarityThreshold,
      storageType: config.get('storage.type'),
      serverUptime: process.uptime()
    };
    
    return {
      stats
    };
  },
  
  'memory.config': async () => {
    // Get memory config or provide a fallback
    const memoryConfig = config.get('memory') || {
      dimension: memoryManager.dimension || 1536,
      similarityThreshold: memoryManager.similarityThreshold || 0.7,
      contextWindow: 3,
      decayRate: 0.0001
    };
    
    return {
      config: memoryConfig
    };
  },
  
  'server.info': async () => {
    return {
      ...MCP_SERVER_CONFIG,
      status: 'active',
      uptime: process.uptime()
    };
  }
};

/**
 * MCP Prompts - Pre-defined templates for using tools or resources
 */
const MCPPrompts = {
  'memory.search_template': {
    title: 'Search Memory',
    description: 'Template for searching semantic memory',
    template: `
      To search through the semantic memory, I'll need to:
      
      1. Formulate a clear search query based on the user's question
      2. Use the memory.search tool with the query
      3. Review the results for relevance
      4. Synthesize the information into a coherent answer
      
      Let me search the memory system for relevant information.
      
      {{memory.search query="$query" limit=5}}
    `
  },
  
  'memory.add_template': {
    title: 'Add to Memory',
    description: 'Template for adding interactions to memory',
    template: `
      I'll store this interaction in the semantic memory system to help with future recall.
      
      {{memory.add user_input="$user_input" assistant_response="$assistant_response"}}
      
      The interaction has been successfully saved to memory.
    `
  },
  
  'concepts.extract_template': {
    title: 'Extract Concepts',
    description: 'Template for extracting key concepts from text',
    template: `
      I'll analyze this text to identify the key concepts:
      
      Text to analyze: $text
      
      {{concepts.extract text="$text"}}
      
      Here are the key concepts I've identified:
      
      $concepts
    `
  }
};

/**
 * MCP discovery endpoint
 */
app.get('/mcp', (req, res) => {
  res.json({
    id: MCP_SERVER_CONFIG.id,
    name: MCP_SERVER_CONFIG.name,
    version: MCP_SERVER_CONFIG.version,
    vendor: MCP_SERVER_CONFIG.vendor,
    protocol_version: MCP_SERVER_CONFIG.protocol_version,
    capabilities: {
      tools: Object.keys(MCPTools).map(id => ({ id })),
      resources: Object.keys(MCPResources).map(id => ({ id })),
      prompts: Object.keys(MCPPrompts).map(id => ({ id }))
    }
  });
});

/**
 * Handle JSON-RPC requests
 */
app.post('/mcp', async (req, res) => {
  const requestBody = req.body;
  
  // Check if it's a batch request
  const isBatch = Array.isArray(requestBody);
  const requests = isBatch ? requestBody : [requestBody];
  
  // Process all requests
  const responses = await Promise.all(
    requests.map(async request => {
      const { jsonrpc, id, method, params } = request;
      
      // Validate JSON-RPC request
      if (jsonrpc !== '2.0') {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32600,
            message: 'Invalid Request'
          }
        };
      }
      
      try {
        // Get or create session
        const sessionId = params?.session_id;
        const session = getOrCreateSession(sessionId);
        
        // Store the call in session history
        session.calls.push({
          method,
          params,
          timestamp: new Date().toISOString()
        });
        
        // Handle method calls
        let result;
        
        if (method === 'mcp.tools.list') {
          result = {
            tools: Object.keys(MCPTools).map(id => ({
              id,
              description: `Semem ${id} API`
            }))
          };
        } else if (method === 'mcp.resources.list') {
          result = {
            resources: Object.keys(MCPResources).map(id => ({
              id,
              description: `Semem ${id} resource`
            }))
          };
        } else if (method === 'mcp.prompts.list') {
          result = {
            prompts: Object.entries(MCPPrompts).map(([id, prompt]) => ({
              id,
              title: prompt.title,
              description: prompt.description
            }))
          };
        } else if (method === 'mcp.tools.execute') {
          const { tool_id, tool_params } = params;
          if (!MCPTools[tool_id]) {
            throw new Error(`Tool not found: ${tool_id}`);
          }
          result = await MCPTools[tool_id](tool_params);
        } else if (method === 'mcp.resources.get') {
          const { resource_id, resource_params } = params;
          if (!MCPResources[resource_id]) {
            throw new Error(`Resource not found: ${resource_id}`);
          }
          result = await MCPResources[resource_id](resource_params);
        } else if (method === 'mcp.prompts.get') {
          const { prompt_id } = params;
          if (!MCPPrompts[prompt_id]) {
            throw new Error(`Prompt not found: ${prompt_id}`);
          }
          result = MCPPrompts[prompt_id];
        } else {
          throw new Error(`Method not found: ${method}`);
        }
        
        // Return successful response
        return {
          jsonrpc: '2.0',
          id,
          result
        };
      } catch (error) {
        log.error(`Error handling method ${method}:`, error);
        
        // Return error response
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          }
        };
      }
    })
  );
  
  // Return batch or single response
  res.json(isBatch ? responses : responses[0]);
});

/**
 * Server health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: MCP_SERVER_CONFIG.version,
    uptime: process.uptime()
  });
});

/**
 * Start the server
 */
async function startServer() {
  try {
    await initializeMemoryManager();
    
    app.listen(port, () => {
      log.info(`Semem MCP Server running on port ${port}`);
      log.info(`Server discovery endpoint: http://localhost:${port}/mcp`);
    });
  } catch (error) {
    log.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

startServer();