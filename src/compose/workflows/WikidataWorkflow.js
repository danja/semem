/**
 * WikidataWorkflow - Enhanced BeerQA workflow with Wikidata integration
 * 
 * This workflow extends the standard BeerQA pipeline with Wikidata research:
 * 1. Standard BeerQA processing
 * 2. Wikidata entity discovery and research
 * 3. Enhanced answer generation with external knowledge
 * 
 * API: execute(input, resources, options)
 */

import BaseWorkflow from './BaseWorkflow.js';
import BeerQAWorkflow from './BeerQAWorkflow.js';
import WikidataResearcher from '../../aux/wikidata/WikidataResearcher.js';
import WikidataNavigator from '../../aux/wikidata/WikidataNavigator.js';
import logger from 'loglevel';

export default class WikidataWorkflow extends BaseWorkflow {
    constructor() {
        super('wikidata-enhanced');
        this.beerqaWorkflow = new BeerQAWorkflow();
        this.wikidataResearcher = new WikidataResearcher();
        this.wikidataNavigator = new WikidataNavigator();
    }

    /**
     * Execute the Wikidata-enhanced BeerQA workflow
     * 
     * @param {Object} input - Workflow input data
     * @param {Object} input.question - Question object with text and optional uri
     * @param {boolean} input.enableWikidataResearch - Enable Wikidata research (default: true)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.llmHandler - LLM handler for answer generation
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object
     * @param {Object} resources.wikidataResearch - Wikidata research component (optional)
     * @param {Object} options - Configuration options
     * @param {number} options.maxWikidataEntities - Max Wikidata entities to research (default: 15)
     * @param {boolean} options.fallbackToBeerQA - Fallback to standard BeerQA if Wikidata fails (default: true)
     * @param {string} options.enhancementLevel - Level of enhancement: 'basic', 'standard', 'comprehensive' (default: 'standard')
     * @returns {Promise<Object>} Workflow execution results with enhanced answer
     */
    async execute(input, resources, options = {}) {
        const startTime = Date.now();
        
        try {
            this._validateInput(input, ['question']);
            this._validateResources(resources, ['llmHandler', 'sparqlHelper', 'config']);
            
            const { question, enableWikidataResearch = true } = input;
            const { llmHandler, sparqlHelper, config, wikidataResearch } = resources;
            
            const workflowConfig = this._mergeConfig(options, {
                maxWikidataEntities: 15,
                fallbackToBeerQA: true,
                enhancementLevel: 'standard',
                maxContextTokens: 6000, // Larger context for enhanced answers
                answerStyle: 'comprehensive'
            });

            this._logStep('START', `Processing question with Wikidata enhancement: "${question.text}"`);

            // Step 1: Execute standard BeerQA workflow
            const beerqaResult = await this.beerqaWorkflow.execute(
                { question },
                { llmHandler, sparqlHelper, config },
                {
                    maxContextTokens: workflowConfig.maxContextTokens,
                    answerStyle: workflowConfig.answerStyle
                }
            );

            if (!beerqaResult.success && !workflowConfig.fallbackToBeerQA) {
                return this._handleError(new Error(beerqaResult.error), 'beerqa-base');
            }

            let enhancedAnswer = beerqaResult.data?.answer || '';
            let wikidataResults = null;

            // Step 2: Wikidata research using new component
            if (enableWikidataResearch) {
                const researchResult = await this.wikidataResearcher.executeResearch(
                    { question: question.text },
                    { llmHandler, sparqlHelper, config },
                    {
                        maxWikidataSearchResults: workflowConfig.maxWikidataEntities,
                        storeResults: true,
                        storageGraph: config.wikidataGraphURI
                    }
                );

                if (researchResult.success) {
                    wikidataResults = {
                        entitiesFound: researchResult.ragnoEntities.length,
                        researchDuration: researchResult.metadata.researchDuration,
                        conceptsUsed: researchResult.concepts,
                        entities: researchResult.ragnoEntities,
                        researchQueries: researchResult.concepts || [] // Add the missing property
                    };
                    
                    // Step 3: Generate enhanced answer with Wikidata findings
                    const enhancementResult = await this._enhanceAnswerWithWikidata(
                        question,
                        beerqaResult.data?.answer || '',
                        wikidataResults,
                        llmHandler,
                        workflowConfig
                    );

                    if (enhancementResult.success) {
                        enhancedAnswer = enhancementResult.data.enhancedAnswer;
                    }
                }
            }

            this._logStep('COMPLETE', 'Wikidata-enhanced workflow completed successfully');

            return this._createResult(true, {
                question: question,
                standardAnswer: beerqaResult.data?.answer || '',
                enhancedAnswer: enhancedAnswer,
                wikidataResults: wikidataResults,
                beerqaContext: beerqaResult.data?.context || '',
                relationships: beerqaResult.data?.relationships || [],
                corpusclesUsed: beerqaResult.data?.corpusclesUsed || 0,
                wikidataEntitiesFound: wikidataResults?.entitiesFound || 0
            }, null, this._getWorkflowMetadata(startTime, {
                beerqaDuration: beerqaResult.metadata?.duration || 0,
                wikidataResearchDuration: wikidataResults?.researchDuration || 0,
                enhancementLevel: workflowConfig.enhancementLevel,
                wikidataEnabled: enableWikidataResearch,
                totalSteps: enableWikidataResearch ? 3 : 1
            }));

        } catch (error) {
            return this._handleError(error, 'workflow-execution');
        }
    }

