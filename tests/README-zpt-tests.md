# ZPT (Zoom-Pan-Tilt) Navigation Tests

This directory contains comprehensive tests for the ZPT navigation functionality in Semem, covering both MCP server integration and workbench UI end-to-end testing.

## Overview

The ZPT tests are based on exercises defined in [`docs/manual/zpt-exercises.md`](../docs/manual/zpt-exercises.md) and test the following functionality:

- **Zoom**: Navigation at different abstraction levels (micro → entity → text → unit → community → corpus)
- **Pan**: Content filtering by domains and keywords  
- **Tilt**: Viewing perspectives (keywords, embedding, graph, temporal)

## Test Structure

### Integration Tests (Vitest)
**Location**: `tests/integration/zpt/zpt-mcp-integration.test.js`

Tests ZPT functionality directly through the MCP server API:
- ✅ Basic zoom level navigation (micro, entity, text, unit, community, corpus)
- ✅ Pan filtering by domains and keywords
- ✅ Tilt perspective changes
- ✅ Combined ZPT operations
- ✅ Dynamic navigation sequences
- ✅ Performance and error handling

### End-to-End Tests (Playwright) 
**Location**: `tests/e2e/zpt/zpt-workbench-e2e.test.js`

Tests ZPT functionality through the workbench UI:
- ✅ UI zoom controls and visual feedback
- ✅ Pan filter controls and state management
- ✅ Tilt selector and perspective switching
- ✅ Console logging and progress messages
- ✅ User interaction workflows
- ✅ State consistency across operations

## Test Data

Both test suites seed the system with comprehensive test data covering:

- **Micro**: Cellular biology, DNA bases, mitochondria
- **Entities**: Scientists (Einstein, Curie), institutions (Princeton, NASA)
- **Text**: Full passages about science, history, and technology
- **Units**: Summarized chunks covering democracy, education, governance, AI
- **Community**: Science, history, and technology clusters

## Prerequisites

### System Requirements
- Node.js 18+ 
- Docker and Docker Compose (for services)
- Chrome/Chromium browser (for Playwright)

### Service Dependencies
- **MCP Server** running on port 4101
- **Workbench UI** running on port 4102
- **SPARQL Store** (Fuseki) running on port 3030

## Running Tests

### 1. Start Services

```bash
# Option A: Docker services
docker-compose up -d

# Option B: Local services  
./start.sh

# Verify services are running
curl http://localhost:4101/health  # MCP server
curl http://localhost:4102/health  # Workbench  
curl http://localhost:3030/$/ping  # Fuseki
```

### 2. Run Integration Tests (MCP)

```bash
# Run all ZPT integration tests
npm run test tests/integration/zpt/

# Run with verbose output
npm run test tests/integration/zpt/ -- --reporter=verbose

# Run specific test exercises
npm run test tests/integration/zpt/zpt-mcp-integration.test.js -- -t "Exercise 1.1"
```

### 3. Run E2E Tests (Workbench)

```bash
# Install Playwright dependencies (first time only)
npx playwright install

# Run all ZPT e2e tests
npm run test:e2e tests/e2e/zpt/

# Run in headed mode to watch tests
npx playwright test tests/e2e/zpt/ --headed

# Run specific test exercises  
npx playwright test tests/e2e/zpt/zpt-workbench-e2e.test.js --grep "Exercise 1.1"

# Generate HTML report
npx playwright show-report
```

### 4. Run All ZPT Tests

```bash
# Run both integration and e2e tests
npm run test:zpt

# Or run individually
npm run test tests/integration/zpt/ && npm run test:e2e tests/e2e/zpt/
```

## Test Configuration

### Environment Variables

```bash
# Service ports
export MCP_PORT=4101
export WORKBENCH_PORT=4102  
export FUSEKI_PORT=3030

# Service URLs
export MCP_URL="http://localhost:4101"
export WORKBENCH_URL="http://localhost:4102"

# Test timeouts (milliseconds)
export TEST_TIMEOUT=30000
export SETUP_DELAY=2000
```

### Integration Test Config

Located in test files:
- **Timeout**: 30 seconds per test
- **Setup Delay**: 1-2 seconds between operations
- **Retry Logic**: 2 retries on CI, 0 locally
- **Parallel Execution**: Disabled for integration tests

### Playwright Config

Located in `playwright.config.js`:
- **Browsers**: Chrome, Firefox, Safari
- **Viewport**: 1280x720 (workbench optimized)
- **Timeouts**: 60s test, 10s assertions, 30s navigation
- **Artifacts**: Screenshots on failure, video on retry
- **Reporters**: HTML, JUnit, List

