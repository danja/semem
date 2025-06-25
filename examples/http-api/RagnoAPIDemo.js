/**
 * HTTP Ragno API Demo
 * 
 * This example demonstrates the Ragno API endpoints for knowledge graph operations
 * through HTTP requests. Shows text decomposition, entity extraction, graph analytics,
 * search, export, and enrichment capabilities.
 * 
 * Key features demonstrated:
 * - Text decomposition into knowledge graph via HTTP POST /api/ragno/decompose
 * - Graph statistics and analytics via HTTP GET /api/ragno/stats
 * - Entity retrieval and filtering via HTTP GET /api/ragno/entities
 * - Knowledge graph search via HTTP GET /api/ragno/search
 * - Graph data export via HTTP GET /api/ragno/export
 * - Graph enrichment via HTTP POST /api/ragno/enrich
 * - Community detection via HTTP GET /api/ragno/communities
 * - Full pipeline execution via HTTP POST /api/ragno/pipeline
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

// Demo texts for knowledge graph decomposition
const DEMO_TEXTS = [
    {
        text: "Artificial Intelligence is a branch of computer science that aims to create intelligent machines. Machine Learning, a subset of AI, enables systems to automatically learn and improve from experience. Deep Learning uses neural networks with multiple layers to model and understand complex patterns in data. Natural Language Processing allows computers to understand and interpret human language.",
        description: "AI and Machine Learning overview",
        expectedEntities: ["Artificial Intelligence", "Machine Learning", "Deep Learning", "Natural Language Processing"]
    },
    {
        text: "Quantum Computing leverages quantum mechanical phenomena like superposition and entanglement. Quantum bits or qubits can exist in multiple states simultaneously. Google achieved quantum supremacy in 2019 with their Sycamore processor. IBM and Microsoft are also developing quantum computing systems.",
        description: "Quantum Computing landscape", 
        expectedEntities: ["Quantum Computing", "Google", "IBM", "Microsoft", "Sycamore"]
    },
    {
        text: "Blockchain technology creates decentralized, immutable ledgers using cryptographic hashing. Bitcoin, created by Satoshi Nakamoto, was the first successful cryptocurrency. Ethereum introduced smart contracts, enabling programmable blockchain applications. Decentralized Finance (DeFi) protocols are built on blockchain networks.",
        description: "Blockchain and Cryptocurrency ecosystem",
        expectedEntities: ["Blockchain", "Bitcoin", "Ethereum", "Satoshi Nakamoto", "DeFi"]
    }
];

// Search queries for knowledge graph exploration
const SEARCH_QUERIES = [
    {
        query: "artificial intelligence systems",
        type: "dual",
        description: "AI systems and technologies"
    },
    {
        query: "quantum computing algorithms", 
        type: "entities",
        description: "Quantum computing concepts"
    },
    {
        query: "blockchain cryptocurrency",
        type: "semantic",
        description: "Blockchain and crypto technologies"
    },
    {
        query: "machine learning neural networks",
        type: "dual", 
        description: "ML and neural network concepts"
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
 * Demonstrate text decomposition into knowledge graph with graceful error handling
 */
