#!/usr/bin/env node

// Try to import node-fetch directly, with fallback for older Node.js versions
let fetch;
try {
  // For Node.js 18+ with native fetch
  fetch = globalThis.fetch;
} catch (err) {
  try {
    // For Node.js < 18 using node-fetch
    const module = await import('node-fetch');
    fetch = module.default;
  } catch (err2) {
    console.error('Error: fetch is not available. Please install node-fetch or use Node.js 18+');
    process.exit(1);
  }
}

// Simple test script for the MCP server
const MCP_SERVER_URL = 'http://localhost:4040/mcp';

// Make a JSON-RPC request to the MCP server
async function callMCP(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now().toString(),
    method,
    params
  };
  
  console.log(`Calling ${method}...`);
  
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  
  return response.json();
}

// Test MCP discovery
async function testDiscovery() {
  try {
    console.log('Testing MCP discovery...');
    const response = await fetch(MCP_SERVER_URL);
    const data = await response.json();
    
    console.log('MCP Server Info:');
    console.log(`- Name: ${data.name}`);
    console.log(`- Version: ${data.version}`);
    console.log(`- Protocol: ${data.protocol_version}`);
    console.log('');
    
    return data;
  } catch (error) {
    console.error('Error testing discovery:', error);
  }
}

// Test listing tools
async function testToolsList() {
  try {
    const result = await callMCP('mcp.tools.list');
    console.log('Available tools:');
    console.log(JSON.stringify(result.result, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error listing tools:', error);
  }
}

// Test listing resources
async function testResourcesList() {
  try {
    const result = await callMCP('mcp.resources.list');
    console.log('Available resources:');
    console.log(JSON.stringify(result.result, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error listing resources:', error);
  }
}

// Test getting memory stats
async function testMemoryStats() {
  try {
    const result = await callMCP('mcp.resources.get', {
      resource_id: 'memory.stats'
    });
    console.log('Memory stats:');
    console.log(JSON.stringify(result.result, null, 2));
    console.log('');
  } catch (error) {
    console.error('Error getting memory stats:', error);
  }
}

// Run all tests
async function runTests() {
  try {
    await testDiscovery();
    await testToolsList();
    await testResourcesList();
    await testMemoryStats();
    
    console.log('All tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();