import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import NavigationEndpoint from '../../zpt/api/NavigationEndpoint.js';
import CorpuscleSelector from '../../zpt/selection/CorpuscleSelector.js';
import TiltProjector from '../../zpt/selection/TiltProjector.js';
import CorpuscleTransformer from '../../zpt/transform/CorpuscleTransformer.js';
import ParameterValidator from '../../zpt/parameters/ParameterValidator.js';
import ParameterNormalizer from '../../zpt/parameters/ParameterNormalizer.js';
import ZoomLevelMapper from '../../zpt/selection/ZoomLevelMapper.js';
import PanDomainFilter from '../../zpt/selection/PanDomainFilter.js';

/**
 * ZPT API handler for Zero-Point Traversal navigation operations
 * Integrates ZPT services into the main API server following BaseAPI patterns
 */
export default class ZptAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        
        // Configuration
        this.maxConcurrentRequests = config.maxConcurrentRequests || 10;
        this.requestTimeoutMs = config.requestTimeoutMs || 120000; // 2 minutes
        this.defaultMaxTokens = config.defaultMaxTokens || 4000;
        this.supportedFormats = config.supportedFormats || ['json', 'markdown', 'structured'];
        this.supportedTokenizers = config.supportedTokenizers || ['cl100k_base', 'p50k_base', 'claude', 'llama'];
        
        // Core dependencies (will be injected)
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.sparqlStore = null;
        this.ragnoCorpus = null; // Will need to be provided or created
        
        // ZPT components
        this.navigationEndpoint = null;
        this.corpuscleSelector = null;
        this.tiltProjector = null;
        this.transformer = null;
        this.validator = new ParameterValidator();
        this.normalizer = new ParameterNormalizer();
        this.zoomMapper = null;
        this.panFilter = null;
        
        // Request tracking
        this.activeRequests = new Map();
        
        // Metrics tracking
        this.metrics = {
            navigations: 0,
            previews: 0,
            transformations: 0,
            errors: 0,
            avgProcessingTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    async initialize() {
        await super.initialize();
        
        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for ZptAPI');
        }
        
        try {
            // Get core handlers
            this.llmHandler = registry.get('llm');
            this.embeddingHandler = registry.get('embedding');
            
            // Get storage - try to get SPARQL store if available
            try {
                const memoryManager = registry.get('memory');
                if (memoryManager && memoryManager.storage) {
                    this.sparqlStore = memoryManager.storage;
                }
            } catch (error) {
                this.logger.warn('SPARQL store not available, ZPT functionality will be limited');
            }
            
            // Create mock ragno corpus if SPARQL store available
            // In real implementation, this would query the actual Ragno corpus
            if (this.sparqlStore) {
                this.ragnoCorpus = await this._createCorpusInterface();
            }
            
            // Initialize ZPT components
            await this._initializeZPTComponents();
            
            this.logger.info('ZptAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize ZptAPI:', error);
            throw error;
        }
    }

    /**
     * Initialize ZPT-specific components
     */
    async _initializeZPTComponents() {
        // Initialize zoom level mapper
        this.zoomMapper = new ZoomLevelMapper({
            sparqlStore: this.sparqlStore,
            defaultLevel: 'unit'
        });
        
        // Initialize pan domain filter
        this.panFilter = new PanDomainFilter({
            sparqlStore: this.sparqlStore,
            embeddingHandler: this.embeddingHandler
        });
        
        // Initialize corpuscle selector (main selection component)
        if (this.ragnoCorpus) {
            this.corpuscleSelector = new CorpuscleSelector(this.ragnoCorpus, {
                sparqlStore: this.sparqlStore,
                embeddingHandler: this.embeddingHandler,
                maxResults: 1000,
                enableCaching: true
            });
        }
        
        // Initialize tilt projector (representation transformation)
        this.tiltProjector = new TiltProjector({
            embeddingHandler: this.embeddingHandler,
            textAnalyzer: this.llmHandler
        });
        
        // Initialize transformer (output formatting)
        this.transformer = new CorpuscleTransformer({
            enableCaching: true,
            enableMetrics: true,
            defaultFormat: 'structured',
            supportedFormats: this.supportedFormats
        });
        
        // Initialize navigation endpoint (orchestrator)
        if (this.corpuscleSelector && this.tiltProjector && this.transformer) {
            this.navigationEndpoint = new NavigationEndpoint({
                maxConcurrentRequests: this.maxConcurrentRequests,
                requestTimeoutMs: this.requestTimeoutMs,
                enableCaching: true,
                enableMetrics: true
            });
            
            // Initialize with dependencies
            await this.navigationEndpoint.initialize({
                ragnoCorpus: this.ragnoCorpus,
                sparqlStore: this.sparqlStore,
                embeddingHandler: this.embeddingHandler,
                llmHandler: this.llmHandler
            });
        }
    }

    /**
     * Execute a ZPT operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);
        
        const start = Date.now();
        const requestId = uuidv4();
        
        // Track active request
        this.activeRequests.set(requestId, {
            operation,
            startTime: start,
            params: { ...params, sensitiveData: '[REDACTED]' }
        });
        
        try {
            let result;
            
            switch (operation) {
                case 'navigate':
                    result = await this.navigate(params, requestId);
                    break;
                case 'preview':
                    result = await this.preview(params, requestId);
                    break;
                case 'options':
                    result = await this.getOptions(params, requestId);
                    break;
                case 'schema':
                    result = await this.getSchema(params, requestId);
                    break;
                case 'health':
                    result = await this.getHealth(params, requestId);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            const duration = Date.now() - start;
            this.metrics.avgProcessingTime = this._updateAverage(this.metrics.avgProcessingTime, duration);
            this._emitMetric(`zpt.operation.${operation}.duration`, duration);
            this._emitMetric(`zpt.operation.${operation}.count`, 1);
            
            return {
                ...result,
                requestId,
                processingTime: duration
            };
        } catch (error) {
            this.metrics.errors++;
            this._emitMetric(`zpt.operation.${operation}.errors`, 1);
            this.logger.error(`ZPT operation ${operation} failed:`, error);
            throw error;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Main navigation operation
     */
    async navigate(params, requestId) {
        if (!this.navigationEndpoint) {
            throw new Error('Navigation endpoint not available without proper corpus/SPARQL setup');
        }
        
        this.logger.info(`Processing navigation request`, { requestId, params: this._sanitizeParams(params) });
        
        try {
            // Validate ZPT parameters
            const validationResult = this.validator.validate(params);
            if (!validationResult.valid) {
                throw new Error(`Parameter validation failed: ${validationResult.message}`);
            }
            
            // Normalize parameters
            const normalizedParams = this.normalizer.normalize(params);
            
            // Execute navigation pipeline via NavigationEndpoint
            const result = await this.navigationEndpoint.handleNavigate({
                body: normalizedParams,
                path: '/api/navigate',
                method: 'POST'
            }, requestId);
            
            this.metrics.navigations++;
            
            return {
                success: true,
                navigation: result.navigation,
                content: result.content,
                metadata: result.metadata,
                diagnostics: result.diagnostics
            };
        } catch (error) {
            // If NavigationEndpoint fails, try fallback implementation
            if (this.corpuscleSelector && this.tiltProjector && this.transformer) {
                return await this._executeNavigationFallback(params, requestId);
            }
            throw error;
        }
    }

    /**
     * Navigation preview (limited processing)
     */
    async preview(params, requestId) {
        this.logger.info(`Processing preview request`, { requestId });
        
        try {
            // Validate parameters
            const validationResult = this.validator.validate(params);
            if (!validationResult.valid) {
                throw new Error(`Parameter validation failed: ${validationResult.message}`);
            }
            
            const normalizedParams = this.normalizer.normalize(params);
            
            if (this.navigationEndpoint) {
                // Use NavigationEndpoint if available
                const result = await this.navigationEndpoint.handlePreview({
                    body: normalizedParams,
                    path: '/api/navigate/preview',
                    method: 'POST'
                }, requestId);
                
                this.metrics.previews++;
                return result;
            } else if (this.corpuscleSelector) {
                // Fallback to direct corpuscle selection
                const selectionResult = await this.corpuscleSelector.select(normalizedParams);
                
                this.metrics.previews++;
                return {
                    success: true,
                    preview: true,
                    navigation: normalizedParams,
                    summary: {
                        corpuscleCount: selectionResult.corpuscles?.length || 0,
                        selectionTime: selectionResult.metadata?.selectionTime || 0,
                        estimatedTokens: this._estimateTokens(selectionResult.corpuscles || []),
                        complexity: selectionResult.metadata?.complexity || 'unknown'
                    },
                    corpuscles: (selectionResult.corpuscles || []).slice(0, 5) // Preview first 5
                };
            } else {
                throw new Error('Preview not available without corpus selector');
            }
        } catch (error) {
            this.logger.error('Preview failed:', error);
            throw new Error(`Preview failed: ${error.message}`);
        }
    }

    /**
     * Get available navigation options
     */
    async getOptions(params = {}, requestId) {
        return {
            success: true,
            options: {
                zoomLevels: ['entity', 'unit', 'text', 'community', 'corpus'],
                tiltRepresentations: ['embedding', 'keywords', 'graph', 'temporal'],
                outputFormats: this.supportedFormats,
                encodingStrategies: ['structured', 'compact', 'inline'],
                maxTokenLimits: {
                    'gpt-4': 128000,
                    'gpt-3.5-turbo': 16385,
                    'claude-3-opus': 200000,
                    'claude-3-sonnet': 200000,
                    'llama': 4096,
                    'mistral': 32000
                },
                supportedTokenizers: this.supportedTokenizers,
                panDomains: {
                    topic: 'Subject area filtering',
                    entity: 'Specific entity constraints',
                    temporal: 'Time-based boundaries',
                    geographic: 'Location-based limits'
                },
                transformOptions: {
                    chunkStrategies: ['semantic', 'fixed', 'adaptive'],
                    metadataInclusion: ['minimal', 'standard', 'comprehensive'],
                    compressionLevels: ['none', 'light', 'aggressive']
                }
            }
        };
    }

    /**
     * Get parameter schema and examples
     */
    async getSchema(params = {}, requestId) {
        return {
            success: true,
            schema: this.validator.getSchema(),
            examples: {
                basic: {
                    zoom: 'unit',
                    tilt: 'keywords',
                    transform: { 
                        maxTokens: this.defaultMaxTokens, 
                        format: 'structured' 
                    }
                },
                advanced: {
                    zoom: 'entity',
                    pan: {
                        topic: 'machine-learning',
                        temporal: {
                            start: '2024-01-01',
                            end: '2024-12-31'
                        }
                    },
                    tilt: 'embedding',
                    transform: {
                        maxTokens: 8000,
                        format: 'json',
                        includeMetadata: true,
                        chunkStrategy: 'semantic',
                        tokenizer: 'cl100k_base'
                    }
                },
                minimal: {
                    zoom: 'text'
                }
            },
            documentation: {
                zoom: 'Abstraction level: entity (specific elements), unit (semantic chunks), text (full content), community (summaries), corpus (overview)',
                pan: 'Domain filtering: topic (subject constraints), entity (specific scope), temporal (time bounds), geographic (location limits)',
                tilt: 'Representation format: embedding (vectors), keywords (terms), graph (relationships), temporal (sequences)',
                transform: 'Output options: maxTokens (budget), format (structure), tokenizer (model), metadata (context)'
            },
            defaults: this.validator.getDefaults()
        };
    }

    /**
     * Get ZPT system health
     */
    async getHealth(params = {}, requestId) {
        const health = {
            status: 'healthy',
            components: {
                validator: { status: !!this.validator ? 'healthy' : 'unavailable' },
                normalizer: { status: !!this.normalizer ? 'healthy' : 'unavailable' },
                corpuscleSelector: { status: !!this.corpuscleSelector ? 'healthy' : 'unavailable' },
                tiltProjector: { status: !!this.tiltProjector ? 'healthy' : 'unavailable' },
                transformer: { status: !!this.transformer ? 'healthy' : 'unavailable' },
                navigationEndpoint: { status: !!this.navigationEndpoint ? 'healthy' : 'unavailable' },
                sparqlStore: { status: !!this.sparqlStore ? 'healthy' : 'unavailable' },
                embeddingHandler: { status: !!this.embeddingHandler ? 'healthy' : 'unavailable' },
                llmHandler: { status: !!this.llmHandler ? 'healthy' : 'unavailable' }
            },
            capabilities: {
                fullNavigation: !!this.navigationEndpoint,
                corpuscleSelection: !!this.corpuscleSelector,
                tiltProjection: !!this.tiltProjector,
                transformation: !!this.transformer,
                sparqlIntegration: !!this.sparqlStore,
                embeddingSearch: !!this.embeddingHandler,
                llmAnalysis: !!this.llmHandler
            },
            activeRequests: this.activeRequests.size,
            metrics: this.metrics
        };
        
        // Determine overall health
        const criticalComponents = ['validator', 'normalizer'];
        const hasCriticalIssues = criticalComponents.some(comp => 
            health.components[comp].status !== 'healthy'
        );
        
        const hasCapabilities = health.capabilities.corpuscleSelection || 
                               health.capabilities.fullNavigation;
        
        if (hasCriticalIssues) {
            health.status = 'unhealthy';
        } else if (!hasCapabilities) {
            health.status = 'degraded';
        }
        
        return {
            success: true,
            health
        };
    }

    /**
     * Fallback navigation implementation when NavigationEndpoint is not available
     */
    async _executeNavigationFallback(params, requestId) {
        this.logger.info('Using fallback navigation implementation', { requestId });
        
        const normalizedParams = this.normalizer.normalize(params);
        
        // Stage 1: Corpuscle Selection
        const selectionStart = Date.now();
        const selectionResult = await this.corpuscleSelector.select(normalizedParams);
        const selectionTime = Date.now() - selectionStart;
        
        // Stage 2: Tilt Projection
        const projectionStart = Date.now();
        const projectionResult = await this.tiltProjector.project(
            selectionResult.corpuscles || [],
            normalizedParams.tilt || 'keywords',
            {
                embeddingHandler: this.embeddingHandler,
                textAnalyzer: this.llmHandler
            }
        );
        const projectionTime = Date.now() - projectionStart;
        
        // Stage 3: Transformation
        const transformStart = Date.now();
        const transformResult = await this.transformer.transform(
            projectionResult,
            selectionResult,
            normalizedParams.transform || {}
        );
        const transformTime = Date.now() - transformStart;
        
        this.metrics.navigations++;
        
        return {
            success: true,
            navigation: normalizedParams,
            content: transformResult.content,
            metadata: {
                pipeline: {
                    selectionTime,
                    projectionTime,
                    transformTime,
                    totalTime: selectionTime + projectionTime + transformTime
                },
                selection: selectionResult.metadata,
                projection: projectionResult.metadata,
                transformation: transformResult.metadata,
                fallbackUsed: true
            },
            diagnostics: {
                requestId,
                stages: ['selection', 'projection', 'transformation'],
                performance: { selectionTime, projectionTime, transformTime },
                implementation: 'fallback'
            }
        };
    }

    /**
     * Create a basic corpus interface for ZPT components
     */
    async _createCorpusInterface() {
        // This is a simplified interface - in real implementation would query Ragno corpus
        return {
            // Mock corpus interface
            query: async (criteria) => {
                this.logger.debug('Querying corpus with criteria:', criteria);
                return []; // Empty results for now
            },
            getMetadata: async () => ({
                totalUnits: 0,
                totalEntities: 0,
                lastUpdated: new Date().toISOString()
            })
        };
    }

    /**
     * Estimate tokens for corpuscles (simple heuristic)
     */
    _estimateTokens(corpuscles) {
        return corpuscles.reduce((total, corpuscle) => {
            const content = Object.values(corpuscle.content || {}).join(' ');
            return total + Math.ceil(content.length / 4); // Rough 4 chars per token
        }, 0);
    }

    /**
     * Update running average
     */
    _updateAverage(currentAvg, newValue) {
        const count = this.metrics.navigations + this.metrics.previews + 1;
        return (currentAvg * (count - 1) + newValue) / count;
    }

    /**
     * Sanitize parameters for logging (remove sensitive data)
     */
    _sanitizeParams(params) {
        const sanitized = { ...params };
        // Remove or mask any sensitive fields
        if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        return sanitized;
    }

    /**
     * Store interaction (inherited from BaseAPI)
     */
    async storeInteraction(interaction) {
        // ZPT doesn't directly store interactions, but processes navigation requests
        throw new Error('Use navigate operation to process ZPT navigation requests');
    }

    /**
     * Retrieve interactions (inherited from BaseAPI)
     */
    async retrieveInteractions(query) {
        // Return navigation history if implemented
        throw new Error('Navigation history retrieval not yet implemented');
    }

    /**
     * Get ZPT API metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();
        
        return {
            ...baseMetrics,
            zpt: this.metrics,
            components: {
                navigationEndpoint: !!this.navigationEndpoint,
                corpuscleSelector: !!this.corpuscleSelector,
                tiltProjector: !!this.tiltProjector,
                transformer: !!this.transformer,
                sparqlStore: !!this.sparqlStore,
                ragnoCorpus: !!this.ragnoCorpus
            },
            activeRequests: Array.from(this.activeRequests.values())
        };
    }

    async shutdown() {
        this.logger.info('Shutting down ZptAPI');
        
        // Wait for active requests to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.activeRequests.size > 0) {
            this.logger.warn(`Forced shutdown with ${this.activeRequests.size} active requests`);
        }
        
        // Shutdown navigation endpoint if available
        if (this.navigationEndpoint && typeof this.navigationEndpoint.shutdown === 'function') {
            await this.navigationEndpoint.shutdown();
        }
        
        // Cleanup other components
        if (this.transformer && typeof this.transformer.dispose === 'function') {
            await this.transformer.dispose();
        }
        
        if (this.corpuscleSelector && typeof this.corpuscleSelector.dispose === 'function') {
            await this.corpuscleSelector.dispose();
        }
        
        this.activeRequests.clear();
        
        await super.shutdown();
    }
}