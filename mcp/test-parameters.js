#!/usr/bin/env node

/**
 * Parameter Testing Script for Semem MCP Server
 * 
 * This script tests parameter passing to the MCP server tools
 * and provides detailed debugging information.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class ParameterTester {
  constructor() {
    this.client = null;
    this.transport = null;
    this.testResults = [];
  }

  async connect() {
    console.log('🔌 Connecting to Semem MCP Server for parameter testing...');
    
    this.client = new Client({ 
      name: "parameter-test-client", 
      version: "1.0.0" 
    });
    
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp/index.js'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        MCP_DEBUG: 'true',
        MCP_DEBUG_LEVEL: 'debug'
      }
    });

    await this.client.connect(this.transport);
    console.log('✅ Connected to MCP server!');
    
    // List available tools
    const tools = await this.client.listTools();
    console.log(`📚 Available tools: ${tools.tools.length}`);
    tools.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
    });
    
    return this;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MCP server');
    }
  }

  async callTool(name, args) {
    console.log(`\n🛠️  Testing tool: ${name}`);
    console.log(`📥 Parameters: ${JSON.stringify(args, null, 2)}`);
    
    try {
      const result = await this.client.callTool({ name, arguments: args });
      
      const response = JSON.parse(result.content[0].text);
      console.log(`✅ Success: ${response.success}`);
      
      if (response.success) {
        console.log(`📤 Result summary: ${response.message || 'OK'}`);
      } else {
        console.log(`❌ Error: ${response.error}`);
      }
      
      this.testResults.push({
        tool: name,
        args,
        success: response.success,
        error: response.error || null,
        response: response
      });
      
      return response;
    } catch (error) {
      console.log(`❌ Call failed: ${error.message}`);
      this.testResults.push({
        tool: name,
        args,
        success: false,
        error: error.message,
        response: null
      });
      return null;
    }
  }

  async testDiagnosticTool() {
    console.log('\n🔍 === DIAGNOSTIC TOOL TEST ===');
    
    const testCases = [
      // Test with various parameter types
      {
        testString: "Hello, world!",
        testNumber: 42,
        testBoolean: true,
        testObject: { nested: "value", array: [1, 2, 3] },
        testArray: ["item1", "item2", "item3"]
      },
      // Test with minimal parameters
      {
        testString: "minimal"
      },
      // Test with null/undefined values
      {
        testString: "null test",
        testNumber: null,
        testBoolean: false
      }
    ];

    for (const testCase of testCases) {
      await this.callTool('mcp_debug_params', testCase);
    }
  }

  async testMemoryTools() {
    console.log('\n🧠 === MEMORY TOOLS TEST ===');

    // Test extract concepts with various inputs
    const conceptTests = [
      { text: "Artificial intelligence and machine learning are transforming technology." },
      { text: "Simple text" },
      { text: "" }, // Should fail
      {}, // Should fail - missing text
      { text: "Very long text that should be truncated in the response because it's longer than the usual limit we set for display purposes in the debugging output." }
    ];

    for (const test of conceptTests) {
      await this.callTool('semem_extract_concepts', test);
    }

    // Test generate embedding
    const embeddingTests = [
      { text: "Test embedding generation" },
      { text: "" }, // Should fail
      {} // Should fail - missing text
    ];

    for (const test of embeddingTests) {
      await this.callTool('semem_generate_embedding', test);
    }

    // Test store interaction
    const storeTests = [
      {
        prompt: "What is AI?",
        response: "AI is artificial intelligence",
        metadata: { topic: "technology" }
      },
      {
        prompt: "Test prompt",
        response: "Test response"
        // No metadata - should use default
      },
      {
        prompt: "", // Should fail
        response: "Empty prompt test"
      },
      {} // Should fail - missing required fields
    ];

    for (const test of storeTests) {
      await this.callTool('semem_store_interaction', test);
    }

    // Test retrieve memories
    const retrieveTests = [
      {
        query: "artificial intelligence",
        threshold: 0.7,
        limit: 5
      },
      {
        query: "test query"
        // Using defaults for other parameters
      },
      {
        query: "", // Should fail
      },
      {} // Should fail - missing query
    ];

    for (const test of retrieveTests) {
      await this.callTool('semem_retrieve_memories', test);
    }

    // Test generate response
    const responseTests = [
      {
        prompt: "Explain machine learning",
        useMemory: true,
        temperature: 0.7,
        maxTokens: 100
      },
      {
        prompt: "Simple question"
        // Using defaults
      },
      {
        prompt: "", // Should fail
      },
      {} // Should fail - missing prompt
    ];

    for (const test of responseTests) {
      await this.callTool('semem_generate_response', test);
    }
  }

  printSummary() {
    console.log('\n📊 === TEST SUMMARY ===');
    
    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);
    
    console.log(`Total tests: ${this.testResults.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed tests:');
      failed.forEach(test => {
        console.log(`   - ${test.tool}: ${test.error}`);
      });
    }
    
    if (successful.length > 0) {
      console.log('\n✅ Successful tests:');
      successful.forEach(test => {
        console.log(`   - ${test.tool}: OK`);
      });
    }
  }
}

// Main execution
async function main() {
  console.log('🧪 Semem MCP Parameter Testing');
  console.log('==============================');
  
  const tester = new ParameterTester();
  
  try {
    // Connect to server
    await tester.connect();
    
    // Run diagnostic tests first
    await tester.testDiagnosticTool();
    
    // Test memory tools
    await tester.testMemoryTools();
    
    // Print summary
    tester.printSummary();
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
  } finally {
    await tester.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down tests...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default ParameterTester;