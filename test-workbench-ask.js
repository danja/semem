#!/usr/bin/env node

/**
 * Test the Ask function to reproduce workbench issue
 */

import { initializeServices } from './mcp/lib/initialization.js';
import { getSimpleVerbsService } from './mcp/tools/simple-verbs.js';

async function testWorkbenchAsk() {
    console.log('🔍 Testing Ask Function - Workbench Issue Reproduction');
    console.log('====================================================\n');

    try {
        // Initialize exactly as workbench would
        console.log('1️⃣ Initializing services (as workbench would)...');
        await initializeServices();
        const service = getSimpleVerbsService();
        console.log('✅ Services initialized\n');

        // Test the exact query user tried
        console.log('2️⃣ Testing exact workbench query: "what is postcraft?"');
        
        const result = await service.ask({
            question: "what is postcraft?",
            useContext: true
        });

        console.log('Ask result:');
        console.log('- Success:', result.success);
        console.log('- Context items:', result.contextItems);
        console.log('- Memories used:', result.memories);
        console.log('- Answer preview:', result.answer?.substring(0, 200) + '...');
        
        // Check if answer contains useful information
        const hasPostcraftInfo = result.answer && 
            (result.answer.toLowerCase().includes('static site builder') ||
             result.answer.toLowerCase().includes('transmissions') ||
             result.answer.toLowerCase().includes('sparql store'));
             
        console.log('- Contains Postcraft info:', hasPostcraftInfo);

        if (!hasPostcraftInfo) {
            console.log('\n❌ ISSUE CONFIRMED: Ask function not finding Postcraft content');
            
            // Let's try some variations
            console.log('\n3️⃣ Trying query variations...');
            
            const variations = [
                "Tell me about Postcraft",
                "What do you know about Postcraft?",
                "Describe Postcraft static site builder",
                "What was recently ingested about Postcraft?"
            ];
            
            for (const query of variations) {
                console.log(`\n🔍 Trying: "${query}"`);
                
                const varResult = await service.ask({
                    question: query,
                    useContext: true
                });
                
                const hasInfo = varResult.answer && 
                    (varResult.answer.toLowerCase().includes('static site builder') ||
                     varResult.answer.toLowerCase().includes('transmissions'));
                     
                console.log(`   📊 Context items: ${varResult.contextItems}, Found info: ${hasInfo}`);
                
                if (hasInfo) {
                    console.log(`   ✅ SUCCESS with this variation!`);
                    console.log(`   📝 Answer: ${varResult.answer.substring(0, 150)}...`);
                    break;
                }
            }
        } else {
            console.log('\n✅ Ask function is working correctly!');
        }

        // Check memory state
        console.log('\n4️⃣ Checking memory state...');
        const inspection = await service.inspect({ what: 'session' });
        console.log('Memory inspection:', {
            success: inspection.success,
            totalMemories: inspection.session?.memoryStats?.total || 'unknown'
        });

    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

testWorkbenchAsk();