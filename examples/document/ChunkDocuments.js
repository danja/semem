#!/usr/bin/env node

/**
 * Document Chunking Script
 * 
 * Finds ragno:TextElement instances that haven't been processed yet and chunks them
 * using src/services/document/Chunker.js. The chunks are stored with proper OLO 
 * (Ordered Lists Ontology) indexing and references back to the source TextElement.
 * 
 * Usage: node examples/document/ChunkDocuments.js [--limit N] [--graph URI]
 */

import { parseArgs } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import Chunker from '../../src/services/document/Chunker.js';
import { URIMinter } from '../../src/utils/URIMinter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class ChunkDocuments {
    constructor() {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.chunker = null;
    }

    async init() {
        // Config path relative to project root
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('ChunkDocuments requires SPARQL storage configuration');
        }
        
        this.queryService = new SPARQLQueryService();
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        
        this.chunker = new Chunker({
            maxChunkSize: 2000,
            minChunkSize: 100,
            overlapSize: 100,
            strategy: 'semantic',
            baseNamespace: 'http://purl.org/stuff/instance/'
        });
    }

    async listAllTextElements(targetGraph) {
        try {
            const query = await this.queryService.getQuery('list-text-elements', {
                graphURI: targetGraph
            });
            
            const storageConfig = this.config.get('storage.options');
            const response = await fetch(storageConfig.query, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
                },
                body: query
            });
            
            const result = await response.json();
            return result.results?.bindings || [];
        } catch (error) {
            console.error(`Error listing text elements: ${error.message}`);
            return [];
        }
    }

    async findUnprocessedTextElements(targetGraph, limit = 10) {
        try {
            const query = await this.queryService.getQuery('find-unprocessed-text-elements', {
                graphURI: targetGraph,
                limit: limit
            });
            
            const storageConfig = this.config.get('storage.options');
            const response = await fetch(storageConfig.query, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
                },
                body: query
            });
            
            const result = await response.json();
            return result.results?.bindings || [];
        } catch (error) {
            console.error(`Error finding unprocessed text elements: ${error.message}`);
            return [];
        }
    }

    async processTextElement(textElement, targetGraph) {
        const textElementURI = textElement.textElement.value;
        const content = textElement.content.value;
        const sourceUnit = textElement.sourceUnit.value;
        
        console.log(`  📄 Processing TextElement: ${textElementURI}`);
        console.log(`     📏 Content length: ${content.length} characters`);
        
        try {
            // Chunk the content
            const chunkingResult = await this.chunker.chunk(content, {
                title: `TextElement ${textElementURI.split('/').pop()}`,
                sourceUri: textElementURI
            });
            
            console.log(`     ✂️  Created ${chunkingResult.chunks.length} chunks`);
            console.log(`     📊 Average size: ${Math.round(chunkingResult.metadata.chunking.avgChunkSize)} chars`);
            
            // Generate URIs for the OLO structure
            const chunkListURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'chunklist', textElementURI);
            
            // Build chunk triples
            const chunkTriples = [];
            const slotTriples = [];
            
            chunkingResult.chunks.forEach((chunk, index) => {
                const chunkURI = chunk.uri;
                const slotURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'slot', `${textElementURI}-${index}`);
                
                // Chunk as ragno:SemanticUnit
                chunkTriples.push(`
    <${chunkURI}> a ragno:SemanticUnit ;
                  ragno:hasContent """${chunk.content.replace(/"/g, '\\"')}""" ;
                  ragno:size ${chunk.size} ;
                  ragno:index ${chunk.index} ;
                  prov:wasDerivedFrom <${textElementURI}> ;
                  dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .`);
                
                // OLO slot structure
                slotTriples.push(`
    <${slotURI}> a olo:Slot ;
                 olo:index ${index + 1} ;
                 olo:item <${chunkURI}> ;
                 olo:ordered_list <${chunkListURI}> .
    
    <${chunkListURI}> olo:slot <${slotURI}> .`);
                
                // Add next/previous relationships for slots
                if (index > 0) {
                    const prevSlotURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'slot', `${textElementURI}-${index-1}`);
                    slotTriples.push(`
    <${slotURI}> olo:previous <${prevSlotURI}> .
    <${prevSlotURI}> olo:next <${slotURI}> .`);
                }
            });
            
            // Create the SPARQL update query
            const updateQuery = await this.queryService.getQuery('store-chunks-with-olo', {
                graphURI: targetGraph,
                textElementURI: textElementURI,
                chunkListURI: chunkListURI,
                chunkCount: chunkingResult.chunks.length,
                textElementTitle: textElementURI.split('/').pop(),
                chunkTriples: chunkTriples.join('\n'),
                slotTriples: slotTriples.join('\n')
            });
            
            // Execute the update
            await this.sparqlHelper.executeUpdate(updateQuery);
            
            console.log(`     ✅ Stored ${chunkingResult.chunks.length} chunks with OLO indexing`);
            
            return {
                textElementURI,
                chunkCount: chunkingResult.chunks.length,
                chunkListURI,
                avgChunkSize: chunkingResult.metadata.chunking.avgChunkSize
            };
            
        } catch (error) {
            console.error(`     ❌ Error processing ${textElementURI}: ${error.message}`);
            throw error;
        }
    }

    async run(options) {
        const { limit, graph } = options;
        
        const targetGraph = graph || this.config.get('storage.options.graphName') || 
                            this.config.get('graphName') || 
                            'http://purl.org/stuff/semem/documents';
        
        console.log(`🔍 Finding unprocessed TextElements in graph: ${targetGraph}`);
        console.log(`📏 Limit: ${limit}`);
        
        
        const unprocessedElements = await this.findUnprocessedTextElements(targetGraph, limit);
        console.log(`📋 Found ${unprocessedElements.length} unprocessed TextElements`);
        
        if (unprocessedElements.length === 0) {
            console.log('✅ No TextElements need processing.');
            return [];
        }
        
        const results = [];
        let processed = 0;
        let failed = 0;
        
        for (const textElement of unprocessedElements) {
            try {
                const result = await this.processTextElement(textElement, targetGraph);
                results.push(result);
                processed++;
            } catch (error) {
                console.error(`Failed to process TextElement: ${error.message}`);
                failed++;
            }
        }
        
        console.log(`\n📊 Processing Summary:`);
        console.log(`   ✅ Successfully processed: ${processed} TextElements`);
        console.log(`   ❌ Failed: ${failed} TextElements`);
        console.log(`   📈 Total chunks created: ${results.reduce((sum, r) => sum + r.chunkCount, 0)}`);
        console.log(`   🎯 Graph: ${targetGraph}`);
        
        return results;
    }

    async cleanup() {
        // Close any open connections
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
    }
}

