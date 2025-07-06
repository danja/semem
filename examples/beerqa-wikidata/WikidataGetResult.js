#!/usr/bin/env node

/**
 * WikidataGetResult.js - Enhanced answer generation with Wikidata integration
 * 
 * This script provides context-augmented question answering by combining:
 * - Local Wikipedia knowledge from BeerQA corpus
 * - Global Wikidata entities and relationships
 * - Enhanced navigation relationships from WikidataNavigate.js
 * - LLM completion with enriched context
 * 
 * Key Features:
 * - Multi-source context aggregation
 * - Wikidata entity descriptions and properties
 * - Enhanced relationship traversal
 * - Context-aware answer generation
 * - Source attribution in responses
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Config from '../../src/Config.js';
import ContextManager from '../../src/ContextManager.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
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
    console.log(chalk.bold.blue('║') + chalk.bold.white('         🎯 ENHANCED WIKIDATA QUESTION ANSWERING          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('   Context-augmented answers with Wikipedia + Wikidata       ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('Wikidata Graph URI:')} ${chalk.white(config.wikidataGraphURI)}`);
    console.log(`   ${chalk.cyan('Navigation Graph URI:')} ${chalk.white(config.navigationGraphURI)}`);
    console.log(`   ${chalk.cyan('Max Context Tokens:')} ${chalk.white(config.maxContextTokens)}`);
    console.log(`   ${chalk.cyan('Context Window Size:')} ${chalk.white(config.maxContextSize)}`);
    console.log(`   ${chalk.cyan('LLM Model:')} ${chalk.white(config.llmModel)}`);
    console.log('');
}

/**
 * Get questions with enhanced relationships from navigation
 */
async function getQuestionsWithEnhancedRelationships(sparqlHelper, config) {
    console.log(chalk.bold.white('📋 Finding questions with enhanced relationships...'));

    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?question ?questionText ?relationship ?targetEntity ?relationshipType ?weight ?sourceCorpus ?similarity
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
    }
    
    GRAPH <${config.navigationGraphURI}> {
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
        
        OPTIONAL { ?relationship ragno:sourceCorpus ?sourceCorpus }
        OPTIONAL { ?relationship ragno:similarity ?similarity }
        
        # Filter for enhanced relationships
        FILTER(CONTAINS(?relationshipType, "wikidata") || CONTAINS(?relationshipType, "wikipedia"))
    }
    
    # FILTER FOR SPECIFIC QUESTION - UNCOMMENT AND MODIFY AS NEEDED:
    # FILTER(CONTAINS(LCASE(?questionText), "your search term here"))
    # Example: FILTER(CONTAINS(LCASE(?questionText), "machine learning"))
}
ORDER BY ?question DESC(?weight)`;

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
                text: binding.questionText.value,
                relationships: []
            });
        }

        questionsMap.get(questionURI).relationships.push({
            uri: binding.relationship.value,
            targetEntity: binding.targetEntity.value,
            relationshipType: binding.relationshipType.value,
            weight: parseFloat(binding.weight.value),
            sourceCorpus: binding.sourceCorpus?.value || 'unknown',
            similarity: binding.similarity ? parseFloat(binding.similarity.value) : null
        });
    }

    const questions = Array.from(questionsMap.values());
    console.log(chalk.green(`   ✓ Found ${questions.length} questions with enhanced relationships`));
    
    return questions;
}

/**
 * Retrieve enhanced context for entities from multiple sources
 */
async function getEnhancedEntityContext(entityURIs, question, sparqlHelper, config) {
    const contextSources = {
        wikipedia: [],
        wikidata: [],
        beerqa: []
    };

    // Get Wikipedia context
    if (entityURIs.length > 0) {
        const wikipediaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label ?content WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL { ?entity ragno:content ?content }
        
        FILTER(?entity IN (${entityURIs.map(uri => `<${uri}>`).join(', ')}))
    }
}`;

        const wikipediaResult = await sparqlHelper.executeSelect(wikipediaQuery);
        if (wikipediaResult.success) {
            contextSources.wikipedia = wikipediaResult.data.results.bindings.map(binding => ({
                uri: binding.entity.value,
                label: binding.label.value,
                content: binding.content?.value || '',
                source: 'Wikipedia'
            }));
        }
    }

    // Get Wikidata context
    if (entityURIs.length > 0) {
        // Filter for only Wikidata URIs
        const wikidataURIs = entityURIs.filter(uri => uri.includes('wikidata'));
        
        if (wikidataURIs.length > 0) {
            console.log(chalk.dim(`   🔍 Querying ${wikidataURIs.length} Wikidata URIs: ${wikidataURIs.slice(0, 2).join(', ')}`));
            
            const wikidataQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label ?wikidataId ?description WHERE {
    GRAPH <${config.wikidataGraphURI}> {
        ?entity a ragno:Entity ;
               rdfs:label ?label .
        
        OPTIONAL { ?entity ragno:wikidataId ?wikidataId }
        OPTIONAL { ?entity rdfs:comment ?description }
        
        FILTER(?entity IN (${wikidataURIs.map(uri => `<${uri}>`).join(', ')}))
    }
}`;

            const wikidataResult = await sparqlHelper.executeSelect(wikidataQuery);
            if (wikidataResult.success) {
                contextSources.wikidata = wikidataResult.data.results.bindings.map(binding => ({
                    uri: binding.entity.value,
                    label: binding.label.value,
                    wikidataId: binding.wikidataId?.value || '',
                    description: binding.description?.value || '',
                    source: 'Wikidata'
                }));
            }
        }
    }

    // Get BeerQA context - include both target entities and the source question
    const beerqaURIs = entityURIs.filter(uri => uri.includes('beerqa'));
    const allBeerQAURIs = [...beerqaURIs];
    
    // Also include the source question URI 
    if (question && question.uri) {
        allBeerQAURIs.push(question.uri);
    }
    
    if (allBeerQAURIs.length > 0) {
        console.log(chalk.dim(`   🔍 Querying ${allBeerQAURIs.length} BeerQA URIs`));
        
        const beerqaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label ?content WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL { ?entity ragno:content ?content }
        
        FILTER(?entity IN (${allBeerQAURIs.map(uri => `<${uri}>`).join(', ')}))
    }
}`;

        const beerqaResult = await sparqlHelper.executeSelect(beerqaQuery);
        if (beerqaResult.success) {
            contextSources.beerqa = beerqaResult.data.results.bindings.map(binding => ({
                uri: binding.entity.value,
                label: binding.label.value,
                content: binding.content?.value || '',
                source: 'BeerQA'
            }));
        }
    }

    return contextSources;
}

