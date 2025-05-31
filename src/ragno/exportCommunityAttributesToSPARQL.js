// Ragno: Export Community Attribute nodes to SPARQL triple store
import SPARQLHelpers from '../utils/SPARQLHelpers.js';

/**
 * exportCommunityAttributesToSPARQL(attributes, endpoint, auth)
 * @param {Attribute[]} attributes - Array of Attribute nodes (community summaries)
 * @param {string} endpoint - SPARQL endpoint URL
 * @param {string} auth - Authorization header (if needed)
 * @returns {Promise<void>}
 */
export default async function exportCommunityAttributesToSPARQL(attributes, endpoint, auth) {
  for (const attr of attributes) {
    // SPARQL: create CommunityAttribute node
    const attrId = `ragno:CommunityAttribute_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    const query = `
      PREFIX ragno: <http://hyperdata.it/ontologies/ragno#>
      INSERT DATA {
        ${attrId} a ragno:CommunityAttribute ;
          ragno:attributeText """${attr.text}""" ;
          ragno:summary """${attr.summary}""" ;
          ragno:provenance "${attr.provenance}" .
      }
    `;
    await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, auth);
  }
}
