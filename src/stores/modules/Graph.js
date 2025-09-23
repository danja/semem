import dotenv from 'dotenv';
import Config from '../../Config.js';
import { SPARQL_CONFIG } from '../../../config/preferences.js';
import SPARQLTemplateLoader from '../SPARQLTemplateLoader.js';
import Graph from 'graphology';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('graph');

dotenv.config();

/**
 * Graph module handles graph operations, traversal, and corpus validation
 * This module manages in-memory concept graphs and provides graph analysis capabilities
 */
export class GraphModule {
    constructor(sparqlExecute, graphName, baseUri) {
        this.config = new Config();
        this.sparqlExecute = sparqlExecute;
        this.graphName = graphName;
        this.baseUri = baseUri;

        // Initialize template loader for query templates
        this.templateLoader = new SPARQLTemplateLoader();

        // Initialize in-memory concept graph
        this.graph = new Graph();

        // Persistence timer for debounced saves
        this._graphPersistenceTimer = null;

        logger.info('Graph module initialized');
    }

    /**
     * Graph traversal query with configurable depth
     * @param {string} startNodeId - Starting node URI
     * @param {number} depth - Maximum traversal depth
     * @param {Object} options - Traversal options (direction, relationTypes)
     * @returns {Promise<Object>} Graph structure with nodes and edges
     */
    async traverseGraph(startNodeId, depth = 2, options = {}) {
        const { direction = 'both', relationTypes = [] } = options;

        // Build property path for traversal
        let propertyPath = 'ragno:connectsTo';
        if (direction === 'outgoing') {
            propertyPath = 'ragno:connectsTo';
        } else if (direction === 'incoming') {
            propertyPath = '^ragno:connectsTo';
        } else {
            propertyPath = 'ragno:connectsTo|^ragno:connectsTo';
        }

        // Add specific relation types if specified
        if (relationTypes.length > 0) {
            const typeConstraints = relationTypes.map(t => `ragno:${t}`).join('|');
            propertyPath = `(${typeConstraints})`;
        }

        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

            SELECT DISTINCT ?node ?label ?type ?distance WHERE {
                GRAPH <${this.graphName}> {
                    <${startNodeId}> (${propertyPath}){0,${depth}} ?node .
                    ?node rdfs:label ?label .
                    OPTIONAL { ?node rdf:type ?type }

                    # Calculate distance (approximation)
                    {
                        SELECT ?node (COUNT(?intermediate) AS ?distance) WHERE {
                            <${startNodeId}> (${propertyPath})* ?intermediate .
                            ?intermediate (${propertyPath})* ?node .
                        }
                        GROUP BY ?node
                    }
                }
            }
            ORDER BY ?distance ?label
        `;

        try {
            const result = await this.sparqlExecute.executeSparqlQuery(query);
            const nodes = new Map();
            const edges = [];

            // Process nodes
            for (const binding of result.results.bindings) {
                const nodeId = binding.node.value;
                nodes.set(nodeId, {
                    id: nodeId,
                    label: binding.label.value,
                    type: binding.type?.value || 'unknown',
                    distance: parseInt(binding.distance?.value) || 0
                });
            }

            // Get edges between discovered nodes
            const nodeIds = Array.from(nodes.keys());
            if (nodeIds.length > 1) {
                const edgeQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

                    SELECT ?source ?target ?label ?type WHERE {
                        GRAPH <${this.graphName}> {
                            ?source ragno:connectsTo ?target .
                            ?source rdfs:label ?sourceLabel .
                            ?target rdfs:label ?targetLabel .
                            OPTIONAL { ?source rdfs:label ?label }
                            OPTIONAL { ?source rdf:type ?type }

                            VALUES ?source { ${nodeIds.map(id => `<${id}>`).join(' ')} }
                            VALUES ?target { ${nodeIds.map(id => `<${id}>`).join(' ')} }
                        }
                    }
                `;

                const edgeResult = await this.sparqlExecute.executeSparqlQuery(edgeQuery);
                for (const binding of edgeResult.results.bindings) {
                    edges.push({
                        source: binding.source.value,
                        target: binding.target.value,
                        label: binding.label?.value || '',
                        type: binding.type?.value || 'connection'
                    });
                }
            }

