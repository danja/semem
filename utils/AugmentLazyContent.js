#!/usr/bin/env node

/**
 * Augment Lazy Content Utility
 *
 * Processes lazy-stored content by generating embeddings and extracting concepts.
 * This is the second phase of the two-phase lazy ingestion workflow.
 */

import { parseArgs } from 'util';
import Config from '../src/Config.js';
import SPARQLStore from '../src/stores/SPARQLStore.js';
import { getSimpleVerbsService } from '../src/mcp/tools/simple-verbs.js';
import { initializeServices } from '../src/mcp/lib/initialization.js';
import logger from 'loglevel';

class AugmentLazyContentCLI {
    constructor() {
        this.config = null;
        this.store = null;
        this.simpleVerbsService = null;
        this.stats = {
            total: 0,
            processed: 0,
            failed: 0,
            skipped: 0,
            startTime: null,
            endTime: null
        };
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
            this.simpleVerbsService = getSimpleVerbsService();

            // Initialize SPARQL store
            const storage = this.config.get('storage');
            if (!storage || storage.type !== 'sparql') {
                throw new Error('SPARQL storage configuration not found in config.json');
            }

            const queryEndpoint = storage.options.query;
            const updateEndpoint = storage.options.update;
            const graphName = storage.options.graphName;
            const user = storage.options.user;
            const password = storage.options.password;

            // Pass endpoints as object to SPARQLStore
            const endpoints = {
                query: queryEndpoint,
                update: updateEndpoint
            };

            this.store = new SPARQLStore(endpoints, {
                user: user,
                password: password,
                graphName: graphName,
                dimension: this.config.get('embeddingDimension') || 1536
            }, this.config);

            logger.info('✅ Augment Lazy Content CLI initialized');
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
                description: 'Maximum number of items to process (default: 10)'
            },
            'batch-size': {
                type: 'string',
                short: 'b',
                description: 'Items to process per batch (default: 5)'
            },
            type: {
                type: 'string',
                short: 't',
                description: 'Filter by content type (document, concept, interaction)'
            },
            id: {
                type: 'string',
                description: 'Process specific item by ID'
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
🔄 Augment Lazy Content Utility

Processes lazy-stored content by generating embeddings and extracting concepts.

USAGE:
  node AugmentLazyContent.js [OPTIONS]

OPTIONS:
  -l, --limit <number>      Maximum items to process (default: 10)
  -b, --batch-size <number> Items per batch (default: 5)
  -t, --type <type>         Filter by type (document, concept, interaction)
      --id <id>             Process specific item by ID
  -d, --dry-run             Preview without processing
  -v, --verbose             Verbose output
  -h, --help                Show this help

EXAMPLES:
  # Process first 10 lazy items
  node AugmentLazyContent.js

  # Process 20 documents in batches of 5
  node AugmentLazyContent.js --limit 20 --batch-size 5 --type document

  # Dry run to preview
  node AugmentLazyContent.js --dry-run --limit 5

  # Process specific item
  node AugmentLazyContent.js --id "semem:123456"

WORKFLOW:
  1. Query for lazy content (processingStatus = "lazy")
  2. For each item:
     - Generate embedding via augment verb
     - Extract concepts
     - Update processingStatus to "processed"
  3. Report statistics

See: docs/manual/lazy-batch-processing.md
`);
    }

    /**
     * Find lazy content items to process
     */
    async findLazyItems(options = {}) {
        const { limit = 10, type = null, id = null } = options;

        try {
            if (id) {
                // Query specific item
                const query = `
                    PREFIX semem: <http://purl.org/stuff/semem/>
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX dcterms: <http://purl.org/dc/terms/>

                    SELECT ?element ?content ?label ?type ?created
                    FROM <${this.store.graphName}>
                    WHERE {
                        BIND(<${id}> AS ?element)
                        ?element semem:processingStatus "lazy" ;
                                 ragno:content ?content .
                        OPTIONAL { ?element rdfs:label ?label }
                        OPTIONAL { ?element ragno:subType ?type }
                        OPTIONAL { ?element dcterms:created ?created }
                    }
                `;

                const response = await this.store.sparqlExecute.executeSparqlQuery(query);
                return response.results.bindings.map(this.bindingToItem);
            }

            // Build query with optional type filter
            let typeFilter = '';
            if (type) {
                const typeUri = type.includes('://') ? type : `http://purl.org/stuff/semem/${type}`;
                typeFilter = `?element ragno:subType <${typeUri}> .`;
            }

