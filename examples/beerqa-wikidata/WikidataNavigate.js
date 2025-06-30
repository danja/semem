#!/usr/bin/env node

/**
 * WikidataNavigate.js - Enhanced ZPT navigation with Wikidata integration
 * 
 * This script extends the BeerQA navigation workflow by incorporating Wikidata
 * entities into the corpus for enhanced semantic navigation. It combines local
 * Wikipedia knowledge with global Wikidata entities to create richer navigation
 * contexts and more comprehensive relationship discovery.
 * 
 * Key Features:
 * - Integrates Wikidata entities into navigation corpus
 * - Creates cross-references between local and global knowledge
 * - Enhanced ZPT navigation with expanded entity relationships
 * - Maintains compatibility with existing BeerQA workflow patterns
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';
import WikidataResearch from './WikidataResearch.js';
import SPARQLHelper from './SPARQLHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('         🌐 ENHANCED WIKIDATA ZPT NAVIGATION              ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('  Semantic navigation with Wikipedia + Wikidata integration  ') + chalk.bold.blue('║'));
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
    console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(config.similarityThreshold)}`);
    console.log(`   ${chalk.cyan('Max Related Corpuscles:')} ${chalk.white(config.maxRelatedCorpuscles)}`);
    console.log(`   ${chalk.cyan('Wikidata Enhancement:')} ${chalk.white(config.enableWikidataEnhancement ? 'Enabled' : 'Disabled')}`);
    console.log('');
}

/**
 * Get navigable questions from BeerQA corpus
 */
