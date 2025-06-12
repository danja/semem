/**
 * BasicNavigation.js - Basic ZPT Navigation Demonstration
 * 
 * This example demonstrates the fundamental ZPT (Zoom/Pan/Tilt) navigation concepts:
 * 
 * 1. **Parameter Setup**: Basic zoom/pan/tilt parameter configuration
 * 2. **Parameter Validation**: Input validation and normalization
 * 3. **Simple Selection**: Basic corpuscle selection using zoom levels
 * 4. **Tilt Projection**: Different representation formats (keywords, embeddings)
 * 5. **Transform Pipeline**: Content transformation for LLM consumption
 * 
 * ZPT Navigation Fundamentals:
 * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 * │   ZOOM      │───▶│     PAN     │───▶│    TILT     │───▶│ TRANSFORM   │
 * │(abstraction)│    │ (filtering) │    │(projection) │    │  (format)   │
 * └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
 * 
 * This example shows:
 * - Different zoom levels (entity, unit, text, community, corpus)
 * - Basic pan filtering (no complex filters)
 * - Multiple tilt representations (keywords, embeddings, graph)
 * - Various output formats (JSON, Markdown, structured)
 * 
 * Prerequisites:
 * - Ragno corpus with semantic units and entities
 * - Ollama with nomic-embed-text model for embeddings
 * - Basic ZPT pipeline components initialized
 */

import dotenv from 'dotenv'
dotenv.config()

import { logger } from '../../src/Utils.js'
import Config from '../../src/Config.js'
import ParameterValidator from '../../src/zpt/parameters/ParameterValidator.js'
import ParameterNormalizer from '../../src/zpt/parameters/ParameterNormalizer.js'
import CorpuscleSelector from '../../src/zpt/selection/CorpuscleSelector.js'
import TiltProjector from '../../src/zpt/selection/TiltProjector.js'
import CorpuscleTransformer from '../../src/zpt/transform/CorpuscleTransformer.js'

// Configure logging
logger.info('Starting Basic ZPT Navigation Demo')

let config = null
let validator = null
let normalizer = null
let selector = null
let projector = null
let transformer = null

/**
 * Initialize ZPT pipeline components
 */
async function initializeComponents() {
    logger.info('🔧 Initializing ZPT components...')
    
    // Initialize configuration
    config = new Config()
    await config.initialize()
    
    // Initialize parameter processing
    validator = new ParameterValidator()
    normalizer = new ParameterNormalizer()
    
    // Initialize navigation components
    // Note: In a real implementation, you'd pass actual ragnoCorpus and dependencies
    selector = new CorpuscleSelector(null, {
        enableCaching: true,
        enableMetrics: true
    })
    
    projector = new TiltProjector({
        enableCaching: true
    })
    
    transformer = new CorpuscleTransformer({
        enableCaching: true,
        enableMetrics: true
    })
    
    logger.info('✅ ZPT components initialized')
}

/**
 * Demonstrate basic parameter validation and normalization
 */
