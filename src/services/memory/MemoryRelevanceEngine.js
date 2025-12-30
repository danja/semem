/**
 * Memory Relevance Engine
 * 
 * Specialized service for calculating multi-factor relevance scores for memory visibility.
 * Supports adaptive weighting, temporal decay, and contextual relevance adjustments.
 */

import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

export class MemoryRelevanceEngine {
    constructor(options = {}) {
        this.config = {
            // Base relevance weights (can be adapted per user/context)
            baseWeights: {
                domainMatch: 0.35,      // How well memory matches current domains
                temporal: 0.20,         // Recency and temporal decay
                semantic: 0.30,         // Semantic similarity to current focus
                frequency: 0.15         // Access frequency and importance
            },

            // Temporal decay settings
            temporalDecay: {
                session: { halfLife: 3600000 },         // 1 hour
                daily: { halfLife: 86400000 },          // 24 hours  
                project: { halfLife: 2592000000 },      // 30 days
                permanent: { halfLife: 31536000000 }    // 365 days
            },

            // Domain type boost factors
            domainBoosts: {
                'instruction': 1.5,     // Explicit instructions get boost
                'user': 1.2,            // User preferences get boost
                'project': 1.0,         // Project memories baseline
                'session': 0.8          // Session memories reduced
            },

            // Minimum relevance score (memories never completely forgotten)
            minimumRelevance: 0.001,

            ...options
        };

        this.logger = createUnifiedLogger('MemoryRelevanceEngine');
        this.adaptiveWeights = new Map(); // Per-user adaptive weights
        this.logger.info('🧮 MemoryRelevanceEngine initialized');
    }

    /**
     * Calculate comprehensive relevance score for a memory
     */
    calculateRelevance(memory, currentZPTState, context = {}) {
        const startTime = performance.now();

        const factors = {
            domainMatch: this.computeDomainMatchScore(memory, currentZPTState),
            temporal: this.computeTemporalScore(memory, currentZPTState),
            semantic: this.computeSemanticScore(memory, currentZPTState),
            frequency: this.computeFrequencyScore(memory, context)
        };

        // Get contextual weights (adaptive if available)
        const weights = this.getContextualWeights(context.userId, currentZPTState);

        // Calculate base weighted score
        let relevanceScore = Object.entries(factors).reduce((total, [factor, value]) => {
            return total + (value * weights[factor]);
        }, 0);

        // Apply domain-specific boosts
        relevanceScore = this.applyDomainBoosts(relevanceScore, memory, currentZPTState);

        // Apply contextual modifiers
        relevanceScore = this.applyContextualModifiers(relevanceScore, memory, currentZPTState, context);

        // Ensure minimum relevance (never zero)
        const finalScore = Math.max(this.config.minimumRelevance, relevanceScore);

        const calculationTime = performance.now() - startTime;

        this.logger.debug('🎯 Relevance calculated:', {
            memoryId: memory.id?.substring(0, 8) || 'unknown',
            factors,
            weights,
            finalScore: finalScore.toFixed(4),
            calculationTime: `${calculationTime.toFixed(2)}ms`
        });

        return {
            score: finalScore,
            factors,
            weights,
            metadata: {
                calculationTime,
                domainTypes: this.extractDomainTypes(memory),
                temporalCategory: this.categorizeTemporalRelevance(factors.temporal),
                boostsApplied: this.getAppliedBoosts(memory, currentZPTState)
            }
        };
    }

    /**
     * Batch calculate relevance for multiple memories (optimized)
     */
    calculateBatchRelevance(memories, currentZPTState, context = {}) {
        const startTime = performance.now();

        this.logger.info(`🔄 Batch relevance calculation for ${memories.length} memories`);

        // Pre-calculate shared context values
        const sharedContext = {
            currentTime: Date.now(),
            focusEmbedding: currentZPTState.focusEmbedding,
            panDomains: currentZPTState.pan?.domains || [],
            weights: this.getContextualWeights(context.userId, currentZPTState)
        };

        const results = memories.map(memory => {
            const relevanceResult = this.calculateRelevanceOptimized(memory, currentZPTState, sharedContext);
            return {
                ...memory,
                relevance: relevanceResult.score,
                relevanceFactors: relevanceResult.factors,
                relevanceMetadata: relevanceResult.metadata
            };
        });

        const totalTime = performance.now() - startTime;
        const avgTime = totalTime / memories.length;

        this.logger.debug(`⚡ Batch calculation complete: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(3)}ms avg`);

        return results;
    }

