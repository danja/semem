// API Key authentication middleware factory
export const createAuthenticateRequest = (config) => {
    return (req, res, next) => {
        // Check if we're in development mode (for the web UI)
        const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
        
        // Bypass authentication if we're in development mode
        if (isDevelopment) {
            // Add a dummy API client for consistency
            req.apiClient = {
                key: 'dev-mode',
                timestamp: Date.now()
            };
            return next();
        }
        
        const apiKey = req.headers['x-api-key'] || req.query.api_key;

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Missing API key',
                message: 'API key must be provided in X-API-Key header or api_key query parameter'
            });
        }

        try {
            // Get API key from config system
            const validApiKey = config?.get('api.key') || 
                               config?.get('apiKey') || 
                               process.env.SEMEM_API_KEY || 
                               'semem-dev-key';
            
            if (apiKey === validApiKey) {
                // Store API key info in request for potential rate limiting
                req.apiClient = {
                    key: apiKey,
                    timestamp: Date.now()
                };
                next();
            } else {
                res.status(401).json({
                    success: false,
                    error: 'Invalid API key',
                    message: 'The provided API key is not valid'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Authentication error',
                message: 'An error occurred during authentication'
            });
        }
    };
};

// Backward compatibility - default export without config (uses env vars)
export const authenticateRequest = createAuthenticateRequest();