async function demonstrateParameterProcessing() {
    logger.info('\n📋 === Parameter Processing Demo ===')
    
    // Example 1: Basic valid parameters
    logger.info('\n1. Basic Valid Parameters:')
    const basicParams = {
        zoom: 'unit',
        tilt: 'keywords',
        transform: {
            maxTokens: 4000,
            format: 'structured'
        }
    }
    
    logger.info('Input parameters:', basicParams)
    
    // Validate parameters
    const validationResult = validator.validate(basicParams)
    logger.info('Validation result:', {
        valid: validationResult.valid,
        errors: validationResult.errors?.length || 0,
        warnings: validationResult.warnings?.length || 0
    })
    
    if (validationResult.valid) {
        // Normalize parameters
        const normalizedParams = normalizer.normalize(basicParams)
        logger.info('Normalized parameters:', {
            zoom: normalizedParams.zoom,
            pan: normalizedParams.pan,
            tilt: normalizedParams.tilt,
            transform: normalizedParams.transform
        })
        logger.info('Parameter hash:', normalizedParams.metadata.parameterHash)
    }
    
    // Example 2: Invalid parameters (shows error handling)
    logger.info('\n2. Invalid Parameters Example:')
    const invalidParams = {
        zoom: 'invalid-level',  // Invalid zoom level
        tilt: 'unknown-tilt',   // Invalid tilt representation
        transform: {
            maxTokens: -100     // Invalid token limit
        }
    }
    
    logger.info('Input parameters:', invalidParams)
    const invalidResult = validator.validate(invalidParams)
    logger.info('Validation result:', {
        valid: invalidResult.valid,
        errors: invalidResult.errors?.map(e => e.message) || [],
        warnings: invalidResult.warnings?.map(w => w.message) || []
    })
    
    // Example 3: Parameters with defaults applied
    logger.info('\n3. Parameters with Defaults:')
    const minimalParams = { zoom: 'entity' }
    logger.info('Input parameters:', minimalParams)
    
    const minimalValidation = validator.validate(minimalParams)
    if (minimalValidation.valid) {
        const normalizedMinimal = normalizer.normalize(minimalParams)
        logger.info('Normalized with defaults:', {
            zoom: normalizedMinimal.zoom,
            tilt: normalizedMinimal.tilt,
            transform: normalizedMinimal.transform
        })
    }
}

/**
 * Demonstrate different zoom levels and their effects
 */
async function demonstrateZoomLevels() {
    logger.info('\n🔍 === Zoom Level Demonstrations ===')
    
    const zoomLevels = ['entity', 'unit', 'text', 'community', 'corpus']
    
    for (const zoomLevel of zoomLevels) {
        logger.info(`\n${zoomLevel.toUpperCase()} Level Navigation:`)
        
        const params = {
            zoom: zoomLevel,
            tilt: 'keywords',
            transform: { maxTokens: 2000, format: 'json' }
        }
        
        // Validate and normalize
        const validationResult = validator.validate(params)
        if (!validationResult.valid) {
            logger.error('Validation failed:', validationResult.errors)
            continue
        }
        
        const normalizedParams = normalizer.normalize(params)
        logger.info(`Parameters for ${zoomLevel}:`, {
            zoom: normalizedParams.zoom,
            expectedScope: getZoomScopeDescription(zoomLevel),
            tilt: normalizedParams.tilt,
            estimatedComplexity: estimateZoomComplexity(zoomLevel)
        })
        
        // Note: In a real implementation, you would call:
        // const selectionResult = await selector.select(normalizedParams)
        // For demo purposes, we'll simulate the result
        const simulatedResult = simulateSelectionResult(zoomLevel)
        logger.info(`Simulated selection result:`, simulatedResult)
    }
}

/**
 * Demonstrate different tilt representations
 */
async function demonstrateTiltProjections() {
    logger.info('\n🎯 === Tilt Projection Demonstrations ===')
    
    const tiltTypes = ['keywords', 'embedding', 'graph', 'temporal']
    const baseParams = {
        zoom: 'unit',
        transform: { maxTokens: 3000, format: 'structured' }
    }
    
    for (const tiltType of tiltTypes) {
        logger.info(`\n${tiltType.toUpperCase()} Projection:`)
        
        const params = { ...baseParams, tilt: tiltType }
        const normalizedParams = normalizer.normalize(params)
        
        logger.info(`Tilt configuration:`, {
            representation: tiltType,
            description: getTiltDescription(tiltType),
            outputFormat: getExpectedTiltOutput(tiltType)
        })
        
        // Simulate projection result
        const projectionResult = simulateProjectionResult(tiltType)
        logger.info(`Simulated projection:`, projectionResult)
    }
}

/**
 * Demonstrate different output formats and transformations
 */
