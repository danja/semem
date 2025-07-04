#!/usr/bin/env node

/**
 * Document QA Stage 4: Generate Answers
 * 
 * Generates comprehensive answers using retrieved document chunks as context.
 * Follows the proven pattern from examples/flow/09-enhanced-answers.js but
 * adapted for document-based question answering with citations.
 * 
 * Usage: node examples/document-qa/04-generate-answers.js [--limit N] [--style STYLE]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
    console.log(chalk.bold.yellow('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.yellow('║') + chalk.bold.white('        📝 DOCUMENT QA STAGE 4: GENERATE ANSWERS             ') + chalk.bold.yellow('║'));
    console.log(chalk.bold.yellow('║') + chalk.gray('      Create comprehensive answers with document context      ') + chalk.bold.yellow('║'));
    console.log(chalk.bold.yellow('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        style: 'comprehensive',
        namespace: 'http://example.org/docqa/'
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--style':
                options.style = args[++i];
                break;
            case '--namespace':
                options.namespace = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 04-generate-answers.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N           Limit number of questions to process');
                console.log('  --style STYLE       Answer style: brief, comprehensive, detailed (default: comprehensive)');
                console.log('  --namespace URI     Base namespace for URIs');
                console.log('  --help, -h          Show this help');
                console.log('');
                console.log(chalk.white('Answer styles:'));
                console.log('  brief         - Concise answers with key points');
                console.log('  comprehensive - Detailed answers with explanations');
                console.log('  detailed      - Extended answers with full context');
                console.log('');
                console.log(chalk.white('Examples:'));
                console.log('  node 04-generate-answers.js --style brief --limit 3');
                console.log('  node 04-generate-answers.js --style detailed');
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
 * Retrieve questions with context
 */
async function retrieveQuestionsWithContext(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving questions with context...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content ?chunksFound
WHERE {
    GRAPH <${config.graphName}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content ;
                 ragno:processingStage "context-retrieved" .
        
        # Get context retrieval info
        ?question ragno:hasAttribute ?contextAttr .
        ?contextAttr ragno:attributeType "context-retrieval" ;
                    ragno:chunksFound ?chunksFound .
        
        # Only get questions that haven't had answers generated yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "04-generate-answers" .
        }
    }
}
ORDER BY DESC(?chunksFound)
${limit ? `LIMIT ${limit}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const questions = result.data.results.bindings.map(binding => ({
            uri: binding.question.value,
            label: binding.label.value,
            content: binding.content.value,
            chunksFound: parseInt(binding.chunksFound.value)
        }));
        
        console.log(chalk.green(`   ✓ Found ${questions.length} questions with context`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No questions with context found'));
        return [];
    }
}

/**
 * Retrieve relevant chunks for a question
 */
async function retrieveQuestionContext(questionUri, sparqlHelper, config) {
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?chunkUri ?content ?title ?relevanceScore ?semanticScore ?keywordScore ?chunkIndex
WHERE {
    GRAPH <${config.graphName}> {
        <${questionUri}> ragno:hasAttribute ?chunkAttr .
        ?chunkAttr ragno:attributeType "relevant-chunk" ;
                  ragno:attributeValue ?chunkUri ;
                  ragno:relevanceScore ?relevanceScore ;
                  ragno:semanticScore ?semanticScore ;
                  ragno:keywordScore ?keywordScore ;
                  ragno:chunkIndex ?chunkIndex .
        
        # Get chunk content
        ?chunkUri ragno:hasContent ?content ;
                 skos:prefLabel ?title .
    }
}
ORDER BY ?chunkIndex`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success) {
        return result.data.results.bindings.map(binding => ({
            uri: binding.chunkUri.value,
            content: binding.content.value,
            title: binding.title.value,
            relevanceScore: parseFloat(binding.relevanceScore.value),
            semanticScore: parseFloat(binding.semanticScore.value),
            keywordScore: parseFloat(binding.keywordScore.value),
            index: parseInt(binding.chunkIndex.value)
        }));
    }
    
    return [];
}

/**
 * Generate answer using document context
 */
