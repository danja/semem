// Ragno: Community Detection (Leiden algorithm placeholder)
// Clusters entities and summarizes communities
import Attribute from './Attribute.js';

/**
 * aggregateCommunities(G, llmHandler, options)
 * @param {Object} G - Graph object with entities, units, relationships
 * @param {Object} llmHandler - LLMHandler instance for community summary
 * @param {Object} [options] - Options (e.g., minCommunitySize)
 * @returns {Promise<{communities: Object[], attributes: Attribute[]}>}
 */
export async function aggregateCommunities(G, llmHandler, options = {}) {
  // 1. Build an adjacency list for entities
  const adj = {};
  for (const rel of G.relationships || []) {
    adj[rel.source] = adj[rel.source] || new Set();
    adj[rel.target] = adj[rel.target] || new Set();
    adj[rel.source].add(rel.target);
    adj[rel.target].add(rel.source);
  }

  // 2. Simple connected components as communities (Leiden placeholder)
  const visited = new Set();
  const communities = [];
  for (const entity of G.entities || []) {
    if (!visited.has(entity.name)) {
      const queue = [entity.name];
      const members = new Set();
      while (queue.length) {
        const curr = queue.pop();
        if (!visited.has(curr)) {
          visited.add(curr);
          members.add(curr);
          for (const neighbor of adj[curr] || []) {
            if (!visited.has(neighbor)) queue.push(neighbor);
          }
        }
      }
      if (members.size >= (options.minCommunitySize || 2)) {
        communities.push({ members: Array.from(members) });
      }
    }
  }

  // 3. Summarize each community with the LLM
  const attributes = [];
  for (const comm of communities) {
    const units = (G.units || []).filter(u => u.entities && u.entities.some(e => comm.members.includes(e)));
    const context = units.map(u => u.text).join('\n');
    const prompt = `Summarize the main theme or topic of this community based on the following units:\n${context}`;
    const summary = await llmHandler.generateResponse(prompt, []);
    attributes.push(new Attribute({
      text: summary,
      summary,
      entity: null,
      provenance: 'community summary'
    }));
    comm.attribute = summary;
  }
  return { communities, attributes };
}
