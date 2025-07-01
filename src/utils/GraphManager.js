/**
 * GraphManager - Utility for common RDF graph operations
 * 
 * This component provides standardized operations for managing RDF graphs
 * including clearing, dropping, creating, and validating graph operations.
 * 
 * API: clearGraph(input, resources, options)
 */

import logger from 'loglevel';

export default class GraphManager {
    /**
     * Clear all triples from a named graph
     * 
     * @param {Object} input - Clear operation input data
     * @param {string} input.graphURI - URI of the graph to clear
     * @param {boolean} input.confirm - Skip confirmation if true (default: false)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} options - Configuration options
     * @param {boolean} options.validateExists - Check if graph exists before clearing (default: true)
     * @param {boolean} options.dryRun - Only simulate the operation (default: false)
     * @returns {Promise<Object>} Operation results
     */
    async clearGraph(input, resources, options = {}) {
        try {
            const { graphURI, confirm = false } = input;
            const { sparqlHelper } = resources;
            
            const operationConfig = {
                validateExists: options.validateExists !== false,
                dryRun: options.dryRun || false,
                ...options
            };

            // Validate inputs
            if (!graphURI) {
                throw new Error('Graph URI is required');
            }
            
            if (!sparqlHelper) {
                throw new Error('SPARQL helper is required');
            }

            // Check if graph exists (if validation enabled)
            let existsCheck = null;
            if (operationConfig.validateExists) {
                existsCheck = await this._checkGraphExists(graphURI, sparqlHelper);
                if (!existsCheck.exists) {
                    return {
                        success: true,
                        message: 'Graph does not exist, no action needed',
                        graphURI,
                        metadata: {
                            operation: 'clear',
                            triplesRemoved: 0,
                            graphExisted: false,
                            timestamp: new Date().toISOString()
                        }
                    };
                }
            }

            // Count triples before clearing (for reporting)
            const tripleCount = await this._countTriples(graphURI, sparqlHelper);

            // Dry run mode
            if (operationConfig.dryRun) {
                return {
                    success: true,
                    message: 'Dry run completed - would clear graph',
                    graphURI,
                    metadata: {
                        operation: 'clear-dry-run',
                        wouldRemoveTriples: tripleCount.count,
                        graphExists: existsCheck?.exists || true,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Perform the clear operation
            const clearQuery = `CLEAR GRAPH <${graphURI}>`;
            const result = await sparqlHelper.executeUpdate(clearQuery);

            if (result.success) {
                return {
                    success: true,
                    message: `Successfully cleared graph: ${graphURI}`,
                    graphURI,
                    metadata: {
                        operation: 'clear',
                        triplesRemoved: tripleCount.count,
                        graphExisted: existsCheck?.exists || true,
                        timestamp: new Date().toISOString(),
                        queryExecuted: clearQuery
                    }
                };
            } else {
                throw new Error(result.error || 'Failed to clear graph');
            }

        } catch (error) {
            logger.error('Failed to clear graph:', error.message);
            return {
                success: false,
                error: error.message,
                graphURI: input.graphURI,
                metadata: {
                    operation: 'clear',
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Drop a named graph completely
     * 
     * @param {Object} input - Drop operation input data
     * @param {string} input.graphURI - URI of the graph to drop
     * @param {boolean} input.ifExists - Only drop if exists (default: true)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} options - Configuration options
     * @param {boolean} options.dryRun - Only simulate the operation (default: false)
     * @returns {Promise<Object>} Operation results
     */
    async dropGraph(input, resources, options = {}) {
        try {
            const { graphURI, ifExists = true } = input;
            const { sparqlHelper } = resources;
            
            const operationConfig = {
                dryRun: options.dryRun || false,
                ...options
            };

            if (!graphURI || !sparqlHelper) {
                throw new Error('Graph URI and SPARQL helper are required');
            }

            // Check if graph exists
            const existsCheck = await this._checkGraphExists(graphURI, sparqlHelper);
            
            if (!existsCheck.exists && ifExists) {
                return {
                    success: true,
                    message: 'Graph does not exist, no action needed',
                    graphURI,
                    metadata: {
                        operation: 'drop',
                        graphExisted: false,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Count triples before dropping
            const tripleCount = await this._countTriples(graphURI, sparqlHelper);

            // Dry run mode
            if (operationConfig.dryRun) {
                return {
                    success: true,
                    message: 'Dry run completed - would drop graph',
                    graphURI,
                    metadata: {
                        operation: 'drop-dry-run',
                        wouldRemoveTriples: tripleCount.count,
                        graphExists: existsCheck.exists,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Perform the drop operation
            const dropQuery = ifExists ? 
                `DROP GRAPH IF EXISTS <${graphURI}>` : 
                `DROP GRAPH <${graphURI}>`;
                
            const result = await sparqlHelper.executeUpdate(dropQuery);

            if (result.success) {
                return {
                    success: true,
                    message: `Successfully dropped graph: ${graphURI}`,
                    graphURI,
                    metadata: {
                        operation: 'drop',
                        triplesRemoved: tripleCount.count,
                        graphExisted: existsCheck.exists,
                        timestamp: new Date().toISOString(),
                        queryExecuted: dropQuery
                    }
                };
            } else {
                throw new Error(result.error || 'Failed to drop graph');
            }

        } catch (error) {
            logger.error('Failed to drop graph:', error.message);
            return {
                success: false,
                error: error.message,
                graphURI: input.graphURI,
                metadata: {
                    operation: 'drop',
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get statistics about a graph
     * 
     * @param {Object} input - Statistics input data
     * @param {string} input.graphURI - URI of the graph to analyze
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} options - Configuration options
     * @param {boolean} options.includeTypes - Include type counts (default: true)
     * @param {boolean} options.includePredicates - Include predicate counts (default: true)
     * @returns {Promise<Object>} Graph statistics
     */
    async getGraphStatistics(input, resources, options = {}) {
        try {
            const { graphURI } = input;
            const { sparqlHelper } = resources;
            
            const statsConfig = {
                includeTypes: options.includeTypes !== false,
                includePredicates: options.includePredicates !== false,
                ...options
            };

            if (!graphURI || !sparqlHelper) {
                throw new Error('Graph URI and SPARQL helper are required');
            }

            const statistics = {
                graphURI,
                exists: false,
                tripleCount: 0,
                subjectCount: 0,
                predicateCount: 0,
                objectCount: 0,
                types: [],
                predicates: []
            };

            // Check if graph exists
            const existsCheck = await this._checkGraphExists(graphURI, sparqlHelper);
            statistics.exists = existsCheck.exists;
            
            if (!existsCheck.exists) {
                return {
                    success: true,
                    statistics,
                    metadata: {
                        operation: 'statistics',
                        graphExists: false,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Get basic counts
            const basicStats = await this._getBasicStatistics(graphURI, sparqlHelper);
            Object.assign(statistics, basicStats);

            // Get type counts if requested
            if (statsConfig.includeTypes) {
                statistics.types = await this._getTypeCounts(graphURI, sparqlHelper);
            }

            // Get predicate counts if requested
            if (statsConfig.includePredicates) {
                statistics.predicates = await this._getPredicateCounts(graphURI, sparqlHelper);
            }

            return {
                success: true,
                statistics,
                metadata: {
                    operation: 'statistics',
                    graphExists: true,
                    includeTypes: statsConfig.includeTypes,
                    includePredicates: statsConfig.includePredicates,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Failed to get graph statistics:', error.message);
            return {
                success: false,
                error: error.message,
                graphURI: input.graphURI,
                metadata: {
                    operation: 'statistics',
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Check if a graph exists
     * @private
     */
    async _checkGraphExists(graphURI, sparqlHelper) {
        try {
            const query = `ASK WHERE { GRAPH <${graphURI}> { ?s ?p ?o } }`;
            const result = await sparqlHelper.executeSelect(query);
            
            return {
                exists: result.success && result.data.boolean === true,
                query
            };
        } catch (error) {
            logger.debug('Graph existence check failed:', error.message);
            return { exists: false };
        }
    }

    /**
     * Count triples in a graph
     * @private
     */
    async _countTriples(graphURI, sparqlHelper) {
        try {
            const query = `SELECT (COUNT(*) as ?count) WHERE { GRAPH <${graphURI}> { ?s ?p ?o } }`;
            const result = await sparqlHelper.executeSelect(query);
            
            if (result.success && result.data.results.bindings.length > 0) {
                return {
                    count: parseInt(result.data.results.bindings[0].count.value),
                    query
                };
            }
            
            return { count: 0 };
        } catch (error) {
            logger.debug('Triple count failed:', error.message);
            return { count: 0 };
        }
    }

    /**
     * Get basic graph statistics
     * @private
     */
    async _getBasicStatistics(graphURI, sparqlHelper) {
        try {
            const query = `SELECT 
    (COUNT(*) as ?tripleCount)
    (COUNT(DISTINCT ?s) as ?subjectCount)
    (COUNT(DISTINCT ?p) as ?predicateCount)
    (COUNT(DISTINCT ?o) as ?objectCount)
WHERE { 
    GRAPH <${graphURI}> { 
        ?s ?p ?o 
    } 
}`;

            const result = await sparqlHelper.executeSelect(query);
            
            if (result.success && result.data.results.bindings.length > 0) {
                const binding = result.data.results.bindings[0];
                return {
                    tripleCount: parseInt(binding.tripleCount?.value || 0),
                    subjectCount: parseInt(binding.subjectCount?.value || 0),
                    predicateCount: parseInt(binding.predicateCount?.value || 0),
                    objectCount: parseInt(binding.objectCount?.value || 0)
                };
            }
            
            return {
                tripleCount: 0,
                subjectCount: 0,
                predicateCount: 0,
                objectCount: 0
            };
        } catch (error) {
            logger.debug('Basic statistics failed:', error.message);
            return {
                tripleCount: 0,
                subjectCount: 0,
                predicateCount: 0,
                objectCount: 0
            };
        }
    }

    /**
     * Get type counts in graph
     * @private
     */
    async _getTypeCounts(graphURI, sparqlHelper) {
        try {
            const query = `SELECT ?type (COUNT(*) as ?count) WHERE { 
    GRAPH <${graphURI}> { 
        ?s a ?type 
    } 
} 
GROUP BY ?type 
ORDER BY DESC(?count)
LIMIT 20`;

            const result = await sparqlHelper.executeSelect(query);
            
            if (result.success) {
                return result.data.results.bindings.map(binding => ({
                    type: binding.type.value,
                    count: parseInt(binding.count.value)
                }));
            }
            
            return [];
        } catch (error) {
            logger.debug('Type counts failed:', error.message);
            return [];
        }
    }

    /**
     * Get predicate counts in graph
     * @private
     */
    async _getPredicateCounts(graphURI, sparqlHelper) {
        try {
            const query = `SELECT ?predicate (COUNT(*) as ?count) WHERE { 
    GRAPH <${graphURI}> { 
        ?s ?predicate ?o 
    } 
} 
GROUP BY ?predicate 
ORDER BY DESC(?count)
LIMIT 20`;

            const result = await sparqlHelper.executeSelect(query);
            
            if (result.success) {
                return result.data.results.bindings.map(binding => ({
                    predicate: binding.predicate.value,
                    count: parseInt(binding.count.value)
                }));
            }
            
            return [];
        } catch (error) {
            logger.debug('Predicate counts failed:', error.message);
            return [];
        }
    }
}