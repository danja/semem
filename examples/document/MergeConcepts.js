#!/usr/bin/env node

/**
 * Merge Concepts Script
 * 
 * Finds duplicate concepts (same content) within the same source document,
 * merges them into a single concept with combined intermediate text elements,
 * and removes the redundant concept corpuscles. This helps consolidate
 * concept extraction results and reduce redundancy.
 * 
 * Usage: node examples/document/MergeConcepts.js [--limit N] [--graph URI] [--dry-run]
 */

import { parseArgs } from 'util';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import Config from '../../src/Config.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');
    
    const { values: args } = parseArgs({
        options: {
            limit: {
                type: 'string',
                default: '50'
            },
            graph: {
                type: 'string'
            },
            'dry-run': {
                type: 'boolean',
                default: false
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help) {
        console.log(`
MergeConcepts.js - Merge duplicate concepts within source documents

Usage: node examples/document/MergeConcepts.js [options]

Options:
  --limit <number>   Maximum number of concept groups to process (default: 50)
  --graph <uri>      Graph URI to query (default: from config)
  --dry-run          Show what would be merged without making changes
  --help, -h         Show this help message

Description:
  This script finds concepts with identical content that originated from the same
  source document and merges them into a single concept. It consolidates the
  intermediate text elements from all duplicate concepts into the merged concept
  and removes the redundant concept corpuscles.

Examples:
  node examples/document/MergeConcepts.js                     # Merge up to 50 concept groups
  node examples/document/MergeConcepts.js --limit 20          # Process up to 20 groups
  node examples/document/MergeConcepts.js --dry-run           # Preview merges without changes
  node examples/document/MergeConcepts.js --graph "http://example.org/docs"

Prerequisites:
  1. Concepts must be extracted using ExtractConcepts.js
  2. Document processing pipeline must be complete
  3. SPARQL endpoint running and accessible
        `);
        return;
    }

    console.log('🔗 Merging Duplicate Concepts');
    console.log('='.repeat(60));

    let queryService = null;
    let sparqlHelper = null;

    try {
        // Load configuration
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        const config = new Config(configPath);
        await config.init();

        // Get graph URI and SPARQL endpoint
        const storageConfig = config.get('storage');
        const graphURI = args.graph || storageConfig?.options?.graphName || 'http://tensegrity.it/semem';
        const sparqlEndpoint = storageConfig?.options?.query || 'http://localhost:3030/semem/query';
        const updateEndpoint = storageConfig?.options?.update || sparqlEndpoint.replace('/query', '/update');

        // Create query service and SPARQL helper
        queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });

        sparqlHelper = new SPARQLHelper(updateEndpoint, {
            user: storageConfig?.options?.user,
            password: storageConfig?.options?.password
        });

        // Prepare query parameters
        const queryParams = {
            graphURI: graphURI,
            limit: args.limit && parseInt(args.limit) > 0 ? `LIMIT ${args.limit}` : ''
        };

        console.log(`📊 Querying graph: ${graphURI}`);
        console.log(`🔢 Limit: ${args.limit || 'no limit'}`);
        console.log(`🔍 Mode: ${args['dry-run'] ? 'DRY RUN' : 'MERGE'}`);
        console.log('');

        // Execute query to find duplicate concepts
        const query = await queryService.getQuery('merge-concepts', queryParams);
        const result = await sparqlHelper.executeSelect(query);

        if (!result.success) {
            throw new Error(`Query failed: ${result.error}`);
        }

        const duplicateGroups = result.data.results.bindings;
        
        console.log(`📝 Found ${duplicateGroups.length} concept groups with duplicates`);
        console.log('='.repeat(60));

        if (duplicateGroups.length === 0) {
            console.log('No duplicate concepts found in the knowledge graph.');
            console.log('');
            console.log('💡 This is good - it means concepts are already well-consolidated!');
            return;
        }

        let totalMerged = 0;
        let totalConceptsRemoved = 0;

        // Process each group of duplicates
        for (let i = 0; i < duplicateGroups.length; i++) {
            const group = duplicateGroups[i];
            const conceptText = group.conceptText.value;
            const documentTitle = group.documentTitle ? group.documentTitle.value : 'Unknown Document';
            const documentFile = group.documentFile ? group.documentFile.value : 'Unknown File';
            const duplicateCount = parseInt(group.duplicateCount.value);
            
            const duplicateCorpuscles = group.duplicateCorpuscles.value.split('|');
            const conceptUnits = group.conceptUnits.value.split('|').filter(e => e);
            const sourceChunks = group.sourceChunks.value.split('|');
            const intermediateElements = group.intermediateElements.value.split('|').filter(e => e);
            const collectionCorpuscles = group.collectionCorpuscles.value.split('|').filter(e => e);

            // Create the concept label for display
            const conceptLabel = `Concept: ${conceptText}`;

            console.log(`📚 Document: ${documentTitle}`);
            console.log(`📁 File: ${documentFile}`);
            console.log(`🔗 Concept: "${conceptText}"`);
            console.log(`🏷️  Label: "${conceptLabel}"`);
            console.log(`🔢 Duplicates: ${duplicateCount} copies`);
            console.log(`🎯 Concept units: ${conceptUnits.length}`);
            console.log(`📄 Source chunks: ${sourceChunks.length}`);
            console.log(`📋 Intermediate elements: ${intermediateElements.length}`);
            
            if (args['dry-run']) {
                console.log('   🔍 DRY RUN - Would merge:');
                duplicateCorpuscles.forEach((corpuscle, idx) => {
                    console.log(`      ${idx + 1}. ${corpuscle.split('/').pop()}`);
                });
                console.log('');
                totalMerged++;
                totalConceptsRemoved += duplicateCount - 1;
                continue;
            }

            try {
                // Merge the concepts
                const mergeResult = await mergeConcepts(
                    sparqlHelper,
                    graphURI,
                    conceptText,
                    duplicateCorpuscles,
                    conceptUnits,
                    sourceChunks,
                    intermediateElements,
                    collectionCorpuscles
                );

                if (mergeResult.success) {
                    console.log(`   ✅ Successfully merged into: ${mergeResult.mergedCorpuscleURI.split('/').pop()}`);
                    console.log(`   🗑️  Removed ${duplicateCount - 1} duplicate concepts`);
                    totalMerged++;
                    totalConceptsRemoved += duplicateCount - 1;
                } else {
                    console.log(`   ❌ Failed to merge: ${mergeResult.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Error merging concepts: ${error.message}`);
            }
            
            console.log('');
        }

        // Display summary statistics
        console.log('📊 Merge Summary:');
        console.log(`   Concept groups processed: ${duplicateGroups.length}`);
        console.log(`   Successfully merged: ${totalMerged}`);
        console.log(`   Redundant concepts removed: ${totalConceptsRemoved}`);
        console.log(`   Mode: ${args['dry-run'] ? 'DRY RUN (no changes made)' : 'MERGE (changes applied)'}`);
        console.log('');

        if (args['dry-run']) {
            console.log('💡 Run without --dry-run to apply these merges');
        } else {
            console.log('✅ Concept merging completed successfully!');
        }
        
    } catch (error) {
        console.error('❌ Error merging concepts:', error.message);
        
        if (logger.getLevel() <= logger.levels.DEBUG) {
            console.error('Stack:', error.stack);
        }
        
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('- Ensure SPARQL endpoint is running and accessible');
        console.log('- Check that the graph URI is correct');
        console.log('- Verify that concepts have been extracted (run ExtractConcepts.js)');
        console.log('- Check network connectivity to SPARQL endpoint');
        console.log('- Ensure update endpoint has write permissions');
        
        // Cleanup before exit
        if (queryService) {
            queryService.cleanup();
        }
        
        process.exit(1);
    } finally {
        // Always cleanup connections
        if (queryService) {
            queryService.cleanup();
        }
        
        // Force exit after a short delay to ensure cleanup completes
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

/**
 * Merge duplicate concepts into a single concept
 */
async function mergeConcepts(
    sparqlHelper,
    graphURI,
    conceptText,
    duplicateCorpuscles,
    conceptUnits,
    sourceChunks,
    intermediateElements,
    collectionCorpuscles
) {
    try {
        const now = new Date().toISOString();
        
        // Use the first corpuscle as the target for merging
        const targetCorpuscleURI = duplicateCorpuscles[0];
        const duplicatesToRemove = duplicateCorpuscles.slice(1);
        
        // Create a merged concept with all intermediate elements
        const mergedCorpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'merged-concept-corpuscle', conceptText);
        
        // Create a merged concept unit
        const mergedConceptURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'merged-concept', conceptText);
        
        // Create the concept label for the corpuscle
        const conceptLabel = `Concept: ${conceptText}`;
        
        // Combine all entities (removing duplicates)
        const uniqueConceptUnits = [...new Set(conceptUnits)];
        const uniqueIntermediateElements = [...new Set(intermediateElements)];
        const uniqueSourceChunks = [...new Set(sourceChunks)];
        const uniqueCollectionCorpuscles = [...new Set(collectionCorpuscles)];
        
        // Build the merge query
        const mergeTriples = `
            # Create merged concept unit (ragno:Unit only - matching actual structure)
            <${mergedConceptURI}> a ragno:Unit ;
                rdfs:label ${SPARQLHelper.createLiteral(conceptText)} ;
                dcterms:created "${now}"^^xsd:dateTime ;
                ragno:mergedFrom ${uniqueConceptUnits.map(uri => `<${uri}>`).join(', ')} ;
                ragno:inCorpuscle <${mergedCorpuscleURI}> .
            
            # Create merged concept corpuscle
            <${mergedCorpuscleURI}> a ragno:Corpuscle ;
                rdfs:label ${SPARQLHelper.createLiteral(conceptLabel)} ;
                ragno:content ${SPARQLHelper.createLiteral(conceptText)} ;
                dcterms:created "${now}"^^xsd:dateTime ;
                ragno:mergedFrom ${duplicateCorpuscles.map(uri => `<${uri}>`).join(', ')} ;
                ragno:mergedElementCount ${uniqueIntermediateElements.length} ;
                ragno:originalDuplicates ${duplicateCorpuscles.length} ;
                skos:member <${mergedConceptURI}> .
            
            # Link to all source chunks
            ${uniqueSourceChunks.map(chunk => 
                `<${mergedCorpuscleURI}> prov:wasDerivedFrom <${chunk}> .`
            ).join('\n            ')}
            
            # Link to all intermediate elements
            ${uniqueIntermediateElements.map(element => 
                `<${mergedCorpuscleURI}> ragno:hasIntermediateElement <${element}> .`
            ).join('\n            ')}
        `;
        
        // Execute the merge insert
        const insertQuery = sparqlHelper.createInsertDataQuery(graphURI, mergeTriples);
        const insertResult = await sparqlHelper.executeUpdate(insertQuery);
        
        if (!insertResult.success) {
            throw new Error(`Failed to insert merged concept: ${insertResult.error}`);
        }
        
        // Remove duplicate concept corpuscles and their associated concept units
        for (const duplicateCorpuscleURI of duplicatesToRemove) {
            // First, find and delete the associated concept units
            const findUnitsQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                
                SELECT ?conceptUnit
                WHERE {
                    GRAPH <${graphURI}> {
                        <${duplicateCorpuscleURI}> skos:member ?conceptUnit .
                        ?conceptUnit a ragno:Unit .
                    }
                }
            `;
            
            const unitsResult = await sparqlHelper.executeSelect(findUnitsQuery);
            if (unitsResult.success && unitsResult.data.results.bindings.length > 0) {
                // Delete each associated concept unit
                for (const binding of unitsResult.data.results.bindings) {
                    const conceptUnitURI = binding.conceptUnit.value;
                    const deleteUnitQuery = `
                        PREFIX ragno: <http://purl.org/stuff/ragno/>
                        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                        PREFIX dcterms: <http://purl.org/dc/terms/>
                        PREFIX prov: <http://www.w3.org/ns/prov#>
                        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                        
                        DELETE {
                            GRAPH <${graphURI}> {
                                <${conceptUnitURI}> ?p ?o .
                                ?s ?p2 <${conceptUnitURI}> .
                            }
                        }
                        WHERE {
                            GRAPH <${graphURI}> {
                                {
                                    <${conceptUnitURI}> ?p ?o .
                                }
                                UNION
                                {
                                    ?s ?p2 <${conceptUnitURI}> .
                                }
                            }
                        }
                    `;
                    
                    const deleteUnitResult = await sparqlHelper.executeUpdate(deleteUnitQuery);
                    if (!deleteUnitResult.success) {
                        logger.warn(`Failed to delete duplicate concept unit ${conceptUnitURI}: ${deleteUnitResult.error}`);
                    }
                }
            }
            
            // Then delete the corpuscle itself
            const deleteCorpuscleQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX dcterms: <http://purl.org/dc/terms/>
                PREFIX prov: <http://www.w3.org/ns/prov#>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                
                DELETE {
                    GRAPH <${graphURI}> {
                        <${duplicateCorpuscleURI}> ?p ?o .
                        ?s ?p2 <${duplicateCorpuscleURI}> .
                    }
                }
                WHERE {
                    GRAPH <${graphURI}> {
                        {
                            <${duplicateCorpuscleURI}> ?p ?o .
                        }
                        UNION
                        {
                            ?s ?p2 <${duplicateCorpuscleURI}> .
                        }
                    }
                }
            `;
            
            const deleteCorpuscleResult = await sparqlHelper.executeUpdate(deleteCorpuscleQuery);
            if (!deleteCorpuscleResult.success) {
                logger.warn(`Failed to delete duplicate concept corpuscle ${duplicateCorpuscleURI}: ${deleteCorpuscleResult.error}`);
            }
        }
        
        return {
            success: true,
            mergedCorpuscleURI: mergedCorpuscleURI,
            duplicatesRemoved: duplicatesToRemove.length
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export default main;