## Test Exercises

### Exercise Set 1: Basic Zoom Navigation
- **1.1**: Micro level detail (ATP, DNA bases)
- **1.2**: Entity level navigation (Einstein, Princeton)  
- **1.3**: Text level detail (full passages)
- **1.4**: Unit level abstraction (semantic summaries)
- **1.5**: Community level overview (science, technology clusters)
- **1.6**: Corpus level overview (corpus stats)

### Exercise Set 2: Pan Filtering  
- **2.1**: Domain-based filtering (science, technology)
- **2.2**: Keyword-based filtering (AI, machine learning)
- **2.3**: Combined domain and keyword filtering

### Exercise Set 3: Tilt Perspective Changes
- **3.1**: Keywords perspective (term emphasis)
- **3.2**: Entities perspective (named entity focus)
- **3.3**: Relationships perspective (connection emphasis)
- **3.4**: Temporal perspective (time-based organization)

### Exercise Set 4: Combined ZPT Navigation
- **4.1**: Science research (concept + science domain + relationships)
- **4.2**: Historical analysis (entity + history keywords + temporal)
- **4.3**: Technology themes (theme + tech keywords + keywords)

### Exercise Set 5: Dynamic Navigation Sequences
- **5.1**: Zoom progression (corpus → community → unit → text → entity → micro)
- **5.2**: Pan filter refinement (progressive narrowing)
- **5.3**: Tilt perspective switching (same content, different views)

## Performance Expectations

### Response Times
- **Simple Navigation**: < 500ms
- **Complex Filtering**: < 1000ms  
- **Multi-step Sequences**: < 2000ms total
- **UI Operations**: < 5000ms

### Quality Metrics
- **Relevance**: >80% accuracy for navigation criteria
- **Completeness**: Comprehensive results within scope
- **Consistency**: Same parameters yield consistent results
- **Coherence**: Logical organization and meaningful results

## Debugging

### Console Logging
Tests validate human-friendly console messages:
- ✅ `🔍 Zoom level changed to "entity" - adjusting abstraction level`
- ✅ `🔄 Pan filters updated - filtering by 2 domains and 3 keywords`
- ✅ `🎯 Tilt view changed to "keywords" - adjusting content perspective`
- ✅ `🗺️ Executing ZPT navigation with zoom:"entity", pan filters, and tilt:"keywords"`
- ✅ `✅ Navigation completed - found 28 relevant items`

### Error Messages  
- Clear parameter validation errors
- Meaningful empty result messages
- Network timeout handling
- Malformed query sanitization

### Artifacts
- **Screenshots**: Taken on test failures
- **Videos**: Recorded on retries
- **Traces**: Available for debugging
- **Console Logs**: Captured for analysis

## Common Issues

### Service Connection
```bash
# Check if services are running
docker ps                                    # Docker services
ps aux | grep -E "(mcp|workbench|fuseki)"  # Local processes

# Restart services if needed
docker-compose restart
# or
./stop.sh && ./start.sh
```

### Test Data Issues
```bash
# Clear test data
curl -X POST http://localhost:3030/semem/update \
  -H "Content-Type: application/sparql-update" \
  -d "CLEAR ALL"

# Re-run tests to re-seed data
```

### Browser Issues (Playwright)
```bash
# Update browsers
npx playwright install

# Clear browser cache
npx playwright test --reset

# Run with debug mode
npx playwright test --debug
```

## Contributing

When adding new ZPT tests:

1. **Document in exercises.md**: Add human-level description
2. **Add to both test suites**: Integration (MCP) and E2E (Workbench)
3. **Include test data**: Provide realistic content for seeding
4. **Validate console logs**: Ensure human-friendly progress messages
5. **Test error cases**: Validate graceful failure handling
6. **Performance check**: Ensure tests complete within timeout bounds

## CI/CD Integration

Tests are configured for continuous integration:

```yaml
# Example GitHub Actions workflow
- name: Run ZPT Integration Tests
  run: npm run test tests/integration/zpt/
  
- name: Run ZPT E2E Tests  
  run: npm run test:e2e tests/e2e/zpt/
  env:
    CI: true
    WORKBENCH_URL: http://localhost:4102
    MCP_URL: http://localhost:4101
```

The test suite provides comprehensive coverage of ZPT navigation functionality across both API and UI layers, ensuring robust semantic navigation capabilities.
