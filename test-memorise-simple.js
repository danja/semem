#!/usr/bin/env node
/**
 * Simple test script for Memorise module
 * Tests the basic functionality without complex testing framework setup
 */

import Memorise from './src/ragno/Memorise.js';

async function testMemoriseBasics() {
    console.log('🧪 Testing Memorise module basics...\n');
    
    try {
        // Test 1: Module instantiation
        console.log('Test 1: Creating Memorise instance...');
        const memorise = new Memorise();
        console.log('✅ Memorise instance created successfully\n');
        
        // Test 2: Initialization
        console.log('Test 2: Initializing Memorise...');
        await memorise.init();
        console.log('✅ Memorise initialized successfully\n');
        
        // Test 3: Check that services are initialized
        console.log('Test 3: Checking service initialization...');
        if (!memorise.config) throw new Error('Config not initialized');
        if (!memorise.sparqlHelper) throw new Error('SPARQL helper not initialized');
        if (!memorise.llmHandler) throw new Error('LLM handler not initialized');
        if (!memorise.embeddingHandler) throw new Error('Embedding handler not initialized');
        if (!memorise.chunker) throw new Error('Chunker not initialized');
        if (!memorise.conceptExtractor) throw new Error('Concept extractor not initialized');
        console.log('✅ All services initialized correctly\n');
        
        // Test 4: Small text memorization
        console.log('Test 4: Testing small text memorization...');
        const smallText = 'Artificial intelligence is transforming technology.';
        const result = await memorise.memorize(smallText, {
            title: 'AI Test',
            graph: 'http://test.graph/memorise'
        });
        
        if (!result.success) throw new Error('Memorization failed');
        if (!result.unitURI) throw new Error('Unit URI not generated');
        if (!result.textElementURI) throw new Error('TextElement URI not generated');
        if (result.chunks === undefined) throw new Error('Chunks not processed');
        
        console.log('✅ Small text memorized successfully');
        console.log(`   Unit URI: ${result.unitURI}`);
        console.log(`   TextElement URI: ${result.textElementURI}`);
        console.log(`   Chunks: ${result.chunks}`);
        console.log(`   Processing time: ${result.statistics.processingTimeMs}ms\n`);
        
        // Test 5: Cleanup
        console.log('Test 5: Testing cleanup...');
        await memorise.cleanup();
        console.log('✅ Cleanup completed successfully\n');
        
        console.log('🎉 All basic tests passed!\n');
        
        // Summary
        console.log('📊 Test Summary:');
        console.log(`   Text length: ${result.statistics.textLength} characters`);
        console.log(`   Units created: ${result.statistics.unitsCreated}`);
        console.log(`   Text elements: ${result.statistics.textElementsCreated}`);
        console.log(`   Chunks: ${result.statistics.chunksCreated}`);
        console.log(`   Embeddings: ${result.statistics.embeddingsCreated}`);
        console.log(`   Concepts: ${result.statistics.conceptsExtracted}`);
        console.log(`   Entities: ${result.statistics.entitiesCreated}`);
        console.log(`   Relationships: ${result.statistics.relationshipsCreated}`);
        
        if (result.statistics.errors.length > 0) {
            console.log(`   Errors: ${result.statistics.errors.length}`);
            result.statistics.errors.forEach((error, i) => {
                console.log(`     ${i + 1}. ${error}`);
            });
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (process.env.DEBUG) {
            console.error('Stack trace:', error.stack);
        }
        return false;
    }
}

async function testMemoriseErrors() {
    console.log('\n🧪 Testing error handling...\n');
    
    try {
        // Test error conditions
        console.log('Test 1: Empty text handling...');
        const memorise = new Memorise();
        await memorise.init();
        
        try {
            await memorise.memorize('', { title: 'Empty Test' });
            console.log('⚠️  Empty text was processed (may be expected behavior)');
        } catch (error) {
            console.log('✅ Empty text handled correctly with error');
        }
        
        console.log('Test 2: Very short text handling...');
        const result = await memorise.memorize('AI.', { title: 'Short Test' });
        if (result.success) {
            console.log('✅ Very short text handled successfully');
        }
        
        await memorise.cleanup();
        console.log('✅ Error handling tests completed\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error handling test failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('Memorise Module Test Suite');
    console.log('=' * 50);
    
    let allTestsPassed = true;
    
    // Run basic functionality tests
    const basicTestsResult = await testMemoriseBasics();
    allTestsPassed = allTestsPassed && basicTestsResult;
    
    // Run error handling tests  
    const errorTestsResult = await testMemoriseErrors();
    allTestsPassed = allTestsPassed && errorTestsResult;
    
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
        console.log('🎊 All tests passed successfully!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed.');
        process.exit(1);
    }
}

// Run the tests
main().catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
});