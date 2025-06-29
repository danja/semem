#!/usr/bin/env node

/**
 * IngestPagesTest - Quick test version with disabled embeddings and smaller content
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import HTML2MD from '../../src/aux/markup/HTML2MD.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

/**
 * Extract Wikipedia page ID from various Wikipedia URL formats
 */
function extractWikipediaPageId(url) {
    try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname.includes('wikipedia.org')) {
            const pathParts = urlObj.pathname.split('/');
            const wikiIndex = pathParts.findIndex(part => part === 'wiki');
            if (wikiIndex !== -1 && wikiIndex + 1 < pathParts.length) {
                return decodeURIComponent(pathParts[wikiIndex + 1]);
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Fetch Wikipedia page content via API (truncated version)
 */
async function fetchWikipediaContent(pageId, maxLength = 5000) {
    try {
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageId)}`;
        
        console.log(`   ${chalk.gray('Fetching:')} ${chalk.white(pageId)}`);
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Semem/1.0 Wikipedia Page Ingestion Test',
                'Accept': 'text/html'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`   ${chalk.yellow('⚠️')} Page not found: ${pageId}`);
                return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Truncate HTML if too long
        const truncatedHtml = html.length > maxLength * 5 
            ? html.substring(0, maxLength * 5) + '...'
            : html;
        
        // Convert HTML to markdown
        const markdown = HTML2MD.html2md(truncatedHtml);
        
        // Truncate markdown
        const truncatedMarkdown = markdown.length > maxLength
            ? markdown.substring(0, maxLength) + '...'
            : markdown;
        
        return {
            pageId: pageId,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageId)}`,
            markdown: truncatedMarkdown,
            contentLength: truncatedMarkdown.length
        };
        
    } catch (error) {
        console.log(`   ${chalk.red('❌')} Failed to fetch ${pageId}: ${error.message}`);
        return null;
    }
}

async function testIngest() {
    console.log(chalk.bold.blue('🧪 Testing Wikipedia Page Ingestion...'));
    
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
    
    // Get one related URI to test with
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?relatedURI
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:maybeRelated ?relatedURI .
    }
}
LIMIT 1`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success || result.data.results.bindings.length === 0) {
        console.log(chalk.red('❌ No related URIs found'));
        return;
    }
    
    const binding = result.data.results.bindings[0];
    const relatedURI = binding.relatedURI.value;
    
    console.log(`Testing with URI: ${relatedURI}`);
    
    // Find the corpuscle and get Wikipedia URL
    const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?textElement ?wikipediaURL
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        <${relatedURI}> a ragno:Corpuscle ;
                      ragno:hasTextElement ?textElement .
        
        ?textElement prov:wasDerivedFrom ?wikipediaURL .
    }
}`;

    const corpResult = await sparqlHelper.executeSelect(corpuscleQuery);
    
    if (!corpResult.success || corpResult.data.results.bindings.length === 0) {
        console.log(chalk.red('❌ No corpuscle found'));
        return;
    }
    
    const wikipediaURL = corpResult.data.results.bindings[0].wikipediaURL.value;
    const pageId = extractWikipediaPageId(wikipediaURL);
    
    console.log(`Wikipedia URL: ${wikipediaURL}`);
    console.log(`Page ID: ${pageId}`);
    
    if (!pageId) {
        console.log(chalk.red('❌ Could not extract page ID'));
        return;
    }
    
    // Fetch and convert content
    const pageContent = await fetchWikipediaContent(pageId, 2000);
    
    if (pageContent) {
        console.log(chalk.green(`✅ Successfully processed ${pageId}`));
        console.log(`   Content length: ${pageContent.contentLength}`);
        console.log(`   Sample markdown:`);
        console.log(chalk.gray(pageContent.markdown.substring(0, 200) + '...'));
        
        // Test creating a TextElement (without actually inserting)
        const textElementURI = `${relatedURI}/markdown_text_element`;
        console.log(`   Would create TextElement: ${textElementURI}`);
        
        console.log(chalk.green('🎉 Test completed successfully!'));
    }
}

testIngest().catch(console.error);