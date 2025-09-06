/**
 * Preserves ZPT navigation context and metadata in formatted outputs
 */
export default class MetadataEncoder {
    constructor(options = {}) {
        this.config = {
            encoding: options.encoding || 'structured',
            includeNavigation: options.includeNavigation !== false,
            includeTimestamps: options.includeTimestamps !== false,
            includeProvenance: options.includeProvenance !== false,
            includeMetrics: options.includeMetrics !== false,
            compressionLevel: options.compressionLevel || 'medium',
            preservePrivacy: options.preservePrivacy || false,
            ...options
        };

        this.initializeEncodingStrategies();
        this.initializeMetadataSchemas();
        this.initializeCompressionLevels();
    }

    /**
     * Initialize metadata encoding strategies
     */
    initializeEncodingStrategies() {
        this.encodingStrategies = {
            structured: {
                name: 'Structured Metadata',
                handler: this.encodeStructured.bind(this),
                description: 'Comprehensive structured metadata with full context',
                overhead: 'high',
                readability: 'high'
            },
            compact: {
                name: 'Compact Encoding',
                handler: this.encodeCompact.bind(this),
                description: 'Compressed metadata with essential information only',
                overhead: 'low',
                readability: 'medium'
            },
            inline: {
                name: 'Inline Markers',
                handler: this.encodeInline.bind(this),
                description: 'Embedded metadata markers within content',
                overhead: 'minimal',
                readability: 'low'
            },
            header: {
                name: 'Header Metadata',
                handler: this.encodeHeader.bind(this),
                description: 'Metadata in document header/frontmatter',
                overhead: 'medium',
                readability: 'high'
            },
            footer: {
                name: 'Footer Metadata',
                handler: this.encodeFooter.bind(this),
                description: 'Metadata appended at document end',
                overhead: 'medium',
                readability: 'medium'
            },
            distributed: {
                name: 'Distributed Encoding',
                handler: this.encodeDistributed.bind(this),
                description: 'Metadata distributed throughout content sections',
                overhead: 'medium',
                readability: 'high'
            }
        };
    }

    /**
     * Initialize metadata schemas for different contexts
     */
    initializeMetadataSchemas() {
        this.schemas = {
            navigation: {
                fields: ['zoom', 'pan', 'tilt', 'timestamp', 'sessionId'],
                required: ['zoom', 'tilt'],
                description: 'ZPT navigation parameters and context'
            },
            provenance: {
                fields: ['source', 'method', 'filters', 'transformations', 'timestamp'],
                required: ['source', 'method'],
                description: 'Data origin and processing history'
            },
            performance: {
                fields: ['processingTime', 'tokenCount', 'chunkCount', 'cacheHits'],
                required: ['processingTime'],
                description: 'Performance and processing metrics'
            },
            quality: {
                fields: ['confidence', 'completeness', 'relevance', 'coherence'],
                required: ['confidence'],
                description: 'Content quality indicators'
            },
            technical: {
                fields: ['version', 'model', 'tokenizer', 'parameters'],
                required: ['version'],
                description: 'Technical implementation details'
            }
        };
    }

    /**
     * Initialize compression levels
     */
    initializeCompressionLevels() {
        this.compressionLevels = {
            minimal: {
                includeFields: ['zoom', 'tilt', 'timestamp'],
                omitDetails: true,
                abbreviate: true,
                description: 'Absolute minimum metadata'
            },
            low: {
                includeFields: ['zoom', 'pan', 'tilt', 'timestamp', 'processingTime'],
                omitDetails: true,
                abbreviate: false,
                description: 'Essential navigation and timing info'
            },
            medium: {
                includeFields: ['zoom', 'pan', 'tilt', 'timestamp', 'processingTime', 'source', 'confidence'],
                omitDetails: false,
                abbreviate: false,
                description: 'Balanced metadata with key quality indicators'
            },
            high: {
                includeFields: 'all',
                omitDetails: false,
                abbreviate: false,
                description: 'Complete metadata with full context'
            },
            full: {
                includeFields: 'all',
                omitDetails: false,
                abbreviate: false,
                includeDebug: true,
                description: 'Full metadata including debug information'
            }
        };
    }

