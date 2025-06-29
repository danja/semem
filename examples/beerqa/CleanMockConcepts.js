#!/usr/bin/env node

/**
 * Clean up mock concepts to test HyDE functionality
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function cleanMockConcepts() {
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        graphURI: 'http://purl.org/stuff/beerqa/test'
    };

    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });

    // Delete all concept attributes
    const deleteQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

DELETE {
    GRAPH <${config.graphURI}> {
        ?attr ?p ?o .
        ?corpuscle ragno:hasAttribute ?attr .
    }
}
WHERE {
    GRAPH <${config.graphURI}> {
        ?attr a ragno:Attribute ;
              ragno:attributeType "concept" .
        ?attr ?p ?o .
        ?corpuscle ragno:hasAttribute ?attr .
    }
}`;

    try {
        console.log('🧹 Cleaning up mock concepts...');
        
        const result = await sparqlHelper.executeUpdate(deleteQuery);
        
        if (result.success) {
            console.log(chalk.green('✅ Successfully cleaned up mock concepts!'));
            console.log(chalk.yellow('💡 You can now test HyDE functionality with QuestionResearch.js'));
        } else {
            console.log(chalk.red('❌ Failed to clean concepts:', result.error));
        }

    } catch (error) {
        console.log(chalk.red('❌ Failed to clean mock concepts:', error.message));
    }
}

cleanMockConcepts();