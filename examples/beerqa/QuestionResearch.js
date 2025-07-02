#!/usr/bin/env node

/**
 * QuestionResearch - Research concepts from BeerQA questions using Wikipedia
 * 
 * This script finds BeerQA question corpuscles with extracted concepts,
 * uses those concepts to search Wikipedia via WikipediaSearch,
 * and transforms the results to corpuscles via UnitsToCorpuscles.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import WikipediaSearch from '../../src/aux/wikipedia/Search.js';
import UnitsToCorpuscles from '../../src/aux/wikipedia/UnitsToCorpuscles.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📚 BEER QA QUESTION RESEARCH                  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     Research Concepts via Wikipedia Search & Ingestion    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('BeerQA Graph URI:')} ${chalk.white(config.beerqaGraphURI)}`);
    console.log(`   ${chalk.cyan('Wikipedia Graph URI:')} ${chalk.white(config.wikipediaGraphURI)}`);
    console.log(`   ${chalk.cyan('Search Delay:')} ${chalk.white(config.searchDelay + 'ms')}`);
    console.log(`   ${chalk.cyan('Max Results per Concept:')} ${chalk.white(config.maxResultsPerConcept)}`);
    console.log(`   ${chalk.cyan('Generate Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Yes' : 'No')}`);
    console.log('');
}

/**
 * Display question information
 */
function displayQuestionInfo(question) {
    console.log(chalk.bold.white('📝 Question Found:'));
    console.log(`   ${chalk.cyan('Question:')} ${chalk.white(question.questionText)}`);
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(question.corpuscle)}`);
    console.log(`   ${chalk.cyan('Source:')} ${chalk.white(question.source || 'N/A')}`);
    console.log(`   ${chalk.cyan('Question ID:')} ${chalk.white(question.questionId || 'N/A')}`);
    console.log(`   ${chalk.cyan('Concepts Found:')} ${chalk.white(question.concepts.length)}`);
    console.log('');
}

/**
 * Display extracted concepts
 */
function displayConcepts(concepts, conceptsSource = 'unknown') {
    const sourceLabel = conceptsSource === 'hyde' ? '(from HyDE)' : 
                       conceptsSource === 'existing' ? '(existing)' : '';
    
    console.log(chalk.bold.white(`🧠 Concepts to Research ${sourceLabel}:`));
    for (let i = 0; i < Math.min(concepts.length, 10); i++) {
        const concept = concepts[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(concept.value)}`);
        if (concept.type) {
            console.log(`      ${chalk.gray('Type:')} ${chalk.white(concept.type)}`);
        }
        if (concept.confidence) {
            console.log(`      ${chalk.gray('Confidence:')} ${chalk.white((concept.confidence * 100).toFixed(1) + '%')}`);
        }
        if (concept.source === 'hyde' && concept.attempt) {
            console.log(`      ${chalk.gray('HyDE Attempt:')} ${chalk.white(concept.attempt)}`);
        }
    }
    
    if (concepts.length > 10) {
        console.log(`   ${chalk.dim(`... and ${concepts.length - 10} more concepts`)}`);
    }
    console.log('');
}

/**
 * Display research results summary
 */
