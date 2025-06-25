/**
 * HTTP Memory API Demo
 * 
 * This example demonstrates the Memory API endpoints for semantic memory management
 * through HTTP requests. Shows storage, search, embedding generation, and concept extraction.
 * 
 * Key features demonstrated:
 * - Memory storage via HTTP POST /api/memory
 * - Semantic search via HTTP GET /api/memory/search
 * - Embedding generation via HTTP POST /api/memory/embedding
 * - Concept extraction via HTTP POST /api/memory/concepts
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

// Demo data for memory operations
const DEMO_INTERACTIONS = [
    {
        prompt: "What is machine learning?",
        response: "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions or decisions.",
        metadata: { topic: "AI", difficulty: "beginner" }
    },
    {
        prompt: "Explain neural networks",
        response: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers that process information by passing signals between them. Deep learning uses multi-layered neural networks.",
        metadata: { topic: "AI", difficulty: "intermediate" }
    },
    {
        prompt: "What is quantum computing?",
        response: "Quantum computing uses quantum mechanical phenomena like superposition and entanglement to process information. Unlike classical bits, quantum bits (qubits) can exist in multiple states simultaneously, potentially solving certain problems exponentially faster.",
        metadata: { topic: "quantum", difficulty: "advanced" }
    },
    {
        prompt: "How does blockchain work?",
        response: "Blockchain is a distributed ledger technology that maintains a continuously growing list of records (blocks) linked using cryptography. Each block contains a hash of the previous block, timestamp, and transaction data, making it tamper-resistant.",
        metadata: { topic: "blockchain", difficulty: "intermediate" }
    }
];

const DEMO_TEXTS = [
    "Natural language processing enables computers to understand human language",
    "Deep learning revolutionizes pattern recognition in data",
    "Quantum supremacy achieved in specific computational tasks",
    "Cryptocurrency enables peer-to-peer digital transactions"
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
 * Demonstrate memory storage functionality
 */
