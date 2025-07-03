#!/usr/bin/env node

/**
 * Document QA Stage 2: Process Questions
 * 
 * Processes user questions, generates embeddings, and stores them for retrieval.
 * Follows the proven flow pattern from examples/flow/02-augment-questions.js.
 * 
 * Usage: node examples/document-qa/02-process-questions.js [--questions FILE] [--question "text"]
 */

import path from 'path';
import fs from 'fs';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Import Flow components (following working examples pattern)
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.green('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.green('║') + chalk.bold.white('         🧠 DOCUMENT QA STAGE 2: PROCESS QUESTIONS            ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('║') + chalk.gray('       Generate embeddings and extract semantic concepts      ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        questions: null,
        question: null,
        namespace: 'http://example.org/docqa/'
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--questions':
                options.questions = args[++i];
                break;
            case '--question':
                options.question = args[++i];
                break;
            case '--namespace':
                options.namespace = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 02-process-questions.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --questions FILE    JSON file containing questions array');
                console.log('  --question "text"   Process single question');
                console.log('  --namespace URI     Base namespace for question URIs');
                console.log('  --help, -h          Show this help');
                console.log('');
                console.log(chalk.white('Examples:'));
                console.log('  node 02-process-questions.js --question "What is Wikidata?"');
                console.log('  node 02-process-questions.js --questions questions.json');
                console.log('');
                console.log(chalk.white('Questions file format:'));
                console.log('  ["What is AI?", "How does machine learning work?", ...]');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize LLM handler (following working examples pattern)
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
 * Initialize embedding handler (following working examples pattern)
 */
async function initializeEmbeddingHandler(config) {
    console.log(chalk.cyan('🔧 Initializing embedding handler...'));

    try {
        // Use the correct pattern from AugmentQuestion.js
        const embeddingConnector = await EmbeddingConnectorFactory.createConnector(config);
        const dimension = config.get('memory.dimension') || 768;  // Nomic model uses 768 dimensions
        
        // Get embedding model from config
        const llmProviders = config.get('llmProviders') || [];
        const embeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
        
        const embeddingModel = embeddingProvider?.embeddingModel || 'nomic-embed-text';
        
        console.log(chalk.white(`   🎯 Selected provider: ${embeddingProvider?.type || 'ollama'}`));
        console.log(chalk.white(`   📏 Embedding dimensions: ${dimension}`));
        console.log(chalk.white(`   🤖 Model: ${embeddingModel}`));

        const embeddingHandler = new EmbeddingHandler(
            embeddingConnector,
            embeddingModel,
            dimension
        );
        
        console.log(chalk.green(`   ✅ Embedding handler initialized successfully`));
        return embeddingHandler;
        
    } catch (error) {
        console.error(chalk.red(`   ❌ Failed to initialize embedding handler: ${error.message}`));
        throw error;
    }
}

/**
 * Load questions from various sources including MCP memory
 */
async function loadQuestions(options, sparqlHelper, config) {
    console.log(chalk.cyan('📖 Loading questions...'));
    
    let questions = [];
    
    if (options.question) {
        // Single question from command line
        questions = [options.question];
        console.log(chalk.green(`   ✓ Loaded 1 question from command line`));
    } else if (options.questions) {
        // Questions from JSON file
        const questionsPath = path.isAbsolute(options.questions) 
            ? options.questions 
            : join(projectRoot, options.questions);
            
        if (!fs.existsSync(questionsPath)) {
            throw new Error(`Questions file not found: ${questionsPath}`);
        }
        
        const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        questions = Array.isArray(questionsData) ? questionsData : questionsData.questions || [];
        console.log(chalk.green(`   ✓ Loaded ${questions.length} questions from ${questionsPath}`));
    } else {
        // Load questions from MCP memory format and default demo questions
        console.log(chalk.white('   🔍 Checking for questions from MCP memory...'));
        
        try {
            const mcpQuestions = await loadQuestionsFromMCPMemory(sparqlHelper, config);
            if (mcpQuestions.length > 0) {
                questions = questions.concat(mcpQuestions);
                console.log(chalk.green(`   ✓ Loaded ${mcpQuestions.length} questions from MCP memory`));
            }
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Could not load MCP questions: ${error.message}`));
        }
        
        // Add default demo questions if no other questions found
        if (questions.length === 0) {
            const defaultQuestions = [
                "What is Wikidata and how is it used in life sciences?",
                "How does Wikidata integrate with biomedical research?",
                "What are the main challenges in using Wikidata for life sciences?",
                "How can Wikidata improve FAIR data principles?",
                "What types of biomedical entities are stored in Wikidata?"
            ];
            questions = questions.concat(defaultQuestions);
            console.log(chalk.green(`   ✓ Using ${defaultQuestions.length} default demo questions`));
        }
    }
    
    return questions;
}

/**
 * Load questions from MCP memory format
 */
async function loadQuestionsFromMCPMemory(sparqlHelper, config) {
    const selectQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?interaction ?prompt ?response
WHERE {
    GRAPH <${config.graphName}> {
        ?interaction rdf:type ?type ;
                    rdfs:label ?prompt ;
                    ?responseProp ?response .
        
        # Look for MCP-style interactions (different from ragno:Corpuscle)
        FILTER(?type != <http://purl.org/stuff/ragno/Corpuscle>)
        FILTER(STRLEN(?prompt) > 5)
        FILTER(CONTAINS(LCASE(?prompt), "?") || CONTAINS(LCASE(?prompt), "what") || CONTAINS(LCASE(?prompt), "how") || CONTAINS(LCASE(?prompt), "why"))
    }
}
LIMIT 10`;

    try {
        const result = await sparqlHelper.executeSelect(selectQuery);
        
        if (result.success && result.data.results.bindings.length > 0) {
            const mcpQuestions = result.data.results.bindings
                .map(binding => binding.prompt.value)
                .filter(prompt => prompt && prompt.length > 5);
            
            return mcpQuestions;
        }
    } catch (error) {
        console.warn(chalk.yellow(`      ⚠️  MCP memory query failed: ${error.message}`));
    }
    
    return [];
}

/**
 * Process questions with embeddings and concepts
 */
async function processQuestions(questions, llmHandler, embeddingHandler, sparqlHelper, config) {
    console.log(chalk.cyan('🧠 Processing questions with embeddings and concepts...'));
    
    const questionStats = {
        questionsProcessed: 0,
        embeddingsGenerated: 0,
        conceptsExtracted: 0,
        errors: 0
    };
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionId = Date.now() + i;
        const questionUri = `${config.namespace}question/${questionId}`;
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.substring(0, 50)}..."`));
        
        try {
            // Generate embedding for semantic similarity
            const embedding = await embeddingHandler.generateEmbedding(question);
            console.log(chalk.white(`      ✓ Generated embedding (${embedding.length} dimensions)`));
            questionStats.embeddingsGenerated++;
            
            // Extract concepts using LLM
            const concepts = await llmHandler.extractConcepts(question);
            console.log(chalk.white(`      ✓ Extracted ${concepts.length} concepts`));
            questionStats.conceptsExtracted += concepts.length;
            
            // Store question with embeddings and concepts
            await storeProcessedQuestion(
                questionUri, 
                question, 
                embedding, 
                concepts, 
                sparqlHelper, 
                config
            );
            
            questionStats.questionsProcessed++;
            console.log(chalk.green(`      ✅ Stored question: ${questionUri}`));
            
        } catch (error) {
            console.error(chalk.red(`      ❌ Failed to process question: ${error.message}`));
            questionStats.errors++;
        }
    }
    
    return questionStats;
}

/**
 * Store processed question in SPARQL store
 */
async function storeProcessedQuestion(questionUri, questionText, embedding, concepts, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const triples = [];
    
    // Main question corpuscle
    triples.push(`<${questionUri}> a ragno:Corpuscle ;`);
    triples.push(`    rdfs:label "${escapeRDFString(questionText)}" ;`);
    triples.push(`    ragno:content "${escapeRDFString(questionText)}" ;`);
    triples.push(`    ragno:corpuscleType "question" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime ;`);
    triples.push(`    ragno:processingStage "processed" ;`);
    triples.push(`    ragno:questionLength ${questionText.length} .`);
    
    // Embedding attribute
    const embeddingAttrUri = `${questionUri}/attr/embedding`;
    triples.push(`<${questionUri}> ragno:hasAttribute <${embeddingAttrUri}> .`);
    triples.push(`<${embeddingAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "embedding" ;`);
    triples.push(`    ragno:attributeValue "${JSON.stringify(embedding)}" ;`);
    triples.push(`    ragno:embeddingDimensions ${embedding.length} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Concepts attributes
    concepts.forEach((concept, index) => {
        const conceptAttrUri = `${questionUri}/attr/concept_${index}`;
        triples.push(`<${questionUri}> ragno:hasAttribute <${conceptAttrUri}> .`);
        triples.push(`<${conceptAttrUri}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "concept" ;`);
        triples.push(`    ragno:attributeValue "${escapeRDFString(concept)}" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    });
    
    // Flow stage tracking
    const flowAttrUri = `${questionUri}/attr/flow_stage`;
    triples.push(`<${questionUri}> ragno:hasAttribute <${flowAttrUri}> .`);
    triples.push(`<${flowAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "02-process-questions" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.graphName}> {
        ${triples.join('\n        ')}
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`SPARQL storage failed: ${result.error}`);
    }
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
function displaySummary(stats, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 2 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${stats.questionsProcessed}`));
    console.log(chalk.white(`   Embeddings generated: ${stats.embeddingsGenerated}`));
    console.log(chalk.white(`   Concepts extracted: ${stats.conceptsExtracted}`));
    if (stats.errors > 0) {
        console.log(chalk.red(`   Errors: ${stats.errors}`));
    }
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log('');
    
    if (stats.questionsProcessed > 0) {
        console.log(chalk.gray('Next Step: Stage 3 - Retrieve context from document chunks'));
        console.log(chalk.gray('Command: node examples/document-qa/03-retrieve-context.js'));
    }
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();
        
        displayHeader();
        
        const options = parseArgs();
        
        // Initialize configuration
        console.log(chalk.cyan('🔧 Initializing configuration...'));
        const configPath = join(projectRoot, 'config/config.json');
        const config = new Config(configPath);
        await config.init();
        
        config.namespace = options.namespace;
        config.graphName = config.get('storage.options.graphName') || 'http://tensegrity.it/semem';
        
        console.log(chalk.green('   ✓ Configuration loaded'));
        
        // Initialize components
        const llmHandler = await initializeLLMHandler(config);
        const embeddingHandler = await initializeEmbeddingHandler(config);
        const sparqlHelper = new SPARQLHelper(
            config.get('storage.options.update') || 'http://localhost:3030/semem/update',
            {
                auth: { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Load questions (including MCP memory questions)
        const questions = await loadQuestions(options, sparqlHelper, config);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions found to process'));
            return;
        }
        
        // Process questions
        const stats = await processQuestions(questions, llmHandler, embeddingHandler, sparqlHelper, config);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(stats, duration);
        
        if (stats.questionsProcessed > 0) {
            console.log(chalk.bold.green('🎉 Stage 2: Question processing completed successfully!'));
        } else {
            console.log(chalk.bold.red('❌ Stage 2: No questions were successfully processed'));
            process.exit(1);
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 2 failed:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the stage
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}