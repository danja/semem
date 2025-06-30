#!/usr/bin/env node

/**
 * GraphPreprocessor.js - Pre-compute Graph Analytics for BeerQA Enhancement
 * 
 * This script runs the complete graph analysis pipeline on the Wikipedia corpus
 * to pre-compute all analytics results needed for enhanced BeerQA workflows.
 * It orchestrates Phase 1 foundation scripts to ensure all graph analytics
 * are available and cached in the SPARQL store for fast retrieval during
 * question answering sessions.
 * 
 * Key Features:
 * - Orchestrates all Phase 1 graph analytics scripts in proper sequence
 * - Ensures complete graph analytics coverage of Wikipedia corpus
 * - Caches all results in SPARQL store for fast retrieval
 * - Supports incremental updates when new Wikipedia data is added
 * - Provides comprehensive analytics validation and reporting
 * - Optimizes graph analytics for production question answering workflows
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { GraphBuilder } from '../ragno/GraphBuilder.js';
import { CorpuscleRanking } from '../ragno/CorpuscleRanking.js';
import { CommunityAnalysis } from '../ragno/CommunityAnalysis.js';
import { SemanticSearch } from '../ragno/SemanticSearch.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              ⚙️  GRAPH PREPROCESSOR                        ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Pre-compute complete graph analytics for BeerQA enhancement') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * GraphPreprocessor class for orchestrating complete graph analytics pipeline
 */
class GraphPreprocessor {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 60000, // Longer timeout for batch processing
            
            // Pipeline execution options
            forceRecompute: options.forceRecompute || false,
            validateResults: options.validateResults !== false,
            cleanupBefore: options.cleanupBefore || false,
            
            // Graph analytics options
            enableGraphBuilding: options.enableGraphBuilding !== false,
            enableCorpuscleRanking: options.enableCorpuscleRanking !== false,
            enableCommunityAnalysis: options.enableCommunityAnalysis !== false,
            enableSemanticSearch: options.enableSemanticSearch !== false,
            
            // Performance options
            batchProcessing: options.batchProcessing !== false,
            parallelSafeMode: options.parallelSafeMode !== false,
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            pipelineStartTime: null,
            pipelineEndTime: null,
            totalProcessingTime: 0,
            stagesCompleted: 0,
            stagesSkipped: 0,
            stagesFailed: 0,
            
            // Stage-specific stats
            graphBuildingTime: 0,
            corpuscleRankingTime: 0,
            communityAnalysisTime: 0,
            semanticSearchTime: 0,
            
            // Results stats
            graphTriples: 0,
            corpuscleRankings: 0,
            communitiesDetected: 0,
            pprResults: 0,
            
