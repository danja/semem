#!/usr/bin/env node

/**
 * Test extract_concepts with simple text: "the cat sat on the mat"
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testSimpleExtract() {
  try {
    console.log('🔍 Testing extract_concepts with simple text...');
    
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
            name: 'simple-extract-test',
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

    // Test extract_concepts with simple text
    console.log('\n🔧 Calling extract_concepts with "the cat sat on the mat"...');
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
          name: 'semem_extract_concepts',
          arguments: {
            text: "the cat sat on the mat"
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
        console.log('🎉 SUCCESS! Concepts extracted from simple text');
        console.log(`📝 Original text: "${resultData.text}"`);
        console.log(`🔍 Concepts found: ${resultData.conceptCount}`);
        
        if (resultData.concepts && resultData.concepts.length > 0) {
          console.log('\n📋 Extracted concepts:');
          resultData.concepts.forEach((concept, idx) => {
            console.log(`   ${idx + 1}. "${concept}"`);
          });
        } else {
          console.log('⚠️  No concepts found in simple text');
        }
        
        console.log('\n💭 Analysis:');
        if (resultData.conceptCount === 0) {
          console.log('   • Simple everyday language may not contain "concepts" in the semantic sense');
          console.log('   • The LLM correctly identified that basic actions/objects aren\'t key concepts');
        } else {
          console.log('   • LLM found semantic concepts even in simple text');
          console.log('   • Shows the model can extract meaning from basic language');
        }
      } else {
        console.log('⚠️  Tool returned an error:', resultData.error);
      }
    } else {
      console.log('❓ Could not parse tool response');
      console.log('Raw response (first 300 chars):', toolCallText.substring(0, 300));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testSimpleExtract().then(() => {
  console.log('\n✅ Simple extract test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});