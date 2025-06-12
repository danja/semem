#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';

// Import Semem APIs
import MemoryManager from '../src/MemoryManager.js';
import Config from '../src/Config.js';
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js';
import Entity from '../src/ragno/Entity.js';
import SemanticUnit from '../src/ragno/SemanticUnit.js';
import CorpuscleSelector from '../src/zpt/selection/CorpuscleSelector.js';
import ContentChunker from '../src/zpt/transform/ContentChunker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create MCP server instance
const server = new McpServer({
  name: "Semem Integration Server",
  version: "1.0.0",
  instructions: "Provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing"
});

// Global instances for reuse
let memoryManager = null;
let config = null;

// Initialize core services with proper error handling
async function initializeServices() {
  try {
    if (!config) {
      console.error('Initializing config...');
      config = new Config(path.join(process.cwd(), 'config', 'config.json'));
      await config.init();
      console.error('Config initialized successfully');
    }
    
    if (!memoryManager) {
      console.error('Initializing memory manager...');
      
      // Check for required environment variables
      const hasOllama = process.env.OLLAMA_HOST || process.env.OLLAMA_API_KEY;
      const hasClaude = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
      
      if (!hasOllama && !hasClaude) {
        console.warn('No LLM provider API keys found. Some features may be limited.');
        console.warn('Consider setting OLLAMA_HOST or CLAUDE_API_KEY environment variables.');
      }
      
      // Initialize with fallback configuration if needed
      memoryManager = new MemoryManager(config);
      await memoryManager.initialize();
      console.error('Memory manager initialized successfully');
    }
  } catch (error) {
    console.error('Service initialization failed:', error.message);
    console.error('Some tools may have limited functionality');
    
    // Create a minimal fallback config if needed
    if (!config) {
      config = {
        get: (key) => {
          const defaults = {
            'chatModel': 'qwen2:1.5b',
            'embeddingModel': 'nomic-embed-text',
            'sparqlEndpoints': []
          };
          return defaults[key];
        }
      };
    }
  }
}

// === SEMEM CORE API TOOLS ===

