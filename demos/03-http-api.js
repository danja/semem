#!/usr/bin/env node

/**
 * Demo: HTTP API Functionality
 * Tests REST API endpoints for memory, chat, search, and system operations
 * 
 * Path: ./demos/03-http-api.js
 * Run: node demos/03-http-api.js
 * 
 * Expected: Successfully interacts with HTTP API endpoints
 * Prerequisites: API server running (node servers/api-server.js)
 */

import fetch from 'node-fetch';
import logger from 'loglevel';

logger.setLevel('info');

const API_BASE = 'http://localhost:4100';
const API_KEY = 'semem-dev-key'; // Default dev key from auth middleware

async function makeAPIRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
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

async function testHTTPAPI() {
    console.log('=== DEMO: HTTP API Functionality ===\n');
    
    try {
        // Test API health
        console.log('1. Testing API health...');
        
        const health = await makeAPIRequest('/api/health');
        console.log('   ✓ API is healthy');
        console.log(`   Status: ${health.status}`);
        console.log(`   Uptime: ${Math.round(health.uptime)}s`);
        
        if (health.components) {
            console.log('   Components:');
            Object.entries(health.components).forEach(([name, component]) => {
                console.log(`     - ${name}: ${component.status}`);
            });
        }
        
        // Test memory storage
        console.log('\n2. Testing memory storage API...');
        
        const memoryData = {
            prompt: "What is the capital of France?",
            response: "The capital of France is Paris, known for the Eiffel Tower and rich cultural heritage.",
            metadata: {
                source: "geography_qa",
                timestamp: Date.now()
            }
        };
        
        console.log(`   Storing: "${memoryData.prompt}"`);
        const storeResult = await makeAPIRequest('/api/memory', {
            method: 'POST',
            body: JSON.stringify(memoryData)
        });
        
        console.log('   ✓ Memory stored successfully');
        console.log(`   ID: ${storeResult.id}`);
        console.log(`   Concepts: [${(storeResult.concepts || []).join(', ')}]`);
        
        // Test memory search
        console.log('\n3. Testing memory search API...');
        
        const searchQueries = [
            "Tell me about Paris",
            "What do you know about France?",
            "European capitals"
        ];
        
        for (const query of searchQueries) {
            console.log(`\n   Query: "${query}"`);
            
            const searchParams = new URLSearchParams({
                query: query,
                limit: '3',
                threshold: '0.6'
            });
            
            const searchResult = await makeAPIRequest(`/api/memory/search?${searchParams}`);
            
            console.log(`   Found ${searchResult.count} results:`);
            searchResult.results.forEach((result, idx) => {
                console.log(`     ${idx + 1}. Similarity: ${result.similarity?.toFixed(2) || 'N/A'}`);
                console.log(`        Prompt: "${result.prompt}"`);
            });
        }
        
        // Test embedding generation
        console.log('\n4. Testing embedding generation API...');
        
        const embeddingText = "Artificial intelligence and machine learning";
        console.log(`   Text: "${embeddingText}"`);
        
        const embeddingResult = await makeAPIRequest('/api/memory/embedding', {
            method: 'POST',
            body: JSON.stringify({
                text: embeddingText,
                model: 'nomic-embed-text'
            })
        });
        
        console.log('   ✓ Embedding generated successfully');
        console.log(`   Dimensions: ${embeddingResult.dimension}`);
        console.log(`   Model: ${embeddingResult.model}`);
        console.log(`   Vector preview: [${embeddingResult.embedding.slice(0, 5).map(x => x.toFixed(3)).join(', ')}, ...]`);
        
        // Test concept extraction
        console.log('\n5. Testing concept extraction API...');
        
        const conceptText = "Machine learning algorithms use neural networks to process large datasets and identify patterns for predictive analytics.";
        console.log(`   Text: "${conceptText}"`);
        
        const conceptResult = await makeAPIRequest('/api/memory/concepts', {
            method: 'POST',
            body: JSON.stringify({
                text: conceptText
            })
        });
        
        console.log('   ✓ Concepts extracted successfully');
        console.log(`   Concepts: [${conceptResult.concepts.join(', ')}]`);
        
        // Test chat API
        console.log('\n6. Testing chat API...');
        
        const chatPrompt = "Based on what you know about France, tell me something interesting about Paris.";
        console.log(`   Prompt: "${chatPrompt}"`);
        
        const chatResult = await makeAPIRequest('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                prompt: chatPrompt,
                useMemory: true,
                temperature: 0.7
            })
        });
        
        console.log('   ✓ Chat response generated');
        console.log(`   Response: "${chatResult.response}"`);
        console.log(`   Conversation ID: ${chatResult.conversationId}`);
        console.log(`   Used ${chatResult.memoryIds?.length || 0} memory references`);
        
        // Test search API
        console.log('\n7. Testing search API...');
        
        const searchQuery = "European geography and capitals";
        console.log(`   Query: "${searchQuery}"`);
        
        const searchParams = new URLSearchParams({
            query: searchQuery,
            limit: '3'
        });
        
        const contentSearchResult = await makeAPIRequest(`/api/search?${searchParams}`);
        
        console.log(`   ✓ Search completed`);
        console.log(`   Found ${contentSearchResult.count} results:`);
        contentSearchResult.results.forEach((result, idx) => {
            console.log(`     ${idx + 1}. Type: ${result.type || 'memory'}`);
            console.log(`        Title: "${result.title}"`);
            console.log(`        Similarity: ${result.similarity?.toFixed(2) || 'N/A'}`);
        });
        
        // Test metrics API
        console.log('\n8. Testing metrics API...');
        
        const metrics = await makeAPIRequest('/api/metrics');
        console.log('   ✓ Metrics retrieved');
        console.log(`   Timestamp: ${new Date(metrics.data.timestamp).toISOString()}`);
        console.log(`   API Count: ${metrics.data.apiCount}`);
        
        if (metrics.data.memory) {
            console.log('   Memory API metrics available');
        }
        if (metrics.data.chat) {
            console.log('   Chat API metrics available');
        }
        
        console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        console.log('\nWhat was tested:');
        console.log('- API health and status endpoints');
        console.log('- Memory storage and retrieval operations');
        console.log('- Vector embedding generation');
        console.log('- Concept extraction from text');
        console.log('- Chat with memory context');
        console.log('- Semantic search functionality');
        console.log('- System metrics and monitoring');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        
        if (error.cause?.code === 'ECONNREFUSED') {
            console.log('\nTroubleshooting:');
            console.log('- Start the API server: node servers/api-server.js');
            console.log('- Ensure server is running on port 4100');
            console.log('- Check if Ollama is running for LLM operations');
        } else {
            console.error('Stack:', error.stack);
        }
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

testHTTPAPI();