/**
 * Build comprehensive context from multiple sources
 */
function buildEnhancedContext(question, relationships, contextSources, config) {
    const contextSections = [];
    
    // Add question context
    contextSections.push(`QUESTION: ${question.text}\n`);
    
    // Add Wikidata context
    if (contextSources.wikidata.length > 0) {
        contextSections.push('WIKIDATA KNOWLEDGE:');
        contextSources.wikidata.forEach(entity => {
            const description = entity.description || entity.label;
            contextSections.push(`• ${entity.label}: ${description}`);
            if (entity.wikidataId) {
                contextSections.push(`  (Wikidata ID: ${entity.wikidataId})`);
            }
        });
        contextSections.push('');
    }
    
    // Add Wikipedia context
    if (contextSources.wikipedia.length > 0) {
        contextSections.push('WIKIPEDIA CONTEXT:');
        contextSources.wikipedia.forEach(entity => {
            const content = entity.content || entity.label;
            const truncatedContent = content.length > 300 ? 
                content.substring(0, 300) + '...' : content;
            contextSections.push(`• ${entity.label}: ${truncatedContent}`);
        });
        contextSections.push('');
    }
    
    // Add BeerQA context
    if (contextSources.beerqa.length > 0) {
        contextSections.push('BEERQA CONTEXT:');
        contextSources.beerqa.forEach(entity => {
            const content = entity.content || entity.label;
            const truncatedContent = content.length > 200 ? 
                content.substring(0, 200) + '...' : content;
            contextSections.push(`• ${entity.label}: ${truncatedContent}`);
        });
        contextSections.push('');
    }
    
    // Add relationship information
    if (relationships.length > 0) {
        contextSections.push('RELATED ENTITIES:');
        relationships
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5)
            .forEach((rel, i) => {
                const similarity = rel.similarity ? ` (similarity: ${rel.similarity.toFixed(3)})` : '';
                contextSections.push(`${i + 1}. ${rel.targetEntity.split('/').pop()} from ${rel.sourceCorpus}${similarity}`);
            });
        contextSections.push('');
    }
    
    const context = contextSections.join('\n');
    
    // Ensure context doesn't exceed token limits
    const maxContextLength = config.maxContextTokens * 4; // Rough estimate: 4 chars per token
    if (context.length > maxContextLength) {
        return context.substring(0, maxContextLength) + '\n[Context truncated...]';
    }
    
    return context;
}

/**
 * Generate enhanced answer using LLM with multi-source context
 */
