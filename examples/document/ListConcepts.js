#!/usr/bin/env node

/**
 * List Concepts Script
 * 
 * Lists all concepts (ragno:Corpuscle instances) that have been extracted from
 * text elements, showing their labels, content, source text elements, and
 * embedding status. This helps understand what concepts are in the knowledge graph.
 * 
 * Usage: node examples/document/ListConcepts.js [--limit N] [--graph URI] [--format FORMAT]
 */

import { parseArgs } from 'util';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
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
            format: {
                type: 'string',
                default: 'detailed'
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help) {
        console.log(`
ListConcepts.js - List extracted concepts from the knowledge graph

Usage: node examples/document/ListConcepts.js [options]

Options:
  --limit <number>   Maximum number of concepts to display (default: 50)
  --graph <uri>      Graph URI to query (default: from config)
  --format <format>  Output format: detailed, summary, compact (default: detailed)
  --help, -h         Show this help message

Formats:
  detailed   - Full information including embeddings and relationships
  summary    - Concept content and source text element
  compact    - Just concept content (one per line)

Examples:
  node examples/document/ListConcepts.js                          # List 50 concepts
  node examples/document/ListConcepts.js --limit 100             # List 100 concepts
  node examples/document/ListConcepts.js --format summary        # Summary format
  node examples/document/ListConcepts.js --format compact        # Compact format
        `);
        return;
    }

    console.log('🔍 Listing Concepts from Knowledge Graph');
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

        // Create query service and SPARQL helper
        queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });

        sparqlHelper = new SPARQLHelper(sparqlEndpoint, {
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
        console.log(`📋 Format: ${args.format}`);
        console.log('');

        // Execute query
        const query = await queryService.getQuery('list-concepts', queryParams);
        
        // For debugging, you can uncomment this to see the generated query
        // console.log('Generated SPARQL query:');
        // console.log(query);
        // console.log('');

        const result = await sparqlHelper.executeSelect(query);

        if (!result.success) {
            throw new Error(`Query failed: ${result.error}`);
        }

        const concepts = result.data.results.bindings;
        
        console.log(`📝 Found ${concepts.length} concepts`);
        console.log('='.repeat(60));

        if (concepts.length === 0) {
            console.log('No concepts found in the knowledge graph.');
            console.log('');
            console.log('💡 To extract concepts from text elements, run:');
            console.log('   node examples/document/ExtractConcepts.js');
            return;
        }

        // Group concepts by source document for better organization
        const conceptsByDocument = {};
        concepts.forEach(concept => {
            const docTitle = concept.documentTitle ? concept.documentTitle.value : 'Unknown Document';
            const docFile = concept.documentFile ? concept.documentFile.value : 'Unknown File';
            const docKey = `${docTitle}||${docFile}`;
            
            if (!conceptsByDocument[docKey]) {
                conceptsByDocument[docKey] = {
                    title: docTitle,
                    file: docFile,
                    concepts: []
                };
            }
            conceptsByDocument[docKey].concepts.push(concept);
        });

        // Display concepts based on format
        let conceptIndex = 1;
        
        for (const [docKey, docData] of Object.entries(conceptsByDocument)) {
            if (args.format === 'compact') {
                // Compact format - just concept content
                docData.concepts.forEach(concept => {
                    console.log(concept.conceptContent.value);
                });
            } else if (args.format === 'summary') {
                // Summary format - concept content and source document
                console.log(`📚 Document: ${docData.title}`);
                console.log(`📁 File: ${docData.file}`);
                console.log(`📝 Concepts (${docData.concepts.length}):`);
                docData.concepts.forEach(concept => {
                    console.log(`   • ${concept.conceptContent.value}`);
                });
                console.log('');
            } else {
                // Detailed format - full information
                console.log(`📚 Document: ${docData.title}`);
                console.log(`📁 File: ${docData.file}`);
                console.log(`📝 Concepts (${docData.concepts.length}):`);
                
                docData.concepts.forEach(concept => {
                    console.log(`   ${conceptIndex}. ${concept.conceptContent.value}`);
                    console.log(`       📍 Concept URI: ${concept.conceptCorpuscle.value.split('/').pop()}`);
                    console.log(`       🏷️  Label: ${concept.conceptLabel.value}`);
                    console.log(`       📅 Created: ${concept.created.value}`);
                    console.log(`       🧠 Has Embedding: ${concept.hasEmbedding ? 'Yes' : 'No'}`);
                    console.log(`       📄 TextElement: ${concept.sourceTextElement.value.split('/').pop()}`);
                    
                    if (concept.conceptUnit) {
                        console.log(`       🔗 Unit URI: ${concept.conceptUnit.value.split('/').pop()}`);
                    }
                    
                    if (concept.collectionCorpuscle) {
                        console.log(`       📦 Collection: ${concept.collectionCorpuscle.value.split('/').pop()}`);
                    }
                    
                    if (concept.sourceUnit) {
                        console.log(`       📖 Source Unit: ${concept.sourceUnit.value.split('/').pop()}`);
                    }
                    
                    console.log('');
                    conceptIndex++;
                });
                
                console.log('');
            }
        }

        // Display summary statistics
        if (args.format !== 'compact') {
            console.log('📊 Summary Statistics:');
            console.log(`   Total concepts: ${concepts.length}`);
            console.log(`   Source documents: ${Object.keys(conceptsByDocument).length}`);
            console.log(`   Concepts with embeddings: ${concepts.filter(c => c.hasEmbedding).length}`);
            console.log(`   Concepts with units: ${concepts.filter(c => c.conceptUnit).length}`);
            console.log(`   Concepts in collections: ${concepts.filter(c => c.collectionCorpuscle).length}`);
            console.log(`   Concepts with document titles: ${concepts.filter(c => c.documentTitle).length}`);
            console.log('');
        }

        console.log('✅ Concept listing completed successfully!');
        
    } catch (error) {
        console.error('❌ Error listing concepts:', error.message);
        
        if (logger.getLevel() <= logger.levels.DEBUG) {
            console.error('Stack:', error.stack);
        }
        
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('- Ensure SPARQL endpoint is running and accessible');
        console.log('- Check that the graph URI is correct');
        console.log('- Verify that concepts have been extracted (run ExtractConcepts.js)');
        console.log('- Check network connectivity to SPARQL endpoint');
        
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

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export default main;