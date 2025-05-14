#!/usr/bin/env node
/**
 * Unified test runner script for Semem
 * 
 * Usage:
 *   node run-tests.js [options] [test-patterns]
 * 
 * Options:
 *   --unit        Run unit tests only
 *   --integration Run integration tests only
 *   --core        Run core tests only (Config, MemoryManager, etc.)
 *   --api         Run API tests only
 *   --http        Run HTTP/WebSocket tests only
 *   --all         Run all tests (default)
 *   --coverage    Generate coverage report
 *   --watch       Watch for changes and rerun tests
 * 
 * Examples:
 *   node run-tests.js --unit
 *   node run-tests.js --core --coverage
 *   node run-tests.js tests/unit/Config.vitest.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Get the directory of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
let testPatterns = [];
let options = [];
let vitestArgs = [];

// Default test patterns
const unitTests = 'tests/unit/**/*.{test,vitest}.js';
const integrationTests = 'tests/integration/**/*.{test,vitest}.js';
const coreTests = [
  'tests/unit/Config.vitest.js',
  'tests/unit/MemoryManager.vitest.js',
  'tests/unit/ContextWindowManager.vitest.js',
  'tests/unit/handlers/REPLHandler.vitest.js',
  'tests/unit/api/BaseAPI.vitest.js'
].join(' ');
const apiTests = 'tests/unit/api/**/*.{test,vitest}.js';
const httpTests = 'tests/unit/http/**/*.{test,vitest}.js tests/integration/http/**/*.{test,vitest}.js';

// Process command line arguments
for (const arg of args) {
  if (arg.startsWith('--')) {
    options.push(arg.substring(2));
  } else if (arg.startsWith('-')) {
    options.push(arg.substring(1));
  } else {
    testPatterns.push(arg);
  }
}

// Determine test patterns based on options
if (testPatterns.length === 0) {
  if (options.includes('unit')) {
    testPatterns.push(unitTests);
  } else if (options.includes('integration')) {
    testPatterns.push(integrationTests);
  } else if (options.includes('core')) {
    testPatterns.push(coreTests);
  } else if (options.includes('api')) {
    testPatterns.push(apiTests);
  } else if (options.includes('http')) {
    testPatterns.push(httpTests);
  } else if (options.includes('all') || options.length === 0) {
    testPatterns.push(unitTests);
    testPatterns.push(integrationTests);
  }
}

// Add coverage option
if (options.includes('coverage')) {
  vitestArgs.push('--coverage');
}

// Add watch option
if (options.includes('watch')) {
  vitestArgs.push('watch');
} else {
  vitestArgs.push('run');
}

// Build the command
const command = 'npx';
const finalArgs = ['vitest', ...vitestArgs, ...testPatterns];

console.log(`Running tests with command: ${command} ${finalArgs.join(' ')}`);

// Execute the command
const child = spawn(command, finalArgs, {
  stdio: 'inherit',
  shell: true
});

// Handle process exit
child.on('exit', (code) => {
  process.exit(code);
});