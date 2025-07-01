#!/usr/bin/env node

/**
 * Flow Stage 8: Wikidata Research
 * 
 * Enhance corpus with global Wikidata entities using Flow components.
 * Maps to: WikidataNavigate.js in the original workflow
 * 
 * Usage: node examples/flow/08-wikidata-research.js [--limit N]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import WikidataResearcher from '../../src/aux/wikidata/WikidataResearcher.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white('            🌐 FLOW STAGE 8: WIKIDATA RESEARCH               ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('║') + chalk.gray('        Enhance corpus with global Wikidata entities         ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        maxEntities: 15
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--max-entities':
                options.maxEntities = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 08-wikidata-research.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N           Limit number of questions to process (default: all)');
                console.log('  --max-entities N    Maximum Wikidata entities per question (default: 15)');
                console.log('  --help, -h          Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize LLM handler
 */
async function initializeLLMHandler(config) {
    console.log(chalk.cyan('🔧 Initializing LLM handler...'));

    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!chatProvider) {
        throw new Error('No chat LLM provider configured');
    }

    console.log(chalk.white(`   🎯 Selected provider: ${chatProvider.type} (priority ${chatProvider.priority})`));

    let llmConnector;
    
    if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
        console.log(chalk.green('   ✓ Using Mistral API'));
        llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
    } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
        console.log(chalk.green('   ✓ Using Claude API'));
        llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
    } else {
        console.log(chalk.yellow('   ⚠️  API key not found, falling back to Ollama'));
        llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        chatProvider.chatModel = 'qwen2:1.5b';
    }

    const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
    console.log(chalk.green(`   ✅ LLM handler initialized with ${chatProvider.type} provider`));
    return llmHandler;
}

/**
 * Retrieve researched questions
 */
async function retrieveResearchedQuestions(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving researched questions...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content ;
                 ragno:processingStage "researched" .
        
        # Only get questions that haven't been Wikidata researched yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "08-wikidata-research" .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const questions = result.data.results.bindings.map(binding => ({
            uri: binding.question.value,
            label: binding.label.value,
            content: binding.content.value
        }));
        
        console.log(chalk.green(`   ✓ Found ${questions.length} questions ready for Wikidata research`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No researched questions found for Wikidata research'));
        return [];
    }
}

/**
 * Conduct Wikidata research for questions
 */
async function conductWikidataResearch(questions, llmHandler, sparqlHelper, config, maxEntities = 15) {
    console.log(chalk.cyan('🌐 Conducting Wikidata research...'));
    console.log(chalk.gray(`   → Maximum entities per question: ${maxEntities}`));
    
    const wikidataResearcher = new WikidataResearcher();
    
    const researchStats = {
        questionsProcessed: 0,
        totalEntitiesFound: 0,
        totalEntitiesConverted: 0,
        researchSessions: 0,
        errors: 0
    };
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        
        try {
            // Execute Wikidata research using Flow component
            const researchResult = await wikidataResearcher.executeResearch(
                { question: question.content },
                resources,
                {
                    maxWikidataSearchResults: maxEntities,  // Configurable entities per question
                    storeResults: true,
                    storageGraph: config.wikidataGraphURI,
                    sourceQuestion: question.uri
                }
            );
            
            if (researchResult.success) {
                researchStats.totalEntitiesFound += researchResult.wikidataEntities.length;
                researchStats.totalEntitiesConverted += researchResult.ragnoEntities.length;
                researchStats.researchSessions++;
                
                console.log(chalk.green(`      ✓ Found ${researchResult.ragnoEntities.length} Wikidata entities`));
                console.log(chalk.gray(`      📝 Concepts: ${(researchResult.concepts || []).join(', ')}`));
                
                // Mark question as Wikidata researched
                await markQuestionWikidataResearched(question, researchResult, sparqlHelper, config);
                
            } else {
                console.log(chalk.red(`      ❌ Research failed: ${researchResult.error}`));
                researchStats.errors++;
            }
            
            researchStats.questionsProcessed++;
            
            // Brief pause to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Research error: ${error.message}`));
            researchStats.errors++;
        }
    }
    
    return researchStats;
}

/**
 * Mark question as Wikidata researched with metadata
 */
async function markQuestionWikidataResearched(question, researchResult, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const flowAttrURI = `${question.uri}/attr/flow_stage_08`;
    const wikidataMetaURI = `${question.uri}/attr/wikidata_meta`;
    
    const triples = [];
    
    // Flow stage tracking
    triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
    triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "08-wikidata-research" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Wikidata research metadata
    triples.push(`<${question.uri}> ragno:hasAttribute <${wikidataMetaURI}> .`);
    triples.push(`<${wikidataMetaURI}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "wikidata-research-metadata" ;`);
    triples.push(`    ragno:entitiesFound ${researchResult.ragnoEntities.length} ;`);
    triples.push(`    ragno:conceptsUsed "${(researchResult.concepts || []).join(', ')}" ;`);
    triples.push(`    ragno:researchDuration ${researchResult.metadata.researchDuration} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Update processing stage
    triples.push(`<${question.uri}> ragno:processingStage "wikidata-researched" .`);
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to mark question as Wikidata researched: ${result.error}`);
    }
}

/**
 * Display completion summary
 */
function displaySummary(researchStats, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 8 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${researchStats.questionsProcessed}`));
    console.log(chalk.white(`   Research sessions completed: ${researchStats.researchSessions}`));
    console.log(chalk.white(`   Total Wikidata entities found: ${researchStats.totalEntitiesFound}`));
    console.log(chalk.white(`   Total entities converted: ${researchStats.totalEntitiesConverted}`));
    console.log(chalk.white(`   Research errors: ${researchStats.errors}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (researchStats.questionsProcessed > 0) {
        console.log(chalk.white(`   Average entities per question: ${(researchStats.totalEntitiesConverted / researchStats.questionsProcessed).toFixed(1)}`));
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 9 - Generate enhanced answers'));
    console.log(chalk.gray('Command: node examples/flow/09-enhanced-answers.js'));
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();
        
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
        
        // Initialize LLM handler
        const llmHandler = await initializeLLMHandler(config);
        
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve researched questions
        const questions = await retrieveResearchedQuestions(sparqlHelper, workflowConfig, args.limit);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No researched questions found. Run Stages 1-3 first.'));
            return;
        }
        
        // Conduct Wikidata research
        const researchStats = await conductWikidataResearch(questions, llmHandler, sparqlHelper, workflowConfig, args.maxEntities);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(researchStats, duration);
        
        console.log(chalk.bold.green('🎉 Stage 8: Wikidata research completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 8 failed:'), error.message);
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