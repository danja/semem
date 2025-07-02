#!/usr/bin/env node

/**
 * Wikipedia Demo - Complete pipeline for Wikipedia search ingestion and corpuscle creation
 * 
 * This demo shows the complete Wikipedia processing pipeline:
 * 1. Search Wikipedia for a query
 * 2. Ingest search results as ragno:Unit instances with ragno:Entity and ragno:TextElement
 * 3. Transform units to ragno:Corpuscle instances with embeddings and relationships
 */

import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../src/Config.js';
import WikipediaSearch from '../../src/aux/wikipedia/Search.js';
import UnitsToCorpuscles from '../../src/aux/wikipedia/UnitsToCorpuscles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('                   📚 WIKIPEDIA DEMO                        ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('        Search, Ingest, and Transform to Corpuscles         ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(config.graphURI)}`);
    console.log(`   ${chalk.cyan('Base URI:')} ${chalk.white(config.baseURI)}`);
    console.log(`   ${chalk.cyan('Search Delay:')} ${chalk.white(config.searchDelay + 'ms')}`);
    console.log(`   ${chalk.cyan('Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Enabled' : 'Disabled')}`);
    console.log('');
}

/**
 * Display search results
 */
function displaySearchResults(searchObject) {
    console.log(chalk.bold.white('🔍 Wikipedia Search Results:'));
    console.log(`   ${chalk.cyan('Query:')} ${chalk.white(searchObject.query)}`);
    console.log(`   ${chalk.cyan('Results Found:')} ${chalk.bold.green(searchObject.results.length)}`);
    console.log(`   ${chalk.cyan('Total Hits:')} ${chalk.bold.green(searchObject.totalHits.toLocaleString())}`);
    console.log('');
    
    // Show first few results
    const displayCount = Math.min(3, searchObject.results.length);
    for (let i = 0; i < displayCount; i++) {
        const result = searchObject.results[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(result.title)}`);
        console.log(`      ${chalk.gray('Snippet:')} ${chalk.white(result.snippet.replace(/<[^>]*>/g, '').substring(0, 100))}...`);
        console.log(`      ${chalk.gray('Word Count:')} ${chalk.white(result.wordcount || 'N/A')}`);
        console.log('');
    }
    
    if (searchObject.results.length > displayCount) {
        console.log(`   ${chalk.dim(`... and ${searchObject.results.length - displayCount} more results`)}`);
        console.log('');
    }
}

/**
 * Display ingestion statistics
 */
function displayIngestionStats(report) {
    console.log(chalk.bold.white('📊 Ingestion Statistics:'));
    console.log(`   ${chalk.cyan('Processed Results:')} ${chalk.bold.green(report.summary.processedResults)}`);
    console.log(`   ${chalk.cyan('Generated Units:')} ${chalk.bold.green(report.summary.generatedUnits)}`);
    console.log(`   ${chalk.cyan('Generated Triples:')} ${chalk.bold.green(report.summary.generatedTriples.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.bold.green(report.summary.successRate)}`);
    console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.bold.green(report.summary.processingTime)}`);
    console.log(`   ${chalk.cyan('Avg Triples/Unit:')} ${chalk.bold.green(report.summary.avgTriplesPerUnit)}`);
    console.log('');
}

/**
 * Display corpuscle creation statistics
 */
function displayCorpuscleStats(report) {
    console.log(chalk.bold.white('📈 Corpuscle Creation Statistics:'));
    console.log(`   ${chalk.cyan('Units Processed:')} ${chalk.bold.green(report.summary.processedUnits)}`);
    console.log(`   ${chalk.cyan('Corpuscles Created:')} ${chalk.bold.green(report.summary.generatedCorpuscles)}`);
    console.log(`   ${chalk.cyan('Relationships Created:')} ${chalk.bold.green(report.summary.generatedRelationships)}`);
    console.log(`   ${chalk.cyan('Embeddings Generated:')} ${chalk.bold.green(report.summary.generatedEmbeddings)}`);
    console.log(`   ${chalk.cyan('Generated Triples:')} ${chalk.bold.green(report.summary.generatedTriples.toLocaleString())}`);
    console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.bold.green(report.summary.successRate)}`);
    console.log(`   ${chalk.cyan('Embedding Success Rate:')} ${chalk.bold.green(report.summary.embeddingSuccessRate)}`);
    console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.bold.green(report.summary.processingTime)}`);
    console.log('');
}

/**
 * Display sample units or corpuscles
 */
