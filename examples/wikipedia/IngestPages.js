#!/usr/bin/env node

/**
 * IngestPages - Fetch Wikipedia pages from ragno:maybeRelated URIs and convert to markdown
 * 
 * This script queries for question corpuscles that have ragno:maybeRelated Wikipedia URIs,
 * fetches the full Wikipedia pages, converts them to markdown using HTML2MD.js,
 * creates new ragno:TextElement instances with the markdown content, and generates
 * embeddings for the Wikipedia content.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import HTML2MD from '../../src/aux/markup/HTML2MD.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📖 WIKIPEDIA PAGE INGESTION                   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('      Fetch Pages, Convert to Markdown & Generate Embeddings ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('BeerQA Graph URI:')} ${chalk.white(config.beerqaGraphURI)}`);
    console.log(`   ${chalk.cyan('Wikipedia Graph URI:')} ${chalk.white(config.wikipediaGraphURI)}`);
    console.log(`   ${chalk.cyan('Request Delay:')} ${chalk.white(config.requestDelay + 'ms')}`);
    console.log(`   ${chalk.cyan('Max Pages per Question:')} ${chalk.white(config.maxPagesPerQuestion)}`);
    console.log(`   ${chalk.cyan('Generate Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Yes' : 'No')}`);
    console.log(`   ${chalk.cyan('Content Max Length:')} ${chalk.white(config.maxContentLength)}`);
    console.log('');
}

/**
 * Get questions with ragno:maybeRelated Wikipedia URIs
 */
async function getQuestionsWithRelatedPages(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Finding questions with related Wikipedia pages...'));
    
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?relatedURI
WHERE {
    GRAPH <${beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:maybeRelated ?relatedURI .
    }
}
ORDER BY ?question ?relatedURI
`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        throw new Error(`Failed to retrieve questions with related pages: ${result.error}`);
    }
    
    // Group results by question
    const questionsMap = new Map();
    
    for (const binding of result.data.results.bindings) {
        const questionURI = binding.question.value;
        const relatedURI = binding.relatedURI.value;
        
        if (!questionsMap.has(questionURI)) {
            questionsMap.set(questionURI, {
                uri: questionURI,
                questionText: binding.questionText.value,
                relatedURIs: []
            });
        }
        
        questionsMap.get(questionURI).relatedURIs.push(relatedURI);
    }
    
    const questions = Array.from(questionsMap.values());
    
    console.log(`   ${chalk.green('✓')} Found ${questions.length} questions with related pages`);
    
    const totalRelatedURIs = questions.reduce((sum, q) => sum + q.relatedURIs.length, 0);
    console.log(`   ${chalk.green('✓')} Total related URIs: ${totalRelatedURIs}`);
    console.log('');
    
    return questions;
}

/**
 * Extract Wikipedia page ID from various Wikipedia URL formats
 */
function extractWikipediaPageId(url) {
    try {
        const urlObj = new URL(url);
        
        // Handle standard Wikipedia URLs
        if (urlObj.hostname.includes('wikipedia.org')) {
            const pathParts = urlObj.pathname.split('/');
            const wikiIndex = pathParts.findIndex(part => part === 'wiki');
            if (wikiIndex !== -1 && wikiIndex + 1 < pathParts.length) {
                return decodeURIComponent(pathParts[wikiIndex + 1]);
            }
        }
        
        // Fallback: try to extract from any URL
        const match = url.match(/[\/:]([^\/\?&#]+)(?:\?|#|$)/);
        return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to parse URL: ${url}`));
        return null;
    }
}

/**
 * Fetch Wikipedia page content via API
 */
