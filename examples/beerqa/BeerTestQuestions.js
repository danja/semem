#!/usr/bin/env node

/**
 * BeerTestQuestions - ETL process for BeerQA Test Questions Dataset
 * 
 * This demo shows how to extract BeerQA test questions data, transform it to RDF corpuscles
 * using the Ragno vocabulary, and load it into a SPARQL store. This reuses the existing
 * BeerETL infrastructure but processes the test questions dataset.
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
    console.log(chalk.bold.blue('║') + chalk.bold.white('               🍺 BEER QA TEST QUESTIONS ETL                 ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('       Extract, Transform, Load Test Questions to RDF        ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('Number of Batches:')} ${chalk.white(etl.options.nBatches !== null ? etl.options.nBatches : 'All')}`);
    console.log(`   ${chalk.cyan('Total Records:')} ${chalk.white(etl.options.nBatches !== null ? etl.options.nBatches * etl.options.batchSize : 'All')}`);
    console.log(`   ${chalk.cyan('Rate Limit:')} ${chalk.white(etl.options.rateLimit + 'ms')}`);
    console.log(`   ${chalk.cyan('Include Context:')} ${chalk.white(etl.options.includeContext ? 'Yes' : 'No')}`);
    console.log(`   ${chalk.cyan('Dataset Type:')} ${chalk.bold.yellow('Test Questions')}`);
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

    console.log(chalk.bold.white('🔍 Sample Test Questions from SPARQL Store:'));

    const bindings = results.results.bindings.slice(0, 5); // Show first 5

    for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(binding.label?.value || 'No label')}`);
        console.log(`      ${chalk.gray('Source:')} ${chalk.white(binding.source?.value || 'Test Questions')}`);
        console.log(`      ${chalk.gray('Type:')} ${chalk.white('Question Only (No Answers/Context)')}`);
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
 * Custom ETL class for test questions that extends BeerETL
 */
class BeerTestQuestionsETL extends BeerETL {
    constructor(options = {}) {
        // Override defaults for test questions
        const testOptions = {
            ...options,
            // Use different graph for test questions
            graphURI: options.graphURI || 'http://purl.org/stuff/beerqa/test',
            baseURI: options.baseURI || 'http://purl.org/stuff/beerqa/test/',
            // Test questions don't have answers/context by default
            includeContext: false,
            ...options
        };
        
        super(testOptions);
    }

    /**
     * Override transform method to handle test questions format
     * Test questions typically only have id and question fields
     */
    async transformToCorpuscles(data) {
        logger.info(`Transforming ${data.length} test questions to RDF corpuscles...`);
        
        const corpuscles = [];
        this.stats.totalRecords = data.length;

        for (let i = 0; i < data.length; i++) {
            try {
                const record = data[i];
                
                // Create corpuscle for test question
                const corpuscle = await this.createTestQuestionCorpuscle(record, i);
                corpuscles.push(corpuscle);
                
                this.stats.processedRecords++;
                this.stats.generatedCorpuscles++;
                
                // Log progress periodically
                if ((i + 1) % 100 === 0) {
                    logger.info(`Processed ${i + 1}/${data.length} test questions...`);
                }
                
            } catch (error) {
                logger.error(`Error transforming record ${i}:`, error);
                this.stats.errors.push(`Record ${i}: ${error.message}`);
            }
        }

        logger.info(`Successfully transformed ${corpuscles.length} test questions to corpuscles`);
        return corpuscles;
    }

    /**
     * Create RDF corpuscle for a test question using the same approach as BeerETL
     */
    async createTestQuestionCorpuscle(record, index) {
        // Generate URIs using the same pattern as BeerETL
        const corpuscleURI = `${this.options.baseURI}corpuscle/${record.id}`;
        const questionURI = `${this.options.baseURI}question/${record.id}`;
        
        // Create main corpuscle using the same structure as BeerETL
        const corpuscle = {
            uri: corpuscleURI,
            type: 'test-question',
            content: `Test Question: ${record.question}`,
            metadata: {
                id: record.id,
                source: 'beerqa_test_questions_v1.0',
                questionURI: questionURI,
                question: record.question,
                answerCount: 0,
                contextCount: 0
            },
            triples: []
        };

        // Generate RDF triples using the same approach as BeerETL
        corpuscle.triples = this.generateTestQuestionTriples(corpuscle, record);
        
        this.stats.generatedTriples += corpuscle.triples.length;
        
        return corpuscle;
    }

    /**
     * Generate RDF triples for test question corpuscle using the same format as BeerETL
     */
    generateTestQuestionTriples(corpuscle, record) {
        const triples = [];
        const corpuscleURI = `<${corpuscle.uri}>`;
        
        // Core corpuscle properties - using same format as BeerETL
        triples.push(`${corpuscleURI} rdf:type ragno:Corpuscle .`);
        triples.push(`${corpuscleURI} rdfs:label "${record.question.replace(/"/g, '\\"')}" .`);
        triples.push(`${corpuscleURI} ragno:content "${corpuscle.content.replace(/"/g, '\\"')}" .`);
        triples.push(`${corpuscleURI} ragno:corpuscleType "${corpuscle.type}" .`);
        
        // Metadata properties
        triples.push(`${corpuscleURI} dcterms:identifier "${record.id}" .`);
        triples.push(`${corpuscleURI} dcterms:source "${corpuscle.metadata.source}" .`);
        triples.push(`${corpuscleURI} dcterms:created "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`);
        
        // Question-specific properties
        const questionURI = `<${corpuscle.metadata.questionURI}>`;
        triples.push(`${questionURI} rdf:type ragno:Question .`);
        triples.push(`${questionURI} rdfs:label "${record.question.replace(/"/g, '\\"')}" .`);
        triples.push(`${corpuscleURI} ragno:hasQuestion ${questionURI} .`);
        
        // Quantitative properties (test questions have no answers/context)
        triples.push(`${corpuscleURI} ragno:answerCount "0"^^<http://www.w3.org/2001/XMLSchema#integer> .`);
        triples.push(`${corpuscleURI} ragno:contextCount "0"^^<http://www.w3.org/2001/XMLSchema#integer> .`);
        triples.push(`${corpuscleURI} ragno:contentLength "${record.question.length}"^^<http://www.w3.org/2001/XMLSchema#integer> .`);
        
        return triples;
    }
}

