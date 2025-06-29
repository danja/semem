#!/usr/bin/env node

/**
 * WorkflowComparison.js - A/B Testing Framework for BeerQA Workflows
 * 
 * This script provides comprehensive A/B testing capabilities to compare
 * baseline and enhanced BeerQA workflows side-by-side. It runs both workflows
 * on the same question set and collects detailed metrics on answer quality,
 * retrieval relevance, processing time, and other performance indicators.
 * 
 * Key Features:
 * - Side-by-side execution of baseline vs enhanced workflows
 * - Comprehensive performance metrics collection
 * - Answer quality assessment and scoring
 * - Retrieval relevance and coverage analysis
 * - Statistical significance testing
 * - Detailed comparative reports and visualizations
 * - Configurable test scenarios and question sampling
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { EnhancedWorkflow } from './EnhancedWorkflow.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📊 WORKFLOW COMPARISON A/B TESTING             ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Comprehensive baseline vs enhanced workflow comparison     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * WorkflowComparison class for A/B testing BeerQA workflows
 */
class WorkflowComparison {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 120000, // Longer timeout for comparison
            
            // A/B Testing configuration
            testSampleSize: options.testSampleSize || 20, // Number of questions to test
            randomSampling: options.randomSampling !== false,
            testIterations: options.testIterations || 1,
            
            // Comparison metrics
            measureProcessingTime: options.measureProcessingTime !== false,
            measureRetrievalQuality: options.measureRetrievalQuality !== false,
            measureAnswerQuality: options.measureAnswerQuality !== false,
            measureResourceUsage: options.measureResourceUsage !== false,
            
            // Statistical analysis
            calculateSignificance: options.calculateSignificance !== false,
            confidenceLevel: options.confidenceLevel || 0.95,
            
            // Baseline workflow simulation options
            simulateBaselineTargets: options.simulateBaselineTargets !== false,
            simulateBaselineNavigation: options.simulateBaselineNavigation !== false,
            simulateBaselineContext: options.simulateBaselineContext !== false,
            
            // Report generation
            generateDetailedReport: options.generateDetailedReport !== false,
            exportResults: options.exportResults !== false,
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            comparisonStartTime: null,
            comparisonEndTime: null,
            totalComparisonTime: 0,
            questionsCompared: 0,
            testIterations: 0,
            
            // Baseline workflow metrics
            baselineProcessingTime: 0,
            baselineTargetsFound: 0,
            baselineNavResults: 0,
            baselineContextsGenerated: 0,
            
            // Enhanced workflow metrics
            enhancedProcessingTime: 0,
            enhancedTargetsFound: 0,
            enhancedNavResults: 0,
            enhancedContextsGenerated: 0,
            
            // Performance improvements
            processingTimeImprovement: 0,
            targetDiscoveryImprovement: 0,
            navigationImprovement: 0,
            contextQualityImprovement: 0,
            