async function fetchWikipediaContent(pageId, language = 'en') {
    try {
        // Use Wikipedia API to get page content
        const apiUrl = `https://${language}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageId)}`;
        
        console.log(`   ${chalk.gray('Fetching:')} ${chalk.white(pageId)}`);
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Semem/1.0 (https://github.com/danja/semem) Wikipedia Page Ingestion',
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
        
        // Truncate HTML if very large (to speed up conversion and reduce content size)
        const truncatedHtml = html.length > 50000 
            ? html.substring(0, 50000) + '...' 
            : html;
        
        // Convert HTML to markdown
        const markdown = HTML2MD.html2md(truncatedHtml);
        
        return {
            pageId: pageId,
            url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(pageId)}`,
            html: html,
            markdown: markdown,
            contentLength: markdown.length
        };
        
    } catch (error) {
        console.log(`   ${chalk.red('❌')} Failed to fetch ${pageId}: ${error.message}`);
        return null;
    }
}

/**
 * Generate embedding for content
 */
async function generateContentEmbedding(content, embeddingHandler, maxLength = 8000) {
    try {
        // Truncate content if too long for embedding
        const truncatedContent = content.length > maxLength 
            ? content.substring(0, maxLength) + '...' 
            : content;
        
        const embedding = await embeddingHandler.generateEmbedding(truncatedContent);
        
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
            console.log(`   ${chalk.yellow('⚠️')} Invalid embedding generated`);
            return null;
        }
        
        return embedding;
        
    } catch (error) {
        console.log(`   ${chalk.yellow('⚠️')} Failed to generate embedding: ${error.message}`);
        return null;
    }
}

/**
 * Find existing Wikipedia corpuscle for a related URI
 */
async function findWikipediaCorpuscle(sparqlHelper, wikipediaGraphURI, relatedURI) {
    // First try direct corpuscle URI match
    const directQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?textElement ?wikipediaURL
WHERE {
    GRAPH <${wikipediaGraphURI}> {
        <${relatedURI}> a ragno:Corpuscle ;
                      ragno:hasTextElement ?textElement .
        
        OPTIONAL { ?textElement prov:wasDerivedFrom ?wikipediaURL }
    }
}
LIMIT 1`;

    const directResult = await sparqlHelper.executeSelect(directQuery);
    
    if (directResult.success && directResult.data.results.bindings.length > 0) {
        const binding = directResult.data.results.bindings[0];
        return {
            corpuscle: relatedURI, // The related URI is the corpuscle URI
            textElement: binding.textElement.value,
            wikipediaURL: binding.wikipediaURL?.value || null
        };
    }
    
    // Fallback: try to find by prov:wasDerivedFrom if relatedURI is a Wikipedia URL
    const provQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?textElement
WHERE {
    GRAPH <${wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement prov:wasDerivedFrom <${relatedURI}> .
    }
}
LIMIT 1`;

    const provResult = await sparqlHelper.executeSelect(provQuery);
    
    if (provResult.success && provResult.data.results.bindings.length > 0) {
        const binding = provResult.data.results.bindings[0];
        return {
            corpuscle: binding.corpuscle.value,
            textElement: binding.textElement.value,
            wikipediaURL: relatedURI
        };
    }
    
    return null;
}

/**
 * Create new TextElement with markdown content
 */
async function createMarkdownTextElement(sparqlHelper, wikipediaGraphURI, corpuscleURI, pageContent, embedding) {
    const textElementURI = `${corpuscleURI}/markdown_text_element`;
    
    // Escape content for SPARQL
    const escapedMarkdown = SPARQLHelper.escapeString(pageContent.markdown);
    const escapedPageId = SPARQLHelper.escapeString(pageContent.pageId);
    const embeddingStr = embedding ? JSON.stringify(embedding) : null;
    
    let triples = `
        <${textElementURI}> a ragno:TextElement ;
                           ragno:contentType "text/markdown" ;
                           ragno:content ${SPARQLHelper.createLiteral(escapedMarkdown)} ;
                           ragno:pageId ${SPARQLHelper.createLiteral(escapedPageId)} ;
                           ragno:contentLength ${pageContent.contentLength} ;
                           ragno:sourceURL <${pageContent.url}> ;
                           prov:wasDerivedFrom <${pageContent.url}> .
        
        <${corpuscleURI}> ragno:hasTextElement <${textElementURI}> .`;
    
    if (embedding) {
        triples += `
        
        <${textElementURI}> ragno:embedding '${JSON.stringify(embedding)}' .`;
    }
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${wikipediaGraphURI}> {
        ${triples}
    }
}`;
    
    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    return {
        success: result.success,
        textElementURI: textElementURI,
        error: result.error || null
    };
}

/**
 * Process a single question's related pages
 */
async function processQuestionPages(sparqlHelper, wikipediaGraphURI, question, embeddingHandler, options) {
    console.log(chalk.bold.white(`📝 Processing: ${question.questionText.substring(0, 80)}...`));
    console.log(`   ${chalk.cyan('Question URI:')} ${chalk.dim(question.uri)}`);
    console.log(`   ${chalk.cyan('Related Pages:')} ${chalk.white(question.relatedURIs.length)}`);
    
    const results = {
        questionURI: question.uri,
        pagesProcessed: 0,
        pagesSuccess: 0,
        pagesFailed: 0,
        textElementsCreated: 0,
        embeddingsGenerated: 0
    };
    
    for (let i = 0; i < Math.min(question.relatedURIs.length, options.maxPagesPerQuestion); i++) {
        const relatedURI = question.relatedURIs[i];
        results.pagesProcessed++;
        
        console.log(`   ${chalk.bold.cyan(`Page ${i + 1}:`)} ${chalk.white(relatedURI)}`);
        
        // Extract page ID from URI
        const pageId = extractWikipediaPageId(relatedURI);
        if (!pageId) {
            console.log(`   ${chalk.red('❌')} Could not extract page ID from URI`);
            results.pagesFailed++;
            continue;
        }
        
        // Find existing Wikipedia corpuscle
        const existingCorpuscle = await findWikipediaCorpuscle(sparqlHelper, wikipediaGraphURI, relatedURI);
        if (!existingCorpuscle) {
            console.log(`   ${chalk.yellow('⚠️')} No existing corpuscle found for URI`);
            results.pagesFailed++;
            continue;
        }
        
        console.log(`   ${chalk.green('✓')} Found existing corpuscle`);
        
        // Determine Wikipedia URL to fetch - prefer the one from the corpuscle metadata
        let wikipediaURL = existingCorpuscle.wikipediaURL || relatedURI;
        let pageIdToFetch = pageId;
        
        // If we have a Wikipedia URL from the corpuscle, use that for fetching
        if (existingCorpuscle.wikipediaURL) {
            pageIdToFetch = extractWikipediaPageId(existingCorpuscle.wikipediaURL);
            if (!pageIdToFetch) {
                console.log(`   ${chalk.red('❌')} Could not extract page ID from Wikipedia URL: ${existingCorpuscle.wikipediaURL}`);
                results.pagesFailed++;
                continue;
            }
        }
        
        // Fetch Wikipedia content
        const pageContent = await fetchWikipediaContent(pageIdToFetch);
        if (!pageContent) {
            results.pagesFailed++;
            continue;
        }
        
        console.log(`   ${chalk.green('✓')} Fetched content (${pageContent.contentLength} chars)`);
        console.log(`   ${chalk.green('✓')} Converted to markdown`);
        
        // Generate embedding if enabled
        let embedding = null;
        if (options.generateEmbeddings && embeddingHandler) {
            embedding = await generateContentEmbedding(
                pageContent.markdown, 
                embeddingHandler, 
                options.maxContentLength
            );
            
            if (embedding) {
                results.embeddingsGenerated++;
                console.log(`   ${chalk.green('✓')} Generated embedding (${embedding.length}D)`);
            }
        }
        
        // Create new TextElement with markdown content
        const createResult = await createMarkdownTextElement(
            sparqlHelper,
            wikipediaGraphURI,
            existingCorpuscle.corpuscle,
            pageContent,
            embedding
        );
        
        if (createResult.success) {
            results.textElementsCreated++;
            results.pagesSuccess++;
            console.log(`   ${chalk.green('✓')} Created markdown TextElement`);
            console.log(`   ${chalk.dim('URI:')} ${chalk.dim(createResult.textElementURI)}`);
        } else {
            results.pagesFailed++;
            console.log(`   ${chalk.red('❌')} Failed to create TextElement: ${createResult.error}`);
        }
        
        // Add delay between requests
        if (i < question.relatedURIs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, options.requestDelay));
        }
        
        console.log('');
    }
    
    return results;
}

