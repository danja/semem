#!/usr/bin/env node

/**
 * Batched SPARQL Store Cleanup
 * Removes phantom nodes in small batches to avoid timeouts
 */

import fetch from 'node-fetch';
import Config from '../src/Config.js';

const SPARQL_ENDPOINT = 'http://localhost:3030/semem';

// Graph URI will be loaded from config
let GRAPH_URI;
let auth;

async function executeSPARQLUpdate(query, description, timeout = 30000) {
    console.log(`🔄 ${description}...`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`${SPARQL_ENDPOINT}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Authorization': `Basic ${auth}`
            },
            body: query,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            console.log(`✅ ${description} completed`);
            return true;
        } else {
            console.log(`❌ ${description} failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`⏱️  ${description} timed out after ${timeout/1000}s`);
        } else {
            console.log(`❌ ${description} error: ${error.message}`);
        }
        return false;
    }
}

async function removeBatchOfPhantomNodes(batchSize = 1000) {
    const query = `
        PREFIX semem: <http://purl.org/stuff/semem/>
        
        DELETE {
            GRAPH <${GRAPH_URI}> {
                ?phantomNode semem:decayFactor ?decay .
            }
        }
        WHERE {
            {
                SELECT ?phantomNode ?decay WHERE {
                    GRAPH <${GRAPH_URI}> {
                        ?phantomNode semem:decayFactor ?decay .
                        FILTER(isBlank(?phantomNode))
                        FILTER NOT EXISTS { 
                            ?phantomNode ?otherProp ?otherValue . 
                            FILTER(?otherProp != semem:decayFactor)
                        }
                    }
                }
                LIMIT ${batchSize}
            }
        }
    `;
    
    return await executeSPARQLUpdate(query, `Removing batch of ${batchSize} phantom nodes`, 15000);
}

async function countRemainingPhantoms() {
    const query = `
        SELECT (COUNT(*) as ?count)
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
            return parseInt(data.results.bindings[0]?.count?.value || 0);
        }
    } catch (error) {
        console.log(`❌ Count query failed: ${error.message}`);
    }
    
    return -1;
}

async function main() {
    console.log('🚀 Starting Batched Cleanup...\n');

    // Initialize config to get graph URI
    const config = new Config();
    await config.init();
    GRAPH_URI = config.get('graphName') || config.get('storage.options.graphName');
    if (!GRAPH_URI) {
        throw new Error('Graph name not found in configuration. Please set graphName in config.json');
    }

    // Get auth from config
    const storageOptions = config.get('storage.options');
    if (storageOptions.user && storageOptions.password) {
        auth = Buffer.from(`${storageOptions.user}:${storageOptions.password}`).toString('base64');
    }

    console.log(`📊 Graph URI: ${GRAPH_URI}\n`);
    
    let totalRemoved = 0;
    let batchSize = 5000;
    let maxBatches = 200; // Safety limit
    
    for (let batch = 1; batch <= maxBatches; batch++) {
        console.log(`\n📦 Batch ${batch}:`);
        
        // Remove batch
        const success = await removeBatchOfPhantomNodes(batchSize);
        
        if (!success) {
            console.log(`⚠️  Batch ${batch} failed, trying smaller size...`);
            batchSize = Math.max(100, Math.floor(batchSize / 2));
            continue;
        }
        
        // Check remaining count every 10 batches
        if (batch % 5 === 0) {
            const remaining = await countRemainingPhantoms();
            console.log(`📊 Remaining phantom nodes: ${remaining}`);
            
            if (remaining === 0) {
                console.log(`🎉 All phantom nodes removed after ${batch} batches!`);
                break;
            }
            
            if (remaining > 0) {
                totalRemoved += batchSize;
                console.log(`📈 Estimated progress: ${totalRemoved} removed`);
            }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final count
    const finalCount = await countRemainingPhantoms();
    console.log(`\n✅ Cleanup completed. Remaining phantom nodes: ${finalCount}`);
}

main().catch(console.error);