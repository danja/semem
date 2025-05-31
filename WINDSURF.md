# Semem Project - Development Notes

## Overview
This document contains notes on the current state of the Semem project, including working strategies, known issues, and areas that need attention.

---

## Ollama/SPARQL Integration Status (2025-05-31)

- SPARQLStore and most query construction in the codebase include necessary RDF prefixes or expand prefixes to full URIs. No further prefix issues are anticipated unless encountered during runtime.
- OllamaConnector provides `generateChat` and `generateCompletion` methods, which are used for LLM interactions. Any legacy usage of `llm.chat` should be updated to these methods.
- RDF term usage and graph structure align with the documentation in `docs/ragno`.
- Next step: Run `node examples/OllamaExample.js` and debug any issues that arise, focusing on LLM/SPARQL integration and data flow.
- Continue documenting findings, errors, and fixes in this file for future reference.

---

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
- **Critical**: SPARQLStore is failing with SPARQL query errors.
  - Error: `Unresolved prefixed name: rdfs:label` in SPARQL update queries
  - This suggests that the RDF Schema (RDFS) prefix is not properly defined in the SPARQL queries
  - The query needs to include the proper RDFS namespace declaration
  - The error occurs in the `verify()` and `loadHistory()` methods of SPARQLStore

### Ollama Integration
- **Error**: `TypeError: llm.chat is not a function`
  - The Ollama connector doesn't have a `chat` method, but the code is trying to call it
  - This happens in the `extractConcepts` function in OllamaExample.js
  - Need to update the code to use the correct method from the OllamaConnector class

### Timeout Issues
- The script is timing out after 10 seconds (as expected with our test timeout)
- The timeout is likely due to the SPARQL query errors preventing proper initialization
- Once the SPARQL and Ollama issues are fixed, we should adjust the timeout to a more reasonable value (e.g., 30-60 seconds)

---

## SPARQL & Ollama Integration - 2025-05-31

### Findings
- **SPARQLStore.js**: Queries (notably in `verify()` and `loadHistory()`) are missing the `PREFIX rdfs:` declaration, causing errors like `Unresolved prefixed name: rdfs:label`.
- **OllamaConnector.js**: The Ollama connector does not have a `chat` method. The code should use the correct method provided by the Ollama client for chat/completion.

### Action Plan
1. **SPARQL Prefix Fix:**
   - Update `SPARQLStore.js` so all queries include `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`.
2. **Ollama Connector Fix:**
   - Determine the correct method for chat/completion in the Ollama client and update usage accordingly in `OllamaExample.js` and related code.
3. **Timeout Adjustment:**
   - After fixing the above, increase the script timeout for more robust testing.

---

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
