#!/usr/bin/env node

/**
 * GetResult.js - Final LLM-based question answering for BeerQA
 * 
 * This script uses ContextManager.js to combine question corpuscles with
 * related corpuscles (found through ZPT navigation), formulates them as
 * augmented questions for the LLM, and returns the final answers to users.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import ContextManager from '../../src/ContextManager.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import SPARQLHelper from './SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🎯 BEER QA FINAL RESULTS                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Context-augmented question answering with LLM completion  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('BeerQA Graph URI:')} ${chalk.white(config.beerqaGraphURI)}`);
    console.log(`   ${chalk.cyan('Wikipedia Graph URI:')} ${chalk.white(config.wikipediaGraphURI)}`);
    console.log(`   ${chalk.cyan('Max Context Tokens:')} ${chalk.white(config.maxContextTokens)}`);
    console.log(`   ${chalk.cyan('Context Window Size:')} ${chalk.white(config.maxContextSize)}`);
    console.log(`   ${chalk.cyan('LLM Model:')} ${chalk.white(config.llmModel)}`);
    console.log('');
}

/**
 * Get questions with their relationships (from ZPT navigation)
 */
async function getQuestionsWithRelationships(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Finding questions with relationships...'));
    
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?relationship ?targetEntity ?relationshipType ?weight ?sourceCorpus
WHERE {
    GRAPH <${beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
        
        OPTIONAL { ?relationship ragno:sourceCorpus ?sourceCorpus }
        
        # Exclude self-references for cleaner context
        FILTER(?question != ?targetEntity)
    }
}
ORDER BY ?question DESC(?weight)
`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        throw new Error(`Failed to retrieve questions with relationships: ${result.error}`);
    }
    
    // Group results by question
    const questionsMap = new Map();
    
    for (const binding of result.data.results.bindings) {
        const questionURI = binding.question.value;
        
        if (!questionsMap.has(questionURI)) {
            questionsMap.set(questionURI, {
                uri: questionURI,
                questionText: binding.questionText.value,
                relationships: []
            });
        }
        
        questionsMap.get(questionURI).relationships.push({
            uri: binding.relationship.value,
            targetEntity: binding.targetEntity.value,
            relationshipType: binding.relationshipType.value,
            weight: parseFloat(binding.weight.value),
            sourceCorpus: binding.sourceCorpus?.value || 'unknown'
        });
    }
    
    const questions = Array.from(questionsMap.values());
    
    console.log(`   ${chalk.green('✓')} Found ${questions.length} questions with relationships`);
    
    const totalRelationships = questions.reduce((sum, q) => sum + q.relationships.length, 0);
    console.log(`   ${chalk.green('✓')} Total relationships: ${totalRelationships}`);
    console.log('');
    
    return questions;
}

/**
 * Get content for related entities (corpuscles and text elements)
 */
async function getRelatedEntityContent(sparqlHelper, beerqaGraphURI, wikipediaGraphURI, entityURIs) {
    if (entityURIs.length === 0) return new Map();
    
    console.log(chalk.gray(`     Fetching content for ${entityURIs.length} related entities...`));
    
    const entityContent = new Map();
    
    // Query BeerQA content
    const beerqaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?content
WHERE {
    GRAPH <${beerqaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?content .
        
        FILTER(?entity IN (${entityURIs.map(uri => `<${uri}>`).join(', ')}))
    }
}`;

    const beerqaResult = await sparqlHelper.executeSelect(beerqaQuery);
    
    if (beerqaResult.success) {
        for (const binding of beerqaResult.data.results.bindings) {
            entityContent.set(binding.entity.value, {
                content: binding.content.value,
                source: 'BeerQA',
                type: 'question'
            });
        }
    }
    
    // Query Wikipedia content
    const wikipediaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?entity ?title ?content ?contentType
WHERE {
    GRAPH <${wikipediaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title .
        
        OPTIONAL {
            ?textElement ragno:content ?content ;
                        ragno:contentType ?contentType .
        }
        
        FILTER(?entity IN (${entityURIs.map(uri => `<${uri}>`).join(', ')}))
    }
}`;

    const wikipediaResult = await sparqlHelper.executeSelect(wikipediaQuery);
    
    if (wikipediaResult.success) {
        for (const binding of wikipediaResult.data.results.bindings) {
            const existing = entityContent.get(binding.entity.value);
            
            if (!existing) {
                // Use markdown content if available, otherwise title
                const content = binding.content?.value || binding.title.value;
                const contentType = binding.contentType?.value || 'title';
                
                entityContent.set(binding.entity.value, {
                    content: content,
                    source: 'Wikipedia',
                    type: contentType,
                    title: binding.title.value
                });
            }
        }
    }
    
    console.log(chalk.gray(`     ✓ Retrieved content for ${entityContent.size} entities`));
    
    return entityContent;
}

/**
 * Build augmented context using ContextManager
 */
function buildAugmentedContext(contextManager, question, relationships, entityContent, options = {}) {
    console.log(chalk.gray(`     Building augmented context...`));
    
    // Prepare interactions from related entities
    const retrievals = [];
    
    for (const rel of relationships) {
        const content = entityContent.get(rel.targetEntity);
        
        if (content) {
            // Format content based on type
            let formattedContent = content.content;
            
            if (content.type === 'text/markdown') {
                // Truncate long markdown content
                if (formattedContent.length > 2000) {
                    formattedContent = formattedContent.substring(0, 2000) + '...\n\n[Content truncated for context window]';
                }
            } else if (content.type === 'title') {
                formattedContent = `${content.title}: ${content.content}`;
            }
            
            // Create interaction format for ContextManager
            const interaction = {
                prompt: `Related information about ${content.title || 'topic'}`,
                output: formattedContent,
                concepts: [rel.relationshipType],
                source: content.source,
                relationshipType: rel.relationshipType
            };
            
            retrievals.push({
                interaction: interaction,
                similarity: rel.weight // Use relationship weight as similarity
            });
        }
    }
    
    // Sort by weight/similarity for better context ordering
    retrievals.sort((a, b) => b.similarity - a.similarity);
    
    // Build context using ContextManager
    const context = contextManager.buildContext(
        question.questionText,
        retrievals,
        [], // No recent interactions for this use case
        {
            systemContext: options.systemContext || 'Answer the question using the provided context information.'
        }
    );
    
    console.log(chalk.gray(`     ✓ Built context with ${retrievals.length} related pieces`));
    
    return {
        context: context,
        sourceCount: retrievals.length,
        sources: retrievals.map(r => r.interaction.source)
    };
}

/**
 * Generate final answer using LLM
 */
async function generateAnswer(llmHandler, question, contextInfo, options = {}) {
    console.log(chalk.gray(`     Generating LLM response...`));
    
    const systemPrompt = `You are an expert assistant answering questions using provided context information.

Instructions:
- Answer the question directly and concisely
- Use the context information to provide accurate details
- If the context doesn't contain enough information, say so clearly
- Cite information from the context when relevant
- Keep the answer focused on the question asked

Context sources available: ${contextInfo.sources.join(', ')}`;

    try {
        const response = await llmHandler.generateResponse(
            question.questionText,
            contextInfo.context,
            {
                systemPrompt: systemPrompt,
                temperature: options.temperature || 0.7,
                maxRetries: 3
            }
        );
        
        console.log(chalk.gray(`     ✓ Generated response (${response.length} chars)`));
        
        return {
            answer: response,
            contextSources: contextInfo.sources,
            contextSourceCount: contextInfo.sourceCount,
            success: true
        };
        
    } catch (error) {
        console.log(chalk.red(`     ❌ Failed to generate response: ${error.message}`));
        
        return {
            answer: 'I apologize, but I was unable to generate a response due to a technical issue. Please try again.',
            contextSources: contextInfo.sources,
            contextSourceCount: contextInfo.sourceCount,
            success: false,
            error: error.message
        };
    }
}

/**
 * Process a single question through the complete pipeline
 */
async function processQuestion(sparqlHelper, beerqaGraphURI, wikipediaGraphURI, question, contextManager, llmHandler, config) {
    console.log(chalk.bold.white(`❓ Question: ${question.questionText}`));
    console.log(`   ${chalk.cyan('Question URI:')} ${chalk.dim(question.uri)}`);
    console.log(`   ${chalk.cyan('Related Entities:')} ${chalk.white(question.relationships.length)}`);
    
    // Display relationship summary
    const relationshipSummary = question.relationships.reduce((acc, rel) => {
        acc[rel.sourceCorpus] = (acc[rel.sourceCorpus] || 0) + 1;
        return acc;
    }, {});
    
    for (const [source, count] of Object.entries(relationshipSummary)) {
        console.log(`     ${chalk.gray(source)}: ${chalk.white(count)} relationships`);
    }
    
    // Get content for related entities
    const entityURIs = question.relationships.map(rel => rel.targetEntity);
    const entityContent = await getRelatedEntityContent(
        sparqlHelper,
        beerqaGraphURI,
        wikipediaGraphURI,
        entityURIs
    );
    
    // Build augmented context
    const contextInfo = buildAugmentedContext(
        contextManager,
        question,
        question.relationships,
        entityContent,
        {
            systemContext: 'Use the related information to provide a comprehensive answer to the question.'
        }
    );
    
    // Generate final answer
    const result = await generateAnswer(llmHandler, question, contextInfo, {
        temperature: config.temperature
    });
    
    // Display results
    console.log('');
    console.log(chalk.bold.green('📋 ANSWER:'));
    console.log(chalk.white(result.answer));
    console.log('');
    
    console.log(chalk.bold.cyan('📊 Answer Metadata:'));
    console.log(`   ${chalk.cyan('Context Sources:')} ${chalk.white(result.contextSources.join(', '))}`);
    console.log(`   ${chalk.cyan('Source Count:')} ${chalk.white(result.contextSourceCount)}`);
    console.log(`   ${chalk.cyan('Success:')} ${result.success ? chalk.green('Yes') : chalk.red('No')}`);
    
    if (!result.success) {
        console.log(`   ${chalk.cyan('Error:')} ${chalk.red(result.error)}`);
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('');
    
    return {
        questionURI: question.uri,
        questionText: question.questionText,
        answer: result.answer,
        contextSourceCount: result.contextSourceCount,
        contextSources: result.contextSources,
        relationshipCount: question.relationships.length,
        success: result.success,
        error: result.error || null
    };
}

/**
 * Display final summary
 */
function displaySummary(allResults) {
    const totals = allResults.reduce((acc, result) => ({
        questions: acc.questions + 1,
        successfulAnswers: acc.successfulAnswers + (result.success ? 1 : 0),
        totalRelationships: acc.totalRelationships + result.relationshipCount,
        totalContextSources: acc.totalContextSources + result.contextSourceCount,
        totalAnswerLength: acc.totalAnswerLength + result.answer.length
    }), {
        questions: 0,
        successfulAnswers: 0,
        totalRelationships: 0,
        totalContextSources: 0,
        totalAnswerLength: 0
    });
    
    console.log(chalk.bold.white('📊 Final Results Summary:'));
    console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(totals.questions)}`);
    console.log(`   ${chalk.cyan('Successful Answers:')} ${chalk.green(totals.successfulAnswers)}/${totals.questions}`);
    console.log(`   ${chalk.cyan('Total Relationships Used:')} ${chalk.white(totals.totalRelationships)}`);
    console.log(`   ${chalk.cyan('Total Context Sources:')} ${chalk.white(totals.totalContextSources)}`);
    
    if (totals.questions > 0) {
        console.log(`   ${chalk.cyan('Avg Relationships per Question:')} ${chalk.white((totals.totalRelationships / totals.questions).toFixed(1))}`);
        console.log(`   ${chalk.cyan('Avg Context Sources per Question:')} ${chalk.white((totals.totalContextSources / totals.questions).toFixed(1))}`);
        console.log(`   ${chalk.cyan('Avg Answer Length:')} ${chalk.white(Math.round(totals.totalAnswerLength / totals.questions))} chars`);
        
        const successRate = (totals.successfulAnswers / totals.questions * 100).toFixed(1);
        console.log(`   ${chalk.cyan('Success Rate:')} ${chalk.white(successRate + '%')}`);
    }
    
    console.log('');
}