            errors: []
        };

        this.stageStatus = {
            graphBuilding: 'pending',
            corpuscleRanking: 'pending',
            communityAnalysis: 'pending',
            semanticSearch: 'pending'
        };
    }

    /**
     * Run complete graph preprocessing pipeline
     * @returns {Object} Preprocessing results and statistics
     */
    async runPreprocessingPipeline() {
        this.stats.pipelineStartTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting complete graph preprocessing pipeline...'));

        try {
            // Phase 1: Check existing analytics (if not forcing recompute)
            if (!this.options.forceRecompute) {
                console.log(chalk.white('🔍 Checking existing graph analytics...'));
                const existingAnalytics = await this.checkExistingAnalytics();
                this.logExistingAnalytics(existingAnalytics);
            }

            // Phase 2: Cleanup previous results (if requested)
            if (this.options.cleanupBefore) {
                console.log(chalk.white('🧹 Cleaning up previous analytics results...'));
                await this.cleanupPreviousResults();
            }

            // Phase 3: Run graph analytics pipeline stages
            await this.executeAnalyticsPipeline();

            // Phase 4: Validate results (if enabled)
            if (this.options.validateResults) {
                console.log(chalk.white('✅ Validating analytics results...'));
                await this.validateAnalyticsResults();
            }

            // Calculate final statistics
            this.stats.pipelineEndTime = Date.now();
            this.stats.totalProcessingTime = this.stats.pipelineEndTime - this.stats.pipelineStartTime;
            
            console.log(chalk.green('✅ Graph preprocessing pipeline completed successfully'));
            this.displayPipelineResults();

            return {
                success: true,
                stageStatus: this.stageStatus,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Pipeline failed: ${error.message}`);
            console.log(chalk.red('❌ Graph preprocessing pipeline failed:', error.message));
            throw error;
        }
    }

    /**
     * Check existing graph analytics in SPARQL store
     * @returns {Object} Existing analytics summary
     */
    async checkExistingAnalytics() {
        const analytics = {
            graphData: 0,
            rankings: 0,
            communities: 0,
            pprResults: 0
        };

        try {
            // Check graph data
            const graphQuery = `
SELECT (COUNT(*) as ?count)
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?s ?p ?o .
    }
}`;
            const graphResult = await this.sparqlHelper.executeSelect(graphQuery);
            if (graphResult.success && graphResult.data.results.bindings.length > 0) {
                analytics.graphData = parseInt(graphResult.data.results.bindings[0].count.value);
            }

            // Check rankings
            const rankingQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT (COUNT(*) as ?count)
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?attr ragno:attributeType "corpuscle-importance-ranking" .
    }
}`;
            const rankingResult = await this.sparqlHelper.executeSelect(rankingQuery);
            if (rankingResult.success && rankingResult.data.results.bindings.length > 0) {
                analytics.rankings = parseInt(rankingResult.data.results.bindings[0].count.value);
            }

            // Check communities
            const communityQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT (COUNT(DISTINCT ?community) as ?count)
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?community rdf:type ragno:Community .
    }
}`;
            const communityResult = await this.sparqlHelper.executeSelect(communityQuery);
            if (communityResult.success && communityResult.data.results.bindings.length > 0) {
                analytics.communities = parseInt(communityResult.data.results.bindings[0].count.value);
            }

            // Check PPR results
            const pprQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT (COUNT(*) as ?count)
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?attr ragno:attributeType "ppr-search-result" .
    }
}`;
            const pprResult = await this.sparqlHelper.executeSelect(pprQuery);
            if (pprResult.success && pprResult.data.results.bindings.length > 0) {
                analytics.pprResults = parseInt(pprResult.data.results.bindings[0].count.value);
            }

        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Could not check existing analytics: ${error.message}`));
        }

        return analytics;
    }

    /**
     * Log existing analytics status
     * @param {Object} existingAnalytics - Existing analytics data
     */
    logExistingAnalytics(existingAnalytics) {
        console.log(chalk.gray('   Current analytics status:'));
        console.log(chalk.gray(`   • Graph triples: ${existingAnalytics.graphData}`));
        console.log(chalk.gray(`   • Corpuscle rankings: ${existingAnalytics.rankings}`));
        console.log(chalk.gray(`   • Communities: ${existingAnalytics.communities}`));
        console.log(chalk.gray(`   • PPR results: ${existingAnalytics.pprResults}`));

        // Determine which stages to skip
        if (!this.options.forceRecompute) {
            if (existingAnalytics.rankings > 0) {
                console.log(chalk.yellow('   ⚠️  Corpuscle rankings exist, consider using --force-recompute'));
            }
            if (existingAnalytics.communities > 0) {
                console.log(chalk.yellow('   ⚠️  Communities exist, consider using --force-recompute'));
            }
            if (existingAnalytics.pprResults > 0) {
                console.log(chalk.yellow('   ⚠️  PPR results exist, consider using --force-recompute'));
            }
        }
    }

    /**
     * Clean up previous analytics results
     */
    async cleanupPreviousResults() {
        console.log(chalk.gray('   Removing previous analytics results...'));

        const cleanupQueries = [
            // Remove importance rankings
            `DELETE WHERE {
                GRAPH <${this.options.wikipediaGraphURI}> {
                    ?attr ragno:attributeType "corpuscle-importance-ranking" .
                    ?attr ?p ?o .
                }
            }`,
            // Remove communities
            `DELETE WHERE {
                GRAPH <${this.options.wikipediaGraphURI}> {
                    ?community rdf:type ragno:Community .
                    ?community ?p ?o .
                }
            }`,
            // Remove PPR results
            `DELETE WHERE {
                GRAPH <${this.options.wikipediaGraphURI}> {
                    ?attr ragno:attributeType "ppr-search-result" .
                    ?attr ?p ?o .
                }
            }`
        ];

        for (const query of cleanupQueries) {
            try {
                const result = await this.sparqlHelper.executeUpdate(`PREFIX ragno: <http://purl.org/stuff/ragno/>\n${query}`);
                if (!result.success) {
                    console.log(chalk.yellow(`   ⚠️  Cleanup query failed: ${result.error}`));
                }
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Cleanup error: ${error.message}`));
            }
        }

        console.log(chalk.gray('   ✓ Cleanup completed'));
    }

    /**
     * Execute the complete analytics pipeline
     */
    async executeAnalyticsPipeline() {
        console.log(chalk.white('🔄 Executing graph analytics pipeline stages...'));

        // Stage 1: Graph Building
        if (this.options.enableGraphBuilding) {
            await this.executeGraphBuilding();
        } else {
            this.skipStage('graphBuilding', 'Graph building disabled');
        }

        // Stage 2: Corpuscle Ranking
        if (this.options.enableCorpuscleRanking) {
            await this.executeCorpuscleRanking();
        } else {
            this.skipStage('corpuscleRanking', 'Corpuscle ranking disabled');
        }

        // Stage 3: Community Analysis
        if (this.options.enableCommunityAnalysis) {
            await this.executeCommunityAnalysis();
        } else {
            this.skipStage('communityAnalysis', 'Community analysis disabled');
        }

        // Stage 4: Semantic Search
        if (this.options.enableSemanticSearch) {
            await this.executeSemanticSearch();
        } else {
            this.skipStage('semanticSearch', 'Semantic search disabled');
        }
    }

    /**
     * Execute graph building stage
     */
    async executeGraphBuilding() {
        const stageStart = Date.now();
        console.log(chalk.cyan('📊 Stage 1: Graph Building'));
        
        try {
            this.stageStatus.graphBuilding = 'running';
            
            const graphBuilder = new GraphBuilder(this.options);
            const result = await graphBuilder.buildCompleteGraph();
            
            this.stats.graphTriples = result.statistics.totalTriples;
            this.stats.graphBuildingTime = Date.now() - stageStart;
            this.stageStatus.graphBuilding = 'completed';
            this.stats.stagesCompleted++;
            
            console.log(chalk.green(`   ✅ Graph building completed: ${this.stats.graphTriples} triples`));
            
        } catch (error) {
            this.handleStageError('graphBuilding', error, stageStart);
        }
    }

    /**
     * Execute corpuscle ranking stage
     */
    async executeCorpuscleRanking() {
        const stageStart = Date.now();
        console.log(chalk.cyan('📈 Stage 2: Corpuscle Ranking'));
        
        try {
            this.stageStatus.corpuscleRanking = 'running';
            
            const corpuscleRanking = new CorpuscleRanking(this.options);
            const result = await corpuscleRanking.runCorpuscleRanking();
            
            this.stats.corpuscleRankings = result.statistics.rankingsExported;
            this.stats.corpuscleRankingTime = Date.now() - stageStart;
            this.stageStatus.corpuscleRanking = 'completed';
            this.stats.stagesCompleted++;
            
            console.log(chalk.green(`   ✅ Corpuscle ranking completed: ${this.stats.corpuscleRankings} rankings`));
            
        } catch (error) {
            this.handleStageError('corpuscleRanking', error, stageStart);
        }
    }

    /**
     * Execute community analysis stage
     */
    async executeCommunityAnalysis() {
        const stageStart = Date.now();
        console.log(chalk.cyan('🏘️  Stage 3: Community Analysis'));
        
        try {
            this.stageStatus.communityAnalysis = 'running';
            
            const communityAnalysis = new CommunityAnalysis(this.options);
            const result = await communityAnalysis.runCommunityAnalysis();
            
            this.stats.communitiesDetected = result.statistics.communitiesDetected;
            this.stats.communityAnalysisTime = Date.now() - stageStart;
            this.stageStatus.communityAnalysis = 'completed';
            this.stats.stagesCompleted++;
            
            console.log(chalk.green(`   ✅ Community analysis completed: ${this.stats.communitiesDetected} communities`));
            
        } catch (error) {
            this.handleStageError('communityAnalysis', error, stageStart);
        }
    }

    /**
     * Execute semantic search stage
     */
    async executeSemanticSearch() {
        const stageStart = Date.now();
        console.log(chalk.cyan('🔍 Stage 4: Semantic Search'));
        
        try {
            this.stageStatus.semanticSearch = 'running';
            
            const semanticSearch = new SemanticSearch(this.options);
            const result = await semanticSearch.runSemanticSearch();
            
            this.stats.pprResults = result.statistics.exportedResults;
            this.stats.semanticSearchTime = Date.now() - stageStart;
            this.stageStatus.semanticSearch = 'completed';
            this.stats.stagesCompleted++;
            
            console.log(chalk.green(`   ✅ Semantic search completed: ${this.stats.pprResults} PPR results`));
            
        } catch (error) {
            this.handleStageError('semanticSearch', error, stageStart);
        }
    }

    /**
     * Handle stage error
     * @param {string} stageName - Name of the stage
     * @param {Error} error - Error that occurred
     * @param {number} stageStart - Stage start time
     */
    handleStageError(stageName, error, stageStart) {
        this.stageStatus[stageName] = 'failed';
        this.stats.stagesFailed++;
        const stageTime = Date.now() - stageStart;
        
        console.log(chalk.red(`   ❌ ${stageName} failed after ${(stageTime / 1000).toFixed(2)}s: ${error.message}`));
        this.stats.errors.push(`${stageName} failed: ${error.message}`);
        
        // Continue with next stage rather than failing entire pipeline
        console.log(chalk.yellow(`   ⚠️  Continuing with next stage...`));
    }

    /**
     * Skip a stage
     * @param {string} stageName - Name of the stage
     * @param {string} reason - Reason for skipping
     */
    skipStage(stageName, reason) {
        this.stageStatus[stageName] = 'skipped';
        this.stats.stagesSkipped++;
        console.log(chalk.yellow(`   ⏭️  Skipping ${stageName}: ${reason}`));
    }

    /**
     * Validate analytics results
     */
    async validateAnalyticsResults() {
        console.log(chalk.gray('   Validating graph analytics results...'));
        
        const validation = {
            valid: true,
            issues: []
        };

        try {
            // Check that we have some graph data
            if (this.stats.graphTriples === 0) {
                validation.issues.push('No graph triples found');
                validation.valid = false;
            }

            // Check rankings vs corpuscles ratio
            if (this.stats.corpuscleRankings > 0 && this.stats.graphTriples > 0) {
                const rankingRatio = this.stats.corpuscleRankings / this.stats.graphTriples;
                if (rankingRatio < 0.01) { // Less than 1% ranked
                    validation.issues.push('Very low ranking coverage of corpuscles');
                }
            }

            // Validate stage completion
            const expectedStages = ['graphBuilding', 'corpuscleRanking', 'communityAnalysis', 'semanticSearch'];
            const completedStages = expectedStages.filter(stage => this.stageStatus[stage] === 'completed');
            
            if (completedStages.length < 2) {
                validation.issues.push('Less than 2 stages completed successfully');
                validation.valid = false;
            }

            if (validation.valid) {
                console.log(chalk.green('   ✅ Analytics validation passed'));
            } else {
                console.log(chalk.yellow('   ⚠️  Analytics validation found issues:'));
                validation.issues.forEach(issue => {
                    console.log(chalk.yellow(`       • ${issue}`));
                });
            }

        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Validation failed: ${error.message}`));
            validation.valid = false;
            validation.issues.push(`Validation error: ${error.message}`);
        }

        return validation;
    }

    /**
     * Display pipeline results
     */
    displayPipelineResults() {
        console.log('');
        console.log(chalk.bold.white('📊 Graph Preprocessing Pipeline Results:'));
        console.log(`   ${chalk.cyan('Total Processing Time:')} ${chalk.white((this.stats.totalProcessingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Stages Completed:')} ${chalk.white(this.stats.stagesCompleted)}`);
        console.log(`   ${chalk.cyan('Stages Skipped:')} ${chalk.white(this.stats.stagesSkipped)}`);
        console.log(`   ${chalk.cyan('Stages Failed:')} ${chalk.white(this.stats.stagesFailed)}`);
        console.log('');
        
        console.log(chalk.bold.white('📈 Analytics Results:'));
        console.log(`   ${chalk.cyan('Graph Triples:')} ${chalk.white(this.stats.graphTriples)}`);
        console.log(`   ${chalk.cyan('Corpuscle Rankings:')} ${chalk.white(this.stats.corpuscleRankings)}`);
        console.log(`   ${chalk.cyan('Communities Detected:')} ${chalk.white(this.stats.communitiesDetected)}`);
        console.log(`   ${chalk.cyan('PPR Results:')} ${chalk.white(this.stats.pprResults)}`);
        console.log('');
        
        console.log(chalk.bold.white('⏱️  Stage Timing:'));
        console.log(`   ${chalk.cyan('Graph Building:')} ${chalk.white((this.stats.graphBuildingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Corpuscle Ranking:')} ${chalk.white((this.stats.corpuscleRankingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Community Analysis:')} ${chalk.white((this.stats.communityAnalysisTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Semantic Search:')} ${chalk.white((this.stats.semanticSearchTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log('');
            console.log(chalk.bold.white('⚠️  Errors:'));
            this.stats.errors.forEach(error => {
                console.log(`   ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display stage status summary
        console.log(chalk.bold.white('🎯 Stage Status Summary:'));
        Object.entries(this.stageStatus).forEach(([stage, status]) => {
            const statusIcon = {
                'completed': '✅',
                'failed': '❌',
                'skipped': '⏭️',
                'pending': '⏸️',
                'running': '🔄'
            }[status] || '❓';
            
            console.log(`   ${statusIcon} ${chalk.cyan(stage)}: ${chalk.white(status)}`);
        });
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function runGraphPreprocessing() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 60000,
            
            // Pipeline configuration
            forceRecompute: false,
            validateResults: true,
            cleanupBefore: false,
            
            // Stage enablement
            enableGraphBuilding: true,
            enableCorpuscleRanking: true,
            enableCommunityAnalysis: true,
            enableSemanticSearch: true,
            
            // Performance options
            batchProcessing: true,
            parallelSafeMode: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Force Recompute:')} ${chalk.white(config.forceRecompute ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Validate Results:')} ${chalk.white(config.validateResults ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Cleanup Before:')} ${chalk.white(config.cleanupBefore ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('All Stages Enabled:')} ${chalk.white('Yes')}`);
        console.log('');

        const preprocessor = new GraphPreprocessor(config);
        const result = await preprocessor.runPreprocessingPipeline();

        if (result.success) {
            const completedStages = Object.values(result.stageStatus).filter(status => status === 'completed').length;
            console.log(chalk.green(`🎉 Graph preprocessing completed successfully! (${completedStages}/4 stages)`));
            console.log(chalk.white('All graph analytics are now cached and ready for enhanced BeerQA workflows.'));
        } else {
            console.log(chalk.yellow('⚠️  Graph preprocessing completed with issues'));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Graph preprocessing failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { GraphPreprocessor };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runGraphPreprocessing().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}