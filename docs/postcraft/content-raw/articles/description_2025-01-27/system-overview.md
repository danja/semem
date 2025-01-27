# Semem System Overview

## Purpose
Semem is a semantic memory system that integrates LLM capabilities with RDF/SPARQL storage. It provides a flexible API layer supporting multiple access modes and comprehensive monitoring.

## Core Components

### Memory Management Layer
- `src/MemoryManager.js`: Central coordinator for memory operations
- `src/ContextManager.js`: Manages context windows and memory retrieval
- `src/ContextWindowManager.js`: Handles text segmentation and context window sizing
- `src/Config.js`: System-wide configuration management

### Storage Layer (src/stores/)
- Base storage abstraction with multiple implementations:
  - `SPARQLStore.js`: RDF triple store integration
  - `CachedSPARQLStore.js`: Caching layer for SPARQL operations
  - `JSONStore.js`: File-based storage
  - `InMemoryStore.js`: Volatile memory storage

### API Layer (src/api/)
Multiple interfaces for system access:
- Common:
  - `BaseAPI.js`: Abstract base for all API implementations
  - `APIRegistry.js`: Service discovery and registration
  - `APILogger.js`: Unified logging system
  - `MetricsCollector.js`: Performance monitoring
- Features:
  - `ActiveHandler.js`: Complex operations combining multiple services
  - `PassiveHandler.js`: Basic storage and retrieval operations
  - `SelfieHandler.js`: System monitoring and metrics
- Interfaces:
  - `CLIHandler.js`: Command line interface
  - `REPLHandler.js`: Interactive shell
  - `HTTPServer.js`: REST API and WebSocket support

### LLM Integration (src/handlers/)
- `LLMHandler.js`: LLM interaction management
- `EmbeddingHandler.js`: Vector embedding generation and management
- `CacheManager.js`: Caching for LLM operations

### Utilities (src/utils/)
- `EmbeddingValidator.js`: Validation for vector embeddings
- `SPARQLHelpers.js`: SPARQL query utilities
- `FusekiDiscovery.js`: SPARQL endpoint discovery

## Key Concepts

### Memory Types
- Short-term memory: Recent interactions stored with embeddings
- Long-term memory: Archived interactions with concept indexing
- Semantic memory: RDF-based knowledge representation

### Storage Architecture
- Primary storage in SPARQL/RDF
- Caching layer for performance
- Transaction support with backup/restore
- Federation capabilities

### API Design
- Event-driven architecture
- Pluggable storage backends
- Multiple access modes
- Comprehensive monitoring

## Data Flow
1. Input received through API interfaces
2. ActiveHandler coordinates processing
3. LLM generates embeddings/responses
4. Memory operations managed by MemoryManager
5. Storage handled by appropriate store implementation
6. Metrics collected throughout process

## Deployment Requirements
- Node.js 20.11.0+
- SPARQL endpoint (e.g., Fuseki)
- Ollama or compatible LLM service
- Optional monitoring infrastructure