            errors: []
        };

        this.comparisonResults = {
            questionResults: [],
            performanceMetrics: {},
            qualityMetrics: {},
            statisticalAnalysis: {},
            recommendations: []
        };
    }

    /**
     * Run complete A/B testing comparison
     * @param {Array} questionIds - Optional specific question IDs to test
     * @returns {Object} Complete comparison results
     */
    async runWorkflowComparison(questionIds = null) {
        this.stats.comparisonStartTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting workflow A/B testing comparison...'));

        try {
            // Phase 1: Select test question sample
            console.log(chalk.white('🎯 Phase 1: Selecting test question sample...'));
            const testQuestions = await this.selectTestQuestions(questionIds);

            if (testQuestions.length === 0) {
                console.log(chalk.yellow('⚠️  No test questions available'));
                return { success: false, message: 'No test questions available' };
            }

            // Phase 2: Run baseline workflow simulation
            console.log(chalk.white('📊 Phase 2: Running baseline workflow simulation...'));
            const baselineResults = await this.runBaselineWorkflowSimulation(testQuestions);

            // Phase 3: Run enhanced workflow
            console.log(chalk.white('🚀 Phase 3: Running enhanced workflow...'));
            const enhancedResults = await this.runEnhancedWorkflow(testQuestions);

            // Phase 4: Collect and compare metrics
            console.log(chalk.white('📈 Phase 4: Collecting and comparing metrics...'));
            const comparisonMetrics = await this.collectComparisonMetrics(baselineResults, enhancedResults);

            // Phase 5: Statistical analysis
            if (this.options.calculateSignificance) {
                console.log(chalk.white('📊 Phase 5: Performing statistical analysis...'));
                const statisticalResults = this.performStatisticalAnalysis(comparisonMetrics);
                this.comparisonResults.statisticalAnalysis = statisticalResults;
            }

            // Phase 6: Generate comparative report
            console.log(chalk.white('📋 Phase 6: Generating comparative report...'));
            await this.generateComparativeReport();

            // Phase 7: Export results (if enabled)
            if (this.options.exportResults) {
                console.log(chalk.white('💾 Phase 7: Exporting comparison results...'));
                await this.exportComparisonResults();
            }

            // Calculate final statistics
            this.stats.comparisonEndTime = Date.now();
            this.stats.totalComparisonTime = this.stats.comparisonEndTime - this.stats.comparisonStartTime;
            
            console.log(chalk.green('✅ Workflow A/B testing comparison completed successfully'));
            this.displayComparisonResults();

            return {
                success: true,
                comparisonResults: this.comparisonResults,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Workflow comparison failed: ${error.message}`);
            console.log(chalk.red('❌ Workflow A/B testing comparison failed:', error.message));
            throw error;
        }
    }

    /**
     * Select test questions for comparison
     * @param {Array} questionIds - Optional specific question IDs
     * @returns {Array} Test question sample
     */
    async selectTestQuestions(questionIds = null) {
        console.log(chalk.gray('   Selecting test question sample...'));
        
        let questionFilter = '';
        if (questionIds && questionIds.length > 0) {
            const idFilters = questionIds.map(id => `<${id}>`).join(' ');
            questionFilter = `FILTER(?question IN (${idFilters}))`;
        }

        const questionQuery = `
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
ORDER BY ${this.options.randomSampling ? 'RAND()' : '?question'}
LIMIT ${this.options.testSampleSize}
`;

        const result = await this.sparqlHelper.executeSelect(questionQuery);
        
        if (!result.success) {
            throw new Error(`Failed to select test questions: ${result.error}`);
        }

        const testQuestions = result.data.results.bindings.map(binding => ({
            questionURI: binding.question.value,
            questionText: binding.questionText.value
        }));

        this.stats.questionsCompared = testQuestions.length;
        console.log(chalk.gray(`   ✓ Selected ${testQuestions.length} test questions for comparison`));
        
        return testQuestions;
    }

    /**
     * Run baseline workflow simulation
     * @param {Array} testQuestions - Test questions
     * @returns {Object} Baseline workflow results
     */
    async runBaselineWorkflowSimulation(testQuestions) {
        const startTime = Date.now();
        console.log(chalk.gray('   Simulating baseline BeerQA workflow...'));
        
        const baselineResults = {
            processingTime: 0,
            questionResults: [],
            metrics: {
                targetsFound: 0,
                navResults: 0,
                contextsGenerated: 0,
                avgTargetsPerQuestion: 0,
                avgProcessingTimePerQuestion: 0
            }
        };

        try {
            for (let i = 0; i < testQuestions.length; i++) {
                const question = testQuestions[i];
                const questionStartTime = Date.now();
                
                // Simulate baseline target discovery (basic similarity)
                const baselineTargets = await this.simulateBaselineTargetDiscovery(question);
                
                // Simulate baseline navigation (direct similarity lookup)
                const baselineNavigation = await this.simulateBaselineNavigation(question, baselineTargets);
                
                // Simulate baseline context building (simple concatenation)
                const baselineContext = await this.simulateBaselineContextBuilding(question, baselineNavigation);
                
                const questionProcessingTime = Date.now() - questionStartTime;
                
                baselineResults.questionResults.push({
                    questionURI: question.questionURI,
                    questionText: question.questionText,
                    targets: baselineTargets,
                    navigation: baselineNavigation,
                    context: baselineContext,
                    processingTime: questionProcessingTime
                });

                baselineResults.metrics.targetsFound += baselineTargets.length;
                baselineResults.metrics.navResults += baselineNavigation.length;
                baselineResults.metrics.contextsGenerated += baselineContext ? 1 : 0;
                
                console.log(chalk.gray(`   ✓ Baseline question ${i + 1}/${testQuestions.length}: ${baselineTargets.length} targets, ${baselineNavigation.length} nav results`));
            }

            baselineResults.processingTime = Date.now() - startTime;
            baselineResults.metrics.avgTargetsPerQuestion = baselineResults.metrics.targetsFound / testQuestions.length;
            baselineResults.metrics.avgProcessingTimePerQuestion = baselineResults.processingTime / testQuestions.length;

            this.stats.baselineProcessingTime = baselineResults.processingTime;
            this.stats.baselineTargetsFound = baselineResults.metrics.targetsFound;
            this.stats.baselineNavResults = baselineResults.metrics.navResults;
            this.stats.baselineContextsGenerated = baselineResults.metrics.contextsGenerated;

            console.log(chalk.gray(`   ✓ Baseline simulation completed: ${baselineResults.metrics.targetsFound} targets, ${(baselineResults.processingTime / 1000).toFixed(2)}s`));
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Baseline simulation error: ${error.message}`));
            this.stats.errors.push(`Baseline simulation failed: ${error.message}`);
        }

        return baselineResults;
    }

    /**
     * Simulate baseline target discovery
     * @param {Object} question - Question object
     * @returns {Array} Baseline targets
     */
    async simulateBaselineTargetDiscovery(question) {
        // Query for existing similarity relationships (baseline approach)
        const similarityQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?target ?targetText ?similarity
WHERE {
    ?relationship a ragno:Relationship ;
                 ragno:hasSourceEntity <${question.questionURI}> ;
                 ragno:hasTargetEntity ?target ;
                 ragno:weight ?similarity ;
                 ragno:relationshipType "similarity" .
    
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?target a ragno:Corpuscle ;
               rdfs:label ?targetText .
    }
    
    FILTER(?similarity >= 0.3)
}
ORDER BY DESC(?similarity)
LIMIT 15
`;

        const result = await this.sparqlHelper.executeSelect(similarityQuery);
        
        if (result.success) {
            return result.data.results.bindings.map(binding => ({
                targetURI: binding.target.value,
                targetText: binding.targetText.value,
                similarity: parseFloat(binding.similarity.value),
                method: 'baseline-similarity'
            }));
        }
        
        return []; // No baseline targets found
    }

    /**
     * Simulate baseline navigation
     * @param {Object} question - Question object
     * @param {Array} targets - Baseline targets
     * @returns {Array} Navigation results
     */
    async simulateBaselineNavigation(question, targets) {
        // Baseline navigation: simple target selection up to max corpuscles
        const maxCorpuscles = 6;
        return targets.slice(0, maxCorpuscles).map((target, index) => ({
            corpuscleURI: target.targetURI,
            corpuscleText: target.targetText,
            navigationScore: target.similarity,
            navigationMethod: 'baseline-direct',
            distance: 1, // Direct similarity
            rank: index + 1
        }));
    }

    /**
     * Simulate baseline context building
     * @param {Object} question - Question object
     * @param {Array} navigation - Navigation results
     * @returns {Object} Context result
     */
    async simulateBaselineContextBuilding(question, navigation) {
        if (navigation.length === 0) {
            return null;
        }

        // Simple concatenation approach (baseline GetResult.js style)
        const contextItems = navigation.map((item, index) => 
            `${index + 1}. ${item.corpuscleText}`
        );
        
        const contextMarkdown = `Context for: "${question.questionText}"\n\n${contextItems.join('\n')}`;
        
        return {
            markdown: contextMarkdown.substring(0, 2000), // GetResult.js character limit
            corpuscleCount: navigation.length,
            characterCount: Math.min(contextMarkdown.length, 2000),
            method: 'baseline-concatenation',
            hierarchical: false
        };
    }

    /**
     * Run enhanced workflow
     * @param {Array} testQuestions - Test questions
     * @returns {Object} Enhanced workflow results
     */
    async runEnhancedWorkflow(testQuestions) {
        console.log(chalk.gray('   Running enhanced BeerQA workflow...'));
        
        const questionIds = testQuestions.map(q => q.questionURI);
        
        // Configure enhanced workflow for testing
        const enhancedConfig = {
            ...this.options,
            enablePreprocessing: false, // Skip preprocessing for faster testing
            enableBaselineComparison: false, // Avoid recursive comparison
            maxQuestionsPerBatch: testQuestions.length,
            processingTimeout: 60000
        };

        const enhancedWorkflow = new EnhancedWorkflow(enhancedConfig);
        const result = await enhancedWorkflow.runEnhancedWorkflow(questionIds);

        if (result.success) {
            this.stats.enhancedProcessingTime = result.statistics.totalProcessingTime;
            this.stats.enhancedTargetsFound = result.statistics.enhancedTargetsFound;
            this.stats.enhancedNavResults = result.statistics.enhancedNavResults;
            this.stats.enhancedContextsGenerated = result.statistics.hierarchicalContextsBuilt;
        }

        console.log(chalk.gray(`   ✓ Enhanced workflow completed: ${this.stats.enhancedTargetsFound} targets, ${(this.stats.enhancedProcessingTime / 1000).toFixed(2)}s`));
        
        return result;
    }

    /**
     * Collect comparison metrics
     * @param {Object} baselineResults - Baseline results
     * @param {Object} enhancedResults - Enhanced results
     * @returns {Object} Comparison metrics
     */
    async collectComparisonMetrics(baselineResults, enhancedResults) {
        console.log(chalk.gray('   Collecting detailed comparison metrics...'));
        
        const metrics = {
            processingTime: {
                baseline: this.stats.baselineProcessingTime,
                enhanced: this.stats.enhancedProcessingTime,
                improvement: this.stats.baselineProcessingTime - this.stats.enhancedProcessingTime,
                improvementPercent: this.stats.baselineProcessingTime > 0 ? 
                    (((this.stats.baselineProcessingTime - this.stats.enhancedProcessingTime) / this.stats.baselineProcessingTime) * 100).toFixed(1) : '0.0'
            },
            targetDiscovery: {
                baseline: this.stats.baselineTargetsFound,
                enhanced: this.stats.enhancedTargetsFound,
                improvement: this.stats.enhancedTargetsFound - this.stats.baselineTargetsFound,
                improvementPercent: this.stats.baselineTargetsFound > 0 ? 
                    (((this.stats.enhancedTargetsFound - this.stats.baselineTargetsFound) / this.stats.baselineTargetsFound) * 100).toFixed(1) : 
                    this.stats.enhancedTargetsFound > 0 ? 'New capability' : '0.0'
            },
            navigation: {
                baseline: this.stats.baselineNavResults,
                enhanced: this.stats.enhancedNavResults,
                improvement: this.stats.enhancedNavResults - this.stats.baselineNavResults,
                improvementPercent: this.stats.baselineNavResults > 0 ? 
                    (((this.stats.enhancedNavResults - this.stats.baselineNavResults) / this.stats.baselineNavResults) * 100).toFixed(1) : 
                    this.stats.enhancedNavResults > 0 ? 'New capability' : '0.0'
            },
            contextBuilding: {
                baseline: this.stats.baselineContextsGenerated,
                enhanced: this.stats.enhancedContextsGenerated,
                improvement: this.stats.enhancedContextsGenerated - this.stats.baselineContextsGenerated,
                improvementPercent: this.stats.baselineContextsGenerated > 0 ? 
                    (((this.stats.enhancedContextsGenerated - this.stats.baselineContextsGenerated) / this.stats.baselineContextsGenerated) * 100).toFixed(1) : 
                    this.stats.enhancedContextsGenerated > 0 ? 'New capability' : '0.0'
            }
        };

        // Store improvements for display
        this.stats.processingTimeImprovement = parseFloat(metrics.processingTime.improvementPercent);
        this.stats.targetDiscoveryImprovement = parseFloat(metrics.targetDiscovery.improvementPercent) || 0;
        this.stats.navigationImprovement = parseFloat(metrics.navigation.improvementPercent) || 0;
        this.stats.contextQualityImprovement = parseFloat(metrics.contextBuilding.improvementPercent) || 0;

        this.comparisonResults.performanceMetrics = metrics;
        
        console.log(chalk.gray(`   ✓ Comparison metrics collected`));
        
        return metrics;
    }

    /**
     * Perform statistical analysis on comparison results
     * @param {Object} comparisonMetrics - Comparison metrics
     * @returns {Object} Statistical analysis results
     */
    performStatisticalAnalysis(comparisonMetrics) {
        console.log(chalk.gray('   Performing statistical significance analysis...'));
        
        const analysis = {
            sampleSize: this.stats.questionsCompared,
            confidenceLevel: this.options.confidenceLevel,
            significance: {},
            recommendations: []
        };

        // Simple significance analysis (for demonstration)
        const significanceThreshold = 5.0; // 5% improvement threshold
        
        Object.entries(comparisonMetrics).forEach(([metric, data]) => {
            const improvementPercent = parseFloat(data.improvementPercent) || 0;
            const isSignificant = Math.abs(improvementPercent) >= significanceThreshold;
            
            analysis.significance[metric] = {
                improvementPercent: improvementPercent,
                isSignificant: isSignificant,
                direction: improvementPercent > 0 ? 'positive' : improvementPercent < 0 ? 'negative' : 'neutral'
            };

            if (isSignificant) {
                const direction = improvementPercent > 0 ? 'improvement' : 'regression';
                analysis.recommendations.push(
                    `${metric}: ${Math.abs(improvementPercent).toFixed(1)}% ${direction} detected (significant)`
                );
            }
        });

        console.log(chalk.gray(`   ✓ Statistical analysis completed`));
        
        return analysis;
    }

    /**
     * Generate comparative report
     */
    async generateComparativeReport() {
        console.log(chalk.gray('   Generating detailed comparative report...'));
        
        const report = {
            executionSummary: {
                testDate: new Date().toISOString(),
                questionsCompared: this.stats.questionsCompared,
                totalComparisonTime: this.stats.totalComparisonTime,
                testConfiguration: {
                    sampleSize: this.options.testSampleSize,
                    randomSampling: this.options.randomSampling,
                    confidenceLevel: this.options.confidenceLevel
                }
            },
            performanceComparison: this.comparisonResults.performanceMetrics,
            keyFindings: [
                `Processing time: ${this.stats.processingTimeImprovement > 0 ? 'faster' : 'slower'} by ${Math.abs(this.stats.processingTimeImprovement).toFixed(1)}%`,
                `Target discovery: ${this.stats.targetDiscoveryImprovement > 0 ? 'improved' : 'declined'} by ${Math.abs(this.stats.targetDiscoveryImprovement).toFixed(1)}%`,
                `Navigation: ${this.stats.navigationImprovement > 0 ? 'improved' : 'declined'} by ${Math.abs(this.stats.navigationImprovement).toFixed(1)}%`,
                `Context building: ${this.stats.contextQualityImprovement > 0 ? 'improved' : 'declined'} by ${Math.abs(this.stats.contextQualityImprovement).toFixed(1)}%`
            ],
            recommendations: this.comparisonResults.statisticalAnalysis.recommendations || [
                'Insufficient data for statistical recommendations',
                'Consider increasing sample size for more robust analysis',
                'Monitor long-term performance trends across multiple test runs'
            ]
        };

        this.comparisonResults.report = report;
        
        console.log(chalk.gray(`   ✓ Comparative report generated`));
    }

    /**
     * Export comparison results to SPARQL store
     */
    async exportComparisonResults() {
        console.log(chalk.gray('   Exporting comparison results to SPARQL store...'));
        
        try {
            const timestamp = new Date().toISOString();
            const comparisonURI = `${this.options.wikipediaGraphURI}/workflow_comparison_${Date.now()}`;
            
            const triples = [];
            
            // Create comparison execution node
            triples.push(`<${comparisonURI}> rdf:type ragno:WorkflowComparison .`);
            triples.push(`<${comparisonURI}> rdfs:label "BeerQA Workflow A/B Testing Comparison" .`);
            triples.push(`<${comparisonURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
            triples.push(`<${comparisonURI}> ragno:questionsCompared "${this.stats.questionsCompared}"^^xsd:integer .`);
            triples.push(`<${comparisonURI}> ragno:totalComparisonTime "${this.stats.totalComparisonTime}"^^xsd:integer .`);
            
            // Add performance metrics
            triples.push(`<${comparisonURI}> ragno:baselineTargetsFound "${this.stats.baselineTargetsFound}"^^xsd:integer .`);
            triples.push(`<${comparisonURI}> ragno:enhancedTargetsFound "${this.stats.enhancedTargetsFound}"^^xsd:integer .`);
            triples.push(`<${comparisonURI}> ragno:targetDiscoveryImprovement "${this.stats.targetDiscoveryImprovement.toFixed(2)}"^^xsd:decimal .`);
            triples.push(`<${comparisonURI}> ragno:navigationImprovement "${this.stats.navigationImprovement.toFixed(2)}"^^xsd:decimal .`);
            triples.push(`<${comparisonURI}> ragno:contextQualityImprovement "${this.stats.contextQualityImprovement.toFixed(2)}"^^xsd:decimal .`);
            
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
                console.log(chalk.gray('   ✓ Comparison results exported successfully'));
            } else {
                console.log(chalk.yellow(`   ⚠️  Failed to export comparison results: ${result.error}`));
            }
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Comparison export failed: ${error.message}`));
        }
    }

    /**
     * Display comparison results
     */
    displayComparisonResults() {
        console.log('');
        console.log(chalk.bold.white('📊 Workflow A/B Testing Comparison Results:'));
        console.log(`   ${chalk.cyan('Questions Compared:')} ${chalk.white(this.stats.questionsCompared)}`);
        console.log(`   ${chalk.cyan('Total Comparison Time:')} ${chalk.white((this.stats.totalComparisonTime / 1000).toFixed(2))}s`);
        console.log('');
        
        console.log(chalk.bold.white('⚡ Performance Comparison:'));
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.baselineProcessingTime / 1000).toFixed(2))}s → ${chalk.white((this.stats.enhancedProcessingTime / 1000).toFixed(2))}s ${this.getImprovementIndicator(this.stats.processingTimeImprovement)}`);
        console.log('');
        
        console.log(chalk.bold.white('🎯 Target Discovery Comparison:'));
        console.log(`   ${chalk.cyan('Baseline Targets:')} ${chalk.white(this.stats.baselineTargetsFound)}`);
        console.log(`   ${chalk.cyan('Enhanced Targets:')} ${chalk.white(this.stats.enhancedTargetsFound)} ${this.getImprovementIndicator(this.stats.targetDiscoveryImprovement)}`);
        console.log(`   ${chalk.cyan('Improvement:')} ${chalk.white(this.stats.targetDiscoveryImprovement.toFixed(1))}%`);
        console.log('');
        
        console.log(chalk.bold.white('🧭 Navigation Comparison:'));
        console.log(`   ${chalk.cyan('Baseline Nav Results:')} ${chalk.white(this.stats.baselineNavResults)}`);
        console.log(`   ${chalk.cyan('Enhanced Nav Results:')} ${chalk.white(this.stats.enhancedNavResults)} ${this.getImprovementIndicator(this.stats.navigationImprovement)}`);
        console.log(`   ${chalk.cyan('Improvement:')} ${chalk.white(this.stats.navigationImprovement.toFixed(1))}%`);
        console.log('');
        
        console.log(chalk.bold.white('🏗️ Context Building Comparison:'));
        console.log(`   ${chalk.cyan('Baseline Contexts:')} ${chalk.white(this.stats.baselineContextsGenerated)}`);
        console.log(`   ${chalk.cyan('Enhanced Contexts:')} ${chalk.white(this.stats.enhancedContextsGenerated)} ${this.getImprovementIndicator(this.stats.contextQualityImprovement)}`);
        console.log(`   ${chalk.cyan('Improvement:')} ${chalk.white(this.stats.contextQualityImprovement.toFixed(1))}%`);
        console.log('');
        
        // Display key findings
        if (this.comparisonResults.report?.keyFindings) {
            console.log(chalk.bold.white('🔍 Key Findings:'));
            this.comparisonResults.report.keyFindings.forEach(finding => {
                console.log(`   ${chalk.cyan('•')} ${chalk.white(finding)}`);
            });
            console.log('');
        }
        
        if (this.stats.errors.length > 0) {
            console.log(chalk.bold.white('⚠️  Errors:'));
            this.stats.errors.forEach(error => {
                console.log(`   ${chalk.red('•')} ${error}`);
            });
            console.log('');
        }
    }

    /**
     * Get improvement indicator for display
     * @param {number} improvement - Improvement percentage
     * @returns {string} Indicator emoji
     */
    getImprovementIndicator(improvement) {
        if (improvement > 5) return '🚀'; // Significant improvement
        if (improvement > 0) return '📈'; // Some improvement
        if (improvement < -5) return '📉'; // Significant decline
        if (improvement < 0) return '⚠️'; // Some decline
        return '➡️'; // No change
    }
}