async function main() {
    const { values: args } = parseArgs({
        options: {
            limit: {
                type: 'string',
                default: '10'
            },
            graph: {
                type: 'string'
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help) {
        console.log(`
ChunkDocuments.js - Process ragno:TextElement instances that haven't been chunked yet

Usage: node examples/document/ChunkDocuments.js [options]

Options:
  --limit <number>   Maximum number of TextElements to process (default: 10)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Description:
  This script finds ragno:TextElement instances that don't have the semem:hasChunks flag,
  processes them using the document Chunker service, and stores the resulting chunks
  with proper OLO (Ordered Lists Ontology) indexing. Each chunk is stored as a 
  ragno:SemanticUnit with references back to the source TextElement.

Examples:
  node examples/document/ChunkDocuments.js                                    # Process up to 10 TextElements
  node examples/document/ChunkDocuments.js --limit 5                         # Process up to 5 TextElements  
  node examples/document/ChunkDocuments.js --graph "http://example.org/docs" # Use specific graph
        `);
        return;
    }

    const chunker = new ChunkDocuments();
    
    try {
        await chunker.init();
        
        const options = {
            limit: parseInt(args.limit) || 10,
            graph: args.graph
        };
        
        await chunker.run(options);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await chunker.cleanup();
        
        // Force exit after a short delay to ensure cleanup completes
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

export default ChunkDocuments;