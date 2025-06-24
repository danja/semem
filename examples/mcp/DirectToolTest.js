#!/usr/bin/env node

/**
 * Direct MCP Tool Testing Script
 * Test Semem MCP tools with remote Mistral + Nomic providers
 */
import { spawn } from 'child_process';
import path from 'path';
import Config from '../../src/Config.js';

// Load configuration
let config;
try {
  config = new Config();
  await config.init();
  console.log('✅ Configuration loaded successfully');
} catch (error) {
  console.warn('⚠️  Could not load config, using defaults:', error.message);
  config = {
    get: (key) => {
      const defaults = {
        'mcp.port': 3000,
        'mcp.host': 'localhost',
        'embeddingModel': 'nomic-embed-text',
        'chatModel': 'qwen2:1.5b'
      };
      return defaults[key];
    }
  };
}

const mcpServerPath = path.join(process.cwd(), 'mcp', 'index.js');

/**
 * Send MCP request to server
 */
async function sendMcpRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const host = config.get('mcp.host') || 'localhost';
    const port = config.get('mcp.port') || 3000;
    
    console.log(`🌐 Sending MCP request to ${host}:${port} - ${method}`);
    
    const child = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_HOST: host,
        MCP_PORT: port.toString()
      }
    });

    let response = '';
    let error = '';

    child.stdout.on('data', (data) => {
      response += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(response);
          resolve(result);
        } catch (e) {
          resolve({ response, error });
        }
      } else {
        reject(new Error(`Process exited with code ${code}: ${error}`));
      }
    });

    // Send the request
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    };

    child.stdin.write(JSON.stringify(request) + '\n');
    child.stdin.end();
  });
}

/**
 * Test functions
 */
async function testListTools() {
  console.log('\n🔧 Testing: List Tools');
  try {
    const result = await sendMcpRequest('tools/list');
    console.log(`Found ${result.tools?.length || 0} tools`);
    result.tools?.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testStoreMemory() {
  console.log('\n💾 Testing: Store Memory');
  try {
    const result = await sendMcpRequest('tools/call', {
      name: 'semem_store_interaction',
      arguments: {
        prompt: 'What are semantic web technologies?',
        response: 'Semantic web technologies are standards designed to make web content machine-readable. RDF provides a framework for representing information as triples.',
        metadata: {
          topic: 'semantic_web',
          tags: ['RDF', 'SPARQL']
        }
      }
    });
    console.log('Memory stored:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testGenerateEmbedding() {
  console.log('\n🔍 Testing: Generate Embedding (Nomic API)');
  try {
    const result = await sendMcpRequest('tools/call', {
      name: 'semem_generate_embedding',
      arguments: {
        text: 'Semantic web technologies enable machine-readable data through RDF triples'
      }
    });
    console.log('Embedding generated:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testExtractConcepts() {
  console.log('\n🧠 Testing: Extract Concepts (Mistral API)');
  try {
    const result = await sendMcpRequest('tools/call', {
      name: 'semem_extract_concepts',
      arguments: {
        text: 'Knowledge graphs represent structured information as interconnected nodes and edges'
      }
    });
    console.log('Concepts extracted:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testSearchMemories() {
  console.log('\n🔎 Testing: Search Memories');
  try {
    const result = await sendMcpRequest('tools/call', {
      name: 'semem_retrieve_memories',
      arguments: {
        query: 'semantic web and RDF technologies',
        threshold: 0.7,
        limit: 5
      }
    });
    console.log('Search results:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Semem MCP Tool Tests...\n');
  
  await testListTools();
  await testStoreMemory();
  await testGenerateEmbedding();
  await testExtractConcepts();
  await testSearchMemories();
  
  console.log('\n✅ Tests completed!');
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}