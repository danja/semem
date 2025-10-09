/**
 * BaseVerbCommand - Abstract base class for all verb commands
 *
 * Implements the Command Pattern to replace switch statements with polymorphism.
 * Each verb (tell, ask, augment, etc.) will extend this base class.
 */

import { verbsLogger } from '../../VerbsLogger.js';

export class BaseVerbCommand {
  constructor(name) {
    this.name = name;
    this.initialized = false;
  }

  /**
   * Initialize the command with required services and context
   * @param {Object} context - Shared context containing services
   * @param {Object} context.memoryManager - Memory management service
   * @param {Object} context.safeOps - Safe operations service
   * @param {Object} context.stateManager - ZPT state management
   * @param {Object} context.templateLoader - Template loading service
   * @param {Object} context.enhancementCoordinator - Enhancement service
   * @param {Object} context.memoryDomainManager - Memory domain service
   * @param {Object} context.memoryRelevanceEngine - Relevance engine
   */
  async initialize(context) {
    if (this.initialized) {
      return;
    }

    // Store references to shared services
    this.memoryManager = context.memoryManager;
    this.safeOps = context.safeOps;
    this.stateManager = context.stateManager;
    this.templateLoader = context.templateLoader;
    this.enhancementCoordinator = context.enhancementCoordinator;
    this.memoryDomainManager = context.memoryDomainManager;
    this.memoryRelevanceEngine = context.memoryRelevanceEngine;
    this.zptService = context.zptService;
    this.config = context.config || context.memoryManager?.config || null;
    this.storage = context.storage || context.memoryManager?.store || null;
    this.sharedContext = context;

    // Perform command-specific initialization
    await this.onInitialize(context);

    this.initialized = true;
    verbsLogger.debug(`${this.name} command initialized`);
  }

  /**
   * Override in subclasses for command-specific initialization
   * @param {Object} context - Shared context
   */
  async onInitialize(context) {
    // Default implementation - no additional initialization needed
  }

  /**
   * Validate command parameters using Zod schemas
   * @param {Object} params - Command parameters
   * @returns {Object} Validated parameters
   * @throws {Error} If validation fails
   */
  validateParameters(params) {
    if (this.schema) {
      try {
        return this.schema.parse(params);
      } catch (error) {
        verbsLogger.error(`${this.name} command validation failed:`, error.message);
        throw new Error(`Invalid parameters for ${this.name}: ${error.message}`);
      }
    }
    return params;
  }

  /**
   * Execute the command with given parameters
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   * @throws {Error} Must be implemented by subclasses
   */
  async execute(params) {
    throw new Error(`Command ${this.name} must implement execute method`);
  }

  /**
   * Get convenient access to LLM handler
   */
  get llmHandler() {
    return this.memoryManager?.llmHandler;
  }

  /**
   * Get convenient access to embedding handler
   */
  get embeddingHandler() {
    return this.memoryManager?.embeddingHandler;
  }

  /**
   * Ensure command is initialized before execution
   * @param {Object} context - Shared context
   */
  async ensureInitialized(context) {
    if (!this.initialized) {
      await this.initialize(context);
    }
  }

  /**
   * Log operation for performance tracking
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  logOperation(level, message, metadata = {}) {
    verbsLogger[level](`[${this.name.toUpperCase()}] ${message}`, {
      command: this.name,
      ...metadata
    });
  }

  /**
   * Handle errors in a consistent way across commands
   * @param {Error} error - The error that occurred
   * @param {string} operation - What operation was being performed
   * @param {Object} context - Additional context
   * @returns {Object} Error response object
   */
  handleError(error, operation, context = {}) {
    this.logOperation('error', `${operation} failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      ...context
    });

    return {
      success: false,
      error: error.message,
      verb: this.name,
      operation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a successful response object
   * @param {Object} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Success response object
   */
  createSuccessResponse(data, metadata = {}) {
    return {
      success: true,
      verb: this.name,
      ...data,
      ...metadata,
      timestamp: new Date().toISOString()
    };
  }
}

export default BaseVerbCommand;
