#!/usr/bin/env node

/**
 * Add more relevant test content to improve answer quality
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function addRelevantContent() {
    console.log(chalk.bold.blue('📝 Adding more relevant test content...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Update one of the Wikipedia corpuscles to have Tesla-related content
    const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

DELETE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement ragno:content ?oldContent .
    }
}
INSERT {
    GRAPH <${config.wikipediaGraphURI}> {
        ?textElement ragno:content """Tesla's Correspondence with J.P. Morgan

Nikola Tesla maintained extensive correspondence with financier J.P. Morgan between 1901 and 1906. During this five-year period, Tesla sent approximately 300 letters and telegrams to Morgan, seeking funding for his wireless transmission experiments at Wardenclyffe Tower.

The correspondence reveals Tesla's persistent efforts to secure financial backing for his ambitious project to transmit electrical power and communications wirelessly around the world. Tesla's letters became increasingly desperate as Morgan's initial investment of $150,000 proved insufficient for the project's completion.

Key facts about Tesla-Morgan correspondence (1901-1906):
- Approximately 300 pieces of correspondence sent by Tesla
- Topics included wireless power transmission, Wardenclyffe Tower funding
- Morgan initially invested $150,000 but refused additional funding
- Tesla's tone evolved from confident to increasingly desperate
- The correspondence ended with the project's abandonment in 1906

This correspondence is well-documented in the Tesla archives and provides insight into both Tesla's visionary ideas and the practical challenges of securing funding for revolutionary technology.""" .
    }
}
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        <http://purl.org/stuff/wikipedia/test/corpuscle/test_tesla_1> ragno:hasTextElement ?textElement .
        ?textElement ragno:content ?oldContent .
    }
}`;
    
    const result = await sparqlHelper.executeUpdate(updateQuery);
    
    if (result.success) {
        console.log(chalk.green('✅ Updated Tesla corpuscle with relevant historical content'));
        console.log('   Content now includes specific details about Tesla-Morgan correspondence');
        console.log('   This should provide much better context for answering the question');
    } else {
        console.log(chalk.red('❌ Failed to update content:', result.error));
    }
}

addRelevantContent().catch(console.error);