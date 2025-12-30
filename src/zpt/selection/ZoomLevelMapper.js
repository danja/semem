/**
 * Maps zoom levels to specific Ragno element types and selection strategies
 */
export default class ZoomLevelMapper {
    constructor(options = {}) {
        this.ragnoNamespace = options.ragnoNamespace || 'http://purl.org/stuff/ragno/';
        this.initializeZoomMappings();
        this.initializeSelectionStrategies();
    }

    /**
     * Initialize zoom level to RDF type mappings
     */
    initializeZoomMappings() {
        this.zoomMappings = {
            'corpus': {
                primaryTypes: ['ragno:Corpus'],
                secondaryTypes: [],
                granularity: 1,
                scope: 'global',
                description: 'Entire corpus overview and metadata',
                typicalResultCount: 1,
                aggregationLevel: 'corpus'
            },
            'community': {
                primaryTypes: ['ragno:Community'],
                secondaryTypes: ['ragno:CommunityCluster', 'ragno:Topic'],
                granularity: 2,
                scope: 'thematic',
                description: 'Thematic communities and topic clusters',
                typicalResultCount: 50,
                aggregationLevel: 'community'
            },
            'unit': {
                primaryTypes: ['ragno:SemanticUnit', 'ragno:Unit'],
                secondaryTypes: ['ragno:Chunk', 'ragno:Segment'],
                granularity: 3,
                scope: 'semantic',
                description: 'Semantic units and meaningful segments',
                typicalResultCount: 200,
                aggregationLevel: 'unit'
            },
            'entity': {
                primaryTypes: ['ragno:Entity'],
                secondaryTypes: ['ragno:Concept', 'ragno:NamedEntity'],
                granularity: 5,
                scope: 'conceptual',
                description: 'Individual entities and named elements',
                typicalResultCount: 600,
                aggregationLevel: 'entity'
            },
            'micro': {
                primaryTypes: ['ragno:Attribute'],
                secondaryTypes: ['ragno:Element'],
                granularity: 6,
                scope: 'fine',
                description: 'Fine-grained attributes and sub-entity components',
                typicalResultCount: 800,
                aggregationLevel: 'micro'
            },
            'text': {
                primaryTypes: ['ragno:TextElement', 'ragno:Text'],
                secondaryTypes: ['ragno:Sentence', 'ragno:Paragraph', 'ragno:Document'],
                granularity: 4,
                scope: 'textual',
                description: 'Raw text elements and documents',
                typicalResultCount: 1000,
                aggregationLevel: 'text'
            }
        };
    }

    /**
     * Initialize selection strategies for each zoom level
     */
    initializeSelectionStrategies() {
        this.selectionStrategies = {
            'corpus': {
                primaryStrategy: 'metadata_aggregation',
                scoringFactors: ['completeness', 'recency', 'size'],
                weights: { completeness: 0.5, recency: 0.3, size: 0.2 },
                requiresAggregation: true,
                maxResults: 5,
                sortBy: 'created_desc'
            },
            'community': {
                primaryStrategy: 'community_detection',
                scoringFactors: ['cohesion', 'diversity', 'size', 'relevance'],
                weights: { cohesion: 0.3, diversity: 0.25, size: 0.2, relevance: 0.25 },
                requiresAggregation: true,
                maxResults: 50,
                sortBy: 'cohesion_desc'
            },
            'unit': {
                primaryStrategy: 'semantic_similarity',
                scoringFactors: ['relevance', 'completeness', 'connectivity'],
                weights: { relevance: 0.5, completeness: 0.3, connectivity: 0.2 },
                requiresAggregation: false,
                maxResults: 200,
                sortBy: 'relevance_desc'
            },
            'entity': {
                primaryStrategy: 'entity_ranking',
                scoringFactors: ['relevance', 'importance', 'connectivity', 'frequency'],
                weights: { relevance: 0.4, importance: 0.3, connectivity: 0.2, frequency: 0.1 },
                requiresAggregation: false,
                maxResults: 500,
                sortBy: 'importance_desc'
            },
            'micro': {
                primaryStrategy: 'entity_ranking',
                scoringFactors: ['relevance', 'importance', 'connectivity'],
                weights: { relevance: 0.5, importance: 0.3, connectivity: 0.2 },
                requiresAggregation: false,
                maxResults: 800,
                sortBy: 'relevance_desc'
            },
            'text': {
                primaryStrategy: 'text_retrieval',
                scoringFactors: ['relevance', 'recency', 'quality'],
                weights: { relevance: 0.6, recency: 0.25, quality: 0.15 },
                requiresAggregation: false,
                maxResults: 1000,
                sortBy: 'relevance_desc'
            }
        };
    }

