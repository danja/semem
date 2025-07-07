#!/usr/bin/env node

/**
 * ClearGraph.js - Utility to remove all triples from a named graph
 * 
 * This utility provides a simple way to clear all data from a specific
 * named graph in a SPARQL store. Useful for cleaning up test data or
 * resetting datasets before reloading.
 */

import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { createRequire } from 'module';
import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

const require = createRequire(import.meta.url);

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.red('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.red('║') + chalk.bold.white('                    🗑️  CLEAR GRAPH UTILITY                   ') + chalk.bold.red('║'));
    console.log(chalk.bold.red('║') + chalk.gray('           Remove all triples from a named graph           ') + chalk.bold.red('║'));
    console.log(chalk.bold.red('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node ClearGraph.js')} [options]`);
    console.log('');
    console.log(chalk.bold.white('Options:'));
    console.log(`  ${chalk.cyan('--config')}           Clear config graph (default: from config/config.json)`);
    console.log(`  ${chalk.cyan('--graph <uri>')}      Graph URI to clear (custom graph)`);
    console.log(`  ${chalk.cyan('--all-flow')}         Clear all Flow component graphs (beerqa + wikipedia + wikidata)`);
    console.log(`  ${chalk.cyan('--beerqa')}           Clear BeerQA test graph only`);
    console.log(`  ${chalk.cyan('--wikipedia')}        Clear Wikipedia research graph only`);
    console.log(`  ${chalk.cyan('--wikidata')}         Clear Wikidata research graph only`);
    console.log(`  ${chalk.cyan('--confirm')}          Skip confirmation prompt`);
    console.log(`  ${chalk.cyan('--help, -h')}         Show this help message`);
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Uses SPARQL endpoint and credentials from config/config.json');
    console.log('  Compatible with examples/flow/ component system');
    console.log('');
    console.log(chalk.bold.white('Default Flow Graphs:'));
    console.log(`  ${chalk.cyan('BeerQA:')} http://purl.org/stuff/beerqa/test`);
    console.log(`  ${chalk.cyan('Wikipedia:')} http://purl.org/stuff/wikipedia/research`);
    console.log(`  ${chalk.cyan('Wikidata:')} http://purl.org/stuff/wikidata/research`);
    console.log('');
    console.log(chalk.bold.white('Examples:'));
    console.log(`  ${chalk.gray('# Clear config graph (default)')}`);
    console.log(`  ${chalk.cyan('node ClearGraph.js --config --confirm')}`);
    console.log('');
    console.log(`  ${chalk.gray('# Clear all Flow component graphs')}`);
    console.log(`  ${chalk.cyan('node ClearGraph.js --all-flow --confirm')}`);
    console.log('');
    console.log(`  ${chalk.gray('# Clear only BeerQA test questions')}`);
    console.log(`  ${chalk.cyan('node ClearGraph.js --beerqa --confirm')}`);
    console.log('');
    console.log(`  ${chalk.gray('# Clear custom graph')}`);
    console.log(`  ${chalk.cyan('node ClearGraph.js --graph http://example.org/mygraph --confirm')}`);
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        mode: 'config', // Default to clearing config graph
        graphURI: null,
        confirm: false,
        help: false
    };

    // Flow component graph URIs (matching examples/flow/01-load-questions.js)
    const flowGraphs = {
        beerqa: 'http://purl.org/stuff/beerqa/test',
        wikipedia: 'http://purl.org/stuff/wikipedia/research',
        wikidata: 'http://purl.org/stuff/wikidata/research'
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--graph':
                options.mode = 'custom';
                options.graphURI = args[++i];
                break;
            case '--config':
                options.mode = 'config';
                break;
            case '--all-flow':
                options.mode = 'all-flow';
                break;
            case '--beerqa':
                options.mode = 'beerqa';
                options.graphURI = flowGraphs.beerqa;
                break;
            case '--wikipedia':
                options.mode = 'wikipedia';
                options.graphURI = flowGraphs.wikipedia;
                break;
            case '--wikidata':
                options.mode = 'wikidata';
                options.graphURI = flowGraphs.wikidata;
                break;
            case '--confirm':
                options.confirm = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                console.log(chalk.red(`Unknown option: ${arg}`));
                process.exit(1);
        }
    }

    // Set default graphs for each mode
    if (options.mode === 'all-flow') {
        options.graphURIs = Object.values(flowGraphs);
    } else if (options.mode === 'config') {
        // Will be resolved from config in main function
        options.graphURIs = null;
    } else if (options.graphURI) {
        options.graphURIs = [options.graphURI];
    }

    return options;
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(graphURIs) {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(chalk.bold.yellow('⚠️  WARNING: This will permanently delete ALL data from the following graphs!'));
        graphURIs.forEach(uri => {
            console.log(`   ${chalk.cyan('•')} ${chalk.white(uri)}`);
        });
        console.log('');

        rl.question(chalk.bold.red('Are you sure you want to continue? Type "yes" to confirm: '), (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Count triples in the graph before clearing
 */
async function countTriples(queryEndpoint, auth, graphURI) {
    const countQuery = `
        SELECT (COUNT(*) as ?count) 
        FROM <${graphURI}>
        WHERE { ?s ?p ?o }
    `;

    try {
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString('base64')}`
            },
            body: countQuery
        });

        if (!response.ok) {
            throw new Error(`Query failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const count = parseInt(result.results.bindings[0]?.count?.value || '0');
        return count;

    } catch (error) {
        logger.warn('Could not count triples:', error.message);
        return null;
    }
}

/**
 * Clear the specified graphs
 */
async function clearGraph(options) {
    try {
        // Use Config.js for configuration management (matching Flow components)
        console.log(chalk.yellow('⚙️  Loading configuration from config/config.json...'));

        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        const config = new Config(configPath);
        await config.init();

        // Resolve config graph if needed
        if (options.mode === 'config') {
            const configGraph = config.get('storage.options.graphName') || 
                              config.get('graphName') || 
                              'http://tensegrity.it/semem';
            options.graphURIs = [configGraph];
            console.log(chalk.cyan(`Using graph from config: ${configGraph}`));
        }

        const storageOptions = config.get('storage.options');
        const sparqlConfig = {
            sparqlEndpoint: storageOptions.update,
            sparqlAuth: {
                user: storageOptions.user,
                password: storageOptions.password
            },
            timeout: 60000
        };

        const endpoint = {
            query: sparqlConfig.sparqlEndpoint.replace('/update', '/query'),
            update: sparqlConfig.sparqlEndpoint
        };

        const auth = sparqlConfig.sparqlAuth;

        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(endpoint.update, {
            auth: auth,
            timeout: sparqlConfig.timeout
        });

        console.log(chalk.green('✅ Configuration loaded successfully'));

        // Display configuration
        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('Mode:')} ${chalk.white(options.mode)}`);
        console.log(`   ${chalk.cyan('Graphs to clear:')} ${chalk.white(options.graphURIs.length)}`);
        options.graphURIs.forEach(uri => {
            console.log(`     ${chalk.cyan('•')} ${chalk.white(uri)}`);
        });
        console.log(`   ${chalk.cyan('SPARQL Query Endpoint:')} ${chalk.white(endpoint.query)}`);
        console.log(`   ${chalk.cyan('SPARQL Update Endpoint:')} ${chalk.white(endpoint.update)}`);
        console.log(`   ${chalk.cyan('Authentication:')} ${chalk.white(auth.user + ':' + '*'.repeat(auth.password.length))}`);
        console.log('');

        // Count existing triples for all graphs
        console.log(chalk.yellow('🔍 Checking graph contents...'));
        let totalTriples = 0;
        const graphStats = [];

        for (const graphURI of options.graphURIs) {
            const tripleCount = await countTriples(endpoint.query, auth, graphURI);
            if (tripleCount !== null) {
                totalTriples += tripleCount;
                graphStats.push({ uri: graphURI, count: tripleCount });
                console.log(`   ${chalk.cyan('•')} ${chalk.white(graphURI)}: ${chalk.white(tripleCount.toLocaleString())} triples`);
            } else {
                graphStats.push({ uri: graphURI, count: null });
                console.log(`   ${chalk.cyan('•')} ${chalk.white(graphURI)}: ${chalk.yellow('Could not count (may not exist)')}`);
            }
        }

        console.log(`   ${chalk.cyan('Total triples:')} ${chalk.white(totalTriples.toLocaleString())}`);
        console.log('');

        if (totalTriples === 0) {
            console.log(chalk.green('✅ All graphs are already empty - nothing to clear!'));
            return { success: true, message: 'All graphs were already empty' };
        }

        // Confirmation prompt (unless --confirm flag is used)
        if (!options.confirm) {
            const confirmed = await promptConfirmation(options.graphURIs);
            if (!confirmed) {
                console.log(chalk.yellow('❌ Operation cancelled by user'));
                return { success: false, message: 'Cancelled by user' };
            }
            console.log('');
        }

        // Execute clear operations for all graphs
        console.log(chalk.yellow('🗑️  Clearing graphs...'));
        const startTime = Date.now();
        let clearedCount = 0;
        const results = [];

        for (const graphURI of options.graphURIs) {
            console.log(chalk.cyan(`   Clearing: ${graphURI}`));
            const clearQuery = `CLEAR GRAPH <${graphURI}>`;
            const result = await sparqlHelper.executeUpdate(clearQuery);

            if (result.success) {
                console.log(chalk.green(`   ✅ Cleared successfully`));
                clearedCount++;
                results.push({ uri: graphURI, success: true });
            } else {
                console.log(chalk.red(`   ❌ Failed: ${result.error}`));
                results.push({ uri: graphURI, success: false, error: result.error });
            }
        }

        const duration = Date.now() - startTime;

        if (clearedCount === options.graphURIs.length) {
            console.log(chalk.bold.green(`✅ All ${clearedCount} graphs cleared successfully in ${duration}ms!`));

            // Verify the clear operations
            console.log(chalk.yellow('🔍 Verifying graphs are empty...'));
            let allEmpty = true;

            for (const graphURI of options.graphURIs) {
                const remainingCount = await countTriples(endpoint.query, auth, graphURI);
                if (remainingCount !== null && remainingCount > 0) {
                    console.log(chalk.red(`   ❌ ${graphURI}: ${remainingCount} triples remain`));
                    allEmpty = false;
                } else {
                    console.log(chalk.green(`   ✅ ${graphURI}: empty`));
                }
            }

            if (allEmpty) {
                console.log(chalk.green('✅ Verification passed - all graphs are now empty'));
            }

            return { success: true, message: `${clearedCount} graphs cleared successfully`, duration, results };
        } else {
            console.log(chalk.bold.yellow(`⚠️  Partially completed: ${clearedCount}/${options.graphURIs.length} graphs cleared`));
            return { success: false, message: 'Some graphs failed to clear', results };
        }

    } catch (error) {
        console.log(chalk.bold.red('💥 Clear operation failed!'));
        console.log(chalk.red('Error:', error.message));

        console.log('');
        console.log(chalk.bold.yellow('💡 Troubleshooting Tips:'));
        console.log(`   • Verify the SPARQL endpoint is accessible`);
        console.log(`   • Check authentication credentials in config/config.json`);
        console.log(`   • Ensure the graph URIs are correct`);
        console.log(`   • Verify network connectivity`);

        return { success: false, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    displayHeader();

    const options = parseArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    const result = await clearGraph(options);

    if (result.success) {
        console.log('');
        console.log(chalk.bold.green('🎉 Clear operation completed successfully!'));
        if (options.mode === 'config') {
            console.log(chalk.white(`The config graph ${options.graphURIs[0]} is now empty and ready for new data.`));
            console.log(chalk.gray('You can now run: node examples/document/LoadPDFs.js'));
        } else if (options.mode === 'all-flow') {
            console.log(chalk.white('All Flow component graphs are now empty and ready for new data.'));
            console.log(chalk.gray('You can now run: node examples/flow/run-pipeline.js --limit 10'));
        } else if (options.graphURIs.length === 1) {
            console.log(chalk.white(`The graph ${options.graphURIs[0]} is now empty and ready for new data.`));
        } else {
            console.log(chalk.white(`${options.graphURIs.length} graphs are now empty and ready for new data.`));
        }
    } else {
        console.log('');
        console.log(chalk.bold.red('❌ Clear operation failed!'));
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Operation cancelled by user'));
    process.exit(0);
});

// Run the utility
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}

export { clearGraph, main as runClearGraph };