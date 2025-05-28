# Semem Examples Documentation

This directory contains various example scripts demonstrating different features and integrations of the Semem system. Below is a summary of what each example demonstrates:

## Core Examples

### `ArticleEmbedding.js`
- Demonstrates how to generate and store article embeddings using Ollama
- Shows integration with SPARQL for storing and querying embeddings
- Includes error handling and graceful shutdown procedures

### `ArticleSearchService.js`
- Implements a semantic search service for articles
- Uses FAISS for efficient similarity search
- Integrates with SPARQL for article storage and retrieval
- Supports embedding generation using Ollama models

## AI Model Integrations

### `ClaudeExample.js`
- Shows integration with Anthropic's Claude API
- Demonstrates chat completion and embedding generation
- Includes environment variable configuration
- Implements graceful error handling and shutdown

### `OllamaExample.js` / `OllamaChat.js`
- Basic examples of using Ollama for text generation
- Demonstrate different prompting techniques
- Show how to interact with local Ollama models

### `OllamaClaudeExample.js`
- Shows how to use Claude models through Ollama
- Demonstrates local inference with Claude models

### `MistralExample.js`
- Example of using Mistral models
- Demonstrates model configuration and inference

## Client Implementations

### `HClient` Examples
- `HClaudeClientExample.js`: HTTP client for Claude API
- `HHybridClientExample.js`: Hybrid client implementation
- `HOllamaClientExample.js`: HTTP client for Ollama API

### `MCPClientExample.js`
- Demonstrates the Model Control Protocol client
- Shows how to interact with MCP servers

## Utility Scripts

### `DirectEmbeddingScript.js`
- Direct script for generating embeddings
- Useful for batch processing of text

### `SPARQLExample.js`
- Demonstrates SPARQL query execution
- Shows how to interact with the SPARQL endpoint

### `SearchServer.js`
- Implements a search server
- Provides HTTP endpoints for search functionality

### `SimpleClaudeExample.js`
- Minimal example of using Claude API
- Good starting point for basic Claude integration

## Configuration

### `README.md`
- General documentation for the examples
- Setup instructions and usage examples

## Notes
- Most examples require specific environment variables to be set
- Many examples use the `loglevel` package for configurable logging
- Error handling and graceful shutdown are common patterns across examples
