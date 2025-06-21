# Semem MCP Server

This MCP (Model Context Protocol) server provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing. **Now with full GraphRAG compatibility and MCP Prompts for workflow orchestration!**

## Features

### 🚀 MCP Prompts - Workflow Orchestration (NEW!)

Transform complex multi-step operations into simple, guided workflows with **8 pre-built prompt templates**:

#### Memory Workflows (3 prompts)
- `semem-research-analysis` - Analyze research documents with semantic memory context
- `semem-memory-qa` - Q&A using semantic memory retrieval and context assembly
- `semem-concept-exploration` - Deep concept exploration through memory relationships

#### Knowledge Graph Construction (2 prompts)  
- `ragno-corpus-to-graph` - Transform text corpus to structured RDF knowledge graph
- `ragno-entity-analysis` - Analyze and enrich entities with contextual relationships

#### 3D Navigation (1 prompt)
- `zpt-navigate-explore` - Interactive 3D knowledge space navigation and analysis

#### Integrated Workflows (2 prompts)
- `semem-full-pipeline` - Complete memory → graph → navigation processing pipeline
- `research-workflow` - Academic research document processing and insight generation

**Key Features:**
- **Multi-step Coordination**: Chain multiple tools with context passing
- **Dynamic Arguments**: Type validation, defaults, and requirement checking  
- **Conditional Execution**: Skip workflow steps based on conditions
- **Error Recovery**: Graceful handling of failures with partial results
- **Execution Tracking**: Unique execution IDs and detailed step results

### 🆕 GraphRAG Standard Tools

#### Document Management
- `store_document` - Store documents with metadata and vector embeddings
- `list_documents` - List and filter stored documents with pagination
- `delete_documents` - Remove documents from storage (with confirmation)

#### Relationship Management  
- `create_relations` - Create typed relationships between entities
- `search_relations` - Query relationships by entity, type, or direction
- `delete_relations` - Remove relationships from knowledge graph

#### Hybrid Search (Core GraphRAG Feature)
- `hybrid_search` - **Combined vector similarity + graph traversal search**
  - Configurable vector/graph weights
  - Multi-hop graph traversal
  - ZPT navigation integration
  - Comprehensive result scoring

#### Graph Traversal & Analytics
- `search_nodes` - Discover and filter graph nodes by type or query
- `read_graph` - Export graph structure (adjacency, edge list, Cytoscape formats)
- `get_knowledge_graph_stats` - Comprehensive analytics and connectivity metrics

#### Enhanced Retrieval
- `search_documentation` - Advanced semantic document search with filtering
- `add_observations` - Enrich entities with contextual observations

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

### ZPT (Zoom, Pan, Tilt) Navigation Tools  
- `zpt_select_corpuscles` - Multi-dimensional content selection with 3D navigation
- `zpt_chunk_content` - Advanced content chunking with semantic boundaries

### Resources
- `semem://status` - System status and service health information
- `semem://graph/schema` - RDF graph schema and ontology documentation
- `semem://docs/api` - Complete API documentation

### MCP Prompts Documentation
- **Complete Guide**: `mcp/prompts/resources/prompt-guide.md` - Comprehensive user guide with examples
- **Usage Examples**: `mcp/prompts/resources/examples.md` - Real-world usage patterns and scenarios
- **Implementation Plan**: `docs/mcp/MCP-PROMPTS-PLAN.md` - Technical architecture and design decisions

## Usage

### Starting the Server

#### HTTP/SSE Transport (Recommended)
```bash
# Start HTTP server with Server-Sent Events transport
npm run mcp:http

# Or directly
node mcp/http-server.js

# Custom port and host
MCP_PORT=3002 MCP_HOST=localhost node mcp/http-server.js

# Using binary
semem-mcp-http --port=3002 --host=localhost
```

**Integration URL:** `http://localhost:3002/mcp` (default port changed to avoid conflicts)

#### Stdio Transport (Legacy - Deprecated)
```bash
# Start with stdio transport (for use with MCP clients)
node mcp/index.js

# Note: Stdio transport is deprecated in favor of HTTP/SSE
```

### Testing

```bash
# Test HTTP/SSE transport
curl -X GET http://localhost:3002/health

# Test the bridge
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node mcp/stdio-to-http-bridge-simple.js

# Test with MCP client examples
node examples/mcp/HTTPClient.js

# Run automated tests
npm test tests/mcp/http-transport.test.js
```

