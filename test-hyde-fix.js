#!/usr/bin/env node

/**
 * Simple test to verify Hyde algorithm interface compatibility fix
 */

import Config from './src/Config.js'
import MemoryManager from './src/MemoryManager.js'
import InMemoryStore from './src/stores/InMemoryStore.js'
import EmbeddingConnectorFactory from './src/connectors/EmbeddingConnectorFactory.js'
import { ClientFactory } from 'hyperdata-clients'
import Hyde from './src/ragno/algorithms/Hyde.js'
import logger from 'loglevel'

logger.setLevel('info')

async function testHydeFix() {
    console.log('🔬 Testing Hyde Algorithm Interface Fix')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
        // Step 1: Initialize config and providers
        console.log('📋 Step 1: Initializing config and providers...')
        
        const config = new Config('config/config.json')
        await config.init()
        
        const llmProviders = config.get('llmProviders')
        const chatProviderConfig = llmProviders.find(p => p.capabilities?.includes('chat'))
        
        console.log(`✓ Found chat provider: ${chatProviderConfig.type} with model: ${chatProviderConfig.chatModel}`)
        
        // Step 2: Create hyperdata-clients provider
        console.log('📋 Step 2: Creating hyperdata-clients provider...')
        
        const chatProvider = await ClientFactory.createClient(chatProviderConfig.type, {
            model: chatProviderConfig.chatModel,
            baseUrl: chatProviderConfig.baseUrl,
            apiKey: chatProviderConfig.apiKey
        })
        
        console.log(`✓ Created ${chatProviderConfig.type} provider with hyperdata-clients`)
        
        // Step 3: Test MemoryManager capability detection
        console.log('📋 Step 3: Testing MemoryManager capability detection...')
        
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
        
        // Check if LLMHandler was created (should not be null anymore)
        if (memoryManager.llmHandler === null) {
            throw new Error('❌ LLMHandler is still null - capability detection failed')
        }
        
        console.log('✅ MemoryManager capability detection working - LLMHandler created')
        
        // Step 4: Test direct LLMHandler call
        console.log('📋 Step 4: Testing LLMHandler interface compatibility...')
        
        try {
            const testResponse = await memoryManager.llmHandler.generateResponse(
                'What is 2+2?', 
                '', 
                { model: chatProviderConfig.chatModel, temperature: 0.1 }
            )
            
            console.log(`✅ LLMHandler.generateResponse() working`)
            console.log(`   Response: "${testResponse.substring(0, 100)}${testResponse.length > 100 ? '...' : ''}"`)
            
        } catch (error) {
            throw new Error(`❌ LLMHandler.generateResponse() failed: ${error.message}`)
        }
        
        // Step 5: Test Hyde algorithm with LLMHandler
        console.log('📋 Step 5: Testing Hyde algorithm with LLMHandler...')
        
        const hyde = new Hyde({
            hypothesesPerQuery: 1,
            temperature: 0.1,
            maxTokens: 100
        })
        
        try {
            // Test hypothesis generation with a simple query
            const llmHandler = memoryManager.llmHandler
            const testQuery = "What is machine learning?"
            
            console.log(`   Testing with query: "${testQuery}"`)
            
            // Call the internal method directly to isolate the test
            const hypothesis = await hyde.generateSingleHypothesis(testQuery, llmHandler, { 
                temperature: 0.1, 
                model: chatProviderConfig.chatModel  // Use the correct model for the provider
            }, 0)
            
            console.log('✅ Hyde hypothesis generation working')
            console.log(`   Generated hypothesis with confidence: ${hypothesis.confidence}`)
            console.log(`   Content: "${hypothesis.content.substring(0, 100)}${hypothesis.content.length > 100 ? '...' : ''}"`)
            
        } catch (error) {
            throw new Error(`❌ Hyde algorithm failed: ${error.message}`)
        }
        
        // Cleanup
        await memoryManager.dispose()
        
        console.log('\n🎉 All tests passed! Interface compatibility fix is working.')
        console.log('\n✅ Summary of fixes:')
        console.log('   • MemoryManager now detects hyperdata-clients chat() method')
        console.log('   • LLMHandler supports both hyperdata-clients and legacy interfaces')
        console.log('   • Hyde algorithm can successfully use hyperdata-clients providers')
        
    } catch (error) {
        console.error(`\n💥 Test failed: ${error.message}`)
        process.exit(1)
    }
}

testHydeFix()