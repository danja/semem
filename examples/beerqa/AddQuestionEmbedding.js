#!/usr/bin/env node

/**
 * AddQuestionEmbedding - Add a test embedding to the BeerQA question
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function addQuestionEmbedding() {
    console.log(chalk.bold.blue('🔢 Adding test embedding to BeerQA question...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Find the question that has concepts
    const findQuestionQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?questionText
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?questionText ;
                  ragno:hasAttribute ?attr .
        
        ?attr ragno:attributeType "concept" .
    }
}
LIMIT 1`;
    
    const result = await sparqlHelper.executeSelect(findQuestionQuery);
    
    if (!result.success || result.data.results.bindings.length === 0) {
        console.log(chalk.red('❌ No questions with concepts found'));
        return;
    }
    
    const binding = result.data.results.bindings[0];
    const corpuscleURI = binding.corpuscle.value;
    const questionText = binding.questionText.value;
    
    console.log(`   ${chalk.cyan('Question:')} ${chalk.white(questionText)}`);
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(corpuscleURI)}`);
    
    // Generate a test embedding that will be similar to some of the Wikipedia embeddings
    // This simulates what would happen if we had actual embeddings
    const embedding = generateQuestionEmbedding();
    
    console.log(`   ${chalk.cyan('Embedding dimensions:')} ${chalk.white(embedding.length)}`);
    
    // Add the embedding to the question corpuscle
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${corpuscleURI}> ragno:embedding '${JSON.stringify(embedding)}' .
    }
}`;
    
    const insertResult = await sparqlHelper.executeUpdate(insertQuery);
    
    if (insertResult.success) {
        console.log(chalk.green('✅ Successfully added test embedding to question!'));
    } else {
        console.log(chalk.red('❌ Failed to add embedding:', insertResult.error));
    }
}

/**
 * Generate a test embedding that will have some similarity to test Wikipedia embeddings
 * This embedding is designed to be somewhat similar to the "science" and "knowledge" concepts
 */
function generateQuestionEmbedding() {
    const embedding = new Array(1536).fill(0);
    
    // Create a pattern that will be similar to both test cases 1 and 2 (Tesla correspondence and Scientific knowledge)
    // to simulate a question about Tesla's scientific correspondence
    for (let i = 0; i < 1536; i++) {
        if (i < 512) {
            // Some similarity to Tesla correspondence (test case 1)
            embedding[i] = Math.random() * 0.6 + 0.1;
        } else if (i >= 512 && i < 1024) {
            // Some similarity to Scientific knowledge (test case 2)
            embedding[i] = Math.random() * 0.7 + 0.1;
        } else {
            // Less similarity to geography (test case 3)
            embedding[i] = Math.random() * 0.3;
        }
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

addQuestionEmbedding().catch(console.error);