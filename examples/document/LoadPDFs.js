import { parseArgs } from 'util';
import globPkg from 'glob';
const { glob } = globPkg;
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import PDFConverter from '../../src/services/document/PDFConverter.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class LoadPDFs {
    constructor() {
        this.config = null;
        this.sparqlHelper = null;
        this.queryService = null;
    }

    async init() {
        // Config path relative to project root
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();
        
        // Use the configured storage options directly
        const storageConfig = this.config.get('storage');
        
        if (storageConfig.type !== 'sparql') {
            throw new Error('LoadPDFs requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        this.queryService = new SPARQLQueryService();
    }

    async listStoredDocuments(targetGraph) {
        try {
            const query = await this.queryService.getQuery('list-documents', {
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
            console.warn(`Warning: Could not list documents: ${error.message}`);
            return [];
        }
    }

    async checkDocumentExists(filePath, targetGraph) {
        try {
            const query = await this.queryService.getQuery('check-document-exists', {
                graphURI: targetGraph,
                sourceFile: filePath
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
            return result.boolean === true;
        } catch (error) {
            console.warn(`Warning: Could not check if document exists: ${error.message}`);
            return false; // Assume it doesn't exist if we can't check
        }
    }

    async processPDF(filePath, cacheDir, targetGraph) {
        const filename = basename(filePath, extname(filePath));
        const cacheFile = join(cacheDir, `${filename}.md`);
        
        console.log(`Processing ${filePath}...`);
        
        // Check if document already exists in SPARQL store
        console.log(`  🔍 Checking if document already exists...`);
        const exists = await this.checkDocumentExists(filePath, targetGraph);
        if (exists) {
            console.log(`  ⏭️  Document already exists in SPARQL store, skipping: ${filePath}`);
            return { unitURI: null, textURI: null, metadata: { skipped: true, reason: 'already exists' } };
        }
        console.log(`  ✅ Document not found in store, proceeding with processing...`);
        
        let markdown, metadata;
        
        if (existsSync(cacheFile)) {
            console.log(`  Loading from cache: ${cacheFile}`);
            markdown = readFileSync(cacheFile, 'utf8');
            metadata = {
                title: filename,
                sourceFile: filePath,
                cached: true
            };
        } else {
            console.log(`  Converting PDF to markdown...`);
            const conversionResult = await PDFConverter.convert(filePath, {
                metadata: { title: filename, sourceFile: filePath }
            });
            
            markdown = conversionResult.markdown;
            metadata = conversionResult.metadata;
            
            writeFileSync(cacheFile, markdown);
            console.log(`  Cached markdown to: ${cacheFile}`);
        }
        
        const unitURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'unit', filePath);
        const textURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'text', markdown);
        
        const now = new Date().toISOString();
        
        const unitData = {
            id: unitURI,
            content: markdown,
            metadata: {
                type: 'ragno:Unit',
                label: metadata.title || filename,
                created: now,
                sourceFile: filePath,
                hasTextElement: textURI,
                graph: targetGraph
            }
        };
        
        const textData = {
            id: textURI,
            content: markdown,
            metadata: {
                type: 'ragno:TextElement',
                label: `${metadata.title || filename} markdown`,
                created: now,
                size: markdown.length,
                wasDerivedFrom: unitURI,
                graph: targetGraph
            }
        };
        
        // Store basic document data without embeddings or concept extraction
        
        console.log(`  Storing to SPARQL graph: ${targetGraph}`);
        
        // Create SPARQL update query to store Unit and TextElement
        const updateQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX semem: <http://semem.hyperdata.it/>

            INSERT DATA {
                GRAPH <${targetGraph}> {
                    # Store ragno:Unit
                    <${unitURI}> a ragno:Unit ;
                        rdfs:label """${unitData.metadata.label.replace(/"/g, '\\"')}""" ;
                        dcterms:created "${unitData.metadata.created}"^^xsd:dateTime ;
                        semem:sourceFile "${unitData.metadata.sourceFile}" ;
                        ragno:hasTextElement <${textURI}> .
                    
                    # Store ragno:TextElement
                    <${textURI}> a ragno:TextElement ;
                        rdfs:label """${textData.metadata.label.replace(/"/g, '\\"')}""" ;
                        dcterms:created "${textData.metadata.created}"^^xsd:dateTime ;
                        ragno:content """${markdown.replace(/"/g, '\\"')}""" ;
                        dcterms:extent ${textData.metadata.size} ;
                        prov:wasDerivedFrom <${unitURI}> .
                }
            }
        `;
        
        await this.sparqlHelper.executeUpdate(updateQuery);
        console.log(`  ✓ Processed ${filePath}`);
        return { unitURI, textURI, metadata };
    }

    async run(options) {
        const { docs, cache, limit, graph } = options;
        
        const docPattern = docs;
        const cacheDir = cache;
        const targetGraph = graph || this.config.get('storage.options.graphName') || 
                            this.config.get('graphName') || 
                            'http://purl.org/stuff/semem/documents';
        
        
        if (!existsSync(cacheDir)) {
            mkdirSync(cacheDir, { recursive: true });
            console.log(`Created cache directory: ${cacheDir}`);
        }
        
        console.log(`Searching for files with pattern: ${docPattern}`);
        const files = await new Promise((resolve, reject) => {
            glob(docPattern, (err, matches) => {
                if (err) reject(err);
                else resolve(matches);
            });
        });
        console.log(`Found ${files.length} PDF files matching pattern: ${docPattern}`);
        
        if (files.length === 0) {
            console.log('No files found to process.');
            return;
        }
        
        const filesToProcess = limit > 0 ? files.slice(0, limit) : files;
        console.log(`Processing ${filesToProcess.length} files...`);
        
        const results = [];
        
        for (const file of filesToProcess) {
            try {
                const result = await this.processPDF(file, cacheDir, targetGraph);
                results.push(result);
            } catch (error) {
                console.error(`Error processing ${file}: ${error.message}`);
                console.error(error.stack);
            }
        }
        
        const successfulResults = results.filter(r => !r.metadata?.skipped);
        const skippedResults = results.filter(r => r.metadata?.skipped);
        
        console.log(`\nProcessed ${successfulResults.length} files successfully.`);
        if (skippedResults.length > 0) {
            console.log(`Skipped ${skippedResults.length} files (already exist in SPARQL store).`);
        }
        console.log(`Graph: ${targetGraph}`);
        console.log(`Cache directory: ${cacheDir}`);
        
        return results;
    }

    async cleanup() {
        // Close any open connections
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        
        // Clear any timers or intervals
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
    }
}

async function main() {
    const { values: args } = parseArgs({
        options: {
            docs: {
                type: 'string',
                default: 'data/pdfs/*.pdf'
            },
            cache: {
                type: 'string', 
                default: 'data/cache'
            },
            limit: {
                type: 'string',
                default: '0'
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
LoadPDFs.js - Load PDF files, convert to markdown, and store in SPARQL

Usage: node examples/document/LoadPDFs.js [options]

Options:
  --docs <pattern>   Source pattern for documents (default: data/pdfs/*.pdf)
  --cache <dir>      Cache directory for markdown files (default: data/cache)
  --limit <number>   Limit number of documents to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Examples:
  node examples/document/LoadPDFs.js
  node examples/document/LoadPDFs.js --docs "data/pdfs/*.pdf" --limit 5
  node examples/document/LoadPDFs.js --graph "http://example.org/my-docs"
        `);
        return;
    }

    const loader = new LoadPDFs();
    
    try {
        await loader.init();
        
        const options = {
            docs: args.docs,
            cache: args.cache,
            limit: parseInt(args.limit),
            graph: args.graph
        };
        
        await loader.run(options);
    } finally {
        // Always cleanup, even if there was an error
        await loader.cleanup();
        
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

export default LoadPDFs;