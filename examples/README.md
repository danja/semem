# Semem Examples

This directory contains examples demonstrating the full capabilities of the Semem semantic memory system. The examples are organized into categories based on functionality and complexity.

## Directory Structure

```
examples/
├── basic/          # Core Semem functionality examples
├── ragno/          # Knowledge graph and RDF examples  
├── mcp/            # Model Context Protocol integration
├── zpt/            # Zero-Point Traversal content processing
├── data/           # Sample data files
└── pending/        # Work-in-progress examples
```

## Quick Start

To run any example:
```bash
# Basic memory operations
node examples/basic/MemoryEmbeddingJSON.js

# Knowledge graph processing
node examples/ragno/RagnoPipelineDemo.js

# MCP server integration
npm run mcp-example

# ZPT content processing
node examples/zpt/BasicNavigation.js
```

## Prerequisites

- **Node.js 20.11.0+**
- **Ollama** with models:
  - `ollama pull qwen2:1.5b` (chat)
  - `ollama pull nomic-embed-text` (embeddings)
- **SPARQL endpoint** (optional, for advanced examples)
- **Environment variables** in `.env` file

```bash
cp example.env .env
# Edit .env with your API keys and configuration
```

## Categories

### 🧠 Basic Examples (`examples/basic/`)

Core Semem functionality demonstrating memory storage, retrieval, and semantic operations.

| Example | Description | Prerequisites |
|---------|-------------|---------------|
| **MemoryEmbeddingJSON.js** | Basic memory operations with JSON storage | Ollama |
| **MemoryEmbeddingSPARQL.js** | Memory operations with SPARQL backend | Ollama, Fuseki |
| **ArticleEmbedding.js** | Generate and store article embeddings | Ollama, Fuseki |
| **ArticleSearch.js** | Semantic search through article collections | Ollama, Fuseki |
| **ContextManagement.js** | Context window and memory management | Ollama |
| **CheckLLMProviders.js** | Test and validate LLM provider connections | Various APIs |
| **ClaudeEnrichJSON.js** | Enhance data using Claude API | Claude API |
| **HTTPCalls.js** | HTTP API integration examples | API servers |

**Key Features Demonstrated:**
- Memory initialization and configuration
- Embedding generation and storage
- Semantic similarity search
- Context management
- Multi-provider LLM integration
- JSON and SPARQL persistence

### 🕸️ Ragno Examples (`examples/ragno/`)

Knowledge graph construction, entity extraction, and RDF processing using the Ragno subsystem.

| Example | Description | Prerequisites |
|---------|-------------|---------------|
| **RagnoPipelineDemo.js** | Complete knowledge graph pipeline | Ollama, optional Fuseki |
| **Communities.js** | Community detection in knowledge graphs | Ollama |
| **AnalyseGraph.js** | Graph analytics and centrality measures | Ollama |
| **GraphRAGConceptAugment.js** | Concept augmentation with graph analysis | Ollama, Fuseki |
| **Hyde.js** | Hypothetical Document Embeddings | Ollama |
| **VSOM.js** | Vector Self-Organizing Maps | Ollama |
| **PPR.js** | Personalized PageRank algorithms | Ollama |
| **OllamaEnrichSPARQL.js** | SPARQL data enrichment via Ollama | Ollama, Fuseki |

**Key Features Demonstrated:**
- Corpus decomposition into semantic units
- Entity and relationship extraction
- RDF dataset creation and export
- Community detection (Leiden algorithm)
- Graph centrality analysis
- Vector similarity indexing (HNSW)
- SPARQL integration

### 🔌 MCP Examples (`examples/mcp/`)

Model Context Protocol integration for AI assistant interoperability with comprehensive GraphRAG capabilities.

| Example | Description | Prerequisites |
|---------|-------------|---------------|
| **MCPClient.js** | Original MCP client demonstration | MCP server running |
| **GraphRAGDemo.js** | GraphRAG features showcase with verbose logging | MCP server, chalk |
| **SememCoreDemo.js** | Traditional Semem capabilities demonstration | MCP server, chalk |
| **IntegratedWorkflowDemo.js** | Advanced integrated workflows | MCP server, chalk |

**Key Features Demonstrated:**

**GraphRAG Capabilities (new):**
- Document management (store, list, delete with metadata)
- Relationship management (create, search, delete entity relationships)
- Hybrid search (vector similarity + graph traversal + ZPT navigation)
- Graph analytics (statistics, node discovery, structure export)
- Enhanced retrieval (semantic document search, entity observations)

**Semem Core Features:**
- Semantic memory storage and retrieval
- Vector embedding generation and analysis
- Advanced concept extraction
- Memory-enhanced response generation
- Performance monitoring and optimization

**Ragno Knowledge Graph:**
- RDF-based entity and semantic unit creation
- Corpus decomposition into knowledge graphs
- Relationship extraction and analysis
- Multi-format graph exports

**ZPT Content Processing:**
- Multi-dimensional content navigation (zoom/pan/tilt)
- Intelligent content chunking strategies
- Corpuscle selection and filtering
- Content transformation pipelines

