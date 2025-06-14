# Semem - Semantic Memory System

![npm version](https://img.shields.io/npm/v/semem)
![license](https://img.shields.io/npm/l/semem)
![node](https://img.shields.io/node/v/semem)

An AI-powered semantic memory system that combines large language models (LLMs) with RDF knowledge graphs and vector embeddings for intelligent memory management.

## 🚀 Quick Start

### Installation

```bash
npm install semem
```

### Basic Usage

```javascript
import { MemoryManager, OllamaConnector } from 'semem';

// Create LLM connector
const llmProvider = new OllamaConnector();

// Initialize memory manager
const memoryManager = new MemoryManager({
  llmProvider,
  chatModel: 'qwen2:1.5b',
  embeddingModel: 'nomic-embed-text',
  dimension: 1536
});

await memoryManager.init();

// Add interactions to memory
await memoryManager.addInteraction(
  "What is machine learning?",
  "Machine learning is a subset of AI that enables computers to learn without explicit programming."
);

// Retrieve relevant memories
const memories = await memoryManager.retrieveRelevantInteractions(
  "Tell me about AI learning", 
  0.7  // similarity threshold
);

// Generate contextual response
const response = await memoryManager.generateResponse(
  "How do computers learn?",
  [], // context interactions
  memories // retrieved memories
);

console.log(response);
```

## 🔧 MCP (Model Context Protocol) Integration

Semem provides seamless integration with Claude's MCP system for enhanced AI capabilities.

### Setup with Claude

```bash
# Add Semem as an MCP server to Claude
claude mcp add semem npx semem-mcp
```

### Manual MCP Server

```bash
# Start MCP server manually
npx semem-mcp

# Or with custom configuration
npx semem-mcp --config ./my-config.json --port 3000
```

### Programmatic MCP Usage

```javascript
import { createMCPServer } from 'semem';

const server = await createMCPServer({
  transport: 'stdio',  // or 'http', 'sse'
  port: 3000,          // for http/sse transport
  configPath: './config.json'
});

console.log('MCP server running...');
```

## 📦 Modular Architecture

Semem is built with a modular architecture. Import only what you need:

### Core Components

```javascript
import { 
  MemoryManager,     // Main memory management
  Config,            // Configuration management
  ContextManager     // Context window management
} from 'semem';
```

### Storage Providers

```javascript
import { 
  InMemoryStore,     // Transient memory storage
  JSONStore,         // File-based persistence
  SPARQLStore        // RDF/SPARQL backend
} from 'semem';
```

### LLM Connectors

```javascript
import { 
  OllamaConnector,   // Local Ollama models
  ClaudeConnector,   // Anthropic Claude
  MistralConnector   // Mistral AI
} from 'semem';
```

### Knowledge Graph (Ragno)

```javascript
import { 
  Entity, 
  SemanticUnit, 
  Relationship,
  decomposeCorpus 
} from 'semem/ragno';

// Decompose text into knowledge graph
const result = await decomposeCorpus(textChunks, llmHandler, {
  extractRelationships: true,
  maxEntitiesPerChunk: 10
});

console.log(result.entities, result.relationships);
```

### Zero-Point Traversal (ZPT)

```javascript
import { 
  CorpuscleSelector,
  ParameterValidator 
} from 'semem/zpt';

// Navigate content with zoom/pan/tilt parameters
const selector = new CorpuscleSelector(corpus);
const result = await selector.select({
  zoom: { level: 'entity', granularity: 4 },
  tilt: { representation: 'embedding' },
  transform: { format: 'markdown', maxTokens: 4000 }
});
```

## 🔨 CLI Usage

Semem provides a command-line interface for various operations:

```bash
# Start MCP server
semem mcp --transport stdio

# Initialize new project
semem init --dir ./my-project

# Start HTTP server
semem server --port 4100

# Run examples
semem example basic/MemoryEmbedding.js
```

## 📊 Features

### 🧠 Semantic Memory
- **Vector Embeddings**: Generate and search semantic embeddings
- **Context Management**: Intelligent context window management
- **Memory Decay**: Configurable memory decay and access patterns
- **Multi-provider Support**: Ollama, Claude, Mistral, OpenAI

### 🕸️ Knowledge Graphs (Ragno)
- **RDF-based Entities**: W3C compliant RDF entities and relationships
- **Corpus Decomposition**: Automatic text-to-knowledge-graph conversion
- **SPARQL Integration**: Query and manage knowledge with SPARQL
- **Graph Analytics**: Community detection, PageRank, graph traversal

### 🎯 Zero-Point Traversal (ZPT)
- **Parameter-based Navigation**: Zoom/Pan/Tilt content exploration
- **Multiple Representations**: Keywords, embeddings, graphs, temporal
- **Content Transformation**: JSON, Markdown, structured, conversational
- **Token Management**: Intelligent chunking and token budgeting

### 🔗 MCP Integration
- **Native Claude Support**: Seamless integration with Claude
- **22 MCP Tools**: Memory, knowledge graph, and navigation tools
- **Multiple Transports**: stdio, HTTP, Server-Sent Events
- **Production Ready**: Error handling and graceful degradation

## 🛠️ Configuration

### Environment Variables

```bash
# LLM Provider Configuration
OLLAMA_HOST=http://localhost:11434
CLAUDE_API_KEY=your-claude-key
MISTRAL_API_KEY=your-mistral-key
OPENAI_API_KEY=your-openai-key

# Storage Configuration  
SPARQL_ENDPOINT=https://your-fuseki-server.com/dataset
SPARQL_USER=admin
SPARQL_PASSWORD=password
```

### Configuration File

```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "endpoint": "https://fuseki.hyperdata.it/semem",
      "graphName": "http://example.org/data"
    }
  },
  "models": {
    "chat": {
      "provider": "ollama",
      "model": "qwen2:1.5b"
    },
    "embedding": {
      "provider": "ollama", 
      "model": "nomic-embed-text"
    }
  },
  "memory": {
    "dimension": 1536,
    "similarityThreshold": 0.7,
    "contextWindow": 3
  }
}
```

## 📚 TypeScript Support

Semem includes comprehensive TypeScript definitions:

```typescript
import { 
  MemoryManager, 
  MemoryManagerConfig,
  LLMProvider,
  Interaction,
  RetrievalResult 
} from 'semem';

const config: MemoryManagerConfig = {
  llmProvider: new OllamaConnector(),
  chatModel: 'qwen2:1.5b',
  dimension: 1536
};

const manager = new MemoryManager(config);
```

## 🧪 Examples

The package includes comprehensive examples:

```bash
# Memory management
node examples/basic/MemoryEmbeddingJSON.js

# Knowledge graph creation
node examples/ragno/RagnoPipelineDemo.js

# ZPT navigation
node examples/zpt/BasicNavigation.js

# MCP integration
node examples/mcp/MCPClient.js
```

## 🤝 Contributing

We welcome contributions! See our [GitHub repository](https://github.com/danja/semem) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/danja/semem)
- [Documentation](https://github.com/danja/semem#readme)
- [Issue Tracker](https://github.com/danja/semem/issues)
- [MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)

## 🏷️ Keywords

`semantic-memory` `ai` `llm` `embeddings` `vector-database` `knowledge-graph` `rdf` `sparql` `ragno` `mcp` `model-context-protocol` `claude` `ollama` `typescript`