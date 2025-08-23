/**
 * ContextAwareThresholdCalculator - Intelligent dynamic threshold calculation
 * 
 * This system replaces static similarity thresholds with context-aware, adaptive
 * thresholds that consider ZPT state, query characteristics, content density,
 * and historical performance to optimize search results.
 * 
 * Key Features:
 * - Dynamic threshold calculation based on multiple context factors
 * - ZPT state integration for navigation-aware search
 * - Query complexity analysis for appropriate threshold selection
 * - Content density adaptation for optimal precision/recall balance
 * - Learning system for continuous threshold optimization
 */

import log from 'loglevel';

const thresholdLogger = log.getLogger('ContextAwareThresholdCalculator');

export class ContextAwareThresholdCalculator {
    constructor(options = {}) {
        this.options = {
            // Base threshold ranges by zoom level
            baseThresholds: {
                entity: { min: 0.35, max: 0.65, default: 0.45 },
                unit: { min: 0.25, max: 0.50, default: 0.35 },
                text: { min: 0.20, max: 0.45, default: 0.30 },
                community: { min: 0.15, max: 0.40, default: 0.25 },
                corpus: { min: 0.10, max: 0.35, default: 0.20 },
                micro: { min: 0.10, max: 0.35, default: 0.20 }
            },
            
            // Learning parameters
            learningRate: options.learningRate || 0.05,
            confidenceWindow: options.confidenceWindow || 50, // Number of recent searches to consider
            
            // Query analysis parameters
            shortQueryThreshold: options.shortQueryThreshold || 20,
            complexQueryThreshold: options.complexQueryThreshold || 100,
            
            // Performance tracking
            enableLearning: options.enableLearning !== false,
            
            ...options
        };
        
        // Performance tracking data
        this.performanceHistory = {
            searchResults: [], // Recent search results with success metrics
            thresholdPerformance: new Map(), // threshold -> performance metrics
            queryTypePerformance: new Map(), // queryType -> optimal thresholds
            panFilterEffectiveness: new Map() // pan filter combo -> boost effectiveness
        };
        
        // Content density cache
        this.contentDensityCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        thresholdLogger.info('ContextAwareThresholdCalculator initialized', {
            enableLearning: this.options.enableLearning,
            confidenceWindow: this.options.confidenceWindow
        });
    }
    
    /**
     * Calculate optimal thresholds for a query considering all context factors
     * 
     * @param {string} query - User query
     * @param {Object} zptState - Current ZPT navigation state
     * @param {Object} options - Search options and constraints
     * @returns {Object} Calculated threshold configuration
     */
    calculateThresholds(query, zptState, options = {}) {
        thresholdLogger.debug('🎯 Calculating context-aware thresholds', {
            queryLength: query.length,
            zoom: zptState.zoom,
            hasFilters: !!(zptState.pan?.domains || zptState.pan?.keywords),
            tilt: zptState.tilt
        });
        
        // Step 1: Analyze query characteristics
        const queryAnalysis = this._analyzeQuery(query);
        
        // Step 2: Get base threshold from ZPT zoom level
        const baseThreshold = this._getBaseThreshold(zptState.zoom, queryAnalysis);
        
        // Step 3: Apply ZPT state modulation
        const zptModulation = this._calculateZPTModulation(zptState, queryAnalysis);
        
        // Step 4: Apply pan filter integration
        const panModulation = this._calculatePanModulation(zptState.pan, queryAnalysis);
        
        // Step 5: Apply content density adaptation
        const densityModulation = this._calculateDensityModulation(query, options);
        
        // Step 6: Apply learning-based optimization
        const learningModulation = this._applyLearningOptimization(queryAnalysis, zptState);
        
        // Step 7: Calculate final thresholds with confidence intervals
        const thresholds = this._combineModulations({
            base: baseThreshold,
            zpt: zptModulation,
            pan: panModulation,
            density: densityModulation,
            learning: learningModulation
        }, queryAnalysis);
        
        thresholdLogger.info('🎯 Context-aware thresholds calculated', {
            primaryThreshold: thresholds.primary,
            fallbackThreshold: thresholds.fallback,
            confidence: thresholds.confidence,
            strategy: thresholds.strategy,
            modulations: {
                zpt: zptModulation.adjustment,
                pan: panModulation.adjustment,
                density: densityModulation.adjustment,
                learning: learningModulation.adjustment
            }
        });
        
        return thresholds;
    }
    