**Advanced Features:**
- Comprehensive workflow orchestration
- Data flow tracking and visualization
- Performance metrics and optimization
- Progress monitoring with colored output
- Error handling with graceful fallbacks

**Usage:**
```bash
# Start MCP server (in one terminal)
npm run mcp-server-new

# Run original client example
npm run mcp-example

# Run GraphRAG demonstration
node examples/mcp/GraphRAGDemo.js

# Run Semem core demonstration  
node examples/mcp/SememCoreDemo.js

# Run integrated workflow demonstration
node examples/mcp/IntegratedWorkflowDemo.js
```

**Logging and Visualization:**
All new examples feature extensive verbose logging with:
- Colored terminal output using chalk
- Progress bars and performance tracking
- Workflow step completion monitoring
- Data flow analysis and metrics
- System resource usage monitoring
- Comprehensive error reporting with fallback modes

### 🎯 ZPT Examples (`examples/zpt/`)

Zoom, Pan, Tilt system for intelligent content navigation and processing.

| Example | Description | Prerequisites |
|---------|-------------|---------------|
| **BasicNavigation.js** | Core ZPT navigation patterns | Ollama |
| **AdvancedFiltering.js** | Complex filtering and selection | Ollama |
| **TransformationPipeline.js** | Content transformation workflows | Ollama |
| **PerformanceOptimization.js** | Optimization strategies | Ollama |
| **APIEndpoints.js** | ZPT API integration patterns | API servers |

**Key Features Demonstrated:**
- Zoom/Pan/Tilt navigation paradigm
- Content chunking strategies
- Corpuscle selection algorithms
- Transformation pipelines
- Performance optimization
- API integration patterns

## Running Examples

### Environment Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp example.env .env
   # Edit .env with your API keys
   ```

3. **Start Ollama:**
   ```bash
   ollama serve
   ollama pull qwen2:1.5b
   ollama pull nomic-embed-text
   ```

4. **Optional - Start SPARQL endpoint:**
   ```bash
   # Using Docker
   docker run -d --name fuseki -p 3030:3030 stain/jena-fuseki
   ```

### Example Execution

**Basic Memory Operations:**
```bash
node examples/basic/MemoryEmbeddingJSON.js
```

**Knowledge Graph Pipeline:**
```bash
node examples/ragno/RagnoPipelineDemo.js
```

**MCP Integration:**
```bash
# Terminal 1: Start MCP server
npm run mcp-server-new

# Terminal 2: Run client
npm run mcp-example
```

**ZPT Content Processing:**
```bash
node examples/zpt/BasicNavigation.js
```

## Configuration

Examples use the main configuration system. Key configuration files:

- `config/config.json` - Main configuration
- `.env` - Environment variables and API keys
- Individual example configs where needed

## Data Files

The `examples/data/` directory contains:
- Sample JSON datasets
- Test documents
- Configuration files
- Generated outputs

## Common Patterns

### Error Handling
All examples include:
- Graceful shutdown handlers
- Connection timeout handling
- Resource cleanup
- Informative error messages

### Logging
Examples use structured logging:
```javascript
import logger from 'loglevel';
logger.setLevel('info'); // Set appropriate level
```

### Resource Management
Examples demonstrate proper:
- Memory manager initialization
- Connection pooling
- Resource disposal
- Memory cleanup

## Troubleshooting

### Common Issues

**Ollama Connection:**
```bash
# Check Ollama status
ollama list
curl http://localhost:11434/api/tags
```

**Model Availability:**
```bash
# Install required models
ollama pull qwen2:1.5b
ollama pull nomic-embed-text
```

**SPARQL Endpoint:**
```bash
# Test SPARQL connectivity
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

Enable debug logging for any example:
```bash
LOG_LEVEL=debug node examples/basic/MemoryEmbeddingJSON.js
```

## Pending Examples (`examples/pending/`)

Work-in-progress examples that demonstrate additional features:

- **MCPClientExample.js** - Alternative MCP client patterns
- **OllamaExample.js** - Pure Ollama integration
- **SimpleClaudeExample.js** - Basic Claude API usage
- **SearchServer.js** - Semantic search API server
- **SPARQLExample.js** - Advanced SPARQL operations
- **REPL.js** - Interactive command-line interface
- **ChatSnippet.js** - Chat interface examples

## Contributing

When adding new examples:

1. **Place in appropriate category directory**
2. **Follow naming conventions**: `PascalCase.js`
3. **Include comprehensive documentation**
4. **Add error handling and cleanup**
5. **Update this README**
6. **Test with clean environment**

### Example Template

```javascript
/**
 * Example Name - Brief Description
 * 
 * Detailed description of what this example demonstrates.
 * 
 * Prerequisites:
 * - List required services
 * - List required models
 * - List required configuration
 */

import logger from 'loglevel';
// Other imports...

// Global cleanup reference
let globalCleanup = null;

async function shutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    if (globalCleanup) {
        await globalCleanup();
    }
    process.exit(0);
}

// Signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
    try {
        // Example implementation
        
        // Set up cleanup
        globalCleanup = async () => {
            // Cleanup resources
        };
        
    } catch (error) {
        logger.error('Example failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
```

## License

All examples are provided under the same MIT license as the main Semem project.