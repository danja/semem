# Semem

**Semantic Memory for Intelligent Agents**

Semem is a Node.js toolkit for AI memory management that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It offers knowledge graph retrieval and augmentation algorithms within a conceptual model based on the [Ragno](https://github.com/danja/ragno) (knowledge graph description) and [ZPT](https://github.com/danja/zpt) (knowledge graph navigation) ontologies. It is a [Tensegrity](https://github.com/danja/tensegrity) project.

**Status 2025-06-13 :** mostly in place but very, very sketchy. It has an MCP server with very limited functionality, HTTP APIs and a crude UI with a little more and code APIs that mostly work. The description below is very AI-sloppy. A lot to do before much will be usable. But a lot of the examples at least do *something*.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.11.0-brightgreen.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 🚀 Key Features

- **🧠 Semantic Memory**: Intelligent context retrieval and memory organization with vector embeddings and SPARQL
- **🕸️ Knowledge Graph Processing**: End-to-end Ragno pipeline for entity extraction and relationship modeling
- **🎯 Zoom, Pan Tilt (ZPT)**: Knowledge navigation and processing, cinematic analogy 
- **🔌 Model Context Protocol (MCP)**: JSON-RPC 2.0 API for seamless LLM and agent integration
- **🤖 Advanced Algorithms**: HyDE, VSOM, graph analytics, community detection, and Personal PageRank
- **🔗 Multi-Provider LLM Support**: Ollama, Claude, Mistral, and other providers via unified connector system
- **📊 Multiple Storage Backends**: In-memory, JSON, and SPARQL/RDF with caching optimization

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

# MCP server integration
npm run mcp-server-new     # Start MCP server
npm run mcp-example        # Run client example

# ZPT content processing
node examples/zpt/BasicNavigation.js
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
- **Standardized API** for LLM integration
- **Tool definitions** for all Semem capabilities
- **Resource management** for data access
- **Schema validation** for reliable interactions

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
- **🔌 MCP Examples** (`examples/mcp/`): Model Context Protocol integration
- **🎯 ZPT Examples** (`examples/zpt/`): Content processing and navigation

See [examples/README.md](examples/README.md) for detailed documentation and usage instructions.

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

```bash
# Start MCP server
npm run mcp-server-new

# Connect from Claude Desktop or other MCP clients
# Server provides 10+ tools covering all Semem capabilities
```

### Available MCP Tools
- **Memory Operations**: Store, retrieve, generate responses
- **Embeddings**: Generate vector embeddings for text
- **Concepts**: Extract semantic concepts
- **Knowledge Graph**: Entity creation, corpus decomposition  
- **Content Processing**: Chunking, corpuscle selection

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
npm run mcp-server-new    # Start new MCP server
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