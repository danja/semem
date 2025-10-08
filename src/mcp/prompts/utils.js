/**
 * MCP Prompt Utilities - Helper functions for prompt execution and validation
 * 
 * This module provides utilities for validating prompt arguments, executing
 * workflow steps, and managing prompt execution context.
 */

import logger from 'loglevel';
import { workflowOrchestrator } from '../lib/workflow-orchestrator.js';

/**
 * Validate prompt arguments against the prompt template
 */
export function validatePromptArguments(prompt, providedArgs) {
  const errors = [];
  const processedArgs = {};

  // Check required arguments
  for (const argDef of prompt.arguments) {
    const value = providedArgs[argDef.name];

    if (argDef.required && (value === undefined || value === null)) {
      errors.push(`Required argument '${argDef.name}' is missing`);
      continue;
    }

    // Use default value if not provided
    if (value === undefined && argDef.default !== undefined) {
      processedArgs[argDef.name] = argDef.default;
      continue;
    }

    // Validate type if value is provided
    if (value !== undefined) {
      const validationError = validateArgumentType(argDef, value);
      if (validationError) {
        errors.push(`Argument '${argDef.name}': ${validationError}`);
        continue;
      }
      processedArgs[argDef.name] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    processedArgs
  };
}

/**
 * Validate argument type against expected type
 */
function validateArgumentType(argDef, value) {
  const { type, name } = argDef;

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Expected string, got ${typeof value}`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Expected number, got ${typeof value}`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Expected boolean, got ${typeof value}`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `Expected array, got ${typeof value}`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        return `Expected object, got ${typeof value}`;
      }
      break;

    default:
      logger.warn(`Unknown argument type: ${type} for argument: ${name}`);
  }

  return null;
}

/**
 * Execute a prompt workflow with the provided arguments
 */
export async function executePromptWorkflow(prompt, args, toolExecutor) {
  logger.info(`Executing prompt workflow: ${prompt.name}`);
  
  const validation = validatePromptArguments(prompt, args);
  if (!validation.valid) {
    throw new Error(`Argument validation failed: ${validation.errors.join(', ')}`);
  }

  // Use enhanced orchestrator for version 2.0 workflows
  if (prompt.version === '2.0' || prompt.features) {
    logger.info(`Using enhanced orchestrator for workflow: ${prompt.name}`);
    try {
      const orchestratorResult = await workflowOrchestrator.executeWorkflow(
        prompt.name, 
        validation.processedArgs, 
        toolExecutor
      );
      
      if (orchestratorResult.toolExecutor) {
        // Use the enhanced tool executor
        toolExecutor = orchestratorResult.toolExecutor;
      }
    } catch (error) {
      logger.warn(`Enhanced orchestrator failed, falling back to standard execution: ${error.message}`);
    }
  }

  const results = [];
  const context = {
    promptName: prompt.name,
    arguments: validation.processedArgs,
    stepResults: {},
    executionId: generateExecutionId()
  };

  try {
    for (let i = 0; i < prompt.workflow.length; i++) {
      const step = prompt.workflow[i];
      logger.debug(`Executing workflow step ${i + 1}/${prompt.workflow.length}: ${step.tool}`);

      // Check step condition if present
      if (step.condition && !evaluateCondition(step.condition, context)) {
        logger.debug(`Skipping step ${i + 1} - condition not met: ${step.condition}`);
        continue;
      }

      // Resolve step arguments with context
      const resolvedArgs = resolveStepArguments(step.arguments, context);
      
      // Execute the tool
      const stepResult = await executeWorkflowStep(step.tool, resolvedArgs, toolExecutor, context);
      
      // Store result for future steps
      context.stepResults[`step_${i}`] = stepResult;
      context.stepResults[step.tool] = stepResult;
      
      results.push({
        step: i + 1,
        tool: step.tool,
        arguments: resolvedArgs,
        result: stepResult,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Prompt workflow completed successfully: ${prompt.name}`);
    return {
      success: true,
      promptName: prompt.name,
      executionId: context.executionId,
      results,
      summary: generateWorkflowSummary(results)
    };

  } catch (error) {
    logger.error(`Prompt workflow failed: ${prompt.name}`, error);
    return {
      success: false,
      promptName: prompt.name,
      executionId: context.executionId,
      error: error.message,
      results,
      partialCompletion: results.length > 0
    };
  }
}

/**
 * Execute a single workflow step
 */
