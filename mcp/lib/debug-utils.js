/**
 * Debug utilities for MCP protocol debugging
 * Provides comprehensive logging and parameter inspection
 */

/**
 * Enhanced logger for MCP debugging
 * Logs to stderr to avoid interfering with MCP protocol on stdout
 */
export class MCPDebugger {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.logLevel = process.env.MCP_DEBUG_LEVEL || 'info';
    this.logToFile = process.env.MCP_DEBUG_FILE || false;
  }

  log(level, message, data = null) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [MCP-${level.toUpperCase()}]`;
    
    let logMessage = `${prefix} ${message}`;
    
    if (data !== null) {
      logMessage += `\nData: ${this.formatData(data)}`;
    }

    // Always log to stderr to avoid interfering with MCP protocol
    console.error(logMessage);
  }

  formatData(data) {
    try {
      if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
      }
      return String(data);
    } catch (error) {
      return `[Error formatting data: ${error.message}]`;
    }
  }

  debug(message, data = null) {
    if (this.logLevel === 'debug') {
      this.log('debug', message, data);
    }
  }

  info(message, data = null) {
    if (['debug', 'info'].includes(this.logLevel)) {
      this.log('info', message, data);
    }
  }

  warn(message, data = null) {
    if (['debug', 'info', 'warn'].includes(this.logLevel)) {
      this.log('warn', message, data);
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  /**
   * Log MCP protocol messages (requests and responses)
   */
  logProtocolMessage(direction, method, params = null, result = null, error = null) {
    const data = {
      direction, // 'incoming' or 'outgoing'
      method,
      params,
      result,
      error,
      timestamp: Date.now()
    };

    this.debug(`MCP ${direction.toUpperCase()} - ${method}`, data);
  }

  /**
   * Log tool call details with parameter inspection
   */
  logToolCall(toolName, rawArgs, processedArgs, result, error = null) {
    const data = {
      toolName,
      rawArgs: this.inspectParameters(rawArgs),
      processedArgs: this.inspectParameters(processedArgs),
      result: this.truncateResult(result),
      error: error ? { message: error.message, stack: error.stack } : null,
      timestamp: Date.now()
    };

    this.info(`Tool Call: ${toolName}`, data);
  }

  /**
   * Inspect parameter structure for debugging
   */
  inspectParameters(params) {
    if (params === null || params === undefined) {
      return { type: typeof params, value: params };
    }

    const inspection = {
      type: typeof params,
      isArray: Array.isArray(params),
      constructor: params.constructor?.name,
      keys: null,
      length: null,
      value: null
    };

    if (typeof params === 'object') {
      if (Array.isArray(params)) {
        inspection.length = params.length;
        inspection.value = params.slice(0, 3); // First 3 elements for debugging
      } else {
        inspection.keys = Object.keys(params);
        inspection.value = {};
        // Include first few properties for inspection
        Object.keys(params).slice(0, 5).forEach(key => {
          inspection.value[key] = this.truncateValue(params[key]);
        });
      }
    } else {
      inspection.value = this.truncateValue(params);
    }

    return inspection;
  }

  /**
   * Truncate values for logging to prevent huge logs
   */
  truncateValue(value) {
    if (typeof value === 'string') {
      return value.length > 200 ? value.substring(0, 200) + '...' : value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 3);
    }
    return value;
  }

  /**
   * Truncate result for logging
   */
  truncateResult(result) {
    if (!result) return result;
    
    if (result.content && Array.isArray(result.content)) {
      return {
        ...result,
        content: result.content.map(item => ({
          ...item,
          text: typeof item.text === 'string' && item.text.length > 500 
            ? item.text.substring(0, 500) + '...' 
            : item.text
        }))
      };
    }
    
    return result;
  }

  /**
   * Create a diagnostic tool call for parameter testing
   */
  createDiagnosticTool(server, toolName = 'mcp_debug_params') {
    server.tool(
      toolName,
      {
        description: "Diagnostic tool to test parameter passing and format",
        parameters: {
          testString: { type: "string", description: "Test string parameter" },
          testNumber: { type: "number", description: "Test number parameter" },
          testBoolean: { type: "boolean", description: "Test boolean parameter" },
          testObject: { type: "object", description: "Test object parameter" },
          testArray: { type: "array", description: "Test array parameter" }
        }
      },
      (...args) => {
        this.info(`Diagnostic tool ${toolName} called`, {
          argumentsLength: args.length,
          arguments: args.map((arg, i) => ({
            index: i,
            inspection: this.inspectParameters(arg)
          }))
        });

        // Try different ways to extract parameters
        const extractionMethods = {
          directArgs: args,
          firstArg: args[0],
          destructured: args.length > 0 ? args[0] : {},
          flattenedArgs: args.length > 1 ? Object.assign({}, ...args) : args[0]
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Diagnostic tool executed successfully",
              parameterAnalysis: {
                totalArguments: args.length,
                extractionMethods,
                recommendations: this.analyzeParameterStructure(args)
              }
            }, null, 2)
          }]
        };
      }
    );

    this.info(`Registered diagnostic tool: ${toolName}`);
  }

  /**
   * Analyze parameter structure and provide recommendations
   */
  analyzeParameterStructure(args) {
    const recommendations = [];

    if (args.length === 0) {
      recommendations.push("No arguments received - check MCP client call format");
    } else if (args.length === 1) {
      const firstArg = args[0];
      if (typeof firstArg === 'object' && firstArg !== null) {
        recommendations.push("Single object argument - likely correct MCP format");
        recommendations.push("Use destructuring: async ({ param1, param2 }) => {}");
      } else {
        recommendations.push("Single non-object argument - unusual for MCP tools");
      }
    } else {
      recommendations.push("Multiple arguments - may indicate parameter spreading issue");
      recommendations.push("Consider using rest parameters: async (...args) => {}");
    }

    return recommendations;
  }
}

/**
 * Global debugger instance
 */
export const mcpDebugger = new MCPDebugger(
  process.env.MCP_DEBUG === 'true' || process.env.NODE_ENV === 'development'
);

/**
 * Wrap a tool handler with debugging
 */
export function debugToolHandler(toolName, handler, debug = mcpDebugger) {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      debug.debug(`Tool ${toolName} starting`, {
        arguments: debug.inspectParameters(args)
      });

      const result = await handler(...args);
      
      const duration = Date.now() - startTime;
      debug.logToolCall(toolName, args, args, result);
      debug.debug(`Tool ${toolName} completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      debug.logToolCall(toolName, args, args, null, error);
      debug.error(`Tool ${toolName} failed after ${duration}ms`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  };
}

/**
 * Helper to validate and extract parameters with debugging
 */
export function extractParameters(args, expectedParams, debug = mcpDebugger) {
  debug.debug('Extracting parameters', {
    args: debug.inspectParameters(args),
    expectedParams
  });

  if (!args || args.length === 0) {
    throw new Error('No arguments provided');
  }

  // MCP typically passes parameters as a single object
  const params = args[0];
  
  if (typeof params !== 'object' || params === null) {
    throw new Error(`Expected object parameters, got ${typeof params}`);
  }

  // Validate expected parameters are present
  const missing = expectedParams.filter(param => !(param in params));
  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }

  debug.debug('Parameter extraction successful', {
    extractedParams: debug.inspectParameters(params)
  });

  return params;
}