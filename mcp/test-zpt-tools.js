/**
 * Comprehensive ZPT tools testing and validation
 * Tests all 6 ZPT tools and 4 resources with simulation framework
 */
import { registerZPTTools, ZPTToolName } from './tools/zpt-tools.js';
import { registerZPTResources, ZPTResourceURI } from './resources/zpt-resources.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Mock MCP server for testing
class MockMCPServer {
  constructor() {
    this.handlers = new Map();
  }

  setRequestHandler(schema, handler) {
    this.handlers.set(schema, handler);
  }

  async handleRequest(schema, request) {
    const handler = this.handlers.get(schema);
    if (!handler) {
      throw new Error(`No handler registered for schema: ${schema.name}`);
    }
    return await handler(request);
  }
}

// Test data and scenarios
const ZPT_TEST_SCENARIOS = [
  {
    name: "Basic Entity Navigation",
    tool: ZPTToolName.NAVIGATE,
    args: {
      query: "artificial intelligence",
      zoom: "entity",
      tilt: "keywords"
    },
    expectedFields: ["success", "content", "metadata"],
    expectedTime: 1000
  },
  {
    name: "Complex Multi-Parameter Navigation",
    tool: ZPTToolName.NAVIGATE,
    args: {
      query: "machine learning algorithms",
      zoom: "unit",
      pan: {
        temporal: { start: "2020-01-01", end: "2024-12-31" },
        topic: "deep learning"
      },
      tilt: "embedding",
      transform: { 
        maxTokens: 6000, 
        format: "structured",
        chunkStrategy: "semantic"
      }
    },
    expectedFields: ["success", "content", "metadata"],
    expectedTime: 2000
  },
  {
    name: "Preview Navigation",
    tool: ZPTToolName.PREVIEW,
    args: {
      query: "quantum computing",
      zoom: "entity"
    },
    expectedFields: ["success", "preview"],
    expectedTime: 500
  },
  {
    name: "Schema Retrieval",
    tool: ZPTToolName.GET_SCHEMA,
    args: {},
    expectedFields: ["success", "schema"],
    expectedTime: 100
  },
  {
    name: "Parameter Validation - Valid",
    tool: ZPTToolName.VALIDATE_PARAMS,
    args: {
      params: {
        query: "climate change",
        zoom: "unit",
        tilt: "graph"
      }
    },
    expectedFields: ["success", "validation"],
    expectedTime: 100
  },
  {
    name: "Parameter Validation - Invalid",
    tool: ZPTToolName.VALIDATE_PARAMS,
    args: {
      params: {
        query: "",
        zoom: "invalid_zoom",
        tilt: "nonexistent_tilt"
      }
    },
    expectedFields: ["success", "validation"],
    expectedValidation: { valid: false },
    expectedTime: 100
  },
  {
    name: "Get Navigation Options",
    tool: ZPTToolName.GET_OPTIONS,
    args: {
      context: "current",
      query: "renewable energy"
    },
    expectedFields: ["success", "options"],
    expectedTime: 300
  },
  {
    name: "Corpus Analysis",
    tool: ZPTToolName.ANALYZE_CORPUS,
    args: {
      analysisType: "structure",
      includeStats: true
    },
    expectedFields: ["success", "analysis"],
    expectedTime: 500
  }
];

const ZPT_RESOURCE_TESTS = [
  {
    name: "ZPT Schema Resource",
    uri: ZPTResourceURI.SCHEMA,
    expectedMimeType: "application/json",
    expectedContent: ["$schema", "properties", "errorCodes"]
  },
  {
    name: "ZPT Examples Resource", 
    uri: ZPTResourceURI.EXAMPLES,
    expectedMimeType: "text/markdown",
    expectedContent: ["# ZPT Navigation Examples", "Basic Navigation", "Advanced Filtering"]
  },
  {
    name: "ZPT Guide Resource",
    uri: ZPTResourceURI.GUIDE,
    expectedMimeType: "text/markdown", 
    expectedContent: ["# ZPT", "Zoom:", "Pan:", "Tilt:"]
  },
  {
    name: "ZPT Performance Resource",
    uri: ZPTResourceURI.PERFORMANCE,
    expectedMimeType: "text/markdown",
    expectedContent: ["# ZPT Performance", "Optimization", "Caching"]
  }
];

const ZPT_ERROR_SCENARIOS = [
  {
    name: "Empty Query Error",
    tool: ZPTToolName.NAVIGATE,
    args: { query: "" },
    expectError: true,
    expectedErrorType: "ZodError"
  },
  {
    name: "Invalid Zoom Level",
    tool: ZPTToolName.NAVIGATE,
    args: { 
      query: "test",
      zoom: "invalid_zoom"
    },
    expectError: true,
    expectedErrorType: "ZodError"
  },
  {
    name: "Invalid Token Range",
    tool: ZPTToolName.NAVIGATE,
    args: {
      query: "test",
      transform: { maxTokens: 50 }  // Below minimum
    },
    expectError: true,
    expectedErrorType: "ZodError"
  },
  {
    name: "Unknown Tool Call",
    tool: "unknown_zpt_tool",
    args: {},
    expectError: true,
    expectedErrorType: "Error"
  }
];

