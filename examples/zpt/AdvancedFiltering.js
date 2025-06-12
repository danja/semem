/**
 * AdvancedFiltering.js - Advanced Pan Filtering Demonstration
 * 
 * This example showcases sophisticated pan filtering capabilities in ZPT navigation:
 * 
 * 1. **Topic Filtering**: Semantic topic constraints with pattern matching
 * 2. **Entity Filtering**: Specific entity targeting and entity type filtering
 * 3. **Temporal Filtering**: Time-based constraints and date range filtering
 * 4. **Geographic Filtering**: Location-based filtering with spatial constraints
 * 5. **Combined Filtering**: Multiple filter combinations and complex queries
 * 6. **Filter Performance**: Optimization and selectivity analysis
 * 
 * Pan Filtering Architecture:
 * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 * │   TOPIC     │    │   ENTITY    │    │  TEMPORAL   │    │ GEOGRAPHIC  │
 * │ (semantic)  │    │ (specific)  │    │ (temporal)  │    │ (spatial)   │
 * └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
 *       │                    │                    │                    │
 *       └────────────────────┼────────────────────┼────────────────────┘
 *                            │                    │
 *                    ┌───────▼────────┐   ┌───────▼────────┐
 *                    │  SPARQL Query  │   │ Filter Builder │
 *                    │   Generation   │   │ Optimization   │
 *                    └────────────────┘   └────────────────┘
 * 
 * This example demonstrates:
 * - Complex SPARQL query generation for semantic filtering
 * - Multi-dimensional filter combinations and optimization
 * - Performance analysis and selectivity estimation
 * - Cache-aware filtering strategies
 * 
 * Prerequisites:
 * - Ragno corpus with rich entity metadata
 * - Temporal and geographic annotations in RDF
 * - SPARQL endpoint with full-text search capabilities
 */

import dotenv from 'dotenv'
dotenv.config()

import { logger } from '../../src/Utils.js'
import Config from '../../src/Config.js'
import ParameterValidator from '../../src/zpt/parameters/ParameterValidator.js'
import ParameterNormalizer from '../../src/zpt/parameters/ParameterNormalizer.js'
import FilterBuilder from '../../src/zpt/parameters/FilterBuilder.js'
import PanDomainFilter from '../../src/zpt/selection/PanDomainFilter.js'

// Configure logging
logger.info('Starting Advanced Pan Filtering Demo')

let config = null
let validator = null
let normalizer = null
let filterBuilder = null
let panFilter = null

/**
 * Initialize filtering components
 */
async function initializeComponents() {
    logger.info('🔧 Initializing pan filtering components...')
    
    config = new Config()
    await config.init()
    
    validator = new ParameterValidator()
    normalizer = new ParameterNormalizer()
    filterBuilder = new FilterBuilder()
    panFilter = new PanDomainFilter({
        enableCaching: true,
        enableFuzzyMatching: true,
        enableSemanticExpansion: true
    })
    
    logger.info('✅ Pan filtering components initialized')
}

/**
 * Demonstrate topic-based filtering with semantic patterns
 */
