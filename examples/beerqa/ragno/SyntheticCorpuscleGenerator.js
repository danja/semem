#!/usr/bin/env node

/**
 * SyntheticCorpuscleGenerator.js - Generate Synthetic Wikipedia Content for BeerQA
 * 
 * This script addresses the missing Wikipedia content by generating synthetic
 * corpuscles that represent the "answer space" for BeerQA questions. Since the
 * current data only contains questions without corresponding Wikipedia content,
 * this creates a synthetic knowledge base to enable proper graph analytics.
 * 
 * Key Features:
 * - Generates topic-based synthetic Wikipedia-style content
 * - Creates embeddings for synthetic content using LLM services
 * - Establishes diverse content categories matching question domains
 * - Provides realistic text content for graph analytics testing
 * - Enables the full NodeRAG pipeline to function with proper target content
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import MemoryManager from '../../../src/MemoryManager.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📖 SYNTHETIC CORPUSCLE GENERATOR               ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Generate synthetic Wikipedia-style content for testing    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * SyntheticCorpuscleGenerator class for creating synthetic Wikipedia content
 */
class SyntheticCorpuscleGenerator {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            
            // Content generation options
            numberOfCorpuscles: options.numberOfCorpuscles || 50,
            contentLength: options.contentLength || 500,
            generateEmbeddings: options.generateEmbeddings !== false,
            topicDiversity: options.topicDiversity || 10,
            