### Configuration

The server requires:
- A valid `config/config.json` file with LLM provider settings
- Environment variables for API keys (see main project `.env` file)
- Node.js 20.11.0+

### Example Tool Calls

#### 🚀 MCP Prompts Examples (NEW!)

##### List Available Prompts
```json
{
  "method": "prompts/list",
  "params": {}
}
```

##### Research Document Analysis Workflow
```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-research-analysis",
    "arguments": {
      "document_text": "Artificial intelligence has evolved significantly with the introduction of transformer architectures. These models have revolutionized natural language processing tasks and enabled the development of large language models like GPT and BERT.",
      "analysis_depth": "deep",
      "context_threshold": 0.8
    }
  }
}
```

##### Memory-Based Q&A Workflow
```json
{
  "method": "prompts/execute", 
  "params": {
    "name": "semem-memory-qa",
    "arguments": {
      "question": "What are the main advantages of transformer architectures?",
      "context_limit": 10,
      "similarity_threshold": 0.7
    }
  }
}
```

##### Knowledge Graph Construction Workflow
```json
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-corpus-to-graph",
    "arguments": {
      "corpus_chunks": [
        "Apple Inc. is a technology company founded by Steve Jobs.",
        "The iPhone was first released in 2007.",
        "Tim Cook became CEO in 2011."
      ],
      "entity_confidence": 0.8,
      "extract_relationships": true
    }
  }
}
```

##### Full Pipeline Workflow
```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-full-pipeline",
    "arguments": {
      "input_data": "Machine learning is transforming healthcare through predictive analytics and diagnostic assistance.",
      "pipeline_stages": ["memory", "graph", "navigation"],
      "output_formats": ["json", "rdf", "summary"]
    }
  }
}
```

#### 🆕 GraphRAG Examples

##### Store a Document
```json
{
  "name": "store_document",
  "arguments": {
    "content": "Artificial intelligence (AI) is intelligence demonstrated by machines...",
    "metadata": {
      "title": "Introduction to AI",
      "author": "AI Research Team",
      "type": "research",
      "tags": ["ai", "technology", "research"]
    }
  }
}
```

##### Hybrid Search (Core GraphRAG)
```json
{
  "name": "hybrid_search",
  "arguments": {
    "query": "machine learning applications",
    "options": {
      "maxResults": 15,
      "vectorWeight": 0.6,
      "graphWeight": 0.4,
      "graphDepth": 3,
      "includeDocuments": true,
      "includeEntities": true,
      "includeRelationships": true
    }
  }
}
```

##### Create Relationships
```json
{
  "name": "create_relations",
  "arguments": {
    "sourceEntity": "artificial_intelligence",
    "targetEntity": "machine_learning", 
    "relationshipType": "includes",
    "description": "AI includes machine learning as a subset",
    "weight": 0.9
  }
}
```

##### Read Graph Structure
```json
{
  "name": "read_graph",
  "arguments": {
    "rootNodes": ["artificial_intelligence"],
    "maxDepth": 2,
    "format": "cytoscape",
    "includeMetadata": true
  }
}
```

##### Search Documentation
```json
{
  "name": "search_documentation",
  "arguments": {
    "query": "neural networks deep learning",
    "options": {
      "maxResults": 10,
      "sortBy": "relevance",
      "documentTypes": ["research", "tutorial"],
      "includeContent": true
    }
  }
}
```

#### Traditional Semem Examples

##### Store an Interaction
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

##### Retrieve Memories
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

##### Decompose Text Corpus
```json
{
  "name": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": ["AI is transforming technology.", "Machine learning enables pattern recognition."],
    "options": {"maxEntities": 50, "extractRelationships": true}
  }
}
```

##### ZPT Content Navigation
```json
{
  "name": "zpt_select_corpuscles",
  "arguments": {
    "zoom": "entity",
    "tilt": "embedding",
    "selectionType": "embedding",
    "criteria": {"query": "machine learning"},
    "limit": 20
  }
}
```

## Integration

### Claude Desktop

#### Using HTTP/SSE Transport (Recommended)

**Step 1:** Start the HTTP MCP server
```bash
MCP_PORT=3002 node mcp/http-server.js &
```

**Step 2:** Configure Claude Desktop with the bridge
```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/flow/hyperdata/semem/mcp/stdio-to-http-bridge-simple.js"]
    }
  }
}
```

**Note:** The bridge script converts Claude Desktop's stdio transport to HTTP/SSE for the Semem server.

