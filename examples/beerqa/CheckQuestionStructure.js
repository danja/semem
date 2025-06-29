#!/usr/bin/env node

/**
 * Check the actual structure of BeerQA questions in the SPARQL store
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function checkQuestionStructure() {
    console.log(chalk.bold.blue('🔍 Checking BeerQA question structure...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Check what's in the graph
    const generalQuery = `
SELECT DISTINCT ?type
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?s a ?type .
    }
}`;
    
    console.log(chalk.yellow('Types in graph:'));
    const typesResult = await sparqlHelper.executeSelect(generalQuery);
    
    if (typesResult.success) {
        for (const binding of typesResult.data.results.bindings) {
            console.log(`   • ${binding.type.value}`);
        }
    }
    
    // Check corpuscle structure
    const corpuscleQuery = `
SELECT ?corpuscle ?prop ?value
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?corpuscle a <http://purl.org/stuff/ragno/Corpuscle> .
        ?corpuscle ?prop ?value .
    }
}
LIMIT 20`;
    
    console.log(chalk.yellow('\nCorpuscle properties:'));
    const corpuscleResult = await sparqlHelper.executeSelect(corpuscleQuery);
    
    if (corpuscleResult.success) {
        for (const binding of corpuscleResult.data.results.bindings) {
            const prop = binding.prop.value.split('/').pop().split('#').pop();
            let value = binding.value.value;
            if (value.length > 50) value = value.substring(0, 50) + '...';
            
            console.log(`   • ${prop}: ${value}`);
        }
    }
    
    // Check text element structure  
    const textElementQuery = `
SELECT ?textElement ?prop ?value
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?corpuscle a <http://purl.org/stuff/ragno/Corpuscle> ;
                  <http://purl.org/stuff/ragno/hasTextElement> ?textElement .
        ?textElement ?prop ?value .
    }
}
LIMIT 20`;
    
    console.log(chalk.yellow('\nText element properties:'));
    const textResult = await sparqlHelper.executeSelect(textElementQuery);
    
    if (textResult.success) {
        for (const binding of textResult.data.results.bindings) {
            const prop = binding.prop.value.split('/').pop().split('#').pop();
            let value = binding.value.value;
            if (value.length > 50) value = value.substring(0, 50) + '...';
            
            console.log(`   • ${prop}: ${value}`);
        }
    }
}

checkQuestionStructure().catch(console.error);