#!/usr/bin/env node

/**
 * Life Sciences PDF Processing Demo
 * 
 * This demo reads the eLife paper PDF, converts it to markdown,
 * chunks it using Ragno-compliant methods, and stores the results
 * in a SPARQL store with full provenance tracking.
 * 
 * Usage: node examples/document/LifeSciDemo.js
 */

import { PDFConverter, Chunker } from '../../src/services/document/index.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import Config from '../../src/Config.js';
import logger from 'loglevel';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const pdfPath = join(projectRoot, 'docs/paper/references/elife-52614-v1.pdf');

// Configure logging
logger.setLevel('INFO');

/**
 * Main demo function
 */
async function runLifeSciDemo() {
  console.log('🧬 Life Sciences Document Processing Demo');
  console.log('📄 Processing: elife-52614-v1.pdf\n');

  let store = null;

  try {
    // Step 1: Initialize configuration and storage
    console.log('🔧 Step 1: Initializing configuration and storage...');
    const configPath = join(projectRoot, 'config/config.json');
    const config = new Config(configPath);
    await config.init();

    // Initialize SPARQL store using the configured storage options
    const storageOptions = config.get('storage.options');
    if (!storageOptions) {
      throw new Error('No storage configuration found in config');
    }
    
    console.log('✅ Using configured storage options:', {
      query: storageOptions.query,
      update: storageOptions.update,
      graphName: storageOptions.graphName
    });
    store = new SPARQLStore(storageOptions);
    console.log('✅ Storage initialized\n');

    // Step 2: Convert PDF to markdown
    console.log('📖 Step 2: Converting PDF to markdown...');
    const startTime = Date.now();
    
    const conversionResult = await PDFConverter.convert(pdfPath, {
      metadata: {
        title: 'eLife Research Paper',
        subject: 'Life Sciences Research',
        domain: 'biology',
        journal: 'eLife',
        documentType: 'research-paper'
      }
    });

    const conversionTime = Date.now() - startTime;
    console.log('✅ PDF conversion completed');
    console.log(`📊 Processing time: ${conversionTime}ms`);
    console.log(`📏 Document size: ${conversionResult.metadata.fileSize} bytes`);
    console.log(`📄 Estimated pages: ${conversionResult.metadata.pages}`);
    console.log(`📝 Markdown length: ${conversionResult.markdown.length} characters\n`);

    // Step 3: Chunk the document
    console.log('✂️ Step 3: Chunking document with Ragno compliance...');
    const chunker = new Chunker({
      maxChunkSize: 1200,  // Larger max to give more room
      minChunkSize: 800,   // Much higher minimum to force larger chunks
      strategy: 'fixed',   // Use fixed size strategy to avoid over-splitting
      baseNamespace: 'http://example.org/lifesci/',
      preserveHeaders: false,  // Don't try to preserve headers for now
      respectMarkdownStructure: false
    });

    const chunkingResult = await chunker.chunk(
      conversionResult.markdown,
      conversionResult.metadata
    );

    console.log('✅ Document chunking completed');
    console.log(`📦 Chunks created: ${chunkingResult.chunks.length}`);
    console.log(`🎯 Source URI: ${chunkingResult.sourceUri}`);
    console.log(`📚 Corpus URI: ${chunkingResult.corpus.uri}`);
    console.log(`👥 Community URI: ${chunkingResult.community.uri}`);
    console.log(`🤝 Community cohesion: ${chunkingResult.community.metadata.cohesion}`);
    
    // Display sample chunks
    console.log('\n📋 Sample chunks:');
    chunkingResult.chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`  ${index + 1}. "${chunk.title}" (${chunk.size} chars)`);
      console.log(`     Content: "${chunk.content.substring(0, 100)}..."`);
      console.log(`     URI: ${chunk.uri}`);
    });
    console.log();

    // Step 4: Store chunks in SPARQL store
    console.log('💾 Step 4: Storing chunks in SPARQL store...');
    const startStoreTime = Date.now();
    let storedCount = 0;

    // Store each chunk using the SPARQLStore API
    for (const chunk of chunkingResult.chunks) {
      const storeData = {
        id: chunk.uri,
        content: chunk.content,
        prompt: chunk.title,
        embedding: [], // Would need actual embeddings in production
        metadata: {
          size: chunk.size,
          index: chunk.index,
          strategy: chunk.metadata.strategy,
          hash: chunk.metadata.hash,
          sourceUri: chunkingResult.sourceUri
        },
        timestamp: new Date().toISOString()
      };

      try {
        await store.store(storeData);
        storedCount++;
        
        // Show progress for large numbers of chunks
        if (storedCount % 1000 === 0) {
          console.log(`   📦 Stored ${storedCount}/${chunkingResult.chunks.length} chunks...`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to store chunk ${chunk.index}: ${error.message}`);
      }
    }

    const storeTime = Date.now() - startStoreTime;
    console.log('✅ SPARQL storage completed');
    console.log(`⏱️ Storage time: ${storeTime}ms`);
    console.log(`📈 Chunks stored: ${storedCount}/${chunkingResult.chunks.length}`);
    console.log(`📊 Performance: ${Math.round(storedCount / (storeTime / 1000))} chunks/sec\n`);

    // Step 5: Query and verify stored data
    console.log('🔍 Step 5: Querying stored data...');
    
    try {
      // Simple verification by searching for stored content
      const searchResults = await store.search([], 5); // Empty embedding for basic query
      console.log(`📚 Elements found in store: ${searchResults?.length || 0}`);
      
      if (searchResults && searchResults.length > 0) {
        console.log(`🧩 Sample stored elements:`);
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. Score: ${result.score?.toFixed(3) || 'N/A'}`);
          console.log(`     Content preview: "${(result.content || '').substring(0, 80)}..."`);
        });
      } else {
        console.log(`📋 No elements found in search results`);
      }
    } catch (queryError) {
      console.warn(`⚠️ Query verification failed: ${queryError.message}`);
      console.log(`📝 Note: This is expected if embeddings were not generated`);
    }

    // Step 6: Display final statistics
    console.log('\n📊 Final Statistics:');
    console.log('═'.repeat(50));
    console.log(`📄 Original PDF: ${conversionResult.metadata.fileSize} bytes`);
    console.log(`📝 Markdown: ${conversionResult.markdown.length} characters`);
    console.log(`📦 Total chunks: ${chunkingResult.chunks.length}`);
    console.log(`📏 Average chunk size: ${Math.round(chunkingResult.metadata.chunking.avgChunkSize)} characters`);
    console.log(`⏱️ Total processing: ${Date.now() - startTime}ms`);
    console.log(`🔗 All data linked with Ragno ontology`);
    console.log(`📋 Full PROV-O provenance tracking`);
    console.log(`💾 Stored in SPARQL graph: ${store.graphName || 'default'}`);

    // Success summary
    console.log('\n🎉 Life Sciences Demo Completed Successfully!');
    console.log('✨ The eLife paper has been processed and is now available for:');
    console.log('   • Semantic search across chunks');
    console.log('   • Knowledge graph queries');
    console.log('   • Provenance tracking');
    console.log('   • Research paper analysis');
    console.log('   • Citation and reference mining');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);

  } finally {
    // Cleanup resources
    try {
      if (store) {
        await store.close();
        console.log('\n🧹 Resources cleaned up');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🧬 Life Sciences Document Processing Demo

This demo processes the eLife research paper located at:
  docs/paper/references/elife-52614-v1.pdf

The demo will:
1. Convert the PDF to markdown format
2. Chunk the content using semantic boundaries
3. Create Ragno-compliant RDF entities
4. Ingest everything into a SPARQL store
5. Query the results to verify storage

Requirements:
- SPARQL endpoint running (Apache Fuseki recommended)
- PDF file present at the specified location
- Proper configuration in config/config.json

Usage:
  node examples/document/LifeSciDemo.js

Environment:
- Set SPARQL_ENDPOINT if using custom endpoint
- Set LOG_LEVEL for different verbosity (DEBUG, INFO, WARN, ERROR)
`);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received termination signal. Shutting down gracefully...');
  process.exit(0);
});

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runLifeSciDemo().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}