#!/usr/bin/env node

/**
 * @fileoverview Module 10: Integration Report
 * 
 * This module generates comprehensive analysis and reporting of the complete
 * Semem workflow execution. It aggregates results from all previous modules,
 * analyzes system performance, integration quality, and provides detailed
 * insights into the semantic memory system's capabilities and effectiveness.
 * 
 * Dependencies: All previous modules (1-9) - requires their execution results
 * 
 * Usage:
 *   node examples/end-to-end/Report.js
 * 
 * Features:
 * - Workflow execution analysis and performance metrics
 * - Cross-module integration assessment
 * - Knowledge graph quality evaluation
 * - Semantic search effectiveness analysis
 * - AI capabilities assessment (HyDE, QA, VSOM)
 * - System health and reliability reporting
 * - Comprehensive benchmarking and recommendations
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Config from '../../src/Config.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Integration Report Generator
 */
class IntegrationReportGenerator {
    constructor(config) {
        this.config = config;
        this.workflowResults = {};
        this.systemMetrics = {};
        this.analysisResults = {};
        this.recommendations = [];
        this.reportSections = new Map();
    }

    /**
     * Collect results from all executed modules
     */
    collectWorkflowResults(moduleResults) {
        this.workflowResults = moduleResults;
        console.log(`📊 Collected results from ${Object.keys(moduleResults).length} modules`);
        
        // Log what we received
        Object.entries(moduleResults).forEach(([module, result]) => {
            console.log(`   ✓ ${module}: ${result.success ? 'Success' : 'Failed'}`);
        });
    }

    /**
     * Analyze system performance metrics
     */
    async analyzeSystemPerformance() {
        console.log('🔍 Analyzing system performance...');
        
        const performance = {
            modulesExecuted: Object.keys(this.workflowResults).length,
            successfulModules: Object.values(this.workflowResults).filter(r => r.success).length,
            failedModules: Object.values(this.workflowResults).filter(r => !r.success).length,
            overallSuccessRate: 0,
            dataProcessingStats: {},
            integrationQuality: {}
        };

        performance.overallSuccessRate = (performance.successfulModules / performance.modulesExecuted) * 100;

        // Analyze data processing statistics
        if (this.workflowResults.ingest) {
            const ingest = this.workflowResults.ingest;
            performance.dataProcessingStats.documentsProcessed = ingest.documentsProcessed || 0;
            performance.dataProcessingStats.totalWords = ingest.totalWords || 0;
            performance.dataProcessingStats.avgWordsPerDoc = 
                ingest.documentsProcessed > 0 ? (ingest.totalWords / ingest.documentsProcessed).toFixed(1) : 0;
        }

        if (this.workflowResults.enrich) {
            const enrich = this.workflowResults.enrich;
            performance.dataProcessingStats.entitiesExtracted = enrich.entitiesExtracted || 0;
            performance.dataProcessingStats.semanticUnits = enrich.semanticUnitsCreated || 0;
            performance.dataProcessingStats.embeddings = enrich.embeddingsGenerated || 0;
        }

        // Integration quality assessment
        const integrationScores = this.assessIntegrationQuality();
        performance.integrationQuality = integrationScores;

        this.systemMetrics.performance = performance;
        
        console.log(`   ✓ Success rate: ${performance.overallSuccessRate.toFixed(1)}%`);
        console.log(`   ✓ Integration quality: ${integrationScores.overall.toFixed(1)}/10`);
        
        return performance;
    }