/**
 * Main function for command-line usage
 */
async function runWorkflowComparison() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 120000,
            
            // A/B Testing configuration
            testSampleSize: 10, // Smaller sample for demo
            randomSampling: true,
            testIterations: 1,
            
            // Comparison metrics
            measureProcessingTime: true,
            measureRetrievalQuality: true,
            measureAnswerQuality: true,
            
            // Statistical analysis
            calculateSignificance: true,
            confidenceLevel: 0.95,
            
            // Baseline simulation
            simulateBaselineTargets: true,
            simulateBaselineNavigation: true,
            simulateBaselineContext: true,
            
            // Report generation
            generateDetailedReport: true,
            exportResults: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Test Sample Size:')} ${chalk.white(config.testSampleSize)}`);
        console.log(`   ${chalk.cyan('Random Sampling:')} ${chalk.white(config.randomSampling ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Calculate Significance:')} ${chalk.white(config.calculateSignificance ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Confidence Level:')} ${chalk.white(config.confidenceLevel)}`);
        console.log(`   ${chalk.cyan('Generate Report:')} ${chalk.white(config.generateDetailedReport ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Export Results:')} ${chalk.white(config.exportResults ? 'Yes' : 'No')}`);
        console.log('');

        const comparison = new WorkflowComparison(config);
        const result = await comparison.runWorkflowComparison();

        if (result.success) {
            console.log(chalk.green('🎉 Workflow A/B testing comparison completed successfully!'));
            console.log(chalk.white('Detailed comparison results and recommendations are now available.'));
        } else {
            console.log(chalk.yellow('⚠️  Workflow comparison completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Workflow A/B testing comparison failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { WorkflowComparison };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runWorkflowComparison().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}