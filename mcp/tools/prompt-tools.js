/**
 * Prompt workflow tools - expose MCP Prompts as regular MCP tools
 * This allows clients to use prompt workflows through the standard tools interface
 */
import { z } from 'zod';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { mcpDebugger } from '../lib/debug-utils.js';
import { promptRegistry } from '../prompts/registry.js';
import { executePromptWorkflow, createSafeToolExecutor, validateExecutionPrerequisites } from '../prompts/utils.js';

// Tool definitions for MCP
export const PROMPT_TOOLS = [
  {
    name: "prompt_list",
    description: "List all available MCP prompt workflows",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category filter (memory, ragno, zpt, integrated)"
        }
      }
    }
  },
  {
    name: "prompt_get", 
    description: "Get detailed information about a specific prompt workflow",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the prompt to retrieve"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "prompt_execute",
    description: "Execute a prompt workflow with the specified arguments",
    inputSchema: {
      type: "object", 
      properties: {
        name: {
          type: "string",
          description: "Name of the prompt to execute"
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the prompt workflow",
          additionalProperties: true
        }
      },
      required: ["name"]
    }
  }
];

/**
 * Categorize prompt by name for display purposes
 */
function categorizePrompt(name) {
  if (name.startsWith('semem-')) return 'Memory Workflows';
  if (name.startsWith('ragno-')) return 'Knowledge Graph';
  if (name.startsWith('zpt-')) return '3D Navigation';
  return 'Integrated Workflows';
}

/**
 * Execute a prompt-related tool
 */
export async function executePromptTool(toolName, args, server) {
  try {
    if (toolName === "prompt_list") {
      const { category } = args || {};
      
      const prompts = promptRegistry.listPrompts();
      mcpDebugger.info(`Listed ${prompts.length} available prompts`);
      
      let filteredPrompts = prompts;
      if (category) {
        filteredPrompts = prompts.filter(prompt => 
          categorizePrompt(prompt.name).toLowerCase().includes(category.toLowerCase())
        );
      }
      
      const categories = {};
      filteredPrompts.forEach(prompt => {
        const cat = categorizePrompt(prompt.name);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments.length,
          requiredArgs: prompt.arguments.filter(a => a.required).length
        });
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            totalPrompts: prompts.length,
            filteredPrompts: filteredPrompts.length,
            categories,
            availableCategories: ["memory", "ragno", "zpt", "integrated"]
          }, null, 2)
        }]
      };
    }

    if (toolName === "prompt_get") {
      const { name: promptName } = args || {};
      
      if (!promptName) {
        throw new Error('Prompt name is required');
      }

      const prompt = promptRegistry.getPrompt(promptName);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptName}`);
      }

      mcpDebugger.info(`Retrieved prompt: ${promptName}`);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            prompt: {
              name: prompt.name,
              description: prompt.description,
              category: categorizePrompt(prompt.name),
              arguments: prompt.arguments,
              workflow: prompt.workflow.map(step => ({
                tool: step.tool,
                arguments: step.arguments,
                condition: step.condition,
                description: step.description || `Execute ${step.tool} tool`
              })),
              examples: prompt.examples || []
            }
          }, null, 2)
        }]
      };
    }

    if (toolName === "prompt_execute") {
      const { name: promptName, arguments: promptArgs = {} } = args || {};
      
      if (!promptName) {
        throw new Error('Prompt name is required');
      }

      const prompt = promptRegistry.getPrompt(promptName);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptName}`);
      }

      const toolExecutor = createSafeToolExecutor(server);

      mcpDebugger.info(`Executing prompt: ${promptName}`, { arguments: promptArgs });
      const result = await executePromptWorkflow(prompt, promptArgs, toolExecutor);

      mcpDebugger.info(`Prompt execution completed: ${promptName}`, { 
        success: result.success,
        steps: result.results.length 
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: result.success,
            promptName: promptName,
            executionId: result.executionId,
            steps: result.results.length,
            results: result.results,
            summary: result.summary,
            error: result.error,
            partialCompletion: result.partialCompletion
          }, null, 2)
        }]
      };
    }

    throw new Error(`Unknown prompt tool: ${toolName}`);
    
  } catch (error) {
    mcpDebugger.error(`Prompt tool ${toolName} failed`, {
      error: error.message,
      stack: error.stack
    });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error.message,
          tool: toolName
        }, null, 2)
      }]
    };
  }
}