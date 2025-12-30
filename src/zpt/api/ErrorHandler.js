/**
 * Comprehensive error handling for ZPT navigation API
 */
import { logger } from '../../Utils.js';

export default class ErrorHandler {
    constructor(options = {}) {
        this.config = {
            logErrors: options.logErrors !== false,
            includeStackTrace: options.includeStackTrace || false,
            enableErrorReporting: options.enableErrorReporting || false,
            sanitizeErrorMessages: options.sanitizeErrorMessages !== false,
            maxErrorMessageLength: options.maxErrorMessageLength || 500,
            enableRecovery: options.enableRecovery !== false,
            ...options
        };

        this.initializeErrorTypes();
        this.initializeErrorCodes();
        this.initializeRecoveryStrategies();
        
        // Error statistics
        this.errorStats = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByCode: new Map(),
            recentErrors: []
        };
    }

    /**
     * Initialize error type definitions
     */
    initializeErrorTypes() {
        this.errorTypes = {
            VALIDATION_ERROR: {
                statusCode: 400,
                category: 'client',
                severity: 'medium',
                recoverable: true,
                description: 'Request validation failed'
            },
            AUTHENTICATION_ERROR: {
                statusCode: 401,
                category: 'client',
                severity: 'medium',
                recoverable: false,
                description: 'Authentication required or failed'
            },
            AUTHORIZATION_ERROR: {
                statusCode: 403,
                category: 'client',
                severity: 'medium',
                recoverable: false,
                description: 'Insufficient permissions'
            },
            NOT_FOUND_ERROR: {
                statusCode: 404,
                category: 'client',
                severity: 'low',
                recoverable: false,
                description: 'Resource not found'
            },
            RATE_LIMIT_ERROR: {
                statusCode: 429,
                category: 'client',
                severity: 'medium',
                recoverable: true,
                description: 'Rate limit exceeded'
            },
            PARAMETER_ERROR: {
                statusCode: 400,
                category: 'client',
                severity: 'medium',
                recoverable: true,
                description: 'Invalid navigation parameters'
            },
            CORPUS_ERROR: {
                statusCode: 503,
                category: 'server',
                severity: 'high',
                recoverable: true,
                description: 'Corpus access error'
            },
            PROCESSING_ERROR: {
                statusCode: 500,
                category: 'server',
                severity: 'high',
                recoverable: true,
                description: 'Navigation processing failed'
            },
            TIMEOUT_ERROR: {
                statusCode: 408,
                category: 'server',
                severity: 'medium',
                recoverable: true,
                description: 'Request timeout'
            },
            RESOURCE_ERROR: {
                statusCode: 507,
                category: 'server',
                severity: 'high',
                recoverable: false,
                description: 'Insufficient resources'
            },
            CONFIGURATION_ERROR: {
                statusCode: 500,
                category: 'server',
                severity: 'critical',
                recoverable: false,
                description: 'System configuration error'
            },
            EXTERNAL_SERVICE_ERROR: {
                statusCode: 502,
                category: 'server',
                severity: 'high',
                recoverable: true,
                description: 'External service unavailable'
            },
            UNKNOWN_ERROR: {
                statusCode: 500,
                category: 'server',
                severity: 'high',
                recoverable: false,
                description: 'Unknown system error'
            }
        };
    }

    /**
     * Initialize specific error codes
     */
    initializeErrorCodes() {
        this.errorCodes = {
            // Validation errors (4000-4099)
            'INVALID_ZOOM_LEVEL': { type: 'VALIDATION_ERROR', code: 4001 },
            'INVALID_TILT_REPRESENTATION': { type: 'VALIDATION_ERROR', code: 4002 },
            'INVALID_PAN_FILTER': { type: 'VALIDATION_ERROR', code: 4003 },
            'INVALID_TRANSFORM_PARAMS': { type: 'VALIDATION_ERROR', code: 4004 },
            'MISSING_REQUIRED_PARAM': { type: 'VALIDATION_ERROR', code: 4005 },
            'INVALID_TOKEN_LIMIT': { type: 'VALIDATION_ERROR', code: 4006 },
            'INVALID_FORMAT': { type: 'VALIDATION_ERROR', code: 4007 },
            'INVALID_DATE_RANGE': { type: 'VALIDATION_ERROR', code: 4008 },
            'INVALID_GEOGRAPHIC_BOUNDS': { type: 'VALIDATION_ERROR', code: 4009 },
            
            // Parameter errors (4100-4199)
            'PARAMETER_VALIDATION_FAILED': { type: 'PARAMETER_ERROR', code: 4101 },
            'PARAMETER_NORMALIZATION_FAILED': { type: 'PARAMETER_ERROR', code: 4102 },
            'INCOMPATIBLE_PARAMETERS': { type: 'PARAMETER_ERROR', code: 4103 },
            'PARAMETER_LIMIT_EXCEEDED': { type: 'PARAMETER_ERROR', code: 4104 },
            
            // Corpus errors (5000-5099)
            'CORPUS_UNAVAILABLE': { type: 'CORPUS_ERROR', code: 5001 },
            'CORPUS_QUERY_FAILED': { type: 'CORPUS_ERROR', code: 5002 },
            'CORPUS_TIMEOUT': { type: 'CORPUS_ERROR', code: 5003 },
            'SPARQL_ENDPOINT_ERROR': { type: 'CORPUS_ERROR', code: 5004 },
            'EMBEDDING_SERVICE_ERROR': { type: 'CORPUS_ERROR', code: 5005 },
            
            // Processing errors (5100-5199)
            'SELECTION_FAILED': { type: 'PROCESSING_ERROR', code: 5101 },
            'PROJECTION_FAILED': { type: 'PROCESSING_ERROR', code: 5102 },
            'TRANSFORMATION_FAILED': { type: 'PROCESSING_ERROR', code: 5103 },
            'CHUNKING_FAILED': { type: 'PROCESSING_ERROR', code: 5104 },
            'FORMATTING_FAILED': { type: 'PROCESSING_ERROR', code: 5105 },
            'ENCODING_FAILED': { type: 'PROCESSING_ERROR', code: 5106 },
            'TOKEN_COUNT_EXCEEDED': { type: 'PROCESSING_ERROR', code: 5107 },
            
            // Resource errors (5200-5299)
            'MEMORY_LIMIT_EXCEEDED': { type: 'RESOURCE_ERROR', code: 5201 },
            'CPU_LIMIT_EXCEEDED': { type: 'RESOURCE_ERROR', code: 5202 },
            'DISK_SPACE_ERROR': { type: 'RESOURCE_ERROR', code: 5203 },
            'CONNECTION_LIMIT_EXCEEDED': { type: 'RESOURCE_ERROR', code: 5204 },
            
            // Configuration errors (5300-5399)
            'MISSING_DEPENDENCY': { type: 'CONFIGURATION_ERROR', code: 5301 },
            'INVALID_CONFIGURATION': { type: 'CONFIGURATION_ERROR', code: 5302 },
            'SERVICE_NOT_INITIALIZED': { type: 'CONFIGURATION_ERROR', code: 5303 },
            
            // External service errors (5400-5499)
            'LLM_SERVICE_UNAVAILABLE': { type: 'EXTERNAL_SERVICE_ERROR', code: 5401 },
            'EMBEDDING_SERVICE_UNAVAILABLE': { type: 'EXTERNAL_SERVICE_ERROR', code: 5402 },
            'SPARQL_SERVICE_UNAVAILABLE': { type: 'EXTERNAL_SERVICE_ERROR', code: 5403 }
        };
    }

    /**
     * Initialize error recovery strategies
     */
    initializeRecoveryStrategies() {
        this.recoveryStrategies = {
            'VALIDATION_ERROR': this.recoverFromValidationError.bind(this),
            'PARAMETER_ERROR': this.recoverFromParameterError.bind(this),
            'CORPUS_ERROR': this.recoverFromCorpusError.bind(this),
            'PROCESSING_ERROR': this.recoverFromProcessingError.bind(this),
            'TIMEOUT_ERROR': this.recoverFromTimeoutError.bind(this),
            'EXTERNAL_SERVICE_ERROR': this.recoverFromExternalServiceError.bind(this)
        };
    }

    /**
     * Main error handling method
     * @param {Error} error - The error to handle
     * @param {Object} req - HTTP request object
     * @param {Object} res - HTTP response object
     * @param {Object} context - Additional context
     */
    async handleError(error, req, res, context = {}) {
        const errorId = this.generateErrorId();
        const timestamp = new Date().toISOString();

        try {
            // Normalize error
            const normalizedError = this.normalizeError(error, context);
            
            // Log error
            if (this.config.logErrors) {
                this.logError(normalizedError, errorId, req, context);
            }
            
            // Update statistics
            this.updateErrorStats(normalizedError);
            
            // Attempt recovery if enabled
            let recoveredError = normalizedError;
            if (this.config.enableRecovery && normalizedError.recoverable) {
                recoveredError = await this.attemptRecovery(normalizedError, req, context);
            }
            
            // Format error response
            const errorResponse = this.formatErrorResponse(recoveredError, errorId, context);
            
            // Send response
            this.sendErrorResponse(res, errorResponse, recoveredError.statusCode);
            
            // Report error if enabled
            if (this.config.enableErrorReporting) {
                await this.reportError(recoveredError, errorId, req, context);
            }

        } catch (handlingError) {
            // Fallback error handling
            logger.error('Error handler failed', { 
                originalError: error.message,
                handlingError: handlingError.message,
                errorId 
            });
            
            this.sendFallbackErrorResponse(res, errorId);
        }
    }

    /**
     * Normalize error into standard format
     */
    normalizeError(error, context) {
        // Determine error type and code
        const { errorType, errorCode } = this.classifyError(error, context);
        const typeInfo = this.errorTypes[errorType];
        
        return {
            id: this.generateErrorId(),
            type: errorType,
            code: errorCode,
            message: this.sanitizeErrorMessage(error.message),
            originalMessage: error.message,
            statusCode: context.statusCode || typeInfo.statusCode,
            category: typeInfo.category,
            severity: typeInfo.severity,
            recoverable: typeInfo.recoverable,
            timestamp: new Date().toISOString(),
            stackTrace: this.config.includeStackTrace ? error.stack : undefined,
            context: this.sanitizeContext(context),
            metadata: {
                field: error.field,
                details: error.details,
                cause: error.cause?.message
            }
        };
    }

    /**
     * Classify error type based on error properties
     */
    classifyError(error, context) {
        // Check for explicit error codes
        if (error.code && this.errorCodes[error.code]) {
            const codeInfo = this.errorCodes[error.code];
            return {
                errorType: codeInfo.type,
                errorCode: error.code
            };
        }

        // Check for status code override
        if (context.statusCode) {
            if (context.statusCode === 404) return { errorType: 'NOT_FOUND_ERROR', errorCode: 'NOT_FOUND' };
            if (context.statusCode === 429) return { errorType: 'RATE_LIMIT_ERROR', errorCode: 'RATE_LIMIT_EXCEEDED' };
        }

        // Pattern matching on error message
        const message = error.message.toLowerCase();
        
        if (message.includes('validation') || message.includes('invalid')) {
            return { errorType: 'VALIDATION_ERROR', errorCode: 'VALIDATION_FAILED' };
        }
        
        if (message.includes('parameter')) {
            return { errorType: 'PARAMETER_ERROR', errorCode: 'PARAMETER_ERROR' };
        }
        
        if (message.includes('timeout') || message.includes('timed out')) {
            return { errorType: 'TIMEOUT_ERROR', errorCode: 'REQUEST_TIMEOUT' };
        }
        
        if (message.includes('corpus') || message.includes('sparql')) {
            return { errorType: 'CORPUS_ERROR', errorCode: 'CORPUS_ACCESS_ERROR' };
        }
        
        if (message.includes('processing') || message.includes('transformation')) {
            return { errorType: 'PROCESSING_ERROR', errorCode: 'PROCESSING_FAILED' };
        }
        
        if (message.includes('memory') || message.includes('resource')) {
            return { errorType: 'RESOURCE_ERROR', errorCode: 'RESOURCE_EXHAUSTED' };
        }
        
        if (message.includes('service') || message.includes('unavailable')) {
            return { errorType: 'EXTERNAL_SERVICE_ERROR', errorCode: 'SERVICE_UNAVAILABLE' };
        }

        // Default classification
        return { errorType: 'UNKNOWN_ERROR', errorCode: 'UNKNOWN' };
    }

    /**
     * Attempt error recovery
     */
    async attemptRecovery(normalizedError, req, context) {
        const recoveryStrategy = this.recoveryStrategies[normalizedError.type];
        
        if (!recoveryStrategy) {
            return normalizedError;
        }

        try {
            const recoveryResult = await recoveryStrategy(normalizedError, req, context);
            
            if (recoveryResult.recovered) {
                return {
                    ...normalizedError,
                    recovered: true,
                    recoveryMessage: recoveryResult.message,
                    fallbackData: recoveryResult.data
                };
            }
        } catch (recoveryError) {
            logger.warn('Error recovery failed', { 
                originalError: normalizedError.code,
                recoveryError: recoveryError.message 
            });
        }

        return normalizedError;
    }

    /**
     * Recovery strategy implementations
     */
    async recoverFromValidationError(error, req, context) {
        // Try to provide corrected parameters
        if (error.code === 'INVALID_ZOOM_LEVEL') {
            return {
                recovered: true,
                message: 'Suggested valid zoom levels',
                data: {
                    validZoomLevels: ['micro', 'entity', 'text', 'unit', 'community', 'corpus'],
                    suggestion: 'unit'
                }
            };
        }

        if (error.code === 'INVALID_TILT_REPRESENTATION') {
            return {
                recovered: true,
                message: 'Suggested valid tilt representations',
                data: {
                    validTilts: ['embedding', 'keywords', 'graph', 'temporal'],
                    suggestion: 'keywords'
                }
            };
        }

        return { recovered: false };
    }

    async recoverFromParameterError(error, req, context) {
        // Try to provide default parameters
        return {
            recovered: true,
            message: 'Using default parameters',
            data: {
                defaultParams: {
                    zoom: 'unit',
                    tilt: 'keywords',
                    transform: { maxTokens: 4000, format: 'structured' }
                }
            }
        };
    }

    async recoverFromCorpusError(error, req, context) {
        // Try alternative data sources or cached results
        return {
            recovered: true,
            message: 'Using cached corpus data',
            data: {
                source: 'cache',
                freshness: 'stale',
                limitation: 'Limited results available from cache'
            }
        };
    }

    async recoverFromProcessingError(error, req, context) {
        // Try simplified processing
        return {
            recovered: true,
            message: 'Using simplified processing mode',
            data: {
                mode: 'simplified',
                limitations: ['No chunking', 'Basic formatting', 'Reduced metadata']
            }
        };
    }

    async recoverFromTimeoutError(error, req, context) {
        // Suggest pagination or reduced scope
        return {
            recovered: true,
            message: 'Request timeout - suggest reducing scope',
            data: {
                suggestions: [
                    'Reduce maxTokens parameter',
                    'Use more specific pan filters',
                    'Try pagination for large results'
                ]
            }
        };
    }

    async recoverFromExternalServiceError(error, req, context) {
        // Try fallback services
        return {
            recovered: true,
            message: 'Using fallback processing mode',
            data: {
                mode: 'fallback',
                limitations: ['No embeddings', 'Basic text processing only']
            }
        };
    }

    /**
     * Format error response
     */
    formatErrorResponse(normalizedError, errorId, context) {
        const response = {
            success: false,
            error: {
                id: errorId,
                code: normalizedError.code,
                type: normalizedError.type,
                message: normalizedError.message,
                timestamp: normalizedError.timestamp,
                statusCode: normalizedError.statusCode
            },
            requestId: context.requestId
        };

        // Add recovery information
        if (normalizedError.recovered) {
            response.recovery = {
                recovered: true,
                message: normalizedError.recoveryMessage,
                fallbackData: normalizedError.fallbackData
            };
        }

        // Add field-specific information
        if (normalizedError.metadata.field) {
            response.error.field = normalizedError.metadata.field;
        }

        // Add details in debug mode
        if (this.config.includeStackTrace && normalizedError.stackTrace) {
            response.error.stackTrace = normalizedError.stackTrace;
        }

        // Add suggestions based on error type
        response.suggestions = this.generateErrorSuggestions(normalizedError);

        // Add rate limit information
        if (context.rateLimitInfo) {
            response.rateLimit = context.rateLimitInfo;
        }

        return response;
    }

    /**
     * Generate helpful suggestions based on error type
     */
    generateErrorSuggestions(error) {
        const suggestions = [];

        switch (error.type) {
            case 'VALIDATION_ERROR':
                suggestions.push('Check parameter format against API schema');
                suggestions.push('Use /api/navigate/schema endpoint for parameter documentation');
                break;

            case 'PARAMETER_ERROR':
                suggestions.push('Verify zoom/pan/tilt parameter combinations');
                suggestions.push('Use /api/navigate/options endpoint for valid values');
                break;

            case 'RATE_LIMIT_ERROR':
                suggestions.push('Reduce request frequency');
                suggestions.push('Implement exponential backoff');
                break;

            case 'TIMEOUT_ERROR':
                suggestions.push('Reduce scope of request (smaller maxTokens)');
                suggestions.push('Use more specific filters to narrow results');
                break;

            case 'CORPUS_ERROR':
                suggestions.push('Check system status');
                suggestions.push('Try again in a few moments');
                break;

            case 'PROCESSING_ERROR':
                suggestions.push('Simplify navigation parameters');
                suggestions.push('Try smaller token limits');
                break;
        }

        return suggestions;
    }

    /**
     * Utility methods
     */
    sanitizeErrorMessage(message) {
        if (!this.config.sanitizeErrorMessages) return message;
        
        // Remove potentially sensitive information
        let sanitized = message.replace(/password[=:]\s*\S+/gi, 'password=***');
        sanitized = sanitized.replace(/token[=:]\s*\S+/gi, 'token=***');
        sanitized = sanitized.replace(/key[=:]\s*\S+/gi, 'key=***');
        
        // Truncate if too long
        if (sanitized.length > this.config.maxErrorMessageLength) {
            sanitized = sanitized.substring(0, this.config.maxErrorMessageLength) + '...';
        }
        
        return sanitized;
    }

    sanitizeContext(context) {
        const sanitized = { ...context };
        
        // Remove sensitive fields
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.key;
        delete sanitized.authorization;
        
        return sanitized;
    }

    logError(error, errorId, req, context) {
        const logData = {
            errorId,
            type: error.type,
            code: error.code,
            message: error.message,
            severity: error.severity,
            statusCode: error.statusCode,
            requestId: context.requestId,
            method: req?.method,
            path: req?.url,
            userAgent: req?.headers?.['user-agent'],
            timestamp: error.timestamp
        };

        switch (error.severity) {
            case 'critical':
                logger.error('Critical error occurred', logData);
                break;
            case 'high':
                logger.error('High severity error', logData);
                break;
            case 'medium':
                logger.warn('Medium severity error', logData);
                break;
            case 'low':
                logger.info('Low severity error', logData);
                break;
            default:
                logger.error('Error occurred', logData);
        }
    }

    updateErrorStats(error) {
        this.errorStats.totalErrors++;
        
        // Update error type counts
        const typeCount = this.errorStats.errorsByType.get(error.type) || 0;
        this.errorStats.errorsByType.set(error.type, typeCount + 1);
        
        // Update error code counts
        const codeCount = this.errorStats.errorsByCode.get(error.code) || 0;
        this.errorStats.errorsByCode.set(error.code, codeCount + 1);
        
        // Keep recent errors (last 100)
        this.errorStats.recentErrors.push({
            id: error.id,
            type: error.type,
            code: error.code,
            timestamp: error.timestamp
        });
        
        if (this.errorStats.recentErrors.length > 100) {
            this.errorStats.recentErrors.shift();
        }
    }

    sendErrorResponse(res, errorResponse, statusCode) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = statusCode || 500;
        res.end(JSON.stringify(errorResponse, null, 2));
    }

    sendFallbackErrorResponse(res, errorId) {
        const fallbackResponse = {
            success: false,
            error: {
                id: errorId,
                code: 'SYSTEM_ERROR',
                message: 'An unexpected system error occurred',
                timestamp: new Date().toISOString()
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 500;
        res.end(JSON.stringify(fallbackResponse));
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async reportError(error, errorId, req, context) {
        // Placeholder for external error reporting
        // Could integrate with services like Sentry, Rollbar, etc.
        logger.info('Error reported', { errorId, type: error.type, code: error.code });
    }

    /**
     * Statistics and monitoring
     */
    getErrorStats() {
        return {
            total: this.errorStats.totalErrors,
            byType: Object.fromEntries(this.errorStats.errorsByType),
            byCode: Object.fromEntries(this.errorStats.errorsByCode),
            recent: this.errorStats.recentErrors.slice(-10) // Last 10 errors
        };
    }

    getErrorTypeInfo(errorType) {
        return this.errorTypes[errorType] ? { ...this.errorTypes[errorType] } : null;
    }

    getErrorCodeInfo(errorCode) {
        return this.errorCodes[errorCode] ? { ...this.errorCodes[errorCode] } : null;
    }

    resetStats() {
        this.errorStats = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByCode: new Map(),
            recentErrors: []
        };
    }

    /**
     * Configuration methods
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }

    getErrorHandlerInfo() {
        return {
            config: this.config,
            errorTypes: Object.keys(this.errorTypes),
            errorCodes: Object.keys(this.errorCodes),
            recoveryStrategies: Object.keys(this.recoveryStrategies),
            statistics: this.getErrorStats()
        };
    }
}
