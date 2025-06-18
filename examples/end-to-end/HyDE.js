#!/usr/bin/env node

/**
 * @fileoverview Module 8: HyDE (Hypothetical Document Embeddings) Enhancement
 * 
 * This module implements the HyDE (Hypothetical Document Embeddings) technique
 * for enhanced retrieval. Instead of directly embedding user queries, HyDE
 * generates hypothetical documents that would contain the answer to the query,
 * then uses those document embeddings for more effective semantic search.
 * 
 * Dependencies: Module 3 (Search) - requires entity embeddings and search capabilities
 * 
 * Usage:
 *   node examples/end-to-end/HyDE.js
 * 
 * Features:
 * - Hypothetical document generation using LLM
 * - Enhanced embedding generation for improved retrieval
 * - Comparative analysis of standard vs HyDE search
 * - Cross-domain query expansion and refinement
 * - Search result quality metrics and evaluation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Config from '../../src/Config.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import EmbeddingHandler from '../../src/handlers/EmbeddingHandler.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import CacheManager from '../../src/handlers/CacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * HyDE implementation for enhanced retrieval
 */
class HyDERetriever {
    constructor(llmHandler, embeddingHandler) {
        this.llmHandler = llmHandler;
        this.embeddingHandler = embeddingHandler;
        this.entityEmbeddings = [];
        this.documentEmbeddings = [];
    }

