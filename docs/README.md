# Semem Documentation

Welcome to the comprehensive documentation for Semem - a semantic memory management system for intelligent agents. This documentation provides detailed information about the architecture, APIs, and usage patterns for all system components.

## Overview

Semem (Semantic Memory) is a Node.js library that provides intelligent memory management for AI applications. It integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL) to create a powerful knowledge management system.

### Key Features

- **Multi-Provider LLM Support**: Claude, Ollama, Mistral, and more
- **Knowledge Graph Integration**: RDF-based semantic relationships
- **Vector Similarity Search**: High-performance embedding-based retrieval
- **Multiple Storage Backends**: In-memory, JSON, SPARQL, and cached variants
- **Real-time Web Interface**: Interactive visualization and management
- **Comprehensive APIs**: REST, CLI, and REPL interfaces
- **Advanced Analytics**: Community detection, centrality analysis, and clustering

## Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Frontend      │  │      API        │  │   Connectors    │
│                 │  │                 │  │                 │
│ • Web UI        │  │ • HTTP Server   │  │ • Claude        │
│ • Visualization │  │ • CLI Handler   │  │ • Ollama        │
│ • Real-time     │  │ • REPL Handler  │  │ • Mistral       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Handlers     │  │      Core       │  │     Ragno       │
│                 │  │                 │  │                 │
│ • LLM Handler   │  │ • Memory Mgr    │  │ • Knowledge     │
│ • Embedding     │  │ • Context Mgr   │  │   Graph         │
│ • Cache Mgr     │  │ • Config        │  │ • Analytics     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Stores      │  │    Services     │  │     Utils       │
│                 │  │                 │  │                 │
│ • Memory Store  │  │ • Search Svc    │  │ • Validation    │
│ • SPARQL Store  │  │ • Embedding Svc │  │ • SPARQL Helpers│
│ • JSON Store    │  │ • VSOM Service  │  │ • Discovery     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Module Documentation

### Core System Components

#### [API Module](./api/)
Comprehensive interfaces for system interaction including HTTP REST APIs, command-line interfaces, and REPL environments. Provides authentication, validation, and request processing capabilities.

#### [Connectors Module](./connectors/)
Unified interfaces for integrating with various LLM providers (Claude, Ollama, Mistral). Implements the Adapter pattern to normalize different provider APIs into a consistent interface.

#### [Handlers Module](./handlers/)
Core processing capabilities for managing LLM interactions, embeddings, and caching. Acts as the orchestration layer between high-level APIs and low-level connector implementations.

#### [Stores Module](./stores/)
Flexible persistence layer supporting multiple storage backends from in-memory caching to distributed RDF triple stores. Provides unified CRUD operations with backend-specific optimizations.

### Advanced Features

#### [Ragno Module](./ragno/)
Knowledge graph and semantic reasoning engine providing advanced graph analytics, community detection, and semantic relationship modeling using RDF/SPARQL technologies.

#### [Frontend Module](./frontend/)
Modern, interactive web interface built with vanilla JavaScript and D3.js. Offers real-time visualization, conversational interfaces, and comprehensive system administration capabilities.

#### [Services Module](./services/)
Specialized business logic services that orchestrate complex operations across multiple system components. Implements domain-specific workflows and integrations.

### Supporting Infrastructure

#### [Utils Module](./utils/)
Essential utility functions for validation, data transformation, configuration management, and integration with external services like Apache Fuseki.

#### [Types Module](./types/)
Comprehensive TypeScript type definitions and schema validation ensuring type safety across all components with runtime validation for data integrity.

## Quick Start

### Installation

```bash
npm install semem
```

### Basic Usage

```javascript
import { MemoryManager } from 'semem';

// Initialize with default configuration
const memory = new MemoryManager();
await memory.initialize();

// Store a memory
const result = await memory.store({
  prompt: "What is machine learning?",
  response: "Machine learning is a subset of AI that enables systems to learn from data..."
});

// Search memories
const memories = await memory.search("artificial intelligence", {
  limit: 10,
  threshold: 0.8
});

console.log(`Found ${memories.length} related memories`);
```

### Configuration

```javascript
import { Config } from 'semem';

const config = new Config({
  llm: {
    provider: 'ollama',
    model: 'qwen2:1.5b',
    endpoint: 'http://localhost:11434'
  },
  embedding: {
    model: 'nomic-embed-text',
    dimensions: 1536
  },
  storage: {
    type: 'sparql',
    endpoint: 'http://localhost:3030/semem'
  }
});
```

## API Reference

### Core APIs

- **Memory Management**: Store, retrieve, and search semantic memories
- **Embedding Operations**: Generate and manage vector embeddings
- **Knowledge Graph**: Entity and relationship management
- **Search & Retrieval**: Multi-modal search capabilities
- **Analytics**: Graph analysis and community detection

### HTTP REST API

```bash
# Memory operations
POST /api/memory          # Store new memory
GET /api/memory/:id       # Retrieve memory
PUT /api/memory/:id       # Update memory
DELETE /api/memory/:id    # Delete memory

# Search operations
POST /api/search          # Semantic search
GET /api/search/similar/:id  # Find similar memories

# Graph operations
GET /api/graph/entities   # List entities
POST /api/graph/query     # SPARQL query
GET /api/graph/analytics  # Graph analytics
```

### CLI Interface

```bash
# Memory operations
semem memory store --prompt "question" --response "answer"
semem memory search --query "machine learning" --limit 10

# Graph operations
semem graph query --sparql "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
semem graph analyze --algorithm community-detection

# System operations
semem config show
semem health check
semem backup create
```

## Development Guide

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/hyperdata/semem.git
cd semem

# Install dependencies
npm install

# Copy configuration template
cp example.env .env

# Start development servers
npm run start:ui    # Web interface on http://localhost:4120
npm run start:api   # API server on http://localhost:3000
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests

# Generate coverage report
npm run test:coverage
```

### Building Documentation

```bash
# Generate documentation
npm run docs

# Serve documentation locally
npm run docs:serve

# Publish to GitHub Pages
npm run ghp
```

## Contributing

### Code Style

- Use ES modules and modern JavaScript features
- Follow JSDoc commenting standards
- Implement comprehensive error handling
- Write tests for all new functionality
- Maintain backward compatibility

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request with detailed description

## Support

### Resources

- **GitHub Repository**: [https://github.com/hyperdata/semem](https://github.com/hyperdata/semem)
- **Issue Tracker**: [GitHub Issues](https://github.com/hyperdata/semem/issues)
- **Documentation**: [https://hyperdata.github.io/semem/](https://hyperdata.github.io/semem/)
- **Examples**: [Examples Directory](./examples/)

### Community

- **Discussions**: GitHub Discussions for questions and ideas
- **Discord**: Community chat and support
- **Twitter**: [@SememAI](https://twitter.com/SememAI) for updates and news

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Acknowledgments

- Built with modern web technologies and semantic web standards
- Integrates with leading LLM providers and open-source models
- Inspired by cognitive science research on human memory systems
- Community-driven development with contributions from researchers and developers worldwide