async function demonstrateTopicFiltering() {
    logger.info('\n🎯 === Topic Filtering Demonstrations ===')
    
    const topicFilters = [
        {
            name: 'Exact Topic Match',
            filter: {
                zoom: 'entity',
                pan: {
                    topic: 'machine-learning'
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Fuzzy Topic Match',
            filter: {
                zoom: 'unit',
                pan: {
                    topic: {
                        value: 'artificial intelligence',
                        pattern: 'fuzzy',
                        threshold: 0.8
                    }
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Semantic Topic Expansion',
            filter: {
                zoom: 'text',
                pan: {
                    topic: {
                        value: 'neural networks',
                        pattern: 'semantic',
                        expandSynonyms: true,
                        expandHyponyms: true
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'Multiple Topic OR',
            filter: {
                zoom: 'entity',
                pan: {
                    topic: {
                        value: ['deep-learning', 'computer-vision', 'nlp'],
                        operator: 'OR'
                    }
                },
                tilt: 'embedding'
            }
        },
        {
            name: 'Topic Exclusion',
            filter: {
                zoom: 'unit',
                pan: {
                    topic: {
                        include: 'machine-learning',
                        exclude: ['supervised-learning', 'regression']
                    }
                },
                tilt: 'keywords'
            }
        }
    ]
    
    for (const example of topicFilters) {
        logger.info(`\n${example.name}:`)
        logger.info('Filter configuration:', JSON.stringify(example.filter.pan.topic, null, 2))
        
        // Validate and normalize
        const validationResult = validator.validate(example.filter)
        if (validationResult.valid) {
            const normalized = normalizer.normalize(example.filter)
            
            // Build SPARQL query
            const queryResult = filterBuilder.buildQuery(normalized)
            logger.info('Generated query metadata:', { zoomLevel: queryResult.zoomLevel, complexity: queryResult.metadata.complexity })
            logger.info('Estimated selectivity:', estimateTopicSelectivity(example.filter.pan.topic))
            
            // Simulate filtering result
            const filterResult = simulateTopicFilterResult(example.filter.pan.topic)
            logger.info('Simulated result:', filterResult)
        } else {
            logger.warn('Validation failed:', validationResult.errors.map(e => e.message))
        }
    }
}

/**
 * Demonstrate entity-based filtering with specific targeting
 */
async function demonstrateEntityFiltering() {
    logger.info('\n🎭 === Entity Filtering Demonstrations ===')
    
    const entityFilters = [
        {
            name: 'Specific Entity URI',
            filter: {
                zoom: 'entity',
                pan: {
                    entity: {
                        uri: 'http://example.org/entities/TensorFlow'
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'Entity Type Filtering',
            filter: {
                zoom: 'unit',
                pan: {
                    entity: {
                        type: 'http://purl.org/stuff/ragno/SoftwareFramework',
                        limit: 10
                    }
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Entity Label Pattern',
            filter: {
                zoom: 'entity',
                pan: {
                    entity: {
                        labelPattern: 'Google.*',
                        caseInsensitive: true
                    }
                },
                tilt: 'embedding'
            }
        },
        {
            name: 'Related Entities',
            filter: {
                zoom: 'text',
                pan: {
                    entity: {
                        relatedTo: 'http://example.org/entities/DeepLearning',
                        relationTypes: ['ragno:relatedTo', 'ragno:partOf'],
                        maxDistance: 2
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'Entity Property Constraints',
            filter: {
                zoom: 'entity',
                pan: {
                    entity: {
                        properties: {
                            'ragno:importance': { min: 0.7 },
                            'ragno:frequency': { min: 5 },
                            'dct:created': { after: '2023-01-01' }
                        }
                    }
                },
                tilt: 'keywords'
            }
        }
    ]
    
    for (const example of entityFilters) {
        logger.info(`\n${example.name}:`)
        logger.info('Entity filter:', JSON.stringify(example.filter.pan.entity, null, 2))
        
        // Process filter
        const validationResult = validator.validate(example.filter)
        if (validationResult.valid) {
            const normalized = normalizer.normalize(example.filter)
            const queryResult = filterBuilder.buildQuery(normalized)
            
            logger.info('Entity constraints generated:', queryResult.entityConstraints?.length || 0)
            logger.info('Estimated result count:', estimateEntityFilterResults(example.filter.pan.entity))
            
            // Simulate entity filtering
            const entityResult = simulateEntityFilterResult(example.filter.pan.entity)
            logger.info('Simulated entities:', entityResult)
        }
    }
}

/**
 * Demonstrate temporal filtering with date ranges and patterns
 */
async function demonstrateTemporalFiltering() {
    logger.info('\n⏰ === Temporal Filtering Demonstrations ===')
    
    const temporalFilters = [
        {
            name: 'Simple Date Range',
            filter: {
                zoom: 'unit',
                pan: {
                    temporal: {
                        start: '2023-01-01',
                        end: '2023-12-31'
                    }
                },
                tilt: 'temporal'
            }
        },
        {
            name: 'Recent Content (Relative)',
            filter: {
                zoom: 'text',
                pan: {
                    temporal: {
                        relative: 'last-30-days'
                    }
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Specific Time Period',
            filter: {
                zoom: 'entity',
                pan: {
                    temporal: {
                        start: '2023-06-01T00:00:00Z',
                        end: '2023-06-30T23:59:59Z',
                        timezone: 'UTC'
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'Before/After Constraints',
            filter: {
                zoom: 'community',
                pan: {
                    temporal: {
                        before: '2024-01-01',
                        property: 'dct:modified'
                    }
                },
                tilt: 'embedding'
            }
        },
        {
            name: 'Periodic Pattern',
            filter: {
                zoom: 'unit',
                pan: {
                    temporal: {
                        pattern: 'monthly',
                        startDate: '2023-01-01',
                        occurrences: 6
                    }
                },
                tilt: 'temporal'
            }
        }
    ]
    
    for (const example of temporalFilters) {
        logger.info(`\n${example.name}:`)
        logger.info('Temporal filter:', JSON.stringify(example.filter.pan.temporal, null, 2))
        
        // Process temporal filter
        const validationResult = validator.validate(example.filter)
        if (validationResult.valid) {
            const normalized = normalizer.normalize(example.filter)
            const queryResult = filterBuilder.buildQuery(normalized)
            
            logger.info('Query generated:', queryResult.query ? 'Yes' : 'No')
            logger.info('Date range coverage:', calculateDateRangeCoverage(example.filter.pan.temporal))
            
            // Simulate temporal filtering
            const temporalResult = simulateTemporalFilterResult(example.filter.pan.temporal)
            logger.info('Simulated temporal result:', temporalResult)
        }
    }
}

/**
 * Demonstrate geographic filtering with spatial constraints
 */
async function demonstrateGeographicFiltering() {
    logger.info('\n🌍 === Geographic Filtering Demonstrations ===')
    
    const geographicFilters = [
        {
            name: 'Bounding Box (Silicon Valley)',
            filter: {
                zoom: 'entity',
                pan: {
                    geographic: {
                        bbox: {
                            minLon: -122.5,
                            minLat: 37.2,
                            maxLon: -121.9,
                            maxLat: 37.6
                        }
                    }
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Radius Around Point (London)',
            filter: {
                zoom: 'unit',
                pan: {
                    geographic: {
                        center: {
                            lon: -0.1276,
                            lat: 51.5074
                        },
                        radius: 50,
                        units: 'km'
                    }
                },
                tilt: 'embedding'
            }
        },
        {
            name: 'Named Location',
            filter: {
                zoom: 'text',
                pan: {
                    geographic: {
                        location: 'United States',
                        includeSubRegions: true
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'Multiple Regions (OR)',
            filter: {
                zoom: 'community',
                pan: {
                    geographic: {
                        regions: ['Europe', 'North America'],
                        operator: 'OR'
                    }
                },
                tilt: 'keywords'
            }
        },
        {
            name: 'Geographic Exclusion',
            filter: {
                zoom: 'entity',
                pan: {
                    geographic: {
                        include: {
                            location: 'California'
                        },
                        exclude: {
                            location: 'Los Angeles'
                        }
                    }
                },
                tilt: 'temporal'
            }
        }
    ]
    
    for (const example of geographicFilters) {
        logger.info(`\n${example.name}:`)
        logger.info('Geographic filter:', JSON.stringify(example.filter.pan.geographic, null, 2))
        
        // Process geographic filter
        const validationResult = validator.validate(example.filter)
        if (validationResult.valid) {
            const normalized = normalizer.normalize(example.filter)
            const queryResult = filterBuilder.buildQuery(normalized)
            
            logger.info('Query complexity:', queryResult.metadata.complexity)
            logger.info('Coverage area:', calculateGeographicCoverage(example.filter.pan.geographic))
            
            // Simulate geographic filtering
            const geoResult = simulateGeographicFilterResult(example.filter.pan.geographic)
            logger.info('Simulated geographic result:', geoResult)
        }
    }
}

/**
 * Demonstrate complex multi-dimensional filtering
 */
async function demonstrateComplexFiltering() {
    logger.info('\n🎛️ === Complex Multi-Dimensional Filtering ===')
    
    const complexFilters = [
        {
            name: 'AI Research in Silicon Valley (2023)',
            filter: {
                zoom: 'entity',
                pan: {
                    topic: {
                        value: 'artificial-intelligence',
                        pattern: 'semantic',
                        expandSynonyms: true
                    },
                    geographic: {
                        bbox: {
                            minLon: -122.5,
                            minLat: 37.2,
                            maxLon: -121.9,
                            maxLat: 37.6
                        }
                    },
                    temporal: {
                        start: '2023-01-01',
                        end: '2023-12-31'
                    }
                },
                tilt: 'embedding'
            }
        },
        {
            name: 'Recent Google DeepMind Publications',
            filter: {
                zoom: 'text',
                pan: {
                    entity: {
                        labelPattern: 'DeepMind|Google',
                        type: 'http://purl.org/stuff/ragno/Organization'
                    },
                    topic: {
                        value: ['deep-learning', 'reinforcement-learning'],
                        operator: 'OR'
                    },
                    temporal: {
                        relative: 'last-6-months'
                    }
                },
                tilt: 'graph'
            }
        },
        {
            name: 'European ML Conferences with High Impact',
            filter: {
                zoom: 'community',
                pan: {
                    topic: 'machine-learning',
                    geographic: {
                        location: 'Europe',
                        includeSubRegions: true
                    },
                    entity: {
                        type: 'http://purl.org/stuff/ragno/Conference',
                        properties: {
                            'ragno:importance': { min: 0.8 },
                            'ragno:attendeeCount': { min: 1000 }
                        }
                    }
                },
                tilt: 'keywords'
            }
        }
    ]
    
    for (const example of complexFilters) {
        logger.info(`\n${example.name}:`)
        logger.info('Complex filter configuration:')
        
        // Show each dimension
        if (example.filter.pan.topic) {
            logger.info('  Topic:', example.filter.pan.topic)
        }
        if (example.filter.pan.entity) {
            logger.info('  Entity:', example.filter.pan.entity)
        }
        if (example.filter.pan.temporal) {
            logger.info('  Temporal:', example.filter.pan.temporal)
        }
        if (example.filter.pan.geographic) {
            logger.info('  Geographic:', example.filter.pan.geographic)
        }
        
        // Process complex filter
        const validationResult = validator.validate(example.filter)
        if (validationResult.valid) {
            const normalized = normalizer.normalize(example.filter)
            const queryResult = filterBuilder.buildQuery(normalized)
            
            // Analyze filter complexity
            const complexity = analyzeFilterComplexity(example.filter.pan)
            logger.info('Filter analysis:', complexity)
            
            // Generate performance estimate
            const performance = estimateFilterPerformance(example.filter.pan)
            logger.info('Performance estimate:', performance)
            
            // Simulate complex filtering result
            const complexResult = simulateComplexFilterResult(example.filter.pan)
            logger.info('Simulated result:', complexResult)
        }
    }
}

/**
 * Demonstrate filter optimization strategies
 */
async function demonstrateFilterOptimization() {
    logger.info('\n⚡ === Filter Optimization Demonstrations ===')
    
    // Example of poorly optimized vs optimized filters
    const filterExamples = [
        {
            name: 'Unoptimized Filter',
            filter: {
                topic: {
                    value: 'artificial intelligence',
                    pattern: 'fuzzy',
                    threshold: 0.3  // Very low threshold = many results
                },
                geographic: {
                    location: 'World'  // Too broad
                },
                temporal: {
                    start: '1900-01-01',  // Too wide range
                    end: '2024-12-31'
                }
            },
            optimization: 'none'
        },
        {
            name: 'Optimized Filter',
            filter: {
                topic: {
                    value: 'artificial intelligence',
                    pattern: 'semantic',
                    threshold: 0.8  // Higher threshold = fewer, better results
                },
                geographic: {
                    location: 'California'  // More specific
                },
                temporal: {
                    relative: 'last-2-years'  // Narrower timeframe
                }
            },
            optimization: 'applied'
        }
    ]
    
    for (const example of filterExamples) {
        logger.info(`\n${example.name}:`)
        
        // Analyze selectivity
        const selectivityAnalysis = analyzeFilterSelectivity(example.filter)
        logger.info('Selectivity analysis:', selectivityAnalysis)
        
        // Estimate resource usage
        const resourceEstimate = estimateResourceUsage(example.filter)
        logger.info('Resource estimate:', resourceEstimate)
        
        // Show optimization suggestions
        if (example.optimization === 'none') {
            const suggestions = generateOptimizationSuggestions(example.filter)
            logger.info('Optimization suggestions:', suggestions)
        } else {
            logger.info('Optimizations applied:', getAppliedOptimizations(example.filter))
        }
    }
    
    // Cache effectiveness demo
    logger.info('\n💾 Cache Effectiveness Analysis:')
    const cacheScenarios = [
        { name: 'Popular topic + recent timeframe', hitRate: 0.85 },
        { name: 'Specific entity + broad geographic', hitRate: 0.60 },
        { name: 'Complex multi-filter query', hitRate: 0.25 },
        { name: 'Rare topic + narrow constraints', hitRate: 0.10 }
    ]
    
    cacheScenarios.forEach(scenario => {
        logger.info(`${scenario.name}: ${(scenario.hitRate * 100).toFixed(1)}% cache hit rate`)
    })
}

/**
 * Helper functions for simulation and analysis
 */
function estimateTopicSelectivity(topicFilter) {
    const baseSelectivity = 0.3
    if (typeof topicFilter === 'string') return baseSelectivity
    
    let selectivity = baseSelectivity
    if (topicFilter.pattern === 'exact') selectivity *= 0.5
    if (topicFilter.pattern === 'fuzzy') selectivity *= 1.5
    if (topicFilter.expandSynonyms) selectivity *= 1.2
    
    return Math.min(selectivity, 1.0)
}

function simulateTopicFilterResult(topicFilter) {
    const baseCount = 100
    const selectivity = estimateTopicSelectivity(topicFilter)
    
    return {
        matchingCorpuscles: Math.floor(baseCount * selectivity),
        processingTime: Math.floor(Math.random() * 200) + 50,
        cacheHit: Math.random() > 0.6,
        queryComplexity: typeof topicFilter === 'object' ? 'complex' : 'simple'
    }
}

function estimateEntityFilterResults(entityFilter) {
    if (entityFilter.uri) return Math.floor(Math.random() * 5) + 1
    if (entityFilter.type) return Math.floor(Math.random() * 30) + 10
    if (entityFilter.labelPattern) return Math.floor(Math.random() * 20) + 5
    return Math.floor(Math.random() * 50) + 20
}

function simulateEntityFilterResult(entityFilter) {
    return {
        entityCount: estimateEntityFilterResults(entityFilter),
        processingTime: Math.floor(Math.random() * 150) + 30,
        sparqlQueries: entityFilter.relatedTo ? 3 : 1,
        resultQuality: Math.random() * 0.3 + 0.7
    }
}

function calculateDateRangeCoverage(temporalFilter) {
    if (temporalFilter.relative) {
        const coverage = {
            'last-30-days': '30 days',
            'last-6-months': '6 months',
            'last-year': '1 year'
        }
        return coverage[temporalFilter.relative] || 'unknown'
    }
    
    if (temporalFilter.start && temporalFilter.end) {
        return `${temporalFilter.start} to ${temporalFilter.end}`
    }
    
    return 'open-ended'
}

function simulateTemporalFilterResult(temporalFilter) {
    return {
        timeRangeHits: Math.floor(Math.random() * 80) + 20,
        oldestMatch: '2023-02-15',
        newestMatch: '2024-01-10',
        processingTime: Math.floor(Math.random() * 100) + 25,
        indexUsed: true
    }
}

function calculateGeographicCoverage(geoFilter) {
    if (geoFilter.bbox) {
        const area = Math.abs(geoFilter.bbox.maxLon - geoFilter.bbox.minLon) * 
                    Math.abs(geoFilter.bbox.maxLat - geoFilter.bbox.minLat)
        return `${area.toFixed(2)} degrees²`
    }
    
    if (geoFilter.radius) {
        const area = Math.PI * Math.pow(geoFilter.radius, 2)
        return `${area.toFixed(0)} ${geoFilter.units || 'km'}²`
    }
    
    return 'region-based'
}

function simulateGeographicFilterResult(geoFilter) {
    return {
        locationsMatched: Math.floor(Math.random() * 25) + 5,
        processingTime: Math.floor(Math.random() * 120) + 40,
        spatialIndexUsed: !!geoFilter.bbox || !!geoFilter.center,
        accuracy: Math.random() * 0.2 + 0.8
    }
}

function analyzeFilterComplexity(panFilter) {
    const dimensions = Object.keys(panFilter).length
    const patterns = Object.values(panFilter).filter(f => 
        typeof f === 'object' && (f.pattern || f.operator || f.properties)
    ).length
    
    return {
        dimensions,
        hasPatternMatching: patterns > 0,
        complexity: dimensions < 2 ? 'low' : dimensions < 4 ? 'medium' : 'high',
        estimatedQueryTime: dimensions * 50 + patterns * 30
    }
}

function estimateFilterPerformance(panFilter) {
    const complexity = analyzeFilterComplexity(panFilter)
    
    return {
        estimatedResults: Math.floor(Math.random() * 200) + 50,
        processingTime: complexity.estimatedQueryTime + Math.floor(Math.random() * 100),
        memoryUsage: `${complexity.dimensions * 2 + Math.floor(Math.random() * 5)} MB`,
        cacheability: complexity.complexity === 'low' ? 'high' : 'medium'
    }
}

function simulateComplexFilterResult(panFilter) {
    const complexity = analyzeFilterComplexity(panFilter)
    
    return {
        totalMatches: Math.floor(Math.random() * 50) + 10,
        processingTime: complexity.estimatedQueryTime,
        breakdown: {
            topicMatches: panFilter.topic ? Math.floor(Math.random() * 30) + 10 : 0,
            entityMatches: panFilter.entity ? Math.floor(Math.random() * 20) + 5 : 0,
            temporalMatches: panFilter.temporal ? Math.floor(Math.random() * 40) + 15 : 0,
            geographicMatches: panFilter.geographic ? Math.floor(Math.random() * 25) + 8 : 0
        },
        intersectionEfficiency: Math.random() * 0.3 + 0.7
    }
}

function analyzeFilterSelectivity(filter) {
    const selectivities = {
        topic: estimateTopicSelectivity(filter.topic || {}),
        geographic: filter.geographic ? 0.4 : 1.0,
        temporal: filter.temporal ? 0.6 : 1.0,
        entity: filter.entity ? 0.2 : 1.0
    }
    
    const overallSelectivity = Object.values(selectivities).reduce((a, b) => a * b, 1)
    
    return {
        individual: selectivities,
        combined: overallSelectivity,
        rating: overallSelectivity < 0.1 ? 'highly selective' : 
                overallSelectivity < 0.3 ? 'moderately selective' : 'broad'
    }
}

function estimateResourceUsage(filter) {
    const dimensions = Object.keys(filter).length
    const complexity = dimensions * 10 + Math.floor(Math.random() * 20)
    
    return {
        cpuTime: `${complexity * 2}ms`,
        memoryUsage: `${dimensions * 1.5 + Math.floor(Math.random() * 3)} MB`,
        diskIO: `${complexity * 0.5} operations`,
        networkCalls: dimensions > 2 ? Math.floor(dimensions / 2) : 1
    }
}

function generateOptimizationSuggestions(filter) {
    const suggestions = []
    
    if (filter.topic?.threshold && filter.topic.threshold < 0.5) {
        suggestions.push('Increase topic threshold for better precision')
    }
    
    if (filter.geographic?.location === 'World') {
        suggestions.push('Narrow geographic scope to specific regions')
    }
    
    if (filter.temporal?.start && new Date(filter.temporal.start).getFullYear() < 2020) {
        suggestions.push('Consider focusing on more recent content')
    }
    
    if (Object.keys(filter).length > 3) {
        suggestions.push('Consider splitting complex filters into multiple queries')
    }
    
    return suggestions.length > 0 ? suggestions : ['Filter is already well-optimized']
}

function getAppliedOptimizations(filter) {
    const optimizations = []
    
    if (filter.topic?.threshold >= 0.7) {
        optimizations.push('High precision topic matching')
    }
    
    if (filter.geographic?.location !== 'World') {
        optimizations.push('Specific geographic targeting')
    }
    
    if (filter.temporal?.relative) {
        optimizations.push('Relative time constraints for relevance')
    }
    
    return optimizations
}

/**
 * Main execution function
 */
async function runAdvancedFilteringDemo() {
    try {
        await initializeComponents()
        await demonstrateTopicFiltering()
        await demonstrateEntityFiltering()
        await demonstrateTemporalFiltering()
        await demonstrateGeographicFiltering()
        await demonstrateComplexFiltering()
        await demonstrateFilterOptimization()
        
        logger.info('\n🎉 Advanced Pan Filtering Demo completed successfully!')
        logger.info('This demo showcased sophisticated filtering capabilities:')
        logger.info('- Topic-based semantic filtering with pattern matching')
        logger.info('- Entity-specific targeting and relationship traversal')
        logger.info('- Temporal constraints with flexible date ranges')
        logger.info('- Geographic spatial filtering with multiple constraint types')
        logger.info('- Complex multi-dimensional filter combinations')
        logger.info('- Performance optimization and selectivity analysis')
        
    } catch (error) {
        logger.error('Demo failed:', error.message)
        logger.error('Stack:', error.stack)
    } finally {
        if (config) {
            config = null
        }
        logger.info('🧹 Cleanup completed')
    }
}

// Execute the demo
runAdvancedFilteringDemo()