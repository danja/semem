/**
 * HTTP-Only MCP Server Creation
 * This creates an MCP server specifically for HTTP transport without stdio dependencies
 */

import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpDebugger } from './lib/debug-utils.js';
import { mcpConfig } from './lib/config.js';

// Import centralized handlers from main server
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import resource registrations  
import { registerStatusResources } from './resources/status-resource.js';
import { registerZPTResources } from './resources/zpt-resources.js';

// Import prompt system
import { initializePromptRegistry, promptRegistry } from './prompts/registry.js';

/**
 * Create MCP server for HTTP transport
 */
export async function createHttpServer() {
  mcpDebugger.info('Creating MCP server for HTTP transport');
  
  // Create MCP server instance
  const server = new Server({
    name: mcpConfig.name,
    version: mcpConfig.version,
    instructions: mcpConfig.instructions,
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  // Services will be initialized lazily when tools are called
  mcpDebugger.info('Services will be initialized when first tool is called...');

  // Skip prompt registry initialization for now
  mcpDebugger.info('Skipping prompt registry initialization for HTTP server...');

  // Skip tool registration for HTTP-only server - tools removed in cleanup
  mcpDebugger.info('Skipping tool registration for HTTP-only server...');
  // Memory tools have been deprecated in favor of Simple Verbs interface

  // Register all resources
  mcpDebugger.info('Registering status resources...');
  try {
    registerStatusResources(server);
    registerZPTResources(server);
    mcpDebugger.info('All resources registered.');
  } catch (error) {
    mcpDebugger.warn('Resource registration failed, continuing without some resources:', error.message);
  }

  // Skip prompt tools and prompts for now
  mcpDebugger.info('Skipping prompt tools and prompts for HTTP server...');

  mcpDebugger.info('HTTP MCP server creation complete');
  return server;
}