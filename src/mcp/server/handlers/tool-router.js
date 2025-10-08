/**
 * Unified Tool Router
 * Replaces the massive if-else chain with clean routing to core tools and modules
 */

import { SimpleVerbsService } from '../../tools/SimpleVerbsService.js';
import { mcpDebugger } from '../../lib/debug-utils.js';

export class ToolRouter {
  constructor() {
    this.coreTools = new SimpleVerbsService();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.coreTools.initialize?.();
    this.initialized = true;
    mcpDebugger.info('ToolRouter initialized with core verb tools only');
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
      'chat': { tool: 'ask', transform: this.transformChatArgs },
      'chat-enhanced': { tool: 'ask', transform: this.transformEnhancedChatArgs }
    };

    const mapping = deprecatedMappings[toolName];
    if (mapping) {
      mcpDebugger.warn(`Redirecting deprecated tool ${toolName} to ${mapping.tool}`);
     const transformedArgs = mapping.transform ? mapping.transform(args) : args;
     return await this.coreTools.execute(mapping.tool, transformedArgs);
   }

    return null;
  }

  // Argument transformation functions for deprecated tools
  transformChatArgs(args) {
    const message = args?.message || args?.question;
    if (!message || typeof message !== 'string') {
      throw new Error('Chat message is required');
    }
    return {
      question: message,
      mode: 'standard',
      useContext: true
    };
  }

  transformEnhancedChatArgs(args) {
    const query = args?.query || args?.message;
    if (!query || typeof query !== 'string') {
      throw new Error('Enhanced chat query is required');
    }
    return {
      question: query,
      mode: 'comprehensive',
      useContext: true,
      useHyDE: !!args?.useHyDE,
      useWikipedia: !!args?.useWikipedia,
      useWikidata: !!args?.useWikidata,
      useWebSearch: !!args?.useWebSearch
    };
  }

  /**
   * Get list of all available tools
   */
  async getAvailableTools() {
    await this.initialize();

    return this.coreTools.coreToolNames.map(name => ({
      name,
      type: 'core',
      description: this.getCoreToolDescription(name)
    }));
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