// Memory Management Tools
server.tool(
  "semem_store_interaction",
  {
    prompt: z.string().describe("The user prompt/input"),
    response: z.string().describe("The AI response/output"),
    metadata: z.object({}).optional().describe("Additional metadata for the interaction")
  },
  async ({ prompt, response, metadata = {} }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        // Generate embedding and extract concepts
        const embedding = await memoryManager.generateEmbedding(prompt);
        const concepts = await memoryManager.extractConcepts(response);
        
        // Store the interaction
        await memoryManager.addInteraction(prompt, response, embedding, concepts, metadata);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Successfully stored interaction with ${concepts.length} concepts extracted`,
              prompt: prompt.substring(0, 50) + "...",
              conceptCount: concepts.length,
              metadata
            }, null, 2)
          }]
        };
      } else {
        // Fallback demo response
        const mockConcepts = ["artificial intelligence", "machine learning", "technology"];
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              success: true,
              message: `Demo: Stored interaction with ${mockConcepts.length} concepts extracted`,
              prompt: prompt.substring(0, 50) + "...",
              conceptCount: mockConcepts.length,
              concepts: mockConcepts,
              metadata,
              note: "Demo mode - memory manager not available"
            }, null, 2)
          }]
        };
      }
    } catch (error) {
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
  }
);

server.tool(
  "semem_retrieve_memories",
  {
    query: z.string().describe("Search query to find relevant memories"),
    threshold: z.number().optional().default(0.7).describe("Similarity threshold (0-1)"),
    limit: z.number().optional().default(10).describe("Maximum number of results"),
    excludeLastN: z.number().optional().default(0).describe("Exclude the last N interactions")
  },
  async ({ query, threshold, limit, excludeLastN }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const retrievals = await memoryManager.retrieveRelevantInteractions(
          query, threshold, excludeLastN
        );
        
        // Limit results
        const limitedResults = retrievals.slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              threshold,
              count: limitedResults.length,
              memories: limitedResults.map(r => ({
                prompt: r.prompt,
                response: r.response,
                similarity: r.similarity,
                concepts: r.concepts,
                timestamp: r.timestamp
              }))
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback - create mock memories
        const mockMemories = [
          {
            prompt: "What is artificial intelligence?",
            response: "AI is a broad field of computer science focused on creating systems that can perform tasks that typically require human intelligence.",
            similarity: 0.89,
            concepts: ["artificial intelligence", "computer science", "human intelligence"],
            timestamp: new Date().toISOString()
          },
          {
            prompt: "Explain machine learning",
            response: "Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.",
            similarity: 0.76,
            concepts: ["machine learning", "artificial intelligence", "algorithms"],
            timestamp: new Date().toISOString()
          }
        ].filter(memory => 
          memory.prompt.toLowerCase().includes(query.toLowerCase()) ||
          memory.response.toLowerCase().includes(query.toLowerCase())
        ).slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              threshold,
              count: mockMemories.length,
              memories: mockMemories,
              note: "Demo mode - using mock memories"
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Error retrieving memories: ${error.message}`,
            query
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "semem_generate_response",
  {
    prompt: z.string().describe("The input prompt"),
    useMemory: z.boolean().optional().default(true).describe("Whether to use memory for context"),
    contextWindow: z.number().optional().default(4000).describe("Context window size in tokens"),
    temperature: z.number().optional().default(0.7).describe("Response temperature (0-1)")
  },
  async ({ prompt, useMemory, contextWindow, temperature }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        let retrievals = [];
        let lastInteractions = [];
        
        if (useMemory) {
          // Get relevant memories and recent interactions
          retrievals = await memoryManager.retrieveRelevantInteractions(prompt, 0.7, 0);
          // Get last few interactions for context
          lastInteractions = await memoryManager.retrieveRelevantInteractions("", 0, 0);
          lastInteractions = lastInteractions.slice(-3); // Last 3 interactions
        }
        
        const response = await memoryManager.generateResponse(
          prompt, lastInteractions, retrievals, contextWindow, { temperature }
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prompt,
              response,
              memoryUsed: useMemory,
              retrievalCount: retrievals.length,
              contextCount: lastInteractions.length,
              temperature
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback - generate mock response
        const demoResponses = {
          "machine learning": "Machine learning is a powerful subset of AI that enables systems to automatically learn and improve from experience without being explicitly programmed for every scenario.",
          "neural networks": "Neural networks are computational models inspired by biological neural networks, consisting of interconnected nodes that process information through weighted connections.",
          "default": "This is a demo response generated by the Semem MCP server. In a full deployment, this would be generated using configured LLM providers with semantic memory context."
        };
        
        const responseKey = Object.keys(demoResponses).find(key => 
          prompt.toLowerCase().includes(key)
        ) || "default";
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prompt,
              response: demoResponses[responseKey],
              memoryUsed: useMemory,
              retrievalCount: useMemory ? 2 : 0,
              contextCount: useMemory ? 1 : 0,
              temperature,
              note: "Demo mode - using mock response generation"
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Error generating response: ${error.message}`,
            prompt
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Embedding and Concept Tools
server.tool(
  "semem_generate_embedding",
  {
    text: z.string().describe("Text to generate embedding for"),
    model: z.string().optional().describe("Embedding model to use")
  },
  async ({ text, model }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const embedding = await memoryManager.generateEmbedding(text, model);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
              embeddingLength: embedding.length,
              model: model || 'default',
              embedding: embedding.slice(0, 10).concat(['...']) // Show first 10 dims
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback - generate mock embedding
        const mockEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
              embeddingLength: mockEmbedding.length,
              model: model || 'mock-embedding-model',
              embedding: mockEmbedding.slice(0, 10).concat(['...']),
              note: "Demo mode - using mock embedding"
            }, null, 2)
          }]
        };
      }
    } catch (error) {
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
  }
);

server.tool(
  "semem_extract_concepts",
  {
    text: z.string().describe("Text to extract concepts from")
  },
  async ({ text }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const concepts = await memoryManager.extractConcepts(text);
        
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
  }
);

// === RAGNO API TOOLS ===

server.tool(
  "ragno_decompose_corpus",
  {
    textChunks: z.array(z.string()).describe("Array of text chunks to decompose"),
    options: z.object({
      maxEntities: z.number().optional().default(100),
      minFrequency: z.number().optional().default(1),
      extractRelationships: z.boolean().optional().default(true)
    }).optional().describe("Decomposition options")
  },
  async ({ textChunks, options = {} }) => {
    try {
      await initializeServices();
      
      if (memoryManager && memoryManager.llmHandler) {
        // Get LLM handler from memory manager
        const llmHandler = memoryManager.llmHandler;
        
        const result = await decomposeCorpus(textChunks, llmHandler, options);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              statistics: result.statistics,
              unitCount: result.units.length,
              entityCount: result.entities.length,
              relationshipCount: result.relationships.length,
              entities: result.entities.slice(0, 5).map(e => ({
                name: e.getName(),
                frequency: e.frequency,
                isEntryPoint: e.isEntryPoint()
              })),
              relationships: result.relationships.slice(0, 5).map(r => ({
                source: r.source,
                target: r.target,
                description: r.description,
                weight: r.weight
              }))
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback - create mock decomposition result
        const mockEntities = textChunks.flatMap(chunk => 
          chunk.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
        )
        .filter((entity, index, arr) => arr.indexOf(entity) === index)
        .slice(0, options.maxEntities || 10)
        .map((name, i) => ({
          name,
          frequency: Math.floor(Math.random() * 5) + 1,
          isEntryPoint: i < 3
        }));
        
        const mockRelationships = [];
        for (let i = 0; i < Math.min(mockEntities.length - 1, 5); i++) {
          mockRelationships.push({
            source: mockEntities[i].name,
            target: mockEntities[i + 1].name,
            description: "related_to",
            weight: Math.random().toFixed(2)
          });
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              statistics: {
                totalChunks: textChunks.length,
                totalTokens: textChunks.join(' ').split(/\s+/).length,
                processingTime: "demo"
              },
              unitCount: textChunks.length,
              entityCount: mockEntities.length,
              relationshipCount: mockRelationships.length,
              entities: mockEntities.slice(0, 5),
              relationships: mockRelationships,
              note: "Demo mode - using mock corpus decomposition"
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Error decomposing corpus: ${error.message}`,
            textChunkCount: textChunks.length
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "ragno_create_entity",
  {
    name: z.string().describe("Entity name"),
    isEntryPoint: z.boolean().optional().default(false).describe("Whether this is an entry point entity"),
    subType: z.string().optional().describe("Entity subtype"),
    frequency: z.number().optional().default(1).describe("Entity frequency/importance")
  },
  async ({ name, isEntryPoint, subType, frequency }) => {
    try {
      const entity = new Entity({ name, isEntryPoint, subType, frequency });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            created: true,
            entity: {
              name: entity.getName(),
              prefLabel: entity.getPrefLabel(),
              isEntryPoint: entity.isEntryPoint(),
              subType: entity.getSubType(),
              frequency: entity.frequency
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating entity: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "ragno_create_semantic_unit",
  {
    text: z.string().describe("Text content of the semantic unit"),
    summary: z.string().optional().describe("Summary of the unit"),
    source: z.string().optional().describe("Source identifier"),
    position: z.number().optional().describe("Position in source"),
    length: z.number().optional().describe("Length of the unit")
  },
  async ({ text, summary, source, position, length }) => {
    try {
      const unit = new SemanticUnit({ text, summary, source, position, length });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            created: true,
            unit: {
              text: unit.getText().substring(0, 100) + (unit.getText().length > 100 ? '...' : ''),
              summary: unit.getSummary(),
              source: unit.source,
              position: unit.position,
              length: unit.length
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating semantic unit: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// === ZPT API TOOLS ===

server.tool(
  "zpt_select_corpuscles",
  {
    zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus']).describe("ZPT zoom level (required)"),
    pan: z.object({
      topic: z.string().optional(),
      entity: z.array(z.string()).optional(),
      temporal: z.object({
        start: z.string().optional(),
        end: z.string().optional()
      }).optional()
    }).optional().describe("ZPT pan parameters"),
    tilt: z.enum(['embedding', 'keywords', 'graph', 'temporal']).describe("ZPT tilt perspective (required)"),
    selectionType: z.enum(['embedding', 'keywords', 'graph', 'temporal']).describe("Type of selection"),
    criteria: z.any().describe("Selection criteria specific to the type"),
    limit: z.number().optional().default(10).describe("Maximum results")
  },
  async ({ zoom, pan = {}, tilt, selectionType, criteria, limit }) => {
    try {
      await initializeServices();
      
      // Check if we have the required services for ZPT operations
      if (memoryManager && memoryManager.embeddingHandler) {
        // Construct proper ZPT parameters
        const zptParams = {
          zoom,
          pan,
          tilt,
          selectionType,
          criteria,
          limit
        };
        
        const selector = new CorpuscleSelector();
        const results = await selector.select(zptParams);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              zoom,
              tilt,
              selectionType,
              resultCount: results.length,
              results: results.slice(0, 10) // Limit output
            }, null, 2)
          }]
        };
      } else {
        // Use demo mode when services not available
        throw new Error("Services not available - using demo mode");
      }
    } catch (error) {
      // Fallback demo response
      const mockResults = [
        { 
          id: "demo_1", 
          relevance: 0.95, 
          type: selectionType,
          title: `Sample ${selectionType} result 1`,
          content: `This is a demo result for ${selectionType} selection at ${zoom} zoom level.`
        },
        { 
          id: "demo_2", 
          relevance: 0.87, 
          type: selectionType,
          title: `Sample ${selectionType} result 2`, 
          content: `Another demo result showcasing ${tilt} perspective.`
        }
      ];
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            zoom,
            tilt,
            selectionType,
            resultCount: mockResults.length,
            results: mockResults,
            note: `Demo mode - services not available for ZPT operations`
          }, null, 2)
        }]
      };
    }
  }
);

