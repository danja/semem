/**
 * BaseStrategy - Abstract base class for strategy pattern implementations
 *
 * Used to replace switch statements within commands with polymorphic strategy objects.
 * For example, AugmentCommand uses different strategies for different operation types.
 */

import { verbsLogger } from '../../VerbsLogger.js';

export class BaseStrategy {
  constructor(name) {
    this.name = name;
  }

  /**
   * Execute the strategy with given parameters and context
   * @param {Object} params - Strategy parameters
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   * @throws {Error} Must be implemented by subclasses
   */
  async execute(params, context) {
    throw new Error(`Strategy ${this.name} must implement execute method`);
  }

  /**
   * Validate strategy-specific parameters
   * @param {Object} params - Strategy parameters
   * @returns {Object} Validated parameters
   * @throws {Error} If validation fails
   */
  validateParameters(params) {
    if (this.schema) {
      try {
        return this.schema.parse(params);
      } catch (error) {
        verbsLogger.error(`${this.name} strategy validation failed:`, error.message);
        throw new Error(`Invalid parameters for ${this.name} strategy: ${error.message}`);
      }
    }
    return params;
  }

  /**
   * Log strategy operation for debugging and monitoring
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  logOperation(level, message, metadata = {}) {
    verbsLogger[level](`[${this.name.toUpperCase()}_STRATEGY] ${message}`, {
      strategy: this.name,
      ...metadata
    });
  }

  /**
   * Handle errors consistently across strategies
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
      strategy: this.name,
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
      strategy: this.name,
      ...data,
      ...metadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if the strategy supports the given operation or parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    // Default implementation - strategies support all parameters
    // Override in subclasses for specific support checks
    return true;
  }

  /**
   * Get strategy metadata for introspection
   * @returns {Object} Strategy metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description || `${this.name} strategy`,
      supportsParameters: this.supportedParameters || [],
      schema: this.schema ? this.schema._def : null
    };
  }
}

export default BaseStrategy;