            // LLM options
            llmProvider: options.llmProvider || 'ollama',
            embeddingModel: options.embeddingModel || 'nomic-embed-text',
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            syntheticCorpusclesGenerated: 0,
            embeddingsGenerated: 0,
            topicsCreated: 0,
            processingTime: 0,
            errors: []
        };

        // Predefined topics for synthetic content
        this.contentTopics = [
            {
                topic: 'Biology and Botany',
                keywords: ['plants', 'species', 'taxonomy', 'botanical', 'classification'],
                content: 'Botanical classification systems organize plant species based on their evolutionary relationships and morphological characteristics.'
            },
            {
                topic: 'Politics and Government',
                keywords: ['parliament', 'vote', 'government', 'democracy', 'legislation'],
                content: 'Parliamentary systems require specific voting procedures to pass legislation and make governmental decisions.'
            },
            {
                topic: 'History and Culture',
                keywords: ['historical', 'culture', 'tradition', 'heritage', 'society'],
                content: 'Cultural heritage represents the traditions and practices that societies pass down through generations.'
            },
            {
                topic: 'Technology and Broadcasting',
                keywords: ['transmitter', 'broadcasting', 'radio', 'television', 'communications'],
                content: 'Broadcasting technology enables the transmission of audio and video signals across vast distances.'
            },
            {
                topic: 'Physics and Science',
                keywords: ['physics', 'effect', 'discovery', 'scientist', 'experiment'],
                content: 'Scientific discoveries often involve the identification of new physical phenomena and their underlying principles.'
            },
            {
                topic: 'Literature and Publishing',
                keywords: ['publication', 'book', 'writing', 'author', 'literature'],
                content: 'Literary works represent significant contributions to human knowledge and cultural understanding.'
            },
            {
                topic: 'Economics and Resources',
                keywords: ['resources', 'consumption', 'energy', 'economics', 'sustainability'],
                content: 'Resource management involves balancing consumption patterns with sustainable development goals.'
            },
            {
                topic: 'Sports and Entertainment',
                keywords: ['sports', 'competition', 'athlete', 'tournament', 'performance'],
                content: 'Athletic competitions showcase human physical capabilities and competitive strategies.'
            },
            {
                topic: 'Arts and Music',
                keywords: ['composer', 'music', 'artistic', 'creative', 'performance'],
                content: 'Musical composition represents the artistic expression of cultural themes and emotional experiences.'
            },
            {
                topic: 'General Knowledge',
                keywords: ['knowledge', 'information', 'facts', 'data', 'learning'],
                content: 'General knowledge encompasses the broad range of information that forms the basis of educational understanding.'
            }
        ];
    }

    /**
     * Generate synthetic corpuscles for Wikipedia content
     * @returns {Object} Generation results
     */
    async generateSyntheticCorpuscles() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting synthetic corpuscle generation...'));

        try {
            // Phase 1: Initialize LLM services
            console.log(chalk.white('🤖 Phase 1: Initializing LLM services...'));
            const memoryManager = await this.initializeLLMServices();

            // Phase 2: Generate synthetic content
            console.log(chalk.white('📝 Phase 2: Generating synthetic content...'));
            const syntheticContent = await this.generateTopicBasedContent();

            // Phase 3: Generate embeddings
            if (this.options.generateEmbeddings && memoryManager) {
                console.log(chalk.white('🧠 Phase 3: Generating embeddings...'));
                await this.generateContentEmbeddings(syntheticContent, memoryManager);
            }

            // Phase 4: Export to SPARQL store
            console.log(chalk.white('💾 Phase 4: Exporting synthetic corpuscles...'));
            await this.exportSyntheticCorpuscles(syntheticContent);

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Synthetic corpuscle generation completed successfully'));
            this.displayResults();

            return {
                success: true,
                syntheticCorpuscles: syntheticContent,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Synthetic corpuscle generation failed: ${error.message}`);
            console.log(chalk.red('❌ Synthetic corpuscle generation failed:', error.message));
            throw error;
        }
    }

    /**
     * Initialize LLM services for embedding generation
     * @returns {MemoryManager} Memory manager instance
     */
    async initializeLLMServices() {
        try {
            console.log(chalk.gray('   Initializing LLM services...'));
            
            const config = new Config();
            await config.initialize();
            
            const memoryManager = new MemoryManager(config);
            await memoryManager.initialize();
            
            console.log(chalk.gray('   ✓ LLM services initialized'));
            return memoryManager;
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Could not initialize LLM services: ${error.message}`));
            return null;
        }
    }

    /**
     * Generate topic-based synthetic content
     * @returns {Array} Synthetic content items
     */
    async generateTopicBasedContent() {
        console.log(chalk.gray('   Generating topic-based synthetic content...'));
        
        const syntheticContent = [];
        const corpusclesPerTopic = Math.ceil(this.options.numberOfCorpuscles / this.contentTopics.length);

        for (let topicIndex = 0; topicIndex < this.contentTopics.length; topicIndex++) {
            const topic = this.contentTopics[topicIndex];
            
            for (let i = 0; i < corpusclesPerTopic && syntheticContent.length < this.options.numberOfCorpuscles; i++) {
                const corpuscleContent = this.generateTopicContent(topic, i + 1);
                const corpuscleURI = `http://purl.org/stuff/wikipedia/test/corpuscle/synthetic_${topic.topic.toLowerCase().replace(/\s+/g, '_')}_${i + 1}`;
                
                syntheticContent.push({
                    corpuscleURI: corpuscleURI,
                    corpuscleText: corpuscleContent,
                    corpuscleType: 'wikipedia-content',
                    topic: topic.topic,
                    keywords: topic.keywords,
                    embedding: null // Will be generated later if enabled
                });

                this.stats.syntheticCorpusclesGenerated++;
            }

            this.stats.topicsCreated++;
            console.log(chalk.gray(`   ✓ Topic ${topicIndex + 1}/${this.contentTopics.length}: ${topic.topic} (${corpusclesPerTopic} corpuscles)`));
        }

        console.log(chalk.gray(`   ✓ Generated ${syntheticContent.length} synthetic corpuscles`));
        return syntheticContent;
    }

    /**
     * Generate content for a specific topic
     * @param {Object} topic - Topic configuration
     * @param {number} index - Content index
     * @returns {string} Generated content
     */
    generateTopicContent(topic, index) {
        const variations = [
            `${topic.content} This field encompasses research into ${topic.keywords.join(', ')} and their applications in modern contexts. Understanding these concepts is essential for advancing knowledge in this domain.`,
            
            `Research in ${topic.topic.toLowerCase()} has revealed important insights about ${topic.keywords[0]} and ${topic.keywords[1]}. ${topic.content} Current studies focus on the relationship between ${topic.keywords[2] || topic.keywords[0]} and practical applications.`,
            
            `The study of ${topic.keywords.join(' and ')} has contributed significantly to our understanding of ${topic.topic.toLowerCase()}. ${topic.content} Modern approaches to this field continue to evolve with new research methodologies.`,
            
            `${topic.content} Experts in ${topic.topic.toLowerCase()} examine how ${topic.keywords[0]} influences ${topic.keywords[1] || 'related phenomena'}. This research area combines theoretical knowledge with practical applications in ${topic.keywords[2] || 'various contexts'}.`,
            
            `In the field of ${topic.topic.toLowerCase()}, researchers investigate the complex relationships between ${topic.keywords.slice(0, 3).join(', ')}. ${topic.content} These studies provide valuable insights for both academic and practical purposes.`
        ];

        const selectedVariation = variations[index % variations.length];
        
        // Add some randomization to make each corpuscle unique
        const additionalInfo = [
            'This knowledge forms the foundation for advanced research and development.',
            'Contemporary applications of these principles continue to emerge in various fields.',
            'Historical perspectives on this topic provide context for modern understanding.',
            'Interdisciplinary approaches have enhanced our comprehension of these concepts.',
            'Future research directions promise to expand our knowledge even further.'
        ];

        const additional = additionalInfo[index % additionalInfo.length];
        
        return `${selectedVariation} ${additional}`.substring(0, this.options.contentLength);
    }

    /**
     * Generate embeddings for synthetic content
     * @param {Array} syntheticContent - Synthetic content items
     * @param {MemoryManager} memoryManager - Memory manager instance
     */
    async generateContentEmbeddings(syntheticContent, memoryManager) {
        console.log(chalk.gray('   Generating embeddings for synthetic content...'));
        
        for (let i = 0; i < syntheticContent.length; i++) {
            const content = syntheticContent[i];
            
            try {
                const embedding = await memoryManager.embeddingHandler.generateEmbedding(content.corpuscleText);
                content.embedding = embedding;
                this.stats.embeddingsGenerated++;
                
                if ((i + 1) % 10 === 0) {
                    console.log(chalk.gray(`   ✓ Generated embeddings for ${i + 1}/${syntheticContent.length} corpuscles`));
                }
                
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Failed to generate embedding for corpuscle ${i + 1}: ${error.message}`));
                this.stats.errors.push(`Embedding generation failed for corpuscle ${i + 1}: ${error.message}`);
            }
        }

        console.log(chalk.gray(`   ✓ Generated ${this.stats.embeddingsGenerated} embeddings`));
    }

    /**
     * Export synthetic corpuscles to SPARQL store
     * @param {Array} syntheticContent - Synthetic content items
     */
    async exportSyntheticCorpuscles(syntheticContent) {
        console.log(chalk.gray(`   Exporting ${syntheticContent.length} synthetic corpuscles...`));
        
        const timestamp = new Date().toISOString();
        const batchSize = 10;
        let exported = 0;

        try {
            for (let i = 0; i < syntheticContent.length; i += batchSize) {
                const batch = syntheticContent.slice(i, i + batchSize);
                const triples = [];

                for (const content of batch) {
                    // Create corpuscle node
                    triples.push(`<${content.corpuscleURI}> rdf:type ragno:Corpuscle .`);
                    triples.push(`<${content.corpuscleURI}> rdfs:label "${content.corpuscleText.replace(/"/g, '\\"')}" .`);
                    triples.push(`<${content.corpuscleURI}> ragno:corpuscleType "${content.corpuscleType}" .`);
                    triples.push(`<${content.corpuscleURI}> ragno:topic "${content.topic}" .`);
                    triples.push(`<${content.corpuscleURI}> ragno:keywords "${content.keywords.join(', ')}" .`);
                    triples.push(`<${content.corpuscleURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    triples.push(`<${content.corpuscleURI}> prov:wasGeneratedBy "synthetic-corpuscle-generator" .`);
                    
                    // Add embedding if available
                    if (content.embedding) {
                        triples.push(`<${content.corpuscleURI}> ragno:hasEmbedding "${JSON.stringify(content.embedding)}" .`);
                    }
                }

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
                    exported += batch.length;
                    console.log(chalk.gray(`   ✓ Exported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(syntheticContent.length / batchSize)} (${exported}/${syntheticContent.length})`));
                } else {
                    this.stats.errors.push(`Failed to export batch: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export batch: ${result.error}`));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(chalk.gray(`   ✅ Successfully exported ${exported} synthetic corpuscles`));

        } catch (error) {
            this.stats.errors.push(`Corpuscle export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Corpuscle export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display generation results
     */
    displayResults() {
        console.log('');
        console.log(chalk.bold.white('📊 Synthetic Corpuscle Generation Results:'));
        console.log(`   ${chalk.cyan('Synthetic Corpuscles Generated:')} ${chalk.white(this.stats.syntheticCorpusclesGenerated)}`);
        console.log(`   ${chalk.cyan('Embeddings Generated:')} ${chalk.white(this.stats.embeddingsGenerated)}`);
        console.log(`   ${chalk.cyan('Topics Created:')} ${chalk.white(this.stats.topicsCreated)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display topic distribution
        if (this.stats.topicsCreated > 0) {
            console.log(chalk.bold.white('📚 Topic Distribution:'));
            this.contentTopics.slice(0, this.stats.topicsCreated).forEach((topic, index) => {
                const corpusclesPerTopic = Math.ceil(this.options.numberOfCorpuscles / this.contentTopics.length);
                console.log(`   ${chalk.cyan(`${index + 1}.`)} ${chalk.white(topic.topic)}: ${chalk.white(Math.min(corpusclesPerTopic, this.options.numberOfCorpuscles - index * corpusclesPerTopic))} corpuscles`);
            });
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function generateSyntheticCorpuscles() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            
            // Content generation options
            numberOfCorpuscles: 50,
            contentLength: 500,
            generateEmbeddings: true,
            topicDiversity: 10,
            
            // LLM options
            llmProvider: 'ollama',
            embeddingModel: 'nomic-embed-text'
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Number of Corpuscles:')} ${chalk.white(config.numberOfCorpuscles)}`);
        console.log(`   ${chalk.cyan('Content Length:')} ${chalk.white(config.contentLength)} characters`);
        console.log(`   ${chalk.cyan('Generate Embeddings:')} ${chalk.white(config.generateEmbeddings ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Topic Diversity:')} ${chalk.white(config.topicDiversity)}`);
        console.log(`   ${chalk.cyan('LLM Provider:')} ${chalk.white(config.llmProvider)}`);
        console.log(`   ${chalk.cyan('Embedding Model:')} ${chalk.white(config.embeddingModel)}`);
        console.log('');

        const generator = new SyntheticCorpuscleGenerator(config);
        const result = await generator.generateSyntheticCorpuscles();

        if (result.success) {
            console.log(chalk.green('🎉 Synthetic corpuscle generation completed successfully!'));
            console.log(chalk.white(`Generated ${result.statistics.syntheticCorpusclesGenerated} synthetic Wikipedia-style corpuscles with ${result.statistics.embeddingsGenerated} embeddings.`));
            console.log(chalk.white('The BeerQA system now has proper target content for relationship building and graph analytics.'));
        } else {
            console.log(chalk.yellow('⚠️  Synthetic corpuscle generation completed with issues'));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Synthetic corpuscle generation failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { SyntheticCorpuscleGenerator };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateSyntheticCorpuscles().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}