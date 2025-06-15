#!/usr/bin/env node

/**
 * Semem MCP HTTP Client Example
 * 
 * This example demonstrates how to connect to the Semem MCP HTTP server
 * using the StreamableHTTPClientTransport.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

class SememHTTPMCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.client = null;
    this.transport = null;
    this.sessionId = null;
  }

  async connect() {
    console.log(`🔌 Connecting to Semem HTTP MCP Server at ${this.baseUrl}...`);
    
    try {
      this.client = new Client({ 
        name: "semem-http-example-client", 
        version: "1.0.0" 
      });
      
      // Create HTTP transport
      this.transport = new StreamableHTTPClientTransport(
        new URL(`${this.baseUrl}/mcp`)
      );

      await this.client.connect(this.transport);
      console.log('✅ Connected to HTTP MCP server!');
      
      // Get session ID if available
      this.sessionId = this.transport.sessionId;
      if (this.sessionId) {
        console.log(`🔑 Session ID: ${this.sessionId}`);
      }
      
      // List available tools
      const tools = await this.client.listTools();
      console.log(`📚 Available tools: ${tools.tools.length}`);
      tools.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
      });
      
      return this;
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from HTTP MCP server');
    }
  }

  async callTool(name, args) {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error(`❌ Error calling ${name}:`, error.message);
      return null;
    }
  }

  async testBasicFunctionality() {
    console.log('\n🧪 === TESTING BASIC HTTP MCP FUNCTIONALITY ===');
    
    // Test concept extraction
    console.log('🏷️ Testing concept extraction...');
    const conceptResult = await this.callTool('semem_extract_concepts', {
      text: "HTTP transport enables web-based MCP integration with server-sent events for real-time communication."
    });
    
    if (conceptResult && conceptResult.success) {
      console.log(`   ✅ Extracted ${conceptResult.conceptCount} concepts:`);
      conceptResult.concepts.forEach(concept => console.log(`      - ${concept}`));
    } else {
      console.log('   ❌ Concept extraction failed');
    }

    // Test embedding generation
    console.log('\n🔢 Testing embedding generation...');
    const embeddingResult = await this.callTool('semem_generate_embedding', {
      text: "HTTP MCP server with StreamableHTTP transport"
    });
    
    if (embeddingResult && embeddingResult.success) {
      console.log(`   ✅ Generated ${embeddingResult.embeddingLength}-dimensional embedding`);
      console.log(`   📊 First 5 dimensions: [${embeddingResult.embedding.slice(0, 5).join(', ')}]`);
    } else {
      console.log('   ❌ Embedding generation failed');
    }

    // Test interaction storage
    console.log('\n📝 Testing interaction storage...');
    const storeResult = await this.callTool('semem_store_interaction', {
      prompt: "What is HTTP MCP transport?",
      response: "HTTP MCP transport uses StreamableHTTP with optional Server-Sent Events for real-time communication between MCP clients and servers over HTTP.",
      metadata: { 
        test: true, 
        transport: "http",
        timestamp: new Date().toISOString()
      }
    });
    
    if (storeResult && storeResult.success) {
      console.log(`   ✅ Stored interaction with ${storeResult.conceptCount} concepts`);
      console.log(`   📊 Has embedding: ${storeResult.hasEmbedding}`);
    } else {
      console.log('   ❌ Interaction storage failed');
    }

    // Test memory retrieval
    console.log('\n🔍 Testing memory retrieval...');
    const memoryResult = await this.callTool('semem_retrieve_memories', {
      query: "HTTP transport MCP",
      threshold: 0.6,
      limit: 2
    });
    
    if (memoryResult && memoryResult.success) {
      console.log(`   ✅ Found ${memoryResult.count} relevant memories`);
      memoryResult.memories.forEach((memory, i) => {
        const similarity = memory.similarity !== undefined ? memory.similarity.toFixed(3) : 'N/A';
        console.log(`      ${i + 1}. Similarity: ${similarity}`);
        console.log(`         Q: ${memory.prompt || 'No prompt'}`);
        const response = memory.response || memory.answer || memory.text || 'No response';
        console.log(`         A: ${response.substring(0, 100)}...`);
      });
    } else {
      console.log('   ❌ Memory retrieval failed');
    }

    // Test response generation
    console.log('\n🤖 Testing response generation...');
    const responseResult = await this.callTool('semem_generate_response', {
      prompt: "Explain the benefits of HTTP transport for MCP",
      useMemory: true,
      temperature: 0.7
    });
    
    if (responseResult && responseResult.success) {
      console.log(`   ✅ Generated response using ${responseResult.retrievalCount} memories`);
      console.log(`   📝 Response: ${responseResult.response}`);
    } else {
      console.log('   ❌ Response generation failed');
    }
  }

  async checkServerHealth() {
    console.log('\n🏥 === CHECKING SERVER HEALTH ===');
    
    try {
      // Check health endpoint directly
      const healthResponse = await fetch(`${this.baseUrl}/health`);
      const healthData = await healthResponse.json();
      
      console.log('🔍 Health Check:');
      console.log(`   - Status: ${healthData.status}`);
      console.log(`   - Memory Manager: ${healthData.services?.memoryManager ? '✅' : '❌'}`);
      console.log(`   - Config: ${healthData.services?.config ? '✅' : '❌'}`);
      console.log(`   - Sessions: ${healthData.sessions}`);
      console.log(`   - Timestamp: ${healthData.timestamp}`);
      
      // Check server info
      const infoResponse = await fetch(`${this.baseUrl}/info`);
      const infoData = await infoResponse.json();
      
      console.log('\n📊 Server Info:');
      console.log(`   - Name: ${infoData.name}`);
      console.log(`   - Version: ${infoData.version}`);
      console.log(`   - Transport: ${infoData.transport}`);
      console.log(`   - Integration URL: ${infoData.integrationUrl}`);
      
    } catch (error) {
      console.log('❌ Could not check server health:', error.message);
    }

    // Check MCP resources
    try {
      const resources = await this.client.listResources();
      console.log('\n📚 Available MCP resources:', resources.resources.map(r => r.name));

      const statusResource = resources.resources.find(r => r.uri === "semem://status");
      if (statusResource) {
        const status = await this.client.readResource({ uri: "semem://status" });
        const statusData = JSON.parse(status.contents[0].text);
        
        console.log('\n🔍 MCP System Status:');
        console.log(`   - Server: ${statusData.server?.name} v${statusData.server?.version}`);
        console.log(`   - Transport: ${statusData.server?.transport}`);
        console.log(`   - Port: ${statusData.server?.port}`);
        console.log(`   - Active Sessions: ${statusData.stats?.activeSessions}`);
      }
    } catch (error) {
      console.log('❌ Could not retrieve MCP status:', error.message);
    }
  }
}

// Test different connection scenarios
async function testConnections() {
  const scenarios = [
    { name: 'Default (localhost:3000)', url: 'http://localhost:3000' },
    { name: 'Port 4000', url: 'http://localhost:4000' }
  ];

  for (const scenario of scenarios) {
    console.log(`\n🔗 Testing connection: ${scenario.name}`);
    console.log(''.padEnd(50, '='));
    
    try {
      const client = new SememHTTPMCPClient(scenario.url);
      await client.connect();
      await client.checkServerHealth();
      await client.testBasicFunctionality();
      await client.disconnect();
      
      console.log(`✅ ${scenario.name} test completed successfully`);
      break; // Exit after first successful connection
      
    } catch (error) {
      console.log(`❌ ${scenario.name} test failed:`, error.message);
      console.log('   Trying next scenario...');
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Semem HTTP MCP Client Test');
  console.log('==============================');
  
  // Check if server is specified
  const serverUrl = process.argv[2];
  if (serverUrl) {
    console.log(`🎯 Testing specific server: ${serverUrl}`);
    const client = new SememHTTPMCPClient(serverUrl);
    
    try {
      await client.connect();
      await client.checkServerHealth();
      await client.testBasicFunctionality();
      await client.disconnect();
      
      console.log('\n🎉 === HTTP MCP TEST COMPLETED SUCCESSFULLY ===');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  } else {
    console.log('🔍 Auto-detecting server...');
    await testConnections();
    console.log('\n🎉 === CONNECTION TESTS COMPLETED ===');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down test client...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SememHTTPMCPClient;