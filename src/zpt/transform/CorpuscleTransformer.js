/**
 * Main transformation engine coordinating all transformation steps
 */
import TokenCounter from './TokenCounter.js';
import ContentChunker from './ContentChunker.js';
import PromptFormatter from './PromptFormatter.js';
import MetadataEncoder from './MetadataEncoder.js';
import { logger } from '../../Utils.js';

export default class CorpuscleTransformer {
    constructor(options = {}) {
        this.config = {
            defaultTokenizer: options.defaultTokenizer || 'cl100k_base',
            defaultFormat: options.defaultFormat || 'structured',
            defaultEncoding: options.defaultEncoding || 'structured',
            enableCaching: options.enableCaching !== false,
            enableMetrics: options.enableMetrics !== false,
            maxRetries: options.maxRetries || 3,
            timeoutMs: options.timeoutMs || 60000,
            ...options
        };

        // Initialize transformation components
        this.tokenCounter = new TokenCounter({
            defaultTokenizer: this.config.defaultTokenizer,
            cacheEnabled: this.config.enableCaching
        });

        this.contentChunker = new ContentChunker({
            preserveStructure: true,
            semanticBoundaries: true,
            balanceChunks: true
        });

        this.promptFormatter = new PromptFormatter({
            defaultFormat: this.config.defaultFormat,
            includeMetadata: true,
            includeInstructions: false
        });

        this.metadataEncoder = new MetadataEncoder({
            encoding: this.config.defaultEncoding,
            includeNavigation: true,
            includeProvenance: true,
            compressionLevel: 'medium'
        });

        // Transformation pipeline
        this.pipeline = this.initializePipeline();
        
        // Performance tracking
        this.metrics = {
            totalTransformations: 0,
            avgTransformTime: 0,
            successRate: 0,
            cacheHitRate: 0
        };

        // Result cache
        this.cache = new Map();
        this.cacheExpiry = options.cacheExpiry || 3600000; // 1 hour
    }

    /**
     * Initialize transformation pipeline stages
     */
    initializePipeline() {
        return [
            {
                name: 'validation',
                handler: this.validateInput.bind(this),
                required: true,
                description: 'Validate input parameters and data'
            },
            {
                name: 'token_analysis',
                handler: this.analyzeTokens.bind(this),
                required: true,
                description: 'Analyze token requirements and constraints'
            },
            {
                name: 'chunking',
                handler: this.applyChunking.bind(this),
                required: false,
                description: 'Split content into manageable chunks'
            },
            {
                name: 'formatting',
                handler: this.applyFormatting.bind(this),
                required: true,
                description: 'Format content for LLM consumption'
            },
            {
                name: 'metadata_encoding',
                handler: this.applyMetadataEncoding.bind(this),
                required: false,
                description: 'Encode navigation metadata into output'
            },
            {
                name: 'validation_final',
                handler: this.validateOutput.bind(this),
                required: true,
                description: 'Final validation of transformed content'
            }
        ];
    }

