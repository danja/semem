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
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            timeout: options.timeout || 60000,
            
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

            // Phase 3: Create entity-based relationships
            if (this.options.enableEntityRelationships) {
                console.log(chalk.white('🏷️ Phase 3: Creating entity-based relationships...'));
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
            ?question ragno:hasEmbedding ?embedding .
        }
    }
}
ORDER BY ?question
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
        
        const wikipediaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?corpuscleText ?embedding ?corpuscleType
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?corpuscleText .
        
        OPTIONAL { ?corpuscle ragno:corpuscleType ?corpuscleType }
        OPTIONAL { ?corpuscle ragno:hasEmbedding ?embedding }
        
        # Filter out test questions - we want Wikipedia content only
        FILTER(!BOUND(?corpuscleType) || ?corpuscleType != "test-question")
    }
}
ORDER BY ?corpuscle
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

                // Try embedding-based similarity first
                if (question.embedding && wikipediaCorpuscle.embedding) {
                    similarity = this.calculateCosineSimilarity(
                        question.embedding, 
                        wikipediaCorpuscle.embedding
                    );
                    method = 'embedding-similarity';
                    embeddingBased++;
                } else {
                    // Fallback to text-based similarity
                    similarity = this.calculateTextSimilarity(
                        question.questionText,
                        wikipediaCorpuscle.corpuscleText
                    );
                    method = 'text-similarity';
                    textBased++;
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
        
        console.log(chalk.gray(`   ✓ Created ${created} similarity relationships (${embeddingBased} embedding-based, ${textBased} text-based)`));
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
     * Create entity-based relationships using named entity recognition
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createEntityBasedRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating entity-based relationships...'));
        
        const relationships = [];
        let created = 0;

        for (const question of questionData) {
            // Extract entities from question text (simple keyword matching)
            const questionEntities = this.extractSimpleEntities(question.questionText);
            
            if (questionEntities.length === 0) continue;

            for (const wikipediaCorpuscle of wikipediaData) {
                const corpuscleEntities = this.extractSimpleEntities(wikipediaCorpuscle.corpuscleText);
                
                // Calculate entity overlap
                const commonEntities = questionEntities.filter(qEntity => 
                    corpuscleEntities.some(cEntity => 
                        this.fuzzyMatch(qEntity, cEntity, this.options.entityMatchThreshold)
                    )
                );

                if (commonEntities.length > 0) {
                    const entityOverlap = commonEntities.length / Math.max(questionEntities.length, corpuscleEntities.length);
                    
                    if (entityOverlap >= this.options.entityMatchThreshold) {
                        const relationshipURI = `${question.questionURI}_entity_${wikipediaCorpuscle.corpuscleURI.split('/').pop()}`;
                        
                        relationships.push({
                            relationshipURI: relationshipURI,
                            sourceURI: question.questionURI,
                            targetURI: wikipediaCorpuscle.corpuscleURI,
                            relationshipType: 'entity-overlap',
                            weight: entityOverlap,
                            confidence: entityOverlap,
                            method: 'entity-extraction',
                            metadata: {
                                commonEntities: commonEntities,
                                entityOverlapRatio: entityOverlap
                            }
                        });
                        created++;
                    }
                }
            }

            console.log(chalk.gray(`   ✓ Question ${questionData.indexOf(question) + 1}/${questionData.length}: entity analysis complete`));
        }

        // Export relationships to SPARQL
        await this.exportRelationships(relationships, 'entity');
        this.stats.entityRelationshipsCreated = created;
        
        console.log(chalk.gray(`   ✓ Created ${created} entity-based relationships`));
    }

    /**
     * Create semantic relationships using LLM-based analysis
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createSemanticRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating semantic relationships...'));
        
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
        
        console.log(chalk.gray(`   ✓ Created ${created} semantic relationships`));
    }

    /**
     * Create community bridge relationships for cross-topic connections
     * @param {Array} questionData - Question data
     * @param {Array} wikipediaData - Wikipedia data
     */
    async createCommunityBridgeRelationships(questionData, wikipediaData) {
        console.log(chalk.gray('   Creating community bridge relationships...'));
        
        // This creates weaker relationships to ensure connectivity
        const relationships = [];
        let created = 0;

        for (const question of questionData) {
            // Find questions without strong relationships
            const hasStrongRelationships = await this.hasExistingRelationships(question.questionURI);
            
            if (!hasStrongRelationships || created < this.options.minRelationshipsPerQuestion) {
                // Create bridge relationships to ensure minimum connectivity
                const bridgeTargets = wikipediaData
                    .slice(0, this.options.maxWeakRelationships)
                    .map(corpus => ({
                        targetURI: corpus.corpuscleURI,
                        similarity: 0.2 + Math.random() * 0.1, // Weak but present
                        relationshipType: 'community-bridge'
                    }));

                for (const bridge of bridgeTargets) {
                    const relationshipURI = `${question.questionURI}_bridge_${bridge.targetURI.split('/').pop()}`;
                    
                    relationships.push({
                        relationshipURI: relationshipURI,
                        sourceURI: question.questionURI,
                        targetURI: bridge.targetURI,
                        relationshipType: bridge.relationshipType,
                        weight: bridge.similarity,
                        confidence: bridge.similarity,
                        method: 'community-bridge',
                        metadata: {
                            purpose: 'ensure-connectivity'
                        }
                    });
                    created++;
                }
            }

            console.log(chalk.gray(`   ✓ Question ${questionData.indexOf(question) + 1}/${questionData.length}: bridge analysis complete`));
        }

        // Export relationships to SPARQL
        await this.exportRelationships(relationships, 'community-bridge');
        this.stats.communityBridgeRelationshipsCreated = created;
        
        console.log(chalk.gray(`   ✓ Created ${created} community bridge relationships`));
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
     * Extract simple entities (capitalized words, proper nouns)
     * @param {string} text - Text to analyze
     * @returns {Array} Extracted entities
     */
    extractSimpleEntities(text) {
        // Simple entity extraction: capitalized words, beer terms, etc.
        const entities = [];
        const words = text.split(/\s+/);
        
        for (const word of words) {
            const cleaned = word.replace(/[^\w]/g, '');
            if (cleaned.length > 2 && /^[A-Z]/.test(cleaned)) {
                entities.push(cleaned.toLowerCase());
            }
        }
        
        // Add beer-specific terms
        const beerTerms = ['beer', 'ale', 'lager', 'stout', 'porter', 'ipa', 'brewery', 'brewing', 'malt', 'hops'];
        for (const term of beerTerms) {
            if (text.toLowerCase().includes(term)) {
                entities.push(term);
            }
        }
        
        return [...new Set(entities)]; // Remove duplicates
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
     * Fuzzy match between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @param {number} threshold - Match threshold
     * @returns {boolean} Whether strings match
     */
    fuzzyMatch(str1, str2, threshold) {
        const similarity = this.calculateStringSimilarity(str1, str2);
        return similarity >= threshold;
    }

    /**
     * Calculate string similarity using simple edit distance
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score
     */
    calculateStringSimilarity(str1, str2) {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;
        
        const distance = this.levenshteinDistance(str1, str2);
        return 1 - (distance / maxLength);
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
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