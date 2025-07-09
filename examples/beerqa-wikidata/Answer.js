#!/usr/bin/env node

/**
 * Answer.js - Complete workflow for enhanced question answering
 * 
 * This script combines the complete beerqa-wikidata workflow into a single command:
 * 1. WikidataResearch - Extracts concepts and finds Wikidata entities
 * 2. Store question and create navigation relationships
 * 3. WikidataGetResult - Generates context-augmented answers
 * 
 * This is similar to the Flow-based approach in examples/flow/09-enhanced-answers.js
 * but uses the original beerqa-wikidata workflow components directly for a complete
 * end-to-end question answering experience.
 * 
 * Usage: node examples/beerqa-wikidata/Answer.js "What was Einstein's day job?"
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Config from '../../src/Config.js';
import WikidataResearch from './WikidataResearch.js';
import { 
    getQuestionsWithEnhancedRelationships,
    getEnhancedEntityContext,
    buildEnhancedContext,
    generateEnhancedAnswer,
    initializeLLMHandler
} from './WikidataGetResult.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('            🎯 ENHANCED QUESTION ANSWERING               ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     Complete workflow: Research → Navigate → Answer        ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Store question in BeerQA graph for processing
 */
async function storeQuestionInGraph(question, sparqlHelper, config) {
    const questionURI = `${config.beerqaGraphURI}/question/${Date.now()}`;
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${questionURI}> a ragno:Corpuscle ;
                        rdfs:label "${question}" ;
                        ragno:content "${question}" .
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to store question: ${result.error}`);
    }
    
    return {
        uri: questionURI,
        text: question
    };
}

/**
 * Create navigation relationships based on Wikidata research results
 */
async function createNavigationRelationships(questionObj, researchResults, sparqlHelper, config) {
    console.log(chalk.bold.white('🧭 Creating navigation relationships...'));
    
    const relationships = [];
    
    // Create relationships with Wikidata entities from research
    if (researchResults.ragnoEntities && researchResults.ragnoEntities.length > 0) {
        for (const ragnoEntity of researchResults.ragnoEntities) {
            const relationshipURI = `${config.navigationGraphURI}/relationship/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const weight = ragnoEntity.originalEntity?.confidence || 0.8;
            
            const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${config.navigationGraphURI}> {
        <${relationshipURI}> a ragno:Relationship ;
                            ragno:hasSourceEntity <${questionObj.uri}> ;
                            ragno:hasTargetEntity <${ragnoEntity.entityURI}> ;
                            ragno:relationshipType "wikidata-research" ;
                            ragno:weight ${weight} ;
                            ragno:sourceCorpus "Wikidata" ;
                            ragno:similarity ${weight} .
    }
}`;

            const relationshipResult = await sparqlHelper.executeUpdate(relationshipQuery);
            
            if (relationshipResult.success) {
                relationships.push({
                    uri: relationshipURI,
                    targetEntity: ragnoEntity.entityURI,
                    relationshipType: 'wikidata-research',
                    weight: weight,
                    sourceCorpus: 'Wikidata',
                    similarity: weight
                });
            }
        }
    }
    
    // Also create relationships with existing Wikipedia entities based on text similarity
    const similarEntitiesQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
    }
}
LIMIT 20`;

    const entitiesResult = await sparqlHelper.executeSelect(similarEntitiesQuery);
    
    if (entitiesResult.success) {
        for (const binding of entitiesResult.data.results.bindings) {
            const entityURI = binding.entity.value;
            const entityLabel = binding.label.value;
            
            // Simple text similarity
            const similarity = calculateTextSimilarity(questionObj.text, entityLabel);
            
            if (similarity > config.similarityThreshold) {
                const relationshipURI = `${config.navigationGraphURI}/relationship/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${config.navigationGraphURI}> {
        <${relationshipURI}> a ragno:Relationship ;
                            ragno:hasSourceEntity <${questionObj.uri}> ;
                            ragno:hasTargetEntity <${entityURI}> ;
                            ragno:relationshipType "wikipedia-similarity" ;
                            ragno:weight ${similarity} ;
                            ragno:sourceCorpus "Wikipedia" ;
                            ragno:similarity ${similarity} .
    }
}`;

                const relationshipResult = await sparqlHelper.executeUpdate(relationshipQuery);
                
                if (relationshipResult.success) {
                    relationships.push({
                        uri: relationshipURI,
                        targetEntity: entityURI,
                        relationshipType: 'wikipedia-similarity',
                        weight: similarity,
                        sourceCorpus: 'Wikipedia',
                        similarity: similarity
                    });
                }
            }
        }
    }
    
    console.log(chalk.green(`   ✓ Created ${relationships.length} navigation relationships`));
    return relationships;
}

/**
 * Calculate simple text similarity
 */
function calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
}

