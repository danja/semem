#!/usr/bin/env node

// examples/REPL.js
// Interactive REPL for MCP server using the sample client
// Allows user to enter commands, suggests available actions, and shows results
import readline from 'readline';
import http from 'http';

function jsonRpcRequest(method, params = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random()*10000), method, params });
}

function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4100,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(jsonRpcRequest(method, params));
    req.end();
  });
}

async function printSuggestions() {
  const resp = await sendRpc('listResources', {});
  const live = resp.result.filter(r => r.type === 'service');
  console.log('\nAvailable MCP actions:');
  for (const r of live) {
    console.log(`- ${r.id}: ${r.title} (${r.description || ''})`);
  }
  console.log("\nType the method name (e.g. 'searchGraph'), or 'help' for suggestions, or 'exit' to quit.");
}

async function main() {
  await printSuggestions();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.setPrompt('MCP> ');
  rl.prompt();

  rl.on('line', async (line) => {
    const cmd = line.trim();
    if (cmd === 'exit' || cmd === 'quit') {
      rl.close();
      process.exit(0);
    }
    if (cmd === 'help' || cmd === '?') {
      await printSuggestions();
      rl.prompt();
      return;
    }
    if (!cmd) {
      rl.prompt();
      return;
    }
    // Show params suggestion
    const resp = await sendRpc('listResources', {});
    const resource = resp.result.find(r => r.id === cmd);
    if (!resource) {
      console.log(`Unknown method: ${cmd}`);
      await printSuggestions();
      rl.prompt();
      return;
    }
    console.log(`\nEnter params as JSON for ${cmd} (or leave blank for defaults):`);
    rl.question('Params> ', async (paramsLine) => {
      let params = {};
      if (paramsLine.trim()) {
        try {
          params = JSON.parse(paramsLine);
        } catch (e) {
          console.log('Invalid JSON, try again.');
          rl.prompt();
          return;
        }
      }
      try {
        const result = await sendRpc(cmd, params);
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Error:', e.message);
      }
      rl.prompt();
    });
  });
}

main();
