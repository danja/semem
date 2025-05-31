# PLAN2 Progress Log

## 2025-05-31: Plan Initiated
- Created PLAN2.md for live MCP integration plan.
- Will proceed stepwise, noting all progress, issues, and design decisions here.

---

## Step 1: Design MCP Service Endpoints (Complete)
- JSON-RPC methods defined and design reviewed.

---

## Step 2: Implement LLMHandler Integration and callLLM Endpoint (Complete)
- MCP server now loads config from ragno-config.json and instantiates LLMHandler at startup.
- Implemented callLLM JSON-RPC endpoint, which calls LLMHandler.generateResponse.
- callLLM is advertised in listResources as a live service.

---

## Step 3: Integrate Embedding Subsystem (Complete)
- EmbeddingHandler is now instantiated at server startup using config from ragno-config.json.
- Implemented embedText JSON-RPC endpoint, which calls EmbeddingHandler.generateEmbedding.
- embedText is advertised in listResources as a live service.

---

## Step 4: Integrate SPARQLHelpers (Complete)
- SPARQLHelpers is now imported and used in MCP server.
- Implemented sparqlQuery and sparqlUpdate JSON-RPC endpoints, calling SPARQLHelpers methods.
- Both endpoints are advertised in listResources as live services.

---

## Step 5: Integrate Search Subsystem (Complete)
- Integrated real SearchService with EmbeddingService and SPARQLService using config from ragno-config.json.
- Implemented searchGraph JSON-RPC endpoint, which calls searchService.search for live semantic search.
- searchGraph is advertised in listResources as a live service.

---

## Step 6: Graph Augmentation, Attribute, and Community Endpoints (Complete)
- MCP server now exposes augmentGraph and discoverCommunities endpoints using Ragno pipeline modules (augmentWithAttributes, aggregateCommunities).
- Both endpoints accept a graph object and return augmented attributes or detected communities with LLM summaries.
- Endpoints are advertised as live services.

---

## Step 7: Test, Document, and Update README (Next)
- Next: Add/extend integration tests and client examples for new endpoints. Update project README to document all MCP live services and usage patterns.

### Planned JSON-RPC Methods
- `callLLM`: Call LLMHandler for completions, summaries, or concept extraction
- `embedText`: Generate embeddings using EmbeddingHandler
- `sparqlQuery`: Run SPARQL SELECT queries via SPARQLHelpers
- `sparqlUpdate`: Run SPARQL UPDATE via SPARQLHelpers
- `searchGraph`: Perform semantic or exact search using search subsystem
- `augmentGraph`: Run graph augmentation (attributes, enrichment, etc.)
- `discoverCommunities`: Run community detection and summarization

### Design Notes
- Each method will have a clear input/output schema, validated at runtime.
- Methods will be advertised in `listResources` as type `service` with descriptions.
- Handlers will be instantiated at server startup using config.

### Open Questions
- Should all methods be accessible to unauthenticated clients, or add auth?
- Should results include provenance/trace info for auditability?