async function getNavigableQuestions(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Finding questions with embeddings...'));

    const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText WHERE {
    GRAPH <${beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        # Look for any embedding format
        OPTIONAL {
            ?question ragno:hasAttribute ?embedding .
            { ?embedding a ragno:VectorEmbedding } UNION 
            { ?embedding ragno:attributeType "vector-embedding" }
        }
    }
}
ORDER BY ?questionText
LIMIT 10`;

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        throw new Error(`Failed to retrieve questions: ${result.error}`);
    }

    const questions = result.data.results.bindings.map(binding => ({
        uri: binding.question.value,
        text: binding.questionText.value
    }));

    console.log(chalk.green(`   ✓ Found ${questions.length} navigable questions`));
    return questions;
}

/**
 * Get enhanced navigation corpus including Wikipedia and Wikidata entities
 */
async function getEnhancedNavigationCorpus(sparqlHelper, config) {
    console.log(chalk.bold.white('📚 Building enhanced navigation corpus...'));

    // Get Wikipedia corpus (using ragno:Corpuscle from BeerQA workflow)
    const wikipediaQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label ?content WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL { ?entity ragno:content ?content }
    }
}
LIMIT 500`;

    const wikipediaResult = await sparqlHelper.executeSelect(wikipediaQuery);
    const wikipediaEntities = wikipediaResult.success ? 
        wikipediaResult.data.results.bindings.map(binding => ({
            uri: binding.entity.value,
            label: binding.label.value,
            content: binding.content?.value || '',
            source: 'wikipedia',
            type: 'entity'
        })) : [];

    // Get Wikidata corpus if available
    let wikidataEntities = [];
    if (config.enableWikidataEnhancement) {
        const wikidataQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label ?wikidataId WHERE {
    GRAPH <${config.wikidataGraphURI}> {
        ?entity a ragno:Entity ;
               rdfs:label ?label ;
               ragno:hasAttribute ?embedding .
        
        ?embedding a ragno:VectorEmbedding .
        
        OPTIONAL { ?entity ragno:wikidataId ?wikidataId }
    }
}
LIMIT 200`;

        const wikidataResult = await sparqlHelper.executeSelect(wikidataQuery);
        wikidataEntities = wikidataResult.success ?
            wikidataResult.data.results.bindings.map(binding => ({
                uri: binding.entity.value,
                label: binding.label.value,
                wikidataId: binding.wikidataId?.value || '',
                source: 'wikidata',
                type: 'entity'
            })) : [];
    }

    const totalCorpus = [...wikipediaEntities, ...wikidataEntities];

    console.log(chalk.green(`   ✓ Wikipedia entities: ${wikipediaEntities.length}`));
    console.log(chalk.green(`   ✓ Wikidata entities: ${wikidataEntities.length}`));
    console.log(chalk.green(`   ✓ Total corpus size: ${totalCorpus.length}`));

    return totalCorpus;
}

/**
 * Initialize embedding handler for similarity calculations
 */
async function initializeEmbeddingHandler() {
    try {
        console.log(chalk.bold.white('🔧 Initializing embedding handler...'));
        
        const connector = new OllamaConnector({
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        });

        // Initialize cache manager with proper configuration
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        const embeddingHandler = new EmbeddingHandler(connector, { cacheManager });

        console.log(chalk.green('   ✓ Embedding handler initialized'));
        return embeddingHandler;
    } catch (error) {
        logger.warn('Failed to initialize embedding handler:', error.message);
        logger.debug('Embedding handler error details:', error.stack);
        return null;
    }
}

/**
 * Perform Wikidata research for a question to enhance the corpus
 */
async function performWikidataResearch(question, wikidataResearch) {
    console.log(chalk.bold.white(`🌐 Enhancing with Wikidata research...`));

    try {
        const researchResult = await wikidataResearch.executeResearch(question.text, {
            includeWikipediaContext: false, // Skip cross-refs for navigation
            storeResults: true
        });

        if (researchResult.success) {
            console.log(chalk.green(`   ✓ Found ${researchResult.wikidataEntities?.length || 0} new Wikidata entities`));
            console.log(chalk.green(`   ✓ Extracted ${researchResult.concepts?.length || 0} concepts`));
            
            return {
                entities: researchResult.ragnoEntities || [],
                concepts: researchResult.concepts || []
            };
        } else {
            logger.warn('Wikidata research failed:', researchResult.error);
            return { entities: [], concepts: [] };
        }
    } catch (error) {
        logger.warn('Wikidata research error:', error.message);
        return { entities: [], concepts: [] };
    }
}

/**
 * Find related entities using enhanced semantic similarity
 */
async function findRelatedEntitiesEnhanced(questionURI, corpus, embeddingHandler, config) {
    console.log(chalk.bold.white('🔍 Finding related entities with enhanced similarity...'));

    if (!embeddingHandler) {
        logger.warn('No embedding handler available, using basic corpus selection');
        return corpus.slice(0, config.maxRelatedCorpuscles);
    }

    try {
        // Get question embedding
        const questionQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?questionText WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        <${questionURI}> rdfs:label ?questionText .
    }
}`;

        const questionResult = await sparqlHelper.executeSelect(questionQuery);
        if (!questionResult.success || !questionResult.data.results.bindings.length) {
            return corpus.slice(0, config.maxRelatedCorpuscles);
        }

        const questionText = questionResult.data.results.bindings[0].questionText.value;
        
        // Generate embedding for question
        const questionEmbedding = await embeddingHandler.generateEmbedding(questionText);
        
        if (!questionEmbedding) {
            return corpus.slice(0, config.maxRelatedCorpuscles);
        }

        // Calculate similarities with corpus entities
        const similarities = [];
        
        for (const entity of corpus) {
            try {
                const entityText = entity.content || entity.label || '';
                if (entityText.length < 10) continue; // Skip very short content
                
                const entityEmbedding = await embeddingHandler.generateEmbedding(entityText);
                
                if (entityEmbedding) {
                    const similarity = embeddingHandler.calculateCosineSimilarity(questionEmbedding, entityEmbedding);
                    
                    if (similarity >= config.similarityThreshold) {
                        similarities.push({
                            entity,
                            similarity,
                            text: entityText.substring(0, 100) + '...'
                        });
                    }
                }
                
                // Add small delay to avoid overwhelming the embedding service
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                logger.debug(`Similarity calculation failed for ${entity.uri}:`, error.message);
            }
        }

        // Sort by similarity and take top results
        similarities.sort((a, b) => b.similarity - a.similarity);
        const topSimilarities = similarities.slice(0, config.maxRelatedCorpuscles);

        console.log(chalk.green(`   ✓ Found ${topSimilarities.length} related entities above threshold ${config.similarityThreshold}`));
        
        return topSimilarities.map(item => ({
            ...item.entity,
            similarity: item.similarity
        }));

    } catch (error) {
        logger.warn('Enhanced similarity calculation failed:', error.message);
        return corpus.slice(0, config.maxRelatedCorpuscles);
    }
}

/**
 * Create enhanced relationships with source attribution
 */
