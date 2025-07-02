#!/usr/bin/env node

/**
 * Wikidata API Demo
 * 
 * Demonstrates how to use the Wikidata API endpoints for:
 * - Entity lookup by ID or name
 * - Concept research 
 * - Entity search
 * - SPARQL queries
 * - Concept discovery from text
 * 
 * Usage: node examples/http-api/WikidataAPIDemo.js
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
 * Demo: Entity lookup by Wikidata ID
 */
async function demoEntityLookupById() {
    console.log(chalk.cyan('\n🔍 Demo: Entity Lookup by Wikidata ID'));
    console.log('Looking up Q42 (Douglas Adams)...\n');
    
    try {
        const result = await apiRequest('/wikidata/entity', {
            method: 'POST',
            body: JSON.stringify({
                entityId: 'Q42',
                language: 'en',
                includeRelated: true
            })
        });
        
        if (result.success) {
            const entity = result.result.entity;
            console.log(chalk.green('✓ Entity found:'));
            console.log(`  ID: ${entity.id}`);
            console.log(`  Label: ${entity.labels?.en?.value || 'N/A'}`);
            console.log(`  Description: ${entity.descriptions?.en?.value || 'N/A'}`);
            console.log(`  Duration: ${result.duration}ms`);
        } else {
            console.log(chalk.red('✗ Lookup failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Entity lookup by name
 */
async function demoEntityLookupByName() {
    console.log(chalk.cyan('\n🔍 Demo: Entity Lookup by Name'));
    console.log('Looking up "Stockholm"...\n');
    
    try {
        const result = await apiRequest('/wikidata/entity', {
            method: 'POST',
            body: JSON.stringify({
                entityName: 'Stockholm',
                language: 'en'
            })
        });
        
        if (result.success) {
            const entity = result.result.entity;
            console.log(chalk.green('✓ Entity found:'));
            console.log(`  ID: ${entity.id}`);
            console.log(`  Label: ${entity.labels?.en?.value || 'N/A'}`);
            console.log(`  Description: ${entity.descriptions?.en?.value || 'N/A'}`);
            console.log(`  Search results: ${result.result.searchResults?.length || 0}`);
            console.log(`  Duration: ${result.duration}ms`);
        } else {
            console.log(chalk.red('✗ Lookup failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Entity search
 */
async function demoEntitySearch() {
    console.log(chalk.cyan('\n🔍 Demo: Entity Search'));
    console.log('Searching for "quantum physics"...\n');
    
    try {
        const result = await apiRequest('/wikidata/search?query=quantum%20physics&limit=5', {
            method: 'GET'
        });
        
        if (result.success) {
            const searchResult = result.result;
            console.log(chalk.green(`✓ Found ${searchResult.count} entities:`));
            
            searchResult.results.forEach((entity, index) => {
                console.log(`  ${index + 1}. ${entity.label} (${entity.id})`);
                if (entity.description) {
                    console.log(`     ${entity.description}`);
                }
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
 * Demo: Concept research
 */
async function demoConceptResearch() {
    console.log(chalk.cyan('\n🔍 Demo: Concept Research'));
    console.log('Researching concepts related to "artificial intelligence"...\n');
    
    try {
        const result = await apiRequest('/wikidata/research', {
            method: 'POST',
            body: JSON.stringify({
                question: 'What is artificial intelligence and how does it work?',
                options: {
                    maxEntitiesPerConcept: 2,
                    maxSearchResults: 10,
                    storeResults: false // Don't store for demo
                }
            })
        });
        
        if (result.success) {
            const research = result.result;
            console.log(chalk.green('✓ Research completed:'));
            console.log(`  Concepts extracted: ${research.statistics?.conceptsExtracted || 0}`);
            console.log(`  Entities found: ${research.statistics?.entitiesFound || 0}`);
            console.log(`  Total research questions: ${research.statistics?.totalResearchQuestions || 0}`);
            console.log(`  Duration: ${result.duration}ms`);
            
            if (research.conceptResults) {
                console.log('\n  Top concepts:');
                research.conceptResults.slice(0, 3).forEach((concept, index) => {
                    console.log(`    ${index + 1}. ${concept.concept} (${concept.entities?.length || 0} entities)`);
                });
            }
        } else {
            console.log(chalk.red('✗ Research failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: SPARQL query
 */
async function demoSPARQLQuery() {
    console.log(chalk.cyan('\n🔍 Demo: SPARQL Query'));
    console.log('Executing SPARQL query to find capitals...\n');
    
    const sparqlQuery = `
        SELECT ?country ?countryLabel ?capital ?capitalLabel WHERE {
          ?country wdt:P31 wd:Q6256 .
          ?country wdt:P36 ?capital .
          ?country rdfs:label ?countryLabel .
          ?capital rdfs:label ?capitalLabel .
          FILTER(LANG(?countryLabel) = "en")
          FILTER(LANG(?capitalLabel) = "en")
        }
        ORDER BY ?countryLabel
        LIMIT 5
    `;
    
    try {
        const result = await apiRequest('/wikidata/sparql', {
            method: 'POST',
            body: JSON.stringify({
                query: sparqlQuery,
                format: 'json'
            })
        });
        
        if (result.success) {
            const queryResult = result.result;
            console.log(chalk.green('✓ SPARQL query executed:'));
            console.log(`  Duration: ${result.duration}ms`);
            
            if (queryResult.result?.results?.bindings) {
                console.log('\n  Results:');
                queryResult.result.results.bindings.forEach((binding, index) => {
                    const country = binding.countryLabel?.value || 'Unknown';
                    const capital = binding.capitalLabel?.value || 'Unknown';
                    console.log(`    ${index + 1}. ${country}: ${capital}`);
                });
            }
        } else {
            console.log(chalk.red('✗ SPARQL query failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Demo: Concept discovery from text
 */
async function demoConceptDiscovery() {
    console.log(chalk.cyan('\n🔍 Demo: Concept Discovery'));
    console.log('Extracting concepts from text about climate change...\n');
    
    const text = `
        Climate change refers to long-term shifts in global temperatures and weather patterns. 
        While climate change is a natural phenomenon, scientific evidence shows that human activities 
        have been the main driver of climate change since the mid-20th century. The burning of fossil 
        fuels releases greenhouse gases like carbon dioxide into the atmosphere, which trap heat and 
        warm the planet. This leads to rising sea levels, extreme weather events, and changes in 
        precipitation patterns that affect ecosystems and human societies worldwide.
    `;
    
    try {
        const result = await apiRequest('/wikidata/concepts', {
            method: 'POST',
            body: JSON.stringify({
                text: text.trim(),
                options: {
                    researchConcepts: true,
                    maxEntitiesPerConcept: 1,
                    storeResults: false
                }
            })
        });
        
        if (result.success) {
            const discovery = result.result;
            console.log(chalk.green('✓ Concept discovery completed:'));
            console.log(`  Concepts extracted: ${discovery.conceptCount}`);
            console.log(`  Entities found: ${discovery.entitiesFound || 0}`);
            console.log(`  Duration: ${result.duration}ms`);
            
            if (discovery.concepts) {
                console.log('\n  Discovered concepts:');
                discovery.concepts.slice(0, 5).forEach((concept, index) => {
                    console.log(`    ${index + 1}. ${concept}`);
                });
            }
        } else {
            console.log(chalk.red('✗ Concept discovery failed:'), result.error);
        }
    } catch (error) {
        console.log(chalk.red('✗ Request failed:'), error.message);
    }
}

/**
 * Main demo function
 */
async function main() {
    console.log(chalk.bold.blue('🌐 Wikidata API Demo'));
    console.log(chalk.gray('Demonstrating Wikidata research capabilities\n'));
    
    try {
        await demoEntityLookupById();
        await demoEntityLookupByName();
        await demoEntitySearch();
        await demoConceptResearch();
        await demoSPARQLQuery();
        await demoConceptDiscovery();
        
        console.log(chalk.bold.green('\n🎉 All demos completed successfully!'));
        console.log(chalk.gray('\nNote: Make sure the API server is running on localhost:4100'));
        console.log(chalk.gray('Start it with: npm run start:api\n'));
        
    } catch (error) {
        console.log(chalk.red('\n❌ Demo failed:'), error.message);
        console.log(chalk.gray('\nMake sure:'));
        console.log(chalk.gray('1. API server is running (npm run start:api)'));
        console.log(chalk.gray('2. Authentication is configured correctly'));
        console.log(chalk.gray('3. Required services (LLM, SPARQL) are available\n'));
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}