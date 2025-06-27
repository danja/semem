#!/usr/bin/env node

/**
 * End-to-End Module 2: Knowledge Graph Construction with RDF Modeling
 * 
 * Based on: examples/ragno/OllamaEnrichSPARQL.js
 * 
 * This module:
 * - Retrieves documents from SPARQL store (ingested by Module 1)
 * - Performs corpus decomposition using Ragno to extract entities and relationships
 * - Stores entities and semantic units back into SPARQL with embeddings
 * - Provides enriched knowledge graph for subsequent modules
 */

import chalk from 'chalk';
import logger from 'loglevel';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import { decomposeCorpus } from '../../src/ragno/decomposeCorpus.js';
import RDFGraphManager from '../../src/ragno/core/RDFGraphManager.js';
import NamespaceManager from '../../src/ragno/core/NamespaceManager.js';
import rdf from 'rdf-ext';

export default class EnrichModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlStore = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.rdfManager = null;
        this.documents = [];
        this.results = {
            documentsProcessed: 0,
            entitiesExtracted: 0,
            relationshipsFound: 0,
            semanticUnitsCreated: 0,
            embeddingsGenerated: 0,
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            ragnoGraphURI: 'http://purl.org/stuff/ragno/corpus/end-to-end',
            success: false,
            error: null
        };
        
        // Configure logging
        logger.setLevel('info');
    }

    async initialize() {
        console.log(chalk.bold.blue('🕸️ Module 2: Knowledge Graph Construction'));
        console.log(chalk.gray('   Extracting entities and relationships using Ragno\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        await this.initializeSparqlStore();
        await this.initializeLLMServices();
        await this.initializeRDFInfrastructure();

        console.log(chalk.green('✅ Module 2 initialization complete\n'));
    }

    async initializeSparqlStore() {
        // Get SPARQL endpoint configuration
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        const endpoint = sparqlEndpoints[0];
        const sparqlConfig = {
            query: `${endpoint.urlBase}${endpoint.query}`,
            update: `${endpoint.urlBase}${endpoint.update}`
        };

        this.sparqlStore = new SPARQLStore(sparqlConfig, {
            user: endpoint.user,
            password: endpoint.password,
            graphName: this.results.graphURI,
            dimension: 1536
        });

        console.log(`✅ SPARQL store initialized: ${chalk.bold(endpoint.urlBase)}`);
        console.log(`📊 Source graph: ${chalk.bold(this.results.graphURI)}`);
        console.log(`🕸️ Ragno graph: ${chalk.bold(this.results.ragnoGraphURI)}`);
    }

    async initializeLLMServices() {
        // Get provider configuration
        const embeddingProvider = this.config.get('embeddingProvider') || 'ollama';
        const embeddingModel = this.config.get('embeddingModel') || 'nomic-embed-text';
        
        // Get chat configuration from the models.chat config structure
        const chatConfig = this.config.get('models.chat');
        const chatProvider = chatConfig?.provider || 'ollama';
        const chatModel = chatConfig?.model || 'qwen2:1.5b';

        console.log(`🤖 Using embedding provider: ${chalk.bold(embeddingProvider)}`);
        console.log(`💬 Using chat provider: ${chalk.bold(chatProvider)}`);
        console.log(`📄 Chat model: ${chalk.bold(chatModel)}`);
        console.log(`🔢 Embedding model: ${chalk.bold(embeddingModel)}`);

        // Create embedding connector using factory
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
            
            // Test Ollama connection if using Ollama
            try {
                const response = await fetch(`${ollamaBaseUrl}/api/version`);
                if (!response.ok) {
                    throw new Error(`Ollama connection test failed`);
                }
                console.log(`🏃 Using Ollama at: ${chalk.bold(ollamaBaseUrl)}`);
            } catch (error) {
                console.log(chalk.yellow(`⚠️ Ollama connection test failed, but continuing with provider`));
            }
        }

        const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
        
        // Create separate chat connector based on chat provider
        let chatConnector;
        if (chatProvider === 'mistral') {
            const apiKey = process.env.MISTRAL_API_KEY;
            if (!apiKey) {
                console.log(chalk.yellow('⚠️  MISTRAL_API_KEY not found, falling back to Ollama'));
                chatConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
            } else {
                console.log(`✅ Using Mistral API with model: ${chatModel}`);
                chatConnector = new MistralConnector(apiKey, 'https://api.mistral.ai/v1', chatModel);
                await chatConnector.initialize();
            }
        } else if (chatProvider === 'claude') {
            const apiKey = process.env.CLAUDE_API_KEY;
            if (!apiKey) {
                console.log(chalk.yellow('⚠️  CLAUDE_API_KEY not found, falling back to Ollama'));
                chatConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
            } else {
                chatConnector = new ClaudeConnector(apiKey, chatModel);
            }
        } else {
            // Default to Ollama for chat
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            chatConnector = new OllamaConnector(ollamaBaseUrl, chatModel);
        }
        
        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers with separate connectors
        this.embeddingHandler = new EmbeddingHandler(
            embeddingConnector,
            embeddingModel,
            1536,
            cacheManager
        );

        this.llmHandler = new LLMHandler(chatConnector, chatModel);

        console.log(`✅ Embedding services initialized with ${embeddingProvider}`);
        console.log(`✅ Chat services initialized with ${chatProvider}`);
    }


    async initializeRDFInfrastructure() {
        // Initialize RDF infrastructure for Ragno
        const namespaceManager = new NamespaceManager();
        this.rdfManager = new RDFGraphManager({ namespace: namespaceManager });

        console.log('✅ RDF infrastructure initialized');
    }

    async execute() {
        try {
            await this.loadDocumentsFromSparql();
            await this.performCorpusDecomposition();
            await this.storeEnrichedData();
            await this.verifyEnrichment();
            
            this.results.success = true;
            console.log(chalk.bold.green('✅ Module 2 Complete: Knowledge graph successfully constructed\n'));
            
        } catch (error) {
            this.results.error = error.message;
            this.results.success = false;
            console.log(chalk.red(`❌ Module 2 Failed: ${error.message}\n`));
            throw error;
        }
    }

    async loadDocumentsFromSparql() {
        console.log('📚 Loading documents from SPARQL store...');

        const query = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?doc ?title ?content ?wordCount
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?doc a semem:Document ;
                         rdfs:label ?title ;
                         semem:content ?content ;
                         semem:wordCount ?wordCount ;
                         semem:status "ingested" .
                }
            }
            ORDER BY DESC(?wordCount)
        `;

        const result = await this.executeSparqlSelect(query);
        
        if (result.results?.bindings) {
            for (const binding of result.results.bindings) {
                const doc = {
                    uri: binding.doc?.value,
                    title: binding.title?.value,
                    content: binding.content?.value,
                    wordCount: parseInt(binding.wordCount?.value || 0)
                };
                this.documents.push(doc);
                this.results.documentsProcessed++;
                
                console.log(`  📄 ${chalk.green(doc.title)}: ${doc.wordCount} words`);
            }
        }

        if (this.documents.length === 0) {
            throw new Error('No documents found in SPARQL store. Run Module 1 (Ingest) first.');
        }

        console.log(`✅ Loaded ${this.documents.length} documents for processing\n`);
    }

    async performCorpusDecomposition() {
        console.log('🔍 Performing corpus decomposition with Ragno...');

        // Prepare text chunks for decomposition - limit content size for speed
        const textChunks = this.documents.map(doc => ({
            content: doc.content.slice(0, 800), // Limit to first 800 characters for faster processing
            source: doc.title,
            metadata: { 
                title: doc.title,
                wordCount: doc.wordCount,
                uri: doc.uri
            }
        }));

        console.log(`  🧩 Processing ${textChunks.length} text chunks...`);

        try {
            // Add timeout to prevent hanging
            const decompositionPromise = decomposeCorpus(textChunks, this.llmHandler, {
                extractRelationships: false, // Disable relationships for speed
                generateSummaries: false, // Disable summaries for speed
                minEntityConfidence: 0.9, // Only highest confidence entities
                maxEntitiesPerUnit: 2, // Limit to top 2 entities per unit
                maxUnitsPerChunk: 2 // Limit semantic units per document
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Decomposition timeout after 15 seconds')), 15000)
            );

            const decompositionResult = await Promise.race([decompositionPromise, timeoutPromise]);
            const { units, entities, relationships } = decompositionResult;

            this.results.entitiesExtracted = entities?.length || 0;
            this.results.relationshipsFound = relationships?.length || 0;
            this.results.semanticUnitsCreated = units?.length || 0;

            // Store results for processing
            this.decompositionResult = { units: units || [], entities: entities || [], relationships: relationships || [] };

            console.log(`  ✅ Extracted ${chalk.bold(this.results.entitiesExtracted)} entities`);
            console.log(`  ✅ Found ${chalk.bold(this.results.relationshipsFound)} relationships`);
            console.log(`  ✅ Created ${chalk.bold(this.results.semanticUnitsCreated)} semantic units`);

            // Display sample entities
            if (this.results.entitiesExtracted > 0) {
                console.log('\n  📋 Extracted entities:');
                this.decompositionResult.entities.forEach((entity, index) => {
                    try {
                        const label = entity.getPrefLabel?.() || entity.name || 'Unknown Entity';
                        const isEntryPoint = entity.isEntryPoint?.() || false;
                        const subType = entity.getSubType?.() || entity.type || 'general';
                        console.log(`    ${index + 1}. ${chalk.cyan(label)} (${subType})`);
                    } catch (error) {
                        console.log(`    ${index + 1}. Entity processing error: ${error.message}`);
                    }
                });
            }

        } catch (error) {
            console.log(chalk.red(`❌ Corpus decomposition failed: ${error.message}`));
            throw new Error(`Module 2 requires working Ragno decomposition: ${error.message}`);
        }

        console.log('✅ Corpus decomposition complete\n');
    }


    async storeEnrichedData() {
        console.log('💾 Storing enriched knowledge graph data...');

        let stored = 0;

        // Store entities with embeddings
        if (this.decompositionResult.entities.length > 0) {
            console.log(`  📦 Storing ${this.decompositionResult.entities.length} entities...`);
            
            for (const entity of this.decompositionResult.entities) {
                try {
                    const entityLabel = entity.getPrefLabel();
                    const entityContent = entity.getContent?.() || entityLabel;

                    // Generate embedding
                    const embedding = await this.embeddingHandler.generateEmbedding(entityContent);

                    if (embedding && embedding.length === 1536) {
                        const entityData = {
                            id: entity.getURI(),
                            prompt: entityLabel,
                            response: entityContent,
                            embedding: embedding,
                            concepts: [entityLabel],
                            timestamp: new Date().toISOString(),
                            metadata: {
                                type: 'ragno:Entity',
                                subType: entity.getSubType?.() || 'general',
                                isEntryPoint: entity.isEntryPoint?.() || false,
                                ragnoGraph: this.results.ragnoGraphURI,
                                source: 'corpus_decomposition'
                            }
                        };

                        await this.sparqlStore.store(entityData);
                        stored++;
                        this.results.embeddingsGenerated++;
                        
                        if (stored % 5 === 0) {
                            console.log(`    📊 Stored ${stored}/${this.decompositionResult.entities.length} entities`);
                        }
                    }

                } catch (error) {
                    console.log(chalk.yellow(`    ⚠️  Failed to store entity: ${error.message}`));
                }
            }
        }

        // Store semantic units with embeddings
        if (this.decompositionResult.units.length > 0) {
            console.log(`  📦 Storing ${this.decompositionResult.units.length} semantic units...`);
            
            for (const unit of this.decompositionResult.units) {
                try {
                    const unitContent = unit.getContent();
                    const unitSummary = unit.getSummary?.() || 'Semantic Unit';

                    if (unitContent) {
                        const embedding = await this.embeddingHandler.generateEmbedding(unitContent);

                        if (embedding && embedding.length === 1536) {
                            const unitData = {
                                id: unit.getURI(),
                                prompt: unitSummary,
                                response: unitContent,
                                embedding: embedding,
                                concepts: [unitSummary],
                                timestamp: new Date().toISOString(),
                                metadata: {
                                    type: 'ragno:Unit',
                                    summary: unitSummary,
                                    source: unit.getSourceDocument?.() || 'unknown',
                                    ragnoGraph: this.results.ragnoGraphURI,
                                    derivedFrom: 'corpus_decomposition'
                                }
                            };

                            await this.sparqlStore.store(unitData);
                            stored++;
                            this.results.embeddingsGenerated++;
                        }
                    }

                } catch (error) {
                    console.log(chalk.yellow(`    ⚠️  Failed to store semantic unit: ${error.message}`));
                }
            }
        }

        console.log(`✅ Stored ${stored} enriched knowledge graph items\n`);
    }

    async verifyEnrichment() {
        console.log('🔍 Verifying knowledge graph enrichment...');

        const verifyQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT 
                (COUNT(?entity) as ?entityCount)
                (COUNT(?unit) as ?unitCount)
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    OPTIONAL { 
                        ?entity semem:hasMetadata ?entityMeta .
                        ?entityMeta semem:type "ragno:Entity" .
                    }
                    OPTIONAL { 
                        ?unit semem:hasMetadata ?unitMeta .
                        ?unitMeta semem:type "ragno:Unit" .
                    }
                }
            }
        `;

        const result = await this.executeSparqlSelect(verifyQuery);
        const binding = result.results?.bindings?.[0];
        
        if (binding) {
            const storedEntities = parseInt(binding.entityCount?.value || 0);
            const storedUnits = parseInt(binding.unitCount?.value || 0);
            
            console.log(`  📊 Verified storage:`);
            console.log(`    🏷️  Entities: ${chalk.bold(storedEntities)}`);
            console.log(`    📦 Semantic units: ${chalk.bold(storedUnits)}`);
            console.log(`    🔢 Embeddings generated: ${chalk.bold(this.results.embeddingsGenerated)}`);
            
            if (storedEntities > 0 || storedUnits > 0) {
                console.log(`  ✅ Knowledge graph enrichment verified\n`);
            } else {
                console.log(chalk.yellow('  ⚠️  No enriched data found in verification\n'));
            }
        }
    }

    async executeSparqlSelect(query) {
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        const endpoint = sparqlEndpoints[0];
        const queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
        
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': `Basic ${Buffer.from(`${endpoint.user}:${endpoint.password}`).toString('base64')}`
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async cleanup() {
        console.log('🧹 Module 2 cleanup complete');
    }

    getResults() {
        return {
            ...this.results,
            decompositionResult: this.decompositionResult ? {
                entitiesCount: this.decompositionResult.entities.length,
                relationshipsCount: this.decompositionResult.relationships.length,
                unitsCount: this.decompositionResult.units.length
            } : null
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Enrich Module Standalone...\n'));
    
    const module = new EnrichModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Enrich module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Enrich module failed:'), error);
            process.exit(1);
        });
}