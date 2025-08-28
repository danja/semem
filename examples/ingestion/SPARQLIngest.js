#!/usr/bin/env node

/**
 * SPARQL Document Ingestion CLI Tool
 * 
 * Provides command-line interface for ingesting documents from SPARQL endpoints
 * into the semem semantic memory system using configurable query templates.
 */

import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import logger from 'loglevel';
import Config from '../../src/Config.js';
import SPARQLDocumentIngester from '../../src/services/ingestion/SPARQLDocumentIngester.js';
import { getSimpleVerbsService } from '../../mcp/tools/simple-verbs.js';
import { initializeServices } from '../../mcp/lib/initialization.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class SPARQLIngestCLI {
    constructor() {
        this.config = null;
        this.simpleVerbsService = null;
    }

    async initialize() {
        try {
            // Initialize configuration (relative path from examples/ingestion)
            const configPath = process.cwd().endsWith('/examples/ingestion') 
                ? '../../config/config.json' 
                : 'config/config.json';
                
            this.config = new Config(configPath);
            await this.config.init();

            // Initialize services for MCP integration
            await initializeServices();
            this.simpleVerbsService = getSimpleVerbsService();

            logger.info('SPARQL Ingestion CLI initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize CLI:', error.message);
            throw error;
        }
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const options = {
            endpoint: {
                type: 'string',
                short: 'e',
                description: 'SPARQL query endpoint URL'
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
                description: 'Interactive mode for building queries'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Enable verbose logging'
            },
            user: {
                type: 'string',
                description: 'SPARQL endpoint username'
            },
            password: {
                type: 'string',
                description: 'SPARQL endpoint password'
            },
            config: {
                type: 'string',
                short: 'c',
                description: 'Path to configuration file'
            },
            graph: {
                type: 'string',
                short: 'g',
                description: 'Graph URI for SPARQL updates (default: http://hyperdata.it/content)'
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
🔍 SPARQL Document Ingestion Tool

USAGE:
  node SPARQLIngest.js [OPTIONS]

EXAMPLES:
  # Preview blog articles
  node SPARQLIngest.js --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \\
                       --template blog-articles --dry-run --limit 5

  # Ingest documents with lazy processing
  node SPARQLIngest.js --endpoint "http://localhost:3030/dataset/query" \\
                       --template generic-documents --limit 20 --lazy

  # Interactive mode
  node SPARQLIngest.js --interactive

  # Ingest from blog example (using auth)
  node SPARQLIngest.js --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \\
                       --template blog-articles --limit 10 \\
                       --user admin --password secret

OPTIONS:
  -e, --endpoint <url>     SPARQL query endpoint URL
  -t, --template <name>    Query template (blog-articles, generic-documents, wikidata-entities)  
  -l, --limit <number>     Maximum documents to ingest (default: unlimited)
      --lazy               Use lazy processing (store without immediate processing)
  -d, --dry-run            Preview documents without ingesting
  -i, --interactive        Interactive mode for building queries
  -v, --verbose            Enable verbose logging
      --user <username>    SPARQL endpoint username
      --password <pass>    SPARQL endpoint password
  -c, --config <path>      Configuration file path
  -g, --graph <uri>        Graph URI for SPARQL updates (default: http://hyperdata.it/content)
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
        const templateDir = join(__dirname, '../../config/sparql-templates');
        
        if (!existsSync(templateDir)) {
            console.log('❌ No templates directory found');
            return;
        }

        console.log('\n📋 Available SPARQL Templates:');
        console.log('================================');

        try {
            const { readdirSync } = await import('fs');
            const files = readdirSync(templateDir).filter(f => f.endsWith('.sparql'));
            
            for (const file of files) {
                const templateName = file.replace('.sparql', '');
                const templatePath = join(templateDir, file);
                
                try {
                    const content = readFileSync(templatePath, 'utf8');
                    const firstLine = content.split('\n')[0];
                    const description = firstLine.startsWith('#') ? firstLine.substring(1).trim() : 'No description';
                    
                    console.log(`\n🔍 ${templateName}`);
                    console.log(`   ${description}`);
                    console.log(`   File: ${file}`);
                } catch (error) {
                    console.log(`\n🔍 ${templateName}`);
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

        console.log('\n🤖 SPARQL Ingestion Interactive Mode');
        console.log('====================================');
        
        try {
            // List available templates
            await this.listTemplates();

            // Get endpoint URL
            let endpoint = await question('\n📡 Enter SPARQL endpoint URL: ');
            if (!endpoint.trim()) {
                console.log('❌ Endpoint URL is required');
                rl.close();
                return;
            }

            // Get template
            let template = await question('📋 Enter template name (blog-articles, generic-documents, wikidata-entities): ');
            if (!template.trim()) {
                template = 'generic-documents';
                console.log(`Using default template: ${template}`);
            }

            // Get limit
            let limit = await question('📊 Enter limit (default 10): ');
            limit = limit.trim() || '10';

            // Get auth if needed
            const needsAuth = await question('🔐 Does endpoint need authentication? (y/n): ');
            let auth = null;
            if (needsAuth.toLowerCase().startsWith('y')) {
                const user = await question('👤 Username: ');
                const password = await question('🔑 Password: ');
                auth = { user, password };
            }

            // Ask for dry run
            const dryRunResponse = await question('🧪 Run dry run first? (y/n): ');
            const dryRun = dryRunResponse.toLowerCase().startsWith('y');

            rl.close();

            // Execute query
            console.log('\n🚀 Executing SPARQL ingestion...');
            await this.executeIngestion({
                endpoint,
                template,
                limit: parseInt(limit),
                auth,
                dryRun,
                verbose: true
            });

        } catch (error) {
            console.error('❌ Interactive mode failed:', error.message);
            rl.close();
        } finally {
            rl.close();
        }
    }

    /**
     * Execute SPARQL ingestion
     */
    async executeIngestion(options) {
        const {
            endpoint,
            template,
            limit = null,
            lazy = false,
            dryRun = false,
            auth,
            variables = {},
            fieldMappings,
            verbose = false,
            graph = 'http://hyperdata.it/content'
        } = options;

        try {
            // Create ingester
            const ingester = new SPARQLDocumentIngester({
                endpoint,
                auth,
                fieldMappings
            });

            console.log(`\n🔍 SPARQL Ingestion Starting`);
            console.log(`==========================`);
            console.log(`📡 Endpoint: ${endpoint}`);
            console.log(`📋 Template: ${template}`);
            console.log(`📊 Limit: ${limit}`);
            console.log(`🗂️  Graph: ${graph}`);
            console.log(`⚡ Mode: ${dryRun ? 'Dry Run' : (lazy ? 'Lazy Processing' : 'Full Processing')}`);

            if (dryRun) {
                // Execute dry run
                console.log('\n🧪 Executing dry run...');
                const result = await ingester.dryRun(template, { variables, limit, graph });

                if (result.success) {
                    console.log(`\n✅ Dry Run Successful`);
                    console.log(`📊 Total documents found: ${result.totalFound}`);
                    console.log(`\n📋 Preview (first ${result.preview.length} documents):`);
                    
                    result.preview.forEach((doc, index) => {
                        if (doc.error) {
                            console.log(`\n❌ Document ${index + 1}: Error - ${doc.error}`);
                        } else {
                            console.log(`\n📄 Document ${index + 1}:`);
                            console.log(`   URI: ${doc.uri}`);
                            console.log(`   Title: ${doc.title}`);
                            console.log(`   Content Preview: ${doc.contentPreview}`);
                            if (verbose && doc.metadata) {
                                console.log(`   Metadata:`, JSON.stringify(doc.metadata, null, 2));
                            }
                        }
                    });

                    if (result.totalFound > result.preview.length) {
                        console.log(`\n... and ${result.totalFound - result.preview.length} more documents`);
                    }
                } else {
                    console.log(`\n❌ Dry Run Failed: ${result.error}`);
                }

                return result;
            }

            // Execute full ingestion
            console.log('\n🚀 Starting ingestion...');

            // Create tell function for MCP integration
            const tellFunction = async (tellParams) => {
                if (!this.simpleVerbsService) {
                    throw new Error('Simple verbs service not initialized');
                }
                // Add graph parameter to metadata
                const enhancedParams = {
                    ...tellParams,
                    metadata: {
                        ...tellParams.metadata,
                        graph: graph
                    }
                };
                return await this.simpleVerbsService.tell(enhancedParams);
            };

            const result = await ingester.ingestFromTemplate(template, {
                variables,
                limit,
                lazy,
                graph,
                tellFunction,
                progressCallback: (progress) => {
                    const percent = Math.round((progress.processed / progress.total) * 100);
                    console.log(`📊 Progress: ${progress.processed}/${progress.total} (${percent}%) - ${progress.current.title}`);
                }
            });

            // Display results
            console.log(`\n📊 INGESTION COMPLETE`);
            console.log(`====================`);
            console.log(`✅ Success: ${result.success}`);
            console.log(`📁 Documents Found: ${result.statistics?.documentsFound || 0}`);
            console.log(`📥 Documents Ingested: ${result.statistics?.documentsIngested || 0}`);
            console.log(`❌ Errors: ${result.statistics?.errors || 0}`);
            console.log(`⏱️  Duration: ${result.duration}ms`);

            if (result.statistics?.errors > 0 && result.errors?.length > 0) {
                console.log(`\n❌ Error Details (first 5):`);
                result.errors.slice(0, 5).forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.title || error.uri || 'Unknown'}: ${error.error}`);
                });
            }

            if (verbose && result.results?.length > 0) {
                console.log(`\n✅ Successfully Ingested Documents:`);
                result.results.slice(0, 10).forEach((doc, index) => {
                    console.log(`   ${index + 1}. ${doc.title} (${doc.uri})`);
                });
                if (result.results.length > 10) {
                    console.log(`   ... and ${result.results.length - 10} more`);
                }
            }

            return result;

        } catch (error) {
            console.error(`\n❌ Ingestion failed: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    /**
     * Cleanup connections and resources
     */
    async cleanup() {
        try {
            if (this.simpleVerbsService && this.simpleVerbsService.memoryManager) {
                console.log('🧹 Cleaning up memory manager...');
                await this.simpleVerbsService.memoryManager.dispose();
            }
            
            // Small delay to ensure cleanup completes
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Warning: Cleanup failed:', error.message);
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

        try {
            await this.initialize();

            // Interactive mode
            if (values.interactive) {
                await this.runInteractive();
                await this.cleanup();
                return;
            }

            // Validate required arguments for non-interactive mode
            if (!values.endpoint || !values.template) {
                console.error('❌ Both --endpoint and --template are required for non-interactive mode');
                this.showHelp();
                process.exit(1);
            }

            // Prepare auth
            let auth = null;
            if (values.user || values.password) {
                auth = {
                    user: values.user || 'admin',
                    password: values.password || 'admin'
                };
            }

            // Execute ingestion
            await this.executeIngestion({
                endpoint: values.endpoint,
                template: values.template,
                limit: values.limit ? parseInt(values.limit) : null,
                lazy: values.lazy || false,
                dryRun: values['dry-run'] || false,
                auth,
                graph: values.graph || 'http://hyperdata.it/content',
                verbose: values.verbose || false
            });

        } catch (error) {
            console.error(`\n💥 CLI execution failed: ${error.message}`);
            if (values.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            // Always cleanup, even on errors
            await this.cleanup();
        }
    }
}

// Execute CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new SPARQLIngestCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}