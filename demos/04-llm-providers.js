#!/usr/bin/env node

/**
 * Demo: LLM Provider Integration
 * Tests different LLM providers (Ollama, Claude, Mistral) with the memory system
 * 
 * Path: ./demos/04-llm-providers.js
 * Run: node demos/04-llm-providers.js
 * 
 * Expected: Successfully tests available LLM providers and their capabilities
 */

import MemoryManager from '../src/MemoryManager.js';
import InMemoryStore from '../src/stores/InMemoryStore.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../src/connectors/ClaudeConnector.js';
import MistralConnector from '../src/connectors/MistralConnector.js';
import ClientConnector from '../src/connectors/ClientConnector.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

dotenv.config();
logger.setLevel('info');

const providers = [
    {
        name: 'Ollama',
        connector: () => new OllamaConnector(),
        chatModel: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text',
        requiresApiKey: false,
        testEndpoint: 'http://localhost:11434/api/version'
    },
    {
        name: 'Claude (Direct)',
        connector: () => new ClaudeConnector(process.env.CLAUDE_API_KEY),
        chatModel: 'claude-3-opus-20240229',
        embeddingModel: null, // Claude doesn't support embeddings
        requiresApiKey: true,
        apiKeyEnv: 'CLAUDE_API_KEY',
        testEndpoint: null
    },
    {
        name: 'Mistral',
        connector: () => new MistralConnector(process.env.MISTRAL_API_KEY),
        chatModel: 'mistral-medium',
        embeddingModel: 'mistral-embed',
        requiresApiKey: true,
        apiKeyEnv: 'MISTRAL_API_KEY',
        testEndpoint: null
    },
    {
        name: 'Client Factory (Mistral)',
        connector: () => new ClientConnector('mistral', 'open-codestral-mamba'),
        chatModel: 'open-codestral-mamba',
        embeddingModel: null, // Using Ollama for embeddings
        requiresApiKey: true,
        apiKeyEnv: 'MISTRAL_API_KEY',
        testEndpoint: null
    }
];

