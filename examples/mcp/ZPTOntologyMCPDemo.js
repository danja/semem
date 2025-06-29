#!/usr/bin/env node

/**
 * ZPT Ontology MCP Demo
 * 
 * This demo shows how to use the new ZPT ontology integration tools
 * via the MCP (Model Context Protocol) interface.
 * 
 * Prerequisites:
 * - MCP server running (npm run mcp or node mcp/index.js)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import chalk from 'chalk';

class ZPTOntologyMCPDemo {
    constructor() {
        this.client = null;
        this.mcpProcess = null;
        this.isConnected = false;
    }

    async initialize() {
        console.log(chalk.yellow('🚀 Initializing ZPT Ontology MCP Demo...\\n'));
        
        try {
            // Start MCP server process
            console.log(chalk.blue('Starting MCP server...'));
            this.mcpProcess = spawn('node', ['mcp/index.js'], {
                stdio: ['pipe', 'pipe', 'inherit'],
                cwd: process.cwd()
            });
            
            // Create MCP client
            const transport = new StdioClientTransport({
                reader: this.mcpProcess.stdout,
                writer: this.mcpProcess.stdin
            });
            
            this.client = new Client(
                {
                    name: 'zpt-ontology-demo',
                    version: '1.0.0'
                },
                {
                    capabilities: {
                        tools: {}
                    }
                }
            );
            
            await this.client.connect(transport);
            this.isConnected = true;
            
            console.log(chalk.green('✅ MCP client connected successfully\\n'));
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize MCP client:'), error.message);
            throw error;
        }
    }

    async demonstrateParameterConversion() {
        console.log(chalk.cyan('📝 Demo 1: Parameter Conversion to ZPT URIs\\n'));

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
                name: 'Community Analysis',
                params: {
                    zoom: 'community',
                    tilt: 'graph',
                    pan: { domains: ['science', 'research'] }
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(chalk.blue(`🔍 Testing: ${testCase.name}`));
            
            try {
                const result = await this.client.callTool({
                    name: 'zpt_convert_params',
                    arguments: testCase.params
                });
                
                const data = JSON.parse(result.content[0].text);
                
                if (data.success) {
                    console.log(chalk.green('✅ Conversion successful'));
                    console.log(chalk.gray(`   Conversions: ${data.conversionCount}`));
                    Object.entries(data.convertedParams).forEach(([key, value]) => {
                        if (Array.isArray(value)) {
                            console.log(chalk.gray(`   ${key}: [${value.length} URIs]`));
                        } else {
                            console.log(chalk.gray(`   ${key}: ${value.split('/').pop()}`));
                        }
                    });
                } else {
                    console.log(chalk.red(`❌ Error: ${data.error}`));
                }
                console.log();
                
            } catch (error) {
                console.log(chalk.red(`❌ Tool call failed: ${error.message}\\n`));
            }
        }
    }

    async demonstrateOntologyTerms() {
        console.log(chalk.cyan('🌐 Demo 2: ZPT Ontology Terms\\n'));

        console.log(chalk.blue('Retrieving ZPT ontology terms...'));
        
        try {
            const result = await this.client.callTool({
                name: 'zpt_get_ontology_terms',
                arguments: { category: 'all' }
            });
            
            const data = JSON.parse(result.content[0].text);
            
            if (data.success) {
                console.log(chalk.green(`✅ Retrieved ${data.totalTerms} ontology terms:`));
                
                if (data.ontologyTerms.zoomLevels) {
                    console.log(chalk.gray('\\n   📊 Zoom Levels:'));
                    data.ontologyTerms.zoomLevels.forEach(zoom => {
                        console.log(chalk.gray(`     • ${zoom.string} → ${zoom.uri.split('/').pop()}`));
                    });
                }
                
                if (data.ontologyTerms.tiltProjections) {
                    console.log(chalk.gray('\\n   🔄 Tilt Projections:'));
                    data.ontologyTerms.tiltProjections.forEach(tilt => {
                        console.log(chalk.gray(`     • ${tilt.string} → ${tilt.uri.split('/').pop()}`));
                    });
                }
                
                if (data.ontologyTerms.panDomains) {
                    console.log(chalk.gray('\\n   🔍 Pan Domains:'));
                    data.ontologyTerms.panDomains.forEach(pan => {
                        console.log(chalk.gray(`     • ${pan.string} → ${pan.uri.split('/').pop()}`));
                    });
                }
                
                console.log(chalk.gray('\\n   🏷️ Namespaces:'));
                Object.entries(data.ontologyTerms.namespaces).forEach(([prefix, uri]) => {
                    console.log(chalk.gray(`     ${prefix}: ${uri}`));
                });
            } else {
                console.log(chalk.red(`❌ Error: ${data.error}`));
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`❌ Tool call failed: ${error.message}\\n`));
        }
    }

    async demonstrateValidation() {
        console.log(chalk.cyan('✅ Demo 3: Parameter Validation\\n'));

        const validationTests = [
            {
                name: 'Valid Parameters',
                params: { zoom: 'entity', tilt: 'embedding', pan: { domains: ['ai'] } }
            },
            {
                name: 'Invalid Zoom Level',
                params: { zoom: 'invalid_zoom', tilt: 'keywords' }
            },
            {
                name: 'Mixed Valid/Invalid',
                params: { zoom: 'unit', tilt: 'graph', pan: { domains: ['valid', 'invalid'] } }
            }
        ];

        for (const test of validationTests) {
            console.log(chalk.blue(`🔍 Testing: ${test.name}`));
            
            try {
                const result = await this.client.callTool({
                    name: 'zpt_validate_ontology',
                    arguments: test.params
                });
                
                const data = JSON.parse(result.content[0].text);
                
                if (data.success) {
                    const status = data.isValid ? chalk.green('VALID') : chalk.red('INVALID');
                    console.log(chalk.gray(`   Status: ${status}`));
                    
                    if (data.errorCount > 0) {
                        console.log(chalk.red(`   Errors: ${data.errorCount}`));
                        data.validation.errors.forEach(error => {
                            console.log(chalk.red(`     • ${error}`));
                        });
                    }
                    
                    if (data.warningCount > 0) {
                        console.log(chalk.yellow(`   Warnings: ${data.warningCount}`));
                        data.validation.warnings.forEach(warning => {
                            console.log(chalk.yellow(`     • ${warning}`));
                        });
                    }
                } else {
                    console.log(chalk.red(`❌ Error: ${data.error}`));
                }
                console.log();
                
            } catch (error) {
                console.log(chalk.red(`❌ Tool call failed: ${error.message}\\n`));
            }
        }
    }

    async demonstrateSessionManagement() {
        console.log(chalk.cyan('🗄️ Demo 4: Navigation Session Management\\n'));

        // Create a session
        console.log(chalk.blue('Creating navigation session...'));
        
        try {
            const sessionResult = await this.client.callTool({
                name: 'zpt_store_session',
                arguments: {
                    purpose: 'ZPT MCP Demo - Testing session storage',
                    agentURI: 'http://example.org/agents/mcp_demo',
                    userAgent: 'ZPT Ontology MCP Demo v1.0',
                    sessionType: 'demonstration'
                }
            });
            
            const sessionData = JSON.parse(sessionResult.content[0].text);
            
            if (sessionData.success) {
                console.log(chalk.green('✅ Session created successfully'));
                console.log(chalk.gray(`   URI: ${sessionData.sessionURI}`));
                console.log(chalk.gray(`   Purpose: ${sessionData.purpose}`));
                console.log(chalk.gray(`   RDF quads: ${sessionData.quadsGenerated}`));
                console.log(chalk.gray(`   Stored in SPARQL: ${sessionData.storedInSPARQL ? 'Yes' : 'No'}`));
            } else {
                console.log(chalk.red(`❌ Error: ${sessionData.error}`));
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`❌ Session creation failed: ${error.message}\\n`));
        }

        // List sessions
        console.log(chalk.blue('Retrieving session list...'));
        
        try {
            const listResult = await this.client.callTool({
                name: 'zpt_get_sessions',
                arguments: { limit: 5 }
            });
            
            const listData = JSON.parse(listResult.content[0].text);
            
            if (listData.success) {
                console.log(chalk.green(`✅ Found ${listData.totalCount} sessions:`));
                listData.sessions.forEach((session, index) => {
                    console.log(chalk.gray(`   ${index + 1}. ${session.purpose}`));
                    console.log(chalk.gray(`      Agent: ${session.agentURI.split('/').pop()}`));
                });
            } else {
                console.log(chalk.red(`❌ Error: ${listData.error}`));
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`❌ Session listing failed: ${error.message}\\n`));
        }
    }

    async demonstrateNavigationAnalysis() {
        console.log(chalk.cyan('📊 Demo 5: Navigation Analytics\\n'));

        console.log(chalk.blue('Analyzing navigation patterns...'));
        
        try {
            const result = await this.client.callTool({
                name: 'zpt_analyze_navigation',
                arguments: { includeViews: true }
            });
            
            const data = JSON.parse(result.content[0].text);
            
            if (data.success) {
                console.log(chalk.green('✅ Navigation analysis completed:'));
                
                console.log(chalk.gray('\\n   📈 Navigation Statistics:'));
                console.log(chalk.gray(`     Total sessions: ${data.navigationStats.totalSessions}`));
                console.log(chalk.gray(`     Total views: ${data.navigationStats.totalViews}`));
                console.log(chalk.gray(`     Average query length: ${data.navigationStats.averageQueryLength} characters`));
                
                if (data.zoomLevelDistribution.length > 0) {
                    console.log(chalk.gray('\\n   🔍 Zoom Level Distribution:'));
                    data.zoomLevelDistribution.forEach(zoom => {
                        const bar = '█'.repeat(Math.min(zoom.count, 20));
                        console.log(chalk.gray(`     ${zoom.zoomLevel.padEnd(12)} ${bar} (${zoom.count})`));
                    });
                } else {
                    console.log(chalk.gray('\\n   📊 No zoom level data available'));
                }
                
                console.log(chalk.gray(`\\n   Analysis timestamp: ${new Date(data.analysisTimestamp).toLocaleString()}`));
            } else {
                console.log(chalk.red(`❌ Error: ${data.error}`));
            }
            console.log();
            
        } catch (error) {
            console.log(chalk.red(`❌ Analysis failed: ${error.message}\\n`));
        }
    }

    async cleanup() {
        console.log(chalk.yellow('\\n🧹 Cleaning up resources...'));
        
        try {
            if (this.isConnected && this.client) {
                await this.client.close();
            }
            
            if (this.mcpProcess) {
                this.mcpProcess.kill('SIGTERM');
                
                // Wait for process to exit
                await new Promise((resolve) => {
                    this.mcpProcess.on('exit', resolve);
                    setTimeout(resolve, 2000); // Timeout after 2 seconds
                });
            }
            
            console.log(chalk.green('✅ Cleanup complete'));
        } catch (error) {
            console.log(chalk.yellow('⚠️ Cleanup completed with warnings'));
        }
    }

    async run() {
        try {
            await this.initialize();
            
            // Run all demonstrations
            await this.demonstrateParameterConversion();
            await this.demonstrateOntologyTerms();
            await this.demonstrateValidation();
            await this.demonstrateSessionManagement();
            await this.demonstrateNavigationAnalysis();

            console.log(chalk.green('\\n🎉 ZPT Ontology MCP Demo Complete!'));
            console.log('\\nKey Features Demonstrated via MCP:');
            console.log(chalk.green('✅ String-to-URI parameter conversion'));
            console.log(chalk.green('✅ ZPT ontology term discovery'));
            console.log(chalk.green('✅ Parameter validation against ontology'));
            console.log(chalk.green('✅ Navigation session creation and storage'));
            console.log(chalk.green('✅ Navigation pattern analysis'));
            console.log(chalk.green('✅ Full MCP protocol integration'));

        } catch (error) {
            console.error(chalk.red('\\n❌ Demo failed:'), error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Global cleanup reference for signal handlers
let globalCleanup = null;

async function shutdown(signal) {
    console.log(`\\nReceived ${signal}, starting graceful shutdown...`);
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
    const demo = new ZPTOntologyMCPDemo();
    
    // Set up cleanup
    globalCleanup = async () => {
        await demo.cleanup();
    };
    
    demo.run().catch(error => {
        console.error('Demo execution failed:', error);
        process.exit(1);
    });
}

export default ZPTOntologyMCPDemo;