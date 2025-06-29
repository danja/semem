#!/usr/bin/env node

/**
 * Verify that the ZPT navigation created proper ragno:Relationship entities
 */

import chalk from 'chalk';
import SPARQLHelper from './SPARQLHelper.js';

async function verifyNavigation() {
    console.log(chalk.bold.blue('🔍 Verifying ZPT navigation results...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Check ragno:Relationship entities created by navigation
    const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?relationship ?sourceEntity ?targetEntity ?relationshipType ?weight ?description ?created
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?sourceEntity ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
        
        OPTIONAL { ?relationship ragno:description ?description }
        OPTIONAL { ?relationship ragno:created ?created }
    }
}
ORDER BY DESC(?weight)`;
    
    console.log(chalk.yellow('Relationship entities:'));
    const relResult = await sparqlHelper.executeSelect(relationshipQuery);
    
    if (!relResult.success) {
        console.log(chalk.red('❌ Query failed:', relResult.error));
        return;
    }
    
    const relationships = relResult.data.results.bindings;
    
    if (relationships.length === 0) {
        console.log(chalk.yellow('⚠️  No relationship entities found'));
        return;
    }
    
    console.log(chalk.green(`✅ Found ${relationships.length} relationship entities:`));
    console.log('');
    
    // Group by source entity (question)
    const questionGroups = new Map();
    
    for (const rel of relationships) {
        const sourceURI = rel.sourceEntity.value;
        if (!questionGroups.has(sourceURI)) {
            questionGroups.set(sourceURI, []);
        }
        questionGroups.get(sourceURI).push(rel);
    }
    
    for (const [questionURI, rels] of questionGroups.entries()) {
        console.log(chalk.bold.white(`Question: ${questionURI.split('/').pop()}`));
        console.log(`   ${chalk.cyan('Related Entities:')} ${chalk.white(rels.length)}`);
        
        for (let i = 0; i < rels.length; i++) {
            const rel = rels[i];
            
            console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(rel.relationshipType.value)}`);
            console.log(`      ${chalk.gray('Target:')} ${chalk.dim(rel.targetEntity.value.split('/').pop())}`);
            console.log(`      ${chalk.gray('Weight:')} ${chalk.green(parseFloat(rel.weight.value).toFixed(3))}`);
            console.log(`      ${chalk.gray('Description:')} ${chalk.white(rel.description?.value || 'N/A')}`);
            
            if (rel.created) {
                const created = new Date(rel.created.value);
                console.log(`      ${chalk.gray('Created:')} ${chalk.white(created.toLocaleString())}`);
            }
        }
        console.log('');
    }
    
    // Get some additional metadata about the relationships
    const metadataQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?relationship ?navigationScore ?conceptMatches ?sourceCorpus
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?relationship a ragno:Relationship .
        
        OPTIONAL { ?relationship ragno:navigationScore ?navigationScore }
        OPTIONAL { ?relationship ragno:conceptMatches ?conceptMatches }
        OPTIONAL { ?relationship ragno:sourceCorpus ?sourceCorpus }
    }
}`;
    
    const metaResult = await sparqlHelper.executeSelect(metadataQuery);
    
    if (metaResult.success && metaResult.data.results.bindings.length > 0) {
        console.log(chalk.bold.white('📊 Navigation Metadata:'));
        
        const metadata = metaResult.data.results.bindings;
        const sourceCorpusCount = new Map();
        let totalScore = 0;
        let scoreCount = 0;
        
        for (const meta of metadata) {
            if (meta.sourceCorpus) {
                const corpus = meta.sourceCorpus.value;
                sourceCorpusCount.set(corpus, (sourceCorpusCount.get(corpus) || 0) + 1);
            }
            
            if (meta.navigationScore) {
                totalScore += parseFloat(meta.navigationScore.value);
                scoreCount++;
            }
        }
        
        console.log(`   ${chalk.cyan('Source Distribution:')}`);
        for (const [corpus, count] of sourceCorpusCount.entries()) {
            console.log(`     ${chalk.white(corpus)}: ${chalk.green(count)} relationships`);
        }
        
        if (scoreCount > 0) {
            console.log(`   ${chalk.cyan('Average Navigation Score:')} ${chalk.green((totalScore / scoreCount).toFixed(3))}`);
        }
        
        // Show sample concept matches
        const conceptMatches = metadata.filter(m => m.conceptMatches && m.conceptMatches.value !== 'No concept matches');
        if (conceptMatches.length > 0) {
            console.log(`   ${chalk.cyan('Sample Concept Matches:')}`);
            for (let i = 0; i < Math.min(conceptMatches.length, 3); i++) {
                console.log(`     ${chalk.gray(conceptMatches[i].conceptMatches.value)}`);
            }
        }
    }
    
    console.log('');
    console.log(chalk.green('🎉 ZPT navigation verification completed!'));
}

verifyNavigation().catch(console.error);