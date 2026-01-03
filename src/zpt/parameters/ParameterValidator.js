/**
 * Validates ZPT navigation parameters (zoom/pan/tilt)
 */
export default class ParameterValidator {
    constructor() {
        this.schemas = this.initializeSchemas();
    }

    /**
     * Initialize parameter schemas based on ZPT specification
     */
    initializeSchemas() {
        return {
            zoom: {
                type: 'enum',
                values: ['micro', 'entity', 'text', 'unit', 'community', 'corpus'],
                required: true
            },
            pan: {
                type: 'object',
                required: false,
                properties: {
                    domains: { 
                        type: 'array',
                        items: { type: 'string' }
                    },
                    keywords: { 
                        type: 'array',
                        items: { type: 'string' }
                    },
                    entities: { 
                        type: 'array',
                        items: { type: 'string' }
                    },
                    corpuscle: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    temporal: {
                        type: 'object',
                        properties: {
                            start: { type: 'date' },
                            end: { type: 'date' }
                        }
                    },
                    geographic: {
                        type: 'object',
                        properties: {
                            bbox: { 
                                type: 'array',
                                minItems: 4,
                                maxItems: 4
                            },
                            center: {
                                type: 'object',
                                properties: {
                                    lat: { type: 'number', min: -90, max: 90 },
                                    lon: { type: 'number', min: -180, max: 180 }
                                }
                            }
                        }
                    }
                }
            },
            tilt: {
                type: 'enum',
                values: ['embedding', 'keywords', 'graph', 'temporal', 'concept'],
                required: true
            },
            transform: {
                type: 'object',
                required: false,
                properties: {
                    maxTokens: { 
                        type: 'number', 
                        default: 4000,
                        min: 100,
                        max: 128000
                    },
                    format: { 
                        type: 'enum', 
                        values: ['json', 'markdown', 'structured'],
                        default: 'structured'
                    },
                    tokenizer: { 
                        type: 'string', 
                        default: 'cl100k_base'
                    },
                    includeMetadata: {
                        type: 'boolean',
                        default: true
                    },
                    chunkStrategy: {
                        type: 'enum',
                        values: ['semantic', 'fixed', 'adaptive'],
                        default: 'semantic'
                    }
                }
            }
        };
    }

