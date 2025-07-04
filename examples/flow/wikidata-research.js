#!/usr/bin/env node

/**
 * Wikidata Research Flow Example
 * 
 * This example demonstrates the new WikidataResearcher component that provides
 * a simplified, standardized API for conducting Wikidata research. It shows how
 * the complex Wikidata integration can now be achieved with clean, reusable components.
 * 
 * Usage: node examples/flow/wikidata-research.js [--question "your question"]
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
import WikidataResearcher from '../../src/aux/wikidata/WikidataResearcher.js';
import WikidataNavigator from '../../src/aux/wikidata/WikidataNavigator.js';

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
    console.log(chalk.bold.green('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.green('║') + chalk.bold.white('            🌐 WIKIDATA RESEARCH FLOW EXAMPLE              ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('║') + chalk.gray('         Simplified Wikidata integration using core         ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('║') + chalk.gray('              components with standardized APIs              ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        question: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--question':
                options.question = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node wikidata-research.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --question "text"    Research question (default: uses demo questions)');
                console.log('  --help, -h           Show this help');
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
            console.log(chalk.yellow('   ⚠️  API key not found, falling back to Ollama'));
            llmConnector = new OllamaConnector(
                'http://localhost:11434',
                'qwen2:1.5b'
            );
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
 * Get demo research questions
 */
function getDemoQuestions() {
    return [
        'What is quantum computing?',
        'How do solar panels work?',
        'What are the effects of climate change?',
        'Who was Marie Curie?',
        'What is artificial intelligence?'
    ];
}

/**
 * Conduct Wikidata research for a question
 */
async function conductResearch(question, researcher, resources, options = {}) {
    try {
        console.log(chalk.bold.cyan(`\n🔍 Researching: "${question}"`));
        
        const startTime = Date.now();
        
        // Execute research using new component
        const result = await researcher.executeResearch(
            { question },
            resources,
            {
                maxWikidataSearchResults: options.maxEntities || 10,
                storeResults: true,
                ...options
            }
        );
        
        const duration = Date.now() - startTime;
        
        if (result.success) {
            console.log(chalk.green('   ✓ Research completed successfully'));
            console.log(chalk.white(`   📊 Duration: ${duration}ms`));
            console.log(chalk.white(`   🧠 Concepts used: ${result.concepts.length}`));
            console.log(chalk.white(`   🌐 Wikidata entities: ${result.wikidataEntities.length}`));
            console.log(chalk.white(`   📦 Ragno entities: ${result.ragnoEntities.length}`));
            console.log(chalk.white(`   💾 Stored: ${result.storageResult?.success ? 'Yes' : 'No'}`));
            
            // Display concepts
            if (result.concepts.length > 0) {
                console.log(chalk.gray('   💭 Concepts:'));
                result.concepts.slice(0, 3).forEach(concept => {
                    console.log(chalk.gray(`      • ${concept}`));
                });
                if (result.concepts.length > 3) {
                    console.log(chalk.gray(`      ... and ${result.concepts.length - 3} more`));
                }
            }
            
            // Display sample entities
            if (result.ragnoEntities.length > 0) {
                console.log(chalk.gray('   🎯 Sample entities:'));
                result.ragnoEntities.slice(0, 3).forEach(entity => {
                    const label = entity.label || entity.uri?.split('/').pop() || 'Unknown';
                    console.log(chalk.gray(`      • ${label}`));
                });
                if (result.ragnoEntities.length > 3) {
                    console.log(chalk.gray(`      ... and ${result.ragnoEntities.length - 3} more`));
                }
            }
            
            return result;
        } else {
            console.log(chalk.red('   ❌ Research failed:'), result.error);
            return null;
        }
        
    } catch (error) {
        console.log(chalk.red('   ❌ Error during research:'), error.message);
        return null;
    }
}

/**
 * Display research summary
 */
function displayResearchSummary(results, researcher) {
    console.log(chalk.bold.yellow('\n📊 Research Session Summary:'));
    
    const successful = results.filter(r => r !== null);
    const failed = results.filter(r => r === null);
    
    console.log(chalk.white(`   Questions researched: ${results.length}`));
    console.log(chalk.green(`   Successful: ${successful.length}`));
    console.log(chalk.red(`   Failed: ${failed.length}`));
    
    if (successful.length > 0) {
        const totalConcepts = successful.reduce((sum, r) => sum + r.concepts.length, 0);
        const totalEntities = successful.reduce((sum, r) => sum + r.ragnoEntities.length, 0);
        const avgDuration = successful.reduce((sum, r) => sum + (r.metadata?.researchDuration || 0), 0) / successful.length;
        
        console.log(chalk.white(`   Total concepts extracted: ${totalConcepts}`));
        console.log(chalk.white(`   Total entities discovered: ${totalEntities}`));
        console.log(chalk.white(`   Average research time: ${(avgDuration / 1000).toFixed(1)}s`));
    }
    
    // Get component statistics
    const stats = researcher.getStatistics();
    if (stats.success) {
        console.log(chalk.white(`\n   📈 Component Statistics:`));
        console.log(chalk.white(`   Total researches: ${stats.statistics.totalResearches}`));
        console.log(chalk.white(`   Average entities per research: ${stats.statistics.averageEntitiesPerResearch}`));
        console.log(chalk.white(`   Conversion rate: ${(stats.statistics.conversionRate * 100).toFixed(1)}%`));
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
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        // Create Wikidata researcher
        const researcher = new WikidataResearcher();
        
        const resources = {
            llmHandler,
            sparqlHelper,
            config: workflowConfig
        };
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Determine questions to research
        const questions = args.question ? [args.question] : getDemoQuestions();
        
        console.log(chalk.bold.white(`\n🎯 Conducting Wikidata Research (${questions.length} questions):`));
        
        // Conduct research for each question
        const results = [];
        
        for (const question of questions) {
            const result = await conductResearch(question, researcher, resources, {
                maxEntities: 8
            });
            results.push(result);
        }
        
        // Display comprehensive summary
        displayResearchSummary(results, researcher);
        
        console.log(chalk.bold.green('🎉 Wikidata research flow example completed!'));
        console.log('');
        console.log(chalk.gray('This example demonstrates:'));
        console.log(chalk.gray('• Simplified WikidataResearcher component'));
        console.log(chalk.gray('• Standardized API: executeResearch(input, resources, options)'));
        console.log(chalk.gray('• Automatic concept extraction from questions'));
        console.log(chalk.gray('• Wikidata entity search and conversion to Ragno format'));
        console.log(chalk.gray('• Knowledge graph storage with metadata'));
        console.log(chalk.gray('• Built-in statistics and performance tracking'));
        console.log('');
        console.log(chalk.cyan('Try with a custom question: --question "your research question"'));
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