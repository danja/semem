import fetch from 'node-fetch';
import logger from 'loglevel';

/**
 * Service for interacting with a SPARQL endpoint
 */
class SPARQLService {
    /**
     * Creates a new SPARQLService
     * @param {Object} options - Configuration options
     * @param {string} options.queryEndpoint - The SPARQL query endpoint URL
     * @param {string} options.updateEndpoint - The SPARQL update endpoint URL
     * @param {string} options.graphName - The default graph name to use
     * @param {Object} options.auth - Authentication credentials
     * @param {string} options.auth.user - Username for basic auth
     * @param {string} options.auth.password - Password for basic auth
     */
    constructor(options = {}) {
        this.queryEndpoint = options.queryEndpoint || 'https://fuseki.hyperdata.it/semem/query';
        this.updateEndpoint = options.updateEndpoint || 'https://fuseki.hyperdata.it/semem/update';
        this.graphName = options.graphName || 'http://example.org/default';
        this.auth = options.auth || { user: 'admin', password: 'admin123' };
        
        logger.info(`SPARQLService initialized with endpoints: ${this.queryEndpoint}, ${this.updateEndpoint}`);
    }
    
    /**
     * Execute a SPARQL query
     * @param {string} query - The SPARQL query to execute
     * @returns {Promise<Object>} The query results
     */
    async executeQuery(query) {
        logger.debug(`Executing SPARQL query to endpoint: ${this.queryEndpoint}`);
        logger.debug(`Query: ${query}`);
        
        const auth = Buffer.from(`${this.auth.user}:${this.auth.password}`).toString('base64');
        
        try {
            const response = await fetch(this.queryEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: query
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            logger.error('Error executing SPARQL query:', error);
            throw error;
        }
    }
    
    /**
     * Execute a SPARQL update
     * @param {string} update - The SPARQL update to execute
     * @returns {Promise<Response>} The response
     */
    async executeUpdate(update) {
        logger.debug(`Executing SPARQL update to endpoint: ${this.updateEndpoint}`);
        logger.debug(`Update: ${update}`);
        
        const auth = Buffer.from(`${this.auth.user}:${this.auth.password}`).toString('base64');
        
        try {
            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-update',
                    'Accept': 'application/json'
                },
                body: update
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`);
            }
            
            return response;
        } catch (error) {
            logger.error('Error executing SPARQL update:', error);
            throw error;
        }
    }
    
    /**
     * Check if a graph exists
     * @param {string} graphName - The graph name to check
     * @returns {Promise<boolean>} True if the graph exists and contains data
     */
    async graphExists(graphName = this.graphName) {
        const query = `ASK { GRAPH <${graphName}> { ?s ?p ?o } }`;
        
        try {
            const result = await this.executeQuery(query);
            return result.boolean === true;
        } catch (error) {
            logger.error(`Error checking if graph ${graphName} exists:`, error);
            throw error;
        }
    }
    
    /**
     * Store an embedding for a resource in the SPARQL store
     * @param {string} resourceUri - The URI of the resource
     * @param {number[]} embedding - The embedding vector
     * @param {string} graphName - The graph name to store in
     * @param {string} predicateUri - The predicate to use
     * @returns {Promise<boolean>} True if successful
     */
    async storeEmbedding(resourceUri, embedding, graphName = this.graphName, predicateUri = 'http://example.org/embedding/vector') {
        // Prepare the embedding to be stored as a JSON string
        const embeddingStr = JSON.stringify(embedding);
        
        // SPARQL update query to add the embedding to the resource
        const updateQuery = `
            PREFIX schema: <http://schema.org/>
            PREFIX emb: <http://example.org/embedding/>
            
            INSERT DATA {
                GRAPH <${graphName}> {
                    <${resourceUri}> <${predicateUri}> """${embeddingStr}""" .
                }
            }
        `;
        
        try {
            await this.executeUpdate(updateQuery);
            logger.info(`Stored embedding for resource: ${resourceUri}`);
            return true;
        } catch (error) {
            logger.error(`Failed to store embedding for resource ${resourceUri}:`, error);
            throw error;
        }
    }
    
    /**
     * Fetch resources with embeddings from the SPARQL store
     * @param {string} resourceClass - The class of resources to fetch (optional)
     * @param {string} contentPredicate - The predicate for resource content
     * @param {string} embeddingPredicate - The predicate for resource embeddings
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Array>} The resources with their embeddings
     */
    async fetchResourcesWithEmbeddings(
        resourceClass = null,
        contentPredicate = 'http://schema.org/articleBody',
        embeddingPredicate = 'http://example.org/embedding/vector',
        graphName = this.graphName
    ) {
        // Build the class filter if provided
        const classFilter = resourceClass 
            ? `?resource a <${resourceClass}> .` 
            : '';
        
        const query = `
            SELECT ?resource ?content ?embedding WHERE {
                GRAPH <${graphName}> {
                    ${classFilter}
                    ?resource <${contentPredicate}> ?content .
                    ?resource <${embeddingPredicate}> ?embedding .
                }
            }
        `;
        
        try {
            const results = await this.executeQuery(query);
            return results.results.bindings;
        } catch (error) {
            logger.error('Error fetching resources with embeddings:', error);
            throw error;
        }
    }
}

export default SPARQLService;