#!/usr/bin/env node

/**
 * Flow Stage 10: Iterative Feedback Processing
 * 
 * Automated iterative question-answering with feedback loops using Flow components.
 * Maps to: GetResultWithFeedback.js in the original workflow
 * 
 * Usage: node examples/flow/10-iterative-feedback.js [--limit N] [--question "text"] [--mode MODE]
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
import FeedbackWorkflow from '../../src/compose/workflows/FeedbackWorkflow.js';
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
    console.log(chalk.bold.red('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.red('║') + chalk.bold.white('          🔄 FLOW STAGE 10: ITERATIVE FEEDBACK               ') + chalk.bold.red('║'));
    console.log(chalk.bold.red('║') + chalk.gray('      Automated iterative answer improvement system          ') + chalk.bold.red('║'));
    console.log(chalk.bold.red('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: null, question: null, mode: 'standard' };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--question':
                options.question = args[++i];
                break;
            case '--mode':
                options.mode = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 10-iterative-feedback.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N           Limit number of questions to process (default: all)');
                console.log('  --question "text"   Process specific question (default: process stored questions)');
                console.log('  --mode MODE         Feedback mode: fast, standard, comprehensive (default: standard)');
                console.log('  --help, -h          Show this help');
                console.log('');
                console.log(chalk.white('Modes:'));
                console.log('  fast           1 iteration, 1 follow-up question, basic enhancement');
                console.log('  standard       3 iterations, 2 follow-up questions per iteration');
                console.log('  comprehensive  4 iterations, 3 follow-up questions, comprehensive enhancement');
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
 * Retrieve questions ready for iterative feedback
 */
async function retrieveEnhancedQuestions(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving questions ready for iterative feedback...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content ?answer
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content ;
                 ragno:processingStage "enhanced-answered" ;
                 ragno:hasAttribute ?answerAttr .
        
        ?answerAttr ragno:attributeType "enhanced-answer" ;
                   ragno:attributeValue ?answer .
        
        # Only get questions that haven't had iterative feedback yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "10-iterative-feedback" .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const questions = result.data.results.bindings.map(binding => ({
            uri: binding.question.value,
            label: binding.label.value,
            content: binding.content.value,
            initialAnswer: binding.answer.value
        }));
        
        console.log(chalk.green(`   ✓ Found ${questions.length} questions ready for iterative feedback`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No enhanced questions found for iterative feedback'));
        return [];
    }
}

/**
 * Process iterative feedback for questions
 */