    /**
     * Assess integration quality between modules
     */
    assessIntegrationQuality() {
        const scores = {
            dataFlow: 0,
            semanticContinuity: 0,
            crossDomainConnections: 0,
            aiCapabilities: 0,
            overall: 0
        };

        let totalComponents = 0;

        // Data flow assessment (Ingest → Enrich → Search)
        if (this.workflowResults.ingest?.success && 
            this.workflowResults.enrich?.success && 
            this.workflowResults.search?.success) {
            
            const ingestDocs = this.workflowResults.ingest.documentsProcessed || 0;
            const enrichEntities = this.workflowResults.enrich.entitiesExtracted || 0;
            const searchQueries = this.workflowResults.search.searchQueriesExecuted || 0;
            
            if (ingestDocs > 0 && enrichEntities > 0 && searchQueries > 0) {
                scores.dataFlow = 10;
            } else if (ingestDocs > 0 && enrichEntities > 0) {
                scores.dataFlow = 7;
            } else if (ingestDocs > 0) {
                scores.dataFlow = 4;
            }
        }
        totalComponents++;

        // Semantic continuity (Search → Analytics → PageRank)
        if (this.workflowResults.search?.success && 
            this.workflowResults.analytics?.success) {
            
            const searchSimilarity = this.workflowResults.search.averageSimilarity || 0;
            const analyticsNodes = this.workflowResults.analytics.nodesAnalyzed || 0;
            
            if (searchSimilarity > 0.5 && analyticsNodes > 0) {
                scores.semanticContinuity = 10;
            } else if (searchSimilarity > 0.3 && analyticsNodes > 0) {
                scores.semanticContinuity = 7;
            } else if (analyticsNodes > 0) {
                scores.semanticContinuity = 5;
            }
        }
        totalComponents++;

        // Cross-domain connections
        if (this.workflowResults.search?.crossDomainConnections > 0 ||
            this.workflowResults.analytics?.communitiesFound > 1) {
            scores.crossDomainConnections = 10;
        } else if (this.workflowResults.search?.success) {
            scores.crossDomainConnections = 6;
        }
        totalComponents++;

        // AI capabilities assessment (VSOM, HyDE, QA)
        let aiScore = 0;
        let aiModules = 0;
        
        if (this.workflowResults.vsom?.success) {
            aiScore += this.workflowResults.vsom.clustersFound > 0 ? 10 : 6;
            aiModules++;
        }
        
        if (this.workflowResults.hyde?.success) {
            const improvement = this.workflowResults.hyde.averageImprovement || 0;
            aiScore += improvement > 5 ? 10 : (improvement > 0 ? 7 : 5);
            aiModules++;
        }
        
        if (this.workflowResults.qa?.success) {
            const confidence = this.workflowResults.qa.averageConfidence || 0;
            aiScore += confidence > 0.7 ? 10 : (confidence > 0.4 ? 7 : 5);
            aiModules++;
        }
        
        scores.aiCapabilities = aiModules > 0 ? aiScore / aiModules : 0;
        totalComponents++;

        // Calculate overall score
        scores.overall = (scores.dataFlow + scores.semanticContinuity + 
                         scores.crossDomainConnections + scores.aiCapabilities) / totalComponents;

        return scores;
    }

    /**
     * Analyze knowledge graph quality and coverage
     */
    analyzeKnowledgeGraph() {
        console.log('🕸️  Analyzing knowledge graph quality...');
        
        const analysis = {
            coverage: {},
            quality: {},
            connectivity: {},
            semanticRichness: {}
        };

        // Coverage analysis
        if (this.workflowResults.ingest && this.workflowResults.enrich) {
            const docs = this.workflowResults.ingest.documentsProcessed || 0;
            const entities = this.workflowResults.enrich.entitiesExtracted || 0;
            const words = this.workflowResults.ingest.totalWords || 0;
            
            analysis.coverage = {
                documentsProcessed: docs,
                entitiesExtracted: entities,
                totalWords: words,
                entityDensity: docs > 0 ? (entities / docs).toFixed(2) : 0,
                extractionEfficiency: words > 0 ? (entities / words * 1000).toFixed(2) : 0
            };
        }

        // Quality assessment based on search performance
        if (this.workflowResults.search) {
            const avgSim = this.workflowResults.search.averageSimilarity || 0;
            const crossDomain = this.workflowResults.search.crossDomainConnections || 0;
            
            analysis.quality = {
                averageSemanticSimilarity: avgSim,
                crossDomainConnections: crossDomain,
                qualityScore: this.calculateQualityScore(avgSim, crossDomain)
            };
        }

        // Connectivity analysis
        if (this.workflowResults.analytics) {
            const nodes = this.workflowResults.analytics.nodesAnalyzed || 0;
            const communities = this.workflowResults.analytics.communitiesFound || 0;
            const density = this.workflowResults.analytics.networkDensity || 0;
            
            analysis.connectivity = {
                nodesAnalyzed: nodes,
                communitiesDetected: communities,
                networkDensity: density,
                connectivityScore: this.calculateConnectivityScore(nodes, communities, density)
            };
        }

        // Semantic richness from VSOM clustering
        if (this.workflowResults.vsom) {
            const clusters = this.workflowResults.vsom.clustersFound || 0;
            const entities = this.workflowResults.vsom.entitiesProcessed || 0;
            const mapSize = this.workflowResults.vsom.mapSize || '0x0';
            
            analysis.semanticRichness = {
                topologicalClusters: clusters,
                entitiesProcessed: entities,
                mapDimensions: mapSize,
                clusteringEffectiveness: entities > 0 ? (clusters / entities).toFixed(3) : 0
            };
        }

        this.analysisResults.knowledgeGraph = analysis;
        return analysis;
    }

    /**
     * Calculate knowledge graph quality score
     */
    calculateQualityScore(avgSimilarity, crossDomainConnections) {
        let score = 0;
        
        // Similarity contribution (0-60 points)
        score += Math.min(avgSimilarity * 100, 60);
        
        // Cross-domain contribution (0-40 points)
        score += Math.min(crossDomainConnections * 10, 40);
        
        return Math.min(score, 100);
    }

