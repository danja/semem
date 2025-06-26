/**
 * HTTP Calls Example
 * 
 * This example demonstrates comprehensive HTTP API functionality by testing
 * REST API endpoints for memory, chat, search, and system operations.
 * 
 * Key features demonstrated:
 * - API health and status endpoints
 * - Memory storage and retrieval operations
 * - Vector embedding generation
 * - Concept extraction from text
 * - Chat with memory context
 * - Semantic search functionality
 * - System metrics and monitoring
 * - Configuration-driven server connectivity
 * 
 * Prerequisites: 
 * - API servers running (node servers/start-all.js)
 * - Ollama running for LLM operations
 */

import fetch from 'node-fetch';
import Config from '../../src/Config.js';
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

async function makeAPIRequest(baseUrl, endpoint, options = {}, config = null) {
    const url = `${baseUrl}${endpoint}`;
    
    // Get API key from environment or config
    const apiKey = process.env.SEMEM_API_KEY || 
                   config?.get('api.key') || 
                   'semem-dev-key'; // Default dev key from auth middleware
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
    };
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${data.error || data.message || 'Unknown error'}`);
    }
    
    return data;
}

async function checkServerHealth(baseUrl, serverName) {
    try {
        const response = await fetch(`${baseUrl}/api/health`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            const health = await response.json();
            logger.info(`✓ ${serverName} is healthy (${health.status})`);
            return true;
        } else {
            logger.warn(`✗ ${serverName} responded with status ${response.status}`);
            return false;
        }
    } catch (error) {
        logger.warn(`✗ ${serverName} not accessible: ${error.message}`);
        return false;
    }
}

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');

    logger.info('🚀 Starting HTTP Calls Example');

    // Initialize configuration
    const config = new Config('../config/config.json');
    await config.init();

    // Get server configuration with fallbacks
    const serverConfig = config.get('servers');
    const apiPort = serverConfig?.api || 4100;  // Default API port
    const uiPort = serverConfig?.ui || 4120;     // Default UI port
    const apiBaseUrl = `http://localhost:${apiPort}`;
    const uiBaseUrl = `http://localhost:${uiPort}`;

    logger.info(`API Server URL: ${apiBaseUrl}`);
    logger.info(`UI Server URL: ${uiBaseUrl}`);

    try {
        // Check if servers are running
        logger.info('\n=== Checking Server Availability ===');
        
        const apiHealthy = await checkServerHealth(apiBaseUrl, 'API Server');
        const uiHealthy = await checkServerHealth(uiBaseUrl, 'UI Server');
        
        if (!apiHealthy) {
            throw new Error(`API Server not available at ${apiBaseUrl}. Please start servers with: node servers/start-all.js`);
        }
        
        if (!uiHealthy) {
            logger.warn(`UI Server not available at ${uiBaseUrl}, continuing with API tests only`);
        }
        
        // Set up cleanup function
        globalCleanup = async () => {
            logger.info('No cleanup required for HTTP API client');
        };
        
        // Test API health in detail
        logger.info('\n=== Testing API Health ===');
        
        const health = await makeAPIRequest(apiBaseUrl, '/api/health', {}, config);
        logger.info('✓ API health check passed');
        logger.info(`Status: ${health.status}`);
        logger.info(`Uptime: ${Math.round(health.uptime)}s`);
        
        if (health.components) {
            logger.info('Components status:');
            Object.entries(health.components).forEach(([name, component]) => {
                logger.info(`  - ${name}: ${component.status}`);
            });
        }
        
        // Test memory storage
        logger.info('\n=== Testing Memory Storage API ===');
        
        const memoryData = {
            prompt: "What is the capital of France?",
            response: "The capital of France is Paris, known for the Eiffel Tower and rich cultural heritage.",
            metadata: {
                source: "geography_qa",
                timestamp: Date.now(),
                example: "HTTP API Demo"
            }
        };
        
        logger.info(`Storing: "${memoryData.prompt}"`);
        const storeResult = await makeAPIRequest(apiBaseUrl, '/api/memory', {
            method: 'POST',
            body: JSON.stringify(memoryData)
        }, config);
        
        logger.info('✓ Memory stored successfully');
        logger.info(`ID: ${storeResult.id}`);
        logger.info(`Concepts: [${(storeResult.concepts || []).join(', ')}]`);
        
        // Test memory search
        logger.info('\n=== Testing Memory Search API ===');
        
        const searchQueries = [
            "Tell me about Paris",
            "What do you know about France?",
            "European capitals",
            "French culture and heritage"
        ];
        
        for (const query of searchQueries) {
            logger.info(`\nQuery: "${query}"`);
            
            const searchParams = new URLSearchParams({
                query: query,
                limit: '3',
                threshold: '0.5'
            });
            
            const searchResult = await makeAPIRequest(apiBaseUrl, `/api/memory/search?${searchParams}`, {}, config);
            
            logger.info(`Found ${searchResult.count} results:`);
            searchResult.results.forEach((result, idx) => {
                const similarity = result.similarity?.toFixed(3) || 'N/A';
                logger.info(`  ${idx + 1}. Similarity: ${similarity}`);
                logger.info(`     Prompt: "${result.prompt}"`);
                if (result.metadata?.source) {
                    logger.info(`     Source: ${result.metadata.source}`);
                }
            });
        }
        
        // Test embedding generation
        logger.info('\n=== Testing Embedding Generation API ===');
        
        const embeddingText = "Artificial intelligence and machine learning technologies";
        logger.info(`Text: "${embeddingText}"`);
        
        const embeddingResult = await makeAPIRequest(apiBaseUrl, '/api/memory/embedding', {
            method: 'POST',
            body: JSON.stringify({
                text: embeddingText,
                model: 'nomic-embed-text'
            })
        }, config);
        
        logger.info('✓ Embedding generated successfully');
        logger.info(`Dimensions: ${embeddingResult.dimension}`);
        logger.info(`Model: ${embeddingResult.model}`);
        logger.info(`Vector preview: [${embeddingResult.embedding.slice(0, 5).map(x => x.toFixed(3)).join(', ')}, ...]`);
        
        // Test concept extraction
        logger.info('\n=== Testing Concept Extraction API ===');
        
        const conceptText = "Machine learning algorithms use neural networks to process large datasets and identify patterns for predictive analytics in artificial intelligence applications.";
        logger.info(`Text: "${conceptText}"`);
        
        const conceptResult = await makeAPIRequest(apiBaseUrl, '/api/memory/concepts', {
            method: 'POST',
            body: JSON.stringify({
                text: conceptText
            })
        }, config);
        
        logger.info('✓ Concepts extracted successfully');
        logger.info(`Concepts: [${conceptResult.concepts.join(', ')}]`);
        
        // Test chat API
        logger.info('\n=== Testing Chat API ===');
        
        const chatPrompt = "Based on what you know about France, tell me something interesting about Paris.";
        logger.info(`Prompt: "${chatPrompt}"`);
        
        const chatResult = await makeAPIRequest(apiBaseUrl, '/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                prompt: chatPrompt,
                useMemory: true,
                temperature: 0.7,
                maxTokens: 200
            })
        }, config);
        
        logger.info('✓ Chat response generated');
        logger.info(`Response: "${chatResult.response}"`);
        logger.info(`Conversation ID: ${chatResult.conversationId}`);
        logger.info(`Used ${chatResult.memoryIds?.length || 0} memory references`);
        
        // Test search API
        logger.info('\n=== Testing Search API ===');
        
        const searchQuery = "European geography and capitals";
        logger.info(`Query: "${searchQuery}"`);
        
        const searchParams = new URLSearchParams({
            query: searchQuery,
            limit: '3'
        });
        
        const contentSearchResult = await makeAPIRequest(apiBaseUrl, `/api/search?${searchParams}`, {}, config);
        
        logger.info('✓ Search completed');
        logger.info(`Found ${contentSearchResult.count} results:`);
        contentSearchResult.results.forEach((result, idx) => {
            const similarity = result.similarity?.toFixed(3) || 'N/A';
            logger.info(`  ${idx + 1}. Type: ${result.type || 'memory'}`);
            logger.info(`     Title: "${result.title}"`);
            logger.info(`     Similarity: ${similarity}`);
        });
        
        // Test metrics API
        logger.info('\n=== Testing Metrics API ===');
        
        const metrics = await makeAPIRequest(apiBaseUrl, '/api/metrics', {}, config);
        logger.info('✓ Metrics retrieved');
        logger.info(`Timestamp: ${new Date(metrics.data.timestamp).toISOString()}`);
        logger.info(`API Request Count: ${metrics.data.apiCount}`);
        
        if (metrics.data.memory) {
            logger.info('✓ Memory API metrics available');
        }
        if (metrics.data.chat) {
            logger.info('✓ Chat API metrics available');
        }
        if (metrics.data.search) {
            logger.info('✓ Search API metrics available');
        }
        
        // Test multiple interactions to demonstrate persistence
        logger.info('\n=== Testing Multiple Interactions ===');
        
        const additionalInteractions = [
            {
                prompt: "What is the Eiffel Tower?",
                response: "The Eiffel Tower is an iron lattice tower located in Paris, France. It was built in 1889 and is one of the most recognizable landmarks in the world.",
                metadata: { topic: "landmarks", location: "Paris" }
            },
            {
                prompt: "What is French cuisine known for?",
                response: "French cuisine is known for its sophistication, use of fresh ingredients, and techniques like sautéing, braising, and flambéing. Famous dishes include croissants, coq au vin, and ratatouille.",
                metadata: { topic: "cuisine", culture: "French" }
            }
        ];
        
        for (const interaction of additionalInteractions) {
            logger.info(`Storing: "${interaction.prompt}"`);
            
            await makeAPIRequest(apiBaseUrl, '/api/memory', {
                method: 'POST',
                body: JSON.stringify(interaction)
            }, config);
            
            logger.info('✓ Stored successfully');
        }
        
        // Final comprehensive search
        const finalSearch = await makeAPIRequest(apiBaseUrl, '/api/memory/search?' + new URLSearchParams({
            query: "Paris France culture",
            limit: '5'
        }), {}, config);
        
        logger.info(`\nFinal search found ${finalSearch.count} related memories about Paris and France`);
        
        logger.info('\n=== HTTP Calls Example Completed Successfully ===');
        logger.info('\nWhat was demonstrated:');
        logger.info('✓ Server connectivity verification');
        logger.info('✓ API health and status monitoring');
        logger.info('✓ Memory storage and retrieval operations');
        logger.info('✓ Vector embedding generation');
        logger.info('✓ Concept extraction from text');
        logger.info('✓ Chat with memory context');
        logger.info('✓ Semantic search functionality');
        logger.info('✓ System metrics and monitoring');
        logger.info('✓ Configuration-driven API endpoints');
        logger.info('✓ Persistent memory across multiple interactions');
        
    } catch (error) {
        logger.error('\n❌ Example failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED') || error.message.includes('not available')) {
            logger.info('\nTroubleshooting:');
            logger.info('- Start the servers: node servers/start-all.js');
            logger.info('- Ensure servers are running on configured ports');
            logger.info('- Check if Ollama is running for LLM operations: ollama serve');
            logger.info('- Verify required models: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
            logger.info('- Check server configuration in config/config.json');
        } else {
            logger.error('Stack:', error.stack);
        }
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});