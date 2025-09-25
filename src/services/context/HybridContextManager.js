/**
 * @deprecated HybridContextManager is broken - HTTP API uses working unifiedSearch, STDIO MCP uses this broken implementation
 * HybridContextManager - Intelligent merging of enhancement services with personal context
 * 
 * This service orchestrates the combination of external knowledge (Wikidata, Wikipedia, HyDE)
 * with personal/local context from chunked documents, using ZPT navigation state to guide
 * the integration process.
 * 
 * Key Features:
 * - Concurrent processing of enhancement and local search
 * - ZPT-guided scope and filtering
 * - Intelligent context weighting based on relevance
 * - Unified response synthesis
 * - Enhancement result caching for future reuse
 */

import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

const logger = createUnifiedLogger('HybridContextManager');
import AdaptiveSearchEngine from '../search/AdaptiveSearchEngine.js';
import { getPromptManager } from '../../prompts/index.js';

export class HybridContextManager {
    constructor(options = {}) {
        this.enhancementCoordinator = options.enhancementCoordinator;
        this.memoryManager = options.memoryManager;
        this.safeOperations = options.safeOperations;
        this.zptStateManager = options.zptStateManager;

        // Initialize prompt manager for synthesis templates
        this.promptManager = options.promptManager || getPromptManager();

        // Initialize adaptive search engine for intelligent threshold management
        this.adaptiveSearchEngine = new AdaptiveSearchEngine(this.safeOperations, {
            enableLearning: options.enableLearning !== false,
            maxPasses: options.maxSearchPasses || 3,
            targetResultCount: options.targetResultCount || 5,
            enablePanFilterBoosts: options.enablePanFilterBoosts !== false
        });

        // Configuration settings
        this.settings = {
            // Context weighting factors
            personalWeight: options.personalWeight,
            enhancementWeight: options.enhancementWeight,

            // Quality thresholds
            minPersonalRelevance: options.minPersonalRelevance,
            minEnhancementQuality: options.minEnhancementQuality,

            // Response length controls
            maxCombinedLength: options.maxCombinedLength || 8000,
            personalContextLimit: options.personalContextLimit || 4000,
            enhancementContextLimit: options.enhancementContextLimit || 4000,

            // Processing options
            enableConcurrentSearch: options.enableConcurrentSearch !== false,
            fallbackToSingleSource: options.fallbackToSingleSource !== false,

            ...options.settings
        };

        // Statistics tracking
        this.stats = {
            totalQueries: 0,
            hybridResponses: 0,
            personalOnlyResponses: 0,
            enhancementOnlyResponses: 0,
            failedMerges: 0,
            averagePersonalRelevance: 0,
            averageEnhancementQuality: 0
        };
    }

    /**
     * Process query with hybrid context approach
     * 
     * @param {string} query - User question
     * @param {Object} options - Enhancement and search options
     * @returns {Promise<Object>} Merged context result
     */
    async processQuery(query, options = {}) {
        const startTime = Date.now();
        this.stats.totalQueries++;

        logger.info('🔥 HIBRID_DEBUG: HybridContextManager.processQuery() CALLED', {
            query: query.substring(0, 50) + '...',
            useContext: options.useContext,
            useHyDE: options.useHyDE,
            useWikipedia: options.useWikipedia,
            useWikidata: options.useWikidata,
            mode: options.mode,
            hasThis: typeof this,
            hasSafeOperations: !!this.safeOperations,
            hasMemoryManager: !!this.memoryManager,
            hasAdaptiveSearchEngine: !!this.adaptiveSearchEngine
        });

        logger.debug('🔥 [HYBRID_CONTEXT] Starting query processing', {
            query: query.substring(0, 50) + '...',
            useContext: options.useContext,
            useHyDE: options.useHyDE,
            useWikipedia: options.useWikipedia,
            useWikidata: options.useWikidata,
            mode: options.mode
        });

        logger.debug('🔄 CONSOLE: HybridContextManager processQuery called with options:', {
            useContext: options.useContext,
            useHyDE: options.useHyDE,
            useWikipedia: options.useWikipedia,
            useWikidata: options.useWikidata,
            useWebSearch: options.useWebSearch,
            hasEnhancements: this._hasEnhancements(options)
        });
        logger.info('🔄 Processing query with hybrid context approach', {
            query: query.substring(0, 100) + '...',
            enableEnhancements: this._hasEnhancements(options),
            useLocalContext: options.useContext
        });

        try {
            // Get current ZPT state to guide search scope
            const zptState = this._getZPTState(options);

            // Run enhancement and local search concurrently
            logger.debug('🚀 [HYBRID_CONTEXT] Starting concurrent search for enhancements and local context');
            const [enhancementResult, localContextResult] = await this._runConcurrentSearch(
                query,
                options,
                zptState
            );

            logger.debug('🚀 [HYBRID_CONTEXT] Concurrent search completed', {
                enhancementSuccess: enhancementResult?.success,
                enhancementResultsCount: enhancementResult?.results?.length || 0,
                localContextSuccess: !!localContextResult,
                localContextCount: localContextResult?.contexts?.length || 0
            });

            // Analyze and weight the results
            const contextAnalysis = this._analyzeContextRelevance(
                query,
                enhancementResult,
                localContextResult,
                zptState
            );

            // Merge contexts intelligently
            const mergedContext = this._mergeContexts(
                enhancementResult,
                localContextResult,
                contextAnalysis,
                zptState
            );

            // Store enhancement results for future reuse (async, non-blocking)
            if (enhancementResult.success) {
                this._storeEnhancementResults(query, enhancementResult, zptState)
                    .catch(error => logger.warn('⚠️ Failed to store enhancement results', { error: error.message }));
            }

            // Generate unified response
            logger.debug('🤝 [HYBRID_CONTEXT] Synthesizing unified response', {
                mergedContextLength: mergedContext?.combinedContent?.length || 0,
                strategy: contextAnalysis.selectedStrategy
            });

            const unifiedResponse = await this._synthesizeResponse(
                query,
                mergedContext,
                contextAnalysis,
                options
            );

            logger.debug('✅ [HYBRID_CONTEXT] Response synthesis completed', {
                answerLength: unifiedResponse?.answer?.length || 0,
                hasAnswer: !!unifiedResponse?.answer
            });

            const processingTime = Date.now() - startTime;
            this._updateStats(contextAnalysis);

            logger.info('✅ Hybrid context processing completed', {
                processingTime: processingTime + 'ms',
                hasPersonalContext: !!localContextResult?.contexts?.length,
                hasEnhancementContext: !!enhancementResult?.success,
                mergeStrategy: contextAnalysis.selectedStrategy
            });

            // DEBUG: Log the actual structure we're working with
            logger.debug('🔥 DEBUG: HybridContextManager return data structure check', {
                localContextResult: localContextResult ? Object.keys(localContextResult) : 'null',
                localContextResultContexts: localContextResult?.contexts ? {
                    exists: true,
                    isArray: Array.isArray(localContextResult.contexts),
                    length: localContextResult.contexts.length,
                    type: typeof localContextResult.contexts
                } : 'no contexts property',
                enhancementResult: enhancementResult ? Object.keys(enhancementResult) : 'null',
                enhancementResultResults: enhancementResult?.results ? {
                    exists: true,
                    isArray: Array.isArray(enhancementResult.results),
                    length: enhancementResult.results.length
                } : 'no results property'
            });

            return {
                success: true,
                query,
                answer: unifiedResponse.answer,
                contextType: 'hybrid',
                personalContextUsed: contextAnalysis.personalWeight > 0,
                enhancementContextUsed: contextAnalysis.enhancementWeight > 0,
                contextAnalysis,
                mergedContext,
                processingTime,
                zptState,
                localContextResults: localContextResult?.contexts || [],
                enhancementResults: enhancementResult?.results || [],
                enhancements: this._extractEnhancementDetails(enhancementResult),
                stats: {
                    personalContextItems: localContextResult?.contexts?.length || 0,
                    enhancementSources: enhancementResult?.metadata?.servicesUsed || [],
                    totalContextLength: mergedContext?.combinedContent?.length || 0
                }
            };

        } catch (error) {
            logger.error('❌ Hybrid context processing failed:', error.message);

            // Fallback to single source if enabled
            if (this.settings.fallbackToSingleSource) {
                return this._handleFallback(query, options, error);
            }

            throw new Error(`Hybrid context processing failed: ${error.message}`);
        }
    }

    /**
     * Run enhancement and local context search concurrently
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @param {Object} zptState 
     * @returns {Promise<Array>} [enhancementResult, localContextResult]
     */
    async _runConcurrentSearch(query, options, zptState) {
        const searches = [];

        // Enhancement search (if requested) - check cache first, then live enhancement
        if (this._hasEnhancements(options) && this.enhancementCoordinator) {
            logger.debug('🔍 CONSOLE: Starting enhancement search with services:', {
                useHyDE: options.useHyDE,
                useWikipedia: options.useWikipedia,
                useWikidata: options.useWikidata,
                useWebSearch: options.useWebSearch
            });
            const enhancementOptions = this._adaptEnhancementOptionsForZPT(options, zptState);
            searches.push(
                this._searchCachedEnhancements(query, options)
                    .then(cachedResult => {
                        if (cachedResult && cachedResult.success) {
                            logger.info('🚀 Using cached enhancement result for query');
                            return cachedResult;
                        }

                        // No cache hit - proceed with live enhancement
                        logger.debug('🚀 CONSOLE: Cache miss - running live enhancements');
                        logger.debug('🔄 No cache hit, proceeding with live enhancement');
                        return this.enhancementCoordinator.enhanceQuery(query, enhancementOptions);
                    })
                    .catch(error => {
                        logger.warn('Enhancement search (cached + live) failed, continuing with local only:', error.message);
                        return { success: false, error: error.message };
                    })
            );
        } else {
            searches.push(Promise.resolve({ success: false, reason: 'not_requested' }));
        }

        // Local context search using adaptive engine
        logger.debug('🔍 Local context search check', {
            useContext: options.useContext,
            hasSafeOps: !!this.safeOperations,
            hasAdaptiveEngine: !!this.adaptiveSearchEngine
        });

        if (options.useContext && this.safeOperations) {
            logger.debug('🔍 [HYBRID_CONTEXT] Starting adaptive local context search');
            logger.debug('🚀 Executing adaptive local context search');
            // Pass options directly - AdaptiveSearchEngine handles ZPT adaptation internally
            searches.push(
                this._searchLocalContext(query, options)
                    .catch(error => {
                        logger.debug('❌ [HYBRID_CONTEXT] Local context search failed:', error.message);
                        logger.warn('Adaptive local context search failed:', error.message);
                        return { success: false, error: error.message, contexts: [] };
                    })
            );
        } else {
            logger.debug('⚠️ [HYBRID_CONTEXT] Skipping local context search', {
                useContext: options.useContext,
                hasSafeOps: !!this.safeOperations,
                reason: !options.useContext ? 'useContext=false' : 'no safeOperations'
            });
            logger.debug('⚠️ Skipping local context search', {
                useContext: options.useContext,
                hasSafeOps: !!this.safeOperations,
                reason: !options.useContext ? 'useContext=false' : 'no safeOperations'
            });
            searches.push(Promise.resolve({ success: false, reason: 'not_requested', contexts: [] }));
        }

        return Promise.all(searches);
    }

