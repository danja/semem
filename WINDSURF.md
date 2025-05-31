# Semem Project - Development Notes

## Overview
This document contains notes on the current state of the Semem project, including working strategies, known issues, and areas that need attention.

## Working Strategies

### In-Memory Storage
- The `InMemoryStore` class is working correctly after implementing all required methods from `BaseStore`.
- It's a good fallback when SPARQL storage is not available.
- All core functionality (save, load, transactions) works as expected.

### Configuration Loading
- The `Config` class successfully loads and merges configurations from defaults and files.
- Environment variables are properly supported.
- Configuration validation is in place for required sections.

### Concept Extraction with LLM
- Basic Ollama integration for concept extraction is functional.
- The system can extract concepts from text using the configured LLM.

## Known Issues

### SPARQL Storage
- **Critical**: SPARQLStore is failing with "No endpoint for request" errors.
  - Direct curl requests to the SPARQL endpoint work, but the application fails with the same request.
  - The issue persists even with hardcoded URLs that work in curl.
  - The SPARQL server (Fuseki) is accessible but rejecting requests from the application.
  - Possible causes:
    - Different request headers between curl and fetch
    - CORS or other server-side restrictions
    - Authentication/authorization issues

### Reminder
- Keep this file updated with any new findings or changes to the codebase.
- Document any workarounds or solutions found during development.
- Note any configuration changes that affect the application's behavior.

### Error Handling
- Some error messages could be more descriptive.
- Missing retry logic for transient failures.
- Inconsistent error handling across different storage backends.

### Documentation
- Limited documentation on setting up and configuring the SPARQL backend.
- Missing examples for different deployment scenarios.
- API documentation could be more comprehensive.

## Areas Needing Attention

### 1. SPARQL Integration
- Fix URL construction in SPARQLStore.
- Add validation for SPARQL endpoint URLs.
- Implement proper error handling for connection issues.
- Add documentation on setting up and configuring Fuseki.

### 2. Testing
- Add more unit tests for SPARQL operations.
- Implement integration tests with a test SPARQL server.
- Add test coverage for error conditions.

### 3. Documentation
- Document the storage architecture and how to implement custom storage backends.
- Add examples for different deployment scenarios.
- Document the SPARQL schema and data model.

### 4. Error Handling
- Standardize error handling across the codebase.
- Add retry logic for transient failures.
- Improve error messages for better debugging.

## Recommendations

### Short-term
1. Fix the SPARQL URL parsing issue.
2. Add a health check for the SPARQL server.
3. Improve error messages for better debugging.

### Medium-term
1. Add more comprehensive tests.
2. Implement proper transaction support.
3. Add documentation for all public APIs.

### Long-term
1. Support for more storage backends (e.g., PostgreSQL, MongoDB).
2. Add support for more LLM providers.
3. Implement a plugin system for easy extensibility.

## Notes
- The in-memory store is reliable for testing and development.
- The SPARQL backend needs more work before it can be used in production.
- The codebase is well-structured but could benefit from more documentation and tests.