async function generateEnhancedAnswer(question, context, llmHandler, config) {
    const prompt = `You are an expert knowledge assistant with access to information from Wikipedia, Wikidata, and specialized knowledge bases. Please provide a comprehensive answer to the following question using the provided context.

INSTRUCTIONS:
- Use the provided context from multiple sources (Wikidata, Wikipedia, BeerQA)
- Synthesize information from all available sources
- Provide specific details and examples when available
- Mention source attribution when relevant (e.g., "According to Wikidata..." or "Wikipedia indicates...")
- If the context is insufficient, clearly state what additional information would be helpful
- If information is incomplete, generate 2-3 specific follow-up questions that would help complete the answer
- Format follow-up questions as: "FOLLOW-UP QUESTIONS: 1. Question 2. Question 3. Question"

CONTEXT:
${context}

QUESTION: ${question.text}

ENHANCED ANSWER:`;

    try {
        const response = await llmHandler.generateResponse(prompt);
        return {
            success: true,
            answer: response,
            contextLength: context.length,
            hasWikidataContext: context.includes('WIKIDATA KNOWLEDGE:'),
            hasWikipediaContext: context.includes('WIKIPEDIA CONTEXT:'),
            hasBeerqaContext: context.includes('BEERQA CONTEXT:')
        };
    } catch (error) {
        logger.error('LLM generation failed:', error.message);
        return {
            success: false,
            error: error.message,
            contextLength: context.length
        };
    }
}

/**
 * Process a single question for enhanced answer generation
 */
async function processQuestionForAnswer(question, sparqlHelper, llmHandler, config) {
    console.log(chalk.bold.blue(`\n🎯 Answering: "${question.text}"`));
    
    try {
        // Get unique entity URIs from relationships
        const entityURIs = [...new Set(question.relationships.map(rel => rel.targetEntity))];
        
        console.log(chalk.white(`   📊 Context sources: ${entityURIs.length} entities, ${question.relationships.length} relationships`));
        
        // Retrieve enhanced context from multiple sources
        const contextSources = await getEnhancedEntityContext(entityURIs, question, sparqlHelper, config);
        
        console.log(chalk.gray(`   🔍 Context retrieved: ${contextSources.wikidata.length} Wikidata + ${contextSources.wikipedia.length} Wikipedia + ${contextSources.beerqa.length} BeerQA`));
        
        // Debug: Log some entity URIs to check what we're looking for
        if (entityURIs.length > 0) {
            console.log(chalk.dim(`   🔍 Sample entity URIs: ${entityURIs.slice(0, 3).join(', ')}`));
        }
        
        // Build comprehensive context
        const context = buildEnhancedContext(question, question.relationships, contextSources, config);
        
        // Generate enhanced answer
        const answerResult = await generateEnhancedAnswer(question, context, llmHandler, config);
        
        if (answerResult.success) {
            console.log(chalk.green(`   ✓ Answer generated successfully`));
            console.log(chalk.green(`   ✓ Context length: ${answerResult.contextLength} characters`));
            console.log(chalk.green(`   ✓ Sources: Wikidata(${answerResult.hasWikidataContext}), Wikipedia(${answerResult.hasWikipediaContext}), BeerQA(${answerResult.hasBeerqaContext})`));
            
            // Display the full answer immediately
            console.log(chalk.bold.white('\n📝 ENHANCED ANSWER:'));
            console.log(chalk.white(answerResult.answer));
            console.log('');
            
            return {
                success: true,
                question: question,
                answer: answerResult.answer,
                context: context,
                contextSources: contextSources,
                stats: {
                    contextLength: answerResult.contextLength,
                    entityCount: entityURIs.length,
                    relationshipCount: question.relationships.length,
                    wikidataEntities: contextSources.wikidata.length,
                    wikipediaEntities: contextSources.wikipedia.length,
                    beerqaEntities: contextSources.beerqa.length
                }
            };
        } else {
            console.log(chalk.red(`   ❌ Answer generation failed: ${answerResult.error}`));
            return {
                success: false,
                question: question,
                error: answerResult.error
            };
        }
        
    } catch (error) {
        console.log(chalk.red(`   ❌ Processing failed: ${error.message}`));
        return {
            success: false,
            question: question,
            error: error.message
        };
    }
}

/**
 * Display enhanced results
 */
