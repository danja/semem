/**
 * SimpleVerbsService (Refactored) - Clean coordinator using Command Pattern
 *
 * Transformed from 2,646-line monolith with switch statements into a slim
 * coordinator that delegates to focused command classes via registry pattern.
 */

import { VerbCommandRegistry } from './verbs/VerbCommandRegistry.js';
import { verbsLogger } from './VerbsLogger.js';

/**
 * Refactored SimpleVerbsService - Now a clean coordinator (~200 lines vs 2,646 lines)
 */
export class SimpleVerbsService {
  constructor() {
    this.registry = new VerbCommandRegistry();
    this.initialized = false;

    // Core tool names for router interface compatibility
    this.coreToolNames = ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt', 'inspect', 'remember', 'forget', 'recall', 'project_context', 'fade_memory'];
  }

  /**
   * Initialize the service and command registry
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    verbsLogger.info('🔥 SimpleVerbsService.initialize() - Using refactored command registry');

    try {
      await this.registry.initialize();
      this.initialized = true;

      verbsLogger.info('✅ SimpleVerbsService initialized with command registry', {
        supportedVerbs: this.registry.getSupportedVerbs(),
        commandCount: this.registry.commands.size
      });

    } catch (error) {
      verbsLogger.error('❌ SimpleVerbsService initialization failed:', error.message);
      throw new Error(`Failed to initialize SimpleVerbsService: ${error.message}`);
    }
  }

  /**
   * Check if a tool/verb is handled by this service
   * @param {string} toolName - The tool/verb name
   * @returns {boolean} Whether the tool is supported
   */
  handles(toolName) {
    return this.coreToolNames.includes(toolName);
  }

  /**
   * Execute a verb command - MAIN ENTRY POINT (replaces 150+ line switch statement)
   * @param {string} toolName - The verb to execute
   * @param {Object} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async execute(toolName, args) {
    await this.initialize();

    verbsLogger.debug('🎯 SimpleVerbsService.execute() called', {
      toolName,
      hasArgs: !!args && Object.keys(args).length > 0,
      argKeys: args ? Object.keys(args) : []
    });

    try {
      // Validate tool name
      if (!this.handles(toolName)) {
        throw new Error(`Unsupported tool: ${toolName}. Supported tools: ${this.coreToolNames.join(', ')}`);
      }

      // Delegate to registry - this replaces the entire switch statement!
      const result = await this.registry.execute(toolName, args);

      verbsLogger.debug('✅ Command execution completed', {
        toolName,
        success: result.success,
        verb: result.verb
      });

      return result;

    } catch (error) {
      verbsLogger.error(`❌ Command execution failed for ${toolName}:`, error.message);

      // Return standardized error response
      return {
        success: false,
        verb: toolName,
        error: error.message,
        args: args ? Object.keys(args) : [],
        timestamp: new Date().toISOString()
      };
    }
  }

  // ====== PUBLIC API METHODS ======
  // Convenience methods for direct verb invocation
  // All delegate to the command registry via execute()

  /**
   * Tell - store content in semantic memory
   * @param {Object} params - Tell parameters
   * @returns {Promise<Object>} Command result
   */
  async tell(params) {
    return await this.execute('tell', params);
  }

  /**
   * Ask - query semantic memory with context
   * @param {Object} params - Ask parameters
   * @returns {Promise<Object>} Command result
   */
  async ask(params) {
    return await this.execute('ask', params);
  }

  /**
   * Augment - process/enhance content
   * @param {Object} params - Augment parameters
   * @returns {Promise<Object>} Command result
   */
  async augment(params) {
    return await this.execute('augment', params);
  }

  /**
   * Zoom - navigate to different granularities (ZPT)
   * @param {Object} params - Zoom parameters
   * @returns {Promise<Object>} Command result
   */
  async zoom(params) {
    return await this.execute('zoom', params);
  }

  /**
   * Pan - navigate in different directions (ZPT)
   * @param {Object} params - Pan parameters
   * @returns {Promise<Object>} Command result
   */
  async pan(params) {
    return await this.execute('pan', params);
  }

  /**
   * Tilt - change presentation style (ZPT)
   * @param {Object} params - Tilt parameters
   * @returns {Promise<Object>} Command result
   */
  async tilt(params) {
    return await this.execute('tilt', params);
  }

  /**
   * Inspect - examine system state
   * @param {Object} params - Inspect parameters
   * @returns {Promise<Object>} Command result
   */
  async inspect(params) {
    return await this.execute('inspect', params);
  }

  /**
   * Remember - store in specific memory domains
   * @param {Object} params - Remember parameters
   * @returns {Promise<Object>} Command result
   */
  async remember(params) {
    return await this.execute('remember', params);
  }

  /**
   * Forget - remove or fade memory content
   * @param {Object} params - Forget parameters
   * @returns {Promise<Object>} Command result
   */
  async forget(params) {
    return await this.execute('forget', params);
  }

  /**
   * Recall - retrieve from specific memory domains
   * @param {Object} params - Recall parameters
   * @returns {Promise<Object>} Command result
   */
  async recall(params) {
    return await this.execute('recall', params);
  }

  /**
   * Project context - manage project-specific contexts
   * @param {Object} params - Project context parameters
   * @returns {Promise<Object>} Command result
   */
  async project_context(params) {
    return await this.execute('project_context', params);
  }

  /**
   * Fade memory - apply memory decay operations
   * @param {Object} params - Fade memory parameters
   * @returns {Promise<Object>} Command result
   */
  async fade_memory(params) {
    return await this.execute('fade_memory', params);
  }

  // ====== SERVICE INTROSPECTION ======

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      service: 'SimpleVerbsService',
      version: 'refactored',
      initialized: this.initialized,
      architecture: 'command_pattern',
      registryHealth: this.registry.getHealthStatus(),
      supportedVerbs: this.registry.getSupportedVerbs(),
      extractedCommands: ['zoom', 'pan', 'tilt', 'inspect', 'remember', 'forget', 'recall', 'project_context', 'fade_memory'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get supported verbs
   */
  getSupportedVerbs() {
    return this.registry.getSupportedVerbs();
  }

  /**
   * Get command metadata
   */
  getCommandMetadata(verb) {
    return this.registry.getCommandMetadata(verb);
  }

  // ====== LEGACY PROPERTY ACCESS ======
  // For compatibility with existing code that accesses properties

  /**
   * Get LLM handler (compatibility)
   */
  get llmHandler() {
    return this.registry.contextService.getContext()?.llmHandler;
  }

  /**
   * Get memory manager (compatibility)
   */
  get memoryManager() {
    return this.registry.contextService.getContext()?.memoryManager;
  }

  /**
   * Get state manager (compatibility)
   */
  get stateManager() {
    return this.registry.contextService.getContext()?.stateManager;
  }
}

export default SimpleVerbsService;