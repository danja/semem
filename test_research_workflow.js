#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs/promises';

async function testResearchWorkflow() {
  console.log('🚀 Testing research-workflow on DoTA-RAG paper...');
  
  try {
    // Read the paper content
    const paperContent = await fs.readFile('docs/mcp/dotarag-paper.md', 'utf-8');
    console.log(`📄 Paper loaded: ${paperContent.length} characters`);
    
    // Create MCP client
    const client = new Client({ 
      name: "research-workflow-test", 
      version: "1.0.0" 
    });
    
    // Create HTTP transport
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost:3000/mcp')
    );

    // Connect
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // List available tools
    const tools = await client.listTools();
    console.log(`📚 Available tools: ${tools.tools.length}`);
    
    // Check for required tools
    const hasPromptExecute = tools.tools.find(t => t.name === 'prompt_execute');
    const hasResearchIngest = tools.tools.find(t => t.name === 'research_ingest_documents');
    
    console.log('🔍 Tool availability:');
    console.log(`   - prompt_execute: ${hasPromptExecute ? '✅' : '❌'}`);
    console.log(`   - research_ingest_documents: ${hasResearchIngest ? '✅' : '❌'}`);
    
    if (!hasPromptExecute) {
      console.log('❌ prompt_execute tool not found. Available tools:');
      tools.tools.forEach(tool => console.log(`   - ${tool.name}`));
      return;
    }
    
    console.log(`✅ Found ${hasResearchIngest ? 'all required' : 'basic'} tools`);
    
    // Execute research-workflow
    console.log('🔬 Executing research-workflow...');
    
    // Prepare arguments
    const workflowArgs = {
      research_documents: [paperContent],
      domain_focus: 'AI/ML',
      analysis_goals: ['concept_extraction', 'relationship_mapping', 'insight_generation']
    };
    
    console.log('📊 Workflow arguments:', JSON.stringify(workflowArgs, null, 2).substring(0, 300) + '...');
    
    const result = await client.callTool({ 
      name: 'prompt_execute', 
      arguments: {
        name: 'research-workflow',
        arguments: workflowArgs
      }
    });
    
    console.log('🎉 Research workflow completed!');
    
    // Handle result
    const resultText = result.content[0].text;
    console.log('📄 Raw result text:', resultText.substring(0, 500) + '...');
    
    // Try to parse as JSON, fallback to text display
    let workflowResult;
    try {
      workflowResult = JSON.parse(resultText);
    } catch (parseError) {
      console.log('⚠️ Result is not JSON, displaying as text:');
      console.log(resultText);
      return;
    }
    
    console.log('\n📊 === WORKFLOW RESULTS ===');
    console.log(`Success: ${workflowResult.success}`);
    console.log(`Prompt: ${workflowResult.promptName}`);
    console.log(`Steps: ${workflowResult.steps}`);
    
    if (workflowResult.results) {
      console.log('\n📋 === STEP RESULTS ===');
      workflowResult.results.forEach((step, i) => {
        console.log(`\n${i + 1}. ${step.tool}`);
        console.log(`   Status: ${step.result ? '✅ Success' : '❌ Failed'}`);
        if (step.result && typeof step.result === 'object') {
          // Show abbreviated result
          const resultStr = JSON.stringify(step.result, null, 2);
          console.log(`   Result: ${resultStr.substring(0, 200)}...`);
        }
      });
    }
    
    if (workflowResult.error) {
      console.log(`\n❌ Error: ${workflowResult.error}`);
    }
    
    await client.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testResearchWorkflow();