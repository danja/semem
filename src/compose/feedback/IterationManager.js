/**
 * IterationManager - Manage iterative feedback loops for question answering
 * 
 * This component orchestrates the complete iterative feedback workflow by coordinating
 * ResponseAnalyzer, FollowUpGenerator, and research components to progressively
 * improve answer completeness through multiple iterations.
 * 
 * API: processIterations(input, resources, options)
 */

import logger from 'loglevel';
import ResponseAnalyzer from './ResponseAnalyzer.js';
import FollowUpGenerator from './FollowUpGenerator.js';

export default class IterationManager {
    constructor() {
        this.responseAnalyzer = new ResponseAnalyzer();
        this.followUpGenerator = new FollowUpGenerator();
    }

    /**
     * Process iterative feedback loops for comprehensive question answering
     * 
     * @param {Object} input - Iteration input data
     * @param {Object} input.originalQuestion - Original question object with uri and text
     * @param {string} input.initialResponse - Initial response to analyze and improve
     * @param {string} input.context - Available context for the question
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for analysis and generation
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} resources.wikidataResearch - Wikidata research component (optional)
     * @param {Object} options - Configuration options
     * @param {number} options.maxIterations - Maximum iterations to perform (default: 3)
     * @param {number} options.completenessThreshold - Threshold for completeness (default: 0.8)
     * @param {number} options.maxFollowUpQuestions - Max follow-up questions per iteration (default: 2)
     * @returns {Promise<Object>} Complete iteration results with final answer
     */
    async processIterations(input, resources, options = {}) {
        const { originalQuestion, initialResponse, context = '' } = input;
        const { llmHandler, sparqlHelper, config, wikidataResearch } = resources;
        
        const iterationConfig = {
            maxIterations: options.maxIterations || 3,
            completenessThreshold: options.completenessThreshold || 0.8,
            maxFollowUpQuestions: options.maxFollowUpQuestions || 2,
            ...options
        };

        try {
            const iterations = [];
            let currentResponse = initialResponse;
            let currentIteration = 1;
            let isComplete = false;

            // Process iterations until complete or max iterations reached
            while (currentIteration <= iterationConfig.maxIterations && !isComplete) {
                const iterationStart = Date.now();
                
                // Step 1: Analyze current response for completeness
                const analysisResult = await this.responseAnalyzer.analyzeCompleteness(
                    {
                        originalQuestion: originalQuestion.text,
                        response: currentResponse,
                        context: context
                    },
                    { llmHandler },
                    {
                        completenessThreshold: iterationConfig.completenessThreshold,
                        maxFollowUpQuestions: iterationConfig.maxFollowUpQuestions
                    }
                );

                // Check if response is complete
                isComplete = analysisResult.isComplete;

                const iterationData = {
                    iteration: currentIteration,
                    completenessScore: analysisResult.completenessScore,
                    isComplete: isComplete,
                    reasoning: analysisResult.reasoning,
                    followUpQuestions: analysisResult.followUpQuestions,
                    researchResults: null,
                    enhancedResponse: null,
                    duration: null
                };

                // If not complete, generate and research follow-up questions
                if (!isComplete && currentIteration < iterationConfig.maxIterations) {
                    // Step 2: Generate follow-up questions
                    const generationResult = await this.followUpGenerator.generateQuestions(
                        {
                            originalQuestion,
                            analysisResult,
                            iterationLevel: currentIteration
                        },
                        { sparqlHelper, config },
                        iterationConfig
                    );

                    if (generationResult.success && generationResult.questions.length > 0) {
                        // Step 3: Research follow-up questions (if research component available)
                        if (wikidataResearch) {
                            const researchResults = await this._researchFollowUpQuestions(
                                generationResult.questions,
                                wikidataResearch,
                                iterationConfig
                            );
                            
                            iterationData.researchResults = researchResults;

                            // Step 4: Generate enhanced response with research findings
                            if (researchResults.success && researchResults.totalEntities > 0) {
                                const enhancedResponse = await this._generateEnhancedResponse(
                                    originalQuestion,
                                    currentResponse,
                                    researchResults,
                                    llmHandler,
                                    iterationConfig
                                );
                                
                                iterationData.enhancedResponse = enhancedResponse;
                                if (enhancedResponse.success) {
                                    currentResponse = enhancedResponse.response;
                                }
                            }

                            // Mark questions as researched
                            for (const question of generationResult.questions) {
                                await this.followUpGenerator.markQuestionResearched(
                                    {
                                        questionURI: question.uri,
                                        researchResults: {
                                            entityCount: researchResults.entitiesPerQuestion || 0,
                                            conceptCount: researchResults.conceptsPerQuestion || 0
                                        }
                                    },
                                    { sparqlHelper, config }
                                );
                            }
                        }
                    }
                }

                iterationData.duration = Date.now() - iterationStart;
                iterations.push(iterationData);
                currentIteration++;
            }

            // Generate final comprehensive answer if we performed research
            let finalAnswer = currentResponse;
            if (iterations.some(iter => iter.researchResults?.success)) {
                const finalAnswerResult = await this._generateFinalAnswer(
                    originalQuestion,
                    iterations,
                    currentResponse,
                    llmHandler,
                    iterationConfig
                );
                
                if (finalAnswerResult.success) {
                    finalAnswer = finalAnswerResult.answer;
                }
            }

            return {
                success: true,
                originalQuestion,
                initialResponse,
                finalAnswer,
                iterations,
                metadata: {
                    totalIterations: iterations.length,
                    finalCompleteness: iterations[iterations.length - 1]?.completenessScore || 0,
                    isComplete: isComplete,
                    totalDuration: iterations.reduce((sum, iter) => sum + (iter.duration || 0), 0),
                    timestamp: new Date().toISOString(),
                    config: iterationConfig
                }
            };

        } catch (error) {
            logger.error('Failed to process iterations:', error.message);
            return {
                success: false,
                error: error.message,
                originalQuestion,
                initialResponse,
                finalAnswer: initialResponse,
                iterations: [],
                metadata: {
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Research follow-up questions using Wikidata integration
     * @private
     */
    async _researchFollowUpQuestions(questions, wikidataResearch, config) {
        try {
            const researchResults = {
                success: true,
                questionsResearched: 0,
                totalEntities: 0,
                entitiesPerQuestion: 0,
                conceptsPerQuestion: 0,
                researchDetails: []
            };

            for (const question of questions) {
                try {
                    const result = await wikidataResearch.executeResearch(question.text);
                    
                    if (result && result.ragnoEntities) {
                        const entityCount = result.ragnoEntities.length;
                        researchResults.questionsResearched++;
                        researchResults.totalEntities += entityCount;
                        
                        researchResults.researchDetails.push({
                            questionURI: question.uri,
                            questionText: question.text,
                            entitiesFound: entityCount,
                            success: true
                        });
                    }
                } catch (error) {
                    logger.debug(`Research failed for question: ${question.text}`, error.message);
                    researchResults.researchDetails.push({
                        questionURI: question.uri,
                        questionText: question.text,
                        entitiesFound: 0,
                        success: false,
                        error: error.message
                    });
                }
            }

            if (researchResults.questionsResearched > 0) {
                researchResults.entitiesPerQuestion = Math.round(
                    researchResults.totalEntities / researchResults.questionsResearched
                );
            }

            return researchResults;

        } catch (error) {
            logger.error('Failed to research follow-up questions:', error.message);
            return {
                success: false,
                error: error.message,
                questionsResearched: 0,
                totalEntities: 0,
                researchDetails: []
            };
        }
    }

    /**
     * Generate enhanced response incorporating research findings
     * @private
     */
    async _generateEnhancedResponse(originalQuestion, currentResponse, researchResults, llmHandler, config) {
        try {
            const prompt = `You are enhancing an answer with new research findings. Incorporate the research results to provide a more comprehensive answer.

ORIGINAL QUESTION: ${originalQuestion.text}

CURRENT ANSWER: ${currentResponse}

RESEARCH SUMMARY:
- Questions researched: ${researchResults.questionsResearched}
- Total entities found: ${researchResults.totalEntities}
- Average entities per question: ${researchResults.entitiesPerQuestion}

RESEARCH DETAILS:
${researchResults.researchDetails.map((detail, i) => 
`${i + 1}. Question: "${detail.questionText}"
   Results: ${detail.success ? `${detail.entitiesFound} entities found` : 'Research failed'}`
).join('\n')}

Please provide an enhanced answer that:
1. Builds upon the current answer
2. Incorporates insights from the research findings
3. Provides more comprehensive coverage
4. Maintains accuracy and coherence
5. Cites the additional research when relevant

ENHANCED ANSWER:`;

            const enhancedResponse = await llmHandler.generateResponse(prompt);
            
            return {
                success: true,
                response: enhancedResponse,
                metadata: {
                    researchIncorporated: researchResults.questionsResearched,
                    entitiesConsidered: researchResults.totalEntities,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Failed to generate enhanced response:', error.message);
            return {
                success: false,
                error: error.message,
                response: currentResponse
            };
        }
    }

    /**
     * Generate final comprehensive answer from all iterations
     * @private
     */
    async _generateFinalAnswer(originalQuestion, iterations, currentResponse, llmHandler, config) {
        try {
            const researchSummary = iterations
                .filter(iter => iter.researchResults?.success)
                .map(iter => ({
                    iteration: iter.iteration,
                    questionsResearched: iter.researchResults.questionsResearched,
                    entitiesFound: iter.researchResults.totalEntities,
                    completeness: iter.completenessScore
                }));

            const totalQuestions = researchSummary.reduce((sum, iter) => sum + iter.questionsResearched, 0);
            const totalEntities = researchSummary.reduce((sum, iter) => sum + iter.entitiesFound, 0);
            const finalCompleteness = iterations[iterations.length - 1]?.completenessScore || 0;

            const prompt = `You are providing a final comprehensive answer after multiple iterations of research and enhancement.

ORIGINAL QUESTION: ${originalQuestion.text}

ITERATION SUMMARY:
- Total iterations: ${iterations.length}
- Research questions investigated: ${totalQuestions}
- Total entities discovered: ${totalEntities}
- Final completeness score: ${(finalCompleteness * 100).toFixed(1)}%

CURRENT ENHANCED ANSWER: ${currentResponse}

Please provide a final, comprehensive answer that:
1. Synthesizes all research findings from the iterations
2. Provides the most complete response possible
3. Maintains accuracy and coherence
4. Addresses all aspects of the original question
5. Is well-structured and informative

FINAL COMPREHENSIVE ANSWER:`;

            const finalAnswer = await llmHandler.generateResponse(prompt);
            
            return {
                success: true,
                answer: finalAnswer,
                metadata: {
                    iterationsSynthesized: iterations.length,
                    researchQuestionsSynthesized: totalQuestions,
                    entitiesSynthesized: totalEntities,
                    finalCompleteness: finalCompleteness,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Failed to generate final answer:', error.message);
            return {
                success: false,
                error: error.message,
                answer: currentResponse
            };
        }
    }
}