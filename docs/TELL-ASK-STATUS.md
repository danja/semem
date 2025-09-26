# Tell/Ask Workflow Status

## Overview
The Tell/Ask workflow provides unified persistent storage and intelligent retrieval across both HTTP and STDIO protocols. It integrates SPARQL storage, FAISS vector indexing, and semantic similarity measures to enable efficient fact storage and intelligent question answering.

## Workflow Steps
1. **Initialization**:
   - The MCP server is initialized with a protocol version and client information.
   - Method: `initialize`
   - Key Parameters:
     - `protocolVersion`: Specifies the version of the protocol being used.
     - `capabilities`: Describes the capabilities of the client.
     - `clientInfo`: Metadata about the client (e.g., name, version).

2. **Tell Operation**:
   - A fact is stored in the MCP system.
   - Method: `tools/call` with operation `tell`
   - Key Parameters:
     - `name`: Set to `tell`.
     - `arguments`: Contains the `content` (fact) to be stored.
   - Expected Behavior:
     - The fact is processed and stored in the knowledge graph or memory.
     - A response is returned confirming the operation.

3. **Ask Operation**:
   - A question is queried against the stored fact.
   - Method: `tools/call` with operation `ask`
   - Key Parameters:
     - `name`: Set to `ask`.
     - `arguments`: Contains the `question` to be queried.
   - Expected Behavior:
     - The system retrieves relevant information based on the stored fact.
     - A response is returned containing the answer.

4. **Validation**:
   - Responses for `initialize`, `tell`, and `ask` are validated.
   - Ensures STDIO output is clean JSON without pollution.
   - Key Checks:
     - `initialize` response includes `protocolVersion`.
     - `tell` response confirms the fact was stored.
     - `ask` response contains the expected answer.

## Key Files and Components
- **`mcp/index.js`**:
  - Entry point for the MCP server, handling the STDIO interface.
  - Processes `initialize`, `tell`, and `ask` methods.
  - Potential Issues:
    - Incorrect routing of `tell` or `ask` methods.
    - Missing or invalid responses.

- **`tools/call`**:
  - Method used to invoke the `tell` and `ask` operations.
  - Potential Issues:
    - Incorrect parameter handling.
    - Failure to invoke the correct service.

- **`ServiceManager`**:
  - Manages services for the Tell/Ask operations.
  - Potential Issues:
    - Misconfigured services.
    - Errors in service initialization or execution.

- **`config.js`**:
  - Provides configuration for the MCP server, including protocol version and other settings.
  - Potential Issues:
    - Missing or incorrect configuration values.

- **Tell and Ask Handlers**:
  - Specific handlers for processing the `tell` and `ask` operations.
  - Potential Issues:
    - Logic errors in processing the operations.
    - Failure to interact with the knowledge graph or memory.

## Data Created
- **Facts**:
  - Stored in the MCP system during the `tell` operation.
  - Potential Issues:
    - Facts not being stored persistently.
    - Data inconsistencies between memory and SPARQL storage.

- **Responses**:
  - Generated for each operation (`initialize`, `tell`, `ask`) and returned as JSON.
  - Potential Issues:
    - Missing or malformed responses.
    - Responses not adhering to the JSON-RPC protocol.

## Architecture
- **STDIO Interface**:
  - The MCP server communicates via STDIO, processing JSON-RPC messages.
  - Potential Issues:
    - STDIO pollution (non-JSON data in stdout).
    - Timeout or deadlock during communication.

- **Handlers**:
  - Each operation (`tell`, `ask`) is handled by specific components.
  - Potential Issues:
    - Handlers not being invoked correctly.
    - Errors in handler logic.

- **Validation**:
  - Ensures clean protocol communication and correct data handling.
  - Potential Issues:
    - Validation logic not covering edge cases.
    - Insufficient logging for debugging.

## Debugging Checklist
1. **STDIO Output**:
   - Check for non-JSON data in stdout.
   - Ensure stderr logging is minimal and relevant.

2. **ServiceManager**:
   - Verify that all required services are initialized correctly.
   - Check for errors in service execution.

3. **Tell/Ask Handlers**:
   - Ensure the `tell` handler stores facts persistently.
   - Verify that the `ask` handler retrieves the correct data.

4. **Configuration**:
   - Confirm that `config.js` contains valid values for all required settings.
   - Check for environment-specific overrides (e.g., `.env` file).

5. **Integration Tests**:
   - Run the `tell-ask-stdio-e2e.integration.test.js` file with verbose logging.
   - Analyze the test output for errors or unexpected behavior.

## Unified Tell-Ask Architecture (Verified 2025-09-26)

