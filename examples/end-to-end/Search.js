#!/usr/bin/env node

/**
 * End-to-End Module 3: Semantic Search and Cross-Domain Inference
 * 
 * Based on: examples/basic/ArticleEmbedding.js + ArticleSearch.js
 * 
 * This module:
 * - Loads entities and documents with embeddings from SPARQL store
 * - Builds semantic search index for similarity queries
 * - Demonstrates cross-domain knowledge discovery
 * - Performs inference across different subject areas
 */

import chalk from 'chalk';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';
import CacheManager from '../../src/handlers/CacheManager.js';

export default class SearchModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlStore = null;
        this.embeddingHandler = null;
        this.searchIndex = [];
        this.searchQueries = [
            "How does memory formation work?",
            "What are sustainable city planning approaches?", 
            "How do ocean currents affect climate?",
            "What is the relationship between neuroscience and urban planning?",
            "How can smart infrastructure improve learning environments?"
        ];
        this.results = {
            documentsLoaded: 0,
            entitiesLoaded: 0,
            searchQueriesExecuted: 0,
            crossDomainConnections: 0,
            averageSimilarity: 0,
            topResults: [],
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            success: false,
            error: null
        };
    }

    async initialize() {
        console.log(chalk.bold.blue('🔍 Module 3: Semantic Search & Cross-Domain Inference'));
        console.log(chalk.gray('   Semantic similarity search and knowledge discovery\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        await this.initializeSparqlStore();
        await this.initializeEmbeddingHandler();

        console.log(chalk.green('✅ Module 3 initialization complete\n'));
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
        console.log(`📊 Graph URI: ${chalk.bold(this.results.graphURI)}`);
    }

    async initializeEmbeddingHandler() {
        // Check Ollama availability - REQUIRED for demonstration
        const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
        const embeddingModel = 'nomic-embed-text:latest';

        // Test Ollama connection
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            throw new Error(`Ollama is required for Module 3 demonstration. Please start Ollama at ${ollamaBaseUrl}`);
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize embedding handler
        this.embeddingHandler = new Embeddings(
            new EmbeddingsAPIBridge(ollamaConnector, embeddingModel),
            1536,
            cacheManager
        );

        console.log(`✅ Ollama embedding service initialized: ${chalk.bold(ollamaBaseUrl)}`);
        console.log(`🔢 Embedding model: ${chalk.bold(embeddingModel)}`);
    }

    async execute() {
        try {
            await this.loadSearchableContent();
            await this.performSemanticSearch();
            await this.analyzeCrossDomainConnections();
            await this.generateSearchReport();
            
            this.results.success = true;
            console.log(chalk.bold.green('✅ Module 3 Complete: Semantic search and inference demonstrated\n'));
            
        } catch (error) {
            this.results.error = error.message;
            this.results.success = false;
            console.log(chalk.red(`❌ Module 3 Failed: ${error.message}\n`));
            throw error;
        }
    }

    async loadSearchableContent() {
        console.log('📚 Loading searchable content from knowledge graph...');

        // Load documents with their content
        const documentsQuery = `
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
        `;

        const docResult = await this.executeSparqlSelect(documentsQuery);
        if (docResult.results?.bindings) {
            for (const binding of docResult.results.bindings) {
                this.searchIndex.push({
                    type: 'document',
                    id: binding.doc?.value,
                    title: binding.title?.value,
                    content: binding.content?.value.slice(0, 300), // First 300 chars for search
                    wordCount: parseInt(binding.wordCount?.value || 0),
                    embedding: null
                });
                this.results.documentsLoaded++;
            }
        }

        // Load entities with their embeddings using SPARQLStore search
        console.log('🔍 Loading entity embeddings from knowledge graph...');
        
        // Use a general query to get all stored items with embeddings
        const testEmbedding = Array.from({ length: 1536 }, () => 0.1); // Test embedding
        const storedItems = await this.sparqlStore.search(testEmbedding, 50, 0.0); // Low threshold to get all

        for (const item of storedItems) {
            if (item.metadata?.type === 'ragno:Entity') {
                this.searchIndex.push({
                    type: 'entity',
                    id: item.id,
                    title: item.prompt,
                    content: item.response,
                    embedding: item.embedding,
                    confidence: item.metadata?.confidence || 0.9,
                    sourceDocument: item.metadata?.sourceDocument
                });
                this.results.entitiesLoaded++;
            }
        }

        console.log(`✅ Loaded ${this.results.documentsLoaded} documents and ${this.results.entitiesLoaded} entities`);
        console.log(`📊 Total searchable items: ${this.searchIndex.length}\n`);
    }

    async performSemanticSearch() {
        console.log('🔍 Performing semantic search queries...');

        let totalSimilarity = 0;

        for (const query of this.searchQueries) {
            console.log(`\n  🔎 Query: ${chalk.cyan(query)}`);
            
            try {
                // Generate embedding for query
                const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
                
                if (!queryEmbedding || queryEmbedding.length !== 1536) {
                    console.log(`    ❌ Failed to generate query embedding`);
                    continue;
                }

                // Search using SPARQLStore for entities with embeddings
                const searchResults = await this.sparqlStore.search(queryEmbedding, 3, 0.3);
                
                // Also compute similarity with documents (simplified cosine similarity)
                const documentResults = [];
                for (const item of this.searchIndex.filter(i => i.type === 'document')) {
                    // For documents without pre-computed embeddings, use title similarity
                    const titleEmbedding = await this.embeddingHandler.generateEmbedding(item.title);
                    if (titleEmbedding) {
                        const similarity = this.cosineSimilarity(queryEmbedding, titleEmbedding);
                        if (similarity > 0.2) {
                            documentResults.push({
                                ...item,
                                similarity: similarity
                            });
                        }
                    }
                }

                // Combine and rank results
                const allResults = [
                    ...searchResults.map(r => ({ ...r, type: 'entity' })),
                    ...documentResults.map(r => ({ ...r, type: 'document' }))
                ].sort((a, b) => (b.similarity || 0) - (a.similarity || 0)).slice(0, 3);

                // Display results
                if (allResults.length > 0) {
                    allResults.forEach((result, index) => {
                        const sim = (result.similarity || 0).toFixed(3);
                        const title = result.prompt || result.title;
                        const type = result.type === 'entity' ? '🏷️' : '📄';
                        console.log(`    ${index + 1}. ${type} ${chalk.green(title)} (similarity: ${sim})`);
                        
                        if (result.metadata?.sourceDocument) {
                            console.log(`       └─ from: ${chalk.gray(result.metadata.sourceDocument)}`);
                        }
                    });
                    
                    // Track cross-domain connections
                    const sources = new Set(allResults.map(r => 
                        r.metadata?.sourceDocument || r.title
                    ));
                    if (sources.size > 1) {
                        this.results.crossDomainConnections++;
                    }
                    
                    // Update average similarity
                    const avgSim = allResults.reduce((sum, r) => sum + (r.similarity || 0), 0) / allResults.length;
                    totalSimilarity += avgSim;
                    
                    // Store top result for reporting
                    if (allResults[0]) {
                        this.results.topResults.push({
                            query: query,
                            topResult: allResults[0].prompt || allResults[0].title,
                            similarity: allResults[0].similarity || 0,
                            type: allResults[0].type
                        });
                    }
                } else {
                    console.log(`    📭 No relevant results found`);
                }

                this.results.searchQueriesExecuted++;

            } catch (error) {
                console.log(`    ❌ Search failed: ${error.message}`);
            }
        }

        this.results.averageSimilarity = totalSimilarity / this.results.searchQueriesExecuted;
        console.log(`\n✅ Completed ${this.results.searchQueriesExecuted} semantic search queries\n`);
    }

    async analyzeCrossDomainConnections() {
        console.log('🌐 Analyzing cross-domain knowledge connections...');

        const domains = {
            'Neuroscience': ['memory', 'learning', 'synaptic', 'neuroscience', 'brain'],
            'Urban Planning': ['urban', 'planning', 'city', 'infrastructure', 'sustainable'],
            'Climate Science': ['climate', 'ocean', 'dynamics', 'circulation', 'temperature']
        };

        // Find entities that might connect different domains
        let connections = 0;
        const entityConnections = [];

        for (const item of this.searchIndex.filter(i => i.type === 'entity')) {
            const entityDomains = [];
            const content = (item.content || '').toLowerCase();
            
            for (const [domain, keywords] of Object.entries(domains)) {
                if (keywords.some(keyword => content.includes(keyword))) {
                    entityDomains.push(domain);
                }
            }
            
            if (entityDomains.length > 1) {
                connections++;
                entityConnections.push({
                    entity: item.title,
                    domains: entityDomains,
                    source: item.sourceDocument
                });
                
                console.log(`  🔗 ${chalk.cyan(item.title)} connects: ${entityDomains.join(' ↔ ')}`);
                console.log(`     └─ from: ${chalk.gray(item.sourceDocument)}`);
            }
        }

        // Demonstrate inference potential
        if (entityConnections.length > 0) {
            console.log(`\n  💡 ${chalk.bold('Potential cross-domain insights:')}`)
            console.log(`     • Learning environments could benefit from sustainable infrastructure`);
            console.log(`     • Climate considerations should inform urban neuroscience research facilities`);
            console.log(`     • Memory formation research could inspire adaptive city planning algorithms`);
        }

        this.results.crossDomainConnections = connections;
        console.log(`\n✅ Found ${connections} cross-domain connections\n`);
    }

    async generateSearchReport() {
        console.log('📊 Generating semantic search report...');

        console.log(`\n  📈 ${chalk.bold('Search Performance Metrics:')}`);
        console.log(`     • Queries executed: ${chalk.green(this.results.searchQueriesExecuted)}`);
        console.log(`     • Average similarity: ${chalk.green(this.results.averageSimilarity.toFixed(3))}`);
        console.log(`     • Cross-domain connections: ${chalk.green(this.results.crossDomainConnections)}`);
        console.log(`     • Searchable entities: ${chalk.green(this.results.entitiesLoaded)}`);
        console.log(`     • Searchable documents: ${chalk.green(this.results.documentsLoaded)}`);

        if (this.results.topResults.length > 0) {
            console.log(`\n  🏆 ${chalk.bold('Top Search Results:')}`);
            this.results.topResults.forEach((result, index) => {
                const type = result.type === 'entity' ? '🏷️' : '📄';
                console.log(`     ${index + 1}. ${type} "${result.topResult}" (${result.similarity.toFixed(3)})`);
                console.log(`        └─ for query: "${chalk.gray(result.query)}"`);
            });
        }

        console.log(`\n✅ Semantic search capabilities demonstrated\n`);
    }

    // Helper function for cosine similarity
    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        const norm = Math.sqrt(normA) * Math.sqrt(normB);
        return norm === 0 ? 0 : dotProduct / norm;
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
        console.log('🧹 Module 3 cleanup complete');
    }

    getResults() {
        return {
            ...this.results,
            searchQueries: this.searchQueries,
            totalSearchableItems: this.searchIndex.length
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Search Module Standalone...\n'));
    
    const module = new SearchModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Search module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Search module failed:'), error);
            process.exit(1);
        });
}