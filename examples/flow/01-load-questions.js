#!/usr/bin/env node

/**
 * Flow Stage 1: Question Initialization
 * 
 * Loads test questions and creates initial corpuscles with proper metadata.
 * Maps to: BeerTestQuestions.js in the original workflow
 * 
 * Usage: node examples/flow/01-load-questions.js [--limit N]
 */

import path from 'path';
import fs from 'fs';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('               📝 FLOW STAGE 1: LOAD QUESTIONS               ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('           Initialize questions with Flow components          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: 10 }; // Number of questions

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 01-load-questions.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of questions to load (default: 100)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }

    return options;
}

/**
 * Initialize LLM handler
 */
async function initializeLLMHandler(config) {
    console.log(chalk.cyan('🔧 Initializing LLM handler...'));

    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!chatProvider) {
        throw new Error('No chat LLM provider configured');
    }

    console.log(chalk.white(`   🎯 Selected provider: ${chatProvider.type} (priority ${chatProvider.priority})`));

    let llmConnector;

    if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
        console.log(chalk.green('   ✓ Using Mistral API'));
        llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
    } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
        console.log(chalk.green('   ✓ Using Claude API'));
        llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
    } else {
        console.log(chalk.yellow('   ⚠️  API key not found, falling back to Ollama'));
        llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        chatProvider.chatModel = 'qwen2:1.5b';
    }

    const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
    console.log(chalk.green(`   ✅ LLM handler initialized with ${chatProvider.type} provider`));
    return llmHandler;
}

/**
 * Load test questions from JSON file
 */
function loadTestQuestions(options) {
    console.log(chalk.cyan('📖 Loading test questions...'));

    const questionsPath = path.resolve(__dirname, '../../data/beerqa/beerqa_test_questions_v1.0.json');

    if (!fs.existsSync(questionsPath)) {
        throw new Error(`Questions file not found: ${questionsPath}`);
    }

    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    let questions = questionsData.data || questionsData.questions || questionsData;

    // Extract just the question text from the data structure
    questions = questions.map(item => typeof item === 'string' ? item : item.question);

    // Apply limit (default 100 for reasonable testing)
    if (options.limit && options.limit > 0) {
        questions = questions.slice(0, options.limit);
        console.log(chalk.white(`   📊 Limited to ${options.limit} questions (default: 100)`));
    }

    console.log(chalk.green(`   ✓ Loaded ${questions.length} questions`));
    return questions;
}

/**
 * Create question corpuscles with Flow component patterns
 */
async function createQuestionCorpuscles(questions, sparqlHelper, config) {
    console.log(chalk.cyan('🏗️  Creating question corpuscles...'));

    const graphURI = config.beerqaGraphURI;
    const timestamp = new Date().toISOString();

    const triples = [];
    const questionURIs = [];

    questions.forEach((question, index) => {
        const questionURI = `${graphURI}/question/${Date.now()}_${index}`;
        questionURIs.push(questionURI);

        // Basic corpuscle structure
        triples.push(`<${questionURI}> a ragno:Corpuscle ;`);
        triples.push(`    rdfs:label "${escapeRDFString(question)}" ;`);
        triples.push(`    ragno:content "${escapeRDFString(question)}" ;`);
        triples.push(`    ragno:corpuscleType "question" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime ;`);
        triples.push(`    ragno:processingStage "initialized" ;`);
        triples.push(`    ragno:questionIndex ${index} .`);

        // Flow component metadata
        triples.push(`<${questionURI}> ragno:hasAttribute <${questionURI}/attr/flow_stage> .`);
        triples.push(`<${questionURI}/attr/flow_stage> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "flow-stage" ;`);
        triples.push(`    ragno:attributeValue "01-load-questions" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    });

    if (triples.length > 0) {
        const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${graphURI}> {
        ${triples.join('\n        ')}
    }
}`;

        const result = await sparqlHelper.executeUpdate(insertQuery);

        if (result.success) {
            console.log(chalk.green(`   ✅ Stored ${questions.length} question corpuscles`));
            console.log(chalk.white(`   📊 Graph: ${graphURI}`));
            console.log(chalk.white(`   🔗 URIs: ${questionURIs.length} generated`));
            return { success: true, questionURIs, count: questions.length };
        } else {
            throw new Error(`SPARQL storage failed: ${result.error}`);
        }
    }

    return { success: true, questionURIs: [], count: 0 };
}

/**
 * Escape special characters in RDF strings
 */
function escapeRDFString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Display completion summary
 */
function displaySummary(result, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 1 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${result.count}`));
    console.log(chalk.white(`   Question URIs created: ${result.questionURIs.length}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   Status: ${result.success ? 'Success' : 'Failed'}`));
    console.log('');
    console.log(chalk.gray('Next Step: Stage 2 - Augment questions with embeddings and concepts'));
    console.log(chalk.gray('Command: node examples/flow/02-augment-questions.js'));
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();

        displayHeader();

        const args = parseArgs();

        // Initialize configuration
        console.log(chalk.cyan('🔧 Initializing configuration...'));
        const config = new Config('./config/config.json');
        await config.init();

        const workflowConfig = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
        };

        console.log(chalk.green('   ✓ Configuration loaded'));

        // Initialize components
        const llmHandler = await initializeLLMHandler(config);
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );

        console.log(chalk.green('   ✓ Components initialized'));

        // Load test questions
        const questions = loadTestQuestions(args);

        // Create question corpuscles
        const result = await createQuestionCorpuscles(questions, sparqlHelper, workflowConfig);

        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(result, duration);

        console.log(chalk.bold.green('🎉 Stage 1: Question loading completed successfully!'));
        console.log('');

    } catch (error) {
        console.error(chalk.red('❌ Stage 1 failed:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}