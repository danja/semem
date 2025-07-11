/**
 * SearchFilters.js - Advanced Search Result Filtering and Ranking
 * 
 * This module provides comprehensive filtering, ranking, and post-processing
 * capabilities for search results from the RagnoSearch system. It handles
 * relevance thresholding, document type filtering, deduplication, context
 * enrichment, and result ranking.
 * 
 * Key Features:
 * - Relevance threshold filtering
 * - Document type-specific filtering
 * - Result deduplication and merging
 * - Context enrichment for search results
 * - Configurable ranking algorithms
 * - Score normalization and weighting
 * - Result grouping and categorization
 * 
 * Integration:
 * - Used by examples/document/Search.js for result post-processing
 * - Integrates with RagnoSearch for enhanced result quality
 * - Supports multiple ranking and filtering strategies
 */

import { logger } from '../../Utils.js';

export default class SearchFilters {
    constructor(options = {}) {
        this.options = {
            // Relevance filtering options
            relevanceThreshold: options.relevanceThreshold || 0.7,
            enableRelevanceFiltering: options.enableRelevanceFiltering !== false,
            
            // Document type filtering options
            documentTypes: options.documentTypes || [
                'ragno:Entity',
                'ragno:Unit', 
                'ragno:TextElement',
                'ragno:CommunityElement',
                'ragno:Attribute'
            ],
            enableTypeFiltering: options.enableTypeFiltering !== false,
            
            // Deduplication options
            enableDeduplication: options.enableDeduplication !== false,
            deduplicationStrategy: options.deduplicationStrategy || 'uri', // uri, content, hybrid
            contentSimilarityThreshold: options.contentSimilarityThreshold || 0.9,
            
            // Context enrichment options
            enableContextEnrichment: options.enableContextEnrichment !== false,
            contextTypes: options.contextTypes || ['relationship', 'source', 'provenance'],
            
            // Ranking options
            rankingStrategy: options.rankingStrategy || 'weighted', // weighted, score, type, hybrid
            typeWeights: options.typeWeights || {
                'ragno:Entity': 1.0,
                'ragno:Unit': 0.9,
                'ragno:TextElement': 0.8,
                'ragno:CommunityElement': 0.7,
                'ragno:Attribute': 0.6
            },
            
            // Result limiting options
            maxResults: options.maxResults || 50,
            enableResultLimiting: options.enableResultLimiting !== false,
            
            // Score normalization options
            enableScoreNormalization: options.enableScoreNormalization !== false,
            normalizationMethod: options.normalizationMethod || 'minmax', // minmax, zscore, sigmoid
            
            ...options
        };

        // Internal state
        this.statistics = {
            totalProcessed: 0,
            filtered: 0,
            deduplicated: 0,
            enriched: 0,
            ranked: 0
        };

        logger.debug('SearchFilters initialized with options:', this.options);
    }

    /**
     * Main entry point for applying all filters to search results
     */
    async applyFilters(results, filterOptions = {}) {
        if (!results || results.length === 0) {
            return [];
        }

        logger.debug(`🔧 Applying filters to ${results.length} search results`);
        this.statistics.totalProcessed += results.length;

        let filteredResults = [...results];

        try {
            // Step 1: Apply relevance filtering
            if (this.options.enableRelevanceFiltering) {
                filteredResults = await this.applyRelevanceFiltering(filteredResults, filterOptions);
            }

            // Step 2: Apply document type filtering
            if (this.options.enableTypeFiltering) {
                filteredResults = await this.applyTypeFiltering(filteredResults, filterOptions);
            }

            // Step 3: Apply deduplication
            if (this.options.enableDeduplication) {
                filteredResults = await this.applyDeduplication(filteredResults, filterOptions);
            }

            // Step 4: Enrich with context
            if (this.options.enableContextEnrichment) {
                filteredResults = await this.enrichWithContext(filteredResults, filterOptions);
            }

            // Step 5: Apply ranking
            filteredResults = await this.applyRanking(filteredResults, filterOptions);

            // Step 6: Normalize scores
            if (this.options.enableScoreNormalization) {
                filteredResults = await this.normalizeScores(filteredResults, filterOptions);
            }

            // Step 7: Limit results
            if (this.options.enableResultLimiting) {
                filteredResults = await this.limitResults(filteredResults, filterOptions);
            }

            logger.debug(`✅ Filtering complete: ${results.length} → ${filteredResults.length} results`);
            return filteredResults;

        } catch (error) {
            logger.error('❌ Error applying search filters:', error.message);
            throw error;
        }
    }

