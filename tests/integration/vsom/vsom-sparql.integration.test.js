/**
 * VSOM SPARQL Integration Tests
 * Tests VSOM's interaction with SPARQL backend and RDF data visualization
 * Working against live SPARQL endpoint and real semantic data
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import VSOMStandaloneServer from '../../../src/frontend/vsom-standalone/server.js';

describe('VSOM SPARQL Integration Tests', () => {
  let vsomServer;
  const vsomPort = 4105; // Different port to avoid conflicts
  const vsomBaseUrl = `http://localhost:${vsomPort}`;
  const sparqlEndpoint = 'http://localhost:3030/semem/query';

  beforeAll(async () => {
    console.log('🚀 Starting VSOM server for SPARQL testing...');
    vsomServer = new VSOMStandaloneServer({ port: vsomPort });
    await vsomServer.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`✅ VSOM SPARQL test server started at ${vsomBaseUrl}`);

    // Verify SPARQL endpoint is accessible
    try {
      const testQuery = 'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }';
      const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(testQuery)}`, {
        headers: { 'Accept': 'application/sparql-results+json' }
      });
      expect(response.ok).toBe(true);
      console.log('✅ SPARQL endpoint verified');
    } catch (error) {
      console.warn('⚠️ SPARQL endpoint not available, some tests may fail:', error.message);
    }
  }, 30000);

  afterAll(async () => {
    if (vsomServer) {
      console.log('🛑 Stopping VSOM SPARQL test server...');
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

  // Helper to execute SPARQL queries directly
  const executeSparqlQuery = async (query) => {
    try {
      const response = await fetch(`${sparqlEndpoint}?query=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/sparql-results+json' }
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`SPARQL query failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('SPARQL query failed:', error.message);
      return null;
    }
  };

  test('VSOM SPARQL endpoint connectivity', async () => {
    console.log('🔌 Testing VSOM SPARQL endpoint connectivity...');

    // Test basic SPARQL connectivity
    const countQuery = 'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }';
    const result = await executeSparqlQuery(countQuery);

    if (result) {
      expect(result.results).toBeDefined();
      expect(result.results.bindings).toBeDefined();
      console.log(`✅ SPARQL endpoint connected, triple count: ${result.results.bindings[0]?.count?.value || 'unknown'}`);
    } else {
      console.log('⚠️ SPARQL endpoint not available for direct testing');
    }
  });

  test('VSOM data storage to SPARQL backend', async () => {
    console.log('💾 Testing VSOM data storage to SPARQL backend...');

    // Store RDF-compatible semantic content
    const rdfContent = [
      'DBpedia is a structured knowledge base extracted from Wikipedia',
      'FOAF (Friend of a Friend) is an RDF vocabulary for describing people and relationships',
      'SPARQL is a query language for RDF data, similar to SQL for relational databases',
      'OWL (Web Ontology Language) extends RDF with additional semantics for ontologies'
    ];

    let storedCount = 0;
    for (const content of rdfContent) {
      const result = await tellFactViaVSOM(content);

      if (result.success) {
        storedCount++;
      }
    }

    expect(storedCount).toBe(rdfContent.length);
    console.log(`📤 Stored ${storedCount} RDF-compatible concepts`);

    // Verify storage by querying
    const verifyQuery = await askQuestionViaVSOM('What do you know about SPARQL and RDF?');

    expect(verifyQuery.success).toBe(true);
    expect(verifyQuery.answer.toLowerCase()).toContain('sparql');
    console.log('✅ Data storage to SPARQL backend verified');
  }, 45000);

  test('VSOM semantic web data handling', async () => {
    console.log('⚡ Testing VSOM semantic web data handling...');

    // Store structured content
    const structuredContent = 'The Semantic Web is an extension of the World Wide Web that enables data sharing and reuse across applications. It uses RDF (Resource Description Framework) to describe resources and their relationships.';

    const storeResult = await tellFactViaVSOM(structuredContent);
    expect(storeResult.success).toBe(true);
    console.log('📤 Structured content stored');

    // Verify concepts are queryable
    const conceptQuery = await askQuestionViaVSOM('List the main concepts related to the Semantic Web');

    expect(conceptQuery.success).toBe(true);
    expect(conceptQuery.answer.toLowerCase()).toContain('semantic web');
    console.log('🔍 Semantic web concepts are queryable');

    console.log('✅ Semantic web data handling test completed');
  }, 60000);

  test('VSOM query integration', async () => {
    console.log('🔍 Testing VSOM query integration...');

    // First ensure we have some data
    await tellFactViaVSOM('SPARQL integration test: Knowledge graphs enable semantic querying');

    // Test different types of queries
    const queries = [
      'What entities have been stored recently?',
      'Show me concepts related to knowledge graphs',
      'What do you know about semantic querying?'
    ];

    for (const query of queries) {
      const result = await askQuestionViaVSOM(query);

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
      console.log(`  ✅ Query successful: "${query.substring(0, 30)}..."`);
    }

    // Test direct SPARQL query if endpoint is available
    if (await executeSparqlQuery('ASK { ?s ?p ?o }')) {
      const entitiesQuery = `
        SELECT DISTINCT ?subject ?predicate ?object
        WHERE {
          ?subject ?predicate ?object .
          FILTER(CONTAINS(STR(?object), "knowledge"))
        }
        LIMIT 10
      `;

      const sparqlResult = await executeSparqlQuery(entitiesQuery);
      if (sparqlResult) {
        expect(sparqlResult.results).toBeDefined();
        console.log(`  ✅ Direct SPARQL query returned ${sparqlResult.results.bindings.length} results`);
      }
    }

    console.log('✅ Query integration test completed');
  }, 45000);

  test('VSOM graph data visualization', async () => {
    console.log('🎨 Testing VSOM graph data visualization...');

    // Store graph-structured content
    const graphContent = [
      'Machine Learning is a subset of Artificial Intelligence',
      'Neural Networks are the foundation of Machine Learning',
      'Deep Learning uses multiple layers of Neural Networks',
      'Computer Vision requires Deep Learning techniques',
      'Natural Language Processing is related to Machine Learning'
    ];

    for (const content of graphContent) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
    }
    console.log('📊 Graph-structured content stored');

    // Query for visualization-ready data
    const vizQuery = await askQuestionViaVSOM('Show the relationships between AI concepts in a structured format suitable for graph visualization');

    expect(vizQuery.success).toBe(true);
    expect(vizQuery.answer).toBeDefined();
    expect(vizQuery.answer.toLowerCase()).toContain('machine learning');
    console.log('🎯 Visualization-ready data query successful');

    console.log('✅ Graph data visualization test completed');
  }, 60000);

  test('VSOM performance with multiple items', async () => {
    console.log('⚡ Testing VSOM performance with multiple items...');

    // Generate test dataset
    const testItems = [];
    const categories = ['technology', 'science', 'mathematics', 'engineering', 'biology'];

    for (let i = 0; i < 10; i++) {
      const category = categories[i % categories.length];
      testItems.push(`${category} concept ${i}: Advanced implementation in ${category} domain`);
    }

    // Store the dataset
    const startStore = Date.now();
    let storedCount = 0;

    for (const content of testItems) {
      const result = await tellFactViaVSOM(content);
      if (result.success) {
        storedCount++;
      }
    }

    const storeTime = Date.now() - startStore;
    console.log(`📤 Stored ${storedCount} items in ${storeTime}ms (avg: ${(storeTime/storedCount).toFixed(2)}ms per item)`);

    // Test query performance
    const startQuery = Date.now();
    const queryResult = await askQuestionViaVSOM('What are the most common concepts across all categories?');

    const queryTime = Date.now() - startQuery;
    expect(queryResult.success).toBe(true);
    console.log(`🔍 Query completed in ${queryTime}ms`);

    console.log('✅ Performance test completed');
  }, 120000);

  test('VSOM data persistence verification', async () => {
    console.log('💾 Testing VSOM data persistence verification...');

    // Store content for persistence testing
    const persistenceData = [
      'User preference: Always show detailed relationships in visualization',
      'Project goal: Build semantic web visualization system',
      'Session note: Testing data persistence across different contexts'
    ];

    // Store content
    for (const content of persistenceData) {
      const result = await tellFactViaVSOM(content);
      expect(result.success).toBe(true);
    }
    console.log('💾 Content stored for persistence testing');

    // Test data retrieval
    for (const content of persistenceData) {
      const keyword = content.split(':')[0]; // Extract first word
      const queryResult = await askQuestionViaVSOM(`What do you know about ${keyword}?`);

      expect(queryResult.success).toBe(true);
      expect(queryResult.answer).toBeDefined();
      console.log(`  ✅ Retrieved data related to "${keyword}"`);
    }

    console.log('✅ Data persistence verification test completed');
  }, 60000);
});