async function executeWorkflowStep(toolName, arguments_, toolExecutor, context) {
  try {
    if (typeof toolExecutor !== 'function') {
      throw new Error('Tool executor must be a function');
    }

    const result = await toolExecutor(toolName, arguments_, context);
    logger.debug(`Step executed successfully: ${toolName}`);
    return result;

  } catch (error) {
    logger.error(`Step execution failed: ${toolName}`, error);
    throw new Error(`Tool '${toolName}' execution failed: ${error.message}`);
  }
}

/**
 * Resolve step arguments by substituting variables from context
 */
function resolveStepArguments(stepArgs, context) {
  if (!stepArgs || typeof stepArgs !== 'object') {
    return stepArgs;
  }

  const resolved = {};
  
  for (const [key, value] of Object.entries(stepArgs)) {
    resolved[key] = resolveValue(value, context);
  }

  return resolved;
}

/**
 * Resolve a value by substituting variables from context
 */
function resolveValue(value, context) {
  if (typeof value === 'string') {
    // Handle variable substitution: ${variable_name}
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // First check prompt arguments
      if (context.arguments && varName in context.arguments) {
        return context.arguments[varName];
      }
      
      // Then check step results
      if (context.stepResults && varName in context.stepResults) {
        return JSON.stringify(context.stepResults[varName]);
      }
      
      // Handle special cases
      if (varName === 'executionId') {
        return context.executionId;
      }
      
      // Return placeholder if not found
      logger.warn(`Variable not found in context: ${varName}`);
      return match;
    });
  }
  
  if (Array.isArray(value)) {
    return value.map(item => resolveValue(item, context));
  }
  
  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, context);
    }
    return resolved;
  }
  
  return value;
}

/**
 * Evaluate a workflow step condition
 */
function evaluateCondition(condition, context) {
  try {
    // Simple condition evaluation for now
    // Example: "memory in pipeline_stages"
    if (condition.includes(' in ')) {
      const [item, arrayName] = condition.split(' in ').map(s => s.trim());
      const array = context.arguments[arrayName];
      return Array.isArray(array) && array.includes(item);
    }
    
    // Add more condition types as needed
    logger.warn(`Unknown condition format: ${condition}`);
    return true;
    
  } catch (error) {
    logger.error(`Error evaluating condition: ${condition}`, error);
    return false;
  }
}

/**
 * Generate a unique execution ID
 */
