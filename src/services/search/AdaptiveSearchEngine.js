/**
 * AdaptiveSearchEngine - Multi-pass adaptive search with intelligent threshold management
 * 
 * This engine replaces single-pass static threshold searches with an adaptive approach
 * that progressively relaxes thresholds based on result quality and quantity, while
 * integrating pan filters directly into the search process rather than post-processing.
 * 
 * Key Features:
 * - Progressive threshold relaxation with quality-guided expansion
 * - Real-time pan filter integration during search
 * - Multi-pass search with intelligent stopping criteria
 * - Content quality assessment and result optimization
 * - Performance tracking and learning integration
 */

import logger from 'loglevel';
import ContextAwareThresholdCalculator from './ContextAwareThresholdCalculator.js';
import { SEARCH_CONFIG } from '../../../config/preferences.js';

// Use loglevel directly to avoid import issues
const searchLogger = logger.getLogger('AdaptiveSearchEngine');

export class AdaptiveSearchEngine {
    constructor(safeOperations, options = {}) {
        this.safeOperations = safeOperations;
        this.thresholdCalculator = new ContextAwareThresholdCalculator(options.threshold || {});

        this.options = {
            // Search pass configuration
            maxPasses: options.maxPasses || 4,
            minResultsPerPass: options.minResultsPerPass || 2,
            targetResultCount: options.targetResultCount || 5,
            maxResultCount: options.maxResultCount || 12,

            // Quality criteria
            minAcceptableQuality: options.minAcceptableQuality || SEARCH_CONFIG.QUALITY.MIN_ACCEPTABLE_QUALITY,
            qualityImproementThreshold: options.qualityImproementThreshold || SEARCH_CONFIG.QUALITY.QUALITY_IMPROVEMENT_THRESHOLD,

            // Pan filter integration
            enablePanFilterBoosts: options.enablePanFilterBoosts !== false,
            keywordBoostFactor: options.keywordBoostFactor || SEARCH_CONFIG.BOOST_FACTORS.KEYWORD_BOOST,
            entityBoostFactor: options.entityBoostFactor || SEARCH_CONFIG.BOOST_FACTORS.ENTITY_BOOST,
            domainBoostFactor: options.domainBoostFactor || SEARCH_CONFIG.BOOST_FACTORS.DOMAIN_BOOST,

            // Performance tracking
            enableLearning: options.enableLearning !== false,

            ...options
        };

        // Performance tracking
        this.searchMetrics = {
            totalSearches: 0,
            averagePasses: 0,
            successRate: 0,
            qualityDistribution: { high: 0, medium: 0, low: 0 }
        };

        searchLogger.info('AdaptiveSearchEngine initialized', {
            maxPasses: this.options.maxPasses,
            enablePanFilterBoosts: this.options.enablePanFilterBoosts,
            enableLearning: this.options.enableLearning
        });
    }

