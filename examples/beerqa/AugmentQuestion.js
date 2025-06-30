#!/usr/bin/env node

/**
 * AugmentQuestion - Augment BeerQA test questions with embeddings and concept extraction
 * 
 * This script finds test questions that were stored by BeerTestQuestions.js,
 * generates embeddings for the question text, extracts concepts using LLM analysis,
 * and stores the results back to the corpuscle in the SPARQL store.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SPARQLHelper from './SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🔍 BEER QA QUESTION AUGMENTATION               ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('        Add Embeddings and Concepts to Test Questions       ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(config.graphURI)}`);
    console.log(`   ${chalk.cyan('Base URI:')} ${chalk.white(config.baseURI)}`);
    console.log(`   ${chalk.cyan('Generate Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Yes' : 'No')}`);
    console.log(`   ${chalk.cyan('Extract Concepts:')} ${chalk.white(config.extractConcepts ? 'Yes' : 'No')}`);
    console.log('');
}

/**
 * Display question information
 */
function displayQuestionInfo(question) {
    console.log(chalk.bold.white('📝 Selected Question:'));
    console.log(`   ${chalk.cyan('Question:')} ${chalk.white(question.questionText)}`);
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(question.corpuscle)}`);
    console.log(`   ${chalk.cyan('Source:')} ${chalk.white(question.source || 'N/A')}`);
    console.log(`   ${chalk.cyan('Question ID:')} ${chalk.white(question.questionId || 'N/A')}`);
    console.log('');
}

/**
 * Display augmentation results
 */
function displayAugmentationResults(results) {
    console.log(chalk.bold.white('📊 Augmentation Results:'));
    console.log(`   ${chalk.cyan('Embedding Generated:')} ${chalk.white(results.embeddingGenerated ? 'Yes' : 'No')}`);
    if (results.embeddingGenerated) {
        console.log(`   ${chalk.cyan('Embedding Dimensions:')} ${chalk.white(results.embeddingDimensions)}`);
    }
    console.log(`   ${chalk.cyan('Concepts Extracted:')} ${chalk.white(results.conceptsExtracted ? 'Yes' : 'No')}`);
    if (results.conceptsExtracted) {
        console.log(`   ${chalk.cyan('Number of Concepts:')} ${chalk.white(results.conceptCount)}`);
    }
    console.log(`   ${chalk.cyan('Triples Added:')} ${chalk.white(results.triplesAdded)}`);
    console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white(results.processingTime)}`);
    console.log('');
}

/**
 * Display extracted concepts
 */
