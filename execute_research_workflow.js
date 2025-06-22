#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs/promises';

async function executeResearchWorkflow() {
  console.log('📄 Reading DoTA-RAG paper content...');
  
  try {
    // Read the DoTA-RAG paper content
    const paperContent = await fs.readFile('docs/mcp/dotarag-paper.md', 'utf-8');
    console.log(`✅ Paper content loaded (${paperContent.length} characters)`);
    
    // First, initialize a session
    console.log('🔌 Initializing MCP session...');
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'research-workflow-client',
          version: '1.0.0'
        }
      }
    };
    
    const initResponse = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(initRequest)
    });
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`Session initialization failed HTTP ${initResponse.status}: ${errorText}`);
    }
    
    const initResult = await initResponse.json();
    console.log('✅ Session initialized successfully');
    
    // Get session ID from response headers
    const sessionId = initResponse.headers.get('mcp-session-id') || 'research-workflow-session';
    console.log(`🔑 Session ID: ${sessionId}`);
    
    // Prepare the MCP request for prompt execution
    const mcpRequest = {
      jsonrpc: '2.0',
      id: 2,
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
    };
    
    console.log('🚀 Executing research-workflow on DoTA-RAG paper...');
    console.log(`📊 Request payload size: ${JSON.stringify(mcpRequest).length} characters`);
    
    // Send request to MCP HTTP server
    const response = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify(mcpRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Research workflow completed!');
    
    // Parse and display the result
    if (result.result && result.result.content) {
      const workflowResult = JSON.parse(result.result.content[0].text);
      
      console.log('\n🔍 === RESEARCH WORKFLOW RESULTS ===');
      console.log(`✅ Success: ${workflowResult.success}`);
      console.log(`📝 Prompt: ${workflowResult.promptName}`);
      console.log(`🔢 Execution ID: ${workflowResult.executionId}`);
      console.log(`📊 Steps completed: ${workflowResult.steps}`);
      
      if (workflowResult.results && workflowResult.results.length > 0) {
        console.log('\n📋 === WORKFLOW STEPS ===');
        workflowResult.results.forEach((step, i) => {
          console.log(`\n${i + 1}. ${step.tool}`);
          console.log(`   Arguments: ${JSON.stringify(step.arguments, null, 2)}`);
          if (step.result && typeof step.result === 'object') {
            console.log(`   Result: ${JSON.stringify(step.result, null, 2).substring(0, 500)}...`);
          } else {
            console.log(`   Result: ${step.result}`);
          }
        });
      }
      
      if (workflowResult.summary) {
        console.log('\n📈 === EXECUTION SUMMARY ===');
        console.log(`Total Steps: ${workflowResult.summary.totalSteps}`);
        console.log(`Successful Steps: ${workflowResult.summary.successfulSteps}`);
        console.log(`Tools Used: ${workflowResult.summary.toolsUsed?.join(', ')}`);
        console.log(`Execution Time: ${workflowResult.summary.executionTime}ms`);
      }
      
      if (workflowResult.error) {
        console.log(`\n❌ Error: ${workflowResult.error}`);
      }
      
    } else {
      console.log('📄 Raw result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Failed to execute research workflow:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Execute the workflow
executeResearchWorkflow();