import { v4 as uuidv4 } from 'uuid';
import { configureLogging } from './LoggingConfig.js';

/**
 * WorkflowLogger - Centralized logging for multi-step operations
 * Provides context tracking, workflow progression, and dual-level messaging
 */
export class WorkflowLogger {
    constructor(componentName = 'workflow') {
        this.componentName = componentName;
        this.logger = configureLogging(componentName);
        this.activeOperations = new Map(); // Track ongoing operations
        this.logStreams = new Set(); // SSE streams for real-time logging
        
        // Operation emoji mapping for visual clarity
        this.emojis = {
            chat: '💬',
            memory: '🧠',
            search: '🔍',
            storage: '💾',
            embedding: '🎯',
            concepts: '💡',
            retrieval: '📥',
            processing: '⚙️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
    }

    /**
     * Start tracking a new workflow operation
     * @param {string} operationId - Unique operation identifier
     * @param {string} operationType - Type of operation (chat, search, etc.)
     * @param {string} description - Human-friendly operation description
     * @param {Object} metadata - Additional operation context
     */
    startOperation(operationId = null, operationType = 'general', description = '', metadata = {}) {
        const id = operationId || uuidv4();
        const operation = {
            id,
            type: operationType,
            description,
            startTime: Date.now(),
            steps: [],
            metadata,
            status: 'active'
        };
        
        this.activeOperations.set(id, operation);
        
        const emoji = this.emojis[operationType] || this.emojis.processing;
        const humanMessage = `${emoji} ${description || `Starting ${operationType} operation`}`;
        const technicalMessage = `[${this.componentName}] startOperation(${operationType}) - ID: ${id}`;
        
        this.logDualLevel('info', humanMessage, technicalMessage, { 
            operationId: id, 
            operationType,
            ...metadata 
        });
        
        return id;
    }

    /**
     * Log a step within an ongoing operation
     * @param {string} operationId - Operation identifier
     * @param {string} stepName - Technical step name
     * @param {string} humanMessage - User-friendly message
     * @param {string} technicalDetails - Technical details for debug level
     * @param {Object} data - Additional step data
     */
    logStep(operationId, stepName, humanMessage, technicalDetails = '', data = {}) {
        const operation = this.activeOperations.get(operationId);
        if (!operation) {
            this.logger.warn(`Attempted to log step for unknown operation: ${operationId}`);
            return;
        }

        const step = {
            name: stepName,
            timestamp: Date.now(),
            duration: Date.now() - (operation.steps.length > 0 ? 
                operation.steps[operation.steps.length - 1].timestamp : 
                operation.startTime),
            data
        };
        
        operation.steps.push(step);
        
        // Create technical message with class context
        const fullTechnicalMessage = technicalDetails || 
            `[${this.componentName}] ${stepName} - Operation: ${operationId}`;
        
        this.logDualLevel('info', humanMessage, fullTechnicalMessage, {
            operationId,
            stepName,
            operationType: operation.type,
            stepDuration: step.duration,
            ...data
        });
    }

    /**
     * Complete an operation successfully
     * @param {string} operationId - Operation identifier
     * @param {string} result - Operation result summary
     * @param {Object} finalData - Final operation data
     */
    completeOperation(operationId, result = 'Operation completed', finalData = {}) {
        const operation = this.activeOperations.get(operationId);
        if (!operation) {
            this.logger.warn(`Attempted to complete unknown operation: ${operationId}`);
            return;
        }

        const totalDuration = Date.now() - operation.startTime;
        operation.status = 'completed';
        operation.endTime = Date.now();
        operation.result = result;

        const emoji = this.emojis.success;
        const humanMessage = `${emoji} ${result} (${totalDuration}ms)`;
        const technicalMessage = `[${this.componentName}] Operation ${operationId} completed - ${operation.steps.length} steps, ${totalDuration}ms total`;
        
        this.logDualLevel('info', humanMessage, technicalMessage, {
            operationId,
            operationType: operation.type,
            totalDuration,
            stepsCount: operation.steps.length,
            status: 'completed',
            ...finalData
        });

        // Clean up completed operation
        this.activeOperations.delete(operationId);
    }

    /**
     * Fail an operation with error details
     * @param {string} operationId - Operation identifier
     * @param {Error|string} error - Error object or message
     * @param {Object} errorData - Additional error context
     */
    failOperation(operationId, error, errorData = {}) {
        const operation = this.activeOperations.get(operationId);
        if (!operation) {
            this.logger.warn(`Attempted to fail unknown operation: ${operationId}`);
            return;
        }

        const totalDuration = Date.now() - operation.startTime;
        operation.status = 'failed';
        operation.endTime = Date.now();
        operation.error = error instanceof Error ? error.message : error;

        const emoji = this.emojis.error;
        const humanMessage = `${emoji} ${operation.description || 'Operation'} failed: ${operation.error}`;
        const technicalMessage = `[${this.componentName}] Operation ${operationId} failed after ${totalDuration}ms`;
        
        this.logDualLevel('error', humanMessage, technicalMessage, {
            operationId,
            operationType: operation.type,
            totalDuration,
            stepsCount: operation.steps.length,
            error: operation.error,
            status: 'failed',
            stack: error instanceof Error ? error.stack : undefined,
            ...errorData
        });

        // Clean up failed operation
        this.activeOperations.delete(operationId);
    }

    /**
     * Log messages at both human-friendly and technical levels
     * @param {string} level - Log level (info, error, warn, debug)
     * @param {string} humanMessage - User-friendly message
     * @param {string} technicalMessage - Technical message with class details
     * @param {Object} data - Additional structured data
     */
    logDualLevel(level, humanMessage, technicalMessage, data = {}) {
        // Always log to backend file system at technical level
        this.logger[level](technicalMessage, data);
        
        // Stream to frontend console if streams are connected
        this.streamToFrontend({
            timestamp: new Date(),
            level: level,
            humanMessage: humanMessage,
            technicalMessage: technicalMessage,
            component: this.componentName,
            data: data
        });
    }

    /**
     * Stream log message to connected frontend clients
     * @param {Object} logEntry - Structured log entry
     */
    streamToFrontend(logEntry) {
        if (this.logStreams.size === 0) return;

        const message = JSON.stringify({
            type: 'log',
            ...logEntry
        });

        // Send to all connected streams
        this.logStreams.forEach(stream => {
            try {
                stream.write(`data: ${message}\n\n`);
            } catch (error) {
                // Remove broken streams
                this.logStreams.delete(stream);
            }
        });
    }

    /**
     * Add SSE stream for real-time log broadcasting
     * @param {WritableStream} stream - SSE response stream
     */
    addLogStream(stream) {
        this.logStreams.add(stream);
        
        // Send initial connection message
        stream.write(`data: ${JSON.stringify({
            type: 'connection',
            message: 'Connected to workflow logs',
            timestamp: new Date(),
            component: this.componentName
        })}\n\n`);
    }

    /**
     * Remove SSE stream
     * @param {WritableStream} stream - SSE response stream to remove
     */
    removeLogStream(stream) {
        this.logStreams.delete(stream);
    }

    /**
     * Get information about active operations
     * @returns {Array} Active operation summaries
     */
    getActiveOperations() {
        return Array.from(this.activeOperations.values()).map(op => ({
            id: op.id,
            type: op.type,
            description: op.description,
            startTime: op.startTime,
            stepsCount: op.steps.length,
            status: op.status,
            duration: Date.now() - op.startTime
        }));
    }

    /**
     * Create a scoped logger for a specific operation
     * @param {string} operationId - Operation to scope to
     * @returns {Object} Scoped logging interface
     */
    createOperationLogger(operationId) {
        return {
            step: (stepName, humanMessage, technicalDetails, data) => 
                this.logStep(operationId, stepName, humanMessage, technicalDetails, data),
            complete: (result, data) => 
                this.completeOperation(operationId, result, data),
            fail: (error, data) => 
                this.failOperation(operationId, error, data),
            log: (level, humanMessage, technicalMessage, data) =>
                this.logDualLevel(level, humanMessage, technicalMessage, { operationId, ...data })
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.activeOperations.clear();
        this.logStreams.clear();
    }
}

// Global registry for all workflow loggers
class WorkflowLoggerRegistry {
    constructor() {
        this.loggers = new Map();
        this.globalStreams = new Set();
    }

    register(name, logger) {
        this.loggers.set(name, logger);
        // Add existing global streams to new logger
        this.globalStreams.forEach(stream => {
            logger.addLogStream(stream);
        });
    }

    unregister(name) {
        this.loggers.delete(name);
    }

    addGlobalStream(stream) {
        this.globalStreams.add(stream);
        // Add stream to all existing loggers
        this.loggers.forEach(logger => {
            logger.addLogStream(stream);
        });
    }

    removeGlobalStream(stream) {
        this.globalStreams.delete(stream);
        // Remove stream from all loggers
        this.loggers.forEach(logger => {
            logger.removeLogStream(stream);
        });
    }

    getAllLoggers() {
        return Array.from(this.loggers.values());
    }
}

// Global registry instance
export const workflowLoggerRegistry = new WorkflowLoggerRegistry();

// Export singleton instance for global use
export const workflowLogger = new WorkflowLogger('workflow');

// Register the main workflow logger
workflowLoggerRegistry.register('main', workflowLogger);

// Export class for custom instances
export default WorkflowLogger;