    /**
     * Calculate connectivity score
     */
    calculateConnectivityScore(nodes, communities, density) {
        let score = 0;
        
        // Node count contribution
        score += Math.min(nodes * 2, 30);
        
        // Community structure contribution
        score += Math.min(communities * 15, 45);
        
        // Density contribution
        score += Math.min(density * 100, 25);
        
        return Math.min(score, 100);
    }

    /**
     * Analyze AI capabilities performance
     */
    analyzeAICapabilities() {
        console.log('🤖 Analyzing AI capabilities...');
        
        const analysis = {
            semanticEnhancement: {},
            questionAnswering: {},
            visualization: {},
            overallAIEffectiveness: 0
        };

        let totalAIScore = 0;
        let aiModuleCount = 0;

        // HyDE enhancement analysis
        if (this.workflowResults.hyde) {
            const hyde = this.workflowResults.hyde;
            analysis.semanticEnhancement = {
                queriesProcessed: hyde.queriesProcessed || 0,
                hypotheticalDocsGenerated: hyde.hypotheticalDocsGenerated || 0,
                averageImprovement: hyde.averageImprovement || 0,
                bestImprovement: hyde.bestImprovement || 0,
                effectivenessScore: this.calculateHyDEScore(hyde)
            };
            
            totalAIScore += analysis.semanticEnhancement.effectivenessScore;
            aiModuleCount++;
        }

        // Question answering analysis
        if (this.workflowResults.qa) {
            const qa = this.workflowResults.qa;
            analysis.questionAnswering = {
                questionsAnswered: qa.questionsAnswered || 0,
                averageConfidence: qa.averageConfidence || 0,
                totalSources: qa.totalSources || 0,
                questionTypes: qa.questionTypes || {},
                effectivenessScore: this.calculateQAScore(qa)
            };
            
            totalAIScore += analysis.questionAnswering.effectivenessScore;
            aiModuleCount++;
        }

        // VSOM visualization analysis
        if (this.workflowResults.vsom) {
            const vsom = this.workflowResults.vsom;
            analysis.visualization = {
                entitiesProcessed: vsom.entitiesProcessed || 0,
                clustersFound: vsom.clustersFound || 0,
                mapSize: vsom.mapSize || '0x0',
                trainingEpochs: vsom.trainingEpochs || 0,
                converged: vsom.converged || false,
                effectivenessScore: this.calculateVSOMScore(vsom)
            };
            
            totalAIScore += analysis.visualization.effectivenessScore;
            aiModuleCount++;
        }

        analysis.overallAIEffectiveness = aiModuleCount > 0 ? totalAIScore / aiModuleCount : 0;

        this.analysisResults.aiCapabilities = analysis;
        return analysis;
    }

    /**
     * Calculate HyDE effectiveness score
     */
    calculateHyDEScore(hyde) {
        let score = 0;
        
        // Query processing success (0-30 points)
        score += Math.min((hyde.queriesProcessed || 0) * 5, 30);
        
        // Document generation success (0-30 points)
        score += Math.min((hyde.hypotheticalDocsGenerated || 0) * 3, 30);
        
        // Improvement effectiveness (0-40 points)
        const improvement = hyde.averageImprovement || 0;
        if (improvement > 10) score += 40;
        else if (improvement > 5) score += 30;
        else if (improvement > 0) score += 20;
        else score += 10;
        
        return Math.min(score, 100);
    }

    /**
     * Calculate QA effectiveness score
     */
    calculateQAScore(qa) {
        let score = 0;
        
        // Question processing success (0-30 points)
        score += Math.min((qa.questionsAnswered || 0) * 4, 30);
        
        // Confidence level (0-40 points)
        const confidence = qa.averageConfidence || 0;
        score += confidence * 40;
        
        // Source utilization (0-30 points)
        const avgSources = qa.questionsAnswered > 0 ? 
            (qa.totalSources / qa.questionsAnswered) : 0;
        score += Math.min(avgSources * 10, 30);
        
        return Math.min(score, 100);
    }

    /**
     * Calculate VSOM effectiveness score
     */
    calculateVSOMScore(vsom) {
        let score = 0;
        
        // Entity processing (0-25 points)
        score += Math.min((vsom.entitiesProcessed || 0) * 2, 25);
        
        // Clustering success (0-35 points)
        score += Math.min((vsom.clustersFound || 0) * 15, 35);
        
        // Training convergence (0-20 points)
        score += vsom.converged ? 20 : 10;
        
        // Training efficiency (0-20 points)
        const epochs = vsom.trainingEpochs || 0;
        if (epochs > 0 && epochs < 100) score += 20;
        else if (epochs > 0) score += 15;
        
        return Math.min(score, 100);
    }

