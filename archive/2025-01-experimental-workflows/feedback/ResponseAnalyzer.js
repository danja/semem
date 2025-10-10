/**
 * ResponseAnalyzer - Analyze responses for completeness and extract follow-up questions
 * 
 * This component analyzes LLM responses to detect incomplete information and automatically
 * extracts specific follow-up questions that could help complete the answer. It uses
 * pattern matching and LLM analysis to identify knowledge gaps and generate targeted
 * research questions.
 * 
 * API: analyzeCompleteness(input, resources, options)
 */

import logger from 'loglevel';

/**
 * Patterns that indicate incomplete or missing information
 */
const INCOMPLETE_PATTERNS = [
    /additional information would be helpful/i,
    /not possible to determine/i,
    /cannot determine/i,
    /would need to know/i,
    /more specific information/i,
    /additional context/i,
    /would be helpful to know/i,
    /additional details/i,
    /specific details/i,
    /more information/i,
    /cannot provide/i,
    /unable to determine/i,
    /insufficient information/i,
    /would require/i,
    /need more details/i,
    /additional sources/i,
    /more comprehensive answer/i
];

export default class ResponseAnalyzer {
    /**
     * Analyze response completeness and extract follow-up questions
     * 
     * @param {Object} input - Analysis input data
     * @param {string} input.originalQuestion - The original question asked
     * @param {string} input.response - The response to analyze
     * @param {string} input.context - Available context for the question
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for analysis
     * @param {Object} options - Configuration options
     * @param {number} options.completenessThreshold - Threshold for completeness (default: 0.8)
     * @param {number} options.maxFollowUpQuestions - Max follow-up questions to generate (default: 3)
     * @param {number} options.minConfidence - Minimum confidence score (default: 0.7)
     * @returns {Promise<Object>} Analysis results with completeness score and follow-up questions
     */
    async analyzeCompleteness(input, resources, options = {}) {
        const { originalQuestion, response, context = '' } = input;
        const { llmHandler } = resources;

        const config = {
            completenessThreshold: options.completenessThreshold,
            maxFollowUpQuestions: options.maxFollowUpQuestions || 3,
            minConfidence: options.minConfidence,
            ...options
        };

        try {
            // Step 1: Pattern-based incompleteness detection
            const incompleteness = this._detectIncompleteness(response);

            // Step 2: LLM-based analysis for completeness scoring
            const completenessAnalysis = await this._analyzeCompletenessWithLLM(
                originalQuestion, response, context, llmHandler
            );

            // Step 3: Extract follow-up questions if incomplete
            let followUpQuestions = [];
            if (incompleteness.isIncomplete || completenessAnalysis.score < config.completenessThreshold) {
                followUpQuestions = await this._extractFollowUpQuestions(
                    originalQuestion, response, context, llmHandler, config
                );
            }

            const result = {
                isComplete: !incompleteness.isIncomplete && completenessAnalysis.score >= config.completenessThreshold,
                completenessScore: completenessAnalysis.score,
                incompleteness: incompleteness,
                reasoning: completenessAnalysis.reasoning,
                followUpQuestions: followUpQuestions,
                confidence: completenessAnalysis.confidence,
                metadata: {
                    analysisTimestamp: new Date().toISOString(),
                    thresholdUsed: config.completenessThreshold,
                    patternMatches: incompleteness.matches.length,
                    followUpCount: followUpQuestions.length
                }
            };

            return result;

        } catch (error) {
            logger.error('Failed to analyze response:', error.message);
            return {
                isComplete: true, // Default to complete if analysis fails
                completenessScore: 0.5,
                error: error.message,
                followUpQuestions: [],
                confidence: 0.3,
                metadata: {
                    analysisTimestamp: new Date().toISOString(),
                    error: true
                }
            };
        }
    }

    /**
     * Detect incompleteness using pattern matching
     * @private
     */
    _detectIncompleteness(response) {
        const matches = [];
        let isIncomplete = false;

        for (const pattern of INCOMPLETE_PATTERNS) {
            const match = response.match(pattern);
            if (match) {
                matches.push({
                    pattern: pattern.source,
                    match: match[0],
                    position: match.index
                });
                isIncomplete = true;
            }
        }

        return {
            isIncomplete,
            matches,
            confidence: matches.length > 0 ? Math.min(0.9, 0.5 + matches.length * 0.1) : 0.1
        };
    }

