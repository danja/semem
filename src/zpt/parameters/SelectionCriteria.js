/**
 * Builds selection criteria and rules from normalized ZPT parameters
 */
export default class SelectionCriteria {
    constructor(options = {}) {
        this.defaultRules = this.initializeDefaultRules();
        this.priorityWeights = options.priorityWeights || this.getDefaultWeights();
    }

    /**
     * Initialize default selection rules
     */
    initializeDefaultRules() {
        return {
            relevance: {
                weight: 0.4,
                enabled: true,
                description: 'Content relevance to query parameters'
            },
            recency: {
                weight: 0.2,
                enabled: true,
                description: 'Temporal freshness of content'
            },
            connectivity: {
                weight: 0.2,
                enabled: true,
                description: 'Graph connectivity and relationships'
            },
            completeness: {
                weight: 0.1,
                enabled: true,
                description: 'Content completeness and quality'
            },
            diversity: {
                weight: 0.1,
                enabled: true,
                description: 'Content diversity and coverage'
            }
        };
    }

    /**
     * Get default priority weights
     */
    getDefaultWeights() {
        return {
            'entity': { relevance: 0.5, connectivity: 0.3, completeness: 0.2 },
            'unit': { relevance: 0.4, completeness: 0.3, diversity: 0.3 },
            'text': { relevance: 0.6, recency: 0.2, completeness: 0.2 },
            'community': { connectivity: 0.5, diversity: 0.3, relevance: 0.2 },
            'corpus': { completeness: 0.4, diversity: 0.3, recency: 0.3 }
        };
    }

    /**
     * Build complete selection criteria from normalized parameters
     * @param {Object} normalizedParams - Normalized ZPT parameters
     * @returns {Object} Selection criteria configuration
     */
    buildCriteria(normalizedParams) {
        const zoomLevel = normalizedParams.zoom.level;
        const complexity = normalizedParams._metadata.complexity;

        const criteria = {
            primary: this.buildPrimaryRules(normalizedParams),
            secondary: this.buildSecondaryRules(normalizedParams),
            constraints: this.buildConstraints(normalizedParams),
            scoring: this.buildScoringRules(normalizedParams),
            optimization: this.buildOptimizationRules(normalizedParams),
            metadata: {
                zoomLevel,
                complexity,
                totalRules: 0,
                estimatedSelectivity: this.estimateSelectivity(normalizedParams)
            }
        };

        criteria.metadata.totalRules = this.countRules(criteria);
        return criteria;
    }

    /**
     * Build primary selection rules (must-have criteria)
     */
    buildPrimaryRules(normalizedParams) {
        const rules = [];

        // Zoom-level type constraints
        rules.push({
            type: 'type_constraint',
            field: 'rdf:type',
            operator: 'in',
            values: normalizedParams.zoom.targetTypes,
            priority: 'required',
            description: `Must be of types: ${normalizedParams.zoom.targetTypes.join(', ')}`
        });

        // Pan filter constraints
        if (normalizedParams.pan.topic) {
            rules.push(this.buildTopicRule(normalizedParams.pan.topic));
        }

        if (normalizedParams.pan.entity) {
            rules.push(this.buildEntityRule(normalizedParams.pan.entity));
        }

        if (normalizedParams.pan.temporal) {
            rules.push(this.buildTemporalRule(normalizedParams.pan.temporal));
        }

        if (normalizedParams.pan.geographic) {
            rules.push(this.buildGeographicRule(normalizedParams.pan.geographic));
        }

        return rules;
    }