function displayConcepts(concepts) {
    if (!concepts || concepts.length === 0) {
        console.log(chalk.yellow('⚠️  No concepts extracted'));
        return;
    }

    console.log(chalk.bold.white('🧠 Extracted Concepts:'));
    for (let i = 0; i < Math.min(concepts.length, 5); i++) {
        const concept = concepts[i];
        console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(concept.name || concept)}`);
        if (concept.type) {
            console.log(`      ${chalk.gray('Type:')} ${chalk.white(concept.type)}`);
        }
        if (concept.confidence) {
            console.log(`      ${chalk.gray('Confidence:')} ${chalk.white(concept.confidence)}`);
        }
    }
    
    if (concepts.length > 5) {
        console.log(`   ${chalk.dim(`... and ${concepts.length - 5} more concepts`)}`);
    }
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

    const displayErrors = errors.slice(0, 3);
    for (let i = 0; i < displayErrors.length; i++) {
        console.log(`   ${chalk.red('•')} ${chalk.white(displayErrors[i])}`);
    }

    if (errors.length > 3) {
        console.log(`   ${chalk.dim(`... and ${errors.length - 3} more errors`)}`);
    }
    console.log('');
}

/**
 * BeerQA Question Augmentation class
 */
class BeerQAQuestionAugmentation {
    constructor(config, options = {}) {
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            graphURI: options.graphURI || 'http://purl.org/stuff/beerqa/test',
            baseURI: options.baseURI || 'http://purl.org/stuff/beerqa/test/',
            generateEmbeddings: options.generateEmbeddings !== false, // Default true
            extractConcepts: options.extractConcepts !== false, // Default true
            timeout: options.timeout || 60000,
            ...options
        };

        // Initialize RDF namespaces
        this.namespaces = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            dcterms: 'http://purl.org/dc/terms/',
            prov: 'http://www.w3.org/ns/prov#',
            beerqa: this.options.baseURI
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout,
            continueOnError: false
        });

        // Statistics tracking
        this.stats = {
            questionsProcessed: 0,
            embeddingsGenerated: 0,
            conceptsExtracted: 0,
            triplesGenerated: 0,
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
     * Create embedding connector using configuration-driven factory pattern (from api-server.js)
     */
    async createEmbeddingConnector(config) {
        try {
            const embeddingProviders = config.get('embeddingProviders') || [];
            const sortedProviders = embeddingProviders
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            for (const provider of sortedProviders) {
                if (provider.type === 'ollama') {
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'ollama',
                        model: provider.model || 'nomic-embed-text',
                        options: { baseUrl: provider.baseUrl || 'http://localhost:11434' }
                    });
                }
            }
            
            // Default to Ollama
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                model: 'nomic-embed-text',
                options: { baseUrl: 'http://localhost:11434' }
            });
            
        } catch (error) {
            logger.warn('Failed to create embedding connector, using default:', error.message);
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                model: 'nomic-embed-text',
                options: { baseUrl: 'http://localhost:11434' }
            });
        }
    }

    /**
     * Get model configuration (from api-server.js)
     */
    async getModelConfig(config) {
        try {
            const llmModel = config.get('llm.model') || 'qwen2:1.5b';
            const embeddingModel = config.get('embedding.model') || 'nomic-embed-text';
            
            return {
                chatModel: llmModel,
                embeddingModel: embeddingModel
            };
        } catch (error) {
            logger.warn('Failed to get model config, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b',
                embeddingModel: 'nomic-embed-text'
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

            // Initialize embedding handler if enabled
            if (this.options.generateEmbeddings) {
                try {
                    // Use the new configuration pattern from api-server.js
                    const embeddingProvider = await this.createEmbeddingConnector(config);
                    const modelConfig = await this.getModelConfig(config);
                    const dimension = config.get('memory.dimension') || 1536;
                    
                    this.embeddingHandler = new EmbeddingHandler(
                        embeddingProvider,
                        modelConfig.embeddingModel,
                        dimension
                    );
                    logger.info('Embedding handler initialized successfully');
                } catch (error) {
                    logger.warn('Failed to initialize embedding handler:', error.message);
                    logger.warn('Embeddings will be disabled for this session');
                    this.options.generateEmbeddings = false;
                }
            }

            // Initialize LLM handler if concept extraction is enabled
            if (this.options.extractConcepts) {
                try {
                    // Use the new configuration pattern from api-server.js
                    const llmProvider = await this.createLLMConnector(config);
                    const modelConfig = await this.getModelConfig(config);
                    
                    this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
                    logger.info('LLM handler initialized successfully');
                } catch (error) {
                    logger.warn('Failed to initialize LLM handler:', error.message);
                    logger.warn('Concept extraction will be disabled for this session');
                    this.options.extractConcepts = false;
                }
            }

            if (!this.options.generateEmbeddings && !this.options.extractConcepts) {
                logger.warn('Both embedding generation and concept extraction are disabled');
                logger.warn('The augmentation will only update metadata timestamps');
            }

        } catch (error) {
            logger.error('Failed to initialize configuration:', error);
            throw error;
        }
    }

    /**
     * Find first test question from the store
     */
    async findFirstTestQuestion() {
        const queryEndpoint = this.options.sparqlEndpoint.replace('/update', '/query');
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?corpuscle ?questionText ?source ?questionId ?question
FROM <${this.options.graphURI}>
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
            
            if (!results.results.bindings.length) {
                throw new Error('No test questions found in the store. Run BeerTestQuestions.js first.');
            }

            const binding = results.results.bindings[0];
            return {
                corpuscle: binding.corpuscle.value,
                questionText: binding.questionText.value,
                source: binding.source.value,
                questionId: binding.questionId.value,
                question: binding.question.value
            };

        } catch (error) {
            logger.error('Failed to find test question:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for question text
     */
    async generateEmbedding(questionText) {
        if (!this.options.generateEmbeddings || !this.embeddingHandler) {
            return null;
        }

        try {
            logger.info('Generating embedding for question...');
            const embedding = await this.embeddingHandler.generateEmbedding(questionText);
            this.stats.embeddingsGenerated++;
            logger.info(`Generated embedding with ${embedding.length} dimensions`);
            return embedding;
        } catch (error) {
            logger.error('Failed to generate embedding:', error);
            this.stats.errors.push(`Embedding generation: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract concepts from question text
     */
    async extractConcepts(questionText) {
        if (!this.options.extractConcepts || !this.llmHandler) {
            return null;
        }

        try {
            logger.info('Extracting concepts from question...');
            const concepts = await this.llmHandler.extractConcepts(questionText);
            this.stats.conceptsExtracted++;
            logger.info(`Extracted ${concepts.length} concepts`);
            return concepts;
        } catch (error) {
            logger.error('Failed to extract concepts:', error);
            this.stats.errors.push(`Concept extraction: ${error.message}`);
            return null;
        }
    }

    /**
     * Generate RDF triples for augmentation data
     */
    generateAugmentationTriples(question, embedding, concepts) {
        const triples = [];
        const corpuscleURI = `<${question.corpuscle}>`;
        const timestamp = new Date().toISOString();

        // Embedding attribute
        if (embedding) {
            const embeddingURI = `<${this.options.baseURI}attribute/${question.questionId}_embedding>`;
            
            triples.push(`${embeddingURI} rdf:type ragno:Attribute .`);
            triples.push(`${embeddingURI} rdfs:label ${SPARQLHelper.createLiteral('question-embedding')} .`);
            triples.push(`${embeddingURI} a ragno:VectorEmbedding .`);
            triples.push(`${embeddingURI} ragno:attributeValue ${SPARQLHelper.createLiteral(JSON.stringify(embedding))} .`);
            triples.push(`${embeddingURI} ragno:embeddingDimensions ${SPARQLHelper.createLiteral(embedding.length.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
            triples.push(`${embeddingURI} dcterms:created ${SPARQLHelper.createLiteral(timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
            triples.push(`${embeddingURI} prov:wasGeneratedBy ${SPARQLHelper.createLiteral('embedding-handler')} .`);
            
            // Associate embedding with corpuscle
            triples.push(`${corpuscleURI} ragno:hasAttribute ${embeddingURI} .`);
            triples.push(`${embeddingURI} ragno:describesCorpuscle ${corpuscleURI} .`);
        }

        // Concept attributes
        if (concepts && concepts.length > 0) {
            for (let i = 0; i < concepts.length; i++) {
                const concept = concepts[i];
                const conceptURI = `<${this.options.baseURI}attribute/${question.questionId}_concept_${i}>`;
                
                triples.push(`${conceptURI} rdf:type ragno:Attribute .`);
                triples.push(`${conceptURI} rdfs:label ${SPARQLHelper.createLiteral('extracted-concept')} .`);
                triples.push(`${conceptURI} ragno:attributeType ${SPARQLHelper.createLiteral('concept')} .`);
                
                // Handle both string and object concepts
                if (typeof concept === 'string') {
                    triples.push(`${conceptURI} ragno:attributeValue ${SPARQLHelper.createLiteral(concept)} .`);
                } else {
                    triples.push(`${conceptURI} ragno:attributeValue ${SPARQLHelper.createLiteral(concept.name || concept.text || JSON.stringify(concept))} .`);
                    if (concept.type) {
                        triples.push(`${conceptURI} ragno:conceptType ${SPARQLHelper.createLiteral(concept.type)} .`);
                    }
                    if (concept.confidence) {
                        triples.push(`${conceptURI} ragno:confidence ${SPARQLHelper.createLiteral(concept.confidence.toString(), 'http://www.w3.org/2001/XMLSchema#float')} .`);
                    }
                }
                
                triples.push(`${conceptURI} ragno:conceptIndex ${SPARQLHelper.createLiteral(i.toString(), 'http://www.w3.org/2001/XMLSchema#integer')} .`);
                triples.push(`${conceptURI} dcterms:created ${SPARQLHelper.createLiteral(timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
                triples.push(`${conceptURI} prov:wasGeneratedBy ${SPARQLHelper.createLiteral('llm-concept-extraction')} .`);
                
                // Associate concept with corpuscle
                triples.push(`${corpuscleURI} ragno:hasAttribute ${conceptURI} .`);
                triples.push(`${conceptURI} ragno:describesCorpuscle ${corpuscleURI} .`);
            }
        }

        // Update corpuscle metadata
        triples.push(`${corpuscleURI} dcterms:modified ${SPARQLHelper.createLiteral(timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);
        triples.push(`${corpuscleURI} ragno:augmented ${SPARQLHelper.createLiteral('true', 'http://www.w3.org/2001/XMLSchema#boolean')} .`);
        triples.push(`${corpuscleURI} ragno:augmentationTimestamp ${SPARQLHelper.createLiteral(timestamp, 'http://www.w3.org/2001/XMLSchema#dateTime')} .`);

        return triples;
    }

    /**
     * Store augmentation data to SPARQL store
     */
    async storeAugmentationData(triples) {
        try {
            logger.info(`Storing ${triples.length} augmentation triples to SPARQL store...`);
            
            const triplesString = triples.join('\n        ');
            const query = this.sparqlHelper.createInsertDataQuery(this.options.graphURI, triplesString);
            
            const result = await this.sparqlHelper.executeUpdate(query);
            
            if (result.success) {
                logger.info('Augmentation data stored successfully');
                this.stats.triplesGenerated += triples.length;
                return true;
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            logger.error('Failed to store augmentation data:', error);
            this.stats.errors.push(`SPARQL storage: ${error.message}`);
            return false;
        }
    }

    /**
     * Main augmentation process
     */
    async augmentQuestion() {
        try {
            this.stats.startTime = new Date();
            logger.info('Starting BeerQA question augmentation process');

            // Find first test question
            logger.info('Finding first test question from store...');
            const question = await this.findFirstTestQuestion();
            logger.info(`Found question: "${question.questionText.substring(0, 50)}..."`);

            // Generate embedding
            const embedding = await this.generateEmbedding(question.questionText);

            // Extract concepts
            const concepts = await this.extractConcepts(question.questionText);

            // Generate triples for augmentation data
            const triples = this.generateAugmentationTriples(question, embedding, concepts);

            // Store to SPARQL store
            const stored = await this.storeAugmentationData(triples);

            this.stats.questionsProcessed = 1;
            this.stats.endTime = new Date();
            this.stats.processingTime = this.stats.endTime - this.stats.startTime;

            return {
                success: stored,
                question: question,
                embedding: embedding,
                concepts: concepts,
                embeddingGenerated: !!embedding,
                conceptsExtracted: !!concepts,
                embeddingDimensions: embedding ? embedding.length : 0,
                conceptCount: concepts ? concepts.length : 0,
                triplesAdded: triples.length,
                processingTime: `${(this.stats.processingTime / 1000).toFixed(2)}s`,
                statistics: this.getStatistics()
            };

        } catch (error) {
            logger.error('Question augmentation failed:', error);
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
        return {
            ...this.stats,
            processingTimeMs: this.stats.endTime ? this.stats.endTime - this.stats.startTime : null,
            successRate: this.stats.questionsProcessed > 0 ? 100 : 0,
            avgTriplesPerQuestion: this.stats.questionsProcessed > 0 ? this.stats.triplesGenerated / this.stats.questionsProcessed : 0
        };
    }
}

/**
 * Main demo function
 */
async function runBeerQAQuestionAugmentation() {
    displayHeader();

    // Initialize Config.js for proper configuration management
    const config = new Config('config/config.json');
    await config.init();
    
    const options = {
        graphURI: 'http://purl.org/stuff/beerqa/test',
        baseURI: 'http://purl.org/stuff/beerqa/test/',
        generateEmbeddings: true,
        extractConcepts: true
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
        console.log(chalk.bold.yellow('🚀 Starting Question Augmentation Process...'));
        console.log(chalk.dim('Finding test question and adding embeddings and concepts...'));
        console.log('');

        // Initialize augmentation system
        const augmentation = new BeerQAQuestionAugmentation(config, options);
        await augmentation.initialize();

        // Run augmentation
        const result = await augmentation.augmentQuestion();

        if (result.success) {
            console.log(chalk.bold.green('✅ Question Augmentation Completed Successfully!'));
            console.log('');

            // Display question info
            displayQuestionInfo(result.question);

            // Display augmentation results
            displayAugmentationResults(result);

            // Display extracted concepts
            if (result.concepts) {
                displayConcepts(result.concepts);
            }

            // Display any errors
            if (result.statistics.errors && result.statistics.errors.length > 0) {
                displayErrors(result.statistics.errors);
            } else {
                console.log(chalk.bold.green('✅ No errors encountered!'));
                console.log('');
            }

            // Summary
            console.log(chalk.bold.green('🎉 Question Augmentation Demo Completed Successfully!'));
            console.log(chalk.white('The BeerQA test question has been augmented with:'));
            if (result.embeddingGenerated) {
                console.log(`   • ${chalk.white('Vector Embedding:')} ${chalk.cyan(result.embeddingDimensions + ' dimensions')}`);
            }
            if (result.conceptsExtracted) {
                console.log(`   • ${chalk.white('Extracted Concepts:')} ${chalk.cyan(result.conceptCount + ' concepts')}`);
            }
            console.log(`   • ${chalk.white('Additional Triples:')} ${chalk.cyan(result.triplesAdded)}`);
            console.log(`   • ${chalk.white('Stored in graph:')} ${chalk.cyan(options.graphURI)}`);
            console.log('');
            console.log(chalk.bold.cyan('Next Steps:'));
            console.log(`   • Query the augmented data at: ${chalk.white(displayConfig.sparqlEndpoint.replace('/update', '/query'))}`);
            console.log(`   • Find embeddings: ${chalk.white('SELECT * WHERE { ?s a ragno:VectorEmbedding } LIMIT 10')}`);
            console.log(`   • Find concepts: ${chalk.white('SELECT * WHERE { ?s ragno:attributeType "concept" } LIMIT 10')}`);
            console.log(`   • View augmented corpuscles: ${chalk.white('SELECT * WHERE { ?s ragno:augmented true } LIMIT 10')}`);
            console.log('');

        } else {
            console.log(chalk.bold.red('❌ Question Augmentation Failed!'));
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
        console.log(`   • Ensure test questions exist: ${chalk.cyan('node examples/beerqa/BeerTestQuestions.js')}`);
        console.log(`   • Check SPARQL endpoint is accessible: ${chalk.cyan(config.get('storage.options.update'))}`);
        console.log(`   • Verify authentication credentials`);
        console.log(`   • Check that Ollama/embedding service is running`);
        console.log(`   • Ensure LLM service is available for concept extraction`);
        console.log(`   • Check network connectivity`);
        console.log('');
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log(chalk.bold.white('Usage:'));
    console.log(`  ${chalk.cyan('node AugmentQuestion.js')} - Run the question augmentation demo`);
    console.log('');
    console.log(chalk.bold.white('Purpose:'));
    console.log('  Finds a test question stored by BeerTestQuestions.js and augments it with:');
    console.log('  • Vector embeddings of the question text');
    console.log('  • Concept extraction using LLM analysis');
    console.log('  • Stores results as ragno:Attribute instances linked to the corpuscle');
    console.log('');
    console.log(chalk.bold.white('Configuration:'));
    console.log('  Edit the configuration object in this file to customize:');
    console.log(`  • ${chalk.cyan('sparqlEndpoint')} - SPARQL update endpoint URL`);
    console.log(`  • ${chalk.cyan('sparqlAuth')} - Authentication credentials`);
    console.log(`  • ${chalk.cyan('graphURI')} - Target named graph URI (should match test questions)`);
    console.log(`  • ${chalk.cyan('generateEmbeddings')} - Enable/disable embedding generation`);
    console.log(`  • ${chalk.cyan('extractConcepts')} - Enable/disable concept extraction`);
    console.log('');
    console.log(chalk.bold.yellow('Prerequisites:'));
    console.log('  • Run BeerTestQuestions.js first to create test questions');
    console.log('  • Ollama or compatible embedding service running');
    console.log('  • LLM service available for concept extraction');
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
    runBeerQAQuestionAugmentation().catch(error => {
        console.error(chalk.red('Question augmentation failed:', error.message));
        process.exit(1);
    });
}

export { runBeerQAQuestionAugmentation, BeerQAQuestionAugmentation };