    /**
     * Main transformation method - orchestrates the complete pipeline
     * @param {Object} projectedContent - Content from TiltProjector
     * @param {Object} selectionResult - Result from CorpuscleSelector
     * @param {Object} transformOptions - Transformation parameters
     * @returns {Promise<Object>} Complete transformation result
     */
    async transform(projectedContent, selectionResult, transformOptions = {}) {
        const startTime = Date.now();
        const transformId = this.generateTransformId();
        
        logger.info('Starting corpuscle transformation', { 
            transformId, 
            projection: projectedContent.representation,
            corpuscleCount: selectionResult.corpuscles?.length || 0
        });

        try {
            // Check cache first
            const cacheKey = this.createCacheKey(projectedContent, selectionResult, transformOptions);
            if (this.config.enableCaching) {
                const cachedResult = this.getCachedResult(cacheKey);
                if (cachedResult) {
                    logger.debug('Cache hit for transformation', { transformId, cacheKey });
                    return this.enrichCachedResult(cachedResult, transformId);
                }
            }

            // Build transformation context
            const context = this.buildTransformationContext(
                projectedContent, 
                selectionResult, 
                transformOptions,
                transformId
            );

            // Execute pipeline
            let result = context;
            const executionTrace = [];

            for (const stage of this.pipeline) {
                const stageStart = Date.now();
                
                try {
                    logger.debug(`Executing stage: ${stage.name}`, { transformId });
                    
                    result = await this.executeStageWithTimeout(
                        stage, 
                        result, 
                        this.config.timeoutMs / this.pipeline.length
                    );
                    
                    const stageTime = Date.now() - stageStart;
                    executionTrace.push({
                        stage: stage.name,
                        success: true,
                        duration: stageTime,
                        timestamp: new Date().toISOString()
                    });
                    
                    logger.debug(`Stage completed: ${stage.name}`, { 
                        transformId, 
                        duration: stageTime 
                    });

                } catch (error) {
                    const stageTime = Date.now() - stageStart;
                    executionTrace.push({
                        stage: stage.name,
                        success: false,
                        duration: stageTime,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });

                    if (stage.required) {
                        throw new Error(`Required stage ${stage.name} failed: ${error.message}`);
                    } else {
                        logger.warn(`Optional stage ${stage.name} failed`, { 
                            transformId, 
                            error: error.message 
                        });
                        // Continue with degraded functionality
                    }
                }
            }

            // Finalize transformation result
            const finalResult = this.finalizeTransformation(
                result, 
                executionTrace, 
                Date.now() - startTime,
                transformId
            );

            // Cache successful result
            if (this.config.enableCaching) {
                this.cacheResult(cacheKey, finalResult);
            }

            // Update metrics
            this.updateMetrics(Date.now() - startTime, true);

            logger.info('Transformation completed successfully', {
                transformId,
                totalTime: Date.now() - startTime,
                stagesExecuted: executionTrace.length
            });

            return finalResult;

        } catch (error) {
            this.updateMetrics(Date.now() - startTime, false);
            logger.error('Transformation failed', { 
                transformId, 
                error: error.message,
                duration: Date.now() - startTime
            });
            throw new Error(`Transformation failed: ${error.message}`);
        }
    }

    /**
     * Build comprehensive transformation context
     */
    buildTransformationContext(projectedContent, selectionResult, transformOptions, transformId) {
        return {
            // Input data
            projection: projectedContent,
            selection: selectionResult,
            
            // Transformation parameters
            options: {
                ...this.config,
                ...transformOptions,
                transformId
            },
            
            // Navigation context
            navigation: selectionResult.navigation || {},
            
            // Processing state
            state: {
                stage: 'initialization',
                startTime: Date.now(),
                transformId,
                retryCount: 0
            },
            
            // Results accumulator
            results: {
                tokenAnalysis: null,
                chunking: null,
                formatting: null,
                encoding: null
            }
        };
    }

    /**
     * Pipeline stage implementations
     */
    async validateInput(context) {
        const { projection, selection, options } = context;

        // Validate projection
        if (!projection || !projection.representation) {
            throw new Error('Invalid projection: missing representation');
        }

        if (!projection.data) {
            throw new Error('Invalid projection: missing data');
        }

        // Validate selection
        if (!selection || !selection.corpuscles) {
            throw new Error('Invalid selection: missing corpuscles');
        }

        // Validate options
        if (options.maxTokens && (options.maxTokens < 100 || options.maxTokens > 128000)) {
            throw new Error('Invalid maxTokens: must be between 100 and 128000');
        }

        context.state.stage = 'validation_completed';
        return context;
    }

