#!/usr/bin/env node

/**
 * SemanticSearch.js - PPR-based Search for BeerQA Question Enhancement
 * 
 * This script implements Personalized PageRank (PPR) for multi-hop traversal from
 * question concepts to related Wikipedia content. It provides type-aware search
 * functionality that can prioritize certain ragno types in results and integrates
 * with existing similarity thresholds for enhanced target discovery.
 * 
 * Key Features:
 * - Multi-hop traversal using Personalized PageRank algorithm
 * - Type-aware search (prefer entities, corpuscles, or specific types)
 * - Integration with existing similarity and ranking scores
 * - Question-to-Wikipedia content linking via graph relationships
 * - Configurable search depth and result filtering
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import PersonalizedPageRank from '../../../src/ragno/algorithms/PersonalizedPageRank.js';
import { CorpuscleRanking } from './CorpuscleRanking.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🔍 SEMANTIC SEARCH                           ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    PPR-based multi-hop traversal for question enhancement  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * SemanticSearch class for PPR-based content discovery
 */
class SemanticSearch {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            
            // PPR algorithm options
            alpha: options.alpha || 0.15, // Damping factor
            shallowIterations: options.shallowIterations || 2,
            deepIterations: options.deepIterations || 10,
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            
            // Search options
            topKPerType: options.topKPerType || 5,
            preferredTypes: options.preferredTypes || ['ragno:Corpuscle', 'ragno:Entity'],
            boostImportanceRankings: options.boostImportanceRankings !== false,
            minPPRScore: options.minPPRScore || 0.001,
            
