// RagnoPipelineDemo.js: End-to-end demo of Ragno pipeline
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js';
import { augmentWithAttributes } from '../src/ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../src/ragno/aggregateCommunities.js';
import { enrichWithEmbeddings } from '../src/ragno/enrichWithEmbeddings.js';
// Real handlers for demo
import LLMHandler from '../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js';
import loadRagnoConfig from './loadRagnoConfig.js';

// Example provider stubs (replace with your actual provider instances)
const llmProvider = {
  async generateChat(model, messages, options) {
    return `LLM summary for: ${messages.map(m => m.content).join(' ')}`;
  }
};
const embeddingProvider = {
  async generateEmbedding(model, text) {
    // Replace with actual embedding API call
    return Array(8).fill(text.length % 7);
  }
};
const cacheManager = { get: () => undefined, set: () => {} };

(async () => {
  // Load config
  const config = await loadRagnoConfig();
  // Instantiate with config-driven parameters
  const llmHandler = new LLMHandler(
    llmProvider,
    config.decomposition.llm.model,
    config.decomposition.llm.temperature
  );
  const embeddingHandler = new EmbeddingHandler(
    embeddingProvider,
    config.enrichment.embedding.model,
    config.enrichment.embedding.dimensions,
    cacheManager
  );
  const embeddingFn = text => embeddingHandler.generateEmbedding(text);

  const textChunks = [
    { content: 'Hinton invented backprop.', source: 'doc1.txt' },
    { content: 'LeCun developed convolutional nets.', source: 'doc2.txt' }
  ];
  // Step 1: Decompose
  const G1 = await decomposeCorpus(textChunks, llmHandler);
  // Step 2: Augment
  const { attributes } = await augmentWithAttributes(G1, llmHandler, { topK: 2 });
  G1.attributes = attributes;
  // Step 2.2: Community detection
  const { communities, attributes: commAttrs } = await aggregateCommunities(G1, llmHandler, { minCommunitySize: 2 });
  G1.communities = communities;
  G1.communityAttributes = commAttrs;
  // Step 3: Enrichment
  const { embeddings, similarityLinks } = await enrichWithEmbeddings(G1, embeddingFn, { similarityThreshold: 0 });
  console.log('Units:', G1.units);
  console.log('Entities:', G1.entities);
  console.log('Attributes:', attributes);
  console.log('Communities:', communities);
  console.log('Community Attributes:', commAttrs);
  console.log('Embeddings:', embeddings);
  console.log('Similarity Links:', similarityLinks);
})();