    /**
     * Search local context using AdaptiveSearchEngine with intelligent thresholds
     * Enhanced with ZPT-guided filtering, multi-pass search, and learning optimization
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @returns {Promise<Object>} Advanced local search results
     */
    async _searchLocalContext(query, options) {
        logger.debug('🎆 [HYBRID_CONTEXT] Searching local context with adaptive engine');
        logger.debug('🎆 Searching local context with adaptive engine');

        // Get ZPT state for filtering
        const zptState = this._getZPTState(options);

        // Execute adaptive search with intelligent threshold management
        logger.debug('🎯 [HYBRID_CONTEXT] Executing adaptive search with ZPT state:', {
            zoom: zptState?.zoom,
            panDomains: zptState?.pan?.domains,
            panKeywords: zptState?.pan?.keywords
        });

        const adaptiveResult = await this.adaptiveSearchEngine.executeAdaptiveSearch(
            query,
            zptState,
            options
        );

        logger.debug('✅ [HYBRID_CONTEXT] Adaptive search completed', {
            success: adaptiveResult.success,
            contextsFound: adaptiveResult.contexts?.length || 0,
            totalPasses: adaptiveResult.totalPasses
        });


        logger.info('🎆 Adaptive local search completed', {
            success: adaptiveResult.success,
            results: adaptiveResult.contexts.length,
            passes: adaptiveResult.totalPasses,
            avgQuality: adaptiveResult.searchStats?.averageQuality || 0,
            processingTime: adaptiveResult.searchStats?.processingTime || 0
        });

        return {
            success: adaptiveResult.success,
            contexts: adaptiveResult.contexts || [],
            searchMethod: 'adaptive_intelligent_search',
            totalFound: adaptiveResult.contexts?.length || 0,
            adaptiveStats: {
                totalPasses: adaptiveResult.totalPasses,
                thresholdConfig: adaptiveResult.thresholdConfig,
                searchStats: adaptiveResult.searchStats,
                panFilterBoosts: adaptiveResult.thresholdConfig?.panBoosts,
                queryAnalysis: adaptiveResult.thresholdConfig?.queryAnalysis
            },
            zptState: zptState
        };
    }

    /**
     * Analyze relevance and quality of different context sources
     * 
     * @private
     * @param {string} query 
     * @param {Object} enhancementResult 
     * @param {Object} localContextResult 
     * @param {Object} zptState 
     * @returns {Object} Context analysis with weights and strategy
     */
    _analyzeContextRelevance(query, enhancementResult, localContextResult, zptState) {
        const analysis = {
            hasPersonalContext: localContextResult.success && localContextResult.contexts.length > 0,
            hasEnhancementContext: enhancementResult.success && enhancementResult.enhancedAnswer,
            personalRelevance: 0,
            enhancementQuality: 0,
            personalWeight: 0,
            enhancementWeight: 0,
            selectedStrategy: 'none'
        };

        // Calculate personal context relevance
        if (analysis.hasPersonalContext) {
            analysis.personalRelevance = this._calculatePersonalRelevance(
                query,
                localContextResult.contexts
            );
        }

        // Calculate enhancement quality score
        if (analysis.hasEnhancementContext) {
            analysis.enhancementQuality = this._calculateEnhancementQuality(
                enhancementResult
            );
        }

        // Determine merge strategy and weights
        analysis.selectedStrategy = this._selectMergeStrategy(analysis, zptState);
        const weights = this._calculateContextWeights(analysis, zptState);
        analysis.personalWeight = weights.personal;
        analysis.enhancementWeight = weights.enhancement;

        logger.debug('📊 Context relevance analysis', {
            strategy: analysis.selectedStrategy,
            personalRelevance: analysis.personalRelevance,
            enhancementQuality: analysis.enhancementQuality,
            weights: {
                personal: analysis.personalWeight,
                enhancement: analysis.enhancementWeight
            }
        });

        return analysis;
    }

    /**
     * Calculate relevance score for personal context
     * 
     * @private
     * @param {string} query 
     * @param {Array} contexts 
     * @returns {number} Relevance score 0-1
     */
    _calculatePersonalRelevance(query, contexts) {
        if (!contexts || contexts.length === 0) return 0;

        // Simple relevance calculation based on similarity scores
        const avgSimilarity = contexts.reduce((sum, ctx) => sum + (ctx.similarity || 0), 0) / contexts.length;

        // Boost score if contexts contain query keywords
        const queryWords = query.toLowerCase().split(/\s+/);
        let keywordBonus = 0;

        for (const context of contexts) {
            const content = (context.prompt + ' ' + context.response).toLowerCase();
            const matches = queryWords.filter(word => content.includes(word)).length;
            keywordBonus += matches / queryWords.length;
        }

        keywordBonus = keywordBonus / contexts.length; // Average across contexts

        return Math.min(avgSimilarity + (keywordBonus * 0.2), 1.0);
    }

    /**
     * Calculate quality score for enhancement results
     * 
     * @private
     * @param {Object} enhancementResult 
     * @returns {number} Quality score 0-1
     */
    _calculateEnhancementQuality(enhancementResult) {
        if (!enhancementResult.success || !enhancementResult.enhancedAnswer) return 0;

        let qualityScore = 0.5; // Base score for successful enhancement

        // Boost for multiple services used
        const servicesUsed = enhancementResult.stats?.successfulServices || 0;
        qualityScore += Math.min(servicesUsed * 0.1, 0.3);

        // Boost for longer, detailed responses
        const answerLength = enhancementResult.enhancedAnswer.length;
        if (answerLength > 1000) qualityScore += 0.1;
        if (answerLength > 2000) qualityScore += 0.1;

        return Math.min(qualityScore, 1.0);
    }

    /**
     * Select optimal merge strategy based on context analysis
     * 
     * @private
     * @param {Object} analysis 
     * @param {Object} zptState 
     * @returns {string} Selected strategy
     */
    _selectMergeStrategy(analysis, zptState) {
        // No context available
        if (!analysis.hasPersonalContext && !analysis.hasEnhancementContext) {
            return 'no_context';
        }

        // Only one source available
        if (!analysis.hasPersonalContext) return 'enhancement_only';
        if (!analysis.hasEnhancementContext) return 'personal_only';

        // Both sources available - choose based on quality and ZPT state
        const personalQuality = analysis.personalRelevance;
        const enhancementQuality = analysis.enhancementQuality;

        // ZPT zoom level influences strategy
        if (zptState.zoom === 'entity') {
            // Entity-level favors personal context
            return personalQuality >= this.settings.minPersonalRelevance ? 'personal_primary' : 'balanced';
        } else if (zptState.zoom === 'corpus') {
            // Corpus-level favors enhancement context  
            return enhancementQuality >= this.settings.minEnhancementQuality ? 'enhancement_primary' : 'balanced';
        }

        // Default balanced approach
        return 'balanced';
    }

    /**
     * Calculate sophisticated context weights based on multiple factors and ZPT state
     * 
     * @private
     * @param {Object} analysis 
     * @param {Object} zptState 
     * @returns {Object} Detailed weights and rationale for personal and enhancement context
     */
    _calculateContextWeights(analysis, zptState) {
        logger.debug('⚖️ Calculating sophisticated context weights', {
            strategy: analysis.selectedStrategy,
            personalRelevance: analysis.personalRelevance,
            enhancementQuality: analysis.enhancementQuality,
            zoomLevel: zptState.zoom
        });

        const strategy = analysis.selectedStrategy;

        // Handle explicit single-source strategies first
        if (strategy === 'personal_only') {
            return {
                personal: 1.0,
                enhancement: 0.0,
                rationale: 'Explicit personal-only strategy',
                confidence: 1.0
            };
        }
        if (strategy === 'enhancement_only') {
            return {
                personal: 0.0,
                enhancement: 1.0,
                rationale: 'Explicit enhancement-only strategy',
                confidence: 1.0
            };
        }

        // For hybrid strategies, calculate sophisticated weights
        const weights = this._calculateMultiFactorWeights(analysis, zptState);

        // Apply strategy-specific adjustments
        let finalWeights;
        switch (strategy) {
            case 'personal_primary':
                finalWeights = this._adjustWeights(weights, { personalBias: 0.2, enhancementBias: -0.1 });
                finalWeights.rationale = `Personal-primary strategy with quality adjustment (P:${finalWeights.personal.toFixed(2)}, E:${finalWeights.enhancement.toFixed(2)})`;
                break;

            case 'enhancement_primary':
                finalWeights = this._adjustWeights(weights, { personalBias: -0.1, enhancementBias: 0.2 });
                finalWeights.rationale = `Enhancement-primary strategy with quality adjustment (P:${finalWeights.personal.toFixed(2)}, E:${finalWeights.enhancement.toFixed(2)})`;
                break;

            case 'balanced':
            default:
                finalWeights = weights;
                finalWeights.rationale = `Dynamic balanced weighting based on quality, recency, ZPT state, and coverage (P:${finalWeights.personal.toFixed(2)}, E:${finalWeights.enhancement.toFixed(2)})`;
                break;
        }

        logger.debug('⚖️ Context weights calculated', {
            strategy,
            personalWeight: finalWeights.personal,
            enhancementWeight: finalWeights.enhancement,
            confidence: finalWeights.confidence,
            factors: finalWeights.factors
        });

        return finalWeights;
    }