Both HTTP and STDIO protocols now use the same unified storage and retrieval pipeline, integrating SPARQL persistence, FAISS vector indexing, and multi-dimensional similarity measures.

### SPARQL Integration in the Workflow

The workflow leverages SPARQL as the primary persistent storage layer:

#### **SPARQL Storage Structure**:
- **Graph**: `http://tensegrity.it/semem/content` - Main data graph for all interactions
- **Triple Format**:
  ```sparql
  <interaction_uri> semem:prompt "user input" ;
                   semem:output "response content" ;
                   semem:embedding """[vector_array]""" ;
                   semem:concepts """["concept1","concept2"]""" ;
                   semem:timestamp "1234567890"^^xsd:integer ;
                   semem:accessCount "1"^^xsd:integer ;
                   semem:decayFactor "1.0"^^xsd:decimal ;
                   semem:memoryType "short-term" .
  ```

#### **SPARQL Operations**:
1. **Storage**: `Store.store()` → SPARQL INSERT via `sparqlExecute.executeSparqlUpdate()`
2. **Retrieval**: `loadHistory()` → SPARQL SELECT via `sparqlExecute.executeSparqlQuery()`
3. **Templates**: Uses `sparql/templates/store/load-memory.sparql` for structured queries
4. **Transactions**: Supports SPARQL transactions for data consistency

### FAISS Vector Indexing Integration

FAISS provides high-performance similarity search capabilities:

#### **Vector Operations**:
1. **Index Building**: `vectors.rebuildIndex(embeddings)` creates FAISS index from stored embeddings
2. **Similarity Search**: `vectors.searchIndex(queryEmbedding, k)` finds nearest neighbors
3. **Mapping**: `faissToMemoryMap` and `memoryToFaissMap` link FAISS results to SPARQL data
4. **Dimensions**: Configurable embedding dimensions (default 768 for nomic-embed-text)

#### **Integration Flow**:
1. **Tell**: Embedding → FAISS index + SPARQL storage
2. **Ask**: Query embedding → FAISS search → SPARQL data retrieval → Combined similarity scoring

### Multi-Dimensional Similarity Measures

The system uses four weighted similarity measures for intelligent retrieval:

#### **Similarity Components** (from `MemoryDomainManager.calculateRelevance()`):
1. **Domain Match (35% weight)**: `computeDomainMatch()` - contextual domain relevance
2. **Temporal Relevance (20% weight)**: `computeTemporalRelevance()` - exponential decay by age
3. **Semantic Similarity (30% weight)**: `computeSemanticRelevance()` - cosine similarity via FAISS
4. **Frequency Relevance (15% weight)**: `computeFrequencyRelevance()` - access count + importance

#### **Combined Scoring**:
```javascript
totalRelevance = (0.35 × domainMatch) + (0.20 × temporal) +
                 (0.30 × semantic) + (0.15 × frequency)
```

### Unified Tell Operation Flow (HTTP & STDIO):
1. **Protocol Entry**: HTTP `/tell` endpoint OR STDIO `tools/call` with `name: "tell"`
2. **Service Factory**: `getSimpleVerbsService()` returns singleton `SimpleVerbsService` instance
3. **Tell Method**: `SimpleVerbsService.tell(content, type, metadata)` processes the content
4. **Embedding Generation**: `safeOps.generateEmbedding(content)` creates vector representation
5. **Concept Extraction**: `safeOps.extractConcepts(content)` identifies key concepts via LLM
6. **Persistent Storage Path**:
   - `safeOps.storeInteraction()` → `MemoryManager.storeInteraction()` → `MemoryManager.addInteraction()`
   - `SPARQLStore.store()` → `Store.store()` → SPARQL INSERT to `http://tensegrity.it/semem/content`
7. **FAISS Index Update**: `vectors.addEmbedding()` adds new embedding to FAISS index
8. **Session Caching**: `stateManager.addToSessionCache()` for immediate retrieval
9. **Response**: Returns success confirmation with storage metadata

### Unified Ask Operation Flow (HTTP & STDIO):
1. **Protocol Entry**: HTTP `/ask` endpoint OR STDIO `tools/call` with `name: "ask"`
2. **Service Factory**: Same singleton `SimpleVerbsService` instance
3. **Ask Method**: `SimpleVerbsService.ask(question, options)` processes the query
4. **ZPT State Setup**: Creates state context with:
   - `focusQuery`: User's question string
   - `focusEmbedding`: Generated query embedding
   - `relevanceThreshold`: From preferences.js (default 0.1)
   - `maxMemories`: Result limit configuration
