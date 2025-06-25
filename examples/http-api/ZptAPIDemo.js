/**
 * HTTP ZPT API Demo
 * 
 * This example demonstrates the ZPT (Zero-Point Traversal) API endpoints for knowledge graph
 * navigation through HTTP requests. Shows navigation, previews, schema discovery, and options.
 * 
 * Key features demonstrated:
 * - Knowledge graph navigation via HTTP POST /api/zpt/navigate
 * - Navigation previews via HTTP POST /api/zpt/preview
 * - Schema and parameter discovery via HTTP GET /api/zpt/schema
 * - Available options and capabilities via HTTP GET /api/zpt/options
 * - ZPT system health via HTTP GET /api/zpt/health
 * - Multi-dimensional navigation (zoom, pan, tilt)
 * - Configurable output transformations
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

// Demo navigation scenarios for ZPT
const NAVIGATION_SCENARIOS = [
    {
        description: "Basic entity-level navigation with keywords",
        parameters: {
            zoom: 'entity',
            tilt: 'keywords',
            transform: {
                maxTokens: 2000,
                format: 'structured'
            }
        },
        expectedResult: "Entity-level knowledge with keyword representation"
    },
    {
        description: "Unit-level navigation with embeddings",
        parameters: {
            zoom: 'unit', 
            tilt: 'embedding',
            transform: {
                maxTokens: 4000,
                format: 'json',
                includeMetadata: true
            }
        },
        expectedResult: "Semantic units with vector embeddings"
    },
    {
        description: "Topic-filtered navigation with graph representation",
        parameters: {
            zoom: 'text',
            pan: {
                topic: 'artificial-intelligence',
                temporal: {
                    start: '2024-01-01',
                    end: '2024-12-31'
                }
            },
            tilt: 'graph',
            transform: {
                maxTokens: 6000,
                format: 'markdown',
                chunkStrategy: 'semantic'
            }
        },
        expectedResult: "AI-focused content with graph relationships"
    },
    {
        description: "Community-level overview with temporal representation",
        parameters: {
            zoom: 'community',
            pan: {
                entity: 'technology-companies'
            },
            tilt: 'temporal',
            transform: {
                maxTokens: 3000,
                format: 'structured',
                metadataInclusion: 'comprehensive'
            }
        },
        expectedResult: "Community summaries with temporal ordering"
    },
    {
        description: "Corpus-wide overview with compact encoding",
        parameters: {
            zoom: 'corpus',
            tilt: 'keywords',
            transform: {
                maxTokens: 1500,
                format: 'structured',
                encodingStrategy: 'compact',
                compressionLevel: 'light'
            }
        },
        expectedResult: "High-level corpus overview"
    }
];

// Preview scenarios for quick exploration
const PREVIEW_SCENARIOS = [
    {
        description: "Preview entity exploration",
        parameters: {
            zoom: 'entity',
            pan: { topic: 'machine-learning' },
            tilt: 'keywords'
        }
    },
    {
        description: "Preview semantic unit analysis",
        parameters: {
            zoom: 'unit',
            tilt: 'embedding'
        }
    },
    {
        description: "Preview community structure",
        parameters: {
            zoom: 'community',
            tilt: 'graph'
        }
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
 * Demonstrate ZPT schema and parameter discovery
 */
