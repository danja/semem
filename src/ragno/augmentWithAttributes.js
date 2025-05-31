// Ragno: Node Importance-Based Augmentation
// Selects important entities and adds attribute summaries using LLM
import Attribute from './Attribute.js';

/**
 * augmentWithAttributes(G, llmHandler, options)
 * @param {Object} G - Graph object with entities, units, relationships
 * @param {Object} llmHandler - LLMHandler instance for attribute summarization
 * @param {Object} [options] - Options (e.g., topK, importanceMethod)
 * @returns {Promise<{attributes: Attribute[]}>}
 */
export async function augmentWithAttributes(G, llmHandler, options = {}) {
  // 1. Select important entities (by degree for now)
  const topK = options.topK || 5;
  const entities = G.entities || [];
  
  // Compute degree for each entity
  const degreeMap = {};
  for (const rel of G.relationships || []) {
    degreeMap[rel.source] = (degreeMap[rel.source] || 0) + 1;
    degreeMap[rel.target] = (degreeMap[rel.target] || 0) + 1;
  }
  // Sort entities by degree
  const sorted = entities.slice().sort((a, b) => (degreeMap[b.name]||0) - (degreeMap[a.name]||0));
  const important = sorted.slice(0, topK);

  // 2. For each important entity, gather connected units/relationships
  const attributes = [];
  for (const entity of important) {
    const connectedUnits = (G.units || []).filter(u => u.entities && u.entities.includes(entity.name));
    const connectedRels = (G.relationships || []).filter(r => r.source === entity.name || r.target === entity.name);
    // 3. Use LLM to generate attribute summary
    const context = connectedUnits.map(u => u.text).join('\n');
    const relContext = connectedRels.map(r => r.description).join('\n');
    const prompt = `Summarize the key attributes of the entity '${entity.name}' based on the following context.\nUnits:\n${context}\nRelationships:\n${relContext}`;
    const summary = await llmHandler.generateResponse(prompt, []);
    // 4. Create Attribute node
    attributes.push(new Attribute({
      text: summary,
      summary,
      entity: entity.name,
      provenance: 'augmented by LLM'
    }));
  }
  return { attributes };
}
