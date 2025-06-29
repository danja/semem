#!/usr/bin/env node

/**
 * AddTestWikipediaData - Add test Wikipedia corpuscles for testing DiscoverTargets
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function addTestWikipediaData() {
    console.log(chalk.bold.blue('📚 Adding test Wikipedia corpuscles...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Create test Wikipedia data with embeddings and concepts
    const testData = [
        {
            title: 'Tesla correspondence',
            snippet: 'Tesla exchanged extensive correspondence with financiers and inventors',
            pageId: 'test_tesla_1',
            wikipediaURL: 'https://en.wikipedia.org/wiki/Tesla_correspondence',
            embedding: generateTestEmbedding(1), // Similar to science/knowledge
            concepts: [
                { value: 'science', type: 'concept', confidence: 0.9 },
                { value: 'Tesla', type: 'person', confidence: 0.95 },
                { value: 'correspondence', type: 'concept', confidence: 0.8 }
            ]
        },
        {
            title: 'Scientific knowledge',
            snippet: 'Scientific knowledge encompasses empirical research and theoretical understanding',
            pageId: 'test_science_1',
            wikipediaURL: 'https://en.wikipedia.org/wiki/Scientific_knowledge',
            embedding: generateTestEmbedding(2), // Similar to science/knowledge
            concepts: [
                { value: 'science', type: 'concept', confidence: 0.95 },
                { value: 'knowledge', type: 'concept', confidence: 0.9 },
                { value: 'research', type: 'concept', confidence: 0.85 }
            ]
        },
        {
            title: 'Geography fundamentals',
            snippet: 'Geography is the study of places and relationships between people and environments',
            pageId: 'test_geography_1',
            wikipediaURL: 'https://en.wikipedia.org/wiki/Geography',
            embedding: generateTestEmbedding(3), // Similar to geography
            concepts: [
                { value: 'geography', type: 'concept', confidence: 0.95 },
                { value: 'knowledge', type: 'concept', confidence: 0.8 },
                { value: 'environment', type: 'concept', confidence: 0.75 }
            ]
        },
        {
            title: 'Historical documentation',
            snippet: 'Historical documentation preserves knowledge across generations',
            pageId: 'test_history_1',
            wikipediaURL: 'https://en.wikipedia.org/wiki/Historical_documentation',
            embedding: generateTestEmbedding(4), // Different from query concepts
            concepts: [
                { value: 'history', type: 'concept', confidence: 0.9 },
                { value: 'documentation', type: 'concept', confidence: 0.85 }
            ]
        }
    ];
    
    console.log(`   ${chalk.cyan('Creating:')} ${chalk.white(testData.length)} Wikipedia corpuscles`);
    
    // Clear existing test data
    const clearQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

DELETE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?s ?p ?o .
    }
}
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?s ?p ?o .
    }
}`;
    
    await sparqlHelper.executeUpdate(clearQuery);
    
    // Generate triples for each test corpuscle
    for (let i = 0; i < testData.length; i++) {
        const data = testData[i];
        const corpuscleURI = `${config.wikipediaGraphURI}/corpuscle/${data.pageId}`;
        const textElementURI = `${corpuscleURI}/text_element`;
        
        // Main corpuscle and text element triples
        let triples = `
        <${corpuscleURI}> a ragno:Corpuscle ;
                         ragno:hasTextElement <${textElementURI}> .
        
        <${textElementURI}> a ragno:TextElement ;
                           skos:prefLabel "${data.title}" ;
                           ragno:snippet "${data.snippet}" ;
                           ragno:pageId "${data.pageId}" ;
                           ragno:embedding '${JSON.stringify(data.embedding)}' ;
                           prov:wasDerivedFrom <${data.wikipediaURL}> .`;
        
        // Add concept attributes
        for (let j = 0; j < data.concepts.length; j++) {
            const concept = data.concepts[j];
            const attrURI = `${corpuscleURI}/attribute/concept_${j + 1}`;
            
            triples += `
        
        <${attrURI}> a ragno:Attribute ;
                    ragno:attributeType "concept" ;
                    ragno:attributeValue "${concept.value}" ;
                    ragno:attributeSubType "${concept.type}" ;
                    ragno:attributeConfidence ${concept.confidence} .
        
        <${corpuscleURI}> ragno:hasAttribute <${attrURI}> .`;
        }
        
        const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${config.wikipediaGraphURI}> {
        ${triples}
    }
}`;
        
        const result = await sparqlHelper.executeUpdate(insertQuery);
        
        if (result.success) {
            console.log(`   ${chalk.green('✓')} ${chalk.white(data.title)} (${chalk.yellow(data.concepts.length)} concepts)`);
        } else {
            console.log(`   ${chalk.red('✗')} ${chalk.white(data.title)}: ${result.error}`);
        }
    }
    
    console.log(chalk.green('✅ Test Wikipedia data created successfully!'));
}

/**
 * Generate a test embedding vector (1536 dimensions)
 * Each test case gets a different pattern to simulate different semantic content
 */
function generateTestEmbedding(testCase) {
    const embedding = new Array(1536).fill(0);
    
    // Create different patterns for different test cases
    for (let i = 0; i < 1536; i++) {
        switch (testCase) {
            case 1: // Tesla correspondence - high values in first third
                if (i < 512) {
                    embedding[i] = Math.random() * 0.8 + 0.1;
                } else {
                    embedding[i] = Math.random() * 0.2;
                }
                break;
            case 2: // Scientific knowledge - high values in middle third  
                if (i >= 512 && i < 1024) {
                    embedding[i] = Math.random() * 0.8 + 0.1;
                } else {
                    embedding[i] = Math.random() * 0.2;
                }
                break;
            case 3: // Geography - high values in last third
                if (i >= 1024) {
                    embedding[i] = Math.random() * 0.8 + 0.1;
                } else {
                    embedding[i] = Math.random() * 0.2;
                }
                break;
            case 4: // Historical documentation - mixed pattern (low similarity)
                embedding[i] = Math.random() * 0.3;
                break;
        }
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
}

addTestWikipediaData().catch(console.error);