#!/usr/bin/env node

/**
 * Debug what content is being retrieved for context
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function debugContext() {
    console.log(chalk.bold.blue('🔍 Debugging context retrieval...'));
    
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
    
    // Check what related entities exist
    const relQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?targetEntity ?weight
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:weight ?weight .
        
        FILTER(?question != ?targetEntity)
    }
}
ORDER BY DESC(?weight)`;
    
    const relResult = await sparqlHelper.executeSelect(relQuery);
    
    if (relResult.success) {
        console.log(chalk.yellow('Related entities:'));
        for (const binding of relResult.data.results.bindings) {
            console.log(`   Target: ${binding.targetEntity.value}`);
            console.log(`   Weight: ${binding.weight.value}`);
            console.log('');
        }
        
        // Check what content is available for these entities
        const entityURIs = relResult.data.results.bindings.map(b => b.targetEntity.value);
        
        for (const entityURI of entityURIs) {
            console.log(chalk.bold.white(`Content for: ${entityURI}`));
            
            // Check Wikipedia content
            const wikiQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?title ?content ?contentType
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        <${entityURI}> a ragno:Corpuscle ;
                      ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL {
            ?textElement ragno:content ?content ;
                        ragno:contentType ?contentType .
        }
    }
}`;
            
            const wikiResult = await sparqlHelper.executeSelect(wikiQuery);
            
            if (wikiResult.success && wikiResult.data.results.bindings.length > 0) {
                const binding = wikiResult.data.results.bindings[0];
                console.log(`   Title: ${binding.title.value}`);
                console.log(`   Content Type: ${binding.contentType?.value || 'N/A'}`);
                
                if (binding.content) {
                    const content = binding.content.value;
                    console.log(`   Content Length: ${content.length}`);
                    console.log(`   Content Preview: ${content.substring(0, 200)}...`);
                } else {
                    console.log(`   Content: None`);
                }
            } else {
                console.log(`   No Wikipedia content found`);
            }
            
            console.log('');
        }
    }
}

debugContext().catch(console.error);