# Semem System Overview

## Purpose
Semem is a semantic memory system built to provide AI applications with persistent, queryable storage of conversational interactions. It integrates LLM capabilities with RDF/SPARQL storage while maintaining a flexible API layer supporting multiple access modes.

## Documentation Index
- [System Architecture](architecture.md) - Component architecture and interactions
- [Storage Layer](storage.md) - Storage implementation details and patterns
- [Memory Management](memory.md) - Memory handling and retrieval algorithms
- [API Layer](api.md) - API infrastructure and access modes
- [Configuration](config.md) - System configuration and deployment
- [Development](development.md) - Development guides and best practices

## Core Components

### Memory Management
- Central MemoryManager orchestrating operations
- Interaction storage/retrieval with vector similarity
- Concept extraction and semantic clustering
- Memory classification (short/long-term)
- Context management for conversations

### Storage Layer
- Pluggable storage architecture
- Multiple backends (In-Memory, JSON, SPARQL)
- Transaction support with rollback
- Caching layer for performance
- Federation capabilities

### API Layer
- Multiple interface options (CLI, REPL, HTTP)
- Event-driven architecture
- Comprehensive monitoring
- Security middleware
- OpenAPI documentation

### LLM Integration
- Multiple provider support (Ollama, Anthropic)
- Configurable model selection
- Embedding generation/caching
- Prompt template management
- Context window optimization

## Key Features
1. Semantic Memory
   - Vector similarity search
   - Concept relationship tracking
   - Memory decay/reinforcement
   - Context-aware retrieval

2. Storage Options
   - In-memory for development
   - JSON file persistence
   - SPARQL/RDF for production
   - Caching optimization

3. Access Methods
   - Command-line interface
   - Interactive REPL
   - REST API endpoints
   - WebSocket real-time
   - RDF query language

4. System Features
   - Transaction support
   - Backup/recovery
   - Federation support
   - Comprehensive monitoring
   - Security controls

## Technical Stack
- Node.js (20.11.0+)
- ES Modules
- SPARQL/RDF
- WebSocket
- OpenTelemetry
- Jasmine Testing