            logger.info(`Traversed graph from ${startNodeId}: ${nodes.size} nodes, ${edges.length} edges`);
            return {
                nodes: Array.from(nodes.values()),
                edges: edges,
                startNode: startNodeId,
                depth: depth
            };
        } catch (error) {
            logger.error('Error in graph traversal:', error);
            return { nodes: [], edges: [], startNode: startNodeId, depth: depth };
        }
    }

    /**
     * Get corpus health and statistics
     * @returns {Promise<Object>} Health check results with statistics
     */
    async validateCorpus() {
        const healthQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT
                (COUNT(DISTINCT ?entity) AS ?entityCount)
                (COUNT(DISTINCT ?unit) AS ?unitCount)
                (COUNT(DISTINCT ?relationship) AS ?relationshipCount)
                (COUNT(DISTINCT ?community) AS ?communityCount)
                (COUNT(DISTINCT ?embedding) AS ?embeddingCount)
            WHERE {
                GRAPH <${this.graphName}> {
                    OPTIONAL { ?entity a ragno:Entity }
                    OPTIONAL { ?unit a ragno:SemanticUnit }
                    OPTIONAL { ?relationship a ragno:Relationship }
                    OPTIONAL { ?community a ragno:Community }
                    OPTIONAL { ?item semem:embedding ?embedding }
                }
            }
        `;

        try {
            const result = await this.sparqlExecute.executeSparqlQuery(healthQuery);
            const binding = result.results.bindings[0];

            const stats = {
                entityCount: parseInt(binding.entityCount?.value) || 0,
                unitCount: parseInt(binding.unitCount?.value) || 0,
                relationshipCount: parseInt(binding.relationshipCount?.value) || 0,
                communityCount: parseInt(binding.communityCount?.value) || 0,
                embeddingCount: parseInt(binding.embeddingCount?.value) || 0
            };

            // Calculate health score
            const totalElements = stats.entityCount + stats.unitCount + stats.relationshipCount;
            const embeddingCoverage = totalElements > 0 ? stats.embeddingCount / totalElements : 0;
            const connectivity = stats.relationshipCount > 0 ? stats.relationshipCount / stats.entityCount : 0;

            const healthy = totalElements > 0 &&
                           embeddingCoverage > SPARQL_CONFIG.HEALTH.MIN_EMBEDDING_COVERAGE &&
                           connectivity > SPARQL_CONFIG.HEALTH.MIN_CONNECTIVITY;

            const recommendations = [];
            if (embeddingCoverage < SPARQL_CONFIG.HEALTH.MIN_EMBEDDING_COVERAGE) {
                recommendations.push('Low embedding coverage - consider regenerating embeddings');
            }
            if (connectivity < SPARQL_CONFIG.HEALTH.MIN_CONNECTIVITY) {
                recommendations.push('Low graph connectivity - consider adding more relationships');
            }
            if (stats.communityCount === 0) {
                recommendations.push('No communities detected - consider running community detection');
            }

            logger.info(`Corpus health check: ${totalElements} elements, ${embeddingCoverage.toFixed(2)} embedding coverage`);
            return {
                healthy,
                stats,
                embeddingCoverage,
                connectivity,
                recommendations
            };
        } catch (error) {
            logger.error('Error in corpus validation:', error);
            return {
                healthy: false,
                stats: {},
                error: error.message,
                recommendations: ['Unable to validate corpus - check SPARQL endpoint']
            };
        }
    }

    /**
     * Update the in-memory concept graph with new concepts
     * @param {Array<string>} concepts - Array of concept strings
     */
    updateGraph(concepts) {
        // Add new nodes if they don't exist
        for (const concept of concepts) {
            if (!this.graph.hasNode(concept)) {
                this.graph.addNode(concept);
            }
        }

        // Add or update edges between concepts
        for (const concept1 of concepts) {
            for (const concept2 of concepts) {
                if (concept1 !== concept2) {
                    // Check for existing edges between the nodes
                    const existingEdges = this.graph.edges(concept1, concept2);

                    if (existingEdges.length > 0) {
                        // Update weight of first existing edge
                        const edgeWeight = this.graph.getEdgeAttribute(existingEdges[0], 'weight');
                        this.graph.setEdgeAttribute(existingEdges[0], 'weight', edgeWeight + 1);
                    } else {
                        // Create new edge with weight 1
                        this.graph.addEdge(concept1, concept2, { weight: 1 });
                    }
                }
            }
        }

        // Schedule graph persistence (debounced to avoid too frequent updates)
        this._scheduleGraphPersistence();
    }

    /**
     * Load concept graph from SPARQL store
     * @returns {Promise<boolean>} True if successfully loaded
     */
    async loadGraphFromStore() {
        const graphQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT ?graphData WHERE {
                GRAPH <${this.graphName}> {
                    ?graphUri a semem:ConceptGraph ;
                              semem:current "true"^^xsd:boolean ;
                              semem:graphData ?graphData .
                }
            }
            LIMIT 1
        `;

        try {
            const result = await this.sparqlExecute.executeSparqlQuery(graphQuery);
            if (result.results.bindings.length > 0) {
                const binding = result.results.bindings[0];
                const graphData = JSON.parse(binding.graphData.value);

                // Rebuild graph from stored data
                this.graph.clear();
                graphData.nodes.forEach(node => this.graph.addNode(node));
                graphData.edges.forEach(edge => {
                    this.graph.addEdge(edge.source, edge.target, { weight: edge.weight });
                });

                logger.info(`Loaded concept graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
                return true;
            }
        } catch (error) {
            logger.warn('Could not load concept graph from store:', error);
        }
        return false;
    }

    /**
     * Persist concept graph to SPARQL store
     */
    async persistGraphToStore() {
        const graphData = {
            nodes: this.graph.nodes(),
            edges: this.graph.edges().map(edge => {
                const [source, target] = this.graph.extremities(edge);
                return {
                    source,
                    target,
                    weight: this.graph.getEdgeAttribute(edge, 'weight')
                };
            })
        };

        const graphUri = `${this.baseUri}concept-graph/${Date.now()}`;
        const insertQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    <${graphUri}> a semem:ConceptGraph ;
                                 semem:graphData """${JSON.stringify(graphData)}""" ;
                                 semem:nodeCount "${graphData.nodes.length}"^^xsd:integer ;
                                 semem:edgeCount "${graphData.edges.length}"^^xsd:integer ;
                                 semem:current "true"^^xsd:boolean ;
                                 dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                }
            }
        `;

        // Clear previous current graph
        const clearQuery = await this.templateLoader.loadAndInterpolate('store', 'clear-current-concept-graph', {
            graphName: this.graphName
        });

        await this.sparqlExecute.executeSparqlUpdate(clearQuery);
        await this.sparqlExecute.executeSparqlUpdate(insertQuery);

        logger.info(`Persisted concept graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
    }

    /**
     * Schedule debounced graph persistence to avoid frequent saves
     */
    _scheduleGraphPersistence() {
        if (this._graphPersistenceTimer) {
            clearTimeout(this._graphPersistenceTimer);
        }

        this._graphPersistenceTimer = setTimeout(async () => {
            try {
                await this.persistGraphToStore();
            } catch (error) {
                logger.error('Failed to persist concept graph:', error);
            } finally {
                this._graphPersistenceTimer = null;
            }
        }, 30000); // 30 second debounce
    }

    /**
     * Cancel any pending graph persistence
     */
    cancelScheduledPersistence() {
        if (this._graphPersistenceTimer) {
            clearTimeout(this._graphPersistenceTimer);
            this._graphPersistenceTimer = null;
            logger.debug('Cancelled scheduled graph persistence');
        }
    }

    /**
     * Get graph statistics
     * @returns {Object} Graph statistics
     */
    getGraphStats() {
        const nodeCount = this.graph.order;
        const edgeCount = this.graph.size;
        const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;

        // Calculate clustering coefficient (simplified version)
        let totalClustering = 0;
        let nodesWithNeighbors = 0;

        this.graph.forEachNode(node => {
            const neighbors = this.graph.neighbors(node);
            if (neighbors.length > 1) {
                let triangles = 0;
                const possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2;

                for (let i = 0; i < neighbors.length; i++) {
                    for (let j = i + 1; j < neighbors.length; j++) {
                        if (this.graph.hasEdge(neighbors[i], neighbors[j])) {
                            triangles++;
                        }
                    }
                }

                const clustering = possibleTriangles > 0 ? triangles / possibleTriangles : 0;
                totalClustering += clustering;
                nodesWithNeighbors++;
            }
        });

        const avgClustering = nodesWithNeighbors > 0 ? totalClustering / nodesWithNeighbors : 0;

        return {
            nodeCount,
            edgeCount,
            avgDegree,
            avgClustering,
            density: nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0,
            isConnected: this.isGraphConnected()
        };
    }

    /**
     * Check if the graph is connected
     * @returns {boolean} True if connected
     */
    isGraphConnected() {
        if (this.graph.order === 0) return true;
        if (this.graph.order === 1) return true;

        // Simple BFS to check connectivity
        const visited = new Set();
        const queue = [this.graph.nodes()[0]];
        visited.add(queue[0]);

        while (queue.length > 0) {
            const node = queue.shift();
            this.graph.forEachNeighbor(node, neighbor => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            });
        }

        return visited.size === this.graph.order;
    }

    /**
     * Find most central nodes using degree centrality
     * @param {number} limit - Maximum number of nodes to return
     * @returns {Array<Object>} Nodes with centrality scores
     */
    getMostCentralNodes(limit = 10) {
        const centrality = [];

        this.graph.forEachNode(node => {
            const degree = this.graph.degree(node);
            centrality.push({
                node: node,
                degree: degree,
                centrality: degree / (this.graph.order - 1) // Normalized degree centrality
            });
        });

        return centrality
            .sort((a, b) => b.centrality - a.centrality)
            .slice(0, limit);
    }

    /**
     * Find communities using simple modularity-based approach
     * @returns {Array<Array<string>>} Array of communities (arrays of node IDs)
     */
    findCommunities() {
        // Simple community detection based on edge weights
        const communities = [];
        const visited = new Set();

        this.graph.forEachNode(node => {
            if (!visited.has(node)) {
                const community = this._expandCommunity(node, visited);
                if (community.length > 1) {
                    communities.push(community);
                }
            }
        });

        return communities;
    }

    /**
     * Expand community from a seed node using local clustering
     * @param {string} seedNode - Starting node
     * @param {Set} visited - Set of already visited nodes
     * @returns {Array<string>} Community members
     */
    _expandCommunity(seedNode, visited) {
        const community = [seedNode];
        const toExplore = [seedNode];
        visited.add(seedNode);

        while (toExplore.length > 0) {
            const currentNode = toExplore.shift();
            const neighbors = this.graph.neighbors(currentNode);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    // Simple threshold: include if edge weight is above average
                    const edgeWeight = this.graph.getEdgeAttribute(currentNode, neighbor, 'weight') || 1;
                    if (edgeWeight > 1) { // Simple threshold
                        community.push(neighbor);
                        toExplore.push(neighbor);
                        visited.add(neighbor);
                    }
                }
            }
        }

        return community;
    }

    /**
     * Clear the in-memory graph
     */
    clearGraph() {
        this.graph.clear();
        logger.info('Cleared in-memory concept graph');
    }

    /**
     * Get a copy of the current graph
     * @returns {Graph} Copy of the current graph
     */
    getGraphCopy() {
        return this.graph.copy();
    }

    /**
     * Dispose of graph resources
     */
    dispose() {
        this.cancelScheduledPersistence();
        this.clearGraph();
        logger.info('Graph module disposed');
    }
}