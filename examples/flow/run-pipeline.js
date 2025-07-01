#!/usr/bin/env node

/**
 * Flow Pipeline Runner
 * 
 * Executes the complete 10-stage Flow pipeline matching the BeerQA iterative 
 * feedback workflow. Provides options for running individual stages or the 
 * complete pipeline.
 * 
 * Usage: node examples/flow/run-pipeline.js [--stages STAGES] [--limit N] [--mode MODE]
 */

import path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.rainbow('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.rainbow('║') + chalk.bold.white('                🚀 FLOW PIPELINE RUNNER                      ') + chalk.bold.rainbow('║'));
    console.log(chalk.bold.rainbow('║') + chalk.gray('           Complete 10-stage iterative workflow             ') + chalk.bold.rainbow('║'));
    console.log(chalk.bold.rainbow('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        stages: 'all',
        limit: null,
        mode: 'standard',
        question: null
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--stages':
                options.stages = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--mode':
                options.mode = args[++i];
                break;
            case '--question':
                options.question = args[++i];
                break;
            case '--help':
            case '-h':
                displayHelp();
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Display help information
 */
function displayHelp() {
    console.log(chalk.bold.white('Usage: node run-pipeline.js [options]'));
    console.log('');
    console.log(chalk.white('Options:'));
    console.log('  --stages STAGES     Stages to run: "all", "1-5", "8-10", "1,3,5" (default: all)');
    console.log('  --limit N           Limit number of questions processed per stage (default: all)');
    console.log('  --mode MODE         Feedback mode for stage 10: fast, standard, comprehensive (default: standard)');
    console.log('  --question "text"   Process single question through pipeline (default: use stored questions)');
    console.log('  --help, -h          Show this help');
    console.log('');
    console.log(chalk.white('Pipeline Stages:'));
    console.log('  1. Load Questions       - Initialize questions from JSON data');
    console.log('  2. Augment Questions    - Add embeddings and extract concepts');
    console.log('  3. Research Concepts    - Research concepts via Wikipedia');
    console.log('  4. Build Relationships  - Create formal relationship infrastructure');
    console.log('  5. Rank Corpuscles      - Analyze graph structure and rank importance');
    console.log('  6. Community Analysis   - Detect communities using Leiden algorithm');
    console.log('  7. ZPT Navigation       - Semantic navigation enhancement');
    console.log('  8. Wikidata Research    - Enhance corpus with global Wikidata entities');
    console.log('  9. Enhanced Answers     - Generate answers with multi-source context');
    console.log('  10. Iterative Feedback  - Automated iterative answer improvement');
    console.log('');
    console.log(chalk.white('Examples:'));
    console.log('  node run-pipeline.js                                    # Run complete pipeline');
    console.log('  node run-pipeline.js --stages 1-3 --limit 5             # Run stages 1-3 with 5 questions');
    console.log('  node run-pipeline.js --stages 8-10 --mode comprehensive # Run final stages in comprehensive mode');
    console.log('  node run-pipeline.js --question "What is AI?" --stages 9-10 # Single question through final stages');
    console.log('');
}

/**
 * Parse stage specification
 */
function parseStages(stageSpec) {
    if (stageSpec === 'all') {
        return [1, 2, 3, 8, 9, 10]; // Core pipeline stages
    }
    
    if (stageSpec.includes('-')) {
        const [start, end] = stageSpec.split('-').map(n => parseInt(n, 10));
        const stages = [];
        for (let i = start; i <= end; i++) {
            stages.push(i);
        }
        return stages;
    }
    
    if (stageSpec.includes(',')) {
        return stageSpec.split(',').map(n => parseInt(n.trim(), 10));
    }
    
    return [parseInt(stageSpec, 10)];
}

/**
 * Get stage configuration
 */
function getStageConfig(stageNumber) {
    const stages = {
        1: {
            name: 'Load Questions',
            script: '01-load-questions.js',
            description: 'Initialize questions with proper metadata',
            color: 'blue',
            icon: '📝'
        },
        2: {
            name: 'Augment Questions',
            script: '02-augment-questions.js',
            description: 'Add embeddings and extract semantic concepts',
            color: 'green',
            icon: '🧠'
        },
        3: {
            name: 'Research Concepts',
            script: '03-research-concepts.js',
            description: 'Research concepts via Wikipedia integration',
            color: 'cyan',
            icon: '🔍'
        },
        4: {
            name: 'Build Relationships',
            script: '04-build-relationships.js',
            description: 'Create formal relationship infrastructure',
            color: 'yellow',
            icon: '🔗'
        },
        5: {
            name: 'Rank Corpuscles',
            script: '05-rank-corpuscles.js',
            description: 'Analyze graph structure and rank importance',
            color: 'magenta',
            icon: '📊'
        },
        6: {
            name: 'Community Analysis',
            script: '06-community-analysis.js',
            description: 'Detect communities using Leiden algorithm',
            color: 'red',
            icon: '🌐'
        },
        7: {
            name: 'ZPT Navigation',
            script: '07-zpt-navigation.js',
            description: 'Semantic navigation enhancement',
            color: 'white',
            icon: '🧭'
        },
        8: {
            name: 'Wikidata Research',
            script: '08-wikidata-research.js',
            description: 'Enhance corpus with global Wikidata entities',
            color: 'magenta',
            icon: '🌐'
        },
        9: {
            name: 'Enhanced Answers',
            script: '09-enhanced-answers.js',
            description: 'Generate answers with multi-source context',
            color: 'yellow',
            icon: '📝'
        },
        10: {
            name: 'Iterative Feedback',
            script: '10-iterative-feedback.js',
            description: 'Automated iterative answer improvement',
            color: 'red',
            icon: '🔄'
        }
    };
    
    return stages[stageNumber];
}

/**
 * Execute a single stage
 */
async function executeStage(stageNumber, options) {
    const stageConfig = getStageConfig(stageNumber);
    
    if (!stageConfig) {
        console.log(chalk.red(`❌ Unknown stage: ${stageNumber}`));
        return false;
    }
    
    const colorFn = chalk[stageConfig.color] || chalk.white;
    
    console.log('');
    console.log(colorFn('═'.repeat(80)));
    console.log(colorFn(`${stageConfig.icon} STAGE ${stageNumber}: ${stageConfig.name.toUpperCase()}`));
    console.log(colorFn(`${stageConfig.description}`));
    console.log(colorFn('═'.repeat(80)));
    console.log('');
    
    const scriptPath = path.resolve(__dirname, stageConfig.script);
    const args = [];
    
    // Add common arguments
    if (options.limit) {
        args.push('--limit', options.limit.toString());
    }
    
    // Add stage-specific arguments
    if (stageNumber === 10 && options.mode) {
        args.push('--mode', options.mode);
    }
    
    if ((stageNumber === 9 || stageNumber === 10) && options.question) {
        args.push('--question', options.question);
    }
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const child = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            
            if (code === 0) {
                console.log('');
                console.log(colorFn(`✅ Stage ${stageNumber} completed successfully in ${(duration / 1000).toFixed(1)}s`));
                resolve(true);
            } else {
                console.log('');
                console.log(chalk.red(`❌ Stage ${stageNumber} failed with exit code ${code}`));
                resolve(false);
            }
        });
        
        child.on('error', (error) => {
            console.log('');
            console.log(chalk.red(`❌ Stage ${stageNumber} error: ${error.message}`));
            resolve(false);
        });
    });
}

