/**
 * Console Service for Semantic Memory Workbench
 * Manages operation logs and console display
 */

export class ConsoleService {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Maximum number of logs to keep
    this.autoScroll = true;
    this.levelFilter = 'all';
    this.listeners = new Set();
    
    // Bind methods
    this.log = this.log.bind(this);
    this.info = this.info.bind(this);
    this.success = this.success.bind(this);
    this.warning = this.warning.bind(this);
    this.error = this.error.bind(this);
  }

  /**
   * Add a log entry
   * @param {string} level - Log level: 'info', 'success', 'warning', 'error'
   * @param {string} message - Log message
   * @param {Object} details - Additional details (optional)
   */
  log(level, message, details = null) {
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level: level,
      message: message,
      details: details
    };
    
    this.logs.push(logEntry);
    
    // Trim logs if we exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Notify listeners
    this.notifyListeners('logAdded', logEntry);
    
    // Also log to browser console for debugging
    if (typeof console !== 'undefined') {
      const consoleMethod = console[level] || console.log;
      consoleMethod(`[Workbench] ${message}`, details || '');
    }
    
    return logEntry;
  }

  /**
   * Log info message
   */
  info(message, details) {
    return this.log('info', message, details);
  }

  /**
   * Log success message
   */
  success(message, details) {
    return this.log('success', message, details);
  }

  /**
   * Log warning message
   */
  warning(message, details) {
    return this.log('warning', message, details);
  }

  /**
   * Log error message
   */
  error(message, details) {
    return this.log('error', message, details);
  }

  /**
   * Get all logs or filtered logs
   * @param {string} levelFilter - Filter by level or 'all'
   * @returns {Array} Filtered log entries
   */
  getLogs(levelFilter = null) {
    const filter = levelFilter || this.levelFilter;
    
    if (filter === 'all') {
      return [...this.logs];
    }
    
    return this.logs.filter(log => log.level === filter);
  }

  /**
   * Clear all logs
   */
  clear() {
    const clearedCount = this.logs.length;
    this.logs = [];
    
    this.notifyListeners('logsCleared', { clearedCount });
    this.info(`Console cleared (${clearedCount} entries removed)`);
    
    return clearedCount;
  }

  /**
   * Set level filter
   * @param {string} level - Level to filter by or 'all'
   */
  setLevelFilter(level) {
    this.levelFilter = level;
    this.notifyListeners('filterChanged', { level });
  }

  /**
   * Set auto-scroll behavior
   * @param {boolean} enabled - Whether to auto-scroll
   */
  setAutoScroll(enabled) {
    this.autoScroll = enabled;
    this.notifyListeners('autoScrollChanged', { enabled });
  }

  /**
   * Get console statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      info: 0,
      success: 0,
      warning: 0,
      error: 0
    };
    
    this.logs.forEach(log => {
      if (stats.hasOwnProperty(log.level)) {
        stats[log.level]++;
      }
    });
    
    return stats;
  }

  /**
   * Format timestamp for display
   * @param {Date} timestamp - Timestamp to format
   * @returns {string} Formatted time string
   */
  formatTimestamp(timestamp) {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Export logs as JSON
   * @returns {string} JSON string of logs
   */
  exportLogs() {
    return JSON.stringify(this.logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      details: log.details
    })), null, 2);
  }

  /**
   * Import logs from JSON
   * @param {string} jsonString - JSON string to import
   * @returns {number} Number of logs imported
   */
  importLogs(jsonString) {
    try {
      const importedLogs = JSON.parse(jsonString);
      
      const validLogs = importedLogs
        .filter(log => log.timestamp && log.level && log.message)
        .map(log => ({
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date(log.timestamp),
          level: log.level,
          message: log.message,
          details: log.details || null
        }));
      
      this.logs = [...this.logs, ...validLogs];
      
      // Trim if necessary
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      
      this.notifyListeners('logsImported', { count: validLogs.length });
      return validLogs.length;
      
    } catch (error) {
      this.error('Failed to import logs', { error: error.message });
      return 0;
    }
  }

  /**
   * Log API operation start
   * @param {string} operation - Operation name (tell, ask, etc.)
   * @param {Object} params - Operation parameters
   */
  logOperationStart(operation, params = {}) {
    return this.info(`Starting ${operation} operation`, {
      operation,
      params: this.sanitizeParams(params)
    });
  }

  /**
   * Log API operation success
   * @param {string} operation - Operation name
   * @param {Object} result - Operation result
   * @param {number} duration - Duration in milliseconds
   */
  logOperationSuccess(operation, result = {}, duration = 0) {
    return this.success(`${operation} completed successfully${duration ? ` (${duration}ms)` : ''}`, {
      operation,
      duration,
      result: this.sanitizeResult(result)
    });
  }

  /**
   * Log API operation error
   * @param {string} operation - Operation name
   * @param {Error} error - Error object
   * @param {number} duration - Duration in milliseconds
   */
  logOperationError(operation, error, duration = 0) {
    return this.error(`${operation} failed${duration ? ` (${duration}ms)` : ''}`, {
      operation,
      duration,
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Log state change
   * @param {string} type - Type of state change
   * @param {Object} oldState - Previous state
   * @param {Object} newState - New state
   */
  logStateChange(type, oldState, newState) {
    return this.info(`State changed: ${type}`, {
      type,
      changes: this.getStateChanges(oldState, newState)
    });
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   * @param {Object} params - Parameters to sanitize
   * @returns {Object} Sanitized parameters
   */
  sanitizeParams(params) {
    const sanitized = { ...params };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    // Truncate long content
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '... [truncated]';
    }
    
    return sanitized;
  }

  /**
   * Sanitize result data for logging
   * @param {Object} result - Result to sanitize
   * @returns {Object} Sanitized result
   */
  sanitizeResult(result) {
    if (!result) return result;
    
    const sanitized = { ...result };
    
    // Keep only key fields from results
    const keepFields = ['success', 'verb', 'id', 'answer', 'concepts', 'level', 'style'];
    const keys = Object.keys(sanitized);
    
    keys.forEach(key => {
      if (!keepFields.includes(key) && typeof sanitized[key] === 'object') {
        delete sanitized[key];
      }
    });
    
    return sanitized;
  }

  /**
   * Get differences between two states
   * @param {Object} oldState - Previous state
   * @param {Object} newState - New state
   * @returns {Object} Changed fields
   */
  getStateChanges(oldState, newState) {
    const changes = {};
    
    const checkChanges = (old, newer, path = '') => {
      Object.keys(newer).forEach(key => {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (old[key] !== newer[key]) {
          if (typeof newer[key] === 'object' && newer[key] !== null && !Array.isArray(newer[key])) {
            checkChanges(old[key] || {}, newer[key], fullPath);
          } else {
            changes[fullPath] = {
              from: old[key],
              to: newer[key]
            };
          }
        }
      });
    };
    
    checkChanges(oldState || {}, newState || {});
    return changes;
  }

  /**
   * Subscribe to console events
   * @param {Function} listener - Event listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        // Don't use this.error here to avoid infinite loop
        if (typeof console !== 'undefined') {
          console.error('Console listener error:', error);
        }
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.logs = [];
    this.listeners.clear();
  }
}

// Create and export singleton instance
export const consoleService = new ConsoleService();

// Export class for testing or custom instances
export default ConsoleService;