async function generateAnswer(question, contextChunks, llmHandler, options) {
    console.log(chalk.white(`   Generating answer for: "${question.content.substring(0, 50)}..."`));
    
    // Prepare context text
    const contextText = contextChunks.map((chunk, index) => {
        return `[Context ${index + 1}] ${chunk.title}\n${chunk.content}\n(Relevance: ${chunk.relevanceScore.toFixed(3)})\n`;
    }).join('\n');
    
    // Create style-specific prompt
    let styleInstruction;
    switch (options.style) {
        case 'brief':
            styleInstruction = 'Provide a concise, direct answer focusing on the key points. Keep it under 100 words.';
            break;
        case 'detailed':
            styleInstruction = 'Provide a comprehensive, detailed answer with full explanations, examples, and context. Include relevant background information.';
            break;
        default: // comprehensive
            styleInstruction = 'Provide a well-structured, informative answer that covers the main points with sufficient detail and context.';
    }
    
    const prompt = `You are an expert research assistant. Answer the following question using only the provided document context. ${styleInstruction}

Question: ${question.content}

Document Context:
${contextText}

Instructions:
1. Base your answer entirely on the provided context
2. If the context doesn't contain enough information, state this clearly
3. Include specific references to the context sections you used
4. Maintain accuracy and avoid speculation
5. Structure your answer clearly with appropriate formatting

Answer:`;

    try {
        const answer = await llmHandler.generateResponse(prompt, '', {
            maxTokens: options.style === 'brief' ? 150 : (options.style === 'detailed' ? 800 : 400),
            temperature: 0.3
        });
        
        console.log(chalk.white(`      ✓ Generated answer (${answer.length} characters)`));
        
        return {
            answer,
            contextUsed: contextChunks.length,
            averageRelevance: contextChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / contextChunks.length,
            style: options.style
        };
        
    } catch (error) {
        console.error(chalk.red(`      ❌ Failed to generate answer: ${error.message}`));
        throw error;
    }
}

/**
 * Store generated answer with metadata
 */
