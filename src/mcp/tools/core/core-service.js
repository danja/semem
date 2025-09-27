/**
 * Core Service - Shared utilities for core MCP tools
 * Provides common functionality used across all core tools
 */

import { mcpDebugger } from '../../lib/debug-utils.js';

export class CoreService {
  /**
   * Initialize Semem services - shared across all tools
   */
  static async initializeServices() {
    const { initializeServices } = await import('../../lib/initialization.js');
    await initializeServices();
    const { getMemoryManager } = await import('../../lib/initialization.js');
    return getMemoryManager();
  }

  /**
   * Create SafeOperations instance - shared pattern
   */
  static async createSafeOperations(memoryManager) {
    const { SafeOperations } = await import('../../lib/safe-operations.js');
    return new SafeOperations(memoryManager);
  }

  /**
   * Format standard MCP response
   */
  static formatResponse(data, success = true) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success,
          ...data
        }, null, 2)
      }]
    };
  }

  /**
   * Validate arguments against schema - basic validation
   */
  static validateArgs(args, requiredFields = []) {
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments: must be an object');
    }

    for (const field of requiredFields) {
      if (!args[field] || (typeof args[field] === 'string' && !args[field].trim())) {
        throw new Error(`Invalid ${field} parameter. It must be a non-empty string.`);
      }
    }

    return args;
  }

  /**
   * Generate UUID for operations that need it
   */
  static async generateUUID() {
    const { v4: uuidv4 } = await import('uuid');
    return uuidv4();
  }

  /**
   * Log tool execution with consistent format
   */
  static logToolExecution(toolName, args, result = null, error = null) {
    if (error) {
      mcpDebugger.error(`Core tool ${toolName} failed:`, error);
    } else {
      mcpDebugger.info(`Core tool ${toolName} executed successfully`, {
        argsCount: Object.keys(args || {}).length,
        hasResult: !!result
      });
    }
  }
}