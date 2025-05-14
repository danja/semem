// Custom API error class
export class APIError extends Error {
    constructor(message, status = 500, code = null, details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code || `error_${status}`;
        this.details = details;
    }
}

// Validation error class
export class ValidationError extends APIError {
    constructor(message, details = null) {
        super(message, 400, 'validation_error', details);
        this.name = 'ValidationError';
    }
}

// Authentication error class
export class AuthenticationError extends APIError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'authentication_error');
        this.name = 'AuthenticationError';
    }
}

// Not found error class
export class NotFoundError extends APIError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'not_found_error');
        this.name = 'NotFoundError';
    }
}

// Rate limit error class
export class RateLimitError extends APIError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'rate_limit_error');
        this.name = 'RateLimitError';
    }
}

// Global error handling middleware
export const errorHandler = (logger) => (err, req, res, next) => {
    // Log the error
    logger.error('API Error:', err);
    
    // Extract request information for logging
    const requestInfo = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };
    
    logger.debug('Request details:', requestInfo);

    // Set default error values
    let statusCode = 500;
    let errorResponse = {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        requestId: req.id || Date.now().toString(36) + Math.random().toString(36).substr(2)
    };

    // Handle API errors
    if (err instanceof APIError) {
        statusCode = err.status;
        errorResponse = {
            success: false,
            error: err.code,
            message: err.message,
            requestId: req.id || Date.now().toString(36) + Math.random().toString(36).substr(2)
        };
        
        // Add details if available
        if (err.details) {
            errorResponse.details = err.details;
        }
    }
    // Handle validation errors from other libraries
    else if (err.name === 'ValidationError' || err.name === 'JsonSchemaValidationError') {
        statusCode = 400;
        errorResponse = {
            success: false,
            error: 'validation_error',
            message: err.message,
            details: err.details || err.errors || err.validationErrors,
            requestId: req.id || Date.now().toString(36) + Math.random().toString(36).substr(2)
        };
    }
    // Handle authentication errors
    else if (err.name === 'AuthenticationError' || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorResponse = {
            success: false,
            error: 'authentication_error',
            message: err.message || 'Authentication failed',
            requestId: req.id || Date.now().toString(36) + Math.random().toString(36).substr(2)
        };
    }
    // Handle 404 errors
    else if (err.name === 'NotFoundError') {
        statusCode = 404;
        errorResponse = {
            success: false,
            error: 'not_found_error',
            message: err.message || 'Resource not found',
            requestId: req.id || Date.now().toString(36) + Math.random().toString(36).substr(2)
        };
    }

    // Add timestamp
    errorResponse.timestamp = new Date().toISOString();
    
    // In development, add stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
};