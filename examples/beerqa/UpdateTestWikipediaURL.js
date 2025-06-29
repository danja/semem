#!/usr/bin/env node

/**
 * Update one test Wikipedia URL to a real Wikipedia page
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function updateTestURL() {
    console.log(chalk.bold.blue('🔄 Updating test Wikipedia URL to real page...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Update the Tesla correspondence URL to point to the Tesla Wikipedia page (which exists)
    const updateQuery = `
PREFIX prov: <http://www.w3.org/ns/prov#>

DELETE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement prov:wasDerivedFrom <https://en.wikipedia.org/wiki/Tesla_correspondence> .
    }
}
INSERT {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement prov:wasDerivedFrom <https://en.wikipedia.org/wiki/Nikola_Tesla> .
    }
}
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement prov:wasDerivedFrom <https://en.wikipedia.org/wiki/Tesla_correspondence> .
    }
}`;
    
    const result = await sparqlHelper.executeUpdate(updateQuery);
    
    if (result.success) {
        console.log(chalk.green('✅ Updated Tesla URL to point to real Wikipedia page: Nikola_Tesla'));
    } else {
        console.log(chalk.red('❌ Failed to update URL:', result.error));
    }
}

updateTestURL().catch(console.error);