            // Integration options
            combineWithSimilarity: options.combineWithSimilarity !== false,
            exportResults: options.exportResults !== false,
            
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
            questionsProcessed: 0,
            conceptsExtracted: 0,
            pprIterations: 0,
            resultsGenerated: 0,
            typeFilteredResults: 0,
            boostedResults: 0,
            exportedResults: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Run semantic search for BeerQA questions
     * @param {Array} questionIds - Optional array of specific question IDs to process
     * @returns {Object} Search results and statistics
     */
    async runSemanticSearch(questionIds = null) {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting semantic search analysis...'));

        try {
            // Phase 1: Build corpuscle graph (reuse from CorpuscleRanking)
            console.log(chalk.white('📊 Building corpuscle relationship graph...'));
            const graphData = await this.corpuscleRanking.buildCorpuscleGraph();
            
            if (graphData.nodeCount === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles found - no search to perform'));
                return { success: false, message: 'No corpuscles found' };
            }

            // Phase 2: Extract question concepts as seed nodes
            console.log(chalk.white('📝 Extracting question concepts as PPR seed nodes...'));
            const questionData = await this.extractQuestionConcepts(questionIds);

            if (questionData.length === 0) {
                console.log(chalk.yellow('⚠️  No questions found - no search to perform'));
                return { success: false, message: 'No questions found' };
            }

            // Phase 3: Run PPR-based search for each question
            console.log(chalk.white('🔍 Running PPR-based semantic search...'));
            const searchResults = await this.runPPRSearch(graphData.graph, questionData);

            // Phase 4: Apply type preferences and ranking boosts
            console.log(chalk.white('🎯 Applying type preferences and importance rankings...'));
            const enhancedResults = await this.enhanceSearchResults(searchResults);

            // Phase 5: Export results to SPARQL store
            if (this.options.exportResults && enhancedResults.length > 0) {
                console.log(chalk.white('💾 Exporting search results to SPARQL store...'));
                await this.exportSearchResults(enhancedResults);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Semantic search completed successfully'));
            this.displayResults(enhancedResults);

            return {
                success: true,
                searchResults: enhancedResults,
                graphData: graphData,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Semantic search failed: ${error.message}`);
            console.log(chalk.red('❌ Semantic search failed:', error.message));
            throw error;
        }
    }

    /**
     * Extract question concepts to use as PPR seed nodes
     * @param {Array} questionIds - Optional specific question IDs
     * @returns {Array} Array of question data with concepts
     */
    async extractQuestionConcepts(questionIds = null) {
        console.log(chalk.gray('   Extracting question concepts for PPR seeds...'));
        
        let questionFilter = '';
        if (questionIds && questionIds.length > 0) {
            const idFilters = questionIds.map(id => `<${id}>`).join(' ');
            questionFilter = `FILTER(?question IN (${idFilters}))`;
        }

        // Query for questions and their concept relationships
        const conceptQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?concept ?conceptText ?relationshipType
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
        ${questionFilter}
        
        OPTIONAL {
            ?relationship a ragno:Relationship ;
                         ragno:hasSourceEntity ?question ;
                         ragno:hasTargetEntity ?concept ;
                         ragno:relationshipType ?relationshipType .
            ?concept rdfs:label ?conceptText .
        }
    }
}
ORDER BY ?question ?concept
`;

        const result = await this.sparqlHelper.executeSelect(conceptQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract question concepts: ${result.error}`);
        }

        // Group concepts by question
        const questionMap = new Map();
        
        for (const binding of result.data.results.bindings) {
            const questionURI = binding.question.value;
            const questionText = binding.questionText.value;
            
            if (!questionMap.has(questionURI)) {
                questionMap.set(questionURI, {
                    questionURI: questionURI,
                    questionText: questionText,
                    concepts: []
                });
            }
            
            // Add concept if available
            if (binding.concept?.value) {
                const concept = {
                    conceptURI: binding.concept.value,
                    conceptText: binding.conceptText?.value || '',
                    relationshipType: binding.relationshipType?.value || 'related'
                };
                
                // Avoid duplicates
                const existingConcept = questionMap.get(questionURI).concepts.find(
                    c => c.conceptURI === concept.conceptURI
                );
                if (!existingConcept) {
                    questionMap.get(questionURI).concepts.push(concept);
                }
            }
        }

        const questionData = Array.from(questionMap.values());
        this.stats.questionsProcessed = questionData.length;
        this.stats.conceptsExtracted = questionData.reduce((sum, q) => sum + q.concepts.length, 0);
        
        console.log(chalk.gray(`   ✓ Found ${questionData.length} questions with ${this.stats.conceptsExtracted} total concepts`));
        
        return questionData;
    }

    /**
     * Run PPR search for each question's concepts
     * @param {Object} graph - Graph structure
     * @param {Array} questionData - Question data with concepts
     * @returns {Array} PPR search results
     */
    async runPPRSearch(graph, questionData) {
        console.log(chalk.gray(`   Running PPR for ${questionData.length} questions...`));
        
        const searchResults = [];

        for (let i = 0; i < questionData.length; i++) {
            const question = questionData[i];
            
            try {
                // Create seed nodes from question concepts
                const seedNodes = new Map();
                
                // Add the question itself as a seed
                if (graph.nodes.has(question.questionURI)) {
                    seedNodes.set(question.questionURI, 0.5);
                }
                
                // Add related concepts as seeds with lower weights
                const conceptWeight = question.concepts.length > 0 ? 0.5 / question.concepts.length : 0;
                for (const concept of question.concepts) {
                    if (graph.nodes.has(concept.conceptURI)) {
                        seedNodes.set(concept.conceptURI, conceptWeight);
                    }
                }

                if (seedNodes.size === 0) {
                    console.log(chalk.yellow(`   ⚠️  No seed nodes found for question ${i + 1}`));
                    continue;
                }

                // Convert seed nodes map to array for PPR
                const entryPoints = Array.from(seedNodes.keys());

                // Run PPR with shallow iterations first
                const shallowPPR = this.ppr.runPPR(
                    graph, 
                    entryPoints, 
                    { maxIterations: this.options.shallowIterations }
                );

                // Run deep PPR for better results
                const deepPPR = this.ppr.runPPR(
                    graph, 
                    entryPoints, 
                    { maxIterations: this.options.deepIterations }
                );

                this.stats.pprIterations += this.options.shallowIterations + this.options.deepIterations;

                // Filter results by minimum score
                const filteredResults = [];
                if (deepPPR && deepPPR.scores) {
                    for (const [nodeURI, score] of deepPPR.scores) {
                        if (score >= this.options.minPPRScore && !seedNodes.has(nodeURI)) {
                            const node = graph.nodes.get(nodeURI);
                            filteredResults.push({
                                nodeURI: nodeURI,
                                pprScore: score,
                                shallowScore: shallowPPR?.scores?.get(nodeURI) || 0,
                                nodeType: node?.type || 'unknown',
                                nodeLabel: node?.label || '',
                                nodeSource: node?.source || 'unknown'
                            });
                        }
                    }

                    // Sort by PPR score
                    filteredResults.sort((a, b) => b.pprScore - a.pprScore);
                }

                searchResults.push({
                    questionURI: question.questionURI,
                    questionText: question.questionText,
                    conceptCount: question.concepts.length,
                    seedCount: seedNodes.size,
                    results: filteredResults,
                    iterations: (shallowPPR?.options?.iterations || 0) + (deepPPR?.options?.iterations || 0),
                    convergence: {
                        shallow: shallowPPR?.converged || false,
                        deep: deepPPR?.converged || false
                    }
                });

                this.stats.resultsGenerated += filteredResults.length;
                console.log(chalk.gray(`   ✓ Question ${i + 1}/${questionData.length}: ${filteredResults.length} results (${seedNodes.size} seeds)`));

            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  PPR failed for question ${i + 1}: ${error.message}`));
                this.stats.errors.push(`PPR failed for question ${question.questionURI}: ${error.message}`);
            }
        }

        console.log(chalk.gray(`   ✓ PPR completed: ${this.stats.resultsGenerated} total results`));
        return searchResults;
    }

