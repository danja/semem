#!/usr/bin/env node

/**
 * Compare search functionality between isolated service instances
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeServices } from './src/mcp/lib/initialization.js';

async function compareSearch() {
    console.log('🔍 Testing search functionality directly...');

    try {
        const { memoryManager } = await initializeServices();

        console.log('\n📊 Memory stats:');
        console.log(`- FAISS index size: ${memoryManager.storage.vectors.getIndexSize()}`);
        console.log(`- Target dimension: ${memoryManager.storage.getDimension()}`);
        console.log(`- Memory cache stats:`, memoryManager.storage.getMemoryCacheStats());

        // Test search with "dogfort"
        console.log('\n🔍 Testing direct storage search for "dogfort"...');

        // Generate embedding for "dogfort"
        const queryEmbedding = await memoryManager.embeddingProvider.generateEmbedding('dogfort');
        console.log(`🎯 Query embedding dimension: ${queryEmbedding.length}`);

        // Test various search methods
        console.log('\n1️⃣ Testing storage.search() directly:');
        const directResults = await memoryManager.storage.search(queryEmbedding, 10, 0.3);
        console.log(`   Results: ${directResults.length}`);

        console.log('\n2️⃣ Testing storage.searchModule.search() directly:');
        const moduleResults = await memoryManager.storage.searchModule.search(queryEmbedding, 10, 0.3);
        console.log(`   Results: ${moduleResults.length}`);

        console.log('\n3️⃣ Testing storage.findSimilarElements() directly:');
        const findResults = await memoryManager.storage.findSimilarElements(queryEmbedding, 10, 0.3);
        console.log(`   Results: ${findResults.length}`);

        console.log('\n4️⃣ Testing vectors.searchIndex() directly:');
        const faissResults = memoryManager.storage.vectors.searchIndex(queryEmbedding, 10);
        console.log(`   FAISS results: ${faissResults.labels?.length || 0} labels, ${faissResults.distances?.length || 0} distances`);

        if (faissResults.labels?.length > 0) {
            console.log('   FAISS distances:', faissResults.distances.slice(0, 3));
            console.log('   FAISS labels:', faissResults.labels.slice(0, 3));
        }

        console.log('\n5️⃣ Checking short-term memory directly:');
        const shortTerm = memoryManager.storage.shortTermMemory || [];
        console.log(`   Short-term memory entries: ${shortTerm.length}`);
        if (shortTerm.length > 0) {
            console.log('   Sample entries:');
            shortTerm.slice(0, 3).forEach((entry, i) => {
                console.log(`   ${i + 1}. ${entry.prompt?.substring(0, 100)}...`);
                console.log(`      Embedding dimension: ${entry.embedding?.length || 'undefined'}`);
            });
        }

        await memoryManager.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

compareSearch();
