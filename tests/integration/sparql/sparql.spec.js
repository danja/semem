import { describe, it, expect, beforeAll } from 'vitest';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

const getEmbeddingDimension = (config) => {
  const providers = config.get('llmProviders');
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error('No llmProviders configured for embedding dimension');
  }

  const embeddingProviders = providers
    .filter(provider => provider.capabilities?.includes('embedding'))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  if (embeddingProviders.length === 0) {
    throw new Error('No embedding-capable providers configured');
  }

  const dimension = embeddingProviders[0].embeddingDimension;
  if (!dimension) {
    throw new Error('Embedding dimension missing from embedding provider configuration');
  }

  return dimension;
};

describe('SPARQL Storage - Smoke Tests', () => {
  let config;

  beforeAll(async () => {
    config = new Config('config/config.json');
    await config.init();
  });

  it('should have a SPARQL storage configuration', () => {
    const storageConfig = config.get('storage');
    expect(storageConfig).toBeDefined();
    expect(storageConfig.type).toBe('sparql');

    const sparqlEndpoints = config.get('sparqlEndpoints');
    expect(Array.isArray(sparqlEndpoints)).toBe(true);
    expect(sparqlEndpoints.length).toBeGreaterThan(0);
    expect(sparqlEndpoints[0].urlBase).toBeDefined();
  });

  it('should initialize SPARQLStore and execute a basic query', async () => {
    const sparqlEndpoints = config.get('sparqlEndpoints');
    const sparqlEndpoint = sparqlEndpoints[0];
    const graphName = config.get('graphName');
    const embeddingDimension = getEmbeddingDimension(config);

    if (!graphName) {
      throw new Error('graphName not configured');
    }

    const endpoint = {
      query: sparqlEndpoint.urlBase + sparqlEndpoint.query,
      update: sparqlEndpoint.urlBase + sparqlEndpoint.update,
      data: sparqlEndpoint.urlBase + sparqlEndpoint.gspRead
    };

    const store = new SPARQLStore(endpoint, {
      user: sparqlEndpoint.user,
      password: sparqlEndpoint.password,
      graphName,
      dimension: embeddingDimension
    }, config);

    const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const result = await store.executeSparqlQuery(testQuery);

    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
  });
});