    /**
     * Main encoding method - embeds metadata into formatted content
     * @param {Object} formattedContent - Content from PromptFormatter
     * @param {Object} fullContext - Complete processing context
     * @param {Object} options - Encoding options
     * @returns {Object} Content with embedded metadata
     */
    async encode(formattedContent, fullContext, options = {}) {
        const startTime = Date.now();
        const opts = { ...this.config, ...options };

        try {
            // Extract and normalize metadata
            const extractedMetadata = this.extractMetadata(fullContext, opts);
            
            // Apply compression
            const compressedMetadata = this.compressMetadata(extractedMetadata, opts);
            
            // Apply privacy filters
            const filteredMetadata = this.applyPrivacyFilters(compressedMetadata, opts);
            
            // Select encoding strategy
            const strategy = opts.encoding || this.config.encoding;
            const encoder = this.encodingStrategies[strategy];
            
            if (!encoder) {
                throw new Error(`Unknown encoding strategy: ${strategy}`);
            }

            // Encode metadata into content
            const encodedContent = await encoder.handler(
                formattedContent, 
                filteredMetadata, 
                opts
            );

            // Add encoding metadata
            const result = {
                content: encodedContent,
                metadata: {
                    encoding: {
                        strategy,
                        compressionLevel: opts.compressionLevel,
                        overhead: this.calculateOverhead(encodedContent, formattedContent),
                        processingTime: Date.now() - startTime
                    },
                    preserved: filteredMetadata,
                    original: extractedMetadata
                }
            };

            return result;

        } catch (error) {
            throw new Error(`Metadata encoding failed: ${error.message}`);
        }
    }

    /**
     * Extract comprehensive metadata from processing context
     */
    extractMetadata(fullContext, options) {
        const metadata = {
            navigation: this.extractNavigationMetadata(fullContext),
            provenance: this.extractProvenanceMetadata(fullContext),
            performance: this.extractPerformanceMetadata(fullContext),
            quality: this.extractQualityMetadata(fullContext),
            technical: this.extractTechnicalMetadata(fullContext),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };

        // Add session tracking
        if (options.sessionId) {
            metadata.session = {
                id: options.sessionId,
                sequence: options.sequenceNumber || 1,
                context: options.sessionContext || 'standalone'
            };
        }

        return metadata;
    }

    /**
     * Extract navigation-specific metadata
     */
    extractNavigationMetadata(context) {
        const navigation = context.selection?.metadata?.parameters || context.navigation || {};
        
        return {
            zoom: navigation.zoom?.level || navigation.zoom,
            pan: {
                filters: this.summarizeFilters(navigation.pan),
                complexity: navigation._metadata?.complexity,
                hasFilters: navigation._metadata?.hasFilters
            },
            tilt: navigation.tilt?.representation || navigation.tilt,
            parameters: {
                original: navigation,
                normalized: !!navigation._metadata
            }
        };
    }

    /**
     * Extract data provenance metadata
     */
    extractProvenanceMetadata(context) {
        return {
            source: {
                corpus: context.corpus?.name || 'unknown',
                selection: context.selection?.metadata?.zoomLevel,
                projection: context.projection?.representation
            },
            method: {
                selectionStrategy: context.selection?.metadata?.criteria?.primary?.length || 0,
                projectionType: context.projection?.outputType,
                transformationFormat: context.formatting?.format
            },
            filters: this.extractFilterSummary(context),
            transformations: this.extractTransformationChain(context)
        };
    }

