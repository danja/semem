# Semem

**Semantic Memory for Intelligent Agents**

I'm planning to have something potentially usable by summer solstice 2025.

**Status: 2025-05-14** a lot in place, a lot to do. Added a bit of UI for sanity checking. I still need to tidy up the latest spike with Claude Code. 

Docs below courtesy Claude.
 
[![tests](https://img.shields.io/github/actions/workflow/status/danja/semem/test.yml?branch=main&label=tests&style=flat-square)](https://github.com/danja/semem/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/danja/semem/branch/main/graph/badge.svg)](https://codecov.io/gh/danja/semem)
[![npm version](https://img.shields.io/npm/v/semem?style=flat-square)](https://www.npmjs.com/package/semem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

## Features

- Semantic memory management
- Vector embeddings for similarity search
- Multiple storage backends (in-memory, JSON, SPARQL)
- Connector system for different LLM providers
- Context window management
- Concept extraction and organization
- HTTP API with browser-based interface

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

## Quickstart

Get up and running quickly with Semem:

```bash
# Setup environment and dependencies
cp example.env .env
npm install

# Install Ollama models (if using Ollama)
ollama pull nomic-embed-text
ollama pull qwen2:1.5b

# Start both API and UI servers in the background
./start.sh

# Access the web interface
open http://localhost:3000

# Stop the servers when finished
./stop.sh
```

## Running the Server

There are multiple ways to run the Semem server:

```bash
# Option 1: Start both API and UI servers in background (with logging)
./start.sh

# Option 2: Start only the API server directly
node api-server.js

# Option 3: Start only the UI server directly
node ui-server.js

# Option 4: Using the restart script (includes health check)
chmod +x restart-server.sh
./restart-server.sh
```

The start.sh script provides:
- Runs both API and UI servers in the background
- Redirects output to log files for easy monitoring
- Saves PIDs for easy shutdown later

The restart-server.sh script provides:
- Automatically stops any running server processes
- Creates a .env file if missing
- Starts the server with output logging
- Performs a health check after starting
- Displays detailed status information

The server will start on port 3000 by default (or the port specified in your `.env` file with the PORT environment variable).

## Using the Web Interface

Once the server is running, you can access the web interface at:

```
http://localhost:3000
```

The interface provides access to all Semem APIs:

1. **Search**: Search content using semantic similarity
2. **Memory**: Store and retrieve interactions from semantic memory
3. **Chat**: Interact with AI using memory context (standard and streaming)
4. **Embeddings**: Generate vector embeddings for text
5. **Concepts**: Extract semantic concepts from text
6. **Index**: Add content to the semantic search index

### Port Configuration

The browser interface automatically detects if it's running on a different port than the API server (port 3000). If you access the interface on a different port, it will automatically adjust its API calls to target port 3000. This is helpful during development or when using different server configurations.

The interface also provides detailed connectivity information and troubleshooting features:
- Status indicator showing connection state
- Detailed console logging for debugging
- Auto-retry capability for failed connections
- Specific error messages based on connection issues

For detailed guidance on using the browser interface, see the [Browser Interface documentation](docs/api/browser-interface.md).

## API Documentation

The Semem library provides both programmatic and HTTP APIs:

- [API Overview](docs/api/README.md) - Overview of API capabilities and implementation status
- [API Plan](docs/api/api-plan.md) - Strategic plan for API exposure
- [OpenAPI Specification](docs/api/openapi-spec.yaml) - REST API specification
- [Implementation Status](docs/api/implementation-status.md) - Current status of API implementation
- [Browser Interface](docs/api/browser-interface.md) - Guide to using the web-based API interface

### API Endpoints

The API provides the following key endpoints:

#### Memory Management
- `POST /api/memory` - Store interactions in memory
- `GET /api/memory/search` - Retrieve relevant memories based on query
- `POST /api/memory/embedding` - Generate embeddings for text
- `POST /api/memory/concepts` - Extract concepts from text

#### Chat and Completion
- `POST /api/chat` - Generate responses with memory context
- `POST /api/chat/stream` - Stream responses with memory context
- `POST /api/completion` - Generate text completions with memory context

#### Semantic Search
- `GET /api/search` - Search content using vector similarity
- `POST /api/index` - Index content for searching

#### System Endpoints
- `GET /api/health` - Check API health status
- `GET /api/metrics` - Get API metrics and statistics

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