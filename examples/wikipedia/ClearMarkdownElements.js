#!/usr/bin/env node

/**
 * Clear existing markdown TextElements for testing
 */

import chalk from 'chalk';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

async function clearMarkdownElements() {
    console.log(chalk.bold.blue('🧹 Clearing existing markdown TextElements...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    const deleteQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

DELETE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement ?p ?o .
        ?corpuscle ragno:hasTextElement ?textElement .
    }
}
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement ragno:contentType "text/markdown" .
        ?textElement ?p ?o .
        OPTIONAL { ?corpuscle ragno:hasTextElement ?textElement }
    }
}`;
    
    const result = await sparqlHelper.executeUpdate(deleteQuery);
    
    if (result.success) {
        console.log(chalk.green('✅ Cleared existing markdown TextElements'));
    } else {
        console.log(chalk.red('❌ Failed to clear elements:', result.error));
    }
}

clearMarkdownElements().catch(console.error);