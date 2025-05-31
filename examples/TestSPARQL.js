import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import SPARQLStore from '../src/stores/SPARQLStore.js';

// Set up logging with timestamps
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

// Enable debug logging
import logger from 'loglevel';
logger.setLevel('debug');

// Configuration
const CONFIG = {
    sparql: {
        endpoint: 'https://fuseki.hyperdata.it/semem/query',
        updateEndpoint: 'https://fuseki.hyperdata.it/semem/update',
        user: 'admin',
        password: 'admin123',
        graphName: 'http://danny.ayers.name/content',
        dataset: 'semem',
        dimension: 1536
    },
    timeout: 60000 // 60 seconds
};

// Set up timeout
const timeout = setTimeout(() => {
    log(`Script timed out after ${CONFIG.timeout/1000} seconds`);
    process.exit(1);
}, CONFIG.timeout);

async function main() {
    try {
        log('Starting SPARQL test...');
        
        // Initialize SPARQL store
        log('Initializing SPARQL store...');
        const store = new SPARQLStore(
            CONFIG.sparql.endpoint,
            {
                updateEndpoint: CONFIG.sparql.updateEndpoint,
                user: CONFIG.sparql.user,
                password: CONFIG.sparql.password,
                graphName: CONFIG.sparql.graphName,
                dataset: CONFIG.sparql.dataset,
                dimension: CONFIG.sparql.dimension
            }
        );
        
        // Test connection
        log('Testing SPARQL connection...');
        const isConnected = await store.verify();
        if (!isConnected) {
            throw new Error('Failed to connect to SPARQL store');
        }
        log('Successfully connected to SPARQL store');
        
        // Test a simple query
        log('Executing test query...');
        const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
        const results = await store._executeSparqlQuery(query, CONFIG.sparql.endpoint);
        log(`Query results: ${JSON.stringify(results, null, 2)}`);
        
        // Test adding a concept
        log('Testing concept addition...');
        const testConcept = {
            id: 'test:concept:1',
            name: 'Test Concept',
            type: 'TEST',
            description: 'A test concept',
            embedding: new Array(1536).fill(0.1), // Dummy embedding
            metadata: { test: true }
        };
        
        // Use the add method instead of addConcept
        await store.add(testConcept);
        log('Successfully added test concept');
        
        // Clean up
        log('Cleaning up test data...');
        await store._executeSparqlUpdate(
            `DELETE WHERE { GRAPH <${CONFIG.sparql.graphName}> { <${testConcept.id}> ?p ?o } }`,
            CONFIG.sparql.updateEndpoint
        );
        log('Cleanup complete');
        
        log('All tests passed!');
        clearTimeout(timeout);
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error);
        clearTimeout(timeout);
        process.exit(1);
    }
}

// Run the test
main();
