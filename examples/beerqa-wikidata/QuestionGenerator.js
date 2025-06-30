#!/usr/bin/env node

/**
 * QuestionGenerator.js - Generate and store follow-up questions with metadata
 * 
 * This module takes follow-up questions identified by FeedbackAnalyzer and stores
 * them in the BeerQA knowledge graph with proper metadata for tracking iterations,
 * dependencies, and research progress. It creates a structured pipeline for
 * iterative knowledge discovery.
 */

import crypto from 'crypto';
import logger from 'loglevel';
import chalk from 'chalk';

/**
 * Generate and manage follow-up questions for iterative knowledge discovery
 */
class QuestionGenerator {
    constructor(sparqlHelper, config, options = {}) {
        this.sparqlHelper = sparqlHelper;
        this.config = config;
        this.options = {
            maxIterations: options.maxIterations || 3,
            questionPrefix: options.questionPrefix || 'Generated:',
            ...options
        };
        
        // RDF namespaces
        this.namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            dcterms: 'http://purl.org/dc/terms/',
            prov: 'http://www.w3.org/ns/prov#',
            beerqa: this.config.beerqaGraphURI.replace('/test', '') + '/'
        };
    }

    /**
     * Generate and store follow-up questions from analysis results
     */
    async generateQuestions(originalQuestion, analysisResult, iterationLevel = 1) {
        try {
            console.log(chalk.bold.cyan(`🔄 Generating iteration ${iterationLevel} questions...`));
            
            if (iterationLevel > this.options.maxIterations) {
                console.log(chalk.yellow(`   ⚠️  Maximum iterations (${this.options.maxIterations}) reached`));
                return [];
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
                const questionURI = this.generateQuestionURI(questionData);
                
                // Store question in knowledge graph
                const success = await this.storeQuestion(questionURI, questionData);
                
                if (success) {
                    generatedQuestions.push({
                        uri: questionURI,
                        text: questionData.text,
                        type: questionData.type,
                        priority: questionData.priority,
                        iterationLevel: iterationLevel,
                        parentURI: originalQuestion.uri
                    });
                    
                    console.log(chalk.green(`   ✓ Generated: [${questionData.type}] ${questionData.text}`));
                }
            }
            
            console.log(chalk.green(`   ✓ Stored ${generatedQuestions.length} follow-up questions`));
            return generatedQuestions;
            
        } catch (error) {
            logger.error('Failed to generate questions:', error.message);
            return [];
        }
    }

    /**
     * Generate a unique URI for a question based on its content
     */
    generateQuestionURI(questionData) {
        // Create a hash of the question text for uniqueness
        const hash = crypto
            .createHash('sha256')
            .update(questionData.text + questionData.parentQuestionURI)
            .digest('hex')
            .substring(0, 16);
        
        return `${this.config.beerqaGraphURI}/corpuscle/generated_${hash}`;
    }

    /**
     * Store a question in the BeerQA knowledge graph with metadata
     */
    async storeQuestion(questionURI, questionData) {
        try {
            const insertQuery = `
PREFIX ragno: <${this.namespaces.ragno}>
PREFIX rdfs: <${this.namespaces.rdfs}>
PREFIX dcterms: <${this.namespaces.dcterms}>
PREFIX prov: <${this.namespaces.prov}>
PREFIX beerqa: <${this.namespaces.beerqa}>

INSERT DATA {
    GRAPH <${this.config.beerqaGraphURI}> {
        <${questionURI}> a ragno:Corpuscle ;
                        rdfs:label "${this.escapeRDFString(questionData.text)}" ;
                        dcterms:created "${questionData.timestamp}" ;
                        dcterms:type "${questionData.type}" ;
                        beerqa:iterationLevel ${questionData.iterationLevel} ;
                        beerqa:priority ${questionData.priority} ;
                        beerqa:parentQuestion <${questionData.parentQuestionURI}> ;
                        beerqa:parentQuestionText "${this.escapeRDFString(questionData.parentQuestionText)}" ;
                        beerqa:generationMethod "${questionData.generationMethod}" ;
                        beerqa:completenessScore ${questionData.completenessScore} ;
                        beerqa:questionType "${questionData.type}" ;
                        prov:wasGeneratedBy beerqa:FeedbackGenerator ;
                        prov:generatedAtTime "${questionData.timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    }
}`;

            const result = await this.sparqlHelper.executeUpdate(insertQuery);
            return result.success;
            
        } catch (error) {
            logger.error(`Failed to store question ${questionURI}:`, error.message);
            return false;
        }
    }

    /**
     * Retrieve generated questions for a specific parent question
     */
    async getGeneratedQuestions(parentQuestionURI, iterationLevel = null) {
        try {
            const levelFilter = iterationLevel !== null ? 
                `FILTER(?iterationLevel = ${iterationLevel})` : '';
            
            const selectQuery = `
PREFIX ragno: <${this.namespaces.ragno}>
PREFIX rdfs: <${this.namespaces.rdfs}>
PREFIX beerqa: <${this.namespaces.beerqa}>

SELECT ?question ?text ?type ?priority ?iterationLevel ?timestamp WHERE {
    GRAPH <${this.config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?text ;
                 beerqa:parentQuestion <${parentQuestionURI}> ;
                 beerqa:questionType ?type ;
                 beerqa:priority ?priority ;
                 beerqa:iterationLevel ?iterationLevel ;
                 dcterms:created ?timestamp .
        ${levelFilter}
    }
}
ORDER BY DESC(?priority) ?timestamp`;

            const result = await this.sparqlHelper.executeSelect(selectQuery);
            
            if (result.success) {
                return result.data.results.bindings.map(binding => ({
                    uri: binding.question.value,
                    text: binding.text.value,
                    type: binding.type.value,
                    priority: parseFloat(binding.priority.value),
                    iterationLevel: parseInt(binding.iterationLevel.value),
                    timestamp: binding.timestamp.value
                }));
            }
            
            return [];
            
        } catch (error) {
            logger.error('Failed to retrieve generated questions:', error.message);
            return [];
        }
    }

    /**
     * Get questions ready for the next iteration of research
     */
    async getQuestionsForResearch(iterationLevel = 1, limit = 5) {
        try {
            console.log(chalk.bold.cyan(`📋 Finding iteration ${iterationLevel} questions for research...`));
            
            const selectQuery = `
PREFIX ragno: <${this.namespaces.ragno}>
PREFIX rdfs: <${this.namespaces.rdfs}>
PREFIX beerqa: <${this.namespaces.beerqa}>

SELECT ?question ?text ?type ?priority ?parentQuestion ?parentText WHERE {
    GRAPH <${this.config.beerqaGraphURI}> {
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

            const result = await this.sparqlHelper.executeSelect(selectQuery);
            
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
                
                console.log(chalk.green(`   ✓ Found ${questions.length} questions for research`));
                return questions;
            }
            
            return [];
            
        } catch (error) {
            logger.error('Failed to get questions for research:', error.message);
            return [];
        }
    }

    /**
     * Mark a question as researched
     */
    async markQuestionResearched(questionURI, researchResults = {}) {
        try {
            const timestamp = new Date().toISOString();
            const entityCount = researchResults.entityCount || 0;
            const conceptCount = researchResults.conceptCount || 0;
            
            const updateQuery = `
PREFIX beerqa: <${this.namespaces.beerqa}>

INSERT DATA {
    GRAPH <${this.config.beerqaGraphURI}> {
        <${questionURI}> beerqa:researchCompleted true ;
                        beerqa:researchTimestamp "${timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
                        beerqa:entitiesFound ${entityCount} ;
                        beerqa:conceptsFound ${conceptCount} .
    }
}`;

            const result = await this.sparqlHelper.executeUpdate(updateQuery);
            return result.success;
            
        } catch (error) {
            logger.error('Failed to mark question as researched:', error.message);
            return false;
        }
    }

    /**
     * Get statistics about generated questions
     */
    async getQuestionStatistics() {
        try {
            const statsQuery = `
PREFIX ragno: <${this.namespaces.ragno}>
PREFIX beerqa: <${this.namespaces.beerqa}>

SELECT 
    (COUNT(?question) as ?totalGenerated)
    (COUNT(?researched) as ?totalResearched)
    (AVG(?priority) as ?avgPriority)
    (MAX(?iterationLevel) as ?maxIteration)
WHERE {
    GRAPH <${this.config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 beerqa:iterationLevel ?iterationLevel ;
                 beerqa:priority ?priority .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched .
            FILTER(?researched = true)
        }
    }
}`;

            const result = await this.sparqlHelper.executeSelect(statsQuery);
            
            if (result.success && result.data.results.bindings.length > 0) {
                const binding = result.data.results.bindings[0];
                return {
                    totalGenerated: parseInt(binding.totalGenerated?.value || 0),
                    totalResearched: parseInt(binding.totalResearched?.value || 0),
                    avgPriority: parseFloat(binding.avgPriority?.value || 0),
                    maxIteration: parseInt(binding.maxIteration?.value || 0)
                };
            }
            
            return {
                totalGenerated: 0,
                totalResearched: 0,
                avgPriority: 0,
                maxIteration: 0
            };
            
        } catch (error) {
            logger.error('Failed to get question statistics:', error.message);
            return {
                totalGenerated: 0,
                totalResearched: 0,
                avgPriority: 0,
                maxIteration: 0
            };
        }
    }

    /**
     * Escape special characters in RDF strings
     */
    escapeRDFString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Display question generation statistics
     */
    async displayStatistics() {
        const stats = await this.getQuestionStatistics();
        
        console.log(chalk.bold.yellow('\n📊 Question Generation Statistics:'));
        console.log(chalk.white(`   Total Generated: ${stats.totalGenerated}`));
        console.log(chalk.white(`   Total Researched: ${stats.totalResearched}`));
        console.log(chalk.white(`   Research Progress: ${stats.totalGenerated > 0 ? (stats.totalResearched / stats.totalGenerated * 100).toFixed(1) : 0}%`));
        console.log(chalk.white(`   Average Priority: ${stats.avgPriority.toFixed(2)}`));
        console.log(chalk.white(`   Max Iteration Level: ${stats.maxIteration}`));
        console.log('');
    }
}

export default QuestionGenerator;