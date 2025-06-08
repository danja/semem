/**
 * RagnoPipelineDemo.js - Complete Ragno Knowledge Graph Pipeline Demo
 * 
 * This script demonstrates the full Ragno pipeline for knowledge graph construction:
 * 
 * 1. **Corpus Decomposition**: Breaks down text documents into semantic units and entities
 * 2. **Attribute Augmentation**: Generates descriptive attributes for important graph nodes
 * 3. **Community Detection**: Identifies clusters of related entities and concepts
 * 4. **Embedding Enrichment**: Creates vector representations for semantic similarity
 * 5. **Similarity Linking**: Connects semantically similar elements in the graph
 * 
 * The Ragno Pipeline Process:
 * ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 * │   Text Corpus   │───▶│  Decomposition  │───▶│  Knowledge Graph │
 * │   (Documents)   │    │   (Units+Ents)  │    │  (Nodes+Edges)  │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 *                                                        │
 * ┌─────────────────┐    ┌─────────────────┐    ┌───────▼─────────┐
 * │  Enriched KG    │◀───│   Embeddings    │◀───│   Augmentation  │
 * │ (w/ Similarities)│    │  (Vectors)      │    │ (Attributes+Comm)│
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 * 
 * Technologies Used:
 * - **Ollama**: Local LLM for text processing and attribute generation
 * - **nomic-embed-text**: Vector embeddings for semantic similarity
 * - **Ragno Ontology**: RDF vocabulary for knowledge representation
 * - **Graph Algorithms**: Community detection and centrality analysis
 * 
 * Prerequisites:
 * - Ollama running with qwen2:1.5b and nomic-embed-text models
 * - docs/ragno/ragno-config.json configuration file
 * - All Ragno pipeline modules properly installed
 */

import logger from 'loglevel'
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js'
import { augmentWithAttributes } from '../src/ragno/augmentWithAttributes.js'
import { aggregateCommunities } from '../src/ragno/aggregateCommunities.js'
import { enrichWithEmbeddings } from '../src/ragno/enrichWithEmbeddings.js'
import LLMHandler from '../src/handlers/LLMHandler.js'
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import loadRagnoConfig from './loadRagnoConfig.js'

// Configure logging
logger.setLevel('debug')

let ollamaConnector = null

