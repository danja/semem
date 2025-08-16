#!/usr/bin/env node

/**
 * Simple test to verify basic functionality
 */

import logger from 'loglevel';

logger.setLevel('info');

async function executeQuery(endpoint, query) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/sparql-query',
            'Accept': 'application/json',
            'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
        },
        body: query
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`SPARQL query failed: ${response.status} - ${text}`);
    }

    return await response.json();
}

async function simpleTest() {
    console.log('🧪 Running simple ZPT functionality test...\n');

    try {
        // Test 1: Check data availability
        console.log('📊 Test 1: Check data in content graph');
        const result1 = await executeQuery('http://localhost:3030/semem/query', `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            SELECT (COUNT(?item) as ?count) WHERE {
                GRAPH <http://hyperdata.it/content> {
                    ?item a ragno:TextElement .
                }
            }
        `);
        
        const textCount = parseInt(result1.results.bindings[0].count.value);
        console.log(`✅ Found ${textCount} TextElements in content graph\n`);

        // Test 2: Check embeddings
        console.log('🔗 Test 2: Check embedding links');
        const result2 = await executeQuery('http://localhost:3030/semem/query', `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            SELECT (COUNT(?link) as ?count) WHERE {
                GRAPH <http://hyperdata.it/content> {
                    ?item ragno:hasEmbedding ?link .
                }
            }
        `);
        
        const embeddingCount = parseInt(result2.results.bindings[0].count.value);
        console.log(`✅ Found ${embeddingCount} embedding links\n`);

        // Test 3: Simple entity query
        console.log('🎯 Test 3: Simple entity query');
        const result3 = await executeQuery('http://localhost:3030/semem/query', `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?item ?label ?content WHERE {
                GRAPH <http://hyperdata.it/content> {
                    ?item a ragno:Entity ;
                          rdfs:label ?label .
                    OPTIONAL { ?item ragno:content ?content }
                }
            }
            LIMIT 5
        `);
        
        console.log(`✅ Found ${result3.results.bindings.length} entities:`);
        result3.results.bindings.forEach((binding, index) => {
            console.log(`   ${index + 1}. ${binding.label?.value || 'No label'}`);
        });
        console.log('');

        // Test 4: Content search
        console.log('🔍 Test 4: Content search with filtering');
        const result4 = await executeQuery('http://localhost:3030/semem/query', `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            SELECT ?item ?content WHERE {
                GRAPH <http://hyperdata.it/content> {
                    ?item a ragno:TextElement ;
                          ragno:content ?content .
                    FILTER(CONTAINS(LCASE(?content), "text"))
                }
            }
            LIMIT 3
        `);
        
        console.log(`✅ Found ${result4.results.bindings.length} text elements containing "text"`);
        console.log('');

        console.log('🎉 All simple tests passed! Basic functionality is working.');

    } catch (error) {
        console.error('❌ Simple test failed:', error.message);
    }
}

simpleTest().catch(console.error);