/**
 * Display final summary
 */
function displaySummary(allResults) {
    const totals = allResults.reduce((acc, result) => ({
        questions: acc.questions + 1,
        pagesProcessed: acc.pagesProcessed + result.pagesProcessed,
        pagesSuccess: acc.pagesSuccess + result.pagesSuccess,
        pagesFailed: acc.pagesFailed + result.pagesFailed,
        textElementsCreated: acc.textElementsCreated + result.textElementsCreated,
        embeddingsGenerated: acc.embeddingsGenerated + result.embeddingsGenerated
    }), {
        questions: 0,
        pagesProcessed: 0,
        pagesSuccess: 0,
        pagesFailed: 0,
        textElementsCreated: 0,
        embeddingsGenerated: 0
    });
    
    console.log(chalk.bold.white('📊 Ingestion Summary:'));
    console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(totals.questions)}`);
    console.log(`   ${chalk.cyan('Pages Processed:')} ${chalk.white(totals.pagesProcessed)}`);
    console.log(`   ${chalk.cyan('Pages Success:')} ${chalk.green(totals.pagesSuccess)}`);
    console.log(`   ${chalk.cyan('Pages Failed:')} ${chalk.red(totals.pagesFailed)}`);
    console.log(`   ${chalk.cyan('TextElements Created:')} ${chalk.white(totals.textElementsCreated)}`);
    console.log(`   ${chalk.cyan('Embeddings Generated:')} ${chalk.white(totals.embeddingsGenerated)}`);
    
    if (totals.pagesProcessed > 0) {
        const successRate = (totals.pagesSuccess / totals.pagesProcessed * 100).toFixed(1);
        console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.white(successRate + '%')}`);
    }
    
    console.log('');
}

