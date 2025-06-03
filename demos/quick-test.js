#!/usr/bin/env node

// Quick connectivity test
import fetch from 'node-fetch';

console.log('Quick connectivity test...\n');

const tests = [
    {
        name: 'Ollama',
        url: 'http://localhost:11434/api/version',
        expected: 'Ollama version info'
    },
    {
        name: 'API Server',
        url: 'http://localhost:4100/api/health',
        expected: 'Health status'
    },
    {
        name: 'MCP Server',
        url: 'http://localhost:4040/mcp',
        expected: 'MCP server info'
    }
];

for (const test of tests) {
    try {
        const response = await fetch(test.url);
        if (response.ok) {
            console.log(`✅ ${test.name}: Available`);
        } else {
            console.log(`⚠️  ${test.name}: HTTP ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ ${test.name}: Not reachable`);
    }
}

console.log('\nUse `node demos/01-memory-basic.js` to run the first demo.');