    /**
     * Generate system health assessment
     */
    assessSystemHealth() {
        console.log('🏥 Assessing system health...');
        
        const health = {
            moduleReliability: {},
            dataIntegrity: {},
            performanceIndicators: {},
            overallHealth: 'Unknown'
        };

        // Module reliability assessment
        const totalModules = Object.keys(this.workflowResults).length;
        const successfulModules = Object.values(this.workflowResults).filter(r => r.success).length;
        const reliabilityScore = (successfulModules / totalModules) * 100;

        health.moduleReliability = {
            totalModulesExecuted: totalModules,
            successfulModules: successfulModules,
            failedModules: totalModules - successfulModules,
            reliabilityScore: reliabilityScore
        };

        // Data integrity checks
        const dataFlowIssues = this.checkDataFlowIntegrity();
        health.dataIntegrity = {
            dataFlowConsistency: dataFlowIssues.length === 0,
            identifiedIssues: dataFlowIssues,
            integrityScore: dataFlowIssues.length === 0 ? 100 : Math.max(0, 100 - dataFlowIssues.length * 20)
        };

        // Performance indicators
        health.performanceIndicators = {
            knowledgeGraphCoverage: this.analysisResults.knowledgeGraph?.coverage?.entityDensity || 0,
            semanticSearchQuality: this.analysisResults.knowledgeGraph?.quality?.qualityScore || 0,
            aiCapabilitiesScore: this.analysisResults.aiCapabilities?.overallAIEffectiveness || 0
        };

        // Overall health determination
        const avgScore = (reliabilityScore + health.dataIntegrity.integrityScore + 
                         health.performanceIndicators.aiCapabilitiesScore) / 3;
        
        if (avgScore >= 80) health.overallHealth = 'Excellent';
        else if (avgScore >= 60) health.overallHealth = 'Good';
        else if (avgScore >= 40) health.overallHealth = 'Fair';
        else health.overallHealth = 'Poor';

        this.analysisResults.systemHealth = health;
        return health;
    }

    /**
     * Check data flow integrity between modules
     */
    checkDataFlowIntegrity() {
        const issues = [];

        // Check if ingestion produced data for enrichment
        if (this.workflowResults.ingest?.success && this.workflowResults.enrich?.success) {
            const docs = this.workflowResults.ingest.documentsProcessed || 0;
            const entities = this.workflowResults.enrich.entitiesExtracted || 0;
            
            if (docs > 0 && entities === 0) {
                issues.push('No entities extracted despite successful document ingestion');
            }
        }

        // Check if enrichment produced data for search
        if (this.workflowResults.enrich?.success && this.workflowResults.search?.success) {
            const entities = this.workflowResults.enrich.entitiesExtracted || 0;
            const queries = this.workflowResults.search.searchQueriesExecuted || 0;
            
            if (entities > 0 && queries === 0) {
                issues.push('No search queries executed despite available entities');
            }
        }

        // Check AI module dependencies
        if (this.workflowResults.qa?.success && this.workflowResults.search?.success) {
            const searchSuccess = this.workflowResults.search.success;
            const qaQuestions = this.workflowResults.qa.questionsAnswered || 0;
            
            if (searchSuccess && qaQuestions === 0) {
                issues.push('QA module failed to process questions despite successful search setup');
            }
        }

        return issues;
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        this.recommendations = [];

        // Performance recommendations
        const performance = this.systemMetrics.performance;
        if (performance?.overallSuccessRate < 100) {
            this.recommendations.push({
                category: 'Performance',
                priority: 'High',
                issue: `${performance.failedModules} modules failed`,
                recommendation: 'Review module dependencies and error logs. Ensure all required services (Ollama, SPARQL) are running.',
                impact: 'Critical for workflow reliability'
            });
        }

        // Knowledge graph recommendations
        const kg = this.analysisResults.knowledgeGraph;
        if (kg?.coverage?.entityDensity < 2) {
            this.recommendations.push({
                category: 'Knowledge Graph',
                priority: 'Medium',
                issue: 'Low entity extraction density',
                recommendation: 'Consider using more sophisticated entity extraction models or increasing document corpus size.',
                impact: 'Affects search quality and AI capabilities'
            });
        }

        if (kg?.quality?.qualityScore < 60) {
            this.recommendations.push({
                category: 'Semantic Quality',
                priority: 'High',
                issue: 'Low semantic similarity scores',
                recommendation: 'Review embedding model quality and consider fine-tuning for domain-specific content.',
                impact: 'Directly impacts search and QA effectiveness'
            });
        }

        // AI capabilities recommendations
        const ai = this.analysisResults.aiCapabilities;
        if (ai?.questionAnswering?.averageConfidence < 0.6) {
            this.recommendations.push({
                category: 'AI Capabilities',
                priority: 'Medium',
                issue: 'Low QA confidence scores',
                recommendation: 'Increase knowledge graph coverage or use more advanced LLM models for question answering.',
                impact: 'Affects user trust in AI responses'
            });
        }

        if (ai?.semanticEnhancement?.averageImprovement < 5) {
            this.recommendations.push({
                category: 'AI Enhancement',
                priority: 'Low',
                issue: 'HyDE showing minimal improvement',
                recommendation: 'Fine-tune hypothetical document generation prompts or consider domain-specific training.',
                impact: 'Opportunity for search optimization'
            });
        }

        // System health recommendations
        const health = this.analysisResults.systemHealth;
        if (health?.dataIntegrity?.identifiedIssues?.length > 0) {
            this.recommendations.push({
                category: 'Data Integrity',
                priority: 'High',
                issue: 'Data flow inconsistencies detected',
                recommendation: 'Investigate and resolve data pipeline issues to ensure proper module integration.',
                impact: 'Critical for system reliability'
            });
        }

        return this.recommendations;
    }