    /**
     * Build secondary selection rules (preference-based)
     */
    buildSecondaryRules(normalizedParams) {
        const rules = [];
        const tiltType = normalizedParams.tilt.representation;

        // Tilt-specific preferences
        switch (tiltType) {
            case 'embedding':
                rules.push({
                    type: 'embedding_preference',
                    field: 'semem:embedding',
                    operator: 'exists',
                    weight: 0.8,
                    description: 'Prefer items with embeddings'
                });
                break;

            case 'keywords':
                rules.push({
                    type: 'text_preference',
                    field: 'ragno:hasText',
                    operator: 'length_min',
                    value: 10,
                    weight: 0.6,
                    description: 'Prefer items with substantial text content'
                });
                break;

            case 'graph':
                rules.push({
                    type: 'connectivity_preference',
                    field: 'ragno:relatedTo',
                    operator: 'count_min',
                    value: 1,
                    weight: 0.7,
                    description: 'Prefer items with relationships'
                });
                break;

            case 'temporal':
                rules.push({
                    type: 'temporal_preference',
                    field: 'dcterms:created',
                    operator: 'recent',
                    weight: 0.9,
                    description: 'Prefer recently created items'
                });
                break;
        }

        // Quality preferences
        rules.push({
            type: 'quality_preference',
            field: 'semem:quality_score',
            operator: 'min',
            value: 0.5,
            weight: 0.3,
            description: 'Prefer higher quality content'
        });

        return rules;
    }

    /**
     * Build hard constraints
     */
    buildConstraints(normalizedParams) {
        const constraints = [];
        const tokenBudget = normalizedParams.transform.tokenBudget.content;

        // Token budget constraint
        constraints.push({
            type: 'token_budget',
            limit: tokenBudget,
            strategy: normalizedParams.transform.chunkStrategy,
            description: `Must fit within ${tokenBudget} token budget`
        });

        // Result count constraint
        const maxResults = Math.min(
            Math.floor(tokenBudget / 50), // Estimate tokens per item
            1000 // Hard limit
        );
        
        constraints.push({
            type: 'result_count',
            limit: maxResults,
            description: `Maximum ${maxResults} results`
        });

        // Complexity constraint
        if (normalizedParams._metadata.complexity > 7) {
            constraints.push({
                type: 'complexity_limit',
                maxComplexity: 7,
                fallbackStrategy: 'simplify_filters',
                description: 'Reduce complexity for performance'
            });
        }

        return constraints;
    }

    /**
     * Build scoring and ranking rules
     */
    buildScoringRules(normalizedParams) {
        const zoomLevel = normalizedParams.zoom.level;
        const weights = this.priorityWeights[zoomLevel] || this.priorityWeights.entity;

        const scoringRules = {
            algorithm: 'weighted_sum',
            weights,
            normalization: 'min_max',
            components: []
        };

        // Add relevance scoring
        if (weights.relevance) {
            scoringRules.components.push({
                name: 'relevance',
                weight: weights.relevance,
                function: this.buildRelevanceFunction(normalizedParams),
                description: 'Content relevance to query'
            });
        }

        // Add connectivity scoring
        if (weights.connectivity) {
            scoringRules.components.push({
                name: 'connectivity',
                weight: weights.connectivity,
                function: this.buildConnectivityFunction(normalizedParams),
                description: 'Graph connectivity strength'
            });
        }

        // Add recency scoring
        if (weights.recency) {
            scoringRules.components.push({
                name: 'recency',
                weight: weights.recency,
                function: this.buildRecencyFunction(normalizedParams),
                description: 'Temporal freshness'
            });
        }

        // Add completeness scoring
        if (weights.completeness) {
            scoringRules.components.push({
                name: 'completeness',
                weight: weights.completeness,
                function: this.buildCompletenessFunction(normalizedParams),
                description: 'Content completeness'
            });
        }

        // Add diversity scoring
        if (weights.diversity) {
            scoringRules.components.push({
                name: 'diversity',
                weight: weights.diversity,
                function: this.buildDiversityFunction(normalizedParams),
                description: 'Content diversity'
            });
        }

        return scoringRules;
    }