    /**
     * Apply relevance threshold filtering
     */
    async applyRelevanceFiltering(results, options = {}) {
        const threshold = options.threshold || this.options.relevanceThreshold;
        
        logger.debug(`🎯 Applying relevance filtering with threshold ${threshold}`);

        const filtered = results.filter(result => {
            const score = this.extractScore(result);
            return score >= threshold;
        });

        this.statistics.filtered += results.length - filtered.length;
        logger.debug(`🎯 Relevance filtering: ${results.length} → ${filtered.length} results`);
        
        return filtered;
    }

    /**
     * Apply document type filtering
     */
    async applyTypeFiltering(results, options = {}) {
        const allowedTypes = options.documentTypes || this.options.documentTypes;
        
        logger.debug(`📋 Applying type filtering for types: ${allowedTypes.join(', ')}`);

        const filtered = results.filter(result => {
            const resultType = result.type || result.rdfType || 'unknown';
            return allowedTypes.includes(resultType);
        });

        logger.debug(`📋 Type filtering: ${results.length} → ${filtered.length} results`);
        
        return filtered;
    }

    /**
     * Apply deduplication to remove similar results
     */
    async applyDeduplication(results, options = {}) {
        const strategy = options.deduplicationStrategy || this.options.deduplicationStrategy;
        
        logger.debug(`🔄 Applying deduplication using strategy: ${strategy}`);

        let deduplicated;
        switch (strategy) {
            case 'uri':
                deduplicated = this.deduplicateByURI(results);
                break;
            case 'content':
                deduplicated = await this.deduplicateByContent(results);
                break;
            case 'hybrid':
                deduplicated = await this.deduplicateHybrid(results);
                break;
            default:
                deduplicated = this.deduplicateByURI(results);
        }

        this.statistics.deduplicated += results.length - deduplicated.length;
        logger.debug(`🔄 Deduplication: ${results.length} → ${deduplicated.length} results`);
        
        return deduplicated;
    }

    /**
     * Enrich results with additional context
     */
    async enrichWithContext(results, options = {}) {
        const contextTypes = options.contextTypes || this.options.contextTypes;
        
        logger.debug(`🔗 Enriching ${results.length} results with context: ${contextTypes.join(', ')}`);

        const enriched = await Promise.all(results.map(async (result) => {
            const enrichedResult = { ...result };

            // Add relationship context
            if (contextTypes.includes('relationship')) {
                enrichedResult.relationships = await this.extractRelationshipContext(result);
            }

            // Add source context
            if (contextTypes.includes('source')) {
                enrichedResult.sourceContext = await this.extractSourceContext(result);
            }

            // Add provenance context
            if (contextTypes.includes('provenance')) {
                enrichedResult.provenance = await this.extractProvenanceContext(result);
            }

            return enrichedResult;
        }));

        this.statistics.enriched += enriched.length;
        logger.debug(`🔗 Context enrichment completed for ${enriched.length} results`);
        
        return enriched;
    }

    /**
     * Apply ranking to results
     */
    async applyRanking(results, options = {}) {
        const strategy = options.rankingStrategy || this.options.rankingStrategy;
        const sortBy = options.sortBy || 'relevance';
        
        logger.debug(`📊 Applying ranking using strategy: ${strategy}, sortBy: ${sortBy}`);

        let ranked;
        switch (strategy) {
            case 'weighted':
                ranked = this.rankByWeightedScore(results, sortBy);
                break;
            case 'score':
                ranked = this.rankByScore(results, sortBy);
                break;
            case 'type':
                ranked = this.rankByType(results, sortBy);
                break;
            case 'hybrid':
                ranked = this.rankHybrid(results, sortBy);
                break;
            default:
                ranked = this.rankByWeightedScore(results, sortBy);
        }

        this.statistics.ranked += ranked.length;
        logger.debug(`📊 Ranking completed for ${ranked.length} results`);
        
        return ranked;
    }