    /**
     * Analyze query characteristics for threshold strategy selection
     * 
     * @private
     * @param {string} query 
     * @returns {Object} Query analysis
     */
    _analyzeQuery(query) {
        const analysis = {
            length: query.length,
            wordCount: query.trim().split(/\s+/).length,
            complexity: 'medium',
            type: 'general',
            semanticDensity: 0,
            questionWords: 0,
            personalIndicators: 0,
            technicalTerms: 0
        };
        
        // Determine complexity
        if (query.length < this.options.shortQueryThreshold) {
            analysis.complexity = 'simple';
        } else if (query.length > this.options.complexQueryThreshold) {
            analysis.complexity = 'complex';
        }
        
        // Detect query type
        const lowerQuery = query.toLowerCase();
        
        // Question type detection
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
        analysis.questionWords = questionWords.filter(word => lowerQuery.includes(word)).length;
        
        if (analysis.questionWords > 0) {
            analysis.type = 'question';
        }
        
        // Personal experience indicators
        const personalIndicators = ['i ', 'my ', 'me ', 'myself', 'personal', 'experience', 'feel', 'think'];
        analysis.personalIndicators = personalIndicators.filter(indicator => 
            lowerQuery.includes(indicator)
        ).length;
        
        if (analysis.personalIndicators > 2) {
            analysis.type = 'personal';
        }
        
        // Technical/factual query detection
        const technicalTerms = ['definition', 'explain', 'technical', 'scientific', 'research', 'study'];
        analysis.technicalTerms = technicalTerms.filter(term => lowerQuery.includes(term)).length;
        
        if (analysis.technicalTerms > 0) {
            analysis.type = 'factual';
        }
        
        // Semantic density estimation (simplified)
        const uniqueWords = new Set(query.toLowerCase().match(/\b\w+\b/g) || []).size;
        analysis.semanticDensity = uniqueWords / Math.max(analysis.wordCount, 1);
        
        thresholdLogger.debug('🔍 Query analysis completed', analysis);
        return analysis;
    }
    
    /**
     * Get base threshold from ZPT zoom level with query-aware adjustment
     * 
     * @private
     * @param {string} zoomLevel 
     * @param {Object} queryAnalysis 
     * @returns {Object} Base threshold info
     */
    _getBaseThreshold(zoomLevel, queryAnalysis) {
        const zoomThresholds = this.options.baseThresholds[zoomLevel] || 
                              this.options.baseThresholds.entity;
        
        let baseValue = zoomThresholds.default;
        
        // Adjust base based on query complexity
        switch (queryAnalysis.complexity) {
            case 'simple':
                // Simple queries need higher precision
                baseValue = Math.min(zoomThresholds.max, baseValue + 0.1);
                break;
            case 'complex':
                // Complex queries can use broader search
                baseValue = Math.max(zoomThresholds.min, baseValue - 0.05);
                break;
        }
        
        // Adjust based on query type
        switch (queryAnalysis.type) {
            case 'personal':
                // Personal queries may have unique phrasing, lower threshold
                baseValue = Math.max(zoomThresholds.min, baseValue - 0.08);
                break;
            case 'factual':
                // Factual queries need precise matches
                baseValue = Math.min(zoomThresholds.max, baseValue + 0.05);
                break;
        }
        
        return {
            value: baseValue,
            range: zoomThresholds,
            adjustments: {
                complexity: queryAnalysis.complexity,
                type: queryAnalysis.type
            }
        };
    }
    