function displaySampleResults(results, type = 'units') {
    if (!results.results || !results.results.bindings || results.results.bindings.length === 0) {
        console.log(chalk.yellow(`⚠️  No sample ${type} available`));
        return;
    }

    console.log(chalk.bold.white(`🔍 Sample ${type.charAt(0).toUpperCase() + type.slice(1)} from SPARQL Store:`));

    const bindings = results.results.bindings.slice(0, 3);

    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        if (type === 'units') {
            console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(binding.label?.value || 'No label')}`);
            console.log(`      ${chalk.gray('Query:')} ${chalk.white(binding.query?.value || 'N/A')}`);
            console.log(`      ${chalk.gray('Namespace:')} ${chalk.white(binding.namespace?.value || 'N/A')}`);
            console.log(`      ${chalk.gray('URI:')} ${chalk.dim(binding.unit?.value || 'No URI')}`);
        } else {
            console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(binding.label?.value || 'No label')}`);
            console.log(`      ${chalk.gray('Source Unit:')} ${chalk.white(binding.unitLabel?.value || 'N/A')}`);
            console.log(`      ${chalk.gray('Has Embedding:')} ${chalk.white(binding.hasEmbedding?.value === 'true' ? 'Yes' : 'No')}`);
            console.log(`      ${chalk.gray('URI:')} ${chalk.dim(binding.corpuscle?.value || 'No URI')}`);
        }
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

    const displayErrors = errors.slice(0, 3);
    for (let i = 0; i < displayErrors.length; i++) {
        console.log(`   ${chalk.red('•')} ${chalk.white(displayErrors[i])}`);
    }

    if (errors.length > 3) {
        console.log(`   ${chalk.dim(`... and ${errors.length - 3} more errors`)}`);
    }
    console.log('');
}

/**
 * Main demo function
 */
