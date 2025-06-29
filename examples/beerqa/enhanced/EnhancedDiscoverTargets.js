#!/usr/bin/env node

/**
 * EnhancedDiscoverTargets.js - Graph-Enhanced Target Discovery for BeerQA
 * 
 * This script enhances the existing DiscoverTargets.js workflow by incorporating
 * graph analytics results from Phase 1. It combines traditional similarity search
 * with structural importance rankings and community membership to identify
 * more relevant Wikipedia targets for question answering.
 * 
 * Key Features:
 * - Maintains backward compatibility with existing DiscoverTargets.js
 * - Integrates corpuscle importance rankings from CorpuscleRanking.js
 * - Uses PPR search results from SemanticSearch.js for multi-hop discovery
 * - Applies community-aware boosting from CommunityAnalysis.js
 * - Configurable fallback to baseline similarity search
 * - Enhanced scoring that combines similarity + structural importance + community relevance
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🎯 ENHANCED DISCOVER TARGETS                  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Graph-enhanced target discovery with structural ranking  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * EnhancedDiscoverTargets class for graph-enhanced target discovery
 */
class EnhancedDiscoverTargets {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            
            // Enhanced discovery options
            useImportanceRankings: options.useImportanceRankings !== false,
            usePPRResults: options.usePPRResults !== false,
            useCommunityBoosts: options.useCommunityBoosts !== false,
            fallbackToBaseline: options.fallbackToBaseline !== false,
            
            // Scoring weights
            similarityWeight: options.similarityWeight || 0.4,
            importanceWeight: options.importanceWeight || 0.3,
            pprWeight: options.pprWeight || 0.2,
            communityWeight: options.communityWeight || 0.1,
            
            // Baseline compatibility options  
            maxTargetsPerQuestion: options.maxTargetsPerQuestion || 15,
            similarityThreshold: options.similarityThreshold || 0.3,
            conceptMatchThreshold: options.conceptMatchThreshold || 0.4,
            
