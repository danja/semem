#!/usr/bin/env node

/**
 * End-to-End Workflow Orchestrator
 * 
 * This script runs the complete Semem demonstration workflow by orchestrating
 * individual modules in sequence. Each module can also be run independently.
 * 
 * Usage:
 *   node examples/end-to-end/Run.js                    # Run complete workflow
 *   node examples/end-to-end/Run.js --steps 1-3        # Run specific steps
 *   node examples/end-to-end/Run.js --module Ingest    # Run single module
 */

import chalk from 'chalk';
import Config from '../../src/Config.js';

// Import workflow modules
import IngestModule from './Ingest.js';
import EnrichSimpleModule from './EnrichSimple.js';
import SearchModule from './Search.js';
import QueryModule from './Query.js';
import AnalyticsModule from './Analytics.js';
import PageRankModule from './PageRank.js';
import VSOMModule from './VSOM.js';

class WorkflowOrchestrator {
    constructor(options = {}) {
        this.config = null;
        this.options = options;
        this.results = {};
        this.modules = new Map();
        this.executionPlan = [];
        
        // Register available modules
        this.registerModules();
    }

    registerModules() {
        // Module registry with metadata
        this.modules.set('ingest', {
            name: 'SPARQL Document Ingestion',
            class: IngestModule,
            dependencies: [],
            implemented: true
        });
        
        this.modules.set('enrich', {
            name: 'Knowledge Graph Construction (Simplified)',
            class: EnrichSimpleModule,
            dependencies: ['ingest'],
            implemented: true
        });
        
        this.modules.set('search', {
            name: 'Semantic Search & Inference',
            class: SearchModule,
            dependencies: ['ingest', 'enrich'],
            implemented: true
        });
        
        this.modules.set('query', {
            name: 'SPARQL Querying & Reasoning',
            class: QueryModule,
            dependencies: ['ingest', 'enrich'],
            implemented: true
        });
        
        this.modules.set('analytics', {
            name: 'Graph Analytics & Community Detection',
            class: AnalyticsModule,
            dependencies: ['enrich'],
            implemented: true
        });
        
        this.modules.set('pagerank', {
            name: 'Personalized PageRank Analysis',
            class: PageRankModule,
            dependencies: ['enrich'],
            implemented: true
        });
        
        this.modules.set('vsom', {
            name: 'Vector Self-Organizing Map',
            class: VSOMModule,
            dependencies: ['search'],
            implemented: true
        });
        
        this.modules.set('hyde', {
            name: 'HyDE Enhancement',
            class: null, // HydeModule,
            dependencies: ['search'],
            implemented: false
        });
        
        this.modules.set('qa', {
            name: 'Multi-Modal Question Answering',
            class: null, // QaModule,
            dependencies: ['search', 'enrich'],
            implemented: false
        });
        
        this.modules.set('report', {
            name: 'Integration Report',
            class: null, // ReportModule,
            dependencies: ['ingest', 'enrich', 'search'],
            implemented: false
        });
    }

    async initialize() {
        console.log(chalk.bold.magenta('🎯 SEMEM END-TO-END WORKFLOW ORCHESTRATOR'));
        console.log(chalk.gray('   Modular demonstration of complete Semem capabilities\n'));

        // Load shared configuration
        this.config = new Config();
        await this.config.init();
        console.log('✅ Configuration loaded\n');

        // Parse execution plan
        this.parseExecutionPlan();
        this.displayExecutionPlan();
    }

    parseExecutionPlan() {
        const args = process.argv.slice(2);
        
        if (args.includes('--help') || args.includes('-h')) {
            this.showHelp();
            process.exit(0);
        }

        // Check for specific module execution
        const moduleIndex = args.indexOf('--module');
        if (moduleIndex !== -1 && args[moduleIndex + 1]) {
            const moduleName = args[moduleIndex + 1].toLowerCase();
            if (this.modules.has(moduleName)) {
                this.executionPlan = [moduleName];
                return;
            } else {
                throw new Error(`Unknown module: ${moduleName}`);
            }
        }

        // Check for step range
        const stepsIndex = args.indexOf('--steps');
        if (stepsIndex !== -1 && args[stepsIndex + 1]) {
            const stepRange = args[stepsIndex + 1];
            this.parseStepRange(stepRange);
            return;
        }

        // Default: run all implemented modules
        this.executionPlan = Array.from(this.modules.keys()).filter(
            name => this.modules.get(name).implemented
        );
    }

