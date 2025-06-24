# Manual MCP Tool Commands

These are the exact commands you can type to test the Semem MCP tools with remote Mistral + Nomic providers.

## Method 1: Interactive JSON-RPC Client

```bash
cd /flow/hyperdata/semem/examples/mcp
node SimpleJSONRPC.js
```

Then type:
- `list` - Show all available tools
- `store` - Store a test memory 
- `embed` - Generate embedding with Nomic API
- `concepts` - Extract concepts with Mistral API
- `search` - Search stored memories
- `quit` - Exit

## Method 2: Shell Script with All Tests

```bash
cd /flow/hyperdata/semem/examples/mcp
./CurlExamples.sh
```

## Method 3: Direct Tool Testing

```bash
cd /flow/hyperdata/semem/examples/mcp
node DirectToolTest.js
```

## Method 4: Manual JSON-RPC Commands

### List Available Tools
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node ../../mcp/index.js
```

### Store Memory (Mistral + Nomic)
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"semem_store_interaction","arguments":{"prompt":"What is AI?","response":"AI is machine intelligence that can learn and solve problems.","metadata":{"topic":"ai"}}}}' | node ../../mcp/index.js
```

### Generate Embedding (Nomic API)
```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"semem_generate_embedding","arguments":{"text":"Knowledge graphs connect data through relationships"}}}' | node ../../mcp/index.js
```

### Extract Concepts (Mistral API)
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"semem_extract_concepts","arguments":{"text":"Neural networks process information through layers"}}}' | node ../../mcp/index.js
```

### Search Memories
```bash
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"semem_retrieve_memories","arguments":{"query":"artificial intelligence","threshold":0.7,"limit":3}}}' | node ../../mcp/index.js
```

### Knowledge Graph Decomposition (Ragno)
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"ragno_decompose_corpus","arguments":{"textChunks":["Machine learning uses data to train algorithms"],"options":{"maxEntities":5}}}}' | node ../../mcp/index.js
```

## Expected Provider Usage

These commands will demonstrate:

- ✅ **Mistral API** (`mistral-small-latest`) for:
  - Concept extraction from text
  - Chat completions in memory storage
  - Knowledge graph entity identification

- ✅ **Nomic API** (`nomic-embed-text-v1.5`) for:
  - Vector embedding generation (1536 dimensions)
  - Semantic similarity calculations
  - Memory search indexing

- ✅ **SPARQL Storage** for:
  - Persistent memory storage
  - RDF-based knowledge graphs
  - Vector similarity queries

## Verification Points

Each command verifies:
1. Remote API connectivity (not local Ollama)
2. Proper provider selection based on config.json priorities
3. Integration between chat and embedding providers
4. SPARQL backend functionality
5. MCP protocol compliance