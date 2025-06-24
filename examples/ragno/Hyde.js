/**
 * Hyde.js - HyDE (Hypothetical Document Embeddings) Algorithm Demo
 * 
 * This example demonstrates the HyDE algorithm implementation for Ragno knowledge graphs.
 * HyDE enhances retrieval by generating hypothetical answers using LLMs, then using these
 * synthetic documents to improve semantic search and knowledge graph augmentation.
 * 
 * Key Features Demonstrated:
 * 1. **Hypothesis Generation**: Using LLM to create hypothetical answers for queries
 * 2. **RDF Integration**: Adding hypotheses to knowledge graph with ragno:maybe property
 * 3. **Entity Extraction**: Extracting entities from generated hypothetical content
 * 4. **Graph Augmentation**: Creating relationships between queries, hypotheses, and entities
 * 5. **Uncertainty Modeling**: Using ragno:maybe to mark hypothetical vs. factual content
 * 
 * Use Cases:
 * - Improving search with vague or poorly phrased queries
 * - Augmenting sparse knowledge graphs with hypothetical content
 * - Creating training data for retrieval systems
 * - Exploring potential knowledge graph connections
 * 
 * Prerequisites:
 * - Ollama running with qwen2:1.5b model for text generation
 * - nomic-embed-text model for embeddings (optional for full pipeline)
 * - Ragno infrastructure (entities, semantic units, RDF-Ext)
 */

import logger from 'loglevel'
import rdf from 'rdf-ext'
import Config from '../../src/Config.js'
import MemoryManager from '../../src/MemoryManager.js'
import InMemoryStore from '../../src/stores/InMemoryStore.js'
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js'
import { ClientFactory } from 'hyperdata-clients'
import Hyde from '../../src/ragno/algorithms/Hyde.js'
import NamespaceManager from '../../src/ragno/core/NamespaceManager.js'
// Note: RDF export functionality would use existing utilities

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
    hyde: {
        hypothesesPerQuery: 3,
        temperature: 0.7,
        maxTokens: 400,
        extractEntities: true,
        maxEntitiesPerHypothesis: 8,
        confidenceThreshold: 0.4
    },
    demo: {
        queries: [
            "What are the benefits of renewable energy?",
            //     "How does machine learning work?",
            "What is the impact of climate change on biodiversity?"
            //   "How can artificial intelligence improve healthcare?",
            // "What are the challenges of quantum computing?"
        ],
        showRDFOutput: true,
        exportToTurtle: true
    }
}

/**
 * Main demo function
 */
async function runHydeDemo() {
    logger.info('🔬 Starting HyDE Algorithm Demo')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let memoryManager = null

    try {
        // Step 1: Initialize components
        logger.info('📋 Step 1: Initializing components...')

        // Initialize config system
        const config = new Config('config/config.json')
        await config.init()

        // Get LLM providers from config
        const llmProviders = config.get('llmProviders')
        if (!llmProviders || llmProviders.length === 0) {
            throw new Error('No LLM providers configured. Please check your config.')
        }

        // Find the first chat provider
        const chatProviderConfig = llmProviders.find(p => p.capabilities?.includes('chat'))
        if (!chatProviderConfig) {
            throw new Error('No chat provider found in config')
        }

        logger.info(`Using chat provider: ${chatProviderConfig.type} with model: ${chatProviderConfig.chatModel}`)

        // Create chat provider as configured
        const chatProvider = await ClientFactory.createClient(chatProviderConfig.type, {
            model: chatProviderConfig.chatModel,
            baseUrl: chatProviderConfig.baseUrl,
            apiKey: chatProviderConfig.apiKey
        })

        // Create embedding provider using EmbeddingConnectorFactory (compatible with MemoryManager)
        const embeddingProvider = config.get('embeddingProvider') || 'ollama'
        const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text'

        let embeddingProviderConfig = {}
        if (embeddingProvider === 'nomic') {
            embeddingProviderConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: embeddingModel
            }
        } else if (embeddingProvider === 'ollama') {
            embeddingProviderConfig = {
                provider: 'ollama',
                baseUrl: 'http://localhost:11434',
                model: embeddingModel
            }
        }

        const embeddingConnector = EmbeddingConnectorFactory.createConnector(embeddingProviderConfig)

        logger.info(`Using embedding provider: ${embeddingProvider} with model: ${embeddingModel}`)

        // Create memory manager with providers from config
        const storage = new InMemoryStore()
        memoryManager = new MemoryManager({
            llmProvider: chatProvider,
            embeddingProvider: embeddingConnector,
            chatModel: chatProviderConfig.chatModel,
            embeddingModel: embeddingModel,
            storage
        })

        // Get LLM handler from memory manager
        const llmHandler = memoryManager.llmHandler

        const hydeOptions = {
            ...CONFIG.hyde,
            model: chatProviderConfig.chatModel // Get model from config
        }
        const hyde = new Hyde(hydeOptions)
        const namespaces = new NamespaceManager()
        const dataset = rdf.dataset()

        logger.info('✅ Components initialized successfully')

        // Step 2: Generate hypotheses for each query
        logger.info('\\n🧠 Step 2: Generating hypotheses...')

        const allResults = []

        for (let i = 0; i < CONFIG.demo.queries.length; i++) {
            const query = CONFIG.demo.queries[i]
            logger.info(`\\n📝 Processing Query ${i + 1}: "${query}"`)

            try {
                const results = await hyde.generateHypotheses(
                    query,
                    llmHandler,
                    dataset,
                    hydeOptions
                )

                allResults.push({ query, results })

                // Display results for this query
                displayQueryResults(query, results, i + 1)

            } catch (error) {
                logger.error(`❌ Failed to process query "${query}": ${error.message}`)
            }
        }

        // Step 3: Analyze the complete dataset
        logger.info('\\n📊 Step 3: Analyzing complete dataset...')
        analyzeDataset(dataset, namespaces)

        // Step 4: Query hypothetical content
        logger.info('\\n🔍 Step 4: Querying hypothetical content...')
        demonstrateHypotheticalQueries(hyde, dataset)

        // Step 5: Export results if requested
        if (CONFIG.demo.exportToTurtle) {
            logger.info('\\n💾 Step 5: Exporting to RDF formats...')
            await exportResults(dataset, namespaces)
        }

        // Step 6: Display statistics
        logger.info('\\n📈 Step 6: Algorithm statistics...')
        displayStatistics(hyde, allResults)

        logger.info('\\n🎉 HyDE Demo completed successfully!')

    } catch (error) {
        logger.error('💥 Demo failed:', error)
        throw error
    } finally {
        if (memoryManager) {
            logger.info('🧹 Cleaning up memory manager...')
            await memoryManager.dispose()
        }
    }
}