async function storeGeneratedAnswer(question, answerData, contextChunks, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const answerAttrUri = `${question.uri}/attr/generated_answer`;
    const flowAttrUri = `${question.uri}/attr/flow_stage_04`;
    
    const triples = [];
    
    // Generated answer attribute
    triples.push(`<${question.uri}> ragno:hasAttribute <${answerAttrUri}> .`);
    triples.push(`<${answerAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "generated-answer" ;`);
    triples.push(`    ragno:attributeValue "${escapeRDFString(answerData.answer)}" ;`);
    triples.push(`    ragno:answerLength ${answerData.answer.length} ;`);
    triples.push(`    ragno:contextChunksUsed ${answerData.contextUsed} ;`);
    triples.push(`    ragno:averageRelevance ${answerData.averageRelevance.toFixed(6)} ;`);
    triples.push(`    ragno:answerStyle "${answerData.style}" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Flow stage tracking
    triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrUri}> .`);
    triples.push(`<${flowAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "04-generate-answers" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Update processing stage
    triples.push(`<${question.uri}> ragno:processingStage "answered" .`);
    
    // Store citations to source chunks
    contextChunks.forEach((chunk, index) => {
        const citationAttrUri = `${question.uri}/attr/citation_${index}`;
        triples.push(`<${question.uri}> ragno:hasAttribute <${citationAttrUri}> .`);
        triples.push(`<${citationAttrUri}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "citation" ;`);
        triples.push(`    ragno:attributeValue "${chunk.uri}" ;`);
        triples.push(`    ragno:citationRelevance ${chunk.relevanceScore.toFixed(6)} ;`);
        triples.push(`    ragno:citationIndex ${index} ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    });
    
    const insertQuery = `
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
 * Process answer generation for all questions
 */
async function processAnswerGeneration(questions, llmHandler, sparqlHelper, config, options) {
    console.log(chalk.cyan('📝 Processing answer generation...'));
    
    const generationStats = {
        questionsProcessed: 0,
        successfulAnswers: 0,
        totalAnswerLength: 0,
        totalContextChunks: 0,
        averageRelevance: 0,
        errors: 0,
        answers: []
    };
    
    let totalRelevanceSum = 0;
    let totalAnswersWithContext = 0;
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        
        try {
            // Retrieve context chunks for this question
            const contextChunks = await retrieveQuestionContext(question.uri, sparqlHelper, config);
            
            if (contextChunks.length === 0) {
                console.log(chalk.yellow(`      ⚠️  No context chunks found for question`));
                continue;
            }
            
            console.log(chalk.white(`      📄 Found ${contextChunks.length} context chunks`));
            
            // Generate answer
            const answerData = await generateAnswer(question, contextChunks, llmHandler, options);
            
            // Store answer with metadata
            await storeGeneratedAnswer(question, answerData, contextChunks, sparqlHelper, config);
            
            // Update statistics
            generationStats.questionsProcessed++;
            generationStats.successfulAnswers++;
            generationStats.totalAnswerLength += answerData.answer.length;
            generationStats.totalContextChunks += contextChunks.length;
            
            if (answerData.averageRelevance > 0) {
                totalRelevanceSum += answerData.averageRelevance;
                totalAnswersWithContext++;
            }
            
            generationStats.answers.push({
                question: question.content,
                answer: answerData.answer,
                contextChunks: contextChunks.length,
                relevance: answerData.averageRelevance
            });
            
            console.log(chalk.green(`      ✅ Stored answer for question: ${question.uri}`));
            
        } catch (error) {
            console.error(chalk.red(`      ❌ Failed to process question: ${error.message}`));
            generationStats.errors++;
        }
    }
    
    // Calculate overall average relevance
    if (totalAnswersWithContext > 0) {
        generationStats.averageRelevance = totalRelevanceSum / totalAnswersWithContext;
    }
    
    return generationStats;
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
 * Display sample answers
 */
function displaySampleAnswers(stats) {
    if (stats.answers.length > 0) {
        console.log(chalk.bold.cyan('📋 Sample Generated Answers:'));
        console.log('');
        
        const samplesToShow = Math.min(2, stats.answers.length);
        for (let i = 0; i < samplesToShow; i++) {
            const sample = stats.answers[i];
            console.log(chalk.bold.white(`${i + 1}. Question: ${sample.question}`));
            console.log(chalk.gray('   Answer: ' + sample.answer.substring(0, 200) + (sample.answer.length > 200 ? '...' : '')));
            console.log(chalk.gray(`   Context chunks: ${sample.contextChunks}, Relevance: ${sample.relevance.toFixed(3)}`));
            console.log('');
        }
    }
}

/**
 * Display completion summary
 */
function displaySummary(stats, duration, options) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 4 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${stats.questionsProcessed}`));
    console.log(chalk.white(`   Successful answers: ${stats.successfulAnswers}`));
    if (stats.successfulAnswers > 0) {
        console.log(chalk.white(`   Average answer length: ${Math.round(stats.totalAnswerLength / stats.successfulAnswers)} characters`));
        console.log(chalk.white(`   Average context chunks: ${Math.round(stats.totalContextChunks / stats.successfulAnswers)}`));
    }
    if (stats.averageRelevance > 0) {
        console.log(chalk.white(`   Average context relevance: ${stats.averageRelevance.toFixed(3)}`));
    }
    if (stats.errors > 0) {
        console.log(chalk.red(`   Errors: ${stats.errors}`));
    }
    console.log(chalk.white(`   Answer style: ${options.style}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log('');
    
    // Display sample answers
    displaySampleAnswers(stats);
    
    if (stats.successfulAnswers > 0) {
        console.log(chalk.gray('Next Step: Stage 5 - Enhance answers with external knowledge'));
        console.log(chalk.gray('Command: node examples/document-qa/05-enhance-answers.js'));
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
        const sparqlHelper = new SPARQLHelper(
            config.get('storage.options.update') || 'http://localhost:3030/semem/update',
            {
                auth: { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve questions with context
        const questions = await retrieveQuestionsWithContext(sparqlHelper, config, options.limit);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with context found'));
            console.log(chalk.gray('Run Stage 3 first: node examples/document-qa/03-retrieve-context.js'));
            return;
        }
        
        // Process answer generation
        const stats = await processAnswerGeneration(questions, llmHandler, sparqlHelper, config, options);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(stats, duration, options);
        
        if (stats.successfulAnswers > 0) {
            console.log(chalk.bold.green('🎉 Stage 4: Answer generation completed successfully!'));
        } else {
            console.log(chalk.bold.red('❌ Stage 4: No answers were successfully generated'));
            process.exit(1);
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 4 failed:'), error.message);
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