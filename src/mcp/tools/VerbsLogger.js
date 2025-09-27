/**
 * Logging utilities for Simple Verbs
 * Provides neutral logging interface that can be enhanced with hooks
 */

import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

// Use unified STDIO-aware logger
export const verbsLogger = createUnifiedLogger('simple-verbs');

/* Example of adding JSON formatting hook:
 * const originalInfo = verbsLogger.info;
 * verbsLogger.info = function(message, data) {
 *   if (data) {
 *     originalInfo.call(this, JSON.stringify({ message, data, timestamp: Date.now() }));
 *   } else {
 *     originalInfo.call(this, message);
 *   }
 * };
 */

/**
 * Performance logging helper - neutral interface that can be enhanced with hooks
 * @param {string} operation - The operation being logged
 * @param {object} data - Performance data
 */
export const logPerformance = (operation, data) => {
  // Default to info level - hooks can intercept and format differently  
  verbsLogger.info(`PERF[${operation}]`, data);
};

/**
 * Operation logging helper - neutral interface for operation events
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} operation - Operation identifier
 * @param {string} message - Log message
 * @param {object} data - Optional data payload
 */
export const logOperation = (level, operation, message, data = null) => {
  const logData = data ? { operation, message, data } : { operation, message };
  verbsLogger[level](message, logData);
};