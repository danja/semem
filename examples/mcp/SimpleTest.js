#!/usr/bin/env node

/**
 * Simple MCP Tool Test
 * Works with your running semem-mcp server
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../../src/Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Send single JSON-RPC request
 */
function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const host = config.get('mcp.host') || 'localhost';
    const port = config.get('mcp.port') || 3000;
    const mcpServerPath = path.join(__dirname, '..', '..', 'mcp', 'index.js');
    
    console.log(`🌐 Connecting to MCP server at ${host}:${port}...`);
    const server = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000 // 10 second timeout
    });

    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: method,
      params: params
    };

    let stdout = '';
    let stderr = '';

    server.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    server.on('close', (code) => {
      if (stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          resolve({ raw: stdout, error: stderr });
        }
      } else {
        reject(new Error(`No response. Code: ${code}, Error: ${stderr}`));
      }
    });

    server.on('error', (error) => {
      reject(error);
    });

    // Send request and close stdin
    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();

    // Safety timeout
    setTimeout(() => {
      server.kill();
      reject(new Error('Request timeout'));
    }, 10000);
  });
}

/**
 * Run quick test
 */
async function quickTest() {
  console.log('🚀 Quick MCP Test\n');

  try {
    console.log('📋 Listing tools...');
    const tools = await sendRequest('tools/list');
    console.log(`✅ Found ${tools.tools?.length || 0} tools`);
    if (tools.tools) {
      tools.tools.slice(0, 3).forEach(tool => {
        console.log(`  - ${tool.name}`);
      });
    }
    console.log('');

    console.log('🔍 Testing embedding generation...');
    const embedding = await sendRequest('tools/call', {
      name: 'semem_generate_embedding',
      arguments: {
        text: 'Hello world'
      }
    });
    console.log('✅ Embedding generated:', embedding.result ? 'Success' : 'Failed');
    console.log('');

    console.log('✅ Quick test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();