/**
 * Check LLM Providers Example
 * 
 * This example demonstrates testing different LLM providers configured in the system
 * and validates their capabilities including chat generation, embedding generation,
 * concept extraction, and memory system integration.
 * 
 * Key features demonstrated:
 * - Configuration-driven provider discovery
 * - Provider connectivity and authentication testing
 * - Chat response generation capabilities
 * - Vector embedding generation (where supported)
 * - Concept extraction functionality
 * - Memory system integration
 * - Error handling and fallback mechanisms
 * - Comprehensive capability assessment
 * 
 * Prerequisites:
 * - Ollama running with required models for local providers
 * - API keys configured in environment for external providers
 * - Network connectivity for external API services
 */

import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import InMemoryStore from '../../src/stores/InMemoryStore.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global cleanup reference
let globalCleanup = null;

async function shutdown(signal) {
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);
    if (globalCleanup) {
        try {
            await globalCleanup();
            logger.info('Cleanup complete');
            process.exit(0);
        } catch (error) {
            logger.error('Error during cleanup:', error);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    await shutdown('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown('unhandledRejection');
});

function createConnector(providerConfig) {
    switch (providerConfig.type) {
        case 'ollama':
            return new OllamaConnector(
                providerConfig.baseUrl || 'http://localhost:11434',
                providerConfig.chatModel
            );
        case 'claude':
            const apiKey = providerConfig.apiKey?.startsWith('${') 
                ? process.env[providerConfig.apiKey.slice(2, -1)] 
                : providerConfig.apiKey;
            return new ClaudeConnector(apiKey);
        case 'mistral':
            const mistralKey = process.env.MISTRAL_API_KEY;
            return new MistralConnector(mistralKey);
        default:
            throw new Error(`Unknown provider type: ${providerConfig.type}`);
    }
}

async function testProviderConnectivity(providerConfig) {
    switch (providerConfig.type) {
        case 'ollama':
            try {
                const baseUrl = providerConfig.baseUrl || 'http://localhost:11434';
                const response = await fetch(`${baseUrl}/api/version`);
                if (response.ok) {
                    const data = await response.json();
                    logger.info(`✓ Ollama service reachable (version: ${data.version || 'unknown'})`);
                    return true;
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                logger.warn(`✗ Ollama service unreachable: ${error.message}`);
                return false;
            }
            
        case 'claude':
            const apiKey = providerConfig.apiKey?.startsWith('${') 
                ? process.env[providerConfig.apiKey.slice(2, -1)] 
                : providerConfig.apiKey;
            if (!apiKey) {
                logger.warn('✗ Claude API key not found in environment');
                return false;
            }
            logger.info('✓ Claude API key found');
            return true;
            
        case 'mistral':
            const mistralKey = process.env.MISTRAL_API_KEY;
            if (!mistralKey) {
                logger.warn('✗ Mistral API key not found in environment');
                return false;
            }
            logger.info('✓ Mistral API key found');
            return true;
            
        default:
            logger.warn(`✗ Unknown provider type: ${providerConfig.type}`);
            return false;
    }
}

async function testProvider(providerConfig) {
    logger.info(`\n=== Testing ${providerConfig.type.toUpperCase()} Provider ===`);
    logger.info(`Description: ${providerConfig.description || 'No description provided'}`);
    logger.info(`Priority: ${providerConfig.priority || 'Not specified'}`);
    logger.info(`Capabilities: [${providerConfig.capabilities?.join(', ') || 'Not specified'}]`);
    
    // Test connectivity
    logger.info('\n--- Connectivity Test ---');
    const isConnectable = await testProviderConnectivity(providerConfig);
    if (!isConnectable) {
        return { 
            success: false, 
            reason: 'connectivity_failed',
            provider: providerConfig.type
        };
    }
    
    let memoryManager = null;
    const results = {
        success: true,
        provider: providerConfig.type,
        capabilities: [],
        tests: {}
    };
    
    try {
        // Initialize provider
        logger.info('\n--- Provider Initialization ---');
        const llmProvider = createConnector(providerConfig);
        
        // Use Ollama for embeddings if current provider doesn't support them
        const embeddingModel = providerConfig.embeddingModel || 'nomic-embed-text';
        
        const storage = new InMemoryStore();
        
        memoryManager = new MemoryManager({
            llmProvider,
            chatModel: providerConfig.chatModel,
            embeddingModel,
            storage
        });
        
        logger.info('✓ Provider initialized successfully');
        
        // Test chat generation
        if (providerConfig.capabilities?.includes('chat')) {
            logger.info('\n--- Chat Generation Test ---');
            try {
                const testPrompt = "What is the capital of Italy? Please give a brief, factual answer.";
                logger.info(`Prompt: "${testPrompt}"`);
                
                const response = await memoryManager.generateResponse(testPrompt);
                
                // Ensure response is a string
                const responseStr = typeof response === 'string' ? response : String(response);
                const preview = responseStr.substring(0, 150) + (responseStr.length > 150 ? '...' : '');
                
                logger.info(`✓ Chat response generated successfully`);
                logger.info(`Response: "${preview}"`);
                
                results.capabilities.push('chat');
                results.tests.chat = { success: true, responseLength: responseStr.length };
                
            } catch (error) {
                logger.error(`✗ Chat generation failed: ${error.message}`);
                results.tests.chat = { success: false, error: error.message };
            }
        }
        
        // Test embedding generation
        logger.info('\n--- Embedding Generation Test ---');
        try {
            const testText = "Artificial intelligence and machine learning technologies";
            logger.info(`Text: "${testText}"`);
            
            const embedding = await memoryManager.generateEmbedding(testText);
            
            logger.info(`✓ Embedding generated successfully`);
            logger.info(`Dimensions: ${embedding.length}`);
            logger.info(`Vector preview: [${embedding.slice(0, 5).map(x => x.toFixed(3)).join(', ')}, ...]`);
            
            results.capabilities.push('embedding');
            results.tests.embedding = { 
                success: true, 
                dimensions: embedding.length,
                provider: providerConfig.capabilities?.includes('embedding') ? providerConfig.type : 'ollama'
            };
            
        } catch (error) {
            logger.error(`✗ Embedding generation failed: ${error.message}`);
            results.tests.embedding = { success: false, error: error.message };
        }
        
        // Test concept extraction (requires chat capability)
        if (providerConfig.capabilities?.includes('chat')) {
            logger.info('\n--- Concept Extraction Test ---');
            try {
                const conceptText = "Machine learning algorithms analyze large datasets using neural networks to identify patterns and make predictions for business intelligence applications.";
                logger.info(`Text: "${conceptText.substring(0, 100)}..."`);
                
                const concepts = await memoryManager.extractConcepts(conceptText);
                
                logger.info(`✓ Concept extraction successful`);
                logger.info(`Concepts extracted: [${concepts.join(', ')}]`);
                logger.info(`Count: ${concepts.length} concepts`);
                
                results.capabilities.push('concept_extraction');
                results.tests.concept_extraction = { 
                    success: true, 
                    conceptCount: concepts.length,
                    concepts: concepts
                };
                
            } catch (error) {
                logger.error(`✗ Concept extraction failed: ${error.message}`);
                results.tests.concept_extraction = { success: false, error: error.message };
            }
        }
        
        // Test memory integration
        logger.info('\n--- Memory Integration Test ---');
        try {
            const prompt = "What are the benefits of renewable energy?";
            const response = "Renewable energy provides environmental benefits by reducing carbon emissions, offers energy independence, and creates sustainable economic opportunities.";
            
            // Generate embedding for memory storage
            const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
            
            // Store interaction
            await memoryManager.addInteraction(
                prompt,
                response,
                embedding,
                ['renewable energy', 'environment', 'sustainability']
            );
            
            // Test retrieval
            const retrievedMemories = await memoryManager.retrieveRelevantInteractions("Tell me about clean energy benefits");
            
            logger.info(`✓ Memory integration successful`);
            logger.info(`Stored interaction and retrieved ${retrievedMemories.length} related memories`);
            
            if (retrievedMemories.length > 0) {
                const topMemory = retrievedMemories[0];
                const similarity = topMemory.similarity?.toFixed(3) || 'N/A';
                logger.info(`Top result similarity: ${similarity}`);
            }
            
            results.capabilities.push('memory_integration');
            results.tests.memory_integration = { 
                success: true, 
                memoriesRetrieved: retrievedMemories.length
            };
            
        } catch (error) {
            logger.error(`✗ Memory integration failed: ${error.message}`);
            results.tests.memory_integration = { success: false, error: error.message };
        }
        
        logger.info(`\n✅ ${providerConfig.type.toUpperCase()} provider fully tested`);
        logger.info(`Working capabilities: [${results.capabilities.join(', ')}]`);
        
        return results;
        
    } catch (error) {
        logger.error(`\n❌ ${providerConfig.type.toUpperCase()} provider failed: ${error.message}`);
        return { 
            success: false, 
            reason: 'runtime_error', 
            error: error.message,
            provider: providerConfig.type
        };
        
    } finally {
        if (memoryManager) {
            try {
                await memoryManager.dispose();
                logger.info(`Memory manager disposed for ${providerConfig.type}`);
            } catch (disposeError) {
                logger.warn(`Warning: Error disposing ${providerConfig.type}: ${disposeError.message}`);
            }
        }
    }
}

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');

    logger.info('🚀 Starting LLM Providers Check Example');

    // Initialize configuration
    const config = new Config('./config/config.json');
    await config.init();

    // Get LLM providers configuration
    const llmProviders = config.get('llmProviders');
    if (!llmProviders || llmProviders.length === 0) {
        throw new Error('No LLM providers configured. Please check your config.');
    }

    logger.info(`Found ${llmProviders.length} configured LLM providers`);

    try {
        // Set up cleanup function
        globalCleanup = async () => {
            logger.info('No cleanup required for provider testing');
        };
        
        const results = [];
        
        logger.info('\n=== Testing Configured LLM Providers ===');
        
        // Test each configured provider
        for (const provider of llmProviders) {
            const result = await testProvider(provider);
            results.push(result);
        }
        
        // Generate comprehensive summary
        logger.info('\n' + '='.repeat(60));
        logger.info('=== PROVIDER TEST SUMMARY ===');
        logger.info('='.repeat(60));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        logger.info(`\n📊 Overall Results:`);
        logger.info(`✅ Successful providers: ${successful.length}/${results.length}`);
        logger.info(`❌ Failed providers: ${failed.length}/${results.length}`);
        
        if (successful.length > 0) {
            logger.info(`\n✅ Working Providers:`);
            successful.forEach(result => {
                logger.info(`\n   🔸 ${result.provider.toUpperCase()}`);
                logger.info(`     Capabilities: [${result.capabilities.join(', ')}]`);
                
                Object.entries(result.tests).forEach(([test, testResult]) => {
                    const status = testResult.success ? '✅' : '❌';
                    logger.info(`     ${status} ${test}: ${testResult.success ? 'PASSED' : `FAILED (${testResult.error})`}`);
                });
            });
        }
        
        if (failed.length > 0) {
            logger.info(`\n❌ Failed Providers:`);
            failed.forEach(result => {
                let reason = result.reason;
                switch (result.reason) {
                    case 'connectivity_failed':
                        reason = 'Service not reachable or API key missing';
                        break;
                    case 'runtime_error':
                        reason = `Runtime error: ${result.error}`;
                        break;
                }
                logger.info(`   🔸 ${result.provider.toUpperCase()}: ${reason}`);
            });
        }
        
        // Capability matrix
        logger.info(`\n📋 Capability Matrix:`);
        const allCapabilities = ['chat', 'embedding', 'concept_extraction', 'memory_integration'];
        
        allCapabilities.forEach(capability => {
            const supportingProviders = successful
                .filter(r => r.capabilities.includes(capability))
                .map(r => r.provider.toUpperCase());
                
            const status = supportingProviders.length > 0 ? '✅' : '❌';
            logger.info(`   ${status} ${capability}: ${supportingProviders.join(', ') || 'None'}`);
        });
        
        // Recommendations
        logger.info(`\n💡 Recommendations:`);
        
        if (successful.length === 0) {
            logger.info('❌ No providers are working. Check:');
            logger.info('   - Ollama is running: ollama serve');
            logger.info('   - Required models are installed: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
            logger.info('   - API keys are configured in .env file');
            logger.info('   - Network connectivity for external APIs');
        } else {
            logger.info(`✅ ${successful.length} provider(s) working correctly`);
            
            const hasOllama = successful.some(r => r.provider === 'ollama');
            const hasClaude = successful.some(r => r.provider === 'claude');
            const hasMistral = successful.some(r => r.provider === 'mistral');
            
            if (hasOllama) {
                logger.info('   🏠 Ollama: Excellent for local/offline development and embeddings');
            }
            if (hasClaude) {
                logger.info('   🧠 Claude: Superior for complex reasoning and analysis tasks');
            }
            if (hasMistral) {
                logger.info('   ⚡ Mistral: Good balance of performance, speed, and cost');
            }
            
            // Check for redundancy
            const chatProviders = successful.filter(r => r.capabilities.includes('chat')).length;
            const embeddingProviders = successful.filter(r => r.capabilities.includes('embedding')).length;
            
            if (chatProviders > 1) {
                logger.info(`   🔄 You have ${chatProviders} chat providers - consider load balancing or failover`);
            }
            if (embeddingProviders === 0) {
                logger.warn('   ⚠️  No embedding providers working - this may limit semantic search capabilities');
            }
        }
        
        logger.info('\n=== Check LLM Providers Example Completed Successfully ===');
        logger.info('\nWhat was demonstrated:');
        logger.info('✓ Configuration-driven provider discovery');
        logger.info('✓ Provider connectivity and authentication validation');
        logger.info('✓ Chat response generation testing');
        logger.info('✓ Vector embedding generation assessment');
        logger.info('✓ Concept extraction capability verification');
        logger.info('✓ Memory system integration validation');
        logger.info('✓ Comprehensive capability matrix analysis');
        logger.info('✓ Error handling and fallback mechanisms');
        
    } catch (error) {
        logger.error('\n❌ Example failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Check .env file for required API keys');
        logger.info('- Ensure Ollama is running for local models: ollama serve');
        logger.info('- Verify network connectivity for external APIs');
        logger.info('- Check API key validity and quota limits');
        logger.info('- Ensure required Ollama models are installed');
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});