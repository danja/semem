#!/usr/bin/env node

/**
 * Bookmark Ingestion CLI Tool
 *
 * Provides command-line interface for ingesting bookmarks from SPARQL endpoints
 * into the semem semantic memory system using the bookmark vocabulary.
 */

import { parseArgs } from 'util';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import logger from 'loglevel';
import Config from '../src/Config.js';
import SPARQLDocumentIngester from '../src/services/ingestion/SPARQLDocumentIngester.js';
import { getSimpleVerbsService } from '../src/mcp/tools/simple-verbs.js';
import { initializeServices } from '../src/mcp/lib/initialization.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class BookmarkIngestCLI {
    constructor() {
        this.config = null;
        this.simpleVerbsService = null;
    }

    async initialize() {
        try {
            // Initialize configuration (relative path from utils)
            const configPath = process.cwd().endsWith('/utils')
                ? '../config/config.json'
                : 'config/config.json';

            this.config = new Config(configPath);
            await this.config.init();

            // Initialize services for MCP integration
            await initializeServices();
            this.simpleVerbsService = getSimpleVerbsService();

            logger.info('Bookmark Ingestion CLI initialized successfully');
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
            limit: {
                type: 'string',
                short: 'l',
                description: 'Maximum number of bookmarks to ingest (default: 50)'
            },
            lazy: {
                type: 'boolean',
                description: 'Use lazy processing (no immediate embedding/concept extraction)'
            },
            'dry-run': {
                type: 'boolean',
                short: 'd',
                description: 'Preview bookmarks without ingesting them'
            },
            interactive: {
                type: 'boolean',
                short: 'i',
                description: 'Interactive mode'
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
            graph: {
                type: 'string',
                short: 'g',
                description: 'Graph URI (default: http://hyperdata.it/content)'
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
🔖 Bookmark Ingestion Tool

USAGE:
  node BookmarkIngest.js [OPTIONS]

EXAMPLES:
  # Preview bookmarks
  node BookmarkIngest.js --endpoint "https://fuseki.hyperdata.it/hyperdata.it/query" \\
                         --graph "http://hyperdata.it/content" --dry-run --limit 5

  # Ingest bookmarks with lazy processing
  node BookmarkIngest.js --endpoint "http://localhost:3030/dataset/query" \\
                         --limit 20 --lazy

  # Interactive mode
  node BookmarkIngest.js --interactive

OPTIONS:
  -e, --endpoint <url>     SPARQL query endpoint URL
  -l, --limit <number>     Maximum bookmarks to ingest (default: 50)
      --lazy               Use lazy processing (store without immediate processing)
  -d, --dry-run            Preview bookmarks without ingesting
  -i, --interactive        Interactive mode
  -v, --verbose            Enable verbose logging
      --user <username>    SPARQL endpoint username
      --password <pass>    SPARQL endpoint password
  -g, --graph <uri>        Graph URI (default: http://hyperdata.it/content)
  -h, --help               Show this help message

QUERY:
  Uses bookmark vocabulary (http://purl.org/stuff/bm/)
  Retrieves: target URL, title, content, fetch date
  Orders by most recent first
`);
    }

    /**
     * Interactive mode
     */
    async runInteractive() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        console.log('\n🔖 Bookmark Ingestion Interactive Mode');
        console.log('======================================');

        try {
            // Get endpoint URL
            let endpoint = await question('\n📡 Enter SPARQL endpoint URL: ');
            if (!endpoint.trim()) {
                console.log('❌ Endpoint URL is required');
                rl.close();
                return;
            }

            // Get graph
            let graph = await question('🗂️  Enter graph URI (default: http://hyperdata.it/content): ');
            graph = graph.trim() || 'http://hyperdata.it/content';

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
            console.log('\n🚀 Executing bookmark ingestion...');
            await this.executeIngestion({
                endpoint,
                graph,
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
     * Execute bookmark ingestion
     */
    async executeIngestion(options) {
        const {
            endpoint,
            limit = 50,
            lazy = false,
            dryRun = false,
            auth,
            verbose = false,
            graph = 'http://hyperdata.it/content'
        } = options;

        try {
            // Create ingester with field mappings for bookmarks
            const ingester = new SPARQLDocumentIngester({
                endpoint,
                auth,
                fieldMappings: {
                    uri: 'uri',
                    title: 'title',
                    content: 'content',
                    date: 'date'
                }
            });

            console.log(`\n🔖 Bookmark Ingestion Starting`);
            console.log(`=============================`);
            console.log(`📡 Endpoint: ${endpoint}`);
            console.log(`🗂️  Graph: ${graph}`);
            console.log(`📊 Limit: ${limit}`);
            console.log(`⚡ Mode: ${dryRun ? 'Dry Run' : (lazy ? 'Lazy Processing' : 'Full Processing')}`);

            if (dryRun) {
                // Execute dry run
                console.log('\n🧪 Executing dry run...');
                const result = await ingester.dryRun('bookmarks', {
                    variables: {},
                    limit,
                    graph
                });

                if (result.success) {
                    console.log(`\n✅ Dry Run Successful`);
                    console.log(`📊 Total bookmarks found: ${result.totalFound}`);
                    console.log(`\n📋 Preview (first ${result.preview.length} bookmarks):`);

                    result.preview.forEach((doc, index) => {
                        if (doc.error) {
                            console.log(`\n❌ Bookmark ${index + 1}: Error - ${doc.error}`);
                        } else {
                            console.log(`\n🔖 Bookmark ${index + 1}:`);
                            console.log(`   Target: ${doc.uri}`);
                            console.log(`   Title: ${doc.title || '(no title)'}`);
                            console.log(`   Content Preview: ${doc.contentPreview}`);
                            console.log(`   Fetched: ${doc.metadata?.date || 'unknown'}`);
                            if (verbose && doc.metadata) {
                                console.log(`   Metadata:`, JSON.stringify(doc.metadata, null, 2));
                            }
                        }
                    });

                    if (result.totalFound > result.preview.length) {
                        console.log(`\n... and ${result.totalFound - result.preview.length} more bookmarks`);
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
                        graph: graph,
                        source: 'bookmark'
                    }
                };
                return await this.simpleVerbsService.tell(enhancedParams);
            };

            const result = await ingester.ingestFromTemplate('bookmarks', {
                variables: {},
                limit,
                lazy,
                graph,
                tellFunction,
                progressCallback: (progress) => {
                    const percent = Math.round((progress.processed / progress.total) * 100);
                    console.log(`📊 Progress: ${progress.processed}/${progress.total} (${percent}%) - ${progress.current.title || progress.current.uri}`);
                }
            });

            // Display results
            console.log(`\n📊 INGESTION COMPLETE`);
            console.log(`====================`);
            console.log(`✅ Success: ${result.success}`);
            console.log(`📁 Bookmarks Found: ${result.statistics?.documentsFound || 0}`);
            console.log(`📥 Bookmarks Ingested: ${result.statistics?.documentsIngested || 0}`);
            console.log(`❌ Errors: ${result.statistics?.errors || 0}`);
            console.log(`⏱️  Duration: ${result.duration}ms`);

            if (result.statistics?.errors > 0 && result.errors?.length > 0) {
                console.log(`\n❌ Error Details (first 5):`);
                result.errors.slice(0, 5).forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.title || error.uri || 'Unknown'}: ${error.error}`);
                });
            }

            if (verbose && result.results?.length > 0) {
                console.log(`\n✅ Successfully Ingested Bookmarks:`);
                result.results.slice(0, 10).forEach((doc, index) => {
                    console.log(`   ${index + 1}. ${doc.title || doc.uri}`);
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
            if (!values.endpoint) {
                console.error('❌ --endpoint is required for non-interactive mode');
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
                limit: values.limit ? parseInt(values.limit) : 50,
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

            // Force exit after cleanup
            console.log('🔚 Exiting process...');
            process.exit(0);
        }
    }
}

// Execute CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new BookmarkIngestCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}