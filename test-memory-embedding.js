#!/usr/bin/env node

/**
 * Test calling a memory tool that should work
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testMemoryEmbedding() {
  try {
    console.log('🔍 Testing semem_generate_embedding tool...');
    
    // Initialize session
    const initResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          },
          clientInfo: {
            name: 'memory-embedding-test',
            version: '1.0.0'
          }
        }
      })
    });

    if (!initResponse.ok) {
      throw new Error(`Initialization failed: ${initResponse.status}`);
    }

    const sessionId = initResponse.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('No session ID received');
    }

    console.log('✅ Session initialized:', sessionId);

    // Call semem_generate_embedding tool
    console.log('🔧 Calling semem_generate_embedding tool...');
    const toolCallResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'semem_generate_embedding',
          arguments: {
            text: "Hello world, this is a test."
          }
        }
      })
    });

    if (!toolCallResponse.ok) {
      const errorText = await toolCallResponse.text();
      throw new Error(`Tool call failed: ${toolCallResponse.status} - ${errorText}`);
    }

    const toolCallText = await toolCallResponse.text();
    console.log('✅ Tool call completed');
    
    // Parse and display results
    console.log('📥 Parsing tool response...');
    
    const toolCallLines = toolCallText.split('\n');
    let resultData = null;
    
    for (const line of toolCallLines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result && data.result.content && data.result.content[0]) {
            const content = data.result.content[0];
            if (content.text) {
              resultData = JSON.parse(content.text);
              break;
            }
          }
        } catch (e) {
          // Continue parsing
        }
      }
    }
    
    if (resultData) {
      if (resultData.success) {
        console.log('🎉 SUCCESS! Memory embedding tool executed successfully');
        console.log('\n📊 Embedding Results:');
        console.log(`   • Text: ${resultData.text}`);
        console.log(`   • Embedding Dimension: ${resultData.embeddingDimension}`);
        console.log(`   • Preview (first 5 values): [${resultData.embeddingPreview.join(', ')}]`);
      } else {
        console.log('⚠️  Tool returned an error:', resultData.error);
      }
      
      console.log('\n📋 Full Response:');
      console.log(JSON.stringify(resultData, null, 2));
    } else {
      console.log('❓ Could not parse tool response');
      console.log('Raw response:', toolCallText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testMemoryEmbedding().then(() => {
  console.log('\n✅ Memory embedding tool test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});