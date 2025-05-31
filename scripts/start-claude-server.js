#!/usr/bin/env node

// Load environment variables from .env.claude
require('dotenv').config({ path: '../.env.claude' });

// Import required modules
const { spawn } = require('child_process');
const path = require('path');

// Get the port from environment variables or use default
const port = process.env.PORT || 4100;

// Start the MCP server with Claude configuration
const server = spawn('node', [
  '--experimental-modules',
  '--loader', 'esm',
  'src/mcp/server-claude.js'
], {
  env: {
    ...process.env,
    MCP_PORT: port,
    LLM_PROVIDER: 'claude',
    CHAT_MODEL: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'claude-3-opus-20240229',
    NODE_ENV: process.env.NODE_ENV || 'development'
  },
  stdio: 'inherit',
  shell: true
});

// Handle server process events
server.on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

console.log(`Starting MCP server with Claude LLM on port ${port}...`);