    /**
     * Build optimization rules for performance
     */
    buildOptimizationRules(normalizedParams) {
        const rules = {
            indexHints: [],
            caching: {
                enabled: true,
                ttl: 3600,
                keyStrategy: 'parameter_hash'
            },
            pagination: {
                enabled: true,
                pageSize: Math.min(100, normalizedParams.transform.maxTokens / 50)
            },
            parallelization: {
                enabled: normalizedParams._metadata.complexity > 3,
                maxThreads: Math.min(4, normalizedParams._metadata.complexity)
            }
        };

        // Add index hints based on filters
        if (normalizedParams.pan.topic) {
            rules.indexHints.push('text_search_index');
        }

        if (normalizedParams.pan.temporal) {
            rules.indexHints.push('temporal_index');
        }

        if (normalizedParams.pan.geographic) {
            rules.indexHints.push('spatial_index');
        }

        if (normalizedParams.tilt.representation === 'embedding') {
            rules.indexHints.push('vector_index');
        }

        return rules;
    }

    /**
     * Build topic-based selection rule
     */
    buildTopicRule(topicFilter) {
        return {
            type: 'topic_filter',
            field: ['rdfs:label', 'skos:prefLabel'],
            operator: topicFilter.pattern === 'wildcard' ? 'regex' : 'contains',
            value: topicFilter.value,
            caseSensitive: false,
            priority: 'required',
            description: `Topic must match: ${topicFilter.value}`
        };
    }

    /**
     * Build entity-based selection rule
     */
    buildEntityRule(entityFilter) {
        return {
            type: 'entity_filter',
            field: ['?uri', 'ragno:relatedTo'],
            operator: 'in',
            values: entityFilter.values,
            priority: 'required',
            description: `Must relate to entities: ${entityFilter.values.slice(0, 3).join(', ')}${entityFilter.count > 3 ? '...' : ''}`
        };
    }

    /**
     * Build temporal selection rule
     */
    buildTemporalRule(temporalFilter) {
        const rule = {
            type: 'temporal_filter',
            field: 'dcterms:created',
            priority: 'required',
            description: 'Temporal filter applied'
        };

        if (temporalFilter.start && temporalFilter.end) {
            rule.operator = 'between';
            rule.values = [temporalFilter.start, temporalFilter.end];
            rule.description = `Created between ${temporalFilter.start} and ${temporalFilter.end}`;
        } else if (temporalFilter.start) {
            rule.operator = 'gte';
            rule.value = temporalFilter.start;
            rule.description = `Created after ${temporalFilter.start}`;
        } else if (temporalFilter.end) {
            rule.operator = 'lte';
            rule.value = temporalFilter.end;
            rule.description = `Created before ${temporalFilter.end}`;
        }

        return rule;
    }

    /**
     * Build geographic selection rule
     */
    buildGeographicRule(geographicFilter) {
        const rule = {
            type: 'geographic_filter',
            field: 'ragno:hasLocation',
            priority: 'required',
            description: 'Geographic filter applied'
        };

        if (geographicFilter.bbox) {
            rule.operator = 'bbox';
            rule.value = geographicFilter.bbox;
            rule.description = `Within bounding box`;
        } else if (geographicFilter.center && geographicFilter.radius) {
            rule.operator = 'distance';
            rule.center = geographicFilter.center;
            rule.radius = geographicFilter.radius;
            rule.description = `Within ${geographicFilter.radius}km of center`;
        }

        return rule;
    }

    /**
     * Build relevance scoring function
     */
    buildRelevanceFunction(normalizedParams) {
        return {
            type: 'text_similarity',
            fields: ['rdfs:label', 'ragno:hasText', 'skos:prefLabel'],
            query: normalizedParams.pan.topic?.value || '',
            algorithm: 'tf_idf',
            boost: normalizedParams.pan.topic ? 1.5 : 1.0
        };
    }

    /**
     * Build connectivity scoring function
     */
    buildConnectivityFunction(normalizedParams) {
        return {
            type: 'graph_centrality',
            metric: normalizedParams.zoom.level === 'entity' ? 'degree' : 'pagerank',
            direction: 'both',
            normalization: 'global'
        };
    }

    /**
     * Build recency scoring function
     */
    buildRecencyFunction(normalizedParams) {
        return {
            type: 'temporal_decay',
            field: 'dcterms:created',
            halfLife: '30d',
            maxAge: '1y'
        };
    }

