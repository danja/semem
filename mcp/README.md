# Semem MCP Server

This MCP (Model Context Protocol) server provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing. **Now with comprehensive tool coverage and advanced capabilities!**

## Features

### 🚀 Core Memory Management Tools (5 tools)
- `semem_store_interaction` - Store new interactions with embeddings and concept extraction
- `semem_retrieve_memories` - Search for relevant memories based on similarity
- `semem_generate_response` - Generate responses using memory context
- `semem_generate_embedding` - Generate vector embeddings for text
- `semem_extract_concepts` - Extract semantic concepts from text using LLM analysis

### 🧠 Ragno Knowledge Graph Tools (8 tools) - **NEW!**
- `ragno_decompose_corpus` - Transform text chunks into semantic units, entities, and relationships
- `ragno_enrich_embeddings` - Add vector embeddings to knowledge graph elements  
- `ragno_augment_attributes` - Extract and add semantic attributes using LLM analysis
- `ragno_aggregate_communities` - Detect and analyze entity communities
- `ragno_export_sparql` - Export decomposition results to SPARQL endpoints
- `ragno_get_entity` - Retrieve detailed information about specific entities
- `ragno_search_graph` - Multi-modal search (semantic, entity, hybrid approaches)
- `ragno_get_graph_stats` - Comprehensive knowledge graph statistics

### 🗃️ Advanced SPARQL Operations (8 tools) - **NEW!**
- `sparql_execute_query` - Execute SPARQL SELECT or ASK queries with safety limits
- `sparql_execute_construct` - Generate new RDF data with CONSTRUCT queries
- `sparql_navigate_zpt` - Navigate using ZPT spatial metaphors
- `sparql_similarity_search` - Vector similarity search with embeddings
- `sparql_validate_corpus` - Check graph integrity and health
- `sparql_store_dataset` - Bulk store RDF datasets
- `sparql_bulk_operations` - Batch SPARQL operations with transaction support
- `sparql_graph_management` - Create/delete/copy named graphs

### 🎯 VSOM Clustering Tools (9 tools) - **NEW!**  
- `vsom_create_instance` - Create VSOM instances for entity clustering
- `vsom_load_data` - Load entities from multiple sources (SPARQL, arrays, samples)
- `vsom_train_instance` - Train VSOM with progress tracking
- `vsom_get_grid_data` - Export grid topology for visualization
- `vsom_get_clusters` - Extract clusters with entity assignments
- `vsom_get_feature_maps` - Generate feature visualizations
- `vsom_analyze_topology` - Analyze map quality and distortions
- `vsom_list_instances` - Manage multiple VSOM instances
- `vsom_generate_sample_data` - Create test data for experimentation

### 🗺️ ZPT (Zoom, Pan, Tilt) Navigation Tools (12 tools)
- `zpt_navigate` - 3-dimensional knowledge navigation using spatial metaphors
- `zpt_preview` - Preview navigation options without full processing
- `zpt_get_schema` - Get complete ZPT parameter schema
- `zpt_validate_params` - Validate parameters with detailed error reporting
- `zpt_get_options` - Get available parameter values for current context
- `zpt_analyze_corpus` - Analyze corpus structure for navigation optimization

#### 🌐 ZPT Ontology Integration Tools (6 tools) - **NEW!**
- `zpt_convert_params` - Convert string parameters to ZPT ontology URIs
- `zpt_store_session` - Store navigation session with RDF metadata and provenance
- `zpt_get_sessions` - Retrieve stored navigation sessions from SPARQL
- `zpt_get_ontology_terms` - Get ZPT ontology terms, namespaces, and descriptions
- `zpt_validate_ontology` - Validate parameters against formal ZPT ontology
- `zpt_analyze_navigation` - Analyze navigation patterns and usage statistics

### 🔬 Research Workflow Tools (6 tools)
- `research_ingest_documents` - Ingest research documents with SPARQL persistence
- `research_generate_insights` - Generate insights from knowledge graph analysis
- `adaptive_query_processing` - Process queries based on user context and history
- `hybrid_search` - Combined semantic memory + knowledge graph search
- `capture_user_feedback` - Capture feedback for system improvement
- `incremental_learning` - Perform incremental learning from interactions

### 📊 Resources (3 resources)
- `semem://status` - System status and service health information
- `semem://graph/schema` - RDF graph schema and ontology documentation  
- `semem://docs/api` - Complete API documentation

**Total: 51+ MCP Tools Available**

## Usage

### Starting the Server

#### HTTP Transport (Recommended)
```bash
# Start HTTP server
npm run mcp:http

# Or directly
node mcp/http-server.js

# Custom port and host
MCP_PORT=3002 MCP_HOST=localhost node mcp/http-server.js
```

