#!/usr/bin/env node

/**
 * Test calling a Ragno tool to verify functionality
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testRagnoTool() {
  try {
    console.log('🔍 Testing ragno_get_graph_stats tool...');
    
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
            name: 'ragno-tool-test',
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

    // Call ragno_get_graph_stats tool
    console.log('🔧 Calling ragno_get_graph_stats tool...');
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
          name: 'ragno_get_graph_stats',
          arguments: {
            detailed: false,
            computeMetrics: true
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
      console.log('🎉 SUCCESS! Ragno tool executed successfully');
      
      if (resultData.success) {
        console.log('\n📊 Graph Statistics:');
        const stats = resultData.statistics;
        if (stats && stats.basic) {
          console.log(`   • Entities: ${stats.basic.entityCount || 0}`);
          console.log(`   • Units: ${stats.basic.unitCount || 0}`);
          console.log(`   • Relationships: ${stats.basic.relationshipCount || 0}`);
          console.log(`   • Computed At: ${stats.computedAt}`);
        }
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

testRagnoTool().then(() => {
  console.log('\n✅ Ragno tool test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});