#!/usr/bin/env node

/**
 * Check what ragno:maybeRelated URIs look like
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function checkRelatedURIs() {
    console.log(chalk.bold.blue('🔍 Checking ragno:maybeRelated URIs...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Check what ragno:maybeRelated URIs exist
    const relatedQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?relatedURI
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:maybeRelated ?relatedURI .
    }
}`;
    
    console.log(chalk.yellow('Related URIs:'));
    const relatedResult = await sparqlHelper.executeSelect(relatedQuery);
    
    if (relatedResult.success) {
        for (const binding of relatedResult.data.results.bindings) {
            console.log(`   Question: ${binding.questionText.value.substring(0, 50)}...`);
            console.log(`   Related: ${binding.relatedURI.value}`);
            console.log('');
        }
    }
    
    // Check what Wikipedia corpuscles exist
    const wikiQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?title ?wikipediaURL
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL { ?textElement prov:wasDerivedFrom ?wikipediaURL }
    }
}`;
    
    console.log(chalk.yellow('Wikipedia corpuscles:'));
    const wikiResult = await sparqlHelper.executeSelect(wikiQuery);
    
    if (wikiResult.success) {
        for (const binding of wikiResult.data.results.bindings) {
            console.log(`   Corpuscle: ${binding.corpuscle.value}`);
            console.log(`   Title: ${binding.title.value}`);
            console.log(`   Wikipedia URL: ${binding.wikipediaURL?.value || 'N/A'}`);
            console.log('');
        }
    }
}

checkRelatedURIs().catch(console.error);