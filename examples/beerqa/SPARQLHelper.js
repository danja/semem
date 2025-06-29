/**
 * SPARQLHelper - Utility for creating SPARQL UPDATE queries and executing them
 * 
 * This helper provides simple templating methods for creating UPDATE queries
 * and posting them to SPARQL update endpoints.
 */

import fetch from 'node-fetch';
import logger from 'loglevel';

export default class SPARQLHelper {
    /**
     * @param {string} updateEndpoint - SPARQL update endpoint URL
     * @param {Object} options - Configuration options
     */
    constructor(updateEndpoint, options = {}) {
        this.updateEndpoint = updateEndpoint;
        this.options = {
            auth: options.auth || null, // { user: 'admin', password: 'admin123' }
            timeout: options.timeout || 30000,
            headers: options.headers || {},
            ...options
        };
    }

    /**
     * Create INSERT DATA query template
     * 
     * @param {string} graph - Named graph URI
     * @param {string} triples - RDF triples in Turtle syntax
     * @returns {string} - SPARQL UPDATE query
     */
    createInsertDataQuery(graph, triples) {
        return `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${graph}> {
        ${triples}
    }
}`;
    }

    /**
     * Create INSERT query template with WHERE clause
     * 
     * @param {string} graph - Named graph URI
     * @param {string} insertTriples - Triples to insert
     * @param {string} whereClause - WHERE clause conditions
     * @returns {string} - SPARQL UPDATE query
     */
    createInsertQuery(graph, insertTriples, whereClause = '') {
        const whereSection = whereClause ? `WHERE {\n    ${whereClause}\n}` : '';
        
        return `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT {
    GRAPH <${graph}> {
        ${insertTriples}
    }
} ${whereSection}`;
    }

    /**
     * Create DELETE/INSERT query template
     * 
     * @param {string} graph - Named graph URI
     * @param {string} deleteTriples - Triples to delete
     * @param {string} insertTriples - Triples to insert
     * @param {string} whereClause - WHERE clause conditions
     * @returns {string} - SPARQL UPDATE query
     */
    createDeleteInsertQuery(graph, deleteTriples, insertTriples, whereClause) {
        return `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

DELETE {
    GRAPH <${graph}> {
        ${deleteTriples}
    }
}
INSERT {
    GRAPH <${graph}> {
        ${insertTriples}
    }
}
WHERE {
    ${whereClause}
}`;
    }

    /**
     * Create CLEAR GRAPH query
     * 
     * @param {string} graph - Named graph URI to clear
     * @returns {string} - SPARQL UPDATE query
     */
    createClearGraphQuery(graph) {
        return `CLEAR GRAPH <${graph}>`;
    }

    /**
     * Create DROP GRAPH query
     * 
     * @param {string} graph - Named graph URI to drop
     * @returns {string} - SPARQL UPDATE query
     */
    createDropGraphQuery(graph) {
        return `DROP GRAPH <${graph}>`;
    }