/**
 * Display results for a single query
 */
function displayQueryResults(query, results, queryNumber) {
    logger.info(`   📊 Query ${queryNumber} Results:`)
    logger.info(`   • Generated ${results.hypotheses.length} hypotheses`)
    logger.info(`   • Extracted ${results.entities.length} entities`)
    logger.info(`   • Created ${results.relationships.length} relationships`)
    logger.info(`   • Added ${results.rdfTriples} RDF triples`)
    logger.info(`   • Processing time: ${results.processingTime}ms`)

    if (results.hypotheses.length > 0) {
        logger.info(`   \\n   💭 Sample Hypothesis:`)
        const sample = results.hypotheses[0]
        const content = sample.getText() || sample.getContent() || ''
        const preview = content.substring(0, 150) + (content.length > 150 ? '...' : '')
        logger.info(`      "${preview}"`)
        const confidence = sample.metadata?.confidence || 'N/A'
        logger.info(`      Confidence: ${typeof confidence === 'number' ? confidence.toFixed(3) : confidence}`)
    }

    if (results.entities.length > 0) {
        logger.info(`   \\n   🏷️  Extracted Entities:`)
        results.entities.slice(0, 5).forEach(entity => {
            const confidence = entity.metadata?.confidence
            const confidenceStr = typeof confidence === 'number' ? confidence.toFixed(3) : 'N/A'
            logger.info(`      • ${entity.getPrefLabel()} (confidence: ${confidenceStr})`)
        })
        if (results.entities.length > 5) {
            logger.info(`      ... and ${results.entities.length - 5} more`)
        }
    }
}

/**
 * Analyze the complete RDF dataset
 */
function analyzeDataset(dataset, namespaces) {
    const stats = {
        totalTriples: dataset.size,
        hypotheticalTriples: 0,
        entities: new Set(),
        hypotheticalEntities: new Set(),
        semanticUnits: new Set(),
        relationships: new Set()
    }

    // Count different types of content
    for (const quad of dataset) {
        const subject = quad.subject.value
        const predicate = quad.predicate.value
        const object = quad.object.value

        // Check for hypothetical markers
        if (predicate === namespaces.ragno('maybe').value && object === 'true') {
            stats.hypotheticalTriples++
        }

        // Categorize subjects
        if (predicate === namespaces.rdf('type').value) {
            if (object === namespaces.ragno('Entity').value) {
                stats.entities.add(subject)
            } else if (object === namespaces.ragno('SemanticUnit').value) {
                stats.semanticUnits.add(subject)
            } else if (object === namespaces.ragno('Relationship').value) {
                stats.relationships.add(subject)
            }
        }

        // Check if entity is hypothetical
        if (stats.entities.has(subject) && predicate === namespaces.ragno('maybe').value && object === 'true') {
            stats.hypotheticalEntities.add(subject)
        }
    }

    logger.info(`   📊 Dataset Analysis:`)
    logger.info(`   • Total RDF triples: ${stats.totalTriples}`)
    logger.info(`   • Hypothetical triples: ${stats.hypotheticalTriples}`)
    logger.info(`   • Total entities: ${stats.entities.size}`)
    logger.info(`   • Hypothetical entities: ${stats.hypotheticalEntities.size}`)
    logger.info(`   • Semantic units: ${stats.semanticUnits.size}`)
    logger.info(`   • Relationships: ${stats.relationships.size}`)

    const hypotheticalRatio = stats.totalTriples > 0 ? (stats.hypotheticalTriples / stats.totalTriples * 100).toFixed(1) : 0
    logger.info(`   • Hypothetical content ratio: ${hypotheticalRatio}%`)
}

