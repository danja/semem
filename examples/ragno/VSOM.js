/**
 * VSOM.js - Vectorized Self-Organizing Map Algorithm Demo
 * 
 * This example demonstrates the complete VSOM implementation for entity clustering
 * in Ragno knowledge graphs. It showcases all major features including entity
 * loading, training, clustering, RDF export, and visualization.
 * 
 * Key Features Demonstrated:
 * 1. **Entity Clustering**: Primary use case - clustering entities based on embeddings
 * 2. **Multiple Topologies**: Rectangular and hexagonal map layouts
 * 3. **RDF Integration**: Export clusters with ragno:cluster properties
 * 4. **Training Monitoring**: Real-time training progress and convergence
 * 5. **Visualization Export**: Coordinate generation for map visualization
 * 6. **Algorithm Integration**: Working with Hyde and other Ragno algorithms
 * 
 * Use Cases:
 * - Clustering similar entities for knowledge discovery
 * - Creating semantic neighborhoods in knowledge graphs
 * - Visualizing entity relationships in 2D space
 * - Organizing large collections of extracted concepts
 * 
 * Prerequisites:
 * - Ollama running with nomic-embed-text model for embeddings
 * - qwen2:1.5b model for text processing (optional)
 * - Ragno infrastructure (entities, RDF-Ext, algorithms)
 */

import logger from 'loglevel'
import rdf from 'rdf-ext'
import LLMHandler from '../../src/handlers/LLMHandler.js'
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js'
import OllamaConnector from '../../src/connectors/OllamaConnector.js'
import VSOM from '../../src/ragno/algorithms/VSOM.js'
import Entity from '../../src/ragno/Entity.js'
import NamespaceManager from '../../src/ragno/core/NamespaceManager.js'

// Configure logging
logger.setLevel('info')

/**
 * Demo configuration
 */
const CONFIG = {
    ollama: {
        baseURL: 'http://localhost:11434',
        model: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text'
    },
    vsom: {
        // Map configuration
        mapSize: [15, 15],              // 15x15 grid
        topology: 'rectangular',        // 'rectangular' or 'hexagonal'
        boundaryCondition: 'bounded',   // 'bounded' or 'toroidal'
        
        // Algorithm parameters
        embeddingDimension: 1536,       // nomic-embed-text dimension
        distanceMetric: 'cosine',       // 'cosine', 'euclidean', 'manhattan'
        
        // Training parameters
        maxIterations: 500,
        initialLearningRate: 0.1,
        finalLearningRate: 0.01,
        initialRadius: 7.0,             // Start with large neighborhood
        finalRadius: 0.5,               // End with small neighborhood
        
        // Clustering
        clusterThreshold: 0.75,         // Similarity threshold for clustering
        minClusterSize: 2,              // Minimum entities per cluster
        
        // Performance
        batchSize: 50,
        logProgress: true
    },
    demo: {
        runEntityClustering: true,
        runTopologyComparison: true,
        runVisualizationExport: true,
        runRDFIntegration: true,
        runAlgorithmIntegration: false, // Requires additional setup
        showDetailedProgress: true
    }
}

/**
 * Sample entities for clustering demonstration
 */