    /**
     * Get mapping configuration for a zoom level
     * @param {string} zoomLevel - The zoom level (corpus, community, unit, entity, text)
     * @returns {Object} Zoom level configuration
     */
    getZoomMapping(zoomLevel) {
        const mapping = this.zoomMappings[zoomLevel];
        if (!mapping) {
            throw new Error(`Unsupported zoom level: ${zoomLevel}`);
        }
        return { ...mapping };
    }

    /**
     * Get selection strategy for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Object} Selection strategy configuration
     */
    getSelectionStrategy(zoomLevel) {
        const strategy = this.selectionStrategies[zoomLevel];
        if (!strategy) {
            throw new Error(`No selection strategy defined for zoom level: ${zoomLevel}`);
        }
        return { ...strategy };
    }

    /**
     * Get all RDF types for a zoom level (primary + secondary)
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<string>} Array of RDF type URIs
     */
    getAllTypes(zoomLevel) {
        const mapping = this.getZoomMapping(zoomLevel);
        return [...mapping.primaryTypes, ...mapping.secondaryTypes];
    }

    /**
     * Get primary RDF types for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<string>} Array of primary RDF type URIs
     */
    getPrimaryTypes(zoomLevel) {
        const mapping = this.getZoomMapping(zoomLevel);
        return [...mapping.primaryTypes];
    }

    /**
     * Build type filter clause for SPARQL queries
     * @param {string} zoomLevel - The zoom level
     * @param {boolean} includePrimary - Include primary types (default: true)
     * @param {boolean} includeSecondary - Include secondary types (default: false)
     * @returns {string} SPARQL type filter clause
     */
    buildTypeFilter(zoomLevel, includePrimary = true, includeSecondary = false) {
        const mapping = this.getZoomMapping(zoomLevel);
        const types = [];
        
        if (includePrimary) {
            types.push(...mapping.primaryTypes);
        }
        
        if (includeSecondary) {
            types.push(...mapping.secondaryTypes);
        }

        if (types.length === 0) {
            return '';
        }

        if (types.length === 1) {
            return `?uri a ${types[0]} .`;
        }

        const typeUnion = types.map(type => `{ ?uri a ${type} }`).join(' UNION ');
        return `{ ${typeUnion} }`;
    }

    /**
     * Get optimal result limit for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @param {number} tokenBudget - Available token budget
     * @returns {number} Recommended result limit
     */
    getOptimalResultLimit(zoomLevel, tokenBudget = 4000) {
        const mapping = this.getZoomMapping(zoomLevel);
        const strategy = this.getSelectionStrategy(zoomLevel);
        
        // Estimate tokens per result based on zoom level
        const tokensPerResult = this.estimateTokensPerResult(zoomLevel);
        const budgetBasedLimit = Math.floor(tokenBudget * 0.8 / tokensPerResult);
        
        // Use the smaller of strategy max or budget-based limit
        return Math.min(strategy.maxResults, budgetBasedLimit, mapping.typicalResultCount);
    }

    /**
     * Estimate tokens per result for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {number} Estimated tokens per result
     */
    estimateTokensPerResult(zoomLevel) {
        const tokenEstimates = {
            'corpus': 200,    // High-level metadata
            'community': 100, // Community summaries
            'unit': 80,       // Semantic unit content
            'entity': 30,     // Entity information
            'micro': 20,      // Fine-grained components
            'text': 150       // Text content
        };
        
        return tokenEstimates[zoomLevel] || 50;
    }

    /**
     * Get aggregation requirements for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Object} Aggregation configuration
     */
    getAggregationConfig(zoomLevel) {
        const strategy = this.getSelectionStrategy(zoomLevel);
        const mapping = this.getZoomMapping(zoomLevel);
        
        return {
            required: strategy.requiresAggregation,
            level: mapping.aggregationLevel,
            strategy: strategy.primaryStrategy,
            groupBy: this.getAggregationGroupBy(zoomLevel),
            metrics: this.getAggregationMetrics(zoomLevel)
        };
    }

