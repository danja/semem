#!/usr/bin/env node

/**
 * RDF Concept Integration Test Runner
 * Comprehensive test suite for validating the new RDF concept integration functionality
 * 
 * This script coordinates running all concept-related tests:
 * - MCP-based integration tests
 * - Workbench UI tests via Playwright
 * - Unit tests for concept tilt functionality
 * - Unit tests for concept filtering and search
 * - Unit tests for RDF concept storage and retrieval
 * 
 * Usage:
 *   npm run test:concept-integration
 *   node scripts/test-concept-integration.js
 *   node scripts/test-concept-integration.js --unit-only
 *   node scripts/test-concept-integration.js --e2e-only
 *   node scripts/test-concept-integration.js --mcp-only
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes total timeout
  sequential: true, // Run test suites sequentially to avoid conflicts
  verbose: true,
  bail: false // Continue running tests even if some fail
};

// Test suites configuration
const TEST_SUITES = {
  unit: [
    {
      name: 'Concept Tilt Projector Unit Tests',
      path: 'tests/unit/zpt/concept-tilt-projector.test.js',
      description: 'Tests concept extraction and projection functionality in TiltProjector',
      framework: 'vitest'
    },
    {
      name: 'Concept Filtering and Search Unit Tests',
      path: 'tests/unit/zpt/concept-filtering-search.test.js',
      description: 'Tests concept-based filtering strategies and search integration',
      framework: 'vitest'
    },
    {
      name: 'RDF Concept Storage Unit Tests',
      path: 'tests/unit/stores/rdf-concept-storage.test.js',
      description: 'Tests RDF-native concept storage and retrieval in SPARQLStore',
      framework: 'vitest'
    }
  ],
  integration: [
    {
      name: 'Concept Integration MCP Tests',
      path: 'tests/integration/zpt/concept-integration-mcp.test.js',
      description: 'Tests concept functionality through MCP endpoints',
      framework: 'vitest',
      requires: ['mcp-server']
    }
  ],
  e2e: [
    {
      name: 'Concept Navigation Workbench E2E Tests',
      path: 'tests/ui/e2e/concept-navigation-workbench.e2e.js',
      description: 'Tests concept navigation through workbench UI',
      framework: 'playwright',
      requires: ['workbench-server', 'mcp-server']
    }
  ]
};

class ConceptTestRunner {
  constructor(options = {}) {
    this.options = { ...TEST_CONFIG, ...options };
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: []
    };
  }

  async run() {
    console.log('🧠 RDF Concept Integration Test Suite');
    console.log('=====================================');
    console.log('');

    const args = process.argv.slice(2);
    const runUnitOnly = args.includes('--unit-only');
    const runE2EOnly = args.includes('--e2e-only');
    const runMCPOnly = args.includes('--mcp-only');

    try {
      // Determine which suites to run
      let suitesToRun = [];
      
      if (runUnitOnly) {
        suitesToRun = ['unit'];
      } else if (runE2EOnly) {
        suitesToRun = ['e2e'];
      } else if (runMCPOnly) {
        suitesToRun = ['integration'];
      } else {
        suitesToRun = ['unit', 'integration', 'e2e'];
      }

      // Pre-flight checks
      await this.performPreflightChecks(suitesToRun);

      // Run test suites
      for (const suiteType of suitesToRun) {
        if (TEST_SUITES[suiteType]) {
          await this.runTestSuite(suiteType, TEST_SUITES[suiteType]);
        }
      }

      // Generate summary
      this.generateSummary();

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }

  async performPreflightChecks(suitesToRun) {
    console.log('🔍 Performing pre-flight checks...');

    // Check if test files exist
    for (const suiteType of suitesToRun) {
      const suites = TEST_SUITES[suiteType];
      for (const suite of suites) {
        const testPath = path.join(projectRoot, suite.path);
        try {
          await fs.access(testPath);
          console.log(`  ✅ Found test file: ${suite.path}`);
        } catch (error) {
          throw new Error(`Test file not found: ${suite.path}`);
        }
      }
    }

    // Check for required dependencies
    const packageJsonPath = path.join(projectRoot, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Check for test frameworks
      if (suitesToRun.includes('unit') || suitesToRun.includes('integration')) {
        if (!packageJson.devDependencies?.vitest) {
          console.warn('⚠️  Vitest not found in devDependencies - unit tests may fail');
        } else {
          console.log('  ✅ Vitest available for unit/integration tests');
        }
      }

      if (suitesToRun.includes('e2e')) {
        if (!packageJson.devDependencies?.['@playwright/test']) {
          console.warn('⚠️  Playwright not found in devDependencies - E2E tests may fail');
        } else {
          console.log('  ✅ Playwright available for E2E tests');
        }
      }

    } catch (error) {
      console.warn('⚠️  Could not read package.json - dependency check skipped');
    }

    // Check server requirements (if needed)
    if (suitesToRun.some(suite => ['integration', 'e2e'].includes(suite))) {
      console.log('  📋 Server requirements detected - ensure servers are running or will be started by tests');
    }

    console.log('');
  }

  async runTestSuite(suiteType, suites) {
    console.log(`🧪 Running ${suiteType.toUpperCase()} Tests`);
    console.log(`${'─'.repeat(50)}`);

    for (const suite of suites) {
      const suiteResult = await this.runSingleTest(suite);
      this.results.suites.push(suiteResult);
      
      this.results.total++;
      if (suiteResult.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    }

    console.log('');
  }

  async runSingleTest(suite) {
    const startTime = Date.now();
    
    console.log(`🔬 ${suite.name}`);
    console.log(`   ${suite.description}`);
    
    if (suite.requires) {
      console.log(`   📋 Requires: ${suite.requires.join(', ')}`);
    }

    try {
      const result = await this.executeTest(suite);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`   ✅ PASSED (${duration}ms)`);
        if (result.stats) {
          console.log(`   📊 ${result.stats.tests} tests, ${result.stats.passed} passed`);
        }
      } else {
        console.log(`   ❌ FAILED (${duration}ms)`);
        if (result.error) {
          console.log(`   💥 Error: ${result.error.substring(0, 100)}...`);
        }
      }
      
      console.log('');
      
      return {
        name: suite.name,
        path: suite.path,
        success: result.success,
        duration,
        error: result.error,
        stats: result.stats
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ FAILED (${duration}ms)`);
      console.log(`   💥 Error: ${error.message}`);
      console.log('');
      
      return {
        name: suite.name,
        path: suite.path,
        success: false,
        duration,
        error: error.message
      };
    }
  }

  async executeTest(suite) {
    return new Promise((resolve) => {
      const testPath = path.join(projectRoot, suite.path);
      
      let command, args;
      
      if (suite.framework === 'vitest') {
        command = 'npx';
        args = ['vitest', 'run', testPath, '--reporter=json'];
      } else if (suite.framework === 'playwright') {
        command = 'npx';
        args = ['playwright', 'test', testPath, '--reporter=json'];
      } else {
        resolve({ success: false, error: `Unknown test framework: ${suite.framework}` });
        return;
      }

      let stdout = '';
      let stderr = '';

      const child = spawn(command, args, {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Add any test-specific environment variables
          MCP_PORT: process.env.MCP_PORT || '4101',
          WORKBENCH_PORT: process.env.WORKBENCH_PORT || '4102'
        }
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        let result = { success: code === 0 };
        
        // Try to parse test results
        try {
          // For Vitest JSON output
          if (suite.framework === 'vitest' && stdout.includes('"testResults"')) {
            const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
            if (jsonMatch) {
              const testData = JSON.parse(jsonMatch[0]);
              result.stats = {
                tests: testData.numTotalTests || 0,
                passed: testData.numPassedTests || 0,
                failed: testData.numFailedTests || 0
              };
            }
          }
          
          // For Playwright JSON output
          if (suite.framework === 'playwright' && stdout.includes('"suites"')) {
            const jsonMatch = stdout.match(/\{[\s\S]*"suites"[\s\S]*\}/);
            if (jsonMatch) {
              const testData = JSON.parse(jsonMatch[0]);
              const totalTests = testData.suites?.reduce((acc, suite) => 
                acc + (suite.specs?.length || 0), 0) || 0;
              result.stats = {
                tests: totalTests,
                passed: totalTests - (testData.errors?.length || 0),
                failed: testData.errors?.length || 0
              };
            }
          }
        } catch (parseError) {
          // Parsing failed, but test result is still based on exit code
        }

        if (code !== 0) {
          result.error = stderr || stdout || 'Test execution failed';
        }

        resolve(result);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Test timeout exceeded' });
      }, this.options.timeout);

      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  generateSummary() {
    console.log('📊 Test Results Summary');
    console.log('======================');
    console.log('');

    // Overall statistics
    const successRate = this.results.total > 0 ? 
      Math.round((this.results.passed / this.results.total) * 100) : 0;

    console.log(`📈 Overall Results:`);
    console.log(`   Total Suites: ${this.results.total}`);
    console.log(`   Passed: ${this.results.passed} ✅`);
    console.log(`   Failed: ${this.results.failed} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log('');

    // Suite-by-suite breakdown
    if (this.results.suites.length > 0) {
      console.log('📋 Suite Details:');
      
      for (const suite of this.results.suites) {
        const status = suite.success ? '✅' : '❌';
        const duration = `${suite.duration}ms`;
        
        console.log(`   ${status} ${suite.name} (${duration})`);
        
        if (suite.stats) {
          console.log(`      📊 ${suite.stats.tests} tests, ${suite.stats.passed} passed, ${suite.stats.failed} failed`);
        }
        
        if (suite.error) {
          console.log(`      💥 ${suite.error.substring(0, 80)}...`);
        }
      }
      
      console.log('');
    }

    // Recommendations
    console.log('💡 Recommendations:');
    
    if (this.results.failed > 0) {
      console.log(`   🔧 ${this.results.failed} test suite(s) failed - check logs above for details`);
      console.log('   🔍 Run individual suites with --unit-only, --mcp-only, or --e2e-only for debugging');
    }
    
    if (this.results.passed === this.results.total) {
      console.log('   🎉 All test suites passed! RDF concept integration is working correctly.');
      console.log('   ✨ The concept tilt, filtering, and storage functionality is ready for use.');
    }
    
    console.log('');
    console.log('🔗 Related Commands:');
    console.log('   npm run test:unit - Run all unit tests');
    console.log('   npm run test:integration - Run integration tests');
    console.log('   npm run test:e2e - Run end-to-end tests');
    console.log('   npx playwright test - Run Playwright tests directly');
    console.log('   npm run dev - Start development servers for manual testing');
    
    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runner = new ConceptTestRunner();
  runner.run().catch(console.error);
}

export default ConceptTestRunner;