    /**
     * Calculate multi-factor weights considering quality, ZPT state, recency, and coverage
     * 
     * @private
     * @param {Object} analysis 
     * @param {Object} zptState 
     * @returns {Object} Sophisticated weight calculation
     */
    _calculateMultiFactorWeights(analysis, zptState) {
        const factors = {
            qualityScore: { personal: 0, enhancement: 0 },
            zptAlignment: { personal: 0, enhancement: 0 },
            recency: { personal: 0, enhancement: 0 },
            coverage: { personal: 0, enhancement: 0 },
            confidence: { personal: 0, enhancement: 0 }
        };

        // Factor 1: Basic Quality Scores (40% weight)
        const qualityWeight = 0.4;
        factors.qualityScore.personal = (analysis.personalRelevance || 0) * qualityWeight;
        factors.qualityScore.enhancement = (analysis.enhancementQuality || 0) * qualityWeight;

        // Factor 2: ZPT State Alignment (25% weight)
        const zptWeight = 0.25;
        const zptAlignment = this._calculateZPTAlignment(analysis, zptState);
        factors.zptAlignment.personal = zptAlignment.personal * zptWeight;
        factors.zptAlignment.enhancement = zptAlignment.enhancement * zptWeight;

        // Factor 3: Recency Bias (15% weight)
        const recencyWeight = 0.15;
        const recencyBias = this._calculateRecencyBias(analysis);
        factors.recency.personal = recencyBias.personal * recencyWeight;
        factors.recency.enhancement = recencyBias.enhancement * recencyWeight;

        // Factor 4: Content Coverage (15% weight)
        const coverageWeight = 0.15;
        const coverageBias = this._calculateCoverageBias(analysis);
        factors.coverage.personal = coverageBias.personal * coverageWeight;
        factors.coverage.enhancement = coverageBias.enhancement * coverageWeight;

        // Factor 5: Confidence/Authority (5% weight)
        const confidenceWeight = 0.05;
        const confidenceBias = this._calculateConfidenceBias(analysis);
        factors.confidence.personal = confidenceBias.personal * confidenceWeight;
        factors.confidence.enhancement = confidenceBias.enhancement * confidenceWeight;

        // Sum all factors
        const personalTotal = Object.values(factors).reduce((sum, factor) => sum + factor.personal, 0);
        const enhancementTotal = Object.values(factors).reduce((sum, factor) => sum + factor.enhancement, 0);
        const grandTotal = personalTotal + enhancementTotal;

        // Normalize to weights that sum to 1.0
        let personal, enhancement;
        if (grandTotal === 0) {
            personal = 0.5;
            enhancement = 0.5;
        } else {
            personal = personalTotal / grandTotal;
            enhancement = enhancementTotal / grandTotal;
        }

        // Ensure minimum thresholds (no source should be completely ignored unless explicitly requested)
        const minWeight = 0.05;
        if (personal > 0 && personal < minWeight) personal = minWeight;
        if (enhancement > 0 && enhancement < minWeight) enhancement = minWeight;

        // Re-normalize if needed
        const adjustedTotal = personal + enhancement;
        if (adjustedTotal > 1.0) {
            personal = personal / adjustedTotal;
            enhancement = enhancement / adjustedTotal;
        }

        // Calculate confidence in our weighting decision
        const confidence = Math.min(1.0, Math.abs(personalTotal - enhancementTotal) + 0.3); // Higher confidence for clearer differences

        return {
            personal,
            enhancement,
            confidence,
            factors: {
                quality: { personal: factors.qualityScore.personal, enhancement: factors.qualityScore.enhancement },
                zptAlignment: { personal: factors.zptAlignment.personal, enhancement: factors.zptAlignment.enhancement },
                recency: { personal: factors.recency.personal, enhancement: factors.recency.enhancement },
                coverage: { personal: factors.coverage.personal, enhancement: factors.coverage.enhancement },
                confidenceFactor: { personal: factors.confidence.personal, enhancement: factors.confidence.enhancement }
            },
            totals: { personal: personalTotal, enhancement: enhancementTotal }
        };
    }

    /**
     * Calculate how well each context type aligns with current ZPT state
     * 
     * @private
     * @param {Object} analysis 
     * @param {Object} zptState 
     * @returns {Object} ZPT alignment scores
     */
    _calculateZPTAlignment(analysis, zptState) {
        let personalAlignment = 0.5; // Base score
        let enhancementAlignment = 0.5; // Base score

        // Zoom level preferences
        switch (zptState.zoom) {
            case 'entity':
                // Entity level: prefer personal context (specific experiences)
                personalAlignment += 0.3;
                enhancementAlignment += 0.1;
                break;
            case 'unit':
            case 'text':
                // Unit/text level: balanced preference with slight personal bias
                personalAlignment += 0.2;
                enhancementAlignment += 0.15;
                break;
            case 'community':
                // Community level: slight enhancement preference (broader context)
                personalAlignment += 0.1;
                enhancementAlignment += 0.2;
                break;
            case 'corpus':
            case 'micro':
                // Corpus level: prefer enhancement (comprehensive knowledge)
                personalAlignment += 0.05;
                enhancementAlignment += 0.3;
                break;
        }

        // Pan filter considerations
        if (zptState.pan) {
            // If specific entities/keywords are filtered, personal context might be more relevant
            const hasSpecificFilters = (zptState.pan.entities && zptState.pan.entities.length > 0) ||
                (zptState.pan.keywords && zptState.pan.keywords.length > 0);
            if (hasSpecificFilters) {
                personalAlignment += 0.1;
            }

            // If domain filters are set, enhancement might provide better coverage
            if (zptState.pan.domains && zptState.pan.domains.length > 0) {
                enhancementAlignment += 0.1;
            }
        }

        // Tilt style considerations
        switch (zptState.tilt) {
            case 'graph':
                // Graph tilt: enhancement might provide better relationship data
                enhancementAlignment += 0.1;
                break;
            case 'embedding':
                // Embedding tilt: both are semantic, slight personal preference for lived experience
                personalAlignment += 0.05;
                break;
            case 'temporal':
                // Temporal tilt: personal context often has better temporal grounding
                personalAlignment += 0.1;
                break;
            case 'keywords':
                // Keywords: both can provide good keyword matches
                // No adjustment
                break;
        }

        // Clamp to valid range [0, 1]
        personalAlignment = Math.min(1.0, Math.max(0.0, personalAlignment));
        enhancementAlignment = Math.min(1.0, Math.max(0.0, enhancementAlignment));

        return { personal: personalAlignment, enhancement: enhancementAlignment };
    }

    /**
     * Calculate recency bias (newer information preferred)
     * 
     * @private
     * @param {Object} analysis 
     * @returns {Object} Recency bias scores
     */
    _calculateRecencyBias(analysis) {
        // Personal context typically has better temporal/recency information
        // Enhancement context from APIs might be more current for factual information

        return {
            personal: 0.6, // Personal experiences are timestamped and contextual
            enhancement: 0.4 // Enhancement data might be more current but less personal
        };
    }

    /**
     * Calculate coverage bias (comprehensive vs specific)
     * 
     * @private
     * @param {Object} analysis 
     * @returns {Object} Coverage bias scores
     */
    _calculateCoverageBias(analysis) {
        // Enhancement typically provides broader coverage
        // Personal context provides deeper, more specific coverage

        const personalContexts = analysis.personalContexts || [];
        const personalCoverage = Math.min(1.0, personalContexts.length / 3); // Normalize by expected count

        return {
            personal: personalCoverage * 0.7, // Personal is specific but potentially limited
            enhancement: 0.8 // Enhancement typically provides comprehensive coverage
        };
    }

    /**
     * Calculate confidence/authority bias
     * 
     * @private
     * @param {Object} analysis 
     * @returns {Object} Confidence bias scores
     */
    _calculateConfidenceBias(analysis) {
        return {
            personal: 0.7, // Personal context has high confidence for personal experiences
            enhancement: 0.8 // Enhancement from authoritative sources has high confidence
        };
    }

    /**
     * Apply strategy-specific bias adjustments to weights
     * 
     * @private
     * @param {Object} weights 
     * @param {Object} biases 
     * @returns {Object} Adjusted weights
     */
    _adjustWeights(weights, biases) {
        let personal = weights.personal + (biases.personalBias || 0);
        let enhancement = weights.enhancement + (biases.enhancementBias || 0);

        // Ensure weights stay in [0, 1] range
        personal = Math.min(1.0, Math.max(0.0, personal));
        enhancement = Math.min(1.0, Math.max(0.0, enhancement));

        // Normalize to sum to 1.0
        const total = personal + enhancement;
        if (total > 0) {
            personal = personal / total;
            enhancement = enhancement / total;
        }

        return {
            personal,
            enhancement,
            confidence: weights.confidence,
            factors: weights.factors
        };
    }

