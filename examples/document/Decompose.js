#!/usr/bin/env node

/**
 * Document Decomposition Script (Refactored)
 * 
 * This script now uses the unified PromptManager for all LLM interactions,
 * improving maintainability and consistency.
 */

import { parseArgs } from 'util';
import path from 'path';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import logger from 'loglevel';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { quickStart } from '../../src/prompts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class DocumentDecomposer {
    constructor() {
        this.config = null;
        this.sparqlHelper = null;
        this.queryService = null;
        this.promptManager = null;
        this.llmHandler = null;
    }

    async init() {
        const configPath = path.join(process.cwd(), 'config/config.json');
        logger.info(`Loading configuration from: ${configPath}`);
        this.config = new Config(configPath);
        await this.config.init();

        // Initialize the unified prompt manager
        this.promptManager = await quickStart();
        logger.info('🚀 Unified PromptManager initialized.');

        // Initialize LLM handler
        await this.initializeLLMHandler();

        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('DocumentDecomposer requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        this.queryService = new SPARQLQueryService();
    }

    async initializeLLMHandler() {
        try {
            // Get LLM providers from config and find chat-capable one
            const llmProviders = this.config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            // Sort by priority and use the highest priority chat provider
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            // Try providers in priority order
            for (const provider of sortedProviders) {
                try {
                    if (provider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                        chatModel = provider.chatModel || 'mistral-small-latest';
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'claude' && process.env.ANTHROPIC_API_KEY) {
                        chatModel = provider.chatModel || 'claude-3-haiku-20240307';
                        llmProvider = new ClaudeConnector(process.env.ANTHROPIC_API_KEY);
                        logger.info(`🤖 Using Claude LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'ollama') {
                        chatModel = provider.chatModel || 'qwen2:1.5b';
                        const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                        llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                        logger.info(`🤖 Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                        break;
                    }
                } catch (error) {
                    logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                    continue;
                }
            }

            // Fallback to Ollama if no other provider works
            if (!llmProvider) {
                logger.warn('No configured LLM provider available, falling back to Ollama');
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                chatModel = 'qwen2:1.5b';
                llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            }

            this.llmHandler = new LLMHandler(llmProvider, chatModel);
            logger.info(`✅ LLM handler initialized with ${chatModel}`);
            
        } catch (error) {
            logger.error('Failed to initialize LLM handler:', error.message);
            // Emergency fallback
            this.llmHandler = new LLMHandler(new OllamaConnector('http://localhost:11434'), 'qwen2:1.5b');
            logger.warn('Using emergency fallback to Ollama');
        }
    }

    async findProcessedChunks(targetGraph, limit = 0) {
        const graph = targetGraph || this.config.get('graphName') || 'http://tensegrity.it/semem';
        
        try {
            // Use SPARQL template to find chunks ready for decomposition
            const query = await this.queryService.getQuery('find-chunks-for-decomposition', {
                graphURI: graph,
                limit: limit > 0 ? limit : 1000
            });
            
            logger.debug(`Querying for processed chunks...`);
            const result = await this.sparqlHelper.executeSelect(query);
            
            if (result.success) {
                const chunks = result.data.results.bindings;
                logger.info(`Found ${chunks.length} chunks ready for decomposition`);
                return chunks;
            } else {
                throw new Error(`SPARQL query failed: ${result.error}`);
            }
        } catch (error) {
            logger.error('Failed to find processed chunks:', error);
            throw error;
        }
    }

    async decomposeChunks(chunks, targetGraph) {
        logger.info(`Decomposing ${chunks.length} chunks using PromptManager...`);
        
        const textChunks = chunks.map(chunk => ({
            content: chunk.content.value,
            source: chunk.textElement.value,
            metadata: {
                sourceUnit: chunk.sourceUnit.value
            }
        }));
        
        try {
            // Use the LLM handler for executing decomposition prompts
            const decompositionResults = await decomposeCorpus(textChunks, this.llmHandler, {
                extractRelationships: true,
                generateSummaries: true,
                minEntityConfidence: 0.4,
                maxEntitiesPerUnit: 15,
                model: this.llmHandler.chatModel || 'qwen2:1.5b'
            });
            
            logger.info(`Created: ${decompositionResults.units.length} units, ${decompositionResults.entities.length} entities, ${decompositionResults.relationships.length} relationships`);
            return decompositionResults;
            
        } catch (error) {
            logger.error(`❌ Decomposition failed: ${error.message}`);
            throw error;
        }
    }

    async storeDecompositionResults(decompositionResults, chunks, targetGraph) {
        const graph = targetGraph || this.config.get('graphName') || 'http://tensegrity.it/semem';
        
        // Store the RDF dataset from decomposition results
        if (decompositionResults.dataset && decompositionResults.dataset.size > 0) {
            logger.info(`Storing decomposition results: ${decompositionResults.dataset.size} triples`);
            
            // Convert dataset to N-Triples format for SPARQL insertion
            const quads = Array.from(decompositionResults.dataset);
            const triples = quads.map(quad => {
                const subject = quad.subject.termType === 'NamedNode' ? `<${quad.subject.value}>` : quad.subject.value;
                const predicate = `<${quad.predicate.value}>`;
                const object = quad.object.termType === 'NamedNode' ? `<${quad.object.value}>` : 
                             quad.object.termType === 'Literal' ? `"${quad.object.value}"` : quad.object.value;
                return `${subject} ${predicate} ${object} .`;
            }).join('\n');
            
            // Use SPARQLHelper to create and execute the insert query
            const insertQuery = this.sparqlHelper.createInsertDataQuery(graph, triples);
            const result = await this.sparqlHelper.executeUpdate(insertQuery);
            
            if (result.success) {
                logger.info(`Stored ${decompositionResults.dataset.size} triples to graph <${graph}>`);
            } else {
                logger.error(`Failed to store decomposition results: ${result.error}`);
                throw new Error(`SPARQL insert failed: ${result.error}`);
            }
        }
        
        // Mark chunks as having semantic units using SPARQL template
        for (const chunk of chunks) {
            try {
                const markQuery = await this.queryService.getQuery('mark-chunks-decomposed', {
                    graphURI: graph,
                    textElementURI: chunk.textElement.value
                });
                
                const result = await this.sparqlHelper.executeUpdate(markQuery);
                if (!result.success) {
                    logger.warn(`Failed to mark chunk as decomposed: ${result.error}`);
                }
            } catch (error) {
                logger.warn(`Failed to mark chunk as decomposed: ${error.message}`);
            }
        }
        
        logger.info(`Marked ${chunks.length} chunks as having semantic units`);
    }

    async run(options) {
        const { limit = 0, graph } = options;
        
        logger.info('Starting document decomposition process...');
        
        // Find chunks ready for decomposition
        const chunks = await this.findProcessedChunks(graph, limit);
        
        if (chunks.length === 0) {
            logger.info('No chunks found for decomposition. Ensure ExtractConcepts.js has been run first.');
            return;
        }
        
        logger.info(`Processing ${chunks.length} chunks for decomposition...`);
        
        // Decompose chunks using decomposeCorpus
        const decompositionResults = await this.decomposeChunks(chunks, graph);
        
        // Store results in SPARQL store
        await this.storeDecompositionResults(decompositionResults, chunks, graph);
        
        logger.info('Document decomposition completed successfully!');
        logger.info(`Summary: ${decompositionResults.units.length} units, ${decompositionResults.entities.length} entities, ${decompositionResults.relationships.length} relationships`);
        
        return decompositionResults;
    }

    async cleanup() {
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
    }
}

async function main() {
    logger.setLevel(process.env.LOG_LEVEL || 'info');
    
    const { values: args } = parseArgs({
        options: {
            limit: { type: 'string', default: '0' },
            graph: { type: 'string' },
            help: { type: 'boolean', short: 'h' }
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
        `);
        return;
    }

    logger.info('Starting Document Decomposition');
    const decomposer = new DocumentDecomposer();
    let exitCode = 0;

    try {
        await decomposer.init();
        await decomposer.run({
            limit: parseInt(args.limit) || 0,
            graph: args.graph
        });
        logger.info('Decomposition completed successfully');
    } catch (error) {
        logger.error('\n❌ Document decomposition failed:', error.message);
        logger.error('Stack:', error.stack);
        exitCode = 1;
    } finally {
        await decomposer.cleanup();
        setTimeout(() => process.exit(exitCode), 100);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

export default DocumentDecomposer;