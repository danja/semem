#!/usr/bin/env node

/**
 * GraphNavigate.js - ZPT Navigation Enhanced with PPR Traversal
 * 
 * This script enhances the existing ZPT navigation system by integrating
 * Personalized PageRank as a specialized navigation method. Instead of replacing
 * ZPT vocabulary, it extends the ZPT framework to include graph-based traversal
 * capabilities, allowing PPR to be used as a tilt projection method within
 * the existing ZPT (Zoom-Pan-Tilt) paradigm.
 * 
 * Key Features:
 * - Integrates PPR as a new ZPT tilt projection: "ppr-traversal"
 * - Maintains full compatibility with existing ZPT vocabulary and ontology
 * - Supports shallow and deep PPR modes as ZPT zoom levels
 * - Uses existing ZPT pan parameters for query filtering
 * - Creates ZPT-compliant navigation results with proper ontology terms
 * - Preserves relationship creation for downstream processing
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import PersonalizedPageRank from '../../../src/ragno/algorithms/PersonalizedPageRank.js';
import { CorpuscleRanking } from '../ragno/CorpuscleRanking.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🧭 GRAPH NAVIGATE                            ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    ZPT navigation enhanced with PPR graph traversal        ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * GraphNavigate class for ZPT-integrated PPR navigation
 */
class GraphNavigate {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            
            // ZPT Integration options
            zptNamespace: options.zptNamespace || 'http://purl.org/stuff/zpt/',
            enableZPTOntology: options.enableZPTOntology !== false,
            
            // PPR Navigation options  
            defaultZoom: options.defaultZoom || 'entity', // ZPT zoom level
            defaultTilt: options.defaultTilt || 'ppr-traversal', // New ZPT tilt projection
            maxCorpuscles: options.maxCorpuscles || 6, // Maintain Navigate.js compatibility
            similarityThreshold: options.similarityThreshold || 0.3,
            
            // PPR Algorithm options
            alpha: options.alpha || 0.15,
            shallowIterations: options.shallowIterations || 2, // For zoom: "unit"
            deepIterations: options.deepIterations || 10, // For zoom: "entity"
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            
            // ZPT Pan filtering options
            typeFilter: options.typeFilter || null, // Pan parameter for type filtering
            sourceFilter: options.sourceFilter || null, // Pan parameter for source filtering
            
            // Output options
            createRelationships: options.createRelationships !== false,
            exportToSPARQL: options.exportToSPARQL !== false,
            
