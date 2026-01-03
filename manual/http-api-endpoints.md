# Semem HTTP API Status Documentation

This document provides comprehensive status information for all available HTTP API endpoints in the Semem system.

## Field Definitions

* **Name** - Short reference name for the endpoint
* **Purpose** - What the call is used for
* **Endpoint URL** - How it is called (HTTP method and path)
* **OpenAPI Schema** - location
* **Supported HTTP Methods** - GET, POST, PUT, DELETE
* **Inputs** - Arguments to pass to the endpoint
* **Outputs** - Returned values and response structure
* **Side Effects** - Changes elsewhere in the system (e.g., addition to SPARQL store)
* **Behaviour** - How the function operates internally, core classes invoked

---

## System Endpoints

### API Health Check
* **Name**: health
* **Purpose**: Check overall system health and component status
* **Endpoint URL**: `GET /api/health`
* **OpenAPI Schema**: `./components/schemas/common.yaml#/HealthStatus`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "status": "healthy",
    "timestamp": 1234567890,
    "uptime": 123.456,
    "version": "1.0.0",
    "components": {
      "memory": {"status": "healthy"},
      "embedding": {"status": "healthy"},
      "llm": {"status": "healthy"},
      "memory-api": {"status": "healthy"},
      "chat-api": {"status": "healthy"},
      "search-api": {"status": "healthy"},
      "ragno-api": {"status": "healthy"},
      "zpt-api": {"status": "healthy"},
      "unified-search-api": {"status": "healthy"},
      "vsom-api": {"status": "healthy"}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Checks initialization status of all API handlers and core components

---

## MCP Simple Verbs REST API

These endpoints are served by the MCP HTTP server (default port 4101). If you are using the Workbench proxy, the browser will call `/api/*` and the proxy will forward to these MCP endpoints (e.g. `/api/zoom` → MCP `/zoom`).

### Simple Verb: Tell
* **Name**: tell
* **Purpose**: Store content in semantic memory with embeddings
* **Endpoint URL**: `POST /tell`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "content": "string",
    "type": "interaction",
    "metadata": {}
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "id": "memory:...",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```
* **Side Effects**: Stores content and embeddings in SPARQL
* **Behaviour**: Delegates to SimpleVerbsService tell handler

### Simple Verb: Ask
* **Name**: ask
* **Purpose**: Query stored knowledge with ZPT-aware context
* **Endpoint URL**: `POST /ask`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "question": "string",
    "mode": "standard",
    "useContext": true,
    "useHyDE": false,
    "useWikipedia": false,
    "useWikidata": false,
    "useWebSearch": false,
    "threshold": 0.3
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "answer": "string",
    "zptState": { "zoom": "entity", "pan": {}, "tilt": "keywords" },
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```
* **Side Effects**: Updates session cache
* **Behaviour**: Executes SimpleVerbsService ask pipeline

### Simple Verb: Augment
* **Name**: augment
* **Purpose**: Extract concepts/relationships from input text
* **Endpoint URL**: `POST /augment`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "target": "string",
    "operation": "auto",
    "options": {}
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "concepts": [],
    "relationships": []
  }
  ```
* **Side Effects**: May store extracted concepts/relationships
* **Behaviour**: Runs SimpleVerbsService augment pipeline

### Simple Verb: Zoom
* **Name**: zoom
* **Purpose**: Set ZPT abstraction level
* **Endpoint URL**: `POST /zoom`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "level": "entity",
    "query": "optional"
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "verb": "zoom",
    "state": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
  }
  ```
* **Side Effects**: Updates ZPT state
* **Behaviour**: Updates state via SimpleVerbsService zoom

### Simple Verb: Pan
* **Name**: pan
* **Purpose**: Apply ZPT domain filters
* **Endpoint URL**: `POST /pan`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "domains": ["ai"],
    "keywords": ["rag"],
    "entities": ["Ragno"],
    "temporal": { "start": "2024-01-01", "end": "2024-12-31" },
    "corpuscle": ["corpus:foo"],
    "query": "optional"
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "verb": "pan",
    "state": { "zoom": "entity", "pan": { "domains": ["ai"] }, "tilt": "keywords" }
  }
  ```
* **Side Effects**: Updates ZPT state
* **Behaviour**: Updates state via SimpleVerbsService pan

### Simple Verb: Tilt
* **Name**: tilt
* **Purpose**: Choose ZPT representation style
* **Endpoint URL**: `POST /tilt`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "style": "keywords",
    "query": "optional"
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "verb": "tilt",
    "state": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
  }
  ```
