#!/usr/bin/env node

/**
 * AddWikipediaEmbeddings - Add embeddings to existing Wikipedia corpuscles
 * 
 * This script finds Wikipedia corpuscles that don't have embeddings,
 * generates embeddings from their content, and adds them as attributes.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import SPARQLHelper from './SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('          📊 ADD WIKIPEDIA EMBEDDINGS                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     Generate embeddings for existing Wikipedia corpuscles  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

class WikipediaEmbeddingAdder {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'http://localhost:3030/wikipedia/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            timeout: options.timeout || 30000,
            batchSize: options.batchSize || 10,
            ...options
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.embeddingHandler = null;
        
        this.stats = {
            corpusclesProcessed: 0,
            embeddingsGenerated: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
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
     * Get model configuration
     */
    async getModelConfig(config) {
        try {
            const embeddingModel = config.get('embedding.model') || 'nomic-embed-text';
            
            return {
                embeddingModel: embeddingModel
            };
        } catch (error) {
            logger.warn('Failed to get model config, using defaults:', error.message);
            return {
                embeddingModel: 'nomic-embed-text'
            };
        }
    }

    /**
     * Initialize embedding handler
     */
    async initialize() {
        try {
            const configPath = path.join(process.cwd(), 'config/config.json');
            const config = new Config(configPath);
            await config.init();

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
            logger.error('Failed to initialize embedding handler:', error.message);
            throw error;
        }
    }

    /**
     * Find Wikipedia corpuscles without embeddings
     */
    async findCorpusclesWithoutEmbeddings() {
        console.log(chalk.bold.white('🔍 Finding corpuscles without embeddings...'));
        
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?corpuscle ?title ?content
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL { ?textElement ragno:content ?content }
        
        # Find corpuscles that don't have embedding attributes
        FILTER NOT EXISTS {
            ?corpuscle ragno:hasAttribute ?embAttr .
            ?embAttr ragno:attributeType "vector-embedding" .
        }
    }
}
ORDER BY ?corpuscle
`;

        const result = await this.sparqlHelper.executeSelect(query);
        
        if (!result.success) {
            throw new Error(`Failed to find corpuscles: ${result.error}`);
        }

        console.log(`   ✓ Found ${result.data.results.bindings.length} corpuscles without embeddings`);
        
        return result.data.results.bindings.map(binding => ({
            uri: binding.corpuscle.value,
            title: binding.title.value,
            content: binding.content?.value || binding.title.value
        }));
    }

    /**
     * Generate embedding for text content
     */
    async generateEmbedding(text) {
        try {
            const embedding = await this.embeddingHandler.generateEmbedding(text);
            if (embedding && Array.isArray(embedding) && embedding.length === 1536) {
                return embedding;
            }
            return null;
        } catch (error) {
            logger.warn('Failed to generate embedding:', error.message);
            return null;
        }
    }

    /**
     * Add embedding attribute to corpuscle
     */
    async addEmbeddingToCorpuscle(corpuscle, embedding) {
        const timestamp = new Date().toISOString();
        const corpuscleURI = `<${corpuscle.uri}>`;
        const embeddingURI = `<${corpuscle.uri}_embedding_${Date.now()}>`;
        
        const triples = [
            `${embeddingURI} rdf:type ragno:Attribute .`,
            `${embeddingURI} rdfs:label "wikipedia-embedding" .`,
            `${embeddingURI} ragno:attributeType "vector-embedding" .`,
            `${embeddingURI} ragno:attributeValue "${JSON.stringify(embedding).replace(/"/g, '\\"')}" .`,
            `${embeddingURI} ragno:embeddingDimensions "${embedding.length}"^^xsd:integer .`,
            `${embeddingURI} dcterms:created "${timestamp}"^^xsd:dateTime .`,
            `${embeddingURI} prov:wasGeneratedBy "wikipedia-embedding-adder" .`,
            `${corpuscleURI} ragno:hasAttribute ${embeddingURI} .`,
            `${embeddingURI} ragno:describesCorpuscle ${corpuscleURI} .`
        ];

        const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

        const result = await this.sparqlHelper.executeUpdate(updateQuery);
        
        if (result.success) {
            this.stats.embeddingsGenerated++;
            return true;
        } else {
            this.stats.errors.push(`Failed to add embedding for ${corpuscle.uri}: ${result.error}`);
            return false;
        }
    }

    /**
     * Process all corpuscles without embeddings
     */
    async addEmbeddings() {
        try {
            this.stats.startTime = new Date();
            
            console.log(chalk.bold.yellow('🚀 Starting Wikipedia embedding generation...'));
            
            const corpuscles = await this.findCorpusclesWithoutEmbeddings();
            
            if (corpuscles.length === 0) {
                console.log(chalk.yellow('⚠️  All Wikipedia corpuscles already have embeddings'));
                return {
                    success: true,
                    message: 'No work needed - all corpuscles have embeddings',
                    statistics: this.getStatistics()
                };
            }

            console.log(`   Processing ${corpuscles.length} corpuscles...`);
            console.log('');
            
            for (let i = 0; i < corpuscles.length; i++) {
                const corpuscle = corpuscles[i];
                
                console.log(chalk.white(`   ${i + 1}/${corpuscles.length}: ${corpuscle.title}`));
                
                // Generate embedding
                const embedding = await this.generateEmbedding(corpuscle.content);
                
                if (embedding) {
                    const success = await this.addEmbeddingToCorpuscle(corpuscle, embedding);
                    if (success) {
                        console.log(chalk.green(`     ✓ Added embedding (${embedding.length} dimensions)`));
                    } else {
                        console.log(chalk.red(`     ❌ Failed to store embedding`));
                    }
                } else {
                    console.log(chalk.red(`     ❌ Failed to generate embedding`));
                    this.stats.errors.push(`Failed to generate embedding for ${corpuscle.uri}`);
                }
                
                this.stats.corpusclesProcessed++;
                
                // Small delay to be nice to the embedding service
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.endTime = new Date();
            
            return {
                success: true,
                message: 'Embeddings added successfully',
                statistics: this.getStatistics()
            };
            
        } catch (error) {
            this.stats.endTime = new Date();
            this.stats.errors.push(error.message);
            
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
        const processingTime = this.stats.endTime ? this.stats.endTime - this.stats.startTime : null;
        
        return {
            ...this.stats,
            processingTimeMs: processingTime,
            successRate: this.stats.corpusclesProcessed > 0 ? 
                (this.stats.embeddingsGenerated / this.stats.corpusclesProcessed * 100).toFixed(1) : 0
        };
    }
}

/**
 * Main function
 */
async function addWikipediaEmbeddings() {
    displayHeader();

    const config = {
        sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
        sparqlAuth: { user: 'admin', password: 'admin123' },
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',  // Use test graph where corpuscles exist
        timeout: 30000
    };

    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('Wikipedia Graph:')} ${chalk.white(config.wikipediaGraphURI)}`);
    console.log('');

    try {
        const adder = new WikipediaEmbeddingAdder(config);
        await adder.initialize();

        const result = await adder.addEmbeddings();

        if (result.success) {
            console.log('');
            console.log(chalk.bold.green('✅ Wikipedia Embedding Generation Completed!'));
            console.log('');
            
            const stats = result.statistics;
            console.log(chalk.bold.cyan('📊 Results Summary:'));
            console.log(`   ${chalk.cyan('Corpuscles Processed:')} ${chalk.white(stats.corpusclesProcessed)}`);
            console.log(`   ${chalk.cyan('Embeddings Generated:')} ${chalk.white(stats.embeddingsGenerated)}`);
            console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.white(stats.successRate + '%')}`);
            console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((stats.processingTimeMs / 1000).toFixed(2) + 's')}`);
            
            if (stats.errors.length > 0) {
                console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(stats.errors.length)}`);
                stats.errors.forEach(error => {
                    console.log(`     ${chalk.red('•')} ${error}`);
                });
            }
            
        } else {
            console.log(chalk.bold.red('❌ Failed to add embeddings:'));
            console.log(chalk.red(result.error));
        }

    } catch (error) {
        console.log(chalk.bold.red('❌ Process failed:'));
        console.log(chalk.red(error.message));
    }
}

addWikipediaEmbeddings().catch(console.error);