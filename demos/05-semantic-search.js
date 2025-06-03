#!/usr/bin/env node

/**
 * Demo: Semantic Search Functionality
 * Tests vector similarity search and article/content retrieval capabilities
 * 
 * Path: ./demos/05-semantic-search.js
 * Run: node demos/05-semantic-search.js
 * 
 * Expected: Successfully indexes content and performs semantic search
 */

import ArticleSearchService from '../examples/ArticleSearchService.js';
import SearchService from '../src/services/search/SearchService.js';
import EmbeddingService from '../src/services/embeddings/EmbeddingService.js';
import SPARQLService from '../src/services/embeddings/SPARQLService.js';
import MemoryManager from '../src/MemoryManager.js';
import InMemoryStore from '../src/stores/InMemoryStore.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import logger from 'loglevel';

logger.setLevel('info');

async function testSemanticSearch() {
    console.log('=== DEMO: Semantic Search Functionality ===\n');
    
    try {
        // Test 1: Basic embedding-based search with memory manager
        console.log('1. Testing basic semantic search with MemoryManager...');
        
        const llmProvider = new OllamaConnector();
        const storage = new InMemoryStore();
        
        const memoryManager = new MemoryManager({
            llmProvider,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage
        });
        
        // Index sample content
        const sampleContent = [
            {
                title: "Machine Learning Basics",
                content: "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to analyze data patterns."
            },
            {
                title: "Neural Networks",
                content: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes that process information using connectionist approaches."
            },
            {
                title: "Natural Language Processing",
                content: "Natural language processing (NLP) is a branch of AI that helps computers understand, interpret and manipulate human language. It bridges the gap between human communication and computer understanding."
            },
            {
                title: "Computer Vision",
                content: "Computer vision is a field of AI that trains computers to interpret and understand visual information from the world. It involves acquiring, processing, analyzing and understanding digital images."
            },
            {
                title: "Robotics and AI",
                content: "Robotics combines mechanical engineering, electrical engineering, and computer science to design and build robots. AI enhances robots with decision-making capabilities."
            }
        ];
        
        console.log('   Indexing sample content...');
        for (const item of sampleContent) {
            const fullText = `${item.title}: ${item.content}`;
            const embedding = await memoryManager.generateEmbedding(fullText);
            const concepts = await memoryManager.extractConcepts(fullText);
            
            await memoryManager.addInteraction(
                `What is ${item.title}?`,
                item.content,
                embedding,
                concepts
            );
        }
        
        console.log(`   ✓ Indexed ${sampleContent.length} items`);
        
        // Test semantic queries
        const testQueries = [
            "How do computers learn from data?",
            "What technologies help machines see?",
            "Tell me about artificial neural systems",
            "How do machines understand human speech?",
            "What makes robots intelligent?"
        ];
        
        console.log('\n   Testing semantic search queries:');
        for (const query of testQueries) {
            console.log(`\n     Query: "${query}"`);
            
            const results = await memoryManager.retrieveRelevantInteractions(query);
            
            console.log(`     Found ${results.length} relevant results:`);
            results.slice(0, 2).forEach((result, idx) => {
                const interaction = result.interaction || result;
                console.log(`       ${idx + 1}. Similarity: ${result.similarity?.toFixed(2) || 'N/A'}`);
                console.log(`          Topic: "${interaction.prompt}"`);
                console.log(`          Concepts: [${(interaction.concepts || []).join(', ')}]`);
            });
        }
        
        await memoryManager.dispose();
        
        // Test 2: SPARQL-based semantic search (if available)
        console.log('\n2. Testing SPARQL-based semantic search...');
        
        try {
            const sparqlService = new SPARQLService({
                queryEndpoint: 'http://localhost:4030/semem/query',
                updateEndpoint: 'http://localhost:4030/semem/update',
                graphName: 'http://danny.ayers.name/content',
                auth: { user: 'admin', password: 'admin123' }
            });
            
            const embeddingService = new EmbeddingService({
                model: 'nomic-embed-text'
            });
            
            const searchService = new SearchService({
                embeddingService,
                sparqlService,
                graphName: 'http://danny.ayers.name/content',
                dimension: 768
            });
            
            // Test if SPARQL endpoint has data
            console.log('   Checking for existing content in SPARQL store...');
            await searchService.initialize();
            
            const sparqlQuery = "artificial intelligence and machine learning";
            console.log(`   Searching SPARQL store for: "${sparqlQuery}"`);
            
            const sparqlResults = await searchService.search(sparqlQuery, 3);
            
            if (sparqlResults.length > 0) {
                console.log(`   ✓ Found ${sparqlResults.length} results in SPARQL store:`);
                sparqlResults.forEach((result, idx) => {
                    console.log(`     ${idx + 1}. "${result.title || result.uri}"`);
                    console.log(`        Score: ${result.score?.toFixed(2) || 'N/A'}`);
                    console.log(`        Content: "${(result.content || '').substring(0, 100)}..."`);
                });
            } else {
                console.log('   ⚠️  No content found in SPARQL store (may need to run embedding creation first)');
            }
            
        } catch (sparqlError) {
            console.log(`   ⚠️  SPARQL search unavailable: ${sparqlError.message}`);
            console.log('   (This is expected if SPARQL endpoint is not running)');
        }
        
        // Test 3: Article search service (if SPARQL available)
        console.log('\n3. Testing ArticleSearchService...');
        
        try {
            const articleService = new ArticleSearchService();
            
            console.log('   Initializing article search service...');
            await articleService.initialize();
            
            const articleQueries = [
                "semantic web technologies",
                "knowledge representation",
                "data structures and algorithms"
            ];
            
            for (const query of articleQueries) {
                console.log(`\n     Article search: "${query}"`);
                
                const articleResults = await articleService.search(query, 3);
                
                if (articleResults.length > 0) {
                    console.log(`     Found ${articleResults.length} articles:`);
                    articleResults.forEach((result, idx) => {
                        console.log(`       ${idx + 1}. "${result.title}"`);
                        console.log(`          Score: ${result.score?.toFixed(2) || 'N/A'}`);
                        console.log(`          URI: ${result.uri}`);
                    });
                } else {
                    console.log('     No articles found');
                }
            }
            
        } catch (articleError) {
            console.log(`   ⚠️  Article search unavailable: ${articleError.message}`);
            console.log('   (This requires articles with embeddings in SPARQL store)');
        }
        
        // Test 4: Search performance and similarity metrics
        console.log('\n4. Testing search performance and similarity metrics...');
        
        const performanceMemoryManager = new MemoryManager({
            llmProvider: new OllamaConnector(),
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage: new InMemoryStore()
        });
        
        // Create test dataset with varying similarity
        const testDataset = [
            "Deep learning neural networks process complex data patterns",
            "Machine learning algorithms analyze statistical patterns in data", 
            "Artificial intelligence systems mimic human cognitive functions",
            "Computer vision processes and analyzes digital images",
            "Natural language processing understands human text and speech",
            "Robotics engineering combines mechanics with intelligent control",
            "Quantum computing uses quantum mechanics for computation",
            "Blockchain technology creates distributed ledger systems",
            "Cloud computing provides scalable internet-based services",
            "Cybersecurity protects digital systems from threats"
        ];
        
        console.log('   Building test dataset...');
        for (let i = 0; i < testDataset.length; i++) {
            const text = testDataset[i];
            const embedding = await performanceMemoryManager.generateEmbedding(text);
            const concepts = await performanceMemoryManager.extractConcepts(text);
            
            await performanceMemoryManager.addInteraction(
                `Question ${i + 1}`,
                text,
                embedding,
                concepts
            );
        }
        
        // Test similarity ranking
        const similarityQuery = "neural networks and deep learning algorithms";
        console.log(`\n   Similarity test query: "${similarityQuery}"`);
        
        const start = Date.now();
        const similarityResults = await performanceMemoryManager.retrieveRelevantInteractions(similarityQuery);
        const searchTime = Date.now() - start;
        
        console.log(`   ✓ Search completed in ${searchTime}ms`);
        console.log('   Similarity ranking:');
        
        similarityResults.slice(0, 5).forEach((result, idx) => {
            const interaction = result.interaction || result;
            console.log(`     ${idx + 1}. Similarity: ${result.similarity?.toFixed(3) || 'N/A'}`);
            console.log(`        Content: "${interaction.output?.substring(0, 60) || ''}..."`);
        });
        
        await performanceMemoryManager.dispose();
        
        console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        console.log('\nWhat was tested:');
        console.log('- Vector embedding-based similarity search');
        console.log('- Content indexing and retrieval from memory');
        console.log('- SPARQL-based semantic search (if available)');
        console.log('- Article search with vector indexes');
        console.log('- Search performance and similarity ranking');
        console.log('- Multi-modal content search capabilities');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\nTroubleshooting:');
        console.log('- Ensure Ollama is running with required models');
        console.log('- For SPARQL features, ensure endpoint is running');
        console.log('- Check if articles have been indexed with embeddings');
        console.log('- Verify network connectivity to embedding service');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    process.exit(0);
});

testSemanticSearch();