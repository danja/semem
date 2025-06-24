#!/usr/bin/env node

/**
 * Simple test for Hyde with just one query to check for the specific error
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

async function testHydeSimple() {
    console.log('🔬 Testing Hyde with Single Query')
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
        
        // Test Hyde with correct configuration
        const hydeOptions = {
            hypothesesPerQuery: 1,  // Just one hypothesis to speed up test
            temperature: 0.7,
            maxTokens: 100,         // Shorter responses
            model: chatProviderConfig.chatModel,  // IMPORTANT: Use correct model
            extractEntities: false  // Skip entity extraction to speed up
        }
        
        const hyde = new Hyde(hydeOptions)
        const llmHandler = memoryManager.llmHandler
        const dataset = rdf.dataset()
        
        console.log(`✓ Dataset created: ${dataset ? 'Yes' : 'No'}, type: ${typeof dataset}`)
        
        console.log('✓ Hyde initialized')
        
        // Test with one simple query
        const testQuery = "What is machine learning?"
        console.log(`\n🧠 Testing with query: "${testQuery}"`)
        
        const results = await hyde.generateHypotheses(
            testQuery,
            llmHandler,
            dataset,
            hydeOptions
        )
        
        console.log('\n✅ SUCCESS! Hyde completed without errors')
        console.log(`📊 Results:`)
        console.log(`   • Generated ${results.hypotheses.length} hypotheses`)
        console.log(`   • Extracted ${results.entities.length} entities`)
        console.log(`   • Created ${results.relationships.length} relationships`)
        console.log(`   • Processing time: ${results.processingTime}ms`)
        
        if (results.hypotheses.length > 0) {
            const hypothesis = results.hypotheses[0]
            console.log(`\n💭 Sample Hypothesis:`)
            const content = hypothesis.getText() || hypothesis.getContent() || ''
            console.log(`   Content: "${content.substring(0, 150)}..."`)
            console.log(`   Confidence: ${hypothesis.metadata?.confidence || 'N/A'}`)
        }
        
        await memoryManager.dispose()
        
        console.log('\n🎉 Test completed successfully - no "Cannot read properties of undefined" errors!')
        
    } catch (error) {
        console.error(`\n💥 Test failed: ${error.message}`)
        console.error(`Stack: ${error.stack}`)
        process.exit(1)
    }
}

testHydeSimple()