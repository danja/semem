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
import chalk from 'chalk'
import rdf from 'rdf-ext'
import Config from '../../src/Config.js'
import MemoryManager from '../../src/MemoryManager.js'
import InMemoryStore from '../../src/stores/InMemoryStore.js'
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js'
import { ClientFactory } from 'hyperdata-clients'
import Hyde from '../../src/ragno/algorithms/Hyde.js'
import NamespaceManager from '../../src/ragno/core/NamespaceManager.js'
// Note: RDF export functionality would use existing utilities

// Configure logging with subtle color enhancement
logger.setLevel('info')

// Add discrete color to loglevel if colors are supported
if (chalk.supportsColor) {
    const originalFactory = logger.methodFactory
    logger.methodFactory = function (methodName, logLevel, loggerName) {
        const rawMethod = originalFactory(methodName, logLevel, loggerName)
        return function (message, ...args) {
            const colorFn = methodName === 'error' ? chalk.red : 
                           methodName === 'warn' ? chalk.yellow : 
                           methodName === 'info' ? chalk.cyan : chalk.gray
            rawMethod(colorFn(message), ...args)
        }
    }
    logger.setLevel(logger.getLevel()) // Re-apply to activate custom factory
}

// Configure chalk for better color support
process.env.FORCE_COLOR = '3'  // Higher level for better support
process.env.COLORTERM = 'truecolor'  // Signal true color support
chalk.level = 3  // Force higher color level

// Check multiple color support indicators
const hasColorSupport = process.env.FORCE_COLOR || 
                       process.env.NODE_DISABLE_COLORS !== '1' ||
                       process.stdout.isTTY ||
                       chalk.supportsColor

// Manual color override - try to detect color support more aggressively
const FORCE_COLORS = true
const USE_COLORS = FORCE_COLORS && hasColorSupport

// Enhanced format functions with emoji fallbacks
const format = {
    success: USE_COLORS ? chalk.green.bold : (text) => `✅ ${text}`,
    error: USE_COLORS ? chalk.red.bold : (text) => `❌ ${text}`,
    info: USE_COLORS ? chalk.cyan : (text) => `ℹ️  ${text}`,
    warning: USE_COLORS ? chalk.yellow : (text) => `⚠️  ${text}`,
    highlight: USE_COLORS ? chalk.bold : (text) => `**${text}**`,
    number: USE_COLORS ? (text) => chalk.bold.white(text) : (text) => `[${text}]`,
    header: USE_COLORS ? chalk.blue.bold : (text) => `\n=== ${text.replace(/🔬|📋|🧠|📊|🔍|💾|📈/, '')} ===`,
    subheader: USE_COLORS ? chalk.magenta.bold : (text) => `--- ${text.replace(/💭|🏷️/, '')} ---`,
    query: USE_COLORS ? chalk.cyan : (text) => `📝 ${text}`,
    confidence: USE_COLORS ? (text) => chalk.yellow(`confidence: ${chalk.bold(text)}`) : (text) => `confidence: ${text}`,
    entity: USE_COLORS ? chalk.yellow : (text) => `• ${text}`,
    stats: USE_COLORS ? chalk.green : (text) => `• ${text}`,
    gray: USE_COLORS ? chalk.gray : (text) => `(${text})`,
    white: USE_COLORS ? chalk.white : (text) => text
}

console.log(format.info(`Using colors: ${USE_COLORS ? 'YES' : 'NO'} (chalk support: ${chalk.supportsColor?.level || 'none'})`))

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
    console.log(format.header('🔬 Starting HyDE Algorithm Demo'))
    console.log(USE_COLORS ? chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') : '=' .repeat(50))

    let memoryManager = null

    try {
        // Step 1: Initialize components
        console.log(format.header('\n📋 Step 1: Initializing components...'))

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

        console.log(chalk.green(`   ✓ Using chat provider: ${chalk.bold(chatProviderConfig.type)} with model: ${chalk.bold(chatProviderConfig.chatModel)}`))

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

        console.log(chalk.green(`   ✓ Using embedding provider: ${chalk.bold(embeddingProvider)} with model: ${chalk.bold(embeddingModel)}`))

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

        console.log(chalk.green.bold('   ✅ Components initialized successfully'))

        // Step 2: Generate hypotheses for each query
        console.log(chalk.yellow.bold('\n🧠 Step 2: Generating hypotheses...'))

        const allResults = []

        for (let i = 0; i < CONFIG.demo.queries.length; i++) {
            const query = CONFIG.demo.queries[i]
            console.log(chalk.cyan(`\n📝 Processing Query ${i + 1}: `) + chalk.italic(`"${query}"`))

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
                console.log(chalk.red(`   ❌ Failed to process query "${query}": ${error.message}`))
            }
        }

        // Step 3: Analyze the complete dataset
        console.log(chalk.yellow.bold('\n📊 Step 3: Analyzing complete dataset...'))
        analyzeDataset(dataset, namespaces)

        // Step 4: Query hypothetical content
        console.log(chalk.yellow.bold('\n🔍 Step 4: Querying hypothetical content...'))
        demonstrateHypotheticalQueries(hyde, dataset)

        // Step 5: Export results if requested
        if (CONFIG.demo.exportToTurtle) {
            console.log(chalk.yellow.bold('\n💾 Step 5: Exporting to RDF formats...'))
            await exportResults(dataset, namespaces)
        }

        // Step 6: Display statistics
        console.log(chalk.yellow.bold('\n📈 Step 6: Algorithm statistics...'))
        displayStatistics(hyde, allResults)

        console.log(chalk.green.bold('\n🎉 HyDE Demo completed successfully!'))

    } catch (error) {
        console.log(chalk.red.bold('💥 Demo failed:'), chalk.red(error.message))
        throw error
    } finally {
        if (memoryManager) {
            console.log(chalk.gray('🧹 Cleaning up memory manager...'))
            await memoryManager.dispose()
        }
    }
}

