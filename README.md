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