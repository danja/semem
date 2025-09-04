#!/usr/bin/env node

/**
 * SPARQL Document Remote Ingestion CLI Tool
 * 
 * Provides command-line interface for ingesting documents from SPARQL endpoints
 * into a remote semem semantic memory system at tensegrity.it
 */

import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import logger from 'loglevel';
import SPARQLDocumentIngester from '../src/services/ingestion/SPARQLDocumentIngester.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Remote Semem endpoints on tensegrity.it
const REMOTE_ENDPOINTS = {
    MCP: 'https://mcp.tensegrity.it/',
    API: 'https://api.tensegrity.it/',
    FUSEKI: 'https://semem-fuseki.tensegrity.it/',
    WORKBENCH: 'https://semem.tensegrity.it/',
    TELL_ENDPOINT: 'https://semem.tensegrity.it/api/tell'
};

// Source data endpoints to ingest from
const SOURCE_ENDPOINTS = [
    {
        name: 'hyperdata.it_danny',
        endpoint: 'https://fuseki.hyperdata.it/hyperdata.it/query',
        graph: 'http://hyperdata.it/content'
    },
    {
        name: 'danny.ayers.name_content', 
        endpoint: 'https://fuseki.hyperdata.it/danny.ayers.name/query',
        graph: 'http://danny.ayers.name/'
    }
];

