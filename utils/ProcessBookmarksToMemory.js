#!/usr/bin/env node

/**
 * Process Bookmarks to Memory Utility
 *
 * Finds unprocessed bookmarks in the SPARQL graph and processes them through
 * the tell verb to create searchable semem:MemoryItem entities with embeddings.
 */

import { parseArgs } from 'util';
import Config from '../src/Config.js';
import SPARQLStore from '../src/stores/SPARQLStore.js';
import MemoryItemProcessor from '../src/services/ingestion/MemoryItemProcessor.js';
import { getSimpleVerbsService } from '../src/mcp/tools/simple-verbs.js';
import { initializeServices } from '../src/mcp/lib/initialization.js';
import logger from 'loglevel';

class ProcessBookmarksToMemoryCLI {
    constructor() {
        this.config = null;
        this.store = null;
        this.processor = null;
    }

    async initialize() {
        try {
            const configPath = process.cwd().endsWith('/utils')
                ? '../config/config.json'
                : 'config/config.json';

            this.config = new Config(configPath);
            await this.config.init();

            // Initialize MCP services
            await initializeServices();
            const simpleVerbsService = getSimpleVerbsService();

            // Initialize SPARQL store
            const storage = this.config.get('storage');
            if (!storage || storage.type !== 'sparql') {
                throw new Error('SPARQL storage configuration not found in config.json');
            }

            const endpoints = {
                query: storage.options.query,
                update: storage.options.update
            };

            this.store = new SPARQLStore(endpoints, {
                user: storage.options.user,
                password: storage.options.password,
                graphName: storage.options.graphName,
                dimension: this.config.get('embeddingDimension') || 768
            }, this.config);

            // Initialize processor
            this.processor = new MemoryItemProcessor({
                store: this.store,
                simpleVerbsService: simpleVerbsService,
                config: this.config
            });

            logger.info('✅ Process Bookmarks to Memory CLI initialized');
        } catch (error) {
            console.error('❌ Failed to initialize:', error.message);
            throw error;
        }
    }

    parseArguments() {
        const options = {
            limit: {
                type: 'string',
                short: 'l',
                description: 'Maximum number of bookmarks to process (default: 10)'
            },
            'batch-size': {
                type: 'string',
                short: 'b',
                description: 'Bookmarks to process per batch (default: 5)'
            },
            'dry-run': {
                type: 'boolean',
                short: 'd',
                description: 'Show what would be processed without doing it'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Verbose output'
            },
            help: {
                type: 'boolean',
                short: 'h',
                description: 'Show help'
            }
        };

        try {
            const { values } = parseArgs({ options, allowPositionals: false });
            return values;
        } catch (error) {
            console.error('Error parsing arguments:', error.message);
            this.showHelp();
            process.exit(1);
        }
    }

    showHelp() {
        console.log(`
🔖➡️💾 Process Bookmarks to Memory Utility

Finds unprocessed bookmarks and converts them to searchable memory items.

USAGE:
  node ProcessBookmarksToMemory.js [OPTIONS]

OPTIONS:
  -l, --limit <number>      Maximum bookmarks to process (default: 10)
  -b, --batch-size <number> Bookmarks per batch (default: 5)
  -d, --dry-run             Preview without processing
  -v, --verbose             Verbose output
  -h, --help                Show this help

EXAMPLES:
  # Process first 10 bookmarks
  node ProcessBookmarksToMemory.js

  # Process 50 bookmarks in batches of 10
  node ProcessBookmarksToMemory.js --limit 50 --batch-size 10

  # Dry run to preview what would be processed
  node ProcessBookmarksToMemory.js --limit 20 --dry-run --verbose

  # Process all unprocessed bookmarks (up to 1000)
  node ProcessBookmarksToMemory.js --limit 1000

WHAT IT DOES:
  1. Finds bookmarks in the graph that haven't been processed
  2. Processes each bookmark through the 'tell' verb to:
     - Create semem:MemoryItem entities
     - Generate embeddings for semantic search
     - Extract concepts
  3. Marks bookmarks as processed (semem:processedToMemory = true)

After processing, bookmarks will be searchable via the 'ask' verb!
`);
    }

    async run() {
        const args = this.parseArguments();

        // Set log level
        if (args.verbose) {
            logger.setLevel('debug');
        } else {
            logger.setLevel('info');
        }

        // Show help
        if (args.help) {
            this.showHelp();
            return;
        }

        try {
            await this.initialize();

            const limit = args.limit ? parseInt(args.limit) : 10;
            const batchSize = args['batch-size'] ? parseInt(args['batch-size']) : 5;
            const dryRun = args['dry-run'] || false;
            const verbose = args.verbose || false;

            console.log(`\n🔖 Processing Bookmarks to Memory`);
            console.log(`================================`);
            console.log(`📊 Limit: ${limit} bookmarks`);
            console.log(`📦 Batch size: ${batchSize}`);
            console.log(`🗂️  Graph: ${this.store.graphName}`);
            console.log(`⚡ Mode: ${dryRun ? 'Dry Run' : 'Full Processing'}\n`);

            // Process bookmarks
            const result = await this.processor.processBatch({
                limit,
                batchSize,
                dryRun,
                verbose,
                progressCallback: (progress) => {
                    const percent = Math.round((progress.processed / progress.total) * 100);
                    console.log(`📊 Progress: ${progress.processed}/${progress.total} (${percent}%) - Batch ${progress.batchNumber}`);
                }
            });

            // Display results
            console.log(`\n📊 PROCESSING COMPLETE`);
            console.log(`=====================`);
            console.log(`✅ Success: ${result.success}`);
            console.log(`📁 Bookmarks Found: ${result.stats.found}`);
            console.log(`✅ Processed: ${result.stats.processed}`);
            console.log(`❌ Failed: ${result.stats.failed}`);
            console.log(`⏱️  Duration: ${result.duration}ms`);

            if (result.stats.failed > 0 && result.results) {
                console.log(`\n❌ Failed Items:`);
                const failures = result.results.filter(r => !r.success);
                failures.slice(0, 5).forEach((failure, index) => {
                    console.log(`   ${index + 1}. ${failure.bookmark}: ${failure.error}`);
                });
                if (failures.length > 5) {
                    console.log(`   ... and ${failures.length - 5} more failures`);
                }
            }

            if (verbose && result.results) {
                console.log(`\n✅ Successfully Processed:`);
                const successes = result.results.filter(r => r.success);
                successes.slice(0, 10).forEach((success, index) => {
                    console.log(`   ${index + 1}. ${success.bookmark} (${success.concepts || 0} concepts)`);
                });
                if (successes.length > 10) {
                    console.log(`   ... and ${successes.length - 10} more`);
                }
            }

            if (!dryRun && result.stats.processed > 0) {
                console.log(`\n💡 Bookmarks are now searchable via the 'ask' verb!`);
                console.log(`   Try: "What bookmarks do I have about Claude Code?"`);
            }

        } catch (error) {
            console.error(`\n💥 Processing failed: ${error.message}`);
            if (args.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            // Cleanup
            console.log('\n🔚 Exiting...');
            process.exit(0);
        }
    }
}

// Execute CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new ProcessBookmarksToMemoryCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}