    parseStepRange(range) {
        const moduleNames = Array.from(this.modules.keys());
        
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()));
            if (start >= 1 && end <= moduleNames.length && start <= end) {
                this.executionPlan = moduleNames.slice(start - 1, end)
                    .filter(name => this.modules.get(name).implemented);
            } else {
                throw new Error(`Invalid step range: ${range}`);
            }
        } else {
            const step = parseInt(range);
            if (step >= 1 && step <= moduleNames.length) {
                const moduleName = moduleNames[step - 1];
                if (this.modules.get(moduleName).implemented) {
                    this.executionPlan = [moduleName];
                } else {
                    throw new Error(`Module ${step} (${moduleName}) not yet implemented`);
                }
            } else {
                throw new Error(`Invalid step number: ${step}`);
            }
        }
    }

    displayExecutionPlan() {
        console.log(chalk.bold.blue('📋 EXECUTION PLAN:'));
        
        if (this.executionPlan.length === 0) {
            console.log(chalk.yellow('   No modules to execute\n'));
            return;
        }

        this.executionPlan.forEach((moduleName, index) => {
            const module = this.modules.get(moduleName);
            const status = module.implemented ? '✅' : '⚠️';
            console.log(`   ${index + 1}. ${status} ${module.name}`);
        });
        
        console.log('');
    }

    async executeWorkflow() {
        console.log(chalk.bold.green('🚀 STARTING WORKFLOW EXECUTION\n'));

        for (let i = 0; i < this.executionPlan.length; i++) {
            const moduleName = this.executionPlan[i];
            const moduleInfo = this.modules.get(moduleName);
            
            console.log(chalk.bold.cyan(`\n📦 STEP ${i + 1}/${this.executionPlan.length}: ${moduleInfo.name.toUpperCase()}`));
            console.log(chalk.gray('─'.repeat(60)));

            if (!moduleInfo.implemented) {
                console.log(chalk.yellow(`⚠️  Module '${moduleName}' not yet implemented - skipping\n`));
                continue;
            }

            try {
                // Check dependencies
                await this.checkDependencies(moduleName);
                
                // Execute module
                const startTime = Date.now();
                const moduleInstance = new moduleInfo.class(this.config);
                
                await moduleInstance.initialize();
                await moduleInstance.execute();
                await moduleInstance.cleanup();
                
                // Store results for dependent modules
                this.results[moduleName] = moduleInstance.getResults();
                
                const duration = Date.now() - startTime;
                console.log(chalk.bold.green(`✅ Module '${moduleName}' completed in ${duration}ms`));
                
            } catch (error) {
                console.log(chalk.red(`❌ Module '${moduleName}' failed: ${error.message}`));
                
                if (this.options.stopOnError !== false) {
                    throw new Error(`Workflow stopped due to failure in module '${moduleName}': ${error.message}`);
                } else {
                    console.log(chalk.yellow('⚠️  Continuing with next module despite error\n'));
                }
            }
        }
    }

    async checkDependencies(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        const missingDeps = moduleInfo.dependencies.filter(dep => !this.results[dep]);
        
        if (missingDeps.length > 0) {
            throw new Error(`Module '${moduleName}' has unmet dependencies: ${missingDeps.join(', ')}`);
        }
    }

    async generateSummary() {
        console.log(chalk.bold.magenta('\n📊 WORKFLOW EXECUTION SUMMARY'));
        console.log(chalk.gray('═'.repeat(60)));

        const successful = Object.keys(this.results).length;
        const total = this.executionPlan.length;
        
        console.log(`📈 Modules completed: ${chalk.bold.green(successful)}/${total}`);
        console.log(`⏱️  Total execution time: ${chalk.bold(this.getTotalDuration())}ms`);
        
        if (successful > 0) {
            console.log('\n🎯 Module Results:');
            for (const [moduleName, result] of Object.entries(this.results)) {
                const moduleInfo = this.modules.get(moduleName);
                const status = result.success ? '✅' : '❌';
                console.log(`   ${status} ${moduleInfo.name}`);
                
                if (result.success) {
                    this.displayModuleResults(moduleName, result);
                } else {
                    console.log(`      Error: ${result.error}`);
                }
            }
        }

        if (successful === total && total > 0) {
            console.log(chalk.bold.green('\n🎉 ALL MODULES COMPLETED SUCCESSFULLY!'));
            console.log(chalk.gray('   End-to-end Semem workflow demonstration complete\n'));
        } else if (successful > 0) {
            console.log(chalk.bold.yellow(`\n⚠️  PARTIAL SUCCESS: ${successful}/${total} modules completed`));
        } else {
            console.log(chalk.bold.red('\n❌ WORKFLOW FAILED: No modules completed successfully'));
        }
    }

    displayModuleResults(moduleName, result) {
        switch (moduleName) {
            case 'ingest':
                console.log(`      Documents: ${result.documentsProcessed}, Words: ${result.totalWords}`);
                break;
            case 'enrich':
                console.log(`      Entities: ${result.entitiesExtracted}, Units: ${result.semanticUnitsCreated}, Embeddings: ${result.embeddingsGenerated}`);
                break;
            case 'search':
                console.log(`      Queries: ${result.searchQueriesExecuted}, Avg Similarity: ${result.averageSimilarity?.toFixed(3) || 'N/A'}, Cross-domain: ${result.crossDomainConnections}`);
                break;
            case 'query':
                console.log(`      SPARQL Queries: ${result.queriesExecuted}, Relationships: ${result.relationshipsFound}, Inferences: ${result.inferredConnections}`);
                break;
            case 'analytics':
                console.log(`      Nodes: ${result.nodesAnalyzed}, Communities: ${result.communitiesFound}, Density: ${(result.networkDensity * 100).toFixed(1)}%`);
                break;
            case 'pagerank':
                console.log(`      Entities: ${result.entitiesAnalyzed}, Top Score: ${result.topScore?.toFixed(4) || 'N/A'}, Convergence: ${result.converged ? 'Yes' : 'No'}`);
                break;
            case 'vsom':
                console.log(`      Entities: ${result.entitiesProcessed}, Map: ${result.mapSize}, Clusters: ${result.clustersFound}, Epochs: ${result.trainingEpochs}`);
                break;
            default:
                console.log(`      Status: ${result.success ? 'Success' : 'Failed'}`);
        }
    }

    getTotalDuration() {
        // This would track actual execution time in a real implementation
        return 'N/A';
    }

    showHelp() {
        console.log(chalk.bold.blue('Semem End-to-End Workflow Orchestrator\n'));
        console.log('Usage:');
        console.log('  node examples/end-to-end/Run.js                    Run complete workflow');
        console.log('  node examples/end-to-end/Run.js --steps 1-3        Run steps 1 through 3');
        console.log('  node examples/end-to-end/Run.js --steps 2          Run only step 2');
        console.log('  node examples/end-to-end/Run.js --module ingest    Run specific module');
        console.log('  node examples/end-to-end/Run.js --help             Show this help\n');
        
        console.log('Available modules:');
        let stepNum = 1;
        for (const [name, info] of this.modules) {
            const status = info.implemented ? '✅' : '🚧';
            console.log(`  ${stepNum}. ${status} ${name} - ${info.name}`);
            stepNum++;
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.executeWorkflow();
            await this.generateSummary();
            
        } catch (error) {
            console.error(chalk.red('\n💥 Workflow execution failed:'), error.message);
            process.exit(1);
        }
    }
}

// Run the orchestrator if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const orchestrator = new WorkflowOrchestrator();
    orchestrator.run();
}

export default WorkflowOrchestrator;