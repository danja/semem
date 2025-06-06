# Semem

Semem is a modular, extensible semantic memory and graph augmentation system for LLMs, agents, and research. It provides a unified pipeline for entity extraction, embedding, semantic search, SPARQL/RDF graph operations, LLM-powered augmentation, and community detection.

---

## 🚀 Latest Developments (May 2025)

- **Interactive ES Module REPL:**  
  Explore all MCP endpoints interactively with [`examples/REPL.js`](./examples/REPL.js).  
  See a sample session in [`INTERACTIONS.md`](./INTERACTIONS.md).

- **Live MCP Endpoints:**  
  All Semem & Ragno pipeline facilities are now exposed as live, schema-validated JSON-RPC services, including LLM, embedding, SPARQL, semantic search, graph augmentation, and community detection.

- **Agent & LLM Integration:**  
  [`PROMPTS.md`](./PROMPTS.md) provides ready-to-use prompt templates for LLMs/agents.  
  All endpoints are designed for programmatic invocation and agent workflows.

- **Testing & Robustness:**  
  Integration tests for all endpoints in [`examples/mcpClient.test.js`](./examples/mcpClient.test.js).  
  Full evaluation and recommendations in [`REPORT.md`](./REPORT.md).

---

## ⚡ Quick Start

1. **Install dependencies:**  
   ```bash
   npm install
   ```
2. **Start the MCP server:**  
   ```bash
   node src/servers/mcp.js
   ```
3. **Launch the interactive REPL:**  
   ```bash
   node examples/REPL.js
   ```
4. **Try endpoints:**  
   - See [`INTERACTIONS.md`](./INTERACTIONS.md) for example sessions.
   - Use [`PROMPTS.md`](./PROMPTS.md) for LLM/agent prompt templates.

---

## 🧠 Key Features

- **Unified Memory Control Protocol (MCP):** JSON-RPC 2.0 API for all memory, graph, and compute resources
- **Live Compute Endpoints:** LLM completions, embeddings, SPARQL, semantic search, graph augmentation, community detection
- **Agent/LLM-Ready:** Prompt templates and robust schema validation for seamless integration
- **Extensible:** Modular design, easy to add new pipelines or endpoints

---

## 📚 Documentation & Resources

- [INTERACTIONS.md](./INTERACTIONS.md): Example REPL conversations
- [REPORT.md](./REPORT.md): Test report and recommendations
- [PROMPTS.md](./PROMPTS.md): Prompt templates for LLM/agent integration
- [examples/REPL.js](./examples/REPL.js): Interactive ES module REPL
- [examples/mcpClient.test.js](./examples/mcpClient.test.js): Integration tests
- [docs/ragno/PLAN2-progress.md](./docs/ragno/PLAN2-progress.md): Progress log

For full details, see the documentation in `docs/`.

---

## Demo: Ragno Pipeline (`examples/RagnoPipelineDemo.js`, `examples/RagnoSPARQLDemo.js`)

These demo scripts show the end-to-end Ragno pipeline for semantic graph construction, augmentation, community detection, enrichment, and SPARQL export.

- **`examples/RagnoPipelineDemo.js`**: Runs the full pipeline from decomposition to community detection and enrichment, printing each stage's output.
- **`examples/RagnoSPARQLDemo.js`**: Shows how to export attribute, community, and similarity link data to a SPARQL triple store (using dummy endpoints/auth for demonstration).

### How to Run

```sh
node examples/RagnoPipelineDemo.js
node examples/RagnoSPARQLDemo.js
```

See the code and comments in each file for details on how to adapt for your own data and endpoints.

---

## Experimental: Model Context Protocol (MCP) Support

Semem implements Anthropic's [Model Context Protocol (MCP)](https://docs.anthropic.com/en/docs/agents-and-tools/mcp), enabling LLMs and agents to access all memory and graph resources programmatically.

---

## License

MIT

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

---

## Demo: Ragno Pipeline (`examples/RagnoPipelineDemo.js`, `examples/RagnoSPARQLDemo.js`)

These demo scripts show the end-to-end Ragno pipeline for semantic graph construction, augmentation, community detection, enrichment, and SPARQL export.

- **`examples/RagnoPipelineDemo.js`**: Runs the full pipeline from decomposition to community detection and enrichment, printing each stage's output.
- **`examples/RagnoSPARQLDemo.js`**: Shows how to export attribute, community, and similarity link data to a SPARQL triple store (using dummy endpoints/auth for demonstration).

### How to Run

```sh
node examples/RagnoPipelineDemo.js
node examples/RagnoSPARQLDemo.js
```

See the code and comments in each file for details on how to adapt for your own data and endpoints.

---

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