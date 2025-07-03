#!/usr/bin/env node

/**
 * Document QA Pipeline Runner
 * 
 * Executes the complete Document QA pipeline for processing documents and
 * answering questions based on their content. Follows the proven flow pattern
 * from examples/flow/run-pipeline.js.
 * 
 * Usage: node examples/document-qa/run-document-qa.js [--stages STAGES] [--question "text"]
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
    console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white('              📚 DOCUMENT QA PIPELINE RUNNER                ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('║') + chalk.gray('         Complete document-based question answering         ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        stages: 'all',
        question: null,
        style: 'comprehensive',
        docs: null,
        limit: null,
        threshold: 0.1,
        maxChunks: 5
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--stages':
                options.stages = args[++i];
                break;
            case '--question':
                options.question = args[++i];
                break;
            case '--style':
                options.style = args[++i];
                break;
            case '--docs':
                options.docs = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--threshold':
                options.threshold = parseFloat(args[++i]);
                break;
            case '--max-chunks':
                options.maxChunks = parseInt(args[++i], 10);
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
    console.log(chalk.bold.white('Usage: node run-document-qa.js [options]'));
    console.log('');
    console.log(chalk.white('Options:'));
    console.log('  --stages STAGES     Stages to run: "all", "1-3", "2,4", etc. (default: all)');
    console.log('  --question "text"   Process specific question (for stages 2-4)');
    console.log('  --style STYLE       Answer style: brief, comprehensive, detailed (default: comprehensive)');
    console.log('  --docs PATTERN      Document pattern for stage 1 (default: docs/paper/references/*.pdf)');
    console.log('  --limit N           Limit questions/documents processed');
    console.log('  --threshold T       Similarity threshold for context retrieval (default: 0.1)');
    console.log('  --max-chunks N      Maximum chunks per question (default: 5)');
    console.log('  --help, -h          Show this help');
    console.log('');
    console.log(chalk.white('Pipeline Stages:'));
    console.log('  1. Ingest Documents     - Process PDFs and store chunks in SPARQL');
    console.log('  2. Process Questions    - Generate embeddings and extract concepts');
    console.log('  3. Retrieve Context     - Find relevant chunks for each question');
    console.log('  4. Generate Answers     - Create answers using document context');
    console.log('');
    console.log(chalk.white('Examples:'));
    console.log('  node run-document-qa.js                                        # Full pipeline');
    console.log('  node run-document-qa.js --question "What is Wikidata?"         # Single question');
    console.log('  node run-document-qa.js --stages 1 --docs "research/*.pdf"     # Ingest specific docs');
    console.log('  node run-document-qa.js --stages 2-4 --style brief            # Skip ingestion');
    console.log('  node run-document-qa.js --threshold 0.2 --max-chunks 3        # Tune retrieval');
    console.log('');
}

/**
 * Parse stage specification
 */
function parseStages(stageSpec) {
    if (stageSpec === 'all') {
        return [1, 2, 3, 4];
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
            name: 'Ingest Documents',
            script: '01-ingest-documents.js',
            description: 'Process PDFs and store chunks in SPARQL store',
            color: 'blue',
            icon: '📄'
        },
        2: {
            name: 'Process Questions',
            script: '02-process-questions.js',
            description: 'Generate embeddings and extract semantic concepts',
            color: 'green',
            icon: '🧠'
        },
        3: {
            name: 'Retrieve Context',
            script: '03-retrieve-context.js',
            description: 'Find relevant document chunks for each question',
            color: 'cyan',
            icon: '🔍'
        },
        4: {
            name: 'Generate Answers',
            script: '04-generate-answers.js',
            description: 'Create comprehensive answers using document context',
            color: 'yellow',
            icon: '📝'
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
    
    // Add stage-specific arguments
    switch (stageNumber) {
        case 1: // Ingest Documents
            if (options.docs) {
                args.push('--docs', options.docs);
            }
            if (options.limit) {
                args.push('--limit', options.limit.toString());
            }
            break;
            
        case 2: // Process Questions
            if (options.question) {
                args.push('--question', options.question);
            }
            if (options.limit) {
                args.push('--limit', options.limit.toString());
            }
            break;
            
        case 3: // Retrieve Context
            if (options.limit) {
                args.push('--limit', options.limit.toString());
            }
            if (options.threshold) {
                args.push('--threshold', options.threshold.toString());
            }
            if (options.maxChunks) {
                args.push('--max-chunks', options.maxChunks.toString());
            }
            break;
            
        case 4: // Generate Answers
            if (options.limit) {
                args.push('--limit', options.limit.toString());
            }
            if (options.style) {
                args.push('--style', options.style);
            }
            break;
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
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('                📊 DOCUMENT QA SUMMARY                       ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    
    console.log(chalk.bold.white('Pipeline Configuration:'));
    console.log(chalk.white(`   Stages executed: ${stages.join(', ')}`));
    if (options.question) {
        console.log(chalk.white(`   Question: "${options.question.substring(0, 50)}..."`));
    }
    if (options.style && stages.includes(4)) {
        console.log(chalk.white(`   Answer style: ${options.style}`));
    }
    if (options.docs && stages.includes(1)) {
        console.log(chalk.white(`   Document pattern: ${options.docs}`));
    }
    if (options.threshold && stages.includes(3)) {
        console.log(chalk.white(`   Similarity threshold: ${options.threshold}`));
    }
    if (options.maxChunks && stages.includes(3)) {
        console.log(chalk.white(`   Max chunks per question: ${options.maxChunks}`));
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
        console.log(chalk.bold.green('🎉 Document QA Pipeline completed successfully!'));
        
        if (stages.includes(4)) {
            console.log('');
            console.log(chalk.bold.cyan('📚 Document-based Question Answering Complete!'));
            console.log(chalk.gray('Your documents have been processed and questions answered using'));
            console.log(chalk.gray('semantic chunking, context retrieval, and LLM-powered generation.'));
            console.log(chalk.gray('All results are stored in the SPARQL graph for further analysis.'));
        }
    } else {
        console.log(chalk.bold.red('⚠️  Some stages failed. Check the output above for details.'));
        
        if (failureCount > 0) {
            console.log('');
            console.log(chalk.yellow('💡 Troubleshooting Tips:'));
            console.log(chalk.gray('   - Ensure SPARQL endpoint is running (Stage 1-4)'));
            console.log(chalk.gray('   - Check API keys for LLM providers (Stage 2, 4)'));
            console.log(chalk.gray('   - Verify document files exist (Stage 1)'));
            console.log(chalk.gray('   - Run stages in order: 1 → 2 → 3 → 4'));
        }
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
        
        console.log(chalk.bold.white('🚀 Starting Document QA Pipeline'));
        console.log(chalk.white(`📋 Stages to execute: ${stages.join(', ')}`));
        
        if (options.question) {
            console.log(chalk.white(`❓ Question: "${options.question.substring(0, 50)}..."`));
        }
        if (options.style && stages.includes(4)) {
            console.log(chalk.white(`💬 Answer style: ${options.style}`));
        }
        if (options.docs && stages.includes(1)) {
            console.log(chalk.white(`📁 Documents: ${options.docs}`));
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