    /**
     * Enhance search results with type preferences and importance rankings
     * @param {Array} searchResults - Raw PPR search results
     * @returns {Array} Enhanced search results
     */
    async enhanceSearchResults(searchResults) {
        console.log(chalk.gray('   Enhancing results with type preferences and rankings...'));
        
        // Query for existing importance rankings if boost is enabled
        let importanceRankings = new Map();
        if (this.options.boostImportanceRankings) {
            const rankingQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?compositeScore ?rank
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {\
        ?corpuscle ragno:hasAttribute ?ranking .
        ?ranking ragno:attributeType "corpuscle-importance-ranking" ;
                ragno:attributeValue ?compositeScore ;
                ragno:rank ?rank .
    }
}
`;

            const rankingResult = await this.sparqlHelper.executeSelect(rankingQuery);
            if (rankingResult.success) {
                for (const binding of rankingResult.data.results.bindings) {
                    importanceRankings.set(binding.corpuscle.value, {
                        compositeScore: parseFloat(binding.compositeScore.value),
                        rank: parseInt(binding.rank.value)
                    });
                }
                console.log(chalk.gray(`   ✓ Found ${importanceRankings.size} importance rankings`));
            }
        }

        const enhancedResults = [];

        for (const questionResult of searchResults) {
            // Group results by type
            const typeGroups = new Map();
            
            for (const result of questionResult.results) {
                const nodeType = result.nodeType;
                if (!typeGroups.has(nodeType)) {
                    typeGroups.set(nodeType, []);
                }
                
                // Calculate enhanced score
                let enhancedScore = result.pprScore;
                
                // Apply type preference boost
                if (this.options.preferredTypes.includes(nodeType)) {
                    enhancedScore *= 1.5;
                }
                
                // Apply importance ranking boost
                if (importanceRankings.has(result.nodeURI)) {
                    const ranking = importanceRankings.get(result.nodeURI);
                    const rankingBoost = 1 + (ranking.compositeScore * 0.3); // 30% max boost
                    enhancedScore *= rankingBoost;
                    result.importanceRanking = ranking;
                    this.stats.boostedResults++;
                }

                result.enhancedScore = enhancedScore;
                typeGroups.get(nodeType).push(result);
            }

            // Select top-K per type
            const finalResults = [];
            for (const [nodeType, results] of typeGroups) {
                // Sort by enhanced score
                results.sort((a, b) => b.enhancedScore - a.enhancedScore);
                
                // Take top-K for this type
                const topK = results.slice(0, this.options.topKPerType);
                finalResults.push(...topK);
                
                this.stats.typeFilteredResults += topK.length;
            }

            // Final sort by enhanced score
            finalResults.sort((a, b) => b.enhancedScore - a.enhancedScore);

            enhancedResults.push({
                ...questionResult,
                enhancedResults: finalResults,
                typeDistribution: Object.fromEntries(typeGroups.entries().map(([type, results]) => [type, results.length]))
            });
        }

        console.log(chalk.gray(`   ✓ Enhanced ${this.stats.typeFilteredResults} results (${this.stats.boostedResults} with ranking boost)`));
        return enhancedResults;
    }

    /**
     * Export search results to SPARQL store
     * @param {Array} enhancedResults - Enhanced search results
     */
    async exportSearchResults(enhancedResults) {
        console.log(chalk.gray(`   Exporting search results for ${enhancedResults.length} questions...`));
        
        const timestamp = new Date().toISOString();
        let exported = 0;

        try {
            for (const questionResult of enhancedResults) {
                const triples = [];
                
                for (let i = 0; i < Math.min(questionResult.enhancedResults.length, 10); i++) {
                    const result = questionResult.enhancedResults[i];
                    const searchResultURI = `${questionResult.questionURI}_ppr_result_${i + 1}_${Date.now()}`;
                    
                    // Create search result attribute
                    triples.push(`<${searchResultURI}> rdf:type ragno:Attribute .`);
                    triples.push(`<${searchResultURI}> rdfs:label "ppr-search-result" .`);
                    triples.push(`<${searchResultURI}> ragno:attributeType "ppr-search-result" .`);
                    triples.push(`<${searchResultURI}> ragno:attributeValue "${result.enhancedScore.toFixed(6)}" .`);
                    triples.push(`<${searchResultURI}> ragno:pprScore "${result.pprScore.toFixed(6)}" .`);
                    triples.push(`<${searchResultURI}> ragno:resultRank "${i + 1}"^^xsd:integer .`);
                    triples.push(`<${searchResultURI}> ragno:targetNode <${result.nodeURI}> .`);
                    triples.push(`<${searchResultURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    triples.push(`<${searchResultURI}> prov:wasGeneratedBy "ppr-semantic-search" .`);
                    
                    // Link to question
                    triples.push(`<${questionResult.questionURI}> ragno:hasAttribute <${searchResultURI}> .`);
                    triples.push(`<${searchResultURI}> ragno:describesCorpuscle <${questionResult.questionURI}> .`);
                }

                // Execute update
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
                    exported++;
                    console.log(chalk.gray(`   ✓ Exported results for question ${exported}/${enhancedResults.length}`));
                } else {
                    this.stats.errors.push(`Failed to export question ${questionResult.questionURI}: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export question results: ${result.error}`));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.exportedResults = exported;
            console.log(chalk.gray(`   ✅ Successfully exported ${exported} question results`));

        } catch (error) {
            this.stats.errors.push(`Search result export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Search result export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display search results
     * @param {Array} enhancedResults - Enhanced search results
     */
    displayResults(enhancedResults) {
        console.log('');
        console.log(chalk.bold.white('📊 Semantic Search Results:'));
        console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(this.stats.questionsProcessed)}`);
        console.log(`   ${chalk.cyan('Concepts Extracted:')} ${chalk.white(this.stats.conceptsExtracted)}`);
        console.log(`   ${chalk.cyan('PPR Iterations:')} ${chalk.white(this.stats.pprIterations)}`);
        console.log(`   ${chalk.cyan('Results Generated:')} ${chalk.white(this.stats.resultsGenerated)}`);
        console.log(`   ${chalk.cyan('Type-Filtered Results:')} ${chalk.white(this.stats.typeFilteredResults)}`);
        console.log(`   ${chalk.cyan('Boosted Results:')} ${chalk.white(this.stats.boostedResults)}`);
        console.log(`   ${chalk.cyan('Exported Results:')} ${chalk.white(this.stats.exportedResults)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display sample results
        if (enhancedResults.length > 0) {
            console.log(chalk.bold.white('🔍 Sample Search Results:'));
            
            for (let i = 0; i < Math.min(enhancedResults.length, 3); i++) {
                const questionResult = enhancedResults[i];
                const shortQuestion = questionResult.questionText.length > 60 
                    ? questionResult.questionText.substring(0, 60) + '...'
                    : questionResult.questionText;
                    
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortQuestion)}`);
                console.log(`      ${chalk.gray('Seeds:')} ${chalk.white(questionResult.seedCount)} ${chalk.gray('Results:')} ${chalk.white(questionResult.enhancedResults.length)}`);
                
                // Show top 3 results
                for (let j = 0; j < Math.min(questionResult.enhancedResults.length, 3); j++) {
                    const result = questionResult.enhancedResults[j];
                    const shortLabel = result.nodeLabel.length > 40 
                        ? result.nodeLabel.substring(0, 40) + '...'
                        : result.nodeLabel;
                    console.log(`        ${chalk.cyan(`${j + 1}:`)} ${chalk.white(shortLabel)} ${chalk.gray(`(${result.enhancedScore.toFixed(4)})`)}`);
                }
            }
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function runSemanticSearch() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            
            // PPR configuration
            alpha: 0.15,
            shallowIterations: 2,
            deepIterations: 10,
            convergenceThreshold: 1e-6,
            
            // Search configuration
            topKPerType: 5,
            preferredTypes: ['ragno:Corpuscle'],
            boostImportanceRankings: true,
            minPPRScore: 0.001,
            
            // Export configuration
            exportResults: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('PPR Alpha:')} ${chalk.white(config.alpha)}`);
        console.log(`   ${chalk.cyan('Deep Iterations:')} ${chalk.white(config.deepIterations)}`);
        console.log(`   ${chalk.cyan('Top-K Per Type:')} ${chalk.white(config.topKPerType)}`);
        console.log(`   ${chalk.cyan('Boost Rankings:')} ${chalk.white(config.boostImportanceRankings ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Export Results:')} ${chalk.white(config.exportResults ? 'Yes' : 'No')}`);
        console.log('');

        const searcher = new SemanticSearch(config);
        const result = await searcher.runSemanticSearch();

        if (result.success) {
            console.log(chalk.green('🎉 Semantic search completed successfully!'));
            console.log(chalk.white('PPR-based search results have been stored in the SPARQL store.'));
        } else {
            console.log(chalk.yellow('⚠️  Semantic search completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Semantic search failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { SemanticSearch };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runSemanticSearch().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}