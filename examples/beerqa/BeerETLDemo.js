#!/usr/bin/env node

/**
 * BeerETL Demo - Demonstration of BeerQA dataset ETL process
 * 
 * This demo shows how to extract BeerQA data, transform it to RDF corpuscles
 * using the Ragno vocabulary, and load it into a SPARQL store.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import BeerETL from './BeerETL.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('                    🍺 BEER QA ETL DEMO                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('        Extract, Transform, Load BeerQA to RDF Corpuscles    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(etl) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('Data Path:')} ${chalk.white(etl.options.dataPath)}`);
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(etl.options.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(etl.options.graphURI)}`);
    console.log(`   ${chalk.cyan('Base URI:')} ${chalk.white(etl.options.baseURI)}`);
    console.log(`   ${chalk.cyan('Batch Size:')} ${chalk.white(etl.options.batchSize)}`);
    console.log(`   ${chalk.cyan('Include Context:')} ${chalk.white(etl.options.includeContext ? 'Yes' : 'No')}`);
    console.log('');
}

/**
 * Display processing statistics
 */
function displayStatistics(stats) {
    console.log(chalk.bold.white('📊 Processing Statistics:'));
    console.log(`   ${chalk.cyan('Total Records:')} ${chalk.bold.green(stats.summary.totalRecords.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Processed Records:')} ${chalk.bold.green(stats.summary.processedRecords.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Generated Corpuscles:')} ${chalk.bold.green(stats.summary.generatedCorpuscles.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Generated Triples:')} ${chalk.bold.green(stats.summary.generatedTriples.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.bold.green(stats.summary.successRate)}`);
    console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.bold.green(stats.summary.processingTime)}`);
    console.log(`   ${chalk.cyan('Avg Triples/Corpuscle:')} ${chalk.bold.green(stats.summary.avgTriplesPerCorpuscle)}`);
    console.log('');
}

/**
 * Display sample results
 */
function displaySampleResults(results) {
    if (!results.results || !results.results.bindings || results.results.bindings.length === 0) {
        console.log(chalk.yellow('⚠️  No sample results available'));
        return;
    }

    console.log(chalk.bold.white('🔍 Sample Results from SPARQL Store:'));

    const bindings = results.results.bindings.slice(0, 5); // Show first 5

    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(binding.label?.value || 'No label')}`);
        console.log(`      ${chalk.gray('Source:')} ${chalk.white(binding.source?.value || 'Unknown')}`);
        console.log(`      ${chalk.gray('Answers:')} ${chalk.white(binding.answerCount?.value || 0)}, ${chalk.gray('Context:')} ${chalk.white(binding.contextCount?.value || 0)}`);
        console.log(`      ${chalk.gray('URI:')} ${chalk.dim(binding.corpuscle?.value || 'No URI')}`);
        console.log('');
    }
}

/**
 * Display errors if any
 */
function displayErrors(errors) {
    if (errors.length === 0) {
        console.log(chalk.bold.green('✅ No errors encountered!'));
        return;
    }

    console.log(chalk.bold.red(`❌ Errors Encountered (${errors.length}):`));

    const displayErrors = errors.slice(0, 5); // Show first 5 errors
    for (let i = 0; i < displayErrors.length; i++) {
        console.log(`   ${chalk.red('•')} ${chalk.white(displayErrors[i])}`);
    }

    if (errors.length > 5) {
        console.log(`   ${chalk.dim(`... and ${errors.length - 5} more errors`)}`);
    }
    console.log('');
}

/**
 * Main demo function
 */
async function runBeerETLDemo() {
    displayHeader();

    try {
        // Initialize BeerETL with configuration
        const etl = new BeerETL({
            dataPath: path.resolve('data/beerqa/beerqa_dev_v1.0.json'),
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            graphURI: 'http://purl.org/stuff/beerqa',
            baseURI: 'http://purl.org/stuff/beerqa/',
            batchSize: 10, // Small batches for demo
            includeContext: true
        });

        displayConfiguration(etl);

        console.log(chalk.bold.yellow('🚀 Starting BeerQA ETL Process...'));
        console.log(chalk.dim('This may take several minutes for the full dataset...'));
        console.log('');

        // Run the ETL process
        const result = await etl.process();

        if (result.success) {
            console.log(chalk.bold.green('✅ ETL Process Completed Successfully!'));
            console.log('');

            // Display statistics
            const report = etl.generateReport();
            displayStatistics(report);

            // Query and display sample results
            console.log(chalk.bold.yellow('🔍 Querying Sample Results...'));
            try {
                const sampleResults = await etl.queryCorpuscles(5);
                displaySampleResults(sampleResults);
            } catch (queryError) {
                console.log(chalk.yellow('⚠️  Could not query sample results:', queryError.message));
                console.log('');
            }

            // Display any errors
            if (report.errors && report.errors.length > 0) {
                displayErrors(report.errors);
            }

            // Summary
            console.log(chalk.bold.green('🎉 Demo Completed Successfully!'));
            console.log(chalk.white('The BeerQA dataset has been transformed into RDF corpuscles'));
            console.log(chalk.white('and loaded into the SPARQL store using the Ragno vocabulary.'));
            console.log('');
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • Query the data at: ${chalk.white(etl.options.sparqlEndpoint.replace('/update', '/query'))}`);
            console.log(`   • Explore the graph: ${chalk.white(etl.options.graphURI)}`);
            console.log(`   • Use Ragno tools for entity extraction and analysis`);
            console.log('');

        } else {
            console.log(chalk.bold.red('❌ ETL Process Failed!'));
            console.log(chalk.red('Error:', result.error));
            console.log('');

            const report = etl.generateReport();
            if (report.errors && report.errors.length > 0) {
                displayErrors(report.errors);
            }
        }

    } catch (error) {
        console.log(chalk.bold.red('💥 Demo Failed!'));
        console.log(chalk.red('Error:', error.message));
        console.log('');
        console.log(chalk.bold.yellow('💡 Troubleshooting Tips:'));
        console.log(`   • Ensure the data file exists: ${chalk.cyan('data/beerqa/beerqa_dev_v1.0.json')}`);
        console.log(`   • Check SPARQL endpoint is accessible`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check network connectivity`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node BeerETLDemo.js')} - Run the full ETL demo`);
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('dataPath')} - Path to BeerQA JSON file`);
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('sparqlAuth')} - Authentication credentials`);
    console.log(`  • ${chalk.cyan('graphURI')} - Target named graph URI`);
    console.log(`  • ${chalk.cyan('batchSize')} - Number of records per batch`);
    console.log('');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    displayHeader();
    showUsage();
    process.exit(0);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    runBeerETLDemo().catch(error => {
        console.error(chalk.red('Demo failed:', error.message));
        process.exit(1);
    });
}

export { runBeerETLDemo };