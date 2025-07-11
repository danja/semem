#!/usr/bin/env node

/**
 * Debug script to test type filtering issue in vector search
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

async function debugTypeFiltering() {
    console.log('🔍 Debug: Type Filtering Issue');
    console.log('=' .repeat(50));

    try {
        // Load configuration and initialize
        const config = new Config('config/config.json');
        await config.init();

        const embeddingConnector = EmbeddingConnectorFactory.createConnector({
            provider: 'nomic',
            apiKey: process.env.NOMIC_API_KEY,
            model: 'nomic-embed-text:v1.5'
        });

        const embeddingHandler = new EmbeddingHandler(embeddingConnector, 'nomic-embed-text:v1.5', 768);

        const ragnoSearch = new RagnoSearch({
            vectorIndex: { dimension: 768, maxElements: 100000 },
            sparqlEndpoint: 'http://localhost:3030/semem/query',
            embeddingHandler: embeddingHandler
        });

        await ragnoSearch.initialize();

        // Generate embedding for "heterograph"
        const queryEmbedding = await embeddingHandler.generateEmbedding('heterograph');
        console.log(`✅ Generated embedding for "heterograph"`);

        // Test 1: Search without type filtering
        console.log('\n🧪 Test 1: Search without type filtering');
        const allResults = ragnoSearch.vectorIndex.search(queryEmbedding, 10);
        console.log(`   Found ${allResults.length} results without filtering`);
        
        for (let i = 0; i < Math.min(3, allResults.length); i++) {
            const result = allResults[i];
            console.log(`   Result ${i + 1}: type="${result.type}", similarity=${result.similarity.toFixed(4)}`);
            const containsHeterograph = result.content && result.content.toLowerCase().includes('heterograph');
            console.log(`      Contains heterograph: ${containsHeterograph}`);
        }

        // Test 2: Search with type filtering using exact type from results
        if (allResults.length > 0) {
            const firstResultType = allResults[0].type;
            console.log(`\n🧪 Test 2: Search with type filtering for "${firstResultType}"`);
            
            const filteredResults = ragnoSearch.vectorIndex.search(queryEmbedding, 10, {
                filterByTypes: [firstResultType]
            });
            console.log(`   Found ${filteredResults.length} results with type filter`);
        }

        // Test 3: Check the searchByTypes method specifically
        console.log('\n🧪 Test 3: Using searchByTypes method');
        const typeSearchResults = ragnoSearch.vectorIndex.searchByTypes(
            queryEmbedding,
            ['http://purl.org/stuff/ragno/Unit', 'http://purl.org/stuff/ragno/TextElement'],
            10
        );
        
        console.log(`   searchByTypes results:`);
        for (const [type, results] of Object.entries(typeSearchResults)) {
            console.log(`   Type "${type}": ${results.length} results`);
            
            for (let i = 0; i < Math.min(2, results.length); i++) {
                const result = results[i];
                const containsHeterograph = result.content && result.content.toLowerCase().includes('heterograph');
                console.log(`      Result ${i + 1}: similarity=${result.similarity.toFixed(4)}, heterograph=${containsHeterograph}`);
            }
        }

        // Test 4: Check what types actually exist in the index
        console.log('\n🧪 Test 4: Check available types in vector index');
        const stats = ragnoSearch.getStatistics();
        console.log(`   Available types in index: ${JSON.stringify(stats.vectorIndex.availableTypes)}`);
        console.log(`   Nodes by type: ${JSON.stringify(stats.vectorIndex.nodesByType)}`);

        // Test 5: Get nodes by type for inspection
        console.log('\n🧪 Test 5: Get nodes by specific types');
        const unitNodes = ragnoSearch.vectorIndex.getNodesByType('http://purl.org/stuff/ragno/Unit', 3);
        console.log(`   Found ${unitNodes.length} Unit type nodes`);
        
        for (let i = 0; i < unitNodes.length; i++) {
            const node = unitNodes[i];
            const containsHeterograph = node.content && node.content.toLowerCase().includes('heterograph');
            console.log(`   Unit ${i + 1}: heterograph=${containsHeterograph}, content_length=${node.content ? node.content.length : 0}`);
        }

        await ragnoSearch.shutdown();

    } catch (error) {
        console.error('❌ Debug failed:', error);
        console.error(error.stack);
    }
}

debugTypeFiltering().catch(console.error);