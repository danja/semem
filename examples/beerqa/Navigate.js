#!/usr/bin/env node

/**
 * Navigate.js - ZPT-based corpuscle navigation for BeerQA question answering
 * 
 * This script uses ZPT (Zero-Point Traversal) tools to navigate through corpuscles
 * with the best chance of answering the given question. It performs semantic navigation
 * using zoom/tilt/pan parameters and creates ragno:Relationship entities to associate
 * relevant corpuscles with the question corpuscle.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';
import SPARQLHelper from './SPARQLHelper.js';
import { getDefaultQueryService } from '../../src/services/sparql/index.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🧭 BEER QA ZPT NAVIGATION                     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Semantic corpuscle navigation using Zero-Point Traversal ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('Navigation Graph URI:')} ${chalk.white(config.navigationGraphURI)}`);
    console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(config.similarityThreshold)}`);
    console.log(`   ${chalk.cyan('Max Related Corpuscles:')} ${chalk.white(config.maxRelatedCorpuscles)}`);
    console.log('');
}

/**
 * Get questions with concepts and embeddings for navigation
 */
async function getNavigableQuestions(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Finding navigable questions...'));
    
    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('navigation-questions', {
        graphURI: beerqaGraphURI,
        additionalFilters: ''
    });

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        throw new Error(`Failed to retrieve navigable questions: ${result.error}`);
    }
    
    // Group results by question
    const questionsMap = new Map();
    
    for (const binding of result.data.results.bindings) {
        const questionURI = binding.question.value;
        
        if (!questionsMap.has(questionURI)) {
            let embedding = null;
            try {
                if (binding.embedding) {
                    embedding = JSON.parse(binding.embedding.value);
                    if (!Array.isArray(embedding) || embedding.length !== 1536) {
                        embedding = null;
                    }
                }
            } catch (error) {
                console.log(chalk.yellow(`⚠️  Invalid embedding for ${questionURI}: ${error.message}`));
                continue;
            }
            
            questionsMap.set(questionURI, {
                uri: questionURI,
                questionText: binding.questionText.value,
                embedding: embedding,
                concepts: []
            });
        }
        
        // Add concept if present
        if (binding.conceptValue) {
            const concept = {
                value: binding.conceptValue.value,
                type: binding.conceptType?.value || 'concept',
                confidence: binding.conceptConfidence ? parseFloat(binding.conceptConfidence.value) : 0.5
            };
            
            questionsMap.get(questionURI).concepts.push(concept);
        }
    }
    
    const questions = Array.from(questionsMap.values()).filter(q => q.embedding && q.concepts.length > 0);
    
    console.log(`   ${chalk.green('✓')} Found ${questions.length} navigable questions`);
    console.log('');
    
    return questions;
}

/**
 * Get available corpuscles for navigation (from BeerQA and Wikipedia)
 */
