#!/usr/bin/env node

/**
 * Sync session cache data to SPARQL store
 * This script addresses the issue where documents are stored in session cache
 * but not persisting to SPARQL, causing context retrieval to fail
 */

import { initializeServices, getMemoryManager } from './mcp/lib/services.js';

async function syncSessionToSparql() {
    console.log('🔄 Starting session-to-SPARQL sync...');
    
    try {
        // Initialize services
        await initializeServices();
        const memoryManager = getMemoryManager();
        
        // Check if there's data in memory that needs to be synced
        const memStore = memoryManager.memStore;
        console.log(`📊 Found ${memStore.shortTermMemory.length} short-term, ${memStore.longTermMemory.length} long-term memories in session`);
        
        if (memStore.shortTermMemory.length > 0 || memStore.longTermMemory.length > 0) {
            console.log('💾 Forcing sync to SPARQL...');
            
            // Force save to SPARQL
            await memoryManager.store.saveMemoryToHistory(memStore);
            console.log('✅ Successfully synced session data to SPARQL');
            
            // Verify by checking SPARQL store
            const query = `SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }`;
            const response = await fetch('http://localhost:3030/semem/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/sparql-query' },
                body: query
            });
            const data = await response.json();
            const count = data.results.bindings[0].count.value;
            console.log(`🔍 SPARQL store now contains ${count} triples`);
        } else {
            console.log('ℹ️  No session data to sync');
        }
        
    } catch (error) {
        console.error('❌ Error syncing session to SPARQL:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    syncSessionToSparql();
}

export { syncSessionToSparql };