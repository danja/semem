#!/usr/bin/env node

/**
 * Demo: Model Context Protocol (MCP) Server
 * Tests MCP server functionality and client interactions
 * 
 * Path: ./demos/06-mcp-server.js
 * Run: node demos/06-mcp-server.js
 * 
 * Expected: Successfully tests MCP server tools, resources, and prompts
 * Prerequisites: MCP server running (node mcp-server.js)
 */

import logger from 'loglevel';

logger.setLevel('info');

// Dynamic fetch import
let fetch;
try {
    fetch = globalThis.fetch;
} catch (err) {
    try {
        const module = await import('node-fetch');
        fetch = module.default;
    } catch (err2) {
        console.error('Error: fetch is not available. Please install node-fetch or use Node.js 18+');
        process.exit(1);
    }
}

const MCP_SERVER_URL = 'http://localhost:4040/mcp';
const SESSION_ID = 'demo-session-' + Date.now();

async function mcpCall(method, params = {}) {
    const requestParams = {
        ...params,
        session_id: SESSION_ID
    };

    const request = {
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method,
        params: requestParams
    };

    try {
        const response = await fetch(MCP_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonResponse = await response.json();

        if (jsonResponse.error) {
            throw new Error(`MCP error: ${jsonResponse.error.message}`);
        }

        return jsonResponse.result;
    } catch (error) {
        throw new Error(`MCP call failed: ${error.message}`);
    }
}

async function testMCPDiscovery() {
    console.log('1. Testing MCP server discovery...');

    try {
        const response = await fetch(MCP_SERVER_URL);
        const serverInfo = await response.json();

        console.log('   ✓ MCP Server Information:');
        console.log(`     - Name: ${serverInfo.name}`);
        console.log(`     - Version: ${serverInfo.version}`);
        console.log(`     - Protocol: ${serverInfo.protocol_version}`);
        console.log(`     - Vendor: ${serverInfo.vendor}`);

        // List available capabilities
        if (serverInfo.capabilities) {
            console.log('   Available capabilities:');
            if (serverInfo.capabilities.tools) {
                console.log(`     - Tools: ${serverInfo.capabilities.tools.length}`);
            }
            if (serverInfo.capabilities.resources) {
                console.log(`     - Resources: ${serverInfo.capabilities.resources.length}`);
            }
            if (serverInfo.capabilities.prompts) {
                console.log(`     - Prompts: ${serverInfo.capabilities.prompts.length}`);
            }
        }

        return true;
    } catch (error) {
        console.log(`   ✗ Discovery failed: ${error.message}`);
        return false;
    }
}

async function testMCPTools() {
    console.log('\n2. Testing MCP tools...');

    try {
        // List available tools
        const tools = await mcpCall('mcp.tools.list');
        console.log('   Available MCP Tools:');
        tools.tools.forEach(tool => {
            console.log(`     - ${tool.id}: ${tool.description}`);
        });

        // Test memory.add tool
        console.log('\n   Testing memory.add tool...');
        const addResult = await mcpCall('mcp.tools.execute', {
            tool_id: 'memory.add',
            tool_params: {
                user_input: 'What is semantic memory?',
                assistant_response: 'Semantic memory is a type of declarative memory that includes general knowledge about the world, facts, concepts, and relationships that are not tied to personal experiences.'
            }
        });

        console.log(`   ✓ Memory add result: ${addResult.status}`);

        // Test memory.retrieve tool
        console.log('\n   Testing memory.retrieve tool...');
        const retrieveResult = await mcpCall('mcp.tools.execute', {
            tool_id: 'memory.retrieve',
            tool_params: {
                query: 'Tell me about memory systems',
                limit: 3
            }
        });

        console.log('   ✓ Retrieved memories:');
        if (retrieveResult.memories && retrieveResult.memories.length > 0) {
            retrieveResult.memories.forEach((memory, index) => {
                console.log(`     ${index + 1}. Similarity: ${memory.similarity || 'N/A'}`);
                console.log(`        User: "${memory.user || memory.prompt || 'N/A'}"`);
                console.log(`        Assistant: "${(memory.assistant || memory.output || '').substring(0, 100)}..."`);
            });
        } else {
            console.log('     No memories found');
        }

        // Test embeddings.create tool
        console.log('\n   Testing embeddings.create tool...');
        const embeddingResult = await mcpCall('mcp.tools.execute', {
            tool_id: 'embeddings.create',
            tool_params: {
                text: 'Machine learning and artificial intelligence are transforming technology.'
            }
        });

        if (embeddingResult.embedding) {
            const embeddingPreview = embeddingResult.embedding.slice(0, 5);
            console.log(`   ✓ Embedding generated (${embeddingResult.embedding.length} dimensions):`);
            console.log(`     Preview: [${embeddingPreview.map(x => x.toFixed(3)).join(', ')}, ...]`);
        }

        // Test concepts.extract tool
        console.log('\n   Testing concepts.extract tool...');
        const conceptsResult = await mcpCall('mcp.tools.execute', {
            tool_id: 'concepts.extract',
            tool_params: {
                text: 'Neural networks process data through interconnected layers to recognize patterns and make predictions in machine learning applications.'
            }
        });

        if (conceptsResult.concepts) {
            console.log(`   ✓ Concepts extracted: [${conceptsResult.concepts.join(', ')}]`);
        }

        return true;
    } catch (error) {
        console.log(`   ✗ Tools test failed: ${error.message}`);
        return false;
    }
}

async function testMCPResources() {
    console.log('\n3. Testing MCP resources...');

    try {
        // List available resources
        const resources = await mcpCall('mcp.resources.list');
        console.log('   Available MCP Resources:');
        resources.resources.forEach(resource => {
            console.log(`     - ${resource.id}: ${resource.description}`);
        });

        // Test memory.stats resource
        console.log('\n   Testing memory.stats resource...');
        const statsResult = await mcpCall('mcp.resources.get', {
            resource_id: 'memory.stats'
        });

        console.log('   ✓ Memory statistics:');
        if (statsResult.stats) {
            Object.entries(statsResult.stats).forEach(([key, value]) => {
                console.log(`     - ${key}: ${value}`);
            });
        }

        // Test memory.config resource
        console.log('\n   Testing memory.config resource...');
        const configResult = await mcpCall('mcp.resources.get', {
            resource_id: 'memory.config'
        });

        console.log('   ✓ Memory configuration:');
        if (configResult.config) {
            Object.entries(configResult.config).forEach(([key, value]) => {
                console.log(`     - ${key}: ${value}`);
            });
        }

        // Test server.info resource
        console.log('\n   Testing server.info resource...');
        const serverInfoResult = await mcpCall('mcp.resources.get', {
            resource_id: 'server.info'
        });

        console.log('   ✓ Server information:');
        if (serverInfoResult) {
            console.log(`     - Status: ${serverInfoResult.status}`);
            console.log(`     - Uptime: ${Math.round(serverInfoResult.uptime)}s`);
            console.log(`     - Protocol: ${serverInfoResult.protocol_version}`);
        }

        return true;
    } catch (error) {
        console.log(`   ✗ Resources test failed: ${error.message}`);
        return false;
    }
}

async function testMCPPrompts() {
    console.log('\n4. Testing MCP prompts...');

    try {
        // List available prompts
        const prompts = await mcpCall('mcp.prompts.list');
        console.log('   Available MCP Prompts:');
        prompts.prompts.forEach(prompt => {
            console.log(`     - ${prompt.id}: ${prompt.title}`);
            console.log(`       Description: ${prompt.description}`);
        });

        // Test specific prompt templates
        const promptTests = [
            'memory.search_template',
            'memory.add_template',
            'concepts.extract_template'
        ];

        for (const promptId of promptTests) {
            try {
                console.log(`\n   Testing ${promptId}...`);
                const promptResult = await mcpCall('mcp.prompts.get', {
                    prompt_id: promptId
                });

                console.log(`   ✓ Prompt template retrieved:`);
                console.log(`     Title: ${promptResult.title}`);
                console.log(`     Description: ${promptResult.description}`);
                console.log(`     Template length: ${promptResult.template?.length || 0} characters`);
            } catch (promptError) {
                console.log(`   ✗ ${promptId} failed: ${promptError.message}`);
            }
        }

        return true;
    } catch (error) {
        console.log(`   ✗ Prompts test failed: ${error.message}`);
        return false;
    }
}

async function testMCPBatchOperations() {
    console.log('\n5. Testing MCP batch operations...');

    try {
        // Test adding multiple memories in sequence
        const batchData = [
            {
                user_input: "What is machine learning?",
                assistant_response: "Machine learning is a subset of AI that enables computers to learn from data without explicit programming."
            },
            {
                user_input: "How do neural networks work?",
                assistant_response: "Neural networks are computing systems inspired by biological neural networks, using interconnected nodes to process information."
            },
            {
                user_input: "What is deep learning?",
                assistant_response: "Deep learning is a subset of machine learning using neural networks with multiple layers to model complex patterns."
            }
        ];

        console.log('   Adding batch memories...');
        for (let i = 0; i < batchData.length; i++) {
            const data = batchData[i];
            console.log(`     Adding memory ${i + 1}: "${data.user_input}"`);
            
            await mcpCall('mcp.tools.execute', {
                tool_id: 'memory.add',
                tool_params: data
            });
        }

        console.log('   ✓ Batch memories added successfully');

        // Test batch retrieval
        console.log('\n   Testing batch retrieval...');
        const batchQuery = "Tell me about artificial intelligence and machine learning";
        
        const batchResults = await mcpCall('mcp.tools.execute', {
            tool_id: 'memory.retrieve',
            tool_params: {
                query: batchQuery,
                limit: 5
            }
        });

        console.log(`   ✓ Batch retrieval found ${batchResults.memories?.length || 0} memories`);

        return true;
    } catch (error) {
        console.log(`   ✗ Batch operations failed: ${error.message}`);
        return false;
    }
}

async function testMCPServer() {
    console.log('=== DEMO: Model Context Protocol (MCP) Server ===\n');

    const testResults = {
        discovery: false,
        tools: false,
        resources: false,
        prompts: false,
        batch: false
    };

    try {
        testResults.discovery = await testMCPDiscovery();
        testResults.tools = await testMCPTools();
        testResults.resources = await testMCPResources();
        testResults.prompts = await testMCPPrompts();
        testResults.batch = await testMCPBatchOperations();

        // Summary
        console.log('\n=== MCP TEST SUMMARY ===');

        const successful = Object.entries(testResults).filter(([_, success]) => success);
        const failed = Object.entries(testResults).filter(([_, success]) => !success);

        console.log(`\n✅ Successful tests (${successful.length}):`);
        successful.forEach(([test, _]) => {
            console.log(`   - ${test}: Working correctly`);
        });

        if (failed.length > 0) {
            console.log(`\n❌ Failed tests (${failed.length}):`);
            failed.forEach(([test, _]) => {
                console.log(`   - ${test}: Failed or unavailable`);
            });
        }

        if (successful.length === Object.keys(testResults).length) {
            console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        } else {
            console.log(`\n⚠️ DEMO PARTIALLY SUCCESSFUL (${successful.length}/${Object.keys(testResults).length})`);
        }

        console.log('\nWhat was tested:');
        console.log('- MCP server discovery and capabilities');
        console.log('- Memory management tools (add, retrieve)');
        console.log('- Embedding generation tools');
        console.log('- Concept extraction tools');
        console.log('- Resource access (stats, config, info)');
        console.log('- Prompt template system');
        console.log('- Batch operations and session management');

    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);

        console.log('\nTroubleshooting:');
        console.log('- Start the MCP server: node mcp-server.js');
        console.log('- Ensure server is running on port 4040');
        console.log('- Check if Ollama is running for embedding operations');
        console.log('- Verify JSON-RPC 2.0 protocol compatibility');
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

testMCPServer();