async function demonstrateTransformations() {
    logger.info('\n🔄 === Transformation Format Demonstrations ===')
    
    const formats = ['json', 'markdown', 'structured', 'conversational']
    const baseParams = {
        zoom: 'unit',
        tilt: 'keywords'
    }
    
    for (const format of formats) {
        logger.info(`\n${format.toUpperCase()} Format:`)
        
        const params = {
            ...baseParams,
            transform: {
                maxTokens: 4000,
                format: format,
                includeMetadata: true,
                chunkStrategy: 'semantic'
            }
        }
        
        const normalizedParams = normalizer.normalize(params)
        logger.info(`Transform configuration:`, {
            format: format,
            maxTokens: normalizedParams.transform.maxTokens,
            chunkStrategy: normalizedParams.transform.chunkStrategy,
            includeMetadata: normalizedParams.transform.includeMetadata
        })
        
        // Simulate transformation result
        const transformResult = simulateTransformationResult(format)
        logger.info(`Simulated output:`, transformResult)
    }
}

/**
 * Demonstrate complete end-to-end navigation pipeline
 */
async function demonstrateFullPipeline() {
    logger.info('\n🚀 === Full Pipeline Demo ===')
    
    const navigationRequest = {
        zoom: 'entity',
        pan: {
            topic: 'artificial-intelligence'
        },
        tilt: 'embedding',
        transform: {
            maxTokens: 6000,
            format: 'markdown',
            tokenizer: 'cl100k_base',
            chunkStrategy: 'adaptive',
            includeMetadata: true
        }
    }
    
    logger.info('Full navigation request:', navigationRequest)
    
    // Step 1: Validation
    logger.info('\n🔍 Step 1: Parameter Validation')
    const validationResult = validator.validate(navigationRequest)
    logger.info('Validation:', {
        valid: validationResult.valid,
        processedFields: Object.keys(navigationRequest).length
    })
    
    if (!validationResult.valid) {
        logger.error('Pipeline stopped due to validation errors')
        return
    }
    
    // Step 2: Normalization
    logger.info('\n🔧 Step 2: Parameter Normalization')
    const normalizedParams = normalizer.normalize(navigationRequest)
    logger.info('Normalization complete:', {
        parameterHash: normalizedParams.metadata.parameterHash,
        defaultsApplied: normalizedParams.metadata.defaultsApplied,
        complexity: normalizedParams.metadata.complexity
    })
    
    // Step 3: Selection (simulated)
    logger.info('\n🎯 Step 3: Corpuscle Selection')
    const selectionResult = simulateFullSelectionResult(normalizedParams)
    logger.info('Selection result:', selectionResult)
    
    // Step 4: Projection (simulated)
    logger.info('\n📊 Step 4: Tilt Projection')
    const projectionResult = simulateFullProjectionResult(selectionResult, normalizedParams.tilt)
    logger.info('Projection result:', projectionResult)
    
    // Step 5: Transformation (simulated)
    logger.info('\n✨ Step 5: Content Transformation')
    const transformResult = simulateFullTransformationResult(projectionResult, normalizedParams.transform)
    logger.info('Transformation result:', transformResult)
    
    logger.info('\n✅ Full pipeline completed successfully!')
    logger.info('Final output ready for LLM consumption')
}

/**
 * Helper functions for simulation and descriptions
 */
function getZoomScopeDescription(zoomLevel) {
    const descriptions = {
        entity: 'Individual entities and concepts',
        unit: 'Semantic units and meaningful segments', 
        text: 'Full text elements and documents',
        community: 'Thematic communities and clusters',
        corpus: 'Entire corpus overview and metadata'
    }
    return descriptions[zoomLevel] || 'Unknown scope'
}

function estimateZoomComplexity(zoomLevel) {
    const complexity = {
        entity: 'Low (focused, specific)',
        unit: 'Medium (contextual)',
        text: 'High (comprehensive)',
        community: 'Medium (aggregated)',
        corpus: 'Very High (complete overview)'
    }
    return complexity[zoomLevel] || 'Unknown'
}