async function testProvider(providerConfig) {
    console.log(`\n--- Testing ${providerConfig.name} ---`);
    
    // Check API key requirement
    if (providerConfig.requiresApiKey) {
        const apiKey = process.env[providerConfig.apiKeyEnv];
        if (!apiKey) {
            console.log(`   ⚠️  Skipped: ${providerConfig.apiKeyEnv} not found in environment`);
            return { success: false, reason: 'missing_api_key' };
        }
        console.log(`   ✓ API key found for ${providerConfig.name}`);
    }
    
    // Test endpoint connectivity if available
    if (providerConfig.testEndpoint) {
        try {
            console.log(`   Testing connectivity to ${providerConfig.testEndpoint}...`);
            const response = await fetch(providerConfig.testEndpoint);
            if (response.ok) {
                console.log('   ✓ Service is reachable');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`   ✗ Service unreachable: ${error.message}`);
            return { success: false, reason: 'service_unreachable' };
        }
    }
    
    let memoryManager = null;
    
    try {
        // Initialize provider
        console.log('   Initializing provider...');
        const llmProvider = providerConfig.connector();
        
        // For embedding-only providers, use Ollama as fallback
        const embeddingProvider = providerConfig.embeddingModel ? llmProvider : new OllamaConnector();
        
        const storage = new InMemoryStore();
        
        memoryManager = new MemoryManager({
            llmProvider,
            embeddingProvider,
            chatModel: providerConfig.chatModel,
            embeddingModel: providerConfig.embeddingModel || 'nomic-embed-text',
            storage
        });
        
        console.log('   ✓ Provider initialized');
        
        // Test chat generation
        console.log('   Testing chat generation...');
        const testPrompt = "What is the capital of Italy? Give a brief answer.";
        
        const response = await memoryManager.generateResponse(testPrompt);
        console.log(`   ✓ Chat response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
        
        // Test embedding generation (using appropriate provider)
        console.log('   Testing embedding generation...');
        const embedding = await memoryManager.generateEmbedding("Test text for embedding");
        console.log(`   ✓ Embedding generated: ${embedding.length} dimensions`);
        
        // Test concept extraction
        console.log('   Testing concept extraction...');
        const concepts = await memoryManager.extractConcepts("Machine learning algorithms analyze large datasets to find patterns.");
        console.log(`   ✓ Concepts extracted: [${concepts.join(', ')}]`);
        
        // Test memory integration
        console.log('   Testing memory integration...');
        await memoryManager.addInteraction(
            testPrompt,
            response,
            embedding,
            concepts
        );
        
        const retrievedMemories = await memoryManager.retrieveRelevantInteractions("Tell me about European capitals");
        console.log(`   ✓ Memory integration: ${retrievedMemories.length} memories retrieved`);
        
        console.log(`   ✅ ${providerConfig.name} fully functional`);
        
        return { success: true, capabilities: ['chat', 'embedding', 'memory'] };
        
    } catch (error) {
        console.log(`   ❌ ${providerConfig.name} failed: ${error.message}`);
        return { success: false, reason: 'runtime_error', error: error.message };
        
    } finally {
        if (memoryManager) {
            try {
                await memoryManager.dispose();
            } catch (disposeError) {
                console.log(`   Warning: Error disposing ${providerConfig.name}: ${disposeError.message}`);
            }
        }
    }
}

async function testLLMProviders() {
    console.log('=== DEMO: LLM Provider Integration ===\n');
    
    const results = [];
    
    try {
        console.log('Testing multiple LLM providers with Semem memory system...\n');
        
        // Test each provider
        for (const provider of providers) {
            const result = await testProvider(provider);
            results.push({
                name: provider.name,
                ...result
            });
        }
        
        // Summary
        console.log('\n=== PROVIDER TEST SUMMARY ===');
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`\n✅ Successful providers (${successful.length}):`);
        successful.forEach(result => {
            console.log(`   - ${result.name}: ${result.capabilities?.join(', ') || 'basic functionality'}`);
        });
        
        if (failed.length > 0) {
            console.log(`\n❌ Failed providers (${failed.length}):`);
            failed.forEach(result => {
                let reason = result.reason;
                switch (result.reason) {
                    case 'missing_api_key':
                        reason = 'API key not configured';
                        break;
                    case 'service_unreachable':
                        reason = 'Service not running/reachable';
                        break;
                    case 'runtime_error':
                        reason = `Runtime error: ${result.error}`;
                        break;
                }
                console.log(`   - ${result.name}: ${reason}`);
            });
        }
        
        // Recommendations
        console.log('\n=== RECOMMENDATIONS ===');
        
        if (successful.length === 0) {
            console.log('❌ No providers are working. Check:');
            console.log('   - Ollama is running: ollama serve');
            console.log('   - Required models are installed: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
            console.log('   - API keys are configured in .env file');
        } else {
            console.log(`✅ ${successful.length} provider(s) working correctly`);
            
            if (successful.some(r => r.name.includes('Ollama'))) {
                console.log('   - Ollama: Good for local/offline development');
            }
            if (successful.some(r => r.name.includes('Claude'))) {
                console.log('   - Claude: Excellent for complex reasoning tasks');
            }
            if (successful.some(r => r.name.includes('Mistral'))) {
                console.log('   - Mistral: Good balance of performance and cost');
            }
        }
        
        console.log('\n✅ DEMO COMPLETED');
        console.log('\nWhat was tested:');
        console.log('- Provider connectivity and authentication');
        console.log('- Chat response generation');
        console.log('- Vector embedding generation');
        console.log('- Concept extraction capabilities');
        console.log('- Memory system integration');
        console.log('- Error handling and fallback mechanisms');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\nTroubleshooting:');
        console.log('- Check .env file for API keys');
        console.log('- Ensure Ollama is running for local models');
        console.log('- Verify network connectivity for external APIs');
        console.log('- Check API key validity and quota limits');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    process.exit(0);
});

testLLMProviders();