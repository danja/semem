#!/usr/bin/env node

/**
 * Simple test to check tools list without calling any tools
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testToolsList() {
  try {
    console.log('🔍 Testing tools list only...');
    
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
            name: 'tools-list-test',
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

    // List tools
    const toolsResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      })
    });

    const toolsText = await toolsResponse.text();
    console.log('📥 Raw response received, parsing...');
    
    // Parse tools response
    const toolsLines = toolsText.split('\n');
    let toolsList = [];
    for (const line of toolsLines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result && data.result.tools) {
            toolsList = data.result.tools;
            break;
          }
        } catch (e) {
          // Continue parsing
        }
      }
    }

    console.log(`🛠️  Found ${toolsList.length} tools:`);
    toolsList.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    
    console.log('\n✅ Test completed successfully!');
    
    return toolsList.length;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testToolsList().then(count => {
  console.log(`\n🎯 Total tools available: ${count}`);
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});