function createSampleEntities() {
    const namespaces = new NamespaceManager()
    
    return [
        // AI and Machine Learning cluster
        new Entity({
            uri: namespaces.ex('entity_ai_1').value,
            name: 'Artificial Intelligence',
            content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to natural intelligence displayed by humans and animals.',
            subType: 'concept',
            metadata: { category: 'ai', importance: 0.9 }
        }),
        new Entity({
            uri: namespaces.ex('entity_ml_1').value,
            name: 'Machine Learning',
            content: 'Machine learning (ML) is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.',
            subType: 'concept',
            metadata: { category: 'ai', importance: 0.8 }
        }),
        new Entity({
            uri: namespaces.ex('entity_dl_1').value,
            name: 'Deep Learning',
            content: 'Deep learning is a subset of machine learning based on artificial neural networks with multiple layers.',
            subType: 'concept',
            metadata: { category: 'ai', importance: 0.7 }
        }),
        new Entity({
            uri: namespaces.ex('entity_nn_1').value,
            name: 'Neural Networks',
            content: 'Neural networks are computing systems inspired by biological neural networks that constitute animal brains.',
            subType: 'concept',
            metadata: { category: 'ai', importance: 0.6 }
        }),
        
        // Climate and Environment cluster
        new Entity({
            uri: namespaces.ex('entity_climate_1').value,
            name: 'Climate Change',
            content: 'Climate change refers to long-term shifts in global temperatures and weather patterns due to human activities.',
            subType: 'concept',
            metadata: { category: 'environment', importance: 0.9 }
        }),
        new Entity({
            uri: namespaces.ex('entity_renewable_1').value,
            name: 'Renewable Energy',
            content: 'Renewable energy comes from natural sources that are constantly replenished, such as solar, wind, and hydroelectric power.',
            subType: 'concept',
            metadata: { category: 'environment', importance: 0.8 }
        }),
        new Entity({
            uri: namespaces.ex('entity_carbon_1').value,
            name: 'Carbon Footprint',
            content: 'A carbon footprint is the total amount of greenhouse gases produced directly and indirectly by human activities.',
            subType: 'concept',
            metadata: { category: 'environment', importance: 0.7 }
        }),
        new Entity({
            uri: namespaces.ex('entity_sustainability_1').value,
            name: 'Sustainability',
            content: 'Sustainability involves meeting present needs without compromising the ability of future generations to meet their own needs.',
            subType: 'concept',
            metadata: { category: 'environment', importance: 0.8 }
        }),
        
        // Technology and Computing cluster
        new Entity({
            uri: namespaces.ex('entity_blockchain_1').value,
            name: 'Blockchain Technology',
            content: 'Blockchain is a distributed ledger technology that maintains a growing list of records linked using cryptography.',
            subType: 'concept',
            metadata: { category: 'technology', importance: 0.7 }
        }),
        new Entity({
            uri: namespaces.ex('entity_quantum_1').value,
            name: 'Quantum Computing',
            content: 'Quantum computing uses quantum mechanical phenomena to perform operations on data in ways impossible for classical computers.',
            subType: 'concept',
            metadata: { category: 'technology', importance: 0.8 }
        }),
        new Entity({
            uri: namespaces.ex('entity_iot_1').value,
            name: 'Internet of Things',
            content: 'The Internet of Things (IoT) describes the network of physical objects embedded with sensors and software to connect and exchange data.',
            subType: 'concept',
            metadata: { category: 'technology', importance: 0.6 }
        }),
        new Entity({
            uri: namespaces.ex('entity_cybersecurity_1').value,
            name: 'Cybersecurity',
            content: 'Cybersecurity is the practice of protecting systems, networks, and data from digital attacks and unauthorized access.',
            subType: 'concept',
            metadata: { category: 'technology', importance: 0.7 }
        }),
        
        // Health and Medicine cluster
        new Entity({
            uri: namespaces.ex('entity_precision_1').value,
            name: 'Precision Medicine',
            content: 'Precision medicine tailors medical treatment to individual characteristics, needs, and preferences of each patient.',
            subType: 'concept',
            metadata: { category: 'health', importance: 0.8 }
        }),
        new Entity({
            uri: namespaces.ex('entity_genomics_1').value,
            name: 'Genomics',
            content: 'Genomics is the study of an organism\'s complete set of DNA and how genes interact with each other and the environment.',
            subType: 'concept',
            metadata: { category: 'health', importance: 0.7 }
        }),
        new Entity({
            uri: namespaces.ex('entity_telemedicine_1').value,
            name: 'Telemedicine',
            content: 'Telemedicine uses technology to provide healthcare services remotely, improving access to medical care.',
            subType: 'concept',
            metadata: { category: 'health', importance: 0.6 }
        }),
        
        // Economics and Finance cluster
        new Entity({
            uri: namespaces.ex('entity_fintech_1').value,
            name: 'Financial Technology',
            content: 'FinTech refers to new technology that seeks to improve and automate the delivery and use of financial services.',
            subType: 'concept',
            metadata: { category: 'finance', importance: 0.7 }
        }),
        new Entity({
            uri: namespaces.ex('entity_crypto_1').value,
            name: 'Cryptocurrency',
            content: 'Cryptocurrency is a digital currency secured by cryptography, making it nearly impossible to counterfeit.',
            subType: 'concept',
            metadata: { category: 'finance', importance: 0.6 }
        }),
        new Entity({
            uri: namespaces.ex('entity_defi_1').value,
            name: 'Decentralized Finance',
            content: 'DeFi refers to financial applications built on blockchain networks that operate without traditional intermediaries.',
            subType: 'concept',
            metadata: { category: 'finance', importance: 0.5 }
        })
    ]
}