async function getNavigationCorpus(sparqlHelper, beerqaGraphURI, wikipediaGraphURI) {
    console.log(chalk.bold.white('📚 Loading navigation corpus...'));
    
    const queryService = getDefaultQueryService();
    
    const queries = [
        {
            name: 'BeerQA',
            graph: beerqaGraphURI,
            query: await queryService.getQuery('corpus-loading', {
                graphURI: beerqaGraphURI,
                additionalFilters: ''
            })
        },
        {
            name: 'Wikipedia',
            graph: wikipediaGraphURI,
            query: await queryService.getQuery('corpus-loading', {
                graphURI: wikipediaGraphURI,
                additionalFilters: ''
            })
        }
    ];
    
    const allCorpuscles = [];
    
    for (const queryInfo of queries) {
        const result = await sparqlHelper.executeSelect(queryInfo.query);
        
        if (!result.success) {
            console.log(chalk.yellow(`⚠️  Failed to load ${queryInfo.name} corpus: ${result.error}`));
            continue;
        }
        
        // Group by corpuscle
        const corpusclesMap = new Map();
        
        for (const binding of result.data.results.bindings) {
            const corpuscleURI = binding.corpuscle.value;
            
            if (!corpusclesMap.has(corpuscleURI)) {
                let embedding = null;
                try {
                    if (binding.embedding) {
                        embedding = JSON.parse(binding.embedding.value);
                        if (!Array.isArray(embedding) || embedding.length !== 1536) {
                            embedding = null;
                        }
                    }
                } catch (error) {
                    // Skip corpuscles with invalid embeddings
                    continue;
                }
                
                corpusclesMap.set(corpuscleURI, {
                    uri: corpuscleURI,
                    content: binding.content.value,
                    embedding: embedding,
                    concepts: [],
                    source: queryInfo.name
                });
            }
            
            // Add concept if present
            if (binding.conceptValue) {
                corpusclesMap.get(corpuscleURI).concepts.push({
                    value: binding.conceptValue.value,
                    type: binding.conceptType?.value || 'concept'
                });
            }
        }
        
        const corpuscles = Array.from(corpusclesMap.values());
        allCorpuscles.push(...corpuscles);
        
        console.log(`   ${chalk.green('✓')} Loaded ${corpuscles.length} ${queryInfo.name} corpuscles`);
    }
    
    console.log(`   ${chalk.green('✓')} Total corpus: ${allCorpuscles.length} corpuscles`);
    console.log('');
    
    return allCorpuscles;
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length || vec1.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate concept similarity between question and corpuscle concepts
 */
function calculateConceptSimilarity(questionConcepts, corpuscleConcepts) {
    if (questionConcepts.length === 0 || corpuscleConcepts.length === 0) return { score: 0, matches: [] };
    
    const matches = [];
    let totalScore = 0;
    
    for (const qConcept of questionConcepts) {
        for (const cConcept of corpuscleConcepts) {
            const qValue = qConcept.value.toLowerCase();
            const cValue = cConcept.value.toLowerCase();
            
            // Exact match
            if (qValue === cValue) {
                matches.push({ question: qValue, corpuscle: cValue, matchType: 'exact' });
                totalScore += 1.0;
            }
            // Partial match (one contains the other)
            else if (qValue.includes(cValue) || cValue.includes(qValue)) {
                matches.push({ question: qValue, corpuscle: cValue, matchType: 'partial' });
                totalScore += 0.7;
            }
        }
    }
    
    // Normalize score
    const maxPossibleScore = Math.min(questionConcepts.length, corpuscleConcepts.length);
    const normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    
    return {
        score: Math.min(normalizedScore, 1.0),
        matches: matches
    };
}

/**
 * Apply ZPT navigation logic to find relevant corpuscles
 */
function applyZPTNavigation(question, corpus, scenario) {
    const filteredCorpuscles = [];
    
    for (const corpuscle of corpus) {
        let score = 0;
        let details = { similarityScore: 0, conceptScore: 0, conceptMatches: [] };
        
        // Apply tilt projection (representation style)
        if (scenario.tiltProjection === 'embedding' && question.embedding && corpuscle.embedding) {
            // Embedding-based similarity
            const similarity = calculateCosineSimilarity(question.embedding, corpuscle.embedding);
            score += similarity * 0.6; // 60% weight for embedding similarity
            details.similarityScore = similarity;
        }
        
        if (scenario.tiltProjection === 'keywords' || scenario.tiltProjection === 'graph') {
            // Concept-based similarity
            const conceptResult = calculateConceptSimilarity(question.concepts, corpuscle.concepts);
            score += conceptResult.score * 0.4; // 40% weight for concept matching
            details.conceptScore = conceptResult.score;
            details.conceptMatches = conceptResult.matches;
        }
        
        // Apply zoom level (granularity filtering)
        if (scenario.zoomLevel === 'entity') {
            // Entity-level: focus on specific concepts
            if (details.conceptMatches.length > 0) score *= 1.2;
        } else if (scenario.zoomLevel === 'unit') {
            // Unit-level: broader semantic units
            if (corpuscle.content.length > 50) score *= 1.1;
        } else if (scenario.zoomLevel === 'community') {
            // Community-level: thematic clustering
            if (corpuscle.concepts.length > 1) score *= 1.15;
        }
        
        // Apply pan domains (constraint filtering)
        if (scenario.panDomains.includes('topic')) {
            // Topic-based filtering
            if (details.conceptMatches.length > 0) score *= 1.1;
        }
        if (scenario.panDomains.includes('entity')) {
            // Entity-based filtering
            if (details.similarityScore > 0.7) score *= 1.05;
        }
        
        // Only include if above threshold
        if (score > scenario.minScore) {
            filteredCorpuscles.push({
                ...corpuscle,
                navigationScore: score,
                navigationDetails: details
            });
        }
    }
    
    // Sort by navigation score and return top results
    return filteredCorpuscles
        .sort((a, b) => b.navigationScore - a.navigationScore)
        .slice(0, scenario.maxResults);
}

/**
 * Create ragno:Relationship entity linking question to relevant corpuscle
 */
async function createQuestionAnswerRelationship(sparqlHelper, beerqaGraphURI, questionURI, corpuscle, relationshipType = 'potentialAnswer') {
    const relationshipURI = `${questionURI}/relationship/${relationshipType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Prepare relationship data
    const weight = corpuscle.navigationScore;
    const description = `Navigation-based relationship: ${relationshipType} (score: ${weight.toFixed(3)})`;
    const conceptMatches = corpuscle.navigationDetails?.conceptMatches || [];
    const conceptsText = conceptMatches.length > 0 
        ? `Concept matches: ${conceptMatches.map(m => `${m.question}~${m.corpuscle}(${m.matchType})`).join(', ')}`
        : 'No concept matches';
    
    const triples = `
        <${relationshipURI}> a ragno:Relationship ;
                            ragno:hasSourceEntity <${questionURI}> ;
                            ragno:hasTargetEntity <${corpuscle.uri}> ;
                            ragno:relationshipType "${relationshipType}" ;
                            ragno:weight ${weight} ;
                            ragno:description "${description}" ;
                            ragno:navigationScore ${weight} ;
                            ragno:conceptMatches "${conceptsText}" ;
                            ragno:sourceCorpus "${corpuscle.source}" ;
                            ragno:created "${new Date().toISOString()}" .`;
    
    const queryService = getDefaultQueryService();
    const insertQuery = await queryService.getQuery('relationship-creation', {
        graphURI: beerqaGraphURI,
        relationshipURI: relationshipURI,
        sourceEntity: questionURI,
        targetEntity: corpuscle.uri,
        relationshipType: relationshipType,
        weight: weight,
        description: description,
        navigationScore: weight,
        conceptMatches: conceptsText,
        sourceCorpus: corpuscle.source,
        timestamp: new Date().toISOString()
    });
    
    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    return {
        success: result.success,
        relationshipURI: relationshipURI,
        error: result.error || null
    };
}

/**
 * Process a single question through ZPT navigation
 */
async function processQuestionNavigation(sparqlHelper, beerqaGraphURI, question, corpus, config) {
    console.log(chalk.bold.white(`📝 Processing: ${question.questionText.substring(0, 80)}...`));
    console.log(`   ${chalk.cyan('Question URI:')} ${chalk.dim(question.uri)}`);
    console.log(`   ${chalk.cyan('Concepts:')} ${chalk.white(question.concepts.length)}`);
    
    // Define ZPT navigation scenarios based on question characteristics
    const scenarios = [
        {
            name: 'Semantic Entity Navigation',
            zoomLevel: 'entity',
            tiltProjection: 'embedding',
            panDomains: ['topic', 'entity'],
            minScore: config.similarityThreshold,
            maxResults: Math.ceil(config.maxRelatedCorpuscles / 2)
        },
        {
            name: 'Keyword Concept Navigation',
            zoomLevel: 'unit',
            tiltProjection: 'keywords',
            panDomains: ['topic'],
            minScore: config.similarityThreshold * 0.8,
            maxResults: Math.ceil(config.maxRelatedCorpuscles / 2)
        }
    ];
    
    const allNavigationResults = [];
    const allRelationships = [];
    
    for (const scenario of scenarios) {
        console.log(`   ${chalk.yellow('Scenario:')} ${chalk.white(scenario.name)}`);
        console.log(`     ${chalk.gray('ZPT:')} zoom=${scenario.zoomLevel}, tilt=${scenario.tiltProjection}, pan=[${scenario.panDomains.join(', ')}]`);
        
        // Apply ZPT navigation
        const navigationResults = applyZPTNavigation(question, corpus, scenario);
        
        console.log(`     ${chalk.green('✓')} Found ${navigationResults.length} relevant corpuscles`);
        
        // Display top results
        for (let i = 0; i < Math.min(navigationResults.length, 3); i++) {
            const result = navigationResults[i];
            console.log(`       ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(result.source)} - Score: ${chalk.green(result.navigationScore.toFixed(3))}`);
            console.log(`          ${chalk.gray(result.content.substring(0, 60))}...`);
            
            if (result.navigationDetails.conceptMatches.length > 0) {
                const matches = result.navigationDetails.conceptMatches.slice(0, 2);
                console.log(`          ${chalk.yellow('Concepts:')} ${matches.map(m => m.question).join(', ')}`);
            }
        }
        
        // Create relationships for navigation results
        for (const result of navigationResults) {
            const relationshipType = scenario.name === 'Semantic Entity Navigation' 
                ? 'semanticAnswer' 
                : 'keywordAnswer';
            
            const relResult = await createQuestionAnswerRelationship(
                sparqlHelper,
                beerqaGraphURI,
                question.uri,
                result,
                relationshipType
            );
            
            if (relResult.success) {
                allRelationships.push(relResult.relationshipURI);
            } else {
                console.log(`       ${chalk.red('❌')} Failed to create relationship: ${relResult.error}`);
            }
        }
        
        allNavigationResults.push(...navigationResults);
        console.log('');
    }
    
    console.log(`   ${chalk.green('✓')} Created ${allRelationships.length} relationship entities`);
    console.log('');
    
    return {
        questionURI: question.uri,
        navigationResults: allNavigationResults,
        relationshipURIs: allRelationships,
        totalScore: allNavigationResults.reduce((sum, r) => sum + r.navigationScore, 0)
    };
}

/**
 * Display final summary
 */
function displaySummary(allResults) {
    const totals = allResults.reduce((acc, result) => ({
        questions: acc.questions + 1,
        corpusclesFound: acc.corpusclesFound + result.navigationResults.length,
        relationshipsCreated: acc.relationshipsCreated + result.relationshipURIs.length,
        totalScore: acc.totalScore + result.totalScore
    }), {
        questions: 0,
        corpusclesFound: 0,
        relationshipsCreated: 0,
        totalScore: 0
    });
    
    console.log(chalk.bold.white('📊 Navigation Summary:'));
    console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(totals.questions)}`);
    console.log(`   ${chalk.cyan('Relevant Corpuscles Found:')} ${chalk.white(totals.corpusclesFound)}`);
    console.log(`   ${chalk.cyan('Relationships Created:')} ${chalk.white(totals.relationshipsCreated)}`);
    
    if (totals.questions > 0) {
        console.log(`   ${chalk.cyan('Avg Corpuscles per Question:')} ${chalk.white((totals.corpusclesFound / totals.questions).toFixed(1))}`);
        console.log(`   ${chalk.cyan('Avg Navigation Score:')} ${chalk.white((totals.totalScore / totals.corpusclesFound || 0).toFixed(3))}`);
    }
    
    console.log('');
}

