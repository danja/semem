#!/usr/bin/env node

/**
 * HydeAugment - HyDE-based concept augmentation for BeerQA corpuscles
 * 
 * This script finds BeerQA corpuscles that don't have extracted concepts yet,
 * applies the HyDE (Hypothetical Document Embeddings) algorithm to generate
 * hypothetical relevant documents, extracts concepts from those documents,
 * and stores the concepts back to the corpuscles.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import WikipediaSearch from '../../src/aux/wikipedia/Search.js';
import UnitsToCorpuscles from '../../src/aux/wikipedia/UnitsToCorpuscles.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🔮 BEER QA HYDE AUGMENTATION                  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     HyDE-based concept extraction for corpuscles         ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('HyDE Attempts:')} ${chalk.white(config.hydeAttempts)}`);
    console.log(`   ${chalk.cyan('Max Results per Concept:')} ${chalk.white(config.maxResultsPerConcept)}`);
    console.log(`   ${chalk.cyan('Generate Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Yes' : 'No')}`);
    console.log('');
}

/**
 * Display corpuscle information
 */
function displayCorpuscleInfo(corpuscle) {
    console.log(chalk.bold.white('📝 Corpuscle Found:'));
    console.log(`   ${chalk.cyan('Content:')} ${chalk.white(corpuscle.content.substring(0, 80))}...`);
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(corpuscle.corpuscle)}`);
    console.log(`   ${chalk.cyan('Type:')} ${chalk.white(corpuscle.corpuscleType || 'N/A')}`);
    console.log('');
}

/**
 * Display HyDE concepts
 */
function displayHydeConcepts(concepts, hydeAttempt) {
    console.log(chalk.bold.white(`🔮 HyDE Concepts (Attempt ${hydeAttempt}):`));
    for (let i = 0; i < Math.min(concepts.length, 10); i++) {
        const concept = concepts[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(concept.value)}`);
        if (concept.type) {
            console.log(`      ${chalk.gray('Type:')} ${chalk.white(concept.type)}`);
        }
        if (concept.confidence) {
            console.log(`      ${chalk.gray('Confidence:')} ${chalk.white((concept.confidence * 100).toFixed(1) + '%')}`);
        }
        console.log(`      ${chalk.gray('HyDE Attempt:')} ${chalk.white(concept.attempt)}`);
    }
    
    if (concepts.length > 10) {
        console.log(`   ${chalk.dim(`... and ${concepts.length - 10} more concepts`)}`);
    }
    console.log('');
}

/**
 * Display augmentation results summary
 */
