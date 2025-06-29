#!/usr/bin/env node

/**
 * Check what Wikipedia corpuscles exist and their embedding status
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function checkWikipediaCorpuscles() {
    console.log(chalk.bold.blue('🔍 Checking Wikipedia corpuscles...'));
    console.log('');
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'  // Check the original test graph
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });

    // 1. Check for corpuscles
    console.log(chalk.yellow('1. All Corpuscles:'));
    const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?corpuscle ?title (COUNT(?attr) as ?attrCount)
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL { ?corpuscle ragno:hasAttribute ?attr }
    }
}
GROUP BY ?corpuscle ?title
ORDER BY ?corpuscle
`;

    const corpuscleResult = await sparqlHelper.executeSelect(corpuscleQuery);
    
    if (corpuscleResult.success) {
        console.log(`   Found ${corpuscleResult.data.results.bindings.length} corpuscles:`);
        for (const binding of corpuscleResult.data.results.bindings) {
            console.log(`   • ${binding.title.value} (${binding.attrCount.value} attributes)`);
        }
    } else {
        console.log(`   Error: ${corpuscleResult.error}`);
    }
    
    console.log('');

    // 2. Check for embedding attributes specifically
    console.log(chalk.yellow('2. Embedding Attributes:'));
    const embeddingQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?embAttr ?embValue
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle ragno:hasAttribute ?embAttr .
        ?embAttr ragno:attributeType "vector-embedding" ;
                ragno:attributeValue ?embValue .
    }
}
ORDER BY ?corpuscle
`;

    const embeddingResult = await sparqlHelper.executeSelect(embeddingQuery);
    
    if (embeddingResult.success) {
        console.log(`   Found ${embeddingResult.data.results.bindings.length} embedding attributes:`);
        for (const binding of embeddingResult.data.results.bindings) {
            const embValueLength = binding.embValue.value.length;
            console.log(`   • ${binding.corpuscle.value} - embedding length: ${embValueLength} chars`);
        }
    } else {
        console.log(`   Error: ${embeddingResult.error}`);
    }
    
    console.log('');

    // 3. Check the exact query that DiscoverTargets uses
    console.log(chalk.yellow('3. DiscoverTargets Query Test:'));
    const discoverQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?corpuscle ?title ?embedding
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL {
            ?corpuscle ragno:hasAttribute ?embAttr .
            ?embAttr ragno:attributeType "vector-embedding" ;
                     ragno:attributeValue ?embedding .
        }
        
        FILTER(BOUND(?embedding))
    }
}
ORDER BY ?corpuscle
`;

    const discoverResult = await sparqlHelper.executeSelect(discoverQuery);
    
    if (discoverResult.success) {
        console.log(`   DiscoverTargets would find ${discoverResult.data.results.bindings.length} corpuscles with embeddings:`);
        for (const binding of discoverResult.data.results.bindings) {
            console.log(`   • ${binding.title.value}`);
            try {
                const embedding = JSON.parse(binding.embedding.value);
                if (Array.isArray(embedding)) {
                    console.log(`     - Embedding: ${embedding.length} dimensions`);
                } else {
                    console.log(`     - Embedding: Invalid format (not array)`);
                }
            } catch (e) {
                console.log(`     - Embedding: Parse error`);
            }
        }
    } else {
        console.log(`   Error: ${discoverResult.error}`);
    }
}

checkWikipediaCorpuscles().catch(console.error);