    /**
     * Build completeness scoring function
     */
    buildCompletenessFunction(normalizedParams) {
        return {
            type: 'content_completeness',
            factors: ['text_length', 'metadata_richness', 'relationship_count'],
            weights: [0.4, 0.3, 0.3]
        };
    }

    /**
     * Build diversity scoring function
     */
    buildDiversityFunction(normalizedParams) {
        return {
            type: 'content_diversity',
            strategy: 'maximal_marginal_relevance',
            diversityWeight: 0.3,
            similarityThreshold: 0.8
        };
    }

    /**
     * Estimate selectivity of criteria
     */
    estimateSelectivity(normalizedParams) {
        let selectivity = 1.0;

        // Reduce selectivity for each filter
        if (normalizedParams.pan.topic) selectivity *= 0.3;
        if (normalizedParams.pan.entity) selectivity *= 0.2;
        if (normalizedParams.pan.temporal) selectivity *= 0.5;
        if (normalizedParams.pan.geographic) selectivity *= 0.4;

        // Zoom level affects selectivity
        const zoomSelectivity = {
            'corpus': 0.1,
            'community': 0.2,
            'unit': 0.5,
            'entity': 0.7,
            'text': 0.9
        };
        
        selectivity *= zoomSelectivity[normalizedParams.zoom.level] || 0.5;

        return Math.max(0.01, Math.min(1.0, selectivity));
    }

    /**
     * Count total number of rules
     */
    countRules(criteria) {
        return (criteria.primary?.length || 0) + 
               (criteria.secondary?.length || 0) + 
               (criteria.constraints?.length || 0);
    }

    /**
     * Validate selection criteria
     */
    validateCriteria(criteria) {
        if (!criteria.primary || !Array.isArray(criteria.primary)) {
            throw new Error('Invalid criteria: missing primary rules');
        }

        if (!criteria.scoring || !criteria.scoring.algorithm) {
            throw new Error('Invalid criteria: missing scoring configuration');
        }

        // Validate weights sum to 1.0
        const totalWeight = Object.values(criteria.scoring.weights || {})
            .reduce((sum, weight) => sum + weight, 0);
        
        if (Math.abs(totalWeight - 1.0) > 0.01) {
            throw new Error(`Invalid criteria: weights must sum to 1.0, got ${totalWeight}`);
        }

        return true;
    }

    /**
     * Optimize criteria for performance
     */
    optimizeCriteria(criteria, performanceHints = {}) {
        const optimized = JSON.parse(JSON.stringify(criteria));

        // Reorder rules by selectivity (most selective first)
        if (optimized.primary) {
            optimized.primary.sort((a, b) => {
                const selectivityA = this.getRuleSelectivity(a);
                const selectivityB = this.getRuleSelectivity(b);
                return selectivityA - selectivityB;
            });
        }

        // Adjust weights based on performance constraints
        if (performanceHints.fastMode) {
            optimized.scoring.weights.relevance *= 0.7;
            optimized.scoring.weights.connectivity *= 0.5;
        }

        return optimized;
    }

    /**
     * Get estimated selectivity of a rule
     */
    getRuleSelectivity(rule) {
        const selectivityMap = {
            'type_constraint': 0.3,
            'topic_filter': 0.2,
            'entity_filter': 0.1,
            'temporal_filter': 0.4,
            'geographic_filter': 0.3
        };
        
        return selectivityMap[rule.type] || 0.5;
    }

    /**
     * Generate human-readable criteria summary
     */
    getSummary(criteria) {
        const summary = {
            totalRules: criteria.metadata.totalRules,
            complexity: criteria.metadata.complexity,
            selectivity: criteria.metadata.estimatedSelectivity,
            primaryFilters: criteria.primary.map(r => r.description),
            scoringFactors: criteria.scoring.components.map(c => c.name),
            optimizations: Object.keys(criteria.optimization)
        };

        return summary;
    }
}