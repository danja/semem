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
import { createRequire } from 'module';
import SPARQLHelper from './SPARQLHelper.js';

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
    console.log(`  ${chalk.cyan('--graph <uri>')}      Graph URI to clear (default: http://purl.org/stuff/beerqa/test)`);
    console.log(`  ${chalk.cyan('--confirm')}          Skip confirmation prompt`);
    console.log(`  ${chalk.cyan('--help, -h')}         Show this help message`);
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Uses same SPARQL endpoint and credentials as other BeerQA scripts');
    console.log('  (https://fuseki.hyperdata.it/hyperdata.it/update with admin credentials)');
    console.log('');
    console.log(chalk.bold.white('Examples:'));
    console.log(`  ${chalk.gray('# Clear BeerQA graph (default)')}`);
    console.log(`  ${chalk.cyan('node ClearGraph.js --confirm')}`);
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
        graphURI: 'http://purl.org/stuff/beerqa/test',
        confirm: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--graph':
                options.graphURI = args[++i];
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

    return options;
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(graphURI) {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(chalk.bold.yellow('⚠️  WARNING: This will permanently delete ALL data in the graph!'));
        console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(graphURI)}`);
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
 * Clear the specified graph
 */
async function clearGraph(options) {
    try {
        // Use same configuration pattern as other BeerQA scripts
        console.log(chalk.yellow('⚙️  Loading configuration...'));
        
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            timeout: 60000
        };

        const endpoint = {
            query: config.sparqlEndpoint.replace('/update', '/query'),
            update: config.sparqlEndpoint
        };

        const auth = config.sparqlAuth;

        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(endpoint.update, {
            auth: auth,
            timeout: config.timeout
        });
        
        console.log(chalk.green('✅ Configuration loaded successfully'));

        // Display configuration
        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(options.graphURI)}`);
        console.log(`   ${chalk.cyan('SPARQL Query Endpoint:')} ${chalk.white(endpoint.query)}`);
        console.log(`   ${chalk.cyan('SPARQL Update Endpoint:')} ${chalk.white(endpoint.update)}`);
        console.log(`   ${chalk.cyan('Authentication:')} ${chalk.white(auth.user + ':' + '*'.repeat(auth.password.length))}`);
        console.log('');

        // Count existing triples
        console.log(chalk.yellow('🔍 Checking graph contents...'));
        const tripleCount = await countTriples(endpoint.query, auth, options.graphURI);
        
        if (tripleCount !== null) {
            console.log(`   ${chalk.cyan('Current triples:')} ${chalk.white(tripleCount.toLocaleString())}`);
            
            if (tripleCount === 0) {
                console.log(chalk.green('✅ Graph is already empty - nothing to clear!'));
                return { success: true, message: 'Graph was already empty' };
            }
        } else {
            console.log(`   ${chalk.yellow('⚠️  Could not count triples (graph may not exist)')}`);
        }
        console.log('');

        // Confirmation prompt (unless --confirm flag is used)
        if (!options.confirm) {
            const confirmed = await promptConfirmation(options.graphURI);
            if (!confirmed) {
                console.log(chalk.yellow('❌ Operation cancelled by user'));
                return { success: false, message: 'Cancelled by user' };
            }
            console.log('');
        }

        // Execute clear operation
        console.log(chalk.yellow('🗑️  Clearing graph...'));
        const startTime = Date.now();
        
        const clearQuery = `CLEAR GRAPH <${options.graphURI}>`;
        const result = await sparqlHelper.executeUpdate(clearQuery);
        
        const duration = Date.now() - startTime;

        if (result.success) {
            console.log(chalk.bold.green(`✅ Graph cleared successfully in ${duration}ms!`));
            
            // Verify the clear operation
            console.log(chalk.yellow('🔍 Verifying graph is empty...'));
            const remainingCount = await countTriples(endpoint.query, auth, options.graphURI);
            
            if (remainingCount !== null) {
                if (remainingCount === 0) {
                    console.log(chalk.green('✅ Verification passed - graph is now empty'));
                } else {
                    console.log(chalk.red(`❌ Verification failed - ${remainingCount} triples remain`));
                }
            }
            
            return { success: true, message: 'Graph cleared successfully', duration };
        } else {
            console.log(chalk.bold.red('❌ Failed to clear graph!'));
            console.log(chalk.red('Error:', result.error));
            return { success: false, error: result.error };
        }

    } catch (error) {
        console.log(chalk.bold.red('💥 Clear operation failed!'));
        console.log(chalk.red('Error:', error.message));
        
        console.log('');
        console.log(chalk.bold.yellow('💡 Troubleshooting Tips:'));
        console.log(`   • Verify the SPARQL endpoint is accessible`);
        console.log(`   • Check authentication credentials in config/config.json`);
        console.log(`   • Ensure the graph URI is correct: ${chalk.cyan(options.graphURI)}`);
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
        console.log(chalk.white(`The graph ${options.graphURI} is now empty and ready for new data.`));
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