    async analyzeTokens(context) {
        const { projection, options } = context;

        try {
            // Analyze current content tokens
            const contentStr = this.extractContentString(projection.data);
            const tokenAnalysis = await this.tokenCounter.countTokens(
                contentStr, 
                options.tokenizer
            );

            // Check against budget
            const budget = options.maxTokens || context.navigation?.transform?.maxTokens || 4000;
            const contextCheck = this.tokenCounter.checkContextLimits(
                tokenAnalysis.count,
                options.model || 'gpt-4',
                options.reservedTokens || 1000
            );

            // Determine if chunking is needed
            const chunkingNeeded = !contextCheck.fits || tokenAnalysis.count > budget;

            context.results.tokenAnalysis = {
                original: tokenAnalysis,
                budget,
                contextCheck,
                chunkingNeeded,
                estimatedChunks: chunkingNeeded ? 
                    Math.ceil(tokenAnalysis.count / (budget * 0.8)) : 1
            };

            context.state.stage = 'token_analysis_completed';
            return context;

        } catch (error) {
            throw new Error(`Token analysis failed: ${error.message}`);
        }
    }

    async applyChunking(context) {
        const { projection, results, options } = context;

        // Skip chunking if not needed
        if (!results.tokenAnalysis.chunkingNeeded) {
            logger.debug('Chunking skipped - content fits in token budget');
            context.results.chunking = {
                skipped: true,
                reason: 'content_fits_budget'
            };
            context.state.stage = 'chunking_completed';
            return context;
        }

        try {
            const chunkingOptions = {
                strategy: options.chunkStrategy || 'token_aware',
                chunkSize: Math.floor(results.tokenAnalysis.budget * 0.8),
                tokenCounter: this.tokenCounter,
                tokenizer: options.tokenizer,
                maxTokens: results.tokenAnalysis.budget,
                preserveStructure: options.preserveStructure !== false,
                balanceChunks: options.balanceChunks
            };

            // Determine what to chunk
            let chunkingResult;
            if (projection.representation === 'text' && projection.data.corpuscleKeywords) {
                // Chunk individual corpuscle content
                const corpuscleTexts = projection.data.corpuscleKeywords.map(c => c.content);
                chunkingResult = await this.contentChunker.chunk(corpuscleTexts, chunkingOptions);
            } else {
                // Chunk the formatted projection data
                const contentStr = this.extractContentString(projection.data);
                chunkingResult = await this.contentChunker.chunk(contentStr, chunkingOptions);
            }

            context.results.chunking = chunkingResult;
            context.state.stage = 'chunking_completed';
            return context;

        } catch (error) {
            throw new Error(`Chunking failed: ${error.message}`);
        }
    }

    async applyFormatting(context) {
        const { projection, selection, results, options } = context;

        try {
            const formattingOptions = {
                format: options.format || this.config.defaultFormat,
                includeMetadata: options.includeMetadata !== false,
                includeInstructions: options.includeInstructions || false,
                instructionSet: options.instructionSet,
                purpose: options.purpose || 'analysis',
                includeAnalysis: options.includeAnalysis
            };

            // Determine content to format
            let contentToFormat = projection;
            
            if (results.chunking && !results.chunking.skipped) {
                // Format each chunk separately
                const formattedChunks = [];
                
                for (const chunk of results.chunking.chunks) {
                    const chunkProjection = {
                        ...projection,
                        data: this.adaptProjectionDataForChunk(projection.data, chunk)
                    };
                    
                    const formatted = await this.promptFormatter.format(
                        chunkProjection,
                        selection.navigation,
                        formattingOptions
                    );
                    
                    formattedChunks.push({
                        chunkId: chunk.id,
                        formatted,
                        metadata: chunk.metadata
                    });
                }
                
                context.results.formatting = {
                    chunked: true,
                    chunks: formattedChunks,
                    totalChunks: formattedChunks.length
                };
            } else {
                // Format entire content as single unit
                const formatted = await this.promptFormatter.format(
                    contentToFormat,
                    selection.navigation,
                    formattingOptions
                );
                
                context.results.formatting = {
                    chunked: false,
                    content: formatted
                };
            }

            context.state.stage = 'formatting_completed';
            return context;

        } catch (error) {
            throw new Error(`Formatting failed: ${error.message}`);
        }
    }

