/**
 * MCP (Model Context Protocol) Module
 * Barrel file exporting all MCP functionality for npm package consumption
 */

// Core MCP server functionality
export { createServer } from './index.js';

// Workflow orchestrator
export { workflowOrchestrator } from './lib/workflow-orchestrator.js';

// Configuration
export { mcpConfig } from './lib/config.js';

// Utilities and debugging
export { mcpDebugger } from './lib/debug-utils.js';
export { initializeServices } from './lib/initialization.js';
export { SafeOperations } from './lib/safe-operations.js';

// Prompt system
export { 
  initializePromptRegistry, 
  promptRegistry 
} from './prompts/registry.js';
export { 
  executePromptWorkflow, 
  createSafeToolExecutor, 
  validateExecutionPrerequisites 
} from './prompts/utils.js';

// Tool registration functions
export { registerZPTTools } from './tools/zpt-tools.js';
export { registerResearchWorkflowTools } from './tools/research-workflow-tools.js';
export { registerRagnoTools } from './tools/ragno-tools.js';
export { registerSPARQLTools } from './tools/sparql-tools.js';
export { registerVSOMTools } from './tools/vsom-tools.js';

// Resource registration functions
export { registerStatusResources } from './resources/status-resource.js';
export { registerStatusResourcesHttp } from './resources/status-resource-http.js';

// Individual prompt templates (for custom workflows)
export { enhancedResearchWorkflow } from './prompts/templates/integrated/enhanced-research-workflow.js';
export { intelligentQAWorkflow } from './prompts/templates/integrated/intelligent-qa-workflow.js';