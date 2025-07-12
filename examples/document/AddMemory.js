#!/usr/bin/env node

/**
 * AddMemory.js - Command-line interface for the Memorise module
 * 
 * This script provides a simple way to ingest text files into the semem
 * memory system using the integrated Memorise module. It handles the
 * complete pipeline from text input to knowledge graph storage.
 * 
 * Usage: node examples/document/AddMemory.js <file-path> [options]
 * 
 * Example:
 *   node examples/document/AddMemory.js data/mydocument.txt
 *   node examples/document/AddMemory.js data/mydocument.txt --title "My Document" --graph "http://example.org/mygraph"
 */

import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { basename, extname } from 'path';
import Memorise from '../../src/ragno/Memorise.js';
import logger from 'loglevel';

class AddMemoryScript {
    constructor() {
        this.memorise = null;
    }

    async init() {
        this.memorise = new Memorise();
        await this.memorise.init();
    }

    async run(options) {
        const { filePath, title, graph, verbose, augment } = options;

        // Set logging level
        logger.setLevel(verbose ? 'debug' : 'info');

        // Validate file exists
        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Read file content
        logger.info(`📖 Reading file: ${filePath}`);
        const content = readFileSync(filePath, 'utf8');
        
        if (!content.trim()) {
            throw new Error('File is empty or contains no readable content');
        }

        // Prepare options for memorise
        const memoriseOptions = {
            title: title || this.generateTitle(filePath),
            source: filePath,
            graph: graph,
            extractConcepts: augment // Control concept extraction via --augment flag
        };

        logger.info(`📊 File statistics:`);
        logger.info(`   📄 File: ${filePath}`);
        logger.info(`   📏 Size: ${content.length} characters`);
        logger.info(`   🏷️  Title: ${memoriseOptions.title}`);
        logger.info(`   🧠 Concept extraction: ${augment ? 'enabled' : 'disabled'}`);
        if (memoriseOptions.graph) {
            logger.info(`   🎯 Target graph: ${memoriseOptions.graph}`);
        }

        // Process the content
        const result = await this.memorise.memorize(content, memoriseOptions);

        // Display results
        this.displayResults(result, filePath);

        return result;
    }

    generateTitle(filePath) {
        const filename = basename(filePath, extname(filePath));
        // Clean up filename for use as title
        return filename
            .replace(/[_-]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .toLowerCase()
            .replace(/^\w/, c => c.toUpperCase());
    }

    displayResults(result, filePath) {
        logger.info('\n🎉 Memory ingestion completed successfully!');
        logger.info('='.repeat(60));
        logger.info(`📁 Source file: ${filePath}`);
        logger.info(`🆔 Unit URI: ${result.unitURI}`);
        logger.info(`📝 Text Element URI: ${result.textElementURI}`);
        logger.info(`✂️  Chunks created: ${result.chunks}`);
        
        if (result.decompositionResults) {
            logger.info(`🎯 Entities: ${result.decompositionResults.entities?.length || 0}`);
            logger.info(`🔗 Relationships: ${result.decompositionResults.relationships?.length || 0}`);
            logger.info(`📦 Units: ${result.decompositionResults.units?.length || 0}`);
        }

        const stats = result.statistics;
        logger.info(`\n📊 Processing Statistics:`);
        logger.info(`   ⏱️  Total time: ${(stats.processingTimeMs / 1000).toFixed(2)}s`);
        logger.info(`   🔢 Embeddings: ${stats.embeddingsCreated}`);
        logger.info(`   💡 Concepts: ${stats.conceptsExtracted}`);
        
        if (stats.errors.length > 0) {
            logger.warn(`\n⚠️  Warnings (${stats.errors.length}):`);
            stats.errors.forEach((error, index) => {
                logger.warn(`   ${index + 1}. ${error}`);
            });
        }

        logger.info('\n✅ Text has been successfully added to the semantic memory system!');
        logger.info('💡 You can now query this content using the semem API or search interfaces.');
    }

    async cleanup() {
        if (this.memorise) {
            await this.memorise.cleanup();
        }
    }
}

async function main() {
    const { values: args, positionals } = parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
            title: {
                type: 'string',
                short: 't'
            },
            graph: {
                type: 'string',
                short: 'g'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                default: false
            },
            augment: {
                type: 'boolean',
                short: 'a',
                default: false
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help || positionals.length === 0) {
        console.log(`
AddMemory.js - Ingest text files into the Semem memory system

Usage: node examples/document/AddMemory.js <file-path> [options]

Arguments:
  file-path              Path to the text file to ingest

Options:
  -t, --title <title>    Custom title for the content (default: derived from filename)
  -g, --graph <uri>      Target SPARQL graph URI (default: from config)
  -a, --augment          Enable concept extraction and entity decomposition (default: false)
  -v, --verbose          Enable verbose logging with debug information
  -h, --help             Show this help message

Examples:
  node examples/document/AddMemory.js data/research-paper.txt
  node examples/document/AddMemory.js data/notes.md --title "Meeting Notes" --verbose
  node examples/document/AddMemory.js data/article.txt --graph "http://example.org/articles"
  node examples/document/AddMemory.js data/notes.txt --augment  # Enable concept extraction

Description:
  This script processes a text file through the complete Semem memory ingestion
  pipeline, which includes:
  
  1. Creating ragno:Unit and ragno:TextElement RDF resources
  2. Chunking the text into manageable pieces with OLO indexing
  3. Generating vector embeddings for semantic search
  4. [Optional] Extracting concepts and creating ragno:Corpuscle instances (--augment)
  5. [Optional] Decomposing text into entities and relationships (--augment)
  6. Storing all data in the configured SPARQL endpoint
  
  The result is a rich, queryable knowledge representation that can be used
  for semantic search, question answering, and knowledge discovery.

Prerequisites:
  - SPARQL endpoint running and configured in config/config.json
  - LLM provider configured (Mistral, Claude, or Ollama)
  - Embedding provider configured (Nomic or Ollama)
  - Required API keys set in environment variables

Configuration:
  The script uses the standard Semem configuration system. Ensure your
  config/config.json file has proper storage, LLM, and embedding settings.

Troubleshooting:
  - Use --verbose flag for detailed logging
  - Check SPARQL endpoint connectivity
  - Verify LLM and embedding provider availability
  - Ensure API keys are properly set in environment
        `);
        return;
    }

    const filePath = positionals[0];
    if (!filePath) {
        console.error('❌ Error: File path is required');
        console.error('Use --help for usage information');
        process.exit(1);
    }

    const script = new AddMemoryScript();
    
    try {
        logger.info('🚀 Starting AddMemory script...');
        await script.init();
        
        const options = {
            filePath: filePath,
            title: args.title,
            graph: args.graph,
            verbose: args.verbose,
            augment: args.augment
        };
        
        await script.run(options);
        
        logger.info('\n🎊 AddMemory script completed successfully!');
        
    } catch (error) {
        logger.error('\n❌ AddMemory script failed:', error.message);
        
        if (args.verbose) {
            logger.error('Stack trace:', error.stack);
        }
        
        logger.info('\n🔧 Troubleshooting tips:');
        logger.info('- Ensure the file path is correct and readable');
        logger.info('- Check SPARQL endpoint is running and accessible');
        logger.info('- Verify LLM and embedding providers are configured');
        logger.info('- Use --verbose flag for detailed error information');
        logger.info('- Check API keys are set in environment variables');
        
        process.exit(1);
    } finally {
        // Always cleanup
        await script.cleanup();
        
        // Force exit after cleanup
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export default AddMemoryScript;