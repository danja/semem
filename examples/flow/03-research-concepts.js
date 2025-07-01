#!/usr/bin/env node

/**
 * Flow Stage 3: Concept Research
 * 
 * Research extracted concepts via Wikipedia using Flow components.
 * Maps to: QuestionResearch.js in the original workflow
 * 
 * Usage: node examples/flow/03-research-concepts.js [--limit N]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import NomicConnector from '../../src/connectors/NomicConnector.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

// Import Wikipedia research components
import WikipediaSearch from '../../src/aux/wikipedia/Search.js';
import UnitsToCorpuscles from '../../src/aux/wikipedia/UnitsToCorpuscles.js';

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
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('            🔍 FLOW STAGE 3: RESEARCH CONCEPTS               ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('         Research concepts via Wikipedia integration         ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: null };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 03-research-concepts.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of questions to process (default: all)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize embedding handler
 */
async function initializeEmbeddingHandler(config) {
    console.log(chalk.cyan('🔧 Initializing embedding handler...'));

    const llmProviders = config.get('llmProviders') || [];
    const embeddingProvider = llmProviders
        .filter(p => p.capabilities?.includes('embedding'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    const embeddingConnector = new NomicConnector(
        'http://localhost:11434',
        embeddingProvider?.embeddingModel || 'nomic-embed-text'
    );
    const embeddingHandler = new EmbeddingHandler(embeddingConnector);
    
    console.log(chalk.green(`   ✅ Embedding handler: ${embeddingProvider?.embeddingModel || 'nomic-embed-text'}`));
    return embeddingHandler;
}

/**
 * Retrieve questions with concepts
 */
async function retrieveQuestionsWithConcepts(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving questions with concepts...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?concept
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:hasAttribute ?conceptAttr .
        
        ?conceptAttr ragno:attributeType "concept" ;
                    ragno:attributeValue ?concept .
        
        # Only get questions that haven't been researched yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "03-research-concepts" .
        }
    }
}
${limit ? `LIMIT ${limit * 5}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        // Group concepts by question
        const questionMap = new Map();
        
        result.data.results.bindings.forEach(binding => {
            const questionURI = binding.question.value;
            const concept = binding.concept.value;
            const label = binding.label.value;
            
            if (!questionMap.has(questionURI)) {
                questionMap.set(questionURI, {
                    uri: questionURI,
                    label: label,
                    concepts: []
                });
            }
            
            questionMap.get(questionURI).concepts.push(concept);
        });
        
        const questions = Array.from(questionMap.values());
        const limitedQuestions = limit ? questions.slice(0, limit) : questions;
        
        console.log(chalk.green(`   ✓ Found ${limitedQuestions.length} questions with concepts to research`));
        return limitedQuestions;
    } else {
        console.log(chalk.yellow('   ⚠️  No questions with concepts found for research'));
        return [];
    }
}

/**
 * Research concepts via Wikipedia
 */
async function researchConcepts(questions, embeddingHandler, sparqlHelper, config) {
    console.log(chalk.cyan('🔍 Researching concepts via Wikipedia...'));
    
    const wikipediaSearch = new WikipediaSearch();
    const unitsToCorpuscles = new UnitsToCorpuscles();
    
    const researchStats = {
        questionsProcessed: 0,
        conceptsResearched: 0,
        corpusclesCreated: 0,
        errors: 0
    };
    
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.label.substring(0, 50)}..."`));
        console.log(chalk.gray(`      Concepts: ${question.concepts.join(', ')}`));
        
        try {
            const allCorpuscles = [];
            
            // Research each concept
            for (const concept of question.concepts) {
                try {
                    console.log(chalk.gray(`      Researching: "${concept}"`));
                    
                    // Search Wikipedia
                    const searchResults = await wikipediaSearch.searchWikipedia(concept, { maxResults: 3 });
                    
                    if (searchResults.length > 0) {
                        // Convert to corpuscles
                        const corpuscles = await unitsToCorpuscles.convertUnitsToCorpuscles(
                            searchResults,
                            {
                                addEmbeddings: true,
                                embeddingHandler: embeddingHandler,
                                sourceQuestion: question.uri,
                                sourceConcept: concept
                            }
                        );
                        
                        if (corpuscles.length > 0) {
                            allCorpuscles.push(...corpuscles);
                            console.log(chalk.green(`         ✓ Found ${corpuscles.length} Wikipedia articles`));
                        }
                    }
                    
                    researchStats.conceptsResearched++;
                    
                    // Rate limiting for Wikipedia API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (conceptError) {
                    console.log(chalk.red(`         ❌ Research failed: ${conceptError.message}`));
                    researchStats.errors++;
                }
            }
            
            // Store corpuscles if found
            if (allCorpuscles.length > 0) {
                await storeWikipediaCorpuscles(allCorpuscles, question, sparqlHelper, config);
                researchStats.corpusclesCreated += allCorpuscles.length;
                console.log(chalk.green(`      ✅ Stored ${allCorpuscles.length} Wikipedia corpuscles`));
            }
            
            // Mark question as researched
            await markQuestionResearched(question, sparqlHelper, config);
            
            researchStats.questionsProcessed++;
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Question research failed: ${error.message}`));
            researchStats.errors++;
        }
    }
    
    return researchStats;
}

/**
 * Store Wikipedia corpuscles in graph
 */
async function storeWikipediaCorpuscles(corpuscles, sourceQuestion, sparqlHelper, config) {
    const triples = [];
    const timestamp = new Date().toISOString();
    
    corpuscles.forEach((corpuscle, index) => {
        const corpuscleURI = `${config.wikipediaGraphURI}/corpuscle/${Date.now()}_${index}`;
        
        // Basic corpuscle structure
        triples.push(`<${corpuscleURI}> a ragno:Corpuscle ;`);
        triples.push(`    rdfs:label "${escapeRDFString(corpuscle.title)}" ;`);
        triples.push(`    ragno:content "${escapeRDFString(corpuscle.content)}" ;`);
        triples.push(`    ragno:corpuscleType "wikipedia-article" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime ;`);
        triples.push(`    ragno:processingStage "researched" ;`);
        triples.push(`    ragno:sourceQuestion <${sourceQuestion.uri}> .`);
        
        // Wikipedia metadata
        if (corpuscle.url) {
            triples.push(`<${corpuscleURI}> ragno:wikipediaURL "${corpuscle.url}" .`);
        }
        if (corpuscle.snippet) {
            triples.push(`<${corpuscleURI}> ragno:snippet "${escapeRDFString(corpuscle.snippet)}" .`);
        }
        
        // Embedding if available
        if (corpuscle.embedding) {
            const embeddingAttrURI = `${corpuscleURI}/attr/embedding`;
            triples.push(`<${corpuscleURI}> ragno:hasAttribute <${embeddingAttrURI}> .`);
            triples.push(`<${embeddingAttrURI}> a ragno:Attribute ;`);
            triples.push(`    ragno:attributeType "embedding" ;`);
            triples.push(`    ragno:attributeValue "${corpuscle.embedding.join(',')}" ;`);
            triples.push(`    ragno:embeddingModel "nomic-embed-text" ;`);
            triples.push(`    ragno:embeddingDimensions ${corpuscle.embedding.length} ;`);
            triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
        }
        
        // Flow stage tracking
        const flowAttrURI = `${corpuscleURI}/attr/flow_stage`;
        triples.push(`<${corpuscleURI}> ragno:hasAttribute <${flowAttrURI}> .`);
        triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "flow-stage" ;`);
        triples.push(`    ragno:attributeValue "03-research-concepts" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    });
    
    if (triples.length > 0) {
        const insertQuery = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.wikipediaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

        const result = await sparqlHelper.executeUpdate(insertQuery);
        
        if (!result.success) {
            throw new Error(`SPARQL storage failed: ${result.error}`);
        }
    }
}

/**
 * Mark question as researched
 */
async function markQuestionResearched(question, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const flowAttrURI = `${question.uri}/attr/flow_stage_03`;
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${question.uri}> ragno:hasAttribute <${flowAttrURI}> .
        <${flowAttrURI}> a ragno:Attribute ;
            ragno:attributeType "flow-stage" ;
            ragno:attributeValue "03-research-concepts" ;
            dcterms:created "${timestamp}"^^xsd:dateTime .
        
        <${question.uri}> ragno:processingStage "researched" .
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to mark question as researched: ${result.error}`);
    }
}

