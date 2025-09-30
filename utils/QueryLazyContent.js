#!/usr/bin/env node

/**
 * Query Lazy Content Utility
 *
 * Simple tool to query and display content stored with lazy processing status
 */

import { parseArgs } from 'util';
import Config from '../src/Config.js';
import SPARQLStore from '../src/stores/SPARQLStore.js';

class QueryLazyContentCLI {
    constructor() {
        this.config = null;
        this.store = null;
    }

    async initialize() {
        try {
            const configPath = process.cwd().endsWith('/utils')
                ? '../config/config.json'
                : 'config/config.json';

            this.config = new Config(configPath);
            await this.config.init();

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

            console.log('✅ Query Lazy Content CLI initialized');
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
                description: 'Maximum number of items to show (default: 10)'
            },
            graph: {
                type: 'string',
                short: 'g',
                description: 'Graph URI to query'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Show full content'
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
📋 Query Lazy Content Utility

USAGE:
  node QueryLazyContent.js [OPTIONS]

OPTIONS:
  -l, --limit <number>    Maximum items to show (default: 10)
  -g, --graph <uri>       Graph URI to query
  -v, --verbose           Show full content
  -h, --help              Show this help

EXAMPLES:
  # Show first 10 lazy items
  node QueryLazyContent.js

  # Show first 20 lazy items with full content
  node QueryLazyContent.js --limit 20 --verbose

  # Query specific graph
  node QueryLazyContent.js --graph "http://hyperdata.it/content"
`);
    }

    async queryLazyContent(options = {}) {
        const { limit = 10, verbose = false } = options;

        try {
            console.log('\n🔍 Querying lazy content...\n');

            // Use findLazyContent if available, otherwise query directly
            let results;
            if (typeof this.store.findLazyContent === 'function') {
                results = await this.store.findLazyContent(limit);
            } else {
                // Fallback: direct SPARQL query
                const query = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX semem: <http://purl.org/stuff/semem/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX dcterms: <http://purl.org/dc/terms/>

                    SELECT ?element ?content ?label ?type ?created WHERE {
                        GRAPH <${this.store.graphName}> {
                            ?element semem:processingStatus "lazy" ;
                                     ragno:content ?content .
                            OPTIONAL { ?element rdfs:label ?label }
                            OPTIONAL { ?element ragno:subType ?type }
                            OPTIONAL { ?element dcterms:created ?created }
                        }
                    }
                    ORDER BY DESC(?created)
                    LIMIT ${limit}
                `;

                const response = await this.store.sparqlExecute.executeSparqlQuery(query);
                results = response.results.bindings.map(binding => ({
                    id: binding.element?.value,
                    content: binding.content?.value,
                    label: binding.label?.value,
                    type: binding.type?.value,
                    created: binding.created?.value
                }));
            }

            if (results.length === 0) {
                console.log('📭 No lazy content found\n');
                return;
            }

            console.log(`📊 Found ${results.length} lazy items:\n`);

            results.forEach((item, index) => {
                console.log(`${'='.repeat(60)}`);
                console.log(`📄 Item ${index + 1}:`);
                console.log(`   ID: ${item.id}`);
                console.log(`   Label: ${item.label || '(no label)'}`);
                console.log(`   Type: ${item.type || '(no type)'}`);
                console.log(`   Created: ${item.created || '(no date)'}`);

                if (verbose) {
                    console.log(`   Content:\n${item.content}`);
                } else {
                    const preview = item.content?.substring(0, 150) || '';
                    console.log(`   Preview: ${preview}${item.content?.length > 150 ? '...' : ''}`);
                }
                console.log('');
            });

            console.log(`${'='.repeat(60)}\n`);
            console.log(`✅ Total: ${results.length} lazy items\n`);

        } catch (error) {
            console.error('❌ Query failed:', error.message);
            throw error;
        }
    }

    async run() {
        const args = this.parseArguments();

        if (args.help) {
            this.showHelp();
            return;
        }

        try {
            await this.initialize();
            await this.queryLazyContent({
                limit: args.limit ? parseInt(args.limit) : 10,
                verbose: args.verbose || false
            });
        } catch (error) {
            console.error('\n💥 Execution failed:', error.message);
            process.exit(1);
        } finally {
            // Cleanup
            if (this.store?.sparqlExecute) {
                await this.store.sparqlExecute.dispose();
            }
            process.exit(0);
        }
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new QueryLazyContentCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}