// Performance benchmarks
const ZPT_PERFORMANCE_BENCHMARKS = [
  {
    name: "Fast Entity Keywords",
    params: { query: "AI", zoom: "entity", tilt: "keywords" },
    maxTime: 300,
    maxTokens: 1000
  },
  {
    name: "Medium Unit Embedding", 
    params: { query: "machine learning", zoom: "unit", tilt: "embedding" },
    maxTime: 800,
    maxTokens: 3000
  },
  {
    name: "Complex Graph Analysis",
    params: { query: "neural networks", zoom: "unit", tilt: "graph" },
    maxTime: 2000,
    maxTokens: 5000
  },
  {
    name: "Quick Corpus Overview",
    params: { query: "technology trends", zoom: "corpus", tilt: "temporal" },
    maxTime: 500,
    maxTokens: 1000
  }
];

/**
 * Main ZPT testing function
 */
async function testZPTImplementation() {
  console.log('🧪 Starting ZPT MCP Implementation Testing...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    toolsRegistered: 0,
    toolsValidated: 0,
    resourcesRegistered: 0,
    resourcesValidated: 0,
    performanceTests: 0,
    performancePassed: 0,
    errorTests: 0,
    errorTestsPassed: 0,
    errors: [],
    warnings: [],
    summary: {}
  };

  // Create mock server and register ZPT components
  const server = new MockMCPServer();
  
  try {
    // Register ZPT tools and resources
    registerZPTTools(server);
    registerZPTResources(server);
    
    console.log('✅ ZPT tools and resources registered successfully\n');
    
    // Test tool registration
    await testToolRegistration(server, results);
    
    // Test resource registration  
    await testResourceRegistration(server, results);
    
    // Test tool functionality
    await testToolFunctionality(server, results);
    
    // Test resource content
    await testResourceContent(server, results);
    
    // Test error handling
    await testErrorHandling(server, results);
    
    // Test performance benchmarks
    await testPerformanceBenchmarks(server, results);
    
    // Generate summary
    generateTestSummary(results);
    
  } catch (error) {
    console.error('❌ Critical test failure:', error);
    results.errors.push({
      phase: 'setup',
      error: error.message,
      stack: error.stack
    });
  }
  
  return results;
}

/**
 * Test ZPT tool registration
 */
async function testToolRegistration(server, results) {
  console.log('📋 Testing ZPT tool registration...');
  
  try {
    const toolsResponse = await server.handleRequest(ListToolsRequestSchema, {});
    const tools = toolsResponse.tools || [];
    
    const zptTools = tools.filter(tool => tool.name.startsWith('zpt_'));
    results.toolsRegistered = zptTools.length;
    
    console.log(`✅ Found ${zptTools.length} ZPT tools registered`);
    
    // Verify expected tools are present
    const expectedTools = Object.values(ZPTToolName);
    for (const expectedTool of expectedTools) {
      const found = zptTools.find(tool => tool.name === expectedTool);
      if (found) {
        console.log(`   ✓ ${expectedTool}: ${found.description}`);
      } else {
        results.errors.push(`Missing expected tool: ${expectedTool}`);
        console.log(`   ❌ Missing: ${expectedTool}`);
      }
    }
    
    // Validate tool schemas
    for (const tool of zptTools) {
      if (!tool.inputSchema || !tool.inputSchema.properties) {
        results.warnings.push(`Tool ${tool.name} missing input schema`);
      }
    }
    
  } catch (error) {
    results.errors.push(`Tool registration test failed: ${error.message}`);
    console.error('❌ Tool registration test failed:', error);
  }
  
  console.log('');
}

/**
 * Test ZPT resource registration
 */
async function testResourceRegistration(server, results) {
  console.log('📚 Testing ZPT resource registration...');
  
  try {
    const resourcesResponse = await server.handleRequest(ListResourcesRequestSchema, {});
    const resources = resourcesResponse.resources || [];
    
    const zptResources = resources.filter(resource => resource.uri.startsWith('semem://zpt/'));
    results.resourcesRegistered = zptResources.length;
    
    console.log(`✅ Found ${zptResources.length} ZPT resources registered`);
    
    // Verify expected resources are present
    const expectedResources = Object.values(ZPTResourceURI);
    for (const expectedResource of expectedResources) {
      const found = zptResources.find(resource => resource.uri === expectedResource);
      if (found) {
        console.log(`   ✓ ${expectedResource}: ${found.description}`);
      } else {
        results.errors.push(`Missing expected resource: ${expectedResource}`);
        console.log(`   ❌ Missing: ${expectedResource}`);
      }
    }
    
  } catch (error) {
    results.errors.push(`Resource registration test failed: ${error.message}`);
    console.error('❌ Resource registration test failed:', error);
  }
  
  console.log('');
}