            const query = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX dcterms: <http://purl.org/dc/terms/>

                SELECT ?element ?content ?label ?type ?created
                FROM <${this.store.graphName}>
                WHERE {
                    ?element semem:processingStatus "lazy" ;
                             ragno:content ?content .
                    ${typeFilter}
                    OPTIONAL { ?element rdfs:label ?label }
                    OPTIONAL { ?element ragno:subType ?type }
                    OPTIONAL { ?element dcterms:created ?created }
                }
                ORDER BY DESC(?created)
                LIMIT ${limit}
            `;

            const response = await this.store.sparqlExecute.executeSparqlQuery(query);
            return response.results.bindings.map(this.bindingToItem);

        } catch (error) {
            throw new Error(`Failed to find lazy items: ${error.message}`);
        }
    }

    bindingToItem(binding) {
        return {
            id: binding.element?.value,
            content: binding.content?.value,
            label: binding.label?.value,
            type: binding.type?.value,
            created: binding.created?.value
        };
    }

    /**
     * Process a single lazy item
     */
    async processItem(item, options = {}) {
        const { verbose = false } = options;

        try {
            if (verbose) {
                console.log(`\n🔄 Processing: ${item.label || item.id}`);
                console.log(`   Content length: ${item.content?.length || 0} chars`);
            }

            // Use augment verb to process the content
            const augmentResult = await this.simpleVerbsService.augment({
                content: item.content,
                options: {
                    extractConcepts: true,
                    generateEmbedding: true,
                    analyze: true
                }
            });

            if (!augmentResult.success) {
                throw new Error(augmentResult.error || 'Augment operation failed');
            }

            // Update the lazy item with processed data
            await this.updateItemToProcessed(item.id, augmentResult, verbose);

            if (verbose) {
                console.log(`   ✅ Processed successfully`);
                console.log(`   Concepts: ${augmentResult.concepts?.length || 0}`);
                console.log(`   Embedding: ${augmentResult.embedding ? 'generated' : 'none'}`);
            }

            return { success: true, item, result: augmentResult };

        } catch (error) {
            if (verbose) {
                console.log(`   ❌ Failed: ${error.message}`);
            }
            return { success: false, item, error: error.message };
        }
    }

    /**
     * Update lazy item to processed status
     */
    async updateItemToProcessed(itemId, augmentResult, verbose = false) {
        try {
            const embedding = augmentResult.embedding || [];
            const concepts = augmentResult.concepts || [];
            const embeddingJson = JSON.stringify(embedding);

            // Build concept relationships
            let conceptTriples = '';
            if (concepts.length > 0) {
                const conceptUris = concepts.map(c =>
                    `<http://purl.org/stuff/semem/concept/${encodeURIComponent(c)}>`
                ).join(', ');
                conceptTriples = `<${itemId}> skos:related ${conceptUris} .`;
            }

            const updateQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

                DELETE {
                    GRAPH <${this.store.graphName}> {
                        <${itemId}> semem:processingStatus "lazy" .
                    }
                }
                INSERT {
                    GRAPH <${this.store.graphName}> {
                        <${itemId}> semem:processingStatus "processed" ;
                                    ragno:embedding """${embeddingJson}""" .
                        ${conceptTriples}
                    }
                }
                WHERE {
                    GRAPH <${this.store.graphName}> {
                        <${itemId}> semem:processingStatus "lazy" .
                    }
                }
            `;

            await this.store.sparqlExecute.executeSparqlUpdate(updateQuery);

            if (verbose) {
                logger.debug(`Updated ${itemId} to processed status`);
            }

        } catch (error) {
            throw new Error(`Failed to update item status: ${error.message}`);
        }
    }

    /**
     * Process items in batches
     */
    async processBatch(items, options = {}) {
        const { batchSize = 5, verbose = false } = options;

        this.stats.total = items.length;
        this.stats.startTime = new Date();

        console.log(`\n🚀 Starting batch augmentation`);
        console.log(`📊 Total items: ${items.length}`);
        console.log(`📦 Batch size: ${batchSize}\n`);

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(items.length / batchSize);

            console.log(`${'='.repeat(60)}`);
            console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
            console.log(`${'='.repeat(60)}`);

            for (const item of batch) {
                const result = await this.processItem(item, options);

                if (result.success) {
                    this.stats.processed++;
                    console.log(`✅ [${this.stats.processed}/${this.stats.total}] ${item.label || item.id}`);
                } else {
                    this.stats.failed++;
                    console.log(`❌ [${this.stats.processed + this.stats.failed}/${this.stats.total}] ${item.label || item.id}: ${result.error}`);
                }
            }

            // Small delay between batches to avoid overwhelming services
            if (i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        this.stats.endTime = new Date();
    }

    /**
     * Display final statistics
     */
    displayStats() {
        const duration = this.stats.endTime - this.stats.startTime;
        const avgTime = this.stats.processed > 0 ? Math.round(duration / this.stats.processed) : 0;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 AUGMENTATION COMPLETE`);
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ Processed: ${this.stats.processed}/${this.stats.total}`);
        console.log(`❌ Failed: ${this.stats.failed}`);
        console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
        console.log(`⚡ Avg time per item: ${avgTime}ms`);
        console.log(`${'='.repeat(60)}\n`);
    }

    async cleanup() {
        try {
            if (this.simpleVerbsService?.memoryManager) {
                await this.simpleVerbsService.memoryManager.dispose();
            }
            if (this.store?.sparqlExecute) {
                await this.store.sparqlExecute.dispose();
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Warning: Cleanup failed:', error.message);
        }
    }

    async run() {
        const args = this.parseArguments();

        // Set log level
        if (args.verbose) {
            logger.setLevel('debug');
        } else {
            logger.setLevel('info');
        }

        if (args.help) {
            this.showHelp();
            return;
        }

        try {
            await this.initialize();

            const limit = args.limit ? parseInt(args.limit) : 10;
            const batchSize = args['batch-size'] ? parseInt(args['batch-size']) : 5;

            // Find lazy items
            console.log('🔍 Finding lazy content...\n');
            const items = await this.findLazyItems({
                limit,
                type: args.type,
                id: args.id
            });

            if (items.length === 0) {
                console.log('📭 No lazy content found to process\n');
                return;
            }

            console.log(`📋 Found ${items.length} lazy items`);

            // Dry run mode
            if (args['dry-run']) {
                console.log('\n🧪 DRY RUN - Preview only\n');
                items.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.label || item.id}`);
                    console.log(`   Type: ${item.type || 'unknown'}`);
                    console.log(`   Content: ${item.content?.substring(0, 100)}...`);
                    console.log('');
                });
                console.log(`\n✅ Would process ${items.length} items\n`);
                return;
            }

            // Process items
            await this.processBatch(items, {
                batchSize,
                verbose: args.verbose
            });

            // Display statistics
            this.displayStats();

        } catch (error) {
            console.error('\n💥 Execution failed:', error.message);
            if (args.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            await this.cleanup();
            console.log('🔚 Exiting...');
            process.exit(0);
        }
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new AugmentLazyContentCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}