    /**
     * Calculate ZPT state modulation effects on thresholds
     * 
     * @private
     * @param {Object} zptState 
     * @param {Object} queryAnalysis 
     * @returns {Object} ZPT modulation
     */
    _calculateZPTModulation(zptState, queryAnalysis) {
        let adjustment = 0;
        const factors = [];
        
        // Tilt style influence on thresholds
        switch (zptState.tilt) {
            case 'graph':
                // Graph tilt: relationships matter more than exact similarity
                adjustment -= 0.05;
                factors.push('graph_tilt(-0.05)');
                break;
            case 'embedding':
                // Embedding tilt: pure semantic similarity, can be stricter
                adjustment += 0.03;
                factors.push('embedding_tilt(+0.03)');
                break;
            case 'temporal':
                // Temporal tilt: time relevance matters, relax similarity
                adjustment -= 0.03;
                factors.push('temporal_tilt(-0.03)');
                break;
            case 'keywords':
                // Keywords tilt: exact matches important
                adjustment += 0.02;
                factors.push('keywords_tilt(+0.02)');
                break;
        }
        
        // Pan filter complexity adjustment
        const panFilters = zptState.pan || {};
        const filterCount = (panFilters.domains?.length || 0) + 
                           (panFilters.keywords?.length || 0) + 
                           (panFilters.entities?.length || 0) +
                           (panFilters.temporal ? 1 : 0);
        
        if (filterCount > 0) {
            // More filters = can relax similarity since we have other constraints
            const filterAdjustment = -Math.min(0.1, filterCount * 0.02);
            adjustment += filterAdjustment;
            factors.push(`pan_filters(${filterAdjustment.toFixed(3)})`);
        }
        
        return {
            adjustment,
            factors,
            confidence: filterCount > 0 ? 0.8 : 0.6
        };
    }
    
    /**
     * Calculate pan filter specific threshold modulations
     * 
     * @private
     * @param {Object} panFilters 
     * @param {Object} queryAnalysis 
     * @returns {Object} Pan modulation effects
     */
    _calculatePanModulation(panFilters, queryAnalysis) {
        if (!panFilters) {
            return { adjustment: 0, boosts: {}, strategy: 'none' };
        }
        
        const boosts = {
            keyword: 0,
            domain: 0,
            entity: 0,
            temporal: 0
        };
        
        let totalAdjustment = 0;
        const strategies = [];
        
        // Keyword filtering boost
        if (panFilters.keywords && panFilters.keywords.length > 0) {
            // More keywords = more specific search, can lower threshold
            const keywordBoost = -Math.min(0.08, panFilters.keywords.length * 0.02);
            boosts.keyword = keywordBoost;
            totalAdjustment += keywordBoost;
            strategies.push('keyword_boost');
        }
        
        // Domain filtering
        if (panFilters.domains && panFilters.domains.length > 0) {
            const domainBoost = -0.03; // Domain constraints allow lower similarity
            boosts.domain = domainBoost;
            totalAdjustment += domainBoost;
            strategies.push('domain_constraint');
        }
        
        // Entity filtering
        if (panFilters.entities && panFilters.entities.length > 0) {
            const entityBoost = -0.05; // Entity matches can override similarity
            boosts.entity = entityBoost;
            totalAdjustment += entityBoost;
            strategies.push('entity_focus');
        }
        
        // Temporal filtering
        if (panFilters.temporal) {
            const temporalBoost = -0.02; // Temporal constraints help focus
            boosts.temporal = temporalBoost;
            totalAdjustment += temporalBoost;
            strategies.push('temporal_constraint');
        }
        
        return {
            adjustment: totalAdjustment,
            boosts,
            strategy: strategies.join('+'),
            confidence: strategies.length > 0 ? 0.9 : 0.5
        };
    }
    
