We need to refactor embedding and vector operations and remove duplicate code and place it appropriately. Think deeply and create a plan to do this.

There is massive overlap. All embedding validation and vector math should be consolidated into a single new module`src/core/Vectors.js` and current versions removed.
The following files contain related functionality, there may be others :

### `src/Utils.js`
- `vectorOps.normalize(vector)`
- `vectorOps.cosineSimilarity(vec1, vec2)`

### `src/handlers/EmbeddingHandler.js`
- `EmbeddingHandler.standardizeEmbedding(embedding)`
- `EmbeddingHandler.validateEmbedding(embedding)`
- `EmbeddingHandler.generateFallbackEmbedding(text, strategy)`
- `EmbeddingHandler.generateHashEmbedding(text)`

- `Store.js`, `Vectors.js`, and `Search.js` all implement embedding/vector validation and similarity logic:
	- `Store.js`: `validateEmbedding(embedding)`
	- `Vectors.js`: `validateEmbedding(embedding)`, `isValidEmbedding(embedding)`, `adjustEmbeddingLength(embedding, targetLength)`, `calculateCosineSimilarity(vecA, vecB)`
	- `Search.js`: `validateQueryEmbedding(embedding)`, uses `vectors.calculateCosineSimilarity()`

---

Functionality related to embeddings is distributed throughout the code with a lot of duplication. This all needs to be consolidated into src/core/Embeddings.js for operations directly on the embeddings, EmbeddingsAPIBridge.js for code which calls external services. SPARQL storage of embeddings will be dealt with later.
There must be no hardcoded variables (such as thresholds), these should be loaded from preferences.js following existing patterns. There must be no hardcoded URLs, they should come from config.json via Config.js . API keys will be loaded following existing patterns using dotenv.  
You need to search the codebase for places in which embeddings play a role. I've found two already : EmbeddingHandler.js EmbeddingService.js 
After consolidating the functionality the redundant files and methods should be removed.
Think deeply on how best to do this safely, following best practices. Save the plan in docs/EMBEDDINGS-PLAN.md
---

/clear first

LOGGING

mcp/tools/VerbsLogger.js

### `src/Utils.js`
- `logger.info`, `logger.error`, `logger.debug`, `logger.warn`

### `examples/mcp/ZPTBasicNavigation.js`
- `logBanner`, `logStep`, `logConcept`, `logSuccess`, `logWarning`, `logError`, `logPerformance`

**Observation:**
- Both provide logging, but with different levels of sophistication and output formatting.
- Consider whether a unified logging interface could be used across modules.

---

## 3. Client/Handler Classes for External Services

### `src/handlers/EmbeddingHandler.js`
- `EmbeddingHandler` (handles embedding generation, validation, caching, fallback)

### `examples/mcp/HTTPClient.js`
- `SememHTTPMCPClient` (handles connection, tool invocation, health checks)

### `examples/mcp/ZPTBasicNavigation.js`
- `ZPTBasicNavigationDemo` (handles client connection, navigation, validation, performance)

**Observation:**
- Multiple classes manage connections to external services, handle retries, and provide error handling.
- There may be opportunities to abstract common connection/retry/error logic.

---

## 4. Error Handling Patterns

### `src/handlers/EmbeddingHandler.js`
- Custom `EmbeddingError` class

### `examples/mcp/HTTPClient.js` and `ZPTBasicNavigation.js`
- Use of try/catch, custom error messages, and logging

**Observation:**
- Consider whether custom error types and error handling logic could be standardized.

---

## 5. Tool Invocation Patterns

### `examples/mcp/HTTPClient.js`
- `callTool(name, args)`

### `examples/mcp/ZPTBasicNavigation.js`
- `client.callTool({ name, arguments })`

**Observation:**
- Both clients invoke tools by name with arguments, possibly duplicating logic for tool invocation and result parsing.
- Consider abstracting tool invocation into a shared utility or base class.

---

## 6. Store, Search, Graph, and Vector Modules (src/stores/modules)

### Files reviewed:
- `src/stores/modules/Store.js`
- `src/stores/modules/Search.js`
- `src/stores/modules/SPARQLExecute.js`
- `src/stores/modules/SPARQLCache.js`
- `src/stores/modules/Graph.js`
- `src/stores/modules/Vectors.js`
- `src/stores/modules/ZPT.js`




#### b. SPARQL Query/Update Execution
- `SPARQLExecute.js` provides low-level query/update/transaction logic.
- `Store.js`, `Search.js`, `Graph.js`, and `ZPT.js` all depend on a `sparqlExecute` instance for their persistence/query needs.
- There is a clear separation of concerns, but some error handling and connection verification logic is repeated in each module. Consider abstracting common error handling and connection checks.

#### c. Caching and Memory Management
- `SPARQLCache.js` manages in-memory and query result caching for SPARQL data.
- `Store.js` and `Search.js` sometimes duplicate logic for memory/embedding management that could be centralized in the cache module.