/**
 * Main demo function
 */
async function runVSOMDemo() {
    logger.info('🗺️  Starting VSOM Algorithm Demo')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    let ollamaConnector = null
    
    try {
        // Step 1: Initialize components
        logger.info('📋 Step 1: Initializing components...')
        
        ollamaConnector = new OllamaConnector(CONFIG.ollama.baseURL, CONFIG.ollama.model)
        await ollamaConnector.initialize()
        
        const embeddingProvider = {
            generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector)
        }
        
        const cacheManager = { 
            get: () => undefined, 
            set: () => {},
            has: () => false,
            delete: () => false,
            clear: () => {}
        }
        
        const embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            CONFIG.ollama.embeddingModel,
            CONFIG.vsom.embeddingDimension,
            cacheManager
        )
        
        logger.info('✅ Components initialized successfully')
        
        // Step 2: Entity Clustering Demo
        if (CONFIG.demo.runEntityClustering) {
            logger.info('\\n🎯 Step 2: Entity Clustering Demo...')
            await demonstrateEntityClustering(embeddingHandler)
        }
        
        // Step 3: Topology Comparison
        if (CONFIG.demo.runTopologyComparison) {
            logger.info('\\n📐 Step 3: Topology Comparison Demo...')
            await demonstrateTopologyComparison(embeddingHandler)
        }
        
        // Step 4: Visualization Export
        if (CONFIG.demo.runVisualizationExport) {
            logger.info('\\n🎨 Step 4: Visualization Export Demo...')
            await demonstrateVisualizationExport(embeddingHandler)
        }
        
        // Step 5: RDF Integration
        if (CONFIG.demo.runRDFIntegration) {
            logger.info('\\n🔗 Step 5: RDF Integration Demo...')
            await demonstrateRDFIntegration(embeddingHandler)
        }
        
        // Step 6: Algorithm Integration (optional)
        if (CONFIG.demo.runAlgorithmIntegration) {
            logger.info('\\n🔧 Step 6: Algorithm Integration Demo...')
            await demonstrateAlgorithmIntegration(embeddingHandler)
        }
        
        logger.info('\\n🎉 VSOM Demo completed successfully!')
        
    } catch (error) {
        logger.error('💥 Demo failed:', error)
        throw error
    } finally {
        if (ollamaConnector) {
            logger.info('🧹 Cleaning up Ollama connector...')
        }
    }
}

/**
 * Demonstrate basic entity clustering
 */
async function demonstrateEntityClustering(embeddingHandler) {
    logger.info('   🎯 Basic Entity Clustering...')
    
    // Create VSOM instance
    const vsom = new VSOM(CONFIG.vsom)
    
    // Load sample entities
    const entities = createSampleEntities()
    logger.info(`   📚 Loading ${entities.length} entities...`)
    
    const loadResults = await vsom.loadFromEntities(entities, embeddingHandler)
    logger.info(`   ✅ Loaded ${loadResults.entitiesLoaded} entities in ${loadResults.loadTime}ms`)
    
    // Train the VSOM
    logger.info('   🎓 Training VSOM...')
    const trainingResults = await vsom.train({
        onIteration: CONFIG.demo.showDetailedProgress ? (iteration, results) => {
            if (iteration % 50 === 0) {
                logger.info(`      Iteration ${iteration}: QE=${results.quantizationError.toFixed(6)}`)
            }
        } : undefined
    })
    
    logger.info(`   ✅ Training completed: ${trainingResults.totalIterations} iterations, ` +
               `${trainingResults.trainingTime}ms, ` +
               `QE=${trainingResults.finalQuantizationError?.toFixed(6) || 'N/A'}`)
    
    // Generate clusters
    const clusters = vsom.getClusters()
    logger.info(`   🎯 Generated ${clusters.length} clusters`)
    
    // Display cluster information
    displayClusterSummary(clusters, vsom.getNodeMappings(), entities)
    
    // Get statistics
    const stats = vsom.getStatistics()
    logger.info(`   📊 Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`)
    
    return { vsom, trainingResults, clusters }
}