    /**
     * Calculate content density modulation for threshold adaptation
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @returns {Object} Density modulation
     */
    _calculateDensityModulation(query, options) {
        // This would ideally check actual content density in the system
        // For now, we'll use a simplified approach based on estimated content volume
        
        const cacheKey = `density_${query.substring(0, 20)}`;
        const cached = this.contentDensityCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.modulation;
        }
        
        // Estimate content density based on query characteristics
        let estimatedDensity = 0.5; // Default medium density
        
        // Technical/specific queries likely have less matching content
        if (query.toLowerCase().includes('specific') || query.length > 80) {
            estimatedDensity = 0.3; // Lower density
        }
        
        // General/common queries likely have more content
        const commonWords = ['what', 'how', 'general', 'about', 'help', 'information'];
        if (commonWords.some(word => query.toLowerCase().includes(word))) {
            estimatedDensity = 0.7; // Higher density
        }
        
        // Adjust threshold based on density
        let adjustment = 0;
        if (estimatedDensity < 0.4) {
            // Low density = need lower thresholds to find anything
            adjustment = -0.06;
        } else if (estimatedDensity > 0.7) {
            // High density = can be more selective
            adjustment = +0.04;
        }
        
        const modulation = {
            adjustment,
            estimatedDensity,
            confidence: 0.6
        };
        
        // Cache the result
        this.contentDensityCache.set(cacheKey, {
            modulation,
            timestamp: Date.now()
        });
        
