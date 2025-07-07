import { parseArgs } from 'util';
import globPkg from 'glob';
const { glob } = globPkg;
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import PDFConverter from '../../src/services/document/PDFConverter.js';
import { URIMinter } from '../../src/utils/URIMinter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class LoadPDFs {
    constructor() {
        this.config = null;
        this.store = null;
    }

    async init() {
        this.config = new Config(join(__dirname, '../../config/config.json'));
        await this.config.init();
        
        // Use the configured storage options directly
        const storageConfig = this.config.get('storage');
        
        if (storageConfig.type !== 'sparql') {
            throw new Error('LoadPDFs requires SPARQL storage configuration');
        }
        
        this.store = new SPARQLStore(storageConfig.options);
    }

    async processPDF(filePath, cacheDir, targetGraph) {
        const filename = basename(filePath, extname(filePath));
        const cacheFile = join(cacheDir, `${filename}.md`);
        
        console.log(`Processing ${filePath}...`);
        
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
        await this.store.store(unitData);
        await this.store.store(textData);
        
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
        
        console.log(`\nProcessed ${results.length} files successfully.`);
        console.log(`Graph: ${targetGraph}`);
        console.log(`Cache directory: ${cacheDir}`);
        
        return results;
    }
}

async function main() {
    const { values: args } = parseArgs({
        options: {
            docs: {
                type: 'string',
                default: '../../data/pdfs/*.pdf'
            },
            cache: {
                type: 'string', 
                default: '../../data/cache'
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

Usage: node LoadPDFs.js [options]

Options:
  --docs <pattern>   Source pattern for documents (default: ../../data/pdfs/*.pdf)
  --cache <dir>      Cache directory for markdown files (default: ../../data/cache)
  --limit <number>   Limit number of documents to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Examples:
  node LoadPDFs.js
  node LoadPDFs.js --docs "../pdfs/*.pdf" --limit 5
  node LoadPDFs.js --graph "http://example.org/my-docs"
        `);
        return;
    }

    const loader = new LoadPDFs();
    await loader.init();
    
    const options = {
        docs: args.docs,
        cache: args.cache,
        limit: parseInt(args.limit),
        graph: args.graph
    };
    
    await loader.run(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

export default LoadPDFs;