    /**
     * Get GROUP BY clause for aggregation
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<string>} Fields to group by
     */
    getAggregationGroupBy(zoomLevel) {
        const groupByMap = {
            'corpus': ['?corpus'],
            'community': ['?community', '?topic'],
            'unit': [], // No aggregation
            'entity': [], // No aggregation
            'micro': [], // No aggregation
            'text': [] // No aggregation
        };
        
        return groupByMap[zoomLevel] || [];
    }

    /**
     * Get aggregation metrics for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<Object>} Aggregation metrics configuration
     */
    getAggregationMetrics(zoomLevel) {
        const metricsMap = {
            'corpus': [
                { name: 'totalEntities', function: 'COUNT(?entity)', alias: 'entityCount' },
                { name: 'totalUnits', function: 'COUNT(?unit)', alias: 'unitCount' },
                { name: 'avgQuality', function: 'AVG(?quality)', alias: 'avgQuality' },
                { name: 'lastModified', function: 'MAX(?modified)', alias: 'lastModified' }
            ],
            'community': [
                { name: 'memberCount', function: 'COUNT(?member)', alias: 'memberCount' },
                { name: 'avgCohesion', function: 'AVG(?cohesion)', alias: 'avgCohesion' },
                { name: 'topicDiversity', function: 'COUNT(DISTINCT ?topic)', alias: 'topicCount' },
                { name: 'totalConnections', function: 'SUM(?connections)', alias: 'connectionCount' }
            ],
            'unit': [],
            'entity': [],
            'micro': [],
            'text': []
        };
        
        return metricsMap[zoomLevel] || [];
    }

    /**
     * Determine if zoom level supports a specific tilt representation
     * @param {string} zoomLevel - The zoom level
     * @param {string} tiltRepresentation - The tilt representation
     * @returns {boolean} Whether the combination is supported
     */
    supportsTilt(zoomLevel, tiltRepresentation) {
        const supportMatrix = {
            'corpus': ['keywords', 'temporal', 'graph'],
            'community': ['keywords', 'graph', 'embedding'],
            'unit': ['keywords', 'embedding', 'temporal', 'graph'],
            'entity': ['keywords', 'embedding', 'graph'],
            'micro': ['keywords', 'embedding'],
            'text': ['keywords', 'embedding', 'temporal']
        };
        
        const supportedTilts = supportMatrix[zoomLevel] || [];
        return supportedTilts.includes(tiltRepresentation);
    }

    /**
     * Get recommended tilt representation for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {string} Recommended tilt representation
     */
    getRecommendedTilt(zoomLevel) {
        const recommendations = {
            'corpus': 'keywords',
            'community': 'graph',
            'unit': 'embedding',
            'entity': 'embedding',
            'micro': 'keywords',
            'text': 'keywords'
        };
        
        return recommendations[zoomLevel] || 'keywords';
    }

    /**
     * Build zoom-specific SPARQL SELECT clause
     * @param {string} zoomLevel - The zoom level
     * @param {string} tiltRepresentation - The tilt representation
     * @returns {string} SPARQL SELECT clause
     */
    buildSelectClause(zoomLevel, tiltRepresentation) {
        const baseFields = this.getBaseFields(zoomLevel);
        const tiltFields = this.getTiltFields(tiltRepresentation);
        const aggregationFields = this.getAggregationFields(zoomLevel);
        
        const allFields = [...baseFields, ...tiltFields, ...aggregationFields];
        return `SELECT DISTINCT ${allFields.join(' ')}`;
    }

    /**
     * Get base fields for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<string>} Base SPARQL fields
     */
    getBaseFields(zoomLevel) {
        const fieldMap = {
            'corpus': ['?uri', '?label', '?description', '?created', '?modified'],
            'community': ['?uri', '?label', '?description', '?memberCount', '?cohesion'],
            'unit': ['?uri', '?content', '?entity', '?unit', '?created'],
            'entity': ['?uri', '?label', '?type', '?prefLabel', '?importance'],
            'micro': ['?uri', '?label', '?content', '?attributeType'],
            'text': ['?uri', '?text', '?source', '?position', '?created']
        };
        
        return fieldMap[zoomLevel] || ['?uri', '?label'];
    }

