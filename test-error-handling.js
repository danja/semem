#!/usr/bin/env node

/**
 * Test that errors are properly reported instead of being masked by fallbacks
 */

import { SafeOperations } from './mcp/lib/safe-operations.js';

// Mock MemoryManager to test error handling
class MockMemoryManager {
  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
    this.llmHandler = {
      extractConcepts: async (text) => {
        if (this.shouldFail) {
          throw new Error('LLM service unavailable');
        }
        return ['test', 'concepts'];
      }
    };
    this.store = {
      search: async (embedding, limit, threshold) => {
        if (this.shouldFail) {
          throw new Error('Store search failed');
        }
        return [{ content: 'test result' }];
      }
    };
  }
  
  async generateEmbedding(text) {
    if (this.shouldFail) {
      throw new Error('Embedding generation failed');
    }
    return [0.1, 0.2, 0.3]; // mock embedding
  }
}

async function testErrorHandling() {
  console.log('🔍 Testing error handling (no fallbacks)...\n');
  
  // Test 1: Successful operations
  console.log('📝 Test 1: Successful operations');
  const workingManager = new MockMemoryManager(false);
  const workingSafeOps = new SafeOperations(workingManager);
  
  try {
    const concepts = await workingSafeOps.extractConcepts('Test text');
    console.log('✅ extractConcepts succeeded:', concepts);
  } catch (error) {
    console.log('❌ extractConcepts failed:', error.message);
  }
  
  try {
    const embedding = [0.1, 0.2, 0.3];
    const results = await workingSafeOps.searchSimilar(embedding, 5, 0.7);
    console.log('✅ searchSimilar succeeded:', results.length, 'results');
  } catch (error) {
    console.log('❌ searchSimilar failed:', error.message);
  }
  
  // Test 2: Failed operations (should throw errors, not return empty arrays)
  console.log('\n📝 Test 2: Failed operations (should throw errors)');
  const failingManager = new MockMemoryManager(true);
  const failingSafeOps = new SafeOperations(failingManager);
  
  try {
    const concepts = await failingSafeOps.extractConcepts('Test text');
    console.log('❌ extractConcepts should have failed but returned:', concepts);
  } catch (error) {
    console.log('✅ extractConcepts properly failed:', error.message);
  }
  
  try {
    const embedding = [0.1, 0.2, 0.3];
    const results = await failingSafeOps.searchSimilar(embedding, 5, 0.7);
    console.log('❌ searchSimilar should have failed but returned:', results);
  } catch (error) {
    console.log('✅ searchSimilar properly failed:', error.message);
  }
  
  // Test 3: Invalid inputs (should throw errors)
  console.log('\n📝 Test 3: Invalid inputs (should throw errors)');
  
  try {
    const concepts = await workingSafeOps.extractConcepts('');
    console.log('❌ extractConcepts should have failed with empty text but returned:', concepts);
  } catch (error) {
    console.log('✅ extractConcepts properly failed with empty text:', error.message);
  }
  
  try {
    const results = await workingSafeOps.searchSimilar(null, 5, 0.7);
    console.log('❌ searchSimilar should have failed with null embedding but returned:', results);
  } catch (error) {
    console.log('✅ searchSimilar properly failed with null embedding:', error.message);
  }
  
  try {
    const results = await workingSafeOps.searchSimilar('invalid', 5, 0.7);
    console.log('❌ searchSimilar should have failed with string embedding but returned:', results);
  } catch (error) {
    console.log('✅ searchSimilar properly failed with string embedding:', error.message);
  }
  
  console.log('\n🎉 Error handling test completed! All operations should fail fast with clear error messages.');
}

testErrorHandling().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});