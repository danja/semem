#!/usr/bin/env node

/**
 * GetResult.js - Final LLM-based question answering for BeerQA
 * 
 * This script uses ContextManager.js to combine question corpuscles with
 * related corpuscles (found through ZPT navigation), formulates them as
 * augmented questions for the LLM, and returns the final answers to users.
 *
 * DEBUG: To see context passed to LLM, run with:
 *   LOG_LEVEL=debug node examples/beerqa/GetResult.js
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import ContextManager from '../../src/ContextManager.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { getDefaultQueryService } from '../../src/services/sparql/index.js';

/**
 * Calculate cosine similarity between two embedding vectors
 */
function calculateCosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Configure logging - respect LOG_LEVEL environment variable
const logLevel = process.env.LOG_LEVEL || 'info';
logger.setLevel(logLevel);
console.log(`Log level set to: ${logLevel}`);

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

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('questions-with-relationships', {
        graphURI: beerqaGraphURI
    });

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

    // Separate entities by graph based on URI patterns
    const beerqaEntities = entityURIs.filter(uri => uri.includes('/beerqa/'));
    const wikipediaEntities = entityURIs.filter(uri => uri.includes('/wikipedia/'));

    logger.debug(chalk.magenta(`🔍 DEBUG: Entity separation - BeerQA: ${beerqaEntities.length}, Wikipedia: ${wikipediaEntities.length}`));

    const queryService = getDefaultQueryService();

    // Query BeerQA content for BeerQA entities
    if (beerqaEntities.length > 0) {
        logger.debug(chalk.magenta(`📋 Querying ${beerqaEntities.length} BeerQA entities from graph: ${beerqaGraphURI}`));
        const beerqaQuery = await queryService.getQuery('entity-content-retrieval', {
            graphURI: beerqaGraphURI,
            entityList: queryService.formatEntityList(beerqaEntities)
        });

        const beerqaResult = await sparqlHelper.executeSelect(beerqaQuery);

        if (beerqaResult.success) {
            for (const binding of beerqaResult.data.results.bindings) {
                const content = binding.content?.value || binding.title?.value || 'No content available';
                entityContent.set(binding.entity.value, {
                    content: content,
                    source: 'BeerQA',
                    type: 'question',
                    title: binding.title?.value || 'BeerQA Entity'
                });
                logger.debug(chalk.magenta(`  ✓ BeerQA: ${binding.entity.value.split('/').pop()} -> "${content.substring(0, 100)}..."`));
            }
        } else {
            logger.debug(chalk.red(`  ❌ BeerQA query failed: ${beerqaResult.error}`));
        }
    }

    // Query Wikipedia content for Wikipedia entities
    if (wikipediaEntities.length > 0) {
        logger.debug(chalk.magenta(`📋 Querying ${wikipediaEntities.length} Wikipedia entities from graph: ${wikipediaGraphURI}`));
        const wikipediaQuery = await queryService.getQuery('entity-content-retrieval', {
            graphURI: wikipediaGraphURI,
            entityList: queryService.formatEntityList(wikipediaEntities)
        });

        const wikipediaResult = await sparqlHelper.executeSelect(wikipediaQuery);

        if (wikipediaResult.success) {
            for (const binding of wikipediaResult.data.results.bindings) {
                // Use content if available, otherwise title, otherwise label
                const fullContent = binding.content?.value || binding.title?.value || binding.label?.value || 'No content available';
                const contentType = binding.contentType?.value || 'text';
                const title = binding.title?.value || binding.label?.value || 'Unknown Title';

                // Debug: Log what fields we're getting from SPARQL
                logger.debug(chalk.cyan(`    SPARQL fields: content=${!!binding.content?.value}, title=${!!binding.title?.value}, label=${!!binding.label?.value}`));
                logger.debug(chalk.cyan(`    Content preview: "${fullContent.substring(0, 100)}..."`));

                entityContent.set(binding.entity.value, {
                    content: fullContent,
                    source: 'Wikipedia',
                    type: contentType,
                    title: title
                });
                logger.debug(chalk.magenta(`  ✓ Wikipedia: ${title} -> "${fullContent.substring(0, 100)}..."`));
            }
        } else {
            logger.debug(chalk.red(`  ❌ Wikipedia query failed: ${wikipediaResult.error}`));
        }
    }

    console.log(chalk.gray(`     ✓ Retrieved content for ${entityContent.size}/${entityURIs.length} entities (BeerQA: ${beerqaEntities.length}, Wikipedia: ${wikipediaEntities.length})`));

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

    // Debug: Log the context pieces for inspection
    logger.debug(chalk.magenta('🔍 DEBUG: Context pieces being used:'));
    for (let i = 0; i < retrievals.length; i++) {
        const retrieval = retrievals[i];
        logger.debug(chalk.magenta(`  [${i + 1}] Source: ${retrieval.interaction.source}, Similarity: ${retrieval.similarity.toFixed(3)}`));
        logger.debug(chalk.magenta(`      Content: ${retrieval.interaction.output.substring(0, 200)}${retrieval.interaction.output.length > 200 ? '...' : ''}`));
    }

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

    // Debug: Log the complete context being sent to LLM
    logger.debug(chalk.magenta('🤖 DEBUG: Full LLM Input:'));
    logger.debug(chalk.magenta('  Question URI:'), chalk.yellow(question.uri));
    logger.debug(chalk.magenta('  Question Text:'), chalk.yellow(`"${question.questionText}"`));
    logger.debug(chalk.magenta('  Question Object:'), chalk.gray(JSON.stringify(question, null, 2)));
    logger.debug(chalk.magenta('  System Prompt:'), chalk.cyan(systemPrompt));
    logger.debug(chalk.magenta('  Context Length:'), chalk.white(`${contextInfo.context.length} characters`));
    logger.debug(chalk.magenta('  Context Content:'));
    logger.debug(chalk.gray('--- CONTEXT START ---'));
    logger.debug(chalk.white(contextInfo.context));
    logger.debug(chalk.gray('--- CONTEXT END ---'));

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
        
        // Debug: Log the LLM response
        logger.debug(chalk.magenta('📝 DEBUG: LLM Response:'));
        logger.debug(chalk.gray('--- RESPONSE START ---'));
        logger.debug(chalk.green(response));
        logger.debug(chalk.gray('--- RESPONSE END ---'));

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

    // Filter relationships using embedding-based semantic similarity  
    const semanticThreshold = 0.3; // Minimum cosine similarity to consider relevant
    const maxRelationships = 10;   // Maximum relationships per question
    
    console.log(`     ${chalk.gray('Computing embedding-based semantic relevance for')} ${question.relationships.length} relationships...`);
    
    // Get content for all entities first
    const allEntityURIs = question.relationships.map(rel => rel.targetEntity);
    console.log(`     ${chalk.gray('Step 1: Getting content for')} ${allEntityURIs.length} entities...`);
    
    const allEntityContent = await getRelatedEntityContent(
        sparqlHelper,
        beerqaGraphURI,
        wikipediaGraphURI,
        allEntityURIs
    );
    
    console.log(`     ${chalk.gray('Step 2: Content retrieved, initializing embedding handler...')}`);
    
    // Initialize embedding handler using the exact same pattern as AugmentQuestion.js
    let embeddingHandler = null;
    try {
        // Use Ollama as the embedding provider (same as AugmentQuestion.js)
        const EmbeddingConnectorFactory = await import('../../src/connectors/EmbeddingConnectorFactory.js');
        const embeddingConnector = EmbeddingConnectorFactory.default.createConnector({
            provider: 'ollama',
            model: 'nomic-embed-text',
            options: { baseUrl: 'http://localhost:11434' }
        });
        
        const EmbeddingHandler = await import('../../src/handlers/EmbeddingHandler.js');
        const dimension = 1536; // nomic-embed-text dimension
        
        embeddingHandler = new EmbeddingHandler.default(
            embeddingConnector, 
            'nomic-embed-text',
            dimension
        );
        console.log(`     ${chalk.green('✓')} Embedding handler initialized (model: nomic-embed-text, dimension: ${dimension})`);
    } catch (error) {
        console.log(`     ${chalk.yellow('⚠️')} Failed to initialize embedding handler: ${error.message}`);
    }
    
    let filteredRelationships = [];
    let filteredEntityContent = new Map();
    let semanticScores = []; // Declare at proper scope
    
    if (!embeddingHandler) {
        console.log(`     ${chalk.yellow('⚠️')} No embedding handler available, using relationship weights instead`);
        // Fallback to weight-based filtering
        filteredRelationships = question.relationships
            .sort((a, b) => b.weight - a.weight)
            .slice(0, maxRelationships);
        
        for (const rel of filteredRelationships) {
            if (allEntityContent.has(rel.targetEntity)) {
                filteredEntityContent.set(rel.targetEntity, allEntityContent.get(rel.targetEntity));
            }
        }
    } else {
        console.log(`     ${chalk.gray('Step 3: Generating question embedding...')}`);
        
        // Generate embeddings for question and entity content with timeout
        try {
            const questionEmbedding = await Promise.race([
                embeddingHandler.generateEmbedding(question.questionText),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Question embedding timeout')), 15000))
            ]);
            
            console.log(`     ${chalk.gray('Step 4: Question embedding generated, processing')} ${allEntityContent.size} entities...`);
            let processedCount = 0;
            
            for (const rel of question.relationships) {
                const entityContent = allEntityContent.get(rel.targetEntity);
                if (entityContent && entityContent.content) {
                    try {
                        // Generate embedding for entity content with timeout (only process first 3 for speed)
                        if (processedCount >= 3) break; // Limit for testing
                        
                        console.log(`     ${chalk.gray(`Processing ${++processedCount}: ${entityContent.title}`)}`);
                        
                        const contentEmbedding = await Promise.race([
                            embeddingHandler.generateEmbedding(entityContent.content.substring(0, 300)), // Truncate long content
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Content embedding timeout')), 8000))
                        ]);
                        
                        // Calculate cosine similarity
                        const cosineSimilarity = calculateCosineSimilarity(questionEmbedding, contentEmbedding);
                        
                        semanticScores.push({
                            relationship: rel,
                            semanticScore: cosineSimilarity,
                            entityTitle: entityContent.title
                        });
                        
                        console.log(`     ${chalk.green('✓')} ${entityContent.title}: similarity ${cosineSimilarity.toFixed(3)}`);
                        
                    } catch (error) {
                        console.log(`     ${chalk.yellow('⚠️')} Failed to generate embedding for ${entityContent.title}: ${error.message}`);
                        // Continue processing other entities
                    }
                }
            }
        } catch (error) {
            console.log(`     ${chalk.red('❌')} Question embedding failed: ${error.message}`);
            // Fall back to weight-based filtering
            console.log(`     ${chalk.yellow('⚠️')} Falling back to weight-based filtering`);
            filteredRelationships = question.relationships
                .sort((a, b) => b.weight - a.weight)
                .slice(0, maxRelationships);
            
            for (const rel of filteredRelationships) {
                if (allEntityContent.has(rel.targetEntity)) {
                    filteredEntityContent.set(rel.targetEntity, allEntityContent.get(rel.targetEntity));
                }
            }
            return; // Exit early with fallback
        }
        
        console.log(`     ${chalk.gray('Step 5: All embeddings generated, filtering results...')}`);
        
        if (semanticScores.length === 0) {
            console.log(`     ${chalk.yellow('⚠️')} No semantic scores generated, falling back to weight-based filtering`);
            filteredRelationships = question.relationships
                .sort((a, b) => b.weight - a.weight)
                .slice(0, maxRelationships);
        }
        
        // Filter and sort by semantic relevance
        filteredRelationships = semanticScores
            .filter(item => item.semanticScore >= semanticThreshold)
            .sort((a, b) => b.semanticScore - a.semanticScore)
            .slice(0, maxRelationships)
            .map(item => item.relationship);
        
        console.log(`     ${chalk.gray('Embedding-based filtering:')} ${question.relationships.length} → ${filteredRelationships.length} relationships (threshold: ${semanticThreshold})`);
        
        // Log the filtered entities with their similarity scores
        const filteredEntities = semanticScores
            .filter(item => item.semanticScore >= semanticThreshold)
            .slice(0, maxRelationships);
        
        for (const item of filteredEntities) {
            console.log(`     ${chalk.green('✓')} ${item.entityTitle} (similarity: ${item.semanticScore.toFixed(3)})`);
        }
        
        // Use the filtered content
        for (const rel of filteredRelationships) {
            if (allEntityContent.has(rel.targetEntity)) {
                filteredEntityContent.set(rel.targetEntity, allEntityContent.get(rel.targetEntity));
            }
        }
    }

    // Build augmented context using filtered relationships and content
    const contextInfo = buildAugmentedContext(
        contextManager,
        question,
        filteredRelationships,
        filteredEntityContent,
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
 * Create LLM connector based on configuration priority (from api-server.js)
 */
async function createLLMConnector(config) {
    try {
        // Get llmProviders with priority ordering
        const llmProviders = config.get('llmProviders') || [];

        // Sort by priority (lower number = higher priority)
        const sortedProviders = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));

        console.log(`   Available chat providers by priority: ${sortedProviders.map(p => `${p.type} (priority: ${p.priority})`).join(', ')}`);

        // Try providers in priority order
        for (const provider of sortedProviders) {
            console.log(`   Trying LLM provider: ${provider.type} (priority: ${provider.priority})`);

            if (provider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                console.log('   ✅ Creating Mistral connector (highest priority)...');
                return new MistralConnector(process.env.MISTRAL_API_KEY);
            } else if (provider.type === 'claude' && process.env.CLAUDE_API_KEY) {
                console.log('   ✅ Creating Claude connector...');
                return new ClaudeConnector();
            } else if (provider.type === 'ollama') {
                console.log('   ✅ Creating Ollama connector (fallback)...');
                return new OllamaConnector();
            } else {
                console.log(`   ❌ Provider ${provider.type} not available (missing API key or implementation)`);
            }
        }

        console.log('   ⚠️ No configured providers available, defaulting to Ollama');
        return new OllamaConnector();

    } catch (error) {
        console.log(`   ⚠️ Failed to load provider configuration, defaulting to Ollama: ${error.message}`);
        return new OllamaConnector();
    }
}

