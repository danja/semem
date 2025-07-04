#!/usr/bin/env node

/**
 * Verify that the Wikipedia page ingestion worked correctly
 */

import chalk from 'chalk';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

async function verifyIngestion() {
    console.log(chalk.bold.blue('🔍 Verifying Wikipedia page ingestion...'));
    
    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test'
    };
    
    const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
        auth: config.sparqlAuth,
        timeout: 30000
    });
    
    // Check what markdown TextElements were created
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?textElement ?contentType ?contentLength ?pageId ?sourceURL ?hasEmbedding
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement ragno:contentType ?contentType .
        
        OPTIONAL { ?textElement ragno:contentLength ?contentLength }
        OPTIONAL { ?textElement ragno:pageId ?pageId }
        OPTIONAL { ?textElement ragno:sourceURL ?sourceURL }
        OPTIONAL { 
            ?textElement ragno:embedding ?emb .
            BIND(true as ?hasEmbedding)
        }
        
        FILTER(?contentType = "text/markdown")
    }
}
ORDER BY ?corpuscle`;
    
    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        console.log(chalk.red('❌ Query failed:', result.error));
        return;
    }
    
    const bindings = result.data.results.bindings;
    
    if (bindings.length === 0) {
        console.log(chalk.yellow('⚠️  No markdown TextElements found'));
        return;
    }
    
    console.log(chalk.green(`✅ Found ${bindings.length} markdown TextElement(s):`));
    console.log('');
    
    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        
        console.log(chalk.bold.white(`${i + 1}. TextElement:`));
        console.log(`   ${chalk.cyan('URI:')} ${chalk.white(binding.textElement.value)}`);
        console.log(`   ${chalk.cyan('Corpuscle:')} ${chalk.dim(binding.corpuscle.value)}`);
        console.log(`   ${chalk.cyan('Content Type:')} ${chalk.white(binding.contentType.value)}`);
        console.log(`   ${chalk.cyan('Content Length:')} ${chalk.white(binding.contentLength?.value || 'N/A')}`);
        console.log(`   ${chalk.cyan('Page ID:')} ${chalk.white(binding.pageId?.value || 'N/A')}`);
        console.log(`   ${chalk.cyan('Source URL:')} ${chalk.white(binding.sourceURL?.value || 'N/A')}`);
        console.log(`   ${chalk.cyan('Has Embedding:')} ${chalk.white(binding.hasEmbedding?.value || 'false')}`);
        console.log('');
    }
    
    // Test reading a sample of the markdown content
    if (bindings.length > 0) {
        const firstElement = bindings[0].textElement.value;
        
        const contentQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?content
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        <${firstElement}> ragno:content ?content .
    }
}`;
        
        const contentResult = await sparqlHelper.executeSelect(contentQuery);
        
        if (contentResult.success && contentResult.data.results.bindings.length > 0) {
            const content = contentResult.data.results.bindings[0].content.value;
            console.log(chalk.bold.white('📄 Sample Markdown Content:'));
            console.log(chalk.gray(content.substring(0, 300) + '...'));
            console.log('');
        }
    }
    
    console.log(chalk.green('🎉 Wikipedia page ingestion verification completed!'));
}

verifyIngestion().catch(console.error);