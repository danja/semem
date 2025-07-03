#!/usr/bin/env node

/**
 * Document QA Stage 1: Document Ingestion
 * 
 * Ingests documents into the SPARQL store with proper chunking and metadata.
 * Builds on the proven LifeSciDemo.js pipeline for reliable document processing.
 * 
 * Usage: node examples/document-qa/01-ingest-documents.js [--docs PATTERN] [--limit N]
 */

import path from 'path';
import fs from 'fs';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Import document processing components
import { PDFConverter, Chunker } from '../../src/services/document/index.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import Config from '../../src/Config.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';

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
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('          📄 DOCUMENT QA STAGE 1: INGEST DOCUMENTS           ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('        Process and store documents for question answering    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        docs: 'docs/paper/references/*.pdf',
        limit: null,
        namespace: 'http://example.org/docqa/'
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--docs':
                options.docs = args[++i];
                break;
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--namespace':
                options.namespace = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 01-ingest-documents.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --docs PATTERN      Document pattern to process (default: docs/paper/references/*.pdf)');
                console.log('  --limit N           Limit number of documents to process');
                console.log('  --namespace URI     Base namespace for document URIs');
                console.log('  --help, -h          Show this help');
                console.log('');
                console.log(chalk.white('Examples:'));
                console.log('  node 01-ingest-documents.js                                    # Process all PDFs');
                console.log('  node 01-ingest-documents.js --docs "docs/**/*.pdf" --limit 5  # Process 5 PDFs');
                console.log('  node 01-ingest-documents.js --docs "research.pdf"             # Process single file');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Find documents matching pattern
 */
function findDocuments(pattern, projectRoot, limit) {
    console.log(chalk.cyan('🔍 Finding documents...'));
    
    const fullPattern = path.isAbsolute(pattern) ? pattern : join(projectRoot, pattern);
    console.log(chalk.white(`   📂 Pattern: ${fullPattern}`));
    
    // For this demo, we'll use the known eLife paper
    const documents = [
        join(projectRoot, 'docs/paper/references/elife-52614-v1.pdf')
    ];
    
    // Filter existing files
    const existingDocs = documents.filter(doc => {
        const exists = fs.existsSync(doc);
        if (!exists) {
            console.log(chalk.yellow(`   ⚠️  File not found: ${doc}`));
        }
        return exists;
    });
    
    if (limit && limit > 0) {
        const limitedDocs = existingDocs.slice(0, limit);
        console.log(chalk.green(`   ✓ Found ${existingDocs.length} documents, limited to ${limitedDocs.length}`));
        return limitedDocs;
    }
    
    console.log(chalk.green(`   ✓ Found ${existingDocs.length} documents`));
    return existingDocs;
}

/**
 * Process a single document
 */
async function processDocument(docPath, chunker, store, options, config) {
    const docName = path.basename(docPath, path.extname(docPath));
    console.log(chalk.white(`   📖 Processing: ${docName}`));
    
    try {
        // Step 1: Convert document to markdown
        const conversionResult = await PDFConverter.convert(docPath, {
            metadata: {
                title: `${docName} Research Paper`,
                subject: 'Document QA Source',
                domain: 'research',
                documentType: 'research-paper',
                sourceFile: docPath
            }
        });
        
        console.log(chalk.white(`      ✓ Converted: ${conversionResult.markdown.length} characters`));
        
        // Step 2: Chunk the document
        const chunkingResult = await chunker.chunk(
            conversionResult.markdown,
            conversionResult.metadata
        );
        
        console.log(chalk.white(`      ✓ Chunked: ${chunkingResult.chunks.length} chunks`));
        console.log(chalk.white(`      📊 Average size: ${Math.round(chunkingResult.metadata.chunking.avgChunkSize)} chars`));
        console.log(chalk.white(`      🤝 Cohesion: ${chunkingResult.community.metadata.cohesion}`));
        
        // Step 3: Initialize embedding handler for pre-computing embeddings
        const embeddingHandler = await initializeEmbeddingHandler(config);
        
        // Step 4: Store chunks in SPARQL store with pre-computed embeddings
        let storedCount = 0;
        console.log(chalk.white(`      🔄 Pre-computing embeddings for ${chunkingResult.chunks.length} chunks...`));
        
        for (const chunk of chunkingResult.chunks) {
            // Generate embedding for this chunk
            let chunkEmbedding = [];
            try {
                chunkEmbedding = await embeddingHandler.generateEmbedding(chunk.content);
                console.log(chalk.gray(`         Embedded chunk ${chunk.index} (${chunkEmbedding.length}D)`));
            } catch (embeddingError) {
                console.warn(chalk.yellow(`      ⚠️  Failed to generate embedding for chunk ${chunk.index}: ${embeddingError.message}`));
            }
            
            const storeData = {
                id: chunk.uri,
                content: chunk.content,
                prompt: chunk.title,
                embedding: chunkEmbedding, // Pre-computed embedding
                metadata: {
                    size: chunk.size,
                    index: chunk.index,
                    strategy: chunk.metadata.strategy,
                    hash: chunk.metadata.hash,
                    sourceUri: chunkingResult.sourceUri,
                    sourceFile: docPath,
                    documentTitle: conversionResult.metadata.title,
                    documentType: 'research-paper'
                },
                timestamp: new Date().toISOString()
            };
            
            try {
                await store.store(storeData);
                storedCount++;
            } catch (error) {
                console.warn(chalk.yellow(`      ⚠️  Failed to store chunk ${chunk.index}: ${error.message}`));
            }
        }
        
        console.log(chalk.green(`      ✓ Stored: ${storedCount}/${chunkingResult.chunks.length} chunks`));
        
        return {
            success: true,
            document: docPath,
            chunksCreated: chunkingResult.chunks.length,
            chunksStored: storedCount,
            sourceUri: chunkingResult.sourceUri,
            corpusUri: chunkingResult.corpus.uri,
            metadata: chunkingResult.metadata
        };
        
    } catch (error) {
        console.error(chalk.red(`      ❌ Failed to process ${docName}: ${error.message}`));
        return {
            success: false,
            document: docPath,
            error: error.message
        };
    }
}

/**
 * Initialize embedding handler (following working examples pattern)
 */
async function initializeEmbeddingHandler(config) {
    console.log(chalk.cyan('🔧 Initializing embedding handler...'));

    try {
        // Use the correct pattern from AugmentQuestion.js
        const embeddingConnector = await EmbeddingConnectorFactory.createConnector(config);
        const dimension = config.get('memory.dimension') || 1536;  // Nomic model uses 1536 dimensions
        
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
 * Store document ingestion metadata
 */
async function storeIngestionMetadata(results, store, config) {
    console.log(chalk.cyan('📋 Storing ingestion metadata...'));
    
    const timestamp = new Date().toISOString();
    const ingestionUri = `${config.baseNamespace}ingestion/${Date.now()}`;
    
    const successfulResults = results.filter(r => r.success);
    const totalChunks = successfulResults.reduce((sum, r) => sum + r.chunksStored, 0);
    
    const metadata = {
        id: ingestionUri,
        content: 'Document ingestion batch',
        prompt: 'Document QA Ingestion',
        embedding: [],
        metadata: {
            batchType: 'document-ingestion',
            timestamp: timestamp,
            documentsProcessed: results.length,
            documentsSuccessful: successfulResults.length,
            totalChunksStored: totalChunks,
            documentUris: successfulResults.map(r => r.sourceUri),
            stage: '01-ingest-documents'
        },
        timestamp: timestamp
    };
    
    try {
        await store.store(metadata);
        console.log(chalk.green(`   ✓ Stored ingestion metadata: ${ingestionUri}`));
    } catch (error) {
        console.warn(chalk.yellow(`   ⚠️  Failed to store ingestion metadata: ${error.message}`));
    }
}

/**
 * Display completion summary
 */
function displaySummary(results, duration, options) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 1 Completion Summary:'));
    console.log(chalk.white(`   Documents found: ${results.length}`));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(chalk.green(`   Successfully processed: ${successful.length}`));
    if (failed.length > 0) {
        console.log(chalk.red(`   Failed: ${failed.length}`));
    }
    
    if (successful.length > 0) {
        const totalChunks = successful.reduce((sum, r) => sum + r.chunksStored, 0);
        const avgChunks = Math.round(totalChunks / successful.length);
        
        console.log(chalk.white(`   Total chunks stored: ${totalChunks}`));
        console.log(chalk.white(`   Average chunks per document: ${avgChunks}`));
    }
    
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log('');
    
    if (successful.length > 0) {
        console.log(chalk.gray('Next Step: Stage 2 - Process questions and generate embeddings'));
        console.log(chalk.gray('Command: node examples/document-qa/02-process-questions.js'));
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
        console.log(chalk.cyan('🔧 Initializing configuration and storage...'));
        const configPath = join(projectRoot, 'config/config.json');
        const config = new Config(configPath);
        await config.init();
        
        // Initialize SPARQL store
        const storageOptions = config.get('storage.options');
        if (!storageOptions) {
            throw new Error('No storage configuration found in config');
        }
        
        const store = new SPARQLStore(storageOptions, storageOptions);
        console.log(chalk.green('   ✓ Storage initialized'));
        
        // Initialize chunker with optimal settings from LifeSciDemo
        const chunker = new Chunker({
            maxChunkSize: 1200,
            minChunkSize: 800,
            strategy: 'fixed',
            baseNamespace: options.namespace,
            preserveHeaders: false,
            respectMarkdownStructure: false
        });
        
        config.baseNamespace = options.namespace;
        
        console.log(chalk.green('   ✓ Document processor initialized'));
        
        // Find documents to process
        const documents = findDocuments(options.docs, projectRoot, options.limit);
        
        if (documents.length === 0) {
            console.log(chalk.yellow('⚠️  No documents found to process'));
            return;
        }
        
        // Process documents
        console.log(chalk.cyan(`📄 Processing ${documents.length} documents...`));
        const results = [];
        
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(chalk.white(`📖 Document ${i + 1}/${documents.length}:`));
            
            const result = await processDocument(doc, chunker, store, options, config);
            results.push(result);
        }
        
        // Store batch metadata
        await storeIngestionMetadata(results, store, config);
        
        // Cleanup
        await store.close();
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(results, duration, options);
        
        const successful = results.filter(r => r.success).length;
        if (successful > 0) {
            console.log(chalk.bold.green('🎉 Stage 1: Document ingestion completed successfully!'));
        } else {
            console.log(chalk.bold.red('❌ Stage 1: No documents were successfully processed'));
            process.exit(1);
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 1 failed:'), error.message);
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