/**
 * Get working model names from configuration (from api-server.js)
 */
async function getModelConfig(config) {
    try {
        // Get highest priority providers
        const llmProviders = config.get('llmProviders') || [];
        const chatProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        return {
            chatModel: chatProvider?.chatModel || 'qwen2:1.5b'
        };
    } catch (error) {
        console.log(`   ⚠️ Failed to get model config from configuration, using defaults: ${error.message}`);
        return {
            chatModel: 'qwen2:1.5b'
        };
    }
}

/**
 * Initialize LLM handler using configuration-driven approach (updated from api-server.js)
 */
async function initializeLLMHandler(config) {
    try {
        console.log(chalk.bold.white('🤖 Initializing LLM handler...'));

        const llmProvider = await createLLMConnector(config);
        const modelConfig = await getModelConfig(config);

        const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

        console.log(`   ${chalk.green('✓')} LLM handler initialized with model: ${modelConfig.chatModel}`);
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
        // Initialize configuration using the modern pattern (from api-server.js)
        const config = new Config('./config/config.json');
        await config.init();

        // Runtime configuration using Config.js
        const storageOptions = config.get('storage.options');

        const runtimeConfig = {
            sparqlEndpoint: storageOptions.update,
            sparqlAuth: { user: storageOptions.user, password: storageOptions.password },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            maxContextTokens: 4000,
            maxContextSize: 5,
            temperature: 0.7,
            timeout: 30000
        };

        displayConfiguration(runtimeConfig);

        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(runtimeConfig.sparqlEndpoint, {
            auth: runtimeConfig.sparqlAuth,
            timeout: runtimeConfig.timeout
        });

        // Initialize context manager
        const contextManager = new ContextManager({
            maxTokens: runtimeConfig.maxContextTokens,
            maxContextSize: runtimeConfig.maxContextSize,
            relevanceThreshold: 0.3
        });

        console.log(`   ${chalk.green('✓')} Context manager initialized`);

        // Initialize LLM handler
        const llmHandler = await initializeLLMHandler(config);

        // Get questions with relationships
        const questions = await getQuestionsWithRelationships(sparqlHelper, runtimeConfig.beerqaGraphURI);

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
                runtimeConfig.beerqaGraphURI,
                runtimeConfig.wikipediaGraphURI,
                question,
                contextManager,
                llmHandler,
                runtimeConfig
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