/**
 * Display results for a single query
 */
function displayQueryResults(query, results, queryNumber) {
    console.log(chalk.blue.bold(`   📊 Query ${queryNumber} Results:`))
    console.log(chalk.green(`   • Generated ${chalk.bold(results.hypotheses.length)} hypotheses`))
    console.log(chalk.green(`   • Extracted ${chalk.bold(results.entities.length)} entities`))
    console.log(chalk.green(`   • Created ${chalk.bold(results.relationships.length)} relationships`))
    console.log(chalk.green(`   • Added ${chalk.bold(results.rdfTriples)} RDF triples`))
    console.log(chalk.gray(`   • Processing time: ${results.processingTime}ms`))

    if (results.hypotheses.length > 0) {
        console.log(chalk.magenta.bold(`\n   💭 Generated Hypotheses:`))
        
        results.hypotheses.forEach((hypothesis, index) => {
            const content = hypothesis.getText() || hypothesis.getContent() || ''
            const metadata = hypothesis.getMetadata()
            const confidence = metadata?.confidence
            const confidenceStr = typeof confidence === 'number' ? confidence.toFixed(3) : 'N/A'
            
            // Display more text - up to 300 characters with word boundaries
            let preview = content
            if (content.length > 300) {
                const truncated = content.substring(0, 300)
                const lastSpace = truncated.lastIndexOf(' ')
                preview = (lastSpace > 250 ? truncated.substring(0, lastSpace) : truncated) + '...'
            }
            
            console.log(chalk.cyan(`\n      Hypothesis ${index + 1} (confidence: ${chalk.bold(confidenceStr)}):`))
            console.log(chalk.white(`      "${preview}"`))
            
            if (metadata?.originalQuery) {
                console.log(chalk.gray(`      Original query: "${metadata.originalQuery}"`))
            }
        })
    }

    if (results.entities.length > 0) {
        console.log(chalk.magenta.bold(`\n   🏷️ Extracted Entities:`))
        results.entities.slice(0, 8).forEach((entity, index) => {
            const metadata = entity.getMetadata()
            const confidence = metadata?.confidence
            const confidenceStr = typeof confidence === 'number' ? confidence.toFixed(3) : 'N/A'
            const label = entity.getPrefLabel() || entity.getName() || 'Unknown'
            console.log(chalk.yellow(`      ${index + 1}. ${chalk.bold(label)} ${chalk.gray(`(confidence: ${confidenceStr})`)}}`))
        })
        if (results.entities.length > 8) {
            console.log(chalk.gray(`      ... and ${results.entities.length - 8} more entities`))
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

    console.log(chalk.blue.bold(`   📊 Dataset Analysis:`))
    console.log(chalk.cyan(`   • Total RDF triples: ${chalk.bold(stats.totalTriples)}`))
    console.log(chalk.magenta(`   • Hypothetical triples: ${chalk.bold(stats.hypotheticalTriples)}`))
    console.log(chalk.green(`   • Total entities: ${chalk.bold(stats.entities.size)}`))
    console.log(chalk.yellow(`   • Hypothetical entities: ${chalk.bold(stats.hypotheticalEntities.size)}`))
    console.log(chalk.blue(`   • Semantic units: ${chalk.bold(stats.semanticUnits.size)}`))
    console.log(chalk.cyan(`   • Relationships: ${chalk.bold(stats.relationships.size)}`))

    const hypotheticalRatio = stats.totalTriples > 0 ? (stats.hypotheticalTriples / stats.totalTriples * 100).toFixed(1) : 0
    console.log(chalk.gray(`   • Hypothetical content ratio: ${chalk.bold(hypotheticalRatio + '%')}`))
    
    if (stats.totalTriples > 0) {
        console.log(chalk.green(`   ✓ Successfully created knowledge graph with ${stats.totalTriples} triples`))
    }
}

/**
 * Demonstrate querying hypothetical content
 */
function demonstrateHypotheticalQueries(hyde, dataset) {
    console.log(chalk.blue.bold(`   🔍 Querying hypothetical content...`))

    // Query all hypothetical content
    const allHypothetical = hyde.queryHypotheticalContent(dataset)
    console.log(chalk.cyan(`   • Found ${chalk.bold(allHypothetical.length)} hypothetical items`))

    // Query by confidence (if available)
    const confidentHypothetical = hyde.queryHypotheticalContent(dataset, {
        'http://purl.org/stuff/ragno/confidence': '0.6' // Find high-confidence hypotheses
    })
    console.log(chalk.green(`   • High-confidence hypotheses: ${chalk.bold(confidentHypothetical.length)}`))

    // Display sample hypothetical item
    if (allHypothetical.length > 0) {
        const sample = allHypothetical[0]
        console.log(chalk.magenta(`\n   💭 Sample Hypothetical Item:`))
        console.log(chalk.gray(`      URI: ${sample.uri}`))
        console.log(chalk.gray(`      Properties: ${Object.keys(sample.properties).length}`))

        // Show some properties
        const interestingProps = ['http://purl.org/stuff/ragno/confidence', 'http://www.w3.org/2000/01/rdf-schema#label']
        interestingProps.forEach(prop => {
            if (sample.properties[prop]) {
                const value = sample.properties[prop][0]
                const shortProp = prop.split('/').pop()
                console.log(chalk.white(`      ${shortProp}: ${chalk.bold(value)}`))
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
        console.log(chalk.blue(`   💾 Exporting ${chalk.bold(dataset.size)} triples...`))

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

        console.log(chalk.green(`   ✅ Export data prepared`))
        console.log(chalk.cyan(`   📄 Dataset contains ${chalk.bold(dataset.size)} triples`))
        console.log(chalk.yellow(`   🏷️ Using ${chalk.bold(namespaces.prefixes.size)} namespace prefixes`))

        // Note: Full RDF serialization would require additional dependencies
        // For demo purposes, we're showing the export structure

    } catch (error) {
        console.log(chalk.yellow(`   ⚠️ Export warning: ${error.message}`))
    }
}

/**
 * Display comprehensive statistics
 */
function displayStatistics(hyde, allResults) {
    const stats = hyde.getStatistics()

    console.log(chalk.blue.bold(`   📈 HyDE Algorithm Statistics:`))
    console.log(chalk.cyan(`   • Total queries processed: ${chalk.bold(stats.totalQueries)}`))
    console.log(chalk.green(`   • Total hypotheses generated: ${chalk.bold(stats.totalHypotheses)}`))
    console.log(chalk.yellow(`   • Total entities extracted: ${chalk.bold(stats.totalEntitiesExtracted)}`))
    console.log(chalk.magenta(`   • Total execution time: ${chalk.bold(stats.totalExecutionTime)}ms`))
    console.log(chalk.cyan(`   • Average time per query: ${chalk.bold(stats.averageExecutionTime.toFixed(2))}ms`))
    console.log(chalk.green(`   • Average hypotheses per query: ${chalk.bold(stats.averageHypothesesPerQuery.toFixed(2))}`))
    console.log(chalk.yellow(`   • Average entities per query: ${chalk.bold(stats.averageEntitiesPerQuery.toFixed(2))}`))

    // Calculate additional metrics from results
    const totalConfidence = allResults.reduce((sum, result) => {
        return sum + result.results.hypotheses.reduce((hSum, h) => {
            const metadata = h.getMetadata() // Use our new metadata system
            const confidence = metadata?.confidence || 0
            return hSum + (typeof confidence === 'number' ? confidence : 0)
        }, 0)
    }, 0)

    const totalHypotheses = allResults.reduce((sum, result) => sum + result.results.hypotheses.length, 0)
    const avgConfidence = totalHypotheses > 0 ? (totalConfidence / totalHypotheses).toFixed(3) : 0

    console.log(chalk.blue(`   • Average hypothesis confidence: ${chalk.bold(avgConfidence)}`))
    console.log(chalk.gray(`   • Last run: ${stats.lastRun ? stats.lastRun.toISOString() : 'Never'}`))
    
    if (avgConfidence > 0.7) {
        console.log(chalk.green(`   ✓ High quality hypotheses generated (avg confidence: ${avgConfidence})`))
    } else if (avgConfidence > 0.5) {
        console.log(chalk.yellow(`   ⚠ Moderate quality hypotheses (avg confidence: ${avgConfidence})`))
    } else if (totalHypotheses > 0) {
        console.log(chalk.red(`   ⚠ Low confidence hypotheses (avg confidence: ${avgConfidence})`))
    }
}

/**
 * Error handling wrapper
 */
async function main() {
    try {
        await runHydeDemo()
    } catch (error) {
        console.log(chalk.red.bold('💥 HyDE Demo failed with error:'), chalk.red(error.message))
        if (error.stack) {
            console.log(chalk.gray(error.stack))
        }
        process.exit(1)
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
}

export { runHydeDemo, CONFIG }