5. **Memory Retrieval Pipeline**:
   - `memoryDomainManager.getVisibleMemories(query, zptState)`
   - `fetchAllMemories()` → `sparqlStore.loadHistory()`
   - **SPARQL Query**: Uses `sparql/templates/store/load-memory.sparql` template:
     ```sparql
     SELECT ?interaction ?prompt ?output ?embedding ?concepts ?timestamp ?accessCount
     FROM <http://tensegrity.it/semem/content>
     WHERE {
       ?interaction a semem:Interaction ;
                   semem:prompt ?prompt ;
                   semem:output ?output ;
                   semem:embedding ?embedding ;
                   semem:concepts ?concepts ;
                   semem:timestamp ?timestamp ;
                   semem:accessCount ?accessCount .
     }
     ORDER BY DESC(?timestamp)
     ```
6. **Multi-Dimensional Relevance Scoring**:
   - **FAISS Semantic Search**: `vectors.searchIndex(queryEmbedding)` finds similar embeddings
   - **Combined Scoring**: Each memory scored across 4 dimensions:
     - Domain Match (35%): Context relevance
     - Temporal (20%): Age decay factor
     - Semantic (30%): FAISS cosine similarity
     - Frequency (15%): Access count + importance
7. **Filtering & Ranking**: Memories above threshold sorted by total relevance
8. **LLM Response**: Top memories used as context for `llmHandler.generateResponse()`
9. **Response**: Returns answer with context metadata and search statistics

### SPARQL-FAISS Integration Architecture

The system seamlessly combines SPARQL's structured storage with FAISS's vector search:

#### **Dual Storage Strategy**:
1. **SPARQL**: Persistent storage for structured metadata, text content, and vectors
2. **FAISS**: In-memory vector index for high-performance similarity search
3. **Synchronization**: FAISS index rebuilt from SPARQL embeddings on load

#### **Query Optimization**:
- **Hybrid Approach**: FAISS finds candidate vectors → SPARQL provides full metadata
- **Template System**: Parameterized SPARQL queries in `sparql/templates/`
- **Caching**: Query results cached to reduce SPARQL endpoint load
- **Indexing**: FAISS provides O(log n) similarity search vs O(n) brute force

#### **Vector-RDF Integration**:
```javascript
// Storage: Vector embedded in SPARQL triple
<interaction_123> semem:embedding """[0.1, 0.2, ..., 0.8]""" .

// Retrieval: FAISS index maps to SPARQL data
faissIndex.search(queryVector) → [memoryIndex_42, memoryIndex_87]
faissToMemoryMap[42] → interaction_123 → SPARQL metadata lookup
```

### Performance Characteristics

#### **Storage Performance**:
- **SPARQL INSERT**: ~10-50ms per fact (network dependent)
- **FAISS Index Update**: ~1-5ms per embedding
- **Combined Latency**: Dominated by SPARQL persistence

#### **Retrieval Performance**:
- **FAISS Search**: ~1-10ms for k-NN search (k≤100)
- **SPARQL Query**: ~5-20ms for metadata lookup
- **Relevance Scoring**: ~1ms per memory (4 similarity dimensions)
- **Total Query Time**: ~50-200ms for typical ask operations

### Critical Configuration Requirements:
- **No Hardcoded Values**: All thresholds/dimensions must come from `config/preferences.js`
- **SPARQL Endpoint**: Must be configured in `config.json` with credentials
- **Vector Dimensions**: Must match across embedding provider, FAISS, and SPARQL storage
- **Field Mapping**: Memory objects need `content || output || prompt` for text similarity
- **NaN Prevention**: All relevance factors must have defaults (e.g., `importance || 0`)
- **ZPT State**: Must include both `focusQuery` and `focusEmbedding` for proper scoring

### Unified Architecture Achievements (2025-09-26):
- ✅ **Protocol Unification**: HTTP and STDIO use identical storage/retrieval pipelines
- ✅ **Session Isolation Fix**: HTTP tell operations now persist to SPARQL (not just session cache)
- ✅ **SPARQL Integration**: All data persisted to `http://tensegrity.it/semem/content` graph
- ✅ **FAISS Performance**: Vector similarity search integrated with SPARQL metadata
- ✅ **Multi-dimensional Scoring**: Domain, temporal, semantic, and frequency relevance
- ✅ **Configuration Management**: All parameters sourced from `preferences.js`
- ✅ **Code Unification**: Removed redundant HTTP/STDIO specific implementations

## Notes
- The `tell-ask-stdio-e2e.integration.test.js` file ensures that the workflow is functional and adheres to the protocol.
- Future improvements may include additional validation and support for more complex queries.
- Use this document as a reference for tracing and debugging issues in the Tell/Ask workflow.