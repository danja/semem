/**
 * VSOM Features Integration Tests
 * Tests VSOM-specific functionality including visualization and spatial navigation
 * Working against live data and real semantic operations
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import VSOMStandaloneServer from '../../../src/frontend/vsom-standalone/server.js';

describe('VSOM Features Integration Tests', () => {
  let vsomServer;
  const vsomPort = 4104; // Different port to avoid conflicts
  const vsomBaseUrl = `http://localhost:${vsomPort}`;

  beforeAll(async () => {
    console.log('🚀 Starting VSOM server for features testing...');
    vsomServer = new VSOMStandaloneServer({ port: vsomPort });
    await vsomServer.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`✅ VSOM features test server started at ${vsomBaseUrl}`);
  }, 30000);

  afterAll(async () => {
    if (vsomServer) {
      console.log('🛑 Stopping VSOM features test server...');
      await vsomServer.stop();
    }
  });

  // Helper function for API requests
  const makeRequest = async (endpoint, options = {}) => {
    const response = await fetch(`${vsomBaseUrl}${endpoint}`, {
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
    return makeRequest('/api/tell', {
      method: 'POST',
      body: JSON.stringify({
        content: fact,
        type: 'interaction'
      })
    });
  };

  // Helper function to ask questions via VSOM proxy
  const askQuestionViaVSOM = async (question) => {
    return makeRequest('/api/ask', {
      method: 'POST',
      body: JSON.stringify({
        question: question,
        mode: 'standard',
        useContext: true
      })
    });
  };

  test('VSOM static file serving', async () => {
    console.log('📁 Testing VSOM static file serving...');

    // Test main index.html
    const indexResponse = await fetch(`${vsomBaseUrl}/`);
    expect(indexResponse.ok).toBe(true);
    expect(indexResponse.headers.get('content-type')).toContain('text/html');
    console.log('✅ Index.html served correctly');

    // Test JavaScript files
    const jsResponse = await fetch(`${vsomBaseUrl}/js/vsom-standalone.js`);
    expect(jsResponse.ok).toBe(true);
    expect(jsResponse.headers.get('content-type')).toContain('javascript');
    console.log('✅ JavaScript files served correctly');

    // Test health endpoint
    const health = await makeRequest('/health');
    expect(health.status).toBe('healthy');
    expect(health.service).toBe('vsom-standalone');
    console.log('✅ Health endpoint working correctly');
  });

  test('VSOM semantic data visualization workflow', async () => {
    console.log('🎨 Testing VSOM semantic data visualization...');

    // Step 1: Store semantic content for visualization
    const semanticContent = [
      'Neural networks process information through interconnected nodes called neurons',
      'Deep learning uses multiple layers of neural networks to model complex patterns',
      'Machine learning algorithms learn from data to make predictions or decisions',
      'Computer vision enables machines to interpret and understand visual information',
      'Natural language processing helps computers understand and generate human language'
    ];

    for (const content of semanticContent) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
    }
    console.log('📤 Semantic content stored for visualization');

    // Step 2: Query for visualization data
    const visualizationQuery = await askQuestionViaVSOM('What are the main concepts and their relationships in the stored content?');

    expect(visualizationQuery.success).toBe(true);
    expect(visualizationQuery.answer).toBeDefined();
    console.log('🔍 Visualization data query successful');

    console.log('✅ Semantic data visualization workflow completed');
  }, 60000);

  test('VSOM data storage and retrieval', async () => {
    console.log('🗺️ Testing VSOM data storage and retrieval...');

    // Store some facts
    const facts = [
      'Artificial intelligence enables machines to simulate human intelligence',
      'Machine learning is a subset of artificial intelligence',
      'Neural networks are inspired by biological brain structures'
    ];

    for (const fact of facts) {
      const result = await tellFactViaVSOM(fact);
      expect(result.success).toBe(true);
      console.log(`  ✅ Stored fact: "${fact.substring(0, 30)}..."`);
    }

    // Query the stored data
    const queryResult = await askQuestionViaVSOM('What do you know about artificial intelligence?');
    expect(queryResult.success).toBe(true);
    expect(queryResult.answer).toBeDefined();
    expect(queryResult.answer.toLowerCase()).toContain('artificial intelligence');

    console.log('✅ Data storage and retrieval test completed');
  }, 45000);

  test('VSOM categorized data storage', async () => {
    console.log('🎲 Testing VSOM categorized data storage...');

    // Store diverse content for clustering
    const clusteringData = [
      'Python is a high-level programming language',
      'JavaScript enables interactive web development',
      'Photosynthesis converts light energy into chemical energy',
      'Mitochondria are the powerhouses of cells',
      'Quantum entanglement links particles across distances',
      'Einstein\'s relativity changed our understanding of space-time'
    ];

    // Store content
    for (const content of clusteringData) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
    }
    console.log('📤 Diverse content stored');

    // Test categorized querying
    const categories = ['programming', 'biology', 'physics'];
    for (const category of categories) {
      const clusterQuery = await askQuestionViaVSOM(`What concepts are related to ${category}?`);

      expect(clusterQuery.success).toBe(true);
      expect(clusterQuery.answer).toBeDefined();
      console.log(`  ✅ Category query for "${category}" successful`);
    }

    console.log('✅ Categorized data storage test completed');
  }, 60000);

  test('VSOM sequential data processing', async () => {
    console.log('🧠 Testing VSOM sequential data processing...');

    // Store sequential content
    const sequentialContent = [
      'First concept: Memory systems store information',
      'Second concept: Retrieval accesses stored information',
      'Third concept: Processing transforms information',
      'Fourth concept: Output presents processed information'
    ];

    // Store content sequentially
    for (const content of sequentialContent) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
      console.log(`  ✅ Stored: "${content.substring(0, 30)}..."`);
    }
    console.log('💾 Sequential content stored');

    // Test sequential retrieval
    const queryResult = await askQuestionViaVSOM('What are the four concepts in order?');
    expect(queryResult.success).toBe(true);
    expect(queryResult.answer).toBeDefined();
    console.log('🔍 Sequential retrieval successful');

    console.log('✅ Sequential data processing test completed');
  }, 45000);

  test('VSOM progressive context building', async () => {
    console.log('🏗️ Testing VSOM progressive context building...');

    // Step 1: Start with basic concepts
    const basicConcepts = [
      'Artificial intelligence mimics human cognitive functions',
      'Machine learning is a subset of artificial intelligence'
    ];

    for (const concept of basicConcepts) {
      const result = await tellFactViaVSOM(concept);
      expect(result.success).toBe(true);
    }
    console.log('📚 Basic concepts established');

    // Step 2: Add intermediate concepts
    const intermediateConcepts = [
      'Deep learning uses neural networks with multiple hidden layers',
      'Supervised learning trains models using labeled data examples'
    ];

    for (const concept of intermediateConcepts) {
      const result = await tellFactViaVSOM(concept);
      expect(result.success).toBe(true);
    }
    console.log('📖 Intermediate concepts added');

    // Step 3: Add advanced concepts
    const advancedConcepts = [
      'Transformer architectures use attention mechanisms for sequence processing',
      'Reinforcement learning optimizes actions through reward signals'
    ];

    for (const concept of advancedConcepts) {
      const result = await tellFactViaVSOM(concept);
      expect(result.success).toBe(true);
    }
    console.log('📚 Advanced concepts integrated');

    // Step 4: Test progressive querying
    const progressiveLevels = ['basic', 'intermediate', 'advanced'];
    for (const level of progressiveLevels) {
      const query = await askQuestionViaVSOM(`Explain the ${level} concepts of artificial intelligence`);

      expect(query.success).toBe(true);
      expect(query.answer).toBeDefined();
      expect(query.answer.length).toBeGreaterThan(30);
      console.log(`  ✅ Progressive query for "${level}" level successful`);
    }

    console.log('✅ Progressive context building test completed');
  }, 60000);

  test('VSOM temporal analysis', async () => {
    console.log('📊 Testing VSOM temporal analysis...');

    // Store temporal content for analysis
    const temporalContent = [
      'Historical development: Early computers used vacuum tubes in the 1940s',
      'Technological advancement: Transistors replaced vacuum tubes in the 1950s',
      'Modern innovation: Integrated circuits enable miniaturization in the 1960s',
      'Current trends: AI and machine learning dominate computing in the 2020s'
    ];

    for (const content of temporalContent) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
    }
    console.log('📅 Temporal content stored');

    // Test temporal queries
    const temporalQueries = [
      'How has computing technology evolved over time?',
      'What are the key technological breakthroughs in chronological order?',
      'Compare early computing with modern AI developments'
    ];

    for (const query of temporalQueries) {
      const result = await askQuestionViaVSOM(query);

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(50);
      console.log(`  ✅ Temporal query successful: "${query.substring(0, 30)}..."`);
    }

    console.log('✅ Temporal analysis test completed');
  }, 60000);
});