    /**
     * Use LLM to analyze response completeness
     * @private
     */
    async _analyzeCompletenessWithLLM(originalQuestion, response, context, llmHandler) {
        const prompt = `Analyze the completeness of this answer to the given question. Consider whether the answer fully addresses the question or if important information is missing.

ORIGINAL QUESTION: ${originalQuestion}

CONTEXT PROVIDED: ${context.substring(0, 500)}${context.length > 500 ? '...' : ''}

ANSWER TO EVALUATE: ${response}

Please provide:
1. A completeness score from 0.0 to 1.0 (where 1.0 is completely answered)
2. Brief reasoning for the score
3. What specific information is missing (if any)

Response format:
SCORE: [0.0-1.0]
REASONING: [explanation]
MISSING: [what information is missing, or "none" if complete]`;

        try {
            const analysis = await llmHandler.generateResponse(prompt);

            // Parse the structured response
            const scoreMatch = analysis.match(/SCORE:\s*([0-9.]+)/i);
            const reasoningMatch = analysis.match(/REASONING:\s*(.+?)(?=MISSING:|$)/is);
            const missingMatch = analysis.match(/MISSING:\s*(.+)$/is);

            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;
            const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Analysis unavailable';
            const missing = missingMatch ? missingMatch[1].trim() : 'Unknown';

            return {
                score: Math.max(0, Math.min(1, score)), // Clamp between 0 and 1
                reasoning: reasoning,
                missing: missing,
                confidence: 0.8
            };

        } catch (error) {
            logger.debug('LLM completeness analysis failed:', error.message);
            return {
                score: 0.5,
                reasoning: 'Could not analyze completeness',
                missing: 'Analysis failed',
                confidence: 0.3
            };
        }
    }

    /**
     * Extract specific follow-up questions to address knowledge gaps
     * @private
     */
    async _extractFollowUpQuestions(originalQuestion, response, context, llmHandler, config) {
        const prompt = `Based on this incomplete answer, generate ${config.maxFollowUpQuestions} specific follow-up questions that would help provide a more complete answer to the original question.

ORIGINAL QUESTION: ${originalQuestion}

CURRENT ANSWER: ${response}

CONTEXT AVAILABLE: ${context.substring(0, 800)}${context.length > 800 ? '...' : ''}

Generate follow-up questions that are:
1. Specific and focused (not too broad)
2. Likely to have factual answers
3. Would help complete the original answer
4. Searchable in knowledge bases like Wikipedia/Wikidata

Format as a numbered list:
1. [Question]
2. [Question]
3. [Question]

FOLLOW-UP QUESTIONS:`;

        try {
            const questionsResponse = await llmHandler.generateResponse(prompt);

            // Extract numbered questions
            const questions = [];
            const lines = questionsResponse.split('\n');

            for (const line of lines) {
                const match = line.match(/^\s*\d+\.\s*(.+)$/);
                if (match && match[1].trim()) {
                    const question = match[1].trim();
                    if (question.length > 10 && question.length < 200) { // Reasonable length
                        questions.push({
                            text: question,
                            type: this._categorizeQuestion(question),
                            priority: this._calculateQuestionPriority(question, originalQuestion),
                            source: 'llm-generated'
                        });
                    }
                }
            }

            // Limit to max questions
            return questions.slice(0, config.maxFollowUpQuestions);

        } catch (error) {
            logger.debug('Failed to extract follow-up questions:', error.message);
            return [];
        }
    }

    /**
     * Categorize question type for better processing
     * @private
     */
    _categorizeQuestion(question) {
        const questionLower = question.toLowerCase();

        if (questionLower.includes('who') || questionLower.includes('person') || questionLower.includes('author') || questionLower.includes('actor')) {
            return 'person';
        } else if (questionLower.includes('where') || questionLower.includes('location') || questionLower.includes('city') || questionLower.includes('country')) {
            return 'location';
        } else if (questionLower.includes('when') || questionLower.includes('year') || questionLower.includes('date') || questionLower.includes('time')) {
            return 'temporal';
        } else if (questionLower.includes('what') && (questionLower.includes('type') || questionLower.includes('kind') || questionLower.includes('category'))) {
            return 'classification';
        } else if (questionLower.includes('how many') || questionLower.includes('number') || questionLower.includes('count')) {
            return 'quantitative';
        } else if (questionLower.includes('what') || questionLower.includes('which')) {
            return 'factual';
        } else {
            return 'general';
        }
    }

    /**
     * Calculate priority score for follow-up questions
     * @private
     */
    _calculateQuestionPriority(question, originalQuestion) {
        let priority = 0.5; // Base priority

        // Higher priority for questions that share key terms with original
        const originalTerms = originalQuestion.toLowerCase().split(/\s+/);
        const questionTerms = question.toLowerCase().split(/\s+/);
        const overlap = originalTerms.filter(term => questionTerms.includes(term) && term.length > 3);
        priority += overlap.length * 0.1;

        // Higher priority for specific question types
        const questionType = this._categorizeQuestion(question);
        if (['person', 'location', 'temporal'].includes(questionType)) {
            priority += 0.2;
        }

        // Lower priority for very general questions
        if (question.toLowerCase().includes('anything') || question.toLowerCase().includes('everything')) {
            priority -= 0.3;
        }

        return Math.max(0.1, Math.min(1.0, priority));
    }
}