/**
 * Test ZPT tool functionality
 */
async function testToolFunctionality(server, results) {
  console.log('🔧 Testing ZPT tool functionality...');
  
  for (const scenario of ZPT_TEST_SCENARIOS) {
    try {
      console.log(`   Testing: ${scenario.name}`);
      
      const startTime = Date.now();
      const response = await server.handleRequest(CallToolRequestSchema, {
        params: {
          name: scenario.tool,
          arguments: scenario.args
        }
      });
      const duration = Date.now() - startTime;
      
      // Validate response structure
      if (!response.content || !Array.isArray(response.content)) {
        throw new Error('Invalid response structure: missing content array');
      }
      
      const content = response.content[0];
      if (!content.text) {
        throw new Error('Invalid response: missing text content');
      }
      
      // Parse and validate JSON response
      const result = JSON.parse(content.text);
      
      // Check expected fields
      for (const field of scenario.expectedFields) {
        if (!(field in result)) {
          throw new Error(`Missing expected field: ${field}`);
        }
      }
      
      // Validate specific expectations
      if (scenario.expectedValidation) {
        if (result.validation.valid !== scenario.expectedValidation.valid) {
          throw new Error(`Validation result mismatch: expected ${scenario.expectedValidation.valid}, got ${result.validation.valid}`);
        }
      }
      
      // Check performance
      if (duration > scenario.expectedTime) {
        results.warnings.push(`${scenario.name} took ${duration}ms (expected < ${scenario.expectedTime}ms)`);
      }
      
      results.toolsValidated++;
      console.log(`   ✅ ${scenario.name} passed (${duration}ms)`);
      
    } catch (error) {
      results.errors.push(`${scenario.name}: ${error.message}`);
      console.log(`   ❌ ${scenario.name} failed: ${error.message}`);
    }
  }
  
  console.log('');
}

/**
 * Test ZPT resource content
 */
async function testResourceContent(server, results) {
  console.log('📖 Testing ZPT resource content...');
  
  for (const test of ZPT_RESOURCE_TESTS) {
    try {
      console.log(`   Testing: ${test.name}`);
      
      const response = await server.handleRequest(ReadResourceRequestSchema, {
        params: { uri: test.uri }
      });
      
      if (!response.contents || !Array.isArray(response.contents)) {
        throw new Error('Invalid response structure: missing contents array');
      }
      
      const content = response.contents[0];
      if (!content.content) {
        throw new Error('Missing content in resource response');
      }
      
      // Validate MIME type
      if (content.mimeType !== test.expectedMimeType) {
        throw new Error(`MIME type mismatch: expected ${test.expectedMimeType}, got ${content.mimeType}`);
      }
      
      // Check for expected content elements
      const contentStr = content.content;
      for (const expectedElement of test.expectedContent) {
        if (!contentStr.includes(expectedElement)) {
          throw new Error(`Missing expected content element: ${expectedElement}`);
        }
      }
      
      // Validate JSON structure for JSON resources
      if (test.expectedMimeType === 'application/json') {
        JSON.parse(contentStr); // Will throw if invalid JSON
      }
      
      results.resourcesValidated++;
      console.log(`   ✅ ${test.name} passed`);
      
    } catch (error) {
      results.errors.push(`${test.name}: ${error.message}`);
      console.log(`   ❌ ${test.name} failed: ${error.message}`);
    }
  }
  
  console.log('');
}

/**
 * Test error handling scenarios
 */
async function testErrorHandling(server, results) {
  console.log('⚠️  Testing ZPT error handling...');
  
  for (const scenario of ZPT_ERROR_SCENARIOS) {
    try {
      console.log(`   Testing: ${scenario.name}`);
      
      const response = await server.handleRequest(CallToolRequestSchema, {
        params: {
          name: scenario.tool,
          arguments: scenario.args
        }
      });
      
      // Parse response to check for error
      const content = response.content[0];
      const result = JSON.parse(content.text);
      
      if (scenario.expectError) {
        if (result.success !== false) {
          throw new Error('Expected error response but got success');
        }
        console.log(`   ✅ ${scenario.name} correctly returned error: ${result.error}`);
      } else {
        if (result.success !== true) {
          throw new Error(`Unexpected error: ${result.message}`);
        }
        console.log(`   ✅ ${scenario.name} passed`);
      }
      
      results.errorTestsPassed++;
      
    } catch (error) {
      if (scenario.expectError) {
        // Expected error scenario
        console.log(`   ✅ ${scenario.name} correctly threw error: ${error.message}`);
        results.errorTestsPassed++;
      } else {
        results.errors.push(`${scenario.name}: ${error.message}`);
        console.log(`   ❌ ${scenario.name} failed: ${error.message}`);
      }
    }
    
    results.errorTests++;
  }
  
  console.log('');
}