    /**
     * Execute adaptive search with progressive threshold relaxation
     * 
     * @param {string} query - Search query
     * @param {Object} zptState - ZPT navigation state
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results with metadata
     */
    async executeAdaptiveSearch(query, zptState, options = {}) {
        const startTime = Date.now();
        this.searchMetrics.totalSearches++;

        searchLogger.info('🔍 Starting adaptive search', {
            query: query.substring(0, 50) + '...',
            zoom: zptState.zoom,
            userThreshold: options.threshold,
            hasFilters: !!(zptState.pan?.domains || zptState.pan?.keywords)
        });

        console.log('🔍 [ADAPTIVE_DEBUG] Search starting with options:', {
            threshold: options.threshold,
            zoom: zptState.zoom,
            query: query.substring(0, 30) + '...'
        });

        try {
            // Step 1: Calculate context-aware thresholds
            const thresholdConfig = this.thresholdCalculator.calculateThresholds(
                query, zptState, options
            );

            // Override with user-provided threshold if specified
            if (options.threshold !== undefined) {
                console.log('🎯 [ADAPTIVE_SEARCH] Using user-provided threshold:', options.threshold);
                console.log('🎯 [ADAPTIVE_SEARCH] Original expansion steps:', thresholdConfig.expansionSteps);
                thresholdConfig.expansionSteps = [options.threshold];
                thresholdConfig.baseThreshold = options.threshold;
                console.log('🎯 [ADAPTIVE_SEARCH] New expansion steps:', thresholdConfig.expansionSteps);
            } else {
                console.log('🎯 [ADAPTIVE_SEARCH] No user threshold provided, using calculated:', thresholdConfig.expansionSteps);
            }

            // Step 2: Execute multi-pass search
            const searchResult = await this._executeMultiPassSearch(
                query, zptState, thresholdConfig, options
            );

            // Step 3: Apply final result optimization
            const optimizedResults = this._optimizeResults(
                searchResult.results, query, zptState, thresholdConfig
            );

            // Step 4: Record performance for learning
            const finalResult = {
                success: optimizedResults.length > 0,
                contexts: optimizedResults,
                searchMethod: 'adaptive_multi_pass',
                totalPasses: searchResult.passesUsed,
                thresholdConfig,
                searchStats: {
                    initialResults: searchResult.passResults[0]?.results?.length || 0,
                    finalResults: optimizedResults.length,
                    averageQuality: this._calculateAverageQuality(optimizedResults),
                    processingTime: Date.now() - startTime,
                    passResults: searchResult.passResults.map(pass => ({
                        pass: pass.pass,
                        threshold: pass.threshold,
                        resultCount: pass.results.length,
                        avgSimilarity: pass.results.length > 0 ?
                            pass.results.reduce((sum, r) => sum + (r.similarity || 0), 0) / pass.results.length : 0
                    }))
                }
            };

            // Record for learning
            if (this.options.enableLearning) {
                this.thresholdCalculator.recordSearchResult(
                    finalResult,
                    thresholdConfig.primary,
                    thresholdConfig.queryAnalysis,
                    zptState
                );
            }

            // Update metrics
            this._updateMetrics(finalResult);

            searchLogger.info('✅ Adaptive search completed', {
                passes: finalResult.totalPasses,
                results: finalResult.contexts.length,
                avgQuality: finalResult.searchStats.averageQuality.toFixed(3),
                processingTime: finalResult.searchStats.processingTime + 'ms'
            });

            return finalResult;

        } catch (error) {
            searchLogger.error('❌ Adaptive search failed', { error: error.message, query });

            // Fallback to simple search
            return await this._fallbackSearch(query, options);
        }
    }

    /**
     * Execute multi-pass search with progressive threshold relaxation
     * 
     * @private
     * @param {string} query 
     * @param {Object} zptState 
     * @param {Object} thresholdConfig 
     * @param {Object} options 
     * @returns {Promise<Object>} Multi-pass search results
     */
    async _executeMultiPassSearch(query, zptState, thresholdConfig, options) {
        const passResults = [];
        let cumulativeResults = [];
        let bestQualityScore = 0;
        let passesUsed = 0;

        searchLogger.debug('🔄 Starting multi-pass search', {
            expansionSteps: thresholdConfig.expansionSteps.length,
            panBoosts: Object.keys(thresholdConfig.panBoosts).length
        });

        for (let pass = 0; pass < Math.min(this.options.maxPasses, thresholdConfig.expansionSteps.length); pass++) {
            const threshold = thresholdConfig.expansionSteps[pass];
            const limit = Math.max(this.options.targetResultCount, this.options.targetResultCount + (pass * 2));

            searchLogger.debug(`🔍 Pass ${pass + 1}: threshold=${threshold.toFixed(3)}, limit=${limit}`);

            // Execute search for this pass
            const passResult = await this._executeSearchPass(
                query, threshold, limit, zptState, thresholdConfig, options
            );

            passResults.push({
                pass: pass + 1,
                threshold,
                results: passResult.results,
                processingTime: passResult.processingTime,
                panFiltersApplied: passResult.panFiltersApplied
            });

            passesUsed++;

            // Merge results, avoiding duplicates
            cumulativeResults = this._mergeResults(cumulativeResults, passResult.results);

            // Calculate current quality score
            const currentQualityScore = this._calculateAverageQuality(cumulativeResults);

            // Check stopping criteria
            const shouldStop = this._evaluateStoppingCriteria(
                pass + 1,
                cumulativeResults,
                currentQualityScore,
                bestQualityScore,
                thresholdConfig
            );

            if (shouldStop.stop) {
                searchLogger.debug(`✋ Stopping search after pass ${pass + 1}: ${shouldStop.reason}`);
                break;
            }

            bestQualityScore = Math.max(bestQualityScore, currentQualityScore);
        }

        return {
            results: cumulativeResults,
            passesUsed,
            passResults
        };
    }