function generateExecutionId() {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a workflow execution summary
 */
function generateWorkflowSummary(results) {
  const totalSteps = results.length;
  const successfulSteps = results.filter(r => r.result !== null && r.result !== undefined).length;
  const tools = [...new Set(results.map(r => r.tool))];
  
  return {
    totalSteps,
    successfulSteps,
    toolsUsed: tools,
    executionTime: results.length > 0 ? 
      new Date(results[results.length - 1].timestamp) - new Date(results[0].timestamp) : 0
  };
}

/**
 * Create a safe tool executor wrapper that handles errors
 */
export function createSafeToolExecutor(mcpServer) {
  return async function safeToolExecutor(toolName, arguments_, context) {
    try {
      logger.debug(`Attempting to execute tool: ${toolName}`, { 
        arguments: Object.keys(arguments_ || {}),
        mcpServerType: typeof mcpServer 
      });

      // New MCP SDK pattern - call tool through the server
      if (mcpServer && typeof mcpServer.callTool === 'function') {
        const result = await mcpServer.callTool({
          name: toolName,
          arguments: arguments_
        });
        
        logger.debug(`Tool executed via callTool: ${toolName}`, { 
          resultType: typeof result 
        });
        
        // Extract content from MCP result format
        if (result && result.content && result.content[0] && result.content[0].text) {
          try {
            return JSON.parse(result.content[0].text);
          } catch (parseError) {
            // Return as-is if not JSON
            return result.content[0].text;
          }
        }
        
        return result;
      }

      // Fallback: check old pattern
      if (mcpServer.tools && mcpServer.tools[toolName]) {
        const tool = mcpServer.tools[toolName];
        const result = await tool.handler(arguments_);
        
        logger.debug(`Tool executed via old pattern: ${toolName}`, { 
          resultType: typeof result 
        });
        
        return result;
      }

      // If neither pattern works, try the workflow orchestrator
      if (workflowOrchestrator && workflowOrchestrator.isInitialized) {
        logger.debug(`Attempting tool execution via workflow orchestrator: ${toolName}`);
        
        // Map tool names to orchestrator methods
        const methodMap = {
          'research_ingest_documents': 'researchIngestDocuments',
          'research_generate_insights': 'researchGenerateInsights',
          'adaptive_query_processing': 'adaptiveQueryProcessing',
          'hybrid_search': 'hybridSearch',
          'capture_user_feedback': 'captureUserFeedback',
          'incremental_learning': 'incrementalLearning'
        };
        
        const methodName = methodMap[toolName];
        if (methodName && typeof workflowOrchestrator[methodName] === 'function') {
          const result = await workflowOrchestrator[methodName](arguments_, context);
          
          logger.debug(`Tool executed via workflow orchestrator: ${toolName}`, { 
            resultType: typeof result 
          });
          
          return result;
        }
      }

      throw new Error(`Tool not found: ${toolName}`);

    } catch (error) {
      logger.error(`Tool execution error: ${toolName}`, error);
      throw error;
    }
  };
}

/**
 * Validate prompt execution prerequisites
 */
export function validateExecutionPrerequisites(prompt, mcpServer) {
  const errors = [];
  
  // Tool name mapping - matches workflow-orchestrator.js TOOL_MAPPING
  const TOOL_MAPPING = {
    // Memory tools
    'semem_store_interaction': 'tell',
    'semem_retrieve_memories': 'ask', 
    'semem_generate_response': 'ask',
    'semem_generate_embedding': 'augment',
    'semem_extract_concepts': 'augment',
    
    // Ragno tools
    'ragno_decompose_corpus': 'augment',
    'ragno_search_dual': 'ask',
    'ragno_get_entities': 'augment',
    'ragno_vector_search': 'augment',
    'ragno_export_rdf': 'augment',
    'ragno_query_sparql': 'ask',
    'ragno_analyze_graph': 'augment',
    
    // Workflow aliases
    'ragno_build_relationships': 'augment',
    'ragno_extract_entities': 'augment',
    
    // Custom workflow tools (implemented by orchestrator)
    'research_ingest_documents': 'research_ingest_documents',
    'research_generate_insights': 'research_generate_insights',
    'adaptive_query_processing': 'adaptive_query_processing',
    'hybrid_search': 'hybrid_search',
    'capture_user_feedback': 'capture_user_feedback',
    'incremental_learning': 'incremental_learning'
  };

  // Custom workflow tools that are implemented by the orchestrator
  const CUSTOM_TOOLS = [
    'research_ingest_documents', 
    'research_generate_insights',
    'adaptive_query_processing',
    'hybrid_search', 
    'capture_user_feedback',
    'incremental_learning'
  ];
  
  // Check if all required tools are available
  for (const step of prompt.workflow) {
    const mappedTool = TOOL_MAPPING[step.tool] || step.tool;
    
    // For custom tools, assume they're available (implemented by orchestrator)
    if (CUSTOM_TOOLS.includes(mappedTool)) {
      continue;
    }
    
    // For MCP tools, check if they're registered
    // The tools are registered by name in the tools list, not with mcp__ prefix
    const toolExists = mcpServer.tools && mcpServer.tools.some(tool => tool.name === mappedTool);
    
    if (!toolExists) {
      errors.push(`Required tool not available: ${step.tool}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get prompt execution statistics
 */
export function getPromptStats(prompt) {
  return {
    name: prompt.name,
    argumentCount: prompt.arguments.length,
    requiredArguments: prompt.arguments.filter(arg => arg.required).length,
    optionalArguments: prompt.arguments.filter(arg => !arg.required).length,
    workflowSteps: prompt.workflow.length,
    toolsUsed: [...new Set(prompt.workflow.map(step => step.tool))],
    hasConditions: prompt.workflow.some(step => step.condition)
  };
}

/**
 * Create prompt execution context
 */
export function createExecutionContext(promptName, args) {
  return {
    promptName,
    arguments: args,
    stepResults: {},
    executionId: generateExecutionId(),
    startTime: new Date().toISOString(),
    metadata: {}
  };
}

/**
 * Log prompt execution metrics
 */
export function logExecutionMetrics(result) {
  const metrics = {
    promptName: result.promptName,
    executionId: result.executionId,
    success: result.success,
    stepCount: result.results.length,
    duration: result.summary?.executionTime || 0
  };
  
  logger.info('Prompt execution metrics:', metrics);
  return metrics;
}