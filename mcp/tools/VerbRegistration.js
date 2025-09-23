/**
 * MCP Registration Functions for Simple Verbs
 * Handles tool definitions and service exports for the MCP server
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { SimpleVerbToolNames } from './VerbSchemas.js';
import {
  TellSchema,
  AskSchema,
  AugmentSchema,
  ZoomSchema,
  PanSchema,
  TiltSchema,
  InspectSchema,
  RememberSchema,
  ForgetSchema,
  RecallSchema,
  ProjectContextSchema,
  FadeMemorySchema
} from './VerbSchemas.js';
import { SimpleVerbsService } from './SimpleVerbsService.js';
import { logOperation } from './VerbsLogger.js';
import { mcpDebugger } from '../lib/debug-utils.js';
// Create shared service instance for all transports (HTTP and STDIO)
const simpleVerbsService = new SimpleVerbsService();


/**
 * Register Simple Verbs with MCP Server
 */
export function registerSimpleVerbs(server) {
  mcpDebugger.debug('Simple MCP Verbs service initialized for centralized handler');
  // Simple Verbs are now handled by the centralized tool call handler in index.js
  // This function now just initializes the service - tool registration happens centrally
}

// STDIO-compatible service using unified ServiceManager
async function createSTDIOSearchService() {
  stdioLogger.debug('🔍 STDIO: Using unified ServiceManager for search service');

  // Get shared services from ServiceManager
  const serviceManager = (await import('../../src/services/ServiceManager.js')).default;
  const services = await serviceManager.getServices();

  // Return service that uses shared storage
  return {
    async ask({ question, threshold = 0.3 }) {
      // Use shared services for embedding and search
      const questionEmbedding = await services.embeddingHandler.generateEmbedding(question);
      const results = await services.storage.search(questionEmbedding, 10, threshold);

      // Return in compatible format
      return {
        success: true,
        verb: 'ask',
        question,
        answer: results.length > 0 ? `Found ${results.length} relevant memories.` : null,
        memories: results.length,
        contextItems: results.length,
        results: results.map(r => ({
          type: 'memory',
          id: r.id,
          title: r.prompt?.substring(0, 50) || 'Memory',
          score: r.similarity,
          metadata: r.metadata || {}
        }))
      };
    },

    async recall({ query, domain = 'user', limit = 10, threshold = 0.3 }) {
      // Generate embedding for query
      const queryEmbedding = await services.embeddingHandler.generateEmbedding(query);
      // Search using shared storage
      const results = await services.storage.search(queryEmbedding, limit, threshold);

      return {
        success: true,
        verb: 'recall',
        query,
        domain,
        memories: results.length,
        results: results.map(r => ({
          type: 'memory',
          id: r.id,
          content: r.prompt || 'No content',
          score: r.similarity,
          metadata: r.metadata || {}
        }))
      };
    },

    async augment({ target, operations = ['extract_concepts'], threshold = 0.3 }) {
      // For augment, use shared services to find related content for concept extraction
      const targetEmbedding = await services.embeddingHandler.generateEmbedding(target);
      const relatedResults = await services.storage.search(targetEmbedding, 5, threshold);

      return {
        success: true,
        verb: 'augment',
        target,
        operations,
        relatedContent: relatedResults.length,
        results: relatedResults.map(r => ({
          id: r.id,
          content: r.prompt?.substring(0, 100) || 'Content',
          similarity: r.similarity
        }))
      };
    }
  };
}

// Export function to get the Simple Verbs service instance for centralized handler
export function getSimpleVerbsService() {
  // Unified approach: always return the shared singleton that uses ServiceManager
  // No more STDIO vs HTTP differentiation needed since ServiceManager unifies everything
  return simpleVerbsService;
}

// Export Simple Verbs tool definitions for centralized handler
export function getSimpleVerbsToolDefinitions() {
  return [
    {
      name: SimpleVerbToolNames.tell,
      description: "Add resources to the system with minimal processing. Supports interaction, document, and concept types.",
      inputSchema: zodToJsonSchema(TellSchema)
    },
    {
      name: SimpleVerbToolNames.ask,
      description: "Query the system using current ZPT context for enhanced answers.",
      inputSchema: zodToJsonSchema(AskSchema)
    },
    {
      name: SimpleVerbToolNames.augment,
      description: "Run operations like concept extraction on relevant knowledgebase parts.",
      inputSchema: zodToJsonSchema(AugmentSchema)
    },
    {
      name: SimpleVerbToolNames.zoom,
      description: "Set the abstraction level for navigation (entity, unit, text, community, corpus).",
      inputSchema: zodToJsonSchema(ZoomSchema)
    },
    {
      name: SimpleVerbToolNames.pan,
      description: "Set subject domain filters (temporal, keywords, entities, domains).",
      inputSchema: zodToJsonSchema(PanSchema)
    },
    {
      name: SimpleVerbToolNames.tilt,
      description: "Set the view filter/representation style (keywords, embedding, graph, temporal).",
      inputSchema: zodToJsonSchema(TiltSchema)
    },
    {
      name: SimpleVerbToolNames.inspect,
      description: "Inspect stored memories and session cache for debugging purposes.",
      inputSchema: zodToJsonSchema(InspectSchema)
    },
    {
      name: SimpleVerbToolNames.remember,
      description: "Store content in specific memory domain with importance weighting. Supports user, project, session, and instruction domains.",
      inputSchema: zodToJsonSchema(RememberSchema)
    },
    {
      name: SimpleVerbToolNames.forget,
      description: "Fade memory visibility using navigation rather than deletion. Supports fade, context_switch, and temporal_decay strategies.",
      inputSchema: zodToJsonSchema(ForgetSchema)
    },
    {
      name: SimpleVerbToolNames.recall,
      description: "Retrieve memories based on query and domain filters with relevance scoring.",
      inputSchema: zodToJsonSchema(RecallSchema)
    },
    {
      name: SimpleVerbToolNames.project_context,
      description: "Manage project-specific memory domains. Create, switch, list, or archive project contexts.",
      inputSchema: zodToJsonSchema(ProjectContextSchema)
    },
    {
      name: SimpleVerbToolNames.fade_memory,
      description: "Gradually reduce memory visibility for smooth context transitions.",
      inputSchema: zodToJsonSchema(FadeMemorySchema)
    }
  ];
}