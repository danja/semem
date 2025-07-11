#!/usr/bin/env node

/**
 * Debug script to test why "heterograph" search is not working
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import Config from './src/Config.js';
import RagnoSearch from './src/ragno/search/index.js';
import EmbeddingConnectorFactory from './src/connectors/EmbeddingConnectorFactory.js';
import EmbeddingHandler from './src/handlers/EmbeddingHandler.js';

async function debugHeterographSearch() {
    console.log('🔍 Debug: Heterograph Search Issue');
    console.log('=' .repeat(50));

    try {
        // Load configuration
        const config = new Config('config/config.json');
        await config.init();

        // Create embedding connector and handler
        const embeddingConnector = EmbeddingConnectorFactory.createConnector({
            provider: 'nomic',
            apiKey: process.env.NOMIC_API_KEY,
            model: 'nomic-embed-text:v1.5'
        });

        const embeddingHandler = new EmbeddingHandler(embeddingConnector, 'nomic-embed-text:v1.5', 768);

        // Initialize RagnoSearch
        const ragnoSearch = new RagnoSearch({
            vectorIndex: {
                dimension: 768,
                maxElements: 100000
            },
            sparqlEndpoint: 'http://localhost:3030/semem/query',
            embeddingHandler: embeddingHandler
        });

        await ragnoSearch.initialize();

        console.log('✅ RagnoSearch initialized');

        // Test 1: Generate embedding for "heterograph"
        console.log('\n🧪 Test 1: Generate embedding for "heterograph"');
        const queryEmbedding = await embeddingHandler.generateEmbedding('heterograph');
        console.log(`   Generated embedding length: ${queryEmbedding ? queryEmbedding.length : 'null'}`);
        console.log(`   First 5 values: ${queryEmbedding ? queryEmbedding.slice(0, 5).join(', ') : 'null'}`);

        // Test 2: Check vector index statistics
        console.log('\n🧪 Test 2: Vector index statistics');
        const stats = ragnoSearch.getStatistics();
        console.log(`   Total nodes in vector index: ${stats.vectorIndex.totalNodes}`);
        console.log(`   Available types: ${stats.vectorIndex.availableTypes.join(', ')}`);

        // Test 3: Direct vector search
        console.log('\n🧪 Test 3: Direct vector search for "heterograph"');
        if (queryEmbedding) {
            const vectorResults = ragnoSearch.vectorIndex.search(queryEmbedding, 20, {
                filterByTypes: ['ragno:Unit', 'ragno:TextElement'],
                efSearch: 200
            });
            
            console.log(`   Found ${vectorResults.length} vector results`);
            
            // Check top results for "heterograph" content
            for (let i = 0; i < Math.min(5, vectorResults.length); i++) {
                const result = vectorResults[i];
                const containsHeterograph = result.content && result.content.toLowerCase().includes('heterograph');
                console.log(`   Result ${i + 1}: similarity=${result.similarity.toFixed(4)}, contains_heterograph=${containsHeterograph}`);
                if (containsHeterograph) {
                    console.log(`      Content snippet: ${result.content.substring(0, 100)}...`);
                }
            }
        }

        // Test 4: Check if specific heterograph nodes exist in index
        console.log('\n🧪 Test 4: Check specific heterograph URIs in vector index');
        const heterographUris = [
            'http://purl.org/stuff/instance/chunk/af9d19ca3e504fad_3_93c7734e819f4896',
            'http://purl.org/stuff/instance/chunk/af9d19ca3e504fad_4_4c39a049a08c4ec8',
            'http://purl.org/stuff/instance/chunk/af9d19ca3e504fad_5_eed0a5eaf58ca77d'
        ];

        for (const uri of heterographUris) {
            const hasNode = ragnoSearch.hasNode(uri);
            console.log(`   URI exists in vector index: ${uri} -> ${hasNode}`);
            
            if (hasNode) {
                const metadata = ragnoSearch.getNodeMetadata(uri);
                const containsHeterograph = metadata.content && metadata.content.toLowerCase().includes('heterograph');
                console.log(`      Contains heterograph: ${containsHeterograph}`);
                if (containsHeterograph) {
                    console.log(`      Content snippet: ${metadata.content.substring(0, 100)}...`);
                }
            }
        }

        // Test 5: Manual similarity calculation
        console.log('\n🧪 Test 5: Manual similarity to known heterograph content');
        const knownHeterographUri = 'http://purl.org/stuff/instance/chunk/af9d19ca3e504fad_3_93c7734e819f4896';
        
        if (ragnoSearch.hasNode(knownHeterographUri)) {
            const metadata = ragnoSearch.getNodeMetadata(knownHeterographUri);
            console.log(`   Known heterograph content: ${metadata.content.substring(0, 100)}...`);
            
            // Find similar nodes
            const similarNodes = ragnoSearch.findSimilarNodes(knownHeterographUri, 10);
            console.log(`   Found ${similarNodes.length} similar nodes to known heterograph content`);
            
            for (let i = 0; i < Math.min(3, similarNodes.length); i++) {
                const similar = similarNodes[i];
                console.log(`      Similar ${i + 1}: similarity=${similar.similarity.toFixed(4)}, type=${similar.type}`);
            }
        }

        await ragnoSearch.shutdown();

    } catch (error) {
        console.error('❌ Debug failed:', error);
        console.error(error.stack);
    }
}

debugHeterographSearch().catch(console.error);