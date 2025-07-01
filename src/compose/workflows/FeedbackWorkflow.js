/**
 * FeedbackWorkflow - Complete iterative feedback workflow
 * 
 * This workflow implements the full iterative feedback system that combines:
 * 1. WikidataWorkflow for enhanced initial answers
 * 2. IterationManager for feedback loop coordination
 * 3. Progressive answer improvement through multiple iterations
 * 
 * API: execute(input, resources, options)
 */

import BaseWorkflow from './BaseWorkflow.js';
import WikidataWorkflow from './WikidataWorkflow.js';
import IterationManager from '../feedback/IterationManager.js';
import WikidataResearcher from '../../aux/wikidata/WikidataResearcher.js';
import logger from 'loglevel';

export default class FeedbackWorkflow extends BaseWorkflow {
    constructor() {
        super('feedback-iterative');
        this.wikidataWorkflow = new WikidataWorkflow();
        this.iterationManager = new IterationManager();
    }

    /**
     * Execute the complete iterative feedback workflow
     * 
     * @param {Object} input - Workflow input data
     * @param {Object} input.question - Question object with text and optional uri
     * @param {boolean} input.enableIterativeFeedback - Enable iterative feedback loops (default: true)
     * @param {boolean} input.enableWikidataResearch - Enable Wikidata research (default: true)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for analysis and generation
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object
     * @param {Object} resources.wikidataResearch - Wikidata research component (optional)
     * @param {Object} options - Configuration options
     * @param {number} options.maxIterations - Maximum feedback iterations (default: 3)
     * @param {number} options.completenessThreshold - Completeness threshold (default: 0.8)
     * @param {number} options.maxFollowUpQuestions - Max follow-up questions per iteration (default: 2)
     * @param {string} options.workflowMode - Workflow mode: 'fast', 'standard', 'comprehensive' (default: 'standard')
     * @returns {Promise<Object>} Complete workflow results with iterative improvements
     */
    async execute(input, resources, options = {}) {
        const startTime = Date.now();
        
        try {
            this._validateInput(input, ['question']);
            this._validateResources(resources, ['llmHandler', 'sparqlHelper', 'config']);
            
            const { 
                question, 
                enableIterativeFeedback = true, 
                enableWikidataResearch = true 
            } = input;
            const { llmHandler, sparqlHelper, config, wikidataResearch } = resources;
            
            const workflowConfig = this._mergeConfig(options, {
                maxIterations: 3,
                completenessThreshold: 0.8,
                maxFollowUpQuestions: 2,
                workflowMode: 'standard',
                enhancementLevel: 'standard',
                fallbackToBeerQA: true
            });

            // Adjust settings based on workflow mode
            this._adjustConfigForMode(workflowConfig);

            this._logStep('START', `Processing question with feedback workflow: "${question.text}"`);

            // Step 1: Generate initial enhanced answer using WikidataWorkflow
            const initialResult = await this._generateInitialAnswer(
                question,
                { llmHandler, sparqlHelper, config, wikidataResearch },
                workflowConfig
            );

            if (!initialResult.success) {
                return this._handleError(new Error(initialResult.error), 'initial-answer');
            }

            let finalAnswer = initialResult.data.enhancedAnswer || initialResult.data.standardAnswer;
            let iterationResults = null;

            // Step 2: Iterative feedback processing if enabled
            if (enableIterativeFeedback) {
                const feedbackResult = await this._processIterativeFeedback(
                    question,
                    finalAnswer,
                    initialResult.data.beerqaContext || '',
                    { llmHandler, sparqlHelper, config, wikidataResearch },
                    workflowConfig
                );

                if (feedbackResult.success) {
                    iterationResults = feedbackResult.data;
                    finalAnswer = feedbackResult.data.finalAnswer;
                }
            }

            // Step 3: Generate comprehensive final response
            const comprehensiveResult = await this._generateComprehensiveResponse(
                question,
                initialResult.data,
                iterationResults,
                finalAnswer,
                llmHandler,
                workflowConfig
            );

            this._logStep('COMPLETE', 'Feedback workflow completed successfully');

            return this._createResult(true, {
                question: question,
                initialAnswer: initialResult.data.enhancedAnswer || initialResult.data.standardAnswer,
                finalAnswer: comprehensiveResult.success ? comprehensiveResult.data.response : finalAnswer,
                iterations: iterationResults?.iterations || [],
                wikidataResults: initialResult.data.wikidataResults,
                totalResearchQuestions: this._countResearchQuestions(iterationResults),
                totalEntitiesDiscovered: this._countTotalEntities(initialResult.data, iterationResults),
                completenessImprovement: this._calculateCompleteness(iterationResults),
                workflow: {
                    initialWorkflow: 'wikidata-enhanced',
                    feedbackEnabled: enableIterativeFeedback,
                    iterationsPerformed: iterationResults?.iterations?.length || 0
                }
            }, null, this._getWorkflowMetadata(startTime, {
                initialAnswerDuration: initialResult.duration,
                feedbackDuration: iterationResults?.metadata?.totalDuration || 0,
                comprehensiveResponseDuration: comprehensiveResult.duration || 0,
                workflowMode: workflowConfig.workflowMode,
                totalSteps: enableIterativeFeedback ? 3 : 2,
                enhancementLevel: workflowConfig.enhancementLevel
            }));

        } catch (error) {
            return this._handleError(error, 'workflow-execution');
        }
    }

