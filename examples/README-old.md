# Semem Example Scripts

This directory contains example scripts demonstrating different features and integrations of the Semem library.

## Environment Setup

Most examples require environment variables that should be set in a `.env` file in the project root. Copy the `example.env` file and modify it for your needs:

```bash
cp example.env .env
# Edit .env with your API keys and configuration
```

## Available Examples

### LLM Provider Examples

#### Claude Example

```bash
node examples/ClaudeExample.js
```

Demonstrates using Claude with Semem:
- Uses Claude for chat generation
- Uses Ollama for embeddings
- Stores interactions in a JSON store

**Required Environment Variables:**
- `CLAUDE_API_KEY`: Your Claude API key

**Optional Environment Variables:**
- `CLAUDE_API_BASE`: Claude API endpoint (default: https://api.anthropic.com)
- `CLAUDE_MODEL`: Claude model to use (default: claude-3-opus-20240229)
- `OLLAMA_API_BASE`: Ollama API endpoint (default: http://localhost:11434)
- `EMBEDDING_MODEL`: Model for embeddings (default: nomic-embed-text)
- `MEMORY_JSON_PATH`: Path to memory storage (default: data/memory.json)
- `TEST_PROMPT`: Custom prompt to use (optional)
- `CUSTOM_CONCEPTS`: Comma-separated concepts (optional)
- `OPERATION_TIMEOUT`: Timeout in milliseconds (default: 60000)

#### Ollama Example

```bash
node examples/OllamaExample.js
```

Demonstrates using Ollama with Semem:
- Uses Ollama for both chat and embeddings
- Works completely offline (no external API calls)

**Required Environment Variables:**
- None (Ollama must be running locally)

**Optional Environment Variables:**
- `OLLAMA_API_BASE`: Ollama API endpoint (default: http://localhost:11434)
- `CHAT_MODEL`: Ollama chat model (default: qwen2:1.5b)
- `EMBEDDING_MODEL`: Ollama embedding model (default: nomic-embed-text)

### API Examples

#### MCP Client Example

```bash
node examples/MCPClientExample.js
```

Demonstrates using the Model Context Protocol (MCP) with Semem.

**Required Environment Variables:**
- `MCP_SERVER_URL`: URL of the MCP server (default: http://localhost:4040/mcp)

### Search Examples

#### Search Server Example

```bash
node examples/SearchServer.js
```

Demonstrates the semantic search capabilities of Semem:
- Creates and serves a search API for semantic document retrieval
- Uses embeddings to find similar content

**Required Environment Variables:**
- `EMBEDDING_MODEL`: Model for embeddings (default: nomic-embed-text)

## Adding Your Own Examples

To create your own example:

1. Create a new file in the `examples` directory
2. Import the necessary components from Semem
3. Use dotenv to load environment variables:

```javascript
import dotenv from 'dotenv'
dotenv.config()
```

4. Document your example with a comment block at the top of the file
5. Add error handling and proper cleanup