class SPARQLIngestRemoteCLI {
    constructor() {
        this.remoteCredentials = {
            user: 'admin',
            password: 'admin123'
        };
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const options = {
            source: {
                type: 'string',
                short: 's',
                description: 'Source data endpoint (hyperdata.it_danny, danny.ayers.name_content, or both)'
            },
            template: {
                type: 'string',
                short: 't',
                description: 'Query template name (blog-articles, generic-documents, wikidata-entities)'
            },
            limit: {
                type: 'string',
                short: 'l',
                description: 'Maximum number of documents to ingest (default: 50)'
            },
            lazy: {
                type: 'boolean',
                description: 'Use lazy processing (no immediate embedding/concept extraction)'
            },
            'dry-run': {
                type: 'boolean',
                short: 'd',
                description: 'Preview documents without ingesting them'
            },
            interactive: {
                type: 'boolean',
                short: 'i',
                description: 'Interactive mode for selecting sources and templates'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Enable verbose logging'
            },
            'remote-user': {
                type: 'string',
                description: 'Remote semem username (default: admin)'
            },
            'remote-password': {
                type: 'string', 
                description: 'Remote semem password (default: admin123)'
            },
            'source-user': {
                type: 'string',
                description: 'Source SPARQL endpoint username'
            },
            'source-password': {
                type: 'string',
                description: 'Source SPARQL endpoint password'
            },
            help: {
                type: 'boolean',
                short: 'h',
                description: 'Show help message'
            }
        };

        try {
            const { values, positionals } = parseArgs({
                options,
                allowPositionals: true
            });

            return { values, positionals };
        } catch (error) {
            console.error('Error parsing arguments:', error.message);
            this.showHelp();
            process.exit(1);
        }
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
🌐 SPARQL Remote Document Ingestion Tool

USAGE:
  node SPARQLIngestRemote.js [OPTIONS]

EXAMPLES:
  # Preview blog articles from danny.ayers.name
  node SPARQLIngestRemote.js --source danny.ayers.name_content \\
                             --template blog-articles --dry-run --limit 5

  # Ingest from both sources with lazy processing
  node SPARQLIngestRemote.js --source both \\
                             --template generic-documents --limit 20 --lazy

  # Interactive mode
  node SPARQLIngestRemote.js --interactive

REMOTE ENDPOINTS:
  MCP Server:     ${REMOTE_ENDPOINTS.MCP}
  API Server:     ${REMOTE_ENDPOINTS.API} 
  Fuseki:         ${REMOTE_ENDPOINTS.FUSEKI}
  Workbench:      ${REMOTE_ENDPOINTS.WORKBENCH}

SOURCE DATA:
  hyperdata.it_danny        ${SOURCE_ENDPOINTS[0].endpoint}
                           Graph: ${SOURCE_ENDPOINTS[0].graph}
  
  danny.ayers.name_content  ${SOURCE_ENDPOINTS[1].endpoint}
                           Graph: ${SOURCE_ENDPOINTS[1].graph}

OPTIONS:
  -s, --source <name>      Source data endpoint (hyperdata.it_danny, danny.ayers.name_content, both)
  -t, --template <name>    Query template (blog-articles, generic-documents, wikidata-entities)  
  -l, --limit <number>     Maximum documents to ingest per source (default: 50)
      --lazy               Use lazy processing (store without immediate processing)
  -d, --dry-run            Preview documents without ingesting
  -i, --interactive        Interactive mode for source and template selection
  -v, --verbose            Enable verbose logging
      --remote-user <usr>  Remote semem username (default: admin)
      --remote-password <pass> Remote semem password (default: admin123)
      --source-user <usr>  Source endpoint username (if required)
      --source-password <pass> Source endpoint password (if required)
  -h, --help               Show this help message

TEMPLATES:
  blog-articles           Articles following schema.org Article pattern
  generic-documents       Flexible pattern for various document types
  wikidata-entities       Wikidata entities with labels and descriptions

For more information, see: docs/manual/sparql-ingestion.md
`);
    }

    /**
     * List available templates
     */
    async listTemplates() {
        const templateDir = join(__dirname, '../config/sparql-templates');
        
        if (!existsSync(templateDir)) {
            console.log('❌ No templates directory found');
            return;
        }

        console.log('\\n📋 Available SPARQL Templates:');
        console.log('================================');

        try {
            const { readdirSync } = await import('fs');
            const files = readdirSync(templateDir).filter(f => f.endsWith('.sparql'));
            
            for (const file of files) {
                const templateName = file.replace('.sparql', '');
                const templatePath = join(templateDir, file);
                
                try {
                    const content = readFileSync(templatePath, 'utf8');
                    const firstLine = content.split('\\n')[0];
                    const description = firstLine.startsWith('#') ? firstLine.substring(1).trim() : 'No description';
                    
                    console.log(`\\n🔍 ${templateName}`);
                    console.log(`   ${description}`);
                    console.log(`   File: ${file}`);
                } catch (error) {
                    console.log(`\\n🔍 ${templateName}`);
                    console.log(`   Error reading template: ${error.message}`);
                }
            }
        } catch (error) {
            console.log('❌ Failed to list templates:', error.message);
        }
    }

    /**
     * Interactive mode for building and testing queries
     */
    async runInteractive() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        console.log('\\n🌐 SPARQL Remote Ingestion Interactive Mode');
        console.log('===========================================');
        
        try {
            // Show available sources
            console.log('\\n📡 Available Source Endpoints:');
            SOURCE_ENDPOINTS.forEach((source, index) => {
                console.log(`  ${index + 1}. ${source.name}`);
                console.log(`     Endpoint: ${source.endpoint}`);  
                console.log(`     Graph: ${source.graph}\\n`);
            });

            // Get source selection
            let sourceChoice = await question('📡 Select source (1, 2, or "both"): ');
            let sources;
            if (sourceChoice === 'both') {
                sources = SOURCE_ENDPOINTS;
            } else if (sourceChoice === '1') {
                sources = [SOURCE_ENDPOINTS[0]];
            } else if (sourceChoice === '2') {
                sources = [SOURCE_ENDPOINTS[1]];
            } else {
                console.log('❌ Invalid source selection');
                rl.close();
                return;
            }

            // List available templates
            await this.listTemplates();

            // Get template
            let template = await question('\\n📋 Enter template name (blog-articles, generic-documents, wikidata-entities): ');
            if (!template.trim()) {
                template = 'generic-documents';
                console.log(`Using default template: ${template}`);
            }

            // Get limit
            let limit = await question('📊 Enter limit per source (default 50): ');
            limit = limit.trim() || '50';

            // Ask for dry run
            const dryRunResponse = await question('🧪 Run dry run first? (y/n): ');
            const dryRun = dryRunResponse.toLowerCase().startsWith('y');

            // Get remote credentials
            const remoteUser = await question(`🔐 Remote Semem username (default: ${this.remoteCredentials.user}): `);
            const remotePassword = await question(`🔐 Remote Semem password (default: ${this.remoteCredentials.password}): `);
            
            if (remoteUser.trim()) this.remoteCredentials.user = remoteUser.trim();
            if (remotePassword.trim()) this.remoteCredentials.password = remotePassword.trim();

            // Get source auth if needed
            const needsSourceAuth = await question('🔐 Do source endpoints need authentication? (y/n): ');
            let sourceAuth = null;
            if (needsSourceAuth.toLowerCase().startsWith('y')) {
                const user = await question('👤 Source Username: ');
                const password = await question('🔑 Source Password: ');
                sourceAuth = { user, password };
            }

            rl.close();

            // Execute ingestion for selected sources
            for (const source of sources) {
                console.log(`\\n🚀 Processing source: ${source.name}`);
                await this.executeIngestionForSource({
                    source,
                    template,
                    limit: parseInt(limit),
                    sourceAuth,
                    dryRun,
                    verbose: true
                });
            }

        } catch (error) {
            console.error('❌ Interactive mode failed:', error.message);
            rl.close();
        } finally {
            rl.close();
        }
    }

    /**
     * Send Tell request to remote Semem API
     */
    async sendToRemoteSemem(document) {
        try {
            const response = await fetch(REMOTE_ENDPOINTS.TELL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${this.remoteCredentials.user}:${this.remoteCredentials.password}`).toString('base64')}`
                },
                body: JSON.stringify({
                    content: document.content,
                    type: 'concept',
                    metadata: {
                        sourceUri: document.uri,
                        sourceTitle: document.title,
                        sourceEndpoint: document.sourceEndpoint,
                        sourceGraph: document.sourceGraph,
                        ingestedAt: new Date().toISOString()
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Failed to send to remote Semem: ${error.message}`);
        }
    }

    /**
     * Execute SPARQL ingestion for a single source
     */
    async executeIngestionForSource(options) {
        const {
            source,
            template,
            limit = 50,
            lazy = false,
            dryRun = false,
            sourceAuth,
            verbose = false
        } = options;

        try {
            // Create ingester for source endpoint
            const ingester = new SPARQLDocumentIngester({
                endpoint: source.endpoint,
                auth: sourceAuth
            });

            console.log(`\\n🔍 SPARQL Remote Ingestion Starting`);
            console.log(`===================================`);
            console.log(`📡 Source: ${source.name}`);
            console.log(`📡 Endpoint: ${source.endpoint}`);
            console.log(`🗂️  Graph: ${source.graph}`);
            console.log(`📋 Template: ${template}`);
            console.log(`📊 Limit: ${limit}`);
            console.log(`🌐 Remote Target: ${REMOTE_ENDPOINTS.TELL_ENDPOINT}`);
            console.log(`⚡ Mode: ${dryRun ? 'Dry Run' : (lazy ? 'Lazy Processing' : 'Full Processing')}`);

            if (dryRun) {
                // Execute dry run
                console.log('\\n🧪 Executing dry run...');
                const result = await ingester.dryRun(template, { 
                    variables: {}, 
                    limit, 
                    graph: source.graph 
                });

                if (result.success) {
                    console.log(`\\n✅ Dry Run Successful`);
                    console.log(`📊 Total documents found: ${result.totalFound}`);
                    console.log(`\\n📋 Preview (first ${result.preview.length} documents):`);
                    
                    result.preview.forEach((doc, index) => {
                        if (doc.error) {
                            console.log(`\\n❌ Document ${index + 1}: Error - ${doc.error}`);
                        } else {
                            console.log(`\\n📄 Document ${index + 1}:`);
                            console.log(`   URI: ${doc.uri}`);
                            console.log(`   Title: ${doc.title}`);
                            console.log(`   Content Preview: ${doc.contentPreview}`);
                            if (verbose && doc.metadata) {
                                console.log(`   Metadata:`, JSON.stringify(doc.metadata, null, 2));
                            }
                        }
                    });

                    if (result.totalFound > result.preview.length) {
                        console.log(`\\n... and ${result.totalFound - result.preview.length} more documents`);
                    }
                } else {
                    console.log(`\\n❌ Dry Run Failed: ${result.error}`);
                }

                return result;
            }

            // Execute full ingestion to remote Semem
            console.log('\\n🚀 Starting remote ingestion...');

            // Create tell function for remote API
            const remoteTellFunction = async (tellParams) => {
                const document = {
                    uri: tellParams.metadata?.sourceUri || 'unknown',
                    title: tellParams.metadata?.sourceTitle || 'Untitled',
                    content: tellParams.content,
                    sourceEndpoint: source.endpoint,
                    sourceGraph: source.graph
                };
                
                return await this.sendToRemoteSemem(document);
            };

            const result = await ingester.ingestFromTemplate(template, {
                variables: {},
                limit,
                lazy,
                graph: source.graph,
                tellFunction: remoteTellFunction,
                progressCallback: (progress) => {
                    const percent = Math.round((progress.processed / progress.total) * 100);
                    console.log(`📊 Progress: ${progress.processed}/${progress.total} (${percent}%) - ${progress.current.title}`);
                }
            });

            // Display results
            console.log(`\\n📊 REMOTE INGESTION COMPLETE`);
            console.log(`============================`);
            console.log(`✅ Success: ${result.success}`);
            console.log(`📁 Documents Found: ${result.statistics?.documentsFound || 0}`);
            console.log(`📥 Documents Sent to Remote: ${result.statistics?.documentsIngested || 0}`);
            console.log(`❌ Errors: ${result.statistics?.errors || 0}`);
            console.log(`⏱️  Duration: ${result.duration}ms`);
            console.log(`🌐 Target: ${REMOTE_ENDPOINTS.TELL_ENDPOINT}`);

            if (result.statistics?.errors > 0 && result.errors?.length > 0) {
                console.log(`\\n❌ Error Details (first 5):`);
                result.errors.slice(0, 5).forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.title || error.uri || 'Unknown'}: ${error.error}`);
                });
            }

            if (verbose && result.results?.length > 0) {
                console.log(`\\n✅ Successfully Sent to Remote:`);
                result.results.slice(0, 10).forEach((doc, index) => {
                    console.log(`   ${index + 1}. ${doc.title} (${doc.uri})`);
                });
                if (result.results.length > 10) {
                    console.log(`   ... and ${result.results.length - 10} more`);
                }
            }

            return result;

        } catch (error) {
            console.error(`\\n❌ Remote ingestion failed for ${source.name}: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    /**
     * Main execution function
     */
    async run() {
        const { values, positionals } = this.parseArguments();

        // Set log level
        if (values.verbose) {
            logger.setLevel('debug');
        } else {
            logger.setLevel('info');
        }

        // Show help
        if (values.help) {
            this.showHelp();
            return;
        }

        // Update remote credentials if provided
        if (values['remote-user']) {
            this.remoteCredentials.user = values['remote-user'];
        }
        if (values['remote-password']) {
            this.remoteCredentials.password = values['remote-password'];
        }

        try {
            // Interactive mode
            if (values.interactive) {
                await this.runInteractive();
                return;
            }

            // Validate required arguments for non-interactive mode
            if (!values.source || !values.template) {
                console.error('❌ Both --source and --template are required for non-interactive mode');
                this.showHelp();
                process.exit(1);
            }

            // Determine sources to process
            let sourcesToProcess;
            if (values.source === 'both') {
                sourcesToProcess = SOURCE_ENDPOINTS;
            } else if (values.source === 'hyperdata.it_danny') {
                sourcesToProcess = [SOURCE_ENDPOINTS[0]];
            } else if (values.source === 'danny.ayers.name_content') {
                sourcesToProcess = [SOURCE_ENDPOINTS[1]];
            } else {
                console.error(`❌ Invalid source: ${values.source}. Use: hyperdata.it_danny, danny.ayers.name_content, or both`);
                process.exit(1);
            }

            // Prepare source auth
            let sourceAuth = null;
            if (values['source-user'] || values['source-password']) {
                sourceAuth = {
                    user: values['source-user'] || 'admin',
                    password: values['source-password'] || 'admin'
                };
            }

            // Process each source
            for (const source of sourcesToProcess) {
                console.log(`\\n🌐 Processing ${source.name}...`);
                await this.executeIngestionForSource({
                    source,
                    template: values.template,
                    limit: values.limit ? parseInt(values.limit) : 50,
                    lazy: values.lazy || false,
                    dryRun: values['dry-run'] || false,
                    sourceAuth,
                    verbose: values.verbose || false
                });
            }

            console.log('\\n🎉 All sources processed successfully!');

        } catch (error) {
            console.error(`\\n💥 CLI execution failed: ${error.message}`);
            if (values.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
}

// Execute CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new SPARQLIngestRemoteCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export default SPARQLIngestRemoteCLI;