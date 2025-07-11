#!/usr/bin/env node

/**
 * Debug script to test DualSearch vector similarity search issue
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

async function debugDualSearch() {
    console.log('🔍 Debug: DualSearch Vector Similarity Issue');
    console.log('=' .repeat(60));

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
            dualSearch: {
                exactMatchTypes: ['ragno:Entity', 'ragno:Attribute'],
                vectorSimilarityTypes: [
                    'http://purl.org/stuff/ragno/Unit', 
                    'http://purl.org/stuff/ragno/Attribute', 
                    'http://purl.org/stuff/ragno/CommunityElement',
                    'http://purl.org/stuff/ragno/TextElement'
                ],
                vectorSimilarityK: 20,
                similarityThreshold: 0.5,
                pprAlpha: 0.15,
                pprIterations: 2,
                topKPerType: 10
            },
            sparqlEndpoint: 'http://localhost:3030/semem/query',
            embeddingHandler: embeddingHandler
        });

        await ragnoSearch.initialize();

        // Test 1: Generate embedding for "heterograph"
        console.log('\n🧪 Test 1: Generate embedding for "heterograph"');
        const queryEmbedding = await embeddingHandler.generateEmbedding('heterograph');
        console.log(`   Generated embedding length: ${queryEmbedding ? queryEmbedding.length : 'null'}`);

        // Test 2: Direct vector index search (we know this works)
        console.log('\n🧪 Test 2: Direct vector index search');
        const directResults = ragnoSearch.vectorIndex.search(queryEmbedding, 10);
        console.log(`   Direct search results: ${directResults.length}`);
        
        if (directResults.length > 0) {
            console.log(`   First result:`);
            console.log(`      Type: ${directResults[0].type}`);
            console.log(`      Similarity: ${directResults[0].similarity}`);
            console.log(`      Content contains heterograph: ${directResults[0].content.toLowerCase().includes('heterograph')}`);
        }

        // Test 3: searchByTypes method used by DualSearch
        console.log('\n🧪 Test 3: searchByTypes method (used by DualSearch)');
        const typesToSearch = [
            'http://purl.org/stuff/ragno/Unit', 
            'http://purl.org/stuff/ragno/Attribute', 
            'http://purl.org/stuff/ragno/CommunityElement',
            'http://purl.org/stuff/ragno/TextElement'
        ];
        
        console.log(`   Searching for types: ${typesToSearch.join(', ')}`);
        const byTypesResults = ragnoSearch.vectorIndex.searchByTypes(queryEmbedding, typesToSearch, 10);
        console.log(`   searchByTypes results:`, Object.keys(byTypesResults));
        
        for (const [type, results] of Object.entries(byTypesResults)) {
            console.log(`   Type "${type}": ${results.length} results`);
            if (results.length > 0) {
                console.log(`      First result similarity: ${results[0].similarity}`);
                console.log(`      Passes threshold 0.5: ${results[0].similarity >= 0.5}`);
            }
        }

        // Test 4: Test DualSearch performVectorSimilarity directly
        console.log('\n🧪 Test 4: Test DualSearch performVectorSimilarity directly');
        
        const queryData = {
            originalQuery: 'heterograph',
            entities: ['heterograph'],
            embedding: queryEmbedding,
            expandedTerms: [],
            confidence: 1.0
        };
        
        const searchOptions = {
            vectorSimilarityTypes: typesToSearch,
            vectorSimilarityK: 20,
            similarityThreshold: 0.5
        };
        
        const vectorSimResults = await ragnoSearch.dualSearch.performVectorSimilarity(queryData, searchOptions);
        console.log(`   DualSearch performVectorSimilarity results: ${vectorSimResults.length}`);
        
        if (vectorSimResults.length > 0) {
            for (let i = 0; i < Math.min(3, vectorSimResults.length); i++) {
                const result = vectorSimResults[i];
                console.log(`   Result ${i + 1}:`);
                console.log(`      Score: ${result.score}`);
                console.log(`      Type: ${result.type}`);
                console.log(`      Source: ${result.source}`);
            }
        } else {
            console.log(`   ❌ No results from DualSearch performVectorSimilarity!`);
            
            // Debug the issue step by step
            console.log('\n   🔍 Debug step by step:');
            console.log(`      queryData.embedding exists: ${!!queryData.embedding}`);
            console.log(`      this.vectorIndex exists: ${!!ragnoSearch.dualSearch.vectorIndex}`);
            console.log(`      vectorSimilarityTypes: ${searchOptions.vectorSimilarityTypes.join(', ')}`);
            console.log(`      vectorSimilarityK: ${searchOptions.vectorSimilarityK}`);
            console.log(`      similarityThreshold: ${searchOptions.similarityThreshold}`);
        }

        await ragnoSearch.shutdown();

    } catch (error) {
        console.error('❌ Debug failed:', error);
        console.error(error.stack);
    }
}

debugDualSearch().catch(console.error);