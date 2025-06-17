import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

// Test configuration
const CONFIG_PATH = path.join(process.cwd(), 'config', 'config.json');

// Test suite for SPARQL connection functionality
describe('SPARQL Connection', () => {
  let config;
  let endpointUrl;
  let updateUrl;

  // Load config before all tests
  beforeAll(() => {
    try {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = JSON.parse(configData);
      
      const sparqlConfig = config.sparqlEndpoints?.[0];
      if (!sparqlConfig) {
        throw new Error('No SPARQL endpoints configured');
      }
      
      endpointUrl = `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`;
      updateUrl = `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`;
      
      console.log(`Using SPARQL endpoint: ${endpointUrl}`);
      console.log(`Using SPARQL update endpoint: ${updateUrl}`);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  });

  // Test SPARQL query functionality
  it('should execute a SPARQL query', async () => {
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: query,
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toBeDefined();
    expect(Array.isArray(data.results.bindings)).toBe(true);
  });

  // Test SPARQL update functionality
  it('should execute a SPARQL update', async () => {
    // Skip this test if we don't have update URL configured
    if (!updateUrl) {
      console.warn('No SPARQL update URL configured, skipping update test');
      return;
    }

    // Use a unique URI for test data to avoid conflicts
    const testUri = `http://example.org/test-${Date.now()}`;
    const updateQuery = `
      INSERT DATA {
        <${testUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/Test> .
        <${testUri}> <http://example.org/createdAt> "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
      }
    `;

    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: updateQuery,
    });

    expect(response.ok).toBe(true);
    
    // Verify the data was inserted
    const verifyQuery = `ASK { <${testUri}> ?p ?o }`;
    const verifyResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: verifyQuery,
    });
    
    const result = await verifyResponse.json();
    expect(result.boolean).toBe(true);
  });
});
