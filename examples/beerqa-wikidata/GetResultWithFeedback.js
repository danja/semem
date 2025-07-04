#!/usr/bin/env node

/**
 * GetResultWithFeedback.js - Iterative question-answering with automated feedback loops
 * 
 * This script orchestrates an iterative knowledge discovery process that:
 * 1. Generates initial answers using WikidataGetResult.js approach
 * 2. Analyzes answer completeness and extracts follow-up questions
 * 3. Researches follow-up questions using Wikidata integration
 * 4. Repeats until answers are complete or max iterations reached
 * 5. Synthesizes final comprehensive answers from all iterations
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import FeedbackAnalyzer from './FeedbackAnalyzer.js';
import QuestionGenerator from './QuestionGenerator.js';
import WikidataResearch from './WikidataResearch.js';

// Import functions from WikidataGetResult.js
import { 
    getQuestionsWithEnhancedRelationships,
    getEnhancedEntityContext,
    buildEnhancedContext,
    generateEnhancedAnswer,
    processQuestionForAnswer,
    initializeLLMHandler
} from './WikidataGetResult.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('      🔄 ITERATIVE WIKIDATA QUESTION ANSWERING           ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('   Feedback-driven knowledge discovery with auto-iteration   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('Max Iterations:')} ${chalk.white(config.maxIterations)}`);
    console.log(`   ${chalk.cyan('Completeness Threshold:')} ${chalk.white((config.completenessThreshold * 100).toFixed(1) + '%')}`);
    console.log(`   ${chalk.cyan('Max Follow-up Questions:')} ${chalk.white(config.maxFollowUpQuestions)}`);
    console.log(`   ${chalk.cyan('Research Depth:')} ${chalk.white(config.researchDepth)}`);
    console.log('');
}

/**
 * Enhanced question processing with iterative feedback
 */
class IterativeQuestionProcessor {
    constructor(config, sparqlHelper, llmHandler, wikidataResearch) {
        this.config = config;
        this.sparqlHelper = sparqlHelper;
        this.llmHandler = llmHandler;
        this.wikidataResearch = wikidataResearch;
        
        // Initialize feedback components
        this.feedbackAnalyzer = new FeedbackAnalyzer(llmHandler, {
            completenessThreshold: config.completenessThreshold,
            maxFollowUpQuestions: config.maxFollowUpQuestions
        });
        
        this.questionGenerator = new QuestionGenerator(sparqlHelper, config, {
            maxIterations: config.maxIterations
        });
        
        // Statistics tracking
        this.stats = {
            questionsProcessed: 0,
            iterationsPerformed: 0,
            followUpQuestionsGenerated: 0,
            averageIterations: 0,
            completenessImprovement: 0
        };
    }

