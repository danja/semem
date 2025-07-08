#!/usr/bin/env node

/**
 * Document Decomposition Script
 * 
 * Finds ragno:TextElement instances (chunks) that have embeddings and concepts extracted,
 * applies decomposeCorpus to create semantic units, entities, and relationships,
 * and stores the results in SPARQL following the Ragno ontology.
 * 
 * Usage: node examples/document/Decompose.js [--limit N] [--graph URI]
 */

import { parseArgs } from 'util';
import path from 'path';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables with explicit path
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class DocumentDecomposer {
    constructor() {
        this.config = null;
        this.sparqlHelper = null;
        this.queryService = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
    }

    async init() {
        // Load configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        logger.info(`Loading configuration from: ${configPath}`);
        this.config = new Config(configPath);
        await this.config.init();
        
        // Debug: Check if environment variables are loaded
        logger.debug('API keys:', {
            mistral: !!process.env.MISTRAL_API_KEY,
            claude: !!process.env.ANTHROPIC_API_KEY,
            nomic: !!process.env.NOMIC_API_KEY
        });
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('DocumentDecomposer requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        this.queryService = new SPARQLQueryService();
        
        // Initialize providers using configuration-driven pattern
        await this.initializeProviders();
    }

    /**
     * Initialize providers using configuration-driven pattern
     */
    async initializeProviders() {
        try {
            // Initialize providers and get their selected models
            const llmResult = await this.createLLMConnector(this.config);
            const embeddingResult = await this.createEmbeddingConnector(this.config);

            // Initialize handlers with the models from actually selected providers
            const dimension = this.config.get('memory.dimension') || 1536;
            
            this.embeddingHandler = new EmbeddingHandler(
                embeddingResult.connector,
                embeddingResult.model,
                dimension
            );

            this.llmHandler = new LLMHandler(llmResult.connector, llmResult.model);
            
            logger.info(`Initialized: ${llmResult.provider}/${embeddingResult.provider}`);
            
        } catch (error) {
            logger.error('❌ Failed to initialize providers:', error.message);
            throw error;
        }
    }

    /**
     * Create LLM connector based on configuration priority
     * Returns both connector and the model to use with it
     */
    async createLLMConnector(config) {
        try {
            // Get llmProviders with priority ordering
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                if (provider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                    logger.info('Using Mistral LLM');
                    return {
                        connector: new MistralConnector(process.env.MISTRAL_API_KEY),
                        model: provider.chatModel || 'mistral-small-latest',
                        provider: 'mistral'
                    };
                } else if (provider.type === 'claude' && process.env.ANTHROPIC_API_KEY) {
                    logger.info('Using Claude LLM');
                    return {
                        connector: new ClaudeConnector(process.env.ANTHROPIC_API_KEY),
                        model: provider.chatModel || 'claude-3-haiku-20240307',
                        provider: 'claude'
                    };
                } else if (provider.type === 'ollama') {
                    logger.info('Using Ollama LLM');
                    return {
                        connector: new OllamaConnector(),
                        model: provider.chatModel || 'qwen2:1.5b',
                        provider: 'ollama'
                    };
                }
            }
            
            // Default fallback
            logger.info('Using Ollama LLM (fallback)');
            return {
                connector: new OllamaConnector(),
                model: 'qwen2:1.5b',
                provider: 'ollama'
            };
            
        } catch (error) {
            logger.warn('Provider config failed, using Ollama:', error.message);
            return {
                connector: new OllamaConnector(),
                model: 'qwen2:1.5b',
                provider: 'ollama'
            };
        }
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
     * Returns both connector and the model to use with it
     */
    async createEmbeddingConnector(config) {
        try {
            const embeddingProviders = config.get('embeddingProviders') || [];
            const sortedProviders = embeddingProviders
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            for (const provider of sortedProviders) {
                if (provider.type === 'nomic' && process.env.NOMIC_API_KEY) {
                    logger.info('Using Nomic embeddings');
                    const model = provider.embeddingModel || 'nomic-embed-text-v1.5';
                    return {
                        connector: EmbeddingConnectorFactory.createConnector({
                            provider: 'nomic',
                            apiKey: process.env.NOMIC_API_KEY,
                            model: model
                        }),
                        model: model,
                        provider: 'nomic'
                    };
                } else if (provider.type === 'ollama') {
                    logger.info('Using Ollama embeddings');
                    const model = provider.embeddingModel || 'nomic-embed-text';
                    return {
                        connector: EmbeddingConnectorFactory.createConnector({
                            provider: 'ollama',
                            baseUrl: provider.baseUrl || 'http://localhost:11434',
                            model: model
                        }),
                        model: model,
                        provider: 'ollama'
                    };
                }
            }
            
            // Default fallback
            logger.info('Using Ollama embeddings (fallback)');
            return {
                connector: EmbeddingConnectorFactory.createConnector({
                    provider: 'ollama',
                    baseUrl: 'http://localhost:11434',
                    model: 'nomic-embed-text'
                }),
                model: 'nomic-embed-text',
                provider: 'ollama'
            };
            
        } catch (error) {
            logger.warn('Embedding config failed, using Ollama:', error.message);
            return {
                connector: EmbeddingConnectorFactory.createConnector({
                    provider: 'ollama',
                    baseUrl: 'http://localhost:11434',
                    model: 'nomic-embed-text'
                }),
                model: 'nomic-embed-text',
                provider: 'ollama'
            };
        }
    }


    async findProcessedChunks(targetGraph, limit = 0) {
        try {
            const query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX olo: <http://purl.org/ontology/olo/core#>
                PREFIX semem: <http://semem.hyperdata.it/>
                PREFIX prov: <http://www.w3.org/ns/prov#>
                PREFIX dcterms: <http://purl.org/dc/terms/>

                SELECT ?textElement ?content ?sourceUnit ?corpuscle WHERE {
                    GRAPH <${targetGraph}> {
                        ?textElement a ragno:TextElement ;
                                     ragno:content ?content ;
                                     prov:wasDerivedFrom ?sourceUnit .
                        
                        # Only process chunks (which have olo:index)
                        OPTIONAL { ?textElement olo:index ?index }
                        FILTER (BOUND(?index))
                        
                        # Must have embeddings
                        ?textElement ragno:embedding ?embedding .
                        
                        # Must have concepts extracted
                        ?textElement semem:hasConcepts true ;
                                     semem:hasCorpuscle ?corpuscle .
                        
                        # Filter out chunks that have already been decomposed
                        FILTER NOT EXISTS {
                            ?textElement semem:hasSemanticUnits true .
                        }
                    }
                }
                ORDER BY ?sourceUnit ?index
                ${limit > 0 ? `LIMIT ${limit}` : ''}
            `;
            
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
            logger.error(`Error finding processed chunks: ${error.message}`);
            return [];
        }
    }

    async decomposeChunks(chunks, targetGraph) {
        logger.info(`Decomposing ${chunks.length} chunks`);
        
        // Prepare text chunks for decomposeCorpus
        const textChunks = chunks.map(chunk => ({
            content: chunk.content.value,
            source: chunk.textElement.value,
            metadata: {
                sourceUnit: chunk.sourceUnit.value,
                corpuscle: chunk.corpuscle.value
            }
        }));
        
        try {
            // Apply decomposeCorpus with appropriate options
            const decompositionResults = await decomposeCorpus(textChunks, this.llmHandler, {
                extractRelationships: true,
                generateSummaries: true,
                minEntityConfidence: 0.4,
                maxEntitiesPerUnit: 15,
                chunkOverlap: 0.1
            });
            
            logger.info(`Created: ${decompositionResults.units.length} units, ${decompositionResults.entities.length} entities, ${decompositionResults.relationships.length} relationships`);
            
            return decompositionResults;
            
        } catch (error) {
            logger.error(`❌ Decomposition failed: ${error.message}`);
            throw error;
        }
    }

    async storeDecompositionResults(decompositionResults, chunks, targetGraph) {
        logger.info(`Storing results`);
        
        try {
            // Get the RDF dataset from decomposition results
            const { dataset, units, entities, relationships } = decompositionResults;
            
            // Convert RDF dataset to N-Triples for SPARQL insertion
            const triples = [];
            for (const quad of dataset) {
                const subject = quad.subject.termType === 'NamedNode' ? `<${quad.subject.value}>` : `_:${quad.subject.value}`;
                const predicate = `<${quad.predicate.value}>`;
                const object = quad.object.termType === 'NamedNode' ? `<${quad.object.value}>` : 
                              quad.object.termType === 'Literal' ? `"${quad.object.value.replace(/"/g, '\\"')}"` : 
                              `_:${quad.object.value}`;
                triples.push(`${subject} ${predicate} ${object} .`);
            }
            
            // Also mark the original chunks as having semantic units
            const now = new Date().toISOString();
            const markProcessedTriples = chunks.map(chunk => 
                `<${chunk.textElement.value}> semem:hasSemanticUnits true .`
            ).join('\n        ');
            
            // Build complete SPARQL update query
            const updateQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                PREFIX dcterms: <http://purl.org/dc/terms/>
                PREFIX prov: <http://www.w3.org/ns/prov#>
                PREFIX semem: <http://semem.hyperdata.it/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

                INSERT DATA {
                    GRAPH <${targetGraph}> {
                        # Mark chunks as having semantic units
                        ${markProcessedTriples}
                        
                        # Insert all decomposition results
                        ${triples.join('\n        ')}
                    }
                }
            `;
            
            await this.sparqlHelper.executeUpdate(updateQuery);
            
            logger.info(`Stored ${triples.length} triples`);
            
            return {
                triplesStored: triples.length,
                unitsStored: units.length,
                entitiesStored: entities.length,
                relationshipsStored: relationships.length
            };
            
        } catch (error) {
            logger.error(`❌ Error storing decomposition results: ${error.message}`);
            throw error;
        }
    }

    async run(options) {
        const { limit, graph } = options;
        
        const targetGraph = graph || this.config.get('storage.options.graphName') || 
                            this.config.get('graphName') || 
                            'http://tensegrity.it/semem';
        
        logger.info(`Finding chunks in: ${targetGraph.split('/').pop()}`);
        
        const processedChunks = await this.findProcessedChunks(targetGraph, limit);
        logger.info(`Found ${processedChunks.length} chunks ready for decomposition`);
        
        if (processedChunks.length === 0) {
            logger.info('No chunks need decomposition');
            return [];
        }
        
        try {
            // Decompose the chunks
            const decompositionResults = await this.decomposeChunks(processedChunks, targetGraph);
            
            // Store the results
            const storeResults = await this.storeDecompositionResults(decompositionResults, processedChunks, targetGraph);
            
            logger.info(`Summary: ${processedChunks.length} chunks → ${storeResults.unitsStored} units, ${storeResults.entitiesStored} entities, ${storeResults.relationshipsStored} relationships`);
            
            return {
                decompositionResults,
                storeResults,
                processedChunks: processedChunks.length
            };
            
        } catch (error) {
            logger.error(`❌ Decomposition process failed: ${error.message}`);
            throw error;
        }
    }

    async cleanup() {
        // Close any open connections
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
        
        if (this.llmHandler && typeof this.llmHandler.dispose === 'function') {
            await this.llmHandler.dispose();
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
Decompose.js - Apply semantic decomposition to processed document chunks

Usage: node examples/document/Decompose.js [options]

Options:
  --limit <number>   Maximum number of chunks to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Description:
  This script finds ragno:TextElement instances (chunks) that have embeddings and 
  concepts extracted, applies decomposeCorpus to create semantic units, entities, 
  and relationships, and stores the results in SPARQL following the Ragno ontology.
  
  Prerequisites:
  - Chunks must have embeddings (MakeEmbeddings.js)
  - Chunks must have concepts extracted (ExtractConcepts.js)

Examples:
  node examples/document/Decompose.js                                    # Process all ready chunks
  node examples/document/Decompose.js --limit 5                         # Process up to 5 chunks
  node examples/document/Decompose.js --graph "http://example.org/docs" # Use specific graph
        `);
        return;
    }

    logger.info('Starting Document Decomposition');

    const decomposer = new DocumentDecomposer();
    
    try {
        await decomposer.init();
        
        const options = {
            limit: parseInt(args.limit) || 0,  // Default to 0 (no limit)
            graph: args.graph
        };
        
        await decomposer.run(options);
        
        logger.info('Decomposition completed successfully');
        
    } catch (error) {
        logger.error('\n❌ Document decomposition failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running and accessible');
        logger.info('- Check provider configuration in config/config.json');
        logger.info('- Verify API keys in .env file (Mistral, Claude, Nomic)');
        logger.info('- Ensure Ollama is running for local fallback providers');
        logger.info('- Verify chunks have embeddings and concepts extracted');
        logger.info('- Check required models are available: ollama pull qwen2:1.5b nomic-embed-text');
        
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await decomposer.cleanup();
        
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

export default DocumentDecomposer;