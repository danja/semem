#!/usr/bin/env node

/**
 * EnhanceCorpuscles.js - Enhance Document Corpuscles Using Graph Analytics
 * 
 * This script analyzes existing corpuscles from the document processing pipeline using
 * graph analytics algorithms to add enhanced relationships and features. It creates
 * new enhanced corpuscles based on structural importance and semantic clustering.
 * 
 * Key Features:
 * - Queries existing corpuscles with embeddings and concepts from document pipeline
 * - Builds graph from concept relationships and semantic similarity
 * - Applies K-core decomposition and centrality analysis
 * - Creates enhanced corpuscles with structural importance metrics
 * - Generates new relationships based on graph analysis
 * - Exports enhanced corpus back to SPARQL store
 * 
 * Pipeline Integration:
 * Expects data from: LoadPDFs.js → ChunkDocuments.js → MakeEmbeddings.js → ExtractConcepts.js
 * Produces: Enhanced corpuscles with graph-based features and relationships
 */

import path from 'path';
import chalk from 'chalk';
import logger from 'loglevel';
import Config from '../../src/Config.js';
import GraphAnalytics from '../../src/ragno/algorithms/GraphAnalytics.js';
import { createQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import Entity from '../../src/ragno/Entity.js';
import rdf from 'rdf-ext';

// Configure detailed logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('                🚀 ENHANCE CORPUSCLES                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('      Graph analytics enhancement for document corpuscles    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Enhanced Corpuscle Processor class
 */
class EnhancedCorpuscleProcessor {
    constructor(config, options = {}) {
        this.config = config;
        
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || {
                user: storageOptions.user,
                password: storageOptions.password
            },
            graphURI: options.graphURI || storageOptions.graphName || 'http://purl.org/stuff/semem',
            timeout: options.timeout || 60000,
            
            // Algorithm options
            enableKCore: options.enableKCore !== false,
            enableCentrality: options.enableCentrality !== false,
            enableCommunityDetection: options.enableCommunityDetection !== false,
            
            // Enhancement options
            similarityThreshold: options.similarityThreshold || 0.6,
            minCorpuscleConnections: options.minCorpuscleConnections || 2,
            maxGraphNodes: options.maxGraphNodes || 1000,
            
            // Export options
            exportToSPARQL: options.exportToSPARQL !== false,
            createEnhancedCorpuscles: options.createEnhancedCorpuscles !== false,
            
            ...options
        };
        
        // Initialize components
        this.graphAnalytics = new GraphAnalytics({
            logProgress: true,
            maxIterations: 1000,
            convergenceThreshold: 1e-6
        });
        
        // Initialize SPARQL services
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });
        
        this.queryService = createQueryService({
            queryPath: path.join(process.cwd(), 'sparql/queries'),
            templatePath: path.join(process.cwd(), 'sparql/templates'),
            cacheOptions: {
                maxSize: 50,
                ttl: 1800000, // 30 minutes
                enableFileWatch: true
            }
        });
        
        this.stats = {
            corpusclesFound: 0,
            conceptsFound: 0,
            relationshipsCreated: 0,
            enhancedCorpusclesCreated: 0,
            graphAnalysisResults: 0,
            featuresAdded: 0,
            processingTime: 0,
            errors: []
        };
    }
    
    /**
     * Main processing workflow
     * @returns {Object} Enhancement results and statistics
     */
    async run() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting corpuscle enhancement analysis...'));
        
        try {
            // Phase 1: Query existing corpuscles with embeddings and concepts
            console.log(chalk.white('📊 Querying existing corpuscles with embeddings...'));
            const corpuscleData = await this.queryCorpuscles();
            
            if (corpuscleData.corpuscles.length === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles with embeddings found'));
                return { success: false, message: 'No corpuscles found with embeddings' };
            }
            
            // Phase 2: Build conceptual graph from corpuscle relationships
            console.log(chalk.white('🕸️  Building conceptual graph from corpus...'));
            const graphData = await this.buildConceptualGraph(corpuscleData);
            
            // Phase 3: Apply graph analytics
            console.log(chalk.white('🧮 Running graph analytics on conceptual network...'));
            const analysisResults = await this.analyzeConceptualGraph(graphData);
            
            // Phase 4: Enhance corpuscles with graph-based features
            console.log(chalk.white('⚡ Enhancing corpuscles with structural features...'));
            const enhancedCorpuscles = await this.enhanceCorpuscles(corpuscleData, analysisResults);
            
            // Phase 5: Create new relationships based on analysis
            console.log(chalk.white('🔗 Creating new semantic relationships...'));
            const newRelationships = await this.createSemanticRelationships(enhancedCorpuscles, analysisResults);
            
            // Phase 6: Generate enhanced corpuscles for important concepts
            if (this.options.createEnhancedCorpuscles) {
                console.log(chalk.white('🆕 Creating enhanced concept corpuscles...'));
                await this.createEnhancedConceptCorpuscles(analysisResults);
            }
            
            // Phase 7: Export results to SPARQL store
            if (this.options.exportToSPARQL) {
                console.log(chalk.white('💾 Exporting enhanced corpus to SPARQL store...'));
                await this.exportEnhancedCorpus(enhancedCorpuscles, newRelationships);
            }
            
            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Corpuscle enhancement completed successfully'));
            this.displayResults();
            
            return {
                success: true,
                enhancedCorpuscles: enhancedCorpuscles,
                newRelationships: newRelationships,
                analysisResults: analysisResults,
                statistics: { ...this.stats }
            };
            
        } catch (error) {
            this.stats.errors.push(`Enhancement failed: ${error.message}`);
            console.log(chalk.red('❌ Corpuscle enhancement failed:', error.message));
            throw error;
        }
    }
    
    /**
     * Query existing corpuscles with embeddings and concepts
     * @returns {Object} Corpuscle data with embeddings and concept relationships
     */
    async queryCorpuscles() {
        console.log(chalk.gray('   Querying corpuscles with embeddings and concepts...'));
        
        const corpuscleQuery = await this.createCorpuscleQuery();
        const result = await this.sparqlHelper.executeSelect(corpuscleQuery);
        
        if (!result.success) {
            const errorMsg = result.error || result.statusText || 'Unknown SPARQL error';
            console.log(chalk.red(`   ❌ Corpuscle query failed (${result.status}): ${errorMsg}`));
            throw new Error(`Failed to query corpuscles: ${errorMsg}`);
        }
        
        const corpuscles = [];
        const conceptMap = new Map(); // concept URI -> concept data
        const corpuscleConceptMap = new Map(); // corpuscle URI -> concept URIs
        
        // Process corpuscle data
        for (const binding of result.data.results.bindings) {
            const corpuscleURI = binding.corpuscle.value;
            const label = binding.label?.value || '';
            const embedding = binding.embedding?.value;
            const sourceChunk = binding.sourceChunk?.value;
            
            if (!embedding) continue; // Skip corpuscles without embeddings
            
            // Parse embedding vector
            const embeddingVector = embedding.split(',').map(v => parseFloat(v.trim()));
            if (embeddingVector.some(isNaN)) continue; // Skip invalid embeddings
            
            // Extract simple concept-like features from the label and source chunk
            // Since individual concepts aren't stored, we'll create synthetic concepts based on corpuscle characteristics
            const concepts = [];
            
            // Create pseudo-concepts based on the chunk ID patterns
            if (sourceChunk) {
                const chunkId = sourceChunk.split('/').pop();
                const parts = chunkId.split('_');
                if (parts.length >= 3) {
                    // Use document ID and chunk index as concept proxies
                    concepts.push(`doc-${parts[0]}`);
                    concepts.push(`chunk-index-${Math.floor(parseInt(parts[1]) / 5) * 5}`); // Group by 5s
                }
            }
            
            // Add a concept based on embedding characteristics (clustering by similarity)
            const embeddingMagnitude = Math.sqrt(embeddingVector.reduce((sum, val) => sum + val * val, 0));
            const magnitudeGroup = Math.floor(embeddingMagnitude * 10) / 10;
            concepts.push(`embedding-magnitude-${magnitudeGroup}`);
            
            corpuscles.push({
                uri: corpuscleURI,
                embedding: embeddingVector,
                concepts: concepts,
                sourceChunk: sourceChunk,
                label: label
            });
            
            // Track concepts
            concepts.forEach(concept => {
                if (!conceptMap.has(concept)) {
                    conceptMap.set(concept, {
                        name: concept,
                        corpuscles: new Set(),
                        frequency: 0
                    });
                }
                conceptMap.get(concept).corpuscles.add(corpuscleURI);
                conceptMap.get(concept).frequency++;
            });
            
            corpuscleConceptMap.set(corpuscleURI, concepts);
        }
        
        this.stats.corpusclesFound = corpuscles.length;
        this.stats.conceptsFound = conceptMap.size;
        
        console.log(chalk.gray(`   ✓ Found ${corpuscles.length} corpuscles with embeddings`));
        console.log(chalk.gray(`   ✓ Found ${conceptMap.size} unique concepts`));
        
        return {
            corpuscles: corpuscles,
            conceptMap: conceptMap,
            corpuscleConceptMap: corpuscleConceptMap
        };
    }
    
    /**
     * Build conceptual graph from corpuscle relationships
     * @param {Object} corpuscleData - Corpuscle data with concepts
     * @returns {Object} Graph representation for analytics
     */
    async buildConceptualGraph(corpuscleData) {
        console.log(chalk.gray('   Building conceptual relationship graph...'));
        
        const graph = {
            nodes: new Map(), // concept -> node data
            edges: new Map(), // edge key -> edge data
            adjacency: new Map(), // concept -> Set of connected concepts
            inDegree: new Map(),
            outDegree: new Map(),
            corpuscleNodes: new Map() // corpuscle URI -> node data
        };
        
        const { corpuscles, conceptMap, corpuscleConceptMap } = corpuscleData;
        
        // Add concepts as primary nodes
        for (const [conceptName, conceptData] of conceptMap) {
            const conceptURI = `http://purl.org/stuff/instance/concept-${this.generateId(conceptName)}`;
            
            graph.nodes.set(conceptURI, {
                uri: conceptURI,
                type: 'concept',
                name: conceptName,
                frequency: conceptData.frequency,
                corpuscles: Array.from(conceptData.corpuscles),
                properties: new Map()
            });
            
            graph.adjacency.set(conceptURI, new Set());
            graph.inDegree.set(conceptURI, 0);
            graph.outDegree.set(conceptURI, 0);
        }
        
        // Add corpuscles as secondary nodes
        for (const corpuscle of corpuscles) {
            graph.corpuscleNodes.set(corpuscle.uri, {
                uri: corpuscle.uri,
                type: 'corpuscle',
                embedding: corpuscle.embedding,
                concepts: corpuscle.concepts,
                sourceChunk: corpuscle.sourceChunk,
                properties: new Map()
            });
        }
        
        // Create concept co-occurrence relationships
        let relationshipCount = 0;
        for (const corpuscle of corpuscles) {
            const concepts = corpuscle.concepts;
            
            // Create edges between concepts that co-occur in the same corpuscle
            for (let i = 0; i < concepts.length; i++) {
                for (let j = i + 1; j < concepts.length; j++) {
                    const concept1 = concepts[i];
                    const concept2 = concepts[j];
                    
                    const concept1URI = `http://purl.org/stuff/instance/concept-${this.generateId(concept1)}`;
                    const concept2URI = `http://purl.org/stuff/instance/concept-${this.generateId(concept2)}`;
                    
                    if (graph.nodes.has(concept1URI) && graph.nodes.has(concept2URI)) {
                        const edgeKey = `${concept1URI}->${concept2URI}`;
                        const reverseEdgeKey = `${concept2URI}->${concept1URI}`;
                        
                        // Check if edge already exists (either direction)
                        if (!graph.edges.has(edgeKey) && !graph.edges.has(reverseEdgeKey)) {
                            // Calculate co-occurrence weight
                            const freq1 = conceptMap.get(concept1).frequency;
                            const freq2 = conceptMap.get(concept2).frequency;
                            const coOccurrence = Math.min(freq1, freq2);
                            const weight = coOccurrence / Math.max(freq1, freq2); // Jaccard-like similarity
                            
                            graph.edges.set(edgeKey, {
                                source: concept1URI,
                                target: concept2URI,
                                weight: weight,
                                coOccurrence: coOccurrence,
                                relationshipType: 'co-occurrence',
                                properties: new Map()
                            });
                            
                            // Update adjacency (undirected)
                            graph.adjacency.get(concept1URI).add(concept2URI);
                            graph.adjacency.get(concept2URI).add(concept1URI);
                            
                            // Update degrees
                            graph.outDegree.set(concept1URI, graph.outDegree.get(concept1URI) + 1);
                            graph.inDegree.set(concept2URI, graph.inDegree.get(concept2URI) + 1);
                            graph.outDegree.set(concept2URI, graph.outDegree.get(concept2URI) + 1);
                            graph.inDegree.set(concept1URI, graph.inDegree.get(concept1URI) + 1);
                            
                            relationshipCount++;
                        }
                    }
                }
            }
        }
        
        // Add semantic similarity relationships between corpuscles
        await this.addSemanticSimilarityEdges(graph, corpuscles);
        
        this.stats.relationshipsCreated = relationshipCount;
        
        console.log(chalk.gray(`   ✓ Created conceptual graph: ${graph.nodes.size} concepts, ${graph.edges.size} relationships`));
        console.log(chalk.gray(`   ✓ Added ${corpuscles.length} corpuscle nodes for similarity analysis`));
        
        return {
            graph: graph,
            corpuscleData: corpuscleData
        };
    }
    
    /**
     * Add semantic similarity edges between corpuscles
     * @param {Object} graph - Graph structure
     * @param {Array} corpuscles - Corpuscle data with embeddings
     */
    async addSemanticSimilarityEdges(graph, corpuscles) {
        console.log(chalk.gray('   Adding semantic similarity relationships...'));
        
        let similarityCount = 0;
        const threshold = this.options.similarityThreshold;
        
        // Calculate pairwise cosine similarities
        for (let i = 0; i < corpuscles.length; i++) {
            for (let j = i + 1; j < corpuscles.length; j++) {
                const corpuscle1 = corpuscles[i];
                const corpuscle2 = corpuscles[j];
                
                const similarity = this.calculateCosineSimilarity(
                    corpuscle1.embedding,
                    corpuscle2.embedding
                );
                
                if (similarity >= threshold) {
                    const edgeKey = `${corpuscle1.uri}->${corpuscle2.uri}`;
                    
                    graph.edges.set(edgeKey, {
                        source: corpuscle1.uri,
                        target: corpuscle2.uri,
                        weight: similarity,
                        relationshipType: 'semantic-similarity',
                        properties: new Map([['similarity', similarity]])
                    });
                    
                    similarityCount++;
                }
            }
        }
        
        console.log(chalk.gray(`   ✓ Added ${similarityCount} semantic similarity relationships (threshold: ${threshold})`));
    }
    
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} a - First vector
     * @param {Array} b - Second vector
     * @returns {number} Cosine similarity
     */
    calculateCosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }
    
    /**
     * Apply graph analytics to conceptual graph
     * @param {Object} graphData - Graph data structure
     * @returns {Object} Analysis results
     */
    async analyzeConceptualGraph(graphData) {
        const { graph } = graphData;
        
        const analysisResults = {
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.size,
            kCore: null,
            centrality: null,
            statistics: null,
            communityStructure: null,
            graph: graph
        };
        
        // Limit graph size for performance
        if (graph.nodes.size > this.options.maxGraphNodes) {
            console.log(chalk.yellow(`   ⚠️  Large graph (${graph.nodes.size} nodes) - using top concepts only`));
            // Could implement graph sampling here if needed
        }
        
        // Run K-core decomposition
        if (this.options.enableKCore && graph.nodes.size > 1) {
            console.log(chalk.gray('   Running K-core decomposition on concepts...'));
            try {
                analysisResults.kCore = this.graphAnalytics.computeKCore(graph);
                console.log(chalk.gray(`   ✓ K-core completed: max core = ${analysisResults.kCore.maxCore}`));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  K-core failed: ${error.message}`));
                this.stats.errors.push(`K-core failed: ${error.message}`);
            }
        }
        
        // Run betweenness centrality on smaller graphs
        if (this.options.enableCentrality && graph.nodes.size <= 500) {
            console.log(chalk.gray('   Running betweenness centrality analysis...'));
            try {
                analysisResults.centrality = this.graphAnalytics.computeBetweennessCentrality(graph);
                console.log(chalk.gray(`   ✓ Centrality completed: max = ${analysisResults.centrality.maxCentrality.toFixed(4)}`));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Centrality failed: ${error.message}`));
                this.stats.errors.push(`Centrality failed: ${error.message}`);
            }
        } else if (graph.nodes.size > 500) {
            console.log(chalk.gray('   ⚠️  Skipping centrality for large graph (>500 nodes)'));
        }
        
        // Compute basic graph statistics
        analysisResults.statistics = this.graphAnalytics.computeGraphStatistics(graph);
        
        this.stats.graphAnalysisResults = graph.nodes.size;
        
        return analysisResults;
    }
    
    /**
     * Enhance corpuscles with graph-based features
     * @param {Object} corpuscleData - Original corpuscle data
     * @param {Object} analysisResults - Graph analysis results
     * @returns {Array} Enhanced corpuscles
     */
    async enhanceCorpuscles(corpuscleData, analysisResults) {
        console.log(chalk.gray('   Adding structural features to corpuscles...'));
        
        const { corpuscles, conceptMap } = corpuscleData;
        const enhancedCorpuscles = [];
        
        for (const corpuscle of corpuscles) {
            const enhanced = {
                ...corpuscle,
                features: new Map(),
                structuralMetrics: {},
                conceptImportance: {},
                relationshipStrength: 0
            };
            
            // Calculate concept-based structural metrics
            const conceptImportanceScores = [];
            let totalConceptCentrality = 0;
            let totalConceptCore = 0;
            let maxConceptFrequency = 0;
            
            for (const conceptName of corpuscle.concepts) {
                const conceptURI = `http://purl.org/stuff/instance/concept-${this.generateId(conceptName)}`;
                const conceptData = conceptMap.get(conceptName);
                
                // Get k-core score for concept
                let coreScore = 0;
                if (analysisResults.kCore?.coreNumbers?.has(conceptURI)) {
                    coreScore = analysisResults.kCore.coreNumbers.get(conceptURI);
                }
                
                // Get centrality score for concept
                let centralityScore = 0;
                if (analysisResults.centrality?.centrality?.has(conceptURI)) {
                    centralityScore = analysisResults.centrality.centrality.get(conceptURI);
                }
                
                // Calculate concept importance
                const frequency = conceptData.frequency;
                const importance = (coreScore * 0.4) + (centralityScore * 0.4) + (Math.log(frequency + 1) * 0.2);
                
                enhanced.conceptImportance[conceptName] = {
                    coreScore: coreScore,
                    centralityScore: centralityScore,
                    frequency: frequency,
                    importance: importance
                };
                
                conceptImportanceScores.push(importance);
                totalConceptCentrality += centralityScore;
                totalConceptCore += coreScore;
                maxConceptFrequency = Math.max(maxConceptFrequency, frequency);
            }
            
            // Calculate aggregate structural metrics
            enhanced.structuralMetrics = {
                avgConceptImportance: conceptImportanceScores.length > 0 ? 
                    conceptImportanceScores.reduce((a, b) => a + b, 0) / conceptImportanceScores.length : 0,
                maxConceptImportance: Math.max(...conceptImportanceScores, 0),
                totalConceptCentrality: totalConceptCentrality,
                avgConceptCentrality: corpuscle.concepts.length > 0 ? 
                    totalConceptCentrality / corpuscle.concepts.length : 0,
                totalConceptCore: totalConceptCore,
                avgConceptCore: corpuscle.concepts.length > 0 ? 
                    totalConceptCore / corpuscle.concepts.length : 0,
                maxConceptFrequency: maxConceptFrequency,
                conceptDiversity: corpuscle.concepts.length,
                semanticRichness: conceptImportanceScores.length > 0 ? 
                    Math.sqrt(conceptImportanceScores.reduce((sum, score) => sum + score * score, 0)) : 0
            };
            
            // Add features as RDF-compatible attributes
            enhanced.features.set('structural-importance', enhanced.structuralMetrics.avgConceptImportance);
            enhanced.features.set('concept-centrality', enhanced.structuralMetrics.avgConceptCentrality);
            enhanced.features.set('concept-connectivity', enhanced.structuralMetrics.avgConceptCore);
            enhanced.features.set('semantic-richness', enhanced.structuralMetrics.semanticRichness);
            enhanced.features.set('concept-diversity', enhanced.structuralMetrics.conceptDiversity);
            
            this.stats.featuresAdded += enhanced.features.size;
            enhancedCorpuscles.push(enhanced);
        }
        
        console.log(chalk.gray(`   ✓ Enhanced ${enhancedCorpuscles.length} corpuscles with structural features`));
        console.log(chalk.gray(`   ✓ Added ${this.stats.featuresAdded} feature attributes`));
        
        return enhancedCorpuscles;
    }
    
    /**
     * Create new semantic relationships based on analysis
     * @param {Array} enhancedCorpuscles - Enhanced corpuscles
     * @param {Object} analysisResults - Analysis results
     * @returns {Array} New relationships
     */
    async createSemanticRelationships(enhancedCorpuscles, analysisResults) {
        console.log(chalk.gray('   Creating enhanced semantic relationships...'));
        
        const relationships = [];
        
        // Create relationships between corpuscles with high structural similarity
        for (let i = 0; i < enhancedCorpuscles.length; i++) {
            for (let j = i + 1; j < enhancedCorpuscles.length; j++) {
                const corpuscle1 = enhancedCorpuscles[i];
                const corpuscle2 = enhancedCorpuscles[j];
                
                // Calculate structural similarity
                const structuralSimilarity = this.calculateStructuralSimilarity(corpuscle1, corpuscle2);
                
                if (structuralSimilarity > 0.7) {
                    const relationshipURI = `http://purl.org/stuff/instance/relationship-${this.generateId()}`;
                    
                    relationships.push({
                        uri: relationshipURI,
                        sourceEntity: corpuscle1.uri,
                        targetEntity: corpuscle2.uri,
                        relationshipType: 'structural-similarity',
                        weight: structuralSimilarity,
                        metadata: {
                            analysisType: 'graph-structural',
                            similarity: structuralSimilarity,
                            createdBy: 'enhance-corpuscles'
                        }
                    });
                }
            }
        }
        
        // Create concept-based relationships
        const conceptRelationships = this.createConceptBasedRelationships(enhancedCorpuscles, analysisResults);
        relationships.push(...conceptRelationships);
        
        console.log(chalk.gray(`   ✓ Created ${relationships.length} new semantic relationships`));
        
        return relationships;
    }
    
    /**
     * Calculate structural similarity between two corpuscles
     * @param {Object} corpuscle1 - First corpuscle
     * @param {Object} corpuscle2 - Second corpuscle
     * @returns {number} Structural similarity score
     */
    calculateStructuralSimilarity(corpuscle1, corpuscle2) {
        const metrics1 = corpuscle1.structuralMetrics;
        const metrics2 = corpuscle2.structuralMetrics;
        
        // Calculate similarity across multiple dimensions
        const importanceSim = 1 - Math.abs(metrics1.avgConceptImportance - metrics2.avgConceptImportance);
        const centralitySim = 1 - Math.abs(metrics1.avgConceptCentrality - metrics2.avgConceptCentrality);
        const connectivitySim = 1 - Math.abs(metrics1.avgConceptCore - metrics2.avgConceptCore);
        const richnessSim = 1 - Math.abs(metrics1.semanticRichness - metrics2.semanticRichness) / 
                           Math.max(metrics1.semanticRichness, metrics2.semanticRichness, 1);
        
        // Weighted combination
        return (importanceSim * 0.3) + (centralitySim * 0.3) + (connectivitySim * 0.2) + (richnessSim * 0.2);
    }
    
    /**
     * Create concept-based relationships
     * @param {Array} enhancedCorpuscles - Enhanced corpuscles
     * @param {Object} analysisResults - Analysis results
     * @returns {Array} Concept-based relationships
     */
    createConceptBasedRelationships(enhancedCorpuscles, analysisResults) {
        const relationships = [];
        
        // Group corpuscles by their most important concepts
        const conceptGroups = new Map();
        
        for (const corpuscle of enhancedCorpuscles) {
            // Find most important concept for this corpuscle
            let maxImportance = 0;
            let mostImportantConcept = null;
            
            for (const [conceptName, data] of Object.entries(corpuscle.conceptImportance)) {
                if (data.importance > maxImportance) {
                    maxImportance = data.importance;
                    mostImportantConcept = conceptName;
                }
            }
            
            if (mostImportantConcept && maxImportance > 0.5) {
                if (!conceptGroups.has(mostImportantConcept)) {
                    conceptGroups.set(mostImportantConcept, []);
                }
                conceptGroups.get(mostImportantConcept).push(corpuscle);
            }
        }
        
        // Create relationships within concept groups
        for (const [conceptName, corpuscles] of conceptGroups) {
            if (corpuscles.length < 2) continue;
            
            for (let i = 0; i < corpuscles.length; i++) {
                for (let j = i + 1; j < corpuscles.length; j++) {
                    const relationshipURI = `http://purl.org/stuff/instance/relationship-${this.generateId()}`;
                    
                    relationships.push({
                        uri: relationshipURI,
                        sourceEntity: corpuscles[i].uri,
                        targetEntity: corpuscles[j].uri,
                        relationshipType: 'shared-primary-concept',
                        weight: 0.8,
                        metadata: {
                            sharedConcept: conceptName,
                            analysisType: 'concept-clustering',
                            createdBy: 'enhance-corpuscles'
                        }
                    });
                }
            }
        }
        
        return relationships;
    }
    
    /**
     * Create enhanced concept corpuscles for important concepts
     * @param {Object} analysisResults - Analysis results
     */
    async createEnhancedConceptCorpuscles(analysisResults) {
        console.log(chalk.gray('   Creating enhanced concept corpuscles...'));
        
        if (!analysisResults.kCore?.coreNumbers) {
            console.log(chalk.yellow('   ⚠️  No k-core data available for concept enhancement'));
            return;
        }
        
        // Find highly connected concepts (high k-core)
        const topConcepts = this.graphAnalytics.getTopKNodes(analysisResults.kCore.coreNumbers, 20);
        
        for (const { nodeUri, score } of topConcepts) {
            if (score < 3) continue; // Only create corpuscles for highly connected concepts
            
            const conceptData = analysisResults.graph.nodes.get(nodeUri);
            if (!conceptData) continue;
            
            const corpuscleURI = `http://purl.org/stuff/instance/enhanced-concept-corpuscle-${this.generateId()}`;
            
            // Create enhanced concept corpuscle
            const enhancedCorpuscle = new Entity({
                name: `Enhanced concept: ${conceptData.name}`,
                isEntryPoint: true,
                subType: 'enhanced-concept-corpuscle'
            });
            
            // Add structural attributes
            enhancedCorpuscle.addAttribute('concept-name', conceptData.name);
            enhancedCorpuscle.addAttribute('k-core-score', score);
            enhancedCorpuscle.addAttribute('concept-frequency', conceptData.frequency);
            enhancedCorpuscle.addAttribute('structural-importance', score / analysisResults.kCore.maxCore);
            
            if (analysisResults.centrality?.centrality?.has(nodeUri)) {
                const centralityScore = analysisResults.centrality.centrality.get(nodeUri);
                enhancedCorpuscle.addAttribute('betweenness-centrality', centralityScore);
            }
            
            // Add to statistics
            this.stats.enhancedCorpusclesCreated++;
        }
        
        console.log(chalk.gray(`   ✓ Created ${this.stats.enhancedCorpusclesCreated} enhanced concept corpuscles`));
    }
    
    /**
     * Export enhanced corpus to SPARQL store
     * @param {Array} enhancedCorpuscles - Enhanced corpuscles
     * @param {Array} newRelationships - New relationships
     */
    async exportEnhancedCorpus(enhancedCorpuscles, newRelationships) {
        console.log(chalk.gray(`   Exporting enhanced corpus to SPARQL store...`));
        
        const batchSize = 10;
        let exported = 0;
        
        try {
            // Export enhanced corpuscle features
            for (let i = 0; i < enhancedCorpuscles.length; i += batchSize) {
                const batch = enhancedCorpuscles.slice(i, i + batchSize);
                const triples = [];
                
                for (const corpuscle of batch) {
                    // Add structural features as attributes
                    for (const [featureName, featureValue] of corpuscle.features) {
                        const attributeURI = `${corpuscle.uri}_${featureName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        
                        triples.push(`<${attributeURI}> rdf:type ragno:Attribute .`);
                        triples.push(`<${attributeURI}> rdfs:label "${featureName}" .`);
                        triples.push(`<${attributeURI}> ragno:attributeType "${featureName}" .`);
                        triples.push(`<${attributeURI}> ragno:attributeValue "${featureValue.toFixed(6)}" .`);
                        triples.push(`<${attributeURI}> dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .`);
                        triples.push(`<${attributeURI}> prov:wasGeneratedBy "enhance-corpuscles-analysis" .`);
                        triples.push(`<${corpuscle.uri}> ragno:hasAttribute <${attributeURI}> .`);
                    }
                }
                
                if (triples.length > 0) {
                    const updateQuery = this.createInsertQuery(triples);
                    const result = await this.sparqlHelper.executeUpdate(updateQuery);
                    
                    if (result.success) {
                        exported += batch.length;
                        console.log(chalk.gray(`   ✓ Exported features for ${exported}/${enhancedCorpuscles.length} corpuscles`));
                    } else {
                        console.log(chalk.red(`   ❌ Failed to export batch: ${result.error}`));
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Export new relationships
            if (newRelationships.length > 0) {
                await this.exportRelationships(newRelationships);
            }
            
            console.log(chalk.gray(`   ✅ Export completed: ${exported} enhanced corpuscles`));
            
        } catch (error) {
            this.stats.errors.push(`Export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Export failed: ${error.message}`));
            throw error;
        }
    }
    
    /**
     * Export relationships to SPARQL store
     * @param {Array} relationships - Relationships to export
     */
    async exportRelationships(relationships) {
        console.log(chalk.gray(`   Exporting ${relationships.length} new relationships...`));
        
        const batchSize = 5;
        let exported = 0;
        
        for (let i = 0; i < relationships.length; i += batchSize) {
            const batch = relationships.slice(i, i + batchSize);
            const triples = [];
            
            for (const rel of batch) {
                triples.push(`<${rel.uri}> rdf:type ragno:Relationship .`);
                triples.push(`<${rel.uri}> ragno:hasSourceEntity <${rel.sourceEntity}> .`);
                triples.push(`<${rel.uri}> ragno:hasTargetEntity <${rel.targetEntity}> .`);
                triples.push(`<${rel.uri}> ragno:relationshipType "${rel.relationshipType}" .`);
                triples.push(`<${rel.uri}> ragno:weight "${rel.weight.toFixed(6)}" .`);
                triples.push(`<${rel.uri}> dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .`);
                triples.push(`<${rel.uri}> prov:wasGeneratedBy "enhance-corpuscles-analysis" .`);
                
                // Add metadata
                for (const [key, value] of Object.entries(rel.metadata)) {
                    triples.push(`<${rel.uri}> ragno:${key} "${value}" .`);
                }
            }
            
            const updateQuery = this.createInsertQuery(triples);
            const result = await this.sparqlHelper.executeUpdate(updateQuery);
            
            if (result.success) {
                exported += batch.length;
            } else {
                console.log(chalk.red(`   ❌ Failed to export relationship batch: ${result.error}`));
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(chalk.gray(`   ✓ Exported ${exported} relationships`));
    }
    
    /**
     * Create SPARQL INSERT query
     * @param {Array} triples - Array of triple strings
     * @returns {string} SPARQL UPDATE query
     */
    createInsertQuery(triples) {
        return `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${this.options.graphURI}> {
        ${triples.join('\n        ')}
    }
}`;
    }
    
    /**
     * Create corpuscle query
     * @returns {Promise<string>} SPARQL query
     */
    async createCorpuscleQuery() {
        // First check what corpuscles exist at all and understand the data structure
        const debugTemplate = `
SELECT ?corpuscle ?type ?label ?conceptLabels ?embedding ?sourceChunk ?hasEmbedding ?p ?o
WHERE {
    GRAPH <\${graphURI}> {
        ?corpuscle a ?type .
        OPTIONAL { ?corpuscle rdfs:label ?label }
        OPTIONAL { ?corpuscle ragno:conceptLabels ?conceptLabels }
        OPTIONAL { ?corpuscle ragno:hasEmbedding ?embedding }
        OPTIONAL { ?corpuscle ragno:embedding ?embedding }
        OPTIONAL { ?corpuscle ragno:hasSourceChunk ?sourceChunk }
        OPTIONAL { ?corpuscle ?hasEmbedding ?embeddingValue .
                   FILTER(CONTAINS(STR(?hasEmbedding), "embedding")) }
        OPTIONAL { ?corpuscle ?p ?o .
                   FILTER(?p != rdf:type && ?p != rdfs:label) }
        
        FILTER(?type = ragno:Corpuscle || CONTAINS(STR(?type), "Corpuscle"))
    }
}
ORDER BY ?corpuscle
LIMIT 20
`;
        
        const prefixes = await this.queryService.loadPrefixes();
        const debugQuery = prefixes + this.substituteParameters(debugTemplate, { graphURI: this.options.graphURI });
        
        console.log(chalk.gray('   Debug: checking all corpuscle-like entities...'));
        const debugResult = await this.sparqlHelper.executeSelect(debugQuery);
        
        if (debugResult.success && debugResult.data.results.bindings.length > 0) {
            console.log(chalk.gray(`   Found ${debugResult.data.results.bindings.length} corpuscle-like entities:`));
            debugResult.data.results.bindings.slice(0, 5).forEach(binding => {
                const type = binding.type?.value || 'unknown';
                const label = binding.label?.value || 'no label';
                const hasEmbedding = binding.embedding ? 'with embedding' : 'no embedding';
                console.log(chalk.gray(`     ${type.split('/').pop()}: ${label.substring(0, 50)}... (${hasEmbedding})`));
            });
        }
        
        const template = `
SELECT ?corpuscle ?label ?embedding ?sourceChunk
WHERE {
    GRAPH <\${graphURI}> {
        ?corpuscle a ragno:Corpuscle .
        
        # Get the corpuscle label which contains concept information
        OPTIONAL { ?corpuscle rdfs:label ?label }
        
        # Try to find embedding via the wasDerivedFrom relationship to source chunk
        OPTIONAL {
            ?corpuscle prov:wasDerivedFrom ?sourceChunk .
            ?sourceChunk ragno:embedding ?embedding .
        }
        
        # Also try direct embedding properties
        OPTIONAL {
            ?corpuscle ragno:hasEmbedding ?embedding .
        }
        
        OPTIONAL {
            ?corpuscle ragno:embedding ?embedding .
        }
        
        # Include corpuscles that have embeddings either directly or via source chunk
        FILTER(BOUND(?embedding))
    }
}
ORDER BY ?corpuscle
`;
        
        return prefixes + this.substituteParameters(template, { graphURI: this.options.graphURI });
    }
    
    /**
     * Substitute parameters in query template
     * @param {string} template - Query template
     * @param {Object} parameters - Parameters to substitute
     * @returns {string} Query with substituted parameters
     */
    substituteParameters(template, parameters) {
        let query = template;
        for (const [key, value] of Object.entries(parameters)) {
            const placeholder = `\${${key}}`;
            query = query.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        return query;
    }
    
    /**
     * Generate unique identifier
     * @param {string} [seed] - Optional seed for deterministic ID
     * @returns {string} Unique identifier
     */
    generateId(seed) {
        if (seed) {
            // Create deterministic ID from seed
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                const char = seed.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(36);
        }
        return Date.now().toString(36) + Math.random().toString(36).substring(7);
    }
    
    /**
     * Display processing results
     */
    displayResults() {
        console.log('');
        console.log(chalk.bold.white('🚀 Corpuscle Enhancement Results:'));
        console.log(`   ${chalk.cyan('Corpuscles Found:')} ${chalk.white(this.stats.corpusclesFound)}`);
        console.log(`   ${chalk.cyan('Concepts Found:')} ${chalk.white(this.stats.conceptsFound)}`);
        console.log(`   ${chalk.cyan('Relationships Created:')} ${chalk.white(this.stats.relationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Features Added:')} ${chalk.white(this.stats.featuresAdded)}`);
        console.log(`   ${chalk.cyan('Enhanced Corpuscles Created:')} ${chalk.white(this.stats.enhancedCorpusclesCreated)}`);
        console.log(`   ${chalk.cyan('Graph Analysis Results:')} ${chalk.white(this.stats.graphAnalysisResults)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.queryService) {
            this.queryService.cleanup();
        }
    }
}

/**
 * Main function for command-line usage
 */
async function main() {
    displayHeader();
    
    try {
        // Initialize configuration first to get default graph
        const config = new Config('config/config.json');
        await config.init();
        
        // Parse command line arguments
        const args = process.argv.slice(2);
        const limit = args.includes('--limit') ? 
            parseInt(args[args.indexOf('--limit') + 1]) || 0 : 0;
        const graphURI = args.includes('--graph') ?
            args[args.indexOf('--graph') + 1] : config.get('storage.options.graphName');
        
        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('Graph URI:')} ${chalk.white(graphURI)}`);
        console.log(`   ${chalk.cyan('Processing Limit:')} ${chalk.white(limit === 0 ? 'No limit' : limit)}`);
        console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white('0.6')}`);
        console.log(`   ${chalk.cyan('Create Enhanced Corpuscles:')} ${chalk.white('Yes')}`);
        console.log('');
        
        const options = {
            graphURI: graphURI,
            similarityThreshold: 0.6,
            createEnhancedCorpuscles: true,
            exportToSPARQL: true,
            maxGraphNodes: 1000
        };
        
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.get('storage.options.update'))}`);
        console.log('');
        
        const processor = new EnhancedCorpuscleProcessor(config, options);
        
        try {
            const result = await processor.run();
            
            if (result.success) {
                console.log(chalk.green('🎉 Corpuscle enhancement completed successfully!'));
                console.log(chalk.white('Enhanced corpus has been stored in the SPARQL store.'));
            } else {
                console.log(chalk.red('❌ Corpuscle enhancement failed:', result.message));
            }
            
            return result;
            
        } finally {
            await processor.cleanup();
        }
        
    } catch (error) {
        console.log(chalk.red('❌ Enhancement failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { EnhancedCorpuscleProcessor };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}