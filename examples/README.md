# Semem Examples

This directory contains comprehensive examples demonstrating the capabilities of the Semem (Semantic Memory) library and the Ragno knowledge graph system.

## Environment Setup

Most examples require environment variables that should be set in a `.env` file in the project root:

```bash
cp example.env .env
# Edit .env with your API keys and configuration
```

## Core Ragno Pipeline Examples

### RagnoPipelineDemo.js
```bash
node examples/RagnoPipelineDemo.js
```
Complete demonstration of the Ragno knowledge graph pipeline using RDF-Ext infrastructure. Performs corpus decomposition into semantic units and entities, generates RDF attributes using graph analytics, applies Leiden clustering for community detection, builds HNSW vector index for similarity search, and exports to multiple RDF formats.

### RagnoProductionAPIDemo.js
```bash
node examples/RagnoProductionAPIDemo.js
```
Showcases the full Ragno Phase 6 production API infrastructure with comprehensive deployment demonstration. Features production API server with monitoring, advanced unified search capabilities, real-time performance tracking, multi-tier caching with Redis support, and export to multiple formats (Turtle, JSON-LD).

### RagnoServerDeployment.js
```bash
node examples/RagnoServerDeployment.js
```
Production server deployment guide demonstrating proper environment configuration, Kubernetes/Docker compatibility, security best practices, resource management, and graceful shutdown procedures. Shows how to deploy Ragno in real-world production environments.

## Semantic Memory Examples

### ArticleEmbedding.js
```bash
node examples/ArticleEmbedding.js
```
Demonstrates semantic article processing by connecting to SPARQL endpoints for data storage, generating vector embeddings using Ollama's nomic-embed-text model, and storing embeddings in RDF format. Creates embedding vectors suitable for semantic search and similarity matching.

### ArticleSearch.js
```bash
node examples/ArticleSearch.js
```
Shows semantic search capabilities using vector embeddings for document retrieval. Performs similarity-based search across stored articles and demonstrates how to find semantically related content using embedding vectors.

### GraphRAGConceptAugment.js
```bash
node examples/GraphRAGConceptAugment.js
```
Complete semantic memory processing demonstration that loads articles about semantic web technologies, extracts key concepts using LLMs, stores knowledge as RDF triples, performs similarity-based retrieval, and generates intelligent responses using retrieved context.

### ClaudeEnrichJSON.js
```bash
node examples/ClaudeEnrichJSON.js
```
Demonstrates using Claude AI for JSON data enrichment and semantic processing. Shows integration patterns between Claude API and Semem's knowledge graph capabilities for enhanced content processing.

## LLM Integration Examples (Pending)

### OllamaExample.js
```bash
node examples/pending/OllamaExample.js
```
Basic Ollama integration using local models for both chat and embeddings. Works completely offline without external API calls, demonstrating local LLM processing capabilities.

### SimpleClaudeExample.js
```bash
node examples/pending/SimpleClaudeExample.js
```
Simple Claude API integration demonstrating chat generation with embedding storage. Shows basic patterns for using Claude with Semem's memory management.

### MistralExample.js
```bash
node examples/pending/MistralExample.js
```
Integration example for Mistral AI models. Demonstrates using Mistral for text processing and concept extraction within the Semem framework.

## API and Protocol Examples (Pending)

### MCPClientExample.js
```bash
node examples/pending/MCPClientExample.js
```
Model Context Protocol (MCP) client demonstration. Shows how to interact with Semem's MCP server for protocol-based communication and data exchange.

### SearchServer.js
```bash
node examples/pending/SearchServer.js
```
Creates and serves a semantic search API for document retrieval. Demonstrates building web services around Semem's search capabilities with REST endpoints.

### SPARQLExample.js
```bash
node examples/pending/SPARQLExample.js
```
Direct SPARQL endpoint interaction showing advanced query patterns. Demonstrates complex SPARQL queries for knowledge graph traversal and data manipulation.

## Interactive Examples (Pending)

### REPLExample.js
```bash
node examples/pending/REPL.js
```
Interactive REPL (Read-Eval-Print Loop) for exploring Semem capabilities. Provides command-line interface for experimenting with semantic memory operations and knowledge graph queries.

### ChatSnippet.js
```bash
node examples/pending/ChatSnippet.js
```
Chat interface demonstration showing conversational AI capabilities. Integrates LLM chat with semantic memory for context-aware responses.

### OllamaChat.js
```bash
node examples/pending/OllamaChat.js
```
Chat application using local Ollama models. Demonstrates building conversational interfaces with local LLMs and semantic memory integration.

## Hybrid Examples (Pending)

### HHybridClientExample.js
```bash
node examples/pending/HHybridClientExample.js
```
Hybrid client demonstrating multiple LLM provider integration. Shows patterns for using different LLM services together within a single application.

### DirectEmbeddingScript.js
```bash
node examples/pending/DirectEmbeddingScript.js
```
Direct embedding generation without full pipeline. Demonstrates low-level embedding operations and vector processing capabilities.

## Prerequisites

### Required Services
- **Ollama**: Running locally with models:
  - `qwen2:1.5b` for text generation
  - `nomic-embed-text` for embeddings
- **SPARQL Endpoint** (optional): Apache Fuseki or compatible triplestore
- **Redis** (optional): For production caching in API examples

### Environment Variables
Key environment variables used across examples:
- `OLLAMA_ENDPOINT`: Ollama API endpoint (default: http://localhost:11434)
- `CLAUDE_API_KEY`: Claude API key for Claude examples
- `SPARQL_ENDPOINT`: SPARQL endpoint URL for RDF storage
- `REDIS_URL`: Redis connection for caching (production examples)

### Installation
```bash
# Install dependencies
npm install

# Install Ollama models
ollama pull qwen2:1.5b
ollama pull nomic-embed-text

# Copy and configure environment
cp example.env .env
```

## Example Categories

- **🔬 Core Pipeline**: Complete knowledge graph processing workflows
- **🚀 Production**: Deployment-ready server and API examples  
- **🧠 Memory**: Semantic memory and embedding demonstrations
- **🔗 Integration**: LLM provider and API protocol examples
- **💬 Interactive**: Chat and REPL interface examples
- **⚡ Utilities**: Direct operations and specialized tools

## Creating New Examples

To add your own example:

1. Create a new `.js` file in the appropriate category
2. Include descriptive header comments explaining operations
3. Add proper error handling and cleanup
4. Use environment variables for configuration
5. Update this README with a description
6. Test with required services running

Example template:
```javascript
/**
 * YourExample.js - Brief Description
 * 
 * Detailed description of operations performed:
 * 1. First operation
 * 2. Second operation
 * 
 * Prerequisites: List requirements
 */

import dotenv from 'dotenv'
dotenv.config()

// Your example code here
```

## Troubleshooting

- **Import Errors**: Ensure all dependencies are installed via `npm install`
- **Ollama Connection**: Verify Ollama is running on the correct port
- **SPARQL Errors**: Check triplestore is accessible and credentials are correct
- **Memory Issues**: For large datasets, consider increasing Node.js memory limit
- **Network Timeouts**: Adjust timeout values in configuration for slow networks

## Support

For issues or questions:
- Check the main [README.md](../README.md) for setup instructions
- Review configuration files in `config/` directory
- Examine working examples before modifying
- Ensure all prerequisites are properly installed and running