    /**
     * Generate comprehensive report sections
     */
    generateReportSections() {
        console.log('📋 Generating report sections...');

        // Executive Summary
        this.reportSections.set('executive_summary', this.generateExecutiveSummary());
        
        // System Performance
        this.reportSections.set('performance', this.generatePerformanceReport());
        
        // Knowledge Graph Analysis
        this.reportSections.set('knowledge_graph', this.generateKnowledgeGraphReport());
        
        // AI Capabilities Assessment
        this.reportSections.set('ai_capabilities', this.generateAICapabilitiesReport());
        
        // System Health
        this.reportSections.set('system_health', this.generateSystemHealthReport());
        
        // Recommendations
        this.reportSections.set('recommendations', this.generateRecommendationsReport());
        
        // Technical Details
        this.reportSections.set('technical_details', this.generateTechnicalDetailsReport());
    }

    /**
     * Generate executive summary section
     */
    generateExecutiveSummary() {
        const performance = this.systemMetrics.performance;
        const health = this.analysisResults.systemHealth;
        const ai = this.analysisResults.aiCapabilities;

        return {
            title: 'Executive Summary',
            content: [
                `## Semem End-to-End Workflow Analysis Report`,
                ``,
                `### Overview`,
                `This report analyzes the execution of ${performance?.modulesExecuted || 0} workflow modules `,
                `with an overall success rate of ${performance?.overallSuccessRate?.toFixed(1) || 0}%. `,
                `The system demonstrates ${health?.overallHealth || 'Unknown'} health status.`,
                ``,
                `### Key Findings`,
                `- **Module Reliability**: ${performance?.successfulModules || 0}/${performance?.modulesExecuted || 0} modules executed successfully`,
                `- **Knowledge Graph**: ${this.analysisResults.knowledgeGraph?.coverage?.entitiesExtracted || 0} entities extracted from ${this.analysisResults.knowledgeGraph?.coverage?.documentsProcessed || 0} documents`,
                `- **AI Capabilities**: Overall effectiveness score of ${ai?.overallAIEffectiveness?.toFixed(1) || 0}/100`,
                `- **Integration Quality**: ${this.systemMetrics.performance?.integrationQuality?.overall?.toFixed(1) || 0}/10 integration score`,
                ``,
                `### System Status`,
                `${health?.overallHealth === 'Excellent' ? '✅' : health?.overallHealth === 'Good' ? '🟡' : '⚠️'} **${health?.overallHealth || 'Unknown'}** - `,
                `${this.getHealthDescription(health?.overallHealth)}`,
                ``,
                `### Priority Actions`,
                ...this.recommendations.filter(r => r.priority === 'High').slice(0, 3).map(r => 
                    `- **${r.category}**: ${r.issue} - ${r.recommendation}`
                )
            ].join('\n')
        };
    }

    /**
     * Get health status description
     */
    getHealthDescription(health) {
        switch (health) {
            case 'Excellent': return 'All systems operating optimally with high performance across all modules.';
            case 'Good': return 'System functioning well with minor optimization opportunities.';
            case 'Fair': return 'System operational but requires attention to improve performance.';
            case 'Poor': return 'System experiencing significant issues requiring immediate attention.';
            default: return 'System status could not be determined.';
        }
    }

    /**
     * Generate performance report section
     */
    generatePerformanceReport() {
        const perf = this.systemMetrics.performance;
        const integration = perf?.integrationQuality || {};

        return {
            title: 'System Performance Analysis',
            content: [
                `## System Performance Analysis`,
                ``,
                `### Module Execution Statistics`,
                `- **Total Modules**: ${perf?.modulesExecuted || 0}`,
                `- **Successful**: ${perf?.successfulModules || 0}`,
                `- **Failed**: ${perf?.failedModules || 0}`,
                `- **Success Rate**: ${perf?.overallSuccessRate?.toFixed(1) || 0}%`,
                ``,
                `### Data Processing Performance`,
                `- **Documents Processed**: ${perf?.dataProcessingStats?.documentsProcessed || 0}`,
                `- **Total Words**: ${perf?.dataProcessingStats?.totalWords?.toLocaleString() || 0}`,
                `- **Entities Extracted**: ${perf?.dataProcessingStats?.entitiesExtracted || 0}`,
                `- **Embeddings Generated**: ${perf?.dataProcessingStats?.embeddings || 0}`,
                `- **Avg Words/Document**: ${perf?.dataProcessingStats?.avgWordsPerDoc || 0}`,
                ``,
                `### Integration Quality Assessment`,
                `- **Data Flow**: ${integration.dataFlow?.toFixed(1) || 0}/10`,
                `- **Semantic Continuity**: ${integration.semanticContinuity?.toFixed(1) || 0}/10`,
                `- **Cross-Domain Connections**: ${integration.crossDomainConnections?.toFixed(1) || 0}/10`,
                `- **AI Capabilities**: ${integration.aiCapabilities?.toFixed(1) || 0}/10`,
                `- **Overall Integration**: ${integration.overall?.toFixed(1) || 0}/10`,
                ``
            ].join('\n')
        };
    }