#### Using Stdio Transport (Legacy - Deprecated)
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

**Note:** Stdio transport is deprecated. Use HTTP/SSE transport with bridge for better reliability.

### Other MCP Clients
The server follows the standard MCP protocol and should work with any compatible client. For HTTP/SSE transport, clients can connect directly to `http://localhost:3002/mcp`.

## Current Status

### ✅ Working Components
- **HTTP/SSE MCP Server**: Fully functional on port 3002
- **Stdio-to-HTTP Bridge**: Successfully converts between transports
- **Core MCP Tools**: All Semem tools properly exposed via new MCP SDK API
- **Tool Registration**: Using modern `server.tool()` API instead of deprecated `setRequestHandler()`
- **MCP Prompts System**: 8 workflow templates with full orchestration capabilities
- **Prompt Registry**: Dynamic prompt loading and validation system
- **Workflow Execution**: Multi-step tool coordination with error handling

### 🔧 Recent Fixes
- **Fixed MCP SDK Compatibility**: Updated from deprecated `setRequestHandler()` to `server.tool()` API
- **Fixed HTTP Transport**: Added proper SSE headers and response parsing
- **Fixed Bridge Communication**: Created working stdio ↔ HTTP/SSE bridge for Claude Desktop
- **Fixed Port Conflicts**: Server now runs on port 3002 to avoid conflicts
- **Added MCP Prompts**: Implemented comprehensive workflow orchestration system
- **Enhanced Test Coverage**: 62 new prompt tests + maintained existing test compatibility
- **Updated Documentation**: Complete prompt guides and integration examples

### 🐛 Known Issues
- **Stdio Transport**: Deprecated and may have compatibility issues with newer MCP clients
- **Package Dependencies**: Some MCP transport packages don't exist in npm registry

### 🚀 Recommended Setup
1. Use HTTP/SSE transport with the bridge for Claude Desktop
2. Start server on port 3002 to avoid conflicts
3. Restart Claude Desktop after configuration changes
4. **Try MCP Prompts** for complex workflows - start with `semem-memory-qa` or `research-workflow`

## Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `zod` - Schema validation
- Semem core modules (automatically imported from parent project)

## GraphRAG Compatibility

This server provides **full compatibility** with standard GraphRAG MCP patterns while adding unique Semem extensions:

### ✅ Standard GraphRAG Tools Supported
- Document storage and retrieval
- Entity relationship management  
- Hybrid vector + graph search
- Graph traversal and analytics
- Knowledge graph statistics
- Entity observations and enrichment

### 🚀 Semem Extensions
- **ZPT (Zoom, Pan, Tilt)**: 3D navigation through knowledge space
- **Ragno RDF Compliance**: Full semantic web ontology integration
- **Multi-Tilt Representations**: Multiple perspectives on the same content
- **Semantic Memory Integration**: Persistent conversational memory

### Tool Count: **17 Total** + **8 Prompt Workflows**
- **9 GraphRAG Standard Tools**: `store_document`, `list_documents`, `delete_documents`, `create_relations`, `search_relations`, `delete_relations`, `hybrid_search`, `search_nodes`, `read_graph`, `get_knowledge_graph_stats`, `search_documentation`, `add_observations`
- **5 Semem Core Tools**: Memory management and LLM integration
- **3 Ragno Tools**: RDF knowledge graph construction  
- **2 ZPT Tools**: Multi-dimensional content navigation
- **8 MCP Prompts**: Workflow orchestration templates for complex multi-step operations

## Architecture

The MCP server acts as a bridge between the MCP protocol and the Semem APIs, now with full GraphRAG compatibility and workflow orchestration:

```
MCP Client → MCP Server → MCP Prompts (Workflow Orchestration)
                       → GraphRAG Standard APIs
                       → Semem Core APIs  
                       → Ragno Knowledge Graph (RDF)
                       → ZPT Navigation/Transform
```

### Data Flow
1. **Prompts** → Multi-step workflows orchestrating tools and data flow
2. **Documents** → Vector embeddings + RDF entities + Graph relationships
3. **Hybrid Search** → Vector similarity + Graph traversal + ZPT navigation  
4. **Results** → Scored and ranked using multiple strategies
5. **Storage** → Persistent memory + RDF graph + Relationship index

Each tool call is validated, executed against the appropriate API layer, and results are returned in MCP-compliant format with comprehensive error handling and demo fallbacks.