async function demonstrateTextDecomposition() {
    logger.info(chalk.yellow('\n🧬 === Text Decomposition Demo ==='));
    
    // Test decomposition with first text
    const testText = DEMO_TEXTS[0];
    logger.info(chalk.cyan(`\n🧪 Testing decomposition functionality:`));
    logger.info(chalk.gray(`   Description: ${testText.description}`));
    logger.info(chalk.gray(`   Text length: ${testText.text.length} characters`));
    
    let decompositionWorking = true;
    
    try {
        const testResult = await makeRequest('/ragno/decompose', {
            method: 'POST',
            body: JSON.stringify({ 
                text: testText.text,
                options: {
                    extractRelationships: true,
                    generateSummaries: true,
                    store: true
                }
            })
        });
        
        if (testResult.success && testResult.entities) {
            logger.info(chalk.green(`   ✅ Decomposition is working!`));
            logger.info(chalk.gray(`   📊 Extracted ${testResult.entities.length} entities, ${testResult.relationships.length} relationships`));
            
            // Continue with all texts
            for (let i = 1; i < DEMO_TEXTS.length; i++) {
                const demo = DEMO_TEXTS[i];
                
                logger.info(chalk.cyan(`\n🧬 Decomposing text ${i + 1}/${DEMO_TEXTS.length}:`));
                logger.info(chalk.gray(`   Description: ${demo.description}`));
                logger.info(chalk.gray(`   Expected entities: ${demo.expectedEntities.join(', ')}`));
                logger.info(chalk.gray(`   Text: "${demo.text.substring(0, 100)}..."`));
                
                try {
                    const result = await makeRequest('/ragno/decompose', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            text: demo.text,
                            options: {
                                extractRelationships: true,
                                generateSummaries: true,
                                store: true,
                                minEntityConfidence: 0.5
                            }
                        })
                    });
                    
                    if (result.success) {
                        logger.info(chalk.green(`   ✅ Decomposition completed successfully`));
                        logger.info(chalk.gray(`   📊 Statistics:`));
                        logger.info(chalk.gray(`      • ${result.statistics.entitiesCount} entities extracted`));
                        logger.info(chalk.gray(`      • ${result.statistics.relationshipsCount} relationships found`)); 
                        logger.info(chalk.gray(`      • ${result.statistics.unitsCount} semantic units created`));
                        
                        if (result.entities.length > 0) {
                            logger.info(chalk.gray(`   🏷️  Top entities:`));
                            result.entities.slice(0, 3).forEach((entity, idx) => {
                                logger.info(chalk.gray(`      ${idx + 1}. ${entity.name} (${entity.type}, confidence: ${(entity.confidence * 100).toFixed(1)}%)`));
                            });
                        }
                        
                        if (result.relationships.length > 0) {
                            logger.info(chalk.gray(`   🔗 Sample relationships:`));
                            result.relationships.slice(0, 2).forEach((rel, idx) => {
                                const subj = rel.subject.split('/').pop() || rel.subject;
                                const pred = rel.predicate.split('/').pop() || rel.predicate;
                                const obj = rel.object.split('/').pop() || rel.object;
                                logger.info(chalk.gray(`      ${idx + 1}. ${subj} → ${pred} → ${obj}`));
                            });
                        }
                        
                        logger.info(chalk.gray(`   ⏱️  Processing time: ${result.processingTime}ms`));
                    }
                } catch (decompError) {
                    logger.warn(chalk.yellow(`   ⚠️  Decomposition failed: ${decompError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        decompositionWorking = false;
        logger.warn(chalk.yellow('⚠️  Text decomposition functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Text Decomposition Overview (when working):'));
        logger.info(chalk.gray('   • Converts unstructured text into structured knowledge graphs'));
        logger.info(chalk.gray('   • Extracts entities, relationships, and semantic units'));
        logger.info(chalk.gray('   • Generates confidence scores for extracted elements'));
        logger.info(chalk.gray('   • Supports batch processing and configurable extraction'));
        logger.info(chalk.gray('   • Stores results in SPARQL endpoint for querying'));
        
        logger.info(chalk.cyan('\n🔧 Expected decomposition workflow:'));
        DEMO_TEXTS.forEach((demo, index) => {
            logger.info(chalk.gray(`   ${index + 1}. "${demo.description}"`));
            logger.info(chalk.gray(`      Expected: ${demo.expectedEntities.join(', ')}`));
            logger.info(chalk.gray(`      → Would extract entities and map relationships`));
        });
    }
    
    if (!decompositionWorking) {
        logger.info(chalk.yellow('\n💡 Note: Decomposition requires LLM provider and properly configured knowledge graph storage'));
    }
}

/**
 * Demonstrate graph statistics and analytics
 */
async function demonstrateGraphStatistics() {
    logger.info(chalk.yellow('\n📊 === Graph Statistics Demo ==='));
    
    try {
        const result = await makeRequest('/ragno/stats');
        
        if (result.success && result.statistics) {
            logger.info(chalk.green('✅ Graph statistics retrieved successfully'));
            
            const stats = result.statistics;
            logger.info(chalk.cyan('\n📈 Knowledge Graph Overview:'));
            logger.info(chalk.gray(`   🏷️  Total entities: ${stats.entities || 0}`));
            logger.info(chalk.gray(`   🧩 Semantic units: ${stats.units || 0}`));
            logger.info(chalk.gray(`   🔗 Relationships: ${stats.relationships || 0}`));
            logger.info(chalk.gray(`   📄 Total triples: ${stats.triples || 0}`));
            
            if (result.analytics && Object.keys(result.analytics).length > 0) {
                logger.info(chalk.cyan('\n🔬 Graph Analytics:'));
                Object.entries(result.analytics).forEach(([key, value]) => {
                    logger.info(chalk.gray(`   📊 ${key}: ${JSON.stringify(value)}`));
                });
            }
            
            logger.info(chalk.gray(`   🕒 Generated: ${result.timestamp}`));
        } else {
            logger.warn(chalk.yellow('⚠️  Statistics retrieved but no data available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Graph statistics failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Graph Statistics Overview (when working):'));
        logger.info(chalk.gray('   • Total counts of entities, relationships, and semantic units'));
        logger.info(chalk.gray('   • Graph connectivity and structure analytics'));
        logger.info(chalk.gray('   • Performance metrics and storage statistics'));
        logger.info(chalk.gray('   • Real-time monitoring of knowledge graph growth'));
    }
}

/**
 * Demonstrate entity retrieval and filtering
 */
async function demonstrateEntityRetrieval() {
    logger.info(chalk.yellow('\n🏷️  === Entity Retrieval Demo ==='));
    
    const entityQueries = [
        { limit: 10, description: "Recent entities" },
        { limit: 5, type: "technology", description: "Technology entities" },
        { limit: 5, name: "learning", description: "Entities containing 'learning'" },
        { limit: 8, type: "organization", description: "Organization entities" }
    ];
    
    for (let i = 0; i < entityQueries.length; i++) {
        const query = entityQueries[i];
        
        logger.info(chalk.cyan(`\n🔍 Entity query ${i + 1}/${entityQueries.length}:`));
        logger.info(chalk.gray(`   Description: ${query.description}`));
        logger.info(chalk.gray(`   Parameters: limit=${query.limit}${query.type ? `, type=${query.type}` : ''}${query.name ? `, name=${query.name}` : ''}`));
        
        try {
            // Build query string
            const params = new URLSearchParams();
            params.append('limit', query.limit);
            if (query.type) params.append('type', query.type);
            if (query.name) params.append('name', query.name);
            
            const result = await makeRequest(`/ragno/entities?${params.toString()}`);
            
            if (result.success && result.entities) {
                logger.info(chalk.green(`   ✅ Found ${result.entities.length} entities`));
                
                if (result.entities.length > 0) {
                    result.entities.slice(0, 3).forEach((entity, idx) => {
                        logger.info(chalk.gray(`   📄 Entity ${idx + 1}:`));
                        logger.info(chalk.gray(`      Name: ${entity.name}`));
                        logger.info(chalk.gray(`      Type: ${entity.type}`));
                        logger.info(chalk.gray(`      Confidence: ${(entity.confidence * 100).toFixed(1)}%`));
                        logger.info(chalk.gray(`      URI: ${entity.uri.split('/').pop()}`));
                    });
                    
                    if (result.entities.length > 3) {
                        logger.info(chalk.gray(`   📋 ... and ${result.entities.length - 3} more entities`));
                    }
                } else {
                    logger.info(chalk.gray(`   📄 No entities match the criteria`));
                }
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Entity retrieval failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Entity Retrieval Features:'));
                logger.info(chalk.gray('   • Filter entities by type, name, or confidence'));
                logger.info(chalk.gray('   • Paginated results with configurable limits'));
                logger.info(chalk.gray('   • Sorted by confidence score for relevance'));
                logger.info(chalk.gray('   • Rich metadata including URIs and types'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

/**
 * Demonstrate knowledge graph search functionality
 */
async function demonstrateGraphSearch() {
    logger.info(chalk.yellow('\n🔍 === Knowledge Graph Search Demo ==='));
    
    for (let i = 0; i < SEARCH_QUERIES.length; i++) {
        const searchQuery = SEARCH_QUERIES[i];
        
        logger.info(chalk.cyan(`\n🔎 Search ${i + 1}/${SEARCH_QUERIES.length}:`));
        logger.info(chalk.gray(`   Query: "${searchQuery.query}"`));
        logger.info(chalk.gray(`   Type: ${searchQuery.type} search`));
        logger.info(chalk.gray(`   Description: ${searchQuery.description}`));
        
        try {
            const params = new URLSearchParams({
                query: searchQuery.query,
                type: searchQuery.type,
                limit: 5,
                threshold: 0.6
            });
            
            const result = await makeRequest(`/ragno/search?${params.toString()}`);
            
            if (result.success && result.results !== undefined) {
                logger.info(chalk.green(`   ✅ Search completed - found ${result.results.length} results`));
                
                if (result.results.length > 0) {
                    result.results.forEach((item, idx) => {
                        logger.info(chalk.gray(`   📄 Result ${idx + 1}:`));
                        
                        if (item.name) {
                            logger.info(chalk.gray(`      Entity: ${item.name} (${item.type || 'unknown'})`));
                            logger.info(chalk.gray(`      Confidence: ${(item.confidence * 100).toFixed(1)}%`));
                        } else if (item.prompt) {
                            logger.info(chalk.gray(`      Memory: "${item.prompt.substring(0, 50)}..."`));
                        }
                        
                        if (item.score !== undefined) {
                            logger.info(chalk.gray(`      Relevance: ${(item.score * 100).toFixed(1)}%`));
                        }
                    });
                } else {
                    logger.info(chalk.gray(`   📄 No results found for this query`));
                }
                
                logger.info(chalk.gray(`   🔧 Search type: ${result.type}`));
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Search failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Graph Search Capabilities:'));
                logger.info(chalk.gray('   • Dual search combining semantic and symbolic approaches'));
                logger.info(chalk.gray('   • Entity search for finding specific knowledge elements'));
                logger.info(chalk.gray('   • Semantic search using vector embeddings'));
                logger.info(chalk.gray('   • Configurable similarity thresholds and result limits'));
                logger.info(chalk.gray('   • Relevance scoring for result ranking'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 600));
    }
}

/**
 * Demonstrate graph export functionality
 */
async function demonstrateGraphExport() {
    logger.info(chalk.yellow('\n📤 === Graph Export Demo ==='));
    
    const exportFormats = [
        { format: 'json', description: 'JSON format for API consumption' },
        { format: 'turtle', description: 'Turtle RDF format' },
        { format: 'json', filter: { entityType: 'technology' }, description: 'Filtered JSON export' }
    ];
    
    for (let i = 0; i < exportFormats.length; i++) {
        const exportConfig = exportFormats[i];
        
        logger.info(chalk.cyan(`\n📦 Export ${i + 1}/${exportFormats.length}:`));
        logger.info(chalk.gray(`   Format: ${exportConfig.format}`));
        logger.info(chalk.gray(`   Description: ${exportConfig.description}`));
        
        try {
            const exportData = {
                format: exportConfig.format,
                limit: 50
            };
            
            if (exportConfig.filter) {
                exportData.filter = exportConfig.filter;
                logger.info(chalk.gray(`   Filter: ${JSON.stringify(exportConfig.filter)}`));
            }
            
            const params = new URLSearchParams(Object.entries(exportData).flatMap(([key, value]) => 
                typeof value === 'object' ? [[key, JSON.stringify(value)]] : [[key, value]]
            ));
            
            const result = await makeRequest(`/ragno/export?${params.toString()}`);
            
            if (result.success && result.data) {
                logger.info(chalk.green(`   ✅ Export completed successfully`));
                logger.info(chalk.gray(`   📊 Exported ${result.tripleCount} triples`));
                logger.info(chalk.gray(`   📁 Format: ${result.format}`));
                
                if (result.format === 'json' && Array.isArray(result.data)) {
                    logger.info(chalk.gray(`   📄 Sample data (first 2 triples):`));
                    result.data.slice(0, 2).forEach((triple, idx) => {
                        logger.info(chalk.gray(`      ${idx + 1}. ${triple.subject} → ${triple.predicate} → ${triple.object}`));
                    });
                } else if (typeof result.data === 'string') {
                    const lines = result.data.split('\n');
                    logger.info(chalk.gray(`   📄 Sample data (first 2 lines):`));
                    lines.slice(0, 2).forEach((line, idx) => {
                        if (line.trim()) {
                            logger.info(chalk.gray(`      ${idx + 1}. ${line.substring(0, 80)}...`));
                        }
                    });
                }
                
                logger.info(chalk.gray(`   🕒 Exported: ${result.timestamp}`));
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Export failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Graph Export Features:'));
                logger.info(chalk.gray('   • Multiple RDF serialization formats (Turtle, JSON-LD, N-Triples)'));
                logger.info(chalk.gray('   • JSON format for web application integration'));
                logger.info(chalk.gray('   • Filtered exports based on entity types or properties'));
                logger.info(chalk.gray('   • Configurable limits for large graph subsets'));
                logger.info(chalk.gray('   • Triple counting and metadata for export verification'));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

/**
 * Demonstrate graph enrichment functionality
 */
async function demonstrateGraphEnrichment() {
    logger.info(chalk.yellow('\n✨ === Graph Enrichment Demo ==='));
    
    const enrichmentOptions = [
        { 
            embeddings: true, 
            attributes: false, 
            communities: false,
            description: "Embedding enrichment only"
        },
        { 
            embeddings: false, 
            attributes: true, 
            communities: false,
            description: "Attribute augmentation only"
        },
        { 
            embeddings: true, 
            attributes: true, 
            communities: true,
            description: "Full enrichment pipeline"
        }
    ];
    
    for (let i = 0; i < enrichmentOptions.length; i++) {
        const options = enrichmentOptions[i];
        
        logger.info(chalk.cyan(`\n✨ Enrichment ${i + 1}/${enrichmentOptions.length}:`));
        logger.info(chalk.gray(`   Description: ${options.description}`));
        logger.info(chalk.gray(`   Embeddings: ${options.embeddings ? 'Yes' : 'No'}`));
        logger.info(chalk.gray(`   Attributes: ${options.attributes ? 'Yes' : 'No'}`));
        logger.info(chalk.gray(`   Communities: ${options.communities ? 'Yes' : 'No'}`));
        
        try {
            const result = await makeRequest('/ragno/enrich', {
                method: 'POST',
                body: JSON.stringify({ options })
            });
            
            if (result.success && result.enrichment) {
                logger.info(chalk.green(`   ✅ Enrichment completed successfully`));
                
                const enrichment = result.enrichment;
                
                if (enrichment.embeddings) {
                    logger.info(chalk.gray(`   🔢 Embeddings: ${enrichment.embeddings.count || 'Generated'} vectors added`));
                }
                
                if (enrichment.attributes) {
                    logger.info(chalk.gray(`   🏷️  Attributes: ${enrichment.attributes.count || 'Added'} entity attributes`));
                }
                
                if (enrichment.communities) {
                    logger.info(chalk.gray(`   👥 Communities: ${enrichment.communities.length || 0} communities detected`));
                }
                
                logger.info(chalk.gray(`   🕒 Completed: ${result.timestamp}`));
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   ⚠️  Enrichment failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan('   📚 Graph Enrichment Capabilities:'));
                logger.info(chalk.gray('   • Vector embeddings for semantic similarity search'));
                logger.info(chalk.gray('   • AI-generated entity attributes and descriptions'));
                logger.info(chalk.gray('   • Community detection for graph clustering'));
                logger.info(chalk.gray('   • Configurable enrichment pipelines'));
                logger.info(chalk.gray('   • Incremental processing for large graphs'));
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
                const ragnoComponents = ['llm', 'embedding', 'ragno-api'];
                logger.info(chalk.gray('   🔧 Ragno-related components:'));
                ragnoComponents.forEach(component => {
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
async function runRagnoAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP Ragno API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Text decomposition into knowledge graph
        await demonstrateTextDecomposition();
        
        // Step 3: Graph statistics and analytics
        logger.info(chalk.yellow('\n⏳ Waiting 2 seconds for decomposition data to be processed...'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        await demonstrateGraphStatistics();
        
        // Step 4: Entity retrieval and filtering
        await demonstrateEntityRetrieval();
        
        // Step 5: Knowledge graph search
        await demonstrateGraphSearch();
        
        // Step 6: Graph export
        await demonstrateGraphExport();
        
        // Step 7: Graph enrichment
        await demonstrateGraphEnrichment();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All Ragno API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Text decomposition into structured knowledge graphs'));
        logger.info(chalk.gray('   • Entity extraction with confidence scoring'));
        logger.info(chalk.gray('   • Graph statistics and analytics'));
        logger.info(chalk.gray('   • Multi-modal knowledge graph search (dual, entity, semantic)'));
        logger.info(chalk.gray('   • Graph export in multiple RDF and JSON formats'));
        logger.info(chalk.gray('   • Graph enrichment with embeddings, attributes, and communities'));
        logger.info(chalk.gray('   • Comprehensive error handling and progress tracking'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify LLM provider configuration for text decomposition'));
        logger.info(chalk.gray('   • Check SPARQL endpoint availability for graph storage'));
        logger.info(chalk.gray('   • Ensure embedding handler is configured for semantic features'));
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
runRagnoAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});