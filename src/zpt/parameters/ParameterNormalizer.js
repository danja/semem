/**
 * Normalizes and standardizes ZPT navigation parameters
 */
export default class ParameterNormalizer {
    constructor() {
        this.defaults = this.initializeDefaults();
    }

    /**
     * Initialize default values for parameters
     */
    initializeDefaults() {
        return {
            pan: {},
            transform: {
                maxTokens: 4000,
                format: 'structured',
                tokenizer: 'cl100k_base',
                includeMetadata: true,
                chunkStrategy: 'semantic'
            }
        };
    }

    /**
     * Normalize complete parameter object
     * @param {Object} params - Raw navigation parameters
     * @returns {Object} Normalized parameters
     */
    normalize(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Parameters must be an object');
        }

        const normalized = {
            zoom: this.normalizeZoom(params.zoom),
            pan: this.normalizePan(params.pan),
            tilt: this.normalizeTilt(params.tilt),
            transform: this.normalizeTransform(params.transform)
        };

        // Add computed metadata
        normalized._metadata = {
            normalizedAt: new Date().toISOString(),
            hasFilters: this.hasFilters(normalized.pan),
            tokenBudget: normalized.transform.maxTokens,
            complexity: this.calculateComplexity(normalized)
        };

        return normalized;
    }

    /**
     * Normalize zoom parameter
     */
    normalizeZoom(zoom) {
        if (!zoom) {
            throw new Error('Zoom parameter is required');
        }

        return {
            level: zoom,
            granularity: this.getZoomGranularity(zoom),
            targetTypes: this.getTargetTypes(zoom)
        };
    }

    /**
     * Normalize pan parameter with filters
     */
    normalizePan(pan = {}) {
        const normalized = {
            topic: this.normalizeTopicFilter(pan.topic),
            entity: this.normalizeEntityFilter(pan.entity),
            temporal: this.normalizeTemporalFilter(pan.temporal),
            geographic: this.normalizeGeographicFilter(pan.geographic)
        };

        // Remove undefined filters
        Object.keys(normalized).forEach(key => {
            if (normalized[key] === undefined) {
                delete normalized[key];
            }
        });

        return normalized;
    }

    /**
     * Normalize tilt parameter
     */
    normalizeTilt(tilt) {
        if (!tilt) {
            throw new Error('Tilt parameter is required');
        }

        return {
            representation: tilt,
            outputFormat: this.getTiltOutputFormat(tilt),
            processingType: this.getTiltProcessingType(tilt)
        };
    }

    /**
     * Normalize transform parameter with defaults
     */
    normalizeTransform(transform = {}) {
        const normalized = {
            ...this.defaults.transform,
            ...transform
        };

        // Validate and adjust token limits
        normalized.maxTokens = Math.max(100, Math.min(128000, normalized.maxTokens));

        // Add computed transform properties
        normalized.tokenBudget = {
            content: Math.floor(normalized.maxTokens * 0.8),
            metadata: Math.floor(normalized.maxTokens * 0.15),
            overhead: Math.floor(normalized.maxTokens * 0.05)
        };

        // Set chunk size based on strategy
        normalized.chunkSize = this.calculateChunkSize(normalized);

        return normalized;
    }

    /**
     * Normalize topic filter
     */
    normalizeTopicFilter(topic) {
        if (!topic) return undefined;

        return {
            value: topic.toLowerCase().trim(),
            pattern: topic.includes('*') ? 'wildcard' : 'exact',
            namespace: this.extractNamespace(topic)
        };
    }

    /**
     * Normalize entity filter
     */
    normalizeEntityFilter(entities) {
        if (!entities || !Array.isArray(entities)) return undefined;

        return {
            values: entities.map(e => e.trim()),
            count: entities.length,
            type: entities.length === 1 ? 'single' : 'multiple'
        };
    }

    /**
     * Normalize temporal filter
     */
    normalizeTemporalFilter(temporal) {
        if (!temporal) return undefined;

        const normalized = {};

        if (temporal.start) {
            normalized.start = new Date(temporal.start).toISOString();
        }

        if (temporal.end) {
            normalized.end = new Date(temporal.end).toISOString();
        }

        // Calculate duration if both dates are provided
        if (normalized.start && normalized.end) {
            const startDate = new Date(normalized.start);
            const endDate = new Date(normalized.end);
            normalized.duration = endDate.getTime() - startDate.getTime();
            normalized.durationDays = Math.ceil(normalized.duration / (1000 * 60 * 60 * 24));
        }

        return normalized;
    }

    /**
     * Normalize geographic filter
     */
    normalizeGeographicFilter(geographic) {
        if (!geographic) return undefined;

        const normalized = {};

        if (geographic.bbox) {
            const [minLon, minLat, maxLon, maxLat] = geographic.bbox;
            normalized.bbox = {
                minLon, minLat, maxLon, maxLat,
                width: maxLon - minLon,
                height: maxLat - minLat,
                area: (maxLon - minLon) * (maxLat - minLat)
            };
        }

        if (geographic.center) {
            normalized.center = {
                lat: geographic.center.lat,
                lon: geographic.center.lon
            };
        }

        // Add radius if specified
        if (geographic.radius) {
            normalized.radius = geographic.radius;
        }

        return normalized;
    }

    /**
     * Get zoom granularity level
     */
    getZoomGranularity(zoom) {
        const granularityMap = {
            'corpus': 1,    // Highest level overview
            'community': 2, // Community-level aggregation
            'unit': 3,      // Semantic unit level
            'entity': 4,    // Individual entities
            'text': 5       // Full text detail
        };
        return granularityMap[zoom] || 3;
    }

    /**
     * Get target element types for zoom level
     */
    getTargetTypes(zoom) {
        const typeMap = {
            'corpus': ['ragno:Corpus'],
            'community': ['ragno:Community'],
            'unit': ['ragno:SemanticUnit', 'ragno:Unit'],
            'entity': ['ragno:Entity'],
            'text': ['ragno:TextElement', 'ragno:Text']
        };
        return typeMap[zoom] || [];
    }

    /**
     * Get tilt output format
     */
    getTiltOutputFormat(tilt) {
        const formatMap = {
            'embedding': 'vector',
            'keywords': 'text',
            'graph': 'structured',
            'temporal': 'sequence'
        };
        return formatMap[tilt] || 'text';
    }

    /**
     * Get tilt processing type
     */
    getTiltProcessingType(tilt) {
        const processingMap = {
            'embedding': 'vectorization',
            'keywords': 'extraction',
            'graph': 'relationship',
            'temporal': 'chronological'
        };
        return processingMap[tilt] || 'extraction';
    }

    /**
     * Calculate chunk size based on strategy
     */
    calculateChunkSize(transform) {
        const baseSize = transform.tokenBudget.content;
        
        switch (transform.chunkStrategy) {
            case 'fixed':
                return Math.floor(baseSize / 4); // Fixed chunks
            case 'adaptive':
                return { min: Math.floor(baseSize / 8), max: Math.floor(baseSize / 2) };
            case 'semantic':
            default:
                return { target: Math.floor(baseSize / 3), overlap: 50 };
        }
    }

    /**
     * Extract namespace from topic string
     */
    extractNamespace(topic) {
        if (topic.includes(':')) {
            return topic.split(':')[0];
        }
        return 'default';
    }

    /**
     * Check if pan has any active filters
     */
    hasFilters(pan) {
        return Object.keys(pan).length > 0;
    }

    /**
     * Calculate parameter complexity score
     */
    calculateComplexity(params) {
        let complexity = 0;

        // Base complexity from zoom level
        complexity += params.zoom.granularity;

        // Add complexity for filters
        if (params.pan.topic) complexity += 1;
        if (params.pan.entity) complexity += params.pan.entity.count;
        if (params.pan.temporal) complexity += 2;
        if (params.pan.geographic) complexity += 3;

        // Add complexity for tilt processing
        const tiltComplexity = {
            'keywords': 1,
            'temporal': 2,
            'graph': 3,
            'embedding': 4
        };
        complexity += tiltComplexity[params.tilt.representation] || 1;

        return Math.min(complexity, 10); // Cap at 10
    }

    /**
     * Create a hash of normalized parameters for caching
     */
    createParameterHash(normalizedParams) {
        const hashSource = {
            zoom: normalizedParams.zoom.level,
            pan: normalizedParams.pan,
            tilt: normalizedParams.tilt.representation,
            transform: {
                maxTokens: normalizedParams.transform.maxTokens,
                format: normalizedParams.transform.format,
                chunkStrategy: normalizedParams.transform.chunkStrategy
            }
        };

        return this.simpleHash(JSON.stringify(hashSource));
    }

    /**
     * Simple hash function for parameter caching
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Validate that normalized parameters are complete
     */
    validateNormalized(normalizedParams) {
        const required = ['zoom', 'pan', 'tilt', 'transform'];
        const missing = required.filter(field => !normalizedParams[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required normalized fields: ${missing.join(', ')}`);
        }

        return true;
    }

    /**
     * Get parameter summary for logging
     */
    getParameterSummary(normalizedParams) {
        return {
            zoom: normalizedParams.zoom.level,
            filters: Object.keys(normalizedParams.pan).length,
            tilt: normalizedParams.tilt.representation,
            complexity: normalizedParams._metadata.complexity,
            tokenBudget: normalizedParams.transform.maxTokens
        };
    }
}