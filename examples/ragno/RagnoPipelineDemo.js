/**
 * RagnoPipelineDemo.js - Complete Ragno Knowledge Graph Pipeline Demo (RDF-Ext Version)
 * 
 * This script demonstrates the full Ragno pipeline using the new RDF-Ext infrastructure
 * for knowledge graph construction with proper RDF resource management:
 * 
 * 1. **Corpus Decomposition**: Creates RDF-based semantic units, entities, and relationships
 * 2. **Attribute Augmentation**: Generates RDF attributes using graph analytics for importance
 * 3. **Community Detection**: Uses Leiden clustering to create RDF community elements
 * 4. **Vector Enrichment**: Builds HNSW index and creates similarity relationships
 * 5. **RDF Export**: Demonstrates export to multiple RDF formats
 * 
 * Updated Pipeline Process (RDF-Ext):
 * ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 * │   Text Corpus   │───▶│  RDF-Ext        │───▶│  RDF Knowledge  │
 * │   (Documents)   │    │  Decomposition  │    │  Graph Dataset  │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 *                                                        │
 * ┌─────────────────┐    ┌─────────────────┐    ┌───────▼─────────┐
 * │  SPARQL Export  │◀───│   HNSW Vector   │◀───│  Graph Analytics│
 * │ (Turtle/N3/etc) │    │     Index       │    │ (Leiden/PPR/etc)│
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 * 
 * New Technologies (Phase 6):
 * - **RDF-Ext**: Proper RDF dataset management and ontology compliance
 * - **Graph Analytics**: K-core, betweenness centrality, Leiden clustering
 * - **HNSW Indexing**: High-performance vector similarity search
 * - **Production APIs**: Ready for deployment with monitoring and caching
 * 
 * Prerequisites:
 * - Ollama running with qwen2:1.5b and nomic-embed-text models
 * - All Ragno Phase 6 components (RDF-Ext, algorithms, search)
 * - Optional: SPARQL endpoint for RDF storage
 */

import logger from 'loglevel'
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js'
import { augmentWithAttributes } from '../../src/ragno/augmentWithAttributes.js'
import { aggregateCommunities } from '../../src/ragno/aggregateCommunities.js'
import { enrichWithEmbeddings } from '../../src/ragno/enrichWithEmbeddings.js'
import LLMHandler from '../../src/handlers/LLMHandler.js'
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js'
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js'
import Config from '../../src/Config.js'
import loadRagnoConfig from '../../src/utils/loadRagnoConfig.js'

// Configure logging
logger.setLevel('debug')

let embeddingConnector = null

async function shutdown(signal) {
    logger.info(`\\n🔌 Received ${signal}, starting graceful shutdown...`)
    if (embeddingConnector) {
        try {
            // Cleanup any embedding connections if needed
            logger.info('🧹 Cleaning up embedding connector...')
            logger.info('✅ Cleanup complete')
            process.exit(0)
        } catch (error) {
            logger.error('❌ Error during cleanup:', error)
            process.exit(1)
        }
    } else {
        process.exit(0)
    }
}

// Setup graceful shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', async (error) => {
    logger.error('💥 Uncaught Exception:', error)
    await shutdown('uncaughtException')
})
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
    await shutdown('unhandledRejection')
})

