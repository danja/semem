/**
 * @fileoverview Example demonstrating the enhanced SPARQL CONSTRUCT endpoint
 * that returns JSON with RDF data and graph visualization metadata.
 * 
 * This example shows how the updated handleSparqlConstruct method in UIServer.js
 * provides structured JSON responses suitable for:
 * - Loading RDF data into a turtle editor
 * - Triggering graph visualization with nodes and edges
 * - Event bus integration between frontend components
 */

import logger from 'loglevel';

// Set log level for demo
logger.setLevel('info');

/**
 * Demonstrates calling the enhanced SPARQL CONSTRUCT endpoint
 * @param {string} serverUrl - The UIServer base URL (default: http://localhost:4100)
 * @param {string} sparqlQuery - The CONSTRUCT query to execute
 */
async function demonstrateSparqlConstructEndpoint(
    serverUrl = 'http://localhost:4100',
    sparqlQuery = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        
        CONSTRUCT {
            ?entity rdf:type ragno:Entity .
            ?entity rdfs:label ?label .
            ?entity ragno:isEntryPoint ?isEntryPoint .
            ?rel rdf:type ragno:Relationship .
            ?rel ragno:subject ?entity .
            ?rel ragno:predicate ?pred .
            ?rel ragno:object ?target .
        }
        WHERE {
            ?entity rdf:type ragno:Entity .
            OPTIONAL { ?entity rdfs:label ?label }
            OPTIONAL { ?entity ragno:isEntryPoint ?isEntryPoint }
            OPTIONAL {
                ?rel rdf:type ragno:Relationship .
                ?rel ragno:subject ?entity .
                ?rel ragno:predicate ?pred .
                ?rel ragno:object ?target .
            }
        }
        LIMIT 20
    `
) {
    try {
        logger.info('=== SPARQL CONSTRUCT Endpoint Demo ===');
        logger.info(`Server URL: ${serverUrl}`);
        logger.info(`Query preview: ${sparqlQuery.substring(0, 100)}...`);
        
        // Make request to the enhanced SPARQL CONSTRUCT endpoint
        const response = await fetch(`${serverUrl}/api/sparql/construct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query: sparqlQuery,
                format: 'turtle'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Display the structured response
        logger.info('\n=== Response Structure ===');
        logger.info(`Success: ${result.success}`);
        logger.info(`Query type: ${result.metadata?.queryType}`);
        logger.info(`Execution time: ${result.metadata?.executionTime}ms`);
        logger.info(`Timestamp: ${result.metadata?.timestamp}`);
        
        // RDF Data section
        logger.info('\n=== RDF Data ===');
        logger.info(`Format: ${result.rdf?.format}`);
        logger.info(`Size: ${result.rdf?.size} characters`);
        logger.info(`Encoding: ${result.rdf?.encoding}`);
        logger.info(`Data preview: ${result.rdf?.data?.substring(0, 200)}...`);
        
        // Graph Information section
        logger.info('\n=== Graph Information ===');
        logger.info(`Node count: ${result.graph?.nodeCount}`);
        logger.info(`Edge count: ${result.graph?.edgeCount}`);
        logger.info(`Namespaces found: ${result.graph?.namespaces?.length || 0}`);
        
        // Display some sample nodes
        if (result.graph?.nodes?.length > 0) {
            logger.info('\n=== Sample Nodes ===');
            result.graph.nodes.slice(0, 3).forEach((node, index) => {
                logger.info(`Node ${index + 1}:`);
                logger.info(`  ID: ${node.id}`);
                logger.info(`  Label: ${node.label}`);
                logger.info(`  Type: ${node.type}`);
                logger.info(`  URI: ${node.uri}`);
                logger.info(`  Properties: ${JSON.stringify(node.properties, null, 2)}`);
            });
        }
        
        // Display some sample edges
        if (result.graph?.edges?.length > 0) {
            logger.info('\n=== Sample Edges ===');
            result.graph.edges.slice(0, 3).forEach((edge, index) => {
                logger.info(`Edge ${index + 1}:`);
                logger.info(`  ID: ${edge.id}`);
                logger.info(`  Source: ${edge.source}`);
                logger.info(`  Target: ${edge.target}`);
                logger.info(`  Predicate: ${edge.predicate}`);
                logger.info(`  Label: ${edge.label}`);
            });
        }
        
        // Event Bus Integration
        logger.info('\n=== Event Bus Configuration ===');
        logger.info('Frontend components can use these events:');
        
        if (result.events?.triggerTurtleEditor) {
            logger.info('\nTurtle Editor Event:');
            logger.info(`  Type: ${result.events.triggerTurtleEditor.type}`);
            logger.info(`  Source: ${result.events.triggerTurtleEditor.data.source}`);
            logger.info(`  Format: ${result.events.triggerTurtleEditor.data.format}`);
            logger.info(`  Content size: ${result.events.triggerTurtleEditor.data.content?.length} chars`);
        }
        
        if (result.events?.triggerGraphVisualization) {
            logger.info('\nGraph Visualization Event:');
            logger.info(`  Type: ${result.events.triggerGraphVisualization.type}`);
            logger.info(`  Layout: ${result.events.triggerGraphVisualization.data.layout}`);
            logger.info(`  Source: ${result.events.triggerGraphVisualization.data.source}`);
            logger.info(`  Nodes: ${result.events.triggerGraphVisualization.data.nodes?.length}`);
            logger.info(`  Edges: ${result.events.triggerGraphVisualization.data.edges?.length}`);
        }
        
        // Frontend Integration Example
        logger.info('\n=== Frontend Integration Example ===');
        logger.info('// Example frontend code to handle the response:');
        logger.info(`
// Load RDF data into turtle editor
if (response.events?.triggerTurtleEditor) {
    eventBus.emit(response.events.triggerTurtleEditor.type, 
                  response.events.triggerTurtleEditor.data);
}

// Update graph visualization
if (response.events?.triggerGraphVisualization) {
    eventBus.emit(response.events.triggerGraphVisualization.type,
                  response.events.triggerGraphVisualization.data);
}

// Access raw RDF data
const turtleData = response.rdf.data;
const graphNodes = response.graph.nodes;
const graphEdges = response.graph.edges;
        `);
        
        logger.info('\n=== Demo Complete ===');
        return result;
        
    } catch (error) {
        logger.error('Error demonstrating SPARQL CONSTRUCT endpoint:', error);
        
        // Show example error response structure
        logger.info('\n=== Error Response Structure ===');
        logger.info('When errors occur, the endpoint returns:');
        logger.info(`
{
    "success": false,
    "error": "SPARQL CONSTRUCT query failed",
    "message": "Detailed error message",
    "timestamp": "2025-06-16T18:34:27.000Z"
}
        `);
        
        throw error;
    }
}

