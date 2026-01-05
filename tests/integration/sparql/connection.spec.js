import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fetch from 'node-fetch';
import Config from '../../../src/Config.js';

// Test configuration
// Test suite for SPARQL connection functionality
describe('SPARQL Connection', () => {
  let config;
  let endpointUrl;
  let updateUrl;
  let authHeader;

  // Load config before all tests
  beforeAll(async () => {
    config = new Config(path.join(process.cwd(), 'config', 'config.json'));
    await config.init();

    const sparqlConfig = config.get('sparqlEndpoints')?.[0];
    if (!sparqlConfig) {
      throw new Error('No SPARQL endpoints configured');
    }

    if (!sparqlConfig.urlBase || !sparqlConfig.query || !sparqlConfig.update) {
      throw new Error('SPARQL endpoint configuration is incomplete');
    }

    endpointUrl = `${sparqlConfig.urlBase}${sparqlConfig.query}`;
    updateUrl = `${sparqlConfig.urlBase}${sparqlConfig.update}`;

    const username = sparqlConfig.user;
    const password = sparqlConfig.password;
    if (!username || !password) {
      throw new Error('SPARQL credentials are not configured');
    }

    authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  });

  // Test SPARQL query functionality
  it('should execute a SPARQL query', async () => {
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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
        'Authorization': authHeader,
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
        'Authorization': authHeader,
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
