# Semem MCP Server

This MCP (Model Context Protocol) server provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing.

## Features

### Semem Core API Tools
- `semem_store_interaction` - Store new interactions with embeddings and concepts
- `semem_retrieve_memories` - Search for relevant memories based on similarity
- `semem_generate_response` - Generate responses using memory context
- `semem_generate_embedding` - Generate vector embeddings for text
- `semem_extract_concepts` - Extract semantic concepts from text

### Ragno Knowledge Graph Tools
- `ragno_decompose_corpus` - Decompose text corpus into RDF entities and relationships
- `ragno_create_entity` - Create new RDF entities with ontology compliance
- `ragno_create_semantic_unit` - Create semantic text units with metadata

### ZPT (Zero-Point Traversal) Tools  
- `zpt_select_corpuscles` - Intelligent content selection with various strategies
- `zpt_chunk_content` - Advanced content chunking with semantic boundaries

### Resources
- `semem://status` - System status and health information

## Usage

### Starting the Server

```bash
# Start with stdio transport (for use with MCP clients)
node mcp/index.js

# Test with MCP inspector
npx @modelcontextprotocol/inspector node mcp/index.js

# Custom ports if defaults are in use
CLIENT_PORT=8080 SERVER_PORT=9000 npx @modelcontextprotocol/inspector node mcp/index.js
```

### Testing

```bash
# Run the test script
node mcp/test-server.js
```

### Configuration

The server requires:
- A valid `config/config.json` file with LLM provider settings
- Environment variables for API keys (see main project `.env` file)
- Node.js 20.11.0+

### Example Tool Calls

#### Store an Interaction
```json
{
  "name": "semem_store_interaction",
  "arguments": {
    "prompt": "What is machine learning?",
    "response": "Machine learning is a subset of artificial intelligence...",
    "metadata": {"topic": "AI", "difficulty": "beginner"}
  }
}
```

#### Retrieve Memories
```json
{
  "name": "semem_retrieve_memories", 
  "arguments": {
    "query": "artificial intelligence",
    "threshold": 0.7,
    "limit": 5
  }
}
```

#### Decompose Text Corpus
```json
{
  "name": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": ["AI is transforming technology.", "Machine learning enables pattern recognition."],
    "options": {"maxEntities": 50, "extractRelationships": true}
  }
}
```

#### Chunk Content
```json
{
  "name": "zpt_chunk_content",
  "arguments": {
    "content": "Long text to be chunked...",
    "options": {"method": "semantic", "chunkSize": 1000, "overlap": 100}
  }
}
```

## Integration

### Claude Desktop
Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["path/to/semem/mcp/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Other MCP Clients
The server follows the standard MCP protocol and should work with any compatible client using stdio transport.

## Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `zod` - Schema validation
- Semem core modules (automatically imported from parent project)

## Architecture

The MCP server acts as a bridge between the MCP protocol and the Semem APIs:

```
MCP Client → MCP Server → Semem Core APIs
                       → Ragno Knowledge Graph  
                       → ZPT Navigation/Transform
```

Each tool call is validated, executed against the appropriate Semem API, and results are returned in MCP-compliant format.