    /**
     * Process a question with iterative feedback until complete
     */
    async processQuestionIteratively(question) {
        console.log(chalk.bold.blue(`\n🔄 Starting iterative processing: "${question.text}"`));
        
        let iterationLevel = 0;
        let currentAnswer = null;
        let allAnswers = [];
        let isComplete = false;
        let totalContext = '';
        
        while (iterationLevel < this.config.maxIterations && !isComplete) {
            iterationLevel++;
            console.log(chalk.bold.cyan(`\n--- Iteration ${iterationLevel} ---`));
            
            try {
                // Step 1: Generate answer for current iteration
                if (iterationLevel === 1) {
                    // Initial answer using existing enhanced approach
                    currentAnswer = await this.generateInitialAnswer(question);
                } else {
                    // Enhanced answer incorporating follow-up research
                    currentAnswer = await this.generateEnhancedIterativeAnswer(question, allAnswers, totalContext);
                }
                
                if (!currentAnswer.success) {
                    console.log(chalk.red(`   ❌ Failed to generate answer for iteration ${iterationLevel}`));
                    break;
                }
                
                allAnswers.push({
                    iteration: iterationLevel,
                    answer: currentAnswer.answer,
                    contextLength: currentAnswer.contextLength || 0,
                    sources: currentAnswer.stats || {}
                });
                
                // Step 2: Analyze answer completeness
                const analysis = await this.feedbackAnalyzer.analyzeResponse(
                    question.text,
                    currentAnswer.answer,
                    currentAnswer.context || ''
                );
                
                this.feedbackAnalyzer.displayAnalysis(analysis);
                
                // Step 3: Check if complete
                if (analysis.isComplete) {
                    console.log(chalk.green(`   ✅ Answer complete after ${iterationLevel} iteration(s)`));
                    isComplete = true;
                    break;
                }
                
                // Step 4: Generate follow-up questions if not complete
                if (analysis.followUpQuestions.length > 0) {
                    const followUpQuestions = await this.questionGenerator.generateQuestions(
                        question, 
                        analysis, 
                        iterationLevel
                    );
                    
                    this.stats.followUpQuestionsGenerated += followUpQuestions.length;
                    
                    // Step 5: Research follow-up questions
                    if (followUpQuestions.length > 0) {
                        const researchResults = await this.researchFollowUpQuestions(followUpQuestions);
                        totalContext += researchResults.additionalContext;
                        
                        console.log(chalk.green(`   ✓ Research completed for ${followUpQuestions.length} follow-up questions`));
                    }
                } else {
                    console.log(chalk.yellow(`   ⚠️  No follow-up questions generated, stopping iteration`));
                    break;
                }
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Error in iteration ${iterationLevel}: ${error.message}`));
                break;
            }
        }
        
        // Step 6: Generate final synthesized answer
        const finalAnswer = await this.synthesizeFinalAnswer(question, allAnswers, totalContext);
        
        // Update statistics
        this.stats.questionsProcessed++;
        this.stats.iterationsPerformed += iterationLevel;
        this.stats.averageIterations = this.stats.iterationsPerformed / this.stats.questionsProcessed;
        
        return {
            success: true,
            question: question,
            finalAnswer: finalAnswer,
            iterations: allAnswers,
            totalIterations: iterationLevel,
            wasComplete: isComplete,
            stats: {
                iterationCount: iterationLevel,
                followUpGenerated: this.stats.followUpQuestionsGenerated,
                finalContextLength: finalAnswer.contextLength || 0
            }
        };
    }

    /**
     * Generate initial answer using enhanced Wikidata approach
     */
    async generateInitialAnswer(question) {
        try {
            console.log(chalk.white('   📝 Generating initial enhanced answer...'));
            
            // Use existing enhanced answer generation from WikidataGetResult.js
            const result = await processQuestionForAnswer(
                question,
                this.sparqlHelper,
                this.llmHandler,
                this.config
            );
            
            return result;
            
        } catch (error) {
            logger.error('Failed to generate initial answer:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate enhanced answer incorporating follow-up research from previous iterations
     */
    async generateEnhancedIterativeAnswer(question, previousAnswers, additionalContext) {
        try {
            console.log(chalk.white('   📝 Generating enhanced iterative answer...'));
            
            // Get existing entity context
            const entityURIs = [...new Set(question.relationships.map(rel => rel.targetEntity))];
            const contextSources = await getEnhancedEntityContext(entityURIs, question, this.sparqlHelper, this.config);
            
            // Build enhanced context with additional research
            let context = buildEnhancedContext(question, question.relationships, contextSources, this.config);
            
            // Add context from previous iterations
            if (additionalContext) {
                context += '\n\nADDITIONAL RESEARCH:\n' + additionalContext;
            }
            
            // Add previous iteration results for context
            if (previousAnswers.length > 0) {
                context += '\n\nPREVIOUS ANALYSIS:\n';
                previousAnswers.forEach((prev, i) => {
                    context += `Iteration ${prev.iteration}: ${prev.answer.substring(0, 200)}...\n`;
                });
            }
            
            // Generate enhanced answer with iterative context
            const answerResult = await generateEnhancedAnswer(question, context, this.llmHandler, this.config);
            
            if (answerResult.success) {
                return {
                    success: true,
                    answer: answerResult.answer,
                    context: context,
                    contextLength: context.length,
                    stats: {
                        hasWikidataContext: answerResult.hasWikidataContext,
                        hasWikipediaContext: answerResult.hasWikipediaContext,
                        hasBeerqaContext: answerResult.hasBeerqaContext
                    }
                };
            }
            
            return answerResult;
            
        } catch (error) {
            logger.error('Failed to generate enhanced iterative answer:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Research follow-up questions using Wikidata integration
     */
    async researchFollowUpQuestions(followUpQuestions) {
        console.log(chalk.bold.cyan(`   🔍 Researching ${followUpQuestions.length} follow-up questions...`));
        
        let additionalContext = '';
        let totalEntities = 0;
        
        for (const followUp of followUpQuestions) {
            try {
                console.log(chalk.cyan(`      Researching: ${followUp.text}`));
                
                // Create a question object for research
                const researchQuestion = {
                    text: followUp.text,
                    uri: followUp.uri
                };
                
                // Perform Wikidata research
                const researchResult = await this.wikidataResearch.executeResearch(researchQuestion.text);
                
                if (researchResult.success) {
                    // Mark question as researched
                    await this.questionGenerator.markQuestionResearched(followUp.uri, {
                        entityCount: researchResult.ragnoEntities?.length || 0,
                        conceptCount: researchResult.concepts?.length || 0
                    });
                    
                    // Add research results to context
                    if (researchResult.ragnoEntities && researchResult.ragnoEntities.length > 0) {
                        additionalContext += `\nResearch for "${followUp.text}":\n`;
                        researchResult.ragnoEntities.slice(0, 3).forEach(entity => {
                            additionalContext += `• ${entity.originalEntity?.label || 'Unknown'}: ${entity.originalEntity?.description || 'No description'}\n`;
                        });
                        totalEntities += researchResult.ragnoEntities.length;
                    }
                    
                    console.log(chalk.green(`      ✓ Found ${researchResult.ragnoEntities?.length || 0} entities`));
                } else {
                    console.log(chalk.yellow(`      ⚠️  Research failed: ${researchResult.error || 'Unknown error'}`));
                }
                
                // Add delay to avoid overwhelming services
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(chalk.red(`      ❌ Research error: ${error.message}`));
            }
        }
        
        console.log(chalk.green(`   ✓ Research completed: ${totalEntities} total entities found`));
        
        return {
            additionalContext: additionalContext,
            totalEntities: totalEntities,
            questionsResearched: followUpQuestions.length
        };
    }

    /**
     * Synthesize final comprehensive answer from all iterations
     */
    async synthesizeFinalAnswer(question, allAnswers, additionalContext) {
        try {
            console.log(chalk.bold.white('   🎯 Synthesizing final comprehensive answer...'));
            
            // Combine all iteration results
            const iterationSummary = allAnswers.map((ans, i) => 
                `Iteration ${ans.iteration}: ${ans.answer}`
            ).join('\n\n');
            
            const synthesisPrompt = `You are an expert knowledge synthesizer. Based on multiple iterations of research and analysis, provide a comprehensive final answer to the original question.

ORIGINAL QUESTION: ${question.text}

ITERATION RESULTS:
${iterationSummary}

ADDITIONAL RESEARCH CONTEXT:
${additionalContext}

INSTRUCTIONS:
- Synthesize information from all iterations into one comprehensive answer
- Remove redundancy while preserving all relevant information
- Maintain source attribution from different iterations
- Provide the most complete answer possible based on all available information
- If there are still gaps, clearly state what remains unknown

FINAL COMPREHENSIVE ANSWER:`;

            const synthesizedAnswer = await this.llmHandler.generateResponse(synthesisPrompt);
            
            return {
                answer: synthesizedAnswer,
                contextLength: iterationSummary.length + additionalContext.length,
                iterationsUsed: allAnswers.length,
                synthesisMethod: 'llm-integration'
            };
            
        } catch (error) {
            logger.error('Failed to synthesize final answer:', error.message);
            
            // Fallback: return the last iteration's answer
            const lastAnswer = allAnswers[allAnswers.length - 1];
            return {
                answer: lastAnswer.answer,
                contextLength: lastAnswer.contextLength || 0,
                iterationsUsed: allAnswers.length,
                synthesisMethod: 'fallback-last-iteration'
            };
        }
    }

    /**
     * Display processing statistics
     */
    displayStatistics() {
        console.log(chalk.bold.yellow('\n📊 Iterative Processing Statistics:'));
        console.log(chalk.white(`   Questions Processed: ${this.stats.questionsProcessed}`));
        console.log(chalk.white(`   Total Iterations: ${this.stats.iterationsPerformed}`));
        console.log(chalk.white(`   Average Iterations per Question: ${this.stats.averageIterations.toFixed(1)}`));
        console.log(chalk.white(`   Follow-up Questions Generated: ${this.stats.followUpQuestionsGenerated}`));
        console.log('');
    }
}

/**
 * Main iterative question answering function
 */
async function runIterativeQuestionAnswering() {
    displayHeader();
    
    try {
        // Load configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        const configObj = new Config(configPath);
        await configObj.init();
        const storageOptions = configObj.get('storage.options');
        
        // Enhanced configuration with feedback settings
        const config = {
            sparqlEndpoint: storageOptions.update,
            sparqlAuth: { 
                user: storageOptions.user || 'admin', 
                password: storageOptions.password || 'admin123' 
            },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research',
            navigationGraphURI: 'http://purl.org/stuff/navigation/enhanced',
            maxContextTokens: 4000, // Increased for iterative context
            maxContextSize: 16000, // Increased for multiple iterations
            maxIterations: 3, // Maximum feedback iterations
            completenessThreshold: 0.8, // 80% completeness threshold
            maxFollowUpQuestions: 2, // Max follow-up questions per iteration
            researchDepth: 'focused', // Research strategy
            timeout: 60000 // Increased timeout for iterative processing
        };
        
        displayConfiguration(config);
        
        // Initialize components
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        const llmHandler = await initializeLLMHandler(configObj);
        
        // Initialize Wikidata research workflow
        const wikidataResearch = new WikidataResearch({
            sparqlEndpoint: config.sparqlEndpoint,
            sparqlAuth: config.sparqlAuth,
            wikidataGraphURI: config.wikidataGraphURI,
            timeout: config.timeout
        });
        await wikidataResearch.initialize();
        
        // Create iterative processor
        const processor = new IterativeQuestionProcessor(config, sparqlHelper, llmHandler, wikidataResearch);
        
        // Get questions with enhanced relationships
        const questions = await getQuestionsWithEnhancedRelationships(sparqlHelper, config);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with enhanced relationships found. Run WikidataNavigate.js first.'));
            return;
        }
        
        console.log(chalk.bold.white(`🔄 Starting iterative processing for ${questions.length} questions...`));
        console.log('');
        
        // Process questions iteratively
        const results = [];
        
        for (let i = 0; i < Math.min(questions.length, 3); i++) { // Limit to 3 questions for demo
            const question = questions[i];
            
            console.log(chalk.bold.blue(`\nQuestion ${i + 1}/${Math.min(questions.length, 3)}:`));
            
            const result = await processor.processQuestionIteratively(question);
            results.push(result);
            
            // Display final answer
            if (result.success) {
                console.log(chalk.bold.white('\n📝 FINAL COMPREHENSIVE ANSWER:'));
                console.log(chalk.white(result.finalAnswer.answer));
                console.log(chalk.green(`\n   ✓ Completed in ${result.totalIterations} iteration(s)`));
                console.log(chalk.green(`   ✓ Context length: ${result.finalAnswer.contextLength} characters`));
            }
        }
        
        // Display overall statistics
        processor.displayStatistics();
        await processor.questionGenerator.displayStatistics();
        
        console.log(chalk.green('🎉 Iterative question answering completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Iterative question answering failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runIterativeQuestionAnswering();
}

export { 
    IterativeQuestionProcessor,
    runIterativeQuestionAnswering
};