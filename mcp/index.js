#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

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

// Create MCP server instance
const server = new McpServer({
  name: "Semem Integration Server",
  version: "1.0.0",
  instructions: "Provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing"
});

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
      
      // Check for available LLM providers from config
      const llmProviders = config.get('llmProviders') || [];
      const ollamaHost = process.env.OLLAMA_HOST;
      const claudeKey = process.env.CLAUDE_API_KEY;
      const mistralKey = process.env.MISTRAL_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      const hasOllama = ollamaHost && ollamaHost !== '';
      const hasClaude = claudeKey && claudeKey !== '';
      const hasMistral = mistralKey && mistralKey !== '';
      const hasOpenAI = openaiKey && openaiKey !== '';
      const hasConfigProviders = llmProviders.length > 0;
      
      if (!hasOllama && !hasClaude && !hasMistral && !hasOpenAI && !hasConfigProviders) {
        console.warn('No LLM provider API keys found. Some features may be limited.');
        console.warn('Consider setting API keys in .env file or configuring providers in config.json');
      } else {
        const availableProviders = [];
        if (hasOllama) availableProviders.push('Ollama');
        if (hasClaude) availableProviders.push('Claude');
        if (hasMistral) availableProviders.push('Mistral');
        if (hasOpenAI) availableProviders.push('OpenAI');
        if (hasConfigProviders) availableProviders.push(`Config providers (${llmProviders.length})`);
        console.log(`Available LLM providers: ${availableProviders.join(', ')}`);
      }
      
      // Create LLM connector
      const llmProvider = createLLMConnector();
      
      // Use working model names that exist in Ollama (following examples pattern)
      const chatModel = 'qwen2:1.5b';  // Known working model
      const embeddingModel = 'nomic-embed-text';  // Known working model
      
      // Initialize MemoryManager with proper parameters (following working examples)
      memoryManager = new MemoryManager({
        llmProvider,
        chatModel,
        embeddingModel,
        storage: null // Will use default in-memory storage
      });
      
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
  { description: "Store a conversation interaction in semantic memory with concept extraction and embeddings" },
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
  { description: "Retrieve semantically similar memories using vector similarity search" },
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
    description: "Generate an AI response using memory context and LLM integration",
    parameters: {prompt: z.string().describe("The input prompt"),
    useMemory: z.boolean().optional().default(true).describe("Whether to use memory for context"),
    contextWindow: z.number().optional().default(4000).describe("Context window size in tokens"),
    temperature: z.number().optional().default(0.7).describe("Response temperature (0-1)")
  
    }
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
          lastInteractions = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
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
    description: "Generate vector embeddings for text using the configured embedding model",
    parameters: {text: z.string().describe("Text to generate embedding for"),
    model: z.string().optional().describe("Embedding model to use")
  
    }
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
    description: "Extract semantic concepts from text using LLM analysis",
    parameters: {text: z.string().describe("Text to extract concepts from")
  
    }
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

// === DOCUMENT MANAGEMENT TOOLS ===