    /**
     * Execute a single search pass with pan filter integration
     * 
     * @private
     * @param {string} query 
     * @param {number} threshold 
     * @param {number} limit 
     * @param {Object} zptState 
     * @param {Object} thresholdConfig 
     * @param {Object} options 
     * @returns {Promise<Object>} Single pass results
     */
    async _executeSearchPass(query, threshold, limit, zptState, thresholdConfig, options) {
        const passStartTime = Date.now();

        // Execute base similarity search
        console.log('🔍 [SEARCH_PASS] Executing searchSimilar with:', {
            query: query.substring(0, 30) + '...',
            limit: limit * 2,
            threshold: threshold
        });

        let results = await this.safeOperations.searchSimilar(
            query,
            limit * 2, // Get more results for pan filtering
            threshold
        );

        console.log('🔍 [SEARCH_PASS] searchSimilar returned:', {
            resultCount: results?.length || 0,
            firstResult: results[0] ? {
                similarity: results[0].similarity,
                prompt: results[0].prompt?.substring(0, 50)
            } : null
        });

        let panFiltersApplied = [];

        // Apply pan filter boosts and constraints
        if (this.options.enablePanFilterBoosts && zptState.pan) {
            const filterResult = this._applyPanFiltersDuringSearch(
                results, query, zptState.pan, thresholdConfig.panBoosts
            );
            results = filterResult.results;
            panFiltersApplied = filterResult.filtersApplied;
        }

        // Sort by adjusted similarity and limit results
        results = results
            .sort((a, b) => (b.adjustedSimilarity || b.similarity || 0) - (a.adjustedSimilarity || a.similarity || 0))
            .slice(0, limit);

        return {
            results,
            processingTime: Date.now() - passStartTime,
            panFiltersApplied
        };
    }

    /**
     * Apply pan filters during search with real-time similarity boosts
     * 
     * @private
     * @param {Array} results 
     * @param {string} query 
     * @param {Object} panFilters 
     * @param {Object} panBoosts 
     * @returns {Object} Filtered and boosted results
     */
    _applyPanFiltersDuringSearch(results, query, panFilters, panBoosts) {
        const filtersApplied = [];
        let processedResults = [...results];

        // Apply keyword boosts
        if (panFilters.keywords && panFilters.keywords.length > 0) {
            processedResults = processedResults.map(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                let keywordBoost = 0;
                let matchedKeywords = [];

                panFilters.keywords.forEach(keyword => {
                    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    const matches = (content.match(keywordRegex) || []).length;
                    if (matches > 0) {
                        keywordBoost += matches * this.options.keywordBoostFactor;
                        matchedKeywords.push(keyword);
                    }
                });

                const adjustedSimilarity = (result.similarity || 0) + keywordBoost;
                return {
                    ...result,
                    adjustedSimilarity,
                    keywordBoost,
                    matchedKeywords
                };
            });

            filtersApplied.push(`keywords(${panFilters.keywords.length})`);
        }

        // Apply domain constraints
        if (panFilters.domains && panFilters.domains.length > 0) {
            const originalCount = processedResults.length;
            processedResults = processedResults.filter(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                return panFilters.domains.some(domain =>
                    content.toLowerCase().includes(domain.toLowerCase())
                );
            });