    /**
     * Get tilt-specific fields
     * @param {string} tiltRepresentation - The tilt representation
     * @returns {Array<string>} Tilt-specific SPARQL fields
     */
    getTiltFields(tiltRepresentation) {
        const fieldMap = {
            'embedding': ['?embedding', '?similarity'],
            'keywords': ['?keywords', '?keywordScore'],
            'graph': ['?connections', '?centrality'],
            'temporal': ['?created', '?modified', '?sequence']
        };
        
        return fieldMap[tiltRepresentation] || [];
    }

    /**
     * Get aggregation fields for a zoom level
     * @param {string} zoomLevel - The zoom level
     * @returns {Array<string>} Aggregation SPARQL fields
     */
    getAggregationFields(zoomLevel) {
        const metrics = this.getAggregationMetrics(zoomLevel);
        return metrics.map(metric => `(${metric.function} AS ?${metric.alias})`);
    }

    /**
     * Validate zoom level compatibility with parameters
     * @param {string} zoomLevel - The zoom level
     * @param {Object} panFilters - Pan filter parameters
     * @param {string} tiltRepresentation - Tilt representation
     * @returns {Object} Validation result
     */
    validateCompatibility(zoomLevel, panFilters, tiltRepresentation) {
        const issues = [];
        const warnings = [];

        // Check tilt compatibility
        if (!this.supportsTilt(zoomLevel, tiltRepresentation)) {
            issues.push(`Tilt '${tiltRepresentation}' not optimal for zoom level '${zoomLevel}'`);
            warnings.push(`Consider using '${this.getRecommendedTilt(zoomLevel)}' instead`);
        }

        // Check filter compatibility
        if (zoomLevel === 'corpus' && panFilters.entity) {
            warnings.push('Entity filters may not be effective at corpus zoom level');
        }

        if (zoomLevel === 'text' && panFilters.geographic) {
            warnings.push('Geographic filters may have limited effect on text elements');
        }

        // Check result count expectations
        const mapping = this.getZoomMapping(zoomLevel);
        if (panFilters.topic && mapping.typicalResultCount > 500) {
            warnings.push('Topic filters may return many results at this zoom level');
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings,
            recommendations: this.getRecommendations(zoomLevel, panFilters, tiltRepresentation)
        };
    }

    /**
     * Get optimization recommendations
     * @param {string} zoomLevel - The zoom level
     * @param {Object} panFilters - Pan filter parameters
     * @param {string} tiltRepresentation - Tilt representation
     * @returns {Array<string>} Optimization recommendations
     */
    getRecommendations(zoomLevel, panFilters, tiltRepresentation) {
        const recommendations = [];
        
        if (zoomLevel === 'entity' && tiltRepresentation === 'temporal') {
            recommendations.push('Consider using embedding or graph tilt for better entity analysis');
        }
        
        if (zoomLevel === 'corpus' && Object.keys(panFilters).length > 2) {
            recommendations.push('Simplify filters for corpus-level analysis');
        }
        
        if (zoomLevel === 'text' && !panFilters.topic) {
            recommendations.push('Add topic filter to improve text relevance');
        }
        
        return recommendations;
    }

    /**
     * Get zoom level metadata for API documentation
     * @returns {Object} Complete zoom level documentation
     */
    getZoomLevelDocumentation() {
        const documentation = {};
        
        for (const [level, mapping] of Object.entries(this.zoomMappings)) {
            const strategy = this.selectionStrategies[level];
            
            documentation[level] = {
                description: mapping.description,
                granularity: mapping.granularity,
                scope: mapping.scope,
                types: {
                    primary: mapping.primaryTypes,
                    secondary: mapping.secondaryTypes
                },
                strategy: {
                    name: strategy.primaryStrategy,
                    factors: strategy.scoringFactors,
                    maxResults: strategy.maxResults
                },
                supportedTilts: Object.keys(this.selectionStrategies).filter(tilt => 
                    this.supportsTilt(level, tilt)
                ),
                recommendedTilt: this.getRecommendedTilt(level),
                typicalResultCount: mapping.typicalResultCount,
                estimatedTokensPerResult: this.estimateTokensPerResult(level)
            };
        }
        
        return documentation;
    }
}
