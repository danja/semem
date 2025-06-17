import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Config from '../../../src/Config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { fileURLToPath as nodeFileURLToPath } from 'url';

// Get the current file's directory
const __filename = nodeFileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Lightweight smoke tests for SPARQL storage.
 * These tests verify basic functionality without making assumptions about implementation details.
 */
describe('SPARQL Storage - Smoke Tests', () => {
  let config;
  let storage;

  beforeAll(async () => {
    // Load config from the project root
    const configPath = path.join(process.cwd(), 'config/config.json');
    console.log('Loading config from:', configPath);
    
    config = new Config(configPath);
    await config.init();
  });

  it('should be properly configured', async () => {
    const storageConfig = config.get('storage');
    console.log('Storage config:', JSON.stringify(storageConfig, null, 2));
    
    expect(storageConfig).toBeDefined();
    
    if (storageConfig.type === 'sparql') {
      const sparqlEndpoints = config.get('sparqlEndpoints');
      console.log('SPARQL endpoints:', JSON.stringify(sparqlEndpoints, null, 2));
      
      expect(Array.isArray(sparqlEndpoints)).toBe(true);
      expect(sparqlEndpoints.length).toBeGreaterThan(0);
      
      const sparqlEndpoint = sparqlEndpoints[0];
      expect(sparqlEndpoint).toBeDefined();
      expect(sparqlEndpoint.urlBase).toBeDefined();
    } else {
      console.warn('SPARQL storage not configured - skipping SPARQL-specific tests');
    }
  });

  it('should initialize SPARQL store if configured', async () => {
    try {
      const storageConfig = config.get('storage');
      
      if (storageConfig.type !== 'sparql') {
        console.warn('Skipping SPARQL store initialization test - not configured');
        return;
      }

      const sparqlEndpoints = config.get('sparqlEndpoints');
      if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
        throw new Error('No SPARQL endpoints configured');
      }

      const sparqlEndpoint = sparqlEndpoints[0];
      console.log('Using SPARQL endpoint:', JSON.stringify(sparqlEndpoint, null, 2));
      
      // Ensure required properties exist
      if (!sparqlEndpoint.urlBase) {
        throw new Error('SPARQL endpoint is missing urlBase');
      }

      // Log the full endpoint configuration for debugging
      console.log('Full SPARQL endpoint config:', JSON.stringify(sparqlEndpoint, null, 2));
      
      // Construct endpoint URLs based on the actual config structure
      const queryEndpoint = sparqlEndpoint.urlBase + sparqlEndpoint.query;
      const updateEndpoint = sparqlEndpoint.urlBase + sparqlEndpoint.update;

      console.log('Constructed endpoints:', {
        query: queryEndpoint,
        update: updateEndpoint
      });

      // Dynamically import to avoid loading if not needed
      const { default: SPARQLStore } = await import('../../../src/stores/SPARQLStore.js');
      
      // Create store with the actual configuration structure
      storage = new SPARQLStore(
        {
          query: queryEndpoint,
          update: updateEndpoint
        },
        {
          user: sparqlEndpoint.user,
          password: sparqlEndpoint.password,
          graphName: config.get('graphName') || 'http://example.org/memories',
          dimension: 1536
        }
      );
      
      console.log('SPARQLStore initialized with config:', {
        endpoint: storage.endpoint,
        graphName: storage.graphName
      });
      
      // Verify we can perform a basic query
      const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
      
      try {
        console.log('Executing test query...');
        // Use the internal _executeSparqlQuery method with the query endpoint
        const result = await storage._executeSparqlQuery(testQuery, storage.endpoint.query);
        console.log('Query result:', JSON.stringify(result, null, 2));
        
        // The result should be defined
        expect(result).toBeDefined();
        
        // Check for SPARQL JSON result format
        if (result.results && result.results.bindings) {
          expect(Array.isArray(result.results.bindings)).toBe(true);
          console.log(`Got ${result.results.bindings.length} bindings in query result`);
        } else {
          console.warn('Unexpected query result format:', result);
          // At least check that we got some response
          expect(Object.keys(result).length).toBeGreaterThan(0);
        }
      } catch (error) {
        console.error('Query failed:', error);
        // Don't fail the test for network/remote server issues
        if (error.message.includes('fetch failed') || error.message.includes('network')) {
          console.warn('Network/remote server issue - marking test as skipped');
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('SPARQL store test failed:', error);
      throw error;
    }
  });
});