/**
 * Demonstrate different topologies
 */
async function demonstrateTopologyComparison(embeddingHandler) {
    logger.info('   📐 Comparing Rectangular vs Hexagonal Topologies...')
    
    const entities = createSampleEntities().slice(0, 10) // Use subset for speed
    const topologies = ['rectangular', 'hexagonal']
    const results = {}
    
    for (const topology of topologies) {
        logger.info(`   🔧 Testing ${topology} topology...`)
        
        const vsom = new VSOM({
            ...CONFIG.vsom,
            topology: topology,
            mapSize: [10, 10],
            maxIterations: 200,
            logProgress: false
        })
        
        await vsom.loadFromEntities(entities, embeddingHandler)
        const trainingResults = await vsom.train()
        const clusters = vsom.getClusters()
        
        results[topology] = {
            clusters: clusters.length,
            finalError: trainingResults.finalQuantizationError,
            trainingTime: trainingResults.trainingTime,
            converged: trainingResults.converged
        }
        
        logger.info(`      ${topology}: ${clusters.length} clusters, ` +
                   `QE=${trainingResults.finalQuantizationError?.toFixed(6) || 'N/A'}, ` +
                   `${trainingResults.trainingTime}ms`)
    }
    
    // Compare results
    logger.info(`   📊 Topology Comparison:`)
    for (const [topology, result] of Object.entries(results)) {
        logger.info(`      ${topology}: ${result.clusters} clusters, ` +
                   `error=${result.finalError?.toFixed(6) || 'N/A'}, ` +
                   `time=${result.trainingTime}ms, ` +
                   `converged=${result.converged}`)
    }
    
    return results
}

/**
 * Demonstrate visualization export capabilities
 */
async function demonstrateVisualizationExport(embeddingHandler) {
    logger.info('   🎨 Visualization Export Demo...')
    
    const vsom = new VSOM({
        ...CONFIG.vsom,
        topology: 'hexagonal',
        mapSize: [8, 8],
        maxIterations: 150,
        logProgress: false
    })
    
    const entities = createSampleEntities().slice(0, 12)
    await vsom.loadFromEntities(entities, embeddingHandler)
    await vsom.train()
    
    // Export different visualization formats
    const formats = ['coordinates', 'json']
    
    for (const format of formats) {
        const vizData = vsom.exportVisualization(format)
        
        if (format === 'coordinates') {
            logger.info(`   📊 Generated ${vizData.length} visualization coordinates`)
            
            // Show sample coordinate
            const sample = vizData.find(coord => coord.entity !== null)
            if (sample) {
                logger.info(`      Sample: Node ${sample.nodeIndex} at (${sample.visualCoords[0].toFixed(2)}, ${sample.visualCoords[1].toFixed(2)})`)
                logger.info(`              Entity: ${sample.entity.content.substring(0, 50)}...`)
            }
        } else if (format === 'json') {
            logger.info(`   📄 JSON export: ${vizData.length} characters`)
        }
    }
    
    // Get topology information
    const topology = vsom.getTopology()
    logger.info(`   🗺️  Map topology: ${topology.topology} ${topology.mapSize[0]}x${topology.mapSize[1]}`)
    
    return vsom
}

/**
 * Demonstrate RDF integration
 */
async function demonstrateRDFIntegration(embeddingHandler) {
    logger.info('   🔗 RDF Integration Demo...')
    
    const vsom = new VSOM({
        ...CONFIG.vsom,
        mapSize: [6, 6],
        maxIterations: 100,
        logProgress: false
    })
    
    const entities = createSampleEntities().slice(0, 8)
    await vsom.loadFromEntities(entities, embeddingHandler)
    await vsom.train()
    
    const clusters = vsom.getClusters()
    
    // Create RDF dataset and export results
    const dataset = rdf.dataset()
    const triplesAdded = vsom.exportToRDF(dataset)
    
    logger.info(`   ✅ Exported ${triplesAdded} RDF triples`)
    logger.info(`   📊 Dataset now contains ${dataset.size} total triples`)
    
    // Analyze RDF content
    const namespaces = new NamespaceManager()
    analyzeRDFContent(dataset, namespaces)
    
    return { dataset, triplesAdded }
}

