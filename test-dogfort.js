#!/usr/bin/env node

/**
 * Direct test of dogfort query using both HTTP and STDIO paths
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeServices } from './_mcp/lib/initialization.js';

async function testDogfort() {
    console.log('🔍 Testing "dogfort" query directly...');

    try {
        const { memoryManager } = await initializeServices();

        console.log('\n📊 Memory stats:');
        console.log(`- FAISS index size: ${memoryManager.storage.vectors.getIndexSize()}`);
        console.log(`- Target dimension: ${memoryManager.storage.getDimension()}`);

        // Test the search directly
        console.log('\n🔍 Searching for "dogfort"...');

        // Generate embedding for "dogfort"
        const queryEmbedding = await memoryManager.embeddingProvider.generateEmbedding('dogfort');
        console.log(`🎯 Query embedding dimension: ${queryEmbedding.length}`);

        // Search using storage directly
        const results = await memoryManager.storage.search(queryEmbedding, 10, 0.3);
        console.log(`📊 Found ${results.length} results`);

        if (results.length > 0) {
            console.log('\n✅ Results found:');
            results.forEach((result, i) => {
                console.log(`${i + 1}. Similarity: ${result.similarity?.toFixed(3)} - ${result.prompt?.substring(0, 100)}...`);
            });
        } else {
            console.log('\n❌ No results found');

            // Debug: Check what's in memory
            console.log('\n🔍 Debugging memory contents...');
            const shortTerm = memoryManager.storage.shortTermMemory || [];
            console.log(`Short-term memory entries: ${shortTerm.length}`);

            if (shortTerm.length > 0) {
                console.log('Sample entries:');
                shortTerm.slice(0, 3).forEach((entry, i) => {
                    console.log(`${i + 1}. ${entry.prompt?.substring(0, 100)}...`);
                });
            }
        }

        await memoryManager.dispose();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDogfort();