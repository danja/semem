import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('SPARQLStore Core Integration', () => {
  let store;
  let config;
  let testGraphName;
  let embeddingDimension;

  beforeAll(async () => {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const configPath = path.join(projectRoot, 'config/config.json');
    config = new Config(configPath);
    await config.init();

    const storageOptions = config.get('storage.options');
    if (!storageOptions) {
      throw new Error('storage.options not configured');
    }

    const configuredGraphName = config.get('graphName');
    if (!configuredGraphName) {
      throw new Error('graphName not configured');
    }

    embeddingDimension = getEmbeddingDimension(config);
    testGraphName = 'http://example.org/semem/test-sparql-core';

    const endpoint = {
      query: storageOptions.query,
      update: storageOptions.update,
      data: storageOptions.data
    };

    store = new SPARQLStore(endpoint, {
      ...storageOptions,
      graphName: testGraphName,
      dimension: embeddingDimension
    }, config);

    const clearQuery = `
      DROP SILENT GRAPH <${testGraphName}>;
      CREATE GRAPH <${testGraphName}>
    `;
    await store.executeSparqlUpdate(clearQuery);
  }, 60000);

  afterAll(async () => {
    if (!store) {
      return;
    }

    const dropQuery = `DROP SILENT GRAPH <${testGraphName}>`;
    await store.executeSparqlUpdate(dropQuery);
    await store.dispose();
  }, 30000);

  it('should initialize core modules', () => {
    expect(store.index).toBeDefined();
    expect(store.index.getDimension()).toBe(embeddingDimension);
    expect(store.dimension).toBe(embeddingDimension);

    expect(store.graph).toBeDefined();
    expect(store.graph.graph.order).toBe(0);
    expect(store.graph.graph.size).toBe(0);

    expect(store.shortTermMemory).toEqual([]);
    expect(store.longTermMemory).toEqual([]);
    expect(store.embeddings).toEqual([]);
  });

  it('should verify SPARQL connectivity', async () => {
    await expect(store.verify()).resolves.toBeUndefined();
  });

  it('should execute a basic SPARQL query', async () => {
    const testQuery = `
      ASK {
        GRAPH <${testGraphName}> {
          ?s ?p ?o
        }
      }
    `;

    const response = await store.executeSparqlQuery(testQuery);
    expect(response).toBeDefined();
  });
});