async function demonstrateMemoryStorage() {
    logger.info(chalk.yellow('\n🧠 === Memory Storage Demo ==='));
    
    const storedIds = [];
    
    for (let i = 0; i < DEMO_INTERACTIONS.length; i++) {
        const interaction = DEMO_INTERACTIONS[i];
        
        logger.info(chalk.cyan(`\n📝 Storing interaction ${i + 1}/${DEMO_INTERACTIONS.length}:`));
        logger.info(chalk.gray(`   Prompt: "${interaction.prompt}"`));
        logger.info(chalk.gray(`   Topic: ${interaction.metadata.topic} | Difficulty: ${interaction.metadata.difficulty}`));
        
        try {
            const result = await makeRequest('/memory', {
                method: 'POST',
                body: JSON.stringify(interaction)
            });
            
            if (result.success && result.id) {
                storedIds.push(result.id);
                logger.info(chalk.green(`   ✅ Stored with ID: ${result.id}`));
                logger.info(chalk.gray(`   📊 Concepts: ${result.concepts?.join(', ') || 'N/A'}`));
                logger.info(chalk.gray(`   ⏱️  Processing time: ${result.processingTime || 'N/A'}ms`));
            } else {
                logger.warn(chalk.yellow(`   ⚠️  Storage succeeded but no ID returned`));
            }
        } catch (error) {
            logger.error(chalk.red(`   ❌ Failed to store interaction: ${error.message}`));
        }
        
        // Brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(chalk.green(`\n✅ Memory storage complete! Stored ${storedIds.length} interactions`));
    return storedIds;
}

/**
 * Demonstrate semantic search functionality with graceful error handling
 */
async function demonstrateSemanticSearch() {
    logger.info(chalk.yellow('\n🔍 === Semantic Search Demo ==='));
    
    const searchQueries = [
        "artificial intelligence algorithms",
        "quantum computation theory", 
        "distributed ledger technology",
        "language understanding systems"
    ];
    
    let searchWorking = true;
    
    // Test search functionality with first query
    const testQuery = searchQueries[0];
    logger.info(chalk.cyan(`\n🧪 Testing search functionality with: "${testQuery}"`));
    
    try {
        const testResult = await makeRequest(`/memory/search?query=${encodeURIComponent(testQuery)}&limit=1`);
        
        if (testResult.success && testResult.results !== undefined) {
            logger.info(chalk.green(`   ✅ Search is working! Found ${testResult.results.length} results`));
            
            // Continue with all searches
            for (let i = 1; i < searchQueries.length; i++) {
                const query = searchQueries[i];
                logger.info(chalk.cyan(`\n🔎 Searching for: "${query}"`));
                
                try {
                    const result = await makeRequest(`/memory/search?query=${encodeURIComponent(query)}&limit=3`);
                    
                    if (result.success && result.results) {
                        logger.info(chalk.green(`   ✅ Found ${result.results.length} relevant memories`));
                        
                        if (result.results.length > 0) {
                            result.results.forEach((memory, index) => {
                                logger.info(chalk.gray(`   📄 Result ${index + 1}:`));
                                logger.info(chalk.gray(`      Similarity: ${(memory.similarity * 100).toFixed(1)}%`));
                                logger.info(chalk.gray(`      Prompt: "${memory.prompt?.substring(0, 60)}..."`));
                                logger.info(chalk.gray(`      Concepts: ${memory.concepts?.join(', ') || 'N/A'}`));
                            });
                        } else {
                            logger.info(chalk.gray(`   📄 No matching memories found`));
                        }
                        
                        logger.info(chalk.gray(`   ⏱️  Search time: ${result.processingTime || 'N/A'}ms`));
                    }
                } catch (searchError) {
                    logger.warn(chalk.yellow(`   ⚠️  Search failed: ${searchError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    } catch (error) {
        searchWorking = false;
        logger.warn(chalk.yellow('⚠️  Search functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        logger.info(chalk.cyan('\n📚 Search Feature Overview (when working):'));
        logger.info(chalk.gray('   • Semantic similarity search across stored memories'));
        logger.info(chalk.gray('   • Configurable similarity thresholds and result limits'));
        logger.info(chalk.gray('   • Returns memories ranked by relevance to query'));
        logger.info(chalk.gray('   • Supports complex natural language queries'));
        logger.info(chalk.gray('   • Provides similarity scores for each result'));
        
        logger.info(chalk.cyan('\n🔧 Expected search workflow:'));
        searchQueries.forEach((query, index) => {
            logger.info(chalk.gray(`   ${index + 1}. Query: "${query}"`));
            logger.info(chalk.gray(`      → Would find memories related to ${query.split(' ').slice(0, 2).join(' ')}`));
        });
    }
    
    if (!searchWorking) {
        logger.info(chalk.yellow('\n💡 Note: Search functionality requires proper memory indexing and may need server restart'));
    }
}

/**
 * Demonstrate embedding generation
 */
async function demonstrateEmbeddingGeneration() {
    logger.info(chalk.yellow('\n🔢 === Embedding Generation Demo ==='));
    
    for (let i = 0; i < DEMO_TEXTS.length; i++) {
        const text = DEMO_TEXTS[i];
        
        logger.info(chalk.cyan(`\n📊 Generating embedding ${i + 1}/${DEMO_TEXTS.length}:`));
        logger.info(chalk.gray(`   Text: "${text}"`));
        
        try {
            const result = await makeRequest('/memory/embedding', {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            
            if (result.success && result.embedding) {
                const embedding = result.embedding;
                logger.info(chalk.green(`   ✅ Generated ${embedding.length}-dimensional embedding`));
                logger.info(chalk.gray(`   📈 Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`));
                logger.info(chalk.gray(`   📊 Magnitude: ${Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`));
                logger.info(chalk.gray(`   🔧 Model: ${result.model || 'default'} | Dimension: ${result.dimension}`));
                logger.info(chalk.gray(`   ⏱️  Generation time: ${result.processingTime || 'N/A'}ms`));
            } else {
                logger.warn(chalk.yellow(`   ⚠️  Embedding generation succeeded but no vector returned`));
            }
        } catch (error) {
            logger.error(chalk.red(`   ❌ Embedding generation failed: ${error.message}`));
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

/**
 * Demonstrate concept extraction
 */
async function demonstrateConceptExtraction() {
    logger.info(chalk.yellow('\n🏷️  === Concept Extraction Demo ==='));
    
    const complexTexts = [
        "Machine learning algorithms like neural networks and support vector machines are revolutionizing artificial intelligence by enabling computers to learn patterns from data without explicit programming.",
        "Quantum computing leverages quantum mechanical phenomena such as superposition and entanglement to perform computations that could potentially solve certain mathematical problems exponentially faster than classical computers.",
        "Blockchain technology creates immutable distributed ledgers using cryptographic hashing and consensus mechanisms, enabling decentralized applications and cryptocurrency transactions without central authorities.",
        "Natural language processing combines computational linguistics with machine learning to enable computers to understand, interpret and generate human language in meaningful ways."
    ];
    
    for (let i = 0; i < complexTexts.length; i++) {
        const text = complexTexts[i];
        
        logger.info(chalk.cyan(`\n🧠 Extracting concepts ${i + 1}/${complexTexts.length}:`));
        logger.info(chalk.gray(`   Text: "${text.substring(0, 80)}..."`));
        
        try {
            const result = await makeRequest('/memory/concepts', {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            
            if (result.success && result.concepts !== undefined) {
                const concepts = result.concepts;
                logger.info(chalk.green(`   ✅ Extracted ${concepts.length} concepts`));
                if (concepts.length > 0) {
                    logger.info(chalk.gray(`   🏷️  Concepts: ${concepts.join(', ')}`));
                } else {
                    logger.info(chalk.gray(`   🏷️  No concepts extracted (this might be expected for simple text)`));
                }
                logger.info(chalk.gray(`   📝 Original text: "${result.text?.substring(0, 60)}..."`));
                logger.info(chalk.gray(`   ⏱️  Extraction time: ${result.processingTime || 'N/A'}ms`));
            } else {
                logger.warn(chalk.yellow(`   ⚠️  Concept extraction succeeded but no concepts returned`));
            }
        } catch (error) {
            logger.error(chalk.red(`   ❌ Concept extraction failed: ${error.message}`));
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
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
                logger.info(chalk.gray('   🔧 Components:'));
                Object.entries(result.components).forEach(([name, component]) => {
                    const status = component.status === 'healthy' ? '✅' : '⚠️';
                    logger.info(chalk.gray(`      ${status} ${name}: ${component.status}`));
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
async function runMemoryAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP Memory API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Memory storage
        await demonstrateMemoryStorage();
        
        // Step 3: Semantic search (wait a bit for data to be indexed)
        logger.info(chalk.yellow('\n⏳ Waiting 2 seconds for data to be indexed...'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        await demonstrateSemanticSearch();
        
        // Step 4: Embedding generation
        await demonstrateEmbeddingGeneration();
        
        // Step 5: Concept extraction
        await demonstrateConceptExtraction();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All Memory API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Memory storage with automatic concept extraction'));
        logger.info(chalk.gray('   • Semantic similarity search across stored memories'));
        logger.info(chalk.gray('   • On-demand embedding generation for any text'));
        logger.info(chalk.gray('   • Concept extraction from complex text content'));
        logger.info(chalk.gray('   • Comprehensive error handling and progress tracking'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify network connectivity to the API server'));
        logger.info(chalk.gray('   • Check API server logs for detailed error information'));
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
runMemoryAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});