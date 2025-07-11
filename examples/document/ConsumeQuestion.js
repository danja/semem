#!/usr/bin/env node

/**
 * ConsumeQuestion.js - Test script for TextToCorpuscle functionality
 * 
 * This script serves as a manual test for the TextToCorpuscle.js module.
 * It takes a question as an argument, creates a corpuscle with all associated
 * constructs in the SPARQL store, and then queries the store to return the
 * details of the created corpuscle.
 * 
 * Usage: 
 *   node examples/document/ConsumeQuestion.js "What is machine learning?"
 *   node examples/document/ConsumeQuestion.js "How does beer brewing work?" --graph "http://example.org/test"
 *   node examples/document/ConsumeQuestion.js --help
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { TextToCorpuscle } from '../../src/ragno/TextToCorpuscle.js';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

class ConsumeQuestion {
    constructor() {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.textToCorpuscle = null;
    }

    async init() {
        // Config path relative to project root
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('ConsumeQuestion requires SPARQL storage configuration');
        }
        
        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.query, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        
        // Initialize TextToCorpuscle with shared config
        this.textToCorpuscle = new TextToCorpuscle(this.config);
        await this.textToCorpuscle.init();
        
        logger.info('✅ ConsumeQuestion system initialized');
    }

    /**
     * Process a question and create corpuscle, then query for details
     */
    async processAndQuery(questionText, options = {}) {
        logger.info('🚀 PROCESSING QUESTION TO CORPUSCLE');
        logger.info('='.repeat(60));
        logger.info(`❓ Question: "${questionText}"`);

        try {
            // Step 1: Create corpuscle from question
            logger.info('\n📝 Step 1: Creating corpuscle from question...');
            const corpuscleURI = await this.textToCorpuscle.processQuestion(questionText, options);
            
            logger.info(`✅ Corpuscle created: ${corpuscleURI}`);

            // Step 2: Query for corpuscle details
            logger.info('\n🔍 Step 2: Querying corpuscle details...');
            const corpuscleDetails = await this.queryCorpuscleDetails(corpuscleURI, options.graphName);

            // Step 3: Display results
            logger.info('\n📊 CORPUSCLE DETAILS:');
            logger.info('='.repeat(60));
            this.displayCorpuscleDetails(corpuscleDetails);

            return {
                corpuscleURI,
                details: corpuscleDetails
            };

        } catch (error) {
            logger.error('❌ Error processing question:', error.message);
            throw error;
        }
    }

    /**
     * Query the SPARQL store for detailed information about the corpuscle
     * Uses the SPARQLQueryService templating system as described in docs/manual/sparql-service.md
     */
    async queryCorpuscleDetails(corpuscleURI, graphName = null) {
        const storageConfig = this.config.get('storage');
        const targetGraph = graphName || storageConfig.options.graphName || this.config.get('graphName') || 'http://tensegrity.it/semem';

        // Use SPARQLQueryService with the corpuscle-details query template
        // Query file: sparql/queries/corpuscle-details.sparql
        // Template parameters: graphURI, corpuscleURI
        const queryParams = {
            graphURI: targetGraph,
            corpuscleURI: corpuscleURI
        };

        logger.debug('🔍 Loading corpuscle details query from template...');
        const query = await this.queryService.getQuery('corpuscle-details', queryParams);

        logger.debug('🔍 Executing corpuscle details query...');
        const result = await this.sparqlHelper.executeSelect(query);
        
        if (!result.success) {
            throw new Error(`SPARQL query failed: ${result.error}`);
        }

        return result.data.results.bindings;
    }

    /**
     * Display corpuscle details in a structured format
     */
    displayCorpuscleDetails(bindings) {
        if (!bindings || bindings.length === 0) {
            logger.warn('⚠️  No details found for corpuscle');
            return;
        }

        // Group results by type
        const groupedResults = {};
        bindings.forEach(binding => {
            const type = binding.type.value;
            const property = binding.property.value;
            const value = binding.value.value;

            if (!groupedResults[type]) {
                groupedResults[type] = {};
            }
            if (!groupedResults[type][property]) {
                groupedResults[type][property] = [];
            }
            groupedResults[type][property].push(value);
        });

        // Display grouped results
        Object.keys(groupedResults).sort().forEach(type => {
            logger.info(`\n🏷️  ${type.toUpperCase()}:`);
            
            Object.keys(groupedResults[type]).sort().forEach(property => {
                const values = groupedResults[type][property];
                const shortProperty = property.split('/').pop().split('#').pop();
                
                if (values.length === 1) {
                    let displayValue = values[0];
                    if (displayValue.length > 100) {
                        displayValue = displayValue.substring(0, 100) + '...';
                    }
                    logger.info(`   📝 ${shortProperty}: ${displayValue}`);
                } else {
                    logger.info(`   📝 ${shortProperty}:`);
                    values.forEach(value => {
                        let displayValue = value;
                        if (displayValue.length > 80) {
                            displayValue = displayValue.substring(0, 80) + '...';
                        }
                        logger.info(`      - ${displayValue}`);
                    });
                }
            });
        });

        // Summary statistics
        const conceptCount = groupedResults.concept ? Object.values(groupedResults.concept).flat().length : 0;
        const hasEmbedding = groupedResults.textElement && groupedResults.textElement['http://purl.org/stuff/ragno/embedding'];
        
        logger.info('\n📊 SUMMARY:');
        logger.info(`   🔢 Concepts extracted: ${conceptCount}`);
        logger.info(`   🧠 Has embedding: ${hasEmbedding ? 'Yes' : 'No'}`);
        logger.info(`   📏 Total properties: ${bindings.length}`);
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.textToCorpuscle) {
            await this.textToCorpuscle.cleanup();
        }
        
        if (this.sparqlHelper && typeof this.sparqlHelper.cleanup === 'function') {
            await this.sparqlHelper.cleanup();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            this.queryService.cleanup();
        }

        logger.info('✅ ConsumeQuestion cleanup completed');
    }
}

