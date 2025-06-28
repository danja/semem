#!/usr/bin/env node

/**
 * ZPT Ontology API Demo
 * 
 * This demo exercises the new ZPT ontology integration HTTP API endpoints,
 * demonstrating string-to-URI conversion, navigation session storage,
 * RDF metadata management, and navigation analytics.
 * 
 * Prerequisites:
 * - API server running (npm run api-server or node src/servers/api-server.js)
 * - SPARQL endpoint configured for metadata storage
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

class ZPTOntologyAPIDemo {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:4100';
        this.apiKey = process.env.SEMEM_API_KEY || 'semem-dev-key';
        this.sessionData = {};
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTime: 0
        };
    }

    async initialize() {
        console.log(chalk.yellow('🚀 Initializing ZPT Ontology API Demo...\n'));
        
        // Check API server availability
        try {
            const healthResponse = await this.makeRequest('GET', '/api/health');
            if (healthResponse.status === 'healthy') {
                console.log(chalk.green('✅ API server is healthy'));
                console.log(chalk.gray(`   Components: ${Object.keys(healthResponse.components).length}`));
            }
        } catch (error) {
            console.log(chalk.red('❌ API server not available'));
            console.log(chalk.gray(`   Make sure to run: npm run api-server`));
            throw new Error('API server unavailable');
        }

        // Check ZPT API availability
        try {
            const zptHealthResponse = await this.makeRequest('GET', '/api/navigate/health');
            console.log(chalk.green('✅ ZPT API is available'));
        } catch (error) {
            console.log(chalk.yellow('⚠️ ZPT API may have limited functionality'));
        }

        console.log(chalk.green('✅ Initialization complete\n'));
    }

    async demonstrateParameterConversion() {
        console.log(chalk.cyan('📝 Demo 1: Parameter Conversion to ZPT URIs\n'));

        const testCases = [
            {
                name: 'Basic Entity Navigation',
                params: {
                    zoom: 'entity',
                    tilt: 'embedding',
                    pan: { domains: ['ai', 'machine_learning'] }
                }
            },
            {
                name: 'Unit-Level Analysis',
                params: {
                    zoom: 'unit',
                    tilt: 'keywords',
                    pan: { domains: ['science', 'research'] }
                }
            },
            {
                name: 'Community Graph Navigation',
                params: {
                    zoom: 'community',
                    tilt: 'graph',
                    pan: { domains: ['technology', 'innovation'] }
                }
            },
            {
                name: 'Temporal Analysis',
                params: {
                    zoom: 'text',
                    tilt: 'temporal',
                    pan: { domains: ['brewing', 'process'] }
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(chalk.blue(`🔍 Testing: ${testCase.name}`));
            
            try {
                const result = await this.makeRequest('POST', '/api/navigate/convert-params', testCase.params);
                
                console.log(chalk.gray('   Original parameters:'));
                console.log(chalk.gray(`     ${JSON.stringify(testCase.params)}`));
                console.log(chalk.green('   Converted URIs:'));
                Object.entries(result.convertedParams).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        console.log(chalk.green(`     ${key}: [${value.length} URIs]`));
                    } else {
                        console.log(chalk.green(`     ${key}: ${value.split('/').pop()}`));
                    }
                });
                console.log(chalk.gray(`   Conversion count: ${result.conversionCount}\n`));
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Error: ${error.message}\n`));
            }
        }
    }

    async demonstrateSessionManagement() {
        console.log(chalk.cyan('🗄️ Demo 2: Navigation Session Management\n'));

        // Create navigation sessions
        const sessionConfigs = [
            {
                purpose: 'ZPT API Demo - Entity Analysis',
                agentURI: 'http://example.org/agents/api_demo_1',
                userAgent: 'ZPT Ontology API Demo v1.0',
                sessionType: 'demonstration'
            },
            {
                purpose: 'ZPT API Demo - Community Navigation',
                agentURI: 'http://example.org/agents/api_demo_2',
                userAgent: 'ZPT Ontology API Demo v1.0',
                sessionType: 'analysis'
            },
            {
                purpose: 'ZPT API Demo - Temporal Research',
                agentURI: 'http://example.org/agents/api_demo_3',
                userAgent: 'ZPT Ontology API Demo v1.0',
                sessionType: 'research'
            }
        ];

        console.log(chalk.blue('Creating navigation sessions...'));
        
        for (let i = 0; i < sessionConfigs.length; i++) {
            const config = sessionConfigs[i];
            
            try {
                const result = await this.makeRequest('POST', '/api/navigate/store-session', config);
                
                console.log(chalk.green(`✅ Session ${i + 1} created:`));
                console.log(chalk.gray(`   URI: ${result.sessionURI}`));
                console.log(chalk.gray(`   Purpose: ${config.purpose}`));
                console.log(chalk.gray(`   RDF quads: ${result.quadsGenerated}`));
                console.log(chalk.gray(`   Stored in SPARQL: ${result.storedInSPARQL ? 'Yes' : 'No'}\n`));
                
                // Store session URI for later use
                this.sessionData[`session${i + 1}`] = result.sessionURI;
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to create session ${i + 1}: ${error.message}\n`));
            }
        }

        // List created sessions
        console.log(chalk.blue('Retrieving session list...'));
        
        try {
            const sessionsResult = await this.makeRequest('GET', '/api/navigate/sessions?limit=10');
            
            console.log(chalk.green(`✅ Found ${sessionsResult.totalCount} sessions:`));
            sessionsResult.sessions.forEach((session, index) => {
                const purpose = session.purpose.substring(0, 50) + (session.purpose.length > 50 ? '...' : '');
                console.log(chalk.gray(`   ${index + 1}. ${purpose}`));
                console.log(chalk.gray(`      Agent: ${session.agentURI.split('/').pop()}`));
                console.log(chalk.gray(`      Time: ${new Date(session.startTime).toLocaleString()}`));
            });
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Failed to retrieve sessions: ${error.message}\n`));
        }

        // Get details for first session
        if (this.sessionData.session1) {
            console.log(chalk.blue('Getting session details...'));
            
            try {
                const sessionDetails = await this.makeRequest('GET', `/api/navigate/sessions/${encodeURIComponent(this.sessionData.session1)}`);
                
                console.log(chalk.green('✅ Session details retrieved:'));
                console.log(chalk.gray(`   Session URI: ${sessionDetails.sessionURI}`));
                console.log(chalk.gray(`   Properties: ${Object.keys(sessionDetails.properties).length}`));
                console.log(chalk.gray(`   Associated views: ${sessionDetails.viewCount}`));
                
                // Show some properties
                const relevantProps = ['hasPurpose', 'wasAssociatedWith', 'startedAtTime'];
                relevantProps.forEach(prop => {
                    if (sessionDetails.properties[prop]) {
                        console.log(chalk.gray(`   ${prop}: ${sessionDetails.properties[prop]}`));
                    }
                });
                console.log();
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to get session details: ${error.message}\n`));
            }
        }
    }

    async demonstrateOntologyTerms() {
        console.log(chalk.cyan('🌐 Demo 3: ZPT Ontology Terms\n'));

        console.log(chalk.blue('Retrieving ZPT ontology terms...'));
        
        try {
            const termsResult = await this.makeRequest('GET', '/api/navigate/ontology/terms');
            
            console.log(chalk.green(`✅ Retrieved ${termsResult.totalTerms} ontology terms:`));
            
            console.log(chalk.gray('\n   📊 Zoom Levels:'));
            termsResult.ontologyTerms.zoomLevels.forEach(zoom => {
                console.log(chalk.gray(`     • ${zoom.string} → ${zoom.uri.split('/').pop()}`));
                console.log(chalk.gray(`       ${zoom.description}`));
            });
            
            console.log(chalk.gray('\n   🔄 Tilt Projections:'));
            termsResult.ontologyTerms.tiltProjections.forEach(tilt => {
                console.log(chalk.gray(`     • ${tilt.string} → ${tilt.uri.split('/').pop()}`));
                console.log(chalk.gray(`       ${tilt.description}`));
            });
            
            console.log(chalk.gray('\n   🔍 Pan Domains:'));
            termsResult.ontologyTerms.panDomains.forEach(pan => {
                console.log(chalk.gray(`     • ${pan.string} → ${pan.uri.split('/').pop()}`));
                console.log(chalk.gray(`       ${pan.description}`));
            });
            
            console.log(chalk.gray('\n   🏷️ Namespaces:'));
            Object.entries(termsResult.ontologyTerms.namespaces).forEach(([prefix, uri]) => {
                console.log(chalk.gray(`     ${prefix}: ${uri}`));
            });
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Failed to retrieve ontology terms: ${error.message}\n`));
        }
    }

    async demonstrateParameterValidation() {
        console.log(chalk.cyan('✅ Demo 4: Parameter Validation\n'));

        const validationTests = [
            {
                name: 'Valid Parameters',
                params: { zoom: 'entity', tilt: 'embedding', pan: { domains: ['ai', 'science'] } },
                expectValid: true
            },
            {
                name: 'Invalid Zoom Level',
                params: { zoom: 'invalid_zoom', tilt: 'keywords' },
                expectValid: false
            },
            {
                name: 'Invalid Tilt Projection',
                params: { zoom: 'unit', tilt: 'invalid_tilt' },
                expectValid: false
            },
            {
                name: 'Mixed Valid/Invalid Domains',
                params: { zoom: 'community', tilt: 'graph', pan: { domains: ['valid_domain', 'invalid_domain'] } },
                expectValid: true // Should have warnings but still valid
            }
        ];

        for (const test of validationTests) {
            console.log(chalk.blue(`🔍 Testing: ${test.name}`));
            
            try {
                const result = await this.makeRequest('POST', '/api/navigate/validate-ontology', test.params);
                
                const status = result.isValid ? chalk.green('VALID') : chalk.red('INVALID');
                console.log(chalk.gray(`   Status: ${status}`));
                
                if (result.errorCount > 0) {
                    console.log(chalk.red(`   Errors: ${result.errorCount}`));
                    result.validation.errors.forEach(error => {
                        console.log(chalk.red(`     • ${error}`));
                    });
                }
                
                if (result.warningCount > 0) {
                    console.log(chalk.yellow(`   Warnings: ${result.warningCount}`));
                    result.validation.warnings.forEach(warning => {
                        console.log(chalk.yellow(`     • ${warning}`));
                    });
                }
                
                if (Object.keys(result.validation.convertedParams).length > 0) {
                    console.log(chalk.green(`   Converted: ${Object.keys(result.validation.convertedParams).join(', ')}`));
                }
                
                console.log();
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Validation failed: ${error.message}\n`));
            }
        }
    }

    async demonstrateNavigationAnalysis() {
        console.log(chalk.cyan('📊 Demo 5: Navigation Analytics\n'));

        console.log(chalk.blue('Analyzing navigation patterns...'));
        
        try {
            const analysisResult = await this.makeRequest('POST', '/api/navigate/analyze', {});
            
            console.log(chalk.green('✅ Navigation analysis completed:'));
            
            console.log(chalk.gray('\n   📈 Navigation Statistics:'));
            console.log(chalk.gray(`     Total sessions: ${analysisResult.navigationStats.totalSessions}`));
            console.log(chalk.gray(`     Total views: ${analysisResult.navigationStats.totalViews}`));
            console.log(chalk.gray(`     Average query length: ${analysisResult.navigationStats.averageQueryLength} characters`));
            
            if (analysisResult.zoomLevelDistribution.length > 0) {
                console.log(chalk.gray('\n   🔍 Zoom Level Distribution:'));
                analysisResult.zoomLevelDistribution.forEach(zoom => {
                    const bar = '█'.repeat(Math.min(zoom.count, 20));
                    console.log(chalk.gray(`     ${zoom.zoomLevel.padEnd(12)} ${bar} (${zoom.count})`));
                });
            } else {
                console.log(chalk.gray('\n   📊 No zoom level data available (requires navigation views)'));
            }
            
            console.log(chalk.gray(`\n   Analysis timestamp: ${new Date(analysisResult.analysisTimestamp).toLocaleString()}`));
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Analysis failed: ${error.message}\n`));
        }
    }

    async demonstrateServiceDiscovery() {
        console.log(chalk.cyan('🔍 Demo 6: Service Discovery\n'));

        console.log(chalk.blue('Discovering available API services...'));
        
        try {
            const servicesResult = await this.makeRequest('GET', '/api/services');
            
            console.log(chalk.green('✅ Service discovery completed:'));
            console.log(chalk.gray(`   Total services: ${servicesResult.summary.totalServices}`));
            console.log(chalk.gray(`   Healthy services: ${servicesResult.summary.healthyServices}`));
            console.log(chalk.gray(`   Total endpoints: ${servicesResult.summary.totalEndpoints}`));
            
            // Show ZPT service details
            const zptService = servicesResult.services.advanced.zpt;
            if (zptService) {
                console.log(chalk.gray('\n   🎯 ZPT Navigation API:'));
                console.log(chalk.gray(`     Status: ${zptService.status}`));
                console.log(chalk.gray(`     Description: ${zptService.description}`));
                console.log(chalk.gray(`     Endpoints: ${zptService.endpoints.length}`));
                
                // Show new ontology endpoints
                const ontologyEndpoints = zptService.endpoints.filter(e => 
                    e.includes('convert-params') || 
                    e.includes('sessions') || 
                    e.includes('ontology') ||
                    e.includes('analyze')
                );
                
                if (ontologyEndpoints.length > 0) {
                    console.log(chalk.gray('\n     🌐 New Ontology Integration Endpoints:'));
                    ontologyEndpoints.forEach(endpoint => {
                        console.log(chalk.gray(`       • ${endpoint}`));
                    });
                }
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Service discovery failed: ${error.message}\n`));
        }
    }

    async demonstrateViewOperations() {
        console.log(chalk.cyan('👁️ Demo 7: Navigation View Operations\n'));

        // Try to get navigation views
        console.log(chalk.blue('Retrieving navigation views...'));
        
        try {
            const viewsResult = await this.makeRequest('GET', '/api/navigate/views?limit=5');
            
            console.log(chalk.green(`✅ Found ${viewsResult.totalCount} navigation views:`));
            
            if (viewsResult.views.length > 0) {
                viewsResult.views.forEach((view, index) => {
                    console.log(chalk.gray(`   ${index + 1}. Query: "${view.query}"`));
                    console.log(chalk.gray(`      Session: ${view.sessionURI.split('/').pop()}`));
                    console.log(chalk.gray(`      Time: ${new Date(view.timestamp).toLocaleString()}`));
                });
                
                // Get details for first view
                const firstView = viewsResult.views[0];
                console.log(chalk.blue('\nGetting view details...'));
                
                try {
                    const viewDetails = await this.makeRequest('GET', `/api/navigate/views/${encodeURIComponent(firstView.viewURI)}`);
                    
                    console.log(chalk.green('✅ View details retrieved:'));
                    console.log(chalk.gray(`   View URI: ${viewDetails.viewURI}`));
                    console.log(chalk.gray(`   Properties: ${viewDetails.propertyCount}`));
                    
                    // Show relevant properties
                    const relevantProps = ['answersQuery', 'partOfSession', 'navigationTimestamp'];
                    relevantProps.forEach(prop => {
                        if (viewDetails.properties[prop]) {
                            console.log(chalk.gray(`   ${prop}: ${viewDetails.properties[prop]}`));
                        }
                    });
                    
                } catch (error) {
                    console.log(chalk.red(`   ❌ Failed to get view details: ${error.message}`));
                }
            } else {
                console.log(chalk.gray('   📊 No navigation views found (views are created during actual navigation)'));
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`   ❌ Failed to retrieve views: ${error.message}\n`));
        }
    }

    async makeRequest(method, endpoint, data = null) {
        const startTime = performance.now();
        this.metrics.totalRequests++;
        
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.metrics.successfulRequests++;
            this.metrics.totalTime += performance.now() - startTime;
            
            return responseData.data || responseData;
            
        } catch (error) {
            this.metrics.failedRequests++;
            throw error;
        }
    }

    printMetrics() {
        console.log(chalk.cyan('📈 Demo Performance Metrics\n'));
        
        console.log(chalk.gray(`Total requests: ${this.metrics.totalRequests}`));
        console.log(chalk.gray(`Successful requests: ${this.metrics.successfulRequests}`));
        console.log(chalk.gray(`Failed requests: ${this.metrics.failedRequests}`));
        
        if (this.metrics.successfulRequests > 0) {
            const avgTime = (this.metrics.totalTime / this.metrics.successfulRequests).toFixed(2);
            console.log(chalk.gray(`Average response time: ${avgTime}ms`));
        }
        
        const successRate = ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1);
        console.log(chalk.gray(`Success rate: ${successRate}%`));
    }

    async cleanup() {
        console.log(chalk.yellow('\n🧹 Cleaning up resources...'));
        console.log(chalk.green('✅ Cleanup complete'));
    }

    async run() {
        try {
            await this.initialize();
            
            // Run all demonstrations
            await this.demonstrateParameterConversion();
            await this.demonstrateSessionManagement();
            await this.demonstrateOntologyTerms();
            await this.demonstrateParameterValidation();
            await this.demonstrateNavigationAnalysis();
            await this.demonstrateServiceDiscovery();
            await this.demonstrateViewOperations();

            console.log(chalk.green('\n🎉 ZPT Ontology API Demo Complete!'));
            console.log('\nKey Features Demonstrated:');
            console.log(chalk.green('✅ String-to-URI parameter conversion'));
            console.log(chalk.green('✅ Navigation session creation and storage'));
            console.log(chalk.green('✅ RDF metadata management with SPARQL'));
            console.log(chalk.green('✅ ZPT ontology term discovery'));
            console.log(chalk.green('✅ Parameter validation against ontology'));
            console.log(chalk.green('✅ Navigation pattern analysis'));
            console.log(chalk.green('✅ Service discovery and health checking'));
            console.log(chalk.green('✅ Navigation view operations'));

            this.printMetrics();

        } catch (error) {
            console.error(chalk.red('\n❌ Demo failed:'), error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Global cleanup reference for signal handlers
let globalCleanup = null;

async function shutdown(signal) {
    console.log(`\nReceived ${signal}, starting graceful shutdown...`);
    if (globalCleanup) {
        await globalCleanup();
    }
    process.exit(0);
}

// Signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new ZPTOntologyAPIDemo();
    
    // Set up cleanup
    globalCleanup = async () => {
        await demo.cleanup();
    };
    
    demo.run().catch(error => {
        console.error('Demo execution failed:', error);
        process.exit(1);
    });
}

export default ZPTOntologyAPIDemo;