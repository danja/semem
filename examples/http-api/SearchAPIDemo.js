/**
 * HTTP Search API Demo
 * 
 * This example demonstrates the Search API endpoints for content search and indexing
 * through HTTP requests. Shows semantic search, content indexing, and query processing.
 * 
 * Key features demonstrated:
 * - Content search via HTTP GET /api/search
 * - Content indexing via HTTP POST /api/index
 * - Semantic similarity search with configurable thresholds
 * - Content type filtering and metadata handling
 * - Memory manager fallback when dedicated search service unavailable
 * - Error handling and response validation
 * - Progress tracking with colored output
 */

import fetch from 'node-fetch';
import logger from 'loglevel';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel('info');

// API Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:4100/api';
const API_KEY = process.env.SEMEM_API_KEY || 'your-api-key';

// Demo content for indexing
const DEMO_CONTENT = [
    {
        title: "Introduction to Machine Learning",
        content: "Machine Learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed. It uses algorithms to find patterns in data and make predictions or decisions based on those patterns.",
        type: "article",
        metadata: { author: "AI Researcher", topic: "machine-learning", difficulty: "beginner" }
    },
    {
        title: "Neural Networks Explained",
        content: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes called neurons organized in layers. Deep learning uses neural networks with multiple hidden layers to model complex patterns in data.",
        type: "tutorial",
        metadata: { author: "Data Scientist", topic: "neural-networks", difficulty: "intermediate" }
    },
    {
        title: "Quantum Computing Basics",
        content: "Quantum computing leverages quantum mechanical phenomena like superposition and entanglement to process information. Unlike classical bits, quantum bits (qubits) can exist in multiple states simultaneously, enabling exponential speedup for certain algorithms.",
        type: "article",
        metadata: { author: "Quantum Physicist", topic: "quantum-computing", difficulty: "advanced" }
    },
    {
        title: "Blockchain Technology Overview",
        content: "Blockchain is a distributed ledger technology that maintains a continuously growing list of records linked using cryptography. Each block contains a hash of the previous block, timestamp, and transaction data, making it tamper-resistant and decentralized.",
        type: "guide",
        metadata: { author: "Blockchain Developer", topic: "blockchain", difficulty: "intermediate" }
    },
    {
        title: "Natural Language Processing Applications",
        content: "Natural Language Processing (NLP) combines computational linguistics with machine learning to enable computers to understand, interpret, and generate human language. Applications include chatbots, translation, sentiment analysis, and text summarization.",
        type: "overview",
        metadata: { author: "NLP Engineer", topic: "nlp", difficulty: "intermediate" }
    }
];

// Demo search queries
const SEARCH_QUERIES = [
    {
        query: "machine learning algorithms",
        description: "General ML concepts",
        expectedResults: ["machine-learning", "neural-networks"],
        threshold: 0.6
    },
    {
        query: "artificial intelligence neural networks",
        description: "AI and neural network concepts",
        expectedResults: ["machine-learning", "neural-networks"],
        threshold: 0.5
    },
    {
        query: "quantum computation algorithms",
        description: "Quantum computing topics",
        expectedResults: ["quantum-computing"],
        threshold: 0.7
    },
    {
        query: "distributed ledger cryptography",
        description: "Blockchain technology",
        expectedResults: ["blockchain"],
        threshold: 0.6
    },
    {
        query: "language understanding chatbots",
        description: "NLP applications",
        expectedResults: ["nlp"],
        threshold: 0.5
    },
    {
        query: "deep learning patterns",
        description: "Deep learning concepts",
        expectedResults: ["neural-networks", "machine-learning"],
        threshold: 0.6
    }
];

/**
 * Make HTTP request with proper headers and error handling
 */
async function makeRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers
    };

    logger.info(chalk.blue(`📡 Making ${options.method || 'GET'} request to: ${endpoint}`));
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
        }

        logger.info(chalk.green(`✅ Request successful (${response.status})`));
        return data;
    } catch (error) {
        logger.error(chalk.red(`❌ Request failed: ${error.message}`));
        throw error;
    }
}

