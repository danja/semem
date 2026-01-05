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

describe('SPARQLStore Integration Tests', () => {
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
    testGraphName = 'http://example.org/semem/test-sparql-store';

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

  it('should verify SPARQL endpoint connectivity', async () => {
    await expect(store.verify()).resolves.toBeUndefined();
  });

  it('should store and load interaction history', async () => {
    const interactionId = `sparql-test-${Date.now()}`;
    const interaction = {
      id: interactionId,
      prompt: 'What is semantic memory?',
      response: 'Semantic memory stores structured knowledge about the world.',
      embedding: new Array(embeddingDimension).fill(0).map((_, index) => (index === 0 ? 0.01 : 0)),
      timestamp: Date.now(),
      concepts: ['semantic memory', 'knowledge'],
      metadata: { source: 'test' }
    };

    await store.store(interaction);

    const [shortTerm] = await store.loadHistory();
    const stored = shortTerm.find(item => item.id === interactionId);

    expect(stored).toBeDefined();
    expect(stored.prompt).toBe(interaction.prompt);
    expect(stored.output).toBe(interaction.response);
    expect(stored.embedding.length).toBe(embeddingDimension);
    expect(stored.concepts).toEqual(interaction.concepts);
  }, 30000);

  it('should update the in-memory concept graph', () => {
    const concepts = ['graph testing', 'sparql storage', 'semantic memory'];
    store.updateGraph(concepts);

    const stats = store.getGraphStats();
    expect(stats.nodeCount).toBe(3);
    expect(stats.edgeCount).toBeGreaterThan(0);
  });
});