/**
 * Initialize LLM handler
 */
async function initializeLLMHandler(config) {
    try {
        console.log(chalk.bold.white('🤖 Initializing LLM handler...'));
        
        const ollamaBaseUrl = config.ollamaBaseUrl || 'http://localhost:11434';
        
        // Test Ollama connection
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            throw new Error(`Ollama not available at ${ollamaBaseUrl}`);
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, config.llmModel);
        
        const llmHandler = new LLMHandler(
            ollamaConnector,
            config.llmModel,
            config.temperature
        );
        
        console.log(`   ${chalk.green('✓')} LLM handler initialized with model: ${config.llmModel}`);
        return llmHandler;
        
    } catch (error) {
        console.log(chalk.red(`❌ Failed to initialize LLM handler: ${error.message}`));
        throw error;
    }
}

/**
 * Main result generation function
 */
async function getResults() {
    displayHeader();
    
    try {
        // Configuration
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            maxContextTokens: 4000,
            maxContextSize: 5,
            llmModel: 'qwen2:1.5b',
            ollamaBaseUrl: 'http://localhost:11434',
            temperature: 0.7,
            timeout: 30000
        };
        
        displayConfiguration(config);
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        // Initialize context manager
        const contextManager = new ContextManager({
            maxTokens: config.maxContextTokens,
            maxContextSize: config.maxContextSize,
            relevanceThreshold: 0.3
        });
        
        console.log(`   ${chalk.green('✓')} Context manager initialized`);
        
        // Initialize LLM handler
        const llmHandler = await initializeLLMHandler(config);
        
        // Get questions with relationships
        const questions = await getQuestionsWithRelationships(sparqlHelper, config.beerqaGraphURI);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with relationships found. Run Navigate.js first.'));
            return;
        }
        
        console.log(chalk.bold.white('🎯 Generating final answers...'));
        console.log('');
        
        // Process each question
        const allResults = [];
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            console.log(chalk.bold.blue(`Processing ${i + 1}/${questions.length}:`));
            
            const result = await processQuestion(
                sparqlHelper,
                config.beerqaGraphURI,
                config.wikipediaGraphURI,
                question,
                contextManager,
                llmHandler,
                config
            );
            
            allResults.push(result);
        }
        
        displaySummary(allResults);
        console.log(chalk.green('🎉 Final answer generation completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Answer generation failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

getResults();