    /**
     * Execute SPARQL UPDATE query via HTTP POST
     * 
     * @param {string} query - SPARQL UPDATE query
     * @returns {Promise<Object>} - Response object with success/error status
     */
    async executeUpdate(query) {
        const startTime = Date.now();
        
        try {
            logger.info('Executing SPARQL UPDATE:', this.updateEndpoint);
            logger.debug('Query:', query.substring(0, 500) + (query.length > 500 ? '...' : ''));

            // Prepare headers
            const headers = {
                'Content-Type': 'application/sparql-update',
                'Accept': 'application/json, text/plain',
                ...this.options.headers
            };

            // Add Basic Authentication if provided
            if (this.options.auth) {
                const credentials = Buffer.from(`${this.options.auth.user}:${this.options.auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }

            // Execute HTTP POST request
            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers,
                body: query,
                timeout: this.options.timeout
            });

            const responseTime = Date.now() - startTime;
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`SPARQL UPDATE failed (${response.status}): ${response.statusText}`);
                logger.error('Error response:', errorText);
                
                return {
                    success: false,
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    responseTime
                };
            }

            const responseText = await response.text();
            logger.info(`SPARQL UPDATE completed successfully (${responseTime}ms)`);
            
            return {
                success: true,
                status: response.status,
                statusText: response.statusText,
                response: responseText,
                responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('SPARQL UPDATE request failed:', error.message);
            
            return {
                success: false,
                error: error.message,
                responseTime
            };
        }
    }

    /**
     * Execute SPARQL SELECT query
     * 
     * @param {string} query - SPARQL SELECT query
     * @returns {Promise<Object>} - Response object with results
     */
    async executeSelect(query) {
        const startTime = Date.now();
        
        try {
            logger.info('Executing SPARQL SELECT query...');
            logger.debug('Query:', query);

            // Convert update endpoint to query endpoint
            const queryEndpoint = this.updateEndpoint.replace('/update', '/query');

            // Prepare headers
            const headers = {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                ...this.options.headers
            };

            // Add Basic Authentication if provided
            if (this.options.auth) {
                const credentials = Buffer.from(`${this.options.auth.user}:${this.options.auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }

            // Execute HTTP POST request
            const response = await fetch(queryEndpoint, {
                method: 'POST',
                headers,
                body: query,
                timeout: this.options.timeout
            });

            const responseTime = Date.now() - startTime;
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`SPARQL SELECT failed (${response.status}): ${response.statusText}`);
                logger.error('Error response:', errorText);
                
                return {
                    success: false,
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    responseTime
                };
            }

            const data = await response.json();
            logger.info(`SPARQL SELECT completed successfully (${responseTime}ms)`);
            
            return {
                success: true,
                status: response.status,
                statusText: response.statusText,
                data: data,
                responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('SPARQL SELECT error:', error.message);
            
            return {
                success: false,
                error: error.message,
                responseTime
            };
        }
    }

    /**
     * Execute multiple SPARQL UPDATE queries in sequence
     * 
     * @param {string[]} queries - Array of SPARQL UPDATE queries
     * @returns {Promise<Object[]>} - Array of response objects
     */
    async executeUpdates(queries) {
        const results = [];
        
        for (let i = 0; i < queries.length; i++) {
            logger.info(`Executing update ${i + 1}/${queries.length}`);
            const result = await this.executeUpdate(queries[i]);
            results.push(result);
            
            // Stop on first failure unless configured to continue
            if (!result.success && !this.options.continueOnError) {
                logger.error(`Update ${i + 1} failed, stopping execution`);
                break;
            }
            
            // Add delay between requests if configured
            if (this.options.delay && i < queries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.options.delay));
            }
        }
        
        return results;
    }

    /**
     * Batch multiple triples into a single INSERT DATA query
     * 
     * @param {string} graph - Named graph URI
     * @param {string[]} triplesBatch - Array of triple strings
     * @returns {string} - Combined INSERT DATA query
     */
    batchInsertData(graph, triplesBatch) {
        const combinedTriples = triplesBatch.join('\n        ');
        return this.createInsertDataQuery(graph, combinedTriples);
    }

    /**
     * Escape string literals for SPARQL
     * 
     * @param {string} str - String to escape
     * @returns {string} - Escaped string safe for SPARQL
     */
    static escapeString(str) {
        if (typeof str !== 'string') return str;
        
        return str
            .replace(/\\/g, '\\\\')  // Escape backslashes
            .replace(/"/g, '\\"')    // Escape quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t');  // Escape tabs
    }

    /**
     * Create a safe literal value for SPARQL
     * 
     * @param {string} value - Value to wrap
     * @param {string} datatype - XSD datatype URI (optional)
     * @param {string} lang - Language tag (optional)
     * @returns {string} - SPARQL literal
     */
    static createLiteral(value, datatype = null, lang = null) {
        const escaped = SPARQLHelper.escapeString(value);
        
        if (lang) {
            return `"${escaped}"@${lang}`;
        } else if (datatype) {
            return `"${escaped}"^^<${datatype}>`;
        } else {
            return `"${escaped}"`;
        }
    }

    /**
     * Create a safe URI for SPARQL
     * 
     * @param {string} uri - URI to wrap
     * @returns {string} - SPARQL URI
     */
    static createURI(uri) {
        return `<${uri}>`;
    }

    /**
     * Get execution statistics from results
     * 
     * @param {Object[]} results - Array of execution results
     * @returns {Object} - Statistics summary
     */
    static getExecutionStats(results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
        const avgTime = results.length > 0 ? totalTime / results.length : 0;

        return {
            total: results.length,
            successful,
            failed,
            successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
            totalTime,
            averageTime: avgTime,
            errors: results.filter(r => !r.success).map(r => r.error || r.statusText)
        };
    }
}