    /**
     * Extract performance metadata
     */
    extractPerformanceMetadata(context) {
        const selection = context.selection?.metadata || {};
        const projection = context.projection?.metadata || {};
        const formatting = context.formatting?.metadata || {};

        return {
            processingTime: {
                selection: selection.selectionTime || 0,
                projection: projection?.processingTime || 0,
                formatting: formatting?.processingTime || 0,
                total: (selection.selectionTime || 0) + 
                       (projection?.processingTime || 0) + 
                       (formatting?.processingTime || 0)
            },
            tokenCount: {
                estimated: formatting.tokenEstimate || 0,
                budget: context.navigation?.transform?.maxTokens || 0,
                utilization: formatting.tokenEstimate ? 
                    (formatting.tokenEstimate / (context.navigation?.transform?.maxTokens || 4000)) : 0
            },
            chunkCount: context.chunking?.metadata?.totalChunks || 0,
            cacheHits: selection.fromCache ? 1 : 0,
            resultCount: selection.resultCount || 0
        };
    }

    /**
     * Extract quality indicators
     */
    extractQualityMetadata(context) {
        const selection = context.selection?.metadata || {};
        const projection = context.projection?.data || {};

        return {
            confidence: this.calculateConfidence(context),
            completeness: this.calculateCompleteness(context),
            relevance: this.calculateRelevance(context),
            coherence: this.calculateCoherence(projection),
            coverage: selection.criteria?.estimatedSelectivity || 0
        };
    }

