/**
 * BaseWorkflow - Base class for all workflow components
 * 
 * This abstract base class provides common functionality and patterns for
 * workflow implementations. All workflow components should extend this class
 * and implement the execute() method.
 * 
 * API: execute(input, resources, options)
 */

import logger from 'loglevel';

export default class BaseWorkflow {
    constructor(workflowType = 'base') {
        this.workflowType = workflowType;
    }

    /**
     * Execute the workflow - must be implemented by subclasses
     * 
     * @param {Object} input - Workflow input data
     * @param {Object} resources - External dependencies
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Workflow execution results
     */
    async execute(input, resources, options = {}) {
        throw new Error('execute() method must be implemented by subclass');
    }

    /**
     * Validate required input parameters
     * @protected
     */
    _validateInput(input, requiredFields = []) {
        for (const field of requiredFields) {
            if (!(field in input)) {
                throw new Error(`Required input field missing: ${field}`);
            }
        }
    }

    /**
     * Validate required resources
     * @protected
     */
    _validateResources(resources, requiredResources = []) {
        for (const resource of requiredResources) {
            if (!(resource in resources)) {
                throw new Error(`Required resource missing: ${resource}`);
            }
        }
    }

    /**
     * Create standard workflow result object
     * @protected
     */
    _createResult(success, data = {}, error = null, metadata = {}) {
        return {
            success,
            workflowType: this.workflowType,
            data,
            error,
            metadata: {
                timestamp: new Date().toISOString(),
                ...metadata
            }
        };
    }

    /**
     * Log workflow step with consistent formatting
     * @protected
     */
    _logStep(step, message, level = 'info') {
        const formattedMessage = `[${this.workflowType.toUpperCase()}] ${step}: ${message}`;
        logger[level](formattedMessage);
    }

    /**
     * Measure execution time for workflow steps
     * @protected
     */
    _measureTime(fn) {
        return async (...args) => {
            const start = Date.now();
            const result = await fn(...args);
            const duration = Date.now() - start;
            return { ...result, duration };
        };
    }

    /**
     * Handle errors with consistent format
     * @protected
     */
    _handleError(error, step = 'unknown') {
        const errorMessage = `${this.workflowType} workflow failed at step ${step}: ${error.message}`;
        logger.error(errorMessage);
        
        return this._createResult(false, {}, errorMessage, {
            errorStep: step,
            errorType: error.constructor.name
        });
    }

    /**
     * Merge configuration with defaults
     * @protected
     */
    _mergeConfig(options, defaults) {
        return {
            ...defaults,
            ...options
        };
    }

    /**
     * Extract and validate common resources
     * @protected
     */
    _extractCommonResources(resources) {
        const common = {};
        
        if (resources.llmHandler) {
            common.llmHandler = resources.llmHandler;
        }
        
        if (resources.sparqlHelper) {
            common.sparqlHelper = resources.sparqlHelper;
        }
        
        if (resources.config) {
            common.config = resources.config;
        }
        
        return common;
    }

    /**
     * Get workflow metadata for tracking
     * @protected
     */
    _getWorkflowMetadata(startTime, additionalMeta = {}) {
        return {
            workflowType: this.workflowType,
            startTime,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            ...additionalMeta
        };
    }
}