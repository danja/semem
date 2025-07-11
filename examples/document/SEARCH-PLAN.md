# Comprehensive Search Implementation Plan with Vitest Testing

## Overview
Create `examples/document/Search.js` that uses the existing `src/ragno/search/` system to find nodes in the graph related to questions, with proper ranking and relevance filtering. The implementation will support both string queries and URI-based node queries, with comprehensive Vitest test coverage.

## Core Components

### 1. Main Search Module (`examples/document/Search.js`)
- **Purpose**: High-level search interface for document/question discovery
- **Features**:
  - Accept string queries or URI identifiers
  - Use unified RagnoSearch system from `src/ragno/search/index.js`
  - Provide ranked, filtered results with relevance scoring
  - Support multiple search modes (dual, exact, similarity, traversal)
  - Include result explanation and provenance

### 2. Search System Refactoring (`src/ragno/search/`)
- **DualSearch.js Enhancements**:
  - Add document-specific query processing
  - Implement question-to-entity mapping
  - Add relevance filtering based on document context
  - Support URI-based queries as starting points
  
- **New SearchFilters.js Module**:
  - Document-type filtering (questions, entities, chunks)
  - Relevance threshold management
  - Content-type specific ranking adjustments
  - Result deduplication and merging

### 3. SPARQL Service Integration
- **New Query Templates**:
  - `document-search-by-uri.sparql`: Find related nodes from URI starting point
  - `question-entity-mapping.sparql`: Map questions to relevant entities
  - `document-relevance-ranking.sparql`: Advanced relevance scoring
  - `search-result-context.sparql`: Retrieve context for search results

### 4. Configuration and Options
- **Search Configuration**:
  - Configurable relevance thresholds
  - Document type weights and preferences
  - Result limits and pagination
  - Output format options (detailed, summary, URIs only)

## Comprehensive Testing Strategy

### Unit Tests (`tests/unit/`)

#### 1. Search Module Tests (`tests/unit/examples/document/Search.test.js`)
- **Query parsing**: String vs URI detection
- **Configuration handling**: Options validation and defaults
- **Result formatting**: Output structure and filtering
- **Error handling**: Invalid inputs and edge cases
- **CLI argument parsing**: Command line interface validation

#### 2. SearchFilters Tests (`tests/unit/ragno/search/SearchFilters.test.js`)
- **Relevance filtering**: Threshold-based filtering logic
- **Document type filtering**: Type-specific filtering rules
- **Result deduplication**: Duplicate removal and merging
- **Ranking adjustments**: Score normalization and weighting
- **Filter combination**: Multiple filter interaction

#### 3. Enhanced DualSearch Tests (`tests/unit/ragno/search/DualSearch.test.js`)
- **Document-specific queries**: Enhanced query processing
- **URI-based search**: Starting point handling
- **Question-entity mapping**: Entity extraction improvements
- **Result ranking**: Document-context aware scoring
- **Search mode selection**: Mode-specific behavior

### Integration Tests (`tests/integration/`)

#### 1. Search System Integration (`tests/integration/ragno/search/SearchSystem.test.js`)
- **End-to-end search flow**: Full search pipeline execution
- **RagnoSearch integration**: Component interaction testing
- **SPARQL service integration**: Query execution and result processing
- **Multi-mode search**: Combined search method testing
- **Performance benchmarks**: Search speed and accuracy metrics

#### 2. Document Search Integration (`tests/integration/examples/document/DocumentSearch.test.js`)
- **RAG system integration**: Coordination with existing RAG.js
- **Real data testing**: Tests with actual document corpus
- **Search result quality**: Relevance and accuracy validation
- **Cross-system compatibility**: Integration with other document tools

### Mock Infrastructure (`tests/__mocks__/`)

#### 1. Search Mocks (`tests/__mocks__/ragno/search/`)
- **Mock RagnoSearch**: Controlled search system behavior
- **Mock VectorIndex**: Vector search simulation
- **Mock DualSearch**: Search method mocking
- **Mock SearchAPI**: API endpoint simulation

#### 2. Document Mocks (`tests/__mocks__/examples/document/`)
- **Mock document corpus**: Test document collections
- **Mock embeddings**: Controlled vector representations
- **Mock SPARQL responses**: Predictable query results
- **Mock search results**: Expected output formats

### Test Data Management (`tests/fixtures/`)

#### 1. Search Test Data (`tests/fixtures/search/`)
- **Sample queries**: String and URI query examples
- **Expected results**: Ground truth for search validation
- **Test documents**: Small corpus for testing
- **Embedding vectors**: Pre-computed test embeddings

#### 2. Configuration Test Data (`tests/fixtures/config/`)
- **Search configurations**: Various config scenarios
- **SPARQL endpoints**: Test endpoint configurations
- **Filter settings**: Different filtering scenarios

### Test Utilities (`tests/helpers/search/`)

#### 1. Search Test Helpers (`tests/helpers/search/SearchTestHelper.js`)
- **Search setup**: Initialize search system for testing
- **Result validation**: Validate search result structure
- **Performance measurement**: Timing and memory usage
- **Mock data generation**: Create test data on demand

#### 2. Document Test Helpers (`tests/helpers/document/DocumentTestHelper.js`)
- **Document loading**: Load test documents
- **Embedding generation**: Create test embeddings
- **SPARQL setup**: Configure test SPARQL endpoints
- **Cleanup utilities**: Test environment cleanup

## Implementation Steps

### Phase 1: Core Search Module + Unit Tests
1. Create `examples/document/Search.js` with CLI interface
2. Implement query parsing (string vs URI detection)
3. Initialize RagnoSearch system with document-optimized configuration
4. Add basic search execution with result formatting
5. **Create unit tests** for all core functionality
6. **Add mocks** for external dependencies

