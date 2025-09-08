# Simple Verbs Testing Guide

This directory contains comprehensive tests for the `mcp/tools/simple-verbs.js` functionality, split into unit tests and integration tests.

## Test Structure

### Unit Tests
**Location**: `tests/unit/mcp/tools/simple-verbs.test.js`
- **Purpose**: Test individual components with mocked dependencies
- **Coverage**: ZPTStateManager and SimpleVerbsService core functionality
- **Dependencies**: Uses mocks, no external services required
- **Speed**: Fast execution (~2 seconds)

### Integration Tests  
**Location**: `tests/integration/mcp/simple-verbs.integration.test.js`
- **Purpose**: Test complete functionality with live SPARQL store
- **Coverage**: End-to-end workflows with real database operations
- **Dependencies**: Requires SPARQL store running on localhost:3030
- **Speed**: Slower execution due to network operations

## Running the Tests

### Unit Tests (Recommended for Development)
```bash
# Run all unit tests
npx vitest run tests/unit/mcp/tools/simple-verbs.test.js --reporter=verbose

# Run with watch mode for development
npx vitest tests/unit/mcp/tools/simple-verbs.test.js
```

### Integration Tests (For System Validation)
```bash
# Prerequisites: Start SPARQL server
./start.sh  # or ensure SPARQL is running on localhost:3030

# Run basic integration tests (working)
INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs-basic.integration.test.js --reporter=verbose

# Full integration tests (requires implementation fixes)
INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs.integration.test.js --reporter=verbose
```

**Note**: The full integration tests require fixes to implementation bugs in SimpleVerbsService (`startTime` variable scope and success state logic). The basic integration tests work and provide meaningful validation.

### Run Both Test Suites
```bash
# Run unit tests first (fast feedback)
npx vitest run tests/unit/mcp/tools/simple-verbs.test.js

# Then run integration tests (comprehensive validation)
INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs.integration.test.js
```

## Test Coverage

### ZPTStateManager Unit Tests (10 tests - All Passing ✅)
- **State Management**: Initialize, zoom, pan, tilt, reset operations
- **Session Cache**: Add items, search by similarity, statistics
- **State Persistence**: History tracking and size limits

### SimpleVerbsService Unit Tests (11 tests - All Passing ✅)  
- **Service Initialization**: Dependency injection and setup
- **Method Validation**: All verb methods (tell, ask, zoom, pan, tilt, etc.)
- **Error Handling**: Graceful degradation and error responses
- **State Consistency**: Cross-operation state management

### Integration Tests (16 test scenarios)
- **Content Storage**: Real SPARQL operations with tell()
- **Question Answering**: Context retrieval and LLM integration
- **ZPT Navigation**: Zoom, pan, tilt with state persistence
- **Memory Management**: Remember, forget, recall operations
- **System Health**: Analytics and health checks
- **Error Resilience**: Network failure handling

## Test Environment

### Unit Test Environment
- **Mocked Dependencies**: MemoryManager, SPARQLHelper, LLMHandler
- **No Network**: All external calls mocked
- **Fast Execution**: Suitable for TDD and CI/CD
- **Isolated**: Each test runs independently

### Integration Test Environment  
- **Live Dependencies**: Real SPARQL endpoint at localhost:3030
- **Network Operations**: Actual HTTP requests to SPARQL store
- **Data Persistence**: Tests create and clean up real data
- **System Validation**: Verifies complete workflow functionality

## Development Workflow

1. **Start with Unit Tests**: Fast feedback during development
   ```bash
   npx vitest tests/unit/mcp/tools/simple-verbs.test.js --watch
   ```

2. **Validate with Integration Tests**: Before commits/releases
   ```bash
   ./start.sh  # Start local SPARQL server
   INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/simple-verbs.integration.test.js
   ```

3. **CI/CD Pipeline**: Run unit tests in all builds, integration tests on main branch

## Troubleshooting

### Unit Tests Failing
- Check that mocks are properly set up
- Ensure no real network calls are being made
- Verify test isolation (no shared state between tests)

### Integration Tests Failing
- Verify SPARQL server is running: `curl http://localhost:3030/$/ping`
- Check server logs for connection errors
- Ensure database permissions for admin:admin123
- Clear test data if cleanup failed

### Common Issues
- **Port conflicts**: Ensure port 3030 is available for SPARQL
- **Mock leakage**: Unit tests should not hit real services
- **Test data**: Integration tests clean up automatically but may need manual cleanup if interrupted

## Test Data Management

### Unit Tests
- Use synthetic test data
- All data is mocked, nothing persisted
- No cleanup required

### Integration Tests
- Create test data with unique identifiers
- Automatic cleanup in afterEach/afterAll hooks
- Use separate test graph: `http://hyperdata.it/content-test-integration`
- Manual cleanup if needed:
  ```sparql
  DELETE WHERE {
    GRAPH <http://hyperdata.it/content-test-integration> {
      ?s ?p ?o
    }
  }
  ```

## Performance Expectations

### Unit Tests
- **Total Runtime**: ~2 seconds
- **Individual Tests**: <100ms each
- **Memory Usage**: <100MB peak

### Integration Tests  
- **Total Runtime**: ~10-30 seconds (depending on network)
- **Individual Tests**: 500ms-5s each
- **Memory Usage**: <200MB peak
- **Network**: Requires stable connection to localhost:3030