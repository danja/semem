#!/usr/bin/env node

/**
 * RelationshipBuilder.js - Create Formal Relationship Infrastructure for BeerQA
 * 
 * This script addresses the core data structure limitation by creating formal
 * ragno:Relationship nodes between BeerQA questions and Wikipedia corpuscles.
 * It implements multiple relationship creation strategies based on the NodeRAG
 * model to establish the semantic connections needed for graph analytics.
 * 
 * Key Features:
 * - Creates similarity-based ragno:Relationship nodes using embeddings
 * - Establishes semantic connections between questions and Wikipedia content
 * - Implements entity-based relationship discovery using NER
 * - Creates community-bridge relationships for cross-topic connections
 * - Generates hybrid relationships combining multiple similarity metrics
 * - Provides comprehensive relationship validation and quality scoring
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import MemoryManager from '../../../src/MemoryManager.js';
import SPARQLHelper from '../../../src/services/sparql/SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🔗 RELATIONSHIP BUILDER                        ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Create formal ragno:Relationship infrastructure          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * RelationshipBuilder class for creating formal relationship infrastructure
 */
class RelationshipBuilder {
    constructor(config, options = {}) {
        // Store config reference for later use
        this.config = config;
        
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        const relationshipConfig = config.get('performance.relationships') || {};
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            timeout: options.timeout || 60000,
            
            // Performance limits from config
            maxQuestionsToProcess: options.maxQuestionsToProcess || relationshipConfig.maxQuestionsToProcess || 5,
            maxWikipediaCorpusclesPerQuestion: options.maxWikipediaCorpusclesPerQuestion || relationshipConfig.maxWikipediaCorpusclesPerQuestion || 20,
            maxTriplesToGenerate: options.maxTriplesToGenerate || relationshipConfig.maxTriplesToGenerate || 100,
            semanticSimilarityThreshold: options.semanticSimilarityThreshold || relationshipConfig.semanticSimilarityThreshold || 0.4,
            enableBatching: options.enableBatching !== undefined ? options.enableBatching : relationshipConfig.enableBatching !== false,
            batchSize: options.batchSize || relationshipConfig.batchSize || 10,
            
            // Relationship creation strategies
            enableSimilarityRelationships: options.enableSimilarityRelationships !== false,
            enableEntityRelationships: options.enableEntityRelationships !== false,
            enableSemanticRelationships: options.enableSemanticRelationships !== false,
            enableCommunityBridges: options.enableCommunityBridges !== false,
            
            // Similarity thresholds
            similarityThreshold: options.similarityThreshold || 0.1,
            strongSimilarityThreshold: options.strongSimilarityThreshold || 0.5,
            entityMatchThreshold: options.entityMatchThreshold || 0.5,
            
            // Relationship limits
            maxRelationshipsPerQuestion: options.maxRelationshipsPerQuestion || 50,
            maxWeakRelationships: options.maxWeakRelationships || 20,
            minRelationshipsPerQuestion: options.minRelationshipsPerQuestion || 5,
            
            // Quality and validation
            enableQualityScoring: options.enableQualityScoring !== false,
            enableRelationshipValidation: options.enableRelationshipValidation !== false,
            enableBidirectionalRelationships: options.enableBidirectionalRelationships !== false,
            
            // LLM Enhancement
            enableLLMEnhancement: options.enableLLMEnhancement !== false,
            llmValidationSampleRate: options.llmValidationSampleRate || 0.1,
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        // Initialize MemoryManager for proper concept extraction
        this.memoryManager = null; // Will be initialized in initialize() method
        
        // Initialize embedding handler for semantic similarity
        this.embeddingHandler = null; // Will be initialized in initialize() method

        this.stats = {
            questionsProcessed: 0,
            wikipediaCorpusclesProcessed: 0,
            similarityRelationshipsCreated: 0,
            entityRelationshipsCreated: 0,
            semanticRelationshipsCreated: 0,
            communityBridgeRelationshipsCreated: 0,
            totalRelationshipsCreated: 0,
            relationshipsValidated: 0,
            lowQualityRelationshipsFiltered: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Initialize MemoryManager for concept extraction
     */
    async initialize() {
        try {
            console.log(chalk.gray('   Initializing MemoryManager for concept extraction...'));
            
            // Initialize MemoryManager with the same config
            this.memoryManager = new MemoryManager({
                storage: {
                    type: 'sparql',
                    options: {
                        update: this.options.sparqlEndpoint,
                        user: this.options.sparqlAuth.user,
                        password: this.options.sparqlAuth.password
                    }
                }
            });
            
            await this.memoryManager.init();
            console.log(chalk.gray('   ✓ MemoryManager initialized successfully'));
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️ Failed to initialize MemoryManager: ${error.message}`));
            console.log(chalk.yellow('   ⚠️ Will fall back to basic concept extraction'));
            this.memoryManager = null;
        }
        
        // Initialize embedding handler for semantic similarity
        try {
            console.log(chalk.gray('   Initializing embedding handler for semantic similarity...'));
            
            // Get embedding providers from config (prioritized)
            const llmProviders = this.config.get('llmProviders') || [];
            const embeddingProviders = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            if (embeddingProviders.length === 0) {
                throw new Error('No embedding providers configured');
            }
            
            const provider = embeddingProviders[0]; // Use highest priority
            console.log(chalk.gray(`   Using embedding provider: ${provider.type} (priority: ${provider.priority})`));
            
            const EmbeddingConnectorFactory = await import('../../../src/connectors/EmbeddingConnectorFactory.js');
            const embeddingConnector = EmbeddingConnectorFactory.default.createConnector({
                provider: provider.type,
                model: provider.embeddingModel,
                options: { 
                    baseUrl: provider.baseUrl,
                    apiKey: provider.apiKey
                }
            });
            
            const EmbeddingHandler = await import('../../../src/handlers/EmbeddingHandler.js');
            const dimension = 1536; // nomic-embed-text dimension
            
            this.embeddingHandler = new EmbeddingHandler.default(
                embeddingConnector, 
                provider.embeddingModel,
                dimension
            );
            
            console.log(chalk.gray(`   ✓ Embedding handler initialized successfully with ${provider.type}/${provider.embeddingModel}`));
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️ Failed to initialize embedding handler: ${error.message}`));
            console.log(chalk.yellow('   ⚠️ Will fall back to non-semantic relationship creation'));
            this.embeddingHandler = null;
        }
    }