    /**
     * Store enhancement results in SPARQL for future reuse
     * 
     * @private
     * @param {string} query Original query
     * @param {Object} enhancementResult Enhancement results
     * @param {Object} zptState Current ZPT state
     * @returns {Promise<void>}
     */
    async _storeEnhancementResults(query, enhancementResult, zptState) {
        logger.debug('💾 Storing enhancement results for future reuse');

        try {
            if (!this.memoryManager?.store) {
                logger.warn('⚠️ No store available for enhancement caching');
                return;
            }

            const store = this.memoryManager.store;

            // Create unique ID for this enhancement cache entry
            const enhancementId = `enhancement_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            // Determine enhancement type and extract relevant content
            const enhancementData = this._extractEnhancementData(enhancementResult);

            // Generate embedding for the enhancement content for future semantic search
            let enhancementEmbedding;
            try {
                enhancementEmbedding = await this.safeOperations.generateEmbedding(
                    enhancementData.content || enhancementResult.enhancedAnswer || query
                );
            } catch (embeddingError) {
                logger.warn('⚠️ Failed to generate embedding for enhancement results', { error: embeddingError.message });
                enhancementEmbedding = null;
            }

            // Prepare enhancement metadata
            const enhancementMetadata = {
                type: 'enhancement_cache',
                enhancementType: enhancementResult.enhancementType || 'mixed',
                sourceQuery: query,
                servicesUsed: enhancementResult.metadata?.servicesUsed || [],
                enhancementSources: enhancementData.sources || [],
                zptContext: {
                    zoom: zptState.zoom,
                    pan: zptState.pan || {},
                    tilt: zptState.tilt
                },
                cacheInfo: {
                    createdAt: new Date().toISOString(),
                    ttl: this._calculateEnhancementTTL(enhancementData.sources),
                    expiresAt: new Date(Date.now() + this._calculateEnhancementTTL(enhancementData.sources) * 1000).toISOString()
                },
                quality: {
                    enhancementQuality: this._calculateEnhancementQuality(enhancementResult),
                    confidence: enhancementResult.confidence,
                    servicesCount: enhancementResult.stats?.successfulServices || 0
                }
            };

            // Store as interaction for semantic search
            const prompt = `Enhancement Query: ${query}`;
            const response = enhancementResult.enhancedAnswer || enhancementData.content || 'Enhancement results cached';

            if (typeof store.store === 'function') {
                // Use the store's main storage method
                await store.store({
                    id: enhancementId,
                    prompt,
                    response,
                    embedding: enhancementEmbedding,
                    concepts: enhancementData.concepts || [],
                    metadata: enhancementMetadata
                });

                logger.info('💾 Enhancement results stored successfully', {
                    enhancementId,
                    enhancementType: enhancementResult.enhancementType,
                    servicesUsed: enhancementMetadata.servicesUsed.length,
                    ttl: enhancementMetadata.cacheInfo.ttl,
                    hasEmbedding: !!enhancementEmbedding
                });

            } else if (typeof store.storeEnhancementCache === 'function') {
                // Use specialized enhancement storage if available
                await store.storeEnhancementCache({
                    id: enhancementId,
                    query,
                    enhancementResult,
                    embedding: enhancementEmbedding,
                    metadata: enhancementMetadata
                });

                logger.info('💾 Enhancement results stored via specialized method', {
                    enhancementId,
                    enhancementType: enhancementResult.enhancementType
                });

            } else {
                logger.warn('⚠️ Store does not support enhancement caching');
            }

        } catch (error) {
            logger.error('❌ Failed to store enhancement results', {
                error: error.message,
                query: query.substring(0, 50) + '...'
            });
            // Don't throw - enhancement storage failure shouldn't break the main flow
        }
    }

    /**
     * Extract structured data from enhancement results
     * 
     * @private
     * @param {Object} enhancementResult 
     * @returns {Object} Structured enhancement data
     */
    _extractEnhancementData(enhancementResult) {
        const data = {
            content: '',
            sources: [],
            concepts: []
        };

        // Extract content and sources based on enhancement type
        if (enhancementResult.enhancedAnswer) {
            data.content = enhancementResult.enhancedAnswer;
        }

        // Extract sources from enhancement metadata
        if (enhancementResult.context?.enhancements) {
            const enhancements = enhancementResult.context.enhancements;

            if (enhancements.wikidata) {
                data.sources.push({
                    type: 'wikidata',
                    content: enhancements.wikidata,
                    reliability: 0.9
                });
            }

            if (enhancements.wikipedia) {
                data.sources.push({
                    type: 'wikipedia',
                    content: enhancements.wikipedia,
                    reliability: 0.85
                });
            }

            if (enhancements.hyde) {
                data.sources.push({
                    type: 'hyde',
                    content: enhancements.hyde,
                    reliability: 0.7
                });
            }
        }

        // Extract concepts if available
        if (enhancementResult.concepts) {
            data.concepts = Array.isArray(enhancementResult.concepts) ?
                enhancementResult.concepts : [enhancementResult.concepts];
        }

        // If no explicit content, use the main enhanced answer
        if (!data.content && data.sources.length > 0) {
            data.content = data.sources.map(s => s.content).join('\n\n');
        }

        return data;
    }

    /**
     * Calculate TTL for enhancement cache based on source types
     * 
     * @private
     * @param {Array} sources Enhancement sources
     * @returns {number} TTL in seconds
     */
    _calculateEnhancementTTL(sources) {
        // Default TTL: 7 days
        let baseTTL = 7 * 24 * 60 * 60; // 7 days in seconds

        if (!sources || sources.length === 0) {
            return baseTTL;
        }

        // Adjust TTL based on source types
        let adjustmentFactor = 1.0;

        sources.forEach(source => {
            switch (source.type) {
                case 'wikidata':
                    // Wikidata is relatively stable - longer TTL
                    adjustmentFactor = Math.max(adjustmentFactor, 1.5);
                    break;
                case 'wikipedia':
                    // Wikipedia changes more frequently - medium TTL
                    adjustmentFactor = Math.max(adjustmentFactor, 1.2);
                    break;
                case 'hyde':
                    // HyDE is generated content - shorter TTL
                    adjustmentFactor = Math.max(adjustmentFactor, 0.8);
                    break;
            }
        });

        return Math.floor(baseTTL * adjustmentFactor);
    }

    /**
     * Search for cached enhancement results for similar queries
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @returns {Promise<Object|null>} Cached enhancement result or null
     */
    async _searchCachedEnhancements(query, options) {
        logger.debug('🔎 Searching for cached enhancement results');

        try {
            if (!this.safeOperations) {
                return null;
            }

            // Search for similar enhancement cache entries
            const cacheResults = await this.safeOperations.searchSimilar(
                `Enhancement Query: ${query}`,
                3, // limit to top 3 matches
                0.8 // high threshold for cache hits
            );

            if (!cacheResults || cacheResults.length === 0) {
                logger.debug('🔎 No cached enhancement results found');
                return null;
            }

            // Filter for enhancement cache entries that haven't expired
            const validCacheEntries = cacheResults.filter(result => {
                const metadata = result.metadata;
                if (!metadata || metadata.type !== 'enhancement_cache') {
                    return false;
                }

                // Check if cache entry has expired
                if (metadata.cacheInfo?.expiresAt) {
                    const expiresAt = new Date(metadata.cacheInfo.expiresAt);
                    if (new Date() > expiresAt) {
                        logger.debug('🕰️ Cache entry expired, skipping', {
                            expiresAt: expiresAt.toISOString(),
                            age: Math.floor((Date.now() - expiresAt.getTime()) / 1000 / 60) + ' minutes'
                        });
                        return false;
                    }
                }

                return true;
            });

            if (validCacheEntries.length === 0) {
                logger.debug('🔎 No valid (non-expired) cached enhancement results found');
                return null;
            }

            // Return the best match
            const bestMatch = validCacheEntries[0];
            logger.info('🚀 Using cached enhancement result', {
                similarity: bestMatch.similarity,
                cacheAge: Math.floor((Date.now() - new Date(bestMatch.metadata?.cacheInfo?.createdAt).getTime()) / 1000 / 60) + ' minutes',
                enhancementType: bestMatch.metadata?.enhancementType
            });

            return {
                success: true,
                cached: true,
                enhancedAnswer: bestMatch.response,
                enhancementType: bestMatch.metadata?.enhancementType || 'cached',
                cacheMetadata: bestMatch.metadata,
                similarity: bestMatch.similarity
            };

        } catch (error) {
            logger.warn('⚠️ Failed to search cached enhancements', { error: error.message });
            return null;
        }
    }

    /**
     * Merge contexts according to selected strategy and weights
     * 
     * @private
     * @param {Object} enhancementResult 
     * @param {Object} localContextResult 
     * @param {Object} contextAnalysis 
     * @param {Object} zptState 
     * @returns {Object} Merged context
     */
    _mergeContexts(enhancementResult, localContextResult, contextAnalysis, zptState) {
        const mergedContext = {
            strategy: contextAnalysis.selectedStrategy,
            personalContent: '',
            enhancementContent: '',
            combinedContent: '',
            sources: []
        };

        // Extract personal context content
        if (contextAnalysis.personalWeight > 0 && localContextResult.contexts) {
            logger.debug('🔥 DEBUG: HybridContextManager _mergeContexts processing contexts', {
                contextCount: localContextResult.contexts.length,
                personalWeight: contextAnalysis.personalWeight,
                firstContext: localContextResult.contexts[0] ? {
                    hasPrompt: !!localContextResult.contexts[0].prompt,
                    hasOutput: !!localContextResult.contexts[0].output,
                    hasResponse: !!localContextResult.contexts[0].response,
                    hasContent: !!localContextResult.contexts[0].content,
                    keys: Object.keys(localContextResult.contexts[0]),
                    promptPreview: localContextResult.contexts[0].prompt?.substring(0, 50),
                    outputPreview: localContextResult.contexts[0].output?.substring(0, 50),
                    responsePreview: localContextResult.contexts[0].response?.substring(0, 50),
                    contentPreview: localContextResult.contexts[0].content?.substring(0, 50)
                } : 'no first context'
            });

            const personalContexts = localContextResult.contexts
                .slice(0, 3) // Limit to top 3 for brevity
                .map((ctx, index) => {
                    // Handle multiple content field formats:
                    // - ctx.output: MemoryManager results
                    // - ctx.content: ragno:Unit chunks 
                    // - ctx.response: old format interactions
                    const content = ctx.output || ctx.response || ctx.content || '';

                    // For document chunks, just return the content without the metadata prompt
                    // This avoids showing "Document chunk: ..." in the final response
                    let contextString = content;

                    // If the content is very short or empty, include some context from prompt
                    if (!content || content.length < 20) {
                        // Extract document title/context from prompt if available
                        if (ctx.prompt && ctx.prompt.includes('Document:')) {
                            const docMatch = ctx.prompt.match(/Document:\s*([^#]+)/);
                            const titleMatch = ctx.prompt.match(/#\s*([^\n]+)/);
                            if (docMatch && titleMatch) {
                                contextString = `${titleMatch[1].trim()}\n\n${content}`;
                            } else {
                                contextString = content || ctx.prompt;
                            }
                        } else {
                            contextString = content || ctx.prompt;
                        }
                    }

                    logger.debug(`🔥 DEBUG: HybridContextManager context ${index} extraction`, {
                        hasPrompt: !!ctx.prompt,
                        hasOutput: !!ctx.output,
                        hasResponse: !!ctx.response,
                        hasContent: !!ctx.content,
                        extractedContent: content.substring(0, 100),
                        finalString: contextString.substring(0, 100)
                    });

                    return contextString;
                });

            mergedContext.personalContent = personalContexts.join('\n\n');
            mergedContext.sources.push({
                type: 'personal',
                weight: contextAnalysis.personalWeight,
                itemCount: localContextResult.contexts.length
            });
        }

        // Extract enhancement content
        if (contextAnalysis.enhancementWeight > 0 && enhancementResult.enhancedAnswer) {
            mergedContext.enhancementContent = enhancementResult.enhancedAnswer;
            mergedContext.sources.push({
                type: 'enhancement',
                weight: contextAnalysis.enhancementWeight,
                services: enhancementResult.stats?.successfulServices || 0
            });
        }

        // Combine content based on strategy
        mergedContext.combinedContent = this._combineContent(
            mergedContext.personalContent,
            mergedContext.enhancementContent,
            contextAnalysis
        );

        return mergedContext;
    }

    /**
     * Combine personal and enhancement content intelligently
     * 
     * @private
     * @param {string} personalContent 
     * @param {string} enhancementContent 
     * @param {Object} contextAnalysis 
     * @returns {string} Combined content
     */
    _combineContent(personalContent, enhancementContent, contextAnalysis) {
        const parts = [];

        if (personalContent && contextAnalysis.personalWeight > 0) {
            parts.push(`[PERSONAL CONTEXT]\n${personalContent}`);
        }

        if (enhancementContent && contextAnalysis.enhancementWeight > 0) {
            parts.push(`[EXTERNAL KNOWLEDGE]\n${enhancementContent}`);
        }

        return parts.join('\n\n---\n\n');
    }

    /**
     * Synthesize unified response from merged context with sophisticated integration
     * 
     * @private
     * @param {string} query 
     * @param {Object} mergedContext 
     * @param {Object} contextAnalysis 
     * @param {Object} options 
     * @returns {Promise<Object>} Synthesized response
     */
    async _synthesizeResponse(query, mergedContext, contextAnalysis, options) {
        logger.debug('🎨 Synthesizing unified response', {
            strategy: contextAnalysis.selectedStrategy,
            personalWeight: contextAnalysis.personalWeight,
            enhancementWeight: contextAnalysis.enhancementWeight
        });

        // Create sophisticated synthesis prompt
        const synthesisComponents = this._prepareSynthesisComponents(
            query,
            mergedContext,
            contextAnalysis
        );

        const synthesisPrompt = await this._createAdvancedSynthesisPrompt(
            query,
            synthesisComponents,
            contextAnalysis
        );

        // Generate response using LLM with enhanced prompting
        let answer;
        if (this.safeOperations?.generateResponse) {
            try {
                logger.debug('🔥 DEBUG: HybridContextManager about to call LLM generateResponse', {
                    promptType: typeof synthesisPrompt,
                    promptKeys: typeof synthesisPrompt === 'object' ? Object.keys(synthesisPrompt) : 'not-object',
                    promptLength: typeof synthesisPrompt === 'string' ? synthesisPrompt.length : 'not-string',
                    promptPreview: typeof synthesisPrompt === 'string' ? synthesisPrompt.substring(0, 200) : JSON.stringify(synthesisPrompt).substring(0, 200),
                    hasPersonalContent: !!synthesisComponents.personalContent,
                    personalContentLength: synthesisComponents.personalContent?.length || 0,
                    personalContentPreview: synthesisComponents.personalContent?.substring(0, 100),
                    hasEnhancementContent: !!synthesisComponents.enhancementContent,
                    enhancementContentLength: synthesisComponents.enhancementContent?.length || 0,
                    enhancementContentPreview: synthesisComponents.enhancementContent?.substring(0, 100)
                });

                // Create a cleaner, more natural prompt that blends contexts without explicit section headers
                const contextParts = [];

                if (synthesisComponents.personalContent) {
                    logger.debug('🔥 DEBUG: Adding personal content to context');
                    contextParts.push(synthesisComponents.personalContent);
                }

                if (synthesisComponents.enhancementContent) {
                    logger.debug('🔥 DEBUG: Adding enhancement content to context (from web search, Wikipedia, etc.)');
                    contextParts.push(synthesisComponents.enhancementContent);
                }

                const contextContent = contextParts.length > 0 ? contextParts.join('\n\n') : 'No relevant context found.';

                logger.debug('🔥 DEBUG: Final context composition', {
                    totalParts: contextParts.length,
                    combinedLength: contextContent.length,
                    contextPreview: contextContent.substring(0, 300)
                });

                // More natural prompt that encourages synthesis rather than verbatim reproduction
                const directPrompt = `Please answer this question naturally, drawing insights from the available information:

"${query}"

Available information:
${contextContent}

Provide a helpful, synthesized answer based on the information above. Focus on directly answering the question rather than repeating the source material.`;

                answer = await this.safeOperations.generateResponse(directPrompt);

                logger.debug('🔥 DEBUG: HybridContextManager LLM response received', {
                    answerLength: answer?.length || 0,
                    answerPreview: answer?.substring(0, 200)
                });

                logger.debug('✅ LLM response generated successfully');
            } catch (error) {
                logger.debug('🔥 DEBUG: HybridContextManager LLM generation failed', {
                    error: error.message,
                    errorType: error.constructor.name,
                    fallbackToTemplate: true
                });

                logger.warn('⚠️ LLM response generation failed, using template fallback', {
                    error: error.message,
                    errorType: error.constructor.name
                });
                // Enhanced fallback with template-based synthesis
                answer = this._createTemplateBasedResponse(query, synthesisComponents, contextAnalysis);

                logger.debug('🔥 DEBUG: HybridContextManager template fallback used', {
                    templateAnswerLength: answer?.length || 0,
                    templateAnswerPreview: answer?.substring(0, 200)
                });
            }
        } else {
            logger.debug('🔄 No LLM available, using template-based response');
            // Enhanced fallback with template-based synthesis
            answer = this._createTemplateBasedResponse(query, synthesisComponents, contextAnalysis);
        }

        // Post-process to ensure proper source attribution
        const enhancedAnswer = this._enhanceSourceAttribution(answer, synthesisComponents, contextAnalysis);

        logger.info('🎨 Response synthesis completed', {
            answerLength: enhancedAnswer.length,
            hasPersonalContent: !!synthesisComponents.personalContent,
            hasEnhancementContent: !!synthesisComponents.enhancementContent,
            strategy: contextAnalysis.selectedStrategy
        });

        // Prepare result arrays for simple-verbs compatibility
        const localContextResults = synthesisComponents.personalSources || [];
        const enhancementResults = synthesisComponents.enhancementSources || [];

        logger.debug('🔥 DEBUG: HybridContextManager returning results', {
            localContextResultsCount: localContextResults.length,
            enhancementResultsCount: enhancementResults.length,
            totalContextItems: localContextResults.length + enhancementResults.length,
            localContextResultsType: Array.isArray(localContextResults) ? 'array' : typeof localContextResults,
            enhancementResultsType: Array.isArray(enhancementResults) ? 'array' : typeof enhancementResults,
            personalSourcesFromSynthesis: synthesisComponents.personalSources ? synthesisComponents.personalSources.length : 'undefined',
            enhancementSourcesFromSynthesis: synthesisComponents.enhancementSources ? synthesisComponents.enhancementSources.length : 'undefined'
        });

        return {
            success: true,
            answer: enhancedAnswer,
            synthesisPrompt,
            synthesisComponents,
            method: 'advanced_hybrid_synthesis',
            // These fields are expected by simple-verbs.js
            localContextResults,
            enhancementResults,
            localContextUsed: localContextResults.length > 0,
            enhancementUsed: enhancementResults.length > 0,
            // Legacy compatibility
            sourceAttribution: {
                personalSources: synthesisComponents.personalSources?.length || 0,
                enhancementSources: synthesisComponents.enhancementSources?.length || 0,
                crossReferences: synthesisComponents.crossReferences?.length || 0
            }
        };
    }

    /**
     * Prepare structured synthesis components from merged context
     * 
     * @private
     * @param {string} query 
     * @param {Object} mergedContext 
     * @param {Object} contextAnalysis 
     * @returns {Object} Structured synthesis components
     */
    _prepareSynthesisComponents(query, mergedContext, contextAnalysis) {
        const components = {
            personalContent: '',
            enhancementContent: '',
            personalSources: [],
            enhancementSources: [],
            crossReferences: [],
            keyInsights: {
                personal: [],
                enhancement: [],
                connections: []
            }
        };

        // Extract personal context components
        if (mergedContext.personalContent && contextAnalysis.personalWeight > 0) {
            components.personalContent = mergedContext.personalContent;

            logger.debug('🔥 DEBUG: HybridContextManager - personalContent extracted', {
                length: mergedContext.personalContent.length,
                preview: mergedContext.personalContent.substring(0, 100),
                hasADHD: mergedContext.personalContent.toLowerCase().includes('adhd')
            });

            // Extract personal sources from merged context
            if (mergedContext.sources) {
                components.personalSources = mergedContext.sources.filter(source =>
                    source.type === 'personal' || source.source === 'local_context'
                );
            }

            // Extract key personal insights
            components.keyInsights.personal = this._extractKeyInsights(
                mergedContext.personalContent, 'personal'
            );
        }

        // Extract enhancement context components
        if (mergedContext.enhancementContent && contextAnalysis.enhancementWeight > 0) {
            components.enhancementContent = mergedContext.enhancementContent;

            // Extract enhancement sources
            if (mergedContext.sources) {
                components.enhancementSources = mergedContext.sources.filter(source =>
                    source.type === 'enhancement' || ['wikidata', 'wikipedia', 'hyde'].includes(source.source)
                );
            }

            // Extract key enhancement insights
            components.keyInsights.enhancement = this._extractKeyInsights(
                mergedContext.enhancementContent, 'enhancement'
            );
        }

        // Identify cross-references and connections between personal and external knowledge
        if (components.personalContent && components.enhancementContent) {
            components.crossReferences = this._identifyCrossReferences(
                components.keyInsights.personal,
                components.keyInsights.enhancement,
                query
            );

            components.keyInsights.connections = this._findKnowledgeConnections(
                components.personalContent,
                components.enhancementContent,
                query
            );
        }

        return components;
    }

    /**
     * Create advanced synthesis prompt using the prompt system
     * 
     * @private
     * @param {string} query 
     * @param {Object} synthesisComponents 
     * @param {Object} contextAnalysis 
     * @returns {string} Advanced synthesis prompt
     */
    async _createAdvancedSynthesisPrompt(query, synthesisComponents, contextAnalysis) {
        try {
            // Get strategy-specific instructions
            const strategyInstructions = await this._getStrategySpecificInstructions(contextAnalysis.selectedStrategy);

            // Prepare template variables
            const variables = {
                query,
                strategy: contextAnalysis.selectedStrategy,
                strategyInstructions,
                personalContent: synthesisComponents.personalContent || '',
                enhancementContent: synthesisComponents.enhancementContent || '',
                personalInsights: synthesisComponents.keyInsights?.personal || [],
                enhancementInsights: synthesisComponents.keyInsights?.enhancement || [],
                crossReferences: synthesisComponents.crossReferences || []
            };

            // Generate prompt using template system
            const prompt = await this.promptManager.generatePrompt('hybrid-context-synthesis', variables);
            return prompt;
        } catch (error) {
            logger.warn('Failed to generate synthesis prompt from template, using fallback:', error.message);
            return this._createFallbackSynthesisPrompt(query, synthesisComponents, contextAnalysis);
        }
    }

    /**
     * Get strategy-specific synthesis instructions using the prompt system
     * 
     * @private
     * @param {string} strategy 
     * @returns {Promise<string>} Strategy-specific instructions
     */
    async _getStrategySpecificInstructions(strategy) {
        try {
            const instructions = await this.promptManager.generatePrompt('synthesis-strategy-instructions', {
                strategy
            });
            return instructions;
        } catch (error) {
            logger.warn('Failed to get strategy instructions from template, using fallback:', error.message);
            return this._getFallbackStrategyInstructions(strategy);
        }
    }

    /**
     * Fallback method for strategy instructions when prompt system fails
     * 
     * @private
     * @param {string} strategy 
     * @returns {string} Strategy-specific instructions
     */
    _getFallbackStrategyInstructions(strategy) {
        const instructions = {
            'personal_primary': 'SYNTHESIS STRATEGY: Personal Experience Primary\n- Start with and emphasize personal experience\n- Use external knowledge to provide context and validation\n- Show how external knowledge relates to the personal experience\n- Maintain the personal perspective as the central narrative',

            'enhancement_primary': 'SYNTHESIS STRATEGY: External Knowledge Primary\n- Begin with authoritative external information\n- Incorporate personal experience as illustrative examples\n- Use personal insights to add nuance to general knowledge\n- Ensure external facts form the foundation of the response',

            'balanced': 'SYNTHESIS STRATEGY: Balanced Integration\n- Weave together personal experience and external knowledge equally\n- Create smooth transitions between different types of information\n- Highlight where personal experience aligns with or differs from general knowledge\n- Provide a complete picture from both perspectives',

            'personal_only': 'SYNTHESIS STRATEGY: Personal Experience Only\n- Focus exclusively on available personal experience and context\n- If personal context is insufficient, acknowledge this limitation gracefully\n- Suggest ways the user can provide more relevant information\n- Never describe data structures or technical details like "undefined" to the user\n- Maintain a helpful, conversational tone even with limited information',

            'enhancement_only': 'SYNTHESIS STRATEGY: External Knowledge Only\n- Focus exclusively on authoritative external information\n- If external context is insufficient, acknowledge this limitation gracefully\n- Suggest reliable sources where more information might be found\n- Never describe data structures or technical details like "undefined" to the user\n- Maintain a helpful, conversational tone even with limited information',

            'no_context': 'SYNTHESIS STRATEGY: Limited Context Response\n- Acknowledge that sufficient relevant information is not currently available\n- Provide general guidance on where to find the requested information\n- Suggest ways to improve future queries\n- Never mention technical terms like "undefined", "null", or data structure details\n- Focus on being helpful despite the lack of specific information'
        };

        return instructions[strategy] || 'SYNTHESIS STRATEGY: Comprehensive Integration\n- Use all available information to create the most complete answer possible\n- Clearly distinguish between different types of sources\n- Build connections and show relationships between different knowledge types\n- If information is limited, acknowledge this without technical jargon';
    }

    /**
     * Fallback method for creating synthesis prompt when template system fails
     * 
     * @private
     * @param {string} query 
     * @param {Object} synthesisComponents 
     * @param {Object} contextAnalysis 
     * @returns {string} Fallback synthesis prompt
     */
    _createFallbackSynthesisPrompt(query, synthesisComponents, contextAnalysis) {
        let prompt = `You are an expert at synthesizing information from multiple sources. Answer the following question by intelligently combining personal experience with authoritative external knowledge.\n\n`;

        // Add strategy-specific instructions
        prompt += this._getFallbackStrategyInstructions(contextAnalysis.selectedStrategy);

        // Add source formatting instructions
        prompt += `\n\nSOURCE ATTRIBUTION REQUIREMENTS:\n`;
        prompt += `- Clearly distinguish between personal experience and external knowledge\n`;
        prompt += `- Use phrases like "From your experience..." or "According to authoritative sources..."\n`;
        prompt += `- Create connections between different types of knowledge when relevant\n`;
        prompt += `- Maintain a conversational yet informative tone\n`;
        prompt += `- NEVER mention technical terms like "undefined", "null", or describe data structures\n`;
        prompt += `- If information is limited, say so naturally without technical jargon\n\n`;

        prompt += `QUESTION: ${query}\n\n`;

        // Add personal context section
        if (synthesisComponents.personalContent) {
            prompt += `PERSONAL EXPERIENCE:\n`;
            prompt += synthesisComponents.personalContent;

            if (synthesisComponents.keyInsights && synthesisComponents.keyInsights.personal && synthesisComponents.keyInsights.personal.length > 0) {
                prompt += `\n\nKey Personal Insights:\n`;
                synthesisComponents.keyInsights.personal.forEach((insight, idx) => {
                    prompt += `${idx + 1}. ${insight}\n`;
                });
            }
            prompt += `\n`;
        }

        // Add external knowledge section
        if (synthesisComponents.enhancementContent) {
            prompt += `EXTERNAL KNOWLEDGE:\n`;
            prompt += synthesisComponents.enhancementContent;

            if (synthesisComponents.keyInsights && synthesisComponents.keyInsights.enhancement && synthesisComponents.keyInsights.enhancement.length > 0) {
                prompt += `\n\nKey External Facts:\n`;
                synthesisComponents.keyInsights.enhancement.forEach((insight, idx) => {
                    prompt += `${idx + 1}. ${insight}\n`;
                });
            }
            prompt += `\n`;
        }

        // Add cross-references if available
        if (synthesisComponents.crossReferences && synthesisComponents.crossReferences.length > 0) {
            prompt += `CONNECTIONS BETWEEN SOURCES:\n`;
            synthesisComponents.crossReferences.forEach((ref, idx) => {
                prompt += `${idx + 1}. ${ref}\n`;
            });
            prompt += `\n`;
        }

        prompt += `Please provide a comprehensive answer that seamlessly integrates all available knowledge while clearly attributing sources. Focus on being helpful and informative while avoiding any technical terminology or references to data structures, programming concepts, or system internals.`;

        return prompt;
    }

    /**
     * Extract key insights from content
     * 
     * @private
     * @param {string} content 
     * @param {string} type 
     * @returns {Array} Key insights
     */
    _extractKeyInsights(content, type) {
        if (!content) return [];

        // Simple extraction based on sentence structure and key phrases
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const insights = [];

        sentences.forEach(sentence => {
            const trimmed = sentence.trim();
            if (trimmed.length < 30) return;

            // Look for insight indicators
            const insightIndicators = {
                personal: ['I found', 'my experience', 'I noticed', 'for me', 'I learned', 'I discovered'],
                enhancement: ['research shows', 'studies indicate', 'according to', 'evidence suggests', 'data reveals']
            };

            const indicators = insightIndicators[type] || [];
            const hasIndicator = indicators.some(indicator =>
                trimmed.toLowerCase().includes(indicator.toLowerCase())
            );

            if (hasIndicator || trimmed.length > 60) {
                insights.push(trimmed);
            }
        });

        // Limit to top 3 insights
        return insights.slice(0, 3);
    }

    /**
     * Identify cross-references between personal and enhancement insights
     * 
     * @private
     * @param {Array} personalInsights 
     * @param {Array} enhancementInsights 
     * @param {string} query 
     * @returns {Array} Cross-references
     */
    _identifyCrossReferences(personalInsights, enhancementInsights, query) {
        const crossReferences = [];

        // Look for conceptual overlaps
        const queryKeywords = this._extractKeywords(query);

        personalInsights.forEach(personalInsight => {
            const personalKeywords = this._extractKeywords(personalInsight);

            enhancementInsights.forEach(enhancementInsight => {
                const enhancementKeywords = this._extractKeywords(enhancementInsight);

                // Check for keyword overlap
                const overlap = personalKeywords.filter(keyword =>
                    enhancementKeywords.includes(keyword) ||
                    queryKeywords.includes(keyword)
                );

                if (overlap.length >= 2) {
                    crossReferences.push(
                        `Personal experience of "${personalInsight.substring(0, 50)}..." aligns with external knowledge about "${enhancementInsight.substring(0, 50)}..." regarding ${overlap.slice(0, 2).join(' and ')}`
                    );
                }
            });
        });

        return crossReferences.slice(0, 3); // Limit to top 3 cross-references
    }

    /**
     * Find knowledge connections between personal and enhancement content
     * 
     * @private
     * @param {string} personalContent 
     * @param {string} enhancementContent 
     * @param {string} query 
     * @returns {Array} Knowledge connections
     */
    _findKnowledgeConnections(personalContent, enhancementContent, query) {
        const connections = [];

        // Simple keyword-based connection finding
        const queryKeywords = this._extractKeywords(query);
        const personalKeywords = this._extractKeywords(personalContent);
        const enhancementKeywords = this._extractKeywords(enhancementContent);

        // Find common themes
        const commonKeywords = personalKeywords.filter(keyword =>
            enhancementKeywords.includes(keyword)
        );

        commonKeywords.forEach(keyword => {
            if (queryKeywords.includes(keyword)) {
                connections.push(`Both personal experience and external sources discuss ${keyword} in relation to the question`);
            }
        });

        return connections.slice(0, 2); // Limit connections
    }

    /**
     * Extract keywords from text for connection analysis
     * 
     * @private
     * @param {string} text 
     * @returns {Array} Keywords
     */
    _extractKeywords(text) {
        if (!text) return [];

        // Simple keyword extraction
        const words = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'way', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'what'].includes(word));

        // Count frequency and return top keywords
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        return Object.keys(frequency)
            .sort((a, b) => frequency[b] - frequency[a])
            .slice(0, 10);
    }

    /**
     * Create template-based response when LLM is not available
     * 
     * @private
     * @param {string} query 
     * @param {Object} synthesisComponents 
     * @param {Object} contextAnalysis 
     * @returns {string} Template-based response
     */
    _createTemplateBasedResponse(query, synthesisComponents, contextAnalysis) {
        let response = '';

        if (contextAnalysis.selectedStrategy === 'personal_primary') {
            if (synthesisComponents.personalContent) {
                response += `Based on your experience:\n${synthesisComponents.personalContent}\n\n`;
            }
            if (synthesisComponents.enhancementContent) {
                response += `Additional context from authoritative sources:\n${synthesisComponents.enhancementContent}`;
            }
        } else if (contextAnalysis.selectedStrategy === 'enhancement_primary') {
            if (synthesisComponents.enhancementContent) {
                response += `According to authoritative sources:\n${synthesisComponents.enhancementContent}\n\n`;
            }
            if (synthesisComponents.personalContent) {
                response += `This aligns with your personal experience:\n${synthesisComponents.personalContent}`;
            }
        } else {
            // Balanced approach
            if (synthesisComponents.personalContent) {
                response += `From your experience:\n${synthesisComponents.personalContent}\n\n`;
            }
            if (synthesisComponents.enhancementContent) {
                response += `External knowledge provides additional context:\n${synthesisComponents.enhancementContent}`;
            }
        }

        return response || 'No sufficient context available to answer the question.';
    }

    /**
     * Enhance source attribution in the generated response
     * 
     * @private
     * @param {string} answer 
     * @param {Object} synthesisComponents 
     * @param {Object} contextAnalysis 
     * @returns {string} Enhanced answer with better attribution
     */
    _enhanceSourceAttribution(answer, synthesisComponents, contextAnalysis) {
        if (!answer) return answer;

        // Add source summary at the end if multiple sources were used
        if (synthesisComponents.personalSources.length > 0 && synthesisComponents.enhancementSources.length > 0) {
            const sourceCount = synthesisComponents.personalSources.length + synthesisComponents.enhancementSources.length;
            answer += `\n\n*This response combines insights from your personal experience with information from ${synthesisComponents.enhancementSources.length} external authoritative source${synthesisComponents.enhancementSources.length === 1 ? '' : 's'}.*`;
        }

        return answer;
    }

    /**
     * Create synthesis prompt for unified response generation
     * 
     * @private
     * @param {string} query 
     * @param {Object} mergedContext 
     * @param {Object} contextAnalysis 
     * @returns {string} Synthesis prompt
     */
    _createSynthesisPrompt(query, mergedContext, contextAnalysis) {
        let prompt = `Answer the following question using the provided context sources. `;

        // Add strategy-specific instructions
        switch (contextAnalysis.selectedStrategy) {
            case 'personal_primary':
                prompt += `Focus primarily on the personal experience while incorporating relevant external knowledge for context.`;
                break;
            case 'enhancement_primary':
                prompt += `Focus primarily on authoritative external knowledge while noting any relevant personal insights.`;
                break;
            case 'balanced':
                prompt += `Provide a balanced answer that integrates both personal experience and external knowledge, clearly distinguishing sources.`;
                break;
            default:
                prompt += `Use all available context to provide a comprehensive answer.`;
        }

        prompt += `\n\nQuestion: ${query}\n\nContext:\n${mergedContext.combinedContent}`;

        return prompt;
    }

    /**
     * Adapt enhancement options based on ZPT state
     * 
     * @private
     * @param {Object} options 
     * @param {Object} zptState 
     * @returns {Object} Adapted options
     */
    _adaptEnhancementOptionsForZPT(options, zptState) {
        const adaptedOptions = { ...options };

        logger.debug('🎯 Adapting enhancement options with ZPT state', {
            zoom: zptState.zoom,
            panFilters: Object.keys(zptState.pan || {}),
            tilt: zptState.tilt
        });

        // Adjust enhancement scope based on zoom level
        switch (zptState.zoom) {
            case 'entity':
                // Entity-level: precise, detailed information about specific things
                adaptedOptions.maxResults = 2;
                adaptedOptions.focusLevel = 'precise';
                adaptedOptions.detailLevel = 'high';
                adaptedOptions.preferDefinitions = true;
                break;

            case 'unit':
                // Unit-level: focused on semantic chunks and relationships
                adaptedOptions.maxResults = 3;
                adaptedOptions.focusLevel = 'contextual';
                adaptedOptions.detailLevel = 'medium';
                adaptedOptions.includeRelationships = true;
                break;

            case 'text':
                // Text-level: document-oriented, narrative context
                adaptedOptions.maxResults = 4;
                adaptedOptions.focusLevel = 'narrative';
                adaptedOptions.detailLevel = 'medium';
                adaptedOptions.preferSummaries = true;
                break;

            case 'community':
                // Community-level: thematic, broader connections
                adaptedOptions.maxResults = 5;
                adaptedOptions.focusLevel = 'thematic';
                adaptedOptions.detailLevel = 'broad';
                adaptedOptions.includeRelatedTopics = true;
                break;

            case 'corpus':
            case 'micro':
            default:
                // Corpus-level: comprehensive, wide-ranging context
                adaptedOptions.maxResults = 6;
                adaptedOptions.focusLevel = 'comprehensive';
                adaptedOptions.detailLevel = 'broad';
                adaptedOptions.includeBackground = true;
                break;
        }

        // Apply pan domain/topic filters to enhancement queries
        if (zptState.pan) {
            if (zptState.pan.domains && zptState.pan.domains.length > 0) {
                adaptedOptions.domainFilter = zptState.pan.domains;
                adaptedOptions.constrainToDomains = true;
                logger.debug('📂 Applied domain filters', { domains: zptState.pan.domains });
            }

            if (zptState.pan.keywords && zptState.pan.keywords.length > 0) {
                adaptedOptions.keywordFilter = zptState.pan.keywords;
                adaptedOptions.boostKeywords = true;
                logger.debug('🔑 Applied keyword filters', { keywords: zptState.pan.keywords });
            }

            if (zptState.pan.entities && zptState.pan.entities.length > 0) {
                adaptedOptions.entityFilter = zptState.pan.entities;
                adaptedOptions.focusOnEntities = true;
                logger.debug('🏷️ Applied entity filters', { entities: zptState.pan.entities });
            }

            if (zptState.pan.temporal) {
                adaptedOptions.temporalFilter = zptState.pan.temporal;
                if (zptState.pan.temporal.start || zptState.pan.temporal.end) {
                    adaptedOptions.constrainToTimeframe = true;
                    logger.debug('⏰ Applied temporal filters', { temporal: zptState.pan.temporal });
                }
            }
        }

        // Adapt enhancement strategy based on tilt style
        switch (zptState.tilt) {
            case 'graph':
                adaptedOptions.emphasizeRelationships = true;
                adaptedOptions.includeConnections = true;
                adaptedOptions.responseFormat = 'structured';
                break;

            case 'embedding':
                adaptedOptions.prioritizeSemantics = true;
                adaptedOptions.useDeepSimilarity = true;
                adaptedOptions.responseFormat = 'contextual';
                break;

            case 'temporal':
                adaptedOptions.emphasizeTimeline = true;
                adaptedOptions.includeHistory = true;
                adaptedOptions.responseFormat = 'chronological';
                break;

            case 'keywords':
            default:
                adaptedOptions.emphasizeKeyTerms = true;
                adaptedOptions.responseFormat = 'keyword_focused';
                break;
        }

        logger.debug('🎯 Enhancement options adapted for ZPT', {
            maxResults: adaptedOptions.maxResults,
            focusLevel: adaptedOptions.focusLevel,
            hasFilters: !!(adaptedOptions.domainFilter || adaptedOptions.keywordFilter || adaptedOptions.entityFilter),
            tiltStyle: zptState.tilt
        });

        return adaptedOptions;
    }

    /**
     * Adapt local search options based on ZPT state
     * 
     * @private
     * @param {Object} options 
     * @param {Object} zptState 
     * @returns {Object} Adapted options
     */
    _adaptLocalSearchForZPT(options, zptState) {
        const adaptedOptions = { ...options };

        logger.debug('🎯 Adapting local search with ZPT state', {
            zoom: zptState.zoom,
            panFilters: Object.keys(zptState.pan || {}),
            tilt: zptState.tilt
        });

        // Adjust search parameters based on zoom level
        switch (zptState.zoom) {
            case 'entity':
                // Entity-level: high precision, specific matches
                adaptedOptions.limit = 3;
                adaptedOptions.threshold = 0.45; // High threshold for precise matches
                adaptedOptions.searchScope = 'precise';
                adaptedOptions.preferExactMatches = true;
                break;

            case 'unit':
                // Unit-level: semantic chunks, medium precision
                adaptedOptions.limit = 5;
                adaptedOptions.threshold = 0.35; // Medium-high threshold
                adaptedOptions.searchScope = 'semantic_chunks';
                adaptedOptions.preferChunks = true;
                break;

            case 'text':
                // Text-level: document sections, balanced approach
                adaptedOptions.limit = 6;
                adaptedOptions.threshold = 0.3; // Medium threshold
                adaptedOptions.searchScope = 'document_sections';
                adaptedOptions.groupByDocument = true;
                break;

            case 'community':
                // Community-level: thematic groups, broader search
                adaptedOptions.limit = 8;
                adaptedOptions.threshold = 0.25; // Lower threshold
                adaptedOptions.searchScope = 'thematic_groups';
                adaptedOptions.includeRelatedConcepts = true;
                break;

            case 'corpus':
            case 'micro':
            default:
                // Corpus-level: comprehensive search, cast wide net
                adaptedOptions.limit = 10;
                adaptedOptions.threshold = 0.2; // Low threshold for broad discovery
                adaptedOptions.searchScope = 'comprehensive';
                adaptedOptions.includeLowSimilarity = true;
                break;
        }

        // Apply pan filters to constrain local search
        if (zptState.pan) {
            const filters = [];

            if (zptState.pan.domains && zptState.pan.domains.length > 0) {
                adaptedOptions.domainConstraints = zptState.pan.domains;
                filters.push(`domains:${zptState.pan.domains.length}`);
            }

            if (zptState.pan.keywords && zptState.pan.keywords.length > 0) {
                adaptedOptions.keywordBoosts = zptState.pan.keywords;
                // Boost similarity for content containing these keywords
                adaptedOptions.keywordBoostFactor = 0.1; // Add 0.1 to similarity if keywords match
                filters.push(`keywords:${zptState.pan.keywords.length}`);
            }

            if (zptState.pan.entities && zptState.pan.entities.length > 0) {
                adaptedOptions.entityConstraints = zptState.pan.entities;
                filters.push(`entities:${zptState.pan.entities.length}`);
            }

            if (zptState.pan.temporal) {
                adaptedOptions.temporalConstraints = zptState.pan.temporal;
                filters.push('temporal');
            }

            if (filters.length > 0) {
                logger.debug('🔍 Applied pan filters to local search', { filters: filters.join(', ') });
            }
        }

        // Adapt search strategy based on tilt style
        switch (zptState.tilt) {
            case 'graph':
                // Graph tilt: emphasize relationships and connections
                adaptedOptions.searchStrategy = 'relationship_aware';
                adaptedOptions.includeRelatedNodes = true;
                adaptedOptions.expandConnections = true;
                break;

            case 'embedding':
                // Embedding tilt: pure semantic similarity
                adaptedOptions.searchStrategy = 'semantic_similarity';
                adaptedOptions.usePureEmbedding = true;
                adaptedOptions.ignoreKeywordMatches = false;
                break;

            case 'temporal':
                // Temporal tilt: time-aware search
                adaptedOptions.searchStrategy = 'temporal_aware';
                adaptedOptions.sortByTime = true;
                adaptedOptions.groupByTimeframe = true;
                break;

            case 'keywords':
            default:
                // Keywords tilt: traditional keyword-enhanced search
                adaptedOptions.searchStrategy = 'keyword_enhanced';
                adaptedOptions.boostKeywordMatches = true;
                adaptedOptions.hybridKeywordSemantic = true;
                break;
        }

        logger.debug('🎯 Local search options adapted for ZPT', {
            limit: adaptedOptions.limit,
            threshold: adaptedOptions.threshold,
            searchScope: adaptedOptions.searchScope,
            strategy: adaptedOptions.searchStrategy,
            hasConstraints: !!(adaptedOptions.domainConstraints || adaptedOptions.keywordBoosts || adaptedOptions.entityConstraints)
        });

        return adaptedOptions;
    }

    /**
     * Get current ZPT state from session or defaults
     * 
     * @private
     * @param {Object} options 
     * @returns {Object} ZPT state
     */
    _getZPTState(options) {
        let zptState;

        // Try to get from ZPT state manager if available
        if (this.zptStateManager?.getState) {
            zptState = this.zptStateManager.getState();
            logger.debug('🧭 Retrieved ZPT state from session', {
                zoom: zptState.zoom,
                panFilters: Object.keys(zptState.pan || {}),
                tilt: zptState.tilt,
                lastQuery: zptState.lastQuery?.substring(0, 50) + (zptState.lastQuery?.length > 50 ? '...' : ''),
                sessionId: zptState.sessionId
            });
        } else {
            // Default ZPT state with comprehensive structure
            zptState = {
                zoom: 'entity',
                pan: {
                    domains: [],
                    keywords: [],
                    entities: [],
                    temporal: null
                },
                tilt: 'keywords',
                lastQuery: '',
                sessionId: null,
                timestamp: new Date().toISOString()
            };

            logger.debug('🧭 Using default ZPT state (no session manager available)');
        }

        // Validate and normalize ZPT state
        zptState = this._validateZPTState(zptState);

        return zptState;
    }

    /**
     * Validate and normalize ZPT state structure
     * 
     * @private
     * @param {Object} zptState 
     * @returns {Object} Validated ZPT state
     */
    _validateZPTState(zptState) {
        const validZoomLevels = ['entity', 'unit', 'text', 'community', 'corpus', 'micro'];
        const validTiltStyles = ['keywords', 'embedding', 'graph', 'temporal'];

        // Ensure zoom is valid
        if (!validZoomLevels.includes(zptState.zoom)) {
            logger.warn('⚠️ Invalid zoom level, defaulting to entity', { zoom: zptState.zoom });
            zptState.zoom = 'entity';
        }

        // Ensure tilt is valid
        if (!validTiltStyles.includes(zptState.tilt)) {
            logger.warn('⚠️ Invalid tilt style, defaulting to keywords', { tilt: zptState.tilt });
            zptState.tilt = 'keywords';
        }

        // Ensure pan is an object with expected structure
        if (!zptState.pan || typeof zptState.pan !== 'object') {
            zptState.pan = {};
        }

        // Normalize pan arrays
        if (zptState.pan.domains && !Array.isArray(zptState.pan.domains)) {
            zptState.pan.domains = [zptState.pan.domains].filter(Boolean);
        }
        if (zptState.pan.keywords && !Array.isArray(zptState.pan.keywords)) {
            zptState.pan.keywords = [zptState.pan.keywords].filter(Boolean);
        }
        if (zptState.pan.entities && !Array.isArray(zptState.pan.entities)) {
            zptState.pan.entities = [zptState.pan.entities].filter(Boolean);
        }

        // Validate temporal structure if present
        if (zptState.pan.temporal && typeof zptState.pan.temporal !== 'object') {
            logger.warn('⚠️ Invalid temporal filter structure, removing', { temporal: zptState.pan.temporal });
            delete zptState.pan.temporal;
        }

        logger.debug('✅ ZPT state validated and normalized', {
            zoom: zptState.zoom,
            tilt: zptState.tilt,
            panFilters: {
                domains: zptState.pan.domains?.length || 0,
                keywords: zptState.pan.keywords?.length || 0,
                entities: zptState.pan.entities?.length || 0,
                temporal: !!zptState.pan.temporal
            }
        });

        return zptState;
    }

    /**
     * Apply ZPT filters to search results to enhance relevance
     * 
     * @private
     * @param {Array} results 
     * @param {Object} zptState 
     * @param {string} query 
     * @returns {Array} Filtered and re-ranked results
     */
    _applyZPTFiltersToResults(results, zptState, query) {
        if (!results || results.length === 0) {
            return results;
        }

        logger.debug('🎨 Applying ZPT filters to results', {
            resultCount: results.length,
            zoom: zptState.zoom,
            hasFilters: !!(zptState.pan?.domains || zptState.pan?.keywords || zptState.pan?.entities)
        });

        let filteredResults = [...results];

        // Apply pan domain filters
        if (zptState.pan?.domains && zptState.pan.domains.length > 0) {
            filteredResults = filteredResults.filter(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                return zptState.pan.domains.some(domain =>
                    content.toLowerCase().includes(domain.toLowerCase())
                );
            });

            logger.debug('📂 Applied domain filters', {
                domains: zptState.pan.domains,
                beforeCount: results.length,
                afterCount: filteredResults.length
            });
        }

        // Apply keyword boosts and filters
        if (zptState.pan?.keywords && zptState.pan.keywords.length > 0) {
            filteredResults = filteredResults.map(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                let boost = 0;

                zptState.pan.keywords.forEach(keyword => {
                    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    const matches = (content.match(keywordRegex) || []).length;
                    boost += matches * 0.05; // Small boost per keyword match
                });

                return {
                    ...result,
                    similarity: (result.similarity || 0) + boost,
                    keywordBoost: boost
                };
            });

            // Re-sort after keyword boosts
            filteredResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

            logger.debug('🔑 Applied keyword boosts', {
                keywords: zptState.pan.keywords,
                averageBoost: filteredResults.reduce((sum, r) => sum + (r.keywordBoost || 0), 0) / filteredResults.length
            });
        }

        // Apply entity filters
        if (zptState.pan?.entities && zptState.pan.entities.length > 0) {
            // Boost results that mention the specified entities
            filteredResults = filteredResults.map(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                let entityBoost = 0;

                zptState.pan.entities.forEach(entity => {
                    const entityRegex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    if (entityRegex.test(content)) {
                        entityBoost += 0.1; // Stronger boost for entity matches
                    }
                });

                return {
                    ...result,
                    similarity: (result.similarity || 0) + entityBoost,
                    entityBoost: entityBoost
                };
            });

            // Re-sort after entity boosts
            filteredResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

            logger.debug('🏷️ Applied entity boosts', {
                entities: zptState.pan.entities,
                boostedCount: filteredResults.filter(r => r.entityBoost > 0).length
            });
        }

        // Apply temporal filters if specified
        if (zptState.pan?.temporal) {
            const temporal = zptState.pan.temporal;
            let startTime = null;
            let endTime = null;

            if (temporal.start) {
                try {
                    startTime = new Date(temporal.start);
                } catch (e) {
                    logger.warn('⚠️ Invalid temporal start time', { start: temporal.start });
                }
            }

            if (temporal.end) {
                try {
                    endTime = new Date(temporal.end);
                } catch (e) {
                    logger.warn('⚠️ Invalid temporal end time', { end: temporal.end });
                }
            }

            if (startTime || endTime) {
                const beforeCount = filteredResults.length;
                filteredResults = filteredResults.filter(result => {
                    // Check if result has timestamp information
                    const timestamp = result.timestamp || result.metadata?.timestamp || result.metadata?.storedAt;
                    if (!timestamp) {
                        return true; // Keep results without timestamps
                    }

                    try {
                        const resultTime = new Date(timestamp);
                        let inRange = true;

                        if (startTime && resultTime < startTime) {
                            inRange = false;
                        }
                        if (endTime && resultTime > endTime) {
                            inRange = false;
                        }

                        return inRange;
                    } catch (e) {
                        return true; // Keep results with invalid timestamps
                    }
                });

                logger.debug('⏰ Applied temporal filters', {
                    start: temporal.start,
                    end: temporal.end,
                    beforeCount,
                    afterCount: filteredResults.length
                });
            }
        }

        // Apply zoom-level result limiting
        const zoomLimits = {
            entity: 3,
            unit: 5,
            text: 6,
            community: 8,
            corpus: 10,
            micro: 10
        };

        const limit = zoomLimits[zptState.zoom] || 5;
        if (filteredResults.length > limit) {
            filteredResults = filteredResults.slice(0, limit);
            logger.debug('✂️ Applied zoom-level limiting', {
                zoom: zptState.zoom,
                limit,
                finalCount: filteredResults.length
            });
        }

        logger.debug('🎨 ZPT filters applied to results', {
            originalCount: results.length,
            finalCount: filteredResults.length,
            filteringReduction: ((results.length - filteredResults.length) / results.length * 100).toFixed(1) + '%'
        });

        return filteredResults;
    }

    /**
     * Check if enhancement options are requested
     * 
     * @private
     * @param {Object} options 
     * @returns {boolean}
     */
    _hasEnhancements(options) {
        return options.useHyDE || options.useWikipedia || options.useWikidata || options.useWebSearch;
    }

    /**
     * Extract enhancement details from EnhancementCoordinator result
     * 
     * @private
     * @param {Object} enhancementResult - Result from EnhancementCoordinator
     * @returns {Array} Array of enhancement details
     */
    _extractEnhancementDetails(enhancementResult) {
        if (!enhancementResult || !enhancementResult.success) {
            return [];
        }

        const enhancements = [];

        // Debug: Log the structure we're working with
        logger.debug('Extracting enhancement details from:', {
            hasIndividualResults: !!enhancementResult.individualResults,
            hasMetadata: !!enhancementResult.metadata,
            servicesUsed: enhancementResult.metadata?.servicesUsed
        });

        // Extract from individual results if available
        if (enhancementResult.individualResults && enhancementResult.individualResults.successful) {
            for (const serviceResult of enhancementResult.individualResults.successful) {
                const enhancement = {
                    type: serviceResult.serviceName,
                    success: true,
                    source: serviceResult.serviceName
                };

                // Add service-specific data based on the service type
                switch (serviceResult.serviceName) {
                    case 'webSearch':
                        if (serviceResult.result && serviceResult.result.results) {
                            enhancement.results = serviceResult.result.results.map(item => ({
                                title: item.title,
                                url: item.url,
                                snippet: item.snippet,
                                relevanceScore: item.relevanceScore
                            }));
                            enhancement.count = serviceResult.result.results.length;
                        }
                        break;

                    case 'wikipedia':
                        if (serviceResult.result && serviceResult.result.wikipediaResults) {
                            enhancement.results = serviceResult.result.wikipediaResults.map(item => ({
                                title: item.title,
                                url: item.url,
                                content: item.content?.substring(0, 200) + '...'
                            }));
                            enhancement.count = serviceResult.result.wikipediaResults.length;
                        }
                        break;

                    case 'wikidata':
                        if (serviceResult.result && serviceResult.result.wikidataResults) {
                            enhancement.results = serviceResult.result.wikidataResults.map(item => ({
                                entity: item.entity,
                                label: item.label,
                                description: item.description
                            }));
                            enhancement.count = serviceResult.result.wikidataResults.length;
                        }
                        break;

                    case 'hyde':
                        if (serviceResult.result && serviceResult.result.hydeResults) {
                            enhancement.results = [{
                                expandedQuery: serviceResult.result.expandedQuery,
                                concepts: serviceResult.result.concepts
                            }];
                            enhancement.count = 1;
                        }
                        break;

                    default:
                        enhancement.results = [serviceResult.result];
                        enhancement.count = 1;
                }

                enhancements.push(enhancement);
            }
        }

        // If no individual results, create a basic enhancement entry from metadata
        if (enhancements.length === 0 && enhancementResult.metadata && enhancementResult.metadata.servicesUsed) {
            for (const serviceName of enhancementResult.metadata.servicesUsed) {
                enhancements.push({
                    type: serviceName,
                    success: true,
                    source: serviceName,
                    count: 1,
                    results: []
                });
            }
        }

        return enhancements;
    }

    /**
     * Handle fallback when hybrid processing fails
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @param {Error} error 
     * @returns {Object} Fallback result
     */
    async _handleFallback(query, options, error) {
        logger.warn('🔄 Falling back to single-source approach', { error: error.message });

        // Try local context first
        if (options.useContext && this.safeOperations) {
            try {
                const localResult = await this._searchLocalContext(query, options);
                if (localResult.success) {
                    return {
                        success: true,
                        query,
                        answer: localResult.contexts.map(c => `${c.prompt}: ${c.response}`).join('\n\n'),
                        contextType: 'personal_fallback',
                        fallbackReason: error.message
                    };
                }
            } catch (localError) {
                logger.warn('Local fallback also failed:', localError.message);
            }
        }

        // Final fallback - no context
        return {
            success: false,
            query,
            error: 'Both hybrid and fallback approaches failed',
            originalError: error.message
        };
    }

    /**
     * Update statistics based on processing results
     * 
     * @private
     * @param {Object} contextAnalysis 
     */
    _updateStats(contextAnalysis) {
        switch (contextAnalysis.selectedStrategy) {
            case 'balanced':
            case 'personal_primary':
            case 'enhancement_primary':
                this.stats.hybridResponses++;
                break;
            case 'personal_only':
                this.stats.personalOnlyResponses++;
                break;
            case 'enhancement_only':
                this.stats.enhancementOnlyResponses++;
                break;
            default:
                this.stats.failedMerges++;
        }

        // Update running averages
        const totalProcessed = this.stats.hybridResponses + this.stats.personalOnlyResponses + this.stats.enhancementOnlyResponses;
        this.stats.averagePersonalRelevance = (
            (this.stats.averagePersonalRelevance * (totalProcessed - 1)) + contextAnalysis.personalRelevance
        ) / totalProcessed;

        this.stats.averageEnhancementQuality = (
            (this.stats.averageEnhancementQuality * (totalProcessed - 1)) + contextAnalysis.enhancementQuality
        ) / totalProcessed;
    }

    /**
     * Get current processing statistics
     * 
     * @returns {Object} Current statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics counters
     */
    resetStats() {
        this.stats = {
            totalQueries: 0,
            hybridResponses: 0,
            personalOnlyResponses: 0,
            enhancementOnlyResponses: 0,
            failedMerges: 0,
            averagePersonalRelevance: 0,
            averageEnhancementQuality: 0
        };
    }
}

export default HybridContextManager;