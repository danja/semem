#!/usr/bin/env node

/**
 * Feedback Loop Flow Example
 * 
 * This example demonstrates the complete iterative feedback workflow using
 * the new core components. It shows how the complex feedback system from
 * the original examples can now be achieved with clean, composable components.
 * 
 * Usage: node examples/flow/feedback-loop.js [--mode fast|standard|comprehensive]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import new core components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import FeedbackWorkflow from '../../src/compose/workflows/FeedbackWorkflow.js';
import GraphManager from '../../src/utils/GraphManager.js';

// Import helper from examples (for SPARQL operations)
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

// Mock Wikidata research for this example
class MockWikidataResearch {
    async executeResearch(question) {
        // Simulate research delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return mock entities based on question content
        const entityCount = question.toLowerCase().includes('simple') ? 5 : 15;
        const entities = Array.from({ length: entityCount }, (_, i) => `mock-entity-${i + 1}`);
        
        return {
            ragnoEntities: entities,
            concepts: ['concept-1', 'concept-2', 'concept-3']
        };
    }
}

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white('            🔄 ITERATIVE FEEDBACK FLOW EXAMPLE              ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('║') + chalk.gray('      Complete feedback loop with research iterations       ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        mode: 'standard',
        clear: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--mode':
                options.mode = args[++i];
                if (!['fast', 'standard', 'comprehensive'].includes(options.mode)) {
                    console.log(chalk.red(`Invalid mode: ${options.mode}`));
                    process.exit(1);
                }
                break;
            case '--clear':
                options.clear = true;
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node feedback-loop.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --mode fast|standard|comprehensive  Workflow mode (default: standard)');
                console.log('  --clear                              Clear graphs before processing');
                console.log('  --help, -h                           Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }

    return options;
}

/**
 * Initialize LLM handler (following working examples pattern)
 */
async function initializeLLMHandler(config) {
    console.log(chalk.cyan('🔧 Initializing LLM handler...'));

    try {
        const llmProviders = config.get('llmProviders') || [];
        const chatProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        if (!chatProvider) {
            throw new Error('No chat LLM provider configured');
        }

        console.log(chalk.white(`   🎯 Selected provider: ${chatProvider.type} (priority ${chatProvider.priority})`));
        console.log(chalk.white(`   🤖 Model: ${chatProvider.chatModel}`));

        // Create LLM connector based on provider type
        let llmConnector;
        
        if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
            console.log(chalk.green('   ✓ Using Mistral API'));
            llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
        } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
            console.log(chalk.green('   ✓ Using Claude API'));
            llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
        } else {
            // Fallback to Ollama
            console.log(chalk.yellow('   ⚠️  API key not found or provider unavailable, falling back to Ollama'));
            llmConnector = new OllamaConnector(
                'http://localhost:11434',
                'qwen2:1.5b'
            );
            // Override model for Ollama fallback
            chatProvider.chatModel = 'qwen2:1.5b';
        }

        const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
        
        console.log(chalk.green(`   ✅ LLM handler initialized with ${chatProvider.type} provider`));
        return llmHandler;

    } catch (error) {
        console.error(chalk.red('Failed to initialize LLM handler:', error.message));
        throw error;
    }
}

/**
 * Get configuration for different workflow modes
 */
function getWorkflowOptions(mode) {
    const configs = {
        fast: {
            maxIterations: 1,
            completenessThreshold: 0.7,
            maxFollowUpQuestions: 1,
            workflowMode: 'fast'
        },
        standard: {
            maxIterations: 3,
            completenessThreshold: 0.8,
            maxFollowUpQuestions: 2,
            workflowMode: 'standard'
        },
        comprehensive: {
            maxIterations: 4,
            completenessThreshold: 0.9,
            maxFollowUpQuestions: 3,
            workflowMode: 'comprehensive'
        }
    };
    
    return configs[mode] || configs.standard;
}

/**
 * Create demo questions with varying complexity
 */