    /**
     * Generate knowledge graph report section
     */
    generateKnowledgeGraphReport() {
        const kg = this.analysisResults.knowledgeGraph || {};

        return {
            title: 'Knowledge Graph Analysis',
            content: [
                `## Knowledge Graph Analysis`,
                ``,
                `### Coverage Metrics`,
                `- **Documents Processed**: ${kg.coverage?.documentsProcessed || 0}`,
                `- **Entities Extracted**: ${kg.coverage?.entitiesExtracted || 0}`,
                `- **Total Words**: ${kg.coverage?.totalWords?.toLocaleString() || 0}`,
                `- **Entity Density**: ${kg.coverage?.entityDensity || 0} entities/document`,
                `- **Extraction Efficiency**: ${kg.coverage?.extractionEfficiency || 0} entities/1000 words`,
                ``,
                `### Quality Assessment`,
                `- **Average Semantic Similarity**: ${kg.quality?.averageSemanticSimilarity?.toFixed(3) || 0}`,
                `- **Cross-Domain Connections**: ${kg.quality?.crossDomainConnections || 0}`,
                `- **Quality Score**: ${kg.quality?.qualityScore?.toFixed(1) || 0}/100`,
                ``,
                `### Network Connectivity`,
                `- **Nodes Analyzed**: ${kg.connectivity?.nodesAnalyzed || 0}`,
                `- **Communities Detected**: ${kg.connectivity?.communitiesDetected || 0}`,
                `- **Network Density**: ${(kg.connectivity?.networkDensity * 100)?.toFixed(2) || 0}%`,
                `- **Connectivity Score**: ${kg.connectivity?.connectivityScore?.toFixed(1) || 0}/100`,
                ``,
                `### Semantic Richness (VSOM Analysis)`,
                `- **Topological Clusters**: ${kg.semanticRichness?.topologicalClusters || 0}`,
                `- **Entities Processed**: ${kg.semanticRichness?.entitiesProcessed || 0}`,
                `- **Map Dimensions**: ${kg.semanticRichness?.mapDimensions || 'N/A'}`,
                `- **Clustering Effectiveness**: ${kg.semanticRichness?.clusteringEffectiveness || 0}`,
                ``
            ].join('\n')
        };
    }

    /**
     * Generate AI capabilities report section
     */
    generateAICapabilitiesReport() {
        const ai = this.analysisResults.aiCapabilities || {};

        return {
            title: 'AI Capabilities Assessment',
            content: [
                `## AI Capabilities Assessment`,
                ``,
                `### Overall AI Effectiveness: ${ai.overallAIEffectiveness?.toFixed(1) || 0}/100`,
                ``,
                `### Semantic Enhancement (HyDE)`,
                `- **Queries Processed**: ${ai.semanticEnhancement?.queriesProcessed || 0}`,
                `- **Hypothetical Documents**: ${ai.semanticEnhancement?.hypotheticalDocsGenerated || 0}`,
                `- **Average Improvement**: ${ai.semanticEnhancement?.averageImprovement?.toFixed(1) || 0}%`,
                `- **Best Improvement**: ${ai.semanticEnhancement?.bestImprovement?.toFixed(1) || 0}%`,
                `- **Effectiveness Score**: ${ai.semanticEnhancement?.effectivenessScore?.toFixed(1) || 0}/100`,
                ``,
                `### Question Answering System`,
                `- **Questions Answered**: ${ai.questionAnswering?.questionsAnswered || 0}`,
                `- **Average Confidence**: ${(ai.questionAnswering?.averageConfidence * 100)?.toFixed(1) || 0}%`,
                `- **Total Sources Used**: ${ai.questionAnswering?.totalSources || 0}`,
                `- **Question Types**: ${Object.keys(ai.questionAnswering?.questionTypes || {}).length} types`,
                `- **Effectiveness Score**: ${ai.questionAnswering?.effectivenessScore?.toFixed(1) || 0}/100`,
                ``,
                `### Visualization & Clustering (VSOM)`,
                `- **Entities Processed**: ${ai.visualization?.entitiesProcessed || 0}`,
                `- **Clusters Found**: ${ai.visualization?.clustersFound || 0}`,
                `- **Map Size**: ${ai.visualization?.mapSize || 'N/A'}`,
                `- **Training Epochs**: ${ai.visualization?.trainingEpochs || 0}`,
                `- **Converged**: ${ai.visualization?.converged ? 'Yes' : 'No'}`,
                `- **Effectiveness Score**: ${ai.visualization?.effectivenessScore?.toFixed(1) || 0}/100`,
                ``
            ].join('\n')
        };
    }

