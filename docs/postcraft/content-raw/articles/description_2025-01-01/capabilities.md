# Semem Capabilities Overview

Semem is a semantic memory system designed for AI applications that provides persistent, queryable storage of conversations and interactions. It combines embedding-based similarity search with semantic understanding.

## Core Features

### Memory Management
- Short-term and long-term memory storage
- Automatic memory classification and decay
- Concept extraction from interactions
- Semantic clustering of related memories
- Context window management for large conversations

### AI Integration
- Supports multiple LLM providers (Ollama, OpenAI)
- Embedding generation for semantic search
- Configurable models for chat and embeddings
- Prompt template management for different models

### Storage Options
- In-memory storage for testing/development
- JSON file-based persistent storage
- SPARQL-based semantic triple store
- Cached SPARQL store with automatic cleanup

### Advanced Features
- Transaction support with rollback capability 
- Backup and recovery mechanisms
- Federation across multiple SPARQL endpoints
- Memory clustering and concept relationships
- Automatic decay and reinforcement of memories

## Configuration
The system is highly configurable, supporting:
- Custom storage backends
- Multiple LLM providers
- Adjustable memory parameters
- SPARQL endpoint configuration
- Context window sizes