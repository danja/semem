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
// CRITICAL: This singleton must be initialized once and reused across all requests
let simpleVerbsService = null;


/**
 * Register Simple Verbs with MCP Server
 */
export function registerSimpleVerbs(server) {
  mcpDebugger.debug('Simple MCP Verbs service initialized for centralized handler');
  // Simple Verbs are now handled by the centralized tool call handler in index.js
  // This function now just initializes the service - tool registration happens centrally
}

// REDUNDANT CRUFT REMOVED: createSTDIOSearchService() function was unused legacy code
// that bypassed MemoryDomainManager and used direct SPARQLStore.search() calls.
// All recall operations now properly go through SimpleVerbsService -> MemoryDomainManager.

// Export function to get the Simple Verbs service instance for centralized handler
export function getSimpleVerbsService() {
  // Unified approach: ensure singleton is created once and reused
  if (!simpleVerbsService) {
    mcpDebugger.info('🔄 Creating shared SimpleVerbsService singleton');
    simpleVerbsService = new SimpleVerbsService();
  }

  // Always return the same singleton instance for unified storage
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