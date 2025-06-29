#!/usr/bin/env node

/**
 * AddTestConcepts - Add test concepts to a BeerQA question for testing DiscoverTargets
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function addTestConcepts() {
    console.log(chalk.bold.blue('🧠 Adding test concepts to BeerQA question...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // First, find a question to add concepts to
    const findQuestionQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?questionText
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?questionText .
    }
}
LIMIT 1`;
    
    const result = await sparqlHelper.executeSelect(findQuestionQuery);
    
    if (!result.success || result.data.results.bindings.length === 0) {
        console.log(chalk.red('❌ No questions found to add concepts to'));
        return;
    }
    
    const binding = result.data.results.bindings[0];
    const corpuscleURI = binding.corpuscle.value;
    const questionText = binding.questionText.value;
    
    console.log(`   ${chalk.cyan('Question:')} ${chalk.white(questionText)}`);
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(corpuscleURI)}`);
    
    // Determine test concepts based on the question content
    let testConcepts = [];
    
    if (questionText.toLowerCase().includes('sorghastrum') || questionText.toLowerCase().includes('artabotrys')) {
        testConcepts = [
            { value: 'Sorghastrum', type: 'plant_genus', confidence: 0.95 },
            { value: 'Artabotrys', type: 'plant_genus', confidence: 0.95 },
            { value: 'plant geography', type: 'concept', confidence: 0.8 },
            { value: 'botanical distribution', type: 'concept', confidence: 0.75 }
        ];
    } else if (questionText.toLowerCase().includes('parliament') || questionText.toLowerCase().includes('commission')) {
        testConcepts = [
            { value: 'European Parliament', type: 'institution', confidence: 0.9 },
            { value: 'European Commission', type: 'institution', confidence: 0.9 },
            { value: 'legislative procedure', type: 'concept', confidence: 0.8 },
            { value: 'political science', type: 'concept', confidence: 0.7 }
        ];
    } else {
        // Generic concepts
        testConcepts = [
            { value: 'geography', type: 'concept', confidence: 0.8 },
            { value: 'science', type: 'concept', confidence: 0.7 },
            { value: 'knowledge', type: 'concept', confidence: 0.6 }
        ];
    }
    
    console.log(`   ${chalk.cyan('Adding Concepts:')} ${chalk.white(testConcepts.length)}`);
    
    // Generate concept attributes
    const conceptTriples = [];
    
    for (let i = 0; i < testConcepts.length; i++) {
        const concept = testConcepts[i];
        const attrURI = `${corpuscleURI}/attribute/concept_${i + 1}`;
        
        conceptTriples.push(`
        <${attrURI}> a ragno:Attribute ;
                    ragno:attributeType "concept" ;
                    ragno:attributeValue "${concept.value}" ;
                    ragno:attributeSubType "${concept.type}" ;
                    ragno:attributeConfidence ${concept.confidence} .
        
        <${corpuscleURI}> ragno:hasAttribute <${attrURI}> .`);
    }
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        ${conceptTriples.join('\n        ')}
    }
}`;
    
    const insertResult = await sparqlHelper.executeUpdate(insertQuery);
    
    if (insertResult.success) {
        console.log(chalk.green(`✅ Successfully added ${testConcepts.length} test concepts!`));
        
        for (const concept of testConcepts) {
            console.log(`      ${chalk.bold.cyan('•')} ${chalk.white(concept.value)} (${chalk.yellow(concept.type)}, ${chalk.green((concept.confidence * 100).toFixed(1) + '%')})`);
        }
    } else {
        console.log(chalk.red('❌ Failed to add concepts:', insertResult.error));
    }
}

addTestConcepts().catch(console.error);