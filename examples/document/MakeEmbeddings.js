#!/usr/bin/env node

/**
 * Make Embeddings Script
 * 
 * Finds ragno:TextElement instances that don't have embeddings associated with them
 * and creates embeddings for each, saving them to the SPARQL store using the
 * ragno:embedding property.
 * 
 * Based on examples/basic/MemoryEmbeddingSPARQL.js for module usage patterns.
 * 
 * Usage: node examples/document/MakeEmbeddings.js [--limit N] [--graph URI]
 */

import { parseArgs } from 'util';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class MakeEmbeddings {
    constructor() {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.embeddingHandler = null;
    }

    async init() {
        // Initialize configuration
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('MakeEmbeddings requires SPARQL storage configuration');
        }
        
        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService();
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        
        // Initialize embedding handler using configuration patterns from MemoryEmbeddingSPARQL.js
        await this.initializeEmbeddingHandler();
    }

    async initializeEmbeddingHandler() {
        // Get embedding configuration from config, following MemoryEmbeddingSPARQL.js patterns
        const embeddingProvider = this.config.get('embeddingProvider') || 'ollama';
        const embeddingModel = this.config.get('embeddingModel') || 'nomic-embed-text';
        
        logger.info(`Using embedding provider: ${embeddingProvider}`);
        logger.info(`Embedding model: ${embeddingModel}`);
        
        // Create embedding connector using configuration patterns from reference
        let providerConfig = {};
        if (embeddingProvider === 'nomic') {
            providerConfig = {
                provider: 'nomic',
                apiKey: process.env.NOMIC_API_KEY,
                model: embeddingModel
            };
        } else if (embeddingProvider === 'ollama') {
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            providerConfig = {
                provider: 'ollama',
                baseUrl: ollamaBaseUrl,
                model: embeddingModel
            };
            logger.info(`Using Ollama at: ${ollamaBaseUrl}`);
        } else {
            // Default to ollama for any other provider
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            providerConfig = {
                provider: 'ollama',
                baseUrl: ollamaBaseUrl,
                model: embeddingModel
            };
            logger.info(`Defaulting to Ollama at: ${ollamaBaseUrl}`);
        }
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
        
        // Determine embedding dimension based on provider/model
        let embeddingDimension;
        if (embeddingProvider === 'nomic' || embeddingModel.includes('nomic')) {
            embeddingDimension = 768; // Nomic embedding dimension
        } else if (embeddingModel.includes('text-embedding')) {
            embeddingDimension = 1536; // OpenAI text-embedding models
        } else {
            embeddingDimension = 1536; // Default dimension for most models
        }
        
        this.embeddingHandler = new EmbeddingHandler(embeddingConnector, embeddingModel, embeddingDimension);
        
        logger.info(`✓ Embedding handler initialized with ${embeddingProvider} connector`);
    }

    async findTextElementsWithoutEmbeddings(targetGraph, limit = 0) {
        try {
            const query = await this.queryService.getQuery('find-textelements-without-embeddings', {
                graphURI: targetGraph,
                limit: limit || 1000000  // Use a very high limit if 0 (no limit)
            });
            
            const storageConfig = this.config.get('storage.options');
            const response = await fetch(storageConfig.query, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json',
                    'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
                },
                body: query
            });
            
            const result = await response.json();
            return result.results?.bindings || [];
        } catch (error) {
            logger.error(`Error finding TextElements without embeddings: ${error.message}`);
            return [];
        }
    }

    async createAndStoreEmbedding(textElement, targetGraph) {
        const textElementURI = textElement.textElement.value;
        const content = textElement.content.value;
        
        logger.info(`  📄 Processing TextElement: ${textElementURI}`);
        logger.info(`     📏 Content length: ${content.length} characters`);
        
        try {
            // Generate embedding for the content
            logger.info(`     🔄 Generating embedding...`);
            const embedding = await this.embeddingHandler.generateEmbedding(content);
            logger.info(`     ✅ Generated embedding (${embedding.length} dimensions)`);
            
            // Convert embedding array to comma-separated string for storage
            const embeddingString = embedding.join(',');
            
            // Store the embedding using SPARQL update
            const updateQuery = await this.queryService.getQuery('store-textelement-embedding', {
                graphURI: targetGraph,
                textElementURI: textElementURI,
                embedding: embeddingString
            });
            
            await this.sparqlHelper.executeUpdate(updateQuery);
            
            logger.info(`     💾 Stored embedding in SPARQL store`);
            
            return {
                textElementURI,
                embeddingDimension: embedding.length,
                contentLength: content.length
            };
            
        } catch (error) {
            logger.error(`     ❌ Error processing ${textElementURI}: ${error.message}`);
            throw error;
        }
    }

    async run(options) {
        const { limit, graph } = options;
        
        const targetGraph = graph || this.config.get('storage.options.graphName') || 
                            this.config.get('graphName') || 
                            'http://purl.org/stuff/semem/documents';
        
        logger.info(`🔍 Finding TextElements without embeddings in graph: ${targetGraph}`);
        logger.info(`📏 Limit: ${limit === 0 ? 'No limit (process all)' : limit}`);
        
        const textElementsWithoutEmbeddings = await this.findTextElementsWithoutEmbeddings(targetGraph, limit);
        logger.info(`📋 Found ${textElementsWithoutEmbeddings.length} TextElements without embeddings`);
        
        if (textElementsWithoutEmbeddings.length === 0) {
            logger.info('✅ All TextElements already have embeddings.');
            return [];
        }
        
        const results = [];
        let processed = 0;
        let failed = 0;
        
        for (const textElement of textElementsWithoutEmbeddings) {
            try {
                const result = await this.createAndStoreEmbedding(textElement, targetGraph);
                results.push(result);
                processed++;
            } catch (error) {
                logger.error(`Failed to process TextElement: ${error.message}`);
                failed++;
            }
        }
        
        logger.info(`\n📊 Embedding Creation Summary:`);
        logger.info(`   ✅ Successfully processed: ${processed} TextElements`);
        logger.info(`   ❌ Failed: ${failed} TextElements`);
        logger.info(`   📈 Total embeddings created: ${processed}`);
        logger.info(`   🎯 Graph: ${targetGraph}`);
        
        return results;
    }

    async cleanup() {
        // Close any open connections
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
        
        if (this.embeddingHandler && typeof this.embeddingHandler.dispose === 'function') {
            await this.embeddingHandler.dispose();
        }
    }
}

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
MakeEmbeddings.js - Create embeddings for ragno:TextElement instances that don't have them

