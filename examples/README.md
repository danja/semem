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

#### 🌟 **SPARQLInferenceDemo.js** - Comprehensive SPARQL-Based Inference System

The definitive demonstration of Semem's full capabilities using SPARQL storage for advanced semantic reasoning and cross-domain inference.

**What it does:**
- **SPARQL Ingestion**: Loads three discursive documents (climate science, urban planning, neuroscience) into RDF triplestore
- **Knowledge Graph Construction**: Creates comprehensive RDF knowledge graph with entities, relationships, and semantic units
- **Advanced SPARQL Queries**: Executes sophisticated inference queries for cross-domain analysis
- **Semantic Question Answering**: Answers complex questions by reasoning across domains
- **Graph Analytics**: Performs community detection, PageRank analysis, and centrality measures
- **VSOM Visualization**: Creates vector self-organizing maps for high-dimensional embedding analysis
- **HyDE Enhancement**: Uses hypothetical document embeddings for improved retrieval
- **Multi-Modal Integration**: Combines vector search, graph traversal, and semantic reasoning

**How to run:**
```bash
# Prerequisites: Fuseki SPARQL server running on localhost:3030
docker run -d --name fuseki -p 3030:3030 stain/jena-fuseki
# Create dataset named "semem" in Fuseki web interface (http://localhost:3030)

# Run comprehensive SPARQL demo
node examples/SPARQLInferenceDemo.js
```

**What to expect:**
- Complete ingestion of 8,000+ words across three knowledge domains
- RDF knowledge graph with 50+ entities and relationships
- Advanced SPARQL queries revealing cross-domain connections
- Semantic answers to questions like "How do neural networks relate to urban planning?"
- Community detection revealing semantic clusters
- PageRank analysis showing concept importance
- VSOM clustering of document embeddings
- Comprehensive system report with statistics and insights

**Key Insights Demonstrated:**
- SPARQL storage enables sophisticated semantic reasoning
- Cross-domain entity extraction discovers conceptual bridges
- Graph analytics reveal hidden relationship patterns  
- Integrated pipeline enables complex multi-modal reasoning
- Knowledge graphs facilitate interdisciplinary understanding

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

#### MCPClient.js - Original MCP Integration

The foundational MCP example that demonstrates basic integration with Semem's MCP server.

**What it does:**
- Connects to the Semem MCP server using stdio transport
- Demonstrates semantic memory operations (store, retrieve, generate embeddings)
- Shows knowledge graph processing with Ragno (entity creation, corpus decomposition)
- Illustrates ZPT content processing (chunking, selection)
- Runs an integrated workflow combining all three subsystems

**How to run:**
```bash
# Terminal 1: Start MCP server
npm run mcp-server-new

# Terminal 2: Run client
npm run mcp-example
```

**What to expect:**
- Clear step-by-step output showing each operation
- Demonstration of semantic memory storage and retrieval
- Knowledge graph entity creation and relationships
- Content chunking with different strategies
- End-to-end pipeline from raw text to enhanced memory

#### GraphRAGDemo.js - GraphRAG Capabilities Showcase

Comprehensive demonstration of the new GraphRAG-compatible tools with extensive logging and progress tracking.

**What it does:**
- Document Management: Stores academic documents with metadata, generates embeddings, extracts concepts
- Relationship Management: Creates entity relationships, searches by type and entity, builds knowledge graph
- Hybrid Search: Combines vector similarity with graph traversal and ZPT navigation
- Graph Analytics: Analyzes graph statistics, discovers nodes, exports structure in multiple formats
- Enhanced Retrieval: Advanced document search and entity enrichment with observations

**How to run:**
```bash
# Terminal 1: Start MCP server
npm run mcp-server-new

# Terminal 2: Run GraphRAG demo
node examples/mcp/GraphRAGDemo.js
```

**What to expect:**
- Colorful progress indicators with chalk-styled output
- Performance metrics for each operation (duration, memory usage)
- Creation of documents about AI, machine learning, and deep learning topics
- Building of semantic relationships between concepts
- Multi-dimensional search results with hybrid scoring
- Graph statistics showing connectivity and node distribution
- Resource tracking summary at completion