    /**
     * Extract technical implementation details
     */
    extractTechnicalMetadata(context) {
        return {
            version: {
                zpt: '1.0.0',
                semem: '1.0.0',
                ragno: '1.0.0'
            },
            model: context.projection?.metadata?.model || 'unknown',
            tokenizer: context.navigation?.transform?.tokenizer || 'cl100k_base',
            parameters: {
                zoomGranularity: context.navigation?.zoom?.granularity,
                tiltOutputFormat: context.navigation?.tilt?.outputFormat,
                transformStrategy: context.navigation?.transform?.chunkStrategy
            },
            environment: {
                timestamp: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };
    }

    /**
     * Compress metadata based on compression level
     */
    compressMetadata(metadata, options) {
        const level = this.compressionLevels[options.compressionLevel];
        if (!level) {
            return metadata; // No compression
        }

        const compressed = {};
        
        // Include specified fields
        if (level.includeFields === 'all') {
            Object.assign(compressed, metadata);
        } else {
            level.includeFields.forEach(field => {
                if (this.hasNestedField(metadata, field)) {
                    this.setNestedField(compressed, field, this.getNestedField(metadata, field));
                }
            });
        }

        // Apply detail omission
        if (level.omitDetails) {
            compressed.provenance = compressed.provenance ? {
                source: compressed.provenance.source?.corpus
            } : undefined;
            
            compressed.technical = compressed.technical ? {
                version: compressed.technical.version?.zpt
            } : undefined;
        }

        // Apply abbreviation
        if (level.abbreviate) {
            compressed = this.abbreviateFields(compressed);
        }

        return compressed;
    }

    /**
     * Apply privacy filters to metadata
     */
    applyPrivacyFilters(metadata, options) {
        if (!options.preservePrivacy) {
            return metadata;
        }

        const filtered = JSON.parse(JSON.stringify(metadata)); // Deep copy

        // Remove potentially sensitive information
        if (filtered.session) {
            delete filtered.session.id;
        }

        if (filtered.technical?.environment) {
            delete filtered.technical.environment.timezone;
        }

        if (filtered.provenance?.source) {
            filtered.provenance.source = {
                type: 'corpus'
            };
        }

        // Anonymize navigation parameters
        if (filtered.navigation?.pan?.filters) {
            filtered.navigation.pan.filters = {
                count: Object.keys(filtered.navigation.pan.filters).length,
                types: Object.keys(filtered.navigation.pan.filters)
            };
        }

        return filtered;
    }

    /**
     * Encoding strategy implementations
     */
    async encodeStructured(content, metadata, options) {
        const structured = {
            zpt_metadata: metadata,
            content: content.content || content,
            encoding_info: {
                strategy: 'structured',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        if (typeof content === 'string') {
            return `${JSON.stringify(structured, null, 2)}`;
        } else {
            return structured;
        }
    }

    async encodeCompact(content, metadata, options) {
        const compact = this.createCompactRepresentation(metadata);
        const encoded = {
            zpt: compact,
            data: content.content || content
        };

        if (typeof content === 'string') {
            return `<!-- ZPT:${JSON.stringify(compact)} -->\n${content.content || content}`;
        } else {
            return encoded;
        }
    }

    async encodeInline(content, metadata, options) {
        const contentStr = content.content || content;
        if (typeof contentStr !== 'string') {
            throw new Error('Inline encoding requires string content');
        }

        const markers = this.createInlineMarkers(metadata);
        let encoded = contentStr;

        // Insert markers at strategic points
        encoded = markers.start + encoded;
        encoded = encoded.replace(/\n\n/g, `\n${markers.section}\n`);
        encoded = encoded + markers.end;

        return encoded;
    }

    async encodeHeader(content, metadata, options) {
        const contentStr = content.content || content;
        const header = this.createHeaderMetadata(metadata);

        if (typeof contentStr === 'string') {
            return `---\n${header}\n---\n\n${contentStr}`;
        } else {
            return {
                metadata: metadata,
                content: contentStr
            };
        }
    }

    async encodeFooter(content, metadata, options) {
        const contentStr = content.content || content;
        const footer = this.createFooterMetadata(metadata);

        if (typeof contentStr === 'string') {
            return `${contentStr}\n\n---\n\n${footer}`;
        } else {
            return {
                content: contentStr,
                metadata: metadata
            };
        }
    }

    async encodeDistributed(content, metadata, options) {
        const contentStr = content.content || content;
        if (typeof contentStr !== 'string') {
            throw new Error('Distributed encoding requires string content');
        }

        // Split content into sections
        const sections = this.splitIntoSections(contentStr);
        const metadataParts = this.distributeMetadata(metadata, sections.length);

        let distributed = '';
        sections.forEach((section, index) => {
            distributed += section;
            if (index < metadataParts.length) {
                distributed += `\n<!-- ${JSON.stringify(metadataParts[index])} -->\n`;
            }
        });

        return distributed;
    }

    /**
     * Helper methods for encoding strategies
     */
    createCompactRepresentation(metadata) {
        return {
            z: metadata.navigation?.zoom,
            t: metadata.navigation?.tilt,
            f: metadata.navigation?.pan?.filters ? Object.keys(metadata.navigation.pan.filters).length : 0,
            ts: metadata.timestamp,
            pt: metadata.performance?.processingTime?.total,
            rc: metadata.performance?.resultCount
        };
    }

    createInlineMarkers(metadata) {
        const nav = metadata.navigation || {};
        return {
            start: `<!-- ZPT-START: ${nav.zoom}/${nav.tilt} -->`,
            section: `<!-- ZPT-CTX: ${metadata.timestamp} -->`,
            end: `<!-- ZPT-END: ${metadata.performance?.processingTime?.total}ms -->`
        };
    }

    createHeaderMetadata(metadata) {
        const yaml = [];
        yaml.push('zpt_navigation:');
        yaml.push(`  zoom: ${metadata.navigation?.zoom || 'unknown'}`);
        yaml.push(`  tilt: ${metadata.navigation?.tilt || 'unknown'}`);
        yaml.push(`timestamp: ${metadata.timestamp}`);
        
        if (metadata.performance?.processingTime?.total) {
            yaml.push(`processing_time: ${metadata.performance.processingTime.total}ms`);
        }
        
        if (metadata.quality?.confidence) {
            yaml.push(`confidence: ${metadata.quality.confidence.toFixed(3)}`);
        }

        return yaml.join('\n');
    }

    createFooterMetadata(metadata) {
        const footer = [];
        footer.push('## ZPT Metadata');
        footer.push('');
        footer.push(`**Navigation:** ${metadata.navigation?.zoom}/${metadata.navigation?.tilt}`);
        footer.push(`**Generated:** ${metadata.timestamp}`);
        
        if (metadata.performance?.processingTime?.total) {
            footer.push(`**Processing Time:** ${metadata.performance.processingTime.total}ms`);
        }

        return footer.join('\n');
    }

    splitIntoSections(content) {
        // Split content by double newlines (paragraphs)
        return content.split(/\n\s*\n/).filter(section => section.trim().length > 0);
    }

    distributeMetadata(metadata, sectionCount) {
        const parts = [];
        const keys = Object.keys(metadata);
        const keysPerSection = Math.ceil(keys.length / sectionCount);

        for (let i = 0; i < sectionCount; i++) {
            const sectionKeys = keys.slice(i * keysPerSection, (i + 1) * keysPerSection);
            const part = {};
            sectionKeys.forEach(key => {
                part[key] = metadata[key];
            });
            if (Object.keys(part).length > 0) {
                parts.push(part);
            }
        }

        return parts;
    }

    /**
     * Quality calculation methods
     */
    calculateConfidence(context) {
        let confidence = 0.5; // Base confidence

        // Increase confidence based on processing success
        if (context.selection?.metadata?.selectionTime) confidence += 0.2;
        if (context.projection?.metadata?.processingTime) confidence += 0.2;
        if (!context.selection?.metadata?.fromCache) confidence += 0.1;

        return Math.min(1.0, confidence);
    }

    calculateCompleteness(context) {
        const targetResults = context.navigation?.transform?.maxTokens ? 
            Math.floor(context.navigation.transform.maxTokens / 50) : 100;
        const actualResults = context.selection?.metadata?.resultCount || 0;
        
        return Math.min(1.0, actualResults / targetResults);
    }

    calculateRelevance(context) {
        // Based on selection criteria and filtering
        const hasFilters = context.navigation?.pan && Object.keys(context.navigation.pan).length > 0;
        const complexity = context.navigation?._metadata?.complexity || 0;
        
        return hasFilters ? 0.8 + (complexity * 0.2) : 0.5;
    }

    calculateCoherence(projectionData) {
        // Simple coherence based on data structure
        if (projectionData.aggregateStats?.avgSimilarity) {
            return projectionData.aggregateStats.avgSimilarity;
        }
        
        if (projectionData.stats?.coverageScore) {
            return projectionData.stats.coverageScore;
        }
        
        return 0.5; // Default coherence
    }

    /**
     * Utility methods
     */
    summarizeFilters(pan) {
        if (!pan) return {};
        
        const summary = {};
        if (pan.topic) summary.topic = pan.topic.value || pan.topic;
        if (pan.entity) summary.entity = pan.entity.count || (Array.isArray(pan.entity) ? pan.entity.length : 1);
        if (pan.temporal) summary.temporal = true;
        if (pan.geographic) summary.geographic = true;
        
        return summary;
    }

    extractFilterSummary(context) {
        const navigation = context.navigation || context.selection?.metadata?.parameters || {};
        return {
            count: navigation.pan ? Object.keys(navigation.pan).length : 0,
            types: navigation.pan ? Object.keys(navigation.pan) : [],
            complexity: navigation._metadata?.complexity || 0
        };
    }

    extractTransformationChain(context) {
        const chain = [];
        
        if (context.selection) {
            chain.push({
                step: 'selection',
                method: 'corpuscle_selector',
                timestamp: context.selection.metadata?.timestamp
            });
        }
        
        if (context.projection) {
            chain.push({
                step: 'projection',
                method: context.projection.representation,
                timestamp: context.projection.metadata?.timestamp
            });
        }
        
        if (context.formatting) {
            chain.push({
                step: 'formatting',
                method: context.formatting.format,
                timestamp: context.formatting.metadata?.timestamp
            });
        }
        
        return chain;
    }

    calculateOverhead(encodedContent, originalContent) {
        const encodedSize = typeof encodedContent === 'string' ? 
            encodedContent.length : JSON.stringify(encodedContent).length;
        const originalSize = typeof originalContent === 'string' ? 
            originalContent.length : JSON.stringify(originalContent).length;
        
        return {
            bytes: encodedSize - originalSize,
            percentage: ((encodedSize - originalSize) / originalSize * 100).toFixed(1)
        };
    }

    abbreviateFields(obj) {
        const abbreviations = {
            timestamp: 'ts',
            processingTime: 'pt',
            confidence: 'conf',
            navigation: 'nav',
            performance: 'perf',
            technical: 'tech'
        };

        const abbreviated = {};
        for (const [key, value] of Object.entries(obj)) {
            const abbrevKey = abbreviations[key] || key;
            abbreviated[abbrevKey] = value;
        }
        
        return abbreviated;
    }

    hasNestedField(obj, field) {
        return field.split('.').reduce((current, key) => 
            current && current[key] !== undefined, obj) !== undefined;
    }

    getNestedField(obj, field) {
        return field.split('.').reduce((current, key) => 
            current && current[key], obj);
    }

    setNestedField(obj, field, value) {
        const keys = field.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Decoding methods for retrieving metadata
     */
    async decode(encodedContent, strategy = null) {
        if (!strategy) {
            strategy = this.detectEncodingStrategy(encodedContent);
        }

        const decoder = this.getDecoder(strategy);
        if (!decoder) {
            throw new Error(`No decoder available for strategy: ${strategy}`);
        }

        return decoder(encodedContent);
    }

    detectEncodingStrategy(content) {
        if (typeof content === 'object' && content.zpt_metadata) {
            return 'structured';
        }
        
        if (typeof content === 'string') {
            if (content.includes('<!-- ZPT:')) return 'compact';
            if (content.includes('<!-- ZPT-START:')) return 'inline';
            if (content.startsWith('---\n')) return 'header';
            if (content.includes('\n---\n\n## ZPT Metadata')) return 'footer';
        }
        
        return 'unknown';
    }

    getDecoder(strategy) {
        const decoders = {
            structured: (content) => content.zpt_metadata,
            compact: (content) => {
                const match = content.match(/<!-- ZPT:(.+?) -->/);
                return match ? JSON.parse(match[1]) : null;
            },
            inline: (content) => {
                const matches = content.match(/<!-- ZPT-.*? -->/g);
                return matches ? { markers: matches } : null;
            },
            header: (content) => {
                const match = content.match(/^---\n([\s\S]*?)\n---/);
                return match ? { yaml: match[1] } : null;
            },
            footer: (content) => {
                const match = content.match(/\n---\n\n([\s\S]*)$/);
                return match ? { footer: match[1] } : null;
            }
        };
        
        return decoders[strategy];
    }

    /**
     * Configuration and info methods
     */
    getAvailableStrategies() {
        return Object.keys(this.encodingStrategies);
    }

    getStrategyInfo(strategy) {
        return this.encodingStrategies[strategy] ? 
            { ...this.encodingStrategies[strategy] } : null;
    }

    getCompressionLevels() {
        return Object.keys(this.compressionLevels);
    }

    getCompressionInfo(level) {
        return this.compressionLevels[level] ? 
            { ...this.compressionLevels[level] } : null;
    }

    getSchemas() {
        return Object.keys(this.schemas);
    }

    getSchemaInfo(schema) {
        return this.schemas[schema] ? 
            { ...this.schemas[schema] } : null;
    }

    /**
     * Validation methods
     */
    validateMetadata(metadata, schema = 'navigation') {
        const schemaInfo = this.schemas[schema];
        if (!schemaInfo) {
            throw new Error(`Unknown schema: ${schema}`);
        }

        const issues = [];
        
        // Check required fields
        schemaInfo.required.forEach(field => {
            if (!this.hasNestedField(metadata, field)) {
                issues.push(`Missing required field: ${field}`);
            }
        });

        return {
            valid: issues.length === 0,
            issues,
            schema
        };
    }

    validateEncodedContent(content, expectedStrategy = null) {
        const detectedStrategy = this.detectEncodingStrategy(content);
        
        if (expectedStrategy && detectedStrategy !== expectedStrategy) {
            return {
                valid: false,
                detected: detectedStrategy,
                expected: expectedStrategy,
                message: `Strategy mismatch: expected ${expectedStrategy}, detected ${detectedStrategy}`
            };
        }

        return {
            valid: detectedStrategy !== 'unknown',
            detected: detectedStrategy,
            message: detectedStrategy === 'unknown' ? 'No encoding detected' : 'Valid encoding detected'
        };
    }
}