    /**
     * Validate complete ZPT parameter object
     * @param {Object} params - Navigation parameters
     * @returns {Object} Validation result
     */
    validate(params) {
        if (!params || typeof params !== 'object') {
            return {
                valid: false,
                message: 'Parameters must be an object',
                errors: []
            };
        }

        const errors = [];
        const warnings = [];

        // Validate zoom parameter
        const zoomResult = this.validateZoom(params.zoom);
        if (!zoomResult.valid) {
            errors.push({ field: 'zoom', ...zoomResult });
        }

        // Validate tilt parameter
        const tiltResult = this.validateTilt(params.tilt);
        if (!tiltResult.valid) {
            errors.push({ field: 'tilt', ...tiltResult });
        }

        // Validate optional pan parameter
        if (params.pan !== undefined) {
            const panResult = this.validatePan(params.pan);
            if (!panResult.valid) {
                errors.push({ field: 'pan', ...panResult });
            }
        }

        // Validate optional transform parameter
        if (params.transform !== undefined) {
            const transformResult = this.validateTransform(params.transform);
            if (!transformResult.valid) {
                errors.push({ field: 'transform', ...transformResult });
            }
            warnings.push(...(transformResult.warnings || []));
        }

        // Check for unknown parameters
        const knownParams = ['query', 'zoom', 'pan', 'tilt', 'transform'];
        const unknownParams = Object.keys(params).filter(key => !knownParams.includes(key));
        if (unknownParams.length > 0) {
            warnings.push({
                field: 'unknown',
                message: `Unknown parameters: ${unknownParams.join(', ')}`
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            message: errors.length > 0 ? `Validation failed: ${errors[0].message}` : null
        };
    }

    /**
     * Validate zoom parameter
     */
    validateZoom(zoom) {
        const schema = this.schemas.zoom;
        
        if (zoom === undefined || zoom === null) {
            return {
                valid: false,
                message: 'Zoom parameter is required'
            };
        }

        if (!schema.values.includes(zoom)) {
            return {
                valid: false,
                message: `Invalid zoom level. Must be one of: ${schema.values.join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate tilt parameter
     */
    validateTilt(tilt) {
        const schema = this.schemas.tilt;
        
        if (tilt === undefined || tilt === null) {
            return {
                valid: false,
                message: 'Tilt parameter is required'
            };
        }

        if (!schema.values.includes(tilt)) {
            return {
                valid: false,
                message: `Invalid tilt value. Must be one of: ${schema.values.join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate pan parameter
     */
    validatePan(pan) {
        if (!pan || typeof pan !== 'object') {
            return {
                valid: false,
                message: 'Pan parameter must be an object'
            };
        }

        const errors = [];

        // Validate domain filters
        if (pan.domains !== undefined) {
            if (!Array.isArray(pan.domains)) {
                errors.push('Domain filters must be an array');
            } else if (pan.domains.some(d => typeof d !== 'string')) {
                errors.push('All domain filter values must be strings');
            }
        }

        // Validate keyword filters
        if (pan.keywords !== undefined) {
            if (!Array.isArray(pan.keywords)) {
                errors.push('Keyword filters must be an array');
            } else if (pan.keywords.some(k => typeof k !== 'string')) {
                errors.push('All keyword filter values must be strings');
            }
        }

        // Validate entity filters
        if (pan.entities !== undefined) {
            if (!Array.isArray(pan.entities)) {
                errors.push('Entity filters must be an array');
            } else if (pan.entities.some(e => typeof e !== 'string')) {
                errors.push('All entity filter values must be strings');
            }
        }

        // Validate corpuscle filter
        if (pan.corpuscle !== undefined) {
            if (!Array.isArray(pan.corpuscle)) {
                errors.push('Corpuscle filter must be an array');
            } else if (pan.corpuscle.some(c => typeof c !== 'string')) {
                errors.push('All corpuscle filter values must be strings');
            }
        }

        // Validate temporal filter
        if (pan.temporal !== undefined) {
            const temporalResult = this.validateTemporal(pan.temporal);
            if (!temporalResult.valid) {
                errors.push(temporalResult.message);
            }
        }

        // Validate geographic filter
        if (pan.geographic !== undefined) {
            const geoResult = this.validateGeographic(pan.geographic);
            if (!geoResult.valid) {
                errors.push(geoResult.message);
            }
        }

        return {
            valid: errors.length === 0,
            message: errors.length > 0 ? errors[0] : null,
            errors
        };
    }

    /**
     * Validate temporal filter
     */
    validateTemporal(temporal) {
        if (!temporal || typeof temporal !== 'object') {
            return {
                valid: false,
                message: 'Temporal filter must be an object'
            };
        }

        const { start, end } = temporal;

        if (start) {
            const startDate = new Date(start);
            if (isNaN(startDate.getTime())) {
                return {
                    valid: false,
                    message: 'Invalid start date format'
                };
            }
        }

        if (end) {
            const endDate = new Date(end);
            if (isNaN(endDate.getTime())) {
                return {
                    valid: false,
                    message: 'Invalid end date format'
                };
            }
        }

        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (startDate > endDate) {
                return {
                    valid: false,
                    message: 'Start date must be before end date'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Validate geographic filter
     */
    validateGeographic(geographic) {
        if (!geographic || typeof geographic !== 'object') {
            return {
                valid: false,
                message: 'Geographic filter must be an object'
            };
        }

        if (geographic.bbox) {
            if (!Array.isArray(geographic.bbox) || geographic.bbox.length !== 4) {
                return {
                    valid: false,
                    message: 'Bounding box must be an array of 4 numbers [minLon, minLat, maxLon, maxLat]'
                };
            }
            
            const [minLon, minLat, maxLon, maxLat] = geographic.bbox;
            if (![minLon, minLat, maxLon, maxLat].every(n => typeof n === 'number')) {
                return {
                    valid: false,
                    message: 'All bounding box values must be numbers'
                };
            }

            if (minLon >= maxLon || minLat >= maxLat) {
                return {
                    valid: false,
                    message: 'Invalid bounding box coordinates'
                };
            }
        }

        if (geographic.center) {
            const { lat, lon } = geographic.center;
            if (typeof lat !== 'number' || typeof lon !== 'number') {
                return {
                    valid: false,
                    message: 'Center coordinates must be numbers'
                };
            }

            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return {
                    valid: false,
                    message: 'Invalid center coordinates'
                };
            }
        }

        return { valid: true };
    }

    /**
     * Validate transform parameter
     */
    validateTransform(transform) {
        if (!transform || typeof transform !== 'object') {
            return {
                valid: false,
                message: 'Transform parameter must be an object'
            };
        }

        const errors = [];
        const warnings = [];
        const schema = this.schemas.transform.properties;

        // Validate maxTokens
        if (transform.maxTokens !== undefined) {
            if (typeof transform.maxTokens !== 'number' || transform.maxTokens <= 0) {
                errors.push('maxTokens must be a positive number');
            } else if (transform.maxTokens < schema.maxTokens.min) {
                errors.push(`maxTokens must be at least ${schema.maxTokens.min}`);
            } else if (transform.maxTokens > schema.maxTokens.max) {
                warnings.push(`maxTokens exceeds recommended maximum of ${schema.maxTokens.max}`);
            }
        }

        // Validate format
        if (transform.format !== undefined) {
            if (!schema.format.values.includes(transform.format)) {
                errors.push(`Invalid format. Must be one of: ${schema.format.values.join(', ')}`);
            }
        }

        // Validate tokenizer
        if (transform.tokenizer !== undefined) {
            if (typeof transform.tokenizer !== 'string') {
                errors.push('Tokenizer must be a string');
            }
        }

        // Validate includeMetadata
        if (transform.includeMetadata !== undefined) {
            if (typeof transform.includeMetadata !== 'boolean') {
                errors.push('includeMetadata must be a boolean');
            }
        }

        // Validate chunkStrategy
        if (transform.chunkStrategy !== undefined) {
            if (!schema.chunkStrategy.values.includes(transform.chunkStrategy)) {
                errors.push(`Invalid chunkStrategy. Must be one of: ${schema.chunkStrategy.values.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            message: errors.length > 0 ? errors[0] : null,
            errors,
            warnings
        };
    }

    /**
     * Get parameter schema for documentation
     */
    getSchema() {
        return this.schemas;
    }

    /**
     * Get default values for optional parameters
     */
    getDefaults() {
        return {
            transform: {
                maxTokens: this.schemas.transform.properties.maxTokens.default,
                format: this.schemas.transform.properties.format.default,
                tokenizer: this.schemas.transform.properties.tokenizer.default,
                includeMetadata: this.schemas.transform.properties.includeMetadata.default,
                chunkStrategy: this.schemas.transform.properties.chunkStrategy.default
            }
        };
    }
}
