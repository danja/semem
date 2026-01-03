/**
 * Formats API responses with consistent structure and metadata
 */
export default class ResponseFormatter {
    constructor(options = {}) {
        this.config = {
            includeMetadata: options.includeMetadata !== false,
            includeTiming: options.includeTiming !== false,
            includeDebugInfo: options.includeDebugInfo || false,
            compressResponses: options.compressResponses || false,
            standardizeErrors: options.standardizeErrors !== false,
            apiVersion: options.apiVersion || '1.0.0',
            ...options
        };

        this.initializeFormatters();
        this.initializeTemplates();
    }

    /**
     * Initialize response formatters for different content types
     */
    initializeFormatters() {
        this.formatters = {
            success: this.formatSuccessResponse.bind(this),
            error: this.formatErrorResponse.bind(this),
            navigation: this.formatNavigationResponse.bind(this),
            preview: this.formatPreviewResponse.bind(this),
            options: this.formatOptionsResponse.bind(this),
            schema: this.formatSchemaResponse.bind(this),
            health: this.formatHealthResponse.bind(this),
            metrics: this.formatMetricsResponse.bind(this)
        };
    }

    /**
     * Initialize response templates
     */
    initializeTemplates() {
        this.templates = {
            base: {
                success: true,
                data: null,
                metadata: {},
                links: {},
                version: this.config.apiVersion
            },
            error: {
                success: false,
                error: {
                    code: '',
                    message: '',
                    details: null,
                    timestamp: null
                },
                requestId: null,
                version: this.config.apiVersion
            },
            pagination: {
                page: 1,
                limit: 50,
                total: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    }

    /**
     * Main formatting method - routes to appropriate formatter
     * @param {Object} data - Response data to format
     * @param {Object} context - Request context and metadata
     * @returns {Object} Formatted response
     */
    async format(data, context = {}) {
        try {
            // Determine response type
            const responseType = this.determineResponseType(data, context);
            
            // Get appropriate formatter
            const formatter = this.formatters[responseType] || this.formatters.success;
            
            // Format the response
            const formattedResponse = await formatter(data, context);
            
            // Add common metadata
            this.addCommonMetadata(formattedResponse, context);
            
            // Apply post-processing
            return this.postProcessResponse(formattedResponse, context);
            
        } catch (error) {
            // Fallback error formatting
            return this.formatErrorResponse({
                message: `Response formatting failed: ${error.message}`,
                code: 'FORMATTING_ERROR'
            }, context);
        }
    }

    /**
     * Determine response type based on data structure
     */
    determineResponseType(data, context) {
        if (data.success === false || data.error) {
            return 'error';
        }
        
        if (data.navigation && data.content) {
            return 'navigation';
        }
        
        if (data.preview === true) {
            return 'preview';
        }
        
        if (data.options) {
            return 'options';
        }
        
        if (data.schema) {
            return 'schema';
        }
        
        if (data.status && data.checks) {
            return 'health';
        }
        
        if (data.metrics) {
            return 'metrics';
        }
        
        return 'success';
    }

    /**
     * Format success responses
     */
    async formatSuccessResponse(data, context) {
        const response = {
            ...this.templates.base,
            data: this.sanitizeData(data),
            requestId: context.requestId
        };

        // Add timing information
        if (this.config.includeTiming && context.processingTime) {
            response.metadata.timing = {
                processingTime: context.processingTime,
                timestamp: new Date().toISOString()
            };
        }

        // Add pagination if applicable
        if (this.isPaginatedResponse(data)) {
            response.pagination = this.buildPaginationInfo(data, context);
        }

        return response;
    }

    /**
     * Format error responses
     */
    async formatErrorResponse(error, context) {
        const response = {
            ...this.templates.error,
            error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message || 'An unknown error occurred',
                details: this.config.includeDebugInfo ? error.details : null,
                timestamp: new Date().toISOString()
            },
            requestId: context.requestId
        };

        // Add error context if available
        if (error.statusCode) {
            response.error.statusCode = error.statusCode;
        }

        if (error.field) {
            response.error.field = error.field;
        }

        // Add rate limit information for rate limit errors
        if (error.rateLimitInfo) {
            response.error.rateLimit = {
                remaining: error.rateLimitInfo.remaining,
                resetTime: error.rateLimitInfo.resetTime
            };
        }

        return response;
    }

    /**
     * Format navigation responses
     */
    async formatNavigationResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            navigation: {
                parameters: this.formatNavigationParameters(data.navigation),
                results: {
                    format: this.detectContentFormat(data.content),
                    size: this.calculateContentSize(data.content),
                    chunks: this.countChunks(data.content)
                }
            },
            content: this.formatNavigationContent(data.content),
            metadata: this.formatNavigationMetadata(data.metadata),
            version: this.config.apiVersion
        };

