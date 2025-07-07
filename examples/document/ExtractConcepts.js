#!/usr/bin/env node

/**
 * Extract Concepts Script
 * 
 * Finds ragno:TextElement instances (chunks) that don't have concepts extracted yet,
 * uses the configured LLM to extract concepts from their content, and stores the results
 * as ragno:Unit instances with concept labels and ragno:Corpuscle collections.
 * 
 * Usage: node examples/document/ExtractConcepts.js [--limit N] [--graph URI]
 */

import { parseArgs } from 'util';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ExtractConcepts {
    constructor() {
        this.config = null;
        this.sparqlHelper = null;
        this.queryService = null;
        this.llmHandler = null;
    }

    async init() {
        // Config path relative to project root
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        this.config = new Config(configPath);
        await this.config.init();
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('ExtractConcepts requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
        this.queryService = new SPARQLQueryService();
        
        // Initialize LLM handler using configuration patterns
        await this.initializeLLMHandler();
    }

    async initializeLLMHandler() {
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
                chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';
                
                if (provider.type === 'mistral' && provider.apiKey) {
                    llmProvider = new MistralConnector();
                    logger.info(`Using Mistral LLM with model: ${chatModel}`);
                    break;
                } else if (provider.type === 'claude' && provider.apiKey) {
                    llmProvider = new ClaudeConnector();
                    logger.info(`Using Claude LLM with model: ${chatModel}`);
                    break;
                } else if (provider.type === 'ollama') {
                    const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                    llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                    logger.info(`Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                    break;
                }
            } catch (error) {
                logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                continue;
            }
        }
        
        // Fallback to Ollama if no providers worked
        if (!llmProvider) {
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
            llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
            logger.info(`Fallback to Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
        }
        
        this.llmHandler = new LLMHandler(llmProvider, chatModel);
        logger.info(`✓ LLM handler initialized for chat with model: ${chatModel}`);
    }

    async findTextElementsWithoutConcepts(targetGraph, limit = 0) {
        try {
            const query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX olo: <http://purl.org/ontology/olo/core#>
                PREFIX semem: <http://semem.hyperdata.it/>

                SELECT ?textElement ?content WHERE {
                    GRAPH <${targetGraph}> {
                        ?textElement a ragno:TextElement ;
                                     ragno:content ?content .
                        
                        # Only process chunks (which have olo:index) to avoid original documents that are too large
                        OPTIONAL { ?textElement olo:index ?index }
                        FILTER (BOUND(?index))
                        
                        # Filter out TextElements that already have concepts extracted
                        FILTER NOT EXISTS {
                            ?textElement semem:hasConcepts true .
                        }
                    }
                }
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
            logger.error(`Error finding TextElements without concepts: ${error.message}`);
            return [];
        }
    }

    async extractAndStoreConcepts(textElement, targetGraph) {
        const textElementURI = textElement.textElement.value;
        const content = textElement.content.value;
        
        logger.info(`  📄 Processing TextElement: ${textElementURI}`);
        logger.info(`     📏 Content length: ${content.length} characters`);
        
        try {
            // Extract concepts using LLM
            logger.info(`     🧠 Extracting concepts...`);
            const concepts = await this.llmHandler.extractConcepts(content);
            logger.info(`     ✅ Extracted ${concepts.length} concepts: ${concepts.slice(0, 5).join(', ')}${concepts.length > 5 ? '...' : ''}`);
            
            if (concepts.length === 0) {
                logger.info(`     ⚠️  No concepts extracted, marking as processed`);
                
                // Mark as processed even if no concepts found
                const markProcessedQuery = `
                    PREFIX semem: <http://semem.hyperdata.it/>
                    INSERT DATA {
                        GRAPH <${targetGraph}> {
                            <${textElementURI}> semem:hasConcepts true .
                        }
                    }
                `;
                await this.sparqlHelper.executeUpdate(markProcessedQuery);
                
                return {
                    textElementURI,
                    conceptCount: 0,
                    corpuscleURI: null
                };
            }
            
            // Generate URIs for concepts and corpuscle
            const corpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'corpuscle', textElementURI);
            const conceptURIs = concepts.map(concept => 
                URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept)
            );
            
            // Build SPARQL update for concepts and corpuscle
            const now = new Date().toISOString();
            const conceptTriples = conceptURIs.map((conceptURI, index) => `
                # Concept as ragno:Unit
                <${conceptURI}> a ragno:Unit ;
                    rdfs:label """${concepts[index].replace(/"/g, '\\"')}""" ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:inCorpuscle <${corpuscleURI}> .
            `).join('\n');
            
            const corpuscleMembers = conceptURIs.map(uri => `<${uri}>`).join(', ');
            
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
                        # Mark TextElement as having concepts extracted
                        <${textElementURI}> semem:hasConcepts true ;
                                           semem:hasCorpuscle <${corpuscleURI}> .
                        
                        # Create the Corpuscle collection
                        <${corpuscleURI}> a ragno:Corpuscle ;
                            rdfs:label "Concepts from ${textElementURI.split('/').pop()}" ;
                            dcterms:created "${now}"^^xsd:dateTime ;
                            prov:wasDerivedFrom <${textElementURI}> ;
                            skos:member ${corpuscleMembers} .
                        
                        ${conceptTriples}
                    }
                }
            `;
            
            await this.sparqlHelper.executeUpdate(updateQuery);
            
            logger.info(`     ✅ Stored ${concepts.length} concepts and corpuscle ${corpuscleURI.split('/').pop()}`);
            
            return {
                textElementURI,
                conceptCount: concepts.length,
                corpuscleURI,
                concepts
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
                            'http://tensegrity.it/semem';
        
        logger.info(`🔍 Finding TextElements without concepts in graph: ${targetGraph}`);
        logger.info(`📏 Limit: ${limit === 0 ? 'No limit (process all)' : limit}`);
        
        const textElementsWithoutConcepts = await this.findTextElementsWithoutConcepts(targetGraph, limit);
        logger.info(`📋 Found ${textElementsWithoutConcepts.length} TextElements without concepts`);
        
        if (textElementsWithoutConcepts.length === 0) {
            logger.info('✅ All TextElements already have concepts extracted.');
            return [];
        }
        
        const results = [];
        let processed = 0;
        let failed = 0;
        let totalConcepts = 0;
        
        for (const textElement of textElementsWithoutConcepts) {
            try {
                const result = await this.extractAndStoreConcepts(textElement, targetGraph);
                results.push(result);
                processed++;
                totalConcepts += result.conceptCount;
            } catch (error) {
                logger.error(`Failed to process TextElement: ${error.message}`);
                failed++;
            }
        }
        
        logger.info(`\\n📊 Concept Extraction Summary:`);
        logger.info(`   ✅ Successfully processed: ${processed} TextElements`);
        logger.info(`   ❌ Failed: ${failed} TextElements`);
        logger.info(`   🧠 Total concepts extracted: ${totalConcepts}`);
        logger.info(`   📦 Corpuscles created: ${results.filter(r => r.corpuscleURI).length}`);
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
        
        if (this.llmHandler && typeof this.llmHandler.dispose === 'function') {
            await this.llmHandler.dispose();
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
ExtractConcepts.js - Extract concepts from ragno:TextElement chunks using LLM

Usage: node examples/document/ExtractConcepts.js [options]

Options:
  --limit <number>   Maximum number of TextElements to process (default: 0, no limit)
  --graph <uri>      Target graph URI (default: from config)
  --help, -h         Show this help message

Description:
  This script finds ragno:TextElement instances (chunks) that don't have concepts extracted,
  uses the configured LLM to extract concepts from their content, and stores the results
  as ragno:Unit instances with concept labels. Creates ragno:Corpuscle collections that
  group all extracted concepts from each TextElement.

Examples:
  node examples/document/ExtractConcepts.js                                    # Process all TextElements
  node examples/document/ExtractConcepts.js --limit 5                         # Process up to 5 TextElements
  node examples/document/ExtractConcepts.js --graph "http://example.org/docs" # Use specific graph
        `);
        return;
    }

    logger.info('🚀 Starting Concept Extraction for TextElements');

    const extractor = new ExtractConcepts();
    
    try {
        await extractor.init();
        
        const options = {
            limit: parseInt(args.limit) || 0,  // Default to 0 (no limit)
            graph: args.graph
        };
        
        await extractor.run(options);
        
        logger.info('\\n=== Concept Extraction Completed Successfully ===');
        
    } catch (error) {
        logger.error('\\n❌ Concept extraction failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\\nTroubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running and accessible');
        logger.info('- Check LLM provider configuration (Ollama/Nomic)');
        logger.info('- Verify network connectivity to LLM service');
        logger.info('- Ensure required models are available: ollama pull qwen2:1.5b');
        
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await extractor.cleanup();
        
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

export default ExtractConcepts;