    async applyMetadataEncoding(context) {
        const { results, options } = context;

        // Skip encoding if disabled
        if (options.skipMetadataEncoding) {
            context.results.encoding = {
                skipped: true,
                reason: 'disabled_by_options'
            };
            context.state.stage = 'metadata_encoding_completed';
            return context;
        }

        try {
            const encodingOptions = {
                encoding: options.encoding || this.config.defaultEncoding,
                compressionLevel: options.compressionLevel || 'medium',
                includeNavigation: options.includeNavigation !== false,
                includeProvenance: options.includeProvenance !== false,
                preservePrivacy: options.preservePrivacy || false,
                sessionId: options.sessionId
            };

            const fullContext = this.buildFullContext(context);

            if (results.formatting.chunked) {
                // Encode each chunk
                const encodedChunks = [];
                
                for (const chunk of results.formatting.chunks) {
                    const encoded = await this.metadataEncoder.encode(
                        chunk.formatted,
                        fullContext,
                        encodingOptions
                    );
                    
                    encodedChunks.push({
                        chunkId: chunk.chunkId,
                        encoded,
                        originalMetadata: chunk.metadata
                    });
                }
                
                context.results.encoding = {
                    chunked: true,
                    chunks: encodedChunks
                };
            } else {
                // Encode single content
                const encoded = await this.metadataEncoder.encode(
                    results.formatting.content,
                    fullContext,
                    encodingOptions
                );
                
                context.results.encoding = {
                    chunked: false,
                    content: encoded
                };
            }

            context.state.stage = 'metadata_encoding_completed';
            return context;

        } catch (error) {
            // Metadata encoding is optional - continue without it
            logger.warn('Metadata encoding failed, continuing without encoding', { 
                error: error.message 
            });
            
            context.results.encoding = {
                skipped: true,
                reason: 'encoding_failed',
                error: error.message
            };
            
            context.state.stage = 'metadata_encoding_completed';
            return context;
        }
    }

    async validateOutput(context) {
        const { results, options } = context;

        try {
            // Validate final output structure
            const finalContent = this.extractFinalContent(results);
            
            if (!finalContent) {
                throw new Error('No final content produced');
            }

            // Validate token counts if specified
            if (options.validateTokens !== false) {
                await this.validateFinalTokenCounts(finalContent, results.tokenAnalysis, options);
            }

            // Validate format integrity
            if (options.validateFormat !== false) {
                this.validateFormatIntegrity(finalContent, options.format);
            }

            context.state.stage = 'validation_final_completed';
            return context;

        } catch (error) {
            throw new Error(`Output validation failed: ${error.message}`);
        }
    }

    /**
     * Helper methods for pipeline stages
     */
    extractContentString(projectionData) {
        if (typeof projectionData === 'string') return projectionData;
        
        // Extract text content based on projection type
        if (projectionData.globalKeywords) {
            return projectionData.globalKeywords.map(k => k.keyword).join(' ');
        }
        
        if (projectionData.embeddings) {
            return projectionData.embeddings.map(e => e.uri).join(' ');
        }
        
        if (projectionData.nodes) {
            return projectionData.nodes.map(n => n.label).join(' ');
        }
        
        if (projectionData.events) {
            return projectionData.events.map(e => e.label).join(' ');
        }
        
        return JSON.stringify(projectionData);
    }

    adaptProjectionDataForChunk(originalData, chunk) {
        // Adapt projection data to work with a specific chunk
        if (chunk.type === 'token_aware' || chunk.type === 'semantic') {
            // For text-based chunks, create a subset of the original data
            if (originalData.corpuscleKeywords) {
                return {
                    ...originalData,
                    corpuscleKeywords: [{
                        content: chunk.content,
                        keywords: this.extractKeywordsFromChunk(chunk.content, originalData.globalKeywords)
                    }]
                };
            }
        }
        
        // For other chunk types, return original data with chunk context
        return {
            ...originalData,
            chunkContext: {
                id: chunk.id,
                content: chunk.content,
                position: chunk.position
            }
        };
    }