* **Side Effects**: Updates ZPT state
* **Behaviour**: Updates state via SimpleVerbsService tilt

### ZPT Navigate
* **Name**: zpt-navigate
* **Purpose**: Execute full ZPT navigation with zoom/pan/tilt parameters
* **Endpoint URL**: `POST /zpt/navigate`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  {
    "query": "string",
    "zoom": "entity",
    "pan": {},
    "tilt": "keywords"
  }
  ```
* **Outputs**:
  ```json
  {
    "success": true,
    "navigation": { "zoom": "entity", "pan": {}, "tilt": "keywords" },
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses ZPT navigation services in SimpleVerbsService

### Inspect
* **Name**: inspect
* **Purpose**: Inspect system state and diagnostics
* **Endpoint URL**: `POST /inspect`
* **Supported HTTP Methods**: POST
* **Inputs**:
  ```json
  { "type": "session" }
  ```
* **Outputs**:
  ```json
  { "success": true, "state": {} }
  ```
* **Side Effects**: None
* **Behaviour**: Executes SimpleVerbsService inspect handlers

### State
* **Name**: state
* **Purpose**: Get current ZPT state and session info
* **Endpoint URL**: `GET /state`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**:
  ```json
  {
    "success": true,
    "state": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns SimpleVerbsService state snapshot

---

### System Configuration
* **Name**: config
* **Purpose**: Retrieve sanitized system configuration information
* **Endpoint URL**: `GET /api/config`
* **OpenAPI Schema**: `./components/schemas/common.yaml#/ConfigurationInfo`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "data": {
      "storage": {"availableTypes": ["memory", "json", "sparql"], "current": "sparql"},
      "models": {"chat": {}, "embedding": {}},
      "sparqlEndpoints": [...],
      "llmProviders": [...]
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses Config class to load and sanitize configuration, removes sensitive data like passwords

### System Metrics
* **Name**: metrics
* **Purpose**: Get performance metrics and usage statistics
* **Endpoint URL**: `GET /api/metrics`
* **OpenAPI Schema**: `./components/schemas/metrics.yaml#/ApiMetrics`
* **Supported HTTP Methods**: GET
* **Inputs**: None (requires authentication)
* **Outputs**: 
  ```json
  {
    "success": true,
    "data": {
      "timestamp": 1234567890,
      "apiCount": 6,
      "memory-api": {...},
      "chat-api": {...}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Collects metrics from all initialized API handlers using their getMetrics() methods

### Service Discovery
* **Name**: services
* **Purpose**: List all available API services and their endpoints
* **Endpoint URL**: `GET /api/services`
* **OpenAPI Schema**: `./components/schemas/service.yaml#/ServiceInfo`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "summary": {"totalServices": 6, "healthyServices": 6, "totalEndpoints": 30},
    "services": {
      "basic": {"memory": {...}, "chat": {...}, "search": {...}},
      "advanced": {"ragno": {...}, "zpt": {...}, "unified": {...}, "vsom": {...}},
      "system": {...}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Dynamically discovers available services and their health status

---

## Memory API

### Store Interaction
* **Name**: store-memory
* **Purpose**: Store a prompt-response interaction in semantic memory
* **Endpoint URL**: `POST /api/memory`
* **OpenAPI Schema**: `./components/schemas/memory.yaml#/MemoryStoreRequest` and `MemoryStoreResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "prompt": "user input text",
    "response": "assistant response",
    "metadata": {"optional": "metadata"}
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "memoryId": "uuid",
    "embedding": [...],
    "concepts": ["concept1", "concept2"]
  }
  ```
* **Side Effects**: Stores interaction in configured storage backend (SPARQL/JSON/memory), generates vector embedding
* **Behaviour**: Uses MemoryManager.storeInteraction(), LLMHandler.extractConcepts(), EmbeddingHandler.generateEmbedding()

### Search Memories
* **Name**: search-memory
* **Purpose**: Search stored memories using semantic similarity
* **Endpoint URL**: `GET /api/memory/search`
* **OpenAPI Schema**: `./components/schemas/memory.yaml#/MemorySearchRequest` and `MemorySearchResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `query` (required): Search query text
  - `limit` (optional): Max results (default: 10)
  - `threshold` (optional): Similarity threshold (default: 0.7)
* **Outputs**: 
  ```json
  {
    "success": true,
    "results": [
      {
        "id": "uuid",
        "prompt": "original prompt",
        "response": "original response",
        "similarity": 0.85,
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ],
    "queryEmbedding": [...]
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses MemoryManager.searchMemories() with vector similarity search via storage backend

### Generate Embedding
* **Name**: embedding
* **Purpose**: Generate vector embedding for input text
* **Endpoint URL**: `POST /api/memory/embedding`
* **OpenAPI Schema**: `./components/schemas/memory.yaml#/EmbeddingRequest` and `EmbeddingResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "text": "text to embed"
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "embedding": [0.1, 0.2, ...],
    "dimension": 1536,
    "model": "nomic-embed-text-v1.5"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses EmbeddingHandler.generateEmbedding() with configured embedding provider

### Extract Concepts
* **Name**: concepts
* **Purpose**: Extract semantic concepts from input text using LLM
* **Endpoint URL**: `POST /api/memory/concepts`
* **OpenAPI Schema**: `./components/schemas/memory.yaml#/ConceptsRequest` and `ConceptsResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "text": "text to analyze"
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "concepts": ["concept1", "concept2", "concept3"],
    "model": "mistral-small-latest"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses LLMHandler.extractConcepts() with structured prompting for concept extraction

---

## Chat API

### Chat Completion
* **Name**: chat
* **Purpose**: Generate contextual chat responses with memory integration
* **Endpoint URL**: `POST /api/chat`
* **OpenAPI Schema**: `./components/schemas/chat.yaml#/ChatRequest` and `ChatResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "message": "user message",
    "includeMemory": true,
    "contextWindow": 5
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "response": "AI response",
    "contextUsed": [...],
    "memoryId": "uuid"
  }
  ```
* **Side Effects**: Stores the conversation in memory if includeMemory is true
* **Behaviour**: Uses LLMHandler.generateResponse(), MemoryManager for context retrieval and storage

### Streaming Chat
* **Name**: chat-stream
* **Purpose**: Generate streaming chat responses for real-time interaction
* **Endpoint URL**: `POST /api/chat/stream`
* **OpenAPI Schema**: `./components/schemas/chat.yaml#/StreamingChatRequest` and `StreamingChatChunk`
* **Supported HTTP Methods**: POST
* **Inputs**: Same as chat completion
* **Outputs**: Server-Sent Events stream with chunks:
  ```
  data: {"chunk": "partial response", "done": false}
  data: {"done": true}
  ```
* **Side Effects**: Stores conversation in memory when stream completes
* **Behaviour**: Uses LLMHandler streaming capabilities with EventEmitter pattern

### Text Completion
* **Name**: completion
* **Purpose**: Simple text completion without memory integration
* **Endpoint URL**: `POST /api/completion`
* **OpenAPI Schema**: `./components/schemas/chat.yaml#/TextCompletionRequest` and `TextCompletionResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "prompt": "text to complete",
    "maxTokens": 100
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "completion": "completed text",
    "model": "mistral-small-latest"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Direct LLMHandler.generateCompletion() call without memory integration

---

## Search API

### Search Content
* **Name**: search
* **Purpose**: Search indexed content and memories
* **Endpoint URL**: `GET /api/search`
* **OpenAPI Schema**: `./components/schemas/search.yaml#/SearchRequest` and `SearchResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `query` (required): Search query
  - `limit` (optional): Max results
  - `type` (optional): Search type filter
* **Outputs**: 
  ```json
  {
    "success": true,
    "results": [...],
    "source": "memory_fallback",
    "totalResults": 5
  }
  ```
* **Side Effects**: None
* **Behaviour**: Falls back to MemoryManager.searchMemories() when dedicated search service unavailable

### Index Content
* **Name**: index
* **Purpose**: Index content for searchability
* **Endpoint URL**: `POST /api/index`
* **OpenAPI Schema**: `./components/schemas/search.yaml#/IndexRequest` and `IndexResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "content": "content to index",
    "metadata": {"type": "document"}
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "indexed": true,
    "id": "content-id"
  }
  ```
* **Side Effects**: Adds content to search index or memory storage
* **Behaviour**: Uses SearchHandler.indexContent() or MemoryManager as fallback

---

## Ragno Knowledge Graph API

### Decompose Text
* **Name**: decompose
* **Purpose**: Decompose unstructured text into knowledge graph entities and relationships
* **Endpoint URL**: `POST /api/graph/decompose`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoDecomposeRequest` and `RagnoDecomposeResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "textChunks": ["text1", "text2"],
    "options": {
      "extractRelationships": true,
      "generateSummaries": true,
      "maxEntitiesPerUnit": 10
    }
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "results": {
      "units": [...],
      "entities": [...],
      "relationships": [...],
      "statistics": {...}
    }
  }
  ```
* **Side Effects**: Stores extracted entities and relationships in SPARQL store
* **Behaviour**: Uses decomposeCorpus() function with LLMHandler, creates RDF triples via RDFGraphManager

### Graph Statistics
* **Name**: graph-stats
* **Purpose**: Get comprehensive statistics about the knowledge graph
* **Endpoint URL**: `GET /api/graph/stats`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoGraphStats`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "statistics": {
      "entities": 0,
      "units": 0,
      "relationships": 0,
      "triples": 0
    },
    "analytics": {}
  }
  ```
* **Side Effects**: None
* **Behaviour**: Queries SPARQL store for counts, uses GraphAnalytics for advanced metrics

### Get Entities
* **Name**: entities
* **Purpose**: Retrieve entities from the knowledge graph with filtering
* **Endpoint URL**: `GET /api/graph/entities`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoEntity`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `limit` (optional): Max entities to return
  - `type` (optional): Filter by entity type
  - `name` (optional): Filter by name pattern
* **Outputs**: 
  ```json
  {
    "success": true,
    "entities": [
      {
        "uri": "http://example.org/entity1",
        "name": "Entity Name",
        "type": "concept",
        "confidence": 0.95
      }
    ]
  }
  ```
* **Side Effects**: None
* **Behaviour**: Queries SPARQL store using Entity class methods, applies filters and pagination

### Search Knowledge Graph
* **Name**: graph-search
* **Purpose**: Search entities and relationships using various strategies
* **Endpoint URL**: `POST /api/graph/search`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoSearchRequest` and `RagnoSearchResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "query": "search terms",
    "type": "dual",
    "limit": 10,
    "threshold": 0.7
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "results": [...],
    "searchType": "dual",
    "strategy": "semantic_and_symbolic"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses DualSearch system combining semantic (embeddings) and symbolic (SPARQL) search

### Export Graph
* **Name**: export
* **Purpose**: Export knowledge graph in various formats
* **Endpoint URL**: `GET /api/graph/export/{format}`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoExportResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `format` (path): Export format (json, turtle, jsonld, ntriples)
  - `limit` (optional): Max items to export
  - `filter` (optional): JSON filter criteria
* **Outputs**: Format-specific graph data (JSON, RDF/Turtle, etc.)
* **Side Effects**: None
* **Behaviour**: Uses RDFGraphManager.exportToFormat() with format-specific serializers

### Enrich Graph
* **Name**: enrich
* **Purpose**: Enhance graph with embeddings, attributes, and community detection
* **Endpoint URL**: `POST /api/graph/enrich`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoEnrichRequest` and `RagnoEnrichResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "includeEmbeddings": true,
    "includeAttributes": true,
    "includeCommunities": true
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "enrichmentResults": {
      "embeddingsAdded": 10,
      "attributesGenerated": 15,
      "communitiesDetected": 3
    }
  }
  ```
* **Side Effects**: Updates entities in SPARQL store with enrichment data
* **Behaviour**: Uses EmbeddingHandler, LLMHandler for attributes, CommunityDetection for graph clustering

### Get Communities
* **Name**: communities
* **Purpose**: Retrieve detected communities from the knowledge graph
* **Endpoint URL**: `GET /api/graph/communities`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoCommunity`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `algorithm` (optional): Community detection algorithm
  - `minSize` (optional): Minimum community size
* **Outputs**: 
  ```json
  {
    "success": true,
    "communities": [
      {
        "id": "community1",
        "entities": [...],
        "size": 5,
        "coherence": 0.85
      }
    ]
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses CommunityDetection with Leiden/Louvain algorithms on entity relationship graph

### Ragno Pipeline
* **Name**: pipeline
* **Purpose**: Execute complete Ragno pipeline from text to enriched knowledge graph
* **Endpoint URL**: `POST /api/graph/pipeline`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoPipelineRequest` and `RagnoPipelineResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "textChunks": ["text1", "text2"],
    "enrichment": {
      "embeddings": true,
      "attributes": true,
      "communities": true
    }
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "pipelineResults": {
      "decomposition": {...},
      "enrichment": {...},
      "finalStats": {...}
    }
  }
  ```
* **Side Effects**: Complete knowledge graph creation and storage in SPARQL
* **Behaviour**: Orchestrates decompose → enrich → store pipeline with error handling and progress tracking

### Generate Hypotheses (HyDE)
* **Name**: hyde-generate
* **Purpose**: Generate hypothetical answers for queries using the HyDE algorithm
* **Endpoint URL**: `POST /api/graph/hyde-generate`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoHydeGenerateRequest` and `RagnoHydeGenerateResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "queries": ["What is quantum computing?", "How does AI work?"],
    "options": {
      "hypothesesPerQuery": 3,
      "temperature": 0.7,
      "extractEntities": true,
      "store": true
    }
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "queries": ["What is quantum computing?"],
    "hypotheses": [...],
    "entities": [...],
    "relationships": [...],
    "statistics": {
      "queriesProcessed": 1,
      "hypothesesGenerated": 3,
      "entitiesExtracted": 15
    }
  }
  ```
* **Side Effects**: Stores hypothetical content in knowledge graph with ragno:maybe markers
* **Behaviour**: Uses LLM to generate hypothetical answers, extracts entities, creates RDF with uncertainty annotations

### Query Hypotheses (HyDE)
* **Name**: hyde-query
* **Purpose**: Query and retrieve hypothetical content from knowledge graph
* **Endpoint URL**: `GET /api/graph/hyde-query`
* **OpenAPI Schema**: `./components/schemas/ragno.yaml#/RagnoHydeQueryRequest` and `RagnoHydeQueryResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  ```json
  {
    "filters": {
      "confidence": "0.6"
    },
    "limit": 50
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "hypotheses": [...],
    "count": 25,
    "totalFound": 47,
    "filters": {"confidence": "0.6"}
  }
  ```
* **Side Effects**: None
* **Behaviour**: Retrieves hypothetical content marked with ragno:maybe property, applies filters

---

## ZPT Navigation API

### Navigate Corpus
* **Name**: navigate
* **Purpose**: Navigate knowledge space using ZPT (Zero-Point Traversal) system
* **Endpoint URL**: `POST /api/navigate`
* **OpenAPI Schema**: `./components/schemas/zpt.yaml#/ZPTNavigateRequest` and `ZPTNavigateResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "query": "navigation query",
    "zoom": "entity",
    "tilt": "keywords",
    "pan": {},
    "transform": {}
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "navigation": {
      "corpuscles": [...],
      "metadata": {...},
      "coordinates": {...}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses NavigationEndpoint with CorpuscleSelector, TiltProjector, CorpuscleTransformer

### Navigation Preview
* **Name**: navigate-preview
* **Purpose**: Get lightweight preview of navigation destination
* **Endpoint URL**: `POST /api/navigate/preview`
* **OpenAPI Schema**: `./components/schemas/zpt.yaml#/ZPTPreviewRequest` and `ZPTPreviewResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "query": "preview query",
    "zoom": "entity",
    "pan": {}
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "preview": {
      "summary": "preview description",
      "estimatedResults": 10
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Lightweight version of navigation without full processing

### Navigation Options
* **Name**: navigate-options
* **Purpose**: Get available navigation options and parameters
* **Endpoint URL**: `GET /api/navigate/options`
* **OpenAPI Schema**: `./components/schemas/zpt.yaml#/ZPTOptions`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `context` (optional): Scope for context-specific options
  - `query` (optional): Query for relevant options
* **Outputs**: 
  ```json
  {
    "success": true,
    "options": {
      "zoom": ["entity", "unit", "text", "community", "corpus"],
      "tilt": ["keywords", "embedding", "graph", "temporal"],
      "availableTransforms": [...]
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns static and dynamic navigation options from ZPT system

### Navigation Schema
* **Name**: navigate-schema
* **Purpose**: Get ZPT parameter schema and validation rules
* **Endpoint URL**: `GET /api/navigate/schema`
* **OpenAPI Schema**: `./components/schemas/zpt.yaml#/ZPTSchema`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "schema": {
      "zoom": {"type": "enum", "values": [...]},
      "tilt": {"type": "enum", "values": [...]},
      "pan": {"type": "object", "properties": {...}},
      "transform": {"type": "object", "properties": {...}}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns JSON schema for ZPT navigation parameters

### ZPT Health Check
* **Name**: navigate-health
* **Purpose**: Check ZPT system health and component status
* **Endpoint URL**: `GET /api/navigate/health`
* **OpenAPI Schema**: `./components/schemas/zpt.yaml#/ZPTHealth`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "health": {
      "corpuscleSelector": "ready",
      "tiltProjector": "ready",
      "corpuscleTransformer": "ready",
      "navigationEndpoint": "ready"
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Checks initialization status of all ZPT components

---

## Unified Search API

### Unified Search
* **Name**: unified-search
* **Purpose**: Intelligent search across all available services with automatic strategy selection
* **Endpoint URL**: `POST /api/search/unified`
* **OpenAPI Schema**: `./components/schemas/unified-search.yaml#/UnifiedSearchRequest` and `UnifiedSearchResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "query": "search query",
    "services": ["memory", "ragno", "zpt"],
    "limit": 20,
    "enableRanking": true
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "results": [
      {
        "content": "result content",
        "source": "memory",
        "score": 0.95,
        "metadata": {...}
      }
    ],
    "strategy": "parallel_search",
    "servicesUsed": ["memory", "ragno"]
  }
  ```
* **Side Effects**: None
* **Behaviour**: Orchestrates parallel searches across services, ranks and deduplicates results

### Analyze Search Query
* **Name**: analyze-query
* **Purpose**: Analyze search query to determine optimal search strategy
* **Endpoint URL**: `POST /api/search/analyze`
* **OpenAPI Schema**: `./components/schemas/unified-search.yaml#/QueryAnalysisRequest` and `QueryAnalysisResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "query": "search query to analyze"
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "analysis": {
      "queryType": "semantic",
      "recommendedServices": ["memory", "ragno"],
      "suggestedStrategy": "parallel",
      "confidence": 0.85
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses NLP analysis to categorize query and recommend search approach

### Get Available Services
* **Name**: search-services
* **Purpose**: List search services available for unified search
* **Endpoint URL**: `GET /api/search/services`
* **OpenAPI Schema**: `./components/schemas/unified-search.yaml#/SearchServices`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "services": {
      "memory": true,
      "ragno": true,
      "zpt": true,
      "search": false
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Checks availability and health of all searchable services

### Get Search Strategies
* **Name**: search-strategies
* **Purpose**: List available search strategies and their characteristics
* **Endpoint URL**: `GET /api/search/strategies`
* **OpenAPI Schema**: `./components/schemas/unified-search.yaml#/SearchStrategy`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "strategies": {
      "parallel": {"description": "Search all services simultaneously"},
      "sequential": {"description": "Search services in priority order"},
      "adaptive": {"description": "Dynamic strategy based on query analysis"}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns static configuration of available search orchestration strategies

---

## VSOM (Vector Self-Organizing Map) API

### Create VSOM Instance
* **Name**: create-vsom
* **Purpose**: Create a new Vector Self-Organizing Map instance for knowledge graph visualization
* **Endpoint URL**: `POST /api/vsom/create`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMCreateRequest` and `VSOMCreateResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "mapSize": [20, 20],
    "topology": "rectangular",
    "embeddingDimension": 1536,
    "maxIterations": 1000,
    "initialLearningRate": 0.1,
    "finalLearningRate": 0.01,
    "clusterThreshold": 0.8,
    "minClusterSize": 3
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "config": {...},
    "status": "created",
    "created": "2024-01-16T10:30:45.123Z"
  }
  ```
* **Side Effects**: Creates new VSOM instance in memory with specified configuration
* **Behaviour**: Uses VSOMService.createInstance() to initialize new VSOM algorithm instance with grid topology

### Load Data into VSOM
* **Name**: load-vsom-data
* **Purpose**: Load entity data into a VSOM instance for training and visualization
* **Endpoint URL**: `POST /api/vsom/load-data`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMLoadDataRequest` and `VSOMLoadDataResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "instanceId": "vsom_1640995200000_abc123def",
    "dataType": "entities",
    "data": {
      "entities": [
        {
          "uri": "http://example.org/entity/123",
          "name": "Machine Learning",
          "content": "Machine learning is a subset of AI",
          "embedding": [0.1, 0.2, ...]
        }
      ]
    }
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "dataType": "entities",
    "entitiesLoaded": 50,
    "dataPreview": [...]
  }
  ```
* **Side Effects**: Loads entity embeddings into VSOM instance, generates embeddings if not provided
* **Behaviour**: Uses EmbeddingHandler.generateEmbedding() for missing embeddings, VSOM.loadFromEntities() for data loading

### Generate Sample Data
* **Name**: generate-vsom-samples
* **Purpose**: Generate sample entity data for VSOM testing and demonstration
* **Endpoint URL**: `POST /api/vsom/generate-sample-data`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMGenerateSampleDataRequest` and `VSOMGenerateSampleDataResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "count": 50
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "entities": [...],
    "count": 50,
    "format": "entities",
    "embeddingDimension": 1536
  }
  ```
* **Side Effects**: None
* **Behaviour**: Generates sample entities with topics and uses EmbeddingHandler to create embeddings

### Train VSOM
* **Name**: train-vsom
* **Purpose**: Train the VSOM with loaded data using competitive learning algorithm
* **Endpoint URL**: `POST /api/vsom/train`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMTrainRequest` and `VSOMTrainResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "instanceId": "vsom_1640995200000_abc123def",
    "epochs": 100,
    "batchSize": 10
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "trainingResults": {
      "epochs": 100,
      "finalError": 0.15,
      "convergenceIteration": 85,
      "trainingTime": 45000
    },
    "status": "completed"
  }
  ```
* **Side Effects**: Updates VSOM node weights, creates entity-to-node mappings
* **Behaviour**: Uses VSOM.train() with learning rate decay and convergence detection

### Get VSOM Grid State
* **Name**: vsom-grid-state
* **Purpose**: Retrieve current grid state and entity mappings for visualization
* **Endpoint URL**: `GET /api/vsom/grid`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMGridStateRequest` and `VSOMGridStateResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `instanceId` (required): VSOM instance identifier
  - `includeWeights` (optional): Include node weight vectors
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "gridState": {
      "nodes": [...],
      "topology": "rectangular",
      "dimensions": [20, 20]
    },
    "mappings": [...],
    "metadata": {...}
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses VSOM.exportVisualization() and getNodeMappings() for grid and mapping data

### Get Feature Maps
* **Name**: vsom-feature-maps
* **Purpose**: Generate feature maps (U-Matrix, component planes) for pattern visualization
* **Endpoint URL**: `GET /api/vsom/features`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMFeatureMapsRequest` and `VSOMFeatureMapsResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `instanceId` (required): VSOM instance identifier
  - `mapType` (optional): Type of feature map (umatrix, component, distance)
  - `dimension` (optional): Dimension for component maps
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "mapType": "umatrix",
    "featureMap": [...],
    "statistics": {
      "minValue": 0.1,
      "maxValue": 0.9,
      "meanValue": 0.45
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses VSOM internal calculations to generate distance matrices and component visualizations

### Perform Clustering
* **Name**: vsom-clustering
* **Purpose**: Perform clustering analysis on trained VSOM to identify entity groups
* **Endpoint URL**: `POST /api/vsom/cluster`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMClusteringRequest` and `VSOMClusteringResponse`
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "instanceId": "vsom_1640995200000_abc123def",
    "algorithm": "umatrix",
    "threshold": 0.8,
    "minClusterSize": 3
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "clusters": [
      {
        "id": 0,
        "center": [10, 15],
        "size": 15,
        "entities": [...],
        "quality": 0.82
      }
    ],
    "algorithm": "umatrix",
    "statistics": {...}
  }
  ```
* **Side Effects**: None
* **Behaviour**: Uses VSOM.getClusters() with distance-based clustering algorithms

### Get Training Status
* **Name**: vsom-training-status
* **Purpose**: Monitor training progress and status for VSOM instances
* **Endpoint URL**: `GET /api/vsom/training-status`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMTrainingStatus`
* **Supported HTTP Methods**: GET
* **Inputs**: 
  - `instanceId` (optional): Specific instance ID, or all instances if omitted
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "isTraining": false,
    "progress": {
      "currentIteration": 100,
      "totalIterations": 100,
      "progress": 100,
      "status": "completed"
    },
    "message": "Training completed"
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns current training state from VSOMService progress tracking

### List VSOM Instances
* **Name**: list-vsom-instances
* **Purpose**: List all VSOM instances with their status and configuration
* **Endpoint URL**: `GET /api/vsom/instances`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMInstancesListResponse`
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "instances": [
      {
        "instanceId": "vsom_1640995200000_abc123def",
        "config": {...},
        "status": "trained",
        "created": "2024-01-16T10:30:45.123Z",
        "dataLoaded": true,
        "entitiesCount": 50
      }
    ],
    "count": 1
  }
  ```
* **Side Effects**: None
* **Behaviour**: Returns summary information for all VSOM instances from VSOMService

### Delete VSOM Instance
* **Name**: delete-vsom-instance
* **Purpose**: Delete a VSOM instance and free associated resources
* **Endpoint URL**: `DELETE /api/vsom/delete`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMDeleteInstanceRequest` and `VSOMDeleteInstanceResponse`
* **Supported HTTP Methods**: DELETE
* **Inputs**: 
  ```json
  {
    "instanceId": "vsom_1640995200000_abc123def"
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "deleted": true
  }
  ```
* **Side Effects**: Removes VSOM instance from memory, stops any ongoing training
* **Behaviour**: Uses VSOMService.deleteInstance() to clean up instance and associated data

### Stop VSOM Training
* **Name**: stop-vsom-training
* **Purpose**: Stop ongoing VSOM training process
* **Endpoint URL**: `POST /api/vsom/stop-training`
* **OpenAPI Schema**: `./components/schemas/vsom.yaml#/VSOMTrainRequest` (instanceId only)
* **Supported HTTP Methods**: POST
* **Inputs**: 
  ```json
  {
    "instanceId": "vsom_1640995200000_abc123def"
  }
  ```
* **Outputs**: 
  ```json
  {
    "success": true,
    "instanceId": "vsom_1640995200000_abc123def",
    "stopped": true,
    "status": "stopped"
  }
  ```
* **Side Effects**: Interrupts training process, preserves current state
* **Behaviour**: Uses VSOMService.stopTraining() to gracefully halt training algorithm

---

## Authentication and Security

All API endpoints (except health check and service discovery) require authentication via:
- **Header**: `X-API-Key: your-api-key`
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security Headers**: Helmet.js for security hardening
- **CORS**: Configured for development (origin: *)

## Error Handling

All endpoints return standardized error responses:
```json
{
  "success": false,
  "error": "error_type",
  "message": "Human readable error message",
  "requestId": "uuid",
  "timestamp": "ISO8601"
}
```

Common error types:
- `authentication_error` (401)
- `not_found_error` (404)
- `validation_error` (400)
- `internal_server_error` (500)
- `rate_limit_exceeded` (429)

## System Status

**Last Updated**: 2025-06-27  
**API Version**: 1.0.0  
**Total Endpoints**: 43  
**Service Health**: All services operational  
**Storage Backend**: SPARQL (https://fuseki.hyperdata.it)  
**LLM Providers**: Mistral (primary), Claude (secondary), Ollama (fallback)  
**Embedding Provider**: Nomic (primary), Ollama (fallback)