function createSampleCorpus() {
    return [
        {
            content: "Geoffrey Hinton is often called the 'Godfather of AI' for his pioneering work in deep learning and neural networks. He developed the backpropagation algorithm which revolutionized machine learning. Hinton worked at the University of Toronto and Google, making breakthrough contributions to artificial intelligence research.",
            source: "ai_pioneers_hinton.txt",
            metadata: { author: "AI Research Journal", year: 2023, topic: "Deep Learning" }
        },
        {
            content: "Yann LeCun developed convolutional neural networks (CNNs) which became fundamental to computer vision. His work on LeNet-5 laid the groundwork for modern image recognition systems. LeCun serves as Chief AI Scientist at Meta and is a professor at NYU, continuing to advance the field of artificial intelligence.",
            source: "ai_pioneers_lecun.txt", 
            metadata: { author: "AI Research Journal", year: 2023, topic: "Computer Vision" }
        },
        {
            content: "Yoshua Bengio made significant contributions to deep learning, particularly in the areas of neural language models and representation learning. His research on attention mechanisms and generative models has influenced modern AI architectures. Bengio co-founded Element AI and leads the Montreal Institute for Learning Algorithms (MILA).",
            source: "ai_pioneers_bengio.txt",
            metadata: { author: "AI Research Journal", year: 2023, topic: "NLP" }
        },
        {
            content: "The transformer architecture, introduced in 'Attention Is All You Need', revolutionized natural language processing. Transformers use self-attention mechanisms to process sequences in parallel, enabling the development of large language models like GPT and BERT. This architecture has become the foundation for modern AI systems.",
            source: "transformer_architecture.txt",
            metadata: { author: "Google Research", year: 2017, topic: "Transformers" }
        },
        {
            content: "Large Language Models (LLMs) like GPT-4, Claude, and LLaMA represent the current state-of-the-art in natural language processing. These models demonstrate emergent capabilities including reasoning, code generation, and creative writing. They are trained on massive text corpora using transformer architectures and have billions of parameters.",
            source: "modern_llms.txt",
            metadata: { author: "AI Today", year: 2024, topic: "LLMs" }
        }
    ]
}

async function displayGraphStats(graph, step) {
    logger.info(`\\n📊 Knowledge Graph Statistics - ${step}:`)
    logger.info(`   📝 Units: ${graph.units?.length || 0}`)
    logger.info(`   🏷️  Entities: ${graph.entities?.length || 0}`)
    logger.info(`   🔗 Relationships: ${graph.relationships?.length || 0}`)
    
    // Handle both old and new attribute formats
    if (graph.attributes) {
        const attrCount = Array.isArray(graph.attributes) ? graph.attributes.length : Object.keys(graph.attributes).length
        logger.info(`   📋 Attributes: ${attrCount}`)
    }
    
    if (graph.communities) {
        logger.info(`   👥 Communities: ${graph.communities.length}`)
    }
    
    // Handle new RDF dataset
    if (graph.dataset && graph.dataset.size) {
        logger.info(`   🗄️  RDF Dataset: ${graph.dataset.size} triples`)
    }
    
    // Handle new vector index
    if (graph.vectorIndex) {
        logger.info(`   🧠 Vector Index: Available`)
    } else if (graph.embeddings) {
        const embCount = graph.embeddings instanceof Map ? graph.embeddings.size : Object.keys(graph.embeddings).length
        logger.info(`   🧠 Embeddings: ${embCount}`)
    }
    
    if (graph.similarityLinks) {
        logger.info(`   🔗 Similarity Links: ${graph.similarityLinks.length}`)
    }
    
    // Show statistics if available
    if (graph.statistics) {
        logger.info(`   ⏱️  Processing Time: ${graph.statistics.processingTime}ms`)
    }
}