    extractKeywordsFromChunk(chunkContent, globalKeywords) {
        // Extract relevant keywords that appear in the chunk
        const chunkLower = chunkContent.toLowerCase();
        return globalKeywords.filter(kw => 
            chunkLower.includes(kw.keyword.toLowerCase())
        ).slice(0, 10); // Limit to top 10 relevant keywords
    }

    buildFullContext(context) {
        return {
            selection: context.selection,
            projection: context.projection,
            navigation: context.navigation,
            tokenAnalysis: context.results.tokenAnalysis,
            chunking: context.results.chunking,
            formatting: context.results.formatting,
            corpus: context.options.corpus
        };
    }

    extractFinalContent(results) {
        if (results.encoding && !results.encoding.skipped) {
            return results.encoding.chunked ? 
                results.encoding.chunks : results.encoding.content;
        }
        
        if (results.formatting) {
            return results.formatting.chunked ? 
                results.formatting.chunks : results.formatting.content;
        }
        
        return null;
    }

    async validateFinalTokenCounts(finalContent, tokenAnalysis, options) {
        if (!tokenAnalysis || !options.maxTokens) return;

        let totalTokens = 0;
        
        if (Array.isArray(finalContent)) {
            // Chunked content
            for (const chunk of finalContent) {
                const contentStr = typeof chunk === 'string' ? chunk : 
                    chunk.encoded?.content || chunk.formatted?.content || JSON.stringify(chunk);
                const tokens = await this.tokenCounter.countTokens(contentStr, options.tokenizer);
                totalTokens += tokens.count;
            }
        } else {
            // Single content
            const contentStr = typeof finalContent === 'string' ? finalContent :
                finalContent.encoded?.content || finalContent.formatted?.content || JSON.stringify(finalContent);
            const tokens = await this.tokenCounter.countTokens(contentStr, options.tokenizer);
            totalTokens = tokens.count;
        }

        if (totalTokens > options.maxTokens * 1.1) { // Allow 10% tolerance
            throw new Error(`Final content exceeds token budget: ${totalTokens} > ${options.maxTokens}`);
        }
    }

    validateFormatIntegrity(finalContent, expectedFormat) {
        // Basic format validation - could be enhanced
        if (expectedFormat === 'json') {
            if (Array.isArray(finalContent)) {
                finalContent.forEach(chunk => {
                    const content = chunk.encoded?.content || chunk.formatted?.content || chunk;
                    if (typeof content === 'string') {
                        try {
                            JSON.parse(content);
                        } catch (e) {
                            throw new Error('Invalid JSON format in chunk');
                        }
                    }
                });
            }
        }
    }

