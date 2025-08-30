# Testing Infrastructure

Semem includes a comprehensive testing infrastructure organized into multiple categories based on external service dependencies. Tests are implemented using Vitest and organized to support selective execution based on available services.

## Test Categories

### Core Tests
Fast unit tests with no external dependencies, suitable for CI/CD and development feedback loops.

- **Command**: `npm run test:core`
- **Timeout**: 10 seconds
- **Coverage**: 80%+ thresholds enforced
- **Location**: `tests/core/unit/`

### Integration Tests
Tests requiring external services with automatic availability checking.

- **Basic Integration**: `npm run test:integration:basic` 
- **SPARQL Integration**: `npm run test:sparql`
- **Full Integration**: `npm run test:integration:full`

### MCP Protocol Tests
Tests for Model Context Protocol stdio and HTTP interfaces.

- **MCP stdio**: `npm run test:mcp:stdio`
- **MCP HTTP**: `npm run test:mcp:http`

### UI Tests
End-to-end tests for the web workbench interface using Playwright.

- **Workbench**: `npm run test:ui`

## Service Dependencies

Tests automatically check for service availability before execution:

- **SPARQL Store**: Tests expect a Fuseki server at `http://localhost:3030`
- **LLM Providers**: Ollama, Mistral, Claude (via environment variables)
- **Embedding Services**: Nomic, Ollama embedding models
- **External APIs**: Wikipedia, Wikidata (for enhancement tests)

## SPARQL Test Store

Integration tests require a running SPARQL endpoint. The default test configuration expects:

- **Endpoint**: `http://localhost:3030/test`
- **Update URL**: `http://localhost:3030/test/update` 
- **Query URL**: `http://localhost:3030/test/query`
- **Authentication**: admin/admin123 (configurable via SPARQL_USER/SPARQL_PASSWORD environment variables)

To set up a test SPARQL store using Apache Jena Fuseki:

```bash
# Start Fuseki with test dataset
fuseki-server --port=3030 --mem /test
```

## Configuration

Test configuration uses multiple Vitest config files for different scenarios:

- `vitest.core.config.js` - Core unit tests
- `vitest.sparql.config.js` - SPARQL integration tests  
- `vitest.mcp.stdio.config.js` - MCP protocol tests
- `vitest.integration.config.js` - General integration tests

Environment variables are loaded via dotenv following the same pattern as production code.

## Test Utilities

The test infrastructure includes utilities for:

- **Service Checking**: Automatic detection of available services
- **Mock Factories**: Consistent test data generation
- **Config Factories**: Dynamic test configuration creation
- **Cleanup Management**: Proper resource disposal after tests

Tests follow the principle of graceful degradation - they skip or adapt when required services are unavailable rather than failing.