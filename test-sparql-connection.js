import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Set up logging
console.log(`[${new Date().toISOString()}] Starting SPARQL connection test...`);

// Load config file
const configPath = path.join(process.cwd(), 'config', 'config.json');
console.log(`[${new Date().toISOString()}] Loading config from: ${configPath}`);

let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
    console.log(`[${new Date().toISOString()}] Config loaded successfully`);
} catch (error) {
    console.error(`[${new Date().toISOString()}] Error loading config:`, error);
    process.exit(1);
}

// Get SPARQL endpoint configuration
const sparqlConfig = config.sparqlEndpoints?.[0];
if (!sparqlConfig) {
    console.error(`[${new Date().toISOString()}] No SPARQL endpoints configured`);
    process.exit(1);
}

const endpointUrl = `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`;
const updateUrl = `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`;

console.log(`[${new Date().toISOString()}] Using SPARQL endpoint: ${endpointUrl}`);
console.log(`[${new Date().toISOString()}] Using SPARQL update endpoint: ${updateUrl}`);

// Test SPARQL query
async function testSparqlQuery() {
    console.log(`[${new Date().toISOString()}] Testing SPARQL query...`);
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    
    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            body: query,
            timeout: 10000 // 10 seconds
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`[${new Date().toISOString()}] SPARQL query successful`);
        console.log(`[${new Date().toISOString()}] Results:`, JSON.stringify(result, null, 2));
        return true;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] SPARQL query failed:`, error);
        return false;
    }
}

// Test SPARQL update
async function testSparqlUpdate() {
    console.log(`[${new Date().toISOString()}] Testing SPARQL update...`);
    
    // Use a test graph for updates
    const testGraph = 'http://example.org/test-graph';
    const update = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        INSERT DATA {
            GRAPH <${testGraph}> {
                <http://example.org/test> rdf:type rdfs:Resource ;
                                        rdfs:label "Test data"@en .
            }
        }`;
    
    try {
        const response = await fetch(updateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            body: update,
            timeout: 10000 // 10 seconds
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        console.log(`[${new Date().toISOString()}] SPARQL update successful`);
        return true;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] SPARQL update failed:`, error);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log(`[${new Date().toISOString()}] Starting SPARQL connection tests...`);
    
    const querySuccess = await testSparqlQuery();
    const updateSuccess = await testSparqlUpdate();
    
    console.log('\n=== Test Results ===');
    console.log(`SPARQL Query: ${querySuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`SPARQL Update: ${updateSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (querySuccess && updateSuccess) {
        console.log('\n✅ All SPARQL tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some SPARQL tests failed');
        process.exit(1);
    }
}

// Run the tests
runTests().catch(error => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
    process.exit(1);
});