    /**
     * Pipeline execution utilities
     */
    async executeStageWithTimeout(stage, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Stage ${stage.name} timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            stage.handler(context)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    finalizeTransformation(context, executionTrace, totalTime, transformId) {
        const { results, projection, selection, options } = context;
        
        return {
            transformId,
            content: this.extractFinalContent(results),
            metadata: {
                transformation: {
                    totalTime,
                    stages: executionTrace,
                    successful: executionTrace.every(stage => stage.success),
                    version: '1.0.0'
                },
                input: {
                    projection: projection.representation,
                    corpuscleCount: selection.corpuscles?.length || 0,
                    navigation: selection.navigation
                },
                processing: {
                    tokenAnalysis: results.tokenAnalysis,
                    chunking: results.chunking,
                    formatting: results.formatting?.chunked ? 'chunked' : 'single',
                    encoding: results.encoding?.skipped ? 'skipped' : 'applied'
                },
                output: {
                    format: options.format,
                    chunked: results.formatting?.chunked || false,
                    chunkCount: results.formatting?.chunks?.length || 1,
                    hasMetadata: !results.encoding?.skipped
                }
            },
            diagnostics: {
                pipeline: this.pipeline.map(stage => stage.name),
                executionTrace,
                cacheUsed: false // Will be set to true for cached results
            }
        };
    }

    /**
     * Caching methods
     */
    createCacheKey(projectedContent, selectionResult, transformOptions) {
        const keyData = {
            projection: {
                type: projectedContent.representation,
                dataHash: this.hashObject(projectedContent.data)
            },
            selection: {
                corpuscleCount: selectionResult.corpuscles?.length || 0,
                navigationHash: this.hashObject(selectionResult.navigation)
            },
            options: {
                format: transformOptions.format,
                tokenizer: transformOptions.tokenizer,
                maxTokens: transformOptions.maxTokens
            }
        };
        
        return this.hashObject(keyData);
    }

    getCachedResult(cacheKey) {
        if (!this.cache.has(cacheKey)) return null;
        
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(cacheKey);
            return null;
        }
        
        return cached.result;
    }

    cacheResult(cacheKey, result) {
        // Deep copy to avoid mutations
        const cachedResult = JSON.parse(JSON.stringify(result));
        
        this.cache.set(cacheKey, {
            result: cachedResult,
            timestamp: Date.now()
        });
        
        // Cleanup old entries
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    enrichCachedResult(cachedResult, transformId) {
        return {
            ...cachedResult,
            transformId,
            metadata: {
                ...cachedResult.metadata,
                fromCache: true,
                cacheTimestamp: new Date().toISOString()
            },
            diagnostics: {
                ...cachedResult.diagnostics,
                cacheUsed: true
            }
        };
    }

    hashObject(obj) {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    generateTransformId() {
        return `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Metrics and monitoring
     */
    updateMetrics(duration, success) {
        this.metrics.totalTransformations++;
        
        // Update average time
        this.metrics.avgTransformTime = 
            (this.metrics.avgTransformTime * (this.metrics.totalTransformations - 1) + duration) / 
            this.metrics.totalTransformations;
        
        // Update success rate
        const prevSuccesses = Math.round(this.metrics.successRate * (this.metrics.totalTransformations - 1));
        const newSuccesses = prevSuccesses + (success ? 1 : 0);
        this.metrics.successRate = newSuccesses / this.metrics.totalTransformations;
    }

    /**
     * Configuration and info methods
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            pipelineStages: this.pipeline.length
        };
    }

    getPipelineInfo() {
        return this.pipeline.map(stage => ({
            name: stage.name,
            required: stage.required,
            description: stage.description
        }));
    }

    getComponentInfo() {
        return {
            tokenCounter: this.tokenCounter.getAvailableTokenizers(),
            contentChunker: this.contentChunker.getAvailableStrategies(),
            promptFormatter: this.promptFormatter.getAvailableFormats(),
            metadataEncoder: this.metadataEncoder.getAvailableStrategies()
        };
    }

    async healthCheck() {
        const issues = [];
        
        // Test token counter
        try {
            await this.tokenCounter.countTokens('test content');
        } catch (error) {
            issues.push(`TokenCounter: ${error.message}`);
        }
        
        // Test content chunker
        try {
            await this.contentChunker.chunk('test content for chunking');
        } catch (error) {
            issues.push(`ContentChunker: ${error.message}`);
        }
        
        return {
            healthy: issues.length === 0,
            issues,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset and cleanup
     */
    clearCache() {
        this.cache.clear();
        if (this.tokenCounter.clearCache) {
            this.tokenCounter.clearCache();
        }
    }

    resetMetrics() {
        this.metrics = {
            totalTransformations: 0,
            avgTransformTime: 0,
            successRate: 0,
            cacheHitRate: 0
        };
    }

    dispose() {
        this.clearCache();
        logger.info('CorpuscleTransformer disposed');
    }
}