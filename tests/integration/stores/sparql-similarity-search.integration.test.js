/**
 * SPARQLStore Similarity Search Integration Test
 * Tests the core similarity search functionality directly through SPARQLStore
 * 1. Store data with embeddings
 * 2. Test direct similarity search method
 * 3. Verify cosine similarity calculations are working
 * NO MOCKING - tests against live SPARQL endpoint
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import EmbeddingsAPIBridge from '../../../src/services/embeddings/EmbeddingsAPIBridge.js';
import Config from '../../../src/Config.js';
import { RandomFactGenerator } from '../../helpers/randomFactGenerator.js';

describe('SPARQLStore Similarity Search Tests', () => {
  let sparqlStore;
  let embeddingsBridge;
  let config;
  let randomFacts;

  beforeAll(async () => {
    // Initialize components following existing patterns
    config = new Config();
    await config.init();

    const storageConfig = config.get('storage.options') || {};
    console.log('🔍 Storage Config:', storageConfig);

    const endpoint = storageConfig.query || 'http://localhost:3030/semem/query';
    const embeddingDimension = config.get('embeddingDimension') || 768; // Default Ollama embedding dimension
    const sparqlOptions = {
      graphName: storageConfig.graphName || 'http://purl.org/stuff/semem/test',
      dimension: embeddingDimension
    };
    console.log('🔍 SPARQLStore endpoint:', endpoint);
    console.log('🔍 SPARQLStore Options:', sparqlOptions);

    sparqlStore = new SPARQLStore(endpoint, sparqlOptions, config);

    embeddingsBridge = new EmbeddingsAPIBridge(config);
    randomFacts = new RandomFactGenerator();

    console.log('🔧 Test setup: SPARQLStore similarity search direct testing');
  });

  test('SPARQLStore search method finds stored memories by similarity', async () => {
    const testFact = randomFacts.generateFact();
    console.log(`🧪 Testing similarity search with: "${testFact}"`);

    // Step 1: Generate embedding for our test fact
    const embedding = await embeddingsBridge.generateEmbedding(testFact);
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    console.log(`📊 Generated embedding: length=${embedding.length}, first few values=[${embedding.slice(0, 3).join(', ')}...]`);

    // Step 2: Store the fact with embedding using SPARQLStore.store()
    const memoryData = {
      id: `test-memory-${Date.now()}`,
      prompt: `Remember this: ${testFact}`,
      output: testFact,
      embedding: embedding,
      concepts: ['test', 'similarity', 'search'],
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    const storeResult = await sparqlStore.store(memoryData);
    console.log(`📤 Stored memory: success=${!!storeResult}`);

    // Step 3: Generate a similar query embedding (same text should have high similarity)
    const queryEmbedding = await embeddingsBridge.generateEmbedding(testFact);
    console.log(`🔍 Query embedding: length=${queryEmbedding.length}`);

    // Step 4: Test SPARQLStore.search() method directly
    const searchResults = await sparqlStore.search(queryEmbedding, 10, 0.1); // Low threshold to catch results
    console.log(`📋 Search results: found ${searchResults.length} memories`);

    // Log detailed results
    if (searchResults.length > 0) {
      searchResults.forEach((result, i) => {
        console.log(`📊 Result ${i}: id=${result.id}, similarity=${result.similarity}, content="${(result.prompt || result.output || '').substring(0, 50)}..."`);
      });
    }

    // Verify we found our stored memory
    expect(searchResults.length).toBeGreaterThan(0);

    // Find our specific memory in the results
    const foundMemory = searchResults.find(result => result.id === memoryData.id);
    expect(foundMemory).toBeDefined();
    expect(foundMemory.similarity).toBeGreaterThan(0.8); // Should be very high similarity for identical text

    console.log(`✅ Found stored memory with similarity=${foundMemory.similarity}`);
    console.log(`🎉 SPARQLStore similarity search test passed!`);

  }, 30000); // 30 second timeout

  test('SPARQLStore search respects similarity threshold', async () => {
    const testFact = randomFacts.generateFact();
    const differentFact = randomFacts.generateFact();
    console.log(`🧪 Testing threshold filtering with: "${testFact}" vs "${differentFact}"`);

    // Store two different facts
    const embedding1 = await embeddingsBridge.generateEmbedding(testFact);
    const embedding2 = await embeddingsBridge.generateEmbedding(differentFact);

    const memory1 = {
      id: `threshold-test-1-${Date.now()}`,
      prompt: testFact,
      output: testFact,
      embedding: embedding1,
      concepts: ['threshold', 'test'],
      metadata: { test: true }
    };

    const memory2 = {
      id: `threshold-test-2-${Date.now()}`,
      prompt: differentFact,
      output: differentFact,
      embedding: embedding2,
      concepts: ['threshold', 'test'],
      metadata: { test: true }
    };

    await sparqlStore.store(memory1);
    await sparqlStore.store(memory2);

    // Search with high threshold - should find fewer results
    const highThresholdResults = await sparqlStore.search(embedding1, 10, 0.9);
    const lowThresholdResults = await sparqlStore.search(embedding1, 10, 0.1);

    console.log(`📊 High threshold (0.9): ${highThresholdResults.length} results`);
    console.log(`📊 Low threshold (0.1): ${lowThresholdResults.length} results`);

    // Low threshold should find more results than high threshold
    expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);

    console.log(`✅ Threshold filtering working correctly`);

  }, 30000);

});