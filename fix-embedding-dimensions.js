#!/usr/bin/env node

/**
 * Fix embedding dimension mismatches in SPARQL store
 * Finds embeddings with incompatible dimensions and either fixes or removes them
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeServices } from './_mcp/lib/initialization.js';

async function fixEmbeddingDimensions() {
    console.log('🔧 Starting embedding dimension fix...');

    try {
        const { memoryManager, config } = await initializeServices();
        const storage = memoryManager.storage;

        // Get target dimension from config
        const llmProviders = config.get('llmProviders') || [];
        const activeEmbeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        const targetDimension = activeEmbeddingProvider.embeddingDimension;
        console.log(`🎯 Target embedding dimension: ${targetDimension}`);

        // Query to find all embeddings and their dimensions
        const checkQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            SELECT ?entity ?embeddingNode ?vectorContent WHERE {
                ?entity ragno:hasEmbedding ?embeddingNode .
                ?embeddingNode ragno:vectorContent ?vectorContent .
            }
        `;

        console.log('📊 Analyzing stored embeddings...');
        const results = await storage.executeSparqlQuery(checkQuery);

        let validCount = 0;
        let invalidCount = 0;
        const invalidEmbeddings = [];

        for (const binding of results.results.bindings) {
            const entity = binding.entity.value;
            const embeddingNode = binding.embeddingNode.value;
            const vectorContent = binding.vectorContent.value;

            try {
                const embedding = JSON.parse(vectorContent);
                const dimension = Array.isArray(embedding) ? embedding.length : 0;

                if (dimension === targetDimension) {
                    validCount++;
                    console.log(`✅ ${entity}: ${dimension}D (valid)`);
                } else {
                    invalidCount++;
                    console.log(`❌ ${entity}: ${dimension}D (invalid, expected ${targetDimension}D)`);
                    invalidEmbeddings.push({
                        entity,
                        embeddingNode,
                        currentDimension: dimension,
                        embedding
                    });
                }
            } catch (error) {
                invalidCount++;
                console.log(`❌ ${entity}: Invalid JSON embedding`);
                invalidEmbeddings.push({
                    entity,
                    embeddingNode,
                    currentDimension: 0,
                    embedding: null
                });
            }
        }

        console.log(`\n📈 Summary: ${validCount} valid, ${invalidCount} invalid embeddings`);

        if (invalidEmbeddings.length > 0) {
            console.log('\n🔧 Fixing invalid embeddings...');

            for (const invalid of invalidEmbeddings) {
                console.log(`\n🔄 Processing ${invalid.entity}...`);

                if (invalid.embedding && Array.isArray(invalid.embedding)) {
                    // Try to adjust the embedding dimension
                    const adjustedEmbedding = storage.vectors.adjustEmbeddingLength(
                        invalid.embedding,
                        targetDimension
                    );

                    console.log(`  📏 Adjusted from ${invalid.currentDimension}D to ${adjustedEmbedding.length}D`);

                    // Update the embedding in SPARQL store
                    const updateQuery = `
                        PREFIX ragno: <http://purl.org/stuff/ragno/>
                        DELETE {
                            <${invalid.embeddingNode}> ragno:vectorContent ?oldContent .
                        }
                        INSERT {
                            <${invalid.embeddingNode}> ragno:vectorContent "${JSON.stringify(adjustedEmbedding).replace(/"/g, '\\"')}" .
                        }
                        WHERE {
                            <${invalid.embeddingNode}> ragno:vectorContent ?oldContent .
                        }
                    `;

                    await storage.executeSparqlUpdate(updateQuery);
                    console.log(`  ✅ Updated embedding in SPARQL store`);
                } else {
                    // Remove invalid embedding entirely
                    console.log(`  🗑️ Removing invalid embedding...`);
                    const deleteQuery = `
                        PREFIX ragno: <http://purl.org/stuff/ragno/>
                        DELETE {
                            <${invalid.entity}> ragno:hasEmbedding <${invalid.embeddingNode}> .
                            <${invalid.embeddingNode}> ?p ?o .
                        }
                        WHERE {
                            <${invalid.entity}> ragno:hasEmbedding <${invalid.embeddingNode}> .
                            <${invalid.embeddingNode}> ?p ?o .
                        }
                    `;

                    await storage.executeSparqlUpdate(deleteQuery);
                    console.log(`  ✅ Removed invalid embedding from SPARQL store`);
                }
            }
        }

        console.log('\n🔄 Reloading memory to rebuild FAISS index...');
        await memoryManager.storage._ensureMemoryLoaded();

        console.log('\n✅ Embedding dimension fix completed!');
        console.log(`🔍 FAISS index now contains: ${storage.vectors.getIndexSize()} entries`);

        await memoryManager.dispose();

    } catch (error) {
        console.error('❌ Error fixing embedding dimensions:', error);
        process.exit(1);
    }
}

// Run the fix
fixEmbeddingDimensions();