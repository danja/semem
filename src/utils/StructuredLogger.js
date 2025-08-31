/**
 * Structured logging utilities for consistent, analysis-ready log output
 * Provides standardized logging formats for different types of operations
 */

import logger from 'loglevel';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CURRENT_LOG_DIR, PerformanceTimer } from './LoggingConfig.js';

// Log entry types
export const LogEntryTypes = {
    APPLICATION: 'application',
    PERFORMANCE: 'performance', 
    OPERATION: 'operation',
    ERROR: 'error',
    SECURITY: 'security',
    API: 'api',
    DATABASE: 'database',
    SYSTEM: 'system'
};

// Log severity levels
export const LogLevels = {
    TRACE: 'trace',
    DEBUG: 'debug', 
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

// Context types for correlation
export const ContextTypes = {
    REQUEST: 'request',
    SESSION: 'session',
    OPERATION: 'operation',
    USER: 'user',
    SYSTEM: 'system'
};

/**
 * Structured logger that outputs consistent JSON format logs
 */
export class StructuredLogger {
    constructor(component, options = {}) {
        this.component = component;
        this.sessionId = options.sessionId || uuidv4();
        this.baseLogger = logger.getLogger(component);
        this.logFile = path.join(CURRENT_LOG_DIR, `${component}-structured-${this.getDateString()}.log`);
        this.correlationContext = new Map();
        
        // Default metadata for all logs
        this.defaultMetadata = {
            processId: process.pid,
            nodeVersion: process.version,
            component: this.component,
            sessionId: this.sessionId,
            ...options.defaultMetadata
        };

        this.setupDirectories();
    }

    setupDirectories() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Create a structured log entry
     */
    createLogEntry(level, message, data = {}, entryType = LogEntryTypes.APPLICATION) {
        const timestamp = this.getTimestamp();
        const correlationId = data.correlationId || this.generateCorrelationId();
        
        const logEntry = {
            '@timestamp': timestamp,
            '@version': '1',
            level: level.toUpperCase(),
            message,
            type: entryType,
            component: this.component,
            correlationId,
            ...this.defaultMetadata,
            ...this.extractContextualData(data),
            metadata: this.sanitizeMetadata(data.metadata || {}),
            tags: data.tags || []
        };

        // Add performance data if available
        if (data.performance) {
            logEntry.performance = this.sanitizePerformanceData(data.performance);
        }

        // Add error details if this is an error log
        if (level === LogLevels.ERROR && data.error) {
            logEntry.error = this.extractErrorData(data.error);
        }

        // Add operation context if available
        if (data.operation) {
            logEntry.operation = this.sanitizeOperationData(data.operation);
        }

        return logEntry;
    }

    /**
     * Extract contextual data from the input
     */
    extractContextualData(data) {
        const contextual = {};
        
        // Request context
        if (data.requestId) {
            contextual.requestId = data.requestId;
        }
        if (data.userId) {
            contextual.userId = data.userId;
        }
        if (data.ip) {
            contextual.clientIp = data.ip;
        }
        if (data.userAgent) {
            contextual.userAgent = data.userAgent;
        }

        // Operation context
        if (data.operationId) {
            contextual.operationId = data.operationId;
        }
        if (data.operationType) {
            contextual.operationType = data.operationType;
        }

        // System context
        if (data.threadId) {
            contextual.threadId = data.threadId;
        }
        if (data.hostname) {
            contextual.hostname = data.hostname;
        }

        return contextual;
    }

    /**
     * Sanitize metadata to ensure it's JSON serializable
     */
    sanitizeMetadata(metadata) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(metadata)) {
            try {
                // Test serialization
                JSON.stringify(value);
                sanitized[key] = value;
            } catch (error) {
                // Replace unserializable values
                if (typeof value === 'function') {
                    sanitized[key] = '[Function]';
                } else if (value instanceof Error) {
                    sanitized[key] = {
                        name: value.name,
                        message: value.message,
                        stack: value.stack
                    };
                } else {
                    sanitized[key] = String(value);
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Extract error data in a structured format
     */
    extractErrorData(error) {
        const errorData = {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            type: error.constructor.name
        };

        if (error.stack) {
            errorData.stack = error.stack;
            // Extract just the relevant stack frames
            const stackLines = error.stack.split('\n');
            errorData.stackFrames = stackLines.slice(1, 6).map(line => line.trim());
        }

        if (error.code) {
            errorData.code = error.code;
        }

        if (error.statusCode) {
            errorData.statusCode = error.statusCode;
        }

        // Custom error properties
        const customProps = {};
        for (const key of Object.keys(error)) {
            if (!['name', 'message', 'stack'].includes(key)) {
                customProps[key] = error[key];
            }
        }
        if (Object.keys(customProps).length > 0) {
            errorData.customProperties = customProps;
        }

        return errorData;
    }

    /**
     * Sanitize performance data
     */
    sanitizePerformanceData(performance) {
        return {
            duration: performance.duration || 0,
            operationName: performance.operationName || 'unknown',
            startTime: performance.startTime,
            endTime: performance.endTime,
            memoryDelta: performance.memoryDelta || {},
            metadata: this.sanitizeMetadata(performance.metadata || {})
        };
    }

    /**
     * Sanitize operation data
     */
    sanitizeOperationData(operation) {
        return {
            type: operation.type || 'unknown',
            id: operation.id,
            phase: operation.phase,
            status: operation.status || 'unknown',
            metadata: this.sanitizeMetadata(operation.metadata || {})
        };
    }

    /**
     * Generate correlation ID
     */
    generateCorrelationId() {
        return uuidv4();
    }

    /**
     * Write structured log entry to file
     */
    writeLogEntry(logEntry) {
        try {
            const jsonLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(this.logFile, jsonLine);
        } catch (error) {
            // Fallback to console logging
            logger.error('Failed to write structured log:', error.message);
            logger.info('Log entry:', logEntry);
        }
    }

    /**
     * Main logging methods
     */
    trace(message, data = {}) {
        const logEntry = this.createLogEntry(LogLevels.TRACE, message, data);
        this.baseLogger.trace(message, data);
        this.writeLogEntry(logEntry);
    }

    debug(message, data = {}) {
        const logEntry = this.createLogEntry(LogLevels.DEBUG, message, data);
        this.baseLogger.debug(message, data);
        this.writeLogEntry(logEntry);
    }

    info(message, data = {}) {
        const logEntry = this.createLogEntry(LogLevels.INFO, message, data);
        this.baseLogger.info(message, data);
        this.writeLogEntry(logEntry);
    }

    warn(message, data = {}) {
        const logEntry = this.createLogEntry(LogLevels.WARN, message, data);
        this.baseLogger.warn(message, data);
        this.writeLogEntry(logEntry);
    }

    error(message, data = {}) {
        const logEntry = this.createLogEntry(LogLevels.ERROR, message, data, LogEntryTypes.ERROR);
        this.baseLogger.error(message, data);
        this.writeLogEntry(logEntry);
    }

    /**
     * Specialized logging methods
     */
    logOperation(operationType, operationId, phase, status, data = {}) {
        const operationData = {
            operation: {
                type: operationType,
                id: operationId,
                phase,
                status
            },
            ...data
        };
        
        const logEntry = this.createLogEntry(
            LogLevels.INFO, 
            `${operationType} operation ${status}: ${phase}`,
            operationData,
            LogEntryTypes.OPERATION
        );
        
        this.writeLogEntry(logEntry);
    }

    logPerformance(performanceData, message = null) {
        const msg = message || `Performance: ${performanceData.operationName} (${performanceData.duration}ms)`;
        const logEntry = this.createLogEntry(
            LogLevels.INFO,
            msg,
            { performance: performanceData },
            LogEntryTypes.PERFORMANCE
        );
        
        this.writeLogEntry(logEntry);
    }

    logAPICall(method, endpoint, statusCode, duration, data = {}) {
        const apiData = {
            api: {
                method,
                endpoint,
                statusCode,
                duration
            },
            ...data
        };
        
        const logEntry = this.createLogEntry(
            LogLevels.INFO,
            `API ${method} ${endpoint} - ${statusCode} (${duration}ms)`,
            apiData,
            LogEntryTypes.API
        );
        
        this.writeLogEntry(logEntry);
    }

    logDatabaseQuery(queryType, table, duration, data = {}) {
        const dbData = {
            database: {
                queryType,
                table,
                duration
            },
            ...data
        };
        
        const logEntry = this.createLogEntry(
            LogLevels.INFO,
            `Database ${queryType} on ${table} (${duration}ms)`,
            dbData,
            LogEntryTypes.DATABASE
        );
        
        this.writeLogEntry(logEntry);
    }

    logSecurity(event, severity, data = {}) {
        const level = severity === 'high' ? LogLevels.ERROR : 
                     severity === 'medium' ? LogLevels.WARN : LogLevels.INFO;
        
        const securityData = {
            security: {
                event,
                severity
            },
            ...data
        };
        
        const logEntry = this.createLogEntry(
            level,
            `Security event: ${event} (${severity})`,
            securityData,
            LogEntryTypes.SECURITY
        );
        
        this.writeLogEntry(logEntry);
    }

    /**
     * Context management
     */
    setCorrelationContext(contextId, contextData) {
        this.correlationContext.set(contextId, contextData);
    }

    getCorrelationContext(contextId) {
        return this.correlationContext.get(contextId);
    }

    clearCorrelationContext(contextId) {
        this.correlationContext.delete(contextId);
    }

    /**
     * Create child logger with inherited context
     */
    createChildLogger(childComponent, additionalMetadata = {}) {
        return new StructuredLogger(childComponent, {
            sessionId: this.sessionId,
            defaultMetadata: {
                ...this.defaultMetadata,
                parentComponent: this.component,
                ...additionalMetadata
            }
        });
    }

    /**
     * Flush any pending logs (for graceful shutdown)
     */
    flush() {
        // In this implementation, logs are written synchronously
        // This method exists for API compatibility and future async implementations
        return Promise.resolve();
    }
}

/**
 * Factory for creating structured loggers
 */
export class StructuredLoggerFactory {
    static loggers = new Map();
    
    static getLogger(component, options = {}) {
        const key = `${component}-${options.sessionId || 'default'}`;
        
        if (!this.loggers.has(key)) {
            this.loggers.set(key, new StructuredLogger(component, options));
        }
        
        return this.loggers.get(key);
    }
    
    static clearLoggers() {
        this.loggers.clear();
    }
    
    static getAllLoggers() {
        return Array.from(this.loggers.values());
    }
    
    static async flushAll() {
        const flushPromises = Array.from(this.loggers.values()).map(logger => logger.flush());
        await Promise.all(flushPromises);
    }
}

export default StructuredLogger;