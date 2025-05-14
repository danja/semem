# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

It uses ES modules and will use Vitest for tests.

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