/**
 * Complete answer workflow
 */
async function answerQuestion(question) {
    displayHeader();
    
    try {
        console.log(chalk.bold.white(`🎯 Processing question: "${question}"`));
        console.log('');
        
        // Load configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        const configObj = new Config(configPath);
        await configObj.init();
        const storageOptions = configObj.get('storage.options');
        
        const config = {
            sparqlEndpoint: storageOptions.update,
            sparqlAuth: { 
                user: storageOptions.user || 'admin', 
                password: storageOptions.password || 'admin123' 
            },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research',
            navigationGraphURI: 'http://purl.org/stuff/navigation/enhanced',
            similarityThreshold: 0.1,
            maxContextTokens: 3000,
            timeout: 30000
        };
        
        // Initialize services
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        const llmHandler = await initializeLLMHandler(configObj);
        
        // Step 1: Research phase - find Wikidata entities
        console.log(chalk.bold.blue('🔍 Step 1: Researching Wikidata entities...'));
        const research = new WikidataResearch({
            storageGraph: config.wikidataGraphURI,
            maxWikidataSearchResults: 10
        });
        
        await research.initialize();
        const researchResults = await research.executeResearch(question);
        
        if (!researchResults.success) {
            throw new Error(`Research failed: ${researchResults.error}`);
        }
        
        console.log(chalk.green(`   ✓ Found ${researchResults.wikidataEntities?.length || 0} Wikidata entities`));
        console.log('');
        
        // Step 2: Store question in graph
        console.log(chalk.bold.blue('🏗️  Step 2: Storing question for navigation...'));
        const questionObj = await storeQuestionInGraph(question, sparqlHelper, config);
        console.log(chalk.green(`   ✓ Question stored with URI: ${questionObj.uri}`));
        console.log('');
        
        // Step 3: Create navigation relationships
        console.log(chalk.bold.blue('🧭 Step 3: Creating navigation relationships...'));
        const relationships = await createNavigationRelationships(questionObj, researchResults, sparqlHelper, config);
        console.log('');
        
        // Step 4: Generate enhanced answer
        console.log(chalk.bold.blue('🎯 Step 4: Generating enhanced answer...'));
        
        // Create a question object with relationships for the answer generation
        const questionWithRelationships = {
            uri: questionObj.uri,
            text: questionObj.text,
            relationships: relationships
        };
        
        // Get unique entity URIs from relationships
        const entityURIs = [...new Set(relationships.map(rel => rel.targetEntity))];
        
        // Retrieve enhanced context from multiple sources
        const contextSources = await getEnhancedEntityContext(entityURIs, questionWithRelationships, sparqlHelper, config);
        
        // Build comprehensive context
        const context = buildEnhancedContext(questionWithRelationships, relationships, contextSources, config);
        
        // Generate enhanced answer
        const answerResult = await generateEnhancedAnswer(questionWithRelationships, context, llmHandler, config);
        
        if (!answerResult.success) {
            throw new Error(`Answer generation failed: ${answerResult.error}`);
        }
        
        console.log(chalk.green(`   ✓ Answer generated successfully`));
        console.log('');
        
        // Display the final answer
        console.log(chalk.bold.yellow('🎉 ENHANCED ANSWER:'));
        console.log(chalk.bold.blue('════════════════════════════════════════════════════════════════'));
        console.log(chalk.white(answerResult.answer));
        console.log(chalk.bold.blue('════════════════════════════════════════════════════════════════'));
        console.log('');
        
        // Display statistics
        console.log(chalk.bold.cyan('📊 Workflow Statistics:'));
        console.log(chalk.white(`   Research: ${researchResults.wikidataEntities?.length || 0} Wikidata entities found`));
        console.log(chalk.white(`   Navigation: ${relationships.length} relationships created`));
        console.log(chalk.white(`   Context: ${contextSources.wikidata.length} Wikidata + ${contextSources.wikipedia.length} Wikipedia + ${contextSources.beerqa.length} BeerQA entities`));
        console.log(chalk.white(`   Answer: ${answerResult.contextLength} characters of context used`));
        console.log('');
        
        console.log(chalk.bold.green('✅ Question answered successfully!'));
        
        // Cleanup
        await research.cleanup();
        
    } catch (error) {
        console.log(chalk.bold.red('❌ Answer workflow failed:'));
        console.log(chalk.red(`   Error: ${error.message}`));
        
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
        
        process.exit(1);
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const question = process.argv[2];
    
    if (!question) {
        console.log(chalk.red('❌ Usage: node examples/beerqa-wikidata/Answer.js "Your question here"'));
        console.log(chalk.gray('   Example: node examples/beerqa-wikidata/Answer.js "What was Einstein\'s day job?"'));
        process.exit(1);
    }
    
    answerQuestion(question);
}

export default answerQuestion;