#!/usr/bin/env node
/**
 * ZPT Test Runner Script
 * Runs ZPT-specific tests with proper configuration and reporting
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

// Test configuration
const testConfig = {
  unit: {
    pattern: 'tests/unit/stores/SPARQLStore.enhanced.spec.js',
    description: 'Enhanced SPARQLStore unit tests'
  },
  integration: {
    pattern: 'tests/integration/zpt/**/*.spec.js',
    description: 'ZPT pipeline integration tests'
  },
  performance: {
    pattern: 'tests/performance/zpt/**/*.spec.js', 
    description: 'ZPT performance benchmarks'
  },
  all: {
    pattern: 'tests/**/*{SPARQLStore.enhanced,zpt}*.spec.js',
    description: 'All ZPT-related tests'
  }
};

// Command line argument parsing
const args = process.argv.slice(2);
const testType = args[0] || 'all';
const options = args.slice(1);

// Validate test type
if (!testConfig[testType]) {
  console.error(`Invalid test type: ${testType}`);
  console.error(`Available types: ${Object.keys(testConfig).join(', ')}`);
  process.exit(1);
}

// Prepare test command
const config = testConfig[testType];
const vitestArgs = [
  'vitest',
  'run',
  '--config', 'tests/zpt.test.config.js',
  '--reporter=verbose',
  config.pattern
];

// Add coverage for non-performance tests
if (testType !== 'performance') {
  vitestArgs.push('--coverage');
}

// Add additional options
vitestArgs.push(...options);

console.log(`\n🧪 Running ${config.description}...`);
console.log(`📁 Pattern: ${config.pattern}`);
console.log(`⚙️  Command: npx ${vitestArgs.join(' ')}\n`);

// Ensure test directories exist
const testDirs = [
  path.join(projectRoot, 'tests/unit/stores'),
  path.join(projectRoot, 'tests/integration/zpt'),
  path.join(projectRoot, 'tests/performance/zpt'),
  path.join(projectRoot, 'test-results'),
  path.join(projectRoot, 'coverage/zpt')
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Run tests
const testProcess = spawn('npx', vitestArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    __ENABLE_PERFORMANCE_LOGGING__: testType === 'performance' ? 'true' : 'false'
  }
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log(`\n✅ ${config.description} completed successfully!`);
    
    // Show coverage report location if generated
    if (testType !== 'performance') {
      const coverageDir = path.join(projectRoot, 'coverage/zpt');
      if (fs.existsSync(path.join(coverageDir, 'index.html'))) {
        console.log(`📊 Coverage report: file://${coverageDir}/index.html`);
      }
    }
    
    // Show performance results location if generated
    if (testType === 'performance') {
      console.log(`🚀 Performance benchmarks completed`);
      console.log(`📈 Check console output above for detailed metrics`);
    }
    
  } else {
    console.error(`\n❌ ${config.description} failed with exit code ${code}`);
    process.exit(code);
  }
});

testProcess.on('error', (error) => {
  console.error(`\n💥 Failed to start test process: ${error.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Test execution interrupted');
  testProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Test execution terminated');
  testProcess.kill('SIGTERM');
});

export default testConfig;