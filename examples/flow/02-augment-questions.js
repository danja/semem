#!/usr/bin/env node

/**
 * Flow Stage 2: Question Augmentation
 * 
 * Adds embeddings and extracts semantic concepts from questions using Flow components.
 * Maps to: AugmentQuestion.js in the original workflow
 * 
 * Usage: node examples/flow/02-augment-questions.js [--limit N]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import NomicConnector from '../../src/connectors/NomicConnector.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

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
    console.log(chalk.bold.green('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.green('║') + chalk.bold.white('            🧠 FLOW STAGE 2: AUGMENT QUESTIONS               ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('║') + chalk.gray('        Add embeddings and extract semantic concepts         ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: null };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 02-augment-questions.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of questions to process (default: all)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize handlers
 */
async function initializeHandlers(config) {
    console.log(chalk.cyan('🔧 Initializing handlers...'));

    // Initialize LLM handler
    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    let llmConnector;
    if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
        llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
    } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
        llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
    } else {
        llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        chatProvider.chatModel = 'qwen2:1.5b';
    }

    const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
    console.log(chalk.green(`   ✅ LLM handler: ${chatProvider.type}`));

    // Initialize embedding handler
    const embeddingProvider = llmProviders
        .filter(p => p.capabilities?.includes('embedding'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    const embeddingConnector = new NomicConnector(
        'http://localhost:11434',
        embeddingProvider?.embeddingModel || 'nomic-embed-text'
    );
    const embeddingHandler = new EmbeddingHandler(embeddingConnector);
    console.log(chalk.green(`   ✅ Embedding handler: ${embeddingProvider?.embeddingModel || 'nomic-embed-text'}`));

    return { llmHandler, embeddingHandler };
}

/**
 * Retrieve questions from graph
 */
async function retrieveQuestions(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving questions from graph...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content .
        
        # Only get questions that haven't been augmented yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "embedding" .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const questions = result.data.results.bindings.map(binding => ({
            uri: binding.question.value,
            label: binding.label.value,
            content: binding.content.value
        }));
        
        console.log(chalk.green(`   ✓ Found ${questions.length} questions to augment`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No unaugmented questions found'));
        return [];
    }
}

/**
 * Extract concepts from question text
 */
async function extractConcepts(questionText, llmHandler) {
    const prompt = `Extract 3-5 key semantic concepts from this question that could be useful for research:

"${questionText}"

Return only the concepts, one per line, without explanations or numbers.`;

    try {
        const response = await llmHandler.generateResponse(prompt);
        const concepts = response
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 2 && line.length < 50)
            .slice(0, 5);
        
        return concepts;
    } catch (error) {
        logger.debug('Concept extraction failed:', error.message);
        return [];
    }
}

/**
 * Augment questions with embeddings and concepts
 */
async function augmentQuestions(questions, llmHandler, embeddingHandler, sparqlHelper, config) {
    console.log(chalk.cyan('🧠 Augmenting questions with embeddings and concepts...'));
    
    const augmentedCount = { embeddings: 0, concepts: 0 };
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        
        try {
            // Generate embedding
            const embedding = await embeddingHandler.generateEmbedding(question.content);
            
            // Extract concepts
            const concepts = await extractConcepts(question.content, llmHandler);
            
            // Store embedding and concepts
            const triples = [];
            
            // Embedding attribute
            const embeddingAttrURI = `${question.uri}/attr/embedding_${Date.now()}`;
            triples.push(`<${question.uri}> ragno:hasAttribute <${embeddingAttrURI}> .`);
            triples.push(`<${embeddingAttrURI}> a ragno:Attribute ;`);
            triples.push(`    ragno:attributeType "embedding" ;`);
            triples.push(`    ragno:attributeValue "${embedding.join(',')}" ;`);
            triples.push(`    ragno:embeddingModel "nomic-embed-text" ;`);
            triples.push(`    ragno:embeddingDimensions ${embedding.length} ;`);
            triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
            
            // Concept attributes
            concepts.forEach((concept, conceptIndex) => {
                const conceptAttrURI = `${question.uri}/attr/concept_${conceptIndex}_${Date.now()}`;
                triples.push(`<${question.uri}> ragno:hasAttribute <${conceptAttrURI}> .`);
                triples.push(`<${conceptAttrURI}> a ragno:Attribute ;`);
                triples.push(`    ragno:attributeType "concept" ;`);
                triples.push(`    ragno:attributeValue "${escapeRDFString(concept)}" ;`);
                triples.push(`    ragno:conceptIndex ${conceptIndex} ;`);
                triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
            });
            
            // Update processing stage
            triples.push(`<${question.uri}> ragno:processingStage "augmented" .`);
            
            // Flow stage tracking
            const flowAttrURI = `${question.uri}/attr/flow_stage_02`;
            triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
            triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
            triples.push(`    ragno:attributeType "flow-stage" ;`);
            triples.push(`    ragno:attributeValue "02-augment-questions" ;`);
            triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
            
            if (triples.length > 0) {
                const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

                const result = await sparqlHelper.executeUpdate(insertQuery);
                
                if (result.success) {
                    augmentedCount.embeddings++;
                    if (concepts.length > 0) {
                        augmentedCount.concepts++;
                    }
                    console.log(chalk.green(`      ✓ Embedding (${embedding.length}D) + ${concepts.length} concepts`));
                } else {
                    console.log(chalk.red(`      ❌ Failed to store: ${result.error}`));
                }
            }
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Error: ${error.message}`));
        }
    }
    
    return augmentedCount;
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
function displaySummary(questionsProcessed, augmentedCount, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 2 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${questionsProcessed}`));
    console.log(chalk.white(`   Questions with embeddings: ${augmentedCount.embeddings}`));
    console.log(chalk.white(`   Questions with concepts: ${augmentedCount.concepts}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   Average time per question: ${(duration / questionsProcessed / 1000).toFixed(1)}s`));
    console.log('');
    console.log(chalk.gray('Next Step: Stage 3 - Research concepts via Wikipedia'));
    console.log(chalk.gray('Command: node examples/flow/03-research-concepts.js'));
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
        
        // Initialize handlers
        const { llmHandler, embeddingHandler } = await initializeHandlers(config);
        
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve questions to augment
        const questions = await retrieveQuestions(sparqlHelper, workflowConfig, args.limit);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions found to augment. Run Stage 1 first.'));
            return;
        }
        
        // Augment questions
        const augmentedCount = await augmentQuestions(questions, llmHandler, embeddingHandler, sparqlHelper, workflowConfig);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(questions.length, augmentedCount, duration);
        
        console.log(chalk.bold.green('🎉 Stage 2: Question augmentation completed successfully!'));
        console.log('');
        
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

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}