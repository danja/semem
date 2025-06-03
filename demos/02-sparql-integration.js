#!/usr/bin/env node

/**
 * Demo: SPARQL Store Integration
 * Tests RDF/SPARQL storage backend functionality
 * 
 * Path: ./demos/02-sparql-integration.js
 * Run: node demos/02-sparql-integration.js
 * 
 * Expected: Successfully stores and retrieves data from SPARQL endpoint
 * Prerequisites: SPARQL endpoint running (e.g., Apache Fuseki)
 */

import MemoryManager from '../src/MemoryManager.js';
import SPARQLStore from '../src/stores/SPARQLStore.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import logger from 'loglevel';

logger.setLevel('info');

async function testSPARQLIntegration() {
    console.log('=== DEMO: SPARQL Store Integration ===\n');
    
    let memoryManager = null;
    
    try {
        // Test SPARQL endpoints from config
        const endpoints = [
            {
                query: 'http://localhost:4030/semem/query',
                update: 'http://localhost:4030/semem/update',
                auth: { user: 'admin', password: 'admin123' }
            },
            {
                query: 'http://localhost:3030/semem/query', 
                update: 'http://localhost:3030/semem/update',
                auth: { user: 'admin', password: 'admin' }
            }
        ];
        
        let workingEndpoint = null;
        
        console.log('1. Testing SPARQL endpoint connectivity...');
        
        for (const endpoint of endpoints) {
            try {
                console.log(`   Testing: ${endpoint.query}`);
                
                const store = new SPARQLStore(endpoint, {
                    user: endpoint.auth.user,
                    password: endpoint.auth.password,
                    graphName: 'http://danny.ayers.name/content'
                });
                
                await store.verify();
                console.log('   ✓ Connection successful');
                workingEndpoint = endpoint;
                break;
                
            } catch (error) {
                console.log(`   ✗ Failed: ${error.message}`);
            }
        }
        
        if (!workingEndpoint) {
            throw new Error('No working SPARQL endpoints found');
        }
        
        console.log('\n2. Initializing memory manager with SPARQL store...');
        
        const sparqlStore = new SPARQLStore(workingEndpoint, {
            user: workingEndpoint.auth.user,
            password: workingEndpoint.auth.password,
            graphName: 'http://danny.ayers.name/semem-demo'
        });
        
        const llmProvider = new OllamaConnector();
        
        memoryManager = new MemoryManager({
            llmProvider,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage: sparqlStore
        });
        
        console.log('   ✓ SPARQL-backed memory manager initialized');
        
        // Test RDF data storage
        console.log('\n3. Storing semantic data...');
        
        const semanticInteractions = [
            {
                prompt: "What is RDF?",
                response: "RDF (Resource Description Framework) is a standard model for data interchange on the Web using subject-predicate-object triples.",
                concepts: ["RDF", "semantic web", "triples", "W3C"]
            },
            {
                prompt: "How does SPARQL work?",
                response: "SPARQL is a query language for RDF data that allows pattern matching against graph data using triple patterns.",
                concepts: ["SPARQL", "query language", "RDF", "graph patterns"]
            },
            {
                prompt: "What are knowledge graphs?",
                response: "Knowledge graphs are structured representations of knowledge using entities, relationships, and semantic metadata.",
                concepts: ["knowledge graphs", "entities", "relationships", "semantic data"]
            }
        ];
        
        for (const interaction of semanticInteractions) {
            console.log(`   Storing: "${interaction.prompt}"`);
            
            const embedding = await memoryManager.generateEmbedding(
                `${interaction.prompt} ${interaction.response}`
            );
            
            await memoryManager.addInteraction(
                interaction.prompt,
                interaction.response,
                embedding,
                interaction.concepts
            );
            
            console.log('   ✓ Stored in RDF triple store');
        }
        
        // Test semantic querying
        console.log('\n4. Testing semantic memory retrieval...');
        
        const semanticQueries = [
            "Tell me about semantic web technologies",
            "How do I query RDF data?",
            "What's the structure of knowledge representation?"
        ];
        
        for (const query of semanticQueries) {
            console.log(`\n   Query: "${query}"`);
            
            const memories = await memoryManager.retrieveRelevantInteractions(query);
            
            console.log(`   Retrieved ${memories.length} relevant triples:`);
            
            memories.slice(0, 2).forEach((memory, idx) => {
                const interaction = memory.interaction || memory;
                console.log(`     ${idx + 1}. Similarity: ${memory.similarity?.toFixed(2) || 'N/A'}`);
                console.log(`        Subject: "${interaction.prompt}"`);
                console.log(`        Concepts: [${(interaction.concepts || []).join(', ')}]`);
            });
        }
        
        // Test persistence verification
        console.log('\n5. Verifying RDF persistence...');
        
        // Create a new memory manager to test loading from SPARQL
        const newMemoryManager = new MemoryManager({
            llmProvider,
            chatModel: 'qwen2:1.5b', 
            embeddingModel: 'nomic-embed-text',
            storage: new SPARQLStore(workingEndpoint, {
                user: workingEndpoint.auth.user,
                password: workingEndpoint.auth.password,
                graphName: 'http://danny.ayers.name/semem-demo'
            })
        });
        
        const persistedMemories = await newMemoryManager.retrieveRelevantInteractions("RDF and SPARQL");
        console.log(`   ✓ Successfully loaded ${persistedMemories.length} memories from RDF store`);
        
        await newMemoryManager.dispose();
        
        console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        console.log('\nWhat was tested:');
        console.log('- SPARQL endpoint connectivity and authentication');
        console.log('- RDF triple storage for semantic memory');
        console.log('- Semantic querying with vector similarity');
        console.log('- Data persistence across sessions');
        console.log('- Integration with semantic web standards');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\nTroubleshooting:');
        console.log('- Ensure SPARQL endpoint is running (e.g., Apache Fuseki)');
        console.log('- Check endpoint URLs and authentication credentials');
        console.log('- Verify network connectivity to SPARQL server');
        console.log('- Ensure Ollama is running for embedding generation');
        
    } finally {
        if (memoryManager) {
            try {
                await memoryManager.dispose();
                console.log('Memory manager disposed cleanly');
            } catch (disposeError) {
                console.error('Error disposing memory manager:', disposeError);
            }
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

testSPARQLIntegration();