function displayResearchSummary(results) {
    console.log(chalk.bold.white('📊 Research Results Summary:'));
    console.log(`   ${chalk.cyan('Concepts Researched:')} ${chalk.white(results.conceptsResearched)}`);
    
    if (results.hydeAttempts > 0) {
        console.log(`   ${chalk.cyan('HyDE Attempts:')} ${chalk.white(results.hydeAttempts)}`);
        console.log(`   ${chalk.cyan('HyDE Successes:')} ${chalk.white(results.hydeSuccesses)}`);
        console.log(`   ${chalk.cyan('Concepts from HyDE:')} ${chalk.white(results.conceptsFromHyde)}`);
    }
    
    console.log(`   ${chalk.cyan('Total Wikipedia Searches:')} ${chalk.white(results.totalSearches)}`);
    console.log(`   ${chalk.cyan('Total Wikipedia Results:')} ${chalk.white(results.totalWikipediaResults)}`);
    console.log(`   ${chalk.cyan('Wikipedia Units Created:')} ${chalk.white(results.unitsCreated)}`);
    console.log(`   ${chalk.cyan('Corpuscles Created:')} ${chalk.white(results.corpusclesCreated)}`);
    console.log(`   ${chalk.cyan('Relationships Created:')} ${chalk.white(results.relationshipsCreated)}`);
    console.log(`   ${chalk.cyan('Total Processing Time:')} ${chalk.white(results.totalProcessingTime)}`);
    console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.white(results.successRate)}`);
    console.log('');
}

/**
 * Display errors if any
 */
function displayErrors(errors) {
    if (errors.length === 0) {
        console.log(chalk.bold.green('✅ No errors encountered!'));
        return;
    }

    console.log(chalk.bold.red(`❌ Errors Encountered (${errors.length}):`));

    const displayErrors = errors.slice(0, 5);
    for (let i = 0; i < displayErrors.length; i++) {
        console.log(`   ${chalk.red('•')} ${chalk.white(displayErrors[i])}`);
    }

    if (errors.length > 5) {
        console.log(`   ${chalk.dim(`... and ${errors.length - 5} more errors`)}`);
    }
    console.log('');
}

/**
 * HyDE implementation for hypothetical document generation
 */
class HyDEGenerator {
    constructor(llmHandler) {
        this.llmHandler = llmHandler;
    }

    /**
     * Generate hypothetical document for a given question
     */
    async generateHypotheticalDocument(question, domain = null) {
        const domainContext = domain ? ` in the context of ${domain}` : '';
        
        const prompt = `Write a detailed, informative paragraph that would contain comprehensive information to answer the following question${domainContext}:

Question: ${question}

Write as if you are an expert providing a thorough answer with specific details, examples, and relevant concepts. The paragraph should be 3-4 sentences long and contain the type of information someone would find in an authoritative source.

