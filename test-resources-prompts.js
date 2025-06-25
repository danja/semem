#!/usr/bin/env node

/**
 * Test the newly enabled resources and prompts endpoints
 */

import fetch from 'node-fetch';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

async function testResourcesAndPrompts() {
  try {
    console.log('🔍 Testing resources and prompts endpoints...');
    
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
            name: 'resources-prompts-test',
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

    // Test list resources
    console.log('\n🔧 Testing resources/list...');
    const listResourcesResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {}
      })
    });

    if (!listResourcesResponse.ok) {
      const errorText = await listResourcesResponse.text();
      throw new Error(`List resources failed: ${listResourcesResponse.status} - ${errorText}`);
    }

    const listResourcesText = await listResourcesResponse.text();
    console.log('✅ List resources completed');
    
    // Parse resources response
    console.log('📥 Parsing resources response...');
    let resourcesData = null;
    const resourcesLines = listResourcesText.split('\n');
    
    for (const line of resourcesLines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result && data.result.resources) {
            resourcesData = data.result;
            break;
          }
        } catch (e) {
          // Continue parsing
        }
      }
    }
    
    if (resourcesData) {
      console.log('🎉 SUCCESS! Resources endpoint is working');
      console.log(`   • Found ${resourcesData.resources.length} resources`);
      resourcesData.resources.forEach((resource, idx) => {
        console.log(`   ${idx + 1}. ${resource.name} (${resource.uri})`);
      });
    } else {
      console.log('❓ Could not parse resources response');
      console.log('Raw response:', listResourcesText.substring(0, 500));
    }

    // Test list prompts
    console.log('\n🔧 Testing prompts/list...');
    const listPromptsResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'prompts/list',
        params: {}
      })
    });

    if (!listPromptsResponse.ok) {
      const errorText = await listPromptsResponse.text();
      throw new Error(`List prompts failed: ${listPromptsResponse.status} - ${errorText}`);
    }

    const listPromptsText = await listPromptsResponse.text();
    console.log('✅ List prompts completed');
    
    // Parse prompts response
    console.log('📥 Parsing prompts response...');
    let promptsData = null;
    const promptsLines = listPromptsText.split('\n');
    
    for (const line of promptsLines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result && data.result.prompts) {
            promptsData = data.result;
            break;
          }
        } catch (e) {
          // Continue parsing
        }
      }
    }
    
    if (promptsData) {
      console.log('🎉 SUCCESS! Prompts endpoint is working');
      console.log(`   • Found ${promptsData.prompts.length} prompts`);
      promptsData.prompts.forEach((prompt, idx) => {
        console.log(`   ${idx + 1}. ${prompt.name} - ${prompt.description}`);
      });
    } else {
      console.log('❓ Could not parse prompts response');
      console.log('Raw response:', listPromptsText.substring(0, 500));
    }

    // Test reading a specific resource
    if (resourcesData && resourcesData.resources.length > 0) {
      const testResource = resourcesData.resources.find(r => r.uri === 'semem://status');
      if (testResource) {
        console.log('\n🔧 Testing resources/read for semem://status...');
        const readResourceResponse = await fetch(MCP_SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'resources/read',
            params: {
              uri: 'semem://status'
            }
          })
        });

        if (!readResourceResponse.ok) {
          const errorText = await readResourceResponse.text();
          console.log(`⚠️  Read resource failed: ${readResourceResponse.status} - ${errorText}`);
        } else {
          const readResourceText = await readResourceResponse.text();
          console.log('✅ Read resource completed');
          
          // Parse read resource response
          let resourceContentData = null;
          const resourceContentLines = readResourceText.split('\n');
          
          for (const line of resourceContentLines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.result && data.result.contents) {
                  resourceContentData = data.result;
                  break;
                }
              } catch (e) {
                // Continue parsing
              }
            }
          }
          
          if (resourceContentData) {
            console.log('🎉 SUCCESS! Resource reading is working');
            const content = JSON.parse(resourceContentData.contents[0].text);
            console.log(`   • Server: ${content.server.name} v${content.server.version}`);
            console.log(`   • Capabilities: ${Object.keys(content.capabilities).length} features`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testResourcesAndPrompts().then(() => {
  console.log('\n✅ Resources and prompts endpoints test completed successfully!');
  console.log('🔧 MCP Inspector should now show "list resources" and "list prompts" as available');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});