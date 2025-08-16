#!/usr/bin/env node

/**
 * Create test entities from existing TextElements for ZPT testing
 */

async function executeUpdate(endpoint, query) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/sparql-update',
            'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
        },
        body: query
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`SPARQL update failed: ${response.status} - ${text}`);
    }

    return { success: true };
}

async function createTestEntities() {
    console.log('🏗️  Creating test entities from TextElements...');

    try {
        // Create entities based on keywords found in content
        const entityCreationQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            
            INSERT {
                GRAPH <http://hyperdata.it/content> {
                    ?entityURI a ragno:Entity ;
                        rdfs:label ?keyword ;
                        skos:prefLabel ?keyword ;
                        ragno:content ?entityContent ;
                        ragno:isEntryPoint true ;
                        ragno:subType ragno:ExtractedConcept ;
                        dcterms:created ?now .
                }
            }
            WHERE {
                {
                    SELECT DISTINCT ?keyword ?entityContent ?entityURI ?now WHERE {
                        VALUES ?keyword { 
                            "machine learning" "artificial intelligence" "semantic web" 
                            "sparql" "rdf" "knowledge graph" "navigation" "text" 
                            "embedding" "vector" "query" "data" "algorithm"
                        }
                        
                        ?textElement a ragno:TextElement ;
                                    ragno:content ?content .
                        
                        FILTER(CONTAINS(LCASE(?content), LCASE(?keyword)))
                        
                        BIND(CONCAT("Entity for ", ?keyword) AS ?entityContent)
                        BIND(IRI(CONCAT("http://purl.org/stuff/instance/entity-", 
                                       ENCODE_FOR_URI(REPLACE(?keyword, " ", "-")))) AS ?entityURI)
                        BIND(NOW() AS ?now)
                    }
                    LIMIT 50
                }
            }
        `;

        await executeUpdate('http://localhost:3030/semem/update', entityCreationQuery);
        console.log('✅ Created entities based on keyword extraction');

        // Create some units from TextElements
        const unitCreationQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            
            INSERT {
                GRAPH <http://hyperdata.it/content> {
                    ?unitURI a ragno:Unit ;
                        ragno:content ?content ;
                        ragno:hasTextElement ?textElement ;
                        ragno:hasEmbedding ?embedding ;
                        ragno:isEntryPoint true ;
                        dcterms:created ?now .
                }
            }
            WHERE {
                {
                    SELECT ?textElement ?content ?embedding ?unitURI ?now WHERE {
                        ?textElement a ragno:TextElement ;
                                    ragno:content ?content ;
                                    ragno:hasEmbedding ?embedding .
                        
                        FILTER(STRLEN(?content) > 100)
                        
                        BIND(IRI(CONCAT("http://purl.org/stuff/instance/unit-", 
                                       STRUUID())) AS ?unitURI)
                        BIND(NOW() AS ?now)
                    }
                    LIMIT 100
                }
            }
        `;

        await executeUpdate('http://localhost:3030/semem/update', unitCreationQuery);
        console.log('✅ Created units from TextElements');

        console.log('🎉 Test entities and units created successfully!');

    } catch (error) {
        console.error('❌ Failed to create test entities:', error.message);
    }
}

createTestEntities().catch(console.error);