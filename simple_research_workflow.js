#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs/promises';

async function simpleResearchWorkflow() {
  try {
    // Read the DoTA-RAG paper content
    const paperContent = await fs.readFile('docs/mcp/dotarag-paper.md', 'utf-8');
    console.log('📄 Paper content loaded:', paperContent.length, 'characters');
    
    // Try direct tool call without session complexity
    const response = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'simple-client', version: '1.0.0' }
        }
      })
    });

    console.log('✅ Connected to server, executing research-workflow...');
    
    // Skip the complex session handling and try direct tool call
    const toolResponse = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'research',
        method: 'tools/call',
        params: {
          name: 'prompt_execute',
          arguments: {
            name: 'research-workflow',
            arguments: {
              content: paperContent,
              source: 'docs/mcp/dotarag-paper.md'
            }
          }
        }
      })
    });

    if (toolResponse.ok) {
      const result = await toolResponse.text();
      console.log('🎉 Success! Response:');
      console.log(result);
    } else {
      const error = await toolResponse.text();
      console.log('❌ Error response:');
      console.log(error);
    }

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

simpleResearchWorkflow();