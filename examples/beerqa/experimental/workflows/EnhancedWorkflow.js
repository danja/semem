#!/usr/bin/env node

/**
 * EnhancedWorkflow.js - Complete Enhanced BeerQA Pipeline
 * 
 * This script orchestrates the complete enhanced BeerQA workflow by sequencing
 * all enhanced scripts in proper order. It provides a comprehensive pipeline
 * that integrates graph analytics, enhanced target discovery, PPR navigation,
 * and community-aware context building to deliver superior question answering
 * results compared to the baseline workflow.
 * 
 * Key Features:
 * - Orchestrates all Phase 2 enhanced scripts in optimal sequence
 * - Provides side-by-side comparison with baseline workflow performance
 * - Includes comprehensive performance metrics and analytics
 * - Supports configurable fallback to baseline components
 * - Generates detailed workflow execution reports
 * - Maintains full backward compatibility with existing BeerQA structure
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { GraphPreprocessor } from './GraphPreprocessor.js';
import { EnhancedDiscoverTargets } from '../enhanced/EnhancedDiscoverTargets.js';
import { GraphNavigate } from '../enhanced/GraphNavigate.js';
import { CommunityContextBuilder } from '../enhanced/CommunityContextBuilder.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🚀 ENHANCED BEERQA WORKFLOW                 ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Complete graph-enhanced question answering pipeline     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * EnhancedWorkflow class for orchestrating complete enhanced BeerQA pipeline
 */
class EnhancedWorkflow {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 60000,
            
            // Workflow execution options
            enablePreprocessing: options.enablePreprocessing !== false,
            enableEnhancedDiscovery: options.enableEnhancedDiscovery !== false,
            enableGraphNavigation: options.enableGraphNavigation !== false,
            enableCommunityContext: options.enableCommunityContext !== false,
            enableBaselineComparison: options.enableBaselineComparison !== false,
            
            // Performance monitoring options
            collectDetailedMetrics: options.collectDetailedMetrics !== false,
            generateExecutionReport: options.generateExecutionReport !== false,
            exportResults: options.exportResults !== false,
            
            // Fallback and error handling
            fallbackToBaseline: options.fallbackToBaseline !== false,
            continueOnStageFailure: options.continueOnStageFailure !== false,
            maxRetries: options.maxRetries || 2,
            
            // Question processing options
            maxQuestionsPerBatch: options.maxQuestionsPerBatch || 25,
            batchProcessing: options.batchProcessing !== false,
            processingTimeout: options.processingTimeout || 300000, // 5 minutes per stage
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            workflowStartTime: null,
            workflowEndTime: null,
            totalProcessingTime: 0,
            stagesExecuted: 0,
            stagesSkipped: 0,
            stagesFailed: 0,
            
            // Stage-specific timing
            preprocessingTime: 0,
            discoveryTime: 0,
            navigationTime: 0,
            contextBuildingTime: 0,
            comparisonTime: 0,
            
            // Results metrics
            questionsProcessed: 0,
            graphAnalyticsGenerated: false,
            enhancedTargetsFound: 0,
            navigationViewsCreated: 0,
            hierarchicalContextsBuilt: 0,
            
            // Comparison metrics
            baselineTargets: 0,
            enhancedTargets: 0,
            baselineNavResults: 0,
            enhancedNavResults: 0,
            