function getDemoQuestions() {
    return [
        {
            text: 'What is renewable energy?',
            uri: 'http://purl.org/stuff/beerqa/test/question/renewable-energy',
            expectedComplexity: 'medium'
        },
        {
            text: 'How do photovoltaic cells convert sunlight to electricity?',
            uri: 'http://purl.org/stuff/beerqa/test/question/photovoltaic',
            expectedComplexity: 'high'
        },
        {
            text: 'What is solar energy?',
            uri: 'http://purl.org/stuff/beerqa/test/question/solar',
            expectedComplexity: 'low'
        }
    ];
}

/**
 * Process a question through the complete feedback workflow
 */
async function processQuestionWithFeedback(question, workflow, resources, options) {
    try {
        console.log(chalk.bold.cyan(`\n🔄 Processing with feedback: "${question.text}"`));
        console.log(chalk.gray(`   Expected complexity: ${question.expectedComplexity}`));
        
        const startTime = Date.now();
        
        const input = {
            question,
            enableIterativeFeedback: true,
            enableWikidataResearch: true
        };
        
        // Execute the complete feedback workflow
        const result = await workflow.execute(input, resources, options);
        
        const duration = Date.now() - startTime;
        
        if (result.success) {
            console.log(chalk.green('   ✓ Feedback workflow completed'));
            
            // Display workflow statistics
            const data = result.data;
            const metadata = result.metadata;
            
            console.log(chalk.white(`   📊 Total duration: ${duration}ms`));
            console.log(chalk.white(`   🔄 Iterations performed: ${data.workflow.iterationsPerformed}`));
            console.log(chalk.white(`   🔍 Research questions: ${data.totalResearchQuestions || 0}`));
            console.log(chalk.white(`   📈 Entities discovered: ${data.totalEntitiesDiscovered || 0}`));
            
            if (data.completenessImprovement) {
                const improvement = (data.completenessImprovement.improvement * 100).toFixed(1);
                console.log(chalk.white(`   📋 Completeness improvement: +${improvement}%`));
                console.log(chalk.white(`   📋 Final completeness: ${(data.completenessImprovement.final * 100).toFixed(1)}%`));
            }
            
            // Display iteration breakdown
            if (data.iterations && data.iterations.length > 0) {
                console.log(chalk.gray('\n   🔄 Iteration Details:'));
                data.iterations.forEach((iteration, index) => {
                    const iterNum = index + 1;
                    const completeness = (iteration.completenessScore * 100).toFixed(1);
                    const followUps = iteration.followUpQuestions?.length || 0;
                    const entities = iteration.researchResults?.totalEntities || 0;
                    
                    console.log(chalk.gray(`      Iteration ${iterNum}: ${completeness}% complete, ${followUps} follow-ups, ${entities} entities`));
                });
            }
            
            // Display answer comparison
            const initialLength = data.initialAnswer?.length || 0;
            const finalLength = data.finalAnswer?.length || 0;
            const improvement = finalLength - initialLength;
            
            console.log(chalk.white(`   📝 Answer length: ${initialLength} → ${finalLength} (+${improvement} chars)`));
            
            // Show truncated final answer
            const answer = data.finalAnswer || 'No answer generated';
            const truncatedAnswer = answer.length > 300 ? 
                answer.substring(0, 300) + '...' : answer;
            
            console.log(chalk.gray('\n   💬 Final Answer:'));
            console.log(chalk.gray(`      ${truncatedAnswer}`));
            
            return {
                success: true,
                duration,
                iterations: data.workflow.iterationsPerformed,
                researchQuestions: data.totalResearchQuestions || 0,
                entitiesDiscovered: data.totalEntitiesDiscovered || 0,
                completenessImprovement: data.completenessImprovement?.improvement || 0,
                finalCompleteness: data.completenessImprovement?.final || 0
            };
        } else {
            console.log(chalk.red('   ❌ Feedback workflow failed:'), result.error);
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.log(chalk.red('   ❌ Error in feedback processing:'), error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Display comprehensive workflow summary
 */
function displayWorkflowSummary(results, mode, options) {
    console.log(chalk.bold.yellow('\n📊 Feedback Workflow Summary:'));
    console.log(chalk.white(`   Mode: ${mode}`));
    console.log(chalk.white(`   Max iterations: ${options.maxIterations}`));
    console.log(chalk.white(`   Completeness threshold: ${(options.completenessThreshold * 100).toFixed(0)}%`));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(chalk.white(`\n   Questions processed: ${results.length}`));
    console.log(chalk.green(`   Successful: ${successful.length}`));
    console.log(chalk.red(`   Failed: ${failed.length}`));
    
    if (successful.length > 0) {
        const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
        const totalIterations = successful.reduce((sum, r) => sum + r.iterations, 0);
        const totalResearchQuestions = successful.reduce((sum, r) => sum + r.researchQuestions, 0);
        const totalEntities = successful.reduce((sum, r) => sum + r.entitiesDiscovered, 0);
        const avgImprovement = successful.reduce((sum, r) => sum + r.completenessImprovement, 0) / successful.length;
        const avgFinalCompleteness = successful.reduce((sum, r) => sum + r.finalCompleteness, 0) / successful.length;
        
        console.log(chalk.white(`\n   📊 Performance Metrics:`));
        console.log(chalk.white(`   Average duration: ${(avgDuration / 1000).toFixed(1)}s`));
        console.log(chalk.white(`   Total iterations: ${totalIterations}`));
        console.log(chalk.white(`   Total research questions: ${totalResearchQuestions}`));
        console.log(chalk.white(`   Total entities discovered: ${totalEntities}`));
        console.log(chalk.white(`   Average improvement: +${(avgImprovement * 100).toFixed(1)}%`));
        console.log(chalk.white(`   Average final completeness: ${(avgFinalCompleteness * 100).toFixed(1)}%`));
    }
    
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        displayHeader();
        
        const args = parseArgs();
        
        console.log(chalk.cyan(`🎯 Running in ${args.mode} mode`));
        if (args.clear) {
            console.log(chalk.cyan('🧹 Will clear graphs before processing'));
        }
        
        // Initialize configuration
        console.log(chalk.cyan('\n🔧 Initializing configuration...'));
        const config = new Config('./config/config.json');
        await config.init();
        
        const workflowConfig = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
        };
        
        console.log(chalk.green('   ✓ Configuration loaded'));
        
        // Initialize components
        const llmHandler = await initializeLLMHandler(config);
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        const graphManager = new GraphManager();
        const wikidataResearch = new MockWikidataResearch();
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Create feedback workflow
        const workflow = new FeedbackWorkflow();
        
        const resources = {
            llmHandler,
            sparqlHelper,
            config: workflowConfig,
            wikidataResearch
        };
        
        const options = getWorkflowOptions(args.mode);
        
        console.log(chalk.green('   ✓ Feedback workflow configured'));
        
        // Optional: Clear graphs for clean demo
        if (args.clear) {
            console.log(chalk.cyan('\n🧹 Clearing graphs...'));
            
            for (const graphURI of Object.values(workflowConfig)) {
                const clearResult = await graphManager.clearGraph(
                    { graphURI },
                    { sparqlHelper }
                );
                
                if (clearResult.success) {
                    console.log(chalk.green(`   ✓ Cleared ${graphURI.split('/').pop()}`));
                } else {
                    console.log(chalk.yellow(`   ⚠️  Failed to clear ${graphURI.split('/').pop()}`));
                }
            }
        }
        
        // Process demo questions
        console.log(chalk.bold.white('\n🎯 Processing Questions with Iterative Feedback:'));
        
        const demoQuestions = getDemoQuestions();
        const results = [];
        
        for (const question of demoQuestions) {
            const result = await processQuestionWithFeedback(question, workflow, resources, options);
            results.push(result);
        }
        
        // Display comprehensive summary
        displayWorkflowSummary(results, args.mode, options);
        
        console.log(chalk.bold.green('🎉 Iterative feedback flow example completed!'));
        console.log('');
        console.log(chalk.gray('This example demonstrates:'));
        console.log(chalk.gray('• Complete iterative feedback workflow'));
        console.log(chalk.gray('• Automated follow-up question generation'));
        console.log(chalk.gray('• Simulated Wikidata research integration'));
        console.log(chalk.gray('• Progressive answer improvement'));
        console.log(chalk.gray('• Configurable workflow modes'));
        console.log('');
        console.log(chalk.cyan('Try different modes: --mode fast|standard|comprehensive'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}