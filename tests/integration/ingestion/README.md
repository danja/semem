# Bookmark Ingestion and Lazy Batch Processing Integration Tests

Comprehensive integration tests for the bookmark ingestion system and lazy batch processing workflow.

## Test Files

### 1. `bookmark-ingestion.integration.test.js`
Tests the BookmarkIngest.js CLI utility:
- Help and validation
- Dry run mode
- Lazy mode ingestion
- Full processing mode
- Error handling
- Verbose output
- Performance characteristics

### 2. `augment-lazy-content.integration.test.js`
Tests the AugmentLazyContent.js CLI utility:
- Help and validation
- Dry run mode
- Single item augmentation
- Batch processing
- Filter by type
- Error handling
- Performance validation

### 3. `lazy-workflow-e2e.integration.test.js`
End-to-end tests for the complete workflow:
- Full lifecycle: Ingest → Query → Augment → Verify
- Performance comparison (lazy vs full)
- Error recovery and resume capability
- Mixed content types
- Documentation compliance

## Running the Tests

### Prerequisites
- Live SPARQL endpoint (configured in `config/config.json`)
- LLM and embedding services available (Ollama/Mistral/Claude)
- Node.js environment with all dependencies installed

### Run All Integration Tests

```bash
# Run all ingestion integration tests
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/

# Run specific test file
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/bookmark-ingestion.integration.test.js

# Run with verbose output
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/ --reporter=verbose
```

### Run Individual Test Suites

```bash
# Bookmark ingestion tests only
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/bookmark-ingestion.integration.test.js

# Augmentation tests only
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/augment-lazy-content.integration.test.js

# E2E workflow tests only
INTEGRATION_TESTS=true npx vitest run tests/integration/ingestion/lazy-workflow-e2e.integration.test.js
```

## Test Configuration

Tests use services configured in `config/config.json`:

```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/semem/query",
      "update": "http://localhost:3030/semem/update",
      "graphName": "http://tensegrity.it/semem",
      "user": "${SPARQL_USER}",
      "password": "${SPARQL_PASSWORD}"
    }
  },
  "embeddingDimension": 1536
}
```

Ensure your `.env` file has the required credentials:

```bash
SPARQL_USER=admin
SPARQL_PASSWORD=your-password
```

## Test Coverage

### BookmarkIngest.js Tests
- ✅ CLI help display
- ✅ Parameter validation
- ✅ Dry run mode (no storage)
- ✅ Lazy mode (fast storage)
- ✅ Full mode (with processing)
- ✅ Metadata verification
- ✅ Performance timing
- ✅ Error handling
- ✅ Verbose output

### AugmentLazyContent.js Tests
- ✅ CLI help display
- ✅ Dry run mode (no processing)
- ✅ Single item augmentation
- ✅ Batch processing
- ✅ Embedding generation
- ✅ Status updates
- ✅ Type filtering
- ✅ Statistics reporting
- ✅ Error handling
- ✅ Performance validation

### E2E Workflow Tests
- ✅ Complete lifecycle workflow
- ✅ Performance comparison
- ✅ Interrupted workflow recovery
- ✅ Mixed content types
- ✅ Documentation compliance
- ✅ Multiple workflow variations

## Expected Test Duration

| Test Suite | Approximate Duration |
|------------|---------------------|
| bookmark-ingestion.integration.test.js | 3-5 minutes |
| augment-lazy-content.integration.test.js | 3-5 minutes |
| lazy-workflow-e2e.integration.test.js | 5-8 minutes |
| **Total** | **11-18 minutes** |

## Test Data Cleanup

All tests automatically clean up their test data:
- Before tests: Removes existing test items
- After tests: Removes all created test items
- Uses dedicated test graph: `http://tensegrity.it/semem`

Test items are identifiable by:
- Processing status: `lazy` or `processed`
- Entity type: `ragno:Entity`
- Content type: `semem:document`, `semem:concept`, or `semem:interaction`

## Performance Benchmarks

Tests validate these performance characteristics:

| Operation | Expected Time |
|-----------|--------------|
| Lazy storage | < 500ms per item |
| Full processing | 30-120s per item |
| Augmentation | 2-30s per item |
| Batch (10 items) | < 5 minutes |

## Troubleshooting

### Tests Fail to Connect to SPARQL
- Verify SPARQL endpoint is running
- Check credentials in `.env`
- Ensure endpoint URLs in `config/config.json` are correct

### Tests Timeout
- Increase timeout in test file (default: 2-5 minutes)
- Check LLM/embedding services are responsive
- Verify network connectivity

### Cleanup Failures
- Tests may leave data if interrupted
- Manual cleanup query:
```sparql
PREFIX semem: <http://purl.org/stuff/semem/>
DELETE {
  GRAPH <http://tensegrity.it/semem> {
    ?element ?p ?o .
  }
}
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?element semem:processingStatus ?status .
    FILTER(?status IN ("lazy", "processed"))
    ?element ?p ?o .
  }
}
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  env:
    INTEGRATION_TESTS: true
    SPARQL_USER: ${{ secrets.SPARQL_USER }}
    SPARQL_PASSWORD: ${{ secrets.SPARQL_PASSWORD }}
  run: |
    npm run test:integration:ingestion
```

## Related Documentation

- [Lazy Batch Processing Guide](../../../docs/manual/lazy-batch-processing.md)
- [Document Ingestion](../../../docs/manual/ingest.md)
- [Testing Framework](../../../docs/manual/tests.md)