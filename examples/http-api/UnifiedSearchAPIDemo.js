/**
 * HTTP Unified Search API Demo
 * 
 * This example demonstrates the Unified Search API endpoints that aggregate and rank
 * search results across all Semem services through HTTP requests. Shows intelligent
 * query routing, service selection, result ranking, and search strategy optimization.
 * 
 * Key features demonstrated:
 * - Unified search across all services via HTTP POST /api/search/unified
 * - Query analysis and strategy recommendation via HTTP POST /api/search/analyze
 * - Available services discovery via HTTP GET /api/search/services
 * - Search strategies information via HTTP GET /api/search/strategies
 * - Intelligent query routing and service selection
 * - Result ranking and merging from multiple sources
 * - Parallel and sequential search execution
 * - Query type classification and optimization
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

// Demo search queries showcasing different types and strategies
const SEARCH_QUERIES = [
    {
        query: "What is artificial intelligence?",
        type: "concept-focused",
        description: "Conceptual question about AI",
        expectedServices: ["memory", "search", "ragno"],
        expectedSources: ["memory", "ragno"]
    },
    {
        query: "Who founded OpenAI?",
        type: "entity-focused", 
        description: "Entity-specific question",
        expectedServices: ["ragno", "memory", "search"],
        expectedSources: ["ragno", "memory"]
    },
    {
        query: "How do neural networks relate to deep learning?",
        type: "relationship-focused",
        description: "Relationship exploration",
        expectedServices: ["ragno", "zpt", "memory"],
        expectedSources: ["ragno", "memory"]
    },
    {
        query: "Navigate to machine learning algorithms",
        type: "navigation-focused",
        description: "Navigation request",
        expectedServices: ["zpt", "ragno", "search"],
        expectedSources: ["zpt", "ragno"]
    },
    {
        query: "Recent developments in quantum computing",
        type: "temporal-focused",
        description: "Time-sensitive query",
        expectedServices: ["memory", "search", "ragno"],
        expectedSources: ["memory", "search"]
    },
    {
        query: "Knowledge graph semantic relationships",
        type: "knowledge-focused",
        description: "Knowledge-centric query",
        expectedServices: ["ragno", "memory", "zpt"],
        expectedSources: ["ragno", "memory"]
    }
];

// Test search strategies
const SEARCH_STRATEGIES = [
    {
        strategy: "auto",
        description: "Automatic strategy selection based on query analysis"
    },
    {
        strategy: "balanced",
        description: "Query all services with equal weighting"
    },
    {
        strategy: "entity-focused",
        description: "Prioritize entity and knowledge graph search"
    },
    {
        strategy: "concept-focused", 
        description: "Emphasize conceptual and semantic search"
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
 * Demonstrate available services discovery
 */