/**
 * Main demo function
 */
async function runBeerTestQuestionsETL() {
    displayHeader();

    try {
        // Initialize BeerTestQuestionsETL with configuration
        const etl = new BeerTestQuestionsETL({
            dataPath: path.resolve('data/beerqa/beerqa_test_questions_v1.0.json'),
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            graphURI: 'http://purl.org/stuff/beerqa/test',
            baseURI: 'http://purl.org/stuff/beerqa/test/',
            batchSize: 25, // Smaller batches for demo
            nBatches: 4, // Only process 4 batches (100 test questions total) for demo
            rateLimit: 300, // 300ms delay between SPARQL updates for demo
            includeContext: false // Test questions don't have context
        });

        displayConfiguration(etl);

        console.log(chalk.bold.yellow('🚀 Starting BeerQA Test Questions ETL Process...'));
        console.log(chalk.dim(`Processing ${etl.options.nBatches !== null ? etl.options.nBatches + ' batches (' + (etl.options.nBatches * etl.options.batchSize) + ' records)' : 'full dataset'} - this may take a few minutes...`));
        console.log(chalk.bold.cyan('📝 Note: Test questions contain only questions (no answers or context)'));
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
            console.log(chalk.bold.yellow('🔍 Querying Sample Test Questions...'));
            try {
                // Custom query for test questions
                const queryEndpoint = etl.options.sparqlEndpoint.replace('/update', '/query');
                const testQuestionQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX dcterms: <http://purl.org/dc/terms/>
                    
                    SELECT ?corpuscle ?label ?source WHERE {
                        GRAPH <${etl.options.graphURI}> {
                            ?corpuscle a ragno:Corpuscle ;
                                     rdfs:label ?label ;
                                     dcterms:source ?source ;
                                     ragno:corpuscleType "test-question" .
                        }
                    }
                    ORDER BY ?corpuscle
                    LIMIT 5
                `;
                
                const response = await fetch(queryEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/sparql-query',
                        'Accept': 'application/sparql-results+json',
                        'Authorization': `Basic ${btoa(`${etl.options.sparqlAuth.user}:${etl.options.sparqlAuth.password}`)}`
                    },
                    body: testQuestionQuery
                });
                
                if (!response.ok) {
                    throw new Error(`Query failed: ${response.status} ${response.statusText}`);
                }
                
                const sampleResults = await response.json();
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
            console.log(chalk.bold.green('🎉 Test Questions ETL Demo Completed Successfully!'));
            console.log(chalk.white('The BeerQA test questions dataset has been transformed into RDF corpuscles'));
            console.log(chalk.white('and loaded into the SPARQL store using the Ragno vocabulary.'));
            console.log('');
            console.log(chalk.bold.cyan('🔍 Key Differences from Regular BeerQA:'));
            console.log(`   • ${chalk.white('Test questions are stored in separate graph:')} ${chalk.cyan(etl.options.graphURI)}`);
            console.log(`   • ${chalk.white('corpuscleType:')} ${chalk.cyan('test-question')} (vs question-answer)`);
            console.log(`   • ${chalk.white('answerCount:')} ${chalk.cyan('0')} (no answers provided)`);
            console.log(`   • ${chalk.white('contextCount:')} ${chalk.cyan('0')} (no context provided)`);
            console.log('');
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • Query the data at: ${chalk.white(etl.options.sparqlEndpoint.replace('/update', '/query'))}`);
            console.log(`   • Explore the test graph: ${chalk.white(etl.options.graphURI)}`);
            console.log(`   • Compare with main BeerQA data in: ${chalk.white('http://purl.org/stuff/beerqa')}`);
            console.log(`   • Use for question answering evaluation and testing`);
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
        console.log(`   • Ensure the data file exists: ${chalk.cyan('data/beerqa/beerqa_test_questions_v1.0.json')}`);
        console.log(`   • Check SPARQL endpoint is accessible`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check network connectivity`);
        console.log(`   • Ensure sufficient disk space for test questions storage`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node BeerTestQuestions.js')} - Run the test questions ETL demo`);
    console.log('');
    console.log(chalk.bold.white('Purpose:'));
    console.log('  Process BeerQA test questions dataset (questions only, no answers/context)');
    console.log('  Store in separate named graph for evaluation and testing purposes');
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('dataPath')} - Path to BeerQA test questions JSON file`);
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('sparqlAuth')} - Authentication credentials`);
    console.log(`  • ${chalk.cyan('graphURI')} - Target named graph URI (default: test-specific)`);
    console.log(`  • ${chalk.cyan('batchSize')} - Number of records per batch`);
    console.log('');
    console.log(chalk.bold.yellow('Note:'));
    console.log('  This tool extends the existing BeerETL infrastructure but handles');
    console.log('  the test questions format (questions without answers/context).');
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
    runBeerTestQuestionsETL().catch(error => {
        console.error(chalk.red('Test Questions ETL failed:', error.message));
        process.exit(1);
    });
}

export { runBeerTestQuestionsETL, BeerTestQuestionsETL };