    /**
     * Generate system health report section
     */
    generateSystemHealthReport() {
        const health = this.analysisResults.systemHealth || {};

        return {
            title: 'System Health Assessment',
            content: [
                `## System Health Assessment`,
                ``,
                `### Overall Health: ${health.overallHealth || 'Unknown'}`,
                ``,
                `### Module Reliability`,
                `- **Total Modules Executed**: ${health.moduleReliability?.totalModulesExecuted || 0}`,
                `- **Successful Modules**: ${health.moduleReliability?.successfulModules || 0}`,
                `- **Failed Modules**: ${health.moduleReliability?.failedModules || 0}`,
                `- **Reliability Score**: ${health.moduleReliability?.reliabilityScore?.toFixed(1) || 0}%`,
                ``,
                `### Data Integrity`,
                `- **Data Flow Consistency**: ${health.dataIntegrity?.dataFlowConsistency ? 'Passed' : 'Issues Detected'}`,
                `- **Integrity Score**: ${health.dataIntegrity?.integrityScore?.toFixed(1) || 0}/100`,
                ``,
                ...(health.dataIntegrity?.identifiedIssues?.length > 0 ? [
                    `### Identified Issues:`,
                    ...health.dataIntegrity.identifiedIssues.map(issue => `- ${issue}`)
                ] : [`### ✅ No Data Integrity Issues Detected`]),
                ``,
                `### Performance Indicators`,
                `- **Knowledge Graph Coverage**: ${health.performanceIndicators?.knowledgeGraphCoverage || 0}`,
                `- **Semantic Search Quality**: ${health.performanceIndicators?.semanticSearchQuality?.toFixed(1) || 0}/100`,
                `- **AI Capabilities Score**: ${health.performanceIndicators?.aiCapabilitiesScore?.toFixed(1) || 0}/100`,
                ``
            ].join('\n')
        };
    }

    /**
     * Generate recommendations report section
     */
    generateRecommendationsReport() {
        return {
            title: 'Recommendations',
            content: [
                `## Recommendations`,
                ``,
                ...(this.recommendations.length > 0 ? 
                    this.recommendations.map(rec => [
                        `### ${rec.category} (${rec.priority} Priority)`,
                        `**Issue**: ${rec.issue}`,
                        `**Recommendation**: ${rec.recommendation}`,
                        `**Impact**: ${rec.impact}`,
                        ``
                    ]).flat() :
                    [`### ✅ No Critical Issues Identified`,
                     `The system is performing well with no immediate recommendations.`,
                     ``]
                )
            ].join('\n')
        };
    }

    /**
     * Generate technical details report section
     */
    generateTechnicalDetailsReport() {
        return {
            title: 'Technical Details',
            content: [
                `## Technical Details`,
                ``,
                `### Module Execution Results`,
                ...Object.entries(this.workflowResults).map(([module, result]) => [
                    `#### ${module.toUpperCase()} Module`,
                    `- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}`,
                    ...this.formatModuleDetails(module, result),
                    ``
                ]).flat(),
                ``,
                `### System Configuration`,
                `- **SPARQL Endpoint**: ${this.config?.get('sparqlEndpoints')?.[0]?.urlBase || 'Not configured'}`,
                `- **Embedding Model**: ${this.config?.get('models.embedding.model') || 'Not configured'}`,
                `- **Chat Model**: ${this.config?.get('models.chat.model') || 'Not configured'}`,
                `- **Memory Dimension**: ${this.config?.get('memory.dimension') || 'Not configured'}`,
                ``
            ].join('\n')
        };
    }

    /**
     * Format module-specific details
     */
    formatModuleDetails(module, result) {
        const details = [];
        
        switch (module) {
            case 'ingest':
                details.push(`- Documents: ${result.documentsProcessed || 0}`);
                details.push(`- Words: ${result.totalWords?.toLocaleString() || 0}`);
                break;
            case 'enrich':
                details.push(`- Entities: ${result.entitiesExtracted || 0}`);
                details.push(`- Semantic Units: ${result.semanticUnitsCreated || 0}`);
                details.push(`- Embeddings: ${result.embeddingsGenerated || 0}`);
                break;
            case 'search':
                details.push(`- Queries: ${result.searchQueriesExecuted || 0}`);
                details.push(`- Avg Similarity: ${result.averageSimilarity?.toFixed(3) || 'N/A'}`);
                details.push(`- Cross-domain: ${result.crossDomainConnections || 0}`);
                break;
            case 'qa':
                details.push(`- Questions: ${result.questionsAnswered || 0}`);
                details.push(`- Confidence: ${(result.averageConfidence * 100)?.toFixed(1) || 0}%`);
                details.push(`- Sources: ${result.totalSources || 0}`);
                break;
            case 'hyde':
                details.push(`- Queries: ${result.queriesProcessed || 0}`);
                details.push(`- Improvement: ${result.averageImprovement?.toFixed(1) || 0}%`);
                break;
            case 'vsom':
                details.push(`- Entities: ${result.entitiesProcessed || 0}`);
                details.push(`- Clusters: ${result.clustersFound || 0}`);
                details.push(`- Map: ${result.mapSize || 'N/A'}`);
                break;
            default:
                details.push(`- Status: ${result.success ? 'Completed' : 'Failed'}`);
        }
        
        return details;
    }