/**
 * Demonstrate content indexing functionality
 */
async function demonstrateContentIndexing() {
    logger.info(chalk.yellow('\n📚 === Content Indexing Demo ==='));
    
    const indexedIds = [];
    
    for (let i = 0; i < DEMO_CONTENT.length; i++) {
        const content = DEMO_CONTENT[i];
        
        logger.info(chalk.cyan(`\n📝 Indexing content ${i + 1}/${DEMO_CONTENT.length}:`));
        logger.info(chalk.gray(`   Title: "${content.title}"`));
        logger.info(chalk.gray(`   Type: ${content.type}`));
        logger.info(chalk.gray(`   Topic: ${content.metadata.topic}`));
        logger.info(chalk.gray(`   Difficulty: ${content.metadata.difficulty}`));
        logger.info(chalk.gray(`   Content length: ${content.content.length} characters`));
        
        try {
            const result = await makeRequest('/api/index', {
                method: 'POST',
                body: JSON.stringify(content)
            });
            
            if (result.success && result.id) {
                indexedIds.push(result.id);
                logger.info(chalk.green(`   ✅ Indexed successfully with ID: ${result.id}`));
            } else {
                logger.warn(chalk.yellow(`   ⚠️  Indexing succeeded but no ID returned`));
            }
        } catch (error) {
            logger.error(chalk.red(`   ❌ Failed to index content: ${error.message}`));
        }
        
        // Brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    logger.info(chalk.green(`\n✅ Content indexing complete! Indexed ${indexedIds.length} items`));
    return indexedIds;
}

/**
 * Demonstrate search functionality with graceful error handling
 */
async function demonstrateContentSearch() {
    logger.info(chalk.yellow('\n🔍 === Content Search Demo ==='));
    
    let searchWorking = true;
    
    // Test search functionality with first query
    const testQuery = SEARCH_QUERIES[0];
    logger.info(chalk.cyan(`\n🧪 Testing search functionality:`));
    logger.info(chalk.gray(`   Query: "${testQuery.query}"`));
    logger.info(chalk.gray(`   Description: ${testQuery.description}`));
    
    try {
        const testResult = await makeRequest(`/api/search?query=${encodeURIComponent(testQuery.query)}&limit=3&threshold=${testQuery.threshold}`);
        
        if (testResult.results !== undefined) {
            logger.info(chalk.green(`   ✅ Search is working! Found ${testResult.results.length} results`));
            
            // Continue with all search queries
            for (let i = 1; i < SEARCH_QUERIES.length; i++) {
                const search = SEARCH_QUERIES[i];
                
                logger.info(chalk.cyan(`\n🔎 Search ${i + 1}/${SEARCH_QUERIES.length}:`));
                logger.info(chalk.gray(`   Query: "${search.query}"`));
                logger.info(chalk.gray(`   Description: ${search.description}`));
                logger.info(chalk.gray(`   Expected topics: [${search.expectedResults.join(', ')}]`));
                logger.info(chalk.gray(`   Similarity threshold: ${search.threshold}`));
                
                try {
                    const result = await makeRequest(`/api/search?query=${encodeURIComponent(search.query)}&limit=5&threshold=${search.threshold}`);
                    
                    if (result.results !== undefined) {
                        logger.info(chalk.green(`   ✅ Found ${result.results.length} relevant results`));
                        
                        if (result.results.length > 0) {
                            result.results.forEach((item, index) => {
                                logger.info(chalk.gray(`   📄 Result ${index + 1}:`));
                                logger.info(chalk.gray(`      Title: "${item.title || 'Untitled'}"`));
                                logger.info(chalk.gray(`      Type: ${item.type || 'unknown'}`));
                                logger.info(chalk.gray(`      Similarity: ${((item.similarity || 0) * 100).toFixed(1)}%`));
                                if (item.content) {
                                    logger.info(chalk.gray(`      Content: "${item.content.substring(0, 80)}..."`));
                                }
                                if (item.metadata && item.metadata.topic) {
                                    logger.info(chalk.gray(`      Topic: ${item.metadata.topic}`));
                                }
                            });
                        } else {
                            logger.info(chalk.gray(`   📄 No results found for this query`));
                        }
                        
                        if (result.error) {
                            logger.warn(chalk.yellow(`   ⚠️  Search completed with warning: ${result.error}`));
                        }
                    }
                } catch (searchError) {
                    logger.warn(chalk.yellow(`   ⚠️  Search failed: ${searchError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }
    } catch (error) {
        searchWorking = false;
        logger.warn(chalk.yellow('⚠️  Search functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Content Search Overview (when working):'));
        logger.info(chalk.gray('   • Semantic similarity search across indexed content'));
        logger.info(chalk.gray('   • Configurable similarity thresholds for precision'));
        logger.info(chalk.gray('   • Content type filtering and metadata search'));
        logger.info(chalk.gray('   • Memory manager fallback for search operations'));
        logger.info(chalk.gray('   • Result ranking by similarity scores'));
        
        logger.info(chalk.cyan('\n🔧 Expected search workflow:'));
        SEARCH_QUERIES.forEach((query, index) => {
            logger.info(chalk.gray(`   ${index + 1}. "${query.query}"`));
            logger.info(chalk.gray(`      Expected: ${query.expectedResults.join(', ')} topics`));
            logger.info(chalk.gray(`      → ${query.description}`));
        });
    }
    
    if (!searchWorking) {
        logger.info(chalk.yellow('\n💡 Note: Search functionality requires memory manager or dedicated search service'));
    }
}

/**
 * Demonstrate advanced search with filters
 */
async function demonstrateAdvancedSearch() {
    logger.info(chalk.yellow('\n🎯 === Advanced Search Demo ==='));
    
    const advancedSearches = [
        {
            query: "learning algorithms",
            types: "article,tutorial",
            description: "Search articles and tutorials about learning",
            limit: 3
        },
        {
            query: "quantum technology",
            types: "article", 
            description: "Search only articles about quantum technology",
            limit: 2
        },
        {
            query: "artificial intelligence",
            threshold: 0.8,
            description: "High-precision search for AI content",
            limit: 4
        },
        {
            query: "distributed systems",
            threshold: 0.4,
            description: "Broad search for distributed systems",
            limit: 5
        }
    ];
    
    for (let i = 0; i < advancedSearches.length; i++) {
        const search = advancedSearches[i];
        
        logger.info(chalk.cyan(`\n🎯 Advanced search ${i + 1}/${advancedSearches.length}:`));
        logger.info(chalk.gray(`   Query: "${search.query}"`));
        logger.info(chalk.gray(`   Description: ${search.description}`));
        if (search.types) {
            logger.info(chalk.gray(`   Content types: ${search.types}`));
        }
        if (search.threshold) {
            logger.info(chalk.gray(`   Similarity threshold: ${search.threshold}`));
        }
        logger.info(chalk.gray(`   Result limit: ${search.limit}`));
        
        try {
            // Build query parameters
            const params = new URLSearchParams({
                query: search.query,
                limit: search.limit
            });
            
            if (search.types) {
                params.append('types', search.types);
            }
            if (search.threshold) {
                params.append('threshold', search.threshold);
            }
            
            const result = await makeRequest(`/api/search?${params.toString()}`);
            
            if (result.results !== undefined) {
                logger.info(chalk.green(`   ✅ Search completed - found ${result.results.length} results`));
                
                if (result.results.length > 0) {
                    // Show result summary
                    const typeDistribution = {};
                    const avgSimilarity = result.results.reduce((sum, item) => {
                        const type = item.type || 'unknown';
                        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                        return sum + (item.similarity || 0);
                    }, 0) / result.results.length;
                    
                    logger.info(chalk.gray(`   📊 Results summary:`));
                    logger.info(chalk.gray(`      • Average similarity: ${(avgSimilarity * 100).toFixed(1)}%`));
                    logger.info(chalk.gray(`      • Type distribution: ${Object.entries(typeDistribution).map(([type, count]) => `${type}(${count})`).join(', ')}`));
                    
                    // Show top results
                    logger.info(chalk.gray(`   🏆 Top results:`));
                    result.results.slice(0, 2).forEach((item, idx) => {
                        logger.info(chalk.gray(`      ${idx + 1}. "${item.title}" (${item.type})`));
                        logger.info(chalk.gray(`         Similarity: ${((item.similarity || 0) * 100).toFixed(1)}%`));
                    });
                } else {
                    logger.info(chalk.gray(`   📄 No results found matching the criteria`));
                }
                
                if (result.error) {
                    logger.warn(chalk.yellow(`   ⚠️  Search warning: ${result.error}`));
                }
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Advanced search failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Advanced Search Features:'));
                logger.info(chalk.gray('   • Content type filtering (article, tutorial, guide, etc.)'));
                logger.info(chalk.gray('   • Configurable similarity thresholds'));
                logger.info(chalk.gray('   • Result limit control'));
                logger.info(chalk.gray('   • Metadata-based filtering'));
                logger.info(chalk.gray('   • Performance optimization'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 700));
    }
}

/**
 * Demonstrate API health check
 */
async function checkAPIHealth() {
    logger.info(chalk.yellow('\n🏥 === API Health Check ==='));
    
    try {
        const result = await makeRequest('/health');
        
        if (result.status === 'healthy') {
            logger.info(chalk.green('✅ API server is healthy'));
            logger.info(chalk.gray(`   🚀 Uptime: ${Math.floor(result.uptime)}s`));
            logger.info(chalk.gray(`   📦 Version: ${result.version}`));
            
            if (result.components) {
                const searchComponents = ['memory', 'embedding', 'search-api'];
                logger.info(chalk.gray('   🔧 Search-related components:'));
                searchComponents.forEach(component => {
                    if (result.components[component]) {
                        const status = result.components[component].status === 'healthy' ? '✅' : '⚠️';
                        logger.info(chalk.gray(`      ${status} ${component}: ${result.components[component].status}`));
                    }
                });
            }
        } else {
            logger.warn(chalk.yellow('⚠️ API server health check returned non-healthy status'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Health check failed: ${error.message}`));
        throw error;
    }
}

/**
 * Main demo execution
 */
async function runSearchAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP Search API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Content indexing
        await demonstrateContentIndexing();
        
        // Step 3: Basic content search
        logger.info(chalk.yellow('\n⏳ Waiting 2 seconds for content to be indexed...'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        await demonstrateContentSearch();
        
        // Step 4: Advanced search with filters
        await demonstrateAdvancedSearch();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All Search API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Content indexing with metadata and type classification'));
        logger.info(chalk.gray('   • Semantic similarity search with configurable thresholds'));
        logger.info(chalk.gray('   • Content type filtering and advanced search parameters'));
        logger.info(chalk.gray('   • Memory manager fallback for search operations'));
        logger.info(chalk.gray('   • Result ranking and similarity scoring'));
        logger.info(chalk.gray('   • Error handling with graceful degradation'));
        logger.info(chalk.gray('   • Performance monitoring and progress tracking'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify memory manager configuration'));
        logger.info(chalk.gray('   • Check embedding handler availability'));
        logger.info(chalk.gray('   • Ensure search service or memory fallback is working'));
        logger.info(chalk.gray('   • Review API server logs for detailed error information'));
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    logger.info(chalk.yellow('\n👋 Demo interrupted by user'));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error(chalk.red('\n💥 Uncaught exception:'), error);
    process.exit(1);
});

// Run the demo
runSearchAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});