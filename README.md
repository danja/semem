# Semem

Semantic Memory for Intelligent Agents

**Status: 2025-03-29** a lot in place, a lot to do. Publishing now to the npm registry so I don't have to rename later.

[![codecov](https://codecov.io/gh/username/semem/branch/main/graph/badge.svg)](https://codecov.io/gh/username/semem)

## Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

## Features

- Semantic memory management
- Vector embeddings for similarity search
- Multiple storage backends (in-memory, JSON, SPARQL)
- Connector system for different LLM providers
- Context window management
- Concept extraction and organization

## Installation

```bash
npm install semem
```

## Usage

Basic usage example:

```javascript
import { MemoryManager } from 'semem';
import { OllamaConnector } from 'semem/connectors';

// Initialize a memory manager with Ollama
const llmProvider = new OllamaConnector();
const memoryManager = new MemoryManager({
  llmProvider,
  chatModel: 'qwen2:1.5b',
  embeddingModel: 'nomic-embed-text'
});

// Add an interaction to memory
await memoryManager.addInteraction(
  'What is semantic memory?',
  'Semantic memory stores general knowledge about the world, independent of personal experience.'
);

// Retrieve relevant past interactions
const retrievals = await memoryManager.retrieveRelevantInteractions('Tell me about memory systems');
```

## Development

### Setup

```bash
# Copy example environment file and configure API keys
cp example.env .env

# Install dependencies
npm install

# Install Ollama models (if using Ollama)
ollama pull nomic-embed-text
ollama pull qwen2:1.5b
```

### Testing

The project is currently migrating from Jasmine to Vitest for testing.

```bash
# Run Vitest tests
npm test

# Run specific test file
npm test -- tests/unit/MemoryManager.test.js

# Run tests with coverage
npm test:coverage
```

#### Testing Migration Status

We're in the process of migrating from Jasmine to Vitest. This offers better ESM support, improved performance, and a more modern developer experience.

- Core components already migrated:
  - MemoryManager
  - ContextWindowManager
  - EmbeddingHandler
  
- For guidance on migrating additional tests, see:
  - [Jasmine to Vitest Migration Guide](docs/jasmine-to-vitest-migration.md)

### Documentation

### API Documentation

The Semem library provides both programmatic and HTTP APIs:

- [API Plan](docs/api/api-plan.md) - Strategic plan for API exposure
- [OpenAPI Specification](docs/api/openapi-spec.yaml) - REST API specification
- [API Documentation README](docs/api/README.md) - Overview of API capabilities

### Code Documentation

```bash
# Generate JSDoc documentation
npm run docs
```

## Architecture

Semem has a layered architecture with the following key components:

1. **Memory Management Layer**
   - `MemoryManager`: Core class that coordinates memory operations
   - `ContextManager`: Manages context retrieval and window sizing
   - `ContextWindowManager`: Handles text chunking and window management

2. **Storage Layer**
   - `BaseStore`: Abstract base class for all storage backends
   - `MemoryStore`: In-process memory management
   - `InMemoryStore`: Transient in-memory storage
   - `JSONStore`: Persistent storage using JSON files
   - `SPARQLStore`: RDF-based storage with SPARQL endpoints
   - `CachedSPARQLStore`: Optimized version with caching

3. **Handlers Layer**
   - `EmbeddingHandler`: Manages vector embeddings generation and processing
   - `LLMHandler`: Orchestrates language model interactions
   - `CacheManager`: Provides caching for improved performance

4. **API Layer**
   - Multiple interface types (HTTP, CLI, REPL)
   - `APIRegistry`: Central service registry
   - Request handling via active/passive handlers
   - [API documentation](docs/api/README.md) for REST and SDK interfaces

5. **Connector Layer**
   - `ClientConnector`: Base connector class
   - Provider-specific connectors (Ollama, Claude, etc.)

## Requirements

- Node.js 20.11.0+
- SPARQL endpoint (Apache Fuseki) for SPARQL-based storage
- Ollama or compatible LLM service
- API keys for various LLM providers (configured in .env)

## License

MIT