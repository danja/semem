# Semem Architecture

## Core Components

### Memory Manager
The central component that orchestrates all memory operations. It handles:
- Interaction storage and retrieval
- Embedding generation and caching
- Concept extraction
- Memory classification

### Storage Layer
Implements a pluggable storage architecture with multiple backends:
- BaseStore: Abstract interface for storage implementations
- InMemoryStore: RAM-based storage for testing
- JSONStore: File-based persistent storage
- SPARQLStore: Semantic triple store integration
- CachedSPARQLStore: Performance-optimized SPARQL storage

### Context Management
Manages conversation context through:
- Window size calculation
- Content overlap handling
- Token counting
- Context pruning

### LLM Integration
Provides abstracted access to language models:
- OllamaConnector: Integration with local Ollama models
- Configurable model selection
- Prompt template management
- Embedding generation

### Memory Processing
Sophisticated memory handling through:
- Vector similarity search
- Semantic clustering
- Concept graph maintenance
- Decay and reinforcement mechanisms

## Data Flow
1. New interactions are processed for embedding generation
2. Concepts are extracted using LLM
3. Memory is stored with metadata
4. Retrieval combines embedding similarity and concept matching
5. Context is managed for optimal interaction