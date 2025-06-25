#!/usr/bin/env node

/**
 * Test the zpt_navigate tool
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testZptNavigate() {
  try {
    console.log('🔍 Testing zpt_navigate tool...');
    
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
            name: 'zpt-navigate-test',
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

    // Test zpt_navigate with basic parameters
    console.log('\n🔧 Calling zpt_navigate tool...');
    const toolCallResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'zpt_navigate',
          arguments: {
            query: "artificial intelligence",
            zoom: "entity",
            tilt: "keywords",
            transform: {
              maxTokens: 1000,
              format: "json"
            }
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
        console.log('🎉 SUCCESS! ZPT Navigate tool executed successfully');
        console.log('\n📊 Navigation Results:');
        console.log(`   • Query: ${resultData.query || 'N/A'}`);
        console.log(`   • Zoom: ${resultData.zoom || 'N/A'}`);
        console.log(`   • Tilt: ${resultData.tilt || 'N/A'}`);
        console.log(`   • Result Type: ${typeof resultData.result}`);
        if (resultData.corpuscles) {
          console.log(`   • Corpuscles Found: ${resultData.corpuscles.length}`);
        }
      } else {
        console.log('⚠️  Tool returned an error:', resultData.error);
        console.log('📋 Full Error Response:');
        console.log(JSON.stringify(resultData, null, 2));
      }
    } else {
      console.log('❓ Could not parse tool response');
      console.log('Raw response (first 500 chars):', toolCallText.substring(0, 500));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testZptNavigate().then(() => {
  console.log('\n✅ ZPT Navigate test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});