#### d. Filter Clause Construction
- Both `Search.js` and `ZPT.js` have methods for building SPARQL filter clauses from filter objects (e.g., `buildFilterClauses`).
- The logic for constructing domain, keyword, entity, temporal, and geographic filters is very similar. This could be refactored into a shared utility function.

#### e. Logging
- All modules use a unified logger, but some have custom debug/info messages for similar operations (e.g., cache updates, SPARQL query execution, vector validation).
- Consider standardizing log message formats for similar operations across modules.

#### f. Resource Disposal
- Most modules implement a `dispose()` method for cleanup, but the logic is often similar (clearing timers, caches, or in-memory structures).
- This could be abstracted into a base class or shared utility.

#### g. Graph Operations
- `Graph.js` (GraphModule) and `Store.js` both deal with graph-related data (nodes, edges, relationships), but at different abstraction levels.
- Ensure that graph traversal, statistics, and persistence logic are not duplicated between modules.

### Summary Table

| Concern/Functionality         | Store.js | Search.js | Vectors.js | SPARQLCache.js | Graph.js | ZPT.js |
|------------------------------|----------|-----------|------------|---------------|----------|--------|
| Embedding Validation         |   ✓      |    ✓      |     ✓      |               |          |        |
| Vector Similarity            |          |    ✓      |     ✓      |               |          |        |
| SPARQL Query/Update          |   ✓      |    ✓      |            |               |    ✓     |   ✓    |
| Caching                      |          |           |            |      ✓        |          |        |
| Filter Clause Construction   |          |    ✓      |            |               |          |   ✓    |
| Logging                      |   ✓      |    ✓      |     ✓      |      ✓        |    ✓     |   ✓    |
| Resource Disposal            |   ✓      |    ✓      |     ✓      |      ✓        |    ✓     |   ✓    |
| Graph Operations             |   ✓      |           |            |               |    ✓     |        |

**Recommendation:**
- Refactor embedding/vector logic into a single utility or service.
- Centralize filter clause construction.
- Standardize logging and disposal patterns.
- Review for further opportunities to reduce duplication in graph and SPARQL handling.
# Potentially Redundant Code: Initial Survey

This document lists methods, classes, and modules in the `src` and `mcp` directories that appear to have similar signatures or overlapping functionality. This is an initial survey to help identify code that may be redundant or could be refactored for reuse.

---


## 7. Service Layer (src/services) Redundancy and Overlap

### Files reviewed:
- `src/services/SearchService.js`
- `src/services/sparql/QueryCache.js`
- `src/services/sparql/SPARQLQueryService.js`
- `src/services/embeddings/EmbeddingService.js`
- `src/services/vsom/VSOMService.js`

### Observations:

#### a. Embedding Validation and Standardization
- `EmbeddingService.js` and `VSOMService.js` both validate and standardize embedding vectors (length, type, numeric checks).
- `EmbeddingService.js` has `validateEmbedding` and `standardizeEmbedding` methods, similar to those in `Vectors.js`, `Store.js`, and `EmbeddingHandler.js`.
- `VSOMService.js` checks entity embedding validity before loading/training.
- **Recommendation:** Centralize embedding validation/standardization logic to avoid drift and duplication.

#### b. Search and Similarity
- `SearchService.js` provides unified search across SPARQL and FAISS, combining and ranking results by similarity.
- Similarity calculation and thresholding logic is present in `SearchService.js`, `Vectors.js`, and `Search.js`.
- **Recommendation:** Use a single utility for similarity calculations and result ranking.

#### c. Caching
- `QueryCache.js` and `SPARQLCache.js` both implement in-memory/file-based caching with TTL, LRU, and file modification checks.
- Both have methods for cache eviction, stats, and cleanup.
- **Recommendation:** Consider merging or abstracting cache logic for reuse across services and modules.

#### d. SPARQL Query/Template Handling
- `SPARQLQueryService.js` loads, caches, and parameterizes SPARQL queries/templates, similar to template loading in `Store.js` and `Graph.js`.
- **Recommendation:** Unify query/template management and parameterization.

#### e. Logging and Resource Disposal
- All services use a logger and implement cleanup/disposal methods, similar to modules in `src/stores/modules`.
- **Recommendation:** Standardize logging and disposal patterns across all layers.

#### f. Embedding/Entity Management in VSOM
- `VSOMService.js` manages multiple VSOM instances, each with entity/embedding validation, training, and clustering.
- Embedding checks and error messages are similar to those in other modules.
- **Recommendation:** Ensure embedding/entity validation is consistent and not duplicated.

### Summary Table (Services vs. Modules)