    /**
     * Update adaptive weights based on user behavior
     */
    updateAdaptiveWeights(userId, interactions) {
        if (!userId || !interactions.length) return;

        this.logger.info(`🧠 Updating adaptive weights for user: ${userId}`);

        const currentWeights = this.adaptiveWeights.get(userId) || { ...this.config.baseWeights };

        // Analyze interaction patterns
        const patterns = this.analyzeInteractionPatterns(interactions);

        // Adjust weights based on patterns
        const adjustedWeights = this.adjustWeightsFromPatterns(currentWeights, patterns);

        // Store updated weights
        this.adaptiveWeights.set(userId, {
            ...adjustedWeights,
            lastUpdated: Date.now(),
            interactionCount: interactions.length
        });

        this.logger.debug(`🎛️ Weights updated for ${userId}:`, adjustedWeights);
    }

    /**
     * Get temporal decay multiplier for a given age and decay type
     */
    getTemporalDecayMultiplier(ageMs, decayType = 'project') {
        const halfLife = this.config.temporalDecay[decayType]?.halfLife || this.config.temporalDecay.project.halfLife;
        return Math.exp(-ageMs / halfLife);
    }

    /**
     * Configure relevance weights for specific contexts
     */
    configureContextualWeights(contextId, weights) {
        this.adaptiveWeights.set(`context:${contextId}`, {
            ...this.config.baseWeights,
            ...weights,
            configured: Date.now()
        });

        this.logger.info(`⚙️ Configured contextual weights for: ${contextId}`);
    }

    // === PRIVATE COMPUTATION METHODS ===

    computeDomainMatchScore(memory, currentZPTState) {
        const memoryDomains = memory.domains || [];
        const currentDomains = currentZPTState.pan?.domains || [];

        if (!memoryDomains.length && !currentDomains.length) return 1.0; // Both empty = perfect match
        if (!memoryDomains.length || !currentDomains.length) return 0.1; // One empty = low match

        // Calculate intersection and union
        const intersection = memoryDomains.filter(d => currentDomains.includes(d));
        const union = [...new Set([...memoryDomains, ...currentDomains])];

        // Jaccard similarity with domain hierarchy consideration
        let baseScore = intersection.length / union.length;

        // Bonus for hierarchical relationships
        const hierarchyBonus = this.calculateHierarchyBonus(memoryDomains, currentDomains);

        return Math.min(1.0, baseScore + hierarchyBonus);
    }

    computeTemporalScore(memory, currentZPTState) {
        const now = Date.now();
        const created = memory.timestamp || memory.created || now;
        const lastAccessed = memory.lastAccessed || created;
        const age = now - lastAccessed;

        // Determine decay type based on memory characteristics
        const decayType = this.determineDecayType(memory);

        // Apply temporal decay
        const decayScore = this.getTemporalDecayMultiplier(age, decayType);

        // Recency bonus for very recent memories
        const recencyBonus = age < 3600000 ? (1 - age / 3600000) * 0.2 : 0; // 1 hour window

        return Math.min(1.0, decayScore + recencyBonus);
    }

    computeSemanticScore(memory, currentZPTState) {
        const memoryEmbedding = memory.embedding;
        const focusEmbedding = currentZPTState.focusEmbedding;

        if (!memoryEmbedding || !focusEmbedding) {
            // Use text-based similarity as fallback
            const textContent = memory.content || memory.output || memory.prompt || '';
            return this.computeTextSimilarity(textContent, currentZPTState.focusQuery);
        }

        // Cosine similarity
        const similarity = this.cosineSimilarity(memoryEmbedding, focusEmbedding);

        // Apply non-linear scaling to emphasize high similarity
        return Math.pow(Math.max(0, similarity), 0.8);
    }

    computeFrequencyScore(memory, context) {
        const accessCount = memory.accessCount || 0;
        const importance = memory.metadata?.importance;

        // Logarithmic scaling for access count
        const accessScore = accessCount > 0 ? Math.log(1 + accessCount) / Math.log(100) : 0;

        // Explicit importance weighting
        const importanceScore = importance;

        // User-specific importance (if available in context)
        const userImportanceBonus = context.userPreferences?.importanceBoost || 0;

        return Math.min(1.0, accessScore * 0.6 + importanceScore * 0.4 + userImportanceBonus);
    }

