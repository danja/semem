# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

It uses ES modules and Vitest for tests.

## Commands

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

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- tests/unit/Config.spec.js

# Run tests with coverage
npm test:coverage

# Generate HTML coverage report
npm test:report

# Check coverage thresholds
npm test:check
```

### Documentation

```bash
# Generate JSDoc documentation
npm run docs
```

### Repository Tools

```bash
# Run repomix with configurations
npm run rp
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

5. **Connector Layer**
   - `ClientConnector`: Base connector class
   - Provider-specific connectors (Ollama, Claude, etc.)

6. **Ragno Layer (Knowledge Graph Integration)**
   - `Entity`: RDF-based entities extracted from text
   - `SemanticUnit`: Independent semantic units from corpus decomposition  
   - `Relationship`: First-class relationship nodes between entities
   - `RDFGraphManager`: Manages RDF graph operations
   - `decomposeCorpus`: Main function for text-to-RDF decomposition
   - Uses Ragno vocabulary (http://purl.org/stuff/ragno/) for RDF modeling

## Requirements

- Node.js 20.11.0+
- SPARQL endpoint (Apache Fuseki) for SPARQL-based storage
- Ollama or compatible LLM service
- API keys for various LLM providers (configured in .env)

## Working with the Codebase

- Always initialize Config instances before use
- Properly dispose of resources when finished (especially MemoryManager)
- Use appropriate storage backend for the specific use case
- Respect semantic versioning in any changes or contributions
- Follow the existing coding patterns for new functionality

## Common Issues and Solutions

### LLMHandler Method Names
- Use `generateResponse(prompt, context, options)` for chat completion
- Use `extractConcepts(text)` for concept extraction
- Do NOT use `generateCompletion()` - this method doesn't exist

### Entity Constructor Patterns
- Entity constructor: `new Entity({ name, isEntryPoint, subType, ... })`
- Do NOT pass `rdfManager` as first parameter to Entity constructor
- Entity methods: `getPrefLabel()`, `isEntryPoint()`, `getSubType()`

### SPARQLStore Methods
- Use `store(data)` to save entities/memory items with embeddings
- Use `search(queryEmbedding, limit, threshold)` for similarity search
- Data format: `{ id, prompt, response, embedding, concepts, metadata }`
- SPARQLStore supports cosine similarity search with embedded vectors

### Ragno Integration
- Use `decomposeCorpus(textChunks, llmHandler, options)` for text decomposition
- Returns: `{ units, entities, relationships, dataset }`
- Ragno classes follow RDF-Ext patterns with proper ontology compliance
- All Ragno elements export to RDF dataset via `exportToDataset(dataset)`

### Ollama Models
- Embedding model: `nomic-embed-text` (1536 dimensions)
- Chat model: `qwen2:1.5b` (commonly available, fast)
- Verify models are installed: `ollama list`

### Example Workflows
- See `examples/MistralExample.js` for complete Ragno pipeline demo
- Demonstrates: corpus decomposition → entity extraction → SPARQL storage → retrieval