/**
 * Initialize embedding handler
 */
async function initializeEmbeddingHandler(config) {
    try {
        console.log(chalk.bold.white('🔢 Initializing embedding handler...'));
        
        const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
        
        // Test Ollama connection
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            console.log(chalk.yellow('⚠️  Ollama not available, embeddings will be disabled'));
            return null;
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });
        
        const embeddingHandler = new EmbeddingHandler(
            ollamaConnector,
            'nomic-embed-text:latest',
            1536,
            cacheManager
        );
        
        console.log(`   ${chalk.green('✓')} Embedding handler initialized`);
        return embeddingHandler;
        
    } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to initialize embedding handler: ${error.message}`));
        return null;
    }
}

/**
 * Main page ingestion function
 */
async function ingestPages() {
    displayHeader();
    
    try {
        // Configuration
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            requestDelay: 1000, // 1 second between requests
            maxPagesPerQuestion: 1, // Test with just one page
            generateEmbeddings: true, // Enable for final test
            maxContentLength: 3000, // Smaller content for testing
            timeout: 30000
        };
        
        displayConfiguration(config);
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        // Initialize Config for embedding handler
        let semConfig = null;
        let embeddingHandler = null;
        
        if (config.generateEmbeddings) {
            try {
                semConfig = new Config();
                await semConfig.init();
                embeddingHandler = await initializeEmbeddingHandler(semConfig);
            } catch (error) {
                console.log(chalk.yellow(`⚠️  Embeddings disabled: ${error.message}`));
                config.generateEmbeddings = false;
            }
        }
        
        // Get questions with related pages
        const questions = await getQuestionsWithRelatedPages(sparqlHelper, config.beerqaGraphURI);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with related pages found. Run DiscoverTargets.js first.'));
            return;
        }
        
        console.log(chalk.bold.white('🚀 Starting page ingestion...'));
        console.log('');
        
        // Process each question's related pages
        const allResults = [];
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            console.log(chalk.bold.blue(`Question ${i + 1}/${questions.length}:`));
            
            const result = await processQuestionPages(
                sparqlHelper,
                config.wikipediaGraphURI,
                question,
                embeddingHandler,
                config
            );
            
            allResults.push(result);
        }
        
        displaySummary(allResults);
        console.log(chalk.green('🎉 Wikipedia page ingestion completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Page ingestion failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

ingestPages();