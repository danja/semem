/**
 * Parses and normalizes HTTP requests for ZPT navigation API
 */
export default class RequestParser {
    constructor(options = {}) {
        this.config = {
            maxBodySize: options.maxBodySize || 10 * 1024 * 1024, // 10MB
            allowedContentTypes: options.allowedContentTypes || [
                'application/json',
                'application/x-www-form-urlencoded',
                'multipart/form-data'
            ],
            strictMode: options.strictMode !== false,
            parseQueryParams: options.parseQueryParams !== false,
            parseHeaders: options.parseHeaders !== false,
            extractClientInfo: options.extractClientInfo !== false,
            ...options
        };

        this.initializeValidators();
    }

    /**
     * Initialize request validators
     */
    initializeValidators() {
        this.validators = {
            contentType: this.validateContentType.bind(this),
            bodySize: this.validateBodySize.bind(this),
            method: this.validateMethod.bind(this),
            path: this.validatePath.bind(this),
            headers: this.validateHeaders.bind(this)
        };

        this.supportedMethods = ['GET', 'POST', 'OPTIONS', 'HEAD'];
        this.requiredHeaders = ['content-type', 'user-agent'];
    }

    /**
     * Main parsing method - extracts and normalizes request data
     * @param {Object} req - HTTP request object
     * @returns {Promise<Object>} Parsed request data
     */
    async parse(req) {
        const startTime = Date.now();

        try {
            // Extract basic request information
            const basicInfo = this.extractBasicInfo(req);
            
            // Validate request structure
            await this.validateRequest(req, basicInfo);
            
            // Parse request components
            const parsedComponents = await this.parseComponents(req, basicInfo);
            
            // Extract client information
            const clientInfo = this.config.extractClientInfo ? 
                this.extractClientInfo(req) : {};
            
            // Build complete parsed request
            const parsedRequest = {
                ...basicInfo,
                ...parsedComponents,
                ...clientInfo,
                metadata: {
                    parseTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    parser: 'RequestParser-1.0.0'
                }
            };

            return parsedRequest;

        } catch (error) {
            throw new Error(`Request parsing failed: ${error.message}`);
        }
    }

    /**
     * Extract basic request information
     */
    extractBasicInfo(req) {
        return {
            method: (req.method || 'GET').toUpperCase(),
            path: this.normalizePath(req.url || req.path || '/'),
            protocol: req.protocol || (req.connection?.encrypted ? 'https' : 'http'),
            httpVersion: req.httpVersion || '1.1',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate complete request structure
     */
    async validateRequest(req, basicInfo) {
        const validationResults = [];

        // Run all validators
        for (const [name, validator] of Object.entries(this.validators)) {
            try {
                const result = await validator(req, basicInfo);
                if (!result.valid) {
                    validationResults.push({
                        validator: name,
                        error: result.error,
                        critical: result.critical !== false
                    });
                }
            } catch (error) {
                validationResults.push({
                    validator: name,
                    error: error.message,
                    critical: true
                });
            }
        }

        // Check for critical validation failures
        const criticalErrors = validationResults.filter(r => r.critical);
        if (criticalErrors.length > 0) {
            const errorMessage = criticalErrors.map(e => `${e.validator}: ${e.error}`).join('; ');
            throw new Error(`Critical validation errors: ${errorMessage}`);
        }

        // Log non-critical warnings
        const warnings = validationResults.filter(r => !r.critical);
        if (warnings.length > 0) {
            console.warn('Request validation warnings:', warnings);
        }
    }

    /**
     * Parse all request components
     */
    async parseComponents(req, basicInfo) {
        const components = {};

        // Parse headers
        if (this.config.parseHeaders) {
            components.headers = this.parseHeaders(req);
        }

        // Parse query parameters
        if (this.config.parseQueryParams) {
            components.query = this.parseQueryParams(basicInfo.path);
        }

        // Parse request body
        if (this.shouldParseBody(basicInfo.method)) {
            components.body = await this.parseBody(req, components.headers);
        }

        // Parse cookies
        if (components.headers?.cookie) {
            components.cookies = this.parseCookies(components.headers.cookie);
        }

        return components;
    }

    /**
     * Parse request headers
     */
    parseHeaders(req) {
        const headers = {};
        
        // Normalize header names to lowercase
        for (const [key, value] of Object.entries(req.headers || {})) {
            headers[key.toLowerCase()] = value;
        }

        // Extract special headers
        const specialHeaders = {
            contentType: headers['content-type'],
            contentLength: headers['content-length'] ? parseInt(headers['content-length']) : undefined,
            userAgent: headers['user-agent'],
            authorization: headers['authorization'],
            accept: headers['accept'],
            acceptEncoding: headers['accept-encoding'],
            acceptLanguage: headers['accept-language'],
            origin: headers['origin'],
            referer: headers['referer'],
            xForwardedFor: headers['x-forwarded-for'],
            xRealIp: headers['x-real-ip']
        };

        return {
            raw: headers,
            ...specialHeaders
        };
    }

    /**
     * Parse query parameters from URL
     */
    parseQueryParams(path) {
        const queryIndex = path.indexOf('?');
        if (queryIndex === -1) return {};

        const queryString = path.substring(queryIndex + 1);
        const params = {};

        queryString.split('&').forEach(param => {
            const [key, value] = param.split('=').map(decodeURIComponent);
            if (key) {
                if (params[key]) {
                    // Handle multiple values for same parameter
                    if (Array.isArray(params[key])) {
                        params[key].push(value || '');
                    } else {
                        params[key] = [params[key], value || ''];
                    }
                } else {
                    params[key] = value || '';
                }
            }
        });

        return params;
    }

    /**
     * Parse request body based on content type
     */
    async parseBody(req, headers) {
        const contentType = headers?.contentType || '';
        const contentLength = headers?.contentLength || 0;

        // Validate body size
        if (contentLength > this.config.maxBodySize) {
            throw new Error(`Request body too large: ${contentLength} > ${this.config.maxBodySize}`);
        }

        // Read raw body data
        const rawBody = await this.readRawBody(req);

        // Parse based on content type
        if (contentType.includes('application/json')) {
            return this.parseJsonBody(rawBody);
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            return this.parseFormBody(rawBody);
        } else if (contentType.includes('multipart/form-data')) {
            return this.parseMultipartBody(rawBody, contentType);
        } else if (contentType.includes('text/')) {
            return { text: rawBody.toString('utf8') };
        } else {
            // Return raw data for unknown content types
            return { raw: rawBody };
        }
    }

    /**
     * Read raw body data from request stream
     */
    async readRawBody(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let totalSize = 0;

            req.on('data', chunk => {
                totalSize += chunk.length;
                
                if (totalSize > this.config.maxBodySize) {
                    reject(new Error(`Request body too large: ${totalSize} > ${this.config.maxBodySize}`));
                    return;
                }
                
                chunks.push(chunk);
            });

            req.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            req.on('error', error => {
                reject(new Error(`Failed to read request body: ${error.message}`));
            });

            // Timeout for reading body
            const timeout = setTimeout(() => {
                reject(new Error('Request body read timeout'));
            }, 30000); // 30 seconds

            req.on('end', () => clearTimeout(timeout));
            req.on('error', () => clearTimeout(timeout));
        });
    }

