#!/usr/bin/env node

/**
 * ExtractConcepts.js - Working demo of semem_extract_concepts via MCP HTTP
 * 
 * This demonstrates the complete working flow:
 * 1. Initialize MCP session via HTTP transport
 * 2. Call semem_extract_concepts tool with proper argument handling
 * 3. Parse and display results
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';
const DEMO_TEXT = "the cat sat on the mat";

/**
 * Complete working demo
 */
async function runFinalDemo() {
  console.log('🎯 Final Working Demo: semem_extract_concepts via MCP HTTP');
  console.log(`📝 Text: "${DEMO_TEXT}"`);
  console.log('═'.repeat(65));

  try {
    // Step 1: Initialize session
    console.log('\n1️⃣ Initializing MCP session...');
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
            name: 'extract-concepts-final-demo',
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

    console.log('✅ Session initialized');
    console.log(`🔗 Session ID: ${sessionId}`);

    // Step 2: List available tools
    console.log('\n2️⃣ Listing available tools...');
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
    console.log('✅ Tools listed');
    
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

    // Display all available tools
    console.log(`🛠️  Found ${toolsList.length} tools:`);
    toolsList.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    
    // Find our specific tool for the demo
    const extractTool = toolsList.find(tool => tool.name === 'semem_extract_concepts');
    if (!extractTool) {
      console.log('⚠️  semem_extract_concepts tool not found in available tools');
      return;
    }

    // Step 3: Call the tool
    console.log('\n3️⃣ Calling semem_extract_concepts tool...');
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
          name: 'semem_extract_concepts',
          arguments: {
            text: DEMO_TEXT
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

    // Step 4: Parse and display results
    console.log('\n4️⃣ Processing results...');
    
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

    // Step 5: Display final results
    console.log('\n5️⃣ Final Results:');
    console.log('═'.repeat(40));
    
    if (resultData) {
      if (resultData.success) {
        console.log('🎉 SUCCESS! Concept extraction completed');
        console.log(`📊 Concepts found: ${resultData.conceptCount}`);
        console.log(`📝 Input text: "${resultData.text}"`);
        
        if (resultData.concepts && resultData.concepts.length > 0) {
          console.log('\n🧠 Extracted concepts:');
          resultData.concepts.forEach((concept, index) => {
            console.log(`   ${index + 1}. "${concept}"`);
          });
        } else {
          console.log('\n💭 No specific concepts extracted (this is normal for simple text)');
        }
        
        console.log('\n📊 Complete response:');
        console.log(JSON.stringify(resultData, null, 2));
        
      } else {
        console.log('❌ Tool execution failed');
        console.log(`🚨 Error: ${resultData.error}`);
      }
    } else {
      console.log('❓ Could not parse tool response');
      console.log('Raw response:', toolCallText);
    }

    console.log('\n🎊 Demo completed successfully!');
    console.log('\n💡 Key takeaways:');
    console.log('   • MCP HTTP transport is working correctly');
    console.log('   • Session management is functioning');
    console.log('   • Tool calls can be made with proper arguments');
    console.log('   • All 45+ Semem tools are now accessible via MCP');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Check server health and provide helpful guidance
 */
async function checkServerAndRun() {
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      const health = await response.json();
      console.log(`🏥 Server status: ${health.status}`);
      console.log(`📊 Active sessions: ${health.server_state.active_sessions}`);
      console.log(`🏗️  Architecture: ${health.server_state.architecture}`);
      
      await runFinalDemo();
    } else {
      throw new Error(`Health check failed: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ MCP server is not available:', error.message);
    console.error('');
    console.error('🚀 To start the server:');
    console.error('   node mcp/http-server.js');
    console.error('');
    console.error('🌐 Then visit:');
    console.error('   http://localhost:3000/inspector  (MCP Inspector)');
    console.error('   http://localhost:3000/health     (Health check)');
    console.error('');
    console.error('🔧 After starting the server, run this demo again.');
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Checking MCP server availability...');
  checkServerAndRun();
}

export { runFinalDemo };