Usage: node examples/document/MakeEmbeddings.js [options]

Options:
  --limit <number>   Maximum number of TextElements to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Description:
  This script finds ragno:TextElement instances that don't have the ragno:embedding property,
  generates embeddings for their content using the configured embedding provider, and stores
  the embeddings in the SPARQL store. The embeddings are stored as comma-separated strings
  in the ragno:embedding property.

Examples:
  node examples/document/MakeEmbeddings.js                                    # Process all TextElements (no limit)
  node examples/document/MakeEmbeddings.js --limit 5                         # Process up to 5 TextElements
  node examples/document/MakeEmbeddings.js --graph "http://example.org/docs" # Use specific graph
        `);
        return;
    }

    logger.info('🚀 Starting Make Embeddings for TextElements');

    const embedder = new MakeEmbeddings();
    
    try {
        await embedder.init();
        
        const options = {
            limit: parseInt(args.limit) || 0,  // Default to 0 (no limit)
            graph: args.graph
        };
        
        await embedder.run(options);
        
        logger.info('\n=== Embedding Creation Completed Successfully ===');
        
    } catch (error) {
        logger.error('\n❌ Embedding creation failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running and accessible');
        logger.info('- Check embedding provider configuration (Ollama/Nomic)');
        logger.info('- Verify network connectivity to embedding service');
        logger.info('- Ensure required models are available: ollama pull nomic-embed-text');
        
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await embedder.cleanup();
        
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

export default MakeEmbeddings;