/**
 * Initialize embedding handler
 */
async function initializeEmbeddingHandler() {
    try {
        console.log(chalk.bold.white('🔢 Initializing embedding handler...'));
        
        const ollamaBaseUrl = 'http://localhost:11434';
        
        // Test Ollama connection
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            console.log(chalk.yellow('⚠️  Ollama not available, embeddings will be limited'));
            return null;
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });
        
        const embeddingHandler = new EmbeddingHandler(
            ollamaConnector,
            'nomic-embed-text:latest',
            1536,
            cacheManager
        );
        
        console.log(`   ${chalk.green('✓')} Embedding handler initialized`);
        return embeddingHandler;
        
    } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to initialize embedding handler: ${error.message}`));
        return null;
    }
}

/**
 * Main navigation function
 */
async function navigateQuestions() {
    displayHeader();
    
    try {
        // Load Config.js for proper SPARQL configuration
        const configObj = new Config('./config/config.json');
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
            navigationGraphURI: 'http://purl.org/stuff/navigation',
            similarityThreshold: 0.3,
            maxRelatedCorpuscles: 6,
            timeout: 30000
        };
        
        displayConfiguration(config);
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        // Initialize embedding handler (optional)
        const embeddingHandler = await initializeEmbeddingHandler();
        
        // Get navigable questions
        const questions = await getNavigableQuestions(sparqlHelper, config.beerqaGraphURI);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No navigable questions found. Run AugmentQuestion.js and AddQuestionEmbedding.js first.'));
            return;
        }
        
        // Load navigation corpus
        const corpus = await getNavigationCorpus(sparqlHelper, config.beerqaGraphURI, config.wikipediaGraphURI);
        
        if (corpus.length === 0) {
            console.log(chalk.yellow('⚠️  No navigation corpus found. Ensure BeerQA and Wikipedia data is loaded.'));
            return;
        }
        
        console.log(chalk.bold.white('🧭 Starting ZPT-based navigation...'));
        console.log('');
        
        // Process each question through ZPT navigation
        const allResults = [];
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            console.log(chalk.bold.blue(`Question ${i + 1}/${questions.length}:`));
            
            const result = await processQuestionNavigation(
                sparqlHelper,
                config.beerqaGraphURI,
                question,
                corpus,
                config
            );
            
            allResults.push(result);
        }
        
        displaySummary(allResults);
        console.log(chalk.green('🎉 ZPT navigation completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Navigation failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

navigateQuestions();