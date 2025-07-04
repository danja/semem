#!/usr/bin/env node

/**
 * Document QA Stage 3: Retrieve Context
 * 
 * Retrieves relevant document chunks for each processed question using
 * semantic similarity, keyword matching, and document structure analysis.
 * 
 * Usage: node examples/document-qa/03-retrieve-context.js [--limit N] [--threshold T]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('        🔍 DOCUMENT QA STAGE 3: RETRIEVE CONTEXT             ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('      Find relevant document chunks for each question         ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        threshold: 0.1,
        maxChunks: 5,
        maxChunksBatch: 1000, // Maximum chunks to process in one batch
        namespace: 'http://example.org/docqa/'
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--threshold':
                options.threshold = parseFloat(args[++i]);
                break;
            case '--max-chunks-batch':
                options.maxChunksBatch = parseInt(args[++i], 10);
                break;
            case '--max-chunks':
                options.maxChunks = parseInt(args[++i], 10);
                break;
            case '--namespace':
                options.namespace = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 03-retrieve-context.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N           Limit number of questions to process');
                console.log('  --threshold T       Similarity threshold for chunk retrieval (default: 0.1)');
                console.log('  --max-chunks N      Maximum chunks per question (default: 5)');
                console.log('  --namespace URI     Base namespace for URIs');
                console.log('  --help, -h          Show this help');
                console.log('');
                console.log(chalk.white('Examples:'));
                console.log('  node 03-retrieve-context.js --max-chunks 3 --threshold 0.2');
                console.log('  node 03-retrieve-context.js --limit 5');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize embedding handler for similarity calculations
 */
async function initializeEmbeddingHandler(config) {
    console.log(chalk.cyan('🔧 Initializing embedding handler...'));

    try {
        // Use the correct pattern from AugmentQuestion.js
        const embeddingConnector = await EmbeddingConnectorFactory.createConnector(config);
        const dimension = config.get('memory.dimension') || 768;  // Nomic model uses 768 dimensions
        
        // Get embedding model from config
        const llmProviders = config.get('llmProviders') || [];
        const embeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
        
        const embeddingModel = embeddingProvider?.embeddingModel || 'nomic-embed-text';
        
        console.log(chalk.white(`   🎯 Selected provider: ${embeddingProvider?.type || 'ollama'}`));
        console.log(chalk.white(`   📏 Embedding dimensions: ${dimension}`));
        console.log(chalk.white(`   🤖 Model: ${embeddingModel}`));

        const embeddingHandler = new EmbeddingHandler(
            embeddingConnector,
            embeddingModel,
            dimension
        );
        
        console.log(chalk.green(`   ✅ Embedding handler initialized successfully`));
        return embeddingHandler;
        
    } catch (error) {
        console.error(chalk.red(`   ❌ Failed to initialize embedding handler: ${error.message}`));
        throw error;
    }
}

/**
 * Retrieve processed questions from SPARQL store
 */