server.tool(
  "store_document",
  {
    content: z.string().describe("Document content to store"),
    metadata: z.object({
      title: z.string().optional(),
      source: z.string().optional(),
      author: z.string().optional(),
      created: z.string().optional(),
      type: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional().describe("Document metadata")
  },
  { description: "Store a document with metadata, generate embeddings, and extract concepts for GraphRAG" },
  async ({ content, metadata = {} }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        // Generate embedding for the document
        const embedding = await memoryManager.generateEmbedding(content);
        
        // Extract concepts from the document
        const concepts = await memoryManager.extractConcepts(content);
        
        // Create document ID
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store as memory interaction with document metadata
        const documentMetadata = {
          ...metadata,
          documentId,
          type: 'document',
          contentLength: content.length,
          timestamp: new Date().toISOString()
        };
        
        await memoryManager.addInteraction(
          `Document: ${metadata.title || 'Untitled'}`, 
          content, 
          embedding, 
          concepts, 
          documentMetadata
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              documentId,
              title: metadata.title || 'Untitled',
              contentLength: content.length,
              conceptCount: concepts.length,
              metadata: documentMetadata
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const documentId = `demo_doc_${Date.now()}`;
        const mockConcepts = content.split(/\s+/).filter(word => word.length > 4).slice(0, 5);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              documentId,
              title: metadata.title || 'Untitled',
              contentLength: content.length,
              conceptCount: mockConcepts.length,
              concepts: mockConcepts,
              metadata: { ...metadata, documentId, type: 'document' },
              note: "Demo mode - document stored in memory"
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
            error: `Error storing document: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "list_documents",
  {
    limit: z.number().optional().default(50).describe("Maximum number of documents to return"),
    offset: z.number().optional().default(0).describe("Number of documents to skip"),
    filter: z.object({
      type: z.string().optional(),
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      dateRange: z.object({
        start: z.string().optional(),
        end: z.string().optional()
      }).optional()
    }).optional().describe("Filters to apply")
  },
  async ({ limit, offset, filter = {} }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        // Retrieve all memories and filter for documents
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        
        let documents = allMemories
          .filter(memory => memory.metadata?.type === 'document')
          .map(memory => ({
            documentId: memory.metadata.documentId,
            title: memory.metadata.title || 'Untitled',
            author: memory.metadata.author,
            source: memory.metadata.source,
            created: memory.metadata.created || memory.timestamp,
            type: memory.metadata.documentType || 'text',
            tags: memory.metadata.tags || [],
            contentLength: memory.metadata.contentLength || memory.response.length,
            conceptCount: memory.concepts?.length || 0,
            timestamp: memory.timestamp
          }));
        
        // Apply filters
        if (filter.type) {
          documents = documents.filter(doc => doc.type === filter.type);
        }
        if (filter.author) {
          documents = documents.filter(doc => doc.author?.includes(filter.author));
        }
        if (filter.tags?.length > 0) {
          documents = documents.filter(doc => 
            filter.tags.some(tag => doc.tags.includes(tag))
          );
        }
        if (filter.dateRange) {
          const start = filter.dateRange.start ? new Date(filter.dateRange.start) : new Date(0);
          const end = filter.dateRange.end ? new Date(filter.dateRange.end) : new Date();
          documents = documents.filter(doc => {
            const docDate = new Date(doc.created);
            return docDate >= start && docDate <= end;
          });
        }
        
        // Apply pagination
        const paginatedDocs = documents.slice(offset, offset + limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              total: documents.length,
              returned: paginatedDocs.length,
              offset,
              limit,
              documents: paginatedDocs
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockDocuments = [
          {
            documentId: "demo_doc_1",
            title: "Sample Document 1",
            author: "Demo Author",
            type: "text",
            tags: ["demo", "sample"],
            contentLength: 1500,
            conceptCount: 8,
            created: new Date().toISOString()
          },
          {
            documentId: "demo_doc_2", 
            title: "Sample Document 2",
            type: "research",
            tags: ["research", "ai"],
            contentLength: 2300,
            conceptCount: 12,
            created: new Date().toISOString()
          }
        ].slice(offset, offset + limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              total: 2,
              returned: mockDocuments.length,
              offset,
              limit,
              documents: mockDocuments,
              note: "Demo mode - showing mock documents"
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
            error: `Error listing documents: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "delete_documents",
  {
    description: "Delete one or more documents by their IDs",
    parameters: { documentIds: z.array(z.string()).describe("Array of document IDs to delete"),
    confirmDelete: z.boolean().default(false).describe("Confirm deletion (safety check)")
  
    }
  },
  async ({ documentIds, confirmDelete }) => {
    try {
      if (!confirmDelete) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Deletion not confirmed. Set confirmDelete to true to proceed.",
              documentsToDelete: documentIds.length
            }, null, 2)
          }]
        };
      }
      
      await initializeServices();
      
      if (memoryManager) {
        // Note: Current MemoryManager doesn't have direct delete functionality
        // In a full implementation, this would require extending MemoryManager
        // For now, we'll provide feedback about what would be deleted
        
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const documentsToDelete = allMemories.filter(memory => 
          memory.metadata?.type === 'document' && 
          documentIds.includes(memory.metadata.documentId)
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              note: "Delete functionality requires MemoryManager enhancement",
              requestedDeletions: documentIds.length,
              foundDocuments: documentsToDelete.length,
              foundDocumentIds: documentsToDelete.map(doc => doc.metadata.documentId),
              message: "In full implementation, these documents would be deleted from storage"
            }, null, 2)
          }]
        };
      } else {
        // Demo mode
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deletedDocuments: documentIds.length,
              deletedIds: documentIds,
              note: "Demo mode - documents would be deleted in real implementation"
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
            error: `Error deleting documents: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// === RELATIONSHIP MANAGEMENT TOOLS ===

server.tool(
  "create_relations",
  {
    sourceEntity: z.string().describe("Source entity URI or ID"),
    targetEntity: z.string().describe("Target entity URI or ID"),
    relationshipType: z.string().describe("Type of relationship (e.g., 'relatedTo', 'partOf', 'causes')"),
    description: z.string().optional().describe("Human-readable description of the relationship"),
    weight: z.number().optional().default(1.0).describe("Relationship strength/weight (0-1)"),
    metadata: z.object({}).optional().describe("Additional relationship metadata")
  },
  async ({ sourceEntity, targetEntity, relationshipType, description, weight, metadata = {} }) => {
    try {
      await initializeServices();
      
      if (memoryManager && memoryManager.llmHandler) {
        // Create relationship using Ragno's Relationship class
        const relationship = new Relationship({
          source: sourceEntity,
          target: targetEntity,
          type: relationshipType,
          description: description || `${sourceEntity} ${relationshipType} ${targetEntity}`,
          weight: weight,
          metadata: {
            ...metadata,
            created: new Date().toISOString(),
            createdBy: 'mcp-server'
          }
        });
        
        // In a full implementation, this would be stored in SPARQL store
        // For now, we'll store it as a memory interaction
        const relationshipData = {
          type: 'relationship',
          relationship: {
            source: sourceEntity,
            target: targetEntity,
            relationshipType,
            description,
            weight,
            id: relationship.uri || `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata
          }
        };
        
        await memoryManager.addInteraction(
          `Relationship: ${sourceEntity} ${relationshipType} ${targetEntity}`,
          JSON.stringify(relationshipData),
          null, // No embedding for relationships
          [sourceEntity, targetEntity, relationshipType],
          relationshipData
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              relationship: relationshipData.relationship,
              message: "Relationship created successfully"
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const relationshipId = `demo_rel_${Date.now()}`;
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              relationship: {
                id: relationshipId,
                source: sourceEntity,
                target: targetEntity,
                relationshipType,
                description: description || `${sourceEntity} ${relationshipType} ${targetEntity}`,
                weight,
                metadata: { ...metadata, created: new Date().toISOString() }
              },
              note: "Demo mode - relationship would be stored in graph database"
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
            error: `Error creating relationship: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "search_relations",
  {
    description: "Search for relationships by entity, type, or other criteria",
    parameters: {entityId: z.string().optional().describe("Entity ID to search relations for"),
    relationshipType: z.string().optional().describe("Filter by relationship type"),
    direction: z.enum(['outgoing', 'incoming', 'both']).optional().default('both').describe("Relationship direction"),
    limit: z.number().optional().default(50).describe("Maximum relationships to return"),
    minWeight: z.number().optional().default(0).describe("Minimum relationship weight")
  
    }
  },
  async ({ entityId, relationshipType, direction, limit, minWeight }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        // Retrieve all memories and filter for relationships
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        
        let relationships = allMemories
          .filter(memory => memory.metadata?.type === 'relationship')
          .map(memory => memory.metadata.relationship)
          .filter(rel => rel != null);
        
        // Apply filters
        if (entityId) {
          relationships = relationships.filter(rel => {
            switch (direction) {
              case 'outgoing':
                return rel.source === entityId;
              case 'incoming':
                return rel.target === entityId;
              case 'both':
              default:
                return rel.source === entityId || rel.target === entityId;
            }
          });
        }
        
        if (relationshipType) {
          relationships = relationships.filter(rel => rel.relationshipType === relationshipType);
        }
        
        if (minWeight > 0) {
          relationships = relationships.filter(rel => (rel.weight || 0) >= minWeight);
        }
        
        // Limit results
        relationships = relationships.slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: { entityId, relationshipType, direction, minWeight },
              count: relationships.length,
              relationships
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockRelationships = [
          {
            id: "demo_rel_1",
            source: "entity_ai",
            target: "entity_ml", 
            relationshipType: "includes",
            description: "AI includes machine learning",
            weight: 0.9,
            metadata: { created: new Date().toISOString() }
          },
          {
            id: "demo_rel_2",
            source: "entity_ml",
            target: "entity_dl",
            relationshipType: "includes", 
            description: "Machine learning includes deep learning",
            weight: 0.8,
            metadata: { created: new Date().toISOString() }
          }
        ].filter(rel => {
          if (entityId) {
            switch (direction) {
              case 'outgoing': return rel.source === entityId;
              case 'incoming': return rel.target === entityId;
              case 'both': 
              default: return rel.source === entityId || rel.target === entityId;
            }
          }
          return true;
        }).slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: { entityId, relationshipType, direction, minWeight },
              count: mockRelationships.length,
              relationships: mockRelationships,
              note: "Demo mode - showing mock relationships"
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
            error: `Error searching relationships: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "delete_relations",
  {
    description: "Delete relationships from the knowledge graph by ID",
    parameters: {relationshipIds: z.array(z.string()).describe("Array of relationship IDs to delete"),
    confirmDelete: z.boolean().default(false).describe("Confirm deletion (safety check)")
  
    }
  },
  async ({ relationshipIds, confirmDelete }) => {
    try {
      if (!confirmDelete) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Deletion not confirmed. Set confirmDelete to true to proceed.",
              relationshipsToDelete: relationshipIds.length
            }, null, 2)
          }]
        };
      }
      
      await initializeServices();
      
      if (memoryManager) {
        // Note: Similar to document deletion, this requires MemoryManager enhancement
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const relationshipsToDelete = allMemories.filter(memory => 
          memory.metadata?.type === 'relationship' && 
          relationshipIds.includes(memory.metadata.relationship?.id)
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              note: "Delete functionality requires MemoryManager enhancement",
              requestedDeletions: relationshipIds.length,
              foundRelationships: relationshipsToDelete.length,
              foundRelationshipIds: relationshipsToDelete.map(rel => rel.metadata.relationship.id),
              message: "In full implementation, these relationships would be deleted from graph"
            }, null, 2)
          }]
        };
      } else {
        // Demo mode
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              deletedRelationships: relationshipIds.length,
              deletedIds: relationshipIds,
              note: "Demo mode - relationships would be deleted in real implementation"
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
            error: `Error deleting relationships: ${error.message}`
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
    description: "Create an RDF entity with semantic properties and metadata",
    parameters: {name: z.string().describe("Entity name"),
    isEntryPoint: z.boolean().optional().default(false).describe("Whether this is an entry point entity"),
    subType: z.string().optional().describe("Entity subtype"),
    frequency: z.number().optional().default(1).describe("Entity frequency/importance")
  
    }
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
    description: "Create a semantic text unit from corpus decomposition",
    parameters: {text: z.string().describe("Text content of the semantic unit"),
    summary: z.string().optional().describe("Summary of the unit"),
    source: z.string().optional().describe("Source identifier"),
    position: z.number().optional().describe("Position in source"),
    length: z.number().optional().describe("Length of the unit")
  
    }
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

// === GRAPH TRAVERSAL TOOLS ===

server.tool(
  "search_nodes",
  {
    description: "Search for nodes in the knowledge graph by query and type",
    parameters: {query: z.string().optional().describe("Search query for node discovery"),
    nodeType: z.string().optional().describe("Filter by node type (entity, document, concept)"),
    limit: z.number().optional().default(50).describe("Maximum nodes to return"),
    includeConnections: z.boolean().optional().default(false).describe("Include connection count for each node")
  
    }
  },
  async ({ query, nodeType, limit, includeConnections }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const nodes = new Map();
        
        // Collect entities from memory
        allMemories.forEach(memory => {
          // Add document nodes
          if (memory.metadata?.type === 'document') {
            const docId = memory.metadata.documentId;
            if (!nodeType || nodeType === 'document') {
              nodes.set(docId, {
                id: docId,
                name: memory.metadata.title || 'Untitled',
                type: 'document',
                metadata: memory.metadata,
                content: memory.response.substring(0, 200) + '...',
                connections: 0
              });
            }
          }
          
          // Add concept/entity nodes
          if (memory.concepts) {
            memory.concepts.forEach(concept => {
              if (!nodeType || nodeType === 'entity' || nodeType === 'concept') {
                if (!nodes.has(concept)) {
                  nodes.set(concept, {
                    id: concept,
                    name: concept,
                    type: 'concept',
                    connections: 0,
                    sources: []
                  });
                }
                nodes.get(concept).sources.push(memory.metadata?.documentId || 'memory');
              }
            });
          }
        });
        
        // Calculate connections if requested
        if (includeConnections) {
          const relationshipMemories = allMemories.filter(m => m.metadata?.type === 'relationship');
          relationshipMemories.forEach(relMem => {
            const rel = relMem.metadata.relationship;
            if (rel) {
              if (nodes.has(rel.source)) {
                nodes.get(rel.source).connections++;
              }
              if (nodes.has(rel.target)) {
                nodes.get(rel.target).connections++;
              }
            }
          });
        }
        
        let nodeArray = Array.from(nodes.values());
        
        // Apply query filter
        if (query) {
          const queryLower = query.toLowerCase();
          nodeArray = nodeArray.filter(node => 
            node.name.toLowerCase().includes(queryLower) ||
            node.id.toLowerCase().includes(queryLower) ||
            (node.content && node.content.toLowerCase().includes(queryLower))
          );
        }
        
        // Apply limit
        nodeArray = nodeArray.slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: { query, nodeType, includeConnections },
              count: nodeArray.length,
              nodes: nodeArray
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockNodes = [
          {
            id: "entity_ai",
            name: "Artificial Intelligence",
            type: "concept",
            connections: 5,
            sources: ["demo_doc_1", "demo_doc_2"]
          },
          {
            id: "entity_ml", 
            name: "Machine Learning",
            type: "concept",
            connections: 3,
            sources: ["demo_doc_1"]
          },
          {
            id: "demo_doc_1",
            name: "Introduction to AI",
            type: "document",
            connections: 2,
            content: "This document introduces artificial intelligence concepts..."
          }
        ].filter(node => {
          if (nodeType && node.type !== nodeType) return false;
          if (query) {
            const queryLower = query.toLowerCase();
            return node.name.toLowerCase().includes(queryLower) ||
                   node.id.toLowerCase().includes(queryLower);
          }
          return true;
        }).slice(0, limit);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: { query, nodeType, includeConnections },
              count: mockNodes.length,
              nodes: mockNodes,
              note: "Demo mode - showing mock nodes"
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
            error: `Error searching nodes: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "read_graph",
  {
    description: "Export knowledge graph structure in various formats (adjacency, edge list, etc.)",
    parameters: {rootNodes: z.array(z.string()).optional().describe("Starting nodes for graph exploration"),
    maxDepth: z.number().optional().default(3).describe("Maximum traversal depth"),
    includeMetadata: z.boolean().optional().default(true).describe("Include node and edge metadata"),
    format: z.enum(['adjacency', 'edge_list', 'cytoscape']).optional().default('adjacency').describe("Graph format")
  
    }
  },
  async ({ rootNodes, maxDepth, includeMetadata, format }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const nodes = new Map();
        const edges = [];
        
        // Build nodes from memories
        allMemories.forEach(memory => {
          if (memory.metadata?.type === 'document') {
            const docId = memory.metadata.documentId;
            nodes.set(docId, {
              id: docId,
              label: memory.metadata.title || 'Untitled',
              type: 'document',
              metadata: includeMetadata ? memory.metadata : {}
            });
          }
          
          if (memory.concepts) {
            memory.concepts.forEach(concept => {
              if (!nodes.has(concept)) {
                nodes.set(concept, {
                  id: concept,
                  label: concept,
                  type: 'concept',
                  metadata: includeMetadata ? { sources: [] } : {}
                });
              }
              if (includeMetadata && memory.metadata?.documentId) {
                nodes.get(concept).metadata.sources.push(memory.metadata.documentId);
              }
            });
          }
        });
        
        // Build edges from relationships
        const relationshipMemories = allMemories.filter(m => m.metadata?.type === 'relationship');
        relationshipMemories.forEach(relMem => {
          const rel = relMem.metadata.relationship;
          if (rel && nodes.has(rel.source) && nodes.has(rel.target)) {
            edges.push({
              source: rel.source,
              target: rel.target,
              type: rel.relationshipType,
              weight: rel.weight || 1,
              metadata: includeMetadata ? rel.metadata : {}
            });
          }
        });
        
        // Add concept-document edges
        allMemories.forEach(memory => {
          if (memory.metadata?.type === 'document' && memory.concepts) {
            const docId = memory.metadata.documentId;
            memory.concepts.forEach(concept => {
              if (nodes.has(concept) && nodes.has(docId)) {
                edges.push({
                  source: docId,
                  target: concept,
                  type: 'mentions',
                  weight: 1,
                  metadata: includeMetadata ? { extractedFrom: docId } : {}
                });
              }
            });
          }
        });
        
        // Filter by root nodes if specified
        let filteredNodes = nodes;
        let filteredEdges = edges;
        
        if (rootNodes && rootNodes.length > 0) {
          const reachableNodes = new Set(rootNodes);
          const visitedNodes = new Set();
          
          // BFS to find reachable nodes within maxDepth
          let currentDepth = 0;
          let currentLevel = [...rootNodes];
          
          while (currentDepth < maxDepth && currentLevel.length > 0) {
            const nextLevel = [];
            
            for (const nodeId of currentLevel) {
              if (visitedNodes.has(nodeId)) continue;
              visitedNodes.add(nodeId);
              
              // Find connected nodes
              edges.forEach(edge => {
                if (edge.source === nodeId && !reachableNodes.has(edge.target)) {
                  reachableNodes.add(edge.target);
                  nextLevel.push(edge.target);
                }
                if (edge.target === nodeId && !reachableNodes.has(edge.source)) {
                  reachableNodes.add(edge.source);
                  nextLevel.push(edge.source);
                }
              });
            }
            
            currentLevel = nextLevel;
            currentDepth++;
          }
          
          // Filter nodes and edges
          filteredNodes = new Map();
          for (const nodeId of reachableNodes) {
            if (nodes.has(nodeId)) {
              filteredNodes.set(nodeId, nodes.get(nodeId));
            }
          }
          
          filteredEdges = edges.filter(edge => 
            reachableNodes.has(edge.source) && reachableNodes.has(edge.target)
          );
        }
        
        // Format output based on requested format
        let graphData;
        const nodeArray = Array.from(filteredNodes.values());
        
        switch (format) {
          case 'edge_list':
            graphData = {
              nodes: nodeArray,
              edges: filteredEdges
            };
            break;
          
          case 'cytoscape':
            graphData = {
              elements: [
                ...nodeArray.map(node => ({ data: node })),
                ...filteredEdges.map(edge => ({ data: edge }))
              ]
            };
            break;
          
          case 'adjacency':
          default:
            const adjacency = {};
            nodeArray.forEach(node => {
              adjacency[node.id] = {
                node: node,
                connections: filteredEdges
                  .filter(edge => edge.source === node.id || edge.target === node.id)
                  .map(edge => ({
                    connectedTo: edge.source === node.id ? edge.target : edge.source,
                    type: edge.type,
                    weight: edge.weight,
                    direction: edge.source === node.id ? 'outgoing' : 'incoming'
                  }))
              };
            });
            graphData = adjacency;
            break;
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              format,
              statistics: {
                nodeCount: nodeArray.length,
                edgeCount: filteredEdges.length,
                maxDepth: currentDepth || 0
              },
              graph: graphData
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockGraph = {
          "entity_ai": {
            node: { id: "entity_ai", label: "Artificial Intelligence", type: "concept" },
            connections: [
              { connectedTo: "entity_ml", type: "includes", weight: 0.9, direction: "outgoing" },
              { connectedTo: "demo_doc_1", type: "mentions", weight: 1, direction: "incoming" }
            ]
          },
          "entity_ml": {
            node: { id: "entity_ml", label: "Machine Learning", type: "concept" },
            connections: [
              { connectedTo: "entity_ai", type: "includes", weight: 0.9, direction: "incoming" },
              { connectedTo: "entity_dl", type: "includes", weight: 0.8, direction: "outgoing" }
            ]
          },
          "demo_doc_1": {
            node: { id: "demo_doc_1", label: "Introduction to AI", type: "document" },
            connections: [
              { connectedTo: "entity_ai", type: "mentions", weight: 1, direction: "outgoing" }
            ]
          }
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              format,
              statistics: { nodeCount: 3, edgeCount: 3, maxDepth: 1 },
              graph: mockGraph,
              note: "Demo mode - showing mock graph structure"
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
            error: `Error reading graph: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "get_knowledge_graph_stats",
  {
    description: "Get comprehensive statistics about the knowledge graph structure",
    parameters: {includeDetails: z.boolean().optional().default(false).describe("Include detailed breakdowns")
  
    }
  },
  async ({ includeDetails }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        
        const stats = {
          overview: {
            totalMemories: allMemories.length,
            totalDocuments: 0,
            totalEntities: 0,
            totalRelationships: 0,
            totalConcepts: 0
          },
          types: {},
          growth: {},
          connectivity: {}
        };
        
        const entities = new Set();
        const concepts = new Set();
        const documentTypes = {};
        const relationshipTypes = {};
        
        allMemories.forEach(memory => {
          // Count documents
          if (memory.metadata?.type === 'document') {
            stats.overview.totalDocuments++;
            const docType = memory.metadata.documentType || 'text';
            documentTypes[docType] = (documentTypes[docType] || 0) + 1;
          }
          
          // Count relationships
          if (memory.metadata?.type === 'relationship') {
            stats.overview.totalRelationships++;
            const relType = memory.metadata.relationship?.relationshipType || 'unknown';
            relationshipTypes[relType] = (relationshipTypes[relType] || 0) + 1;
          }
          
          // Count concepts and entities
          if (memory.concepts) {
            memory.concepts.forEach(concept => {
              concepts.add(concept);
              entities.add(concept);
            });
          }
        });
        
        stats.overview.totalEntities = entities.size;
        stats.overview.totalConcepts = concepts.size;
        
        if (includeDetails) {
          stats.types = {
            documentTypes,
            relationshipTypes,
            conceptFrequency: {}
          };
          
          // Calculate concept frequency
          allMemories.forEach(memory => {
            if (memory.concepts) {
              memory.concepts.forEach(concept => {
                stats.types.conceptFrequency[concept] = 
                  (stats.types.conceptFrequency[concept] || 0) + 1;
              });
            }
          });
          
          // Calculate connectivity metrics
          const connectionCounts = {};
          allMemories.filter(m => m.metadata?.type === 'relationship').forEach(relMem => {
            const rel = relMem.metadata.relationship;
            if (rel) {
              connectionCounts[rel.source] = (connectionCounts[rel.source] || 0) + 1;
              connectionCounts[rel.target] = (connectionCounts[rel.target] || 0) + 1;
            }
          });
          
          const connections = Object.values(connectionCounts);
          stats.connectivity = {
            avgConnections: connections.length > 0 ? 
              connections.reduce((a, b) => a + b, 0) / connections.length : 0,
            maxConnections: Math.max(...connections, 0),
            connectedNodes: Object.keys(connectionCounts).length,
            isolatedNodes: entities.size - Object.keys(connectionCounts).length
          };
          
          // Growth metrics (basic - could be enhanced with timestamps)
          stats.growth = {
            documentsLastWeek: stats.overview.totalDocuments, // Placeholder
            relationshipsLastWeek: stats.overview.totalRelationships, // Placeholder
            conceptsLastWeek: stats.overview.totalConcepts // Placeholder
          };
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              includeDetails,
              statistics: stats
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockStats = {
          overview: {
            totalMemories: 25,
            totalDocuments: 8,
            totalEntities: 15,
            totalRelationships: 12,
            totalConcepts: 15
          }
        };
        
        if (includeDetails) {
          mockStats.types = {
            documentTypes: { text: 5, research: 2, reference: 1 },
            relationshipTypes: { includes: 6, relatedTo: 4, partOf: 2 },
            conceptFrequency: {
              "artificial intelligence": 8,
              "machine learning": 6,
              "deep learning": 4,
              "neural networks": 3
            }
          };
          
          mockStats.connectivity = {
            avgConnections: 2.4,
            maxConnections: 8,
            connectedNodes: 12,
            isolatedNodes: 3
          };
          
          mockStats.growth = {
            documentsLastWeek: 3,
            relationshipsLastWeek: 5,
            conceptsLastWeek: 7
          };
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              includeDetails,
              statistics: mockStats,
              note: "Demo mode - showing mock statistics"
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
            error: `Error getting knowledge graph stats: ${error.message}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// === HYBRID SEARCH TOOLS ===

server.tool(
  "hybrid_search",
  {
    query: z.string().describe("Search query text"),
    options: z.object({
      maxResults: z.number().optional().default(20).describe("Maximum total results to return"),
      vectorWeight: z.number().optional().default(0.6).describe("Weight for vector similarity (0-1)"),
      graphWeight: z.number().optional().default(0.4).describe("Weight for graph connectivity (0-1)"),
      similarityThreshold: z.number().optional().default(0.7).describe("Minimum similarity threshold"),
      includeDocuments: z.boolean().optional().default(true).describe("Include document content"),
      includeEntities: z.boolean().optional().default(true).describe("Include related entities"),
      includeRelationships: z.boolean().optional().default(true).describe("Include relationships"),
      graphDepth: z.number().optional().default(2).describe("Maximum graph traversal depth"),
      zptParams: z.object({
        zoom: z.enum(['entity', 'unit', 'text', 'community', 'corpus']).optional().default('unit'),
        tilt: z.enum(['embedding', 'keywords', 'graph', 'temporal']).optional().default('embedding')
      }).optional().describe("ZPT navigation parameters")
    }).optional().describe("Hybrid search options")
  },
  { description: "Perform GraphRAG hybrid search combining vector similarity with graph traversal" },
  async ({ query, options = {} }) => {
    try {
      await initializeServices();
      
      const {
        maxResults = 20,
        vectorWeight = 0.6,
        graphWeight = 0.4,
        similarityThreshold = 0.7,
        includeDocuments = true,
        includeEntities = true, 
        includeRelationships = true,
        graphDepth = 2,
        zptParams = { zoom: 'unit', tilt: 'embedding' }
      } = options;
      
      if (memoryManager && memoryManager.embeddingHandler) {
        const results = {
          query,
          summary: {},
          documents: [],
          entities: [],
          relationships: [],
          metadata: {
            vectorWeight,
            graphWeight,
            similarityThreshold,
            graphDepth,
            zptParams
          }
        };
        
        // Phase 1: Vector similarity search
        const vectorResults = await memoryManager.retrieveRelevantInteractions(
          query, 
          similarityThreshold, 
          0
        );
        
        // Phase 2: Extract entities from vector results
        const queryEmbedding = await memoryManager.generateEmbedding(query);
        const relatedEntityIds = new Set();
        
        // Collect entities from memories
        vectorResults.forEach(memory => {
          if (memory.concepts) {
            memory.concepts.forEach(concept => relatedEntityIds.add(concept));
          }
          if (memory.metadata?.type === 'document') {
            relatedEntityIds.add(memory.metadata.documentId);
          }
        });
        
        // Phase 3: Graph traversal from related entities
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const relationshipMemories = allMemories.filter(m => m.metadata?.type === 'relationship');
        
        const graphTraversalResults = new Set();
        const visitedEntities = new Set();
        
        // BFS graph traversal
        let currentDepth = 0;
        let currentLevel = Array.from(relatedEntityIds);
        
        while (currentDepth < graphDepth && currentLevel.length > 0) {
          const nextLevel = new Set();
          
          for (const entityId of currentLevel) {
            if (visitedEntities.has(entityId)) continue;
            visitedEntities.add(entityId);
            graphTraversalResults.add(entityId);
            
            // Find connected entities through relationships
            relationshipMemories.forEach(relMem => {
              const rel = relMem.metadata.relationship;
              if (rel) {
                if (rel.source === entityId && !visitedEntities.has(rel.target)) {
                  nextLevel.add(rel.target);
                }
                if (rel.target === entityId && !visitedEntities.has(rel.source)) {
                  nextLevel.add(rel.source);
                }
              }
            });
          }
          
          currentLevel = Array.from(nextLevel);
          currentDepth++;
        }
        
        // Phase 4: Use ZPT for intelligent content selection
        if (config && zptParams) {
          try {
            const selector = new CorpuscleSelector();
            const zptSelection = await selector.select({
              zoom: zptParams.zoom,
              tilt: zptParams.tilt,
              query: query,
              limit: Math.floor(maxResults * 0.3) // Reserve 30% for ZPT results
            });
            
            results.zptResults = {
              corpuscleCount: zptSelection?.corpuscles?.length || 0,
              selection: zptSelection
            };
          } catch (zptError) {
            results.zptResults = { error: zptError.message };
          }
        }
        
        // Phase 5: Combine and score results
        const combinedResults = [];
        
        // Score vector results
        vectorResults.forEach(memory => {
          const vectorScore = memory.similarity || 0;
          const graphScore = graphTraversalResults.has(memory.metadata?.documentId) ? 1 : 0;
          const hybridScore = (vectorScore * vectorWeight) + (graphScore * graphWeight);
          
          if (hybridScore >= similarityThreshold * 0.8) { // Slightly lower threshold for hybrid
            combinedResults.push({
              ...memory,
              hybridScore,
              vectorScore,
              graphScore,
              source: 'vector'
            });
          }
        });
        
        // Sort by hybrid score
        combinedResults.sort((a, b) => b.hybridScore - a.hybridScore);
        
        // Categorize results
        if (includeDocuments) {
          results.documents = combinedResults
            .filter(r => r.metadata?.type === 'document' || !r.metadata?.type)
            .slice(0, Math.floor(maxResults * 0.5))
            .map(r => ({
              documentId: r.metadata?.documentId || `mem_${r.timestamp}`,
              title: r.metadata?.title || r.prompt.substring(0, 50) + '...',
              content: r.response.substring(0, 500) + (r.response.length > 500 ? '...' : ''),
              similarity: r.similarity,
              hybridScore: r.hybridScore,
              concepts: r.concepts,
              timestamp: r.timestamp,
              metadata: r.metadata
            }));
        }
        
        if (includeEntities) {
          results.entities = Array.from(relatedEntityIds).slice(0, Math.floor(maxResults * 0.3)).map(entityId => ({
            id: entityId,
            name: entityId,
            inGraph: graphTraversalResults.has(entityId),
            type: 'concept'
          }));
        }
        
        if (includeRelationships) {
          results.relationships = relationshipMemories
            .filter(relMem => {
              const rel = relMem.metadata.relationship;
              return rel && (
                relatedEntityIds.has(rel.source) || 
                relatedEntityIds.has(rel.target)
              );
            })
            .slice(0, Math.floor(maxResults * 0.2))
            .map(relMem => relMem.metadata.relationship);
        }
        
        results.summary = {
          totalResults: combinedResults.length,
          documentCount: results.documents.length,
          entityCount: results.entities.length,
          relationshipCount: results.relationships.length,
          graphTraversalDepth: currentDepth,
          entitiesTraversed: visitedEntities.size
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results, null, 2)
          }]
        };
      } else {
        // Demo fallback with mock hybrid results
        const mockResults = {
          query,
          summary: {
            totalResults: 8,
            documentCount: 3,
            entityCount: 3,
            relationshipCount: 2,
            graphTraversalDepth: 2,
            entitiesTraversed: 5
          },
          documents: [
            {
              documentId: "demo_doc_1",
              title: "Introduction to Machine Learning",
              content: "Machine learning is a subset of artificial intelligence that enables computers to learn...",
              similarity: 0.89,
              hybridScore: 0.85,
              concepts: ["machine learning", "artificial intelligence", "algorithms"],
              timestamp: new Date().toISOString()
            },
            {
              documentId: "demo_doc_2", 
              title: "Deep Learning Fundamentals",
              content: "Deep learning uses neural networks with multiple layers to model complex patterns...",
              similarity: 0.76,
              hybridScore: 0.78,
              concepts: ["deep learning", "neural networks", "patterns"],
              timestamp: new Date().toISOString()
            }
          ],
          entities: [
            { id: "entity_ml", name: "Machine Learning", inGraph: true, type: "concept" },
            { id: "entity_ai", name: "Artificial Intelligence", inGraph: true, type: "concept" },
            { id: "entity_dl", name: "Deep Learning", inGraph: true, type: "concept" }
          ],
          relationships: [
            {
              id: "demo_rel_1",
              source: "entity_ai",
              target: "entity_ml",
              relationshipType: "includes",
              description: "AI includes machine learning",
              weight: 0.9
            },
            {
              id: "demo_rel_2",
              source: "entity_ml", 
              target: "entity_dl",
              relationshipType: "includes",
              description: "Machine learning includes deep learning",
              weight: 0.8
            }
          ],
          metadata: { vectorWeight, graphWeight, similarityThreshold, graphDepth, zptParams },
          note: "Demo mode - showing mock hybrid search results combining vector similarity and graph traversal"
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(mockResults, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Error performing hybrid search: ${error.message}`,
            query
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// === ENHANCED RETRIEVAL TOOLS ===

server.tool(
  "search_documentation",
  {
    query: z.string().describe("Search query for semantic document search"),
    options: z.object({
      maxResults: z.number().optional().default(10).describe("Maximum documents to return"),
      similarityThreshold: z.number().optional().default(0.7).describe("Minimum similarity threshold"),
      includeContent: z.boolean().optional().default(true).describe("Include document content in results"),
      contentLength: z.number().optional().default(500).describe("Maximum content length to return"),
      sortBy: z.enum(['similarity', 'date', 'relevance']).optional().default('similarity').describe("Sort order"),
      documentTypes: z.array(z.string()).optional().describe("Filter by document types")
    }).optional().describe("Search options")
  },
  async ({ query, options = {} }) => {
    try {
      await initializeServices();
      
      const {
        maxResults = 10,
        similarityThreshold = 0.7,
        includeContent = true,
        contentLength = 500,
        sortBy = 'similarity',
        documentTypes = []
      } = options;
      
      if (memoryManager) {
        // Perform semantic search on documents
        const allMemories = await memoryManager.retrieveRelevantInteractions(query, similarityThreshold, 0);
        
        // Filter for documents only
        let documentResults = allMemories.filter(memory => 
          memory.metadata?.type === 'document' || !memory.metadata?.type
        );
        
        // Apply document type filter
        if (documentTypes.length > 0) {
          documentResults = documentResults.filter(memory => 
            documentTypes.includes(memory.metadata?.documentType || 'text')
          );
        }
        
        // Sort results
        switch (sortBy) {
          case 'date':
            documentResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            break;
          case 'relevance':
            // Combine similarity with concept overlap
            documentResults = documentResults.map(doc => ({
              ...doc,
              relevanceScore: (doc.similarity || 0) * 0.7 + 
                            (doc.concepts?.length || 0) * 0.1 / 10 + // Normalize concept count
                            (doc.metadata?.title?.toLowerCase().includes(query.toLowerCase()) ? 0.2 : 0)
            })).sort((a, b) => b.relevanceScore - a.relevanceScore);
            break;
          case 'similarity':
          default:
            documentResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            break;
        }
        
        // Limit and format results
        const formattedResults = documentResults.slice(0, maxResults).map(memory => ({
          documentId: memory.metadata?.documentId || `mem_${memory.timestamp}`,
          title: memory.metadata?.title || memory.prompt.substring(0, 50) + '...',
          similarity: memory.similarity,
          relevanceScore: memory.relevanceScore,
          content: includeContent ? 
            memory.response.substring(0, contentLength) + (memory.response.length > contentLength ? '...' : '') : 
            null,
          summary: memory.response.substring(0, 150) + '...',
          concepts: memory.concepts || [],
          metadata: {
            type: memory.metadata?.type || 'text',
            author: memory.metadata?.author,
            source: memory.metadata?.source,
            created: memory.metadata?.created || memory.timestamp,
            tags: memory.metadata?.tags || []
          },
          timestamp: memory.timestamp
        }));
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              options: { maxResults, similarityThreshold, sortBy, documentTypes },
              summary: {
                totalFound: documentResults.length,
                returned: formattedResults.length,
                avgSimilarity: formattedResults.length > 0 ? 
                  formattedResults.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / formattedResults.length : 0
              },
              documents: formattedResults
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockDocuments = [
          {
            documentId: "demo_doc_ai",
            title: "Artificial Intelligence: A Modern Approach",
            similarity: 0.92,
            content: "Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals...",
            summary: "Comprehensive introduction to AI concepts and methodologies...",
            concepts: ["artificial intelligence", "machine learning", "algorithms"],
            metadata: {
              type: "research",
              author: "Russell & Norvig",
              created: "2023-01-15"
            }
          },
          {
            documentId: "demo_doc_ml",
            title: "Machine Learning Fundamentals",
            similarity: 0.87,
            content: "Machine learning is a method of data analysis that automates analytical model building...",
            summary: "Foundational concepts in machine learning and data science...",
            concepts: ["machine learning", "data analysis", "neural networks"],
            metadata: {
              type: "tutorial",
              author: "Data Science Team",
              created: "2023-02-10"
            }
          }
        ].filter(doc => {
          if (documentTypes.length > 0 && !documentTypes.includes(doc.metadata.type)) return false;
          return true;
        }).slice(0, maxResults);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              options: { maxResults, similarityThreshold, sortBy, documentTypes },
              summary: {
                totalFound: mockDocuments.length,
                returned: mockDocuments.length,
                avgSimilarity: 0.895
              },
              documents: mockDocuments,
              note: "Demo mode - showing mock document search results"
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
            error: `Error searching documentation: ${error.message}`,
            query
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "add_observations",
  {
    entityId: z.string().describe("Entity ID to add observations to"),
    observations: z.array(z.object({
      text: z.string().describe("Observation text"),
      type: z.string().optional().default("general").describe("Type of observation"),
      source: z.string().optional().describe("Source of the observation"),
      confidence: z.number().optional().default(1.0).describe("Confidence level (0-1)"),
      metadata: z.object({}).optional().describe("Additional metadata")
    })).describe("Array of observations to add"),
    overwrite: z.boolean().optional().default(false).describe("Overwrite existing observations")
  },
  async ({ entityId, observations, overwrite }) => {
    try {
      await initializeServices();
      
      if (memoryManager) {
        // Find existing entity information
        const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
        const entityMemories = allMemories.filter(memory => 
          (memory.concepts && memory.concepts.includes(entityId)) ||
          memory.metadata?.documentId === entityId
        );
        
        // Create observations data structure
        const observationData = {
          type: 'observations',
          entityId,
          observations: observations.map(obs => ({
            ...obs,
            id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            addedBy: 'mcp-server'
          })),
          metadata: {
            totalObservations: observations.length,
            overwrite,
            relatedMemories: entityMemories.length,
            timestamp: new Date().toISOString()
          }
        };
        
        // Store observations as a memory interaction
        const observationSummary = observations.map(obs => obs.text).join('; ');
        await memoryManager.addInteraction(
          `Observations for ${entityId}`,
          JSON.stringify(observationData),
          null, // No embedding for observations
          [entityId, 'observations', ...observations.map(obs => obs.type)],
          observationData
        );
        
        // Update existing entity memories if needed
        const enrichmentInfo = {
          entityId,
          observationCount: observations.length,
          observationTypes: [...new Set(observations.map(obs => obs.type))],
          avgConfidence: observations.reduce((sum, obs) => sum + (obs.confidence || 1), 0) / observations.length
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              entityId,
              observationsAdded: observations.length,
              observationIds: observationData.observations.map(obs => obs.id),
              enrichmentInfo,
              relatedMemories: entityMemories.length,
              summary: observationSummary.substring(0, 200) + (observationSummary.length > 200 ? '...' : '')
            }, null, 2)
          }]
        };
      } else {
        // Demo fallback
        const mockObservationIds = observations.map((_, i) => `demo_obs_${Date.now()}_${i}`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              entityId,
              observationsAdded: observations.length,
              observationIds: mockObservationIds,
              enrichmentInfo: {
                entityId,
                observationCount: observations.length,
                observationTypes: [...new Set(observations.map(obs => obs.type))],
                avgConfidence: 0.85
              },
              relatedMemories: 3,
              summary: observations.map(obs => obs.text).join('; ').substring(0, 200) + '...',
              note: "Demo mode - observations would be added to entity context"
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
            error: `Error adding observations: ${error.message}`,
            entityId
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// === MCP RESOURCES ===

// System status resource
server.resource(
  "semem-status",
  "semem://status",
  async () => {
    try {
      const status = {
        server: {
          name: "Semem Integration Server",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        },
        services: {
          memoryManagerInitialized: memoryManager !== null,
          configInitialized: config !== null,
          llmProvider: process.env.OLLAMA_HOST ? 'ollama' : (process.env.CLAUDE_API_KEY ? 'claude' : 'none')
        },
        capabilities: {
          semem_core: 5,
          ragno_api: 3, 
          zpt_api: 2,
          document_management: 3,
          relationship_management: 3,
          hybrid_search: 1,
          graph_traversal: 3,
          enhanced_retrieval: 2
        }
      };
      
      if (memoryManager) {
        try {
          // Use a simple query instead of empty string to avoid embedding generation errors
          const allMemories = await memoryManager.retrieveRelevantInteractions("all", 0, 0);
          status.memoryStats = {
            totalMemories: allMemories.length,
            documentCount: allMemories.filter(m => m.metadata?.type === 'document').length,
            relationshipCount: allMemories.filter(m => m.metadata?.type === 'relationship').length,
            observationCount: allMemories.filter(m => m.metadata?.type === 'observations').length
          };
        } catch (error) {
          // Fallback: just show that memory manager is available
          status.memoryStats = { 
            available: true,
            error: `Cannot retrieve stats: ${error.message}`,
            note: "Memory manager is initialized but stats unavailable"
          };
        }
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

// Graph schema resource
server.resource(
  "graph-schema",
  "semem://graph/schema",
  async () => {
    try {
      const schema = {
        namespaces: {
          ragno: "http://purl.org/stuff/ragno/",
          semem: "http://purl.org/stuff/semem/",
          skos: "http://www.w3.org/2004/02/skos/core#",
          rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#"
        },
        nodeTypes: {
          "ragno:Entity": {
            description: "RDF entities with semantic properties",
            properties: ["ragno:prefLabel", "ragno:isEntryPoint", "ragno:frequency"]
          },
          "ragno:SemanticUnit": {
            description: "Semantic text units from corpus decomposition", 
            properties: ["ragno:content", "ragno:source", "ragno:position"]
          },
          "ragno:Relationship": {
            description: "Typed relationships between entities",
            properties: ["ragno:source", "ragno:target", "ragno:weight", "ragno:description"]
          },
          "semem:Document": {
            description: "Stored documents with metadata",
            properties: ["semem:title", "semem:author", "semem:content", "semem:tags"]
          },
          "semem:Observation": {
            description: "Contextual observations about entities",
            properties: ["semem:text", "semem:confidence", "semem:source"]
          }
        },
        relationshipTypes: {
          "ragno:relatedTo": "General semantic relationship",
          "ragno:partOf": "Hierarchical part-whole relationship", 
          "ragno:includes": "Containment relationship",
          "ragno:causes": "Causal relationship",
          "semem:mentions": "Document mentions entity",
          "semem:observes": "Observation about entity"
        },
        zptParameters: {
          zoom: {
            levels: ["entity", "unit", "text", "community", "corpus"],
            description: "Abstraction level for content selection"
          },
          tilt: {
            representations: ["embedding", "keywords", "graph", "temporal"],
            description: "Representation format for selected content"
          }
        }
      };
      
      return {
        contents: [{
          uri: "semem://graph/schema", 
          text: JSON.stringify(schema, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: "semem://graph/schema",
          text: `Error getting graph schema: ${error.message}`,
          mimeType: "text/plain"
        }]
      };
    }
  }
);

// API documentation resource
server.resource(
  "api-docs",
  "semem://docs/api",
  async () => {
    try {
      const apiDocs = {
        title: "Semem MCP Server API Documentation",
        version: "1.0.0",
        description: "GraphRAG-compatible MCP server with Semem core, Ragno knowledge graph, and ZPT APIs",
        tools: {
          document_management: [
            "store_document - Store documents with metadata and embeddings",
            "list_documents - List and filter stored documents", 
            "delete_documents - Remove documents from storage"
          ],
          relationship_management: [
            "create_relations - Create typed relationships between entities",
            "search_relations - Query relationships by entity or type",
            "delete_relations - Remove relationships from graph"
          ],
          hybrid_search: [
            "hybrid_search - Combined vector similarity and graph traversal search"
          ],
          graph_traversal: [
            "search_nodes - Discover and filter graph nodes",
            "read_graph - Export graph structure in multiple formats", 
            "get_knowledge_graph_stats - Analytics and connectivity metrics"
          ],
          enhanced_retrieval: [
            "search_documentation - Semantic document search with advanced options",
            "add_observations - Enrich entities with contextual observations"
          ],
          semem_core: [
            "semem_store_interaction - Store memory interactions",
            "semem_retrieve_memories - Semantic memory retrieval",
            "semem_generate_response - Context-aware response generation",
            "semem_generate_embedding - Vector embedding generation",
            "semem_extract_concepts - LLM concept extraction"
          ],
          ragno_api: [
            "ragno_decompose_corpus - Text to RDF knowledge graph decomposition", 
            "ragno_create_entity - Create RDF entities with ontology compliance",
            "ragno_create_semantic_unit - Create semantic text units"
          ],
          zpt_api: [
            "zpt_select_corpuscles - Multi-dimensional content navigation",
            "zpt_chunk_content - Intelligent content chunking"
          ]
        },
        resources: [
          "semem://status - System status and service health",
          "semem://graph/schema - RDF graph schema and ontology information", 
          "semem://docs/api - This API documentation"
        ],
        graphrag_compatibility: {
          standard_tools: ["store_document", "list_documents", "create_relations", "search_relations", "hybrid_search", "read_graph", "get_knowledge_graph_stats", "search_documentation", "add_observations"],
          semem_extensions: ["ZPT navigation", "Ragno RDF compliance", "Semantic web integration", "Multi-tilt representations"]
        }
      };
      
      return {
        contents: [{
          uri: "semem://docs/api",
          text: JSON.stringify(apiDocs, null, 2), 
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: "semem://docs/api",
          text: `Error getting API documentation: ${error.message}`,
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
    // Initialize services before starting server
    console.error("Initializing Semem services...");
    await initializeServices();
    
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