    /**
     * Parse JSON body
     */
    parseJsonBody(rawBody) {
        try {
            const jsonString = rawBody.toString('utf8');
            const parsed = JSON.parse(jsonString);
            
            return {
                json: parsed,
                raw: jsonString,
                size: rawBody.length
            };
        } catch (error) {
            throw new Error(`Invalid JSON body: ${error.message}`);
        }
    }

    /**
     * Parse form-encoded body
     */
    parseFormBody(rawBody) {
        try {
            const formString = rawBody.toString('utf8');
            const params = {};

            formString.split('&').forEach(param => {
                const [key, value] = param.split('=').map(decodeURIComponent);
                if (key) {
                    params[key] = value || '';
                }
            });

            return {
                form: params,
                raw: formString,
                size: rawBody.length
            };
        } catch (error) {
            throw new Error(`Invalid form body: ${error.message}`);
        }
    }

    /**
     * Parse multipart form data (simplified implementation)
     */
    parseMultipartBody(rawBody, contentType) {
        // Extract boundary from content type
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) {
            throw new Error('Missing boundary in multipart content type');
        }

        const boundary = '--' + boundaryMatch[1];
        const bodyString = rawBody.toString('utf8');
        const parts = bodyString.split(boundary).filter(part => part.trim().length > 0);

        const fields = {};
        const files = [];

        parts.forEach(part => {
            if (part.includes('Content-Disposition')) {
                const { name, filename, content } = this.parseMultipartPart(part);
                
                if (filename) {
                    // File upload
                    files.push({ name, filename, content });
                } else {
                    // Form field
                    fields[name] = content;
                }
            }
        });