/**
 * Demonstrate integration with other algorithms
 */
async function demonstrateAlgorithmIntegration(embeddingHandler) {
    logger.info('   🔧 Algorithm Integration Demo...')
    
    // This would demonstrate integration with Hyde and GraphAnalytics
    // For now, show the structure
    
    logger.info('   📝 Integration capabilities:')
    logger.info('      • Hyde integration: Cluster hypothetical vs factual entities')
    logger.info('      • GraphAnalytics integration: Weight clusters by centrality')
    logger.info('      • Search integration: Use clusters to improve retrieval')
    logger.info('      • Visualization: Export clusters for graph layout')
    
    return { status: 'demo_structure_shown' }
}

/**
 * Display cluster summary information
 */
function displayClusterSummary(clusters, nodeMappings, entities) {
    logger.info(`   📋 Cluster Summary:`)
    
    // Group entities by cluster
    const entityClusters = new Map()
    
    for (let i = 0; i < entities.length; i++) {
        const mapping = nodeMappings[i]
        const clusterIndex = findEntityCluster(mapping.nodeIndex, clusters)
        
        if (clusterIndex !== -1) {
            if (!entityClusters.has(clusterIndex)) {
                entityClusters.set(clusterIndex, [])
            }
            entityClusters.get(clusterIndex).push({
                entity: entities[i],
                distance: mapping.distance
            })
        }
    }
    
    // Display clusters
    for (const [clusterIndex, clusterEntities] of entityClusters.entries()) {
        const cluster = clusters[clusterIndex]
        logger.info(`      Cluster ${clusterIndex}: ${clusterEntities.length} entities`)
        
        // Show entity names and categories
        const categories = new Set()
        clusterEntities.forEach(item => {
            const category = item.entity.metadata?.category || 'unknown'
            categories.add(category)
        })
        
        logger.info(`        Categories: ${Array.from(categories).join(', ')}`)
        logger.info(`        Entities: ${clusterEntities.map(item => item.entity.getPrefLabel()).join(', ')}`)
        
        const avgDistance = clusterEntities.reduce((sum, item) => sum + item.distance, 0) / clusterEntities.length
        logger.info(`        Avg BMU distance: ${avgDistance.toFixed(4)}`)
    }
}

/**
 * Find which cluster a node belongs to
 */
function findEntityCluster(nodeIndex, clusters) {
    for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].members.includes(nodeIndex)) {
            return i
        }
    }
    return -1
}

/**
 * Analyze RDF content
 */
function analyzeRDFContent(dataset, namespaces) {
    const stats = {
        clusters: 0,
        entities: 0,
        clusterAssignments: 0,
        mapPositions: 0
    }
    
    // Count different types of triples
    for (const quad of dataset) {
        const predicate = quad.predicate.value
        
        if (predicate === namespaces.rdf('type').value) {
            if (quad.object.value === namespaces.ragno('Cluster').value) {
                stats.clusters++
            }
        } else if (predicate === namespaces.ragno('cluster').value) {
            stats.clusterAssignments++
        } else if (predicate === namespaces.ragno('mapPosition').value) {
            stats.mapPositions++
        }
    }
    
    logger.info(`   📊 RDF Content Analysis:`)
    logger.info(`      • Clusters: ${stats.clusters}`)
    logger.info(`      • Cluster assignments: ${stats.clusterAssignments}`)
    logger.info(`      • Map positions: ${stats.mapPositions}`)
}

/**
 * Error handling wrapper
 */
async function main() {
    try {
        await runVSOMDemo()
    } catch (error) {
        logger.error('💥 VSOM Demo failed with error:', error)
        process.exit(1)
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
}

export { runVSOMDemo, CONFIG, createSampleEntities }