function displayEnhancedResults(results) {
    console.log(chalk.bold.yellow('\n📋 Enhanced Answer Generation Results:'));
    console.log('');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(chalk.cyan(`   Total questions processed: ${results.length}`));
    console.log(chalk.cyan(`   Successful answers: ${successful.length}`));
    console.log(chalk.cyan(`   Failed attempts: ${failed.length}`));
    console.log('');

    if (successful.length > 0) {
        // Show statistics
        const avgContextLength = successful.reduce((sum, r) => sum + (r.stats?.contextLength || 0), 0) / successful.length;
        const totalWikidataEntities = successful.reduce((sum, r) => sum + (r.stats?.wikidataEntities || 0), 0);
        const totalWikipediaEntities = successful.reduce((sum, r) => sum + (r.stats?.wikipediaEntities || 0), 0);
        
        console.log(chalk.yellow('📊 Context Statistics:'));
        console.log(chalk.white(`   Average context length: ${Math.round(avgContextLength)} characters`));
        console.log(chalk.white(`   Total Wikidata entities: ${totalWikidataEntities}`));
        console.log(chalk.white(`   Total Wikipedia entities: ${totalWikipediaEntities}`));
        console.log('');

        // Show summary of all answers  
        console.log(chalk.bold.yellow('🎯 Enhanced Answers Summary:'));
        console.log('');
        
        successful.forEach((result, i) => {
            console.log(chalk.bold.blue(`${i + 1}. "${result.question.text}"`));
            console.log(chalk.green(`   Sources: ${result.stats.wikidataEntities} Wikidata + ${result.stats.wikipediaEntities} Wikipedia + ${result.stats.beerqaEntities} BeerQA entities`));
            console.log(chalk.gray(`   Context: ${result.stats.contextLength} chars, ${result.stats.relationshipCount} relationships`));
            console.log('');
        });
    }

    if (failed.length > 0) {
        console.log(chalk.red('❌ Failed Questions:'));
        failed.forEach((result, i) => {
            console.log(chalk.red(`   ${i + 1}. "${result.question.text}" - ${result.error}`));
        });
        console.log('');
    }
}

/**
 * Initialize LLM handler with proper provider selection
 */
async function initializeLLMHandler(configObj) {
    console.log(chalk.bold.white('🤖 Initializing LLM handler...'));

    try {
        const llmProviders = configObj.get('llmProviders') || [];
        const chatProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        if (!chatProvider) {
            throw new Error('No chat LLM provider configured');
        }

        // Create LLM connector based on provider type
        let llmConnector;
        if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
            const { default: MistralConnector } = await import('../../src/connectors/MistralConnector.js');
            llmConnector = new MistralConnector({
                apiKey: process.env.MISTRAL_API_KEY,
                model: chatProvider.chatModel
            });
        } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
            const { default: ClaudeConnector } = await import('../../src/connectors/ClaudeConnector.js');
            llmConnector = new ClaudeConnector({
                apiKey: process.env.CLAUDE_API_KEY,
                model: chatProvider.chatModel
            });
        } else {
            // Fallback to Ollama
            const { default: OllamaConnector } = await import('../../src/connectors/OllamaConnector.js');
            llmConnector = new OllamaConnector({
                baseUrl: 'http://localhost:11434',
                model: 'qwen2:1.5b'
            });
        }

        const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel || 'qwen2:1.5b');
        
        console.log(chalk.green(`   ✓ LLM handler initialized with ${chatProvider.type} provider`));
        return llmHandler;

    } catch (error) {
        logger.error('Failed to initialize LLM handler:', error.message);
        throw error;
    }
}

/**
 * Main enhanced answer generation function
 */
async function generateEnhancedAnswers() {
    displayHeader();
    
    try {
        // Load Config.js for proper SPARQL configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        const configObj = new Config(configPath);
        await configObj.init();
        const storageOptions = configObj.get('storage.options');
        
        // Configuration using Config.js
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
            maxContextTokens: 3000,
            maxContextSize: 12000, // characters
            llmModel: 'mistral-small-latest',
            timeout: 30000
        };
        
        displayConfiguration(config);
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        // Initialize LLM handler
        const llmHandler = await initializeLLMHandler(configObj);
        
        // Get questions with enhanced relationships
        const questions = await getQuestionsWithEnhancedRelationships(sparqlHelper, config);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No questions with enhanced relationships found. Run WikidataNavigate.js first.'));
            return;
        }
        
        console.log(chalk.bold.white('🎯 Starting enhanced answer generation...'));
        console.log('');
        
        // Process each question for enhanced answers
        const allResults = [];
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            console.log(chalk.bold.blue(`Question ${i + 1}/${questions.length}:`));
            
            const result = await processQuestionForAnswer(
                question,
                sparqlHelper,
                llmHandler,
                config
            );
            
            allResults.push(result);
        }
        
        displayEnhancedResults(allResults);
        console.log(chalk.green('🎉 Enhanced answer generation completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Enhanced answer generation failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    generateEnhancedAnswers();
}

// Export functions for use in other modules
export { 
    getQuestionsWithEnhancedRelationships,
    getEnhancedEntityContext,
    buildEnhancedContext,
    generateEnhancedAnswer,
    processQuestionForAnswer,
    initializeLLMHandler,
    generateEnhancedAnswers
};