// RagnoPipelineDemo.js: End-to-end demo of Ragno pipeline
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js';
import { augmentWithAttributes } from '../src/ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../src/ragno/aggregateCommunities.js';
import { enrichWithEmbeddings } from '../src/ragno/enrichWithEmbeddings.js';
// Real handlers for demo
import LLMHandler from '../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js';
import loadRagnoConfig from './loadRagnoConfig.js';

// Use real Ollama provider
import OllamaConnector from '../src/connectors/OllamaConnector.js';

// Initialize real providers
const ollamaConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
await ollamaConnector.initialize();

const llmProvider = {
  generateChat: ollamaConnector.generateChat.bind(ollamaConnector),
  generateCompletion: ollamaConnector.generateCompletion.bind(ollamaConnector),
  generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector)
};

const embeddingProvider = {
  generateEmbedding: ollamaConnector.generateEmbedding.bind(ollamaConnector)
};

const cacheManager = { get: () => undefined, set: () => {} };

(async () => {
  // Load config
  const config = await loadRagnoConfig();
  // Explicitly set the model name to use Ollama's qwen2:1.5b model
  const llmHandler = new LLMHandler(
    llmProvider,
    'qwen2:1.5b', // Override with the actual model we have
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
