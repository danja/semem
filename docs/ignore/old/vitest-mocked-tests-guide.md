# Running Mocked Tests with Vitest

This document describes the approach taken to run only mocked tests that don't require external services like Fuseki or Ollama. This ensures CI/CD pipelines can run tests successfully without needing to set up complex infrastructure.

## Quick Start

To run only the mocked tests, use:

```bash
# Run tests that don't require external services
npm run test:mocked

# Run with coverage
npm run test:coverage:mocked
```

## What Tests Are Included?

The mocked tests include all `.vitest.js` files in the `tests/unit` directory. These tests have been specifically designed to use mocks instead of actual external services, making them reliable even when services like Fuseki or Ollama are not available.

Current test files that run with mocks:
- Config.vitest.js
- ContextWindowManager.vitest.js
- MemoryManager.vitest.js
- api/APILogger.vitest.js
- api/BaseAPI.vitest.js
- handlers/CLIHandler.vitest.js
- handlers/REPLHandler.vitest.js
- http/WebSocketServer.vitest.js
- http/message-queue.vitest.js
- sparql/SPARQLEndpoint.vitest.js

## Implementation Details

### Test Script

The `run-mocked-tests.sh` script uses `find` to locate all `.vitest.js` files in the unit tests directory and runs them using Vitest:

```bash
#!/bin/bash
# Script to run only tests that use mocks (no external dependencies)

echo "Running only tests with mocks that don't require external services..."
echo "These tests will pass regardless of whether Fuseki, Ollama, etc. are running."

# Find and run all .vitest.js files in the unit tests directory
find tests/unit -name "*.vitest.js" | xargs npx vitest run "$@"
```

### NPM Scripts

Several npm scripts have been configured to use this approach:

```json
"test:mocked": "./run-mocked-tests.sh",
"test:coverage:mocked": "./run-mocked-tests.sh --coverage",
"test:ci": "./run-mocked-tests.sh --coverage --reporter=json --outputFile=./coverage/coverage.json",
```

### GitHub Actions Integration

The GitHub Actions workflows have been updated to use the mocked tests:

```yaml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run only mocked tests
      run: ./run-mocked-tests.sh --reporter=verbose
      
    - name: Generate coverage for mocked tests only
      run: ./run-mocked-tests.sh --coverage
      
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        directory: ./coverage/
        fail_ci_if_error: true
```

## Adding New Mocked Tests

To add new tests that work with this approach:

1. Create a new test file with the `.vitest.js` extension in the `tests/unit` directory.
2. Use the `VitestTestHelper` utility to create mocks instead of using real services.
3. Install the Vitest test utilities in your test with:
   ```javascript
   import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
   import { setupTestEnvironment } from '../helpers/testSetup.js';
   ```
4. Set up your test environment and mocks:
   ```javascript
   const utils = setupTestEnvironment();
   const mockApi = VitestTestHelper.createMockAPI();
   ```

## Test Coverage

The current test coverage with mocked tests only shows approximately 16% code coverage. This is expected since we're only running a subset of all tests that have been modified to use mocks.

When adding more tests, prioritize migrating the most critical components to use mocks so they can be included in the CI pipeline.