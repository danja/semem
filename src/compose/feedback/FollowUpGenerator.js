/**
 * FollowUpGenerator - Generate and store follow-up questions with metadata
 * 
 * This component takes follow-up questions identified by ResponseAnalyzer and stores
 * them in the knowledge graph with proper metadata for tracking iterations,
 * dependencies, and research progress. It creates a structured pipeline for
 * iterative knowledge discovery.
 * 
 * API: generateQuestions(input, resources, options)
 */

import crypto from 'crypto';
import logger from 'loglevel';

export default class FollowUpGenerator {
    /**
     * Generate and store follow-up questions from analysis results
     * 
     * @param {Object} input - Question generation input data
     * @param {Object} input.originalQuestion - The original question object with uri and text
     * @param {Object} input.analysisResult - Results from ResponseAnalyzer with followUpQuestions
     * @param {number} input.iterationLevel - Current iteration level (default: 1)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @param {number} options.maxIterations - Maximum iterations allowed (default: 3)
     * @param {string} options.questionPrefix - Prefix for generated questions (default: 'Generated:')
     * @returns {Promise<Array>} Generated questions with URIs and metadata
     */
    async generateQuestions(input, resources, options = {}) {
        const { originalQuestion, analysisResult, iterationLevel = 1 } = input;
        const { sparqlHelper, config } = resources;
        
        const genConfig = {
            maxIterations: options.maxIterations || 3,
            questionPrefix: options.questionPrefix || 'Generated:',
            ...options
        };
        
        // RDF namespaces
        const namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            dcterms: 'http://purl.org/dc/terms/',
            prov: 'http://www.w3.org/ns/prov#',
            beerqa: config.beerqaGraphURI.replace('/test', '') + '/'
        };