            // Enhanced filtering options
            boostFactorThreshold: options.boostFactorThreshold || 1.2,
            diversityBonus: options.diversityBonus || 0.1,
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            questionsProcessed: 0,
            baselineTargetsFound: 0,
            importanceBoosts: 0,
            pprBoosts: 0,
            communityBoosts: 0,
            enhancedTargetsGenerated: 0,
            fallbacksUsed: 0,
            processingTime: 0,
            errors: []
        };

        // Cache for graph analytics results
        this.cache = {
            importanceRankings: new Map(),
            pprResults: new Map(),
            communityMemberships: new Map(),
            loaded: false
        };
    }

    /**
     * Run enhanced target discovery for BeerQA questions
     * @param {Array} questionIds - Optional array of specific question IDs to process
     * @returns {Object} Enhanced target discovery results
     */
    async runEnhancedDiscovery(questionIds = null) {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting enhanced target discovery...'));

        try {
            // Phase 1: Load graph analytics results into cache
            console.log(chalk.white('📊 Loading graph analytics results...'));
            await this.loadGraphAnalyticsCache();

            // Phase 2: Get baseline similarity targets
            console.log(chalk.white('🎯 Discovering baseline similarity targets...'));
            const baselineTargets = await this.getBaselineSimilarityTargets(questionIds);

            if (baselineTargets.length === 0) {
                console.log(chalk.yellow('⚠️  No baseline targets found'));
                return { success: false, message: 'No baseline targets found' };
            }

            // Phase 3: Apply graph-based enhancements
            console.log(chalk.white('🧮 Applying graph analytics enhancements...'));
            const enhancedTargets = await this.applyGraphEnhancements(baselineTargets);

            // Phase 4: Final ranking and selection
            console.log(chalk.white('🏆 Final ranking and target selection...'));
            const finalTargets = this.rankAndSelectTargets(enhancedTargets);

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Enhanced target discovery completed successfully'));
            this.displayResults(finalTargets);

            return {
                success: true,
                enhancedTargets: finalTargets,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Enhanced discovery failed: ${error.message}`);
            console.log(chalk.red('❌ Enhanced target discovery failed:', error.message));
            throw error;
        }
    }

    /**
     * Load graph analytics results into cache for efficient access
     */
    async loadGraphAnalyticsCache() {
        console.log(chalk.gray('   Loading importance rankings...'));
        
        // Load importance rankings
        if (this.options.useImportanceRankings) {
            const importanceQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?compositeScore ?rank ?kCoreScore ?centralityScore
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle ragno:hasAttribute ?ranking .
        ?ranking ragno:attributeType "corpuscle-importance-ranking" ;
                ragno:attributeValue ?compositeScore ;
                ragno:rank ?rank .
        OPTIONAL { ?ranking ragno:kCoreScore ?kCoreScore }
        OPTIONAL { ?ranking ragno:centralityScore ?centralityScore }
    }
}
ORDER BY ?rank
`;

            const importanceResult = await this.sparqlHelper.executeSelect(importanceQuery);
            if (importanceResult.success) {
                for (const binding of importanceResult.data.results.bindings) {
                    this.cache.importanceRankings.set(binding.corpuscle.value, {
                        compositeScore: parseFloat(binding.compositeScore.value),
                        rank: parseInt(binding.rank.value),
                        kCoreScore: binding.kCoreScore ? parseFloat(binding.kCoreScore.value) : 0,
                        centralityScore: binding.centralityScore ? parseFloat(binding.centralityScore.value) : 0
                    });
                }
                console.log(chalk.gray(`   ✓ Loaded ${this.cache.importanceRankings.size} importance rankings`));
            }
        }

        // Load PPR search results
        if (this.options.usePPRResults) {
            console.log(chalk.gray('   Loading PPR search results...'));
            
            const pprQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?question ?target ?pprScore ?enhancedScore ?rank
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?question ragno:hasAttribute ?pprResult .
        ?pprResult ragno:attributeType "ppr-search-result" ;
                  ragno:attributeValue ?enhancedScore ;
                  ragno:pprScore ?pprScore ;
                  ragno:resultRank ?rank ;
                  ragno:targetNode ?target .
    }
}
ORDER BY ?question ?rank
`;

            const pprResult = await this.sparqlHelper.executeSelect(pprQuery);
            if (pprResult.success) {
                for (const binding of pprResult.data.results.bindings) {
                    const questionURI = binding.question.value;
                    if (!this.cache.pprResults.has(questionURI)) {
                        this.cache.pprResults.set(questionURI, []);
                    }
                    this.cache.pprResults.get(questionURI).push({
                        targetURI: binding.target.value,
                        pprScore: parseFloat(binding.pprScore.value),
                        enhancedScore: parseFloat(binding.enhancedScore.value),
                        rank: parseInt(binding.rank.value)
                    });
                }
                console.log(chalk.gray(`   ✓ Loaded PPR results for ${this.cache.pprResults.size} questions`));
            }
        }

        // Load community memberships
        if (this.options.useCommunityBoosts) {
            console.log(chalk.gray('   Loading community memberships...'));
            
            const communityQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?community ?communitySize
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle ragno:inCommunity ?community .
        ?community ragno:communitySize ?communitySize .
    }
}
`;

            const communityResult = await this.sparqlHelper.executeSelect(communityQuery);
            if (communityResult.success) {
                for (const binding of communityResult.data.results.bindings) {
                    const corpuscleURI = binding.corpuscle.value;
                    if (!this.cache.communityMemberships.has(corpuscleURI)) {
                        this.cache.communityMemberships.set(corpuscleURI, []);
                    }
                    this.cache.communityMemberships.get(corpuscleURI).push({
                        communityURI: binding.community.value,
                        communitySize: parseInt(binding.communitySize.value)
                    });
                }
                console.log(chalk.gray(`   ✓ Loaded community memberships for ${this.cache.communityMemberships.size} corpuscles`));
            }
        }

        this.cache.loaded = true;
    }

    /**
     * Get baseline similarity targets using traditional approach
     * @param {Array} questionIds - Optional specific question IDs
     * @returns {Array} Baseline target results
     */
    async getBaselineSimilarityTargets(questionIds = null) {
        console.log(chalk.gray('   Executing baseline similarity search...'));
        
        let questionFilter = '';
        if (questionIds && questionIds.length > 0) {
            const idFilters = questionIds.map(id => `<${id}>`).join(' ');
            questionFilter = `FILTER(?question IN (${idFilters}))`;
        }

        // Query for similarity relationships (mimic existing DiscoverTargets.js logic)
        const similarityQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?target ?targetText ?similarity ?relationshipType
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
        ${questionFilter}
    }
    
    # Look for similarity relationships to Wikipedia targets
    OPTIONAL {
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?target ;
                     ragno:weight ?similarity ;
                     ragno:relationshipType ?relationshipType .
        
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?target a ragno:Corpuscle ;
                   rdfs:label ?targetText .
        }
        
        FILTER(?similarity >= ${this.options.similarityThreshold} && (?relationshipType = "similarity" || ?relationshipType = "community-bridge"))
    }
}
ORDER BY ?question DESC(?similarity)
`;

        const result = await this.sparqlHelper.executeSelect(similarityQuery);
        
        if (!result.success) {
            throw new Error(`Failed to execute baseline similarity query: ${result.error}`);
        }

        // Group results by question
        const questionTargets = new Map();
        
        for (const binding of result.data.results.bindings) {
            const questionURI = binding.question.value;
            const questionText = binding.questionText.value;
            
            if (!questionTargets.has(questionURI)) {
                questionTargets.set(questionURI, {
                    questionURI: questionURI,
                    questionText: questionText,
                    targets: []
                });
            }
            
            // Add target if similarity relationship exists
            if (binding.target?.value) {
                questionTargets.get(questionURI).targets.push({
                    targetURI: binding.target.value,
                    targetText: binding.targetText.value,
                    baselineSimilarity: parseFloat(binding.similarity.value),
                    relationshipType: binding.relationshipType.value,
                    enhancedScore: parseFloat(binding.similarity.value), // Will be enhanced later
                    boostFactors: {
                        importance: 1.0,
                        ppr: 1.0,
                        community: 1.0
                    }
                });
                this.stats.baselineTargetsFound++;
            }
        }

        this.stats.questionsProcessed = questionTargets.size;
        const allTargets = Array.from(questionTargets.values());
        
        console.log(chalk.gray(`   ✓ Found ${this.stats.baselineTargetsFound} baseline targets for ${this.stats.questionsProcessed} questions`));
        
        return allTargets;
    }

    /**
     * Apply graph analytics enhancements to baseline targets
     * @param {Array} baselineTargets - Baseline target results
     * @returns {Array} Enhanced target results
     */
    async applyGraphEnhancements(baselineTargets) {
        console.log(chalk.gray('   Applying importance ranking boosts...'));
        
        for (const questionResult of baselineTargets) {
            for (const target of questionResult.targets) {
                let enhancedScore = target.baselineSimilarity * this.options.similarityWeight;
                
                // Apply importance ranking boost
                if (this.cache.importanceRankings.has(target.targetURI)) {
                    const ranking = this.cache.importanceRankings.get(target.targetURI);
                    const importanceBoost = 1 + (ranking.compositeScore * this.options.importanceWeight);
                    target.boostFactors.importance = importanceBoost;
                    enhancedScore += ranking.compositeScore * this.options.importanceWeight;
                    this.stats.importanceBoosts++;
                }
                
                // Apply PPR search boost
                if (this.cache.pprResults.has(questionResult.questionURI)) {
                    const pprResults = this.cache.pprResults.get(questionResult.questionURI);
                    const pprMatch = pprResults.find(ppr => ppr.targetURI === target.targetURI);
                    if (pprMatch) {
                        const pprBoost = 1 + (pprMatch.enhancedScore * this.options.pprWeight);
                        target.boostFactors.ppr = pprBoost;
                        enhancedScore += pprMatch.enhancedScore * this.options.pprWeight;
                        target.pprRank = pprMatch.rank;
                        this.stats.pprBoosts++;
                    }
                }
                
                // Apply community boost
                if (this.cache.communityMemberships.has(target.targetURI)) {
                    const communities = this.cache.communityMemberships.get(target.targetURI);
                    // Boost based on largest community membership
                    const maxCommunitySize = Math.max(...communities.map(c => c.communitySize));
                    const communityBoost = 1 + (Math.log(maxCommunitySize) * this.options.communityWeight);
                    target.boostFactors.community = communityBoost;
                    enhancedScore += Math.log(maxCommunitySize) * this.options.communityWeight;
                    target.communityCount = communities.length;
                    this.stats.communityBoosts++;
                }
                
                // Calculate final enhanced score
                target.enhancedScore = enhancedScore;
                this.stats.enhancedTargetsGenerated++;
            }
            
            // Sort targets by enhanced score
            questionResult.targets.sort((a, b) => b.enhancedScore - a.enhancedScore);
        }

        console.log(chalk.gray(`   ✓ Applied enhancements: ${this.stats.importanceBoosts} importance, ${this.stats.pprBoosts} PPR, ${this.stats.communityBoosts} community boosts`));
        
        return baselineTargets;
    }

    /**
     * Final ranking and target selection with diversity considerations
     * @param {Array} enhancedTargets - Enhanced target results
     * @returns {Array} Final ranked targets
     */
    rankAndSelectTargets(enhancedTargets) {
        console.log(chalk.gray('   Performing final ranking and selection...'));
        
        for (const questionResult of enhancedTargets) {
            // Apply diversity bonus (prefer targets from different sources/types)
            const seenSources = new Set();
            for (const target of questionResult.targets) {
                const source = target.targetURI.includes('wikipedia') ? 'wikipedia' : 'other';
                if (!seenSources.has(source)) {
                    target.enhancedScore += this.options.diversityBonus;
                    seenSources.add(source);
                }
            }
            
            // Final sort and limit to max targets per question
            questionResult.targets.sort((a, b) => b.enhancedScore - a.enhancedScore);
            questionResult.targets = questionResult.targets.slice(0, this.options.maxTargetsPerQuestion);
            
            // Mark significantly boosted targets
            for (const target of questionResult.targets) {
                const totalBoostFactor = target.boostFactors.importance * target.boostFactors.ppr * target.boostFactors.community;
                target.significantlyBoosted = totalBoostFactor >= this.options.boostFactorThreshold;
            }
        }

        console.log(chalk.gray(`   ✓ Final selection completed`));
        
        return enhancedTargets;
    }

    /**
     * Display enhanced discovery results
     * @param {Array} finalTargets - Final target results
     */
    displayResults(finalTargets) {
        console.log('');
        console.log(chalk.bold.white('📊 Enhanced Target Discovery Results:'));
        console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(this.stats.questionsProcessed)}`);
        console.log(`   ${chalk.cyan('Baseline Targets Found:')} ${chalk.white(this.stats.baselineTargetsFound)}`);
        console.log(`   ${chalk.cyan('Importance Boosts Applied:')} ${chalk.white(this.stats.importanceBoosts)}`);
        console.log(`   ${chalk.cyan('PPR Boosts Applied:')} ${chalk.white(this.stats.pprBoosts)}`);
        console.log(`   ${chalk.cyan('Community Boosts Applied:')} ${chalk.white(this.stats.communityBoosts)}`);
        console.log(`   ${chalk.cyan('Enhanced Targets Generated:')} ${chalk.white(this.stats.enhancedTargetsGenerated)}`);
        console.log(`   ${chalk.cyan('Fallbacks Used:')} ${chalk.white(this.stats.fallbacksUsed)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display sample enhanced targets
        if (finalTargets.length > 0) {
            console.log(chalk.bold.white('🎯 Sample Enhanced Targets:'));
            
            for (let i = 0; i < Math.min(finalTargets.length, 3); i++) {
                const questionResult = finalTargets[i];
                const shortQuestion = questionResult.questionText.length > 60 
                    ? questionResult.questionText.substring(0, 60) + '...'
                    : questionResult.questionText;
                    
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortQuestion)}`);
                console.log(`      ${chalk.gray('Targets:')} ${chalk.white(questionResult.targets.length)}`);
                
                // Show top 3 targets with enhancement details
                for (let j = 0; j < Math.min(questionResult.targets.length, 3); j++) {
                    const target = questionResult.targets[j];
                    const shortTarget = target.targetText.length > 40 
                        ? target.targetText.substring(0, 40) + '...'
                        : target.targetText;
                    const boostIndicator = target.significantlyBoosted ? '🚀' : '';
                    console.log(`        ${chalk.cyan(`${j + 1}:`)} ${chalk.white(shortTarget)} ${boostIndicator} ${chalk.gray(`(${target.enhancedScore.toFixed(3)})`)}`);
                    if (target.pprRank) {
                        console.log(`          ${chalk.gray(`PPR Rank: ${target.pprRank}`)}`);
                    }
                }
            }
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function runEnhancedDiscovery() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            
            // Enhanced discovery configuration
            useImportanceRankings: true,
            usePPRResults: true,
            useCommunityBoosts: true,
            fallbackToBaseline: true,
            
            // Scoring weights
            similarityWeight: 0.4,
            importanceWeight: 0.3,
            pprWeight: 0.2,
            communityWeight: 0.1,
            
            // Baseline compatibility
            maxTargetsPerQuestion: 15,
            similarityThreshold: 0.3,
            boostFactorThreshold: 1.2
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Use Importance Rankings:')} ${chalk.white(config.useImportanceRankings ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Use PPR Results:')} ${chalk.white(config.usePPRResults ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Use Community Boosts:')} ${chalk.white(config.useCommunityBoosts ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Similarity Weight:')} ${chalk.white(config.similarityWeight)}`);
        console.log(`   ${chalk.cyan('Importance Weight:')} ${chalk.white(config.importanceWeight)}`);
        console.log(`   ${chalk.cyan('PPR Weight:')} ${chalk.white(config.pprWeight)}`);
        console.log(`   ${chalk.cyan('Max Targets Per Question:')} ${chalk.white(config.maxTargetsPerQuestion)}`);
        console.log('');

        const enhancer = new EnhancedDiscoverTargets(config);
        const result = await enhancer.runEnhancedDiscovery();

        if (result.success) {
            console.log(chalk.green('🎉 Enhanced target discovery completed successfully!'));
            console.log(chalk.white('Graph-enhanced targets are ready for downstream processing.'));
        } else {
            console.log(chalk.yellow('⚠️  Enhanced target discovery completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Enhanced target discovery failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { EnhancedDiscoverTargets };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runEnhancedDiscovery().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}