    /**
     * Generate initial enhanced answer using WikidataWorkflow
     * @private
     */
    async _generateInitialAnswer(question, resources, workflowConfig) {
        const stepStart = Date.now();
        
        try {
            this._logStep('INITIAL', 'Generating initial enhanced answer');

            const result = await this.wikidataWorkflow.execute(
                { 
                    question, 
                    enableWikidataResearch: true 
                },
                resources,
                {
                    enhancementLevel: workflowConfig.enhancementLevel,
                    maxWikidataEntities: workflowConfig.maxWikidataEntities || 15,
                    answerStyle: 'comprehensive'
                }
            );

            return {
                ...result,
                duration: Date.now() - stepStart
            };

        } catch (error) {
            logger.error('Initial answer generation failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - stepStart
            };
        }
    }

    /**
     * Process iterative feedback to improve answer completeness
     * @private
     */
    async _processIterativeFeedback(question, initialAnswer, context, resources, workflowConfig) {
        const stepStart = Date.now();
        
        try {
            this._logStep('FEEDBACK', 'Processing iterative feedback loops');

            const result = await this.iterationManager.processIterations(
                {
                    originalQuestion: question,
                    initialResponse: initialAnswer,
                    context: context
                },
                resources,
                {
                    maxIterations: workflowConfig.maxIterations,
                    completenessThreshold: workflowConfig.completenessThreshold,
                    maxFollowUpQuestions: workflowConfig.maxFollowUpQuestions
                }
            );

            return {
                success: result.success,
                data: result,
                duration: Date.now() - stepStart
            };

        } catch (error) {
            logger.error('Iterative feedback processing failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - stepStart
            };
        }
    }

    /**
     * Generate final comprehensive response
     * @private
     */
    async _generateComprehensiveResponse(question, initialData, iterationResults, finalAnswer, llmHandler, workflowConfig) {
        const stepStart = Date.now();
        
        try {
            this._logStep('FINAL', 'Generating comprehensive final response');

            // If no iterations were performed, return the final answer as-is
            if (!iterationResults || iterationResults.iterations.length === 0) {
                return {
                    success: true,
                    data: { response: finalAnswer },
                    duration: Date.now() - stepStart
                };
            }

            const prompt = this._buildFinalResponsePrompt(
                question,
                initialData,
                iterationResults,
                finalAnswer,
                workflowConfig
            );

            const comprehensiveResponse = await llmHandler.generateResponse(prompt);

            return {
                success: true,
                data: {
                    response: comprehensiveResponse,
                    prompt: prompt.substring(0, 300) + '...' // Truncated
                },
                duration: Date.now() - stepStart
            };

        } catch (error) {
            logger.error('Comprehensive response generation failed:', error.message);
            return {
                success: false,
                error: error.message,
                data: { response: finalAnswer }, // Fallback
                duration: Date.now() - stepStart
            };
        }
    }

