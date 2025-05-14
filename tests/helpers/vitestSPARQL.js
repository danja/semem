// tests/helpers/vitestSPARQL.js
import Config from '../../src/Config.js';

/**
 * Initialize test graphs for SPARQL integration tests
 * @param {Config} config Configuration instance
 */
export async function initTestGraphs(config) {
  // Only run if we have SPARQL endpoints configured
  if (!config || !config.get('sparqlEndpoints') || config.get('sparqlEndpoints').length === 0) {
    console.warn('No SPARQL endpoints configured. Skipping test graph initialization.');
    return;
  }
  
  try {
    const endpoints = config.get('sparqlEndpoints');
    console.log(`Setting up ${endpoints.length} SPARQL test graphs...`);
    
    // Initialize each endpoint
    for (const endpoint of endpoints) {
      await initEndpoint(endpoint);
    }
    
    console.log('SPARQL test graphs initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize SPARQL test graphs:', error);
    throw error;
  }
}

/**
 * Initialize a single SPARQL endpoint for testing
 * @param {Object} endpoint Endpoint configuration
 */
async function initEndpoint(endpoint) {
  console.log(`Initializing endpoint: ${endpoint.label} at ${endpoint.urlBase}${endpoint.update}`);
  
  // Clear the graph first
  await clearGraph(endpoint);
  
  // Add test data (placeholder function - implement as needed)
  await addTestData(endpoint);
}

/**
 * Clear a SPARQL graph
 * @param {Object} endpoint Endpoint configuration
 */
async function clearGraph(endpoint) {
  const url = `${endpoint.urlBase}${endpoint.update}`;
  const headers = {
    'Content-Type': 'application/sparql-update'
  };
  
  // Add basic auth if credentials are provided
  if (endpoint.user && endpoint.password) {
    const auth = Buffer.from(`${endpoint.user}:${endpoint.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: 'CLEAR ALL'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear graph: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Graph cleared for ${endpoint.label}`);
  } catch (error) {
    console.error(`Error clearing graph for ${endpoint.label}:`, error);
    throw error;
  }
}

/**
 * Add test data to a SPARQL graph
 * @param {Object} endpoint Endpoint configuration
 */
async function addTestData(endpoint) {
  const url = `${endpoint.urlBase}${endpoint.update}`;
  const headers = {
    'Content-Type': 'application/sparql-update'
  };
  
  // Add basic auth if credentials are provided
  if (endpoint.user && endpoint.password) {
    const auth = Buffer.from(`${endpoint.user}:${endpoint.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  // Test data - modify as needed
  const testData = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX semem: <http://hyperdata.it/semem/>
    
    INSERT DATA {
      semem:TestMemory1 rdf:type semem:Memory ;
        rdfs:label "Test Memory 1" ;
        semem:content "This is test memory content 1" ;
        semem:timestamp "2025-05-14T12:00:00Z"^^xsd:dateTime ;
        semem:embedding "[0.1, 0.2, 0.3]" .
        
      semem:TestMemory2 rdf:type semem:Memory ;
        rdfs:label "Test Memory 2" ;
        semem:content "This is test memory content 2" ;
        semem:timestamp "2025-05-14T12:30:00Z"^^xsd:dateTime ;
        semem:embedding "[0.2, 0.3, 0.4]" .
    }
  `;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: testData
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add test data: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Test data added to ${endpoint.label}`);
  } catch (error) {
    console.error(`Error adding test data to ${endpoint.label}:`, error);
    throw error;
  }
}

/**
 * Set up a test configuration with SPARQL endpoints for testing
 * @returns {Config} Initialized configuration
 */
export async function setupSPARQLTestConfig() {
  const config = new Config({
    storage: {
      type: 'sparql',
      options: {
        endpoint: 'http://localhost:4030/test-mem',
        apiKey: '',
        timeout: 5000
      }
    },
    models: {
      chat: {
        provider: 'mistral',
        model: 'open-codestral-mamba',
        options: {}
      },
      embedding: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: {}
      }
    },
    sparqlEndpoints: [{
      label: "test-mem",
      user: "admin",
      password: "admin123",
      urlBase: "http://localhost:4030",
      dataset: "test-mem",
      query: "/test-mem",
      update: "/test-mem",
      upload: "/test-mem/upload",
      gspRead: "/test-mem/data",
      gspWrite: "/test-mem/data"
    }]
  });
  
  await config.init();
  return config;
}