/**
 * Demonstrate querying hypothetical content
 */
function demonstrateHypotheticalQueries(hyde, dataset) {
    logger.info(`   🔍 Querying hypothetical content...`)

    // Query all hypothetical content
    const allHypothetical = hyde.queryHypotheticalContent(dataset)
    logger.info(`   • Found ${allHypothetical.length} hypothetical items`)

    // Query by confidence (if available)
    const confidentHypothetical = hyde.queryHypotheticalContent(dataset, {
        'http://purl.org/stuff/ragno/confidence': '0.6' // Find high-confidence hypotheses
    })
    logger.info(`   • High-confidence hypotheses: ${confidentHypothetical.length}`)

    // Display sample hypothetical item
    if (allHypothetical.length > 0) {
        const sample = allHypothetical[0]
        logger.info(`   \\n   💭 Sample Hypothetical Item:`)
        logger.info(`      URI: ${sample.uri}`)
        logger.info(`      Properties: ${Object.keys(sample.properties).length}`)

        // Show some properties
        const interestingProps = ['http://purl.org/stuff/ragno/confidence', 'http://www.w3.org/2000/01/rdf-schema#label']
        interestingProps.forEach(prop => {
            if (sample.properties[prop]) {
                const value = sample.properties[prop][0]
                const shortProp = prop.split('/').pop()
                logger.info(`      ${shortProp}: ${value}`)
            }
        })
    }
}

/**
 * Export results to various RDF formats
 */
async function exportResults(dataset, namespaces) {
    try {
        // Export basic dataset statistics
        logger.info(`   💾 Exporting ${dataset.size} triples...`)

        // Create a simple export using the existing SPARQL export function
        const exportData = {
            dataset: dataset,
            timestamp: new Date(),
            metadata: {
                generator: 'Hyde Algorithm Demo',
                tripleCount: dataset.size,
                namespaces: Object.fromEntries(namespaces.prefixes)
            }
        }

        logger.info(`   ✅ Export data prepared`)
        logger.info(`   📄 Dataset contains ${dataset.size} triples`)
        logger.info(`   🏷️  Using ${namespaces.prefixes.size} namespace prefixes`)

        // Note: Full RDF serialization would require additional dependencies
        // For demo purposes, we're showing the export structure

    } catch (error) {
        logger.warn(`   ⚠️  Export warning: ${error.message}`)
    }
}

/**
 * Display comprehensive statistics
 */
function displayStatistics(hyde, allResults) {
    const stats = hyde.getStatistics()

    logger.info(`   📈 HyDE Algorithm Statistics:`)
    logger.info(`   • Total queries processed: ${stats.totalQueries}`)
    logger.info(`   • Total hypotheses generated: ${stats.totalHypotheses}`)
    logger.info(`   • Total entities extracted: ${stats.totalEntitiesExtracted}`)
    logger.info(`   • Total execution time: ${stats.totalExecutionTime}ms`)
    logger.info(`   • Average time per query: ${stats.averageExecutionTime.toFixed(2)}ms`)
    logger.info(`   • Average hypotheses per query: ${stats.averageHypothesesPerQuery.toFixed(2)}`)
    logger.info(`   • Average entities per query: ${stats.averageEntitiesPerQuery.toFixed(2)}`)

    // Calculate additional metrics from results
    const totalConfidence = allResults.reduce((sum, result) => {
        return sum + result.results.hypotheses.reduce((hSum, h) => {
            const confidence = h.metadata?.confidence || 0
            return hSum + (typeof confidence === 'number' ? confidence : 0)
        }, 0)
    }, 0)

    const totalHypotheses = allResults.reduce((sum, result) => sum + result.results.hypotheses.length, 0)
    const avgConfidence = totalHypotheses > 0 ? (totalConfidence / totalHypotheses).toFixed(3) : 0

    logger.info(`   • Average hypothesis confidence: ${avgConfidence}`)
    logger.info(`   • Last run: ${stats.lastRun ? stats.lastRun.toISOString() : 'Never'}`)
}

/**
 * Error handling wrapper
 */
async function main() {
    try {
        await runHydeDemo()
    } catch (error) {
        logger.error('💥 HyDE Demo failed with error:', error)
        process.exit(1)
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
}

export { runHydeDemo, CONFIG }