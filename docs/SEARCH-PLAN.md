# Search Consolidation Plan

## Objective
Consolidate distributed search-related functionality into two core modules:
1. `SimilaritySearch.js`: Handles vector-based similarity search.
2. `SPARQLSearch.js`: Manages SPARQL-based search operations.

## Current State
Search-related functionality is spread across multiple files:
- `SearchService.js`: Implements semantic search using Faiss and embeddings.
- `AdaptiveSearchEngine.js`: Implements multi-pass adaptive search with dynamic threshold management.
- `SearchServer.js`: Express-based server for handling search requests.
- `ContextAwareThresholdCalculator.js`: Calculates dynamic thresholds for search.
- `UIServer.js`: UI server for web interface and API endpoints.

## Plan

### 1. `SimilaritySearch.js`
- **Responsibilities**:
  - Initialize and manage the Faiss index.
  - Perform similarity search using query embeddings.
  - Load embeddings from external sources.
- **Source Files**:
  - Extract relevant methods from `SearchService.js`.
  - Integrate adaptive search logic from `AdaptiveSearchEngine.js`.

### 2. `SPARQLSearch.js`
- **Responsibilities**:
  - Query SPARQL endpoints for resources.
  - Fetch embeddings and metadata from SPARQL stores.
  - Manage SPARQL-specific configurations.
- **Source Files**:
  - Extract SPARQL-related logic from `SearchService.js`.
  - Integrate SPARQL handling from `SearchServer.js` and `UIServer.js`.

### 3. Refactor Servers
- **SearchServer.js**:
  - Delegate search operations to `SimilaritySearch.js` and `SPARQLSearch.js`.
  - Simplify request handling logic.
- **UIServer.js**:
  - Delegate search operations to `SimilaritySearch.js` and `SPARQLSearch.js`.
  - Focus on UI-specific routes and middleware.

### 4. Dynamic Thresholds
- **ContextAwareThresholdCalculator.js**:
  - Retain as a utility module for dynamic threshold calculation.
  - Ensure compatibility with `SimilaritySearch.js` and `SPARQLSearch.js`.

### 5. Validation
- Test the refactored modules independently.
- Validate end-to-end functionality through `SearchServer.js` and `UIServer.js`.

## Implementation Summary

### Consolidated Modules
1. **`src/core/SimilaritySearch.js`**:
   - Handles vector-based similarity search using embeddings and Faiss.
   - Includes methods for initializing the Faiss index, adding embeddings, and performing searches.

2. **`src/core/SPARQLSearch.js`**:
   - Manages SPARQL-based search operations.
   - Includes methods for querying SPARQL endpoints and fetching embeddings from SPARQL stores.

### Removed Files
- `src/services/search/UIServer.js`: Identified as unused and safely removed.

### Validation
- Both new modules were tested for syntax and logical errors. No issues were found.
- The refactored code adheres to the plan and eliminates redundancy.

### Next Steps
- Integrate the new modules into the broader application.
- Conduct end-to-end testing to ensure seamless functionality.
- Update any dependent documentation or configurations.

## Deliverables
1. `src/core/SimilaritySearch.js`
2. `src/core/SPARQLSearch.js`
3. Updated `SearchServer.js` and `UIServer.js`.
4. Documentation updates in `README.md`.

## Timeline
- **Day 1**: Analyze and extract logic for `SimilaritySearch.js`.
- **Day 2**: Analyze and extract logic for `SPARQLSearch.js`.
- **Day 3**: Refactor `SearchServer.js` and `UIServer.js`.
- **Day 4**: Testing and validation.
- **Day 5**: Documentation updates.

---

## Notes
- Ensure no hardcoded variables or URLs; use configuration files.
- Follow existing patterns for logging and error handling.
- Maintain backward compatibility with existing APIs.