    /**
     * Normalize scores across results
     */
    async normalizeScores(results, options = {}) {
        const method = options.normalizationMethod || this.options.normalizationMethod;
        
        logger.debug(`📏 Normalizing scores using method: ${method}`);

        const scores = results.map(result => this.extractScore(result));
        const normalized = this.normalizeScoreArray(scores, method);

        const normalizedResults = results.map((result, index) => ({
            ...result,
            normalizedScore: normalized[index],
            originalScore: this.extractScore(result)
        }));

        logger.debug(`📏 Score normalization completed`);
        
        return normalizedResults;
    }

    /**
     * Limit results to maximum number
     */
    async limitResults(results, options = {}) {
        const maxResults = options.limit || this.options.maxResults;
        
        if (results.length <= maxResults) {
            return results;
        }

        logger.debug(`✂️  Limiting results from ${results.length} to ${maxResults}`);
        
        return results.slice(0, maxResults);
    }

    /**
     * Extract score from result object
     */
    extractScore(result) {
        return result.score || result.relevance || result.similarity || result.weight || 0;
    }

    /**
     * Deduplicate by URI
     */
    deduplicateByURI(results) {
        const seen = new Set();
        const unique = [];

        for (const result of results) {
            const uri = result.uri || result.id;
            if (uri && !seen.has(uri)) {
                seen.add(uri);
                unique.push(result);
            } else if (!uri) {
                // Keep results without URI
                unique.push(result);
            }
        }

        return unique;
    }

    /**
     * Deduplicate by content similarity
     */
    async deduplicateByContent(results) {
        const threshold = this.options.contentSimilarityThreshold;
        const unique = [];

        for (const result of results) {
            const isDuplicate = await this.checkContentSimilarity(result, unique, threshold);
            if (!isDuplicate) {
                unique.push(result);
            }
        }

        return unique;
    }

    /**
     * Hybrid deduplication (URI + content)
     */
    async deduplicateHybrid(results) {
        // First deduplicate by URI
        const uriDeduped = this.deduplicateByURI(results);
        
        // Then deduplicate by content
        const contentDeduped = await this.deduplicateByContent(uriDeduped);
        
        return contentDeduped;
    }

