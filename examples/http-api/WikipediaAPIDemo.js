#!/usr/bin/env node

/**
 * Wikipedia API Demo
 * 
 * Demonstrates how to use the Wikipedia API endpoints for:
 * - Article search
 * - Specific article retrieval
 * - Batch search operations
 * - Content ingestion to knowledge graph
 * - Category-based search
 * 
 * Usage: node examples/http-api/WikipediaAPIDemo.js
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const API_BASE = 'http://localhost:4100/api';
const API_KEY = 'demo-key'; // Set in your environment or config

/**
 * Make API request with authentication
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...options.headers
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

/**
 * Demo: Wikipedia article search
 */
async function demoArticleSearch() {
    console.log(chalk.cyan('\n🔍 Demo: Wikipedia Article Search'));
    console.log('Searching for "quantum computing"...\n');
    
    try {
        const result = await apiRequest('/wikipedia/search?query=quantum%20computing&limit=5', {
            method: 'GET'
        });
        
        if (result.success) {
            const searchResult = result.result;
            console.log(chalk.green(`✓ Found ${searchResult.resultCount} articles:`));
            
            searchResult.results.forEach((article, index) => {
                console.log(`  ${index + 1}. ${article.title}`);
                if (article.snippet) {
                    console.log(`     ${article.snippet.substring(0, 100)}...`);
                }
                console.log(`     URL: https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`);
            });
            
            console.log(`  Duration: ${result.duration}ms`);
        } else {
            console.log(chalk.red('✗ Search failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Get specific article
 */
async function demoGetArticle() {
    console.log(chalk.cyan('\n📄 Demo: Get Specific Article'));
    console.log('Retrieving "Artificial Intelligence" article...\n');
    
    try {
        const result = await apiRequest('/wikipedia/article?title=Artificial%20intelligence&includeContent=true', {
            method: 'GET'
        });
        
        if (result.success) {
            const article = result.result.article;
            console.log(chalk.green('✓ Article retrieved:'));
            console.log(`  Title: ${article.title}`);
            console.log(`  Page ID: ${article.pageid}`);
            console.log(`  Length: ${article.length} bytes`);
            
            if (article.extract) {
                console.log(`  Summary: ${article.extract.substring(0, 200)}...`);
            }
            
            if (article.content) {
                console.log(`  Content length: ${article.content.length} characters`);
            }
            
            console.log(`  Duration: ${result.duration}ms`);
        } else {
            console.log(chalk.red('✗ Article retrieval failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Batch search
 */
async function demoBatchSearch() {
    console.log(chalk.cyan('\n🔍 Demo: Batch Search'));
    console.log('Searching multiple science topics...\n');
    
    const queries = [
        'machine learning',
        'neural networks', 
        'deep learning',
        'computer vision'
    ];
    
    try {
        const result = await apiRequest('/wikipedia/batch-search', {
            method: 'POST',
            body: JSON.stringify({
                queries,
                limit: 3,
                parallel: true,
                batchSize: 2
            })
        });
        
        if (result.success) {
            const batchResult = result.result;
            console.log(chalk.green('✓ Batch search completed:'));
            console.log(`  Total queries: ${batchResult.summary.totalQueries}`);
            console.log(`  Successful: ${batchResult.summary.successfulQueries}`);
            console.log(`  Failed: ${batchResult.summary.failedQueries}`);
            console.log(`  Total results: ${batchResult.summary.totalResults}`);
            console.log(`  Duration: ${result.duration}ms`);
            
            console.log('\n  Results per query:');
            batchResult.results.forEach((queryResult, index) => {
                if (queryResult.success) {
                    console.log(`    ${index + 1}. "${queryResult.query}": ${queryResult.resultCount} articles`);
                } else {
                    console.log(`    ${index + 1}. "${queryResult.query}": Error - ${queryResult.error}`);
                }
            });
        } else {
            console.log(chalk.red('✗ Batch search failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Article ingestion
 */
async function demoArticleIngestion() {
    console.log(chalk.cyan('\n📥 Demo: Article Ingestion'));
    console.log('Ingesting articles about "climate change" into knowledge graph...\n');
    
    try {
        const result = await apiRequest('/wikipedia/ingest', {
            method: 'POST',
            body: JSON.stringify({
                searchQueries: ['climate change'],
                options: {
                    searchLimit: 2
                }
            })
        });
        
        if (result.success) {
            const ingestionResult = result.result;
            console.log(chalk.green('✓ Ingestion completed:'));
            console.log(`  Total articles: ${ingestionResult.summary.totalArticles}`);
            console.log(`  Successful ingestions: ${ingestionResult.summary.successfulIngestions}`);
            console.log(`  Failed ingestions: ${ingestionResult.summary.failedIngestions}`);
            console.log(`  Duration: ${result.duration}ms`);
            
            if (ingestionResult.ingestionResults.length > 0) {
                console.log('\n  Ingestion details:');
                ingestionResult.ingestionResults.forEach((ingest, index) => {
                    if (ingest.success) {
                        console.log(`    ${index + 1}. "${ingest.article}": Successfully ingested`);
                    } else {
                        console.log(`    ${index + 1}. "${ingest.article}": Failed - ${ingest.error}`);
                    }
                });
            }
        } else {
            console.log(chalk.red('✗ Ingestion failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Category search
 */
async function demoCategorySearch() {
    console.log(chalk.cyan('\n📂 Demo: Category Search'));
    console.log('Searching articles in "Physics" category...\n');
    
    try {
        const result = await apiRequest('/wikipedia/categories?category=Physics&limit=5', {
            method: 'GET'
        });
        
        if (result.success) {
            const categoryResult = result.result;
            console.log(chalk.green(`✓ Found ${categoryResult.resultCount} articles in category:`));
            
            if (categoryResult.pages) {
                categoryResult.pages.forEach((page, index) => {
                    console.log(`  ${index + 1}. ${page.title}`);
                    if (page.extract) {
                        console.log(`     ${page.extract.substring(0, 100)}...`);
                    }
                });
            }
            
            console.log(`  Duration: ${result.duration}ms`);
        } else {
            console.log(chalk.red('✗ Category search failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Combined workflow
 */
async function demoCombinedWorkflow() {
    console.log(chalk.cyan('\n🔄 Demo: Combined Workflow'));
    console.log('Search → Retrieve → Analyze workflow for "renewable energy"...\n');
    
    try {
        // Step 1: Search for articles
        console.log('Step 1: Searching for articles...');
        const searchResult = await apiRequest('/wikipedia/search?query=renewable%20energy&limit=2', {
            method: 'GET'
        });
        
        if (!searchResult.success) {
            throw new Error(`Search failed: ${searchResult.error}`);
        }
        
        console.log(`  Found ${searchResult.result.resultCount} articles`);
        
        // Step 2: Get detailed content for first article
        if (searchResult.result.results.length > 0) {
            const firstArticle = searchResult.result.results[0];
            console.log(`\nStep 2: Retrieving detailed content for "${firstArticle.title}"...`);
            
            const articleResult = await apiRequest(`/wikipedia/article?title=${encodeURIComponent(firstArticle.title)}&includeContent=true`, {
                method: 'GET'
            });
            
            if (articleResult.success) {
                const article = articleResult.result.article;
                console.log(`  Retrieved article: ${article.length} bytes`);
                console.log(`  Categories: ${article.categories?.length || 0}`);
                console.log(`  Links: ${article.links?.length || 0}`);
                
                // Step 3: Demonstrate ingestion potential
                console.log(`\nStep 3: Article is ready for ingestion to knowledge graph`);
                console.log(`  Would create RDF triples for content analysis`);
                console.log(`  Would extract entities and relationships`);
                console.log(`  Would enable semantic search capabilities`);
            } else {
                console.log(`  Article retrieval failed: ${articleResult.error}`);
            }
        }
        
        console.log(chalk.green('\n✓ Combined workflow completed successfully'));
        
    } catch (error) {
        console.log(chalk.red('✗ Combined workflow failed:'), error.message);
    }
}

/**
 * Main demo function
 */
async function main() {
    console.log(chalk.bold.blue('📚 Wikipedia API Demo'));
    console.log(chalk.gray('Demonstrating Wikipedia search and content capabilities\n'));
    
    try {
        await demoArticleSearch();
        await demoGetArticle();
        await demoBatchSearch();
        await demoArticleIngestion();
        await demoCategorySearch();
        await demoCombinedWorkflow();
        
        console.log(chalk.bold.green('\n🎉 All Wikipedia demos completed successfully!'));
        console.log(chalk.gray('\nNote: Make sure the API server is running on localhost:4100'));
        console.log(chalk.gray('Start it with: npm run start:api\n'));
        
    } catch (error) {
        console.log(chalk.red('\n❌ Demo failed:'), error.message);
        console.log(chalk.gray('\nMake sure:'));
        console.log(chalk.gray('1. API server is running (npm run start:api)'));
        console.log(chalk.gray('2. Authentication is configured correctly'));
        console.log(chalk.gray('3. SPARQL endpoint is available for ingestion features\n'));
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}