    /**
     * Adjust configuration based on workflow mode
     * @private
     */
    _adjustConfigForMode(config) {
        switch (config.workflowMode) {
            case 'fast':
                config.maxIterations = 1;
                config.maxFollowUpQuestions = 1;
                config.enhancementLevel = 'basic';
                break;
                
            case 'comprehensive':
                config.maxIterations = 4;
                config.maxFollowUpQuestions = 3;
                config.enhancementLevel = 'comprehensive';
                config.completenessThreshold = 0.9;
                break;
                
            default: // 'standard'
                // Use default values
                break;
        }
    }

    /**
     * Count total research questions across iterations
     * @private
     */
    _countResearchQuestions(iterationResults) {
        if (!iterationResults?.iterations) return 0;
        
        return iterationResults.iterations.reduce((total, iteration) => {
            return total + (iteration.followUpQuestions?.length || 0);
        }, 0);
    }

    /**
     * Count total entities discovered across all research
     * @private
     */
    _countTotalEntities(initialData, iterationResults) {
        let total = initialData.wikidataEntitiesFound || 0;
        
        if (iterationResults?.iterations) {
            total += iterationResults.iterations.reduce((sum, iteration) => {
                return sum + (iteration.researchResults?.totalEntities || 0);
            }, 0);
        }
        
        return total;
    }

    /**
     * Calculate completeness improvement across iterations
     * @private
     */
    _calculateCompleteness(iterationResults) {
        if (!iterationResults?.iterations || iterationResults.iterations.length === 0) {
            return { initial: 1.0, final: 1.0, improvement: 0 };
        }
        
        const initial = iterationResults.iterations[0]?.completenessScore || 0;
        const final = iterationResults.metadata?.finalCompleteness || initial;
        
        return {
            initial,
            final,
            improvement: final - initial
        };
    }

    /**
     * Build final comprehensive response prompt
     * @private
     */
    _buildFinalResponsePrompt(question, initialData, iterationResults, finalAnswer, workflowConfig) {
        const researchSummary = this._createResearchSummary(initialData, iterationResults);
        
        return `You are providing a final, comprehensive answer after a complete iterative research and feedback process.

ORIGINAL QUESTION: ${question.text}

RESEARCH PROCESS SUMMARY:
${researchSummary}

CURRENT FINAL ANSWER: ${finalAnswer}

Please provide a polished, comprehensive final answer that:
1. Synthesizes all research findings and iterations
2. Provides the most complete response possible
3. Is well-structured and highly informative
4. Addresses all aspects of the original question
5. Demonstrates the value of the iterative research process

COMPREHENSIVE FINAL ANSWER:`;
    }

    /**
     * Create summary of entire research process
     * @private
     */
    _createResearchSummary(initialData, iterationResults) {
        let summary = '## Research Process Overview\n';
        
        // Initial research
        if (initialData.wikidataEntitiesFound > 0) {
            summary += `- Initial Wikidata research: ${initialData.wikidataEntitiesFound} entities discovered\n`;
        }
        
        // Iterative research
        if (iterationResults?.iterations) {
            summary += `- Iterative feedback: ${iterationResults.iterations.length} iterations performed\n`;
            
            let totalFollowUps = 0;
            let totalIterativeEntities = 0;
            
            for (const iteration of iterationResults.iterations) {
                totalFollowUps += iteration.followUpQuestions?.length || 0;
                totalIterativeEntities += iteration.researchResults?.totalEntities || 0;
            }
            
            summary += `- Follow-up research questions: ${totalFollowUps}\n`;
            summary += `- Additional entities discovered: ${totalIterativeEntities}\n`;
        }
        
        return summary;
    }
}