/**
 * Parse command line arguments
 */
function parseCommandArgs() {
    const args = process.argv.slice(2);
    const options = {
        question: null,
        graphName: null,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--graph':
                options.graphName = args[++i];
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                if (!arg.startsWith('--') && !options.question) {
                    options.question = arg;
                } else if (!arg.startsWith('--')) {
                    console.log(`Unknown argument: ${arg}`);
                    process.exit(1);
                } else {
                    console.log(`Unknown option: ${arg}`);
                    process.exit(1);
                }
        }
    }

    return options;
}

/**
 * Show usage information
 */
function showUsage() {
    console.log('Usage: node examples/document/ConsumeQuestion.js [question] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  question         Question text to process (required)');
    console.log('');
    console.log('Options:');
    console.log('  --graph <uri>    Named graph URI to use (default: from config)');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node examples/document/ConsumeQuestion.js "What is machine learning?"');
    console.log('  node examples/document/ConsumeQuestion.js "How does beer brewing work?" --graph "http://example.org/test"');
    console.log('');
    console.log('Prerequisites:');
    console.log('  1. Configure config/config.json with SPARQL and LLM providers');
    console.log('  2. Set API keys in .env file');
    console.log('  3. Ensure SPARQL endpoint is running and accessible');
    console.log('');
}

// Main function
async function main() {
    const options = parseCommandArgs();

    if (options.help) {
        showUsage();
        process.exit(0);
    }

    if (!options.question) {
        console.error('❌ Error: Please provide a question to process');
        showUsage();
        process.exit(1);
    }

    logger.info('🚀 Starting ConsumeQuestion test');
    logger.info('='.repeat(60));

    let consumeQuestion = null;

    try {
        consumeQuestion = new ConsumeQuestion();

        // Set up signal handlers for graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
            if (consumeQuestion) {
                await consumeQuestion.cleanup();
            }
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        // Initialize and process
        await consumeQuestion.init();
        
        const result = await consumeQuestion.processAndQuery(options.question, {
            graphName: options.graphName
        });

        logger.info('\n🎉 PROCESSING COMPLETED!');
        logger.info('='.repeat(60));
        logger.info(`✅ Corpuscle URI: ${result.corpuscleURI}`);
        logger.info(`📊 Properties found: ${result.details.length}`);

    } catch (error) {
        logger.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        if (consumeQuestion) {
            await consumeQuestion.cleanup();
        }
        
        // Force exit after a short delay to ensure cleanup completes
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default ConsumeQuestion;