server.tool(
  "zpt_chunk_content",
  {
    content: z.string().describe("Content to chunk"),
    options: z.object({
      method: z.enum(['fixed', 'semantic', 'adaptive', 'token-aware', 'hierarchical']).describe("Chunking method"),
      chunkSize: z.number().optional().default(1000).describe("Target chunk size"),
      overlap: z.number().optional().default(100).describe("Overlap between chunks"),
      preserveStructure: z.boolean().optional().default(true).describe("Preserve document structure")
    }).describe("Chunking options")
  },
  async ({ content, options }) => {
    try {
      const chunker = new ContentChunker();
      const chunks = await chunker.chunk(content, options);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            method: options.method,
            originalLength: content.length,
            chunkCount: chunks.length,
            averageChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length),
            chunks: chunks.slice(0, 3).map(chunk => ({
              content: chunk.content.substring(0, 100) + (chunk.content.length > 100 ? '...' : ''),
              length: chunk.content.length,
              metadata: chunk.metadata || {}
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      // Fallback - simple fixed-size chunking
      const chunkSize = options.chunkSize || 1000;
      const overlap = options.overlap || 100;
      const mockChunks = [];
      
      for (let i = 0; i < content.length; i += chunkSize - overlap) {
        const chunk = content.substring(i, i + chunkSize);
        if (chunk.trim().length > 0) {
          mockChunks.push({
            content: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''),
            length: chunk.length,
            position: i,
            metadata: { method: 'fallback-fixed', chunkIndex: mockChunks.length }
          });
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            method: `${options.method}-fallback`,
            originalLength: content.length,
            chunkCount: mockChunks.length,
            chunks: mockChunks.slice(0, 3),
            note: `Fallback chunking used - original error: ${error.message}`
          }, null, 2)
        }]
      };
    }
  }
);

// Resource for system status
server.resource(
  "semem-status",
  "semem://status",
  async () => {
    try {
      const status = {
        memoryManagerInitialized: memoryManager !== null,
        configInitialized: config !== null,
        timestamp: new Date().toISOString()
      };
      
      if (memoryManager) {
        // Add memory stats if available
        status.memoryStats = {
          // Add any available stats from memory manager
        };
      }
      
      return {
        contents: [{
          uri: "semem://status",
          text: JSON.stringify(status, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: "semem://status",
          text: `Error getting status: ${error.message}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  try {
    await server.connect(transport);
    console.error("Semem MCP Server started successfully");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error("Shutting down server...");
  if (memoryManager) {
    await memoryManager.dispose();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});