#!/usr/bin/env node

/**
 * Simple JSON-RPC MCP Client
 * Easy way to test individual MCP tools via stdin/stdout
 */

import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Send JSON-RPC request to MCP server
 */
function sendRequest(method, params = {}) {
  const host = config.get('mcp.host') || 'localhost';
  const port = config.get('mcp.port') || 3000;
  
  console.log(`🌐 Sending request to MCP server at ${host}:${port} - ${method}`);
  
  const mcpServerPath = path.join(__dirname, '..', '..', 'mcp', 'index.js');
  const mcpServer = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_HOST: host,
      MCP_PORT: port.toString()
    }
  });

  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: method,
    params: params
  };

  console.log('📤 Sending:', JSON.stringify(request, null, 2));
  
  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  mcpServer.stdin.end();

  let response = '';
  mcpServer.stdout.on('data', (data) => {
    response += data.toString();
  });

  mcpServer.stderr.on('data', (data) => {
    console.error('🔴 Error:', data.toString());
  });

  mcpServer.on('close', (code) => {
    if (response.trim()) {
      try {
        const result = JSON.parse(response);
        console.log('📥 Response:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('📥 Raw Response:', response);
      }
    }
    console.log('✅ Process completed\n');
  });
}

/**
 * Interactive mode
 */
function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🚀 Semem MCP Interactive Client');
  console.log('Commands:');
  console.log('  list - List available tools');
  console.log('  store - Store a test memory');
  console.log('  embed - Generate embedding with Nomic');
  console.log('  concepts - Extract concepts with Mistral');
  console.log('  search - Search memories');
  console.log('  quit - Exit\n');

  function prompt() {
    rl.question('mcp> ', (answer) => {
      const cmd = answer.trim().toLowerCase();
      
      switch (cmd) {
        case 'list':
          sendRequest('tools/list');
          break;
          
        case 'store':
          sendRequest('tools/call', {
            name: 'semem_store_interaction',
            arguments: {
              prompt: 'What is machine learning?',
              response: 'Machine learning is a subset of AI that uses algorithms to learn patterns from data.',
              metadata: { topic: 'ai', source: 'test' }
            }
          });
          break;
          
        case 'embed':
          sendRequest('tools/call', {
            name: 'semem_generate_embedding',
            arguments: {
              text: 'Knowledge graphs connect entities through relationships'
            }
          });
          break;
          
        case 'concepts':
          sendRequest('tools/call', {
            name: 'semem_extract_concepts',
            arguments: {
              text: 'Neural networks process information through interconnected layers of nodes'
            }
          });
          break;
          
        case 'search':
          sendRequest('tools/call', {
            name: 'semem_retrieve_memories',
            arguments: {
              query: 'machine learning algorithms',
              threshold: 0.6,
              limit: 3
            }
          });
          break;
          
        case 'quit':
        case 'exit':
          rl.close();
          return;
          
        default:
          console.log('Unknown command. Try: list, store, embed, concepts, search, quit');
      }
      
      setTimeout(prompt, 1000); // Wait a bit before next prompt
    });
  }

  prompt();
}

// Start interactive mode
interactiveMode();