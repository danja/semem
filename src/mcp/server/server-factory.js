/**
 * MCP Server Factory
 * Creates and configures the MCP server with all handlers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mcpConfig } from '../lib/config.js';
import { mcpDebugger } from '../lib/debug-utils.js';

import { registerPromptHandlers } from './handlers/prompt-handlers.js';
import { registerResourceHandlers } from './handlers/resource-handlers.js';
import { ToolRouter } from './handlers/tool-router.js';

export async function createMCPServer() {
  mcpDebugger.info('Creating MCP server with config', mcpConfig);

  // Create MCP server instance
  const server = new Server(
    {
      name: mcpConfig.name,
      version: mcpConfig.version,
      instructions: mcpConfig.instructions
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // Initialize tool router
  const toolRouter = new ToolRouter();

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const tools = await getToolDefinitions(toolRouter);
      mcpDebugger.info(`Listed ${tools.length} available tools`);
      return { tools };
    } catch (error) {
      mcpDebugger.error('Error listing tools:', error);
      throw error;
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      // Validate request
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Invalid tool name: must be a non-empty string');
      }

      if (args !== null && args !== undefined && typeof args !== 'object') {
        throw new Error('Invalid arguments: must be an object, null, or undefined');
      }

      mcpDebugger.info(`Tool call: ${name}`, args);

      // Route the tool call
      return await toolRouter.route(name, args || {});
    } catch (error) {
      mcpDebugger.error(`Tool call failed for ${request.params?.name}:`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: request.params?.name
          }, null, 2)
        }]
      };
    }
  });

  // Register prompt handlers
  registerPromptHandlers(server);

  // Register resource handlers
  registerResourceHandlers(server);

  mcpDebugger.info('MCP server created and configured successfully');
  return server;
}

/**
 * Get tool definitions for the ListTools response
 */
async function getToolDefinitions(toolRouter) {
  // Core tools definitions
  const coreTools = [
    {
      name: 'tell',
      description: 'Store information in semantic memory (documents, interactions, content)',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Content to store' },
          type: { type: 'string', enum: ['interaction', 'document', 'concept'], default: 'interaction' },
          metadata: { type: 'object', description: 'Optional metadata' },
          lazy: { type: 'boolean', default: false, description: 'Store without immediate processing' },
          // Document upload fields
          fileUrl: { type: 'string', description: 'Data URL of uploaded file' },
          filename: { type: 'string', description: 'Original filename' },
          mediaType: { type: 'string', description: 'MIME type' },
          documentType: { type: 'string', enum: ['pdf', 'text', 'markdown'] },
          // SPARQL ingestion fields
          endpoint: { type: 'string', description: 'SPARQL endpoint URL' },
          template: { type: 'string', description: 'Query template name' },
          limit: { type: 'number', default: 50, description: 'Maximum documents to ingest' }
        },
        required: ['content']
      }
    },
    {
      name: 'ask',
      description: 'Query semantic memory and generate answers',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Question to ask' },
          mode: { type: 'string', enum: ['basic', 'standard', 'comprehensive'], default: 'standard' },
          useContext: { type: 'boolean', default: true, description: 'Use ZPT context' },
          useHyDE: { type: 'boolean', default: false, description: 'Use HyDE enhancement' },
          useWikipedia: { type: 'boolean', default: false, description: 'Include Wikipedia' },
          useWikidata: { type: 'boolean', default: false, description: 'Include Wikidata' },
          useWebSearch: { type: 'boolean', default: false, description: 'Include web search' },
          // Memory recall fields
          domains: { type: 'array', items: { type: 'string' }, description: 'Domain filters' },
          timeRange: { type: 'object', description: 'Temporal filters' },
          relevanceThreshold: { type: 'number', default: 0.1, description: 'Minimum relevance' },
          maxResults: { type: 'number', default: 10, description: 'Maximum results' }
        },
        required: ['question']
      }
    },
    {
      name: 'augment',
      description: 'Process and enhance data (concepts, embeddings, memory operations)',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['auto', 'extract_concepts', 'generate_embedding', 'remember', 'forget', 'fade', 'project_context'],
            default: 'auto',
            description: 'Augmentation operation to perform'
          },
          target: { type: 'string', default: 'all', description: 'Target for augmentation' },
          options: { type: 'object', description: 'Operation-specific options' },
          // Concept extraction
          text: { type: 'string', description: 'Text for concept extraction or embedding' },
          // Memory operations
          content: { type: 'string', description: 'Content to remember' },
          domain: { type: 'string', description: 'Memory domain' },
          importance: { type: 'number', min: 0, max: 1, description: 'Importance weighting' },
          // Project context
          projectId: { type: 'string', description: 'Project identifier' },
          action: { type: 'string', enum: ['create', 'switch', 'list', 'archive'], description: 'Project action' },
          // Fade operations
          fadeFactor: { type: 'number', min: 0, max: 1, description: 'Fade intensity' },
          transition: { type: 'string', enum: ['smooth', 'immediate'], description: 'Transition type' }
        }
      }
    },
    {
      name: 'zoom',
      description: 'Set navigation granularity level',
      inputSchema: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['micro', 'entity', 'text', 'unit', 'community', 'corpus'], description: 'Zoom level' },
          query: { type: 'string', description: 'Optional focus query' }
        },
        required: ['level']
      }
    },
    {
      name: 'pan',
      description: 'Set navigation domain filters',
      inputSchema: {
        type: 'object',
        properties: {
          domains: { type: 'array', items: { type: 'string' }, description: 'Domain filters' },
          keywords: { type: 'array', items: { type: 'string' }, description: 'Keyword filters' },
          entities: { type: 'array', items: { type: 'string' }, description: 'Entity filters' },
          corpuscle: { type: 'array', items: { type: 'string' }, description: 'Corpuscle filters' },
          temporal: { type: 'object', description: 'Temporal filter with start/end' }
        }
      }
    },
    {
      name: 'tilt',
      description: 'Set navigation perspective style',
      inputSchema: {
        type: 'object',
        properties: {
          style: { type: 'string', enum: ['keywords', 'embedding', 'graph', 'temporal'], description: 'View style' },
          query: { type: 'string', description: 'Optional focus query' }
        },
        required: ['style']
      }
    },
    {
      name: 'inspect',
      description: 'Inspect system state and components',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['system', 'session', 'concept', 'memory'], default: 'system' },
          target: { type: 'string', description: 'Specific target to inspect' },
          includeRecommendations: { type: 'boolean', default: false, description: 'Include recommendations' }
        }
      }
    }
  ];

  // TODO: Add module-specific tools from the router
  // const moduleTools = await toolRouter.getAvailableTools();

  return coreTools;
}