/**
 * Escape special characters in RDF strings
 */
function escapeRDFString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Display completion summary
 */
function displaySummary(researchStats, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 3 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${researchStats.questionsProcessed}`));
    console.log(chalk.white(`   Concepts researched: ${researchStats.conceptsResearched}`));
    console.log(chalk.white(`   Wikipedia corpuscles created: ${researchStats.corpusclesCreated}`));
    console.log(chalk.white(`   Research errors: ${researchStats.errors}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (researchStats.questionsProcessed > 0) {
        console.log(chalk.white(`   Average corpuscles per question: ${(researchStats.corpusclesCreated / researchStats.questionsProcessed).toFixed(1)}`));
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 4 - Build formal relationships'));
    console.log(chalk.gray('Command: node examples/flow/04-build-relationships.js'));
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
        
        // Initialize embedding handler
        const embeddingHandler = await initializeEmbeddingHandler(config);
        
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve questions with concepts
        const questions = await retrieveQuestionsWithConcepts(sparqlHelper, workflowConfig, args.limit);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with concepts found. Run Stages 1-2 first.'));
            return;
        }
        
        // Research concepts
        const researchStats = await researchConcepts(questions, embeddingHandler, sparqlHelper, workflowConfig);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(researchStats, duration);
        
        console.log(chalk.bold.green('🎉 Stage 3: Concept research completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 3 failed:'), error.message);
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