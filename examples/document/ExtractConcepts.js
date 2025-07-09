#!/usr/bin/env node

/**
 * Extract Concepts Script
 * 
 * Finds ragno:TextElement instances (chunks) that don't have concepts extracted yet,
 * uses the configured LLM to extract concepts from their content, and stores the results
 * as ragno:Unit instances with concept labels and ragno:Corpuscle collections.
 * 
 * This script now uses the enhanced CreateConcepts.js module which provides:
 * - Individual ragno:Corpuscle instances for each concept with embeddings
 * - Collection corpuscles that group concepts from text elements
 * - SPARQL template-based queries for better maintainability
 * 
 * Usage: node examples/document/ExtractConcepts.js [--limit N] [--graph URI]
 */

import { parseArgs } from 'util';
import { CreateConceptsUnified as CreateConcepts } from '../../src/ragno/CreateConceptsUnified.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');
    
    const { values: args } = parseArgs({
        options: {
            limit: {
                type: 'string',
                default: '0'
            },
            graph: {
                type: 'string'
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help) {
        console.log(`
ExtractConcepts.js - Enhanced concept extraction with individual corpuscles and embeddings

Usage: node examples/document/ExtractConcepts.js [options]

Options:
  --limit <number>   Maximum number of TextElements to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Description:
  This script finds ragno:TextElement instances (chunks) that don't have concepts extracted,
  uses the configured LLM to extract concepts from their content, and stores the results
  as ragno:Unit instances with concept labels.

  Enhanced features:
  - Creates individual ragno:Corpuscle instances for each concept with embeddings
  - Creates collection corpuscles that group all concepts from each TextElement
  - Uses SPARQL templates for better maintainability
  - Generates embeddings for concept text values using configured providers

Examples:
  node examples/document/ExtractConcepts.js                                    # Process all TextElements
  node examples/document/ExtractConcepts.js --limit 5                         # Process up to 5 TextElements
  node examples/document/ExtractConcepts.js --graph "http://example.org/docs" # Use specific graph

Prerequisites:
  1. Configure config/config.json with SPARQL, LLM, and embedding providers
  2. Set API keys in .env file
  3. Ensure SPARQL endpoint is running and accessible
  4. Ensure LLM and embedding services are available
        `);
        return;
    }

    logger.info('🚀 Starting Enhanced Concept Extraction for TextElements');
    logger.info('='.repeat(70));

    const createConcepts = new CreateConcepts();
    
    try {
        // Initialize the CreateConcepts system
        await createConcepts.init();
        
        const options = {
            limit: parseInt(args.limit) || 0,  // Default to 0 (no limit)
            graph: args.graph
        };
        
        // Process TextElements and extract concepts with embeddings
        const results = await createConcepts.processTextElements(options);
        
        // Display additional summary information
        logger.info('\n🎉 ENHANCED CONCEPT EXTRACTION COMPLETED!');
        logger.info('='.repeat(70));
        
        if (results.length > 0) {
            const successfulResults = results.filter(r => r.conceptCount > 0);
            const totalConceptCorpuscles = successfulResults.reduce((sum, r) => sum + r.conceptCorpuscleURIs.length, 0);
            const totalCollectionCorpuscles = successfulResults.filter(r => r.collectionCorpuscleURI).length;
            
            logger.info(`📊 Additional Statistics:`);
            logger.info(`   🔗 Individual concept corpuscles: ${totalConceptCorpuscles}`);
            logger.info(`   📦 Collection corpuscles: ${totalCollectionCorpuscles}`);
            logger.info(`   🧠 Average concepts per TextElement: ${(successfulResults.reduce((sum, r) => sum + r.conceptCount, 0) / successfulResults.length).toFixed(2)}`);
            
            // Show sample results
            if (successfulResults.length > 0) {
                logger.info(`\n📝 Sample Results:`);
                successfulResults.slice(0, 3).forEach((result, i) => {
                    logger.info(`   ${i + 1}. ${result.textElementURI.split('/').pop()}: ${result.conceptCount} concepts`);
                    if (result.concepts.length > 0) {
                        logger.info(`      Concepts: ${result.concepts.slice(0, 3).join(', ')}${result.concepts.length > 3 ? '...' : ''}`);
                    }
                });
            }
        }
        
        logger.info('\n✅ Enhanced concept extraction completed successfully!');
        logger.info('💡 Each concept now has its own corpuscle with embeddings for advanced querying.');
        
    } catch (error) {
        logger.error('\n❌ Enhanced concept extraction failed:', error.message);
        
        if (logger.getLevel() <= logger.levels.DEBUG) {
            logger.error('Stack:', error.stack);
        }
        
        logger.info('\n🔧 Troubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running and accessible');
        logger.info('- Check LLM provider configuration (Mistral/Claude/Ollama)');
        logger.info('- Check embedding provider configuration (Nomic/Ollama)');
        logger.info('- Verify network connectivity to LLM and embedding services');
        logger.info('- Ensure required models are available (e.g., ollama pull qwen2:1.5b)');
        logger.info('- Check API keys are set in .env file');
        
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await createConcepts.cleanup();
        
        // Force exit after a short delay to ensure cleanup completes
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

export { CreateConcepts };