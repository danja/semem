#!/usr/bin/env node

/**
 * DiscoverTargets - Discover related Wikipedia targets for BeerQA questions
 * 
 * This script performs similarity search between question corpuscles and Wikipedia corpuscles,
 * matches extracted concepts, and adds related Wikipedia page URIs with ragno:maybeRelated.
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
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
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🎯 BEER QA TARGET DISCOVERY                   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('       Similarity Search & Concept Matching Pipeline       ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(config.similarityThreshold)}`);
    console.log(`   ${chalk.cyan('Max Related Targets:')} ${chalk.white(config.maxRelatedTargets)}`);
    console.log(`   ${chalk.cyan('Concept Match Threshold:')} ${chalk.white(config.conceptMatchThreshold)}`);
    console.log('');
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
}

/**
 * Get question corpuscles with their embeddings and concepts
 */
async function getQuestionCorpuscles(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Retrieving question corpuscles...'));
    
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?questionText ?embedding ?conceptValue ?conceptType ?conceptConfidence
WHERE {
    GRAPH <${beerqaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?questionText .
        
        OPTIONAL { ?corpuscle ragno:embedding ?embedding }
        
        OPTIONAL {
            ?corpuscle ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "concept" ;
                  ragno:attributeValue ?conceptValue .
            
            OPTIONAL { ?attr ragno:attributeConfidence ?conceptConfidence }
            OPTIONAL { ?attr ragno:attributeSubType ?conceptType }
        }
    }
}
ORDER BY ?corpuscle
`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        throw new Error(`Failed to retrieve question corpuscles: ${result.error}`);
    }
    
    // Group results by corpuscle
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
                console.log(chalk.yellow(`⚠️  Invalid embedding for ${corpuscleURI}: ${error.message}`));
            }
            
            corpusclesMap.set(corpuscleURI, {
                uri: corpuscleURI,
                questionText: binding.questionText.value,
                embedding: embedding,
                concepts: []
            });
        }
        
        // Add concept if present
        if (binding.conceptValue) {
            const concept = {
                value: binding.conceptValue.value,
                type: binding.conceptType?.value || 'unknown',
                confidence: binding.conceptConfidence ? parseFloat(binding.conceptConfidence.value) : 0.5
            };
            
            // Avoid duplicates
            const existing = corpusclesMap.get(corpuscleURI).concepts.find(c => 
                c.value === concept.value && c.type === concept.type
            );
            
            if (!existing) {
                corpusclesMap.get(corpuscleURI).concepts.push(concept);
            }
        }
    }
    
    const corpuscles = Array.from(corpusclesMap.values());
    console.log(`   ${chalk.green('✓')} Found ${corpuscles.length} question corpuscles`);
    
    const withEmbeddings = corpuscles.filter(c => c.embedding);
    console.log(`   ${chalk.green('✓')} ${withEmbeddings.length} have valid embeddings`);
    
    const withConcepts = corpuscles.filter(c => c.concepts.length > 0);
    console.log(`   ${chalk.green('✓')} ${withConcepts.length} have extracted concepts`);
    console.log('');
    
    return corpuscles;
}

/**
 * Get Wikipedia corpuscles with their embeddings and metadata
 */
async function getWikipediaCorpuscles(sparqlHelper, wikipediaGraphURI) {
    console.log(chalk.bold.white('📚 Retrieving Wikipedia corpuscles...'));
    
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?title ?snippet ?pageId ?embedding ?wikipediaURL
WHERE {
    GRAPH <${wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasTextElement ?textElement .
        
        ?textElement skos:prefLabel ?title ;
                    ragno:embedding ?embedding .
        
        OPTIONAL { ?textElement ragno:snippet ?snippet }
        OPTIONAL { ?textElement ragno:pageId ?pageId }
        OPTIONAL { ?textElement prov:wasDerivedFrom ?wikipediaURL }
    }
}
ORDER BY ?corpuscle
`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        throw new Error(`Failed to retrieve Wikipedia corpuscles: ${result.error}`);
    }
    
    const corpuscles = [];
    
    for (const binding of result.data.results.bindings) {
        let embedding = null;
        try {
            if (binding.embedding) {
                embedding = JSON.parse(binding.embedding.value);
                if (!Array.isArray(embedding) || embedding.length !== 1536) {
                    embedding = null;
                }
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Invalid embedding for ${binding.corpuscle.value}: ${error.message}`));
            continue;
        }
        
        if (embedding) {
            corpuscles.push({
                uri: binding.corpuscle.value,
                title: binding.title.value,
                snippet: binding.snippet?.value || '',
                pageId: binding.pageId?.value || '',
                embedding: embedding,
                wikipediaURL: binding.wikipediaURL?.value || ''
            });
        }
    }
    
    console.log(`   ${chalk.green('✓')} Found ${corpuscles.length} Wikipedia corpuscles with embeddings`);
    console.log('');
    
    return corpuscles;
}

/**
 * Get concepts from Wikipedia corpuscles for concept matching
 */
async function getWikipediaConcepts(sparqlHelper, wikipediaGraphURI) {
    console.log(chalk.bold.white('🧠 Retrieving Wikipedia concepts...'));
    
    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?conceptValue ?conceptType ?conceptConfidence
WHERE {
    GRAPH <${wikipediaGraphURI}> {
        ?corpuscle a ragno:Corpuscle ;
                  ragno:hasAttribute ?attr .
        
        ?attr ragno:attributeType "concept" ;
              ragno:attributeValue ?conceptValue .
        
        OPTIONAL { ?attr ragno:attributeConfidence ?conceptConfidence }
        OPTIONAL { ?attr ragno:attributeSubType ?conceptType }
    }
}
ORDER BY ?corpuscle ?conceptValue
`;

    const result = await sparqlHelper.executeSelect(query);
    
    if (!result.success) {
        console.log(chalk.yellow(`⚠️  Failed to retrieve Wikipedia concepts: ${result.error}`));
        return new Map();
    }
    
    // Group concepts by corpuscle
    const conceptsMap = new Map();
    
    for (const binding of result.data.results.bindings) {
        const corpuscleURI = binding.corpuscle.value;
        
        if (!conceptsMap.has(corpuscleURI)) {
            conceptsMap.set(corpuscleURI, []);
        }
        
        conceptsMap.get(corpuscleURI).push({
            value: binding.conceptValue.value,
            type: binding.conceptType?.value || 'unknown',
            confidence: binding.conceptConfidence ? parseFloat(binding.conceptConfidence.value) : 0.5
        });
    }
    
    console.log(`   ${chalk.green('✓')} Found concepts for ${conceptsMap.size} Wikipedia corpuscles`);
    console.log('');
    
    return conceptsMap;
}

/**
 * Find similar Wikipedia corpuscles using embedding similarity
 */
function findSimilarCorpuscles(questionCorpuscle, wikipediaCorpuscles, threshold = 0.7, maxResults = 10) {
    if (!questionCorpuscle.embedding) {
        return [];
    }
    
    const similarities = [];
    
    for (const wikiCorpuscle of wikipediaCorpuscles) {
        const similarity = cosineSimilarity(questionCorpuscle.embedding, wikiCorpuscle.embedding);
        
        if (similarity >= threshold) {
            similarities.push({
                corpuscle: wikiCorpuscle,
                similarity: similarity
            });
        }
    }
    
    // Sort by similarity descending and return top results
    return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);
}

/**
 * Find Wikipedia corpuscles with matching concepts
 */
function findMatchingConcepts(questionCorpuscle, wikipediaConcepts, threshold = 0.8) {
    if (questionCorpuscle.concepts.length === 0) {
        return [];
    }
    
    const matches = [];
    
    for (const [corpuscleURI, wikiConceptList] of wikipediaConcepts.entries()) {
        let bestMatch = 0;
        let matchedConcepts = [];
        
        for (const questionConcept of questionCorpuscle.concepts) {
            for (const wikiConcept of wikiConceptList) {
                // Exact match
                if (questionConcept.value.toLowerCase() === wikiConcept.value.toLowerCase()) {
                    bestMatch = Math.max(bestMatch, 1.0);
                    matchedConcepts.push({
                        question: questionConcept,
                        wikipedia: wikiConcept,
                        matchType: 'exact'
                    });
                }
                // Partial match (one contains the other)
                else if (questionConcept.value.toLowerCase().includes(wikiConcept.value.toLowerCase()) ||
                         wikiConcept.value.toLowerCase().includes(questionConcept.value.toLowerCase())) {
                    bestMatch = Math.max(bestMatch, 0.8);
                    matchedConcepts.push({
                        question: questionConcept,
                        wikipedia: wikiConcept,
                        matchType: 'partial'
                    });
                }
            }
        }
        
        if (bestMatch >= threshold) {
            matches.push({
                corpuscleURI: corpuscleURI,
                matchScore: bestMatch,
                matchedConcepts: matchedConcepts
            });
        }
    }
    
    // Sort by match score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Add ragno:maybeRelated properties to question corpuscles
 */
async function addRelatedTargets(sparqlHelper, beerqaGraphURI, questionCorpuscleURI, relatedTargets) {
    if (relatedTargets.length === 0) {
        return { success: true, added: 0 };
    }
    
    // First, remove any existing ragno:maybeRelated relationships for this question
    const deleteQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

DELETE {
    GRAPH <${beerqaGraphURI}> {
        <${questionCorpuscleURI}> ragno:maybeRelated ?existing .
    }
}
WHERE {
    GRAPH <${beerqaGraphURI}> {
        <${questionCorpuscleURI}> ragno:maybeRelated ?existing .
    }
}`;
    
    await sparqlHelper.executeUpdate(deleteQuery);
    
    // Add new relationships
    const insertTriples = relatedTargets.map(target => 
        `<${questionCorpuscleURI}> ragno:maybeRelated <${target.uri}> .`
    ).join('\n        ');
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

INSERT DATA {
    GRAPH <${beerqaGraphURI}> {
        ${insertTriples}
    }
}`;
    
    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    return {
        success: result.success,
        added: result.success ? relatedTargets.length : 0,
        error: result.error || null
    };
}

/**
 * Display discovery results for a question
 */
function displayDiscoveryResults(questionCorpuscle, similarTargets, conceptTargets) {
    console.log(chalk.bold.white(`📝 Question: ${questionCorpuscle.questionText.substring(0, 80)}...`));
    console.log(`   ${chalk.cyan('Corpuscle URI:')} ${chalk.dim(questionCorpuscle.uri)}`);
    console.log(`   ${chalk.cyan('Concepts:')} ${chalk.white(questionCorpuscle.concepts.length)}`);
    
    if (similarTargets.length > 0) {
        console.log(`   ${chalk.cyan('Similarity Targets:')} ${chalk.white(similarTargets.length)}`);
        for (let i = 0; i < Math.min(similarTargets.length, 3); i++) {
            const target = similarTargets[i];
            console.log(`      ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(target.corpuscle.title)} (${chalk.green((target.similarity * 100).toFixed(1) + '%')})`);
        }
    }
    
    if (conceptTargets.length > 0) {
        console.log(`   ${chalk.cyan('Concept Targets:')} ${chalk.white(conceptTargets.length)}`);
        for (let i = 0; i < Math.min(conceptTargets.length, 3); i++) {
            const target = conceptTargets[i];
            console.log(`      ${chalk.bold.cyan(`${i + 1}.`)} Corpuscle with ${chalk.green(target.matchedConcepts.length)} concept matches (${chalk.green((target.matchScore * 100).toFixed(1) + '%')})`);
        }
    }
    
    console.log('');
}

/**
 * Display final summary
 */
function displaySummary(results) {
    console.log(chalk.bold.white('📊 Discovery Summary:'));
    console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(results.questionsProcessed)}`);
    console.log(`   ${chalk.cyan('Total Similarity Matches:')} ${chalk.white(results.totalSimilarityMatches)}`);
    console.log(`   ${chalk.cyan('Total Concept Matches:')} ${chalk.white(results.totalConceptMatches)}`);
    console.log(`   ${chalk.cyan('Total Targets Added:')} ${chalk.white(results.totalTargetsAdded)}`);
    console.log(`   ${chalk.cyan('Questions with Targets:')} ${chalk.white(results.questionsWithTargets)}`);
    console.log(`   ${chalk.cyan('Average Targets per Question:')} ${chalk.white((results.totalTargetsAdded / Math.max(results.questionsWithTargets, 1)).toFixed(1))}`);
    console.log('');
}

/**
 * Main target discovery function
 */
async function discoverTargets() {
    displayHeader();
    
    try {
        // Configuration
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            similarityThreshold: 0.7,
            conceptMatchThreshold: 0.8,
            maxRelatedTargets: 10,
            timeout: 30000
        };
        
        displayConfiguration(config);
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(config.sparqlEndpoint, {
            auth: config.sparqlAuth,
            timeout: config.timeout
        });
        
        // Get question corpuscles
        const questionCorpuscles = await getQuestionCorpuscles(sparqlHelper, config.beerqaGraphURI);
        
        if (questionCorpuscles.length === 0) {
            console.log(chalk.yellow('⚠️  No question corpuscles found. Run BeerTestQuestions.js first.'));
            return;
        }
        
        // Get Wikipedia corpuscles
        const wikipediaCorpuscles = await getWikipediaCorpuscles(sparqlHelper, config.wikipediaGraphURI);
        
        if (wikipediaCorpuscles.length === 0) {
            console.log(chalk.yellow('⚠️  No Wikipedia corpuscles found. Run QuestionResearch.js first.'));
            return;
        }
        
        // Get Wikipedia concepts for concept matching
        const wikipediaConcepts = await getWikipediaConcepts(sparqlHelper, config.wikipediaGraphURI);
        
        console.log(chalk.bold.white('🎯 Starting target discovery...'));
        console.log('');
        
        // Process each question corpuscle
        const results = {
            questionsProcessed: 0,
            totalSimilarityMatches: 0,
            totalConceptMatches: 0,
            totalTargetsAdded: 0,
            questionsWithTargets: 0
        };
        
        for (const questionCorpuscle of questionCorpuscles) {
            results.questionsProcessed++;
            
            // Find similar corpuscles using embeddings
            const similarTargets = findSimilarCorpuscles(
                questionCorpuscle, 
                wikipediaCorpuscles, 
                config.similarityThreshold,
                config.maxRelatedTargets
            );
            
            // Find corpuscles with matching concepts
            const conceptTargets = findMatchingConcepts(
                questionCorpuscle,
                wikipediaConcepts,
                config.conceptMatchThreshold
            );
            
            results.totalSimilarityMatches += similarTargets.length;
            results.totalConceptMatches += conceptTargets.length;
            
            // Combine and deduplicate targets
            const allTargets = new Map();
            
            // Add similarity-based targets
            for (const target of similarTargets) {
                allTargets.set(target.corpuscle.uri, {
                    uri: target.corpuscle.uri,
                    title: target.corpuscle.title,
                    source: 'similarity',
                    score: target.similarity
                });
            }
            
            // Add concept-based targets (merge with similarity if already exists)
            for (const target of conceptTargets) {
                if (allTargets.has(target.corpuscleURI)) {
                    // Enhance existing target
                    const existing = allTargets.get(target.corpuscleURI);
                    existing.source = 'both';
                    existing.conceptScore = target.matchScore;
                } else {
                    // Find the Wikipedia corpuscle details
                    const wikiCorpuscle = wikipediaCorpuscles.find(w => w.uri === target.corpuscleURI);
                    if (wikiCorpuscle) {
                        allTargets.set(target.corpuscleURI, {
                            uri: target.corpuscleURI,
                            title: wikiCorpuscle.title,
                            source: 'concept',
                            score: target.matchScore
                        });
                    }
                }
            }
            
            const finalTargets = Array.from(allTargets.values());
            
            // Display results for this question
            displayDiscoveryResults(questionCorpuscle, similarTargets, conceptTargets);
            
            // Add ragno:maybeRelated relationships
            if (finalTargets.length > 0) {
                const addResult = await addRelatedTargets(
                    sparqlHelper,
                    config.beerqaGraphURI,
                    questionCorpuscle.uri,
                    finalTargets
                );
                
                if (addResult.success) {
                    results.totalTargetsAdded += addResult.added;
                    results.questionsWithTargets++;
                    console.log(chalk.green(`   ✓ Added ${addResult.added} related targets`));
                } else {
                    console.log(chalk.red(`   ❌ Failed to add targets: ${addResult.error}`));
                }
            } else {
                console.log(chalk.yellow(`   ⚠️  No related targets found`));
            }
            
            console.log('');
        }
        
        displaySummary(results);
        console.log(chalk.green('🎉 Target discovery completed successfully!'));
        
    } catch (error) {
        console.log(chalk.red('❌ Target discovery failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

discoverTargets();