    /**
     * Perform Wikidata research for question enhancement
     * @private
     */
    async _performWikidataResearch(question, initialAnswer, wikidataResearch, workflowConfig) {
        const stepStart = Date.now();
        
        try {
            this._logStep('RESEARCH', 'Performing Wikidata research');

            // Extract research queries from the question and initial answer
            const researchQueries = this._extractResearchQueries(
                question.text, 
                initialAnswer, 
                workflowConfig.enhancementLevel
            );

            const researchResults = {
                entitiesFound: 0,
                conceptsDiscovered: 0,
                researchQueries: researchQueries,
                entityDetails: [],
                researchSummary: ''
            };

            // Perform research for each query
            for (const query of researchQueries) {
                try {
                    const result = await wikidataResearch.executeResearch(query);
                    
                    if (result && result.ragnoEntities) {
                        researchResults.entitiesFound += result.ragnoEntities.length;
                        researchResults.entityDetails.push({
                            query: query,
                            entitiesFound: result.ragnoEntities.length,
                            entities: result.ragnoEntities.slice(0, 5) // Limit for summary
                        });
                    }
                } catch (error) {
                    logger.debug(`Wikidata research failed for query: ${query}`, error.message);
                }
            }

            // Create research summary
            researchResults.researchSummary = this._createResearchSummary(researchResults);

            return {
                success: true,
                data: researchResults,
                duration: Date.now() - stepStart
            };

        } catch (error) {
            logger.error('Wikidata research failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - stepStart
            };
        }
    }

    /**
     * Enhance answer with Wikidata research findings
     * @private
     */
    async _enhanceAnswerWithWikidata(question, initialAnswer, wikidataResults, llmHandler, workflowConfig) {
        const stepStart = Date.now();
        
        try {
            this._logStep('ENHANCE', 'Enhancing answer with Wikidata findings');

            const enhancementPrompt = this._buildEnhancementPrompt(
                question.text,
                initialAnswer,
                wikidataResults,
                workflowConfig.enhancementLevel
            );

            const enhancedAnswer = await llmHandler.generateResponse(enhancementPrompt);

            return {
                success: true,
                data: {
                    enhancedAnswer,
                    enhancementPrompt: enhancementPrompt.substring(0, 300) + '...' // Truncated
                },
                duration: Date.now() - stepStart
            };

        } catch (error) {
            logger.error('Answer enhancement failed:', error.message);
            return {
                success: false,
                error: error.message,
                data: {
                    enhancedAnswer: initialAnswer // Fallback to initial answer
                },
                duration: Date.now() - stepStart
            };
        }
    }

    /**
     * Extract research queries from question and initial answer
     * @private
     */
    _extractResearchQueries(questionText, initialAnswer, enhancementLevel) {
        const queries = [];
        
        // Extract key terms and entities from question
        const questionTerms = questionText
            .toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 3 && !['what', 'when', 'where', 'who', 'how', 'why'].includes(term));

        // Create research queries based on enhancement level
        switch (enhancementLevel) {
            case 'basic':
                // Simple keyword-based queries
                queries.push(...questionTerms.slice(0, 2));
                break;
                
            case 'comprehensive':
                // Multiple research angles
                queries.push(questionText); // Full question
                queries.push(...questionTerms.slice(0, 3)); // Key terms
                // Add related concept queries
                if (questionText.includes('history')) queries.push('historical development');
                if (questionText.includes('effect') || questionText.includes('impact')) queries.push('environmental impact');
                break;
                
            default: // 'standard'
                // Balanced approach
                queries.push(questionText);
                queries.push(...questionTerms.slice(0, 2));
        }

        return queries.slice(0, 3); // Limit total queries
    }

    /**
     * Create summary of research findings
     * @private
     */
    _createResearchSummary(researchResults) {
        if (researchResults.entitiesFound === 0) {
            return 'No additional entities found through Wikidata research.';
        }

        let summary = `Research discovered ${researchResults.entitiesFound} entities across ${researchResults.researchQueries.length} queries:\n`;
        
        for (const detail of researchResults.entityDetails) {
            if (detail.entitiesFound > 0) {
                summary += `- Query "${detail.query}": ${detail.entitiesFound} entities\n`;
            }
        }

        return summary;
    }

    /**
     * Build enhancement prompt for LLM
     * @private
     */
    _buildEnhancementPrompt(questionText, initialAnswer, wikidataResults, enhancementLevel) {
        const intensityMap = {
            basic: 'moderately enhance',
            standard: 'significantly enhance',
            comprehensive: 'comprehensively enhance and expand'
        };

        return `You are enhancing an answer with additional research findings from Wikidata. Please ${intensityMap[enhancementLevel]} the initial answer using the research findings.

ORIGINAL QUESTION: ${questionText}

INITIAL ANSWER: ${initialAnswer}

WIKIDATA RESEARCH FINDINGS:
${wikidataResults.researchSummary}

Research Details:
- Total entities discovered: ${wikidataResults.entitiesFound}
- Research queries executed: ${wikidataResults.researchQueries.join(', ')}

Please provide an enhanced answer that:
1. Builds upon the initial answer
2. Incorporates relevant findings from the Wikidata research
3. Maintains accuracy and coherence
4. Provides additional context and depth
5. Clearly indicates when information comes from external research

ENHANCED ANSWER:`;
    }
}