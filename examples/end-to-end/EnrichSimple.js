#!/usr/bin/env node

/**
 * End-to-End Module 2: Simplified Knowledge Graph Construction
 * 
 * This simplified version extracts key entities directly from documents
 * without complex corpus decomposition, focusing on speed while still
 * demonstrating real knowledge graph construction and embedding generation.
 */

import chalk from 'chalk';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';
import CacheManager from '../../src/handlers/CacheManager.js';
import ParseHelper from '../../src/utils/ParseHelper.js';

export default class EnrichSimpleModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlStore = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.documents = [];
        this.extractedEntities = [];
        this.results = {
            documentsProcessed: 0,
            entitiesExtracted: 0,
            embeddingsGenerated: 0,
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            ragnoGraphURI: 'http://purl.org/stuff/ragno/corpus/end-to-end',
            success: false,
            error: null
        };
    }

    async initialize() {
        console.log(chalk.bold.blue('🕸️ Module 2: Knowledge Graph Construction (Simplified)'));
        console.log(chalk.gray('   Direct entity extraction and embedding generation\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        await this.initializeSparqlStore();
        await this.initializeLLMServices();

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
        // Create LLM handler based on config
        const llmHandler = await this.createLLMHandler();
        console.log('✅ LLM handler created with config-based provider');
        
        // Initialize embedding handler (still uses Ollama for embeddings)
        const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
        const embeddingModel = 'nomic-embed-text:latest';

        // Test Ollama connection for embeddings
        console.log('🔌 Testing Ollama connection for embeddings...');
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            throw new Error(`Ollama is required for embeddings. Please start Ollama at ${ollamaBaseUrl}`);
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers
        this.embeddingHandler = new Embeddings(
            new EmbeddingsAPIBridge(ollamaConnector, embeddingModel, 1536, cacheManager)
        );

        this.llmHandler = llmHandler;

        console.log(`✅ LLM and embedding services initialized`);
        console.log(`📄 Chat provider: ${chalk.bold(this.config.get('models.chat.provider') || 'ollama')}`);
        console.log(`🔢 Embedding model: ${chalk.bold(embeddingModel)}`);
    }

    /**
     * Create LLM handler based on config
     */
    async createLLMHandler() {
        const chatConfig = this.config.get('models.chat');
        const provider = chatConfig?.provider || 'ollama';
        const model = chatConfig?.model || 'qwen2:1.5b';
        
        console.log(`🤖 Initializing ${provider} LLM handler with model: ${model}`);
        
        let llmConnector;
        
        if (provider === 'mistral') {
            const apiKey = process.env.MISTRAL_API_KEY;
            if (!apiKey) {
                console.log('⚠️  MISTRAL_API_KEY not found, falling back to Ollama');
                llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
            } else {
                console.log(`✅ Using Mistral API with model: ${model}`);
                llmConnector = new MistralConnector(apiKey, 'https://api.mistral.ai/v1', model);
                await llmConnector.initialize();
            }
        } else if (provider === 'claude') {
            const apiKey = process.env.CLAUDE_API_KEY;
            if (!apiKey) {
                console.log('⚠️  CLAUDE_API_KEY not found, falling back to Ollama');
                llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
            } else {
                llmConnector = new ClaudeConnector(apiKey, model);
            }
        } else {
            // Default to Ollama
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            llmConnector = new OllamaConnector(ollamaBaseUrl, model);
        }
        
        return new LLMHandler(llmConnector, model);
    }

    async execute() {
        try {
            await this.loadDocumentsFromSparql();
            await this.extractKeyEntities();
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

    async extractKeyEntities() {
        console.log('🔍 Extracting key entities from documents...');

        for (let i = 0; i < this.documents.length; i++) {
            const doc = this.documents[i];
            console.log(`  📄 Processing: ${chalk.cyan(doc.title)}`);
            
            // Add a small delay between documents to avoid overwhelming the API
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            }
            
            // Extract first 500 characters for quick entity extraction
            const excerpt = doc.content.slice(0, 500);
            
            // Simple entity extraction prompt
            const prompt = `Extract 2-3 key entities (important concepts, people, places, or topics) from this text. Return only a JSON array of strings.

Text: "${excerpt}"

Return format: ["Entity1", "Entity2", "Entity3"]

Key entities:`;

            try {
                // Add timeout for individual extraction
                const extractionPromise = this.llmHandler.generateResponse(prompt, '', {
                    max_tokens: 100,
                    temperature: 0.1
                });

                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Entity extraction timeout')), 10000)
                );

                const response = await Promise.race([extractionPromise, timeoutPromise]);
                
                // Parse response using ParseHelper
                let entities = [];
                try {
                    const cleanedResponse = ParseHelper.resolveSyntax(response);
                    if (cleanedResponse === false) {
                        console.log(`    ⚠️  ParseHelper could not resolve syntax, falling back to text extraction`);
                        // Fallback: extract quoted strings
                        const quotes = response.match(/"([^"]+)"/g);
                        if (quotes) {
                            entities = quotes.map(q => q.slice(1, -1)).slice(0, 3);
                        } else {
                            entities = [doc.title]; // Last resort: use document title
                        }
                    } else {
                        entities = JSON.parse(cleanedResponse);
                        if (!Array.isArray(entities)) {
                            entities = [entities];
                        }
                    }
                } catch (parseError) {
                    console.log(`    ⚠️  JSON parse failed, using document title: ${parseError.message}`);
                    entities = [doc.title]; // Last resort: use document title
                }

                // Store entities with metadata
                for (const entityName of entities.slice(0, 3)) { // Limit to 3
                    if (entityName && entityName.length > 2) {
                        this.extractedEntities.push({
                            name: entityName,
                            sourceDocument: doc.title,
                            sourceURI: doc.uri,
                            type: 'concept',
                            confidence: 0.9
                        });
                        this.results.entitiesExtracted++;
                    }
                }

                console.log(`    ✅ Extracted ${entities.length} entities: ${entities.slice(0, 3).join(', ')}`);

            } catch (error) {
                console.log(`    ⚠️  Extraction failed: ${error.message}, using document title`);
                // Fallback: use document title as entity
                this.extractedEntities.push({
                    name: doc.title,
                    sourceDocument: doc.title,
                    sourceURI: doc.uri,
                    type: 'document',
                    confidence: 1.0
                });
                this.results.entitiesExtracted++;
            }
        }

        console.log(`✅ Total entities extracted: ${this.results.entitiesExtracted}\n`);
    }

    async storeEnrichedData() {
        console.log('💾 Storing enriched knowledge graph data...');

        let stored = 0;

        for (const entity of this.extractedEntities) {
            try {
                console.log(`  📦 Storing entity: ${chalk.cyan(entity.name)}`);

                // Generate embedding for entity
                const embedding = await this.embeddingHandler.generateEmbedding(entity.name);

                if (embedding && embedding.length === 1536) {
                    const entityData = {
                        id: `${this.results.ragnoGraphURI}/entity/${encodeURIComponent(entity.name)}`,
                        prompt: entity.name,
                        response: `${entity.name} (extracted from ${entity.sourceDocument})`,
                        embedding: embedding,
                        concepts: [entity.name],
                        timestamp: new Date().toISOString(),
                        metadata: {
                            type: 'ragno:Entity',
                            subType: entity.type,
                            confidence: entity.confidence,
                            sourceDocument: entity.sourceDocument,
                            sourceURI: entity.sourceURI,
                            ragnoGraph: this.results.ragnoGraphURI,
                            extractionMethod: 'simplified_llm'
                        }
                    };

                    await this.sparqlStore.store(entityData);
                    stored++;
                    this.results.embeddingsGenerated++;
                    
                    console.log(`    ✅ Stored with embedding (${embedding.length}D)`);
                } else {
                    console.log(`    ❌ Failed to generate valid embedding`);
                }

            } catch (error) {
                console.log(chalk.yellow(`    ⚠️  Failed to store entity: ${error.message}`));
            }
        }

        console.log(`✅ Stored ${stored} enriched knowledge graph entities\n`);
    }

    async verifyEnrichment() {
        console.log('🔍 Verifying knowledge graph enrichment...');

        const verifyQuery = `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT 
                (COUNT(?entity) as ?entityCount)
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?entity semem:hasMetadata ?meta .
                    ?meta semem:type "ragno:Entity" .
                }
            }
        `;

        const result = await this.executeSparqlSelect(verifyQuery);
        const binding = result.results?.bindings?.[0];
        
        if (binding) {
            const storedEntities = parseInt(binding.entityCount?.value || 0);
            
            console.log(`  📊 Verified storage:`);
            console.log(`    🏷️  Entities: ${chalk.bold(storedEntities)}`);
            console.log(`    🔢 Embeddings generated: ${chalk.bold(this.results.embeddingsGenerated)}`);
            
            if (storedEntities > 0) {
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
            entitiesList: this.extractedEntities.map(e => ({
                name: e.name,
                type: e.type,
                confidence: e.confidence,
                sourceDocument: e.sourceDocument
            }))
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Simplified Enrich Module Standalone...\n'));
    
    const module = new EnrichSimpleModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Simplified Enrich module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Simplified Enrich module failed:'), error);
            process.exit(1);
        });
}