function getTiltDescription(tiltType) {
    const descriptions = {
        keywords: 'Extract key terms and concepts',
        embedding: 'Generate vector representations',
        graph: 'Analyze relationships and structure',
        temporal: 'Sequence events chronologically'
    }
    return descriptions[tiltType] || 'Unknown projection'
}

function getExpectedTiltOutput(tiltType) {
    const outputs = {
        keywords: 'Array of weighted terms',
        embedding: 'Vector arrays and similarity scores',
        graph: 'Node-edge relationship data',
        temporal: 'Chronologically ordered events'
    }
    return outputs[tiltType] || 'Unknown output'
}

function simulateSelectionResult(zoomLevel) {
    return {
        corpuscleCount: Math.floor(Math.random() * 50) + 10,
        processingTime: Math.floor(Math.random() * 500) + 100,
        scope: getZoomScopeDescription(zoomLevel),
        fromCache: Math.random() > 0.7
    }
}

function simulateProjectionResult(tiltType) {
    return {
        representation: tiltType,
        dataSize: Math.floor(Math.random() * 1000) + 200,
        processingTime: Math.floor(Math.random() * 300) + 50,
        format: getExpectedTiltOutput(tiltType)
    }
}

function simulateTransformationResult(format) {
    return {
        outputFormat: format,
        tokenCount: Math.floor(Math.random() * 2000) + 500,
        chunkCount: Math.floor(Math.random() * 5) + 1,
        processingTime: Math.floor(Math.random() * 200) + 30
    }
}

function simulateFullSelectionResult(params) {
    return {
        corpuscles: Array(15).fill(null).map((_, i) => ({
            id: `corpuscle_${i}`,
            type: params.zoom.level || params.zoom,
            score: Math.random()
        })),
        metadata: {
            selectionTime: 245,
            fromCache: false,
            complexity: 6.5,
            resultCount: 15
        }
    }
}

function simulateFullProjectionResult(selectionResult, tilt) {
    return {
        representation: tilt.representation || tilt,
        projectedData: {
            format: getExpectedTiltOutput(tilt.representation || tilt),
            size: 1250,
            quality: 0.85
        },
        metadata: {
            processingTime: 180,
            algorithm: tilt.representation || tilt,
            corpuscleCount: selectionResult.corpuscles.length
        }
    }
}

function simulateFullTransformationResult(projectionResult, transform) {
    return {
        content: {
            format: transform.format,
            chunks: 3,
            totalTokens: 4250,
            hasMetadata: transform.includeMetadata
        },
        metadata: {
            output: {
                format: transform.format,
                chunked: true,
                hasMetadata: transform.includeMetadata
            },
            processingTime: 320,
            tokenizer: transform.tokenizer,
            chunkStrategy: transform.chunkStrategy
        }
    }
}

/**
 * Main execution function
 */
async function runBasicNavigationDemo() {
    try {
        await initializeComponents()
        await demonstrateParameterProcessing()
        await demonstrateZoomLevels()
        await demonstrateTiltProjections()
        await demonstrateTransformations()
        await demonstrateFullPipeline()
        
        logger.info('\n🎉 Basic ZPT Navigation Demo completed successfully!')
        logger.info('This demo showed the fundamental concepts of ZPT navigation:')
        logger.info('- Parameter validation and normalization')
        logger.info('- Different zoom levels and their scope')
        logger.info('- Various tilt projections and representations')
        logger.info('- Multiple output formats and transformations')
        logger.info('- Complete end-to-end pipeline execution')
        
    } catch (error) {
        logger.error('Demo failed:', error.message)
        logger.error('Stack:', error.stack)
    } finally {
        // Cleanup
        if (config) {
            await config.dispose()
        }
        logger.info('🧹 Cleanup completed')
    }
}

// Execute the demo
runBasicNavigationDemo()