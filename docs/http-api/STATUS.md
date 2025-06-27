# Semem HTTP API Status Documentation

This document provides comprehensive status information for all available HTTP API endpoints in the Semem system.

## Field Definitions

* **Name** - Short reference name for the endpoint
* **Purpose** - What the call is used for
* **Endpoint URL** - How it is called (HTTP method and path)
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
      "unified-search-api": {"status": "healthy"}
    }
  }
  ```
* **Side Effects**: None
* **Behaviour**: Checks initialization status of all API handlers and core components

### System Configuration
* **Name**: config
* **Purpose**: Retrieve sanitized system configuration information
* **Endpoint URL**: `GET /api/config`
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
* **Supported HTTP Methods**: GET
* **Inputs**: None
* **Outputs**: 
  ```json
  {
    "success": true,
    "summary": {"totalServices": 6, "healthyServices": 6, "totalEndpoints": 30},
    "services": {
      "basic": {"memory": {...}, "chat": {...}, "search": {...}},
      "advanced": {"ragno": {...}, "zpt": {...}, "unified": {...}},
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

---

## ZPT Navigation API

### Navigate Corpus
* **Name**: navigate
* **Purpose**: Navigate knowledge space using ZPT (Zero-Point Traversal) system
* **Endpoint URL**: `POST /api/navigate`
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
**Total Endpoints**: 30  
**Service Health**: All services operational  
**Storage Backend**: SPARQL (https://fuseki.hyperdata.it)  
**LLM Providers**: Mistral (primary), Claude (secondary), Ollama (fallback)  
**Embedding Provider**: Nomic (primary), Ollama (fallback)