            ...options
        };

        // Initialize components
        this.corpuscleRanking = new CorpuscleRanking(this.options);
        this.ppr = new PersonalizedPageRank({
            alpha: this.options.alpha,
            maxIterations: this.options.deepIterations,
            convergenceThreshold: this.options.convergenceThreshold,
            logProgress: false
        });

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            questionsNavigated: 0,
            seedNodesUsed: 0,
            pprIterations: 0,
            zptViewsGenerated: 0,
            relationshipsCreated: 0,
            corpusclesReturned: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Run ZPT navigation with PPR traversal for BeerQA questions
     * @param {Array} questionIds - Optional array of specific question IDs to process
     * @param {Object} zptParams - ZPT navigation parameters (zoom, pan, tilt)
     * @returns {Object} ZPT navigation results
     */
    async runZPTNavigation(questionIds = null, zptParams = {}) {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting ZPT navigation with PPR traversal...'));

        try {
            // Phase 1: Parse and validate ZPT parameters
            console.log(chalk.white('⚙️  Parsing ZPT navigation parameters...'));
            const parsedParams = this.parseZPTParameters(zptParams);
            
            // Phase 2: Build corpuscle graph for PPR traversal
            console.log(chalk.white('📊 Building corpuscle graph for navigation...'));
            const graphData = await this.corpuscleRanking.buildCorpuscleGraph();
            
            if (graphData.nodeCount === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles found - no navigation possible'));
                return { success: false, message: 'No corpuscles found' };
            }

            // Phase 3: Extract question concepts as navigation entry points
            console.log(chalk.white('🎯 Extracting navigation entry points...'));
            const questionData = await this.extractNavigationEntryPoints(questionIds);

            if (questionData.length === 0) {
                console.log(chalk.yellow('⚠️  No questions found - no navigation to perform'));
                return { success: false, message: 'No questions found' };
            }

            // Phase 4: Execute ZPT navigation with PPR traversal
            console.log(chalk.white('🧭 Executing ZPT navigation with PPR traversal...'));
            const navigationResults = await this.executeZPTNavigation(graphData.graph, questionData, parsedParams);

            // Phase 5: Create ZPT-compliant relationships and views
            console.log(chalk.white('🔗 Creating ZPT relationships and views...'));
            const zptViews = await this.createZPTViews(navigationResults, parsedParams);

            // Phase 6: Export results to SPARQL store
            if (this.options.exportToSPARQL && zptViews.length > 0) {
                console.log(chalk.white('💾 Exporting ZPT views to SPARQL store...'));
                await this.exportZPTViews(zptViews);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ ZPT navigation with PPR completed successfully'));
            this.displayResults(zptViews);

            return {
                success: true,
                zptViews: zptViews,
                navigationResults: navigationResults,
                zptParameters: parsedParams,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`ZPT navigation failed: ${error.message}`);
            console.log(chalk.red('❌ ZPT navigation failed:', error.message));
            throw error;
        }
    }

    /**
     * Parse and validate ZPT parameters with PPR integration
     * @param {Object} zptParams - Raw ZPT parameters
     * @returns {Object} Parsed and validated ZPT parameters
     */
    parseZPTParameters(zptParams) {
        console.log(chalk.gray('   Parsing ZPT parameters for PPR integration...'));
        
        const parsed = {
            // ZPT Zoom: Controls PPR iteration depth
            zoom: zptParams.zoom || this.options.defaultZoom,
            
            // ZPT Tilt: PPR is a new tilt projection method  
            tilt: zptParams.tilt || this.options.defaultTilt,
            
            // ZPT Pan: Content filtering parameters
            pan: {
                typeFilter: zptParams.typeFilter || this.options.typeFilter,
                sourceFilter: zptParams.sourceFilter || this.options.sourceFilter,
                maxResults: zptParams.maxCorpuscles || this.options.maxCorpuscles,
                similarityThreshold: zptParams.similarityThreshold || this.options.similarityThreshold,
                ...zptParams.pan
            },
            
            // ZPT Transform: Output format options
            transform: {
                includeRelationships: zptParams.includeRelationships !== false,
                includeMetadata: zptParams.includeMetadata !== false,
                outputFormat: zptParams.outputFormat || 'corpuscles',
                ...zptParams.transform
            }
        };

        // Map zoom levels to PPR iteration counts
        parsed.pprIterations = this.mapZoomToPPRIterations(parsed.zoom);
        
        // Validate tilt projection
        if (parsed.tilt === 'ppr-traversal') {
            parsed.usePPR = true;
        } else {
            console.log(chalk.yellow(`   ⚠️  Tilt '${parsed.tilt}' not PPR-based, falling back to traditional navigation`));
            parsed.usePPR = false;
        }

        console.log(chalk.gray(`   ✓ ZPT Parameters: zoom=${parsed.zoom}, tilt=${parsed.tilt}, pan.maxResults=${parsed.pan.maxResults}`));
        console.log(chalk.gray(`   ✓ PPR Configuration: iterations=${parsed.pprIterations}, usePPR=${parsed.usePPR}`));
        
        return parsed;
    }

    /**
     * Map ZPT zoom levels to PPR iteration counts
     * @param {string} zoom - ZPT zoom level
     * @returns {number} PPR iteration count
     */
    mapZoomToPPRIterations(zoom) {
        const zoomMapping = {
            'micro': 1,      // Very shallow, immediate neighbors
            'unit': 2,       // Shallow traversal (traditional shallow)
            'entity': 10,    // Deep traversal (traditional deep)
            'community': 15, // Very deep for community discovery
            'corpus': 20     // Maximum depth for corpus-wide exploration
        };
        
        return zoomMapping[zoom] || this.options.shallowIterations;
    }

    /**
     * Extract navigation entry points from questions
     * @param {Array} questionIds - Optional specific question IDs
     * @returns {Array} Question data for navigation
     */
    async extractNavigationEntryPoints(questionIds = null) {
        console.log(chalk.gray('   Extracting question entry points for ZPT navigation...'));
        
        let questionFilter = '';
        if (questionIds && questionIds.length > 0) {
            const idFilters = questionIds.map(id => `<${id}>`).join(' ');
            questionFilter = `FILTER(?question IN (${idFilters}))`;
        }

        // Query for questions (entry points for navigation)
        const entryPointQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
        ${questionFilter}
    }
}
ORDER BY ?question
`;

        const result = await this.sparqlHelper.executeSelect(entryPointQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract navigation entry points: ${result.error}`);
        }

        const questionData = result.data.results.bindings.map(binding => ({
            questionURI: binding.question.value,
            questionText: binding.questionText.value,
            entryPoints: [binding.question.value] // Question itself as entry point
        }));

        this.stats.questionsNavigated = questionData.length;
        this.stats.seedNodesUsed = questionData.length; // Each question is a seed
        
        console.log(chalk.gray(`   ✓ Found ${questionData.length} navigation entry points`));
        
        return questionData;
    }

    /**
     * Execute ZPT navigation using PPR traversal
     * @param {Object} graph - Graph structure
     * @param {Array} questionData - Question data with entry points
     * @param {Object} zptParams - Parsed ZPT parameters
     * @returns {Array} Navigation results
     */
    async executeZPTNavigation(graph, questionData, zptParams) {
        console.log(chalk.gray(`   Executing PPR traversal for ${questionData.length} questions...`));
        
        const navigationResults = [];

        for (let i = 0; i < questionData.length; i++) {
            const question = questionData[i];
            
            try {
                let traversalResults = [];

                if (zptParams.usePPR && graph.nodes.has(question.questionURI)) {
                    // Use PPR for graph traversal
                    const pprResults = this.ppr.runPPR(
                        graph,
                        question.entryPoints,
                        { maxIterations: zptParams.pprIterations }
                    );

                    this.stats.pprIterations += zptParams.pprIterations;

                    // Process PPR results into ZPT-compatible format
                    if (pprResults && pprResults.rankedNodes) {
                        traversalResults = pprResults.rankedNodes
                            .filter(node => this.applyZPTPanFilters(node, zptParams.pan))
                            .slice(0, zptParams.pan.maxResults)
                            .map(node => ({
                                nodeURI: node.nodeUri,
                                navigationScore: node.score,
                                nodeType: node.type,
                                zptMethod: 'ppr-traversal',
                                zptZoom: zptParams.zoom,
                                distance: Math.round(-Math.log(node.score + 1e-10)) // Convert score to distance-like metric
                            }));
                    }
                } else {
                    // Fallback to traditional similarity-based navigation
                    console.log(chalk.yellow(`   ⚠️  Using fallback navigation for question ${i + 1}`));
                    traversalResults = await this.fallbackNavigation(question, graph, zptParams);
                }

                navigationResults.push({
                    questionURI: question.questionURI,
                    questionText: question.questionText,
                    entryPoints: question.entryPoints,
                    zptView: {
                        zoom: zptParams.zoom,
                        tilt: zptParams.tilt,
                        pan: zptParams.pan,
                        corpuscles: traversalResults
                    },
                    navigationMetadata: {
                        method: zptParams.usePPR ? 'ppr-traversal' : 'fallback',
                        iterations: zptParams.pprIterations,
                        resultCount: traversalResults.length
                    }
                });

                this.stats.corpusclesReturned += traversalResults.length;
                console.log(chalk.gray(`   ✓ Question ${i + 1}/${questionData.length}: ${traversalResults.length} corpuscles found`));

            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Navigation failed for question ${i + 1}: ${error.message}`));
                this.stats.errors.push(`Navigation failed for question ${question.questionURI}: ${error.message}`);
            }
        }

        console.log(chalk.gray(`   ✓ ZPT navigation completed: ${this.stats.corpusclesReturned} total corpuscles`));
        return navigationResults;
    }

    /**
     * Apply ZPT pan filters to navigation results
     * @param {Object} node - Node to filter
     * @param {Object} panParams - ZPT pan parameters
     * @returns {boolean} Whether node passes filters
     */
    applyZPTPanFilters(node, panParams) {
        // Type filter (ZPT pan parameter)
        if (panParams.typeFilter && !node.type.includes(panParams.typeFilter)) {
            return false;
        }
        
        // Source filter (ZPT pan parameter)
        if (panParams.sourceFilter && !node.nodeUri.includes(panParams.sourceFilter)) {
            return false;
        }
        
        // Score threshold (ZPT pan parameter)
        if (panParams.similarityThreshold && node.score < panParams.similarityThreshold) {
            return false;
        }
        
        return true;
    }

    /**
     * Fallback navigation for non-PPR cases
     * @param {Object} question - Question data
     * @param {Object} graph - Graph structure
     * @param {Object} zptParams - ZPT parameters
     * @returns {Array} Fallback navigation results
     */
    async fallbackNavigation(question, graph, zptParams) {
        // Simple graph neighborhood exploration as fallback
        const results = [];
        
        if (graph.adjacency.has(question.questionURI)) {
            const neighbors = Array.from(graph.adjacency.get(question.questionURI));
            
            for (let i = 0; i < Math.min(neighbors.length, zptParams.pan.maxResults); i++) {
                const neighborURI = neighbors[i];
                const node = graph.nodes.get(neighborURI);
                
                results.push({
                    nodeURI: neighborURI,
                    navigationScore: 0.5, // Default score for fallback
                    nodeType: node?.type || 'unknown',
                    zptMethod: 'adjacency-fallback',
                    zptZoom: zptParams.zoom,
                    distance: 1 // Direct neighbor
                });
            }
        }
        
        return results;
    }

    /**
     * Create ZPT-compliant views from navigation results
     * @param {Array} navigationResults - Raw navigation results
     * @param {Object} zptParams - ZPT parameters
     * @returns {Array} ZPT view objects
     */
    async createZPTViews(navigationResults, zptParams) {
        console.log(chalk.gray('   Creating ZPT-compliant views and relationships...'));
        
        const zptViews = [];

        for (const navResult of navigationResults) {
            const zptView = {
                viewURI: `${this.options.zptNamespace}view/${navResult.questionURI.split('/').pop()}_${Date.now()}`,
                questionURI: navResult.questionURI,
                questionText: navResult.questionText,
                
                // ZPT ontology properties
                zptZoom: navResult.zptView.zoom,
                zptTilt: navResult.zptView.tilt,
                zptPan: navResult.zptView.pan,
                zptTransform: zptParams.transform,
                
                // Navigation results
                corpuscles: navResult.zptView.corpuscles,
                entryPoints: navResult.entryPoints,
                metadata: navResult.navigationMetadata,
                
                // ZPT relationships (if enabled)
                relationships: []
            };

            // Create ZPT-compliant relationships between question and found corpuscles
            if (this.options.createRelationships) {
                for (const corpuscle of zptView.corpuscles) {
                    const relationshipURI = `${navResult.questionURI}_zpt_nav_${corpuscle.nodeURI.split('/').pop()}`;
                    
                    zptView.relationships.push({
                        relationshipURI: relationshipURI,
                        sourceURI: navResult.questionURI,
                        targetURI: corpuscle.nodeURI,
                        relationshipType: 'zpt-navigation',
                        weight: corpuscle.navigationScore,
                        zptMethod: corpuscle.zptMethod,
                        zptDistance: corpuscle.distance
                    });
                    
                    this.stats.relationshipsCreated++;
                }
            }

            zptViews.push(zptView);
            this.stats.zptViewsGenerated++;
        }

        console.log(chalk.gray(`   ✓ Created ${zptViews.length} ZPT views with ${this.stats.relationshipsCreated} relationships`));
        return zptViews;
    }

    /**
     * Export ZPT views to SPARQL store
     * @param {Array} zptViews - ZPT view objects
     */
    async exportZPTViews(zptViews) {
        console.log(chalk.gray(`   Exporting ${zptViews.length} ZPT views to SPARQL store...`));
        
        const timestamp = new Date().toISOString();
        let exported = 0;

        try {
            for (const view of zptViews) {
                const triples = [];
                
                // Create ZPT view node
                triples.push(`<${view.viewURI}> rdf:type zpt:View .`);
                triples.push(`<${view.viewURI}> rdfs:label "ZPT Navigation View" .`);
                triples.push(`<${view.viewURI}> zpt:hasZoom "${view.zptZoom}" .`);
                triples.push(`<${view.viewURI}> zpt:hasTilt "${view.zptTilt}" .`);
                triples.push(`<${view.viewURI}> zpt:fromQuestion <${view.questionURI}> .`);
                triples.push(`<${view.viewURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                triples.push(`<${view.viewURI}> prov:wasGeneratedBy "zpt-ppr-navigation" .`);

                // Add corpuscle connections
                for (const corpuscle of view.corpuscles) {
                    triples.push(`<${view.viewURI}> zpt:includesCorpuscle <${corpuscle.nodeURI}> .`);
                }

                // Add relationships
                for (const rel of view.relationships) {
                    triples.push(`<${rel.relationshipURI}> rdf:type ragno:Relationship .`);
                    triples.push(`<${rel.relationshipURI}> ragno:hasSourceEntity <${rel.sourceURI}> .`);
                    triples.push(`<${rel.relationshipURI}> ragno:hasTargetEntity <${rel.targetURI}> .`);
                    triples.push(`<${rel.relationshipURI}> ragno:relationshipType "${rel.relationshipType}" .`);
                    triples.push(`<${rel.relationshipURI}> ragno:weight "${rel.weight.toFixed(6)}" .`);
                    triples.push(`<${rel.relationshipURI}> zpt:navigationMethod "${rel.zptMethod}" .`);
                    triples.push(`<${rel.relationshipURI}> zpt:navigationDistance "${rel.zptDistance}"^^xsd:integer .`);
                    triples.push(`<${rel.relationshipURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                }

                // Execute update
                const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX zpt: <http://purl.org/stuff/zpt/>
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
                    exported++;
                    console.log(chalk.gray(`   ✓ Exported ZPT view ${exported}/${zptViews.length}`));
                } else {
                    this.stats.errors.push(`Failed to export view ${view.viewURI}: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export view: ${result.error}`));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(chalk.gray(`   ✅ Successfully exported ${exported} ZPT views`));

        } catch (error) {
            this.stats.errors.push(`ZPT view export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ ZPT view export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display ZPT navigation results
     * @param {Array} zptViews - ZPT view results
     */
    displayResults(zptViews) {
        console.log('');
        console.log(chalk.bold.white('📊 ZPT Navigation Results:'));
        console.log(`   ${chalk.cyan('Questions Navigated:')} ${chalk.white(this.stats.questionsNavigated)}`);
        console.log(`   ${chalk.cyan('Seed Nodes Used:')} ${chalk.white(this.stats.seedNodesUsed)}`);
        console.log(`   ${chalk.cyan('PPR Iterations:')} ${chalk.white(this.stats.pprIterations)}`);
        console.log(`   ${chalk.cyan('ZPT Views Generated:')} ${chalk.white(this.stats.zptViewsGenerated)}`);
        console.log(`   ${chalk.cyan('Relationships Created:')} ${chalk.white(this.stats.relationshipsCreated)}`);
        console.log(`   ${chalk.cyan('Corpuscles Returned:')} ${chalk.white(this.stats.corpusclesReturned)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display sample ZPT views
        if (zptViews.length > 0) {
            console.log(chalk.bold.white('🧭 Sample ZPT Navigation Views:'));
            
            for (let i = 0; i < Math.min(zptViews.length, 3); i++) {
                const view = zptViews[i];
                const shortQuestion = view.questionText.length > 60 
                    ? view.questionText.substring(0, 60) + '...'
                    : view.questionText;
                    
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortQuestion)}`);
                console.log(`      ${chalk.gray('ZPT:')} zoom=${chalk.white(view.zptZoom)}, tilt=${chalk.white(view.zptTilt)}`);
                console.log(`      ${chalk.gray('Corpuscles:')} ${chalk.white(view.corpuscles.length)} ${chalk.gray('Relationships:')} ${chalk.white(view.relationships.length)}`);
                
                // Show top 3 navigation results
                for (let j = 0; j < Math.min(view.corpuscles.length, 3); j++) {
                    const corpuscle = view.corpuscles[j];
                    const shortURI = corpuscle.nodeURI.split('/').pop();
                    console.log(`        ${chalk.cyan(`${j + 1}:`)} ${chalk.white(shortURI)} ${chalk.gray(`(score: ${corpuscle.navigationScore.toFixed(4)}, dist: ${corpuscle.distance})`)}`);
                }
            }
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function runZPTNavigation() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            
            // ZPT configuration
            defaultZoom: 'entity',
            defaultTilt: 'ppr-traversal',
            maxCorpuscles: 6,
            similarityThreshold: 0.3,
            
            // PPR configuration
            alpha: 0.15,
            shallowIterations: 2,
            deepIterations: 10,
            
            // Output configuration
            createRelationships: true,
            exportToSPARQL: true
        };

        // Sample ZPT parameters
        const zptParams = {
            zoom: 'entity',
            tilt: 'ppr-traversal',
            pan: {
                maxResults: 6,
                similarityThreshold: 0.3
            },
            transform: {
                includeRelationships: true,
                outputFormat: 'corpuscles'
            }
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('ZPT Zoom:')} ${chalk.white(zptParams.zoom)}`);
        console.log(`   ${chalk.cyan('ZPT Tilt:')} ${chalk.white(zptParams.tilt)}`);
        console.log(`   ${chalk.cyan('PPR Alpha:')} ${chalk.white(config.alpha)}`);
        console.log(`   ${chalk.cyan('Max Corpuscles:')} ${chalk.white(config.maxCorpuscles)}`);
        console.log(`   ${chalk.cyan('Create Relationships:')} ${chalk.white(config.createRelationships ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Export to SPARQL:')} ${chalk.white(config.exportToSPARQL ? 'Yes' : 'No')}`);
        console.log('');

        const navigator = new GraphNavigate(config);
        const result = await navigator.runZPTNavigation(null, zptParams);

        if (result.success) {
            console.log(chalk.green('🎉 ZPT navigation with PPR completed successfully!'));
            console.log(chalk.white('ZPT views and relationships have been stored in the SPARQL store.'));
        } else {
            console.log(chalk.yellow('⚠️  ZPT navigation completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ ZPT navigation failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { GraphNavigate };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runZPTNavigation().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}