    /**
     * Generate hypothetical document for a given query
     */
    async generateHypotheticalDocument(query, domain = null) {
        const domainContext = domain ? ` in the context of ${domain}` : '';
        
        const prompt = `Write a detailed, informative paragraph that would contain comprehensive information to answer the following question${domainContext}:

Question: ${query}

Write as if you are an expert providing a thorough answer with specific details, examples, and relevant concepts. The paragraph should be 3-4 sentences long and contain the type of information someone would find in an authoritative source.

Paragraph:`;

        try {
            const response = await this.llmHandler.generateResponse(
                prompt,
                '', // no additional context needed
                {
                    temperature: 0.7
                }
            );
            
            // Clean up the response
            let hypotheticalDoc = response.trim();
            
            // Remove any leading/trailing quotes or artifacts
            hypotheticalDoc = hypotheticalDoc.replace(/^["']|["']$/g, '');
            
            // Ensure it ends with proper punctuation
            if (!/[.!?]$/.test(hypotheticalDoc)) {
                hypotheticalDoc += '.';
            }
            
            return hypotheticalDoc;
            
        } catch (error) {
            console.log(`⚠️  Failed to generate hypothetical document: ${error.message}`);
            // Fallback: return expanded query
            return `This document discusses ${query} and provides comprehensive information about the topic, including relevant details, examples, and implications.`;
        }
    }

    /**
     * Generate multiple hypothetical documents with different perspectives
     */
    async generateMultipleHypothetical(query, count = 3) {
        const perspectives = [
            'scientific research',
            'practical applications', 
            'theoretical foundations'
        ];
        
        const documents = [];
        
        for (let i = 0; i < Math.min(count, perspectives.length); i++) {
            const domain = perspectives[i];
            
            // Add a small delay between document generation to avoid rate limiting
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
            }
            
            const doc = await this.generateHypotheticalDocument(query, domain);
            documents.push({
                perspective: domain,
                content: doc
            });
        }
        
        return documents;
    }

    /**
     * Perform HyDE-enhanced search
     */
    async hydeSearch(query, topK = 5) {
        console.log(`🔍 HyDE Search: "${query}"`);
        
        // Step 1: Generate hypothetical documents
        console.log('   📝 Generating hypothetical documents...');
        const hypotheticalDocs = await this.generateMultipleHypothetical(query);
        
        // Step 2: Generate embeddings for hypothetical documents
        console.log('   🔢 Computing embeddings for hypothetical documents...');
        const hydeEmbeddings = [];
        for (const doc of hypotheticalDocs) {
            const embedding = await this.embeddingHandler.generateEmbedding(doc.content);
            if (embedding && embedding.length === 1536) {
                hydeEmbeddings.push({
                    ...doc,
                    embedding: embedding
                });
            }
        }
        
        // Step 3: Compute average embedding from hypothetical documents
        let avgEmbedding = null;
        if (hydeEmbeddings.length > 0) {
            avgEmbedding = this.computeAverageEmbedding(hydeEmbeddings.map(h => h.embedding));
        }
        
        // Step 4: Search using HyDE embedding
        console.log('   🎯 Searching with HyDE embedding...');
        const hydeResults = avgEmbedding ? 
            await this.searchWithEmbedding(avgEmbedding, topK) : [];
        
        // Step 5: For comparison, also do standard search
        console.log('   📊 Performing standard search for comparison...');
        const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
        const standardResults = queryEmbedding ? 
            await this.searchWithEmbedding(queryEmbedding, topK) : [];
        
        return {
            query: query,
            hypotheticalDocuments: hypotheticalDocs,
            hydeResults: hydeResults,
            standardResults: standardResults,
            improvement: this.calculateImprovement(hydeResults, standardResults)
        };
    }

    /**
     * Compute average of multiple embeddings
     */
    computeAverageEmbedding(embeddings) {
        if (embeddings.length === 0) return null;
        
        const dim = embeddings[0].length;
        const avgEmbedding = new Array(dim).fill(0);
        
        for (const embedding of embeddings) {
            for (let i = 0; i < dim; i++) {
                avgEmbedding[i] += embedding[i];
            }
        }
        
        for (let i = 0; i < dim; i++) {
            avgEmbedding[i] /= embeddings.length;
        }
        
        return avgEmbedding;
    }

    /**
     * Search using a given embedding
     */
    async searchWithEmbedding(queryEmbedding, topK = 5) {
        const results = [];
        
        // Search through entity embeddings
        for (const entity of this.entityEmbeddings) {
            const similarity = this.cosineSimilarity(queryEmbedding, entity.embedding);
            results.push({
                type: 'entity',
                id: entity.id,
                name: entity.name,
                similarity: similarity
            });
        }
        
        // Search through document embeddings if available
        for (const doc of this.documentEmbeddings) {
            const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
            results.push({
                type: 'document',
                id: doc.id,
                title: doc.title,
                similarity: similarity
            });
        }
        
        // Sort by similarity and return top K
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }

    /**
     * Calculate improvement metrics between HyDE and standard search
     */
    calculateImprovement(hydeResults, standardResults) {
        if (hydeResults.length === 0 || standardResults.length === 0) {
            return { improvement: 0, reason: 'Insufficient results for comparison' };
        }
        
        // Calculate average similarity scores
        const hydeAvgSim = hydeResults.reduce((sum, r) => sum + r.similarity, 0) / hydeResults.length;
        const standardAvgSim = standardResults.reduce((sum, r) => sum + r.similarity, 0) / standardResults.length;
        
        // Calculate overlap in top results
        const hydeTopIds = new Set(hydeResults.slice(0, 3).map(r => r.id || r.name));
        const standardTopIds = new Set(standardResults.slice(0, 3).map(r => r.id || r.name));
        const overlap = [...hydeTopIds].filter(id => standardTopIds.has(id)).length;
        
        return {
            hydeAvgSimilarity: hydeAvgSim,
            standardAvgSimilarity: standardAvgSim,
            improvement: ((hydeAvgSim - standardAvgSim) / standardAvgSim) * 100,
            topResultsOverlap: overlap,
            diversityGain: 3 - overlap // How many new results HyDE found
        };
    }

    /**
     * Load entity and document embeddings for search
     */
    async loadEmbeddings(entityEmbeddings, documentEmbeddings = []) {
        this.entityEmbeddings = entityEmbeddings;
        this.documentEmbeddings = documentEmbeddings;
        console.log(`✅ Loaded ${entityEmbeddings.length} entity embeddings and ${documentEmbeddings.length} document embeddings`);
    }
}

/**
 * Execute SPARQL SELECT query
 */
async function executeSparqlSelect(query, config) {
    const sparqlEndpoints = config.get('sparqlEndpoints');
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

/**
 * Create LLM handler based on config
 */
async function createLLMHandler(config) {
    const chatConfig = config.get('models.chat');
    const provider = chatConfig?.provider || 'ollama';
    const model = chatConfig?.model || 'qwen2:1.5b';
    
    console.log(`🤖 Initializing ${provider} LLM handler with model: ${model}`);
    
    let llmConnector;
    
    if (provider === 'claude') {
        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            console.log('⚠️  CLAUDE_API_KEY not found, falling back to Ollama');
            llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        } else {
            llmConnector = new ClaudeConnector(apiKey, model);
        }
    } else {
        // Default to Ollama
        const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
        llmConnector = new OllamaConnector(ollamaBaseUrl, model);
    }
    
    return new LLMHandler(llmConnector, model);
}

/**
 * Load entity embeddings from SPARQL store
 */
async function loadEntityEmbeddings(config) {
    console.log('📚 Loading entity embeddings from SPARQL store...');
    
    // Query entities with their embeddings
    const entitiesQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        
        SELECT ?entity ?name ?embedding WHERE {
            GRAPH <http://semem.hyperdata.it/end-to-end> {
                ?entity a ragno:Element ;
                       skos:prefLabel ?name ;
                       ragno:embedding ?embedding .
            }
        }
    `;
    
    const result = await executeSparqlSelect(entitiesQuery, config);
    const entities = result.results?.bindings || [];
    
    console.log(`📊 Found ${entities.length} entities with embeddings`);
    
    const embeddings = [];
    for (const entity of entities) {
        try {
            const embeddingStr = entity.embedding.value;
            const embedding = JSON.parse(embeddingStr);
            
            if (Array.isArray(embedding) && embedding.length === 1536) {
                embeddings.push({
                    id: entity.entity.value,
                    name: entity.name.value,
                    embedding: embedding
                });
            }
        } catch (error) {
            console.log(`⚠️  Failed to parse embedding for ${entity.name.value}: ${error.message}`);
        }
    }
    
    console.log(`✅ Loaded ${embeddings.length} valid entity embeddings\n`);
    return embeddings;
}

/**
 * HyDE Module Class for orchestrator integration
 */
class HyDEModule {
    constructor(config = null) {
        this.config = config;
        this.results = {
            queriesProcessed: 0,
            hypotheticalDocsGenerated: 0,
            averageImprovement: 0,
            bestQuery: '',
            bestImprovement: 0,
            success: false
        };
    }

    async initialize() {
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }
    }

    async execute() {
        const analysisResults = await runHyDEAnalysis();
        this.results.queriesProcessed = analysisResults?.queriesProcessed || 0;
        this.results.hypotheticalDocsGenerated = analysisResults?.hypotheticalDocsGenerated || 0;
        this.results.averageImprovement = analysisResults?.averageImprovement || 0;
        this.results.bestQuery = analysisResults?.bestQuery || '';
        this.results.bestImprovement = analysisResults?.bestImprovement || 0;
        this.results.success = true;
    }

    async cleanup() {
        // Cleanup if needed
    }

    getResults() {
        return this.results;
    }
}

/**
 * Main HyDE analysis function
 */
async function runHyDEAnalysis() {
    console.log('🔬 === MODULE 8: HYDE ENHANCEMENT ===\n');
    
    try {
        // Initialize configuration
        const config = new Config();
        await config.init();
        
        console.log('✓ Configuration initialized');
        
        // Create LLM handler based on config
        const llmHandler = await createLLMHandler(config);
        console.log('✅ LLM handler created with config-based provider');
        
        // Initialize embedding handler (still uses Ollama for embeddings)
        const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
        
        // Test Ollama connection for embeddings
        console.log('🔌 Testing Ollama connection for embeddings...');
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            throw new Error(`Ollama is required for embeddings. Please start Ollama at ${ollamaBaseUrl}`);
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        // Initialize cache manager and embedding handler
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });
        
        const embeddingHandler = new EmbeddingHandler(
            ollamaConnector,
            'nomic-embed-text:latest',
            1536,
            cacheManager
        );
        
        console.log('✅ LLM and embedding services initialized');
        
        // Load entity embeddings
        const entityEmbeddings = await loadEntityEmbeddings(config);
        
        if (entityEmbeddings.length === 0) {
            console.log('❌ No entity embeddings found. Please run Module 2 (Enrich) first.');
            return {
                queriesProcessed: 0,
                hypotheticalDocsGenerated: 0,
                averageImprovement: 0,
                bestQuery: '',
                bestImprovement: 0
            };
        }
        
        // Initialize HyDE retriever
        const hydeRetriever = new HyDERetriever(llmHandler, embeddingHandler);
        await hydeRetriever.loadEmbeddings(entityEmbeddings);
        
        console.log('🚀 HyDE retriever initialized\n');
        
        // Define test queries that span the knowledge domains
        const testQueries = [
            "How do neural networks learn and adapt?",
            "What are the environmental impacts of urban transportation?",
            "How does climate change affect ocean circulation patterns?",
            "What role does infrastructure play in sustainable cities?",
            "How do memory and learning processes work in the brain?",
            "What are the connections between urban planning and environmental science?"
        ];
        
        console.log(`🎯 Testing HyDE enhancement with ${testQueries.length} queries...\n`);
        
        const results = [];
        let totalImprovement = 0;
        let totalHypotheticalDocs = 0;
        let bestResult = null;
        
        for (let i = 0; i < testQueries.length; i++) {
            const query = testQueries[i];
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Query ${i + 1}/${testQueries.length}: ${query}`);
            console.log('='.repeat(60));
            
            // Add delay between queries to avoid rate limiting
            if (i > 0) {
                console.log('   ⏱️  Waiting to avoid rate limits...');
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            }
            
            try {
                const result = await hydeRetriever.hydeSearch(query, 5);
                
                // Display hypothetical documents
                console.log('\n📝 Generated Hypothetical Documents:');
                result.hypotheticalDocuments.forEach((doc, idx) => {
                    console.log(`   ${idx + 1}. [${doc.perspective}] ${doc.content}`);
                });
                
                totalHypotheticalDocs += result.hypotheticalDocuments.length;
                
                // Display search results comparison
                console.log('\n🔍 Search Results Comparison:');
                
                console.log('\n   🌟 HyDE Results:');
                result.hydeResults.slice(0, 3).forEach((item, idx) => {
                    const name = item.name || item.title;
                    console.log(`      ${idx + 1}. ${name} (${item.similarity.toFixed(3)})`);
                });
                
                console.log('\n   📊 Standard Results:');
                result.standardResults.slice(0, 3).forEach((item, idx) => {
                    const name = item.name || item.title;
                    console.log(`      ${idx + 1}. ${name} (${item.similarity.toFixed(3)})`);
                });
                
                // Display improvement metrics
                const improvement = result.improvement;
                console.log('\n📈 Improvement Analysis:');
                console.log(`   HyDE Avg Similarity: ${improvement.hydeAvgSimilarity?.toFixed(4) || 'N/A'}`);
                console.log(`   Standard Avg Similarity: ${improvement.standardAvgSimilarity?.toFixed(4) || 'N/A'}`);
                console.log(`   Improvement: ${improvement.improvement?.toFixed(2) || 0}%`);
                console.log(`   Top Results Overlap: ${improvement.topResultsOverlap || 0}/3`);
                console.log(`   New Results Found: ${improvement.diversityGain || 0}`);
                
                if (improvement.improvement && !isNaN(improvement.improvement)) {
                    totalImprovement += improvement.improvement;
                    
                    if (!bestResult || improvement.improvement > bestResult.improvement) {
                        bestResult = {
                            query: query,
                            improvement: improvement.improvement
                        };
                    }
                }
                
                results.push(result);
                
            } catch (error) {
                console.log(`❌ Query failed: ${error.message}`);
            }
        }
        
        // Generate summary analysis
        console.log('\n' + '='.repeat(80));
        console.log('🎯 HYDE ENHANCEMENT SUMMARY');
        console.log('='.repeat(80));
        
        const avgImprovement = results.length > 0 ? totalImprovement / results.length : 0;
        
        console.log(`\n📊 Overall Performance:`);
        console.log(`   Queries Processed: ${results.length}/${testQueries.length}`);
        console.log(`   Hypothetical Documents Generated: ${totalHypotheticalDocs}`);
        console.log(`   Average Improvement: ${avgImprovement.toFixed(2)}%`);
        
        if (bestResult) {
            console.log(`   Best Query: "${bestResult.query}"`);
            console.log(`   Best Improvement: ${bestResult.improvement.toFixed(2)}%`);
        }
        
        // Analysis by improvement level
        const significantImprovements = results.filter(r => 
            r.improvement.improvement && r.improvement.improvement > 5
        ).length;
        
        const negativeImprovements = results.filter(r => 
            r.improvement.improvement && r.improvement.improvement < 0
        ).length;
        
        console.log(`\n🔍 Improvement Distribution:`);
        console.log(`   Significant Improvements (>5%): ${significantImprovements}/${results.length}`);
        console.log(`   Negative Improvements: ${negativeImprovements}/${results.length}`);
        console.log(`   Neutral/Small Improvements: ${results.length - significantImprovements - negativeImprovements}/${results.length}`);
        
        // Domain-specific analysis
        console.log(`\n🏷️ Cross-Domain Enhancement:`);
        const domains = ['neural', 'climate', 'urban', 'memory', 'environmental'];
        domains.forEach(domain => {
            const domainResults = results.filter(r => 
                r.query.toLowerCase().includes(domain)
            );
            if (domainResults.length > 0) {
                const domainAvg = domainResults.reduce((sum, r) => 
                    sum + (r.improvement.improvement || 0), 0
                ) / domainResults.length;
                console.log(`   ${domain}: ${domainAvg.toFixed(2)}% improvement`);
            }
        });
        
        console.log(`\n💡 Key Insights:`);
        if (avgImprovement > 0) {
            console.log(`   ✓ HyDE shows overall positive improvement in search relevance`);
        } else {
            console.log(`   ⚠️ HyDE shows mixed results - may need query refinement`);
        }
        
        if (significantImprovements > 0) {
            console.log(`   ✓ ${significantImprovements} queries showed significant improvement`);
        }
        
        if (totalHypotheticalDocs > 0) {
            console.log(`   ✓ Successfully generated ${totalHypotheticalDocs} hypothetical documents`);
            console.log(`   ✓ Average of ${(totalHypotheticalDocs / results.length).toFixed(1)} perspectives per query`);
        }
        
        console.log('\n🎉 HyDE analysis completed successfully!');
        
        // Return results for orchestrator
        return {
            queriesProcessed: results.length,
            hypotheticalDocsGenerated: totalHypotheticalDocs,
            averageImprovement: avgImprovement,
            bestQuery: bestResult?.query || '',
            bestImprovement: bestResult?.improvement || 0
        };
        
    } catch (error) {
        console.error('❌ HyDE analysis failed:', error.message);
        if (error.message.includes('Ollama')) {
            console.log('\n💡 Tip: Make sure Ollama is running with the embedding model (nomic-embed-text)');
        }
        if (error.message.includes('CLAUDE_API_KEY')) {
            console.log('\n💡 Tip: Set CLAUDE_API_KEY environment variable to use Claude for chat');
        }
        if (error.message.includes('Entity') || error.message.includes('SPARQL')) {
            console.log('\n💡 Tip: Make sure to run Module 2 (Enrich) first to populate entity embeddings');
        }
        
        // Return default results on error
        return {
            queriesProcessed: 0,
            hypotheticalDocsGenerated: 0,
            averageImprovement: 0,
            bestQuery: '',
            bestImprovement: 0
        };
    }
}

// Run the module if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runHyDEAnalysis().catch(console.error);
}

export default HyDEModule;
export { runHyDEAnalysis };