**Integration URL:** `http://localhost:3000/mcp`

eg.
```sh
npx @modelcontextprotocol/inspector node mcp/http-server.js
``

#### Stdio Transport
```bash
# Start with stdio transport (for use with MCP clients)
node mcp/index.js
```
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"tools.25.custom.name: String should match pattern 
     '^[a-zA-Z0-9_-]{1,128}$'"}}
     I just tried ` claude mcp add semem /flow/hyperdata/semem/bin/mcp.js` and semem_answer and semem_ask are still not of the list. Check how  semem-memory-qa is being registered and exposed, that is visible. 
/semem:semem-memory-qa question:"How does Wikidata support FAIR principles?"
or, eg.
```sh
claude mcp add semem npx semem-mcp
```

---
Solution Found ✅

  The HTTP transport connection issue has been resolved! The problem was that the main server (mcp/index.js) was hanging during startup due to eager initialization of heavy services
  (prompt registry, workflow orchestrator, and service initialization).

  The solution:

  1. Use the isolated HTTP server (mcp/http-server.js) instead of the main server
  2. Per-session server creation - Each MCP Inspector connection gets its own server instance using http-only-server.js
  3. Lazy initialization - Services are only initialized when tools are actually called

  How to connect MCP Inspector:

  1. Start the HTTP server:
  node mcp/http-server.js
  2. Open MCP Inspector at: http://localhost:3000/inspector
  3. Configure connection:
    - Transport: HTTP
    - URL: http://localhost:3000/mcp

    
lsof -i:3000

kill -9 [pid]
---
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

#### Decompose Text Corpus into Knowledge Graph
```json
{
  "name": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": [
      "Apple Inc. is a technology company founded by Steve Jobs.",
      "The iPhone was first released in 2007."
    ],
    "options": {"extractRelationships": true, "minEntityConfidence": 0.7}
  }
}
```

#### ZPT Navigation with Spatial Metaphors
```json
{
  "name": "zpt_navigate",
  "arguments": {
    "query": "artificial intelligence applications",
    "zoom": "entity",
    "tilt": "embedding",
    "pan": {"domains": ["technology", "research"]}
  }
}
```

#### ZPT Ontology Integration - Convert Parameters to URIs
```json
{
  "name": "zpt_convert_params",
  "arguments": {
    "zoom": "entity",
    "tilt": "embedding", 
    "pan": {"domains": ["ai", "science"]}
  }
}
```

#### ZPT Ontology Integration - Store Navigation Session
```json
{
  "name": "zpt_store_session",
  "arguments": {
    "purpose": "Research exploration of AI applications",
    "agentURI": "http://example.org/agents/researcher_001",
    "userAgent": "Claude Desktop Research Session",
    "sessionType": "exploration"
  }
}
```

#### ZPT Ontology Integration - Get Ontology Terms
```json
{
  "name": "zpt_get_ontology_terms",
  "arguments": {
    "category": "all"
  }
}
```

## Integration

### Claude Desktop

#### Using Stdio Transport (Recommended)
```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/absolute/path/to/semem/mcp/stdio-server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/semem/` with the actual path to your Semem installation.

#### Alternative: Using Main Index Server
```json
{
  "mcpServers": {
    "semem": {
      "command": "node", 
      "args": ["/absolute/path/to/semem/mcp/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Other MCP Clients

#### HTTP Transport
For clients that support HTTP transport, start the HTTP server:
```bash
node mcp/http-server.js
```

Then connect to: `http://localhost:3000/mcp`

#### Standard MCP Protocol
The server follows the standard MCP protocol and should work with any compatible client using stdio transport.

## New Tool Categories Added

### 🧠 Ragno Knowledge Graph Tools
These tools expose the full power of Ragno's corpus decomposition and knowledge graph construction capabilities:

- **Corpus Decomposition**: Transform raw text into structured semantic units, entities, and relationships
- **Entity Management**: Create, retrieve, and enrich entities with attributes and relationships  
- **Community Detection**: Discover entity communities and analyze graph structure
- **Multi-Modal Search**: Combine semantic similarity, entity matching, and graph traversal
- **RDF Export**: Export results to SPARQL endpoints for further analysis

### 🗃️ Advanced SPARQL Operations  
Direct access to sophisticated SPARQL operations for power users:

- **Query Execution**: Run SELECT, ASK, and CONSTRUCT queries with safety limits
- **ZPT Navigation**: Use spatial metaphors for intuitive graph exploration
- **Similarity Search**: Vector-based similarity search with embedding integration
- **Corpus Validation**: Check graph integrity, embedding coverage, and connectivity
- **Bulk Operations**: Efficient batch processing with transaction support
- **Graph Management**: Create, delete, copy, and manage named graphs

### 🎯 VSOM Clustering Tools
Vector Self-Organizing Maps for advanced entity clustering and visualization:

- **Instance Management**: Create and manage multiple VSOM instances
- **Data Loading**: Load from entities, SPARQL endpoints, or generate sample data
- **Training**: Train SOMs with progress tracking and convergence validation
- **Cluster Extraction**: Extract meaningful clusters with configurable methods
- **Visualization**: Generate grid data and feature maps for visualization
- **Topology Analysis**: Analyze map quality, distortions, and neighborhood structure

### 🌐 ZPT Ontology Integration Features - **NEW!**
Formal semantic web compliance with ZPT ontology integration for knowledge navigation:

- **String-to-URI Conversion**: Seamlessly convert user-friendly strings to formal ZPT ontology URIs
- **Navigation Session Management**: Store navigation sessions as RDF with W3C PROV-O provenance tracking
- **Ontology Term Discovery**: Access complete ZPT ontology with descriptions and namespace mappings  
- **Parameter Validation**: Validate navigation parameters against formal ontology definitions
- **Usage Analytics**: Analyze navigation patterns and generate usage statistics from RDF metadata
- **SPARQL Integration**: Full integration with existing SPARQL storage for RDF persistence

#### Key Capabilities:
- **14 Ontology Terms**: 6 zoom levels, 4 tilt projections, 4 pan domains with formal semantics
- **9 Namespace Mappings**: Complete integration with ZPT, Ragno, RDF, RDFS, OWL, XSD, SKOS, PROV-O, and DC Terms
- **RDF Metadata Storage**: Navigation sessions stored as linked data with temporal provenance
- **Backward Compatibility**: Works alongside existing string-based ZPT tools without breaking changes
- **Semantic Web Standards**: Full W3C RDF/SPARQL compliance for interoperability

## Architecture

The MCP server acts as a bridge between the MCP protocol and the comprehensive Semem ecosystem:

```
MCP Client → MCP Server → Memory Management (Semem Core)
                       → Knowledge Graphs (Ragno) 
                       → SPARQL Operations (Advanced)
                       → Clustering (VSOM)
                       → Navigation (ZPT)
                       → Research Workflows
```

### Data Flow
1. **Documents/Text** → Semantic processing and storage
2. **Knowledge Extraction** → Entities, relationships, communities
3. **Vector Processing** → Embeddings and similarity search
4. **Graph Operations** → SPARQL queries and graph traversal
5. **Clustering** → Entity organization and visualization
6. **Results** → Scored and ranked using multiple strategies

## Current Status

### ✅ Working Components
- **HTTP MCP Server**: Fully functional on port 3000 (configurable)
- **Stdio-to-HTTP Bridge**: Successfully converts between transports
- **All Tool Categories**: 45+ tools properly exposed via MCP SDK API
- **Tool Registration**: Using modern `server.tool()` API
- **Comprehensive Coverage**: Full Semem ecosystem now accessible

### 🔧 Recent Major Updates
- **Added ZPT Ontology Integration**: 6 new tools for semantic web compliance and formal navigation
- **Added Ragno Tools**: Complete knowledge graph construction and analysis
- **Added SPARQL Tools**: Advanced graph operations and management
- **Added VSOM Tools**: Entity clustering and visualization capabilities
- **Enhanced Parameter Validation**: Formal ontology-based validation with detailed error reporting
- **RDF Metadata Storage**: Navigation sessions stored as linked data with provenance tracking
- **Removed Obsolete Files**: Cleaned up legacy and test files
- **Updated Registration**: All new tools properly integrated

### 🚀 Recommended Setup
1. Use stdio transport for Claude Desktop (simplest and most reliable)
2. HTTP server runs on port 3000 by default (configurable with MCP_PORT)
3. Restart Claude Desktop after configuration changes
4. Explore the new capabilities: corpus decomposition, graph analysis, clustering

## Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `zod` - Schema validation
- Semem core modules (automatically imported from parent project)

## Tool Coverage Expansion

**Previous tools**: 11 total
- 5 Memory management tools
- 6 ZPT navigation tools

**Added tools**: 31 total
- 8 Ragno knowledge graph tools
- 8 Advanced SPARQL operation tools  
- 9 VSOM clustering tools
- 6 ZPT ontology integration tools (NEW!)

**Current total**: 51+ MCP tools covering the complete Semem ecosystem

This comprehensive expansion means AI agents now have access to the full power of Semem's semantic memory management, knowledge graph construction, advanced graph operations, entity clustering, spatial navigation capabilities, and formal semantic web integration with ontology-driven navigation.