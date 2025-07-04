#!/usr/bin/env node

/**
 * Basic BeerQA Flow Example
 * 
 * This example demonstrates the simplified BeerQA workflow using the new
 * core components. It shows how the complex functionality from the original
 * examples can now be achieved with much cleaner, more maintainable code.
 * 
 * Usage: node examples/flow/basic-beerqa.js
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
import BeerQAWorkflow from '../../src/compose/workflows/BeerQAWorkflow.js';
import GraphManager from '../../src/utils/GraphManager.js';

// Import helper from examples (for SPARQL operations)
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

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
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('               🚀 BASIC BEERQA FLOW EXAMPLE                ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('          Simplified workflow using core components          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Initialize LLM handler with provider priority (following working examples pattern)
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
 * Create SPARQL helper for graph operations
 */
function createSPARQLHelper(config) {
    const sparqlEndpoint = config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update';
    const sparqlAuth = config.get('sparqlAuth') || { user: 'admin', password: 'admin123' };
    
    return new SPARQLHelper(sparqlEndpoint, {
        auth: sparqlAuth,
        timeout: 30000
    });
}

/**
 * Create test questions for demonstration
 */
function getTestQuestions() {
    return [
        {
            text: 'What is artificial intelligence?',
            uri: 'http://purl.org/stuff/beerqa/test/question/ai'
        },
        {
            text: 'How does machine learning work?',
            uri: 'http://purl.org/stuff/beerqa/test/question/ml'
        },
        {
            text: 'What are neural networks?',
            uri: 'http://purl.org/stuff/beerqa/test/question/nn'
        }
    ];
}

/**
 * Run a single question through the BeerQA workflow
 */
async function processQuestion(question, workflow, resources, options) {
    try {
        console.log(chalk.bold.cyan(`\n🔍 Processing: "${question.text}"`));
        
        const startTime = Date.now();
        
        // Execute the workflow
        const result = await workflow.execute(
            { question },
            resources,
            options
        );
        
        const duration = Date.now() - startTime;
        
        if (result.success) {
            console.log(chalk.green('   ✓ Workflow completed successfully'));
            console.log(chalk.white(`   📊 Duration: ${duration}ms`));
            console.log(chalk.white(`   📈 Corpuscles used: ${result.data.corpusclesUsed || 0}`));
            console.log(chalk.white(`   📝 Answer length: ${result.data.answer?.length || 0} characters`));
            
            // Display answer (truncated)
            const answer = result.data.answer || 'No answer generated';
            const truncatedAnswer = answer.length > 200 ? 
                answer.substring(0, 200) + '...' : answer;
            
            console.log(chalk.gray('   💬 Answer:'));
            console.log(chalk.gray(`      ${truncatedAnswer}`));
            
            return result;
        } else {
            console.log(chalk.red('   ❌ Workflow failed:'), result.error);
            return null;
        }
        
    } catch (error) {
        console.log(chalk.red('   ❌ Error processing question:'), error.message);
        return null;
    }
}

/**
 * Display workflow summary
 */
function displaySummary(results) {
    console.log(chalk.bold.yellow('\n📊 Workflow Summary:'));
    
    const successful = results.filter(r => r !== null);
    const failed = results.filter(r => r === null);
    
    console.log(chalk.white(`   Questions processed: ${results.length}`));
    console.log(chalk.green(`   Successful: ${successful.length}`));
    console.log(chalk.red(`   Failed: ${failed.length}`));
    
    if (successful.length > 0) {
        const avgDuration = successful.reduce((sum, r) => sum + (r.metadata?.duration || 0), 0) / successful.length;
        const totalCorpuscles = successful.reduce((sum, r) => sum + (r.data.corpusclesUsed || 0), 0);
        
        console.log(chalk.white(`   Average duration: ${avgDuration.toFixed(0)}ms`));
        console.log(chalk.white(`   Total corpuscles used: ${totalCorpuscles}`));
    }
    
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        displayHeader();
        
        // Initialize configuration
        console.log(chalk.cyan('🔧 Initializing configuration...'));
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
        const sparqlHelper = createSPARQLHelper(config);
        const graphManager = new GraphManager();
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Create BeerQA workflow
        const workflow = new BeerQAWorkflow();
        
        const resources = {
            llmHandler,
            sparqlHelper,
            config: workflowConfig
        };
        
        const options = {
            maxContextTokens: 4000,
            useEnhancedContext: true,
            answerStyle: 'comprehensive',
            maxRelatedCorpuscles: 8
        };
        
        console.log(chalk.green('   ✓ Workflow configured'));
        
        // Optional: Clear graph for clean demo
        if (process.argv.includes('--clear')) {
            console.log(chalk.cyan('\n🧹 Clearing BeerQA graph...'));
            const clearResult = await graphManager.clearGraph(
                { graphURI: workflowConfig.beerqaGraphURI },
                { sparqlHelper }
            );
            
            if (clearResult.success) {
                console.log(chalk.green(`   ✓ ${clearResult.message}`));
            } else {
                console.log(chalk.yellow(`   ⚠️  Clear failed: ${clearResult.error}`));
            }
        }
        
        // Process test questions
        console.log(chalk.bold.white('\n🎯 Processing Test Questions:'));
        
        const testQuestions = getTestQuestions();
        const results = [];
        
        for (const question of testQuestions) {
            const result = await processQuestion(question, workflow, resources, options);
            results.push(result);
        }
        
        // Display summary
        displaySummary(results);
        
        console.log(chalk.bold.green('🎉 Basic BeerQA flow example completed!'));
        console.log('');
        console.log(chalk.gray('This example demonstrates:'));
        console.log(chalk.gray('• Simplified workflow components'));
        console.log(chalk.gray('• Standardized API patterns'));
        console.log(chalk.gray('• Clean resource management'));
        console.log(chalk.gray('• Consistent error handling'));
        console.log('');
        console.log(chalk.cyan('Try running with --clear to reset the graph first'));
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