Paragraph:`;

        try {
            const response = await this.llmHandler.generateResponse(
                prompt,
                '', // no additional context needed
                {
                    temperature: 0.7
                }
            );
            
            // Clean up the response
            let hypotheticalDoc = response.trim();
            
            // Remove any leading/trailing quotes or artifacts
            hypotheticalDoc = hypotheticalDoc.replace(/^["']|["']$/g, '');
            
            // Ensure it ends with proper punctuation
            if (!/[.!?]$/.test(hypotheticalDoc)) {
                hypotheticalDoc += '.';
            }
            
            return hypotheticalDoc;
            
        } catch (error) {
            logger.warn(`Failed to generate hypothetical document: ${error.message}`);
            // Fallback: return expanded query
            return `This document discusses ${question} and provides comprehensive information about the topic, including relevant details, examples, and implications.`;
        }
    }

    /**
     * Extract concepts from hypothetical document
     */
    async extractConceptsFromDocument(document) {
        try {
            const concepts = await this.llmHandler.extractConcepts(document);
            return concepts || [];
        } catch (error) {
            logger.warn(`Failed to extract concepts from document: ${error.message}`);
            return [];
        }
    }
}

/**
 * BeerQA Question Research class
 */
class BeerQAQuestionResearch {
    constructor(config, options = {}) {
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        
        // Get performance configuration for Wikipedia
        const performanceConfig = config.get('performance.wikipedia') || {};
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            searchDelay: options.searchDelay || performanceConfig.rateLimit || 300, // Use performance config
            maxResultsPerConcept: options.maxResultsPerConcept || performanceConfig.searchResultsLimit || 3,
            generateEmbeddings: options.generateEmbeddings !== false, // Default true
            timeout: options.timeout || performanceConfig.timeout || 60000,
            ...options
        };

        // Initialize Wikipedia components with performance-optimized configuration
        this.wikipediaSearch = new WikipediaSearch({
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.wikipediaGraphURI,
            baseURI: this.options.wikipediaGraphURI.replace(/\/$/, '') + '/',
            timeout: this.options.timeout,
            defaultSearchLimit: performanceConfig.searchResultsLimit || 10,
            rateLimit: performanceConfig.rateLimit || 300
        });
        
        console.log(`🚀 BeerQA using performance config: ${performanceConfig.searchResultsLimit || 10} results, ${performanceConfig.rateLimit || 300}ms rate limit`);

        this.unitsToCorpuscles = new UnitsToCorpuscles({
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.wikipediaGraphURI,
            baseURI: this.options.wikipediaGraphURI.replace(/\/$/, '') + '/',
            generateEmbeddings: this.options.generateEmbeddings,
            timeout: this.options.timeout
        });

        // Initialize LLM handler and HyDE generator (will be set during initialization)
        this.llmHandler = null;
        this.hydeGenerator = null;

        // Statistics tracking
        this.stats = {
            conceptsResearched: 0,
            totalSearches: 0,
            totalWikipediaResults: 0,
            unitsCreated: 0,
            corpusclesCreated: 0,
            relationshipsCreated: 0,
            successfulSearches: 0,
            failedSearches: 0,
            hydeAttempts: 0,
            hydeSuccesses: 0,
            conceptsFromHyde: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Create LLM connector based on configuration priority (from api-server.js)
     */
    async createLLMConnector(config) {
        try {
            // Get llmProviders with priority ordering
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                if (provider.type === 'mistral' && provider.apiKey) {
                    return new MistralConnector();
                } else if (provider.type === 'claude' && provider.apiKey) {
                    return new ClaudeConnector();
                } else if (provider.type === 'ollama') {
                    return new OllamaConnector();
                }
            }
            
            // Default to Ollama
            return new OllamaConnector();
            
        } catch (error) {
            logger.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
            return new OllamaConnector();
        }
    }

    /**
     * Get model configuration (from api-server.js)
     */
    async getModelConfig(config) {
        try {
            const llmModel = config.get('llm.model') || 'qwen2:1.5b';
            
            return {
                chatModel: llmModel
            };
        } catch (error) {
            logger.warn('Failed to get model config, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b'
            };
        }
    }

    /**
     * Initialize LLM handler and HyDE generator
     */
    async initialize() {
        try {
            // Load configuration from config.json like in api-server.js
            const configPath = path.join(process.cwd(), 'config/config.json');
            const config = new Config(configPath);
            await config.init();

            // Initialize LLM handler for HyDE
            try {
                // Use the new configuration pattern from api-server.js
                const llmProvider = await this.createLLMConnector(config);
                const modelConfig = await this.getModelConfig(config);
                
                this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
                this.hydeGenerator = new HyDEGenerator(this.llmHandler);
                logger.info('LLM handler and HyDE generator initialized successfully');
            } catch (error) {
                logger.warn('Failed to initialize LLM handler:', error.message);
                logger.warn('HyDE concept extraction will not be available');
            }

        } catch (error) {
            logger.error('Failed to initialize configuration:', error);
            throw error;
        }
    }

    /**
     * Find question corpuscle (with or without extracted concepts)
     */
    async findQuestionCorpuscle() {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        // First try to find a question with existing concepts
        const queryWithConcepts = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?corpuscle ?questionText ?source ?questionId ?question 
       (GROUP_CONCAT(DISTINCT ?conceptValue; separator="|||") AS ?concepts)
       (GROUP_CONCAT(DISTINCT ?conceptType; separator="|||") AS ?conceptTypes)
       (GROUP_CONCAT(DISTINCT ?conceptConf; separator="|||") AS ?conceptConfidences)
FROM <${this.options.beerqaGraphURI}>
WHERE {
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?questionText ;
               ragno:corpuscleType "test-question" ;
               dcterms:source ?source ;
               dcterms:identifier ?questionId ;
               ragno:hasQuestion ?question ;
               ragno:hasAttribute ?conceptAttr .
    
    ?conceptAttr ragno:attributeType "concept" ;
                 ragno:attributeValue ?conceptValue .
    
    OPTIONAL { ?conceptAttr ragno:conceptType ?conceptType }
    OPTIONAL { ?conceptAttr ragno:confidence ?conceptConf }
}
GROUP BY ?corpuscle ?questionText ?source ?questionId ?question
ORDER BY ?corpuscle
LIMIT 1`;

        // Fallback query for questions without concepts
        const queryWithoutConcepts = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?corpuscle ?questionText ?source ?questionId ?question
