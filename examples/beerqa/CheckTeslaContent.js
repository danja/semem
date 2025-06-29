#!/usr/bin/env node

/**
 * Check Tesla corpuscle content and its relationships
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function checkTeslaContent() {
    console.log(chalk.bold.blue('🔍 Checking Tesla corpuscle...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Find Tesla corpuscle
    const teslaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?corpuscle ?title ?content
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL { ?textElement ragno:content ?content }
        
        FILTER(CONTAINS(LCASE(?title), "tesla"))
    }
}`;
    
    const teslaResult = await sparqlHelper.executeSelect(teslaQuery);
    
    if (teslaResult.success && teslaResult.data.results.bindings.length > 0) {
        const tesla = teslaResult.data.results.bindings[0];
        console.log(chalk.green('✅ Found Tesla corpuscle:'));
        console.log(`   URI: ${tesla.corpuscle.value}`);
        console.log(`   Title: ${tesla.title.value}`);
        
        if (tesla.content) {
            console.log(`   Content Length: ${tesla.content.value.length}`);
            console.log(`   Content Preview: ${tesla.content.value.substring(0, 200)}...`);
        } else {
            console.log(`   Content: None`);
        }
        
        // Check if this Tesla corpuscle is in any relationships
        const relQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?relationship ?sourceEntity ?relationshipType ?weight
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?relationship a ragno:Relationship ;
                     ragno:hasTargetEntity <${tesla.corpuscle.value}> ;
                     ragno:hasSourceEntity ?sourceEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
    }
}`;
        
        const relResult = await sparqlHelper.executeSelect(relQuery);
        
        if (relResult.success) {
            console.log(`   Relationships: ${relResult.data.results.bindings.length}`);
            for (const rel of relResult.data.results.bindings) {
                console.log(`     Type: ${rel.relationshipType.value}, Weight: ${rel.weight.value}`);
            }
        }
    } else {
        console.log(chalk.red('❌ No Tesla corpuscle found'));
        
        // List all Wikipedia corpuscles
        const allQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?corpuscle ?title
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
    }
}`;
        
        const allResult = await sparqlHelper.executeSelect(allQuery);
        
        if (allResult.success) {
            console.log(chalk.yellow('All Wikipedia corpuscles:'));
            for (const binding of allResult.data.results.bindings) {
                console.log(`   ${binding.corpuscle.value}: ${binding.title.value}`);
            }
        }
    }
}

checkTeslaContent().catch(console.error);