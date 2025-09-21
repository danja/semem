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

// Create shared service instance for HTTP (working)
const simpleVerbsService = new SimpleVerbsService();

/**
 * Register Simple Verbs with MCP Server
 */
export function registerSimpleVerbs(server) {
  mcpDebugger.debug('Simple MCP Verbs service initialized for centralized handler');
  // Simple Verbs are now handled by the centralized tool call handler in index.js
  // This function now just initializes the service - tool registration happens centrally
}

// Export function to get the Simple Verbs service instance for centralized handler
export function getSimpleVerbsService() {
  // STDIO FIX: Create fresh instance for STDIO to avoid singleton issues
  // HTTP uses shared instance (working), STDIO gets fresh instance
  if (process.env.MCP_INSPECTOR_MODE === 'true' ||
      process.argv.includes('mcp/index.js') ||
      process.stdin.isTTY === false) {
    console.log('🔍 STDIO FIX: Creating fresh SimpleVerbsService instance for STDIO');
    return new SimpleVerbsService();
  }

  // HTTP path: return shared singleton (working)
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