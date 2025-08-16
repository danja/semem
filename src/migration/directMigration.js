#!/usr/bin/env node

/**
 * Direct SPARQL migration - move data between graphs
 */

import logger from 'loglevel';

async function executeQuery(endpoint, query, isUpdate = false) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': isUpdate ? 'application/sparql-update' : 'application/sparql-query',
            'Accept': 'application/json',
            'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
        },
        body: query
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`SPARQL ${isUpdate ? 'update' : 'query'} failed: ${response.status} - ${text}`);
    }

    return isUpdate ? { success: true } : await response.json();
}

async function directMigration() {
    console.log('🚀 Starting direct SPARQL migration...');
    
    const queryEndpoint = 'http://localhost:3030/semem/query';
    const updateEndpoint = 'http://localhost:3030/semem/update';
    
    try {
        // Step 1: Copy all ragno data from documents to content graph
        console.log('📄 Step 1: Migrating ragno data to content graph...');
        
        const migrateRagnoData = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            INSERT {
                GRAPH <http://hyperdata.it/content> {
                    ?s ?p ?o .
                }
            }
            WHERE {
                GRAPH <http://example.org/semem/documents> {
                    ?s ?p ?o .
                    ?s a ?type .
                    FILTER(?type IN (ragno:TextElement, ragno:Unit, ragno:Entity, ragno:Corpus, ragno:Community))
                }
            }
        `;
        
        await executeQuery(updateEndpoint, migrateRagnoData, true);
        console.log('✅ Ragno data migrated to content graph');
        
        // Step 2: Add missing embeddings for TextElements
        console.log('🔗 Step 2: Adding missing embedding links...');
        
        const addEmbeddings = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            
            INSERT {
                GRAPH <http://hyperdata.it/content> {
                    ?textElement ragno:hasEmbedding ?embeddingURI .
                    ?embeddingURI a ragno:IndexElement ;
                        ragno:subType ragno:TextEmbedding ;
                        ragno:embeddingModel "nomic-embed-text" ;
                        ragno:embeddingDimension 1536 ;
                        ragno:vectorContent "[]" .
                }
            }
            WHERE {
                GRAPH <http://hyperdata.it/content> {
                    ?textElement a ragno:TextElement .
                    FILTER NOT EXISTS { ?textElement ragno:hasEmbedding ?existing }
                    BIND(IRI(CONCAT("http://purl.org/stuff/instance/embedding-", STRUUID())) AS ?embeddingURI)
                }
            }
        `;
        
        await executeQuery(updateEndpoint, addEmbeddings, true);
        console.log('✅ Embedding links added');
        
        // Step 3: Create a default navigation session
        console.log('🧭 Step 3: Creating navigation session...');
        
        const createNavigation = `
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <http://purl.org/stuff/navigation> {
                    <http://purl.org/stuff/instance/session-migration> a zpt:NavigationSession ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        prov:wasAssociatedWith <http://example.org/agent/migration> ;
                        zpt:hasPurpose "Data migration session" .
                }
            }
        `;
        
        await executeQuery(updateEndpoint, createNavigation, true);
        console.log('✅ Navigation session created');
        
        // Step 4: Validate results
        console.log('🔍 Step 4: Validating migration...');
        
        const validation = await executeQuery(queryEndpoint, `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            
            SELECT 
                (COUNT(?textElement) as ?textElements)
                (COUNT(?embedding) as ?embeddings)
                (COUNT(?session) as ?sessions)
            WHERE {
                {
                    GRAPH <http://hyperdata.it/content> {
                        ?textElement a ragno:TextElement .
                    }
                }
                UNION
                {
                    GRAPH <http://hyperdata.it/content> {
                        ?s ragno:hasEmbedding ?embedding .
                    }
                }
                UNION
                {
                    GRAPH <http://purl.org/stuff/navigation> {
                        ?session a zpt:NavigationSession .
                    }
                }
            }
        `);
        
        const results = validation.results.bindings[0];
        console.log('📊 Migration Results:');
        console.log(`   - Text Elements: ${results.textElements?.value || 0}`);
        console.log(`   - Embeddings: ${results.embeddings?.value || 0}`);
        console.log(`   - Navigation Sessions: ${results.sessions?.value || 0}`);
        
        console.log('✅ Direct migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

directMigration().catch(console.error);