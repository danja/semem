// Ragno: Export similarity links to SPARQL triple store
import SPARQLHelpers from '../utils/SPARQLHelpers.js';

/**
 * exportSimilarityLinksToSPARQL(similarityLinks, endpoint, auth)
 * @param {Object[]} similarityLinks - Array of {source, target, similarity}
 * @param {string} endpoint - SPARQL endpoint URL
 * @param {string} auth - Authorization header (if needed)
 * @returns {Promise<void>}
 */
export default async function exportSimilarityLinksToSPARQL(similarityLinks, endpoint, auth) {
  for (const link of similarityLinks) {
    const linkId = `ragno:SimilarityLink_${encodeURIComponent(link.source)}_${encodeURIComponent(link.target)}_${Date.now()}`;
    const query = `
      PREFIX ragno: <http://hyperdata.it/ontologies/ragno#>
      INSERT DATA {
        ${linkId} a ragno:SimilarityLink ;
          ragno:source "${link.source}" ;
          ragno:target "${link.target}" ;
          ragno:similarity ${link.similarity} .
      }
    `;
    await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, auth);
  }
}