async function createEnhancedRelationships(sparqlHelper, questionURI, relatedEntities, config) {
    console.log(chalk.bold.white('🔗 Creating enhanced entity relationships...'));

    const relationships = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < relatedEntities.length; i++) {
        const entity = relatedEntities[i];
        const relationshipURI = `${questionURI}/wikidata-relationship/${Date.now()}_${i}`;
        
        const relationshipType = entity.source === 'wikidata' ? 
            'wikidata-semantic-similarity' : 
            'wikipedia-semantic-similarity';

        const weight = entity.similarity || (0.8 - (i * 0.1)); // Decrease weight by rank
        
        const description = `Enhanced ${entity.source} relationship: ${entity.label}`;

        // Create relationship triples
        const relationshipTriples = [
            `<${relationshipURI}> rdf:type ragno:Relationship .`,
            `<${relationshipURI}> ragno:hasSourceEntity <${questionURI}> .`,
            `<${relationshipURI}> ragno:hasTargetEntity <${entity.uri}> .`,
            `<${relationshipURI}> ragno:relationshipType "${relationshipType}" .`,
            `<${relationshipURI}> ragno:weight "${weight}"^^xsd:float .`,
            `<${relationshipURI}> ragno:description "${description}" .`,
            `<${relationshipURI}> ragno:sourceCorpus "${entity.source}" .`,
            `<${relationshipURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`,
            `<${relationshipURI}> prov:wasGeneratedBy "wikidata-enhanced-navigation" .`
        ];

        if (entity.similarity) {
            relationshipTriples.push(`<${relationshipURI}> ragno:similarity "${entity.similarity}"^^xsd:float .`);
        }

        relationships.push({
            uri: relationshipURI,
            triples: relationshipTriples,
            weight: weight,
            source: entity.source
        });
    }

    // Store relationships in navigation graph
    if (relationships.length > 0) {
        const allTriples = relationships.flatMap(rel => rel.triples);
        const insertQuery = sparqlHelper.createInsertDataQuery(
            config.navigationGraphURI,
            allTriples.join('\n        ')
        );

        const result = await sparqlHelper.executeUpdate(insertQuery);
        
        if (result.success) {
            console.log(chalk.green(`   ✓ Created ${relationships.length} enhanced relationships`));
        } else {
            logger.error('Failed to store relationships:', result.error);
        }
    }

    return relationships;
}

/**
 * Process a single question through enhanced ZPT navigation
 */
async function processEnhancedQuestionNavigation(sparqlHelper, config, question, corpus, embeddingHandler, wikidataResearch) {
    console.log(chalk.bold.blue(`🧭 Navigating: "${question.text}"`));

    try {
        // Step 1: Perform Wikidata research to enhance corpus
        let enhancedCorpus = [...corpus];
        let researchData = { entities: [], concepts: [] };
        
        if (config.enableWikidataEnhancement) {
            console.log(chalk.white(`   🔍 Performing Wikidata research for: "${question.text}"`));
            researchData = await performWikidataResearch(question, wikidataResearch);
            
            console.log(chalk.white(`   📊 Wikidata research results: ${researchData.entities.length} entities, ${researchData.concepts.length} concepts`));
            
            // Add new Wikidata entities to corpus
            const newEntities = researchData.entities.map(entity => ({
                uri: entity.entityURI,
                label: entity.originalEntity?.label || 'Unknown',
                content: entity.originalEntity?.description || '',
                source: 'wikidata-fresh',
                type: 'entity'
            }));
            
            enhancedCorpus = [...corpus, ...newEntities];
            console.log(chalk.white(`   ✓ Enhanced corpus: ${corpus.length} Wikipedia + ${newEntities.length} Wikidata = ${enhancedCorpus.length} total`));
        }

        // Step 2: Find related entities using enhanced similarity
        const relatedEntities = await findRelatedEntitiesEnhanced(
            question.uri, 
            enhancedCorpus, 
            embeddingHandler, 
            config
        );

        // Step 3: Create enhanced relationships
        const relationships = await createEnhancedRelationships(
            sparqlHelper, 
            question.uri, 
            relatedEntities, 
            config
        );

        // Summary statistics
        const wikidataCount = relatedEntities.filter(e => e.source?.includes('wikidata')).length;
        const wikipediaCount = relatedEntities.filter(e => e.source === 'wikipedia').length;
        
        console.log(chalk.green(`   ✓ Navigation completed:`));
        console.log(chalk.green(`     - Related entities: ${relatedEntities.length}`));
        console.log(chalk.green(`     - Wikipedia sources: ${wikipediaCount}`));
        console.log(chalk.green(`     - Wikidata sources: ${wikidataCount}`));
        console.log(chalk.green(`     - Fresh concepts: ${researchData.concepts.length}`));
        console.log('');

        return {
            success: true,
            question: question,
            relatedEntities: relatedEntities,
            relationships: relationships,
            researchData: researchData,
            stats: {
                totalRelated: relatedEntities.length,
                wikipediaCount: wikipediaCount,
                wikidataCount: wikidataCount,
                conceptsFound: researchData.concepts.length
            }
        };

    } catch (error) {
        console.log(chalk.red(`   ❌ Navigation failed: ${error.message}`));
        
        return {
            success: false,
            question: question,
            error: error.message,
            stats: {
                totalRelated: 0,
                wikipediaCount: 0,
                wikidataCount: 0,
                conceptsFound: 0
            }
        };
    }
}

