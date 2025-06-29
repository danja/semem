#!/usr/bin/env node

/**
 * Fix Tesla relationship and content
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function fixTeslaRelationship() {
    console.log(chalk.bold.blue('🔧 Fixing Tesla relationship and content...'));
    
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
    
    const teslaCorpuscleURI = 'http://purl.org/stuff/wikipedia/test/corpuscle/test_tesla_1';
    const questionURI = 'http://purl.org/stuff/beerqa/test/corpuscle/cc7f51db8fe15d93a9649b9336cc186444e64767';
    
    // 1. Add Tesla content to the text element
    const addContentQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

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

This correspondence is well-documented in the Tesla archives and provides insight into both Tesla's visionary ideas and the practical challenges of securing funding for revolutionary technology.""" ;
                            ragno:contentType "text/markdown" .
    }
}
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        <${teslaCorpuscleURI}> ragno:hasTextElement ?textElement .
    }
}`;
    
    const contentResult = await sparqlHelper.executeUpdate(addContentQuery);
    
    if (contentResult.success) {
        console.log(chalk.green('✅ Added Tesla content'));
    } else {
        console.log(chalk.red('❌ Failed to add content:', contentResult.error));
    }
    
    // 2. Create a high-weight relationship from question to Tesla corpuscle
    const relationshipURI = `${questionURI}/relationship/directTeslaAnswer_${Date.now()}`;
    
    const addRelationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${relationshipURI}> a ragno:Relationship ;
                            ragno:hasSourceEntity <${questionURI}> ;
                            ragno:hasTargetEntity <${teslaCorpuscleURI}> ;
                            ragno:relationshipType "directAnswer" ;
                            ragno:weight 0.95 ;
                            ragno:description "Direct answer to Tesla-Morgan correspondence question" ;
                            ragno:sourceCorpus "Wikipedia" ;
                            ragno:created "${new Date().toISOString()}" .
    }
}`;
    
    const relResult = await sparqlHelper.executeUpdate(addRelationshipQuery);
    
    if (relResult.success) {
        console.log(chalk.green('✅ Created direct Tesla relationship'));
        console.log(`   Relationship URI: ${relationshipURI}`);
        console.log(`   Weight: 0.95 (highest priority)`);
    } else {
        console.log(chalk.red('❌ Failed to create relationship:', relResult.error));
    }
    
    console.log('');
    console.log(chalk.bold.white('🎯 Now the Tesla corpuscle should be available for context!'));
}

fixTeslaRelationship().catch(console.error);