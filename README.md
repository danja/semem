# Semem

**Status: 2025-05-14** a lot in place, a lot to do. Added a bit of UI for sanity checking. I still need to tidy up the latest spike with Claude Code. 

I'm planning to have something potentially usable by summer solstice 2025.

## Semantic Memory for Intelligent Agents

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/danja/semem)

It's meant as a bit of infrastructure, Graph RAG with a SPARQL store, a bit of embeddings, a bit of behind the scenes LLM interaction to do some knowledgegraph business. Set up as HTTP APIs. MCP is in there, but right now I'm mostly targetting my own kit, bit more generalized & webby. 

Docs below courtesy Claude.
 
[![tests](https://img.shields.io/github/actions/workflow/status/danja/semem/test.yml?branch=main&label=tests&style=flat-square)](https://github.com/danja/semem/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/semem?style=flat-square)](https://www.npmjs.com/package/semem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

```sh
./start.sh

./stop.sh
```

 1. For development: Run npm run dev for hot-reloading dev server
 2. For production: Run npm run build && npm start
 3. Watch mode: Run npm run build:watch to rebuild on changes
  
  npm stop

  ```sh
  Bash(netstat -tulpn 2>/dev/null | grep :9000)…
  ⎿  tcp6       0      0 :::9000                 :::*                    LISTEN      952322/webpack

  Bash(kill -9 952322)…
```

curl -s http://localhost:4100/api/config | python3 -m json.tool

## Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

## Features

- Semantic memory management
- Vector embeddings for similarity search
- Multiple storage backends (in-memory, JSON, SPARQL)
- Connector system for different LLM providers
- Context window management
- Concept extraction and organization

---

## Demo: LLM + SPARQL Integration (`examples/OllamaExample.js`)

This demo script shows how to use Semem with a SPARQL backend and an Ollama LLM connector for prompt/response memory, embeddings, and concept extraction.

### Prerequisites
- Node.js (v18+ recommended)
- Running SPARQL backend (e.g., Apache Jena Fuseki)
  - Local: `http://localhost:4030/semem/query` and `/update`
  - Remote: `http://fuseki.hyperdata.it/semem/query` and `/update`
- Ollama server running locally (default: `http://localhost:11434`)
- Model: `qwen2:1.5b` for chat, `nomic-embed-text` for embeddings

### Running the Demo

1. **Start your SPARQL backend** (e.g., Jena Fuseki on port 4030 or use the provided remote endpoint).
2. **Start Ollama** with the required models available.
3. **Run the example script:**
   ```sh
   node examples/OllamaExample.js
   ```
   The script will automatically test the local SPARQL endpoint first, and fall back to the remote endpoint if the local one is not available. You can easily switch endpoints by editing the `sparqlEndpoints` block at the top of `OllamaExample.js`.

4. **Expected Output:**
   - The script will connect to the SPARQL backend, verify the graph, and interact with the Ollama LLM.
   - It will log which SPARQL endpoint is in use and show memory operations.

### Troubleshooting
- If you see connection errors, ensure your SPARQL and Ollama servers are running and accessible at the configured URLs.
- You can change the SPARQL endpoint URLs in `OllamaExample.js` to point to your preferred backend.
- For authentication, default credentials are `admin`/`admin123`.
- For more details on SPARQL queries and RDF terms, see `docs/ragno/`.

---

## Storage Configuration

Semem supports multiple storage backends that can be configured in `config.json`:

### In-Memory Storage (default)
```json
{
  "storage": {
    "type": "in-memory",
    "options": {}
  }
}
```
*Note: Data is lost when the application stops*

### JSON File Storage
```json
{
  "storage": {
    "type": "json",
    "options": {
      "filePath": "./data/memories.json"
    }
  }
}
```
*Persists data to a JSON file at the specified path*

### SPARQL Storage
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "endpoint": "https://fuseki.hyperdata.it/semem",
      "graphName": "http://danny.ayers.name/content",
      "user": "admin",
      "password": "admin123"
    }
  }
}
```
*Stores data in a SPARQL endpoint*
- HTTP API with browser-based interface

## Quickstart

*I've only tested properly against a local Ollama model to do the embeddings, unlikely anything else will work.*

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
- [MCP Server](docs/mcp-server.md) - Using the Model Context Protocol (MCP) server


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

## Experimental Features

### Model Context Protocol (MCP) Support

Semem has experimental support for Anthropic's [Model Context Protocol (MCP)](https://docs.anthropic.com/en/docs/agents-and-tools/mcp) - an open standard that allows AI models to access external data sources.

This feature is under development and may not work in all environments, but you can try it:

```bash
# Start the MCP server
npm run mcp-server

# Run the MCP client example
npm run mcp-example

# Test the MCP server
npm run mcp-test
```

MCP implementation provides:
- **Tools**: Memory operations like add, retrieve, search
- **Resources**: Data source access for stats and configuration
- **Prompts**: Templates for common memory tasks

For details, see the [MCP Server Documentation](docs/mcp-server.md).

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