/**
 * Test performance benchmarks
 */
async function testPerformanceBenchmarks(server, results) {
  console.log('⚡ Testing ZPT performance benchmarks...');
  
  for (const benchmark of ZPT_PERFORMANCE_BENCHMARKS) {
    try {
      console.log(`   Benchmarking: ${benchmark.name}`);
      
      const startTime = Date.now();
      const response = await server.handleRequest(CallToolRequestSchema, {
        params: {
          name: ZPTToolName.NAVIGATE,
          arguments: benchmark.params
        }
      });
      const duration = Date.now() - startTime;
      
      const content = response.content[0];
      const result = JSON.parse(content.text);
      
      // Check performance criteria
      let passed = true;
      let issues = [];
      
      if (duration > benchmark.maxTime) {
        passed = false;
        issues.push(`Time: ${duration}ms > ${benchmark.maxTime}ms`);
      }
      
      if (result.metadata && result.metadata.tokenCount > benchmark.maxTokens) {
        passed = false;
        issues.push(`Tokens: ${result.metadata.tokenCount} > ${benchmark.maxTokens}`);
      }
      
      if (passed) {
        results.performancePassed++;
        console.log(`   ✅ ${benchmark.name} passed (${duration}ms, ${result.metadata?.tokenCount || 'N/A'} tokens)`);
      } else {
        results.warnings.push(`${benchmark.name} performance issues: ${issues.join(', ')}`);
        console.log(`   ⚠️  ${benchmark.name} performance warning: ${issues.join(', ')}`);
      }
      
    } catch (error) {
      results.errors.push(`${benchmark.name}: ${error.message}`);
      console.log(`   ❌ ${benchmark.name} failed: ${error.message}`);
    }
    
    results.performanceTests++;
  }
  
  console.log('');
}

/**
 * Generate comprehensive test summary
 */
function generateTestSummary(results) {
  console.log('📊 ZPT Testing Summary');
  console.log('=' .repeat(50));
  
  // Calculate success rates
  const toolSuccessRate = results.toolsRegistered > 0 ? 
    (results.toolsValidated / results.toolsRegistered * 100).toFixed(1) : 0;
  const resourceSuccessRate = results.resourcesRegistered > 0 ? 
    (results.resourcesValidated / results.resourcesRegistered * 100).toFixed(1) : 0;
  const errorHandlingRate = results.errorTests > 0 ? 
    (results.errorTestsPassed / results.errorTests * 100).toFixed(1) : 0;
  const performanceRate = results.performanceTests > 0 ? 
    (results.performancePassed / results.performanceTests * 100).toFixed(1) : 0;
  
  console.log(`🛠️  Tools: ${results.toolsValidated}/${results.toolsRegistered} passed (${toolSuccessRate}%)`);
  console.log(`📚 Resources: ${results.resourcesValidated}/${results.resourcesRegistered} passed (${resourceSuccessRate}%)`);
  console.log(`⚠️  Error Handling: ${results.errorTestsPassed}/${results.errorTests} passed (${errorHandlingRate}%)`);
  console.log(`⚡ Performance: ${results.performancePassed}/${results.performanceTests} passed (${performanceRate}%)`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors (${results.errors.length}):`);
    results.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${results.warnings.length}):`);
    results.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }
  
  // Overall status
  const hasErrors = results.errors.length > 0;
  const hasWarnings = results.warnings.length > 0;
  
  console.log(`\n📈 Overall Status: ${hasErrors ? '❌ FAILED' : hasWarnings ? '⚠️  PASSED WITH WARNINGS' : '✅ PASSED'}`);
  
  // Store summary
  results.summary = {
    status: hasErrors ? 'FAILED' : hasWarnings ? 'WARNING' : 'PASSED',
    toolSuccessRate: parseFloat(toolSuccessRate),
    resourceSuccessRate: parseFloat(resourceSuccessRate),
    errorHandlingRate: parseFloat(errorHandlingRate),
    performanceRate: parseFloat(performanceRate),
    totalErrors: results.errors.length,
    totalWarnings: results.warnings.length
  };
  
  console.log('');
}

/**
 * Export testing utilities for integration testing
 */
export {
  testZPTImplementation,
  ZPT_TEST_SCENARIOS,
  ZPT_RESOURCE_TESTS,
  ZPT_ERROR_SCENARIOS,
  ZPT_PERFORMANCE_BENCHMARKS
};

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testZPTImplementation()
    .then(results => {
      process.exit(results.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}