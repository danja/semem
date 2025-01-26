// Request logging middleware
export const requestLogger = (logger) => (req, res, next) => {
    const start = Date.now();
    
    // Log request
    logger.info(`${req.method} ${req.url}`, {
        headers: req.headers,
        query: req.query,
        body: req.body
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });

    next();
};