        return {
            multipart: { fields, files },
            raw: bodyString,
            size: rawBody.length
        };
    }

    /**
     * Parse individual multipart part
     */
    parseMultipartPart(part) {
        const lines = part.split('\r\n');
        let headersParsed = false;
        let name, filename;
        const contentLines = [];

        for (const line of lines) {
            if (!headersParsed) {
                if (line.trim() === '') {
                    headersParsed = true;
                    continue;
                }

                // Parse Content-Disposition header
                if (line.includes('Content-Disposition')) {
                    const nameMatch = line.match(/name="([^"]+)"/);
                    const filenameMatch = line.match(/filename="([^"]+)"/);
                    
                    if (nameMatch) name = nameMatch[1];
                    if (filenameMatch) filename = filenameMatch[1];
                }
            } else {
                contentLines.push(line);
            }
        }

        return {
            name,
            filename,
            content: contentLines.join('\r\n').trim()
        };
    }

    /**
     * Parse cookies from header
     */
    parseCookies(cookieHeader) {
        const cookies = {};
        
        cookieHeader.split(';').forEach(cookie => {
            const [key, value] = cookie.split('=').map(s => s.trim());
            if (key && value) {
                cookies[key] = decodeURIComponent(value);
            }
        });

        return cookies;
    }

    /**
     * Extract client information
     */
    extractClientInfo(req) {
        const socket = req.socket || req.connection;
        
        return {
            clientIp: this.extractClientIp(req),
            userAgent: req.headers?.['user-agent'],
            acceptLanguage: req.headers?.['accept-language'],
            origin: req.headers?.origin,
            referer: req.headers?.referer,
            connectionInfo: {
                remoteAddress: socket?.remoteAddress,
                remotePort: socket?.remotePort,
                localAddress: socket?.localAddress,
                localPort: socket?.localPort,
                encrypted: !!socket?.encrypted
            }
        };
    }

    /**
     * Extract real client IP address
     */
    extractClientIp(req) {
        // Check various headers for real IP
        const xForwardedFor = req.headers?.['x-forwarded-for'];
        const xRealIp = req.headers?.['x-real-ip'];
        const cfConnectingIp = req.headers?.['cf-connecting-ip'];
        const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress;

        if (xForwardedFor) {
            // X-Forwarded-For can contain multiple IPs, take the first one
            return xForwardedFor.split(',')[0].trim();
        }

        return xRealIp || cfConnectingIp || socketIp || 'unknown';
    }

    /**
     * Request validators
     */
    validateContentType(req, basicInfo) {
        if (basicInfo.method === 'GET' || basicInfo.method === 'HEAD') {
            return { valid: true };
        }

        const contentType = req.headers?.['content-type'];
        if (!contentType) {
            return {
                valid: false,
                error: 'Missing Content-Type header',
                critical: this.config.strictMode
            };
        }

        const isAllowed = this.config.allowedContentTypes.some(allowed => 
            contentType.toLowerCase().includes(allowed.toLowerCase())
        );

        if (!isAllowed) {
            return {
                valid: false,
                error: `Unsupported Content-Type: ${contentType}`,
                critical: this.config.strictMode
            };
        }

        return { valid: true };
    }

    validateBodySize(req, basicInfo) {
        const contentLength = parseInt(req.headers?.['content-length'] || '0');
        
        if (contentLength > this.config.maxBodySize) {
            return {
                valid: false,
                error: `Content-Length exceeds maximum: ${contentLength} > ${this.config.maxBodySize}`,
                critical: true
            };
        }

        return { valid: true };
    }

    validateMethod(req, basicInfo) {
        if (!this.supportedMethods.includes(basicInfo.method)) {
            return {
                valid: false,
                error: `Unsupported HTTP method: ${basicInfo.method}`,
                critical: true
            };
        }

        return { valid: true };
    }

    validatePath(req, basicInfo) {
        const path = basicInfo.path;
        
        // Basic path validation
        if (!path || path.length === 0) {
            return {
                valid: false,
                error: 'Empty request path',
                critical: true
            };
        }

        if (path.length > 2048) {
            return {
                valid: false,
                error: 'Request path too long',
                critical: true
            };
        }

        // Check for suspicious patterns
        const suspiciousPatterns = ['../', '\\', '<script', 'javascript:'];
        const hasSuspiciousContent = suspiciousPatterns.some(pattern => 
            path.toLowerCase().includes(pattern)
        );

        if (hasSuspiciousContent) {
            return {
                valid: false,
                error: 'Suspicious content in request path',
                critical: true
            };
        }

        return { valid: true };
    }

    validateHeaders(req, basicInfo) {
        const headers = req.headers || {};
        const issues = [];

        // Check required headers in strict mode
        if (this.config.strictMode) {
            this.requiredHeaders.forEach(header => {
                if (!headers[header] && !headers[header.toLowerCase()]) {
                    issues.push(`Missing required header: ${header}`);
                }
            });
        }

        // Validate header values
        if (headers['user-agent'] && headers['user-agent'].length > 512) {
            issues.push('User-Agent header too long');
        }

        if (headers['origin'] && !this.isValidOrigin(headers['origin'])) {
            issues.push('Invalid Origin header format');
        }

        if (issues.length > 0) {
            return {
                valid: false,
                error: issues.join('; '),
                critical: this.config.strictMode
            };
        }

        return { valid: true };
    }

    /**
     * Utility methods
     */
    normalizePath(path) {
        // Remove query string for path normalization
        const cleanPath = path.split('?')[0];
        
        // Ensure path starts with /
        return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    }

    shouldParseBody(method) {
        return ['POST', 'PUT', 'PATCH'].includes(method);
    }

    isValidOrigin(origin) {
        try {
            new URL(origin);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get parser configuration and stats
     */
    getParserInfo() {
        return {
            config: this.config,
            supportedMethods: this.supportedMethods,
            allowedContentTypes: this.config.allowedContentTypes,
            validators: Object.keys(this.validators)
        };
    }

    /**
     * Update parser configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }

    /**
     * Validate parser configuration
     */
    validateConfig() {
        const issues = [];

        if (!this.config.maxBodySize || this.config.maxBodySize <= 0) {
            issues.push('Invalid maxBodySize configuration');
        }

        if (!Array.isArray(this.config.allowedContentTypes) || this.config.allowedContentTypes.length === 0) {
            issues.push('Invalid allowedContentTypes configuration');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}