#!/usr/bin/env node

/**
 * Flow Stage 9: Enhanced Answer Generation
 * 
 * Generate enhanced answers with multi-source context using Flow components.
 * Maps to: WikidataGetResult.js in the original workflow
 * 
 * Usage: node examples/flow/09-enhanced-answers.js [--limit N] [--question "text"]
 */

import path from 'path';
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
import WikidataWorkflow from '../../src/compose/workflows/WikidataWorkflow.js';
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
    console.log(chalk.bold.yellow('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.yellow('║') + chalk.bold.white('           📝 FLOW STAGE 9: ENHANCED ANSWERS                 ') + chalk.bold.yellow('║'));
    console.log(chalk.bold.yellow('║') + chalk.gray('        Generate answers with multi-source context           ') + chalk.bold.yellow('║'));
    console.log(chalk.bold.yellow('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: null, question: null };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--question':
                options.question = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 09-enhanced-answers.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N           Limit number of questions to process (default: all)');
                console.log('  --question "text"   Process specific question (default: process stored questions)');
                console.log('  --help, -h          Show this help');
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
 * Retrieve Wikidata researched questions
 */
async function retrieveWikidataResearchedQuestions(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving Wikidata researched questions...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content ;
                 ragno:processingStage "wikidata-researched" .
        
        # Only get questions that haven't had enhanced answers generated yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "09-enhanced-answers" .
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
        
        console.log(chalk.green(`   ✓ Found ${questions.length} questions ready for enhanced answers`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No Wikidata researched questions found'));
        return [];
    }
}

/**
 * Generate enhanced answers using WikidataWorkflow
 */
async function generateEnhancedAnswers(questions, llmHandler, sparqlHelper, config) {
    console.log(chalk.cyan('📝 Generating enhanced answers...'));
    
    const wikidataWorkflow = new WikidataWorkflow();
    
    const answerStats = {
        questionsProcessed: 0,
        successfulAnswers: 0,
        totalAnswerLength: 0,
        wikidataEntitiesUsed: 0,
        errors: 0,
        answers: []
    };
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        
        try {
            // Generate enhanced answer using Wikidata workflow
            const workflowResult = await wikidataWorkflow.execute(
                { 
                    question: { text: question.content, uri: question.uri },
                    enableWikidataResearch: true
                },
                resources,
                {
                    enhancementLevel: 'standard',
                    maxWikidataEntities: 15,
                    answerStyle: 'comprehensive',
                    maxContextTokens: 3000
                }
            );
            
            if (workflowResult.success) {
                const answer = workflowResult.data.enhancedAnswer || workflowResult.data.standardAnswer;
                
                if (!answer) {
                    console.log(chalk.red(`      ❌ No answer generated in workflow result`));
                    answerStats.errors++;
                    continue;
                }
                
                const answerLength = answer.length;
                
                answerStats.successfulAnswers++;
                answerStats.totalAnswerLength += answerLength;
                answerStats.wikidataEntitiesUsed += workflowResult.data.wikidataEntitiesFound || 0;
                
                console.log(chalk.green(`      ✓ Generated answer (${answerLength} chars)`));
                console.log(chalk.gray(`      🌐 Wikidata entities used: ${workflowResult.data.wikidataEntitiesFound || 0}`));
                console.log(chalk.gray(`      📊 BeerQA context: ${workflowResult.data.corpusclesUsed || 0} corpuscles`));
                
                // Store answer and mark question as processed
                await storeEnhancedAnswer(question, answer, workflowResult, sparqlHelper, config);
                
                answerStats.answers.push({
                    question: question.content,
                    answer: answer,
                    length: answerLength,
                    wikidataEntities: workflowResult.data.wikidataEntitiesFound || 0
                });
                
            } else {
                console.log(chalk.red(`      ❌ Answer generation failed: ${workflowResult.error}`));
                answerStats.errors++;
            }
            
            answerStats.questionsProcessed++;
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Answer generation error: ${error.message}`));
            answerStats.errors++;
        }
    }
    
    return answerStats;
}

/**
 * Process single question for enhanced answer
 */
async function processSingleQuestion(questionText, llmHandler, sparqlHelper, config) {
    console.log(chalk.cyan(`📝 Processing single question: "${questionText}"`));
    
    const wikidataWorkflow = new WikidataWorkflow();
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    try {
        const workflowResult = await wikidataWorkflow.execute(
            { 
                question: { text: questionText },
                enableWikidataResearch: true
            },
            resources,
            {
                enhancementLevel: 'comprehensive',
                maxWikidataEntities: 20,
                answerStyle: 'comprehensive',
                maxContextTokens: 4000
            }
        );
        
        if (workflowResult.success) {
            const answer = workflowResult.data.enhancedAnswer || workflowResult.data.standardAnswer;
            
            console.log('');
            console.log(chalk.bold.green('📝 ENHANCED ANSWER:'));
            console.log(chalk.white('═'.repeat(60)));
            console.log(chalk.white(answer));
            console.log(chalk.white('═'.repeat(60)));
            console.log('');
            console.log(chalk.gray(`📊 Answer length: ${answer.length} characters`));
            console.log(chalk.gray(`🌐 Wikidata entities used: ${workflowResult.data.wikidataEntitiesFound || 0}`));
            console.log(chalk.gray(`📚 BeerQA corpuscles used: ${workflowResult.data.corpusclesUsed || 0}`));
            console.log('');
            
            return {
                success: true,
                answer: answer,
                metadata: workflowResult.data
            };
        } else {
            console.log(chalk.red(`❌ Answer generation failed: ${workflowResult.error}`));
            return { success: false, error: workflowResult.error };
        }
        
    } catch (error) {
        console.log(chalk.red(`❌ Processing error: ${error.message}`));
        console.log(chalk.red(`❌ Stack trace: ${error.stack}`));
        return { success: false, error: error.message };
    }
}

/**
 * Store enhanced answer with metadata
 */
async function storeEnhancedAnswer(question, answer, workflowResult, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const answerAttrURI = `${question.uri}/attr/enhanced_answer`;
    const flowAttrURI = `${question.uri}/attr/flow_stage_09`;
    
    const triples = [];
    
    // Ensure workflowResult.data exists
    const data = workflowResult.data || {};
    
    // Enhanced answer attribute
    triples.push(`<${question.uri}> ragno:hasAttribute <${answerAttrURI}> .`);
    triples.push(`<${answerAttrURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "enhanced-answer" ;`);
    triples.push(`    ragno:attributeValue "${escapeRDFString(answer)}" ;`);
    triples.push(`    ragno:answerLength ${answer.length} ;`);
    triples.push(`    ragno:wikidataEntitiesUsed ${data.wikidataEntitiesFound || 0} ;`);
    triples.push(`    ragno:corpusclesUsed ${data.corpusclesUsed || 0} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Flow stage tracking
    triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
    triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "09-enhanced-answers" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Update processing stage
    triples.push(`<${question.uri}> ragno:processingStage "enhanced-answered" .`);
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to store enhanced answer: ${result.error}`);
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
function displaySummary(answerStats, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 9 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${answerStats.questionsProcessed}`));
    console.log(chalk.white(`   Successful answers: ${answerStats.successfulAnswers}`));
    console.log(chalk.white(`   Answer generation errors: ${answerStats.errors}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (answerStats.successfulAnswers > 0) {
        console.log(chalk.white(`   Average answer length: ${Math.round(answerStats.totalAnswerLength / answerStats.successfulAnswers)} characters`));
        console.log(chalk.white(`   Average Wikidata entities per answer: ${(answerStats.wikidataEntitiesUsed / answerStats.successfulAnswers).toFixed(1)}`));
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 10 - Iterative feedback processing'));
    console.log(chalk.gray('Command: node examples/flow/10-iterative-feedback.js'));
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
        
        // Initialize LLM handler
        const llmHandler = await initializeLLMHandler(config);
        
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Process single question or stored questions
        if (args.question) {
            await processSingleQuestion(args.question, llmHandler, sparqlHelper, workflowConfig);
        } else {
            // Retrieve questions ready for enhanced answers
            const questions = await retrieveWikidataResearchedQuestions(sparqlHelper, workflowConfig, args.limit);
            
            if (questions.length === 0) {
                console.log(chalk.yellow('⚠️  No questions ready for enhanced answers. Run Stages 1-8 first.'));
                return;
            }
            
            // Generate enhanced answers
            const answerStats = await generateEnhancedAnswers(questions, llmHandler, sparqlHelper, workflowConfig);
            
            // Display summary
            const duration = Date.now() - startTime;
            displaySummary(answerStats, duration);
        }
        
        console.log(chalk.bold.green('🎉 Stage 9: Enhanced answer generation completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 9 failed:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Unhandled Promise Rejection:'));
    console.error(chalk.red(`   Reason: ${reason}`));
    console.error(chalk.red(`   Promise: ${promise}`));
    if (reason && reason.stack) {
        console.error(chalk.red(`   Stack: ${reason.stack}`));
    }
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught Exception:'));
    console.error(chalk.red(`   Error: ${error.message}`));
    console.error(chalk.red(`   Stack: ${error.stack}`));
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}