/**
 * Display navigation summary
 */
function displaySummary(results) {
    console.log(chalk.bold.yellow('📊 Enhanced Navigation Summary:'));
    console.log('');

    const totalQuestions = results.length;
    const successfulNavigations = results.filter(r => r.success).length;
    const totalRelated = results.reduce((sum, r) => sum + (r.stats?.totalRelated || 0), 0);
    const totalWikipedia = results.reduce((sum, r) => sum + (r.stats?.wikipediaCount || 0), 0);
    const totalWikidata = results.reduce((sum, r) => sum + (r.stats?.wikidataCount || 0), 0);
    const totalConcepts = results.reduce((sum, r) => sum + (r.stats?.conceptsFound || 0), 0);

    console.log(chalk.cyan(`   Questions processed: ${totalQuestions}`));
    console.log(chalk.cyan(`   Successful navigations: ${successfulNavigations}`));
    console.log(chalk.cyan(`   Total related entities: ${totalRelated}`));
    console.log(chalk.cyan(`   Wikipedia sources: ${totalWikipedia}`));
    console.log(chalk.cyan(`   Wikidata sources: ${totalWikidata}`));
    console.log(chalk.cyan(`   Fresh concepts discovered: ${totalConcepts}`));
    console.log('');

    // Show top performing questions
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
        console.log(chalk.bold.yellow('🏆 Top Navigation Results:'));
        successfulResults
            .sort((a, b) => (b.stats?.totalRelated || 0) - (a.stats?.totalRelated || 0))
            .slice(0, 3)
            .forEach((result, i) => {
                console.log(chalk.white(`   ${i + 1}. "${result.question.text}"`));
                console.log(chalk.gray(`      Related: ${result.stats.totalRelated}, Wikidata: ${result.stats.wikidataCount}, Concepts: ${result.stats.conceptsFound}`));
            });
        console.log('');
    }
}

/**
 * Main enhanced navigation function
 */
async function navigateQuestionsEnhanced() {
    displayHeader();
    
    try {
        // Load Config.js for proper SPARQL configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        const configObj = new Config(configPath);
        await configObj.init();
        const storageOptions = configObj.get('storage.options');
        
        // Configuration using Config.js with Wikidata enhancements
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
            similarityThreshold: 0.3,
            maxRelatedCorpuscles: 8, // Increased for enhanced corpus
            enableWikidataEnhancement: true,
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
        
        // Initialize Wikidata research
        const wikidataResearch = new WikidataResearch();
        await wikidataResearch.initialize();
        
        // Get navigable questions
        const questions = await getNavigableQuestions(sparqlHelper, config.beerqaGraphURI);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No navigable questions found. Run AugmentQuestion.js first.'));
            return;
        }
        
        // Load enhanced navigation corpus
        const corpus = await getEnhancedNavigationCorpus(sparqlHelper, config);
        
        if (corpus.length === 0) {
            console.log(chalk.yellow('⚠️  No navigation corpus found. Ensure BeerQA and Wikipedia data is loaded.'));
            return;
        }
        
        console.log(chalk.bold.white('🧭 Starting enhanced ZPT navigation...'));
        console.log('');
        
        // Process each question through enhanced navigation
        const allResults = [];
        
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            console.log(chalk.bold.blue(`Question ${i + 1}/${questions.length}:`));
            
            const result = await processEnhancedQuestionNavigation(
                sparqlHelper,
                config,
                question,
                corpus,
                embeddingHandler,
                wikidataResearch
            );
            
            allResults.push(result);
        }
        
        displaySummary(allResults);
        console.log(chalk.green('🎉 Enhanced navigation completed successfully!'));
        
        // Cleanup
        await wikidataResearch.cleanup();
        
    } catch (error) {
        console.log(chalk.red('❌ Enhanced navigation failed:', error.message));
        if (error.stack) {
            logger.debug('Stack trace:', error.stack);
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    navigateQuestionsEnhanced();
}