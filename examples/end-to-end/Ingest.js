#!/usr/bin/env node

/**
 * End-to-End Module 1: SPARQL Store Initialization and Document Ingestion
 * 
 * Based on: examples/basic/Ingest.js
 * 
 * This module:
 * - Reads documents from examples/data directory
 * - Stores them in SPARQL triplestore with metadata
 * - Verifies successful ingestion
 * - Provides results for next workflow step
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import Config from '../../src/Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class IngestModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlEndpoint = null;
        this.documents = [];
        this.results = {
            documentsProcessed: 0,
            totalWords: 0,
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            success: false,
            error: null
        };
    }

    async initialize() {
        console.log(chalk.bold.blue('📋 Module 1: SPARQL Document Ingestion'));
        console.log(chalk.gray('   Reading and storing documents in triplestore\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        // Get SPARQL endpoint configuration
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        this.sparqlEndpoint = sparqlEndpoints[0];
        console.log(`✅ SPARQL endpoint: ${chalk.bold(this.sparqlEndpoint.urlBase)}`);
        console.log(`📊 Graph URI: ${chalk.bold(this.results.graphURI)}\n`);
    }

    async execute() {
        try {
            await this.loadDocuments();
            await this.clearGraph();
            await this.ingestDocuments();
            await this.verifyIngestion();
            
            this.results.success = true;
            console.log(chalk.bold.green('✅ Module 1 Complete: Documents successfully ingested\n'));
            
        } catch (error) {
            this.results.error = error.message;
            this.results.success = false;
            console.log(chalk.red(`❌ Module 1 Failed: ${error.message}\n`));
            throw error;
        }
    }

    async loadDocuments() {
        console.log('📚 Loading documents from examples/data...');
        
        const dataDir = path.resolve(__dirname, '../data');
        const files = await fs.readdir(dataDir);
        const markdownFiles = files.filter(file => file.endsWith('.md'));

        for (const filename of markdownFiles) {
            const filepath = path.join(dataDir, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            
            // Extract title from content
            const titleMatch = content.match(/^# (.+)$/m);
            const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
            
            // Count words
            const wordCount = content.trim().split(/\s+/).length;
            
            const doc = {
                id: filename.replace('.md', ''),
                filename: filename,
                title: title,
                content: content,
                wordCount: wordCount
            };
            
            this.documents.push(doc);
            this.results.totalWords += wordCount;
            console.log(`  📄 ${chalk.green(filename)}: "${title}" (${wordCount} words)`);
        }
        
        this.results.documentsProcessed = this.documents.length;
        console.log(`✅ Loaded ${this.documents.length} documents (${this.results.totalWords} total words)\n`);
    }

    async clearGraph() {
        console.log('🧹 Clearing existing data...');
        
        const clearQuery = `DROP GRAPH <${this.results.graphURI}>`;

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
            console.log(`  📤 Storing: ${chalk.bold(doc.title)}`);
            
            // Escape content for SPARQL
            const escapedContent = this.escapeForSparql(doc.content);
            const escapedTitle = this.escapeForSparql(doc.title);

            const insertQuery = `
                PREFIX semem: <http://semem.hyperdata.it/vocab/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                
                INSERT DATA {
                    GRAPH <${this.results.graphURI}> {
                        <http://semem.hyperdata.it/document/${doc.id}> a semem:Document ;
                            rdfs:label "${escapedTitle}" ;
                            semem:filename "${doc.filename}" ;
                            semem:content "${escapedContent}" ;
                            semem:wordCount ${doc.wordCount} ;
                            semem:ingestionDate "${new Date().toISOString()}"^^xsd:dateTime ;
                            semem:status "ingested" .
                    }
                }
            `;

            await this.executeSparqlUpdate(insertQuery);
            console.log(`    ✅ Stored (${doc.wordCount} words)`);
        }
        
        console.log(`✅ All documents ingested\n`);
    }

    async verifyIngestion() {
        console.log('🔍 Verifying ingestion...');

        const verifyQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT (COUNT(*) as ?count) (SUM(?wordCount) as ?totalWords)
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?doc a semem:Document ;
                         semem:wordCount ?wordCount ;
                         semem:status "ingested" .
                }
            }
        `;

        const result = await this.executeSparqlSelect(verifyQuery);
        const binding = result.results?.bindings?.[0];
        
        if (binding) {
            const storedCount = parseInt(binding.count?.value || 0);
            const storedWords = parseInt(binding.totalWords?.value || 0);
            
            console.log(`  📊 Verified: ${chalk.bold(storedCount)} documents, ${chalk.bold(storedWords)} words`);
            
            if (storedCount === this.documents.length && storedWords === this.results.totalWords) {
                console.log(`  ✅ Verification successful\n`);
            } else {
                throw new Error(`Verification failed: expected ${this.documents.length} docs with ${this.results.totalWords} words, got ${storedCount} docs with ${storedWords} words`);
            }
        } else {
            throw new Error('Verification query returned no results');
        }
    }

    escapeForSparql(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
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

    async cleanup() {
        // No specific cleanup needed for this module
        console.log('🧹 Module 1 cleanup complete');
    }

    getResults() {
        return {
            ...this.results,
            documents: this.documents.map(doc => ({
                id: doc.id,
                title: doc.title,
                filename: doc.filename,
                wordCount: doc.wordCount
            }))
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Ingest Module Standalone...\n'));
    
    const module = new IngestModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Ingest module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Ingest module failed:'), error);
            process.exit(1);
        });
}