#!/usr/bin/env node

import Config from './src/Config.js'
import MemoryManager from './src/MemoryManager.js'
import InMemoryStore from './src/stores/InMemoryStore.js'
import EmbeddingConnectorFactory from './src/connectors/EmbeddingConnectorFactory.js'
import { ClientFactory } from 'hyperdata-clients'
import Hyde from './src/ragno/algorithms/Hyde.js'
import rdf from 'rdf-ext'
import logger from 'loglevel'

logger.setLevel('warn') // Reduce noise

async function quickTest() {
    try {
        const config = new Config('config/config.json')
        await config.init()
        
        const llmProviders = config.get('llmProviders')
        const chatProviderConfig = llmProviders.find(p => p.capabilities?.includes('chat'))
        
        const chatProvider = await ClientFactory.createClient(chatProviderConfig.type, {
            model: chatProviderConfig.chatModel,
            baseUrl: chatProviderConfig.baseUrl,
            apiKey: chatProviderConfig.apiKey
        })
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        })
        
        const storage = new InMemoryStore()
        const memoryManager = new MemoryManager({
            llmProvider: chatProvider,
            embeddingProvider: embeddingConnector,
            chatModel: chatProviderConfig.chatModel,
            embeddingModel: 'nomic-embed-text',
            storage
        })
        
        const hydeOptions = {
            hypothesesPerQuery: 1,
            temperature: 0.7,
            maxTokens: 100,
            model: chatProviderConfig.chatModel,
            extractEntities: false
        }
        
        const hyde = new Hyde(hydeOptions)
        const llmHandler = memoryManager.llmHandler
        const dataset = rdf.dataset()
        
        console.log('Testing confidence access...')
        
        const results = await hyde.generateHypotheses(
            "Test query",
            llmHandler,
            dataset,
            hydeOptions
        )
        
        if (results.hypotheses.length > 0) {
            const hypothesis = results.hypotheses[0]
            console.log('Hypothesis object properties:', Object.getOwnPropertyNames(hypothesis))
            console.log('Hypothesis prototype:', Object.getPrototypeOf(hypothesis).constructor.name)
            console.log('hypothesis.metadata:', hypothesis.metadata)
            console.log('hypothesis.getMetadata():', JSON.stringify(hypothesis.getMetadata(), null, 2))
        }
        
        await memoryManager.dispose()
        
    } catch (error) {
        console.error('Error:', error.message)
    }
}

quickTest()