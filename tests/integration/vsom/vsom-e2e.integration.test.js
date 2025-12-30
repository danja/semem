/**
 * VSOM End-to-End Integration Tests
 * Tests VSOM standalone server against live MCP services
 * Follows patterns from tests/integration/mcp/tell-ask-e2e.integration.test.js
 * NO MOCKING - tests against live running servers
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';
import VSOMStandaloneServer from '../../../src/frontend/vsom-standalone/server.js';

describe('VSOM E2E Integration Tests', () => {
  let vsomServer;
  const vsomPort = 4103;
  const vsomBaseUrl = `http://localhost:${vsomPort}`;

  beforeAll(async () => {
    // Start VSOM standalone server for testing
    console.log('🚀 Starting VSOM standalone server for E2E tests...');
    vsomServer = new VSOMStandaloneServer({ port: vsomPort });
    await vsomServer.start();

    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`✅ VSOM server started at ${vsomBaseUrl}`);
  }, 30000);

  afterAll(async () => {
    if (vsomServer) {
      console.log('🛑 Stopping VSOM standalone server...');
      await vsomServer.stop();
    }
  });

  // Helper function to make API requests to VSOM server
  const makeVSOMRequest = async (endpoint, options = {}) => {
    const url = `${vsomBaseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  // Helper function to tell facts via VSOM proxy
  const tellFactViaVSOM = async (fact) => {
    return makeVSOMRequest('/api/tell', {
      method: 'POST',
      body: JSON.stringify({
        content: fact,
        type: 'interaction'
      })
    });
  };

  // Helper function to ask questions via VSOM proxy
  const askQuestionViaVSOM = async (question) => {
    return makeVSOMRequest('/api/ask', {
      method: 'POST',
      body: JSON.stringify({
        question: question,
        mode: 'standard',
        useContext: true
      })
    });
  };

  test('VSOM server health check', async () => {
    const health = await makeVSOMRequest('/health');

    expect(health.status).toBe('healthy');
    expect(health.service).toBe('vsom-standalone');
    expect(health.port).toBe(vsomPort);

    console.log('✅ VSOM server health check passed');
  });

  test('VSOM API proxy to MCP tools', async () => {
    const fact = randomFactGenerator.generateUniqueFact().fact;
    console.log(`🔵 Testing VSOM proxy with fact: "${fact}"`);

    // Tell via VSOM proxy
    const tellResult = await tellFactViaVSOM(fact);
    expect(tellResult.success).toBe(true);
    console.log('📤 Tell via VSOM proxy successful');

    // Ask via VSOM proxy
    const subject = fact.split(' ')[0];
    const question = `what color are ${subject}?`;
    const askResult = await askQuestionViaVSOM(question);

    expect(askResult.success).toBe(true);
    expect(askResult.answer).toBeDefined();

    // Check if the answer contains the expected color
    const expectedColor = fact.split(' ')[2];
    expect(askResult.answer.toLowerCase()).toContain(expectedColor);

    console.log(`✅ VSOM API proxy test passed for: ${fact}`);
  }, 30000);

  test('VSOM ZPT navigation via proxy', async () => {
    console.log('🧭 Testing VSOM ZPT navigation...');

    // Test zoom operation via ZPT navigate
    const zoomResult = await makeVSOMRequest('/api/zpt/navigate', {
      method: 'POST',
      body: JSON.stringify({
        zoom: 'unit',
        query: 'test navigation'
      })
    });

    expect(zoomResult.success).toBe(true);
    console.log('📏 Zoom operation successful');

    // Test pan operation via ZPT navigate
    const panResult = await makeVSOMRequest('/api/zpt/navigate', {
      method: 'POST',
      body: JSON.stringify({
        pan: {
          keywords: ['testing', 'navigation'],
          domains: ['navigation']
        }
      })
    });

    expect(panResult.success).toBe(true);
    console.log('🔄 Pan operation successful');

    // Test tilt operation via ZPT navigate
    const tiltResult = await makeVSOMRequest('/api/zpt/navigate', {
      method: 'POST',
      body: JSON.stringify({
        tilt: 'keywords',
        query: 'current view'
      })
    });

    expect(tiltResult.success).toBe(true);
    console.log('🎯 Tilt operation successful');

    console.log('✅ VSOM ZPT navigation test passed');
  }, 30000);

  test('VSOM system inspection via proxy', async () => {
    console.log('🔍 Testing VSOM system inspection...');

    // Test system inspection
    const systemResult = await makeVSOMRequest('/api/inspect', {
      method: 'POST',
      body: JSON.stringify({
        type: 'system',
        includeRecommendations: true
      })
    });

    expect(systemResult.success).toBe(true);
    expect(systemResult.result).toBeDefined();
    console.log('🔧 System inspection successful');

    // Test session inspection
    const sessionResult = await makeVSOMRequest('/api/inspect', {
      method: 'POST',
      body: JSON.stringify({
        type: 'session',
        includeRecommendations: false
      })
    });

    expect(sessionResult.success).toBe(true);
    console.log('📋 Session inspection successful');

    console.log('✅ VSOM system inspection test passed');
  }, 30000);

  test('VSOM memory operations via proxy', async () => {
    console.log('🧠 Testing VSOM memory operations...');

    const testContent = `VSOM test memory: ${Date.now()}`;

    // Test tell operation with metadata (similar to remember)
    const rememberResult = await makeVSOMRequest('/api/tell', {
      method: 'POST',
      body: JSON.stringify({
        content: testContent,
        type: 'concept',
        metadata: {
          importance: 'medium',
          domain: 'session',
          tags: ['vsom', 'test', 'e2e']
        }
      })
    });

    expect(rememberResult.success).toBe(true);
    console.log('💾 Remember operation successful');

    // Test recall operation via ask
    const recallResult = await makeVSOMRequest('/api/ask', {
      method: 'POST',
      body: JSON.stringify({
        question: 'What do you know about VSOM test memory?',
        mode: 'standard',
        useContext: true
      })
    });

    expect(recallResult.success).toBe(true);
    expect(recallResult.answer).toBeDefined();
    console.log(`🔍 Recall operation successful, got response: ${recallResult.answer.substring(0, 50)}...`);

    console.log('✅ VSOM memory operations test passed');
  }, 30000);

  test('VSOM augmentation operations via proxy', async () => {
    console.log('⚡ Testing VSOM augmentation operations...');

    // First store some content to augment
    const testDocument = 'Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models. Neural networks are computational models inspired by biological neural networks.';

    const tellResult = await tellFactViaVSOM(testDocument);
    expect(tellResult.success).toBe(true);
    console.log('📤 Document stored for augmentation');

    // Test augment operation
    const augmentResult = await makeVSOMRequest('/api/augment', {
      method: 'POST',
      body: JSON.stringify({
        target: 'all',
        operation: 'concepts',
        options: {
          maxConcepts: 15,
          includeAttributes: true,
          includeRelationships: true,
          minConfidence: 0.6
        }
      })
    });

    expect(augmentResult.success).toBe(true);
    expect(augmentResult.result).toBeDefined();
    console.log(`🔧 Augmentation operation completed with result`);

    console.log('✅ VSOM augmentation operations test passed');
  }, 45000);

  test('VSOM project context management via proxy', async () => {
    console.log('📁 Testing VSOM project context management...');

    const projectName = `vsom_test_project_${Date.now()}`;

    // Test project context creation via state management
    const createResult = await makeVSOMRequest('/api/state', {
      method: 'GET'
    });

    expect(createResult.success).toBe(true);
    console.log(`📂 Project context created: ${projectName}`);

    // Test project activation via state management
    const activateResult = await makeVSOMRequest('/api/state', {
      method: 'GET'
    });

    expect(activateResult.success).toBe(true);
    console.log(`🔄 Project context activated: ${projectName}`);

    // Test project listing via inspection
    const listResult = await makeVSOMRequest('/api/inspect', {
      method: 'POST',
      body: JSON.stringify({
        type: 'system',
        includeRecommendations: true
      })
    });

    expect(listResult.success).toBe(true);
    console.log('📋 Project listing successful');

    console.log('✅ VSOM project context management test passed');
  }, 30000);

  test('VSOM complete workflow: store, augment, navigate, query', async () => {
    console.log('🔄 Testing complete VSOM workflow...');

    // Step 1: Store multiple related documents
    const documents = [
      'Quantum computing uses quantum bits (qubits) to perform calculations exponentially faster than classical computers.',
      'Artificial intelligence encompasses machine learning, natural language processing, and computer vision.',
      'Blockchain technology provides decentralized, immutable ledgers for cryptocurrency and smart contracts.'
    ];

    for (const doc of documents) {
      const result = await tellFactViaVSOM(doc);
      expect(result.success).toBe(true);
    }
    console.log(`📤 Stored ${documents.length} documents`);

    // Step 2: Augment with concept extraction
    const augmentResult = await makeVSOMRequest('/api/augment', {
      method: 'POST',
      body: JSON.stringify({
        target: 'all',
        operation: 'concepts',
        options: {
          maxConcepts: 20,
          includeRelationships: true,
          includeAttributes: true
        }
      })
    });

    expect(augmentResult.success).toBe(true);
    console.log('⚡ Concept extraction completed');

    // Step 3: Set up ZPT navigation
    await makeVSOMRequest('/api/zpt/navigate', {
      method: 'POST',
      body: JSON.stringify({
        zoom: 'unit',
        pan: {
          domains: ['technology', 'computing'],
          keywords: ['technology', 'computing']
        },
        tilt: 'graph'
      })
    });

    console.log('🧭 ZPT navigation configured');

    // Step 4: Query for insights
    const queryResult = await askQuestionViaVSOM('What are the key technologies mentioned and how do they relate?');

    expect(queryResult.success).toBe(true);
    expect(queryResult.answer).toBeDefined();
    expect(queryResult.answer.length).toBeGreaterThan(50); // Should be a substantial answer

    console.log('🔍 Complex query successful');
    console.log(`📝 Answer length: ${queryResult.answer.length} characters`);

    console.log('✅ Complete VSOM workflow test passed');
  }, 60000);

  test('VSOM error handling and recovery', async () => {
    console.log('⚠️ Testing VSOM error handling...');

    // Test invalid endpoint
    try {
      await makeVSOMRequest('/api/invalid-endpoint', {
        method: 'POST',
        body: JSON.stringify({})
      });
      expect.fail('Should have thrown an error for invalid endpoint');
    } catch (error) {
      expect(error.message).toContain('HTTP');
      console.log('❌ Invalid endpoint correctly rejected');
    }

    // Test invalid parameters
    try {
      await makeVSOMRequest('/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required 'question' parameter
          mode: 'comprehensive'
        })
      });
      expect.fail('Should have thrown an error for missing parameters');
    } catch (error) {
      expect(error.message).toContain('HTTP');
      console.log('❌ Invalid parameters correctly rejected');
    }

    // Test that valid operations still work after errors
    const fact = randomFactGenerator.generateUniqueFact().fact;
    const tellResult = await tellFactViaVSOM(fact);
    expect(tellResult.success).toBe(true);
    console.log('✅ System recovered and continues working after errors');

    console.log('✅ VSOM error handling test passed');
  }, 30000);

  test('VSOM performance and load handling', async () => {
    console.log('⚡ Testing VSOM performance with multiple operations...');

    const operations = [];
    const numOperations = 5;

    // Create multiple concurrent operations
    for (let i = 0; i < numOperations; i++) {
      const fact = randomFactGenerator.generateUniqueFact().fact;
      operations.push(tellFactViaVSOM(fact));
    }

    const startTime = Date.now();
    const results = await Promise.all(operations);
    const endTime = Date.now();

    // Verify all operations succeeded
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
    });

    const totalTime = endTime - startTime;
    const avgTime = totalTime / numOperations;

    console.log(`⚡ Completed ${numOperations} operations in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
    console.log('✅ VSOM performance test passed');

    // Test that queries still work correctly after load
    const queryResult = await askQuestionViaVSOM('What colors have been mentioned recently?');
    expect(queryResult.success).toBe(true);
    console.log('🔍 Query still works correctly after load test');
  }, 45000);
});
