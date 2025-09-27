/**
 * MCP Prompt Handlers
 * Extracted from index.js for better organization
 */

import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { mcpDebugger } from '../../lib/debug-utils.js';
import { initializePromptRegistry, promptRegistry } from '../../prompts/registry.js';
import { executePromptWorkflow } from '../../prompts/utils.js';

export function registerPromptHandlers(server) {
  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      // Ensure prompt registry is initialized
      if (!promptRegistry.initialized) {
        await initializePromptRegistry();
      }
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
      // Ensure prompt registry is initialized
      if (!promptRegistry.initialized) {
        await initializePromptRegistry();
      }

      const { name, arguments: args } = request.params;

      mcpDebugger.info(`Getting prompt: ${name}`, args);

      const prompt = promptRegistry.getPrompt(name);
      if (!prompt) {
        throw new Error(`Prompt not found: ${name}`);
      }

      // Execute prompt workflow to get the formatted prompt
      const result = await executePromptWorkflow(name, args || {});

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: result.formattedPrompt || result.content || 'No content generated'
            }
          }
        ]
      };
    } catch (error) {
      mcpDebugger.error('Error getting prompt:', error);
      throw error;
    }
  });

  mcpDebugger.info('Prompt handlers registered successfully');
}