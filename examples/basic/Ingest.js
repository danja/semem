#!/usr/bin/env node

/**
 * Basic SPARQL Ingestion Example
 * 
 * This example demonstrates:
 * 1. Reading documents from examples/data directory
 * 2. Storing them in a SPARQL triplestore using UPDATE queries
 * 3. Retrieving and verifying the data using SELECT queries
 * 
 * No complex dependencies - just basic SPARQL operations with document content.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Import minimal required components
import Config from '../../src/Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BasicIngestDemo {
    constructor() {
        this.config = null;
        this.sparqlEndpoint = null;
        this.documents = [];
        this.graphURI = 'http://semem.hyperdata.it/basic-ingest';
    }

    async initialize() {
        console.log(chalk.bold.blue('🔧 Basic SPARQL Ingest Demo'));
        console.log(chalk.gray('   Simple document ingestion and retrieval\n'));

        // Load configuration
        console.log('📋 Loading configuration...');
        this.config = new Config();
        await this.config.init();

        // Get SPARQL endpoint configuration
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        this.sparqlEndpoint = sparqlEndpoints[0];
        console.log(`✅ SPARQL endpoint: ${chalk.bold(this.sparqlEndpoint.urlBase)}`);
        console.log(`📊 Dataset: ${chalk.bold(this.sparqlEndpoint.dataset)}`);
        console.log(`🔗 Graph: ${chalk.bold(this.graphURI)}\n`);
    }

    async loadDocuments() {
        console.log('📚 Loading documents from examples/data...');
        
        const dataDir = path.resolve(__dirname, '../data');
        const files = await fs.readdir(dataDir);
        const markdownFiles = files.filter(file => file.endsWith('.md'));

        console.log(`📁 Found ${markdownFiles.length} markdown files`);

        for (const filename of markdownFiles) {
            const filepath = path.join(dataDir, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            
            // Extract title from content (first # heading)
            const titleMatch = content.match(/^# (.+)$/m);
            const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
            
            // Count words (simple whitespace split)
            const wordCount = content.trim().split(/\s+/).length;
            
            const doc = {
                id: filename.replace('.md', ''),
                filename: filename,
                title: title,
                content: content,
                wordCount: wordCount
            };
            
            this.documents.push(doc);
            console.log(`  📄 ${chalk.green(filename)}: "${title}" (${wordCount} words)`);
        }
        
        console.log(`✅ Loaded ${this.documents.length} documents\n`);
    }

    async clearGraph() {
        console.log('🧹 Clearing existing data in graph...');
        
        const clearQuery = `
            DROP GRAPH <${this.graphURI}>
        `;

        try {
            await this.executeSparqlUpdate(clearQuery);
            console.log('✅ Graph cleared\n');
        } catch (error) {
            console.log(chalk.yellow('⚠️  Graph may not have existed (this is normal)\n'));
        }
    }

    async ingestDocuments() {
        console.log('💾 Ingesting documents into SPARQL store...');

        for (const doc of this.documents) {
            console.log(`  📤 Ingesting: ${chalk.bold(doc.title)}`);
            
            // Escape content for SPARQL (basic escaping)
            const escapedContent = doc.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');

            const escapedTitle = doc.title
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');

            // Create SPARQL UPDATE query to insert document
            const insertQuery = `
                PREFIX semem: <http://semem.hyperdata.it/vocab/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                
                INSERT DATA {
                    GRAPH <${this.graphURI}> {
                        <http://semem.hyperdata.it/document/${doc.id}> a semem:Document ;
                            rdfs:label "${escapedTitle}" ;
                            semem:filename "${doc.filename}" ;
                            semem:content "${escapedContent}" ;
                            semem:wordCount ${doc.wordCount} ;
                            semem:ingestionDate "${new Date().toISOString()}"^^xsd:dateTime .
                    }
                }
            `;

            try {
                await this.executeSparqlUpdate(insertQuery);
                console.log(`    ✅ Successfully stored (${doc.wordCount} words)`);
            } catch (error) {
                console.log(`    ❌ Failed to store: ${error.message}`);
            }
        }
        
        console.log(`✅ Document ingestion complete\n`);
    }

    async verifyIngestion() {
        console.log('🔍 Verifying ingestion with SPARQL SELECT queries...');

        // Query 1: Count total documents
        console.log('  📊 Querying document count...');
        const countQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT (COUNT(*) as ?count)
            WHERE {
                GRAPH <${this.graphURI}> {
                    ?doc a semem:Document .
                }
            }
        `;

        const countResult = await this.executeSparqlSelect(countQuery);
        const documentCount = countResult.results?.bindings?.[0]?.count?.value || 0;
        console.log(`    📈 Documents in store: ${chalk.bold(documentCount)}`);

        // Query 2: Get all documents with word counts
        console.log('  📋 Querying document details...');
        const detailsQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?doc ?title ?filename ?wordCount ?ingestionDate
            WHERE {
                GRAPH <${this.graphURI}> {
                    ?doc a semem:Document ;
                         rdfs:label ?title ;
                         semem:filename ?filename ;
                         semem:wordCount ?wordCount ;
                         semem:ingestionDate ?ingestionDate .
                }
            }
            ORDER BY DESC(?wordCount)
        `;

        const detailsResult = await this.executeSparqlSelect(detailsQuery);
        
        if (detailsResult.results?.bindings) {
            console.log('    📄 Retrieved documents:');
            for (const binding of detailsResult.results.bindings) {
                const title = binding.title?.value || 'Unknown';
                const filename = binding.filename?.value || 'Unknown';
                const wordCount = binding.wordCount?.value || 0;
                const date = binding.ingestionDate?.value || 'Unknown';
                
                console.log(`      🔹 ${chalk.green(filename)}: "${title}"`);
                console.log(`        Words: ${chalk.bold(wordCount)}, Stored: ${new Date(date).toLocaleString()}`);
            }
        }

        // Query 3: Word count statistics
        console.log('  📊 Querying word count statistics...');
        const statsQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT 
                (COUNT(*) as ?totalDocs)
                (SUM(?wordCount) as ?totalWords)
                (AVG(?wordCount) as ?avgWords)
                (MIN(?wordCount) as ?minWords)
                (MAX(?wordCount) as ?maxWords)
            WHERE {
                GRAPH <${this.graphURI}> {
                    ?doc a semem:Document ;
                         semem:wordCount ?wordCount .
                }
            }
        `;

        const statsResult = await this.executeSparqlSelect(statsQuery);
        
        if (statsResult.results?.bindings?.[0]) {
            const stats = statsResult.results.bindings[0];
            console.log(`    📈 Statistics:`);
            console.log(`      Total documents: ${chalk.bold(stats.totalDocs?.value || 0)}`);
            console.log(`      Total words: ${chalk.bold(stats.totalWords?.value || 0)}`);
            console.log(`      Average words: ${chalk.bold(Math.round(stats.avgWords?.value || 0))}`);
            console.log(`      Range: ${stats.minWords?.value || 0} - ${stats.maxWords?.value || 0} words`);
        }

        console.log(`✅ Verification complete\n`);
    }

    async executeSparqlUpdate(query) {
        const updateEndpoint = `${this.sparqlEndpoint.urlBase}${this.sparqlEndpoint.update}`;
        
        const response = await fetch(updateEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Authorization': `Basic ${Buffer.from(`${this.sparqlEndpoint.user}:${this.sparqlEndpoint.password}`).toString('base64')}`
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL UPDATE failed: ${response.status} - ${errorText}`);
        }
    }

    async executeSparqlSelect(query) {
        const queryEndpoint = `${this.sparqlEndpoint.urlBase}${this.sparqlEndpoint.query}`;
        
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': `Basic ${Buffer.from(`${this.sparqlEndpoint.user}:${this.sparqlEndpoint.password}`).toString('base64')}`
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async demonstrateContentQuery() {
        console.log('🔍 Demonstrating content-based queries...');

        // Query for documents containing specific terms
        console.log('  🔎 Searching for documents containing "climate"...');
        const contentQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?title ?filename ?wordCount
            WHERE {
                GRAPH <${this.graphURI}> {
                    ?doc a semem:Document ;
                         rdfs:label ?title ;
                         semem:filename ?filename ;
                         semem:content ?content ;
                         semem:wordCount ?wordCount .
                    FILTER(CONTAINS(LCASE(?content), "climate"))
                }
            }
            ORDER BY DESC(?wordCount)
        `;

        const contentResult = await this.executeSparqlSelect(contentQuery);
        
        if (contentResult.results?.bindings) {
            console.log(`    📄 Found ${contentResult.results.bindings.length} documents containing "climate":`);
            for (const binding of contentResult.results.bindings) {
                const title = binding.title?.value || 'Unknown';
                const filename = binding.filename?.value || 'Unknown';
                const wordCount = binding.wordCount?.value || 0;
                console.log(`      🔹 ${chalk.green(filename)}: "${title}" (${wordCount} words)`);
            }
        } else {
            console.log('    📄 No documents found containing "climate"');
        }

        console.log(`✅ Content query demonstration complete\n`);
    }

    async run() {
        try {
            await this.initialize();
            await this.loadDocuments();
            await this.clearGraph();
            await this.ingestDocuments();
            await this.verifyIngestion();
            await this.demonstrateContentQuery();

            console.log(chalk.bold.green('🎉 Basic SPARQL Ingest Demo Complete!'));
            console.log(chalk.gray('   Documents successfully stored and retrieved from SPARQL triplestore'));
            console.log(chalk.gray(`   Graph URI: ${this.graphURI}`));
            
        } catch (error) {
            console.error(chalk.red('❌ Demo failed:'), error.message);
            throw error;
        }
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Starting Basic SPARQL Ingest Demo...\n'));
    
    const demo = new BasicIngestDemo();
    
    demo.run()
        .then(() => {
            console.log(chalk.bold.green('\n✨ Demo completed successfully!'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('\n💥 Demo failed:'), error);
            process.exit(1);
        });
}

export default BasicIngestDemo;