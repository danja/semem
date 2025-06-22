#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testDirectTool() {
  try {
    // Create MCP client
    const client = new Client({ 
      name: "direct-tool-test", 
      version: "1.0.0" 
    });
    
    // Create HTTP transport
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost:3000/mcp')
    );

    // Connect
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // Test direct tool call
    console.log('🔬 Testing direct semem_extract_concepts tool...');
    const result = await client.callTool({ 
      name: 'semem_extract_concepts', 
      arguments: {
        text: "DoTA-RAG is a dynamic retrieval-augmented generation system that uses query rewriting and hybrid search for improved accuracy."
      }
    });
    
    console.log('✅ Tool executed successfully!');
    console.log('📄 Result:', JSON.stringify(JSON.parse(result.content[0].text), null, 2));
    
    await client.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDirectTool();