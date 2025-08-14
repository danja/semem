# Semem
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.11.0-brightgreen.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## Semantic Web Memory for Intelligent Agents
 
*...or, Graph RAG on steroids for the global knowledgebase*
 
**tl;dr - flipping ideas (mostly) from the LLM world over to the Semantic Web for massively simplified integration, at global scale**

**[Semem Documentation](https://danja.github.io/semem/)** - *already out-of-date, below is more current*
 
*click the triangles to expand the text* 
 
<details> 
<summary>Semem is an experimental Node.js toolkit for AI memory management</summary> that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It offers knowledge graph retrieval and augmentation algorithms within a conceptual model based on the <a href="https://github.com/danja/ragno">Ragno</a> (knowledge graph description) and <a href="https://github.com/danja/zpt">ZPT</a> (knowledge graph navigation) ontologies. It is a <a href="https://github.com/danja/tensegrity">tensegrity</a> project.

The intuition is that while LLMs and associated techniques have massively advanced the field of AI and offer considerable utility, the typical approach is missing the elephant in the room: <strong>the Web</strong> - the biggest known knowledgebase in our universe. Semantic Web technologies offer data integration at a global scale, with tried & tested conceptual models for knowledge representation. <strong>There is a lot of low-hanging fruit.</strong>
</details>

## Status 2025-08-13

MCP functionality focused down on 7 core verbs : *ask, tell, augment, zoom, pan, tilt, inspect*. See below and [this blog post](https://tensegrity.it/entries/2025-08-10_claude_simple_verbs.html) (in which Claude demonstrates an inability to count).

The UI has been totally re-written to reflect this. Currently testing.

Latest workflow experiment : [PDF ingestion](https://github.com/danja/semem/tree/main/examples/document#readme)

See also :  [blog](https://tensegrity.it) (co-written with Claude Code)

<details>
<summary>Mostly functional but very, very sketchy. It has an MCP server, HTTP API, a crude browser UI and code APIs. A lot to do before much will be remotely useful. It is in active development in June 2025. The codebase is big and chaotic, <strong>it is not for the fainthearted</strong>.</summary>

The codebase is registered as the npm package [semem](https://www.npmjs.com/package/semem) though there hasn't been much time spent on this angle, currently it's pretty much essential to use this repo. 

The dev process has involved pushing out in various directions with spikes, then circling back to ensure the core is still functional, then consolidation. To date it's been a one-man + various AI assistants (and a dog) operation. Despite me trying to keep things modular so they can be worked on in isolation, it's still complex enough that Claude (and I) struggle. <strong>Collaborators would be very welcome</strong>.
</details>
It is feature-complete as originally conceived, in the sense of <em><a href="https://www.youtube.com/watch?v=R7GeKLE0x3s">all the right notes, but not necessarily in the right order</a></em>. There is a lot of cruft and numerous bugs. Right now it's in a <strong>consolidation phase</strong>.

## System Overview

The SPARQL store, chat LLMs and embeddings service are all external. SPARQL uses the standard HTTP interfaces. There are also in-memory and JSON file storage subsystems but these are an artifact of dev history, though they can be useful as a fallback durin testing. LLMs use the [hyperdata-clients](https://github.com/danja/hyperdata-clients) library to simplify configuration. 

The system is layered in a couple of dimensions: interfacing may be direct (SDK-style) API, via the HTTP server or MCP server. Functionality is grouped by purpose broadly into *Basic*, *Ragno* and *ZPT*. 

There are fairly comprehensive demos under [examples](https://github.com/danja/semem/tree/main/examples) which exercise the different parts of the system (think manual integration tests).

### Basic 
This contains the low-level operations. It covers basic SPARQL store interactions, embeddings/*semantic search* and chat. There are also some minimal temporal/relevance-related parts that overlap with *Ragno*.

Internally the system relies on [RDF-Ext](https://github.com/rdf-ext) and other [RDFJS](http://rdf.js.org/) libraries for its graph model, [FAISS](https://github.com/facebookresearch/faiss) for its primary vector-oriented functionality.

### Ragno
This layer is concerned with the **knowledgebase model** as described by the [Ragno Ontology](https://github.com/danja/ragno). On top of the model are a set of algorithms that offer various knowledge retrieval and augmentation facilities. Most are lifted from the [NodeRAG paper](https://arxiv.org/abs/2504.11544), with additions such as [HyDE](https://arxiv.org/abs/2212.10496) *Hypothetical Document Embeddings* and Vectorised [Self-Organising Maps](https://en.wikipedia.org/wiki/Self-organizing_map).

### ZPT
This layer is concerned with **knowledgegraph navigation** built on the [ZPT Ontology](https://github.com/danja/zpt) following an analogy from the film world, *Zoom, Pan, Tilt*. Algorithms have been created to handle parameterisation of filters/selection and corpus decomposition and chunking.

## UI

Semem has a browser-based UI in progress. This won't be useful for actual knowledge work any time soon (if ever) but it will have a role in checking system behaviour and experimenting. 

---
The description below is very AI-sloppy. 



## 🚀 Quick Start - Simple Verbs Interface

Get started with Semem's natural language interface in 5 minutes:

### Prerequisites
- Node.js 20.11.0 or higher
- npm (comes with Node.js)

### Installation & Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/danja/semem.git
   cd semem
   npm install
   ```

2. **Start the MCP server:**
   ```bash
   node mcp/http-server.js
   ```
   The server starts on `http://localhost:3000` with Simple Verbs REST endpoints.

### Try the 7 Simple Verbs

**Store knowledge with `tell`:**
```bash
curl -X POST http://localhost:3000/tell \
  -H "Content-Type: application/json" \
  -d '{"content": "Machine learning is a subset of AI that enables computers to learn", "type": "concept"}'
```

**Query knowledge with `ask`:**
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is machine learning?"}'
```

**Set context with `zoom` and `pan`:**
```bash
# Set abstraction level
curl -X POST http://localhost:3000/zoom \
  -d '{"level": "entity"}'

# Apply domain filtering  
curl -X POST http://localhost:3000/pan \
  -d '{"domains": ["AI", "technology"], "keywords": ["machine learning"]}'
```

**Check your ZPT state:**
```bash
curl http://localhost:3000/state
```

### Alternative Startup Options

**Full UI + API servers:**
```bash
npm start  # Starts both API server (port 4100) and UI server (port 4120)
```

**MCP Server for Claude Desktop:**
```bash
# Run MCP server for Claude Desktop integration (local dev)
npm run mcp

# Run MCP HTTP server (local dev)
npm run mcp:http

# Or via published package (most reliable method)
git clone https://github.com/danja/semem.git
cd semem
npm install
npm run mcp                      # Stdio MCP server
npm run mcp:http                 # HTTP MCP server on port 3000

# Alternative: Direct node execution
node mcp/index.js                # Stdio MCP server  
node mcp/http-server.js          # HTTP MCP server on port 3000
```

**Development mode:**
```bash
npm run dev  # Hot-reloading for development
```

### 🤖 Claude Desktop Integration

Add Semem to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/path/to/semem/mcp/index.js"]
    }
  }
}
```

**Alternative setup (after cloning repository):**
```json
{
  "mcpServers": {
    "semem": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/semem"
    }
  }
}
```

Then use the 7 Simple Verbs directly in Claude Desktop conversations!

## 🖥️ UI Features

### Interactive Console
Access the developer console by clicking the tab on the right side of the screen. The console provides:
- Real-time log viewing
- Log level filtering (Error, Warn, Info, Debug, Trace)
- Search functionality
- Pause/Resume logging
- Copy logs to clipboard

### VSOM Visualization
Explore high-dimensional data with the Vector Self-Organizing Map visualization:
1. Navigate to the VSOM tab
2. Load or train a SOM model
3. Interact with the visualization
4. Explore feature maps and clustering

### SPARQL Browser
Query and explore your knowledge graph using the built-in SPARQL browser.

## 🚀 Key Features

- **🗣️ Simple Verbs Interface**: 7-verb natural language API (tell, ask, augment, zoom, pan, tilt, inspect) for intuitive semantic operations
- **🧠 Semantic Memory**: Intelligent context retrieval and memory organization with vector embeddings and SPARQL
- **🕸️ Knowledge Graph Processing**: End-to-end Ragno pipeline for entity extraction and relationship modeling
- **🎯 Zoom, Pan Tilt (ZPT)**: Knowledge navigation and processing with persistent state management
- **🔌 Model Context Protocol (MCP)**: JSON-RPC 2.0 API for seamless LLM and agent integration with workflow orchestration
- **🚀 MCP Prompts**: 8 pre-built workflow templates for complex multi-step operations
- **🔍 Advanced Algorithms**: HyDE, VSOM, graph analytics, community detection, and Personal PageRank
- **📊 Interactive Visualizations**: VSOM (Vector Self-Organizing Maps) for high-dimensional data exploration
- **🔗 Multi-Provider LLM Support**: Ollama, Claude, Mistral, and other providers via unified connector system
- **📊 Multiple Storage Backends**: In-memory, JSON, and SPARQL/RDF with caching optimization

## 🗣️ Simple Verbs Interface

Semem features a **7-verb natural language interface** that simplifies complex knowledge operations into conversational commands:

### The 7 Simple Verbs

| Verb | Purpose | Example |
|------|---------|---------|
| **tell** | Store information with automatic embeddings | `tell: "Machine learning uses neural networks"` |
| **ask** | Query stored knowledge with semantic search | `ask: "What is machine learning?"` |
| **augment** | Extract concepts and enhance content | `augment: {"target": "text to analyze", "operation": "concepts"}` |
| **zoom** | Set abstraction level (entity/unit/text/community/corpus) | `zoom: {"level": "entity"}` |
| **pan** | Apply domain/temporal/keyword filtering | `pan: {"domains": ["AI"], "keywords": ["neural networks"]}` |
| **tilt** | Choose view perspective (keywords/embedding/graph/temporal) | `tilt: {"style": "embedding"}` |
| **inspect** | Debug and examine stored memories and session cache | `inspect: {"what": "session", "details": true}` |

### Quick Example Workflow

```bash
# Store knowledge
curl -X POST http://localhost:3000/tell \
  -d '{"content": "The 7 Simple Verbs simplify semantic operations"}'

# Set context  
curl -X POST http://localhost:3000/zoom -d '{"level": "entity"}'
curl -X POST http://localhost:3000/pan -d '{"domains": ["MCP"], "keywords": ["verbs"]}'

# Query with context
curl -X POST http://localhost:3000/ask \
  -d '{"question": "What are the Simple Verbs?"}'
```

The system maintains **persistent ZPT state** across operations, enabling contextual conversations with your knowledge base. All verbs work via REST API, MCP protocol, or direct SDK calls.

See [docs/PROMPT.md](docs/PROMPT.md) for detailed usage instructions.

## 📊 Data Visualization

Semem includes an advanced VSOM (Vector Self-Organizing Map) visualization system for exploring high-dimensional data:

### Key Features
- Interactive SOM grid visualization with zoom/pan
- Real-time training visualization
- Feature map exploration (U-Matrix, component planes)
- Interactive clustering of SOM nodes
- Responsive design for all screen sizes

### Getting Started

1. Navigate to the VSOM tab in the Semem UI
2. Load or train a SOM model
3. Explore the visualization and interact with nodes
4. Use the feature maps to understand data relationships

For more details, see the [VSOM Documentation](docs/features/vsom/README.md).

## 📁 Project Structure

```
semem/
├── src/                    # Core library code
│   ├── handlers/          # LLM and embedding handlers
│   ├── stores/            # Storage backends (JSON, SPARQL, etc.)
│   ├── connectors/        # LLM provider connectors
│   ├── servers/           # HTTP server implementations
│   ├── ragno/             # Knowledge graph algorithms
│   └── zpt/               # Zero-Point Traversal system
├── examples/              # Organized examples by category
│   ├── basic/            # Core functionality examples
│   ├── ragno/            # Knowledge graph examples
│   ├── mcp/              # MCP integration examples
│   ├── zpt/              # ZPT processing examples
│   └── pending/          # Work-in-progress examples
├── mcp/                   # MCP server implementation
├── config/               # Configuration files
└── docs/                 # Comprehensive documentation
```

## 🌐 Server Architecture

Semem provides a complete HTTP server infrastructure for deploying AI memory and knowledge graph services. The server system consists of four main components located in `src/servers/`:

### Core Server Components

#### 🔥 **API Server** (`api-server.js`)
The main REST API server providing HTTP endpoints for all Semem functionality:

- **Memory Operations**: Store, search, and retrieve semantic memories
- **Chat Interface**: Conversational AI with context awareness
- **Embedding Services**: Vector embedding generation and management
- **Configuration Management**: Dynamic provider and storage configuration
- **Health Monitoring**: System status and metrics endpoints

**Key Endpoints:**
```
POST /api/memory          # Store new memories
GET  /api/memory/search   # Search existing memories
POST /api/chat            # Chat with context
POST /api/chat/stream     # Streaming chat responses
GET  /api/health          # System health check
GET  /api/config          # Server configuration
```

#### 🎛️ **UI Server** (`ui-server.js`)
Web interface server for interactive access to Semem capabilities:

- **Provider Selection**: Choose from configured LLM providers
- **Memory Browser**: Visual interface for memory exploration
- **Chat Interface**: Web-based conversational UI
- **Configuration UI**: Visual configuration management

#### 🚀 **Server Manager** (`server-manager.js`)
Process management system for coordinating multiple server instances:

- **Process Lifecycle**: Start, monitor, and gracefully stop servers
- **Port Management**: Automatic port conflict resolution
- **Health Monitoring**: Real-time process status tracking
- **Signal Handling**: Graceful shutdown coordination
- **Logging**: Centralized output management with timestamps

#### 🎯 **Start All** (`start-all.js`)
Orchestration script for launching the complete server ecosystem:

- **Configuration Loading**: Unified config system integration
- **Multi-Server Startup**: Coordinated API and UI server launch
- **Interactive Control**: Keyboard shortcuts for shutdown (Ctrl+C, 'q')
- **Error Handling**: Robust startup failure recovery

### Quick Server Deployment

```bash
# Start all servers (recommended)
./start.sh
# OR
npm run start-servers

# Individual server startup
node src/servers/api-server.js    # API only (port 4100)
node src/servers/ui-server.js     # UI only (port 4120)

# Stop all servers
./stop.sh
# OR
npm run stop-servers
```

### Server Configuration

Servers are configured via `config/config.json`:

```json
{
  "servers": {
    "api": 4100,      # API server port
    "ui": 4120,       # UI server port
    "redirect": 4110, # Optional redirect port
    "redirectTarget": 4120
  },
  "storage": {
    "type": "sparql",  # or "json", "memory"
    "options": { /* storage-specific config */ }
  },
  "llmProviders": [
    { /* provider configurations */ }
  ]
}
```

### Development and Production

**Development Mode:**
```bash
# Start with hot reload and debug logging
LOG_LEVEL=debug ./start.sh

# Watch mode with automatic restarts
npm run dev
```

**Production Deployment:**
```bash
# Set production environment
NODE_ENV=production ./start.sh

# With process management (PM2)
pm2 start src/servers/start-all.js --name semem-servers
```

### Server Monitoring

The server infrastructure includes comprehensive monitoring:

- **Health Checks**: `/api/health` endpoint with component status
- **Metrics**: `/api/metrics` endpoint with performance data  
- **Process Monitoring**: Real-time process status in server manager
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT signals

## ⚡ Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/your-org/semem.git
cd semem
npm install

# Configure environment
cp example.env .env
# Edit .env with your API keys and settings
```

### Prerequisites

1. **Ollama** (recommended for local processing):
   ```bash
   # Install required models
   ollama pull qwen2:1.5b         # For chat/text generation
   ollama pull nomic-embed-text   # For embeddings
   ```

2. **Optional - SPARQL Endpoint** (for advanced features):
   ```bash
   # Using Docker
   docker run -d --name fuseki -p 3030:3030 stain/jena-fuseki
   ```

### Running Servers

```bash
# Start HTTP API and UI servers
./start.sh

# Access web interface
open http://localhost:4120

# Test API endpoints
curl http://localhost:4100/api/health
```

> 📖 See [Server Architecture](#-server-architecture) section for detailed server documentation.

### Running Examples

```bash
# Basic memory operations
node examples/basic/MemoryEmbeddingJSON.js

# Knowledge graph processing  
node examples/ragno/RagnoPipelineDemo.js

# MCP server integration (32 tools + 15 resources + 8 prompt workflows)
npm run mcp               # Start MCP server
node examples/mcp/SememCoreDemo.js           # Core memory operations
node examples/mcp/RagnoCorpusDecomposition.js # Knowledge graphs
node examples/mcp/ZPTBasicNavigation.js      # 3D navigation

# Complete ZPT suite (5 comprehensive demos)
node examples/mcp/ZPTBasicNavigation.js      # Navigation fundamentals
node examples/mcp/ZPTAdvancedFiltering.js    # Multi-dimensional filtering
node examples/mcp/ZPTUtilityTools.js         # Schema and validation
node examples/mcp/ZPTPerformanceOptimization.js # Performance tuning
node examples/mcp/ZPTIntegrationWorkflows.js # Cross-system integration

# MCP Prompts workflows (NEW!)
# Start MCP server first: npm run mcp
# Then use Claude Desktop or other MCP clients to execute:
# - semem-research-analysis: Analyze research documents
# - semem-memory-qa: Q&A with semantic memory
# - ragno-corpus-to-graph: Build knowledge graphs from text
# - semem-full-pipeline: Complete memory+graph+navigation workflows
```

## 🧠 Core Components

### Semantic Memory
- **Vector embeddings** for semantic similarity
- **Context window management** with intelligent chunking
- **Multi-backend storage** (JSON, SPARQL, in-memory)
- **Intelligent retrieval** with relevance scoring

### Knowledge Graph (Ragno)
- **Corpus decomposition** into semantic units and entities
- **Relationship extraction** and RDF modeling
- **Community detection** using Leiden algorithm
- **Graph analytics** (centrality, k-core, PageRank)

### Zero-Point Traversal (ZPT)
- **Zoom/Pan/Tilt navigation** paradigm
- **Content chunking** strategies (semantic, fixed, adaptive)
- **Corpuscle selection** algorithms
- **Transformation pipelines** for content processing

### Model Context Protocol (MCP)
- **32 comprehensive tools** covering all Semem capabilities
- **15 specialized resources** for documentation and data access
- **8 MCP Prompts** for workflow orchestration and multi-step operations
- **Complete ZPT integration** with 6 navigation tools
- **Cross-system workflows** combining Memory + Ragno + ZPT
- **Standardized API** for LLM integration with schema validation

### MCP Prompts - Workflow Orchestration
Transform complex multi-step operations into simple, guided workflows:

**Memory Workflows:**
- `semem-research-analysis` - Research document analysis with semantic memory context
- `semem-memory-qa` - Q&A using semantic memory retrieval and context assembly
- `semem-concept-exploration` - Deep concept exploration through memory relationships

**Knowledge Graph Construction:**
- `ragno-corpus-to-graph` - Transform text corpus to structured RDF knowledge graph
- `ragno-entity-analysis` - Analyze and enrich entities with contextual relationships

**3D Navigation:**
- `zpt-navigate-explore` - Interactive 3D knowledge space navigation and analysis

**Integrated Workflows:**
- `semem-full-pipeline` - Complete memory → graph → navigation processing pipeline
- `research-workflow` - Academic research document processing and insight generation

**Key Features:**
- **Multi-step Coordination**: Chain multiple tools with context passing
- **Dynamic Arguments**: Type validation, defaults, and requirement checking
- **Conditional Execution**: Skip workflow steps based on conditions
- **Error Recovery**: Graceful handling of failures with partial results
- **Execution Tracking**: Unique execution IDs and detailed step results

## 🤖 Advanced Algorithms

### HyDE (Hypothetical Document Embeddings)
Enhances retrieval by generating hypothetical answers using LLMs, with uncertainty modeling via `ragno:maybe` properties.

```bash
node examples/ragno/Hyde.js
```

### VSOM (Vectorized Self-Organizing Maps)
Provides entity clustering and semantic organization with support for multiple topologies.

```bash
node examples/ragno/VSOM.js
```

### Graph Analytics Suite
- **K-core decomposition** for dense cluster identification
- **Betweenness centrality** for bridge node discovery
- **Community detection** (Leiden algorithm)
- **Personalized PageRank** for semantic traversal

```bash
node examples/ragno/AnalyseGraph.js
node examples/ragno/Communities.js
node examples/ragno/PPR.js
```

## 📚 Examples Documentation

The `examples/` directory contains comprehensive demonstrations organized by functionality:

- **🧠 Basic Examples** (`examples/basic/`): Core memory operations, embedding generation, search
- **🕸️ Ragno Examples** (`examples/ragno/`): Knowledge graph processing, entity extraction, RDF
- **🔌 MCP Examples** (`examples/mcp/`): **Complete MCP integration with 32 tools + 15 resources + 8 prompt workflows**
  - **ZPT Suite**: 5 comprehensive demos covering all ZPT navigation capabilities ✅ COMPLETE
  - **Memory Integration**: Core semantic memory with context management
  - **Knowledge Graphs**: Ragno corpus decomposition and RDF processing
  - **Cross-System Workflows**: Advanced integration patterns
  - **🚀 MCP Prompts**: 8 workflow templates for orchestrating complex multi-step operations ✅ NEW!
- **🎯 ZPT Examples** (`examples/zpt/`): Content processing and navigation

See [examples/README.md](examples/README.md) and [examples/mcp/README.md](examples/mcp/README.md) for detailed documentation and usage instructions.

## 🔧 Configuration

### Storage Backends

**JSON Storage** (simple persistence):
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

**SPARQL Storage** (semantic web integration):
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "endpoint": "https://fuseki.hyperdata.it/semem",
      "graphName": "http://example.org/graph",
      "user": "admin",
      "password": "admin123"
    }
  }
}
```

#### Session-Level Memory Cache

Semem implements a **hybrid storage strategy** that combines persistent storage with session-level caching for immediate semantic retrieval:

**How it works:**
- **`tell` operations** store content in both persistent storage (SPARQL/JSON) AND a session-level cache
- **`ask` operations** search session cache first, then persistent storage, combining results by semantic similarity
- **Immediate availability**: Recently stored concepts are immediately available for retrieval within the same session
- **Semantic similarity**: Uses cosine similarity on embeddings for intelligent result ranking

**Session cache features:**
- **In-memory vector search** with similarity caching for performance
- **Concept tracking** - maintains a set of all concepts from the session
- **Debugging support** - use `inspect` tool to examine cache contents:
  ```bash
  curl -X POST http://localhost:3000/inspect \
    -H "Content-Type: application/json" \
    -d '{"what": "session", "details": true}'
  ```

This solves the common issue where `tell` → `ask` operations couldn't find recently stored content due to indexing delays in persistent storage.

### LLM Providers

Configure multiple providers in `config/config.json`:

```json
{
  "llmProviders": [
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "capabilities": ["chat", "embedding"]
    },
    {
      "type": "claude",
      "apiKey": "${CLAUDE_API_KEY}",
      "chatModel": "claude-3-sonnet-20240229",
      "capabilities": ["chat"]
    }
  ]
}
```

## 🔌 MCP Integration

Semem implements Anthropic's [Model Context Protocol (MCP)](https://docs.anthropic.com/en/docs/agents-and-tools/mcp) for seamless LLM integration:

### Using from NPM Package

If you've installed Semem as an npm package, you can run the MCP server directly:

```bash
# Install globally
npm install -g semem

# Run MCP server via npx (recommended)
npx semem mcp

# Run HTTP MCP server
npx semem mcp-http --port=3000

# Or if installed globally
semem mcp
semem mcp --transport http --port 3000
```

### Using from Source

```bash
# Start MCP server
npm run mcp

# Connect from Claude Desktop or other MCP clients
# Server provides 32 tools + 15 resources + 8 prompt workflows covering all Semem capabilities
```

### Claude Desktop Configuration

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "semem": {
      "command": "npx",
      "args": ["semem mcp"]
    }
  }
}
```

Or for HTTP transport:

```json
{
  "mcpServers": {
    "semem": {
      "command": "npx", 
      "args": ["semem mcp-http", "--port=3000"],
      "env": {
        "MCP_PORT": "3000"
      }
    }
  }
}

### Available MCP Tools (32 Total)
- **Memory Operations** (5 tools): Store, retrieve, generate responses, embeddings, concepts
- **Storage Management** (6 tools): Backend switching, backup/restore, migration, statistics
- **Context Management** (4 tools): Context windows, configuration, pruning, summarization
- **System Monitoring** (4 tools): Configuration, metrics, health checks, system status
- **Knowledge Graphs** (8 tools): Ragno corpus decomposition, entity extraction, SPARQL, analytics
- **ZPT Navigation** (6 tools): 3D navigation, filtering, validation, schema, optimization

### Available MCP Prompts (8 Workflows)
- **Memory Workflows** (3): Research analysis, memory Q&A, concept exploration
- **Knowledge Graph** (2): Corpus-to-graph, entity analysis  
- **3D Navigation** (1): Interactive exploration
- **Integrated** (2): Full pipeline, research workflow

### Available MCP Resources (15 Total)
- **System Resources** (7): Status, API docs, schemas, configuration, metrics
- **Ragno Resources** (4): Ontology, pipeline guide, examples, SPARQL templates
- **ZPT Resources** (4): Navigation schema, examples, concepts guide, performance optimization

## 🧪 Testing

```bash
# Run core tests
npm test

# Run LLM-dependent tests
npm run test:llms

# Generate coverage report
npm run test:coverage

# Run with specific test file
npm test -- tests/unit/Config.spec.js
```

## 🛠️ Development

### Project Scripts

```bash
# Development
npm run dev                # Start dev server with hot reload
npm run build:watch       # Build and watch for changes

# Testing
npm test                   # Run unit tests
npm run test:coverage     # Generate coverage report

# Documentation
npm run docs              # Generate JSDoc documentation

# HTTP Servers
./start.sh                # Start all servers (API + UI)
./stop.sh                 # Stop all servers
node src/servers/api-server.js    # Start API server only
node src/servers/ui-server.js     # Start UI server only

# MCP Server
npm run mcp    # Start new MCP server
npm run mcp-example       # Run MCP client example
```

### Adding New Examples

1. Place in appropriate category directory (`basic/`, `ragno/`, `mcp/`, `zpt/`)
2. Follow naming convention: `PascalCase.js`
3. Include comprehensive documentation
4. Add error handling and cleanup
5. Update examples/README.md

## 📖 Documentation

- **[Examples Documentation](examples/README.md)**: Comprehensive examples guide
- **[API Documentation](docs/api/README.md)**: REST API and SDK reference
- **[MCP Documentation](docs/mcp/README.md)**: Model Context Protocol integration
- **[MCP Prompts Guide](mcp/prompts/resources/prompt-guide.md)**: Complete workflow orchestration guide
- **[MCP Prompts Examples](mcp/prompts/resources/examples.md)**: Real-world usage patterns
- **[Architecture Guide](docs/architecture.md)**: System design and components
- **[Algorithm Documentation](docs/ragno/README.md)**: Advanced algorithms guide

## 🔍 Troubleshooting

### Common Issues

**Ollama Connection:**
```bash
# Check Ollama status
ollama list
curl http://localhost:11434/api/tags
```

**SPARQL Endpoint:**
```bash
# Test connectivity
curl -X POST http://localhost:3030/dataset/query \
  -H "Content-Type: application/sparql-query" \
  -d "SELECT * WHERE { ?s ?p ?o } LIMIT 1"
```

**Memory Issues:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug node examples/basic/MemoryEmbeddingJSON.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Update documentation
5. Submit a pull request

### Code Style
- Use ES modules
- Follow existing patterns
- Include JSDoc comments
- Add comprehensive error handling

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- **Documentation**: [docs/](docs/)
- **Examples**: [examples/](examples/)
- **MCP Server**: [mcp/](mcp/)
- **Issue Tracker**: [GitHub Issues](https://github.com/your-org/semem/issues)

---

**Semem** - Intelligent semantic memory for the AI age.