async function shutdown(signal) {
    logger.info(`\\n🔌 Received ${signal}, starting graceful shutdown...`)
    if (ollamaConnector) {
        try {
            // Cleanup any Ollama connections if needed
            logger.info('🧹 Cleaning up Ollama connector...')
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
    if (graph.attributes) {
        logger.info(`   📋 Attributes: ${Object.keys(graph.attributes).length}`)
    }
    if (graph.communities) {
        logger.info(`   👥 Communities: ${graph.communities.length}`)
    }
    if (graph.embeddings) {
        logger.info(`   🧠 Embeddings: ${Object.keys(graph.embeddings).length}`)
    }
    if (graph.similarityLinks) {
        logger.info(`   🔗 Similarity Links: ${graph.similarityLinks.length}`)
    }
}

async function main() {
    logger.info('🚀 Starting Ragno Knowledge Graph Pipeline Demo')
    logger.info('=' .repeat(70))
    
    try {
        // Step 1: Load Configuration
        logger.info('⚙️  Step 1: Loading Ragno configuration...')
        const config = await loadRagnoConfig()
        logger.info('✅ Configuration loaded successfully')
        logger.info(`🏷️  Version: ${config.version}`)
        logger.info(`🤖 LLM Model: ${config.decomposition.llm.model} → qwen2:1.5b (override)`)
        logger.info(`🧠 Embedding Model: ${config.enrichment.embedding.model}`)
        logger.info(`📏 Embedding Dimensions: ${config.enrichment.embedding.dimensions}`)

        // Step 2: Initialize Ollama Connector
        logger.info('\\n🤖 Step 2: Initializing Ollama connector...')
        ollamaConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b')
        await ollamaConnector.initialize()
        logger.info('✅ Ollama connector initialized successfully')

        // Step 3: Setup Handlers
        logger.info('\\n🔧 Step 3: Setting up LLM and Embedding handlers...')
        
        const llmProvider = {
            generateChat: ollamaConnector.generateChat.bind(ollamaConnector),
            generateCompletion: ollamaConnector.generateCompletion.bind(ollamaConnector),
            generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector)
        }

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

        const llmHandler = new LLMHandler(
            llmProvider,
            'qwen2:1.5b', // Use available model
            config.decomposition.llm.temperature
        )

        const embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            'nomic-embed-text', // Use available model
            config.enrichment.embedding.dimensions,
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

        // Display some generated attributes
        if (attributes && Object.keys(attributes).length > 0) {
            logger.info('🏷️  Sample generated attributes:')
            Object.entries(attributes).slice(0, 3).forEach(([nodeId, nodeAttrs]) => {
                logger.info(`   📝 ${nodeId}: ${nodeAttrs.length} attributes`)
                nodeAttrs.slice(0, 2).forEach(attr => {
                    logger.info(`      • ${attr.type}: ${attr.description.substring(0, 60)}...`)
                })
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

        // Display community information
        if (communities && communities.length > 0) {
            logger.info(`🎯 Detected ${communities.length} communities:`)
            communities.forEach((community, i) => {
                logger.info(`   ${i+1}. Community ${community.id}: ${community.members.length} members`)
                logger.info(`      Members: [${community.members.slice(0, 3).join(', ')}${community.members.length > 3 ? '...' : ''}]`)
            })
        }

        // Step 8: Embedding Enrichment
        logger.info('\\n🧠 Step 8: Generating embeddings and computing similarity links...')
        logger.info('⚙️  Creating vector representations for semantic search...')
        const startEmbedding = Date.now()
        const { embeddings, similarityLinks } = await enrichWithEmbeddings(knowledgeGraph, embeddingFn, { 
            similarityThreshold: 0.3 // Only keep high-similarity links
        })
        knowledgeGraph.embeddings = embeddings
        knowledgeGraph.similarityLinks = similarityLinks
        const embeddingTime = Date.now() - startEmbedding
        logger.info(`✅ Embedding enrichment completed in ${embeddingTime}ms`)
        await displayGraphStats(knowledgeGraph, 'Final Knowledge Graph')

        // Display similarity links
        if (similarityLinks && similarityLinks.length > 0) {
            logger.info(`🔗 Generated ${similarityLinks.length} similarity links:`)
            similarityLinks.slice(0, 5).forEach((link, i) => {
                logger.info(`   ${i+1}. ${link.source} ↔ ${link.target} (similarity: ${link.similarity.toFixed(3)})`)
            })
            if (similarityLinks.length > 5) {
                logger.info(`   ... and ${similarityLinks.length - 5} more links`)
            }
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

        logger.info('\\n💡 The knowledge graph is now ready for:')
        logger.info('   🔍 Semantic search and similarity queries')
        logger.info('   📊 Graph analytics and community analysis') 
        logger.info('   🤖 AI-powered question answering')
        logger.info('   📈 Knowledge discovery and insights')
        logger.info('   🗄️  Export to RDF/SPARQL triple stores')

        // Sample of actual extracted data
        logger.info('\\n📋 Sample Extracted Entities:')
        if (knowledgeGraph.entities && knowledgeGraph.entities.length > 0) {
            knowledgeGraph.entities.slice(0, 5).forEach((entity, i) => {
                logger.info(`   ${i+1}. ${entity.name} (${entity.type || 'Unknown'})`)
            })
        }

        logger.info('\\n📝 Sample Semantic Units:')
        if (knowledgeGraph.units && knowledgeGraph.units.length > 0) {
            knowledgeGraph.units.slice(0, 3).forEach((unit, i) => {
                logger.info(`   ${i+1}. "${unit.content.substring(0, 80)}..."`)
            })
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