        // Add diagnostics in debug mode
        if (this.config.includeDebugInfo && data.diagnostics) {
            response.diagnostics = data.diagnostics;
        }

        // Add performance information
        if (data.metadata?.pipeline) {
            response.performance = {
                totalTime: data.metadata.pipeline.totalTime,
                stages: {
                    selection: data.metadata.pipeline.selectionTime,
                    projection: data.metadata.pipeline.projectionTime,
                    transformation: data.metadata.pipeline.transformTime
                }
            };
        }

        return response;
    }

    /**
     * Format preview responses
     */
    async formatPreviewResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            preview: {
                navigation: this.formatNavigationParameters(data.navigation),
                summary: data.summary,
                sample: {
                    corpuscles: this.formatSampleCorpuscles(data.corpuscles),
                    count: data.corpuscles?.length || 0
                }
            },
            recommendations: this.generateRecommendations(data),
            version: this.config.apiVersion
        };

        return response;
    }

    /**
     * Format options responses
     */
    async formatOptionsResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            options: {
                navigation: {
                    zoom: {
                        levels: data.options.zoomLevels,
                        descriptions: this.getZoomDescriptions()
                    },
                    tilt: {
                        representations: data.options.tiltRepresentations,
                        descriptions: this.getTiltDescriptions()
                    },
                    pan: {
                        filters: ['topic', 'entity', 'corpuscle', 'temporal', 'geographic'],
                        descriptions: this.getPanDescriptions()
                    }
                },
                output: {
                    formats: data.options.outputFormats,
                    encodings: data.options.encodingStrategies,
                    tokenLimits: data.options.maxTokenLimits
                },
                technical: {
                    tokenizers: data.options.supportedTokenizers,
                    models: Object.keys(data.options.maxTokenLimits)
                }
            },
            examples: this.generateUsageExamples(),
            version: this.config.apiVersion
        };

        return response;
    }

    /**
     * Format schema responses
     */
    async formatSchemaResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            schema: {
                parameters: data.schema,
                validation: {
                    required: this.extractRequiredFields(data.schema),
                    optional: this.extractOptionalFields(data.schema)
                },
                examples: data.examples,
                documentation: data.documentation
            },
            version: this.config.apiVersion
        };

        return response;
    }

    /**
     * Format health check responses
     */
    async formatHealthResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            health: {
                status: data.status,
                checks: this.formatHealthChecks(data.checks),
                system: {
                    activeRequests: data.activeRequests,
                    uptime: data.uptime,
                    timestamp: new Date().toISOString()
                }
            },
            version: this.config.apiVersion
        };

        return response;
    }

    /**
     * Format metrics responses
     */
    async formatMetricsResponse(data, context) {
        const response = {
            success: true,
            requestId: data.requestId,
            metrics: {
                api: this.formatApiMetrics(data.metrics.requests),
                components: this.formatComponentMetrics(data.metrics.components),
                system: this.formatSystemMetrics(data.metrics.system),
                timestamp: new Date().toISOString()
            },
            version: this.config.apiVersion
        };

        return response;
    }

    /**
     * Helper methods for data formatting
     */
    formatNavigationParameters(navigation) {
        return {
            zoom: navigation.zoom?.level || navigation.zoom,
            pan: this.formatPanParameters(navigation.pan),
            tilt: navigation.tilt?.representation || navigation.tilt,
            transform: this.formatTransformParameters(navigation.transform)
        };
    }

    formatPanParameters(pan) {
        if (!pan || Object.keys(pan).length === 0) {
            return { applied: false };
        }

        const formatted = { applied: true, filters: {} };

        if (pan.domains) {
            formatted.filters.domains = {
                count: pan.domains.count || (Array.isArray(pan.domains) ? pan.domains.length : 1),
                sample: pan.domains.values ? pan.domains.values.slice(0, 3) : pan.domains
            };
        }

        if (pan.keywords) {
            formatted.filters.keywords = {
                count: pan.keywords.count || (Array.isArray(pan.keywords) ? pan.keywords.length : 1),
                sample: pan.keywords.values ? pan.keywords.values.slice(0, 3) : pan.keywords
            };
        }

        if (pan.entities) {
            formatted.filters.entities = {
                count: pan.entities.count || (Array.isArray(pan.entities) ? pan.entities.length : 1),
                type: pan.entities.type || 'multiple'
            };
        }

        if (pan.temporal) {
            formatted.filters.temporal = {
                hasRange: !!(pan.temporal.start && pan.temporal.end),
                duration: pan.temporal.durationDays
            };
        }

        if (pan.geographic) {
            formatted.filters.geographic = {
                type: pan.geographic.bbox ? 'bbox' : pan.geographic.center ? 'center' : 'unknown',
                area: this.calculateGeographicArea(pan.geographic)
            };
        }

        return formatted;
    }

    formatTransformParameters(transform) {
        if (!transform) return { default: true };

        return {
            maxTokens: transform.maxTokens,
            format: transform.format,
            tokenizer: transform.tokenizer,
            strategy: transform.chunkStrategy,
            metadata: transform.includeMetadata
        };
    }

    formatNavigationContent(content) {
        if (!content) return null;

        if (Array.isArray(content)) {
            // Chunked content
            return {
                type: 'chunked',
                chunks: content.map((chunk, index) => ({
                    id: chunk.chunkId || `chunk_${index}`,
                    size: this.calculateChunkSize(chunk),
                    preview: this.generateContentPreview(chunk)
                })),
                totalChunks: content.length
            };
        } else {
            // Single content
            return {
                type: 'single',
                size: this.calculateContentSize(content),
                format: this.detectContentFormat(content),
                preview: this.generateContentPreview(content)
            };
        }
    }

    formatNavigationMetadata(metadata) {
        if (!metadata) return null;

        const formatted = {
            processing: {
                totalTime: metadata.pipeline?.totalTime,
                stages: metadata.pipeline ? Object.keys(metadata.pipeline).length - 1 : 0
            }
        };

        if (metadata.selection) {
            formatted.selection = {
                corpuscleCount: metadata.selection.resultCount,
                fromCache: metadata.selection.fromCache,
                complexity: metadata.selection.complexity
            };
        }

        if (metadata.projection) {
            formatted.projection = {
                type: metadata.projection.representation,
                processingTime: metadata.projection.processingTime
            };
        }

        if (metadata.transformation) {
            formatted.transformation = {
                format: metadata.transformation.output?.format,
                chunked: metadata.transformation.output?.chunked,
                hasMetadata: metadata.transformation.output?.hasMetadata
            };
        }

        return formatted;
    }

    formatSampleCorpuscles(corpuscles) {
        if (!corpuscles || corpuscles.length === 0) return [];

        return corpuscles.map(corpuscle => ({
            uri: corpuscle.uri,
            type: corpuscle.type,
            score: corpuscle.score,
            preview: this.generateCorpusclePreview(corpuscle)
        }));
    }

    formatHealthChecks(checks) {
        const formatted = {};

        for (const [component, check] of Object.entries(checks)) {
            if (check === null) continue;

            formatted[component] = {
                status: check.status,
                ...(check.metrics && { metrics: check.metrics }),
                ...(check.error && { error: check.error }),
                ...(check.issues && { issues: check.issues })
            };
        }

        return formatted;
    }

    formatApiMetrics(requestMetrics) {
        return {
            requests: {
                total: requestMetrics.totalRequests,
                successful: requestMetrics.successfulRequests,
                failed: requestMetrics.failedRequests,
                successRate: requestMetrics.totalRequests > 0 ? 
                    (requestMetrics.successfulRequests / requestMetrics.totalRequests * 100).toFixed(2) + '%' : '0%'
            },
            performance: {
                avgResponseTime: Math.round(requestMetrics.avgResponseTime),
                unit: 'ms'
            },
            endpoints: this.formatEndpointMetrics(requestMetrics.requestsByEndpoint)
        };
    }

    formatEndpointMetrics(endpointMap) {
        const formatted = {};

        for (const [endpoint, stats] of endpointMap.entries()) {
            formatted[endpoint] = {
                total: stats.total,
                successful: stats.successful,
                successRate: stats.total > 0 ? 
                    (stats.successful / stats.total * 100).toFixed(2) + '%' : '0%'
            };
        }

        return formatted;
    }

    formatComponentMetrics(componentMetrics) {
        const formatted = {};

        for (const [component, metrics] of Object.entries(componentMetrics || {})) {
            if (metrics) {
                formatted[component] = {
                    ...metrics,
                    // Add computed fields if available
                    ...(metrics.cacheHitRate !== undefined && {
                        cachePerformance: (metrics.cacheHitRate * 100).toFixed(1) + '%'
                    })
                };
            }
        }

        return formatted;
    }

    formatSystemMetrics(systemMetrics) {
        return {
            activeRequests: systemMetrics.activeRequests,
            memory: {
                rss: Math.round(systemMetrics.memoryUsage.rss / 1024 / 1024) + ' MB',
                heapUsed: Math.round(systemMetrics.memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                heapTotal: Math.round(systemMetrics.memoryUsage.heapTotal / 1024 / 1024) + ' MB'
            },
            uptime: {
                seconds: Math.round(systemMetrics.uptime),
                formatted: this.formatUptime(systemMetrics.uptime)
            }
        };
    }

    /**
     * Utility methods
     */
    sanitizeData(data) {
        // Remove sensitive information and circular references
        return this.removeCircularReferences(data);
    }

    removeCircularReferences(obj, seen = new WeakSet()) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (seen.has(obj)) return '[Circular Reference]';

        seen.add(obj);

        if (Array.isArray(obj)) {
            return obj.map(item => this.removeCircularReferences(item, seen));
        }

        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip sensitive fields
            if (this.isSensitiveField(key)) continue;
            
            cleaned[key] = this.removeCircularReferences(value, seen);
        }

        return cleaned;
    }

    isSensitiveField(fieldName) {
        const sensitiveFields = ['password', 'secret', 'token', 'key', 'auth'];
        return sensitiveFields.some(field => 
            fieldName.toLowerCase().includes(field)
        );
    }

    detectContentFormat(content) {
        if (!content) return 'unknown';
        
        if (typeof content === 'string') {
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                return 'json';
            }
            if (content.includes('# ') || content.includes('## ')) {
                return 'markdown';
            }
            return 'text';
        }
        
        if (typeof content === 'object') {
            return 'structured';
        }
        
        return 'unknown';
    }

    calculateContentSize(content) {
        if (!content) return 0;
        
        if (typeof content === 'string') {
            return content.length;
        }
        
        return JSON.stringify(content).length;
    }

    calculateChunkSize(chunk) {
        if (!chunk) return 0;
        
        const content = chunk.encoded?.content || chunk.formatted?.content || chunk.content || chunk;
        return this.calculateContentSize(content);
    }

    countChunks(content) {
        if (Array.isArray(content)) {
            return content.length;
        }
        return 1;
    }

    generateContentPreview(content, maxLength = 200) {
        let text = '';
        
        if (typeof content === 'string') {
            text = content;
        } else if (content?.encoded?.content) {
            text = content.encoded.content;
        } else if (content?.formatted?.content) {
            text = content.formatted.content;
        } else if (content?.content) {
            text = content.content;
        } else {
            text = JSON.stringify(content);
        }

        return text.length > maxLength ? 
            text.substring(0, maxLength) + '...' : text;
    }

    generateCorpusclePreview(corpuscle) {
        const content = corpuscle.content || {};
        const preview = content.label || content.prefLabel || content.text || content.content;
        
        if (typeof preview === 'string') {
            return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
        }
        
        return corpuscle.uri || 'Unknown';
    }

    calculateGeographicArea(geographic) {
        if (geographic.bbox) {
            const { minLon, minLat, maxLon, maxLat } = geographic.bbox;
            return (maxLon - minLon) * (maxLat - minLat);
        }
        
        if (geographic.radius) {
            return Math.PI * geographic.radius * geographic.radius;
        }
        
        return 0;
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    isPaginatedResponse(data) {
        return data.page !== undefined || data.limit !== undefined || data.total !== undefined;
    }

    buildPaginationInfo(data, context) {
        return {
            page: data.page || 1,
            limit: data.limit || 50,
            total: data.total || 0,
            hasNext: data.hasNext || false,
            hasPrev: data.hasPrev || false
        };
    }

    addCommonMetadata(response, context) {
        if (!this.config.includeMetadata) return;

        response.metadata = response.metadata || {};
        
        if (context.endpoint) {
            response.metadata.endpoint = context.endpoint;
        }
        
        if (this.config.includeTiming && context.processingTime) {
            response.metadata.timing = {
                processingTime: context.processingTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    postProcessResponse(response, context) {
        // Add HATEOAS links if applicable
        if (context.addLinks) {
            response.links = this.generateHateoasLinks(response, context);
        }

        // Compress response if enabled
        if (this.config.compressResponses) {
            response = this.compressResponse(response);
        }

        return response;
    }

    generateHateoasLinks(response, context) {
        const links = {};
        
        if (response.navigation) {
            links.self = `/api/navigate`;
            links.preview = `/api/navigate/preview`;
            links.options = `/api/navigate/options`;
            links.schema = `/api/navigate/schema`;
        }
        
        return links;
    }

    compressResponse(response) {
        // Simple compression - remove empty fields
        return this.removeEmptyFields(response);
    }

    removeEmptyFields(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeEmptyFields(item)).filter(item => item !== null);
        }
        
        if (obj && typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.removeEmptyFields(value);
                if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '') {
                    cleaned[key] = cleanedValue;
                }
            }
            return Object.keys(cleaned).length > 0 ? cleaned : null;
        }
        
        return obj;
    }

    /**
     * Configuration and documentation helpers
     */
    getZoomDescriptions() {
        return {
            micro: 'Sub-entity attributes and fine-grained components',
            entity: 'Named entities and concrete elements',
            text: 'Full text elements and documents',
            unit: 'Semantic units and meaningful segments',
            community: 'Thematic communities and clusters',
            corpus: 'Entire corpus overview and metadata'
        };
    }

    getTiltDescriptions() {
        return {
            embedding: 'Vector embeddings and similarity analysis',
            keywords: 'Keyword extraction and term analysis',
            graph: 'Graph structure and relationship analysis',
            temporal: 'Temporal sequences and chronological analysis',
            concept: 'Concept extraction and relationship analysis'
        };
    }

    getPanDescriptions() {
        return {
            topic: 'Filter by subject area or theme',
            entity: 'Filter by specific entities or concepts',
            corpuscle: 'Filter by corpuscle scope (ragno:Corpuscle)',
            temporal: 'Filter by time period or date range',
            geographic: 'Filter by location or geographic area'
        };
    }

    generateUsageExamples() {
        return {
            basic: {
                description: 'Basic navigation request',
                request: {
                    zoom: 'unit',
                    tilt: 'keywords'
                }
            },
            filtered: {
                description: 'Navigation with topic filter',
                request: {
                    zoom: 'entity',
                    pan: { topic: 'machine-learning' },
                    tilt: 'embedding'
                }
            },
            advanced: {
                description: 'Advanced navigation with multiple filters',
                request: {
                    zoom: 'text',
                    pan: {
                        topic: 'artificial-intelligence',
                        temporal: {
                            start: '2024-01-01',
                            end: '2024-12-31'
                        }
                    },
                    tilt: 'graph',
                    transform: {
                        maxTokens: 8000,
                        format: 'markdown'
                    }
                }
            }
        };
    }

    extractRequiredFields(schema) {
        const required = [];
        
        for (const [field, config] of Object.entries(schema)) {
            if (config.required) {
                required.push(field);
            }
        }
        
        return required;
    }

    extractOptionalFields(schema) {
        const optional = [];
        
        for (const [field, config] of Object.entries(schema)) {
            if (!config.required) {
                optional.push(field);
            }
        }
        
        return optional;
    }

    generateRecommendations(previewData) {
        const recommendations = [];
        
        if (previewData.summary?.estimatedTokens > 8000) {
            recommendations.push({
                type: 'token_optimization',
                message: 'Consider using chunking for large content',
                suggestion: 'Add "chunkStrategy": "semantic" to transform parameters'
            });
        }
        
        if (previewData.summary?.corpuscleCount < 5) {
            recommendations.push({
                type: 'scope_expansion',
                message: 'Few results found, consider broadening filters',
                suggestion: 'Try using a higher zoom level or removing some pan filters'
            });
        }
        
        if (previewData.summary?.complexity > 8) {
            recommendations.push({
                type: 'complexity_reduction',
                message: 'High complexity detected',
                suggestion: 'Consider simplifying pan filters for better performance'
            });
        }
        
        return recommendations;
    }

    /**
     * Configuration methods
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }

    getFormatterInfo() {
        return {
            config: this.config,
            formatters: Object.keys(this.formatters),
            templates: Object.keys(this.templates)
        };
    }
}
