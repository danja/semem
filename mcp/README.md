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

## Complete Tool & Resource Reference

### 🛠️ Tools Available (32 total)

#### Core Memory Management (5 tools)
- `semem_store_interaction` - Store interactions with embeddings and concept extraction
- `semem_retrieve_memories` - Search for semantically similar memories using vector similarity
- `semem_generate_embedding` - Generate vector embeddings for text using configured embedding model
- `semem_generate_response` - Generate LLM responses with optional memory context integration
- `semem_extract_concepts` - Extract key semantic concepts from text using LLM analysis

#### Storage Management (6 tools)
- `semem_switch_storage_backend` - Runtime switching between InMemory/JSON/SPARQL/CachedSPARQL backends
- `semem_backup_memory` - Create backups in JSON/RDF formats with optional embedding inclusion
- `semem_load_memory` - Load memory from backup files with merge or replace options
- `semem_storage_stats` - Get detailed storage statistics and health information
- `semem_migrate_storage` - Migrate data between different storage backend types
- `semem_clear_storage` - Clear storage with confirmation requirements and optional backup

#### Context Management (4 tools)
- `semem_get_context` - Retrieve current context window information and active items
- `semem_update_context_config` - Update context window settings (max tokens, threshold, time window)
- `semem_prune_context` - Manually prune context based on relevance scores and age criteria
- `semem_summarize_context` - Generate intelligent summaries of current context contents

#### System Configuration (3 tools)
- `semem_get_config` - Get current system configuration across all components
- `semem_update_config` - Update configuration settings by section with validation
- `semem_get_metrics` - Get detailed system metrics (memory usage, cache stats, performance)
- `semem_health_check` - Comprehensive health check of all system components

#### Knowledge Graph (Ragno) (8 tools)
- `ragno_decompose_corpus` - Transform text corpus into RDF knowledge graph with entities and relationships
- `ragno_search_dual` - Combined exact matching + vector similarity + PersonalizedPageRank search
- `ragno_get_entities` - Retrieve entities from knowledge graph with advanced filtering and pagination
- `ragno_vector_search` - HNSW-based vector similarity search on knowledge graph embeddings
- `ragno_export_rdf` - Export knowledge graph in multiple RDF formats (Turtle, N-Triples, JSON-LD)
- `ragno_query_sparql` - Execute SPARQL queries against the knowledge graph RDF store
- `ragno_analyze_graph` - Comprehensive graph analysis (centrality, communities, connectivity)
- `ragno_get_graph_stats` - Basic and detailed statistics about knowledge graph structure

#### ZPT Navigation (6 tools)
- `zpt_navigate` - 3-dimensional knowledge graph navigation using Zoom/Pan/Tilt spatial metaphors
- `zpt_preview` - Preview ZPT navigation options and estimated results without full processing
- `zpt_get_schema` - Get complete ZPT parameter schema and navigation documentation
- `zpt_validate_params` - Validate ZPT parameters with detailed error reporting and suggestions
- `zpt_get_options` - Get available parameter values for current corpus state and navigation context
- `zpt_analyze_corpus` - Analyze corpus structure for ZPT navigation optimization and performance tuning

### 📚 Resources Available (11 total)

#### System Information
- `semem://status` - Current system status and service health monitoring data
- `semem://docs/api` - Complete API documentation with examples and integration guides
- `semem://config/current` - Current system configuration settings across all components
- `semem://storage/backends` - Available storage backend information and capabilities comparison
- `semem://metrics/dashboard` - System metrics and performance monitoring dashboard data

#### Knowledge Graph Resources
- `semem://graph/schema` - RDF graph schema and ontology information for data modeling
- `semem://ragno/ontology` - Complete Ragno ontology definition in Turtle RDF format
- `semem://ragno/pipeline` - Complete guide to using Ragno knowledge graph pipeline
- `semem://ragno/examples` - Knowledge graph construction and analysis examples with code
- `semem://ragno/sparql/queries` - Pre-built SPARQL query templates for common graph operations

#### Workflow Resources
- `semem://examples/workflows` - Common workflow examples and templates for typical use cases

### 🎯 Prompt Workflows Available (10 total)

#### Memory Workflows (4 prompts)
- `semem-research-analysis` - Research document analysis with semantic memory context integration
- `semem-memory-qa` - Question-answering using semantic memory retrieval and context assembly
- `semem-concept-exploration` - Deep concept exploration using stored knowledge relationships
- `semem-full-pipeline` - Complete memory → graph → navigation workflow processing pipeline

#### Knowledge Graph (2 prompts)
- `ragno-corpus-to-graph` - Transform text corpus to structured RDF knowledge graph with entities
- `ragno-entity-analysis` - Analyze and enrich entities with contextual relationships and properties

#### 3D Navigation (1 prompt)
- `zpt-navigate-explore` - Interactive 3D knowledge navigation using spatial metaphors

#### Integrated Workflows (3 prompts)
- `enhanced-research-workflow` - Intelligent document processing with SPARQL storage and incremental learning
- `intelligent-qa-workflow` - Answer questions using hybrid search and incremental learning capabilities
- `research-workflow` - Academic research processing pipeline with semantic analysis and storage

## Current Status

### ✅ Working Components
- **HTTP/SSE MCP Server**: Fully functional on port 3002
- **Stdio-to-HTTP Bridge**: Successfully converts between transports
- **Core MCP Tools**: All 32 Semem tools properly exposed via new MCP SDK API
- **Tool Registration**: Using modern `server.tool()` API instead of deprecated `setRequestHandler()`
- **MCP Prompts System**: 10 workflow templates with full orchestration capabilities
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