async function retrieveProcessedQuestions(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving processed questions...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?label ?content ?embedding
WHERE {
    GRAPH <${config.graphName}> {
        ?question a ragno:Corpuscle ;
                 ragno:corpuscleType "question" ;
                 rdfs:label ?label ;
                 ragno:content ?content ;
                 ragno:processingStage "processed" .
        
        # Get embedding
        ?question ragno:hasAttribute ?embeddingAttr .
        ?embeddingAttr ragno:attributeType "embedding" ;
                      ragno:attributeValue ?embedding .
        
        # Only get questions that haven't had context retrieved yet
        MINUS {
            ?question ragno:hasAttribute ?attr .
            ?attr ragno:attributeType "flow-stage" ;
                 ragno:attributeValue "03-retrieve-context" .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const questions = result.data.results.bindings.map(binding => ({
            uri: binding.question.value,
            label: binding.label.value,
            content: binding.content.value,
            embedding: JSON.parse(binding.embedding.value)
        }));
        
        console.log(chalk.green(`   ✓ Found ${questions.length} processed questions`));
        return questions;
    } else {
        console.log(chalk.yellow('   ⚠️  No processed questions found'));
        return [];
    }
}

/**
 * Retrieve document chunks from SPARQL store with performance optimizations
 */
async function retrieveDocumentChunks(sparqlHelper, config, maxChunksBatch = 1000) {
    console.log(chalk.cyan('📄 Retrieving document chunks...'));
    
    // First, get a count of available chunks
    const countQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT (COUNT(?chunk) as ?totalChunks)
WHERE {
    GRAPH <${config.graphName}> {
        ?chunk a ragno:Element ;
              ragno:embedding ?embedding .
        
        FILTER(EXISTS { ?chunk ragno:index ?anyIndex })
        FILTER(?embedding != "[]")
    }
}`;

    const countResult = await sparqlHelper.executeSelect(countQuery);
    const totalChunks = countResult.success && countResult.data.results.bindings.length > 0 
        ? parseInt(countResult.data.results.bindings[0].totalChunks.value) 
        : 0;
    
    console.log(chalk.white(`   📊 Found ${totalChunks} total chunks with embeddings`));
    
    if (totalChunks === 0) {
        return [];
    }
    
    // For large datasets, apply smart filtering and batching
    let limit = '';
    if (totalChunks > maxChunksBatch) {
        console.log(chalk.yellow(`   ⚡ Large dataset detected (${totalChunks} chunks). Applying performance optimizations...`));
        console.log(chalk.white(`   📦 Processing in batches of ${maxChunksBatch} chunks`));
        limit = `LIMIT ${maxChunksBatch}`;
    }
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?chunk ?content ?title ?embedding ?sourceUri ?size ?index
WHERE {
    GRAPH <${config.graphName}> {
        ?chunk a ragno:Element ;
              ragno:content ?content ;
              skos:prefLabel ?title ;
              ragno:embedding ?embedding .
        
        # Extract metadata from stored chunks
        OPTIONAL { ?chunk ragno:size ?size }
        OPTIONAL { ?chunk ragno:index ?index }
        OPTIONAL { ?chunk ragno:sourceUri ?sourceUri }
        OPTIONAL { ?chunk ragno:sourceFile ?sourceFile }
        
        # Filter for document chunks (those with metadata indicating they're chunks)
        FILTER(EXISTS { ?chunk ragno:index ?anyIndex })
        
        # Only chunks with non-empty embeddings (pre-computed during ingestion)
        FILTER(?embedding != "[]")
    }
}
ORDER BY ?sourceUri ?index
${limit}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const chunks = result.data.results.bindings.map(binding => {
            let embedding = [];
            try {
                embedding = JSON.parse(binding.embedding.value);
            } catch (error) {
                console.warn(chalk.yellow(`      ⚠️  Failed to parse embedding for chunk ${binding.chunk.value}`));
            }
            
            return {
                uri: binding.chunk.value,
                content: binding.content.value,
                title: binding.title.value,
                embedding: embedding,
                sourceUri: binding.sourceUri?.value,
                size: parseInt(binding.size.value),
                index: parseInt(binding.index.value)
            };
        });
        
        console.log(chalk.green(`   ✓ Found ${chunks.length} document chunks`));
        return chunks;
    } else {
        console.log(chalk.yellow('   ⚠️  No document chunks found'));
        return [];
    }
}

/**
 * Calculate semantic similarity between question and chunk
 */
function calculateCosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimensionality');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Calculate keyword matching score
 */
function calculateKeywordScore(questionContent, chunkContent) {
    const questionWords = questionContent.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3);
    
    const chunkWords = chunkContent.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3);
    
    const chunkWordSet = new Set(chunkWords);
    const matches = questionWords.filter(word => chunkWordSet.has(word));
    
    return questionWords.length > 0 ? matches.length / questionWords.length : 0;
}

/**
 * Find relevant chunks for a question using pre-computed embeddings
 */
async function findRelevantChunks(question, chunks, embeddingHandler, options) {
    console.log(chalk.white(`   Finding context for: "${question.content.substring(0, 50)}..."`));
    console.log(chalk.white(`   Processing ${chunks.length} chunks with pre-computed embeddings...`));
    
    const relevantChunks = [];
    
    for (const chunk of chunks) {
        try {
            // Use pre-computed embedding from SPARQL store
            const chunkEmbedding = chunk.embedding;
            
            // Skip chunks without valid embeddings
            if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
                console.warn(chalk.yellow(`      ⚠️  Chunk ${chunk.index} has no valid embedding, skipping`));
                continue;
            }
            
            // Calculate semantic similarity using pre-computed embeddings
            const semanticScore = calculateCosineSimilarity(question.embedding, chunkEmbedding);
            
            // Calculate keyword matching score
            const keywordScore = calculateKeywordScore(question.content, chunk.content);
            
            // Combined relevance score (weighted)
            const relevanceScore = (semanticScore * 0.7) + (keywordScore * 0.3);
            
            if (relevanceScore >= options.threshold) {
                relevantChunks.push({
                    ...chunk,
                    semanticScore,
                    keywordScore,
                    relevanceScore
                });
            }
            
        } catch (error) {
            console.warn(chalk.yellow(`      ⚠️  Error processing chunk ${chunk.index}: ${error.message}`));
        }
    }
    
    // Sort by relevance score and limit results
    relevantChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topChunks = relevantChunks.slice(0, options.maxChunks);
    
    console.log(chalk.white(`      ✓ Found ${topChunks.length} relevant chunks (threshold: ${options.threshold})`));
    
    if (topChunks.length > 0) {
        const avgScore = topChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / topChunks.length;
        console.log(chalk.white(`      📊 Average relevance: ${avgScore.toFixed(3)}`));
    }
    
    return topChunks;
}

/**
 * Store context retrieval results
 */
async function storeContextResults(question, relevantChunks, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const triples = [];
    
    // Context retrieval attribute
    const contextAttrUri = `${question.uri}/attr/context_retrieval`;
    triples.push(`<${question.uri}> ragno:hasAttribute <${contextAttrUri}> .`);
    triples.push(`<${contextAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "context-retrieval" ;`);
    triples.push(`    ragno:chunksFound ${relevantChunks.length} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Store reference to each relevant chunk
    relevantChunks.forEach((chunk, index) => {
        const chunkRefAttrUri = `${question.uri}/attr/relevant_chunk_${index}`;
        triples.push(`<${question.uri}> ragno:hasAttribute <${chunkRefAttrUri}> .`);
        triples.push(`<${chunkRefAttrUri}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "relevant-chunk" ;`);
        triples.push(`    ragno:attributeValue "${chunk.uri}" ;`);
        triples.push(`    ragno:relevanceScore ${chunk.relevanceScore.toFixed(6)} ;`);
        triples.push(`    ragno:semanticScore ${chunk.semanticScore.toFixed(6)} ;`);
        triples.push(`    ragno:keywordScore ${chunk.keywordScore.toFixed(6)} ;`);
        triples.push(`    ragno:chunkIndex ${index} ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    });
    
    // Flow stage tracking
    const flowAttrUri = `${question.uri}/attr/flow_stage_03`;
    triples.push(`<${question.uri}> ragno:hasAttribute <${flowAttrUri}> .`);
    triples.push(`<${flowAttrUri}> a ragno:Attribute ;`);
    triples.push(`    ragno:attributeType "flow-stage" ;`);
    triples.push(`    ragno:attributeValue "03-retrieve-context" ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Update processing stage
    triples.push(`<${question.uri}> ragno:processingStage "context-retrieved" .`);
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.graphName}> {
        ${triples.join('\n        ')}
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`SPARQL storage failed: ${result.error}`);
    }
}

/**
 * Process context retrieval for all questions
 */
async function processContextRetrieval(questions, chunks, embeddingHandler, sparqlHelper, config, options) {
    console.log(chalk.cyan('🔍 Processing context retrieval...'));
    
    const retrievalStats = {
        questionsProcessed: 0,
        totalChunksFound: 0,
        averageRelevance: 0,
        errors: 0
    };
    
    let totalRelevanceSum = 0;
    let totalChunksCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${questions.length}: "${question.content.substring(0, 50)}..."`));
        
        try {
            // Find relevant chunks
            const relevantChunks = await findRelevantChunks(question, chunks, embeddingHandler, options);
            
            // Store results
            await storeContextResults(question, relevantChunks, sparqlHelper, config);
            
            // Update statistics
            retrievalStats.questionsProcessed++;
            retrievalStats.totalChunksFound += relevantChunks.length;
            
            if (relevantChunks.length > 0) {
                const avgRelevance = relevantChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / relevantChunks.length;
                totalRelevanceSum += avgRelevance;
                totalChunksCount++;
            }
            
            console.log(chalk.green(`      ✅ Stored context for question: ${question.uri}`));
            
        } catch (error) {
            console.error(chalk.red(`      ❌ Failed to process question: ${error.message}`));
            retrievalStats.errors++;
        }
    }
    
    // Calculate overall average relevance
    if (totalChunksCount > 0) {
        retrievalStats.averageRelevance = totalRelevanceSum / totalChunksCount;
    }
    
    return retrievalStats;
}

/**
 * Display completion summary
 */
function displaySummary(stats, duration, options) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 3 Completion Summary:'));
    console.log(chalk.white(`   Questions processed: ${stats.questionsProcessed}`));
    console.log(chalk.white(`   Total chunks found: ${stats.totalChunksFound}`));
    if (stats.questionsProcessed > 0) {
        console.log(chalk.white(`   Average chunks per question: ${Math.round(stats.totalChunksFound / stats.questionsProcessed)}`));
    }
    if (stats.averageRelevance > 0) {
        console.log(chalk.white(`   Average relevance score: ${stats.averageRelevance.toFixed(3)}`));
    }
    if (stats.errors > 0) {
        console.log(chalk.red(`   Errors: ${stats.errors}`));
    }
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log(chalk.white(`   Similarity threshold: ${options.threshold}`));
    console.log(chalk.white(`   Max chunks per question: ${options.maxChunks}`));
    console.log('');
    
    if (stats.questionsProcessed > 0) {
        console.log(chalk.gray('Next Step: Stage 4 - Generate answers using retrieved context'));
        console.log(chalk.gray('Command: node examples/document-qa/04-generate-answers.js'));
    }
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();
        
        displayHeader();
        
        const options = parseArgs();
        
        // Initialize configuration
        console.log(chalk.cyan('🔧 Initializing configuration...'));
        const configPath = join(projectRoot, 'config/config.json');
        const config = new Config(configPath);
        await config.init();
        
        config.namespace = options.namespace;
        config.graphName = config.get('storage.options.graphName') || 'http://tensegrity.it/semem';
        
        console.log(chalk.green('   ✓ Configuration loaded'));
        
        // Initialize components
        const embeddingHandler = await initializeEmbeddingHandler(config);
        const sparqlHelper = new SPARQLHelper(
            config.get('storage.options.update') || 'http://localhost:3030/semem/update',
            {
                auth: { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve processed questions
        const questions = await retrieveProcessedQuestions(sparqlHelper, config, options.limit);
        
        if (questions.length === 0) {
            console.log(chalk.yellow('⚠️  No processed questions found'));
            console.log(chalk.gray('Run Stage 2 first: node examples/document-qa/02-process-questions.js'));
            return;
        }
        
        // Retrieve document chunks with performance optimizations
        const chunks = await retrieveDocumentChunks(sparqlHelper, config, options.maxChunksBatch);
        
        if (chunks.length === 0) {
            console.log(chalk.yellow('⚠️  No document chunks found'));
            console.log(chalk.gray('Run Stage 1 first: node examples/document-qa/01-ingest-documents.js'));
            return;
        }
        
        // Process context retrieval
        const stats = await processContextRetrieval(questions, chunks, embeddingHandler, sparqlHelper, config, options);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(stats, duration, options);
        
        if (stats.questionsProcessed > 0) {
            console.log(chalk.bold.green('🎉 Stage 3: Context retrieval completed successfully!'));
        } else {
            console.log(chalk.bold.red('❌ Stage 3: No questions were successfully processed'));
            process.exit(1);
        }
        
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

// Run the stage
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}