    /**
     * Generate and display the complete report
     */
    async generateCompleteReport() {
        console.log('\n📊 === INTEGRATION REPORT GENERATION ===\n');
        
        // Run all analyses
        await this.analyzeSystemPerformance();
        this.analyzeKnowledgeGraph();
        this.analyzeAICapabilities();
        this.assessSystemHealth();
        this.generateRecommendations();
        this.generateReportSections();

        // Display the complete report
        console.log('📋 SEMEM INTEGRATION ANALYSIS REPORT');
        console.log('═'.repeat(80));
        
        for (const [sectionId, section] of this.reportSections) {
            console.log('\n' + section.content);
            console.log('─'.repeat(80));
        }

        // Return summary for orchestrator
        return {
            modulesAnalyzed: Object.keys(this.workflowResults).length,
            overallHealth: this.analysisResults.systemHealth?.overallHealth || 'Unknown',
            integrationScore: this.systemMetrics.performance?.integrationQuality?.overall?.toFixed(1) || 0,
            aiEffectiveness: this.analysisResults.aiCapabilities?.overallAIEffectiveness?.toFixed(1) || 0,
            recommendationsCount: this.recommendations.length,
            reportSections: this.reportSections.size
        };
    }
}

/**
 * Report Module Class for orchestrator integration
 */
class ReportModule {
    constructor(config = null) {
        this.config = config;
        this.results = {
            modulesAnalyzed: 0,
            overallHealth: 'Unknown',
            integrationScore: 0,
            aiEffectiveness: 0,
            recommendationsCount: 0,
            reportGenerated: false,
            success: false
        };
    }

    async initialize() {
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }
    }

    async execute() {
        // Use workflow results if available from orchestrator, otherwise simulate minimal data
        const analysisResults = await runReportAnalysis(this.workflowResults);
        this.results.modulesAnalyzed = analysisResults?.modulesAnalyzed || 0;
        this.results.overallHealth = analysisResults?.overallHealth || 'Unknown';
        this.results.integrationScore = analysisResults?.integrationScore || 0;
        this.results.aiEffectiveness = analysisResults?.aiEffectiveness || 0;
        this.results.recommendationsCount = analysisResults?.recommendationsCount || 0;
        this.results.reportGenerated = true;
        this.results.success = true;
    }

    async cleanup() {
        // Cleanup if needed
    }

    getResults() {
        return this.results;
    }

    // Method for orchestrator to provide workflow results
    setWorkflowResults(moduleResults) {
        this.workflowResults = moduleResults;
    }
}

/**
 * Main report analysis function
 */
async function runReportAnalysis(moduleResults = null) {
    console.log('📊 === MODULE 10: INTEGRATION REPORT ===\n');
    
    try {
        // Initialize configuration
        const config = new Config();
        await config.init();
        
        console.log('✓ Configuration initialized');
        
        // Initialize report generator
        const reportGenerator = new IntegrationReportGenerator(config);
        
        // Use provided results or simulate minimal data for standalone execution
        const workflowData = moduleResults || {
            ingest: { success: true, documentsProcessed: 3, totalWords: 2530 },
            enrich: { success: true, entitiesExtracted: 9, semanticUnitsCreated: 15, embeddingsGenerated: 9 },
            search: { success: true, searchQueriesExecuted: 5, averageSimilarity: 0.611, crossDomainConnections: 1 }
        };
        
        reportGenerator.collectWorkflowResults(workflowData);
        
        // Generate complete analysis report
        const summary = await reportGenerator.generateCompleteReport();
        
        console.log('\n🎉 Integration report completed successfully!');
        
        return summary;
        
    } catch (error) {
        console.error('❌ Report generation failed:', error.message);
        
        // Return default results on error
        return {
            modulesAnalyzed: 0,
            overallHealth: 'Unknown',
            integrationScore: 0,
            aiEffectiveness: 0,
            recommendationsCount: 0,
            reportSections: 0
        };
    }
}

// Run the module if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runReportAnalysis().catch(console.error);
}

export default ReportModule;
export { runReportAnalysis };