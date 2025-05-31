// Ragno: Graph Enrichment - Add vector embeddings and similarity edges
// This step generates embeddings for retrievable nodes and links similar nodes
import SPARQLHelpers from '../utils/SPARQLHelpers.js';

/**
 * enrichWithEmbeddings(G, embeddingFn, options)
 * @param {Object} G - Graph object (entities, units, attributes, etc.)
 * @param {Function} embeddingFn - async function(text) => embedding vector
 * @param {Object} [options] - Options (e.g., similarityThreshold)
 * @returns {Promise<{embeddings: Object, similarityLinks: Object[]}>}
 */
export async function enrichWithEmbeddings(G, embeddingFn, options = {}) {
  const retrievable = [
    ...(G.units || []),
    ...(G.attributes || []),
    ...(G.communities || [])
  ];
  // 1. Generate embeddings for each node
  const embeddings = {};
  for (const node of retrievable) {
    const text = node.text || node.summary || '';
    embeddings[node.id || node.text] = await embeddingFn(text);
  }
  // 2. Compute similarity links (cosine similarity)
  const similarityThreshold = options.similarityThreshold || 0.8;
  const similarityLinks = [];
  const nodes = Object.keys(embeddings);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = embeddings[nodes[i]];
      const b = embeddings[nodes[j]];
      const sim = cosineSimilarity(a, b);
      if (sim >= similarityThreshold) {
        similarityLinks.push({ source: nodes[i], target: nodes[j], similarity: sim });
      }
    }
  }
  return { embeddings, similarityLinks };
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