| Concern/Functionality         | SearchService | EmbeddingService | VSOMService | QueryCache | SPARQLQueryService |
|------------------------------|---------------|------------------|-------------|------------|--------------------|
| Embedding Validation         |               |        ✓         |      ✓      |            |                    |
| Embedding Standardization    |               |        ✓         |      ✓      |            |                    |
| Vector Similarity            |      ✓        |                  |             |            |                    |
| Search/Ranking               |      ✓        |                  |             |            |                    |
| Caching                      |               |                  |             |     ✓      |                    |
| Query/Template Handling      |               |                  |             |            |         ✓          |
| Logging                      |      ✓        |        ✓         |      ✓      |            |                    |
| Resource Disposal            |               |                  |      ✓      |     ✓      |         ✓          |

**Overall Recommendation:**
- Refactor embedding, similarity, and cache logic into shared utilities/services.
- Unify query/template management and logging patterns.
- Review for further opportunities to reduce duplication in embedding/entity handling and service/module boundaries.
---

## 8. MCP Tools Layer (mcp/tools) Redundancy and Overlap

### Files reviewed:
- `mcp/tools/zpt-tools.js`
- `mcp/tools/sparql-tools.js`
- `mcp/tools/SimpleVerbsService.js`
- `mcp/tools/ZptStateManager.js`
- `mcp/tools/VerbSchemas.js`

### Observations:

#### a. Navigation, State, and Parameter Handling
- `zpt-tools.js` and `ZptStateManager.js` both implement navigation state, parameter normalization/validation, and session management for ZPT (Zoom-Pan-Tilt) navigation.
- Both define schemas for navigation parameters, zoom/pan/tilt, and filter construction.
- `SimpleVerbsService.js` also manages navigation state, but wraps and delegates to these modules, sometimes duplicating state/parameter logic.
- **Recommendation:** Centralize ZPT state and parameter validation/normalization in a single module, and ensure all navigation tools/services use it.

#### b. SPARQL Query, Similarity, and Corpus Validation
- `sparql-tools.js` exposes advanced SPARQL operations (query, construct, navigation, similarity search, validation, bulk ops, graph management).
- Similar SPARQL query/corpus validation logic appears in `zpt-tools.js` (for navigation/corpus analysis) and in service layers (`src/services/sparql`).
- Embedding validation and similarity search logic is present in both `sparql-tools.js` and ZPT navigation (and in lower-level modules).
- **Recommendation:** Unify SPARQL query execution, corpus validation, and similarity search logic into shared utilities/services.

#### c. Embedding, Concept, and Chunk Management
- `SimpleVerbsService.js` implements embedding generation, concept extraction, and document chunking, but relies on `SafeOperations` and other shared utilities.
- Embedding/concept logic is also present in ZPT navigation and SPARQL tools, and in `src/services/embeddings` and `src/stores/modules/Vectors.js`.
- **Recommendation:** Refactor embedding/concept/chunk logic into a single utility or service, and ensure all tools/services use it.

#### d. Logging and Performance
- All tools use custom loggers (`verbsLogger`, `logOperation`, `mcpDebugger`) with similar info/debug/error patterns.
- Performance timing and analytics are implemented in both `SimpleVerbsService.js` and ZPT navigation, with similar phase tracking and reporting.
- **Recommendation:** Standardize logging and performance analytics across all tools/services.

#### e. Schema and Input Validation
- `VerbSchemas.js` and ZPT/ SPARQL tools all define zod schemas for input validation, with overlapping fields (zoom, pan, tilt, filters, etc).
- There is some duplication in how schemas are defined and validated for similar operations.
- **Recommendation:** Consolidate schema definitions for common operations (navigation, memory, augmentation) to avoid drift.

### Summary Table (MCP Tools Layer)

| Concern/Functionality         | zpt-tools.js | sparql-tools.js | SimpleVerbsService.js | ZptStateManager.js | VerbSchemas.js |
|------------------------------|--------------|-----------------|----------------------|--------------------|---------------|
| ZPT Navigation/State         |      ✓       |                 |          ✓           |         ✓          |               |
| Parameter Validation         |      ✓       |        ✓        |          ✓           |         ✓          |       ✓       |
| SPARQL Query/Validation      |      ✓       |        ✓        |                      |                    |               |
| Embedding/Concept Ops        |      ✓       |        ✓        |          ✓           |                    |               |
| Logging/Performance          |      ✓       |        ✓        |          ✓           |         ✓          |               |
| Schema/Input Validation      |      ✓       |        ✓        |          ✓           |                    |       ✓       |
| Chunking/Document Ops        |              |                 |          ✓           |                    |               |

**Overall Recommendation:**
- Refactor ZPT navigation state, parameter validation, and schema definitions into shared modules.
- Unify SPARQL query, similarity, and corpus validation logic.
- Centralize embedding/concept/chunk logic for reuse.
- Standardize logging and performance analytics.
- Review for further opportunities to reduce duplication in schema/input validation and navigation state management.

---
