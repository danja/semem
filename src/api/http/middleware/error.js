// Global error handling middleware
export const errorHandler = (logger) => (err, req, res, next) => {
    logger.error('API Error:', err);

    // Handle known error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: err.message,
            details: err.details
        });
    }

    if (err.name === 'AuthenticationError') {
        return res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }

    // Default error response
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
};