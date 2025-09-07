# RDF Concept Integration Tests

This document describes the comprehensive test suite for validating the new RDF concept integration functionality in Semem. The concept integration system enables extraction, storage, and navigation of concepts as first-class RDF entities using the ragno vocabulary.

## Overview

The concept integration adds the following key capabilities to Semem:

1. **Concept Tilt**: A new ZPT navigation perspective that extracts and presents conceptual information
2. **Concept Filtering**: Advanced filtering strategies based on concept categories, similarity, and relationships  
3. **RDF Concept Storage**: Native storage of concepts as `ragno:Concept` entities with proper RDF structure
4. **Concept-Enhanced Search**: Search boosting and filtering based on conceptual relevance

## Test Architecture

The test suite is organized into multiple layers to ensure comprehensive coverage:

```
tests/
├── integration/zpt/
│   └── concept-integration-mcp.test.js     # MCP endpoint tests
├── ui/e2e/
│   └── concept-navigation-workbench.e2e.js # Workbench UI tests
├── unit/zpt/
│   ├── concept-tilt-projector.test.js      # Concept tilt functionality
│   └── concept-filtering-search.test.js    # Filtering and search
└── unit/stores/
    └── rdf-concept-storage.test.js         # RDF storage and retrieval
```

## Test Categories

### 1. Unit Tests

#### Concept Tilt Projector (`tests/unit/zpt/concept-tilt-projector.test.js`)

Tests the core concept extraction and projection functionality:

- ✅ **Concept Tilt Availability**: Validates 'concept' as a valid tilt type across all zoom levels
- ✅ **Concept Extraction**: Tests LLM-based concept extraction from text content
- ✅ **Relationship Extraction**: Tests extraction of conceptual relationships with ragno vocabulary
- ✅ **RDF Concept Storage**: Tests proper storage of concepts as ragno:Concept entities
- ✅ **Concept Projection Output**: Tests ZPT-compatible formatting and metadata
- ✅ **Integration with ZPT Pipeline**: Tests compatibility with existing tilt infrastructure
- ✅ **Error Handling**: Tests graceful handling of failures and edge cases

**Key Features Tested:**
- Concept extraction from philosophical, scientific, and psychological content
- Proper RDF URI generation and validation
- Concept categorization and confidence scoring
- Integration with existing ZPT navigation patterns

#### Concept Filtering and Search (`tests/unit/zpt/concept-filtering-search.test.js`)

Tests concept-based filtering strategies and search integration:

- ✅ **Filter Strategy Implementation**: Tests direct, categorical, similarity, and relational filtering
- ✅ **Selectivity Estimation**: Tests performance estimation for different filter strategies  
- ✅ **Integration with FilterBuilder**: Tests SPARQL query generation for concept filters
- ✅ **Search Integration**: Tests concept-enhanced similarity search and query expansion
- ✅ **Concept Corpuscle Extraction**: Tests concept extraction from corpuscle content
- ✅ **Performance Optimization**: Tests handling of large concept sets and query optimization

**Key Features Tested:**
- Four distinct concept filtering strategies
- SPARQL query template loading and building
- Concept-boosted search result ranking
- Query expansion with conceptually related terms

#### RDF Concept Storage (`tests/unit/stores/rdf-concept-storage.test.js`)

Tests RDF-native concept storage and retrieval in SPARQLStore:

- ✅ **Concept Storage as RDF Entities**: Tests storage with proper ragno:Concept structure
- ✅ **Concept Relationship Storage**: Tests relationship storage with ragno vocabulary predicates
- ✅ **Concept Retrieval and Querying**: Tests various query strategies for concept retrieval
- ✅ **Integration with Existing Data**: Tests linking concepts to entities and interactions
- ✅ **Performance and Optimization**: Tests batched operations and query optimization
- ✅ **Error Handling and Data Integrity**: Tests validation and referential integrity

**Key Features Tested:**
- Proper RDF structure with SKOS, Dublin Core, and ragno vocabularies
- Concept metadata, provenance, and multilingual support
- Hierarchical concept queries and path finding
- Concept analytics and statistics generation

### 2. Integration Tests

#### Concept Integration MCP (`tests/integration/zpt/concept-integration-mcp.test.js`)

Tests concept functionality through MCP endpoints:

- ✅ **Concept Tilt Functionality**: Tests concept tilt through `/zpt/navigate` endpoint
- ✅ **Concept-Based Pan Filtering**: Tests concept filters in navigation requests
- ✅ **RDF Concept Storage and Retrieval**: Tests end-to-end concept pipeline
- ✅ **Combined Concept Integration Features**: Tests complex multi-parameter scenarios
- ✅ **Error Handling and Edge Cases**: Tests system resilience and performance

**Key Features Tested:**
- Full MCP request/response cycle for concept operations
- Integration between Tell → Concept Extraction → Storage → Retrieval
- Performance benchmarks for concept-heavy operations
- Error recovery and graceful degradation

### 3. End-to-End Tests

#### Concept Navigation Workbench (`tests/ui/e2e/concept-navigation-workbench.e2e.js`)

Tests concept navigation through the workbench UI using Playwright:

- ✅ **Concept Tilt Functionality**: Tests UI activation and results display
- ✅ **Concept-Based Filtering**: Tests filter UI and result refinement
- ✅ **Concept Navigation User Experience**: Tests loading indicators and state persistence
- ✅ **Performance and Error Handling**: Tests UI responsiveness and error states

**Key Features Tested:**
- Workbench concept tilt activation and configuration
- Visual feedback during concept extraction and processing
- Concept filter UI components and interactions
- User experience during concept-heavy operations

## Running the Tests

### Quick Start

```bash
# Run all concept integration tests
npm run test:concept-integration

# Run only unit tests
npm run test:concept-integration:unit

# Run only MCP integration tests  
npm run test:concept-integration:mcp

# Run only E2E tests
npm run test:concept-integration:e2e
```

### Individual Test Suites

```bash
# Unit tests
npx vitest run tests/unit/zpt/concept-tilt-projector.test.js
npx vitest run tests/unit/zpt/concept-filtering-search.test.js
npx vitest run tests/unit/stores/rdf-concept-storage.test.js

# Integration tests (requires MCP server)
npx vitest run tests/integration/zpt/concept-integration-mcp.test.js

# E2E tests (requires workbench and MCP server)
npx playwright test tests/ui/e2e/concept-navigation-workbench.e2e.js
```

### Prerequisites

**For Unit Tests:**
- Node.js 20.11.0+
- Vitest test framework
- Mock dependencies (automatically configured)

**For Integration Tests:**
- Running MCP server on port 4101 (or configured port)
- SPARQL endpoint available
- LLM service configured for concept extraction

**For E2E Tests:**
- Running workbench server on port 4102 (or configured port)
- Running MCP server on port 4101 (or configured port)
- Playwright browsers installed (`npm run test:e2e:install`)

## Test Data and Scenarios

### Concept-Rich Test Content

The tests use carefully crafted content designed to generate extractable concepts:

**Philosophy**: Phenomenology, consciousness, intentionality, Husserl, epoché
**Physics**: Quantum entanglement, Bell's theorem, locality, realism  
**Psychology**: Metacognition, self-regulation, executive control, cognitive monitoring
**Economics**: Behavioral economics, cognitive biases, bounded rationality, heuristics
**Technology**: Distributed systems, consensus algorithms, Byzantine fault tolerance

### Test Scenarios

1. **Single-Domain Concept Extraction**: Tests focused concept extraction within specific domains
2. **Cross-Domain Concept Integration**: Tests concept relationships across disciplines  
3. **Hierarchical Concept Navigation**: Tests concept category traversal and zoom transitions
4. **Performance Under Load**: Tests system behavior with large concept sets
5. **Error Recovery**: Tests graceful handling of extraction failures and malformed data

## Implementation Details

### RDF Vocabulary Usage

The concept integration uses multiple RDF vocabularies:

- **ragno**: Core concept vocabulary (`http://purl.org/stuff/ragno/`)
  - `ragno:Concept` - Primary concept class
  - `ragno:hasConceptualRelation` - Concept relationships
  - `ragno:hasCategory`, `ragno:hasConfidence` - Metadata properties

- **SKOS**: Concept organization (`http://www.w3.org/2004/02/skos/core#`)  
  - `skos:prefLabel`, `skos:altLabel` - Labeling
  - `skos:definition` - Concept definitions
  - `skos:broader`, `skos:narrower` - Hierarchical relationships

- **Dublin Core**: Metadata (`http://purl.org/dc/terms/`)
  - `dct:created`, `dct:creator` - Provenance
  - `dct:subject` - Subject classification

### SPARQL Query Patterns

Key SPARQL patterns used in testing:

```sparql
# Basic concept retrieval
SELECT ?concept ?label ?definition WHERE {
  ?concept a ragno:Concept ;
           rdfs:label ?label ;
           skos:definition ?definition .
}

# Concept relationship traversal  
SELECT ?subject ?predicate ?object WHERE {
  ?subject ?predicate ?object .
  ?subject a ragno:Concept .
  ?object a ragno:Concept .
  ?predicate a ragno:ConceptualRelation .
}

# Hierarchical concept queries
SELECT ?concept ?category WHERE {
  ?concept a ragno:Concept ;
           ragno:hasCategory/skos:broader* ?category .
}
```

## Integration Points

### ZPT Navigation System

- **Tilt Registration**: Concept tilt registers as 'concept' tilt type
- **Zoom Compatibility**: Works across entity, text, community, and unit zoom levels
- **Filter Integration**: Extends pan filtering with concept-specific strategies
- **Result Format**: Produces ZPT-compatible result structures with concept metadata

### Memory Management System

- **Tell Integration**: Concept extraction triggered during content storage
- **Search Enhancement**: Concept matching boosts search result relevance
- **Context Management**: Concepts included in context window selection
- **Caching Strategy**: Extracted concepts cached to avoid redundant processing

### API Layer

- **MCP Protocol**: Concept operations exposed through MCP endpoints
- **HTTP API**: RESTful endpoints for concept management
- **WebSocket**: Real-time concept extraction progress updates
- **GraphQL**: Rich querying capabilities for concept relationships

## Performance Benchmarks

Expected performance characteristics:

- **Concept Extraction**: < 5 seconds per document (LLM-dependent)
- **Concept Storage**: < 100ms for 10 concepts with relationships  
- **Concept Retrieval**: < 50ms for filtered concept queries
- **UI Response**: < 200ms for concept tilt activation
- **Memory Usage**: < 50MB additional for concept processing

## Troubleshooting

### Common Issues

1. **LLM Service Unavailable**
   - Check LLM provider configuration in `config.json`
   - Verify API keys and endpoint availability
   - Check network connectivity and rate limits

2. **SPARQL Endpoint Issues**
   - Verify SPARQL endpoint URL and credentials
   - Check if endpoint supports required vocabularies
   - Validate graph permissions and access rights

3. **Test Server Startup**
   - Ensure ports 4101 (MCP) and 4102 (workbench) are available
   - Check for conflicting processes or services
   - Verify all dependencies are installed

4. **Playwright Browser Issues**
   - Run `npm run test:e2e:install` to install browsers
   - Check for system compatibility and dependencies
   - Verify display/headless configuration

### Debug Commands

```bash
# Verbose test output
npm run test:concept-integration -- --verbose

# Run single test file with debugging
npx vitest run tests/unit/zpt/concept-tilt-projector.test.js --reporter=verbose

# Playwright debug mode
npx playwright test tests/ui/e2e/concept-navigation-workbench.e2e.js --debug

# Check system dependencies
node scripts/test-concept-integration.js --check-deps
```

## Contributing

When adding new concept-related functionality:

1. **Add Unit Tests**: Create focused unit tests for new components
2. **Update Integration Tests**: Add MCP endpoint tests for new APIs
3. **Add E2E Tests**: Include workbench UI tests for user-facing features
4. **Update Test Data**: Add appropriate test concepts and scenarios
5. **Document Patterns**: Update this README with new test patterns

### Test Naming Conventions

- Unit tests: `*.test.js`
- Integration tests: `*-integration.test.js` 
- E2E tests: `*.e2e.js`
- Test groups: `describe('Feature Name Tests', () => {})`
- Test cases: `it('should perform specific behavior', async () => {})`

## Related Documentation

- [ZPT Manual](../docs/manual/zpt.md) - ZPT navigation system overview
- [Workbench How-to](../docs/manual/workbench-howto.md) - Workbench usage guide  
- [Enhancements Manual](../docs/manual/enhancements.md) - Enhancement systems including concepts
- [RDF Concept Implementation](../src/zpt/README.md) - Technical implementation details
- [SPARQL Queries](../sparql/queries/zpt/) - External SPARQL templates
- [LLM Prompts](../prompts/templates/zpt/) - Concept extraction prompts

---

*This test suite ensures the RDF concept integration functionality works correctly across all layers of the Semem system, from low-level RDF storage to high-level user interactions.*