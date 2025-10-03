/**
 * SPARQL Import Utility
 * 
 * Imports RDF data from Turtle (.ttl) files into a SPARQL store,
 * preserving graph structure and handling large datasets efficiently.
 * 
 * Usage:
 *   node utils/Import.js [--input path] [--endpoint url] [--graph uri] [--clear]
 * 
 * Options:
 *   --input     Input file path (default: data/export.ttl)
 *   --endpoint  SPARQL update endpoint URL (default: from config)
 *   --graph     Target graph URI (default: detect from data)
 *   --clear     Clear target graph before import
 *   --batch     Batch size for chunked imports (default: 1000)
 *   --validate  Validate data before import
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Config from '../src/Config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class SPARQLImporter {
    constructor(options = {}) {
        this.options = {
            inputPath: options.input || 'data/export.ttl',
            endpoint: options.endpoint,
            graph: options.graph,
            clear: options.clear || false,
            batchSize: parseInt(options.batch) || 1000,
            validate: options.validate || false,
            ...options
        };
        this.config = null;
        this.stats = {
            triplesProcessed: 0,
            batchesProcessed: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
    }

    async initialize() {
        console.log('🚀 [INIT] Initializing SPARQL Import utility...');
        
        // Initialize config
        this.config = new Config();
        await this.config.init();
        
        // Use config endpoint if not provided
        if (!this.options.endpoint) {
            const storageOptions = this.config.get('storage.options');
            this.options.endpoint = storageOptions.update;
        }
        
        console.log('✅ [CONFIG] Configuration loaded');
        console.log('📡 [ENDPOINT]', this.options.endpoint);
        console.log('📁 [INPUT]', this.options.inputPath);
        
        if (this.options.graph) {
            console.log('📊 [GRAPH]', this.options.graph);
        } else {
            console.log('📊 [GRAPH] Auto-detect from data');
        }
        
        // Validate input file exists
        if (!existsSync(this.options.inputPath)) {
            throw new Error(`Input file not found: ${this.options.inputPath}`);
        }
        
        this.stats.startTime = Date.now();
    }

    /**
     * Read and parse the input file
     */
    readInputFile() {
        console.log('📖 [READ] Reading input file...');
        
        const content = readFileSync(this.options.inputPath, 'utf8');
        const lines = content.split('\n');
        
        console.log('✅ [READ] File loaded');
        console.log('📊 [SIZE]', `${content.length} characters, ${lines.length} lines`);
        
        return { content, lines };
    }

    /**
     * Extract metadata and statistics from file header
     */
    extractFileMetadata(lines) {
        const metadata = {
            generated: null,
            sourceEndpoint: null,
            format: null,
            sourceGraph: null,
            stats: {}
        };
        
        for (const line of lines.slice(0, 20)) { // Check first 20 lines
            if (line.startsWith('# Generated:')) {
                metadata.generated = line.replace('# Generated:', '').trim();
            } else if (line.startsWith('# Endpoint:')) {
                metadata.sourceEndpoint = line.replace('# Endpoint:', '').trim();
            } else if (line.startsWith('# Format:')) {
                metadata.format = line.replace('# Format:', '').trim();
            } else if (line.startsWith('# Graph:')) {
                metadata.sourceGraph = line.replace('# Graph:', '').trim();
            } else if (line.includes('- ')) {
                // Parse statistics
                const match = line.match(/# - ([^:]+): (.+)/);
                if (match) {
                    metadata.stats[match[1].trim()] = match[2].trim();
                }
            }
        }
        
        console.log('📋 [METADATA] File metadata:', metadata);
        return metadata;
    }

    /**
     * Parse TTL content into triples, handling graphs
     */
    parseTriples(content) {
        console.log('🔍 [PARSE] Parsing RDF triples...');
        
        const triples = [];
        const lines = content.split('\n');
        let currentGraph = this.options.graph;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Skip prefix declarations (we'll add them back)
            if (trimmed.startsWith('@prefix') || trimmed.startsWith('PREFIX')) continue;
            
            // Extract graph information if available
            if (trimmed.includes('graphName')) {
                const match = trimmed.match(/<([^>]+)>\s+<[^>]*graphName>\s+<([^>]+)>/);
                if (match) {
                    currentGraph = match[2];
                }
            }
            
            // Parse triple lines
            if (trimmed.includes(' ') && !trimmed.startsWith('@') && trimmed.endsWith('.')) {
                triples.push({
                    triple: trimmed,
                    graph: currentGraph
                });
            }
        }
        
        console.log('✅ [PARSE] Parsed triples');
        console.log('📊 [COUNT]', `${triples.length} triples found`);
        
        return triples;
    }

    /**
     * Clear target graph if requested
     */
    async clearGraph(graphUri) {
        console.log('🗑️ [CLEAR] Clearing target graph...');
        
        const clearQuery = `CLEAR GRAPH <${graphUri}>`;
        
        const response = await fetch(this.options.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
            },
            body: clearQuery
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Clear graph failed: ${response.status} - ${errorText}`);
        }

        console.log('✅ [CLEAR] Graph cleared successfully');
    }

    /**
     * Create SPARQL INSERT query for a batch of triples
     */
    createInsertQuery(triples, targetGraph) {
        const prefixes = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        `;
        
        const triplesText = triples
            .filter(t => !t.triple.includes('graphName')) // Skip graph metadata
            .map(t => '    ' + t.triple)
            .join('\n');
            
        return `${prefixes}
            INSERT DATA {
                GRAPH <${targetGraph}> {
${triplesText}
                }
            }`;
    }

    /**
     * Execute SPARQL UPDATE query
     */
    async executeSparqlUpdate(query) {
        const response = await fetch(this.options.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL UPDATE failed: ${response.status} - ${errorText}`);
        }
    }

    /**
     * Import triples in batches
     */
    async importTriples(triples) {
        console.log('📥 [IMPORT] Starting batch import...');
        console.log('📊 [BATCHES]', `Processing ${triples.length} triples in batches of ${this.options.batchSize}`);

        // Determine target graph
        const targetGraph = this.options.graph ||
                           (triples.find(t => t.graph)?.graph) ||
                           this.config.get('graphName') ||
                           this.config.get('storage.options.graphName');

        if (!targetGraph) {
            throw new Error('Graph name not found. Please provide --graph or set graphName in config.json');
        }

        console.log('🎯 [TARGET]', targetGraph);
        
        // Clear graph if requested
        if (this.options.clear) {
            await this.clearGraph(targetGraph);
        }
        
        // Process in batches
        for (let i = 0; i < triples.length; i += this.options.batchSize) {
            const batch = triples.slice(i, i + this.options.batchSize);
            const batchNum = Math.floor(i / this.options.batchSize) + 1;
            const totalBatches = Math.ceil(triples.length / this.options.batchSize);
            
            console.log(`⚡ [BATCH ${batchNum}/${totalBatches}] Processing ${batch.length} triples...`);
            
            try {
                const query = this.createInsertQuery(batch, targetGraph);
                await this.executeSparqlUpdate(query);
                
                this.stats.triplesProcessed += batch.length;
                this.stats.batchesProcessed++;
                
                console.log(`✅ [BATCH ${batchNum}] Completed successfully`);
                
                // Small delay to avoid overwhelming the server
                if (batchNum < totalBatches) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (error) {
                console.error(`❌ [BATCH ${batchNum}] Failed:`, error.message);
                this.stats.errors++;
                
                // Continue with next batch unless too many errors
                if (this.stats.errors > 5) {
                    throw new Error('Too many batch errors, stopping import');
                }
            }
        }
        
        console.log('✅ [IMPORT] Batch import completed');
    }

    /**
     * Validate imported data
     */
    async validateImport() {
        console.log('🔍 [VALIDATE] Validating imported data...');
        
        const countQuery = `
            SELECT (COUNT(*) as ?count) 
            WHERE {
                GRAPH ?g { ?s ?p ?o }
            }
        `;
        
        const queryEndpoint = this.options.endpoint.replace('/update', '/sparql');
        
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json'
            },
            body: countQuery
        });

        if (response.ok) {
            const result = await response.json();
            const count = parseInt(result.results.bindings[0].count.value);
            console.log('✅ [VALIDATE] Total triples in store:', count);
            return count;
        } else {
            console.warn('⚠️ [VALIDATE] Could not validate - query endpoint may not be available');
            return null;
        }
    }

    /**
     * Run the complete import process
     */
    async run() {
        try {
            console.log('🎯 [START] Starting SPARQL import process...');
            
            await this.initialize();
            
            const { content, lines } = this.readInputFile();
            const metadata = this.extractFileMetadata(lines);
            const triples = this.parseTriples(content);
            
            await this.importTriples(triples);
            
            if (this.options.validate) {
                await this.validateImport();
            }
            
            this.stats.endTime = Date.now();
            const duration = (this.stats.endTime - this.stats.startTime) / 1000;
            
            console.log('🎉 [SUCCESS] Import completed successfully!');
            console.log('📈 [SUMMARY] Import statistics:');
            console.log(`  - Triples processed: ${this.stats.triplesProcessed}`);
            console.log(`  - Batches processed: ${this.stats.batchesProcessed}`);
            console.log(`  - Errors: ${this.stats.errors}`);
            console.log(`  - Duration: ${duration.toFixed(2)}s`);
            console.log(`  - Rate: ${(this.stats.triplesProcessed / duration).toFixed(2)} triples/sec`);
            
            return { 
                success: true, 
                stats: this.stats,
                metadata,
                duration
            };
            
        } catch (error) {
            console.error('❌ [ERROR] Import failed:', error.message);
            console.error(error.stack);
            return { success: false, error: error.message };
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--input':
                options.input = value;
                break;
            case '--endpoint':
                options.endpoint = value;
                break;
            case '--graph':
                options.graph = value;
                break;
            case '--batch':
                options.batch = value;
                break;
            case '--clear':
                options.clear = true;
                i--; // No value for this flag
                break;
            case '--validate':
                options.validate = true;
                i--; // No value for this flag
                break;
            case '--help':
                console.log(`
SPARQL Import Utility

Usage: node utils/Import.js [options]

Options:
  --input     Input file path (default: data/export.ttl)
  --endpoint  SPARQL update endpoint URL (default: from config)
  --graph     Target graph URI (default: detect from data)
  --clear     Clear target graph before import
  --batch     Batch size for imports (default: 1000)
  --validate  Validate data after import
  --help      Show this help message

Examples:
  node utils/Import.js
  node utils/Import.js --input backup.ttl --clear
  node utils/Import.js --graph "YOUR_GRAPH_URI" --batch 500
  node utils/Import.js --endpoint "http://localhost:3030/dataset/update" --validate
                `);
                process.exit(0);
                break;
        }
    }
    
    const importer = new SPARQLImporter(options);
    const result = await importer.run();
    
    process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default SPARQLImporter;