FROM <${this.options.beerqaGraphURI}>
WHERE {
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?questionText ;
               ragno:corpuscleType "test-question" ;
               dcterms:source ?source ;
               dcterms:identifier ?questionId ;
               ragno:hasQuestion ?question .
}
ORDER BY ?corpuscle
LIMIT 1`;

        try {
            // First try to find a question with existing concepts
            logger.info('Looking for question with existing concepts...');
            let response = await fetch(queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${btoa(`${this.options.sparqlAuth.user}:${this.options.sparqlAuth.password}`)}`
                },
                body: queryWithConcepts
            });

            if (!response.ok) {
                throw new Error(`Query failed: ${response.status} ${response.statusText}`);
            }

            let results = await response.json();
            
            if (results.results.bindings.length > 0) {
                // Found question with existing concepts
                const binding = results.results.bindings[0];
                
                // Parse concepts from concatenated strings
                const conceptValues = binding.concepts.value.split('|||');
                const conceptTypes = binding.conceptTypes ? binding.conceptTypes.value.split('|||') : [];
                const conceptConfidences = binding.conceptConfidences ? binding.conceptConfidences.value.split('|||') : [];
                
                const concepts = conceptValues.map((value, index) => ({
                    value: value,
                    type: conceptTypes[index] || null,
                    confidence: conceptConfidences[index] ? parseFloat(conceptConfidences[index]) : null
                }));

                logger.info(`Found question with ${concepts.length} existing concepts`);

                return {
                    corpuscle: binding.corpuscle.value,
                    questionText: binding.questionText.value,
                    source: binding.source.value,
                    questionId: binding.questionId.value,
                    question: binding.question.value,
                    concepts: concepts,
                    conceptsSource: 'existing'
                };
            }

            // No existing concepts found, try to find any question without concepts
            logger.info('No questions with concepts found, looking for any test question...');
            response = await fetch(queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${btoa(`${this.options.sparqlAuth.user}:${this.options.sparqlAuth.password}`)}`
                },
                body: queryWithoutConcepts
            });

            if (!response.ok) {
                throw new Error(`Fallback query failed: ${response.status} ${response.statusText}`);
            }

            results = await response.json();
            
            if (results.results.bindings.length === 0) {
                throw new Error('No test question corpuscles found. Run BeerTestQuestions.js first.');
            }

            const binding = results.results.bindings[0];
            logger.info('Found question without concepts, will use HyDE to extract concepts');

            return {
                corpuscle: binding.corpuscle.value,
                questionText: binding.questionText.value,
                source: binding.source.value,
                questionId: binding.questionId.value,
                question: binding.question.value,
                concepts: [],
                conceptsSource: 'none'
            };

        } catch (error) {
            logger.error('Failed to find question corpuscle:', error);
            throw error;
        }
    }

    /**
     * Extract concepts using HyDE (up to 3 attempts)
     */
    async extractConceptsViaHyDE(questionText, maxAttempts = 3) {
        if (!this.hydeGenerator) {
            logger.warn('HyDE generator not available, cannot extract concepts');
            return [];
        }

        let allConcepts = [];
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.stats.hydeAttempts++;
            logger.info(`HyDE attempt ${attempt}/${maxAttempts}: Generating hypothetical document...`);
            
            try {
                // Generate hypothetical document
                const hypotheticalDoc = await this.hydeGenerator.generateHypotheticalDocument(questionText);
                logger.info(`Generated hypothetical document (${hypotheticalDoc.length} chars)`);
                logger.debug(`Hypothetical document: "${hypotheticalDoc.substring(0, 100)}..."`);
                
                // Extract concepts from the hypothetical document
                const concepts = await this.hydeGenerator.extractConceptsFromDocument(hypotheticalDoc);
                
                if (concepts && concepts.length > 0) {
                    this.stats.hydeSuccesses++;
                    this.stats.conceptsFromHyde += concepts.length;
                    
                    // Add metadata to concepts
                    const enrichedConcepts = concepts.map((concept, index) => ({
                        value: typeof concept === 'string' ? concept : concept.name || concept.text || concept,
                        type: typeof concept === 'object' ? (concept.type || 'hyde-extracted') : 'hyde-extracted',
                        confidence: typeof concept === 'object' ? concept.confidence || 0.8 : 0.8,
                        source: 'hyde',
                        attempt: attempt,
                        hypotheticalDoc: hypotheticalDoc
                    }));
                    
                    allConcepts.push(...enrichedConcepts);
                    logger.info(`✅ HyDE attempt ${attempt} extracted ${concepts.length} concepts`);
                } else {
                    logger.warn(`⚠️  HyDE attempt ${attempt} extracted no concepts`);
                }
                
            } catch (error) {
                logger.error(`❌ HyDE attempt ${attempt} failed:`, error.message);
                this.stats.errors.push(`HyDE attempt ${attempt}: ${error.message}`);
            }
        }

        if (allConcepts.length === 0) {
            logger.error('❌ Failed to extract concepts via HyDE after all attempts');
            this.stats.errors.push('HyDE concept extraction failed after all attempts');
        } else {
            logger.info(`✅ HyDE extraction completed: ${allConcepts.length} total concepts from ${this.stats.hydeSuccesses} successful attempts`);
        }

        return allConcepts;
    }

    /**
     * Research concepts via Wikipedia search
     */
    async researchConcepts(concepts) {
        logger.info(`Starting research for ${concepts.length} concepts...`);
        
        const researchResults = [];
        
        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            logger.info(`Researching concept ${i + 1}/${concepts.length}: "${concept.value}"`);
            
            try {
                // Search Wikipedia for the concept
                const searchResult = await this.wikipediaSearch.search(concept.value, {
                    delay: this.options.searchDelay,
                    limit: this.options.maxResultsPerConcept
                });
                
                this.stats.totalSearches++;
                this.stats.totalWikipediaResults += searchResult.results.length;
                
                if (searchResult.results.length > 0) {
                    // Ingest search results as units
                    const ingestionResult = await this.wikipediaSearch.ingest(searchResult);
                    
                    if (ingestionResult.success) {
                        this.stats.successfulSearches++;
                        this.stats.unitsCreated += ingestionResult.statistics.generatedUnits;
                        
                        researchResults.push({
                            concept: concept,
                            searchResult: searchResult,
                            ingestionResult: ingestionResult,
                            success: true
                        });
                        
                        logger.info(`✅ Successfully researched "${concept.value}": ${searchResult.results.length} results, ${ingestionResult.statistics.generatedUnits} units created`);
                    } else {
                        this.stats.failedSearches++;
                        this.stats.errors.push(`Ingestion failed for concept "${concept.value}": ${ingestionResult.error}`);
                        
                        researchResults.push({
                            concept: concept,
                            searchResult: searchResult,
                            ingestionResult: ingestionResult,
                            success: false,
                            error: ingestionResult.error
                        });
                        
                        logger.warn(`⚠️  Ingestion failed for "${concept.value}": ${ingestionResult.error}`);
                    }
                } else {
                    this.stats.failedSearches++;
                    logger.warn(`⚠️  No Wikipedia results found for "${concept.value}"`);
                    
                    researchResults.push({
                        concept: concept,
                        searchResult: searchResult,
                        success: false,
                        error: 'No results found'
                    });
                }
                
            } catch (error) {
                this.stats.failedSearches++;
                this.stats.errors.push(`Research failed for concept "${concept.value}": ${error.message}`);
                
                researchResults.push({
                    concept: concept,
                    success: false,
                    error: error.message
                });
                
                logger.error(`❌ Research failed for "${concept.value}":`, error.message);
            }
        }
        
        this.stats.conceptsResearched = concepts.length;
        logger.info(`Research completed: ${this.stats.successfulSearches}/${this.stats.totalSearches} successful searches`);
        
        return researchResults;
    }

    /**
     * Transform Wikipedia units to corpuscles
     */
    async transformUnitsToCorpuscles() {
        logger.info('Transforming Wikipedia units to corpuscles...');
        
        try {
            const transformResult = await this.unitsToCorpuscles.process();
            
            if (transformResult.success) {
                this.stats.corpusclesCreated = transformResult.statistics.generatedCorpuscles;
                this.stats.relationshipsCreated = transformResult.statistics.generatedRelationships;
                
                logger.info(`✅ Successfully transformed units: ${this.stats.corpusclesCreated} corpuscles, ${this.stats.relationshipsCreated} relationships created`);
                return transformResult;
            } else {
                this.stats.errors.push(`Unit transformation failed: ${transformResult.error}`);
                logger.error(`❌ Unit transformation failed: ${transformResult.error}`);
                return transformResult;
            }
            
        } catch (error) {
            this.stats.errors.push(`Unit transformation error: ${error.message}`);
            logger.error('❌ Unit transformation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Main research process
     */
    async research() {
        try {
            this.stats.startTime = new Date();
            logger.info('Starting BeerQA question research process');

            // Find question corpuscle (with or without concepts)
            logger.info('Finding question corpuscle...');
            const question = await this.findQuestionCorpuscle();
            
            let concepts = question.concepts;
            let conceptsSource = question.conceptsSource;

            // If no concepts found, use HyDE to extract them
            if (concepts.length === 0) {
                logger.info('No existing concepts found, using HyDE to extract concepts...');
                concepts = await this.extractConceptsViaHyDE(question.questionText);
                conceptsSource = 'hyde';
                
                if (concepts.length === 0) {
                    return {
                        success: false,
                        error: 'Failed to extract concepts via HyDE after all attempts',
                        question: question,
                        statistics: this.getStatistics()
                    };
                }
            }

            logger.info(`Found question: "${question.questionText.substring(0, 50)}..." with ${concepts.length} concepts (source: ${conceptsSource})`);

            // Update question object with final concepts
            question.concepts = concepts;
            question.conceptsSource = conceptsSource;

            // Research concepts via Wikipedia
            const researchResults = await this.researchConcepts(concepts);

            // Transform Wikipedia units to corpuscles
            const transformResult = await this.transformUnitsToCorpuscles();

            this.stats.endTime = new Date();
            this.stats.processingTime = this.stats.endTime - this.stats.startTime;

            return {
                success: true,
                question: question,
                researchResults: researchResults,
                transformResult: transformResult,
                statistics: this.getStatistics()
            };

        } catch (error) {
            logger.error('Question research failed:', error);
            this.stats.errors.push(error.message);
            this.stats.endTime = new Date();

            return {
                success: false,
                error: error.message,
                statistics: this.getStatistics()
            };
        }
    }

    /**
     * Get processing statistics
     */
    getStatistics() {
        const processingTimeMs = this.stats.endTime ? this.stats.endTime - this.stats.startTime : null;
        const successRate = this.stats.totalSearches > 0 ? 
            ((this.stats.successfulSearches / this.stats.totalSearches) * 100).toFixed(2) + '%' : 'N/A';

        return {
            ...this.stats,
            processingTimeMs: processingTimeMs,
            totalProcessingTime: processingTimeMs ? `${(processingTimeMs / 1000).toFixed(2)}s` : 'N/A',
            successRate: successRate
        };
    }

    /**
     * Query research results for verification
     */
    async queryResearchResults(limit = 5) {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?unit ?unitLabel ?corpuscle ?corpuscleLabel ?searchQuery
FROM <${this.options.wikipediaGraphURI}>
WHERE {
    ?unit a ragno:Unit ;
          rdfs:label ?unitLabel ;
          ragno:searchQuery ?searchQuery .
    
    OPTIONAL {
        ?corpuscle a ragno:Corpuscle ;
                   rdfs:label ?corpuscleLabel ;
                   ragno:relatedToUnit ?unit .
    }
}
ORDER BY ?unit
LIMIT ${limit}`;

        try {
            const response = await fetch(queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${btoa(`${this.options.sparqlAuth.user}:${this.options.sparqlAuth.password}`)}`
                },
                body: query
            });

            if (!response.ok) {
                throw new Error(`Query failed: ${response.status} ${response.statusText}`);
            }

            const results = await response.json();
            return results;
            
        } catch (error) {
            logger.error('Failed to query research results:', error);
            throw error;
        }
    }
}

/**
 * Main demo function
 */
async function runBeerQAQuestionResearch() {
    displayHeader();

    // Initialize Config.js for proper configuration management
    const config = new Config('config/config.json');
    await config.init();
    
    const options = {
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
        searchDelay: 300,
        maxResultsPerConcept: 3,
        generateEmbeddings: true
    };

    // Display configuration with actual SPARQL endpoint from config  
    const displayConfig = {
        sparqlEndpoint: config.get('storage.options.update'),
        sparqlAuth: { 
            user: config.get('storage.options.user'), 
            password: config.get('storage.options.password') 
        },
        ...options
    };
    displayConfiguration(displayConfig);

    try {
        console.log(chalk.bold.yellow('🚀 Starting Question Research Process...'));
        console.log(chalk.dim('Finding question concepts and researching them via Wikipedia...'));
        console.log('');

        // Initialize research system
        const research = new BeerQAQuestionResearch(config, options);
        await research.initialize();

        // Run research
        const result = await research.research();

        if (result.success) {
            console.log(chalk.bold.green('✅ Question Research Completed Successfully!'));
            console.log('');

            // Display question info
            displayQuestionInfo(result.question);

            // Display concepts
            displayConcepts(result.question.concepts, result.question.conceptsSource);

            // Display research summary
            displayResearchSummary(result.statistics);

            // Query and display sample results
            console.log(chalk.bold.yellow('🔍 Querying Sample Research Results...'));
            try {
                const sampleResults = await research.queryResearchResults(5);
                
                if (sampleResults.results.bindings.length > 0) {
                    console.log(chalk.bold.white('📊 Sample Wikipedia Research Results:'));
                    
                    for (let i = 0; i < Math.min(sampleResults.results.bindings.length, 3); i++) {
                        const binding = sampleResults.results.bindings[i];
                        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(binding.unitLabel?.value || 'No label')}`);
                        console.log(`      ${chalk.gray('Search Query:')} ${chalk.white(binding.searchQuery?.value || 'N/A')}`);
                        console.log(`      ${chalk.gray('Has Corpuscle:')} ${chalk.white(binding.corpuscle ? 'Yes' : 'No')}`);
                        if (binding.corpuscle) {
                            console.log(`      ${chalk.gray('Corpuscle:')} ${chalk.white(binding.corpuscleLabel?.value || 'No label')}`);
                        }
                        console.log('');
                    }
                } else {
                    console.log(chalk.yellow('⚠️  No research results found to display'));
                    console.log('');
                }
            } catch (queryError) {
                console.log(chalk.yellow('⚠️  Could not query sample results:', queryError.message));
                console.log('');
            }

            // Display any errors
            if (result.statistics.errors && result.statistics.errors.length > 0) {
                displayErrors(result.statistics.errors);
            } else {
                console.log(chalk.bold.green('✅ No errors encountered!'));
                console.log('');
            }

            // Summary
            console.log(chalk.bold.green('🎉 Question Research Demo Completed Successfully!'));
            console.log(chalk.white('The BeerQA question concepts have been researched and augmented:'));
            console.log(`   • ${chalk.white('Concepts Researched:')} ${chalk.cyan(result.statistics.conceptsResearched)}`);
            console.log(`   • ${chalk.white('Wikipedia Units Created:')} ${chalk.cyan(result.statistics.unitsCreated)}`);
            console.log(`   • ${chalk.white('Corpuscles Created:')} ${chalk.cyan(result.statistics.corpusclesCreated)}`);
            console.log(`   • ${chalk.white('Stored in graph:')} ${chalk.cyan(options.wikipediaGraphURI)}`);
            console.log('');
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • Query the research data at: ${chalk.white(displayConfig.sparqlEndpoint.replace('/update', '/query'))}`);
            console.log(`   • Explore Wikipedia units: ${chalk.white('SELECT * WHERE { GRAPH <' + options.wikipediaGraphURI + '> { ?s a ragno:Unit } } LIMIT 10')}`);
            console.log(`   • Find research corpuscles: ${chalk.white('SELECT * WHERE { GRAPH <' + options.wikipediaGraphURI + '> { ?s a ragno:Corpuscle } } LIMIT 10')}`);
            console.log(`   • Compare with original question: ${chalk.white('SELECT * WHERE { GRAPH <' + options.beerqaGraphURI + '> { ?s ragno:augmented true } } LIMIT 10')}`);
            console.log('');

        } else {
            console.log(chalk.bold.red('❌ Question Research Failed!'));
            console.log(chalk.red('Error:', result.error));
            console.log('');

            const stats = result.statistics;
            if (stats.errors && stats.errors.length > 0) {
                displayErrors(stats.errors);
            }
        }

    } catch (error) {
        console.log(chalk.bold.red('💥 Demo Failed!'));
        console.log(chalk.red('Error:', error.message));
        console.log('');
        console.log(chalk.bold.yellow('💡 Troubleshooting Tips:'));
        console.log(`   • Ensure augmented questions exist: ${chalk.cyan('node examples/beerqa/AugmentQuestion.js')}`);
        console.log(`   • Check SPARQL endpoint is accessible: ${chalk.cyan(config.get('storage.options.update'))}`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check network connectivity to Wikipedia API`);
        console.log(`   • Ensure sufficient storage space for research data`);
        console.log(`   • Check that embedding services are running (if enabled)`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node QuestionResearch.js')} - Run the question research demo`);
    console.log('');
    console.log(chalk.bold.white('Purpose:'));
    console.log('  Finds BeerQA question corpuscles with extracted concepts and researches them:');
    console.log('  • Retrieves questions with extracted concepts from SPARQL store');
    console.log('  • Searches Wikipedia for each concept using WikipediaSearch');
    console.log('  • Ingests Wikipedia results as ragno:Unit instances');
    console.log('  • Transforms units to ragno:Corpuscle instances with UnitsToCorpuscles');
    console.log('  • Creates comprehensive research knowledge base');
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('beerqaGraphURI')} - BeerQA test questions graph URI`);
    console.log(`  • ${chalk.cyan('wikipediaGraphURI')} - Wikipedia research results graph URI`);
    console.log(`  • ${chalk.cyan('searchDelay')} - Rate limiting between Wikipedia searches`);
    console.log(`  • ${chalk.cyan('maxResultsPerConcept')} - Maximum Wikipedia results per concept`);
    console.log(`  • ${chalk.cyan('generateEmbeddings')} - Enable/disable embedding generation`);
    console.log('');
    console.log(chalk.bold.yellow('Prerequisites:'));
    console.log('  • Run BeerTestQuestions.js to create test questions');
    console.log('  • Run AugmentQuestion.js to extract concepts from questions');
    console.log('  • Network access to Wikipedia API');
    console.log('  • Optional: Ollama or compatible embedding service');
    console.log('');
    console.log(chalk.bold.yellow('Pipeline:'));
    console.log('  BeerTestQuestions.js → AugmentQuestion.js → QuestionResearch.js');
    console.log('');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    displayHeader();
    showUsage();
    process.exit(0);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    runBeerQAQuestionResearch().catch(error => {
        console.error(chalk.red('Question research failed:', error.message));
        process.exit(1);
    });
}

export { runBeerQAQuestionResearch, BeerQAQuestionResearch };