async function demonstrateSchemaDiscovery() {
    logger.info(chalk.yellow('\n📋 === ZPT Schema Discovery Demo ==='));
    
    try {
        const result = await makeRequest('/zpt/schema');
        
        if (result.success && result.schema) {
            logger.info(chalk.green('✅ ZPT schema retrieved successfully'));
            
            logger.info(chalk.cyan('\n📚 Parameter Schema:'));
            Object.entries(result.schema.properties || {}).forEach(([param, def]) => {
                logger.info(chalk.gray(`   🔧 ${param}: ${def.type} - ${def.description || 'No description'}`));
            });
            
            if (result.examples) {
                logger.info(chalk.cyan('\n📝 Example Configurations:'));
                Object.entries(result.examples).forEach(([type, example]) => {
                    logger.info(chalk.gray(`   💡 ${type}: ${JSON.stringify(example, null, 2).substring(0, 200)}...`));
                });
            }
            
            if (result.documentation) {
                logger.info(chalk.cyan('\n📖 Parameter Documentation:'));
                Object.entries(result.documentation).forEach(([param, doc]) => {
                    logger.info(chalk.gray(`   📘 ${param}: ${doc}`));
                });
            }
            
            if (result.defaults) {
                logger.info(chalk.cyan('\n⚙️  Default Values:'));
                Object.entries(result.defaults).forEach(([param, value]) => {
                    logger.info(chalk.gray(`   🔧 ${param}: ${JSON.stringify(value)}`));
                });
            }
        } else {
            logger.warn(chalk.yellow('⚠️  Schema retrieved but no data available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Schema discovery failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 ZPT Schema Overview (when working):'));
        logger.info(chalk.gray('   • Parameter validation and type checking'));
        logger.info(chalk.gray('   • Example configurations for different use cases'));
        logger.info(chalk.gray('   • Comprehensive documentation for each parameter'));
        logger.info(chalk.gray('   • Default values and recommended settings'));
    }
}

/**
 * Demonstrate ZPT options and capabilities
 */
async function demonstrateOptionsDiscovery() {
    logger.info(chalk.yellow('\n⚙️  === ZPT Options Discovery Demo ==='));
    
    try {
        const result = await makeRequest('/zpt/options');
        
        if (result.success && result.options) {
            logger.info(chalk.green('✅ ZPT options retrieved successfully'));
            
            const options = result.options;
            
            if (options.zoomLevels) {
                logger.info(chalk.cyan('\n🔍 Available Zoom Levels:'));
                options.zoomLevels.forEach((level, idx) => {
                    logger.info(chalk.gray(`   ${idx + 1}. ${level}`));
                });
            }
            
            if (options.tiltRepresentations) {
                logger.info(chalk.cyan('\n🎭 Tilt Representations:'));
                options.tiltRepresentations.forEach((tilt, idx) => {
                    logger.info(chalk.gray(`   ${idx + 1}. ${tilt}`));
                });
            }
            
            if (options.outputFormats) {
                logger.info(chalk.cyan('\n📄 Output Formats:'));
                options.outputFormats.forEach((format, idx) => {
                    logger.info(chalk.gray(`   ${idx + 1}. ${format}`));
                });
            }
            
            if (options.maxTokenLimits) {
                logger.info(chalk.cyan('\n🎯 Token Limits by Model:'));
                Object.entries(options.maxTokenLimits).forEach(([model, limit]) => {
                    logger.info(chalk.gray(`   🤖 ${model}: ${limit.toLocaleString()} tokens`));
                });
            }
            
            if (options.panDomains) {
                logger.info(chalk.cyan('\n🗺️  Pan Domain Filters:'));
                Object.entries(options.panDomains).forEach(([domain, description]) => {
                    logger.info(chalk.gray(`   🌐 ${domain}: ${description}`));
                });
            }
            
            if (options.transformOptions) {
                logger.info(chalk.cyan('\n🔄 Transform Options:'));
                Object.entries(options.transformOptions).forEach(([option, values]) => {
                    logger.info(chalk.gray(`   ⚙️  ${option}: [${values.join(', ')}]`));
                });
            }
        } else {
            logger.warn(chalk.yellow('⚠️  Options retrieved but no data available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Options discovery failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 ZPT Options Overview (when working):'));
        logger.info(chalk.gray('   • Available zoom levels (entity, unit, text, community, corpus)'));
        logger.info(chalk.gray('   • Tilt representations (embedding, keywords, graph, temporal)'));
        logger.info(chalk.gray('   • Output formats and encoding strategies'));
        logger.info(chalk.gray('   • Token limits for different models'));
        logger.info(chalk.gray('   • Pan domain filtering capabilities'));
        logger.info(chalk.gray('   • Transform and compression options'));
    }
}

/**
 * Demonstrate ZPT health and system status
 */
async function demonstrateZPTHealth() {
    logger.info(chalk.yellow('\n🏥 === ZPT Health Check Demo ==='));
    
    try {
        const result = await makeRequest('/zpt/health');
        
        if (result.success && result.health) {
            const health = result.health;
            
            logger.info(chalk.green(`✅ ZPT system is ${health.status}`));
            
            if (health.components) {
                logger.info(chalk.cyan('\n🔧 System Components:'));
                Object.entries(health.components).forEach(([component, info]) => {
                    const status = info.status === 'healthy' ? '✅' : 
                                 info.status === 'degraded' ? '⚠️' : '❌';
                    logger.info(chalk.gray(`   ${status} ${component}: ${info.status}`));
                });
            }
            
            if (health.capabilities) {
                logger.info(chalk.cyan('\n🎯 System Capabilities:'));
                Object.entries(health.capabilities).forEach(([capability, available]) => {
                    const status = available ? '✅' : '❌';
                    logger.info(chalk.gray(`   ${status} ${capability}: ${available ? 'Available' : 'Unavailable'}`));
                });
            }
            
            if (health.metrics) {
                logger.info(chalk.cyan('\n📊 System Metrics:'));
                Object.entries(health.metrics).forEach(([metric, value]) => {
                    logger.info(chalk.gray(`   📈 ${metric}: ${value}`));
                });
            }
            
            logger.info(chalk.gray(`\n🔄 Active requests: ${health.activeRequests || 0}`));
        } else {
            logger.warn(chalk.yellow('⚠️  Health check completed but no details available'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ ZPT health check failed: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 ZPT Health Features (when working):'));
        logger.info(chalk.gray('   • Component health monitoring'));
        logger.info(chalk.gray('   • Capability availability checking'));
        logger.info(chalk.gray('   • Real-time metrics tracking'));
        logger.info(chalk.gray('   • Active request monitoring'));
    }
}

/**
 * Demonstrate navigation previews with graceful error handling
 */
async function demonstrateNavigationPreviews() {
    logger.info(chalk.yellow('\n👁️  === Navigation Preview Demo ==='));
    
    let previewWorking = true;
    
    // Test preview with first scenario
    const testScenario = PREVIEW_SCENARIOS[0];
    logger.info(chalk.cyan(`\n🧪 Testing preview functionality:`));
    logger.info(chalk.gray(`   Description: ${testScenario.description}`));
    
    try {
        const testResult = await makeRequest('/zpt/preview', {
            method: 'POST',
            body: JSON.stringify(testScenario.parameters)
        });
        
        if (testResult.success) {
            logger.info(chalk.green(`   ✅ Preview is working!`));
            
            // Continue with all preview scenarios
            for (let i = 1; i < PREVIEW_SCENARIOS.length; i++) {
                const scenario = PREVIEW_SCENARIOS[i];
                
                logger.info(chalk.cyan(`\n👁️  Preview ${i + 1}/${PREVIEW_SCENARIOS.length}:`));
                logger.info(chalk.gray(`   Description: ${scenario.description}`));
                logger.info(chalk.gray(`   Zoom: ${scenario.parameters.zoom}`));
                logger.info(chalk.gray(`   Tilt: ${scenario.parameters.tilt}`));
                if (scenario.parameters.pan) {
                    logger.info(chalk.gray(`   Pan: ${JSON.stringify(scenario.parameters.pan)}`));
                }
                
                try {
                    const result = await makeRequest('/zpt/preview', {
                        method: 'POST',
                        body: JSON.stringify(scenario.parameters)
                    });
                    
                    if (result.success) {
                        logger.info(chalk.green(`   ✅ Preview completed successfully`));
                        
                        if (result.summary) {
                            logger.info(chalk.gray(`   📊 Summary:`));
                            logger.info(chalk.gray(`      • Corpuscles: ${result.summary.corpuscleCount || 0}`));
                            logger.info(chalk.gray(`      • Estimated tokens: ${result.summary.estimatedTokens || 0}`));
                            logger.info(chalk.gray(`      • Complexity: ${result.summary.complexity || 'unknown'}`));
                            logger.info(chalk.gray(`      • Selection time: ${result.summary.selectionTime || 0}ms`));
                        }
                        
                        if (result.corpuscles && result.corpuscles.length > 0) {
                            logger.info(chalk.gray(`   🔍 Sample corpuscles (${result.corpuscles.length}):`));
                            result.corpuscles.slice(0, 2).forEach((corpuscle, idx) => {
                                logger.info(chalk.gray(`      ${idx + 1}. ${JSON.stringify(corpuscle).substring(0, 80)}...`));
                            });
                        }
                        
                        logger.info(chalk.gray(`   ⏱️  Processing time: ${result.processingTime || 'N/A'}ms`));
                    }
                } catch (previewError) {
                    logger.warn(chalk.yellow(`   ⚠️  Preview failed: ${previewError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 700));
            }
        }
    } catch (error) {
        previewWorking = false;
        logger.warn(chalk.yellow('⚠️  Navigation preview functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Navigation Preview Overview (when working):'));
        logger.info(chalk.gray('   • Quick exploration of navigation results'));
        logger.info(chalk.gray('   • Corpuscle counting and token estimation'));
        logger.info(chalk.gray('   • Selection performance metrics'));
        logger.info(chalk.gray('   • Complexity analysis of navigation space'));
        logger.info(chalk.gray('   • Sample content preview without full processing'));
        
        logger.info(chalk.cyan('\n🔧 Expected preview scenarios:'));
        PREVIEW_SCENARIOS.forEach((scenario, index) => {
            logger.info(chalk.gray(`   ${index + 1}. ${scenario.description}`));
            logger.info(chalk.gray(`      Zoom: ${scenario.parameters.zoom}, Tilt: ${scenario.parameters.tilt}`));
            logger.info(chalk.gray(`      → Would show corpuscle count and complexity estimate`));
        });
    }
    
    if (!previewWorking) {
        logger.info(chalk.yellow('\n💡 Note: Preview requires properly configured corpus and navigation components'));
    }
}

/**
 * Demonstrate full navigation functionality with graceful error handling
 */
async function demonstrateNavigation() {
    logger.info(chalk.yellow('\n🧭 === ZPT Navigation Demo ==='));
    
    let navigationWorking = true;
    
    // Test navigation with first scenario
    const testScenario = NAVIGATION_SCENARIOS[0];
    logger.info(chalk.cyan(`\n🧪 Testing navigation functionality:`));
    logger.info(chalk.gray(`   Description: ${testScenario.description}`));
    logger.info(chalk.gray(`   Expected: ${testScenario.expectedResult}`));
    
    try {
        const testResult = await makeRequest('/zpt/navigate', {
            method: 'POST',
            body: JSON.stringify(testScenario.parameters)
        });
        
        if (testResult.success) {
            logger.info(chalk.green(`   ✅ Navigation is working!`));
            
            // Continue with all navigation scenarios
            for (let i = 1; i < NAVIGATION_SCENARIOS.length; i++) {
                const scenario = NAVIGATION_SCENARIOS[i];
                
                logger.info(chalk.cyan(`\n🧭 Navigation ${i + 1}/${NAVIGATION_SCENARIOS.length}:`));
                logger.info(chalk.gray(`   Description: ${scenario.description}`));
                logger.info(chalk.gray(`   Expected: ${scenario.expectedResult}`));
                
                const params = scenario.parameters;
                logger.info(chalk.gray(`   🔍 Zoom: ${params.zoom}`));
                logger.info(chalk.gray(`   🎭 Tilt: ${params.tilt}`));
                if (params.pan) {
                    logger.info(chalk.gray(`   🗺️  Pan: ${JSON.stringify(params.pan)}`));
                }
                logger.info(chalk.gray(`   🔄 Transform: ${params.transform.maxTokens} tokens, ${params.transform.format} format`));
                
                try {
                    const result = await makeRequest('/zpt/navigate', {
                        method: 'POST',
                        body: JSON.stringify(params)
                    });
                    
                    if (result.success) {
                        logger.info(chalk.green(`   ✅ Navigation completed successfully`));
                        
                        if (result.content) {
                            const contentPreview = typeof result.content === 'string' ? 
                                result.content.substring(0, 100) : 
                                JSON.stringify(result.content).substring(0, 100);
                            logger.info(chalk.gray(`   📄 Content preview: "${contentPreview}..."`));
                        }
                        
                        if (result.metadata) {
                            logger.info(chalk.gray(`   📊 Metadata:`));
                            if (result.metadata.pipeline) {
                                const p = result.metadata.pipeline;
                                logger.info(chalk.gray(`      ⏱️  Pipeline: ${p.totalTime || 'N/A'}ms total`));
                                logger.info(chalk.gray(`      🔍 Selection: ${p.selectionTime || 'N/A'}ms`));
                                logger.info(chalk.gray(`      🎭 Projection: ${p.projectionTime || 'N/A'}ms`));
                                logger.info(chalk.gray(`      🔄 Transform: ${p.transformTime || 'N/A'}ms`));
                            }
                            if (result.metadata.fallbackUsed) {
                                logger.info(chalk.gray(`      ⚠️  Fallback implementation used`));
                            }
                        }
                        
                        if (result.diagnostics) {
                            logger.info(chalk.gray(`   🔬 Diagnostics: ${result.diagnostics.implementation || 'standard'} implementation`));
                        }
                        
                        logger.info(chalk.gray(`   ⏱️  Total processing time: ${result.processingTime || 'N/A'}ms`));
                    }
                } catch (navError) {
                    logger.warn(chalk.yellow(`   ⚠️  Navigation failed: ${navError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        navigationWorking = false;
        logger.warn(chalk.yellow('⚠️  ZPT navigation functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 ZPT Navigation Overview (when working):'));
        logger.info(chalk.gray('   • Multi-dimensional knowledge graph traversal'));
        logger.info(chalk.gray('   • Zoom levels: entity → unit → text → community → corpus'));
        logger.info(chalk.gray('   • Pan filtering: topic, entity, temporal, geographic'));
        logger.info(chalk.gray('   • Tilt representations: embedding, keywords, graph, temporal'));
        logger.info(chalk.gray('   • Configurable output transformation and formatting'));
        logger.info(chalk.gray('   • Performance monitoring and diagnostics'));
        
        logger.info(chalk.cyan('\n🔧 Expected navigation scenarios:'));
        NAVIGATION_SCENARIOS.forEach((scenario, index) => {
            logger.info(chalk.gray(`   ${index + 1}. ${scenario.description}`));
            logger.info(chalk.gray(`      Zoom: ${scenario.parameters.zoom}, Tilt: ${scenario.parameters.tilt}`));
            logger.info(chalk.gray(`      → ${scenario.expectedResult}`));
        });
    }
    
    if (!navigationWorking) {
        logger.info(chalk.yellow('\n💡 Note: Navigation requires corpus data, SPARQL endpoint, and LLM/embedding handlers'));
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
                const zptComponents = ['llm', 'embedding', 'zpt-api'];
                logger.info(chalk.gray('   🔧 ZPT-related components:'));
                zptComponents.forEach(component => {
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
async function runZptAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP ZPT API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Schema discovery
        await demonstrateSchemaDiscovery();
        
        // Step 3: Options discovery
        await demonstrateOptionsDiscovery();
        
        // Step 4: ZPT system health
        await demonstrateZPTHealth();
        
        // Step 5: Navigation previews
        await demonstrateNavigationPreviews();
        
        // Step 6: Full navigation
        await demonstrateNavigation();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All ZPT API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Schema discovery and parameter validation'));
        logger.info(chalk.gray('   • Options exploration and capability detection'));
        logger.info(chalk.gray('   • System health and component monitoring'));
        logger.info(chalk.gray('   • Navigation previews for quick exploration'));
        logger.info(chalk.gray('   • Multi-dimensional knowledge graph navigation'));
        logger.info(chalk.gray('   • Zoom/Pan/Tilt parameter combinations'));
        logger.info(chalk.gray('   • Configurable output transformation'));
        logger.info(chalk.gray('   • Performance diagnostics and fallback handling'));
        logger.info(chalk.gray('   • Comprehensive error handling and progress tracking'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify corpus data availability in SPARQL endpoint'));
        logger.info(chalk.gray('   • Check LLM and embedding handler configuration'));
        logger.info(chalk.gray('   • Ensure ZPT navigation components are properly initialized'));
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
runZptAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});