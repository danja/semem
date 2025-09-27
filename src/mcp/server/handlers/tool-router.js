/**
 * Unified Tool Router
 * Replaces the massive if-else chain with clean routing to core tools and modules
 */

import { SimpleVerbsService } from '../../tools/SimpleVerbsService.js';
import { mcpDebugger } from '../../lib/debug-utils.js';

export class ToolRouter {
  constructor() {
    this.coreTools = new SimpleVerbsService();
    this.modules = new Map();
    this.initialized = false;
  }

  /**
   * Initialize and register all tool modules
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Register SPARQL tools module
      const { default: sparqlModule } = await import('../../tools/modules/sparql-tools.js');
      this.modules.set('sparql_', sparqlModule);

      // Register Ragno tools module
      const { default: ragnoModule } = await import('../../tools/modules/ragno-tools.js');
      this.modules.set('ragno_', ragnoModule);

      // Register ZPT tools module
      const { default: zptModule } = await import('../../tools/modules/zpt-tools.js');
      this.modules.set('zpt_', zptModule);

      // Register VSOM tools module
      const { default: vsomModule } = await import('../../tools/modules/vsom-tools.js');
      this.modules.set('vsom_', vsomModule);

      // Register Research Workflow tools module
      const { default: researchModule } = await import('../../tools/modules/research-workflow-tools.js');
      this.modules.set('research_', researchModule);

      this.initialized = true;
      mcpDebugger.info('ToolRouter initialized with all modules');
    } catch (error) {
      mcpDebugger.error('Failed to initialize ToolRouter:', error);
      throw error;
    }
  }

  /**
   * Route tool call to appropriate handler
   */
  async route(toolName, args) {
    await this.initialize();

    try {
      // Route to core tools first (highest priority)
      if (this.coreTools.handles(toolName)) {
        mcpDebugger.debug(`Routing ${toolName} to core tools`);
        return await this.coreTools.execute(toolName, args);
      }

      // Route to specialized modules based on prefix
      for (const [prefix, module] of this.modules) {
        if (toolName.startsWith(prefix)) {
          mcpDebugger.debug(`Routing ${toolName} to ${prefix} module`);
          return await module.execute(toolName, args);
        }
      }

      // Handle legacy tools that don't fit the prefix pattern
      const legacyResult = await this.handleLegacyTool(toolName, args);
      if (legacyResult) {
        return legacyResult;
      }

      // Tool not found
      throw new Error(`Unknown tool: ${toolName}. Available core tools: ${this.coreTools.coreToolNames.join(', ')}`);

    } catch (error) {
      mcpDebugger.error(`Tool routing failed for ${toolName}:`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            tool: toolName
          }, null, 2)
        }]
      };
    }
  }

  /**
   * Handle legacy tools that don't follow the module prefix pattern
   */
  async handleLegacyTool(toolName, args) {
    // Handle deprecated tools by redirecting to core tools
    const deprecatedMappings = {
      'semem_store_interaction': { tool: 'tell', transform: this.transformInteractionArgs },
      'semem_retrieve_memories': { tool: 'ask', transform: this.transformRetrievalArgs },
      'semem_answer': { tool: 'ask', transform: this.transformAnswerArgs },
      'semem_ask': { tool: 'ask', transform: this.transformAskArgs },
      'semem_extract_concepts': { tool: 'augment', transform: this.transformConceptArgs },
      'semem_generate_embedding': { tool: 'augment', transform: this.transformEmbeddingArgs },
      'remember': { tool: 'augment', transform: this.transformRememberArgs },
      'forget': { tool: 'augment', transform: this.transformForgetArgs },
      'fade_memory': { tool: 'augment', transform: this.transformFadeArgs },
      'recall': { tool: 'ask', transform: this.transformRecallArgs },
      'project_context': { tool: 'augment', transform: this.transformProjectArgs },
      'uploadDocument': { tool: 'tell', transform: this.transformDocumentArgs }
    };

    const mapping = deprecatedMappings[toolName];
    if (mapping) {
      mcpDebugger.info(`Redirecting deprecated tool ${toolName} to ${mapping.tool}`);
      const transformedArgs = mapping.transform ? mapping.transform(args) : args;
      return await this.coreTools.execute(mapping.tool, transformedArgs);
    }

    return null;
  }

  // Argument transformation functions for deprecated tools
  transformInteractionArgs(args) {
    return { ...args, content: `${args.prompt}\n\nResponse: ${args.response}` };
  }

  transformRetrievalArgs(args) {
    return { question: args.query, ...args };
  }

  transformAnswerArgs(args) {
    return { question: args.question, mode: args.mode || 'comprehensive', ...args };
  }

  transformAskArgs(args) {
    return { question: args.question, ...args };
  }

  transformConceptArgs(args) {
    return { operation: 'extract_concepts', text: args.text, ...args };
  }

  transformEmbeddingArgs(args) {
    return { operation: 'generate_embedding', text: args.text, options: { embedding: true }, ...args };
  }

  transformRememberArgs(args) {
    return { operation: 'remember', content: args.content, ...args };
  }

  transformForgetArgs(args) {
    return { operation: 'forget', target: args.target, ...args };
  }

  transformFadeArgs(args) {
    return { operation: 'fade', ...args };
  }

  transformRecallArgs(args) {
    return { question: args.query, ...args };
  }

  transformProjectArgs(args) {
    return { operation: 'project_context', ...args };
  }

  transformDocumentArgs(args) {
    return { content: 'Document upload', ...args };
  }

  /**
   * Get list of all available tools
   */
  async getAvailableTools() {
    await this.initialize();

    const tools = [
      // Core tools
      ...this.coreTools.coreToolNames.map(name => ({
        name,
        type: 'core',
        description: this.getCoreToolDescription(name)
      }))
    ];

    // Add module tools
    for (const [prefix, module] of this.modules) {
      if (module.getToolNames) {
        const moduleTools = await module.getToolNames();
        tools.push(...moduleTools.map(name => ({
          name,
          type: 'module',
          module: prefix.replace('_', ''),
          description: `${prefix.replace('_', '')} module tool`
        })));
      }
    }

    return tools;
  }

  getCoreToolDescription(toolName) {
    const descriptions = {
      'tell': 'Store information in semantic memory (documents, interactions, content)',
      'ask': 'Query semantic memory and generate answers',
      'augment': 'Process and enhance data (concepts, embeddings, memory operations)',
      'zoom': 'Set navigation granularity level',
      'pan': 'Set navigation domain filters',
      'tilt': 'Set navigation perspective style',
      'inspect': 'Inspect system state and components'
    };
    return descriptions[toolName] || 'Core tool';
  }
}