#### SememCoreDemo.js - Traditional Semem Capabilities

In-depth exploration of Semem's core semantic memory features with enhanced performance monitoring.

**What it does:**
- Semantic Memory: Stores diverse conversations about scientific topics with metadata
- Embedding Analysis: Generates and analyzes vector embeddings with mathematical properties
- Concept Extraction: Processes complex technical texts to extract key concepts
- Memory Retrieval: Performs similarity-based search with threshold filtering
- Response Generation: Creates memory-enhanced responses using retrieved context
- Ragno Processing: Creates structured entities, semantic units, and performs corpus decomposition
- ZPT Processing: Tests multiple chunking strategies and content selection methods

**How to run:**
```bash
# Terminal 1: Start MCP server  
npm run mcp-server-new

# Terminal 2: Run core demo
node examples/mcp/SememCoreDemo.js
```

**What to expect:**
- Comprehensive system health check and capability discovery
- Storage of conversations on quantum mechanics, AI, biology, and thermodynamics
- Detailed embedding analysis including vector magnitude and distribution
- Advanced concept extraction from technical literature
- Performance benchmarking for all operations (embeddings, retrievals, generations)
- Knowledge graph construction with entity frequency analysis
- Multiple content chunking strategies comparison (fixed, semantic, adaptive, hierarchical)
- ZPT navigation with different zoom/pan/tilt configurations
- Complete performance report with operation timing and memory usage

#### IntegratedWorkflowDemo.js - Advanced Integrated Workflows

Sophisticated demonstration of integrated workflows combining all Semem capabilities with comprehensive analysis.

**What it does:**
- Document Ingestion Pipeline: Processes academic documents, generates chunks, builds knowledge graph
- Knowledge Graph Enrichment: Creates domain relationships, adds entity observations
- Multi-Modal Search: Executes hybrid searches with different configurations and parameters
- Graph Analytics: Performs comprehensive graph analysis and exports in multiple formats
- Workflow Orchestration: Coordinates end-to-end data flow with performance tracking

**How to run:**
```bash
# Terminal 1: Start MCP server
npm run mcp-server-new

# Terminal 2: Run integrated demo
node examples/mcp/IntegratedWorkflowDemo.js
```

**What to expect:**
- Multi-stage workflow with detailed progress visualization
- Processing of documents on quantum computing, AI in healthcare, and renewable energy
- Intelligent content chunking with ZPT semantic boundary detection
- Ragno knowledge graph construction with entity and relationship extraction
- Domain relationship creation connecting quantum computing, AI, and climate technologies
- Entity enrichment with contextual observations and confidence scoring
- Advanced hybrid search combining vector similarity, graph traversal, and ZPT navigation
- Comprehensive graph analytics with connectivity metrics and node discovery
- Multi-format graph exports (adjacency lists, edge lists, Cytoscape format)
- Complete workflow analysis report with performance metrics, data flow tracking, and integration insights
- Artifact summary showing all created documents, entities, relationships, and memories

**Common Features Across New Examples:**

**Logging and Visualization:**
- Colored terminal output using chalk for clear visual distinction
- Progress bars showing completion percentage for multi-step operations
- Performance tracking with execution time and memory usage monitoring
- Workflow step completion with success/failure indicators
- Data flow visualization showing transformations between pipeline stages
- System resource monitoring including memory delta tracking
- Comprehensive error reporting with graceful fallback modes

**Error Handling:**
- Graceful degradation when services are unavailable
- Demo modes for tools that require external dependencies
- Comprehensive exception handling with detailed error messages
- Automatic cleanup and resource disposal on shutdown

**Usage:**
```bash
# Start MCP server (required for all examples)
npm run mcp-server-new

# Run individual examples
npm run mcp-example                           # Original client
node examples/mcp/GraphRAGDemo.js            # GraphRAG features
node examples/mcp/SememCoreDemo.js           # Core capabilities  
node examples/mcp/IntegratedWorkflowDemo.js  # Advanced workflows
```

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