function displayAugmentationSummary(results) {
    console.log(chalk.bold.white('📊 HyDE Augmentation Summary:'));
    console.log(`   ${chalk.cyan('Corpuscles Processed:')} ${chalk.white(results.corpusclesProcessed)}`);
    console.log(`   ${chalk.cyan('HyDE Attempts:')} ${chalk.white(results.hydeAttempts)}`);
    console.log(`   ${chalk.cyan('HyDE Successes:')} ${chalk.white(results.hydeSuccesses)}`);
    console.log(`   ${chalk.cyan('Concepts from HyDE:')} ${chalk.white(results.conceptsFromHyde)}`);
    console.log(`   ${chalk.cyan('Total Wikipedia Searches:')} ${chalk.white(results.totalSearches)}`);
    console.log(`   ${chalk.cyan('Wikipedia Units Created:')} ${chalk.white(results.unitsCreated)}`);
    console.log(`   ${chalk.cyan('Corpuscles Created:')} ${chalk.white(results.corpusclesCreated)}`);
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
 * HyDE Generator class for generating hypothetical documents and extracting concepts
 */
class HyDEGenerator {
    constructor(llmHandler, options = {}) {
        this.llmHandler = llmHandler;
        this.options = {
            maxAttempts: options.maxAttempts || 3,
            temperature: options.temperature || 0.8,
            maxTokens: options.maxTokens || 500,
            ...options
        };
    }

    /**
     * Generate hypothetical documents using HyDE approach
     */
    async generateHypotheticalDocument(queryText, attempt = 1) {
        const prompt = `Given the following question or text, generate a hypothetical document that would be relevant and helpful for answering or understanding it. The document should contain detailed information, specific facts, and relevant concepts.

Question/Text: "${queryText}"

Generate a comprehensive, factual document (${this.options.maxTokens} tokens max) that addresses this topic:`;

        try {
            const response = await this.llmHandler.generateResponse(prompt, '', {
                temperature: this.options.temperature,
                maxTokens: this.options.maxTokens
            });
            
            return {
                success: true,
                document: response,
                attempt: attempt
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                attempt: attempt
            };
        }
    }

    /**
     * Extract concepts from hypothetical document
     */
    async extractConceptsFromDocument(document, attempt = 1) {
        try {
            const concepts = await this.llmHandler.extractConcepts(document);
            
            if (concepts && concepts.length > 0) {
                // Add HyDE metadata to concepts
                const hydeAugmentedConcepts = concepts.map((concept, index) => ({
                    value: typeof concept === 'string' ? concept : (concept.name || concept.text || concept.value || JSON.stringify(concept)),
                    type: typeof concept === 'object' ? (concept.type || 'hyde-extracted') : 'hyde-extracted',
                    confidence: typeof concept === 'object' ? (concept.confidence || 0.7) : 0.7,
                    source: 'hyde',
                    attempt: attempt,
                    hydeDocument: document.substring(0, 100) + '...' // Store snippet of source document
                }));
                
                return {
                    success: true,
                    concepts: hydeAugmentedConcepts,
                    attempt: attempt
                };
            } else {
                return {
                    success: false,
                    error: 'No concepts extracted from hypothetical document',
                    attempt: attempt
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                attempt: attempt
            };
        }
    }

    /**
     * Full HyDE concept extraction process
     */
    async extractConcepts(queryText) {
        const allConcepts = [];
        let successfulAttempts = 0;
        const errors = [];

        for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
            logger.info(`HyDE attempt ${attempt}/${this.options.maxAttempts} for query: "${queryText.substring(0, 50)}..."`);

            // Generate hypothetical document
            const docResult = await this.generateHypotheticalDocument(queryText, attempt);
            
            if (!docResult.success) {
                errors.push(`Attempt ${attempt} document generation: ${docResult.error}`);
                continue;
            }

            // Extract concepts from document
            const conceptResult = await this.extractConceptsFromDocument(docResult.document, attempt);
            
            if (conceptResult.success) {
                allConcepts.push(...conceptResult.concepts);
                successfulAttempts++;
                logger.info(`✅ HyDE attempt ${attempt} succeeded: ${conceptResult.concepts.length} concepts extracted`);
            } else {
                errors.push(`Attempt ${attempt} concept extraction: ${conceptResult.error}`);
                logger.warn(`⚠️  HyDE attempt ${attempt} failed: ${conceptResult.error}`);
            }
        }

        return {
            success: allConcepts.length > 0,
            concepts: allConcepts,
            attempts: this.options.maxAttempts,
            successfulAttempts: successfulAttempts,
            errors: errors
        };
    }
}

/**
 * BeerQA HyDE Augmentation class
 */
class BeerQAHydeAugmentation {
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
            searchDelay: options.searchDelay || performanceConfig.rateLimit || 300,
            maxResultsPerConcept: options.maxResultsPerConcept || performanceConfig.searchResultsLimit || 3,
            generateEmbeddings: options.generateEmbeddings !== false,
            hydeAttempts: options.hydeAttempts || 2,
            hydeTemperature: options.hydeTemperature || 0.8,
            hydeMaxTokens: options.hydeMaxTokens || 500,
            timeout: options.timeout || performanceConfig.timeout || 60000,
            ...options
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });
        
        // Initialize Wikipedia components
        this.wikipediaSearch = new WikipediaSearch({
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.wikipediaGraphURI,
            baseURI: this.options.wikipediaGraphURI.replace(/\/$/, '') + '/',
            timeout: this.options.timeout,
            defaultSearchLimit: performanceConfig.searchResultsLimit || 10,
            rateLimit: performanceConfig.rateLimit || 300
        });

        this.unitsToCorpuscles = new UnitsToCorpuscles({
            sparqlEndpoint: this.options.sparqlEndpoint,
            sparqlAuth: this.options.sparqlAuth,
            graphURI: this.options.wikipediaGraphURI,
            baseURI: this.options.wikipediaGraphURI.replace(/\/$/, '') + '/',
            generateEmbeddings: this.options.generateEmbeddings,
            timeout: this.options.timeout
        });

        // Initialize handlers
        this.llmHandler = null;
        this.hydeGenerator = null;

        // Statistics tracking
        this.stats = {
            corpusclesProcessed: 0,
            hydeAttempts: 0,
            hydeSuccesses: 0,
            conceptsFromHyde: 0,
            totalSearches: 0,
            totalWikipediaResults: 0,
            unitsCreated: 0,
            corpusclesCreated: 0,
            relationshipsCreated: 0,
            successfulSearches: 0,
            failedSearches: 0,
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
            
            console.log(`   Available chat providers by priority: ${sortedProviders.map(p => `${p.type} (priority: ${p.priority})`).join(', ')}`);
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                console.log(`   Trying LLM provider: ${provider.type} (priority: ${provider.priority})`);
                
                if (provider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                    console.log('   ✅ Creating Mistral connector (highest priority)...');
                    const MistralConnector = (await import('../../src/connectors/MistralConnector.js')).default;
                    return new MistralConnector(process.env.MISTRAL_API_KEY);
                } else if (provider.type === 'claude' && process.env.CLAUDE_API_KEY) {
                    console.log('   ✅ Creating Claude connector...');
                    const ClaudeConnector = (await import('../../src/connectors/ClaudeConnector.js')).default;
                    return new ClaudeConnector();
                } else if (provider.type === 'ollama') {
                    console.log('   ✅ Creating Ollama connector (fallback)...');
                    const OllamaConnector = (await import('../../src/connectors/OllamaConnector.js')).default;
                    return new OllamaConnector();
                } else {
                    console.log(`   ❌ Provider ${provider.type} not available (missing API key or implementation)`);
                }
            }
            
            console.log('   ⚠️ No configured providers available, defaulting to Ollama');
            const OllamaConnector = (await import('../../src/connectors/OllamaConnector.js')).default;
            return new OllamaConnector();
            
        } catch (error) {
            console.log(`   ⚠️ Failed to load provider configuration, defaulting to Ollama: ${error.message}`);
            const OllamaConnector = (await import('../../src/connectors/OllamaConnector.js')).default;
            return new OllamaConnector();
        }
    }

    /**
     * Get model configuration from provider (from api-server.js)
     */
    async getModelConfig(config) {
        try {
            // Get highest priority provider with chat capability
            const llmProviders = config.get('llmProviders') || [];
            const chatProvider = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            
            return {
                chatModel: chatProvider?.chatModel || 'qwen2:1.5b'
            };
        } catch (error) {
            logger.warn('Failed to get model config, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b'
            };
        }
    }

    /**
     * Initialize handlers
     */
    async initialize() {
        try {
            // Load configuration from config.json like in api-server.js
            const configPath = path.join(process.cwd(), 'config/config.json');
            const config = new Config(configPath);
            await config.init();

            // Initialize LLM handler
            try {
                const llmProvider = await this.createLLMConnector(config);
                const modelConfig = await this.getModelConfig(config);
                
                this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
                
                // Initialize HyDE generator
                this.hydeGenerator = new HyDEGenerator(this.llmHandler, {
                    maxAttempts: this.options.hydeAttempts,
                    temperature: this.options.hydeTemperature,
                    maxTokens: this.options.hydeMaxTokens
                });
                
                logger.info('LLM handler and HyDE generator initialized successfully');
            } catch (error) {
                logger.error('Failed to initialize LLM handler:', error.message);
                throw error;
            }

        } catch (error) {
            logger.error('Failed to initialize configuration:', error);
            throw error;
        }
    }

    /**
     * Find corpuscles without extracted concepts
     */
    async findCorpusclesWithoutConcepts(limit = 10) {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        // Find corpuscles that don't have concept attributes
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?corpuscle ?content ?corpuscleType ?source ?identifier
FROM <${this.options.beerqaGraphURI}>
WHERE {
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?content .
    
    OPTIONAL { ?corpuscle ragno:corpuscleType ?corpuscleType }
    OPTIONAL { ?corpuscle dcterms:source ?source }
    OPTIONAL { ?corpuscle dcterms:identifier ?identifier }
    
    # Exclude corpuscles that already have concept attributes
    FILTER NOT EXISTS {
        ?corpuscle ragno:hasAttribute ?conceptAttr .
        ?conceptAttr ragno:attributeType "concept" .
    }
}
ORDER BY ?corpuscle
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
            
            if (results.results.bindings.length === 0) {
                logger.info('No corpuscles without concepts found. All corpuscles already have concepts.');
                return [];
            }

            const corpuscles = [];
            for (const binding of results.results.bindings) {
                corpuscles.push({
                    corpuscle: binding.corpuscle.value,
                    content: binding.content.value,
                    corpuscleType: binding.corpuscleType?.value || 'unknown',
                    source: binding.source?.value || 'unknown',
                    identifier: binding.identifier?.value || 'unknown'
                });
            }

            logger.info(`Found ${corpuscles.length} corpuscles without concepts`);
            return corpuscles;

        } catch (error) {
            logger.error('Failed to find corpuscles without concepts:', error);
            throw error;
        }
    }

    /**
     * Store extracted concepts to the corpuscle
     */
    async storeConceptsToCorpuscle(corpuscleURI, concepts) {
        if (concepts.length === 0) return true;

        const timestamp = new Date().toISOString();
        const triples = [];
        const baseURI = this.options.beerqaGraphURI.endsWith('/') ? 
            this.options.beerqaGraphURI : this.options.beerqaGraphURI + '/';

        // Extract identifier from corpuscle URI for attribute naming
        const identifier = corpuscleURI.split('/').pop();

        // Create concept attributes
        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            const conceptURI = `<${baseURI}attribute/${identifier}_hyde_concept_${i}_${concept.attempt}>`;
            
            triples.push(`${conceptURI} rdf:type ragno:Attribute .`);
            triples.push(`${conceptURI} rdfs:label "hyde-extracted-concept" .`);
            triples.push(`${conceptURI} ragno:attributeType "concept" .`);
            // Properly escape SPARQL string literals
            const escapedValue = concept.value
                .replace(/\\/g, '\\\\')  // Escape backslashes
                .replace(/"/g, '\\"')     // Escape quotes
                .replace(/\n/g, '\\n')     // Escape newlines
                .replace(/\r/g, '\\r')     // Escape carriage returns
                .replace(/\t/g, '\\t');    // Escape tabs
            triples.push(`${conceptURI} ragno:attributeValue "${escapedValue}" .`);
            
            if (concept.type) {
                triples.push(`${conceptURI} ragno:conceptType "${concept.type}" .`);
            }
            if (concept.confidence) {
                triples.push(`${conceptURI} ragno:confidence "${concept.confidence}"^^xsd:float .`);
            }
            
            triples.push(`${conceptURI} ragno:conceptIndex "${i}"^^xsd:integer .`);
            triples.push(`${conceptURI} ragno:hydeAttempt "${concept.attempt}"^^xsd:integer .`);
            triples.push(`${conceptURI} ragno:hydeSource "hypothetical-document" .`);
            if (concept.hydeDocument) {
                const escapedDoc = concept.hydeDocument
                    .replace(/\\/g, '\\\\\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                triples.push(`${conceptURI} ragno:hydeDocumentSnippet "${escapedDoc}" .`);
            }
            triples.push(`${conceptURI} dcterms:created "${timestamp}"^^xsd:dateTime .`);
            triples.push(`${conceptURI} prov:wasGeneratedBy "hyde-concept-extraction" .`);
            
            // Link to corpuscle
            triples.push(`<${corpuscleURI}> ragno:hasAttribute ${conceptURI} .`);
            triples.push(`${conceptURI} ragno:describesCorpuscle <${corpuscleURI}> .`);
        }

        // Create SPARQL update query
        const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${this.options.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

        try {
            const result = await this.sparqlHelper.executeUpdate(updateQuery);
            
            if (result.success) {
                logger.info(`✅ Stored ${concepts.length} HyDE concepts to corpuscle`);
                return true;
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            logger.error(`❌ Failed to store HyDE concepts: ${error.message}`);
            this.stats.errors.push(`HyDE concept storage: ${error.message}`);
            return false;
        }
    }

    /**
     * Research concepts via Wikipedia search
     */
    async researchConcepts(concepts) {
        logger.info(`Starting Wikipedia research for ${concepts.length} HyDE concepts...`);
        
        const researchResults = [];
        
        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            logger.info(`Researching HyDE concept ${i + 1}/${concepts.length}: "${concept.value}"`);
            
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
                        
                        logger.info(`✅ Successfully researched HyDE concept "${concept.value}": ${searchResult.results.length} results, ${ingestionResult.statistics.generatedUnits} units created`);
                    } else {
                        this.stats.failedSearches++;
                        this.stats.errors.push(`Ingestion failed for HyDE concept "${concept.value}": ${ingestionResult.error}`);
                        
                        researchResults.push({
                            concept: concept,
                            searchResult: searchResult,
                            ingestionResult: ingestionResult,
                            success: false,
                            error: ingestionResult.error
                        });
                        
                        logger.warn(`⚠️  Ingestion failed for HyDE concept "${concept.value}": ${ingestionResult.error}`);
                    }
                } else {
                    this.stats.failedSearches++;
                    logger.warn(`⚠️  No Wikipedia results found for HyDE concept "${concept.value}"`);
                    
                    researchResults.push({
                        concept: concept,
                        searchResult: searchResult,
                        success: false,
                        error: 'No results found'
                    });
                }
                
            } catch (error) {
                this.stats.failedSearches++;
                this.stats.errors.push(`Research failed for HyDE concept "${concept.value}": ${error.message}`);
                
                researchResults.push({
                    concept: concept,
                    success: false,
                    error: error.message
                });
                
                logger.error(`❌ Research failed for HyDE concept "${concept.value}":`, error.message);
            }
        }
        
        logger.info(`HyDE research completed: ${this.stats.successfulSearches}/${this.stats.totalSearches} successful searches`);
        
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
     * Main HyDE augmentation process
     */
    async augment(corpuscleLimit = 10) {
        try {
            this.stats.startTime = new Date();
            logger.info('Starting BeerQA HyDE concept augmentation');

            // Find corpuscles without concepts
            logger.info(`Finding up to ${corpuscleLimit} corpuscles without concepts...`);
            const corpuscles = await this.findCorpusclesWithoutConcepts(corpuscleLimit);
            
            if (!Array.isArray(corpuscles) || corpuscles.length === 0) {
                logger.info('No corpuscles without concepts found. All corpuscles already have concepts.');
                return {
                    success: true,
                    corpusclesProcessed: 0,
                    totalCorpusclesFound: 0,
                    corpuscles: [],
                    allHydeConcepts: [],
                    researchResults: [],
                    statistics: this.getStatistics()
                };
            }

            logger.info(`Processing ${corpuscles.length} corpuscles with HyDE`);
            
            const processedCorpuscles = [];
            const allHydeConcepts = [];
            const allResearchResults = [];

            // Process each corpuscle
            for (let i = 0; i < corpuscles.length; i++) {
                const corpuscle = corpuscles[i];
                logger.info(`\n--- Processing Corpuscle ${i + 1}/${corpuscles.length} ---`);
                logger.info(`Content: "${corpuscle.content.substring(0, 80)}..."`);
                
                // Apply HyDE concept extraction
                const hydeResult = await this.hydeGenerator.extractConcepts(corpuscle.content);
                this.stats.hydeAttempts += hydeResult.attempts;
                
                if (hydeResult.success && hydeResult.concepts.length > 0) {
                    this.stats.hydeSuccesses += hydeResult.successfulAttempts;
                    this.stats.conceptsFromHyde += hydeResult.concepts.length;
                    
                    logger.info(`✅ HyDE extracted ${hydeResult.concepts.length} concepts from ${hydeResult.successfulAttempts}/${hydeResult.attempts} attempts`);

                    // Store concepts back to the corpuscle
                    await this.storeConceptsToCorpuscle(corpuscle.corpuscle, hydeResult.concepts);
                    
                    // Update corpuscle object with HyDE concepts
                    corpuscle.hydeConcepts = hydeResult.concepts;
                    corpuscle.hydeSuccess = true;
                    allHydeConcepts.push(...hydeResult.concepts);
                    
                    // Research concepts via Wikipedia
                    const researchResults = await this.researchConcepts(hydeResult.concepts);
                    allResearchResults.push(...researchResults);
                    
                } else {
                    logger.warn(`⚠️  HyDE failed for corpuscle ${i + 1}: ${hydeResult.errors?.join(', ') || 'No concepts extracted'}`);
                    this.stats.errors.push(`HyDE failed for corpuscle: ${corpuscle.content.substring(0, 50)}...`);
                    
                    corpuscle.hydeConcepts = [];
                    corpuscle.hydeSuccess = false;
                    corpuscle.hydeErrors = hydeResult.errors || [];
                }
                
                processedCorpuscles.push(corpuscle);
                this.stats.corpusclesProcessed++;
            }

            // Transform all Wikipedia units to corpuscles (once at the end)
            if (allResearchResults.length > 0) {
                logger.info('Transforming all Wikipedia units to corpuscles...');
                const transformResult = await this.transformUnitsToCorpuscles();
                
                this.stats.endTime = new Date();
                this.stats.processingTime = this.stats.endTime - this.stats.startTime;

                return {
                    success: true,
                    corpusclesProcessed: processedCorpuscles.length,
                    totalCorpusclesFound: corpuscles.length,
                    corpuscles: processedCorpuscles,
                    allHydeConcepts: allHydeConcepts,
                    researchResults: allResearchResults,
                    transformResult: transformResult,
                    statistics: this.getStatistics()
                };
            } else {
                this.stats.endTime = new Date();
                this.stats.processingTime = this.stats.endTime - this.stats.startTime;

                return {
                    success: true,
                    corpusclesProcessed: processedCorpuscles.length,
                    totalCorpusclesFound: corpuscles.length,
                    corpuscles: processedCorpuscles,
                    allHydeConcepts: allHydeConcepts,
                    researchResults: allResearchResults,
                    statistics: this.getStatistics()
                };
            }

        } catch (error) {
            logger.error('HyDE augmentation failed:', error);
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
}

/**
 * Main demo function
 */
async function runBeerQAHydeAugmentation() {
    displayHeader();

    // Initialize Config.js for proper configuration management
    const config = new Config('config/config.json');
    await config.init();
    
    const options = {
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
        searchDelay: 300,
        maxResultsPerConcept: 2,
        generateEmbeddings: true,
        hydeAttempts: 2,
        hydeTemperature: 0.8,
        hydeMaxTokens: 400
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
        console.log(chalk.bold.yellow('🚀 Starting HyDE Augmentation Process...'));
        console.log(chalk.dim('Finding corpuscles without concepts and applying HyDE algorithm...'));
        console.log('');

        // Initialize HyDE augmentation system
        const augmentation = new BeerQAHydeAugmentation(config, options);
        await augmentation.initialize();

        // Run HyDE augmentation (process up to 10 corpuscles for demo)
        const result = await augmentation.augment(10);

        if (result.success) {
            console.log(chalk.bold.green('✅ HyDE Augmentation Completed Successfully!'));
            console.log('');

            // Display summary of processed corpuscles
            console.log(chalk.bold.white('📊 Corpuscles Processed:'));
            console.log(`   ${chalk.cyan('Total Corpuscles Found:')} ${chalk.white(result.totalCorpusclesFound)}`);
            console.log(`   ${chalk.cyan('Corpuscles Processed:')} ${chalk.white(result.corpusclesProcessed)}`);
            console.log('');

            // Display first successful corpuscle info as example
            const firstSuccessful = result.corpuscles.find(c => c.hydeSuccess);
            if (firstSuccessful) {
                console.log(chalk.bold.white('📝 Sample Corpuscle (first processed):'));
                displayCorpuscleInfo(firstSuccessful);
                
                if (firstSuccessful.hydeConcepts && firstSuccessful.hydeConcepts.length > 0) {
                    const firstAttempt = Math.min(...firstSuccessful.hydeConcepts.map(c => c.attempt));
                    displayHydeConcepts(firstSuccessful.hydeConcepts.filter(c => c.attempt === firstAttempt), firstAttempt);
                }
            }

            // Display HyDE augmentation summary
            displayAugmentationSummary(result.statistics);

            // Display any errors
            if (result.statistics.errors && result.statistics.errors.length > 0) {
                displayErrors(result.statistics.errors);
            } else {
                console.log(chalk.bold.green('✅ No errors encountered!'));
                console.log('');
            }

            // Summary
            console.log(chalk.bold.green('🎉 HyDE Augmentation Demo Completed Successfully!'));
            console.log(chalk.white('The BeerQA corpuscles have been augmented with HyDE concepts:'));
            console.log(`   • ${chalk.white('Corpuscles Processed:')} ${chalk.cyan(result.corpusclesProcessed + '/' + result.totalCorpusclesFound)}`);
            console.log(`   • ${chalk.white('HyDE Attempts:')} ${chalk.cyan(result.statistics.hydeAttempts)}`);
            console.log(`   • ${chalk.white('HyDE Successes:')} ${chalk.cyan(result.statistics.hydeSuccesses)}`);
            console.log(`   • ${chalk.white('Concepts from HyDE:')} ${chalk.cyan(result.statistics.conceptsFromHyde)}`);
            console.log(`   • ${chalk.white('Wikipedia Units Created:')} ${chalk.cyan(result.statistics.unitsCreated)}`);
            console.log(`   • ${chalk.white('Stored in graph:')} ${chalk.cyan(options.beerqaGraphURI)}`);
            console.log('');
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • Query the HyDE data at: ${chalk.white(displayConfig.sparqlEndpoint.replace('/update', '/query'))}`);
            console.log(`   • Find HyDE concepts: ${chalk.white('SELECT * WHERE { ?s ragno:attributeType "concept" ; prov:wasGeneratedBy "hyde-concept-extraction" } LIMIT 10')}`);
            console.log(`   • Explore Wikipedia research: ${chalk.white('SELECT * WHERE { GRAPH <' + options.wikipediaGraphURI + '> { ?s a ragno:Unit } } LIMIT 10')}`);
            console.log(`   • Run QuestionResearch.js for remaining concept extraction`);
            console.log('');

        } else {
            console.log(chalk.bold.red('❌ HyDE Augmentation Failed!'));
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
        console.log(`   • Ensure corpuscles exist: ${chalk.cyan('node examples/beerqa/BeerTestQuestions.js')}`);
        console.log(`   • Check SPARQL endpoint is accessible: ${chalk.cyan(config.get('storage.options.update'))}`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check that LLM service is running for HyDE generation`);
        console.log(`   • Check network connectivity to Wikipedia API`);
        console.log(`   • Ensure sufficient storage space for research data`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node HydeAugment.js')} - Run the HyDE augmentation demo`);
    console.log('');
    console.log(chalk.bold.white('Purpose:'));
    console.log('  Finds BeerQA corpuscles without extracted concepts and applies HyDE algorithm:');
    console.log('  • Retrieves corpuscles without concept attributes from SPARQL store');
    console.log('  • Generates hypothetical documents using LLM (HyDE algorithm)');
    console.log('  • Extracts concepts from hypothetical documents');
    console.log('  • Stores HyDE concepts back to corpuscles with metadata');
    console.log('  • Researches HyDE concepts via Wikipedia search');
    console.log('  • Creates comprehensive research knowledge base');
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('beerqaGraphURI')} - BeerQA corpuscles graph URI`);
    console.log(`  • ${chalk.cyan('wikipediaGraphURI')} - Wikipedia research results graph URI`);
    console.log(`  • ${chalk.cyan('hydeAttempts')} - Number of HyDE generation attempts per corpuscle`);
    console.log(`  • ${chalk.cyan('hydeTemperature')} - LLM temperature for HyDE generation`);
    console.log(`  • ${chalk.cyan('hydeMaxTokens')} - Maximum tokens for hypothetical documents`);
    console.log(`  • ${chalk.cyan('maxResultsPerConcept')} - Maximum Wikipedia results per concept`);
    console.log('');
    console.log(chalk.bold.yellow('Prerequisites:'));
    console.log('  • Run BeerTestQuestions.js to create test questions');
    console.log('  • Run AugmentQuestion.js to extract initial concepts');
    console.log('  • Run QuestionResearch.js for MemoryManager-based concept extraction');
    console.log('  • LLM service available for HyDE generation');
    console.log('  • Network access to Wikipedia API');
    console.log('');
    console.log(chalk.bold.yellow('Pipeline:'));
    console.log('  BeerTestQuestions.js → AugmentQuestion.js → QuestionResearch.js → HydeAugment.js');
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
    runBeerQAHydeAugmentation().catch(error => {
        console.error(chalk.red('HyDE augmentation failed:', error.message));
        process.exit(1);
    });
}

export { runBeerQAHydeAugmentation, BeerQAHydeAugmentation };