        try {
            if (iterationLevel > genConfig.maxIterations) {
                return {
                    success: false,
                    message: `Maximum iterations (${genConfig.maxIterations}) reached`,
                    questions: [],
                    metadata: {
                        iterationLevel,
                        maxIterationsReached: true
                    }
                };
            }
            
            const generatedQuestions = [];
            
            for (let i = 0; i < analysisResult.followUpQuestions.length; i++) {
                const followUp = analysisResult.followUpQuestions[i];
                
                // Create question metadata
                const questionData = {
                    text: followUp.text,
                    type: followUp.type,
                    priority: followUp.priority,
                    iterationLevel: iterationLevel,
                    parentQuestionURI: originalQuestion.uri,
                    parentQuestionText: originalQuestion.text,
                    generationMethod: 'llm-feedback',
                    completenessScore: analysisResult.completenessScore,
                    timestamp: new Date().toISOString()
                };
                
                // Generate unique URI for the question
                const questionURI = this._generateQuestionURI(questionData, config);
                
                // Store question in knowledge graph
                const success = await this._storeQuestion(questionURI, questionData, namespaces, sparqlHelper, config);
                
                if (success) {
                    generatedQuestions.push({
                        uri: questionURI,
                        text: questionData.text,
                        type: questionData.type,
                        priority: questionData.priority,
                        iterationLevel: iterationLevel,
                        parentURI: originalQuestion.uri,
                        metadata: {
                            timestamp: questionData.timestamp,
                            generationMethod: questionData.generationMethod,
                            completenessScore: questionData.completenessScore
                        }
                    });
                }
            }
            
            return {
                success: true,
                questions: generatedQuestions,
                metadata: {
                    iterationLevel,
                    questionsGenerated: generatedQuestions.length,
                    totalAttempted: analysisResult.followUpQuestions.length,
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            logger.error('Failed to generate questions:', error.message);
            return {
                success: false,
                error: error.message,
                questions: [],
                metadata: {
                    iterationLevel,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get questions ready for research from the knowledge graph
     * 
     * @param {Object} input - Retrieval input data
     * @param {number} input.iterationLevel - Iteration level to retrieve (default: 1)
     * @param {number} input.limit - Maximum questions to retrieve (default: 5)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Retrieved questions with metadata
     */
    async getQuestionsForResearch(input, resources, options = {}) {
        const { iterationLevel = 1, limit = 5 } = input;
        const { sparqlHelper, config } = resources;
        
        const namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            beerqa: config.beerqaGraphURI.replace('/test', '') + '/'
        };

        try {
            const selectQuery = `
PREFIX ragno: <${namespaces.ragno}>
PREFIX rdfs: <${namespaces.rdfs}>
PREFIX beerqa: <${namespaces.beerqa}>

SELECT ?question ?text ?type ?priority ?parentQuestion ?parentText WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?text ;
                 beerqa:iterationLevel ${iterationLevel} ;
                 beerqa:questionType ?type ;
                 beerqa:priority ?priority ;
                 beerqa:parentQuestion ?parentQuestion ;
                 beerqa:parentQuestionText ?parentText .
        
        # Only get questions that haven't been researched yet
        FILTER NOT EXISTS {
            ?question beerqa:researchCompleted ?completed .
        }
    }
}
ORDER BY DESC(?priority)
LIMIT ${limit}`;

            const result = await sparqlHelper.executeSelect(selectQuery);
            
            if (result.success) {
                const questions = result.data.results.bindings.map(binding => ({
                    uri: binding.question.value,
                    text: binding.text.value,
                    type: binding.type.value,
                    priority: parseFloat(binding.priority.value),
                    parentQuestionURI: binding.parentQuestion.value,
                    parentQuestionText: binding.parentText.value,
                    iterationLevel: iterationLevel
                }));
                
                return {
                    success: true,
                    questions,
                    metadata: {
                        iterationLevel,
                        questionsFound: questions.length,
                        maxRequested: limit,
                        timestamp: new Date().toISOString()
                    }
                };
            }
            
            return {
                success: false,
                questions: [],
                error: 'SPARQL query failed',
                metadata: {
                    iterationLevel,
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            logger.error('Failed to get questions for research:', error.message);
            return {
                success: false,
                questions: [],
                error: error.message,
                metadata: {
                    iterationLevel,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Mark a question as researched with results
     * 
     * @param {Object} input - Research completion input data
     * @param {string} input.questionURI - URI of the question that was researched
     * @param {Object} input.researchResults - Results from research operation
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Success status and metadata
     */
    async markQuestionResearched(input, resources, options = {}) {
        const { questionURI, researchResults = {} } = input;
        const { sparqlHelper, config } = resources;
        
        const namespaces = {
            beerqa: config.beerqaGraphURI.replace('/test', '') + '/'
        };

        try {
            const timestamp = new Date().toISOString();
            const entityCount = researchResults.entityCount || 0;
            const conceptCount = researchResults.conceptCount || 0;
            
            const updateQuery = `
PREFIX beerqa: <${namespaces.beerqa}>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${questionURI}> beerqa:researchCompleted true ;
                        beerqa:researchTimestamp "${timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
                        beerqa:entitiesFound ${entityCount} ;
                        beerqa:conceptsFound ${conceptCount} .
    }
}`;

            const result = await sparqlHelper.executeUpdate(updateQuery);
            
            return {
                success: result.success,
                metadata: {
                    questionURI,
                    researchTimestamp: timestamp,
                    entitiesFound: entityCount,
                    conceptsFound: conceptCount
                }
            };
            
        } catch (error) {
            logger.error('Failed to mark question as researched:', error.message);
            return {
                success: false,
                error: error.message,
                metadata: {
                    questionURI,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get statistics about generated questions
     * 
     * @param {Object} input - Statistics input data (can be empty)
     * @param {Object} resources - External dependencies
     * @param {Object} resources.sparqlHelper - SPARQL helper for database operations
     * @param {Object} resources.config - Configuration object with graph URIs
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Statistics about question generation and research
     */
    async getQuestionStatistics(input, resources, options = {}) {
        const { sparqlHelper, config } = resources;
        
        const namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            beerqa: config.beerqaGraphURI.replace('/test', '') + '/'
        };

        try {
            const statsQuery = `
PREFIX ragno: <${namespaces.ragno}>
PREFIX beerqa: <${namespaces.beerqa}>

SELECT 
    (COUNT(?question) as ?totalGenerated)
    (COUNT(?researched) as ?totalResearched)
    (AVG(?priority) as ?avgPriority)
    (MAX(?iterationLevel) as ?maxIteration)
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 beerqa:iterationLevel ?iterationLevel ;
                 beerqa:priority ?priority .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched .
            FILTER(?researched = true)
        }
    }
}`;

            const result = await sparqlHelper.executeSelect(statsQuery);
            
            if (result.success && result.data.results.bindings.length > 0) {
                const binding = result.data.results.bindings[0];
                const stats = {
                    totalGenerated: parseInt(binding.totalGenerated?.value || 0),
                    totalResearched: parseInt(binding.totalResearched?.value || 0),
                    avgPriority: parseFloat(binding.avgPriority?.value || 0),
                    maxIteration: parseInt(binding.maxIteration?.value || 0)
                };
                
                return {
                    success: true,
                    statistics: {
                        ...stats,
                        researchProgress: stats.totalGenerated > 0 ? 
                            (stats.totalResearched / stats.totalGenerated) : 0
                    },
                    metadata: {
                        timestamp: new Date().toISOString()
                    }
                };
            }
            
            return {
                success: true,
                statistics: {
                    totalGenerated: 0,
                    totalResearched: 0,
                    avgPriority: 0,
                    maxIteration: 0,
                    researchProgress: 0
                },
                metadata: {
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            logger.error('Failed to get question statistics:', error.message);
            return {
                success: false,
                error: error.message,
                statistics: null,
                metadata: {
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Generate a unique URI for a question based on its content
     * @private
     */
    _generateQuestionURI(questionData, config) {
        // Create a hash of the question text for uniqueness
        const hash = crypto
            .createHash('sha256')
            .update(questionData.text + questionData.parentQuestionURI)
            .digest('hex')
            .substring(0, 16);
        
        return `${config.beerqaGraphURI}/corpuscle/generated_${hash}`;
    }

    /**
     * Store a question in the knowledge graph with metadata
     * @private
     */
    async _storeQuestion(questionURI, questionData, namespaces, sparqlHelper, config) {
        try {
            const insertQuery = `
PREFIX ragno: <${namespaces.ragno}>
PREFIX rdfs: <${namespaces.rdfs}>
PREFIX dcterms: <${namespaces.dcterms}>
PREFIX prov: <${namespaces.prov}>
PREFIX beerqa: <${namespaces.beerqa}>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${questionURI}> a ragno:Corpuscle ;
                        rdfs:label "${this._escapeRDFString(questionData.text)}" ;
                        dcterms:created "${questionData.timestamp}" ;
                        dcterms:type "${questionData.type}" ;
                        beerqa:iterationLevel ${questionData.iterationLevel} ;
                        beerqa:priority ${questionData.priority} ;
                        beerqa:parentQuestion <${questionData.parentQuestionURI}> ;
                        beerqa:parentQuestionText "${this._escapeRDFString(questionData.parentQuestionText)}" ;
                        beerqa:generationMethod "${questionData.generationMethod}" ;
                        beerqa:completenessScore ${questionData.completenessScore} ;
                        beerqa:questionType "${questionData.type}" ;
                        prov:wasGeneratedBy beerqa:FeedbackGenerator ;
                        prov:generatedAtTime "${questionData.timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    }
}`;

            const result = await sparqlHelper.executeUpdate(insertQuery);
            return result.success;
            
        } catch (error) {
            logger.error(`Failed to store question ${questionURI}:`, error.message);
            return false;
        }
    }

    /**
     * Escape special characters in RDF strings
     * @private
     */
    _escapeRDFString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }
}