/**
 * Demonstrates different types of CONSTRUCT queries
 */
async function demonstrateVariousConstructQueries(serverUrl = 'http://localhost:4100') {
    const queries = [
        {
            name: 'Simple Entity Query',
            query: `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                CONSTRUCT { ?s rdf:type ragno:Entity }
                WHERE { ?s rdf:type ragno:Entity }
                LIMIT 5
            `
        },
        {
            name: 'Relationship Network',
            query: `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                CONSTRUCT { 
                    ?rel rdf:type ragno:Relationship .
                    ?rel ragno:subject ?subj .
                    ?rel ragno:object ?obj .
                }
                WHERE { 
                    ?rel rdf:type ragno:Relationship .
                    ?rel ragno:subject ?subj .
                    ?rel ragno:object ?obj .
                }
                LIMIT 10
            `
        },
        {
            name: 'Semantic Units with Entities',
            query: `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                CONSTRUCT { 
                    ?unit rdf:type ragno:SemanticUnit .
                    ?unit rdfs:label ?unitLabel .
                    ?unit ragno:contains ?entity .
                    ?entity rdf:type ragno:Entity .
                }
                WHERE { 
                    ?unit rdf:type ragno:SemanticUnit .
                    OPTIONAL { ?unit rdfs:label ?unitLabel }
                    OPTIONAL { 
                        ?unit ragno:contains ?entity .
                        ?entity rdf:type ragno:Entity .
                    }
                }
                LIMIT 8
            `
        }
    ];
    
    logger.info('\n=== Testing Multiple Query Types ===');
    
    for (const {name, query} of queries) {
        try {
            logger.info(`\n--- ${name} ---`);
            const result = await demonstrateSparqlConstructEndpoint(serverUrl, query);
            logger.info(`✓ Success: ${result.graph.nodeCount} nodes, ${result.graph.edgeCount} edges`);
        } catch (error) {
            logger.error(`✗ Failed: ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    const serverUrl = process.env.SEMEM_SERVER_URL || 'http://localhost:4100';
    
    try {
        // Check if server is running
        logger.info('Checking server health...');
        const healthResponse = await fetch(`${serverUrl}/api/health`);
        if (!healthResponse.ok) {
            throw new Error(`Server not responding at ${serverUrl}`);
        }
        
        logger.info('✓ Server is running');
        
        // Run the main demonstration
        await demonstrateSparqlConstructEndpoint(serverUrl);
        
        // Demonstrate various query types
        await demonstrateVariousConstructQueries(serverUrl);
        
    } catch (error) {
        logger.error('Demo failed:', error.message);
        logger.info('\nTo run this demo:');
        logger.info('1. Start the UIServer: npm run ui-server');
        logger.info('2. Ensure SPARQL endpoint is running with data');
        logger.info('3. Run: node examples/basic/SPARQLConstructExample.js');
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export {
    demonstrateSparqlConstructEndpoint,
    demonstrateVariousConstructQueries
};