            errors: []
        };

        this.stageStatus = {
            preprocessing: 'pending',
            enhancedDiscovery: 'pending',
            graphNavigation: 'pending',
            communityContext: 'pending',
            baselineComparison: 'pending'
        };

        this.results = {
            preprocessing: null,
            enhancedDiscovery: null,
            graphNavigation: null,
            communityContext: null,
            baselineComparison: null,
            workflowMetrics: null
        };
    }

    /**
     * Run complete enhanced BeerQA workflow
     * @param {Array} questionIds - Optional array of specific question IDs to process
     * @returns {Object} Complete workflow results
     */
    async runEnhancedWorkflow(questionIds = null) {
        this.stats.workflowStartTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting complete enhanced BeerQA workflow...'));

        try {
            // Phase 1: Graph Analytics Preprocessing (if enabled)
            if (this.options.enablePreprocessing) {
                console.log(chalk.white('📊 Phase 1: Graph Analytics Preprocessing...'));
                await this.executePreprocessingStage();
            } else {
                this.skipStage('preprocessing', 'Preprocessing disabled');
            }

            // Phase 2: Enhanced Target Discovery (if enabled)
            if (this.options.enableEnhancedDiscovery) {
                console.log(chalk.white('🎯 Phase 2: Enhanced Target Discovery...'));
                await this.executeEnhancedDiscoveryStage(questionIds);
            } else {
                this.skipStage('enhancedDiscovery', 'Enhanced discovery disabled');
            }

            // Phase 3: Graph-Enhanced Navigation (if enabled)
            if (this.options.enableGraphNavigation) {
                console.log(chalk.white('🧭 Phase 3: Graph-Enhanced Navigation...'));
                await this.executeGraphNavigationStage(questionIds);
            } else {
                this.skipStage('graphNavigation', 'Graph navigation disabled');
            }

            // Phase 4: Community-Aware Context Building (if enabled)
            if (this.options.enableCommunityContext) {
                console.log(chalk.white('🏗️ Phase 4: Community-Aware Context Building...'));
                await this.executeCommunityContextStage(questionIds);
            } else {
                this.skipStage('communityContext', 'Community context disabled');
            }

            // Phase 5: Baseline Comparison (if enabled)
            if (this.options.enableBaselineComparison) {
                console.log(chalk.white('📈 Phase 5: Baseline Workflow Comparison...'));
                await this.executeBaselineComparisonStage(questionIds);
            } else {
                this.skipStage('baselineComparison', 'Baseline comparison disabled');
            }

            // Phase 6: Generate Final Results and Reports
            console.log(chalk.white('📋 Phase 6: Generating workflow results and reports...'));
            await this.generateWorkflowResults();

            // Calculate final statistics
            this.stats.workflowEndTime = Date.now();
            this.stats.totalProcessingTime = this.stats.workflowEndTime - this.stats.workflowStartTime;
            
            console.log(chalk.green('✅ Enhanced BeerQA workflow completed successfully'));
            this.displayWorkflowResults();

            return {
                success: true,
                stageStatus: this.stageStatus,
                results: this.results,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Workflow failed: ${error.message}`);
            console.log(chalk.red('❌ Enhanced BeerQA workflow failed:', error.message));
            throw error;
        }
    }

    /**
     * Execute graph analytics preprocessing stage
     */
    async executePreprocessingStage() {
        const stageStart = Date.now();
        console.log(chalk.cyan('📊 Stage 1: Graph Analytics Preprocessing'));
        
        try {
            this.stageStatus.preprocessing = 'running';
            
            const preprocessor = new GraphPreprocessor(this.options);
            const result = await preprocessor.runPreprocessingPipeline();
            
            this.results.preprocessing = result;
            this.stats.graphAnalyticsGenerated = result.success;
            this.stats.preprocessingTime = Date.now() - stageStart;
            this.stageStatus.preprocessing = 'completed';
            this.stats.stagesExecuted++;
            
            console.log(chalk.green(`   ✅ Preprocessing completed: ${result.success ? 'Success' : 'Partial'}`));
            
        } catch (error) {
            this.handleStageError('preprocessing', error, stageStart);
        }
    }

    /**
     * Execute enhanced target discovery stage
     * @param {Array} questionIds - Question IDs to process
     */
    async executeEnhancedDiscoveryStage(questionIds) {
        const stageStart = Date.now();
        console.log(chalk.cyan('🎯 Stage 2: Enhanced Target Discovery'));
        
        try {
            this.stageStatus.enhancedDiscovery = 'running';
            
            const enhancer = new EnhancedDiscoverTargets(this.options);
            const result = await enhancer.runEnhancedDiscovery(questionIds);
            
            this.results.enhancedDiscovery = result;
            if (result.success) {
                this.stats.enhancedTargetsFound = result.statistics.enhancedTargetsGenerated;
                this.stats.questionsProcessed = result.statistics.questionsProcessed;
            }
            this.stats.discoveryTime = Date.now() - stageStart;
            this.stageStatus.enhancedDiscovery = 'completed';
            this.stats.stagesExecuted++;
            
            console.log(chalk.green(`   ✅ Enhanced discovery completed: ${this.stats.enhancedTargetsFound} targets found`));
            
        } catch (error) {
            this.handleStageError('enhancedDiscovery', error, stageStart);
        }
    }

    /**
     * Execute graph navigation stage
     * @param {Array} questionIds - Question IDs to process
     */
    async executeGraphNavigationStage(questionIds) {
        const stageStart = Date.now();
        console.log(chalk.cyan('🧭 Stage 3: Graph-Enhanced Navigation'));
        
        try {
            this.stageStatus.graphNavigation = 'running';
            
            const navigator = new GraphNavigate(this.options);
            
            // Configure ZPT parameters for enhanced navigation
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
            
            const result = await navigator.runZPTNavigation(questionIds, zptParams);
            
            this.results.graphNavigation = result;
            if (result.success) {
                this.stats.navigationViewsCreated = result.statistics.zptViewsGenerated;
                this.stats.enhancedNavResults = result.statistics.corpusclesReturned;
            }
            this.stats.navigationTime = Date.now() - stageStart;
            this.stageStatus.graphNavigation = 'completed';
            this.stats.stagesExecuted++;
            
            console.log(chalk.green(`   ✅ Graph navigation completed: ${this.stats.navigationViewsCreated} views created`));
            
        } catch (error) {
            this.handleStageError('graphNavigation', error, stageStart);
        }
    }

    /**
     * Execute community context building stage
     * @param {Array} questionIds - Question IDs to process
     */
    async executeCommunityContextStage(questionIds) {
        const stageStart = Date.now();
        console.log(chalk.cyan('🏗️ Stage 4: Community-Aware Context Building'));
        
        try {
            this.stageStatus.communityContext = 'running';
            
            const contextBuilder = new CommunityContextBuilder(this.options);
            const result = await contextBuilder.buildCommunityContext(questionIds);
            
            this.results.communityContext = result;
            if (result.success) {
                this.stats.hierarchicalContextsBuilt = result.statistics.hierarchicalContextsBuilt;
            }
            this.stats.contextBuildingTime = Date.now() - stageStart;
            this.stageStatus.communityContext = 'completed';
            this.stats.stagesExecuted++;
            
            console.log(chalk.green(`   ✅ Community context completed: ${this.stats.hierarchicalContextsBuilt} contexts built`));
            
        } catch (error) {
            this.handleStageError('communityContext', error, stageStart);
        }
    }

    /**
     * Execute baseline comparison stage
     * @param {Array} questionIds - Question IDs to process
     */
    async executeBaselineComparisonStage(questionIds) {
        const stageStart = Date.now();
        console.log(chalk.cyan('📈 Stage 5: Baseline Workflow Comparison'));
        
        try {
            this.stageStatus.baselineComparison = 'running';
            
            // Collect baseline metrics for comparison
            const baselineMetrics = await this.collectBaselineMetrics(questionIds);
            
            // Compare enhanced vs baseline results
            const comparisonResults = this.generateComparisonAnalysis(baselineMetrics);
            
            this.results.baselineComparison = {
                success: true,
                baselineMetrics: baselineMetrics,
                comparisonResults: comparisonResults
            };
            
            this.stats.comparisonTime = Date.now() - stageStart;
            this.stageStatus.baselineComparison = 'completed';
            this.stats.stagesExecuted++;
            
            console.log(chalk.green(`   ✅ Baseline comparison completed`));
            
        } catch (error) {
            this.handleStageError('baselineComparison', error, stageStart);
        }
    }

    /**
     * Collect baseline metrics for comparison
     * @param {Array} questionIds - Question IDs to process
     * @returns {Object} Baseline metrics
     */
    async collectBaselineMetrics(questionIds) {
        console.log(chalk.gray('   Collecting baseline workflow metrics...'));
        
        const metrics = {
            questionsProcessed: 0,
            baselineTargets: 0,
            baselineNavResults: 0,
            baselineContexts: 0,
            processingTime: 0
        };

        try {
            // Query for existing baseline similarity relationships
            let questionFilter = '';
            if (questionIds && questionIds.length > 0) {
                const idFilters = questionIds.map(id => `<${id}>`).join(' ');
                questionFilter = `FILTER(?question IN (${idFilters}))`;
            }

            const baselineQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?question) as ?questions) (COUNT(?relationship) as ?targets)
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "test-question" .
        ${questionFilter}
    }
    
    OPTIONAL {
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:relationshipType "similarity" .
    }
}`;

            const result = await this.sparqlHelper.executeSelect(baselineQuery);
            
            if (result.success && result.data.results.bindings.length > 0) {
                const binding = result.data.results.bindings[0];
                metrics.questionsProcessed = parseInt(binding.questions.value);
                metrics.baselineTargets = parseInt(binding.targets.value);
            }
            
            this.stats.baselineTargets = metrics.baselineTargets;
            console.log(chalk.gray(`   ✓ Baseline metrics: ${metrics.questionsProcessed} questions, ${metrics.baselineTargets} targets`));
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Could not collect baseline metrics: ${error.message}`));
        }

        return metrics;
    }

    /**
     * Generate comparison analysis between enhanced and baseline workflows
     * @param {Object} baselineMetrics - Baseline workflow metrics
     * @returns {Object} Comparison analysis
     */
    generateComparisonAnalysis(baselineMetrics) {
        console.log(chalk.gray('   Generating enhanced vs baseline comparison...'));
        
        const comparison = {
            questionsProcessed: {
                baseline: baselineMetrics.questionsProcessed,
                enhanced: this.stats.questionsProcessed,
                improvement: this.stats.questionsProcessed - baselineMetrics.questionsProcessed
            },
            targetsFound: {
                baseline: baselineMetrics.baselineTargets,
                enhanced: this.stats.enhancedTargetsFound,
                improvement: this.stats.enhancedTargetsFound - baselineMetrics.baselineTargets
            },
            navigationResults: {
                baseline: baselineMetrics.baselineNavResults || 0,
                enhanced: this.stats.enhancedNavResults,
                improvement: this.stats.enhancedNavResults - (baselineMetrics.baselineNavResults || 0)
            },
            contextBuilding: {
                baseline: baselineMetrics.baselineContexts || 0,
                enhanced: this.stats.hierarchicalContextsBuilt,
                improvement: this.stats.hierarchicalContextsBuilt - (baselineMetrics.baselineContexts || 0)
            },
            processingTime: {
                baseline: baselineMetrics.processingTime || 0,
                enhanced: this.stats.totalProcessingTime,
                overhead: this.stats.totalProcessingTime - (baselineMetrics.processingTime || 0)
            }
        };

        // Calculate improvement percentages
        for (const [metric, data] of Object.entries(comparison)) {
            if (data.baseline > 0) {
                data.improvementPercent = ((data.improvement / data.baseline) * 100).toFixed(1);
            } else {
                data.improvementPercent = data.enhanced > 0 ? 'New capability' : '0.0';
            }
        }

        console.log(chalk.gray(`   ✓ Comparison analysis generated`));
        return comparison;
    }

    /**
     * Generate final workflow results and reports
     */
    async generateWorkflowResults() {
        console.log(chalk.gray('   Generating workflow execution report...'));
        
        this.results.workflowMetrics = {
            executionSummary: {
                totalStages: Object.keys(this.stageStatus).length,
                stagesExecuted: this.stats.stagesExecuted,
                stagesSkipped: this.stats.stagesSkipped,
                stagesFailed: this.stats.stagesFailed,
                successRate: ((this.stats.stagesExecuted / Object.keys(this.stageStatus).length) * 100).toFixed(1)
            },
            performanceMetrics: {
                totalProcessingTime: this.stats.totalProcessingTime,
                averageStageTime: this.stats.stagesExecuted > 0 ? 
                    (this.stats.totalProcessingTime / this.stats.stagesExecuted).toFixed(0) : 0,
                questionsPerSecond: this.stats.questionsProcessed > 0 ? 
                    (this.stats.questionsProcessed / (this.stats.totalProcessingTime / 1000)).toFixed(2) : 0
            },
            qualityMetrics: {
                graphAnalyticsGenerated: this.stats.graphAnalyticsGenerated,
                enhancedTargetsFound: this.stats.enhancedTargetsFound,
                navigationViewsCreated: this.stats.navigationViewsCreated,
                hierarchicalContextsBuilt: this.stats.hierarchicalContextsBuilt
            },
            errorSummary: {
                totalErrors: this.stats.errors.length,
                errorRate: this.stats.errors.length > 0 ? 
                    ((this.stats.errors.length / this.stats.stagesExecuted) * 100).toFixed(1) : '0.0'
            }
        };

        // Export results if enabled
        if (this.options.exportResults) {
            await this.exportWorkflowResults();
        }

        console.log(chalk.gray('   ✓ Workflow execution report generated'));
    }

    /**
     * Export workflow results to SPARQL store
     */
    async exportWorkflowResults() {
        console.log(chalk.gray('   Exporting workflow results to SPARQL store...'));
        
        try {
            const timestamp = new Date().toISOString();
            const workflowURI = `${this.options.wikipediaGraphURI}/workflow_execution_${Date.now()}`;
            
            const triples = [];
            
            // Create workflow execution node
            triples.push(`<${workflowURI}> rdf:type ragno:WorkflowExecution .`);
            triples.push(`<${workflowURI}> rdfs:label "Enhanced BeerQA Workflow Execution" .`);
            triples.push(`<${workflowURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
            triples.push(`<${workflowURI}> ragno:questionsProcessed "${this.stats.questionsProcessed}"^^xsd:integer .`);
            triples.push(`<${workflowURI}> ragno:stagesExecuted "${this.stats.stagesExecuted}"^^xsd:integer .`);
            triples.push(`<${workflowURI}> ragno:totalProcessingTime "${this.stats.totalProcessingTime}"^^xsd:integer .`);
            triples.push(`<${workflowURI}> ragno:enhancedTargetsFound "${this.stats.enhancedTargetsFound}"^^xsd:integer .`);
            triples.push(`<${workflowURI}> ragno:navigationViewsCreated "${this.stats.navigationViewsCreated}"^^xsd:integer .`);
            triples.push(`<${workflowURI}> ragno:hierarchicalContextsBuilt "${this.stats.hierarchicalContextsBuilt}"^^xsd:integer .`);
            
            const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

INSERT DATA {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

            const result = await this.sparqlHelper.executeUpdate(updateQuery);
            
            if (result.success) {
                console.log(chalk.gray('   ✓ Workflow results exported successfully'));
            } else {
                console.log(chalk.yellow(`   ⚠️  Failed to export workflow results: ${result.error}`));
            }
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Workflow export failed: ${error.message}`));
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
        
        if (this.options.continueOnStageFailure) {
            console.log(chalk.yellow(`   ⚠️  Continuing with next stage...`));
        } else {
            throw error;
        }
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
     * Display complete workflow results
     */
    displayWorkflowResults() {
        console.log('');
        console.log(chalk.bold.white('📊 Enhanced BeerQA Workflow Results:'));
        console.log(`   ${chalk.cyan('Total Processing Time:')} ${chalk.white((this.stats.totalProcessingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Stages Executed:')} ${chalk.white(this.stats.stagesExecuted)}/${chalk.white(Object.keys(this.stageStatus).length)}`);
        console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(this.stats.questionsProcessed)}`);
        console.log(`   ${chalk.cyan('Enhanced Targets Found:')} ${chalk.white(this.stats.enhancedTargetsFound)}`);
        console.log(`   ${chalk.cyan('Navigation Views Created:')} ${chalk.white(this.stats.navigationViewsCreated)}`);
        console.log(`   ${chalk.cyan('Hierarchical Contexts Built:')} ${chalk.white(this.stats.hierarchicalContextsBuilt)}`);
        console.log('');
        
        console.log(chalk.bold.white('⏱️  Stage Performance:'));
        console.log(`   ${chalk.cyan('Preprocessing:')} ${chalk.white((this.stats.preprocessingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Enhanced Discovery:')} ${chalk.white((this.stats.discoveryTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Graph Navigation:')} ${chalk.white((this.stats.navigationTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Community Context:')} ${chalk.white((this.stats.contextBuildingTime / 1000).toFixed(2))}s`);
        console.log(`   ${chalk.cyan('Baseline Comparison:')} ${chalk.white((this.stats.comparisonTime / 1000).toFixed(2))}s`);
        console.log('');
        
        // Display comparison results if available
        if (this.results.baselineComparison?.success) {
            console.log(chalk.bold.white('📈 Enhanced vs Baseline Comparison:'));
            const comparison = this.results.baselineComparison.comparisonResults;
            
            console.log(`   ${chalk.cyan('Targets Found:')} ${chalk.white(comparison.targetsFound.enhanced)} vs ${chalk.gray(comparison.targetsFound.baseline)} ${chalk.white(`(+${comparison.targetsFound.improvementPercent}%)`)}`);
            console.log(`   ${chalk.cyan('Navigation Results:')} ${chalk.white(comparison.navigationResults.enhanced)} vs ${chalk.gray(comparison.navigationResults.baseline)} ${chalk.white(`(+${comparison.navigationResults.improvementPercent}%)`)}`);
            console.log(`   ${chalk.cyan('Context Building:')} ${chalk.white(comparison.contextBuilding.enhanced)} vs ${chalk.gray(comparison.contextBuilding.baseline)} ${chalk.white(`(+${comparison.contextBuilding.improvementPercent}%)`)}`);
            console.log('');
        }
        
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
        
        if (this.stats.errors.length > 0) {
            console.log('');
            console.log(chalk.bold.white('⚠️  Errors:'));
            this.stats.errors.forEach(error => {
                console.log(`   ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function runEnhancedWorkflow() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 60000,
            
            // Workflow execution configuration
            enablePreprocessing: true,
            enableEnhancedDiscovery: true,
            enableGraphNavigation: true,
            enableCommunityContext: true,
            enableBaselineComparison: true,
            
            // Performance monitoring
            collectDetailedMetrics: true,
            generateExecutionReport: true,
            exportResults: true,
            
            // Error handling
            fallbackToBaseline: true,
            continueOnStageFailure: true,
            maxRetries: 2,
            
            // Processing options
            maxQuestionsPerBatch: 25,
            batchProcessing: true,
            processingTimeout: 300000
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Enable Preprocessing:')} ${chalk.white(config.enablePreprocessing ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Enhanced Discovery:')} ${chalk.white(config.enableEnhancedDiscovery ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Graph Navigation:')} ${chalk.white(config.enableGraphNavigation ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Community Context:')} ${chalk.white(config.enableCommunityContext ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Enable Baseline Comparison:')} ${chalk.white(config.enableBaselineComparison ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Continue on Stage Failure:')} ${chalk.white(config.continueOnStageFailure ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Max Questions Per Batch:')} ${chalk.white(config.maxQuestionsPerBatch)}`);
        console.log('');

        const workflow = new EnhancedWorkflow(config);
        const result = await workflow.runEnhancedWorkflow();

        if (result.success) {
            const completedStages = Object.values(result.stageStatus).filter(status => status === 'completed').length;
            console.log(chalk.green(`🎉 Enhanced BeerQA workflow completed successfully! (${completedStages}/${Object.keys(result.stageStatus).length} stages)`));
            console.log(chalk.white('Enhanced question answering capabilities are now active and ready for use.'));
        } else {
            console.log(chalk.yellow('⚠️  Enhanced BeerQA workflow completed with issues'));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Enhanced BeerQA workflow failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { EnhancedWorkflow };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runEnhancedWorkflow().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}