            if (processedResults.length < originalCount) {
                filtersApplied.push(`domains(filtered ${originalCount - processedResults.length})`);
            }
        }

        // Apply entity boosts
        if (panFilters.entities && panFilters.entities.length > 0) {
            processedResults = processedResults.map(result => {
                const content = (result.prompt || '') + ' ' + (result.response || '');
                let entityBoost = 0;
                let matchedEntities = [];

                panFilters.entities.forEach(entity => {
                    const entityRegex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    if (entityRegex.test(content)) {
                        entityBoost += this.options.entityBoostFactor;
                        matchedEntities.push(entity);
                    }
                });

                const currentSimilarity = result.adjustedSimilarity || result.similarity || 0;
                return {
                    ...result,
                    adjustedSimilarity: currentSimilarity + entityBoost,
                    entityBoost,
                    matchedEntities
                };
            });

            filtersApplied.push(`entities(${panFilters.entities.length})`);
        }

        // Apply temporal constraints
        if (panFilters.temporal) {
            const originalCount = processedResults.length;
            processedResults = this._applyTemporalFilter(processedResults, panFilters.temporal);

            if (processedResults.length < originalCount) {
                filtersApplied.push(`temporal(filtered ${originalCount - processedResults.length})`);
            }
        }

        searchLogger.debug('🎯 Pan filters applied during search', {
            filtersApplied,
            originalCount: results.length,
            finalCount: processedResults.length
        });

        return {
            results: processedResults,
            filtersApplied
        };
    }

    /**
     * Apply temporal filtering to results
     * 
     * @private
     * @param {Array} results 
     * @param {Object} temporalConstraints 
     * @returns {Array} Temporally filtered results
     */
    _applyTemporalFilter(results, temporalConstraints) {
        if (!temporalConstraints.start && !temporalConstraints.end) {
            return results;
        }

        let startTime = null;
        let endTime = null;

        if (temporalConstraints.start) {
            try { startTime = new Date(temporalConstraints.start); } catch (e) { }
        }

        if (temporalConstraints.end) {
            try { endTime = new Date(temporalConstraints.end); } catch (e) { }
        }

        return results.filter(result => {
            const timestamp = result.timestamp || result.metadata?.timestamp || result.metadata?.storedAt;
            if (!timestamp) return true; // Keep results without timestamps

            try {
                const resultTime = new Date(timestamp);
                let inRange = true;

                if (startTime && resultTime < startTime) inRange = false;
                if (endTime && resultTime > endTime) inRange = false;

                return inRange;
            } catch (e) {
                return true; // Keep results with invalid timestamps
            }
        });
    }

    /**
     * Merge results from multiple passes, avoiding duplicates
     * 
     * @private
     * @param {Array} existing 
     * @param {Array} newResults 
     * @returns {Array} Merged results
     */
    _mergeResults(existing, newResults) {
        const existingIds = new Set(existing.map(r => this._generateResultId(r)));
        const uniqueNewResults = newResults.filter(r => !existingIds.has(this._generateResultId(r)));

        return [...existing, ...uniqueNewResults];
    }

    /**
     * Generate unique ID for a result to detect duplicates
     * 
     * @private
     * @param {Object} result 
     * @returns {string} Unique ID
     */
    _generateResultId(result) {
        const prompt = result.prompt || '';
        const response = result.response || '';
        return `${prompt.substring(0, 50)}_${response.substring(0, 50)}`;
    }

    /**
     * Evaluate stopping criteria for multi-pass search
     * 
     * @private
     * @param {number} passNumber 
     * @param {Array} cumulativeResults 
     * @param {number} currentQuality 
     * @param {number} bestQuality 
     * @param {Object} thresholdConfig 
     * @returns {Object} Stop decision with reason
     */
    _evaluateStoppingCriteria(passNumber, cumulativeResults, currentQuality, bestQuality, thresholdConfig) {
        // Criterion 1: Reached target result count with good quality
        if (cumulativeResults.length >= this.options.targetResultCount &&
            currentQuality >= this.options.minAcceptableQuality) {
            return { stop: true, reason: 'target_reached_with_quality' };
        }

        // Criterion 2: Maximum result count exceeded
        if (cumulativeResults.length >= this.options.maxResultCount) {
            return { stop: true, reason: 'max_results_exceeded' };
        }

        // Criterion 3: Quality degradation detected
        if (passNumber > 1 && bestQuality > 0 &&
            (bestQuality - currentQuality) > this.options.qualityImproementThreshold) {
            return { stop: true, reason: 'quality_degradation' };
        }

        // Criterion 4: High confidence and sufficient results
        if (thresholdConfig.confidence > SEARCH_CONFIG.QUALITY.HIGH_CONFIDENCE_THRESHOLD &&
            cumulativeResults.length >= this.options.minResultsPerPass) {
            return { stop: true, reason: 'high_confidence_sufficient_results' };
        }

        // Continue searching
        return { stop: false, reason: null };
    }

    /**
     * Optimize final results based on quality and relevance
     * 
     * @private
     * @param {Array} results 
     * @param {string} query 
     * @param {Object} zptState 
     * @param {Object} thresholdConfig 
     * @returns {Array} Optimized results
     */
    _optimizeResults(results, query, zptState, thresholdConfig) {
        if (!results || results.length === 0) return [];

        // Calculate quality scores
        const scoredResults = results.map(result => {
            const qualityScore = this._calculateResultQuality(result, query, zptState);
            // Fallback to similarity if quality calculation fails
            const finalQualityScore = isNaN(qualityScore) ? (result.similarity || 0.5) : qualityScore;
            return {
                ...result,
                qualityScore: finalQualityScore
            };
        });

        // Sort by quality score and similarity
        const sortedResults = scoredResults.sort((a, b) => {
            const aScore = (a.qualityScore * SEARCH_CONFIG.SCORING.QUALITY_WEIGHT) + ((a.adjustedSimilarity || a.similarity || 0) * SEARCH_CONFIG.SCORING.SIMILARITY_WEIGHT);
            const bScore = (b.qualityScore * SEARCH_CONFIG.SCORING.QUALITY_WEIGHT) + ((b.adjustedSimilarity || b.similarity || 0) * SEARCH_CONFIG.SCORING.SIMILARITY_WEIGHT);
            return bScore - aScore;
        });

        // Apply final filtering based on quality threshold
        const qualityThreshold = Math.max(SEARCH_CONFIG.QUALITY.QUALITY_THRESHOLD_FLOOR, this.options.minAcceptableQuality);

        const qualityFiltered = sortedResults.filter(result =>
            result.qualityScore >= qualityThreshold
        );

        // Limit to target count
        const finalResults = qualityFiltered.slice(0, this.options.targetResultCount);

        searchLogger.debug('🎯 Results optimized', {
            original: results.length,
            afterQualityFilter: qualityFiltered.length,
            final: finalResults.length,
            avgQuality: this._calculateAverageQuality(finalResults).toFixed(3)
        });

        return finalResults;
    }

    /**
     * Calculate quality score for a result
     * 
     * @private
     * @param {Object} result 
     * @param {string} query 
     * @param {Object} zptState 
     * @returns {number} Quality score 0-1
     */
    _calculateResultQuality(result, query, zptState) {
        let qualityScore = SEARCH_CONFIG.SCORING.BASE_QUALITY_SCORE;

        // Factor 1: Similarity score
        const similarity = result.adjustedSimilarity || result.similarity || 0;
        qualityScore += similarity * SEARCH_CONFIG.SCORING.SIMILARITY_CONTRIBUTION;

        // Factor 2: Content length and completeness
        const content = (result.prompt || '') + ' ' + (result.response || '');
        const lengthScore = Math.min(1.0, content.length / 200); // Normalize to 200 chars
        qualityScore += lengthScore * SEARCH_CONFIG.SCORING.LENGTH_CONTRIBUTION;

        // Factor 3: Pan filter matches
        const panScore = (result.keywordBoost || 0) + (result.entityBoost || 0);
        qualityScore += Math.min(SEARCH_CONFIG.SCORING.PAN_FILTER_MAX_CONTRIBUTION, panScore);

        // Factor 4: Recency if timestamp available
        if (result.timestamp || result.metadata?.timestamp) {
            const timestamp = new Date(result.timestamp || result.metadata.timestamp);
            const age = Date.now() - timestamp.getTime();
            const daysSinceCreation = age / (1000 * 60 * 60 * 24);
            const recencyScore = Math.max(0, 1 - (daysSinceCreation / 365)); // Decay over a year
            qualityScore += recencyScore * SEARCH_CONFIG.SCORING.RECENCY_CONTRIBUTION;
        }

        // Factor 5: Concept richness
        if (result.concepts && Array.isArray(result.concepts)) {
            const conceptScore = Math.min(1.0, result.concepts.length / 5);
            qualityScore += conceptScore * SEARCH_CONFIG.SCORING.CONCEPT_CONTRIBUTION;
        }

        return Math.min(1.0, qualityScore);
    }

    /**
     * Calculate average quality for a set of results
     * 
     * @private
     * @param {Array} results 
     * @returns {number} Average quality score
     */
    _calculateAverageQuality(results) {
        if (!results || results.length === 0) return 0;

        const totalQuality = results.reduce((sum, result) =>
            sum + (result.qualityScore || result.similarity || SEARCH_CONFIG.SCORING.DEFAULT_SIMILARITY_FALLBACK), 0
        );

        return totalQuality / results.length;
    }

    /**
     * Fallback to simple search when adaptive search fails
     * 
     * @private
     * @param {string} query 
     * @param {Object} options 
     * @returns {Promise<Object>} Fallback search result
     */
    async _fallbackSearch(query, options) {
        searchLogger.warn('⚠️ Using fallback search due to adaptive search failure');

        try {
            const results = await this.safeOperations.searchSimilar(
                query,
                this.options.targetResultCount,
                0.3
            );

            return {
                success: results && results.length > 0,
                contexts: results || [],
                searchMethod: 'fallback_simple',
                warning: 'Adaptive search failed, used simple fallback'
            };
        } catch (error) {
            searchLogger.error('❌ Fallback search also failed', { error: error.message });

            return {
                success: false,
                contexts: [],
                searchMethod: 'failed',
                error: error.message
            };
        }
    }

    /**
     * Update internal metrics for monitoring
     * 
     * @private
     * @param {Object} searchResult 
     */
    _updateMetrics(searchResult) {
        // Update averages
        const totalSearches = this.searchMetrics.totalSearches;
        this.searchMetrics.averagePasses = (
            (this.searchMetrics.averagePasses * (totalSearches - 1)) +
            searchResult.totalPasses
        ) / totalSearches;

        this.searchMetrics.successRate = (
            (this.searchMetrics.successRate * (totalSearches - 1)) +
            (searchResult.success ? 1 : 0)
        ) / totalSearches;

        // Update quality distribution
        const avgQuality = searchResult.searchStats.averageQuality;
        if (avgQuality > SEARCH_CONFIG.QUALITY.HIGH_QUALITY_THRESHOLD) {
            this.searchMetrics.qualityDistribution.high++;
        } else if (avgQuality > SEARCH_CONFIG.QUALITY.MEDIUM_QUALITY_THRESHOLD) {
            this.searchMetrics.qualityDistribution.medium++;
        } else {
            this.searchMetrics.qualityDistribution.low++;
        }
    }

    /**
     * Get performance metrics and statistics
     * 
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            searchEngine: { ...this.searchMetrics },
            thresholdCalculator: this.thresholdCalculator.getPerformanceStats()
        };
    }
}

export default AdaptiveSearchEngine;