    calculateRelevanceOptimized(memory, currentZPTState, sharedContext) {
        // Optimized version that reuses shared calculations
        const factors = {
            domainMatch: this.computeDomainMatchScore(memory, currentZPTState),
            temporal: this.computeTemporalScoreOptimized(memory, sharedContext.currentTime),
            semantic: this.computeSemanticScoreOptimized(memory, sharedContext.focusEmbedding),
            frequency: this.computeFrequencyScore(memory, {})
        };

        let relevanceScore = Object.entries(factors).reduce((total, [factor, value]) => {
            return total + (value * sharedContext.weights[factor]);
        }, 0);

        relevanceScore = this.applyDomainBoosts(relevanceScore, memory, currentZPTState);

        return {
            score: Math.max(this.config.minimumRelevance, relevanceScore),
            factors,
            metadata: {
                domainTypes: this.extractDomainTypes(memory),
                optimizedCalculation: true
            }
        };
    }

    // === UTILITY METHODS ===

    getContextualWeights(userId, currentZPTState) {
        // Try adaptive weights first
        if (userId && this.adaptiveWeights.has(userId)) {
            return this.adaptiveWeights.get(userId);
        }

        // Try context-specific weights
        const contextId = `context:${currentZPTState.zoom || 'default'}`;
        if (this.adaptiveWeights.has(contextId)) {
            return this.adaptiveWeights.get(contextId);
        }

        // Default weights
        return this.config.baseWeights;
    }

    applyDomainBoosts(baseScore, memory, currentZPTState) {
        const memoryDomains = memory.domains || [];
        let boostedScore = baseScore;

        // Apply boosts based on domain types
        for (const domain of memoryDomains) {
            const domainType = domain.split(':')[0]; // Extract type from "type:id" format
            const boost = this.config.domainBoosts[domainType];
            if (boost) {
                boostedScore *= boost;
            }
        }

        return Math.min(1.0, boostedScore);
    }

    applyContextualModifiers(score, memory, currentZPTState, context) {
        let modifiedScore = score;

        // Recent interaction boost
        if (context.recentInteractions?.includes(memory.id)) {
            modifiedScore *= 1.3;
        }

        // Project context boost
        if (context.activeProject && memory.domains?.includes(`project:${context.activeProject}`)) {
            modifiedScore *= 1.2;
        }

        // Instruction priority boost
        if (memory.domain === 'instruction' || memory.type === 'instruction') {
            modifiedScore *= 1.5;
        }

        return Math.min(1.0, modifiedScore);
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const norm = Math.sqrt(normA) * Math.sqrt(normB);
        return norm === 0 ? 0 : dotProduct / norm;
    }

    determineDecayType(memory) {
        const domains = memory.domains || [];

        if (domains.some(d => d.startsWith('instruction'))) return 'permanent';
        if (domains.some(d => d.startsWith('user'))) return 'permanent';
        if (domains.some(d => d.startsWith('project'))) return 'project';
        if (domains.some(d => d.startsWith('session'))) return 'session';

        return 'daily'; // Default
    }

    extractDomainTypes(memory) {
        return (memory.domains || []).map(d => d.split(':')[0]).filter(Boolean);
    }

    categorizeTemporalRelevance(temporalScore) {
        if (temporalScore > 0.8) return 'recent';
        if (temporalScore > 0.5) return 'moderate';
        if (temporalScore > 0.2) return 'aged';
        return 'old';
    }

    getAppliedBoosts(memory, currentZPTState) {
        const boosts = [];
        const domainTypes = this.extractDomainTypes(memory);

        for (const type of domainTypes) {
            if (this.config.domainBoosts[type] > 1.0) {
                boosts.push(`${type}:${this.config.domainBoosts[type]}`);
            }
        }

        return boosts;
    }

    // Placeholder methods that could be implemented for advanced features
    calculateHierarchyBonus(memoryDomains, currentDomains) {
        // Could implement domain hierarchy matching
        return 0;
    }

    computeTextSimilarity(text1, text2) {
        // Simple text similarity fallback
        if (!text1 || !text2) return 0.5;
        // Could implement TF-IDF or other text similarity
        return 0.5;
    }

    analyzeInteractionPatterns(interactions) {
        // Analyze user interaction patterns for adaptive weights
        return {};
    }

    adjustWeightsFromPatterns(currentWeights, patterns) {
        // Adjust weights based on detected patterns
        return currentWeights;
    }

    computeTemporalScoreOptimized(memory, currentTime) {
        const age = currentTime - (memory.lastAccessed || memory.timestamp || currentTime);
        const decayType = this.determineDecayType(memory);
        return this.getTemporalDecayMultiplier(age, decayType);
    }

    computeSemanticScoreOptimized(memory, focusEmbedding) {
        if (!memory.embedding || !focusEmbedding) return 0.5;
        return Math.pow(Math.max(0, this.cosineSimilarity(memory.embedding, focusEmbedding)), 0.8);
    }
}

export default MemoryRelevanceEngine;
