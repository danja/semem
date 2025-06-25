#!/usr/bin/env node

/**
 * Test the extract concepts tool to debug why it's not returning concepts
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testExtractConcepts() {
  try {
    console.log('🔍 Testing semem_extract_concepts tool...');
    
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
            name: 'extract-concepts-test',
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

    // Test concept extraction with clear text
    const testTexts = [
      "Artificial intelligence and machine learning are transforming technology. Deep learning algorithms can process large datasets to identify patterns.",
      "Climate change is affecting global weather patterns. Renewable energy sources like solar and wind power are becoming more important.",
      "The quantum computer uses quantum mechanics principles. Quantum entanglement and superposition enable quantum algorithms."
    ];

    for (let i = 0; i < testTexts.length; i++) {
      const testText = testTexts[i];
      console.log(`\n🔧 Test ${i + 1}: Extracting concepts from text...`);
      console.log(`📝 Text: "${testText.substring(0, 50)}..."`);
      
      const toolCallResponse = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: i + 2,
          method: 'tools/call',
          params: {
            name: 'semem_extract_concepts',
            arguments: {
              text: testText
            }
          }
        })
      });

      if (!toolCallResponse.ok) {
        const errorText = await toolCallResponse.text();
        console.log(`❌ Tool call ${i + 1} failed: ${toolCallResponse.status} - ${errorText}`);
        continue;
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
          console.log(`🎉 SUCCESS! Test ${i + 1} extracted concepts`);
          console.log(`   • Concepts found: ${resultData.conceptCount}`);
          if (resultData.concepts && resultData.concepts.length > 0) {
            resultData.concepts.forEach((concept, idx) => {
              console.log(`     ${idx + 1}. "${concept}"`);
            });
          } else {
            console.log('⚠️  No concepts in the result');
          }
        } else {
          console.log(`⚠️  Test ${i + 1} tool returned an error:`, resultData.error);
        }
      } else {
        console.log(`❓ Test ${i + 1} could not parse tool response`);
        console.log('Raw response (first 300 chars):', toolCallText.substring(0, 300));
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testExtractConcepts().then(() => {
  console.log('\n✅ Extract concepts test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});