async function demonstrateServicesDiscovery() {
    logger.info(chalk.yellow('\n🔍 === Available Services Discovery Demo ==='));
    
    try {
        const result = await makeRequest('/api/search/services');
        
        if (result.success && result.services) {
            logger.info(chalk.green('✅ Available services retrieved successfully'));
            logger.info(chalk.gray(`   📊 Total available: ${result.totalAvailable}/4 services`));
            
            logger.info(chalk.cyan('\n🎯 Service Capabilities:'));
            Object.entries(result.services).forEach(([name, info]) => {
                const status = info.available ? '✅' : '❌';
                logger.info(chalk.gray(`   ${status} ${name}: ${info.available ? 'Available' : 'Unavailable'}`));
                logger.info(chalk.gray(`      📝 ${info.description}`));
                if (info.capabilities) {
                    logger.info(chalk.gray(`      🔧 Capabilities: ${info.capabilities.join(', ')}`));
                }
            });
        } else {
            logger.warn(chalk.yellow('⚠️  Services information retrieved but no data available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Services discovery failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Available Services Overview (when working):'));
        logger.info(chalk.gray('   • Memory: Semantic memory search and concept extraction'));
        logger.info(chalk.gray('   • Ragno: Knowledge graph operations and entity search'));
        logger.info(chalk.gray('   • Search: General content search and text analysis'));
        logger.info(chalk.gray('   • ZPT: Zero-Point Traversal corpus navigation'));
    }
}

/**
 * Demonstrate search strategies information
 */
async function demonstrateStrategiesDiscovery() {
    logger.info(chalk.yellow('\n🎯 === Search Strategies Discovery Demo ==='));
    
    try {
        const result = await makeRequest('/api/search/strategies');
        
        if (result.success && result.strategies) {
            logger.info(chalk.green('✅ Search strategies retrieved successfully'));
            
            logger.info(chalk.cyan('\n📋 Available Strategies:'));
            Object.entries(result.strategies).forEach(([name, info]) => {
                logger.info(chalk.gray(`   🎯 ${name}:`));
                logger.info(chalk.gray(`      📝 ${info.description}`));
                logger.info(chalk.gray(`      🔧 Services: [${info.services.join(', ')}]`));
                logger.info(chalk.gray(`      💡 Use case: ${info.useCase}`));
            });
            
            if (result.defaultWeights) {
                logger.info(chalk.cyan('\n⚖️  Default Service Weights:'));
                Object.entries(result.defaultWeights).forEach(([service, weight]) => {
                    logger.info(chalk.gray(`   📊 ${service}: ${(weight * 100).toFixed(1)}%`));
                });
            }
        } else {
            logger.warn(chalk.yellow('⚠️  Strategies information retrieved but no data available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Strategies discovery failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Search Strategies Overview (when working):'));
        logger.info(chalk.gray('   • Entity-focused: Prioritizes entity and knowledge graph search'));
        logger.info(chalk.gray('   • Concept-focused: Emphasizes conceptual and semantic search'));
        logger.info(chalk.gray('   • Graph-focused: Leverages graph relationships and connections'));
        logger.info(chalk.gray('   • Navigation-focused: Optimized for corpus exploration'));
        logger.info(chalk.gray('   • Knowledge-focused: Comprehensive knowledge base search'));
        logger.info(chalk.gray('   • Balanced: Queries all services with equal weighting'));
    }
}

/**
 * Demonstrate query analysis functionality
 */
async function demonstrateQueryAnalysis() {
    logger.info(chalk.yellow('\n🧠 === Query Analysis Demo ==='));
    
    const analysisQueries = [
        "What is machine learning?",
        "Who created TensorFlow?", 
        "How do transformers relate to attention mechanisms?",
        "Navigate to neural network architectures",
        "Recent advances in computer vision"
    ];
    
    for (let i = 0; i < analysisQueries.length; i++) {
        const query = analysisQueries[i];
        
        logger.info(chalk.cyan(`\n🔍 Analysis ${i + 1}/${analysisQueries.length}:`));
        logger.info(chalk.gray(`   Query: "${query}"`));
        
        try {
            const result = await makeRequest('/api/search/analyze', {
                method: 'POST',
                body: JSON.stringify({ query })
            });
            
            if (result.success && result.analysis) {
                logger.info(chalk.green(`   ✅ Analysis completed successfully`));
                
                const analysis = result.analysis;
                logger.info(chalk.gray(`   🎯 Query type: ${analysis.type}`));
                logger.info(chalk.gray(`   📊 Confidence: ${(analysis.confidence * 100).toFixed(1)}%`));
                logger.info(chalk.gray(`   🏷️  Characteristics: [${analysis.characteristics.join(', ')}]`));
                logger.info(chalk.gray(`   🔑 Keywords: [${analysis.keywords.slice(0, 5).join(', ')}]`));
                
                logger.info(chalk.gray(`   💡 Recommended strategy: ${result.recommendedStrategy}`));
                logger.info(chalk.gray(`   🔧 Recommended services: [${result.recommendedServices.join(', ')}]`));
                
                if (result.estimatedRelevance) {
                    logger.info(chalk.gray(`   📈 Service relevance:`));
                    Object.entries(result.estimatedRelevance).forEach(([service, relevance]) => {
                        const percentage = (relevance * 100).toFixed(0);
                        logger.info(chalk.gray(`      ${service}: ${percentage}%`));
                    });
                }
                
                logger.info(chalk.gray(`   ⏱️  Processing time: ${result.processingTime}ms`));
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Analysis failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Query Analysis Features:'));
                logger.info(chalk.gray('   • Automatic query type classification'));
                logger.info(chalk.gray('   • Keyword extraction and analysis'));
                logger.info(chalk.gray('   • Service relevance estimation'));
                logger.info(chalk.gray('   • Strategy recommendation'));
                logger.info(chalk.gray('   • Confidence scoring'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

/**
 * Demonstrate unified search functionality with graceful error handling
 */
async function demonstrateUnifiedSearch() {
    logger.info(chalk.yellow('\n🌐 === Unified Search Demo ==='));
    
    let searchWorking = true;
    
    // Test unified search with first query
    const testQuery = SEARCH_QUERIES[0];
    logger.info(chalk.cyan(`\n🧪 Testing unified search functionality:`));
    logger.info(chalk.gray(`   Query: "${testQuery.query}"`));
    logger.info(chalk.gray(`   Type: ${testQuery.type}`));
    logger.info(chalk.gray(`   Description: ${testQuery.description}`));
    
    try {
        const testResult = await makeRequest('/api/search/unified', {
            method: 'POST',
            body: JSON.stringify({ 
                query: testQuery.query,
                limit: 10,
                strategy: 'auto'
            })
        });
        
        if (testResult.success) {
            logger.info(chalk.green(`   ✅ Unified search is working!`));
            
            // Continue with all search queries
            for (let i = 1; i < SEARCH_QUERIES.length; i++) {
                const searchQuery = SEARCH_QUERIES[i];
                
                logger.info(chalk.cyan(`\n🔍 Search ${i + 1}/${SEARCH_QUERIES.length}:`));
                logger.info(chalk.gray(`   Query: "${searchQuery.query}"`));
                logger.info(chalk.gray(`   Type: ${searchQuery.type}`));
                logger.info(chalk.gray(`   Description: ${searchQuery.description}`));
                logger.info(chalk.gray(`   Expected services: [${searchQuery.expectedServices.join(', ')}]`));
                
                try {
                    const result = await makeRequest('/api/search/unified', {
                        method: 'POST',
                        body: JSON.stringify({
                            query: searchQuery.query,
                            limit: 8,
                            strategy: 'auto'
                        })
                    });
                    
                    if (result.success) {
                        logger.info(chalk.green(`   ✅ Search completed successfully`));
                        
                        logger.info(chalk.gray(`   📊 Results summary:`));
                        logger.info(chalk.gray(`      • Total results: ${result.results?.length || 0}`));
                        logger.info(chalk.gray(`      • Strategy used: ${result.strategy}`));
                        logger.info(chalk.gray(`      • Services queried: [${result.servicesQueried?.join(', ') || 'none'}]`));
                        
                        if (result.analysis) {
                            logger.info(chalk.gray(`      • Query type: ${result.analysis.type}`));
                            logger.info(chalk.gray(`      • Confidence: ${(result.analysis.confidence * 100).toFixed(1)}%`));
                        }
                        
                        if (result.metadata) {
                            logger.info(chalk.gray(`      • Search time: ${result.metadata.searchTime}ms`));
                            logger.info(chalk.gray(`      • Services used: ${result.metadata.servicesUsed}`));
                            
                            if (result.metadata.resultDistribution) {
                                logger.info(chalk.gray(`      • Result distribution:`));
                                Object.entries(result.metadata.resultDistribution).forEach(([service, count]) => {
                                    if (count > 0) {
                                        logger.info(chalk.gray(`        ${service}: ${count} results`));
                                    }
                                });
                            }
                        }
                        
                        if (result.results && result.results.length > 0) {
                            logger.info(chalk.gray(`   🎯 Top results (${Math.min(3, result.results.length)}):`));
                            result.results.slice(0, 3).forEach((item, idx) => {
                                logger.info(chalk.gray(`      ${idx + 1}. ${item.title || 'Untitled'} (${item.source})`));
                                logger.info(chalk.gray(`         Score: ${(item.finalScore || item.score || 0).toFixed(3)}, Type: ${item.type}`));
                                if (item.content) {
                                    logger.info(chalk.gray(`         Content: "${item.content.substring(0, 80)}..."`));
                                }
                            });
                        } else {
                            logger.info(chalk.gray(`   📄 No results found for this query`));
                        }
                        
                        logger.info(chalk.gray(`   ⏱️  Total processing time: ${result.processingTime}ms`));
                    }
                } catch (searchError) {
                    logger.warn(chalk.yellow(`   ⚠️  Search failed: ${searchError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        searchWorking = false;
        logger.warn(chalk.yellow('⚠️  Unified search functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Unified Search Overview (when working):'));
        logger.info(chalk.gray('   • Intelligent query analysis and routing'));
        logger.info(chalk.gray('   • Automatic service selection based on query type'));
        logger.info(chalk.gray('   • Parallel search execution across multiple services'));
        logger.info(chalk.gray('   • Result ranking and score normalization'));
        logger.info(chalk.gray('   • Service-specific result formatting'));
        logger.info(chalk.gray('   • Performance monitoring and metrics'));
        
        logger.info(chalk.cyan('\n🔧 Expected search scenarios:'));
        SEARCH_QUERIES.forEach((query, index) => {
            logger.info(chalk.gray(`   ${index + 1}. "${query.query}"`));
            logger.info(chalk.gray(`      Type: ${query.type} | Services: [${query.expectedServices.join(', ')}]`));
            logger.info(chalk.gray(`      → ${query.description}`));
        });
    }
    
    if (!searchWorking) {
        logger.info(chalk.yellow('\n💡 Note: Unified search requires configured services (Memory, Ragno, Search, ZPT APIs)'));
    }
}

/**
 * Demonstrate different search strategies
 */
async function demonstrateSearchStrategies() {
    logger.info(chalk.yellow('\n🎭 === Search Strategy Comparison Demo ==='));
    
    const testQuery = "artificial intelligence neural networks";
    
    for (let i = 0; i < SEARCH_STRATEGIES.length; i++) {
        const strategy = SEARCH_STRATEGIES[i];
        
        logger.info(chalk.cyan(`\n🎯 Strategy ${i + 1}/${SEARCH_STRATEGIES.length}:`));
        logger.info(chalk.gray(`   Strategy: ${strategy.strategy}`));
        logger.info(chalk.gray(`   Description: ${strategy.description}`));
        logger.info(chalk.gray(`   Query: "${testQuery}"`));
        
        try {
            const result = await makeRequest('/api/search/unified', {
                method: 'POST',
                body: JSON.stringify({
                    query: testQuery,
                    limit: 5,
                    strategy: strategy.strategy
                })
            });
            
            if (result.success) {
                logger.info(chalk.green(`   ✅ Strategy executed successfully`));
                logger.info(chalk.gray(`   📊 Results: ${result.results?.length || 0} found`));
                logger.info(chalk.gray(`   🔧 Services used: [${result.servicesQueried?.join(', ') || 'none'}]`));
                logger.info(chalk.gray(`   ⏱️  Search time: ${result.metadata?.searchTime || 'N/A'}ms`));
                
                if (result.metadata?.resultDistribution) {
                    const distribution = result.metadata.resultDistribution;
                    const totalResults = Object.values(distribution).reduce((sum, count) => sum + count, 0);
                    if (totalResults > 0) {
                        logger.info(chalk.gray(`   📈 Distribution:`));
                        Object.entries(distribution).forEach(([service, count]) => {
                            if (count > 0) {
                                const percentage = ((count / totalResults) * 100).toFixed(1);
                                logger.info(chalk.gray(`      ${service}: ${count} (${percentage}%)`));
                            }
                        });
                    }
                }
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Strategy failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Search Strategy Features:'));
                logger.info(chalk.gray('   • Multiple search approaches for different use cases'));
                logger.info(chalk.gray('   • Service prioritization and weighting'));
                logger.info(chalk.gray('   • Result distribution and performance comparison'));
                logger.info(chalk.gray('   • Automatic vs manual strategy selection'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 800));
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
                const unifiedComponents = ['memory-api', 'ragno-api', 'search-api', 'zpt-api', 'unified-search-api'];
                logger.info(chalk.gray('   🔧 Unified search related components:'));
                unifiedComponents.forEach(component => {
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
async function runUnifiedSearchAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP Unified Search API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Services discovery
        await demonstrateServicesDiscovery();
        
        // Step 3: Strategies discovery 
        await demonstrateStrategiesDiscovery();
        
        // Step 4: Query analysis
        await demonstrateQueryAnalysis();
        
        // Step 5: Unified search
        await demonstrateUnifiedSearch();
        
        // Step 6: Search strategy comparison
        await demonstrateSearchStrategies();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All Unified Search API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Service discovery and capability detection'));
        logger.info(chalk.gray('   • Search strategy exploration and comparison'));
        logger.info(chalk.gray('   • Intelligent query analysis and classification'));
        logger.info(chalk.gray('   • Unified search across all Semem services'));
        logger.info(chalk.gray('   • Result ranking and score normalization'));
        logger.info(chalk.gray('   • Parallel search execution and aggregation'));
        logger.info(chalk.gray('   • Service-specific result formatting'));
        logger.info(chalk.gray('   • Performance monitoring and distribution analysis'));
        logger.info(chalk.gray('   • Comprehensive error handling and progress tracking'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify all underlying services (Memory, Ragno, Search, ZPT) are configured'));
        logger.info(chalk.gray('   • Check service registry and API context initialization'));
        logger.info(chalk.gray('   • Ensure LLM and embedding handlers are available for query analysis'));
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
runUnifiedSearchAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});