async function processIterativeFeedback(questions, llmHandler, sparqlHelper, config, mode) {
    console.log(chalk.cyan(`🔄 Processing iterative feedback in ${mode} mode...`));
    
    const feedbackWorkflow = new FeedbackWorkflow();
    
    const feedbackStats = {
        questionsProcessed: 0,
        successfulIterations: 0,
        totalIterations: 0,
        totalFollowUpQuestions: 0,
        totalEntitiesDiscovered: 0,
        averageImprovement: 0,
        errors: 0,
        results: []
    };
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    // Configure feedback parameters based on mode
    const feedbackOptions = getFeedbackOptionsForMode(mode);
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        console.log(chalk.gray(`   Mode: ${mode} (${feedbackOptions.maxIterations} iterations max)`));
        
        try {
            // Execute iterative feedback workflow
            const feedbackResult = await feedbackWorkflow.execute(
                { 
                    question: { text: question.content, uri: question.uri },
                    enableIterativeFeedback: true,
                    enableWikidataResearch: true
                },
                resources,
                feedbackOptions
            );
            
            if (feedbackResult.success) {
                const data = feedbackResult.data;
                
                feedbackStats.successfulIterations++;
                feedbackStats.totalIterations += data.workflow.iterationsPerformed;
                feedbackStats.totalFollowUpQuestions += data.totalResearchQuestions;
                feedbackStats.totalEntitiesDiscovered += data.totalEntitiesDiscovered;
                
                if (data.completenessImprovement) {
                    feedbackStats.averageImprovement += data.completenessImprovement.improvement;
                }
                
                console.log(chalk.green(`      ✓ Completed ${data.workflow.iterationsPerformed} iterations`));
                console.log(chalk.gray(`      📈 Completeness improvement: ${(data.completenessImprovement.improvement * 100).toFixed(1)}%`));
                console.log(chalk.gray(`      🔍 Follow-up questions: ${data.totalResearchQuestions}`));
                console.log(chalk.gray(`      🌐 Entities discovered: ${data.totalEntitiesDiscovered}`));
                
                // Store iterative feedback results
                await storeIterativeFeedbackResults(question, feedbackResult, sparqlHelper, config);
                
                feedbackStats.results.push({
                    question: question.content,
                    initialAnswer: data.initialAnswer,
                    finalAnswer: data.finalAnswer,
                    iterations: data.workflow.iterationsPerformed,
                    improvement: data.completenessImprovement.improvement
                });
                
            } else {
                console.log(chalk.red(`      ❌ Iterative feedback failed: ${feedbackResult.error}`));
                feedbackStats.errors++;
            }
            
            feedbackStats.questionsProcessed++;
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Feedback processing error: ${error.message}`));
            feedbackStats.errors++;
        }
    }
    
    // Calculate averages
    if (feedbackStats.successfulIterations > 0) {
        feedbackStats.averageImprovement = feedbackStats.averageImprovement / feedbackStats.successfulIterations;
    }
    
    return feedbackStats;
}

/**
 * Process single question for iterative feedback
 */
async function processSingleQuestionFeedback(questionText, llmHandler, sparqlHelper, config, mode) {
    console.log(chalk.cyan(`🔄 Processing single question with ${mode} iterative feedback:`));
    console.log(chalk.white(`"${questionText}"`));
    console.log('');
    
    const feedbackWorkflow = new FeedbackWorkflow();
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    const feedbackOptions = getFeedbackOptionsForMode(mode);
    
    try {
        const feedbackResult = await feedbackWorkflow.execute(
            { 
                question: { text: questionText },
                enableIterativeFeedback: true,
                enableWikidataResearch: true
            },
            resources,
            feedbackOptions
        );
        
        if (feedbackResult.success) {
            const data = feedbackResult.data;
            
            console.log('');
            console.log(chalk.bold.green('🔄 ITERATIVE FEEDBACK RESULTS:'));
            console.log(chalk.white('═'.repeat(80)));
            console.log('');
            
            console.log(chalk.bold.yellow('📝 INITIAL ANSWER:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.white(data.initialAnswer.substring(0, 500) + (data.initialAnswer.length > 500 ? '...' : '')));
            console.log('');
            
            console.log(chalk.bold.green('📝 FINAL ENHANCED ANSWER:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.white(data.finalAnswer));
            console.log('');
            
            console.log(chalk.white('═'.repeat(80)));
            console.log('');
            console.log(chalk.bold.yellow('📊 FEEDBACK STATISTICS:'));
            console.log(chalk.white(`   Iterations performed: ${data.workflow.iterationsPerformed}`));
            console.log(chalk.white(`   Follow-up questions generated: ${data.totalResearchQuestions}`));
            console.log(chalk.white(`   Entities discovered: ${data.totalEntitiesDiscovered}`));
            console.log(chalk.white(`   Completeness improvement: ${(data.completenessImprovement.improvement * 100).toFixed(1)}%`));
            console.log(chalk.white(`   Initial completeness: ${(data.completenessImprovement.initial * 100).toFixed(1)}%`));
            console.log(chalk.white(`   Final completeness: ${(data.completenessImprovement.final * 100).toFixed(1)}%`));
            console.log('');
            
            if (data.iterations && data.iterations.length > 0) {
                console.log(chalk.bold.cyan('🔍 ITERATION DETAILS:'));
                data.iterations.forEach((iteration, index) => {
                    console.log(chalk.gray(`   Iteration ${index + 1}:`));
                    console.log(chalk.gray(`     Completeness: ${(iteration.completenessScore * 100).toFixed(1)}%`));
                    console.log(chalk.gray(`     Follow-ups: ${iteration.followUpQuestions?.length || 0}`));
                    console.log(chalk.gray(`     Research results: ${iteration.researchResults?.totalEntities || 0} entities`));
                });
            }
            
            console.log('');
            
            return {
                success: true,
                data: data
            };
        } else {
            console.log(chalk.red(`❌ Iterative feedback failed: ${feedbackResult.error}`));
            return { success: false, error: feedbackResult.error };
        }
        
    } catch (error) {
        console.log(chalk.red(`❌ Error: ${error.message}`));
        return { success: false, error: error.message };
    }
}

/**
 * Get feedback options for different modes
 */
function getFeedbackOptionsForMode(mode) {
    switch (mode) {
        case 'fast':
            return {
                maxIterations: 1,
                completenessThreshold: 0.7,
                maxFollowUpQuestions: 1,
                workflowMode: 'fast',
                enhancementLevel: 'basic'
            };
        case 'comprehensive':
            return {
                maxIterations: 4,
                completenessThreshold: 0.9,
                maxFollowUpQuestions: 3,
                workflowMode: 'comprehensive',
                enhancementLevel: 'comprehensive'
            };
        default: // standard
            return {
                maxIterations: 3,
                completenessThreshold: 0.8,
                maxFollowUpQuestions: 2,
                workflowMode: 'standard',
                enhancementLevel: 'standard'
            };
    }
}

/**
 * Store iterative feedback results
 */
async function storeIterativeFeedbackResults(question, feedbackResult, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const feedbackAttrURI = `${question.uri}/attr/iterative_feedback`;
    const flowAttrURI = `${question.uri}/attr/flow_stage_10`;
    
    const data = feedbackResult.data;
    const triples = [];
    
    // Iterative feedback results attribute
    triples.push(`<${question.uri}> ragno:hasAttribute <${feedbackAttrURI}> .`);
    triples.push(`<${feedbackAttrURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "iterative-feedback-results" ;`);
    triples.push(`    ragno:attributeValue "${escapeRDFString(data.finalAnswer)}" ;`);
    triples.push(`    ragno:iterationsPerformed ${data.workflow.iterationsPerformed} ;`);
    triples.push(`    ragno:totalResearchQuestions ${data.totalResearchQuestions} ;`);
    triples.push(`    ragno:totalEntitiesDiscovered ${data.totalEntitiesDiscovered} ;`);
    triples.push(`    ragno:completenessImprovement ${data.completenessImprovement.improvement} ;`);
    triples.push(`    ragno:initialCompleteness ${data.completenessImprovement.initial} ;`);
    triples.push(`    ragno:finalCompleteness ${data.completenessImprovement.final} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Flow stage tracking
    triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
    triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "10-iterative-feedback" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Update processing stage
    triples.push(`<${question.uri}> ragno:processingStage "feedback-completed" .`);
    
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
        throw new Error(`Failed to store iterative feedback results: ${result.error}`);
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
function displaySummary(feedbackStats, mode, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 10 Completion Summary:'));
    console.log(chalk.white(`   Feedback mode: ${mode}`));
    console.log(chalk.white(`   Questions processed: ${feedbackStats.questionsProcessed}`));
    console.log(chalk.white(`   Successful feedback cycles: ${feedbackStats.successfulIterations}`));
    console.log(chalk.white(`   Total iterations performed: ${feedbackStats.totalIterations}`));
    console.log(chalk.white(`   Total follow-up questions: ${feedbackStats.totalFollowUpQuestions}`));
    console.log(chalk.white(`   Total entities discovered: ${feedbackStats.totalEntitiesDiscovered}`));
    console.log(chalk.white(`   Feedback errors: ${feedbackStats.errors}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (feedbackStats.successfulIterations > 0) {
        console.log(chalk.white(`   Average iterations per question: ${(feedbackStats.totalIterations / feedbackStats.successfulIterations).toFixed(1)}`));
        console.log(chalk.white(`   Average completeness improvement: ${(feedbackStats.averageImprovement * 100).toFixed(1)}%`));
        console.log(chalk.white(`   Average entities per question: ${(feedbackStats.totalEntitiesDiscovered / feedbackStats.successfulIterations).toFixed(1)}`));
    }
    
    console.log('');
    console.log(chalk.bold.green('🎉 Complete Flow Pipeline Finished!'));
    console.log(chalk.gray('All 10 stages of the iterative feedback workflow have been completed.'));
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
        
        console.log(chalk.cyan(`🎯 Running in ${args.mode} mode`));
        console.log('');
        
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
            await processSingleQuestionFeedback(args.question, llmHandler, sparqlHelper, workflowConfig, args.mode);
        } else {
            // Retrieve questions ready for iterative feedback
            const questions = await retrieveEnhancedQuestions(sparqlHelper, workflowConfig, args.limit);
            
            if (questions.length === 0) {
                console.log(chalk.yellow('⚠️  No questions ready for iterative feedback. Run Stages 1-9 first.'));
                return;
            }
            
            // Process iterative feedback
            const feedbackStats = await processIterativeFeedback(questions, llmHandler, sparqlHelper, workflowConfig, args.mode);
            
            // Display summary
            const duration = Date.now() - startTime;
            displaySummary(feedbackStats, args.mode, duration);
        }
        
        console.log(chalk.bold.green('🎉 Stage 10: Iterative feedback processing completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 10 failed:'), error.message);
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