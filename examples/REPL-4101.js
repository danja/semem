#!/usr/bin/env node

/**
 * Interactive REPL for testing MCP endpoints
 * Connects to MCP server on port 4101
 */

import repl from 'repl';
import fetch from 'node-fetch';

const MCP_SERVER = 'http://localhost:4101';

async function callMCP(method, params = {}) {
  try {
    const response = await fetch(MCP_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }),
    });
    
    const result = await response.json();
    if (result.error) {
      console.error('Error:', result.error);
      return null;
    }
    return result.result;
  } catch (error) {
    console.error('Request failed:', error);
    return null;
  }
}

// List available resources
async function listResources() {
  console.log('Available resources:');
  const resources = await callMCP('listResources');
  if (resources) {
    resources.forEach(res => {
      console.log(`- ${res.id} (${res.type}): ${res.title}`);
      if (res.description) console.log(`  ${res.description}`);
    });
  }
  return resources;
}

// Start REPL
const r = repl.start('mcp> ');

// Add helper functions to REPL context
r.context.callMCP = callMCP;
r.context.list = listResources;

// Load resources on start
listResources();

console.log(`\nMCP REPL connected to ${MCP_SERVER}`);
console.log('Available commands:');
console.log('- callMCP(method, params): Call any MCP method');
console.log('- list(): List available resources');
console.log('\nExample:');
console.log('  await callMCP("embedText", { text: "Hello world" })');