async function runWikipediaDemo() {
    displayHeader();

    // Load configuration from Config.js
    const configPath = path.resolve(path.dirname(path.dirname(__dirname)), 'config', 'config.json');
    const systemConfig = new Config(configPath);
    await systemConfig.init();
    
    // Get performance configuration
    const performanceConfig = systemConfig.get('performance.wikipedia') || {};
    
    // Configuration with performance optimizations
    const config = {
        sparqlEndpoint: systemConfig.get('sparqlUpdateEndpoint') || 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: systemConfig.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
        graphURI: 'http://purl.org/stuff/wikipedia',
        baseURI: 'http://purl.org/stuff/wikipedia/',
        searchDelay: performanceConfig.rateLimit || 200, // Use performance config
        generateEmbeddings: true,
        searchLimit: performanceConfig.searchResultsLimit || 5, // Use performance config
        defaultSearchLimit: performanceConfig.searchResultsLimit || 10,
        rateLimit: performanceConfig.rateLimit || 200
    };
    
    console.log(chalk.gray(`🚀 Demo using performance config: ${config.searchLimit} results, ${config.searchDelay}ms rate limit`));

    displayConfiguration(config);

    try {
        // Phase 1: Wikipedia Search and Ingestion
        console.log(chalk.bold.yellow('🔍 Phase 1: Wikipedia Search and Ingestion'));
        console.log(chalk.dim('Searching Wikipedia and converting results to RDF units...'));
        console.log('');

        const wikipediaSearch = new WikipediaSearch(config);
        
        // Search for an interesting topic
        const searchQuery = 'semantic web ontology RDF SPARQL';
        console.log(chalk.cyan(`Searching for: "${searchQuery}"`));
        
        const searchObject = await wikipediaSearch.search(searchQuery, { 
            delay: config.searchDelay,
            limit: config.searchLimit
        });
        
        displaySearchResults(searchObject);

        // Ingest search results
        console.log(chalk.cyan('Ingesting search results as RDF units...'));
        const ingestionResult = await wikipediaSearch.ingest(searchObject);
        
        if (ingestionResult.success) {
            console.log(chalk.bold.green('✅ Ingestion Completed Successfully!'));
            console.log('');
            
            const ingestionReport = wikipediaSearch.generateReport();
            displayIngestionStats(ingestionReport);
            
            // Query sample units
            console.log(chalk.bold.yellow('🔍 Querying Sample Units...'));
            try {
                const sampleUnits = await wikipediaSearch.queryUnits(3);
                displaySampleResults(sampleUnits, 'units');
            } catch (queryError) {
                console.log(chalk.yellow('⚠️  Could not query sample units:', queryError.message));
                console.log('');
            }
        } else {
            console.log(chalk.bold.red('❌ Ingestion Failed!'));
            console.log(chalk.red('Error:', ingestionResult.error));
            console.log('');
            return;
        }

        // Phase 2: Units to Corpuscles Transformation
        console.log(chalk.bold.yellow('🔄 Phase 2: Units to Corpuscles Transformation'));
        console.log(chalk.dim('Converting units to corpuscles with embeddings and relationships...'));
        console.log('');

        const unitsToCorpuscles = new UnitsToCorpuscles(config);
        
        console.log(chalk.cyan('Finding units without corpuscles and creating them...'));
        const corpuscleResult = await unitsToCorpuscles.process();
        
        // Get reports from both phases
        const ingestionReport = wikipediaSearch.generateReport();
        
        if (corpuscleResult.success) {
            console.log(chalk.bold.green('✅ Corpuscle Creation Completed Successfully!'));
            console.log('');
            
            const corpuscleReport = unitsToCorpuscles.generateReport();
            displayCorpuscleStats(corpuscleReport);
            
            // Query sample corpuscles
            console.log(chalk.bold.yellow('🔍 Querying Sample Corpuscles...'));
            try {
                const sampleCorpuscles = await unitsToCorpuscles.queryCorpuscles(3);
                displaySampleResults(sampleCorpuscles, 'corpuscles');
            } catch (queryError) {
                console.log(chalk.yellow('⚠️  Could not query sample corpuscles:', queryError.message));
                console.log('');
            }
            
            // Display any errors from both phases
            const allErrors = [
                ...(ingestionReport.errors || []),
                ...(corpuscleReport.errors || [])
            ];
            
            if (allErrors.length > 0) {
                displayErrors(allErrors);
            } else {
                console.log(chalk.bold.green('✅ No errors encountered in either phase!'));
                console.log('');
            }
            
        } else {
            console.log(chalk.bold.red('❌ Corpuscle Creation Failed!'));
            console.log(chalk.red('Error:', corpuscleResult.error));
            console.log('');
            
            // Show ingestion results
            if (ingestionReport.errors && ingestionReport.errors.length > 0) {
                displayErrors(ingestionReport.errors);
            }
        }

        // Summary
        console.log(chalk.bold.green('🎉 Wikipedia Demo Completed!'));
        console.log(chalk.white('Wikipedia search results have been processed through the complete pipeline:'));
        console.log(`   • ${chalk.white('Search:')} ${chalk.cyan(searchQuery)}`);
        console.log(`   • ${chalk.white('Results ingested as:')} ${chalk.cyan('ragno:Unit + ragno:Entity + ragno:TextElement')}`);
        console.log(`   • ${chalk.white('Transformed to:')} ${chalk.cyan('ragno:Corpuscle + ragno:Relationship + ragno:Attribute')}`);
        console.log(`   • ${chalk.white('Stored in graph:')} ${chalk.cyan(config.graphURI)}`);
        console.log('');
        console.log(chalk.bold.cyan('Next Steps:'));
        console.log(`   • Query the data at: ${chalk.white(config.sparqlEndpoint.replace('/update', '/query'))}`);
        console.log(`   • Explore units: ${chalk.white('SELECT * WHERE { ?s a ragno:Unit } LIMIT 10')}`);
        console.log(`   • Explore corpuscles: ${chalk.white('SELECT * WHERE { ?s a ragno:Corpuscle } LIMIT 10')}`);
        console.log(`   • Find relationships: ${chalk.white('SELECT * WHERE { ?s a ragno:Relationship } LIMIT 10')}`);
        console.log('');

    } catch (error) {
        console.log(chalk.bold.red('💥 Demo Failed!'));
        console.log(chalk.red('Error:', error.message));
        console.log('');
        console.log(chalk.bold.yellow('💡 Troubleshooting Tips:'));
        console.log(`   • Check SPARQL endpoint is accessible: ${chalk.cyan(config.sparqlEndpoint)}`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check network connectivity to Wikipedia API`);
        console.log(`   • Ensure Ollama/embedding service is running if embeddings enabled`);
        console.log(`   • Check that required dependencies are installed`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node WikipediaDemo.js')} - Run the complete Wikipedia demo`);
    console.log('');
    console.log(chalk.bold.white('What this demo does:'));
    console.log('  1. Searches Wikipedia for "semantic web ontology RDF SPARQL"');
    console.log('  2. Ingests search results as ragno:Unit instances with entities and text elements');
    console.log('  3. Finds units without corpuscles and creates them');
    console.log('  4. Generates embeddings for text snippets (if embeddings enabled)');
    console.log('  5. Creates relationships between units and corpuscles');
    console.log('  6. Stores everything in the SPARQL store using Ragno vocabulary');
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('sparqlAuth')} - Authentication credentials`);
    console.log(`  • ${chalk.cyan('graphURI')} - Target named graph URI`);
    console.log(`  • ${chalk.cyan('searchDelay')} - Rate limiting between requests`);
    console.log(`  • ${chalk.cyan('generateEmbeddings')} - Enable/disable embedding generation`);
    console.log('');
    console.log(chalk.bold.yellow('Requirements:'));
    console.log('  • SPARQL endpoint (Apache Fuseki or similar)');
    console.log('  • Network access to Wikipedia API');
    console.log('  • Ollama or compatible embedding service (if embeddings enabled)');
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
    runWikipediaDemo().catch(error => {
        console.error(chalk.red('Wikipedia demo failed:', error.message));
        process.exit(1);
    });
}

export { runWikipediaDemo, WikipediaSearch, UnitsToCorpuscles };