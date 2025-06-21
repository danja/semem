#!/usr/bin/env node

/**
 * Semem MCP Integration Server
 * Modular ES6 implementation with enhanced debugging
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

// Import debugging utilities
import { mcpDebugger } from './lib/debug-utils.js';

// Import configuration
import { mcpConfig } from './lib/config.js';
import { initializeServices } from './lib/initialization.js';

// Import tool registrations
import { registerMemoryTools } from './tools/memory-tools.js';
import { registerMemoryToolsHttp } from './tools/memory-tools-http.js';
// import { registerPromptTools } from './tools/prompt-tools.js';

// Import resource registrations  
import { registerStatusResources } from './resources/status-resource.js';
import { registerStatusResourcesHttp } from './resources/status-resource-http.js';

// Import prompt system
import { initializePromptRegistry, promptRegistry } from './prompts/registry.js';
import { executePromptWorkflow, createSafeToolExecutor, validateExecutionPrerequisites } from './prompts/utils.js';

// Import enhanced workflow orchestrator
import { workflowOrchestrator } from './lib/workflow-orchestrator.js';

/**
 * Register MCP prompt handlers
 */
function registerPromptHandlers(server) {
  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      const prompts = promptRegistry.listPrompts();
      mcpDebugger.info(`Listed ${prompts.length} available prompts`);
      
      return {
        prompts: prompts.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments.map(arg => ({
            name: arg.name,
            description: arg.description,
            required: arg.required,
            type: arg.type,
            default: arg.default
          }))
        }))
      };
    } catch (error) {
      mcpDebugger.error('Error listing prompts:', error);
      throw error;
    }
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      const { name } = request.params;
      if (!name) {
        throw new Error('Prompt name is required');
      }

      const prompt = promptRegistry.getPrompt(name);
      if (!prompt) {
        throw new Error(`Prompt not found: ${name}`);
      }

      mcpDebugger.info(`Retrieved prompt: ${name}`);
      return {
        prompt: {
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
          workflow: prompt.workflow.map(step => ({
            tool: step.tool,
            arguments: step.arguments,
            condition: step.condition
          }))
        }
      };
    } catch (error) {
      mcpDebugger.error('Error getting prompt:', error);
      throw error;
    }
  });

  mcpDebugger.info('Prompt handlers registered successfully');
}

/**
 * Create and configure MCP server
 */
async function createServer() {
  mcpDebugger.info('Creating MCP server with config', mcpConfig);
  
  // Create MCP server instance using HTTP version pattern
  const server = new Server(mcpConfig, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  // Temporarily disable debugging wrapper to fix prompt registration
  // const originalSetRequestHandler = server.setRequestHandler;
  // server.setRequestHandler = function(schema, handler) {
  //   const wrappedHandler = async (request) => {
  //     mcpDebugger.logProtocolMessage('incoming', request.method, request.params);
  //     try {
  //       const result = await handler(request);
  //       mcpDebugger.logProtocolMessage('outgoing', request.method, null, result);
  //       return result;
  //     } catch (error) {
  //       mcpDebugger.logProtocolMessage('outgoing', request.method, null, null, error);
  //       throw error;
  //     }
  //   };
  //   return originalSetRequestHandler.call(this, schema, wrappedHandler);
  // };

  // Initialize services
  mcpDebugger.info('Initializing services...');
  await initializeServices();
  mcpDebugger.info('Services initialized successfully');

  // Initialize prompt registry
  mcpDebugger.info('Initializing prompt registry...');
  await initializePromptRegistry();
  mcpDebugger.info('Prompt registry initialized successfully');

  // Initialize enhanced workflow orchestrator
  mcpDebugger.info('Initializing enhanced workflow orchestrator...');
  await workflowOrchestrator.initialize(server);
  mcpDebugger.info('Enhanced workflow orchestrator initialized successfully');

  // Register all tools using HTTP pattern
  mcpDebugger.info('Registering memory tools...');
  
  // Choose which tools to register based on environment
  if (process.env.MCP_USE_HTTP_TOOLS !== 'false') {
    registerMemoryToolsHttp(server);
  } else {
    registerMemoryTools(server);
  }

  // Register all resources using HTTP pattern  
  mcpDebugger.info('Registering status resources...');
  if (process.env.MCP_USE_HTTP_TOOLS !== 'false') {
    registerStatusResourcesHttp(server);
  } else {
    registerStatusResources(server);
  }

  // Register prompt handlers
  mcpDebugger.info('Registering prompt handlers...');
  registerPromptHandlers(server);

  mcpDebugger.info('MCP server creation complete');
  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    mcpDebugger.info('🚀 Starting Semem MCP Integration Server...');

    // Create server
    const server = await createServer();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    mcpDebugger.info('✅ Semem MCP server running on stdio transport');

  } catch (error) {
    mcpDebugger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createServer };