    /**
     * Check content similarity between results
     */
    async checkContentSimilarity(result, existingResults, threshold) {
        const content1 = result.content || result.text || result.summary || '';
        
        for (const existing of existingResults) {
            const content2 = existing.content || existing.text || existing.summary || '';
            
            if (content1 && content2) {
                const similarity = this.calculateContentSimilarity(content1, content2);
                if (similarity >= threshold) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Calculate content similarity (simple Jaccard similarity)
     */
    calculateContentSimilarity(content1, content2) {
        const words1 = new Set(content1.toLowerCase().split(/\s+/));
        const words2 = new Set(content2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Rank by weighted score
     */
    rankByWeightedScore(results, sortBy) {
        return results.sort((a, b) => {
            const scoreA = this.calculateWeightedScore(a);
            const scoreB = this.calculateWeightedScore(b);
            
            if (sortBy === 'score') {
                return scoreB - scoreA; // Descending by score
            } else {
                return scoreB - scoreA; // Default to relevance (same as score)
            }
        });
    }

    /**
     * Rank by raw score
     */
    rankByScore(results, sortBy) {
        return results.sort((a, b) => {
            const scoreA = this.extractScore(a);
            const scoreB = this.extractScore(b);
            return scoreB - scoreA; // Descending
        });
    }

    /**
     * Rank by type priority
     */
    rankByType(results, sortBy) {
        return results.sort((a, b) => {
            const weightA = this.options.typeWeights[a.type] || 0.5;
            const weightB = this.options.typeWeights[b.type] || 0.5;
            
            if (weightA !== weightB) {
                return weightB - weightA; // Descending by type weight
            }
            
            // If same type weight, sort by score
            const scoreA = this.extractScore(a);
            const scoreB = this.extractScore(b);
            return scoreB - scoreA;
        });
    }

    /**
     * Hybrid ranking (type + score)
     */
    rankHybrid(results, sortBy) {
        return results.sort((a, b) => {
            const hybridScoreA = this.calculateHybridScore(a);
            const hybridScoreB = this.calculateHybridScore(b);
            return hybridScoreB - hybridScoreA; // Descending
        });
    }

    /**
     * Calculate weighted score for a result
     */
    calculateWeightedScore(result) {
        const baseScore = this.extractScore(result);
        const typeWeight = this.options.typeWeights[result.type] || 0.5;
        return baseScore * typeWeight;
    }

    /**
     * Calculate hybrid score (type + score)
     */
    calculateHybridScore(result) {
        const baseScore = this.extractScore(result);
        const typeWeight = this.options.typeWeights[result.type] || 0.5;
        
        // Combine base score and type weight
        return (baseScore * 0.7) + (typeWeight * 0.3);
    }

    /**
     * Normalize array of scores
     */
    normalizeScoreArray(scores, method) {
        if (scores.length === 0) return [];

        switch (method) {
            case 'minmax':
                return this.normalizeMinMax(scores);
            case 'zscore':
                return this.normalizeZScore(scores);
            case 'sigmoid':
                return this.normalizeSigmoid(scores);
            default:
                return this.normalizeMinMax(scores);
        }
    }

    /**
     * Min-max normalization
     */
    normalizeMinMax(scores) {
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const range = max - min;
        
        if (range === 0) {
            return scores.map(() => 1.0);
        }
        
        return scores.map(score => (score - min) / range);
    }

    /**
     * Z-score normalization
     */
    normalizeZScore(scores) {
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) {
            return scores.map(() => 0.0);
        }
        
        return scores.map(score => (score - mean) / stdDev);
    }

    /**
     * Sigmoid normalization
     */
    normalizeSigmoid(scores) {
        return scores.map(score => 1 / (1 + Math.exp(-score)));
    }

    /**
     * Extract relationship context for a result
     */
    async extractRelationshipContext(result) {
        // This would typically query the SPARQL endpoint for relationships
        // For now, return placeholder context
        return {
            incomingRelationships: [],
            outgoingRelationships: [],
            relatedEntities: []
        };
    }

    /**
     * Extract source context for a result
     */
    async extractSourceContext(result) {
        // Extract source information from result
        return {
            sourceDocument: result.sourceDocument || result.source,
            sourceUnit: result.sourceUnit,
            sourceUri: result.sourceUri,
            createdAt: result.createdAt,
            modifiedAt: result.modifiedAt
        };
    }

    /**
     * Extract provenance context for a result
     */
    async extractProvenanceContext(result) {
        // Extract provenance information
        return {
            searchMethods: result.searchMethods || result.source || ['unknown'],
            confidence: result.confidence || this.extractScore(result),
            processingSteps: result.processingSteps || [],
            derivedFrom: result.derivedFrom
        };
    }

    /**
     * Get filtering statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            configuration: {
                relevanceThreshold: this.options.relevanceThreshold,
                documentTypes: this.options.documentTypes,
                deduplicationStrategy: this.options.deduplicationStrategy,
                rankingStrategy: this.options.rankingStrategy,
                maxResults: this.options.maxResults
            }
        };
    }

    /**
     * Reset statistics
     */
    resetStatistics() {
        this.statistics = {
            totalProcessed: 0,
            filtered: 0,
            deduplicated: 0,
            enriched: 0,
            ranked: 0
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        logger.debug('🧹 Cleaning up SearchFilters resources');
        // No persistent resources to clean up for now
    }
}