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

    /**
     * Get graph exploration data for a given subject URI
     * @param {string} subjectUri - The subject URI to explore
     * @param {number} depth - The depth of exploration (default: 2)
     * @param {number} limit - Maximum number of triples to return
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Array>} Array of triples for graph visualization
     */
    async exploreGraphFromSubject(subjectUri, depth = 2, limit = 100, graphName = this.graphName) {
        const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            CONSTRUCT {
                ?s ?p ?o .
                ?o ?p2 ?o2 .
            } WHERE {
                GRAPH <${graphName}> {
                    {
                        <${subjectUri}> ?p ?o .
                        BIND(<${subjectUri}> AS ?s)
                    } UNION {
                        <${subjectUri}> ?p ?o .
                        OPTIONAL {
                            ?o ?p2 ?o2 .
                            FILTER(?p2 != rdf:type || ?depth > 1)
                        }
                        BIND(<${subjectUri}> AS ?s)
                    }
                }
            } LIMIT ${limit}
        `;

        try {
            return await this.executeQuery(query);
        } catch (error) {
            logger.error(`Error exploring graph from subject ${subjectUri}:`, error);
            throw error;
        }
    }

    /**
     * Get all classes and their instance counts from the graph
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Array>} Array of classes with counts
     */
    async getGraphClasses(graphName = this.graphName) {
        const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            SELECT ?class (COUNT(?instance) as ?count) WHERE {
                GRAPH <${graphName}> {
                    ?instance rdf:type ?class .
                }
            }
            GROUP BY ?class
            ORDER BY DESC(?count)
        `;

        try {
            const results = await this.executeQuery(query);
            return results.results.bindings;
        } catch (error) {
            logger.error('Error fetching graph classes:', error);
            throw error;
        }
    }

    /**
     * Get all predicates and their usage counts from the graph
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Array>} Array of predicates with counts
     */
    async getGraphPredicates(graphName = this.graphName) {
        const query = `
            SELECT ?predicate (COUNT(*) as ?count) WHERE {
                GRAPH <${graphName}> {
                    ?s ?predicate ?o .
                }
            }
            GROUP BY ?predicate
            ORDER BY DESC(?count)
        `;

        try {
            const results = await this.executeQuery(query);
            return results.results.bindings;
        } catch (error) {
            logger.error('Error fetching graph predicates:', error);
            throw error;
        }
    }

    /**
     * Get graph statistics
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Object>} Graph statistics
     */
    async getGraphStats(graphName = this.graphName) {
        const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            SELECT 
                (COUNT(*) as ?totalTriples)
                (COUNT(DISTINCT ?s) as ?totalSubjects) 
                (COUNT(DISTINCT ?p) as ?totalPredicates)
                (COUNT(DISTINCT ?o) as ?totalObjects)
            WHERE {
                GRAPH <${graphName}> {
                    ?s ?p ?o .
                }
            }
        `;

        try {
            const results = await this.executeQuery(query);
            const stats = results.results.bindings[0];
            
            return {
                triples: parseInt(stats.totalTriples?.value || 0),
                subjects: parseInt(stats.totalSubjects?.value || 0),
                predicates: parseInt(stats.totalPredicates?.value || 0),
                objects: parseInt(stats.totalObjects?.value || 0)
            };
        } catch (error) {
            logger.error('Error fetching graph statistics:', error);
            throw error;
        }
    }

    /**
     * Search for resources containing a text pattern
     * @param {string} searchText - Text to search for
     * @param {string} graphName - The graph name to query
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Array of matching resources
     */
    async searchResources(searchText, graphName = this.graphName, limit = 20) {
        const query = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dc: <http://purl.org/dc/elements/1.1/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            
            SELECT DISTINCT ?resource ?label ?description WHERE {
                GRAPH <${graphName}> {
                    ?resource ?p ?o .
                    FILTER(
                        CONTAINS(LCASE(STR(?o)), LCASE("${searchText}")) ||
                        CONTAINS(LCASE(STR(?resource)), LCASE("${searchText}"))
                    )
                    OPTIONAL { ?resource rdfs:label ?label }
                    OPTIONAL { ?resource skos:prefLabel ?label }
                    OPTIONAL { ?resource dc:title ?label }
                    OPTIONAL { ?resource dcterms:title ?label }
                    OPTIONAL { ?resource rdfs:comment ?description }
                    OPTIONAL { ?resource skos:definition ?description }
                    OPTIONAL { ?resource dc:description ?description }
                    OPTIONAL { ?resource dcterms:description ?description }
                }
            }
            LIMIT ${limit}
        `;

        try {
            const results = await this.executeQuery(query);
            return results.results.bindings;
        } catch (error) {
            logger.error(`Error searching resources for "${searchText}":`, error);
            throw error;
        }
    }

    /**
     * Get neighboring nodes for graph exploration
     * @param {string} nodeUri - The node URI to get neighbors for
     * @param {string} graphName - The graph name to query
     * @param {number} limit - Maximum number of neighbors
     * @returns {Promise<Array>} Array of neighboring nodes
     */
    async getNodeNeighbors(nodeUri, graphName = this.graphName, limit = 50) {
        const query = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT DISTINCT ?neighbor ?predicate ?direction ?label WHERE {
                GRAPH <${graphName}> {
                    {
                        <${nodeUri}> ?predicate ?neighbor .
                        BIND("outgoing" as ?direction)
                    } UNION {
                        ?neighbor ?predicate <${nodeUri}> .
                        BIND("incoming" as ?direction)
                    }
                    FILTER(isURI(?neighbor))
                    OPTIONAL { ?neighbor rdfs:label ?label }
                }
            }
            LIMIT ${limit}
        `;

        try {
            const results = await this.executeQuery(query);
            return results.results.bindings;
        } catch (error) {
            logger.error(`Error fetching neighbors for node ${nodeUri}:`, error);
            throw error;
        }
    }

    /**
     * Export graph data as vis-network compatible format
     * @param {string} subjectUri - Starting subject URI
     * @param {number} depth - Exploration depth
     * @param {string} graphName - The graph name to query
     * @returns {Promise<Object>} Vis-network compatible data {nodes, edges}
     */
    async exportForVisNetwork(subjectUri, depth = 2, graphName = this.graphName) {
        const query = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            SELECT DISTINCT ?s ?p ?o ?sLabel ?oLabel ?sType ?oType WHERE {
                GRAPH <${graphName}> {
                    {
                        <${subjectUri}> ?p ?o .
                        BIND(<${subjectUri}> as ?s)
                    } UNION {
                        <${subjectUri}> ?p1 ?intermediate .
                        ?intermediate ?p ?o .
                        BIND(?intermediate as ?s)
                        FILTER(?intermediate != <${subjectUri}>)
                    }
                    
                    OPTIONAL { ?s rdfs:label ?sLabel }
                    OPTIONAL { ?o rdfs:label ?oLabel }
                    OPTIONAL { ?s rdf:type ?sType }
                    OPTIONAL { ?o rdf:type ?oType }
                }
            }
            LIMIT 200
        `;

        try {
            const results = await this.executeQuery(query);
            const bindings = results.results.bindings;
            
            const nodes = new Map();
            const edges = [];

            bindings.forEach(binding => {
                const s = binding.s.value;
                const p = binding.p.value;
                const o = binding.o.value;
                
                // Add subject node
                if (!nodes.has(s)) {
                    nodes.set(s, {
                        id: s,
                        label: this.getShortLabel(binding.sLabel?.value || s),
                        title: s,
                        group: this.getNodeGroup(binding.sType?.value),
                        shape: 'dot'
                    });
                }
                
                // Add object node (if it's a URI)
                if (binding.o.type === 'uri' && !nodes.has(o)) {
                    nodes.set(o, {
                        id: o,
                        label: this.getShortLabel(binding.oLabel?.value || o),
                        title: o,
                        group: this.getNodeGroup(binding.oType?.value),
                        shape: 'dot'
                    });
                }
                
                // Add edge
                if (binding.o.type === 'uri') {
                    edges.push({
                        from: s,
                        to: o,
                        label: this.getShortLabel(p),
                        title: p,
                        arrows: 'to'
                    });
                }
            });

            return {
                nodes: Array.from(nodes.values()),
                edges: edges
            };
        } catch (error) {
            logger.error(`Error exporting graph data for vis-network:`, error);
            throw error;
        }
    }

    /**
     * Get a short label for display purposes
     * @param {string} uri - The URI or label
     * @returns {string} Short label
     */
    getShortLabel(uri) {
        if (!uri) return 'Unknown';
        
        // If it's a URI, try to extract the local name
        if (uri.startsWith('http')) {
            const lastSlash = uri.lastIndexOf('/');
            const lastHash = uri.lastIndexOf('#');
            const lastIndex = Math.max(lastSlash, lastHash);
            
            if (lastIndex > 0 && lastIndex < uri.length - 1) {
                return uri.substring(lastIndex + 1);
            }
        }
        
        return uri.length > 30 ? uri.substring(0, 27) + '...' : uri;
    }

    /**
     * Determine node group/color based on RDF type
     * @param {string} type - The RDF type URI
     * @returns {string} Group identifier
     */
    getNodeGroup(type) {
        if (!type) return 'default';
        
        if (type.includes('Person')) return 'person';
        if (type.includes('Organization')) return 'organization';
        if (type.includes('Place') || type.includes('Location')) return 'place';
        if (type.includes('Event')) return 'event';
        if (type.includes('Concept')) return 'concept';
        if (type.includes('Document') || type.includes('Article')) return 'document';
        
        return 'default';
    }
}

export default SPARQLService;