#!/usr/bin/env node

/**
 * Debug script to test SearchFilters step by step to identify where results are being lost
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
import SearchFilters from './src/ragno/search/SearchFilters.js';

async function debugSearchFilters() {
    console.log('🔍 Debug: SearchFilters Step-by-Step Analysis');
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
            sparqlEndpoint: 'http://localhost:3030/semem/query',
            embeddingHandler: embeddingHandler
        });

        await ragnoSearch.initialize();

        // Test 1: Get raw dual search results
        console.log('\n🧪 Test 1: Get raw dual search results');
        const rawResults = await ragnoSearch.search('heterograph', {
            limit: 10,
            threshold: 0.5
        });
        
        console.log(`   Raw dual search results: ${Array.isArray(rawResults) ? rawResults.length : 'not array'}`);
        
        if (Array.isArray(rawResults) && rawResults.length > 0) {
            console.log(`   First result structure:`, Object.keys(rawResults[0]));
            for (let i = 0; i < Math.min(3, rawResults.length); i++) {
                const result = rawResults[i];
                console.log(`   Result ${i + 1}:`);
                console.log(`      URI: ${result.uri}`);
                console.log(`      Type: ${result.type}`);
                console.log(`      Score: ${result.score || result.similarity || result.relevance || 'none'}`);
                console.log(`      Source: ${result.source}`);
                console.log(`      Content length: ${result.content ? result.content.length : 0}`);
            }
        }

        // Test 2: Initialize SearchFilters with correct types
        console.log('\n🧪 Test 2: Initialize SearchFilters');
        const searchFilters = new SearchFilters({
            relevanceThreshold: 0.5,
            documentTypes: [
                'http://purl.org/stuff/ragno/Entity', 
                'http://purl.org/stuff/ragno/Unit', 
                'http://purl.org/stuff/ragno/TextElement', 
                'http://purl.org/stuff/ragno/CommunityElement'
            ],
            enableDeduplication: true,
            enableContextEnrichment: false, // Disable for debugging
            maxResults: 10
        });

        console.log(`   SearchFilters initialized with threshold: 0.5`);
        console.log(`   Allowed types: ${searchFilters.options.documentTypes.join(', ')}`);

        // Test 3: Apply filters step by step
        if (Array.isArray(rawResults) && rawResults.length > 0) {
            console.log('\n🧪 Test 3: Apply filters step by step');
            
            let testResults = [...rawResults];
            console.log(`   Starting with: ${testResults.length} results`);

            // Step 1: Relevance filtering
            console.log('\n   📊 Step 1: Relevance filtering');
            const afterRelevance = await searchFilters.applyRelevanceFiltering(testResults, { threshold: 0.5 });
            console.log(`      ${testResults.length} → ${afterRelevance.length} results after relevance filtering`);
            
            if (afterRelevance.length > 0) {
                console.log(`      Sample scores after relevance filtering:`);
                for (let i = 0; i < Math.min(3, afterRelevance.length); i++) {
                    const result = afterRelevance[i];
                    const score = searchFilters.extractScore(result);
                    console.log(`         Result ${i + 1}: score=${score}, threshold=0.5, passes=${score >= 0.5}`);
                }
            } else {
                console.log(`      ❌ All results filtered out by relevance threshold!`);
                console.log(`      Original result scores:`);
                for (let i = 0; i < Math.min(3, testResults.length); i++) {
                    const result = testResults[i];
                    const score = searchFilters.extractScore(result);
                    console.log(`         Result ${i + 1}: score=${score}, threshold=0.5, passes=${score >= 0.5}`);
                }
            }

            // Step 2: Type filtering
            console.log('\n   📋 Step 2: Type filtering');
            const afterType = await searchFilters.applyTypeFiltering(afterRelevance);
            console.log(`      ${afterRelevance.length} → ${afterType.length} results after type filtering`);
            
            if (afterType.length === 0 && afterRelevance.length > 0) {
                console.log(`      ❌ All results filtered out by type filtering!`);
                console.log(`      Result types vs allowed types:`);
                for (let i = 0; i < Math.min(3, afterRelevance.length); i++) {
                    const result = afterRelevance[i];
                    const resultType = result.type || result.rdfType || 'unknown';
                    const isAllowed = searchFilters.options.documentTypes.includes(resultType);
                    console.log(`         Result ${i + 1}: type="${resultType}", allowed=${isAllowed}`);
                }
                console.log(`      Allowed types: ${searchFilters.options.documentTypes.join(', ')}`);
            }

            // Step 3: Deduplication
            console.log('\n   🔄 Step 3: Deduplication');
            const afterDedup = await searchFilters.applyDeduplication(afterType);
            console.log(`      ${afterType.length} → ${afterDedup.length} results after deduplication`);

            // Step 4: Ranking
            console.log('\n   📊 Step 4: Ranking');
            const afterRanking = await searchFilters.applyRanking(afterDedup);
            console.log(`      ${afterDedup.length} → ${afterRanking.length} results after ranking`);

            // Step 5: Limiting
            console.log('\n   ✂️  Step 5: Result limiting');
            const final = await searchFilters.limitResults(afterRanking, { limit: 10 });
            console.log(`      ${afterRanking.length} → ${final.length} results after limiting`);

            console.log(`\n🎯 Final result: ${final.length} results`);

        } else {
            console.log('❌ No raw results to filter - the issue is before SearchFilters!');
        }

        await ragnoSearch.shutdown();

    } catch (error) {
        console.error('❌ Debug failed:', error);
        console.error(error.stack);
    }
}

debugSearchFilters().catch(console.error);