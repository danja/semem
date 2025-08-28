#!/usr/bin/env node

/**
 * Safe SPARQL Store Cleanup Script
 * 
 * This script safely removes phantom nodes and excessive connections
 * without breaking the legitimate memory system.
 */

import fetch from 'node-fetch';

const SPARQL_ENDPOINT = 'http://localhost:3030/semem';
const GRAPH_URI = 'http://hyperdata.it/content';

// Basic auth if needed
const auth = Buffer.from('admin:admin123').toString('base64');

async function executeSPARQLUpdate(query, description) {
    console.log(`\n🔄 ${description}...`);
    
    try {
        const response = await fetch(`${SPARQL_ENDPOINT}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Authorization': `Basic ${auth}`
            },
            body: query
        });
        
        if (response.ok) {
            console.log(`✅ ${description} completed successfully`);
            return true;
        } else {
            console.error(`❌ ${description} failed: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ ${description} failed: ${error.message}`);
        return false;
    }
}

async function executeSPARQLQuery(query, description) {
    console.log(`\n🔍 ${description}...`);
    
    try {
        const response = await fetch(`${SPARQL_ENDPOINT}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json'
            },
            body: query
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error(`❌ ${description} failed: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ ${description} failed: ${error.message}`);
        return null;
    }
}

async function getStoreStatistics() {
    const query = `
        SELECT 
            (COUNT(*) as ?totalTriples)
            (COUNT(DISTINCT ?s) as ?totalSubjects)
        WHERE { 
            GRAPH <${GRAPH_URI}> { 
                ?s ?p ?o 
            } 
        }
    `;
    
    const result = await executeSPARQLQuery(query, "Getting store statistics");
    if (result && result.results.bindings[0]) {
        const binding = result.results.bindings[0];
        return {
            totalTriples: parseInt(binding.totalTriples.value),
            totalSubjects: parseInt(binding.totalSubjects.value)
        };
    }
    return null;
}

async function countPhantomNodes() {
    const query = `
        SELECT (COUNT(*) as ?phantomCount)
        WHERE { 
            GRAPH <${GRAPH_URI}> { 
                ?s <http://purl.org/stuff/semem/decayFactor> ?decay .
                FILTER(isBlank(?s))
                FILTER NOT EXISTS { 
                    ?s ?p ?o . 
                    FILTER(?p != <http://purl.org/stuff/semem/decayFactor>) 
                }
            }
        }
    `;
    
    const result = await executeSPARQLQuery(query, "Counting phantom nodes");
    if (result && result.results.bindings[0]) {
        return parseInt(result.results.bindings[0].phantomCount.value);
    }
    return 0;
}

async function removePhantomNodes() {
    const query = `
        PREFIX semem: <http://purl.org/stuff/semem/>
        
        DELETE {
            GRAPH <${GRAPH_URI}> {
                ?phantomNode semem:decayFactor ?decay .
            }
        }
        WHERE {
            GRAPH <${GRAPH_URI}> {
                ?phantomNode semem:decayFactor ?decay .
                FILTER(isBlank(?phantomNode))
                
                # Ensure this node has NO other properties
                FILTER NOT EXISTS { 
                    ?phantomNode ?otherProp ?otherValue . 
                    FILTER(?otherProp != semem:decayFactor)
                }
            }
        }
    `;
    
    return await executeSPARQLUpdate(query, "Removing phantom blank nodes");
}

async function pruneExcessiveConnections() {
    // Get entities with more than 100 connections
    const query = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        
        SELECT ?source (COUNT(?target) as ?connectionCount)
        WHERE {
            GRAPH <${GRAPH_URI}> {
                ?source ragno:connectsTo ?target .
            }
        }
        GROUP BY ?source
        HAVING (COUNT(?target) > 100)
        ORDER BY DESC(?connectionCount)
        LIMIT 20
    `;
    
    const result = await executeSPARQLQuery(query, "Finding over-connected entities");
    
    if (result && result.results.bindings.length > 0) {
        console.log(`\n📊 Found ${result.results.bindings.length} over-connected entities:`);
        
        for (const binding of result.results.bindings) {
            const source = binding.source.value;
            const count = parseInt(binding.connectionCount.value);
            console.log(`  - ${source}: ${count} connections`);
        }
        
        // For now, just report - we'd need more sophisticated pruning logic
        console.log(`\n⚠️  Connection pruning would require manual review of connection weights/importance`);
        return true;
    } else {
        console.log(`\n✅ No entities with excessive connections found`);
        return true;
    }
}

async function main() {
    console.log('🚀 Starting SPARQL Store Cleanup...\n');
    
    // Phase 1: Get initial statistics
    console.log('📊 PHASE 1: Initial Analysis');
    const initialStats = await getStoreStatistics();
    const phantomCount = await countPhantomNodes();
    
    if (initialStats) {
        console.log(`📈 Current state:`);
        console.log(`   - Total triples: ${initialStats.totalTriples.toLocaleString()}`);
        console.log(`   - Total subjects: ${initialStats.totalSubjects.toLocaleString()}`);
        console.log(`   - Phantom nodes: ${phantomCount.toLocaleString()}`);
    }
    
    // Phase 2: Remove phantom nodes (safe operation)
    console.log('\n🗑️  PHASE 2: Remove Phantom Nodes');
    if (phantomCount > 0) {
        const success = await removePhantomNodes();
        if (success) {
            console.log(`✅ Removed ${phantomCount.toLocaleString()} phantom nodes`);
        }
    } else {
        console.log('✅ No phantom nodes found');
    }
    
    // Phase 3: Connection analysis  
    console.log('\n🔗 PHASE 3: Connection Analysis');
    await pruneExcessiveConnections();
    
    // Phase 4: Final statistics
    console.log('\n📊 PHASE 4: Final Results');
    const finalStats = await getStoreStatistics();
    const remainingPhantoms = await countPhantomNodes();
    
    if (finalStats && initialStats) {
        console.log(`📈 Results:`);
        console.log(`   - Triples: ${initialStats.totalTriples.toLocaleString()} → ${finalStats.totalTriples.toLocaleString()}`);
        console.log(`   - Subjects: ${initialStats.totalSubjects.toLocaleString()} → ${finalStats.totalSubjects.toLocaleString()}`);
        console.log(`   - Phantom nodes: ${phantomCount.toLocaleString()} → ${remainingPhantoms.toLocaleString()}`);
        
        const tripleReduction = initialStats.totalTriples - finalStats.totalTriples;
        const percentReduction = ((tripleReduction / initialStats.totalTriples) * 100).toFixed(1);
        console.log(`   - Reduction: ${tripleReduction.toLocaleString()} triples (${percentReduction}%)`);
    }
    
    console.log('\n🎉 Cleanup completed!');
}

// Run the cleanup
main().catch(console.error);