# Semem HTTP API Server - Endpoint Status

## Overview

This document provides a comprehensive overview of all API endpoints available in the Semem HTTP API server, their functionality, parameters, and current implementation status.

**Server Information:**
- **Main Server**: `/flow/hyperdata/semem/src/servers/api-server.js` 
- **Default Port**: 4100
- **Base URL**: `http://localhost:4100`
- **Authentication**: API key-based authentication (configurable)

---

## System Endpoints

### Configuration & Health

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/config` | GET | System configuration | None | ✅ Active |
| `/api/health` | GET | Health check | None | ✅ Active |
| `/api/metrics` | GET | System metrics | Required | ✅ Active |
| `/api/services` | GET | Service discovery | None | ✅ Active |

#### GET /api/config
- **Purpose**: Retrieve system configuration
- **Parameters**: None
- **Response**: Sanitized configuration including storage types, models, SPARQL endpoints, LLM providers
- **Side Effects**: None
- **Internal Behavior**: Loads Config instance, sanitizes sensitive data

#### GET /api/health
- **Purpose**: System health check
- **Parameters**: None
- **Response**: Health status of all components and APIs
- **Side Effects**: None
- **Internal Behavior**: Checks initialization status of all registered APIs

#### GET /api/metrics
- **Purpose**: Retrieve system performance metrics
- **Parameters**: None
- **Response**: Metrics from all API handlers including counts, durations, errors
- **Side Effects**: None
- **Internal Behavior**: Calls `getMetrics()` on all registered APIs

#### GET /api/services
- **Purpose**: Service discovery endpoint
- **Parameters**: None
- **Response**: Complete list of available services, endpoints, and their status
- **Side Effects**: None
- **Internal Behavior**: Enumerates all APIs and their endpoints

---

## Memory API Endpoints

**Handler**: `MemoryAPI` (`/flow/hyperdata/semem/src/api/features/MemoryAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/memory` | POST | Store interaction | Required | ✅ Active |
| `/api/memory/search` | GET | Search memories | Required | ✅ Active |
| `/api/memory/embedding` | POST | Generate embedding | Required | ✅ Active |
| `/api/memory/concepts` | POST | Extract concepts | Required | ✅ Active |

#### POST /api/memory (store operation)
- **Purpose**: Store a new interaction in semantic memory
- **Required Parameters**: `prompt` (string), `response` (string)
- **Optional Parameters**: `metadata` (object)
- **Response**: `{ id, concepts, timestamp, success }`
- **Side Effects**: 
  - Generates embedding for combined prompt+response
  - Extracts concepts from text
  - Stores in configured storage backend (SPARQL/JSON/Memory)
- **Internal Behavior**: 
  - Calls `memoryManager.generateEmbedding()`
  - Calls `memoryManager.extractConcepts()`
  - Calls `memoryManager.addInteraction()`

#### GET /api/memory/search (search operation)
- **Purpose**: Search stored interactions by semantic similarity
- **Required Parameters**: `query` (string)
- **Optional Parameters**: `threshold` (number, default: 40), `limit` (number, default: 10)
- **Response**: `{ results: [{ id, prompt, output, concepts, timestamp, accessCount, similarity }], count }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: Calls `memoryManager.retrieveRelevantInteractions()`

#### POST /api/memory/embedding (embedding operation)  
- **Purpose**: Generate vector embedding for text
- **Required Parameters**: `text` (string)
- **Optional Parameters**: `model` (string)
- **Response**: `{ embedding: number[], model, dimension }`
- **Side Effects**: None
- **Internal Behavior**: Calls `memoryManager.generateEmbedding()`

#### POST /api/memory/concepts (concepts operation)
- **Purpose**: Extract semantic concepts from text
- **Required Parameters**: `text` (string)
- **Response**: `{ concepts: string[], text }`
- **Side Effects**: None
- **Internal Behavior**: Calls `memoryManager.extractConcepts()`

---

## Chat API Endpoints

**Handler**: `ChatAPI` (`/flow/hyperdata/semem/src/api/features/ChatAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/chat` | POST | Chat completion | Required | ✅ Active |
| `/api/chat/stream` | POST | Streaming chat | Required | ✅ Active |
| `/api/completion` | POST | Text completion | Required | ✅ Active |

#### POST /api/chat (chat operation)
- **Purpose**: Generate chat response with memory context
- **Required Parameters**: `prompt` (string)
- **Optional Parameters**: `conversationId` (string), `useMemory` (boolean, default: true), `temperature` (number, default: 0.7), `model` (string)
- **Response**: `{ response, conversationId, memoryIds }`
- **Side Effects**: 
  - Updates conversation history
  - Stores interaction in memory if `useMemory` is true
  - Generates embeddings and extracts concepts
- **Internal Behavior**: 
  - Retrieves relevant memories with `memoryManager.retrieveRelevantInteractions()`
  - Generates response with `llmHandler.generateResponse()`
  - Manages conversation state in cache

#### POST /api/chat/stream (stream operation)
- **Purpose**: Generate streaming chat response with memory context
- **Required Parameters**: `prompt` (string)
- **Optional Parameters**: `conversationId` (string), `useMemory` (boolean, default: true), `temperature` (number, default: 0.7)
- **Response**: Server-Sent Events stream with chat chunks
- **Side Effects**: Same as chat operation but streamed
- **Internal Behavior**: 
  - Uses `llmHandler.generateStreamingResponse()`
  - Returns EventEmitter for streaming

#### POST /api/completion (completion operation)
- **Purpose**: Generate text completion with memory context
- **Required Parameters**: `prompt` (string)
- **Optional Parameters**: `max_tokens` (number, default: 100), `temperature` (number, default: 0.7)
- **Response**: `{ completion, memoryIds }`
- **Side Effects**: None (read-only operation)
- **Internal Behavior**: 
  - Uses `llmHandler.generateCompletion()`
  - Includes relevant memories as context

---

## Search API Endpoints

**Handler**: `SearchAPI` (`/flow/hyperdata/semem/src/api/features/SearchAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/search` | GET | Search content | Required | ✅ Active |
| `/api/index` | POST | Index content | Required | ✅ Active |

#### GET /api/search (search operation)
- **Purpose**: Search content using semantic similarity
- **Required Parameters**: `query` (string)
- **Optional Parameters**: `limit` (number, default: 5), `types` (string, comma-separated), `threshold` (number, default: 0.7)
- **Response**: `{ results: [{ id, title, content, similarity, type, metadata }], count }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: 
  - Uses dedicated search service if available
  - Falls back to memory manager search
  - Applies defensive error handling

#### POST /api/index (index operation)
- **Purpose**: Index content for search
- **Required Parameters**: `content` (string), `type` (string)
- **Optional Parameters**: `title` (string), `metadata` (object)
- **Response**: `{ id, success }`
- **Side Effects**: 
  - Indexes content in search service or stores in memory
  - Generates embeddings and extracts concepts for fallback storage
- **Internal Behavior**: 
  - Uses search service if available
  - Falls back to memory storage via `memoryManager.addInteraction()`

---

## Ragno Knowledge Graph API Endpoints

**Handler**: `RagnoAPI` (`/flow/hyperdata/semem/src/api/features/RagnoAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/graph/decompose` | POST | Decompose text to entities | Required | ✅ Active |
| `/api/graph/stats` | GET | Graph statistics | Required | ✅ Active |
| `/api/graph/entities` | GET | Get entities | Required | ✅ Active |
| `/api/graph/search` | POST | Search knowledge graph | Required | ✅ Active |
| `/api/graph/export/{format}` | GET | Export graph data | Required | ✅ Active |
| `/api/graph/enrich` | POST | Enrich graph | Required | ✅ Active |
| `/api/graph/communities` | GET | Get communities | Required | ✅ Active |
| `/api/graph/pipeline` | POST | Full ragno pipeline | Required | ✅ Active |

#### POST /api/graph/decompose (decompose operation)
- **Purpose**: Decompose text into knowledge graph entities and relationships
- **Required Parameters**: `text` (string) OR `chunks` (array)
- **Optional Parameters**: `options` (object with decomposition settings)
- **Response**: `{ success, units, entities, relationships, statistics }`
- **Side Effects**: 
  - Creates RDF entities, semantic units, and relationships
  - Stores in SPARQL if available
- **Internal Behavior**: 
  - Calls `decomposeCorpus()` from ragno module
  - Exports results to RDF dataset

#### GET /api/graph/stats (stats operation)
- **Purpose**: Get knowledge graph statistics
- **Parameters**: None
- **Response**: `{ success, statistics: { entities, units, relationships, triples }, analytics }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: 
  - Executes SPARQL COUNT queries
  - Uses GraphAnalytics for additional metrics

#### GET /api/graph/entities (entities operation)
- **Purpose**: Get entities with optional filtering
- **Optional Parameters**: `limit` (number, default: 50), `offset` (number, default: 0), `type` (string), `name` (string)
- **Response**: `{ success, entities: [{ uri, name, type, confidence }], count, pagination }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: Executes filtered SPARQL SELECT query

#### POST /api/graph/search (search operation)
- **Purpose**: Search the knowledge graph
- **Required Parameters**: `query` (string)
- **Optional Parameters**: `type` (string: 'dual'|'entities'|'semantic', default: 'dual'), `limit` (number, default: 10), `threshold` (number, default: 0.7)
- **Response**: `{ success, query, type, results, count }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: 
  - Uses DualSearch for comprehensive search
  - Falls back to entity or semantic search

#### GET /api/graph/export/{format} (export operation)
- **Purpose**: Export graph data in specified format
- **Route Parameters**: `format` (string: 'turtle'|'ntriples'|'jsonld'|'json')
- **Optional Parameters**: `filter` (object), `limit` (number)
- **Response**: `{ success, format, data, tripleCount, timestamp }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: 
  - Executes SPARQL CONSTRUCT query
  - Serializes results to requested format

#### POST /api/graph/enrich (enrich operation)
- **Purpose**: Enrich graph with embeddings and attributes
- **Optional Parameters**: `options` (object with enrichment settings)
- **Response**: `{ success, enrichment: { embeddings, attributes, communities } }`
- **Side Effects**: 
  - Adds embeddings to entities
  - Augments entities with attributes
  - Detects and stores communities
- **Internal Behavior**: 
  - Calls `enrichWithEmbeddings()`
  - Calls `augmentWithAttributes()`
  - Calls `aggregateCommunities()`

#### GET /api/graph/communities (communities operation)
- **Purpose**: Get communities from the graph
- **Optional Parameters**: `algorithm` (string: 'louvain'|'leiden', default: 'louvain'), `limit` (number, default: 50)
- **Response**: `{ success, communities: [{ id, members, size, cohesion }], algorithm, count }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: Uses CommunityDetection algorithms

#### POST /api/graph/pipeline (pipeline operation)
- **Purpose**: Run full ragno pipeline (decompose + enrich + communities + stats)
- **Required Parameters**: `text` (string) OR `chunks` (array)
- **Optional Parameters**: `options` (object with pipeline settings)
- **Response**: `{ success, pipeline: { decomposition, enrichment, communities, statistics } }`
- **Side Effects**: Combination of all above operations
- **Internal Behavior**: Sequential execution of decompose, enrich, communities, and stats

---

## ZPT Navigation API Endpoints

**Handler**: `ZptAPI` (`/flow/hyperdata/semem/src/api/features/ZptAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/navigate` | POST | Main navigation | Required | ✅ Active |
| `/api/navigate/preview` | POST | Navigation preview | Required | ✅ Active |
| `/api/navigate/options` | GET | Navigation options | None | ✅ Active |
| `/api/navigate/schema` | GET | Parameter schema | None | ✅ Active |
| `/api/navigate/health` | GET | ZPT health check | None | ✅ Active |

#### POST /api/navigate (navigate operation)
- **Purpose**: Main ZPT navigation operation for corpus traversal
- **Required Parameters**: `query` (string), `zoom` (string), `tilt` (string)
- **Optional Parameters**: `pan` (object), `transform` (object)
- **Response**: `{ success, navigation, content, metadata, diagnostics }`
- **Side Effects**: None (read-only analysis)
- **Internal Behavior**: 
  - Validates parameters with ParameterValidator
  - Normalizes with ParameterNormalizer
  - Executes navigation pipeline via NavigationEndpoint

#### POST /api/navigate/preview (preview operation)
- **Purpose**: Limited navigation processing for previewing results
- **Required Parameters**: Same as navigate but with limited processing
- **Response**: `{ success, preview: true, navigation, summary, corpuscles }`
- **Side Effects**: None (read-only)
- **Internal Behavior**: 
  - Lighter processing than full navigation
  - Returns first 5 corpuscles for preview

#### GET /api/navigate/options (options operation)
- **Purpose**: Get available navigation options and parameters
- **Parameters**: None
- **Response**: `{ success, options: { zoomLevels, tiltRepresentations, outputFormats, ... } }`
- **Side Effects**: None
- **Internal Behavior**: Returns static configuration options

#### GET /api/navigate/schema (schema operation)
- **Purpose**: Get parameter schema and examples
- **Parameters**: None
- **Response**: `{ success, schema, examples, documentation, defaults }`
- **Side Effects**: None
- **Internal Behavior**: Uses ParameterValidator.getSchema()

#### GET /api/navigate/health (health operation)
- **Purpose**: ZPT system health check
- **Parameters**: None
- **Response**: `{ success, health: { status, components, capabilities, activeRequests, metrics } }`
- **Side Effects**: None
- **Internal Behavior**: Checks status of all ZPT components

---

## Unified Search API Endpoints

**Handler**: `UnifiedSearchAPI` (`/flow/hyperdata/semem/src/api/features/UnifiedSearchAPI.js`)

| Endpoint | Method | Purpose | Authentication | Status |
|----------|--------|---------|----------------|--------|
| `/api/search/unified` | POST | Unified cross-service search | Required | ✅ Active |
| `/api/search/analyze` | POST | Analyze search query | Required | ✅ Active |
| `/api/search/services` | GET | Get available services | None | ✅ Active |
| `/api/search/strategies` | GET | Get search strategies | None | ✅ Active |

#### POST /api/search/unified (unified operation)
- **Purpose**: Search across all available services with intelligent routing and ranking
- **Required Parameters**: `query` (string)
- **Optional Parameters**: `limit` (number, default: 20), `strategy` (string, default: 'auto'), `services` (array), `weights` (object)
- **Response**: `{ success, query, strategy, analysis, servicesQueried, results, metadata }`
- **Side Effects**: None (read-only across all services)
- **Internal Behavior**: 
  - Analyzes query to determine optimal strategy
  - Executes searches across multiple services in parallel
  - Ranks and merges results using weighted scoring

#### POST /api/search/analyze (analyze operation)
- **Purpose**: Analyze search query to recommend strategy and services
- **Required Parameters**: `query` (string)
- **Response**: `{ success, query, analysis, recommendedStrategy, recommendedServices, estimatedRelevance }`
- **Side Effects**: None
- **Internal Behavior**: 
  - Uses regex patterns to classify query type
  - Recommends optimal search strategy and service selection

#### GET /api/search/services (services operation)
- **Purpose**: Get available search services and their capabilities
- **Parameters**: None
- **Response**: `{ success, services: { memory, ragno, search, zpt }, totalAvailable }`
- **Side Effects**: None
- **Internal Behavior**: Enumerates available service APIs and their capabilities

#### GET /api/search/strategies (strategies operation)
- **Purpose**: Get available search strategies and their use cases
- **Parameters**: None
- **Response**: `{ success, strategies: { entity-focused, concept-focused, ... }, defaultWeights }`
- **Side Effects**: None
- **Internal Behavior**: Returns static strategy definitions and default service weights

---

## Authentication & Security

**Middleware**: `/flow/hyperdata/semem/src/api/http/middleware/auth.js`

- **Authentication Method**: API key-based
- **Required Header**: `X-API-Key` or `Authorization: Bearer <token>`
- **Exempt Endpoints**: Health checks, options, schema, service discovery
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security Headers**: Helmet.js for security headers, CORS enabled

---

## Error Handling

**Middleware**: `/flow/hyperdata/semem/src/api/http/middleware/error.js`

- **Standard Error Format**: `{ success: false, error: "message", code?: "ERROR_CODE" }`
- **HTTP Status Codes**: Appropriate status codes (400, 401, 404, 429, 500)
- **Logging**: All errors logged with request IDs for tracing
- **Validation**: Parameter validation with detailed error messages

---

## Performance & Monitoring

### Metrics Collection
- Request duration, response status codes
- API operation counts and error rates
- Service availability and health status
- Cache hit/miss ratios where applicable

### Rate Limiting
- 100 requests per 15 minutes per IP for `/api/*` routes
- Configurable limits per service

### Caching
- LRU cache for embeddings and LLM responses
- Conversation state caching
- SPARQL query result caching (where implemented)

---

## Dependencies & Integration

### Core Dependencies
- **MemoryManager**: Semantic memory operations
- **LLMHandler**: Language model operations  
- **EmbeddingHandler**: Vector embedding operations
- **SPARQL Store**: Knowledge graph storage
- **Ragno**: Knowledge graph decomposition
- **ZPT**: Corpus navigation system

### External Services
- **SPARQL Endpoints**: Apache Fuseki or compatible
- **LLM Providers**: Ollama, Claude, Mistral
- **Embedding Providers**: Ollama, Nomic

---

## Current Status Summary

| Service | Endpoints | Implementation | Dependencies | Status |
|---------|-----------|----------------|--------------|--------|
| Memory API | 4 | Complete | MemoryManager, Storage | ✅ Fully Active |
| Chat API | 3 | Complete | LLMHandler, MemoryManager | ✅ Fully Active |
| Search API | 2 | Complete | SearchService (optional) | ✅ Fully Active |
| Ragno API | 8 | Complete | SPARQL, LLM, Embeddings | ✅ Fully Active |
| ZPT API | 5 | Complete | Corpus, SPARQL (optional) | ✅ Fully Active |
| Unified Search | 4 | Complete | All other APIs | ✅ Fully Active |
| System | 4 | Complete | Configuration | ✅ Fully Active |

**Total Endpoints**: 30 active endpoints across 6 API services

**Last Updated**: 2025-01-27