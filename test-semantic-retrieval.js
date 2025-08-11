#!/usr/bin/env node

/**
 * Test script to verify semantic memory storage and retrieval works
 */

import { initializeServices } from './mcp/lib/initialization.js';

async function testSemanticRetrieval() {
  console.log('🔍 Testing semantic memory storage and retrieval...');
  
  try {
    // Initialize the memory manager
    console.log('📝 Initializing services...');
    const { memoryManager } = await initializeServices();
    
    // Test storage
    console.log('💾 Testing storage...');
    const testContent = `
# MCP Revisited

The plan is to focus on 5 verbs and state:
- tell - add resources to the system with minimal subsequent processing
- ask - query the system
- augment - run operations such as concept extraction to parts of the knowledgebase
- zoom - provide the level of abstraction at which to work
- pan - the subject domain of interest
- tilt - the filter through which to view the knowledgebase

These are the 5 Simple Verbs for MCP.
    `;
    
    // Generate embedding and store
    const embedding = await memoryManager.generateEmbedding(testContent);
    console.log(`📊 Generated embedding with ${embedding.length} dimensions`);
    
    await memoryManager.store({
      id: 'test-5-verbs',
      prompt: 'MCP blog post about 5 Simple Verbs',
      response: testContent,
      embedding,
      metadata: { source: 'test', type: 'blog_post' }
    });
    console.log('✅ Stored test content');
    
    // Test retrieval
    console.log('🔍 Testing retrieval...');
    const queryEmbedding = await memoryManager.generateEmbedding('What are the 5 verbs mentioned?');
    const results = await memoryManager.search(queryEmbedding, 3, 0.5);
    
    console.log(`📋 Found ${results.length} results:`);
    results.forEach((result, i) => {
      console.log(`${i + 1}. Score: ${result.score?.toFixed(3) || 'N/A'}`);
      console.log(`   Content: ${result.response?.substring(0, 100)}...`);
    });
    
    // Test if we found the 5 verbs
    const hasSimpleVerbs = results.some(r => 
      r.response?.includes('tell') && 
      r.response?.includes('ask') && 
      r.response?.includes('augment') && 
      r.response?.includes('zoom') && 
      r.response?.includes('pan') &&
      r.response?.includes('tilt')
    );
    
    if (hasSimpleVerbs) {
      console.log('🎉 SUCCESS: Found stored content about 5 Simple Verbs!');
      console.log('✅ Semantic retrieval is working correctly');
    } else {
      console.log('❌ FAILURE: Could not find 5 Simple Verbs content');
      console.log('⚠️  Semantic retrieval may have issues');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error('🔧 Stack trace:', error.stack);
  }
}

testSemanticRetrieval().catch(console.error);