/**
 * Display pipeline summary
 */
function displayPipelineSummary(stages, results, totalDuration, options) {
    console.log('');
    console.log(chalk.bold.rainbow('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.rainbow('║') + chalk.bold.white('                    📊 PIPELINE SUMMARY                      ') + chalk.bold.rainbow('║'));
    console.log(chalk.bold.rainbow('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    
    console.log(chalk.bold.white('Pipeline Configuration:'));
    console.log(chalk.white(`   Stages executed: ${stages.join(', ')}`));
    if (options.limit) {
        console.log(chalk.white(`   Question limit: ${options.limit}`));
    }
    if (options.mode && stages.includes(10)) {
        console.log(chalk.white(`   Feedback mode: ${options.mode}`));
    }
    if (options.question) {
        console.log(chalk.white(`   Single question: "${options.question.substring(0, 50)}..."`));
    }
    console.log('');
    
    console.log(chalk.bold.white('Execution Results:'));
    
    stages.forEach((stageNumber, index) => {
        const stageConfig = getStageConfig(stageNumber);
        const success = results[index];
        const status = success ? chalk.green('✓ SUCCESS') : chalk.red('✗ FAILED');
        console.log(chalk.white(`   Stage ${stageNumber}: ${stageConfig.name} - ${status}`));
    });
    
    console.log('');
    
    const successCount = results.filter(r => r).length;
    const failureCount = results.filter(r => !r).length;
    
    console.log(chalk.bold.white('Summary Statistics:'));
    console.log(chalk.white(`   Total stages: ${stages.length}`));
    console.log(chalk.green(`   Successful: ${successCount}`));
    console.log(chalk.red(`   Failed: ${failureCount}`));
    console.log(chalk.white(`   Total execution time: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   Average time per stage: ${(totalDuration / stages.length / 1000).toFixed(1)}s`));
    console.log('');
    
    if (successCount === stages.length) {
        console.log(chalk.bold.green('🎉 All stages completed successfully!'));
        
        if (stages.includes(10)) {
            console.log('');
            console.log(chalk.bold.cyan('🔄 Iterative Feedback Pipeline Complete!'));
            console.log(chalk.gray('The complete BeerQA iterative feedback workflow has been executed.'));
            console.log(chalk.gray('Questions have been processed through all stages from initial loading'));
            console.log(chalk.gray('to final iterative improvement with multi-source knowledge integration.'));
        }
    } else {
        console.log(chalk.bold.red('⚠️  Some stages failed. Check the output above for details.'));
    }
    
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        displayHeader();
        
        const options = parseArgs();
        const stages = parseStages(options.stages);
        
        console.log(chalk.bold.white('🚀 Starting Flow Pipeline Execution'));
        console.log(chalk.white(`📋 Stages to execute: ${stages.join(', ')}`));
        if (options.limit) {
            console.log(chalk.white(`📊 Question limit: ${options.limit}`));
        }
        if (options.mode) {
            console.log(chalk.white(`⚙️  Feedback mode: ${options.mode}`));
        }
        if (options.question) {
            console.log(chalk.white(`❓ Single question mode: "${options.question.substring(0, 50)}..."`));
        }
        console.log('');
        
        const startTime = Date.now();
        const results = [];
        
        // Execute stages sequentially
        for (const stageNumber of stages) {
            const success = await executeStage(stageNumber, options);
            results.push(success);
            
            // Stop on failure unless user wants to continue
            if (!success) {
                console.log(chalk.yellow('⚠️  Stage failed. Continuing with remaining stages...'));
            }
        }
        
        const totalDuration = Date.now() - startTime;
        
        // Display final summary
        displayPipelineSummary(stages, results, totalDuration, options);
        
    } catch (error) {
        console.error(chalk.red('❌ Pipeline execution failed:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
});

// Run the pipeline
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}