### Phase 2: Search System Enhancement + Integration Tests
1. Extend DualSearch for document-specific operations
2. Create SearchFilters module for relevance management
3. Add URI-based search starting points
4. Implement result ranking improvements
5. **Create integration tests** for enhanced components
6. **Add performance benchmarks**

### Phase 3: SPARQL Integration + Service Tests
1. Create new query templates for document search
2. Integrate with existing SPARQLQueryService
3. Add context retrieval for search results
4. Implement question-entity relationship queries
5. **Test SPARQL integration** with real and mock endpoints
6. **Validate query templates** with unit tests

### Phase 4: Unification with RAG.js + System Tests
1. Extract common search functionality to `src/ragno/search/`
2. Create shared modules for embedding operations
3. Standardize SPARQL query patterns
4. Update RAG.js to use unified search system
5. **Create end-to-end integration tests**
6. **Add regression tests** for existing functionality

### Phase 5: Documentation + Test Coverage
1. Complete test coverage analysis
2. Add missing test cases to reach 85%+ coverage
3. Create comprehensive test documentation
4. Add performance regression tests
5. **Validate all test scenarios**

## Technical Specifications

### Test Configuration
- **Framework**: Vitest (following existing patterns)
- **Timeout**: 30s for integration tests, 10s for unit tests
- **Coverage target**: 85% lines, 80% functions, 75% branches
- **Test environment**: Node.js with mock SPARQL endpoints
- **Test data**: Fixtures and generated mock data

### Test Execution
```bash
# Run all search tests
npm test -- --grep "Search"

# Run unit tests only
npm run test:unit tests/unit/examples/document/
npm run test:unit tests/unit/ragno/search/

# Run integration tests
npm run test:integration tests/integration/ragno/search/

# Coverage for search components
npm run test:coverage -- --include="**/search/**" --include="**/Search.*"
```

### Mock Strategy
- **Lightweight mocks**: Fast, predictable test execution
- **Realistic data**: Representative test scenarios
- **Error simulation**: Test error handling paths
- **Performance mocks**: Controllable timing for performance tests

## Search Input/Output Formats

### Search Input Formats
- **String Query**: `"What is machine learning?"`
- **URI Query**: `"http://example.org/question/ml-basics"`
- **Options**: `{ mode: 'dual', limit: 10, threshold: 0.7 }`

### Search Result Format
```javascript
{
  query: "original query",
  results: [
    {
      uri: "http://example.org/node/1",
      type: "ragno:Entity",
      score: 0.85,
      relevance: "high",
      content: "content summary",
      context: "relationship context",
      source: ["exact", "vector", "traversal"]
    }
  ],
  metadata: {
    totalResults: 15,
    searchTime: 245,
    methods: ["dual"],
    filters: ["document-type", "relevance"]
  }
}
```

### CLI Interface
```bash
# String query
node examples/document/Search.js "What is machine learning?"

# URI query  
node examples/document/Search.js "http://example.org/question/ml-basics"

# With options
node examples/document/Search.js "beer brewing" --limit 5 --mode similarity --threshold 0.8
```

## Expected Outcomes

1. **Unified Search System**: Single interface for all document/question search needs
2. **Improved RAG Integration**: Better coordination between search and RAG components
3. **Enhanced Relevance**: Document-specific ranking and filtering
4. **Flexible Query Support**: Handle both natural language and URI-based queries
5. **Maintainable Architecture**: Clean separation of concerns with reusable modules
6. **Comprehensive Test Coverage**: 85%+ test coverage with reliable test suite
7. **Performance Validation**: Benchmarks and regression tests for search performance

## Files to Create/Modify

### New Implementation Files
- `examples/document/Search.js` (main implementation)
- `examples/document/SEARCH-PLAN.md` (this plan document)
- `src/ragno/search/SearchFilters.js` (relevance filtering)
- `sparql/queries/search/document-search-by-uri.sparql`
- `sparql/queries/search/question-entity-mapping.sparql`
- `sparql/queries/search/document-relevance-ranking.sparql`

### New Test Files
- `tests/unit/examples/document/Search.test.js`
- `tests/unit/ragno/search/SearchFilters.test.js`
- `tests/integration/ragno/search/SearchSystem.test.js`
- `tests/integration/examples/document/DocumentSearch.test.js`
- `tests/__mocks__/ragno/search/MockRagnoSearch.js`
- `tests/__mocks__/examples/document/MockDocumentData.js`
- `tests/helpers/search/SearchTestHelper.js`
- `tests/helpers/document/DocumentTestHelper.js`
- `tests/fixtures/search/sample-queries.json`
- `tests/fixtures/search/expected-results.json`

### Modified Files
- `src/ragno/search/DualSearch.js` (document-specific enhancements)
- `src/ragno/search/index.js` (new configuration options)
- `examples/document/RAG.js` (integration with unified search)
- `tests/unit/ragno/search/DualSearch.test.js` (enhanced tests)

### Test Coverage Goals
- **Search.js**: 90% coverage (comprehensive CLI and core logic testing)
- **SearchFilters.js**: 95% coverage (all filtering logic paths)
- **Enhanced DualSearch.js**: 85% coverage (new functionality testing)
- **Integration tests**: Full workflow coverage
- **Performance tests**: Search speed and memory usage validation

## Progress Tracking

This plan document serves as both specification and progress tracker. Implementation progress will be tracked through:

1. **Todo List Management**: Task completion tracking
2. **Test Coverage Reports**: Quantitative progress measurement
3. **Performance Benchmarks**: Quality assurance metrics
4. **Integration Validation**: System-wide compatibility verification

The implementation follows the existing semem project patterns and maintains high quality standards with comprehensive testing coverage.