async function main() {
    logger.info('🚀 Starting Ragno Knowledge Graph Pipeline Demo')
    logger.info('=' .repeat(70))
    
    try {
        // Step 1: Load Configuration
        logger.info('⚙️  Step 1: Loading Ragno and system configuration...')
        const ragnoConfig = await loadRagnoConfig()
        const config = new Config()
        await config.init()
        logger.info('✅ Configuration loaded successfully')
        logger.info(`🏷️  Version: ${ragnoConfig.version}`)
        
        // Get provider configuration
        const embeddingProvider = config.get('embeddingProvider') || 'ollama'
        const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text'
        const chatModel = config.get('chatModel') || 'qwen2:1.5b'
        
        logger.info(`🤖 Chat Model: ${chatModel}`)
        logger.info(`🧠 Embedding Provider: ${embeddingProvider}`)
        logger.info(`🧠 Embedding Model: ${embeddingModel}`)
        logger.info(`📏 Embedding Dimensions: ${ragnoConfig.enrichment.embedding.dimensions}`)

        // Step 2: Initialize Embedding Connector
        logger.info('\\n🤖 Step 2: Initializing embedding connector...')
        
        // Create embedding connector using factory
        let providerConfig = {}
        if (embeddingProvider === 'nomic') {
            providerConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: embeddingModel
            }
        } else if (embeddingProvider === 'ollama') {
            const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434'
            providerConfig = {
                provider: 'ollama',
                baseUrl: ollamaBaseUrl,
                model: embeddingModel
            }
            logger.info(`🏃 Using Ollama at: ${ollamaBaseUrl}`)
        }
        
        embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig)
        logger.info('✅ Embedding connector initialized successfully')

        // Step 3: Setup Handlers
        logger.info('\\n🔧 Step 3: Setting up LLM and Embedding handlers...')
        
        const cacheManager = { 
            get: () => undefined, 
            set: () => {},
            has: () => false,
            delete: () => false,
            clear: () => {}
        }

        const llmHandler = new LLMHandler(
            embeddingConnector,
            chatModel,
            ragnoConfig.decomposition.llm.temperature
        )

        const embeddingHandler = new EmbeddingHandler(
            embeddingConnector,
            embeddingModel,
            ragnoConfig.enrichment.embedding.dimensions,
            cacheManager
        )

        const embeddingFn = text => embeddingHandler.generateEmbedding(text)
        logger.info('✅ Handlers configured successfully')

        // Step 4: Prepare Sample Corpus
        logger.info('\\n📚 Step 4: Preparing sample corpus...')
        const textChunks = createSampleCorpus()
        logger.info(`📄 Created corpus with ${textChunks.length} documents`)
        textChunks.forEach((chunk, i) => {
            logger.info(`   ${i+1}. ${chunk.source} (${chunk.content.length} chars)`)
        })

        // Step 5: Decompose Corpus
        logger.info('\\n🔍 Step 5: Decomposing corpus into semantic units and entities...')
        logger.info('⚙️  Running entity extraction and relationship identification...')
        const startDecomp = Date.now()
        const knowledgeGraph = await decomposeCorpus(textChunks, llmHandler)
        const decompTime = Date.now() - startDecomp
        logger.info(`✅ Decomposition completed in ${decompTime}ms`)
        await displayGraphStats(knowledgeGraph, 'After Decomposition')

        // Step 6: Augment with Attributes  
        logger.info('\\n📋 Step 6: Augmenting important nodes with descriptive attributes...')
        logger.info('🔍 Identifying high-importance nodes for attribute generation...')
        const startAugment = Date.now()
        const { attributes } = await augmentWithAttributes(knowledgeGraph, llmHandler, { 
            topK: 5 // Generate attributes for top 5 most important nodes
        })
        knowledgeGraph.attributes = attributes
        const augmentTime = Date.now() - startAugment
        logger.info(`✅ Attribute augmentation completed in ${augmentTime}ms`)
        await displayGraphStats(knowledgeGraph, 'After Augmentation')

        // Display some generated attributes (updated for RDF-Ext)
        if (attributes && attributes.length > 0) {
            logger.info('🏷️  Sample generated attributes:')
            attributes.slice(0, 3).forEach((attr, i) => {
                if (attr && attr.getCategory && attr.getContent) {
                    // RDF-Ext Attribute object
                    logger.info(`   📝 ${i+1}. ${attr.getCategory()}: ${attr.getContent().substring(0, 60)}...`)
                    logger.info(`      Confidence: ${attr.getConfidence?.() || 'N/A'}`)
                } else if (attr && attr.type && attr.description) {
                    // Legacy format
                    logger.info(`   📝 ${i+1}. ${attr.type}: ${attr.description.substring(0, 60)}...`)
                } else {
                    logger.info(`   📝 ${i+1}. ${JSON.stringify(attr)}`)
                }
            })
        }

        // Step 7: Community Detection
        logger.info('\\n👥 Step 7: Detecting communities and generating community attributes...')
        logger.info('🔍 Running graph clustering to identify related concept groups...')
        const startCommunity = Date.now()
        const { communities, attributes: commAttrs } = await aggregateCommunities(knowledgeGraph, llmHandler, { 
            minCommunitySize: 2 
        })
        knowledgeGraph.communities = communities
        knowledgeGraph.communityAttributes = commAttrs
        const communityTime = Date.now() - startCommunity
        logger.info(`✅ Community detection completed in ${communityTime}ms`)
        await displayGraphStats(knowledgeGraph, 'After Community Detection')

        // Display community information (updated for RDF-Ext)
        if (communities && communities.length > 0) {
            logger.info(`🎯 Detected ${communities.length} communities:`)
            communities.forEach((community, i) => {
                if (community && community.getMembers && community.getSummary) {
                    // RDF-Ext CommunityElement object
                    const members = community.getMembers()
                    logger.info(`   ${i+1}. Community: ${members.length} members`)
                    logger.info(`      Summary: ${community.getSummary().substring(0, 80)}...`)
                    logger.info(`      Confidence: ${community.getConfidence?.() || 'N/A'}`)
                } else if (community && community.id && Array.isArray(community.members)) {
                    // Legacy format
                    logger.info(`   ${i+1}. Community ${community.id}: ${community.members.length} members`)
                    logger.info(`      Members: [${community.members.slice(0, 3).join(', ')}${community.members.length > 3 ? '...' : ''}]`)
                } else {
                    logger.info(`   ${i+1}. Community: ${JSON.stringify(community)}`)
                }
            })
        }

        // Step 8: Vector Enrichment (updated for RDF-Ext)
        logger.info('\\n🧠 Step 8: Building HNSW vector index and similarity links...')
        logger.info('⚙️  Creating vector representations for semantic search...')
        const startEmbedding = Date.now()
        const enrichmentResult = await enrichWithEmbeddings(knowledgeGraph, embeddingHandler, { 
            similarityThreshold: 0.5, // Lower threshold to capture more relationships
            batchSize: 5,
            maxElements: 1000
        })
        
        // Update knowledge graph with enrichment results
        knowledgeGraph.vectorIndex = enrichmentResult.vectorIndex
        knowledgeGraph.embeddings = enrichmentResult.embeddings
        knowledgeGraph.similarityLinks = enrichmentResult.similarityLinks
        knowledgeGraph.dataset = enrichmentResult.dataset // Updated RDF dataset
        
        const embeddingTime = Date.now() - startEmbedding
        logger.info(`✅ Vector enrichment completed in ${embeddingTime}ms`)
        await displayGraphStats(knowledgeGraph, 'Final Knowledge Graph')

        // Display similarity links (updated for RDF-Ext)
        const simLinks = knowledgeGraph.similarityLinks || enrichmentResult.similarityLinks
        if (simLinks && simLinks.length > 0) {
            logger.info(`🔗 Generated ${simLinks.length} similarity links:`)
            simLinks.slice(0, 5).forEach((link, i) => {
                if (link && link.source && link.target && typeof link.similarity === 'number') {
                    logger.info(`   ${i+1}. ${link.source} ↔ ${link.target} (similarity: ${link.similarity.toFixed(3)})`)
                } else {
                    logger.info(`   ${i+1}. ${JSON.stringify(link)}`)
                }
            })
            if (simLinks.length > 5) {
                logger.info(`   ... and ${simLinks.length - 5} more links`)
            }
        }

        // Step 9: RDF Export Demonstration (New in Phase 6)
        logger.info('\\n📤 Step 9: Demonstrating RDF Export Capabilities...')
        if (knowledgeGraph.dataset && knowledgeGraph.dataset.size > 0) {
            logger.info(`🗄️  Final RDF Dataset contains ${knowledgeGraph.dataset.size} triples`)
            
            // Sample RDF export (you could actually serialize here)
            logger.info('📋 RDF Export Options Available:')
            logger.info('   • Turtle (.ttl) - Human-readable RDF format')
            logger.info('   • N-Triples (.nt) - Line-based RDF format')
            logger.info('   • JSON-LD (.jsonld) - JSON-based linked data')
            logger.info('   • RDF/XML (.rdf) - XML-based RDF format')
            
            // Note: In a real implementation, you could use rdf-serialize libraries
            logger.info('💡 Use exportToRDF() function for actual serialization to SPARQL endpoints')
        } else {
            logger.info('⚠️  No RDF dataset available for export')
        }

        // Final Summary
        logger.info('\\n🎉 Ragno Pipeline Completed Successfully!')
        logger.info('=' .repeat(70))
        logger.info('📊 Final Knowledge Graph Statistics:')
        logger.info(`   📝 Semantic Units: ${knowledgeGraph.units?.length || 0}`)
        logger.info(`   🏷️  Named Entities: ${knowledgeGraph.entities?.length || 0}`) 
        logger.info(`   🔗 Relationships: ${knowledgeGraph.relationships?.length || 0}`)
        logger.info(`   📋 Node Attributes: ${Object.keys(knowledgeGraph.attributes || {}).length}`)
        logger.info(`   👥 Communities: ${knowledgeGraph.communities?.length || 0}`)
        logger.info(`   🧠 Embeddings: ${Object.keys(knowledgeGraph.embeddings || {}).length}`)
        logger.info(`   🔗 Similarity Links: ${knowledgeGraph.similarityLinks?.length || 0}`)
        
        const totalTime = decompTime + augmentTime + communityTime + embeddingTime
        logger.info(`\\n⏱️  Total Processing Time: ${totalTime}ms`)
        logger.info(`   🔍 Decomposition: ${decompTime}ms`)
        logger.info(`   📋 Augmentation: ${augmentTime}ms`) 
        logger.info(`   👥 Communities: ${communityTime}ms`)
        logger.info(`   🧠 Embeddings: ${embeddingTime}ms`)

        logger.info('\\n💡 The RDF-Ext knowledge graph is now ready for:')
        logger.info('   🔍 HNSW vector similarity search and semantic queries')
        logger.info('   📊 Advanced graph analytics (K-core, Leiden clustering, PPR)')
        logger.info('   🤖 Production API deployment with monitoring and caching')
        logger.info('   📈 Real-time knowledge discovery and graph insights')
        logger.info('   🗄️  Multiple RDF export formats and SPARQL integration')
        logger.info('   🌐 REST API endpoints for all graph operations')
        logger.info('   📈 Performance monitoring and health checks')

        // Sample of actual extracted data (updated for RDF-Ext)
        logger.info('\\n📋 Sample Extracted Entities:')
        if (knowledgeGraph.entities && knowledgeGraph.entities.length > 0) {
            knowledgeGraph.entities.slice(0, 5).forEach((entity, i) => {
                if (entity && entity.getPreferredLabel) {
                    // RDF-Ext Entity object
                    logger.info(`   ${i+1}. ${entity.getPreferredLabel()} (frequency: ${entity.getFrequency?.() || 1})`)
                    logger.info(`      Entry Point: ${entity.isEntryPoint?.() || false}`)
                } else if (entity && entity.name) {
                    // Legacy format
                    logger.info(`   ${i+1}. ${entity.name} (${entity.type || 'Unknown'})`)
                } else {
                    logger.info(`   ${i+1}. ${JSON.stringify(entity)}`)
                }
            })
        } else {
            logger.info('   No entities extracted')
        }

        logger.info('\\n📝 Sample Semantic Units:')
        if (knowledgeGraph.units && knowledgeGraph.units.length > 0) {
            knowledgeGraph.units.slice(0, 3).forEach((unit, i) => {
                if (unit && unit.getContent) {
                    // RDF-Ext SemanticUnit object
                    logger.info(`   ${i+1}. "${unit.getContent().substring(0, 80)}..."`)
                    if (unit.getSummary && unit.getSummary()) {
                        logger.info(`      Summary: ${unit.getSummary().substring(0, 60)}...`)
                    }
                } else if (unit && unit.content) {
                    // Legacy format
                    logger.info(`   ${i+1}. "${unit.content.substring(0, 80)}..."`)
                } else {
                    logger.info(`   ${i+1}. ${JSON.stringify(unit)}`)
                }
            })
        } else {
            logger.info('   No semantic units extracted')
        }

        // New: Show RDF dataset information
        logger.info('\\n🗄️  RDF Dataset Information:')
        if (knowledgeGraph.dataset) {
            logger.info(`   📊 Total Triples: ${knowledgeGraph.dataset.size}`)
            logger.info(`   🏷️  Ontology: ragno (http://purl.org/stuff/ragno/)`)
            logger.info(`   📋 Standards: RDF-Ext, SKOS, OWL`)
            logger.info(`   🔗 Ready for SPARQL querying and export`)
        } else {
            logger.info('   ⚠️  No RDF dataset available')
        }

    } catch (error) {
        logger.error('💥 Fatal error in Ragno pipeline:', error.message)
        logger.error('📋 Stack trace:', error.stack)
        throw error
    }
}

// Run the demo
main().catch(async (error) => {
    logger.error('💥 Demo failed:', error.message)
    await shutdown('fatal error')
})