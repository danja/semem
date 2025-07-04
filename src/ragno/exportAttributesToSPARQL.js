// Ragno: Export Attribute nodes to SPARQL triple store
import SPARQLHelpers from '../services/sparql/SPARQLHelper.js';

/**
 * exportAttributesToSPARQL(attributes, endpoint, auth)
 * @param {Attribute[]} attributes - Array of Attribute nodes
 * @param {string} endpoint - SPARQL endpoint URL
 * @param {string} auth - Authorization header (if needed)
 * @returns {Promise<void>}
 */
export default async function exportAttributesToSPARQL(attributes, endpoint, auth) {
  for (const attr of attributes) {
    // SPARQL: create Attribute node and link to entity
    const attrId = `ragno:Attribute_${encodeURIComponent(attr.entity)}_${Date.now()}`;
    const query = `
      PREFIX ragno: <http://hyperdata.it/ontologies/ragno#>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      INSERT DATA {
        ${attrId} a ragno:Attribute ;
          ragno:attributeText """${attr.text}""" ;
          ragno:summary """${attr.summary}""" ;
          ragno:provenance "${attr.provenance}" ;
          ragno:forEntity "${attr.entity}" .
        ragno:Entity_${encodeURIComponent(attr.entity)} ragno:hasAttribute ${attrId} .
      }
    `;
    await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, auth);
  }
}
