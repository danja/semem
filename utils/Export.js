/**
 * SPARQL Export Utility
 * 
 * Exports all data from the Semem SPARQL store using CONSTRUCT queries
 * and saves it as a Turtle (.ttl) file with graph information preserved.
 * 
 * Usage:
 *   node utils/Export.js [--output path] [--endpoint url] [--graph uri]
 * 
 * Options:
 *   --output    Output file path (default: data/export.ttl)
 *   --endpoint  SPARQL endpoint URL (default: from config)
 *   --graph     Specific graph to export (default: exports all graphs)
 *   --format    Output format: ttl, nt, rdf (default: ttl)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Config from '../src/Config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class SPARQLExporter {
    constructor(options = {}) {
        this.options = {
            outputPath: options.output || 'data/export.ttl',
            endpoint: options.endpoint,
            graph: options.graph,
            format: options.format || 'ttl',
            ...options
        };
        this.config = null;
    }

    async initialize() {
        console.log('🚀 [INIT] Initializing SPARQL Export utility...');
        
        // Initialize config
        this.config = new Config();
        await this.config.init();
        
        // Use config endpoint if not provided
        if (!this.options.endpoint) {
            const storageOptions = this.config.get('storage.options');
            this.options.endpoint = storageOptions.query;
        }
        
        console.log('✅ [CONFIG] Configuration loaded');
        console.log('📡 [ENDPOINT]', this.options.endpoint);
        console.log('📁 [OUTPUT]', this.options.outputPath);
        
        if (this.options.graph) {
            console.log('📊 [GRAPH]', this.options.graph);
        } else {
            console.log('📊 [SCOPE] Exporting all graphs');
        }
    }

    /**
     * Generate CONSTRUCT query to export all data with graph information
     */
    generateExportQuery() {
        if (this.options.graph) {
            // Export specific graph
            return `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                PREFIX dcterms: <http://purl.org/dc/terms/>
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

                CONSTRUCT {
                    ?s ?p ?o .
                }
                WHERE {
                    GRAPH <${this.options.graph}> {
                        ?s ?p ?o .
                    }
                }
            `;
        } else {
            // Export all data with named graphs preserved
            return `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                PREFIX dcterms: <http://purl.org/dc/terms/>
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

                CONSTRUCT {
                    ?g a <http://www.w3.org/2004/03/trix/rdfg-1/Graph> .
                    ?s ?p ?o .
                    ?s <http://www.w3.org/2004/03/trix/rdfg-1/graphName> ?g .
                }
                WHERE {
                    GRAPH ?g {
                        ?s ?p ?o .
                    }
                    FILTER(?g != <http://jena.apache.org/2011/TDB#>)
                }
            `;
        }
    }

    /**
     * Execute SPARQL CONSTRUCT query
     */
    async executeSparqlConstruct(query) {
        console.log('🔍 [QUERY] Executing CONSTRUCT query...');
        console.log('📝 [SPARQL]', query.trim().substring(0, 200) + '...');

        const response = await fetch(this.options.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': this.getMimeType()
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL CONSTRUCT failed: ${response.status} - ${errorText}`);
        }

        const data = await response.text();
        console.log('✅ [QUERY] CONSTRUCT query completed');
        console.log('📊 [SIZE]', `${data.length} characters`);
        
        return data;
    }

    /**
     * Get MIME type for output format
     */
    getMimeType() {
        const mimeTypes = {
            'ttl': 'text/turtle',
            'nt': 'application/n-triples',
            'rdf': 'application/rdf+xml'
        };
        return mimeTypes[this.options.format] || 'text/turtle';
    }

    /**
     * Get statistics about the exported data
     */
    getDataStatistics(data) {
        const lines = data.split('\n');
        const triples = lines.filter(line => 
            line.trim() && 
            !line.trim().startsWith('@') && 
            !line.trim().startsWith('#') &&
            line.includes(' ')
        ).length;

        // Count different types of entities
        const interactions = (data.match(/semem:Interaction/g) || []).length;
        const concepts = (data.match(/ragno:Concept/g) || []).length;
        const units = (data.match(/ragno:Unit/g) || []).length;
        const embeddings = (data.match(/semem:embedding/g) || []).length;

        return {
            totalLines: lines.length,
            estimatedTriples: triples,
            interactions,
            concepts,
            units,
            embeddings
        };
    }

    /**
     * Save data to file with statistics
     */
    saveToFile(data, outputPath) {
        console.log('💾 [SAVE] Saving export to file...');

        // Ensure output directory exists
        const outputDir = dirname(outputPath);
        mkdirSync(outputDir, { recursive: true });

        // Add export metadata as comments
        const timestamp = new Date().toISOString();
        const stats = this.getDataStatistics(data);
        
        const header = `# SPARQL Export from Semem
# Generated: ${timestamp}
# Endpoint: ${this.options.endpoint}
# Format: ${this.options.format}
# Graph: ${this.options.graph || 'ALL'}
# 
# Statistics:
# - Total lines: ${stats.totalLines}
# - Estimated triples: ${stats.estimatedTriples}
# - Interactions: ${stats.interactions}
# - Concepts: ${stats.concepts}
# - Units: ${stats.units}
# - Embeddings: ${stats.embeddings}
#

`;

        const fullContent = header + data;
        
        // Write to file
        writeFileSync(outputPath, fullContent, 'utf8');
        
        console.log('✅ [SAVED] Export completed successfully');
        console.log('📁 [FILE]', outputPath);
        console.log('📊 [STATS]', JSON.stringify(stats, null, 2));
        
        return stats;
    }

    /**
     * Run the complete export process
     */
    async run() {
        try {
            console.log('🎯 [START] Starting SPARQL export process...');
            
            await this.initialize();
            
            const query = this.generateExportQuery();
            const data = await this.executeSparqlConstruct(query);
            const stats = this.saveToFile(data, this.options.outputPath);
            
            console.log('🎉 [SUCCESS] Export completed successfully!');
            console.log(`📈 [SUMMARY] Exported ${stats.estimatedTriples} triples to ${this.options.outputPath}`);
            
            return { success: true, stats, outputPath: this.options.outputPath };
            
        } catch (error) {
            console.error('❌ [ERROR] Export failed:', error.message);
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
            case '--output':
                options.output = value;
                break;
            case '--endpoint':
                options.endpoint = value;
                break;
            case '--graph':
                options.graph = value;
                break;
            case '--format':
                options.format = value;
                break;
            case '--help':
                console.log(`
SPARQL Export Utility

Usage: node utils/Export.js [options]

Options:
  --output    Output file path (default: data/export.ttl)
  --endpoint  SPARQL endpoint URL (default: from config)
  --graph     Specific graph URI to export (default: all graphs)
  --format    Output format: ttl, nt, rdf (default: ttl)
  --help      Show this help message

Examples:
  node utils/Export.js
  node utils/Export.js --output backup.ttl --format ttl
  node utils/Export.js --graph "http://hyperdata.it/content"
  node utils/Export.js --endpoint "http://localhost:3030/dataset/sparql"
                `);
                process.exit(0);
                break;
        }
    }
    
    const exporter = new SPARQLExporter(options);
    const result = await exporter.run();
    
    process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default SPARQLExporter;