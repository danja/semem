# Semem Functionality Demos

This directory contains comprehensive demos to test and verify Semem's claimed functionality. Each demo is a standalone script that tests specific features and capabilities.

## Prerequisites

Before running the demos, ensure you have:

1. **Node.js 20.11.0+** installed
2. **Ollama running locally** (for most demos):
   ```bash
   ollama serve
   ollama pull qwen2:1.5b
   ollama pull nomic-embed-text
   ```
3. **Environment configured** (copy `example.env` to `.env` and add API keys if testing external providers)
4. **SPARQL endpoint** (optional, for RDF/SPARQL demos):
   ```bash
   # Example using Apache Fuseki
   docker run -p 3030:3030 stain/jena-fuseki
   ```

## Demo Scripts

### 1. Basic Memory Storage (`01-memory-basic.js`)

**Tests:** Core memory functionality with storage and retrieval

```bash
node demos/01-memory-basic.js
```

**What it tests:**
- Memory initialization with Ollama connector
- Storage of interactions with embeddings and concepts
- Semantic retrieval based on similarity
- Response generation using memory context
- JSON file persistence

**Expected output:**
- ✅ Successfully stores and retrieves 3 sample interactions
- Shows similarity scores and concept extraction
- Demonstrates memory-informed response generation

### 2. SPARQL Integration (`02-sparql-integration.js`)

**Tests:** RDF/SPARQL storage backend functionality

```bash
node demos/02-sparql-integration.js
```

**Prerequisites:** SPARQL endpoint running on localhost:4030 or localhost:3030

**What it tests:**
- SPARQL endpoint connectivity and authentication
- RDF triple storage for semantic memory
- Semantic querying with vector similarity
- Data persistence across sessions
- Integration with semantic web standards

**Expected output:**
- ✅ Connects to available SPARQL endpoint
- Stores memory as RDF triples
- Retrieves semantic data with similarity rankings

### 3. HTTP API (`03-http-api.js`)

**Tests:** REST API endpoints for memory, chat, search, and system operations

```bash
# First start the API server
node servers/api-server.js

# Then run the demo (in another terminal)
node demos/03-http-api.js
```

**What it tests:**
- API health and status endpoints
- Memory storage and retrieval operations
- Vector embedding generation
- Concept extraction from text
- Chat with memory context
- Semantic search functionality
- System metrics and monitoring

**Expected output:**
- ✅ All API endpoints respond correctly
- Memory operations work via HTTP
- Chat generates responses with context

### 4. LLM Provider Integration (`04-llm-providers.js`)

**Tests:** Different LLM providers (Ollama, Claude, Mistral) with the memory system

```bash
node demos/04-llm-providers.js
```

**What it tests:**
- Provider connectivity and authentication
- Chat response generation
- Vector embedding generation
- Concept extraction capabilities
- Memory system integration
- Error handling and fallback mechanisms

**Expected output:**
- ✅ Shows which providers are available and working
- Tests each provider's capabilities
- Provides recommendations based on results

### 5. Semantic Search (`05-semantic-search.js`)

**Tests:** Vector similarity search and content retrieval capabilities

```bash
node demos/05-semantic-search.js
```

**What it tests:**
- Vector embedding-based similarity search
- Content indexing and retrieval from memory
- SPARQL-based semantic search (if available)
- Article search with vector indexes
- Search performance and similarity ranking
- Multi-modal content search capabilities

**Expected output:**
- ✅ Indexes sample content and performs semantic queries
- Shows similarity rankings and search performance
- Tests different search backends

### 6. MCP Server (`06-mcp-server.js`)

**Tests:** Model Context Protocol server functionality

```bash
# First start the MCP server
node mcp-server.js

# Then run the demo (in another terminal)
node demos/06-mcp-server.js
```

**What it tests:**
- MCP server discovery and capabilities
- Memory management tools (add, retrieve)
- Embedding generation tools
- Concept extraction tools
- Resource access (stats, config, info)
- Prompt template system
- Batch operations and session management

**Expected output:**
- ✅ Connects to MCP server
- Tests all MCP tools and resources
- Demonstrates batch operations

### 7. Context Management (`07-context-management.js`)

**Tests:** Context window management and text processing

```bash
node demos/07-context-management.js
```

**What it tests:**
- Text chunking and window creation
- Token estimation and size calculation
- Overlapping content merging
- Context buffer management and pruning
- Context summarization and building
- Memory-context integration
- Long context handling
- Edge cases and error handling

**Expected output:**
- ✅ Successfully processes text windows
- Demonstrates context management features
- Shows memory-context integration

## Running All Demos

To run all demos in sequence:

```bash
# Make the run script executable
chmod +x demos/run-all.sh

# Run all demos
./demos/run-all.sh
```

Or run them individually to focus on specific functionality.

## Data Directory

Demos that create persistent data will store it in `./demos/data/`:
- `basic-memory.json` - JSON store from basic memory demo
- Other demo-specific data files

This directory is created automatically and can be safely deleted between test runs.

## Troubleshooting

### Common Issues

1. **Ollama Connection Errors:**
   ```bash
   ollama serve
   # Check if running: curl http://localhost:11434/api/version
   ```

2. **Missing Models:**
   ```bash
   ollama pull qwen2:1.5b
   ollama pull nomic-embed-text
   ```

3. **API Server Not Running:**
   ```bash
   node servers/api-server.js
   # Check: curl http://localhost:4100/api/health
   ```

4. **SPARQL Endpoint Issues:**
   - Ensure endpoint is running on correct port
   - Check authentication credentials
   - Verify graph permissions

5. **Memory/Performance Issues:**
   - Reduce test data size for large demos
   - Ensure sufficient system memory
   - Check for resource leaks in long-running tests

### Expected Failures

Some demos may show warnings or skip tests for missing components:
- ⚠️ SPARQL demos skip if no endpoint available
- ⚠️ LLM provider tests skip if API keys missing
- ⚠️ MCP demos skip if server not running

This is expected behavior - the demos test what's available and report what's missing.

## Interpreting Results

### Success Indicators
- ✅ Green checkmarks indicate successful operations
- Numerical results (similarity scores, dimensions, etc.)
- Actual content generation (embeddings, responses, etc.)

### Partial Success
- ⚠️ Yellow warnings for missing optional components
- Graceful degradation when services unavailable
- Clear error messages with troubleshooting steps

### Failure Indicators
- ❌ Red X marks indicate failed operations
- Error stack traces for debugging
- Specific troubleshooting instructions

Each demo provides detailed output about what was tested and what works, helping you understand Semem's actual capabilities versus claimed functionality.