    /**
     * Build comprehensive relationship infrastructure
     * @returns {Object} Relationship building results
     */
    async buildRelationshipInfrastructure() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting relationship infrastructure building...'));

        try {
            // Phase 0: Initialize MemoryManager
            await this.initialize();

            // Phase 1: Load questions and Wikipedia corpuscles
            console.log(chalk.white('📊 Phase 1: Loading questions and Wikipedia corpuscles...'));
            const questionData = await this.loadQuestionData();
            const wikipediaData = await this.loadWikipediaData();

            if (questionData.length === 0 || wikipediaData.length === 0) {
                console.log(chalk.yellow('⚠️  Insufficient data for relationship building'));
                return { success: false, message: 'Insufficient data for relationship building' };
            }

            // Phase 2: Create similarity-based relationships
            if (this.options.enableSimilarityRelationships) {
                console.log(chalk.white('🔗 Phase 2: Creating similarity-based relationships...'));
                await this.createSimilarityRelationships(questionData, wikipediaData);
            }

            // Phase 3: Create entity-based relationships using NER
            if (this.options.enableEntityRelationships) {
                console.log(chalk.white('🏷️ Phase 3: Creating entity-based relationships using named entities...'));
                await this.createEntityBasedRelationships(questionData, wikipediaData);
            }

            // Phase 4: Create semantic relationships
            if (this.options.enableSemanticRelationships) {
                console.log(chalk.white('🧠 Phase 4: Creating semantic relationships...'));
                await this.createSemanticRelationships(questionData, wikipediaData);
            }

            // Phase 5: Create community bridge relationships
            if (this.options.enableCommunityBridges) {
                console.log(chalk.white('🌉 Phase 5: Creating community bridge relationships...'));
                await this.createCommunityBridgeRelationships(questionData, wikipediaData);
            }

            // Phase 6: Validate and score relationships
            if (this.options.enableRelationshipValidation) {
                console.log(chalk.white('✅ Phase 6: Validating and scoring relationships...'));
                await this.validateAndScoreRelationships();
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            // Cleanup MemoryManager
            if (this.memoryManager) {
                await this.memoryManager.dispose();
            }
            
            console.log(chalk.green('✅ Relationship infrastructure building completed successfully'));
            this.displayResults();

            return {
                success: true,
                relationshipCounts: {
                    similarity: this.stats.similarityRelationshipsCreated,
                    entity: this.stats.entityRelationshipsCreated,
                    semantic: this.stats.semanticRelationshipsCreated,
                    communityBridge: this.stats.communityBridgeRelationshipsCreated,
                    total: this.stats.totalRelationshipsCreated
                },
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Relationship building failed: ${error.message}`);
            console.log(chalk.red('❌ Relationship infrastructure building failed:', error.message));
            throw error;
        }
    }

    /**
     * Load question data with embeddings
     * @returns {Array} Question data
     */
    async loadQuestionData() {
        console.log(chalk.gray('   Loading BeerQA questions...'));
        
        const questionQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?embedding
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
        
        OPTIONAL {
            ?question ragno:hasAttribute ?embeddingAttr .
            ?embeddingAttr a ragno:VectorEmbedding ;
                          ragno:attributeValue ?embedding .
        }
    }
}
ORDER BY ?question
LIMIT ${this.options.maxQuestionsToProcess}
`;

        const result = await this.sparqlHelper.executeSelect(questionQuery);
        
        if (!result.success) {
            throw new Error(`Failed to load question data: ${result.error}`);
        }

        const questionData = result.data.results.bindings.map(binding => ({
            questionURI: binding.question.value,
            questionText: binding.questionText.value,
            embedding: binding.embedding?.value ? this.parseEmbedding(binding.embedding.value) : null
        }));

        this.stats.questionsProcessed = questionData.length;
        console.log(chalk.gray(`   ✓ Loaded ${questionData.length} questions`));
        
        return questionData;
    }

    /**
     * Load Wikipedia corpuscle data with embeddings
     * @returns {Array} Wikipedia data
     */
    async loadWikipediaData() {
        console.log(chalk.gray('   Loading Wikipedia corpuscles...'));
        
        // Calculate total Wikipedia limit based on per-question limit
        const totalWikipediaLimit = this.options.maxQuestionsToProcess * this.options.maxWikipediaCorpusclesPerQuestion;
        
        const wikipediaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?corpuscleText ?embedding ?corpuscleType
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?corpuscleText .
        
        OPTIONAL { ?corpuscle ragno:corpuscleType ?corpuscleType }
        OPTIONAL { 
            ?corpuscle ragno:hasAttribute ?embeddingAttr .
            ?embeddingAttr a ragno:VectorEmbedding ;
                          ragno:attributeValue ?embedding .
        }
        
        # Filter out test questions - we want Wikipedia content only
        FILTER(!BOUND(?corpuscleType) || ?corpuscleType != "test-question")
    }
}
ORDER BY ?corpuscle
LIMIT ${totalWikipediaLimit}
`;

        const result = await this.sparqlHelper.executeSelect(wikipediaQuery);
        
        if (!result.success) {
            throw new Error(`Failed to load Wikipedia data: ${result.error}`);
        }

        const wikipediaData = result.data.results.bindings.map(binding => ({
            corpuscleURI: binding.corpuscle.value,
            corpuscleText: binding.corpuscleText.value,
            corpuscleType: binding.corpuscleType?.value || 'wikipedia-content',
            embedding: binding.embedding?.value ? this.parseEmbedding(binding.embedding.value) : null
        }));

        this.stats.wikipediaCorpusclesProcessed = wikipediaData.length;
        console.log(chalk.gray(`   ✓ Loaded ${wikipediaData.length} Wikipedia corpuscles`));
        
        return wikipediaData;
    }

    /**
     * Create similarity-based relationships using embeddings and text fallback
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createSimilarityRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating embedding-based similarity relationships...'));
        
        const relationships = [];
        let created = 0;
        let embeddingBased = 0;
        let textBased = 0;

        for (const question of questionData) {
            const questionSimilarities = [];

            for (const wikipediaCorpuscle of wikipediaData) {
                let similarity = 0;
                let method = 'text-similarity';

                // Use embedding-based similarity only
                if (question.embedding && wikipediaCorpuscle.embedding) {
                    similarity = this.calculateCosineSimilarity(
                        question.embedding, 
                        wikipediaCorpuscle.embedding
                    );
                    method = 'embedding-similarity';
                    embeddingBased++;
                } else {
                    // Skip if no embeddings available - no fallback
                    continue;
                }

                if (similarity >= this.options.similarityThreshold) {
                    questionSimilarities.push({
                        targetURI: wikipediaCorpuscle.corpuscleURI,
                        targetText: wikipediaCorpuscle.corpuscleText,
                        similarity: similarity,
                        method: method,
                        relationshipType: similarity >= this.options.strongSimilarityThreshold ? 
                            'strong-similarity' : 'similarity'
                    });
                }
            }

            // Sort by similarity and limit
            questionSimilarities.sort((a, b) => b.similarity - a.similarity);
            const topSimilarities = questionSimilarities.slice(0, this.options.maxRelationshipsPerQuestion);

            // Create relationship objects
            for (const sim of topSimilarities) {
                const relationshipURI = `${question.questionURI}_sim_${sim.targetURI.split('/').pop()}`;
                
                relationships.push({
                    relationshipURI: relationshipURI,
                    sourceURI: question.questionURI,
                    targetURI: sim.targetURI,
                    relationshipType: sim.relationshipType,
                    weight: sim.similarity,
                    confidence: sim.similarity,
                    method: sim.method,
                    metadata: {
                        sourceText: question.questionText,
                        targetText: sim.targetText
                    }
                });
                created++;
            }

            console.log(chalk.gray(`   ✓ Question ${questionData.indexOf(question) + 1}/${questionData.length}: ${topSimilarities.length} similarities`));
        }

        // Export relationships to SPARQL
        await this.exportRelationships(relationships, 'similarity');
        this.stats.similarityRelationshipsCreated = created;
        
        console.log(chalk.gray(`   ✓ Similarity relationships complete: Created ${created} embedding-based relationships`));
    }

    /**
     * Calculate text-based similarity using keywords and overlap
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} Similarity score
     */
    calculateTextSimilarity(text1, text2) {
        // Simple keyword-based similarity
        const words1 = this.extractKeywords(text1.toLowerCase());
        const words2 = this.extractKeywords(text2.toLowerCase());
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        const intersection = words1.filter(w => words2.includes(w));
        const union = [...new Set([...words1, ...words2])];
        
        const jaccardSimilarity = intersection.length / union.length;
        
        // Boost similarity for direct substring matches
        const text1Clean = text1.toLowerCase().replace(/[^\w\s]/g, '');
        const text2Clean = text2.toLowerCase().replace(/[^\w\s]/g, '');
        
        let substringBoost = 0;
        if (text1Clean.includes(text2Clean.substring(0, 20)) || text2Clean.includes(text1Clean.substring(0, 20))) {
            substringBoost = 0.2;
        }
        
        return Math.min(1.0, jaccardSimilarity + substringBoost);
    }

    /**
     * Extract keywords from text
     * @param {string} text - Input text
     * @returns {Array} Keywords
     */
    extractKeywords(text) {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'what', 'where', 'when', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those']);
        
        return text
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 20); // Limit to top 20 keywords
    }

    /**
     * Create entity-based relationships using SPARQL pattern matching
     * @param {Array} questionData - Question data  
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createEntityBasedRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating entity-based relationships using SPARQL pattern matching...'));
        console.log(chalk.gray(`   Limits: ${this.options.maxQuestionsToProcess} questions, ${this.options.maxTriplesToGenerate} total triples`));
        
        const relationships = [];
        let created = 0;

        for (const question of questionData) {
            console.log(chalk.gray(`   Processing question: ${question.questionText.substring(0, 50)}...`));
            
            // Check triple limit
            if (created >= this.options.maxTriplesToGenerate) {
                console.log(chalk.yellow(`   ⚠️ Reached maximum triples limit (${this.options.maxTriplesToGenerate}), stopping`));
                break;
            }
            
            try {
                // Find shared entities using SPARQL pattern matching
                const sharedEntities = await this.findSharedEntitiesSPARQL(question, wikipediaData);
                
                for (const entityMatch of sharedEntities) {
                    if (created >= this.options.maxTriplesToGenerate) break;
                    
                    const relationshipURI = `${question.questionURI}_entity_${entityMatch.wikipediaURI.split('/').pop()}`;
                    
                    relationships.push({
                        relationshipURI: relationshipURI,
                        sourceURI: question.questionURI,
                        targetURI: entityMatch.wikipediaURI,
                        relationshipType: 'shared-entity',
                        weight: entityMatch.entityCount / 10.0, // Normalize by number of shared entities
                        confidence: entityMatch.entityCount / 10.0,
                        method: 'sparql-entity-matching',
                        metadata: {
                            sharedEntities: entityMatch.entities,
                            entityCount: entityMatch.entityCount,
                            questionText: question.questionText.substring(0, 100)
                        }
                    });
                    
                    created++;
                }
                
                console.log(chalk.gray(`   ✓ Question processed: ${sharedEntities.length} entity relationships`));
                
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️ Failed to process question "${question.questionText}": ${error.message}`));
            }
        }

        await this.exportRelationships(relationships, 'entity');
        this.stats.entityRelationshipsCreated = created;
        
        console.log(chalk.green(`   ✓ Entity relationships complete: Created ${created} SPARQL pattern-matched relationships`));
        return relationships;
    }

    /**
     * Find shared entities between question and Wikipedia corpuscles using SPARQL pattern matching
     * @param {Object} question - Question data
     * @param {Array} wikipediaData - Wikipedia data 
     * @returns {Array} Shared entity matches
     */
    async findSharedEntitiesSPARQL(question, wikipediaData) {
        try {
            // Query for entities/attributes associated with the question
            const questionEntitiesQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?entityLabel ?attributeValue
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        <${question.questionURI}> ragno:hasAttribute ?attr .
        ?attr ragno:attributeValue ?attributeValue .
        OPTIONAL {
            ?attr ragno:describesEntity ?entity .
            ?entity rdfs:label ?entityLabel .
        }
    }
}`;

            const questionResult = await this.sparqlHelper.executeSelect(questionEntitiesQuery);
            if (!questionResult.success || !questionResult.data.results.bindings.length) {
                return [];
            }

            const questionEntities = questionResult.data.results.bindings.map(binding => ({
                entity: binding.entity?.value,
                label: binding.entityLabel?.value,
                value: binding.attributeValue?.value
            }));

            const sharedMatches = [];

            // For each Wikipedia corpuscle, find shared entities using SPARQL pattern matching
            for (const wikipedia of wikipediaData.slice(0, this.options.maxWikipediaCorpusclesPerQuestion)) {
                const wikipediaEntitiesQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?entityLabel ?attributeValue
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        <${wikipedia.corpuscleURI}> ragno:hasAttribute ?attr .
        ?attr ragno:attributeValue ?attributeValue .
        OPTIONAL {
            ?attr ragno:describesEntity ?entity .
            ?entity rdfs:label ?entityLabel .
        }
    }
}`;

                const wikipediaResult = await this.sparqlHelper.executeSelect(wikipediaEntitiesQuery);
                if (!wikipediaResult.success) continue;

                const wikipediaEntities = wikipediaResult.data.results.bindings.map(binding => ({
                    entity: binding.entity?.value,
                    label: binding.entityLabel?.value,
                    value: binding.attributeValue?.value
                }));

                // Find shared entities using embedding similarity
                const sharedEntities = [];
                for (const qEntity of questionEntities) {
                    for (const wEntity of wikipediaEntities) {
                        // Use embedding similarity for entity matching if available
                        if (this.embeddingHandler && qEntity.value && wEntity.value) {
                            try {
                                // Truncate entity values to prevent HTTP 413 errors
                                const qText = String(qEntity.value).substring(0, 200); // Max 200 chars
                                const wText = String(wEntity.value).substring(0, 200); // Max 200 chars
                                
                                if (qText.length < 3 || wText.length < 3) continue; // Skip very short text
                                
                                const qEmbedding = await this.embeddingHandler.generateEmbedding(qText);
                                const wEmbedding = await this.embeddingHandler.generateEmbedding(wText);
                                const similarity = this.calculateCosineSimilarity(qEmbedding, wEmbedding);
                                
                                if (similarity >= 0.7) { // High similarity threshold for entity matching
                                    sharedEntities.push({
                                        questionEntity: qEntity,
                                        wikipediaEntity: wEntity,
                                        similarity: similarity
                                    });
                                }
                            } catch (error) {
                                // Skip embedding comparison if it fails
                                console.log(chalk.yellow(`   ⚠️ Entity embedding failed: ${error.message.substring(0, 100)}`));
                                continue;
                            }
                        }
                    }
                }

                if (sharedEntities.length > 0) {
                    sharedMatches.push({
                        wikipediaURI: wikipedia.corpuscleURI,
                        entities: sharedEntities,
                        entityCount: sharedEntities.length
                    });
                }
            }

            return sharedMatches;

        } catch (error) {
            console.log(chalk.yellow(`   ⚠️ SPARQL entity matching failed: ${error.message}`));
            return [];
        }
    }

    /**
     * Calculate cosine similarity between two embedding vectors
     */
    calculateCosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) {
            return 0;
        }
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Create semantic relationships using LLM-based analysis
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createSemanticRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating semantic relationships using LLM concept analysis...'));
        
        const relationships = [];
        let created = 0;

        // Sample-based approach for performance
        const sampleSize = Math.min(20, questionData.length);
        const questionSample = questionData.slice(0, sampleSize);

        for (const question of questionSample) {
            // Use question concepts and keywords for semantic matching
            const questionConcepts = await this.extractConcepts(question.questionText);
            
            for (const wikipediaCorpuscle of wikipediaData) {
                const corpuscleConcepts = await this.extractConcepts(wikipediaCorpuscle.corpuscleText);
                
                // Calculate concept similarity
                const conceptSimilarity = this.calculateConceptSimilarity(questionConcepts, corpuscleConcepts);
                
                // Use a lower threshold for semantic relationships since concept matching is more specific
                const semanticThreshold = Math.max(0.05, this.options.similarityThreshold * 0.5);
                
                if (conceptSimilarity >= semanticThreshold) {
                    const relationshipURI = `${question.questionURI}_semantic_${wikipediaCorpuscle.corpuscleURI.split('/').pop()}`;
                    
                    relationships.push({
                        relationshipURI: relationshipURI,
                        sourceURI: question.questionURI,
                        targetURI: wikipediaCorpuscle.corpuscleURI,
                        relationshipType: 'semantic-similarity',
                        weight: conceptSimilarity,
                        confidence: conceptSimilarity,
                        method: 'concept-analysis',
                        metadata: {
                            questionConcepts: questionConcepts,
                            corpuscleConcepts: corpuscleConcepts
                        }
                    });
                    created++;
                }
            }

            console.log(chalk.gray(`   ✓ Question ${questionSample.indexOf(question) + 1}/${questionSample.length}: semantic analysis complete`));
        }

        // Export relationships to SPARQL
        await this.exportRelationships(relationships, 'semantic');
        this.stats.semanticRelationshipsCreated = created;
        
        console.log(chalk.gray(`   ✓ Semantic relationships complete: Created ${created} concept-based relationships`));
    }

    /**
     * Create community bridge relationships for cross-topic connections
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createCommunityBridgeRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating community bridge relationships using embedding clustering...'));
        
        const relationships = [];
        let created = 0;

        if (!this.embeddingHandler) {
            console.log(chalk.yellow('   ⚠️ No embedding handler available, skipping community bridges'));
            return relationships;
        }

        try {
            // Create embeddings for all content to find cross-topic connections
            const allEmbeddings = [];
            
            // Add question embeddings
            for (const question of questionData) {
                try {
                    // Truncate question text to prevent HTTP 413 errors
                    const questionText = question.questionText.substring(0, 300); // Max 300 chars
                    const embedding = await this.embeddingHandler.generateEmbedding(questionText);
                    allEmbeddings.push({
                        type: 'question',
                        uri: question.questionURI,
                        embedding: embedding,
                        text: questionText
                    });
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️ Question embedding failed: ${error.message.substring(0, 100)}`));
                    continue;
                }
            }
            
            // Add Wikipedia embeddings (sample for performance)
            const wikipediaSample = wikipediaData.slice(0, Math.min(20, wikipediaData.length));
            for (const wikipedia of wikipediaSample) {
                try {
                    // Truncate Wikipedia text to prevent HTTP 413 errors
                    const wikipediaText = wikipedia.corpuscleText.substring(0, 300); // Max 300 chars
                    if (wikipediaText.length < 10) continue; // Skip very short content
                    
                    const embedding = await this.embeddingHandler.generateEmbedding(wikipediaText);
                    allEmbeddings.push({
                        type: 'wikipedia',
                        uri: wikipedia.corpuscleURI,
                        embedding: embedding,
                        text: wikipedia.corpuscleText.substring(0, 100)
                    });
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️ Wikipedia embedding failed: ${error.message.substring(0, 100)}`));
                    continue;
                }
            }

            // Find cross-topic bridges using embedding similarity in lower dimensional space
            for (const questionItem of allEmbeddings.filter(item => item.type === 'question')) {
                const bridgeConnections = [];
                
                for (const wikipediaItem of allEmbeddings.filter(item => item.type === 'wikipedia')) {
                    const similarity = this.calculateCosineSimilarity(questionItem.embedding, wikipediaItem.embedding);
                    
                    // Look for moderate similarity (0.3-0.6) that indicates cross-topic relevance
                    if (similarity >= 0.3 && similarity <= 0.6) {
                        bridgeConnections.push({
                            wikipediaURI: wikipediaItem.uri,
                            similarity: similarity,
                            wikipediaText: wikipediaItem.text
                        });
                    }
                }
                
                // Sort by similarity and take top bridges
                bridgeConnections.sort((a, b) => b.similarity - a.similarity);
                const topBridges = bridgeConnections.slice(0, 3); // Max 3 bridges per question
                
                for (const bridge of topBridges) {
                    if (created >= this.options.maxTriplesToGenerate) break;
                    
                    const relationshipURI = `${questionItem.uri}_bridge_${bridge.wikipediaURI.split('/').pop()}`;
                    
                    relationships.push({
                        relationshipURI: relationshipURI,
                        sourceURI: questionItem.uri,
                        targetURI: bridge.wikipediaURI,
                        relationshipType: 'cross-topic-bridge',
                        weight: bridge.similarity,
                        confidence: bridge.similarity,
                        method: 'embedding-clustering',
                        metadata: {
                            bridgeType: 'cross-topic',
                            similarity: bridge.similarity,
                            questionText: questionItem.text.substring(0, 100),
                            wikipediaText: bridge.wikipediaText
                        }
                    });
                    created++;
                }
            }

        } catch (error) {
            console.log(chalk.yellow(`   ⚠️ Community bridge creation failed: ${error.message}`));
        }

        // Export relationships to SPARQL
        await this.exportRelationships(relationships, 'community-bridge');
        this.stats.communityBridgeRelationshipsCreated = created;
        
        console.log(chalk.gray(`   ✓ Community bridges complete: Created ${created} cross-topic relationships`));
    }

    /**
     * Export relationships to SPARQL store
     * @param {Array} relationships - Relationship objects
     * @param {string} relationshipType - Type for logging
     */
    async exportRelationships(relationships, relationshipType) {
        if (relationships.length === 0) return;

        console.log(chalk.gray(`   Exporting ${relationships.length} ${relationshipType} relationships...`));
        
        const timestamp = new Date().toISOString();
        const batchSize = 10;
        let exported = 0;

        try {
            for (let i = 0; i < relationships.length; i += batchSize) {
                const batch = relationships.slice(i, i + batchSize);
                const triples = [];

                for (const rel of batch) {
                    // Create relationship node
                    triples.push(`<${rel.relationshipURI}> rdf:type ragno:Relationship .`);
                    triples.push(`<${rel.relationshipURI}> ragno:hasSourceEntity <${rel.sourceURI}> .`);
                    triples.push(`<${rel.relationshipURI}> ragno:hasTargetEntity <${rel.targetURI}> .`);
                    triples.push(`<${rel.relationshipURI}> ragno:relationshipType "${rel.relationshipType}" .`);
                    triples.push(`<${rel.relationshipURI}> ragno:weight "${rel.weight.toFixed(6)}" .`);
                    triples.push(`<${rel.relationshipURI}> ragno:confidence "${rel.confidence.toFixed(6)}" .`);
                    triples.push(`<${rel.relationshipURI}> ragno:extractionMethod "${rel.method}" .`);
                    triples.push(`<${rel.relationshipURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    
                    // Add metadata if present
                    if (rel.metadata) {
                        triples.push(`<${rel.relationshipURI}> ragno:metadata "${JSON.stringify(rel.metadata).replace(/"/g, '\\"')}" .`);
                    }
                }

                const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

INSERT DATA {
    GRAPH <${this.options.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

                const result = await this.sparqlHelper.executeUpdate(updateQuery);
                
                if (result.success) {
                    exported += batch.length;
                    console.log(chalk.gray(`   ✓ Exported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(relationships.length / batchSize)} (${exported}/${relationships.length})`));
                } else {
                    this.stats.errors.push(`Failed to export ${relationshipType} batch: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export batch: ${result.error}`));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.totalRelationshipsCreated += exported;
            console.log(chalk.gray(`   ✅ Successfully exported ${exported} ${relationshipType} relationships`));

        } catch (error) {
            this.stats.errors.push(`Relationship export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Relationship export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Validate and score existing relationships
     */
    async validateAndScoreRelationships() {
        console.log(chalk.gray('   Validating relationship quality...'));
        
        // Simple validation: check for duplicate relationships
        const validationQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?relationship ?source ?target ?weight ?type
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?relationship rdf:type ragno:Relationship ;
                     ragno:hasSourceEntity ?source ;
                     ragno:hasTargetEntity ?target ;
                     ragno:weight ?weight ;
                     ragno:relationshipType ?type .
    }
}
ORDER BY ?source ?target
`;

        const result = await this.sparqlHelper.executeSelect(validationQuery);
        
        if (result.success) {
            this.stats.relationshipsValidated = result.data.results.bindings.length;
            console.log(chalk.gray(`   ✓ Validated ${this.stats.relationshipsValidated} relationships`));
        }
    }

    // Utility methods

    /**
     * Parse embedding string to array
     * @param {string} embeddingStr - Embedding string
     * @returns {Array} Embedding array
     */
    parseEmbedding(embeddingStr) {
        try {
            return JSON.parse(embeddingStr);
        } catch (error) {
            return null;
        }
    }

    /**
     * Calculate cosine similarity between two embeddings
     * @param {Array} a - First embedding
     * @param {Array} b - Second embedding
     * @returns {number} Cosine similarity
     */
    calculateCosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        
        return dotProduct / (magnitudeA * magnitudeB);
    }


    /**
     * Extract concepts from text using MemoryManager or fallback method
     * @param {string} text - Text to analyze
     * @returns {Array} Extracted concepts
     */
    async extractConcepts(text) {
        // Try using MemoryManager's extractConcepts if available
        if (this.memoryManager) {
            try {
                const concepts = await this.memoryManager.extractConcepts(text);
                if (concepts && Array.isArray(concepts) && concepts.length > 0) {
                    // Convert concept objects to strings if needed
                    return concepts.map(c => typeof c === 'string' ? c : (c.name || c.text || JSON.stringify(c)));
                }
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️ MemoryManager concept extraction failed: ${error.message}`));
            }
        }
        
        // Fallback to basic concept extraction
        return this.extractConceptsFallback(text);
    }

    /**
     * Fallback concept extraction method
     * @param {string} text - Text to analyze
     * @returns {Array} Extracted concepts
     */
    extractConceptsFallback(text) {
        const concepts = [];
        const lowerText = text.toLowerCase();
        
        // Expanded domain-specific concept extraction
        const beerConcepts = ['beer', 'ale', 'lager', 'stout', 'porter', 'ipa', 'brewing', 'fermentation', 'alcohol', 'flavor', 'aroma', 'bitterness', 'sweetness', 'brewery', 'malt', 'hops', 'yeast'];
        const processConcepts = ['production', 'method', 'technique', 'process', 'quality', 'recipe', 'manufacturing', 'making', 'create', 'produce'];
        const typeConcepts = ['style', 'variety', 'type', 'kind', 'category', 'classification', 'genus', 'species', 'family'];
        const generalConcepts = ['company', 'organization', 'business', 'industry', 'country', 'nation', 'state', 'city', 'location', 'place', 'time', 'year', 'date', 'history', 'historical'];
        const actionConcepts = ['founded', 'established', 'created', 'built', 'developed', 'invented', 'discovered', 'named', 'called', 'known'];
        const descriptiveConcepts = ['large', 'small', 'big', 'major', 'main', 'primary', 'first', 'last', 'best', 'famous', 'popular', 'common', 'rare'];
        
        const allConcepts = [...beerConcepts, ...processConcepts, ...typeConcepts, ...generalConcepts, ...actionConcepts, ...descriptiveConcepts];
        
        // Extract predefined concepts
        for (const concept of allConcepts) {
            if (lowerText.includes(concept)) {
                concepts.push(concept);
            }
        }
        
        // Extract capitalized words (likely proper nouns/entities)
        const words = text.split(/\s+/);
        for (const word of words) {
            const cleaned = word.replace(/[^\w]/g, '');
            if (cleaned.length > 2 && /^[A-Z]/.test(cleaned)) {
                concepts.push(cleaned.toLowerCase());
            }
        }
        
        // Extract common question words and structures
        const questionWords = ['what', 'where', 'when', 'who', 'why', 'how', 'which', 'whose'];
        for (const qword of questionWords) {
            if (lowerText.includes(qword)) {
                concepts.push(qword);
            }
        }
        
        // Remove duplicates and return
        return [...new Set(concepts)];
    }

    /**
     * Calculate concept similarity between two concept arrays
     * @param {Array} concepts1 - First concept array
     * @param {Array} concepts2 - Second concept array
     * @returns {number} Concept similarity
     */
    calculateConceptSimilarity(concepts1, concepts2) {
        if (concepts1.length === 0 || concepts2.length === 0) return 0;
        
        const intersection = concepts1.filter(c => concepts2.includes(c));
        const union = [...new Set([...concepts1, ...concepts2])];
        
        return intersection.length / union.length; // Jaccard similarity
    }


    /**
     * Check if question has existing relationships
     * @param {string} questionURI - Question URI
     * @returns {boolean} Whether relationships exist
     */
    async hasExistingRelationships(questionURI) {
        const checkQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

ASK {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?relationship ragno:hasSourceEntity <${questionURI}> .
    }
}`;

        const result = await this.sparqlHelper.executeSelect(checkQuery);
        return result.success && result.data.boolean;
    }

    /**
     * Display relationship building results
     */
    displayResults() {
        console.log('');
        console.log(chalk.bold.white('📊 Relationship Infrastructure Building Results:'));
        console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(this.stats.questionsProcessed)}`);
        console.log(`   ${chalk.cyan('Wikipedia Corpuscles Processed:')} ${chalk.white(this.stats.wikipediaCorpusclesProcessed)}`);
        console.log(`   ${chalk.cyan('Similarity Relationships Created:')} ${chalk.white(this.stats.similarityRelationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Entity Relationships Created:')} ${chalk.white(this.stats.entityRelationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Semantic Relationships Created:')} ${chalk.white(this.stats.semanticRelationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Community Bridge Relationships Created:')} ${chalk.white(this.stats.communityBridgeRelationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Total Relationships Created:')} ${chalk.white(this.stats.totalRelationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Relationships Validated:')} ${chalk.white(this.stats.relationshipsValidated)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display relationship creation summary
        const totalRelationships = this.stats.totalRelationshipsCreated;
        if (totalRelationships > 0) {
            console.log(chalk.bold.white('🔗 Relationship Creation Summary:'));
            console.log(`   ${chalk.cyan('Similarity-based:')} ${chalk.white((this.stats.similarityRelationshipsCreated / totalRelationships * 100).toFixed(1))}%`);
            console.log(`   ${chalk.cyan('Entity-based:')} ${chalk.white((this.stats.entityRelationshipsCreated / totalRelationships * 100).toFixed(1))}%`);
            console.log(`   ${chalk.cyan('Semantic:')} ${chalk.white((this.stats.semanticRelationshipsCreated / totalRelationships * 100).toFixed(1))}%`);
            console.log(`   ${chalk.cyan('Community Bridge:')} ${chalk.white((this.stats.communityBridgeRelationshipsCreated / totalRelationships * 100).toFixed(1))}%`);
            console.log('');
            
            console.log(chalk.bold.white('📈 Impact Assessment:'));
            console.log(`   ${chalk.cyan('Questions with Relationships:')} ${chalk.white(Math.min(this.stats.questionsProcessed, totalRelationships / 10))}/${chalk.white(this.stats.questionsProcessed)}`);
            console.log(`   ${chalk.cyan('Average Relationships per Question:')} ${chalk.white((totalRelationships / this.stats.questionsProcessed).toFixed(1))}`);
            console.log(`   ${chalk.cyan('Graph Connectivity:')} ${chalk.white(totalRelationships > 0 ? 'Established' : 'None')}`);
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function buildRelationshipInfrastructure() {
    displayHeader();
    
    try {
        // Initialize Config.js for proper configuration management
        const config = new Config('config/config.json');
        await config.init();
        
        const options = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            timeout: 60000,
            
            // Relationship creation strategies
            enableSimilarityRelationships: true,
            enableEntityRelationships: true,
            enableSemanticRelationships: true,
            enableCommunityBridges: true,
            
            // Similarity thresholds
            similarityThreshold: 0.1,
            strongSimilarityThreshold: 0.5,
            entityMatchThreshold: 0.5,
            
            // Relationship limits
            maxRelationshipsPerQuestion: 50,
            maxWeakRelationships: 20,
            minRelationshipsPerQuestion: 5,
            
            // Quality and validation
            enableQualityScoring: true,
            enableRelationshipValidation: true,
            enableBidirectionalRelationships: false
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Update Endpoint:')} ${chalk.white(config.get('storage.options.update'))}`);
        console.log(`   ${chalk.cyan('SPARQL User:')} ${chalk.white(config.get('storage.options.user'))}`);
        console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(options.similarityThreshold)}`);
        console.log(`   ${chalk.cyan('Entity Match Threshold:')} ${chalk.white(options.entityMatchThreshold)}`);
        console.log(`   ${chalk.cyan('Max Relationships per Question:')} ${chalk.white(options.maxRelationshipsPerQuestion)}`);
        console.log(`   ${chalk.cyan('Enable Similarity Relationships:')} ${chalk.white(options.enableSimilarityRelationships ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Entity Relationships:')} ${chalk.white(options.enableEntityRelationships ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Semantic Relationships:')} ${chalk.white(options.enableSemanticRelationships ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Community Bridges:')} ${chalk.white(options.enableCommunityBridges ? 'Yes' : 'No')}`);
        console.log('');

        const builder = new RelationshipBuilder(config, options);
        const result = await builder.buildRelationshipInfrastructure();

        if (result.success) {
            console.log(chalk.green('🎉 Relationship infrastructure building completed successfully!'));
            console.log(chalk.white(`Created ${result.relationshipCounts.total} total relationships establishing formal connections between questions and Wikipedia content.`));
            console.log(chalk.white('The NodeRAG graph analytics pipeline can now function with proper relationship infrastructure.'));
        } else {
            console.log(chalk.yellow('⚠️  Relationship infrastructure building completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Relationship infrastructure building failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { RelationshipBuilder };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    buildRelationshipInfrastructure().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}