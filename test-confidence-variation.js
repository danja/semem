#!/usr/bin/env node

/**
 * Test confidence variation with multiple hypotheses
 */

import Config from './src/Config.js'
import MemoryManager from './src/MemoryManager.js'
import InMemoryStore from './src/stores/InMemoryStore.js'
import EmbeddingConnectorFactory from './src/connectors/EmbeddingConnectorFactory.js'
import { ClientFactory } from 'hyperdata-clients'
import Hyde from './src/ragno/algorithms/Hyde.js'
import rdf from 'rdf-ext'
import logger from 'loglevel'

logger.setLevel('info')

async function testConfidenceVariation() {
    console.log('🔬 Testing Confidence Variation')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
        // Initialize config and providers
        const config = new Config('config/config.json')
        await config.init()
        
        const llmProviders = config.get('llmProviders')
        const chatProviderConfig = llmProviders.find(p => p.capabilities?.includes('chat'))
        
        console.log(`✓ Using chat provider: ${chatProviderConfig.type} with model: ${chatProviderConfig.chatModel}`)
        
        // Create providers
        const chatProvider = await ClientFactory.createClient(chatProviderConfig.type, {
            model: chatProviderConfig.chatModel,
            baseUrl: chatProviderConfig.baseUrl,
            apiKey: chatProviderConfig.apiKey
        })
        
        const embeddingProvider = config.get('embeddingProvider') || 'ollama'
        const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text'
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector({
            provider: embeddingProvider,
            baseUrl: 'http://localhost:11434',
            model: embeddingModel
        })
        
        const storage = new InMemoryStore()
        const memoryManager = new MemoryManager({
            llmProvider: chatProvider,
            embeddingProvider: embeddingConnector,
            chatModel: chatProviderConfig.chatModel,
            embeddingModel: embeddingModel,
            storage
        })
        
        console.log('✓ MemoryManager initialized')
        
        // Test Hyde with multiple hypotheses for confidence variation
        const hydeOptions = {
            hypothesesPerQuery: 5,  // Generate 5 hypotheses to see variation
            temperature: 0.7,
            maxTokens: 200,         
            model: chatProviderConfig.chatModel,
            extractEntities: false  // Skip entity extraction for speed
        }
        
        const hyde = new Hyde(hydeOptions)
        const llmHandler = memoryManager.llmHandler
        const dataset = rdf.dataset()
        
        console.log('✓ Hyde initialized')
        
        // Test with one query but multiple hypotheses
        const testQuery = "What are the main benefits of renewable energy?"
        console.log(`\n🧠 Testing with query: "${testQuery}"`)
        console.log(`Generating ${hydeOptions.hypothesesPerQuery} hypotheses to test confidence variation...\n`)
        
        const results = await hyde.generateHypotheses(
            testQuery,
            llmHandler,
            dataset,
            hydeOptions
        )
        
        console.log('✅ SUCCESS! Generated hypotheses with varying confidence:')
        console.log(`📊 Results: ${results.hypotheses.length} hypotheses generated\n`)
        
        // Display confidence for each hypothesis
        results.hypotheses.forEach((hypothesis, index) => {
            const content = hypothesis.getText() || hypothesis.getContent() || ''
            console.log(`💭 Hypothesis ${index + 1}:`)
            
            // Try different ways to access confidence
            const confidence1 = hypothesis.metadata?.confidence
            const confidence2 = hypothesis.getMetadata()?.confidence
            const metadata = hypothesis.getMetadata()
            
            console.log(`   Direct metadata.confidence: ${confidence1}`)
            console.log(`   getMetadata().confidence: ${confidence2}`)
            console.log(`   Full metadata keys:`, Object.keys(metadata || {}))
            
            const confidence = confidence1 || confidence2 || 'N/A'
            console.log(`   Final Confidence: ${typeof confidence === 'number' ? confidence.toFixed(4) : confidence}`)
            console.log(`   Length: ${content.length} characters`)
            console.log(`   Preview: "${content.substring(0, 80)}..."`)
            console.log('')
        })
        
        // Calculate statistics
        const confidenceValues = results.hypotheses
            .map(h => h.metadata?.confidence)
            .filter(c => typeof c === 'number')
        
        if (confidenceValues.length > 0) {
            const avg = confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
            const min = Math.min(...confidenceValues)
            const max = Math.max(...confidenceValues)
            const range = max - min
            
            console.log('📈 Confidence Statistics:')
            console.log(`   Average: ${avg.toFixed(4)}`)
            console.log(`   Range: ${min.toFixed(4)} - ${max.toFixed(4)}`)
            console.log(`   Variation: ${range.toFixed(4)}`)
            console.log(`   Standard deviation: ${Math.sqrt(confidenceValues.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidenceValues.length).toFixed(4)}`)
        }
        
        await memoryManager.dispose()
        
        console.log('\n🎉 Confidence variation test completed successfully!')
        
    } catch (error) {
        console.error(`\n💥 Test failed: ${error.message}`)
        console.error(`Stack: ${error.stack}`)
        process.exit(1)
    }
}

testConfidenceVariation()