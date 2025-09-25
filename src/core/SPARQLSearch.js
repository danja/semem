// SPARQLSearch.js
// Consolidated module for SPARQL-based search functionality

import { SPARQLService } from '../services/embeddings/SPARQLService.js';

/**
 * SPARQLSearch class
 * Handles SPARQL-based search operations.
 */
export class SPARQLSearch {
    constructor(config) {
        this.config = config;
        this.sparqlService = new SPARQLService(config);
    }

    /**
     * Query SPARQL endpoint for resources
     * @param {string} query - SPARQL query string
     * @returns {Promise<Array>} - Query results
     */
    async queryResources(query) {
        return await this.sparqlService.executeQuery(query);
    }

    /**
     * Fetch embeddings from SPARQL store
     * @param {string} graphName - Name of the graph to query
     * @returns {Promise<Array>} - Embeddings and associated metadata
     */
    async fetchEmbeddings(graphName) {
        return await this.sparqlService.fetchResourcesWithEmbeddings(null, null, null, graphName);
    }
}