        return modulation;
    }
    
    /**
     * Apply learning-based threshold optimization
     * 
     * @private
     * @param {Object} queryAnalysis 
     * @param {Object} zptState 
     * @returns {Object} Learning-based adjustments
     */
    _applyLearningOptimization(queryAnalysis, zptState) {
        if (!this.options.enableLearning) {
            return { adjustment: 0, confidence: 0.5, source: 'disabled' };
        }
        
        const queryType = queryAnalysis.type;
        const zoomLevel = zptState.zoom;
        const key = `${queryType}_${zoomLevel}`;
        
        const historical = this.performanceHistory.queryTypePerformance.get(key);
        
        if (!historical || historical.samples < 5) {
            // Not enough data for learning
            return { adjustment: 0, confidence: 0.5, source: 'insufficient_data' };
        }
        
        // Calculate adjustment based on historical success rates
        const avgSuccessRate = historical.totalSuccess / historical.samples;
        let adjustment = 0;
        
        if (avgSuccessRate < 0.6) {
            // Poor success rate, lower thresholds
            adjustment = -0.04;
        } else if (avgSuccessRate > 0.9) {
            // Very high success rate, can be more selective
            adjustment = +0.02;
        }
        
        // Weight by confidence (more samples = higher confidence)
        const confidence = Math.min(0.9, historical.samples / this.options.confidenceWindow);
        adjustment *= confidence;
        
        thresholdLogger.debug('📈 Learning-based threshold adjustment', {
            queryType,
            zoomLevel,
            avgSuccessRate: avgSuccessRate.toFixed(3),
            adjustment: adjustment.toFixed(3),
            confidence: confidence.toFixed(3),
            samples: historical.samples
        });
        
        return {
            adjustment,
            confidence,
            source: 'learning',
            historical: {
                successRate: avgSuccessRate,
                samples: historical.samples
            }
        };
    }
    
    /**
     * Combine all modulations into final threshold configuration
     * 
     * @private
     * @param {Object} modulations 
     * @param {Object} queryAnalysis 
     * @returns {Object} Final threshold configuration
     */
    _combineModulations(modulations, queryAnalysis) {
        const { base, zpt, pan, density, learning } = modulations;
        
        // Calculate primary threshold
        const primaryAdjustment = zpt.adjustment + pan.adjustment + 
                                density.adjustment + learning.adjustment;
        let primaryThreshold = Math.max(0.1, 
            Math.min(0.8, base.value + primaryAdjustment)
        );
        
        // Calculate fallback threshold (more permissive)
        let fallbackThreshold = Math.max(0.05, primaryThreshold - 0.1);
        
        // Calculate confidence in these thresholds
        const confidence = (zpt.confidence + pan.confidence + 
                          density.confidence + learning.confidence) / 4;
        
        // Determine search strategy
        let strategy = 'standard';
        if (pan.strategy !== 'none') {
            strategy = 'pan_filtered';
        }
        if (queryAnalysis.type === 'personal') {
            strategy = 'personal_focused';
        }
        if (learning.source === 'learning') {
            strategy += '_learned';
        }
        
        // Calculate expansion parameters for multi-pass search
        const expansionSteps = this._calculateExpansionSteps(primaryThreshold, fallbackThreshold);
        
        return {
            primary: primaryThreshold,
            fallback: fallbackThreshold,
            confidence,
            strategy,
            expansionSteps,
            panBoosts: pan.boosts,
            modulations: {
                base: base.value,
                adjustments: {
                    zpt: zpt.adjustment,
                    pan: pan.adjustment,
                    density: density.adjustment,
                    learning: learning.adjustment
                }
            },
            queryAnalysis
        };
    }
    
    /**
     * Calculate expansion steps for multi-pass search
     * 
     * @private
     * @param {number} primary 
     * @param {number} fallback 
     * @returns {Array} Expansion step thresholds
     */
    _calculateExpansionSteps(primary, fallback) {
        const steps = [primary];
        const stepSize = (primary - fallback) / 3;
        
        // Add intermediate steps
        for (let i = 1; i < 4; i++) {
            const stepThreshold = Math.max(fallback, primary - (stepSize * i));
            if (stepThreshold !== steps[steps.length - 1]) {
                steps.push(stepThreshold);
            }
        }
        
        return steps;
    }
    
    /**
     * Record search results for learning optimization
     * 
     * @param {Object} searchResult 
     * @param {number} threshold 
     * @param {Object} queryAnalysis 
     * @param {Object} zptState 
     */
    recordSearchResult(searchResult, threshold, queryAnalysis, zptState) {
        if (!this.options.enableLearning) return;
        
        const success = searchResult.success && searchResult.contexts.length > 0;
        const key = `${queryAnalysis.type}_${zptState.zoom}`;
        
        // Update query type performance
        const current = this.performanceHistory.queryTypePerformance.get(key) || {
            samples: 0,
            totalSuccess: 0,
            thresholds: []
        };
        
        current.samples++;
        current.totalSuccess += success ? 1 : 0;
        current.thresholds.push({ threshold, success });
        
        // Keep only recent samples
        if (current.samples > this.options.confidenceWindow) {
            const removed = current.thresholds.shift();
            current.samples--;
            if (removed.success) current.totalSuccess--;
        }
        
        this.performanceHistory.queryTypePerformance.set(key, current);
        
        thresholdLogger.debug('📊 Recorded search result for learning', {
            queryType: queryAnalysis.type,
            zoom: zptState.zoom,
            threshold,
            success,
            samples: current.samples,
            successRate: (current.totalSuccess / current.samples).toFixed(3)
        });
    }
    
    /**
     * Get performance statistics for monitoring and debugging
     * 
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        const stats = {
            totalSearches: 0,
            overallSuccessRate: 0,
            queryTypeStats: {},
            thresholdEffectiveness: {},
            cacheSize: this.contentDensityCache.size
        };
        
        // Aggregate query type statistics
        for (const [key, data] of this.performanceHistory.queryTypePerformance) {
            const successRate = data.totalSuccess / data.samples;
            stats.queryTypeStats[key] = {
                samples: data.samples,
                successRate: successRate,
                avgThreshold: data.thresholds.reduce((sum, t) => sum + t.threshold, 0) / data.thresholds.length
            };
            stats.totalSearches += data.samples;
            stats.overallSuccessRate += data.totalSuccess;
        }
        
        if (stats.totalSearches > 0) {
            stats.overallSuccessRate /= stats.totalSearches;
        }
        
        return stats;
    }
}

export default ContextAwareThresholdCalculator;