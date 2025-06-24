# Semem HTTP API Usage Guide

This document describes how to use the Semem HTTP API server which exposes basic, ragno, and zpt services over HTTP.

## Overview

The Semem API server (`src/servers/api-server.js`) provides a RESTful HTTP interface for:

1. **Basic Services**: Core memory management, chat, search functionality
2. **Ragno Services**: Knowledge graph operations, corpus decomposition, graph analytics
3. **ZPT Services**: Zero-Point Traversal navigation and corpus transformation

## Getting Started

### Starting the API Server

```bash
# Using Node.js directly
node src/servers/api-server.js

# Or using npm script (if configured)
npm run api-server
```

The server starts on port 4100 by default. You can override this with the `PORT` environment variable:

```bash
PORT=8080 node src/servers/api-server.js
```

### Base URL

All API endpoints are available at: `http://localhost:4100/api`

## Authentication

### Getting an API Key

The API key configuration depends on your environment:

#### Development Mode (Default)
In development mode (`NODE_ENV=development` or unset), API authentication is **bypassed** for convenience. You can make requests without an API key:

```bash
# Works in development mode - no API key needed
curl http://localhost:4100/api/health
```

#### Production Mode
For production use, you must configure an API key:

1. **Set the API key in your environment**:
   ```bash
   # In your .env file or environment
   SEMEM_API_KEY=your-secure-api-key-here
   NODE_ENV=production
   ```

2. **Or use the default development key**:
   ```bash
   # Default key from example.env
   SEMEM_API_KEY=semem-dev-key
   ```

### Using API Keys

Include the API key in requests using either method:

**Method 1: X-API-Key Header (Recommended)**
```bash
curl -H "X-API-Key: your-api-key" http://localhost:4100/api/health
```

**Method 2: Query Parameter**
```bash
curl "http://localhost:4100/api/health?api_key=your-api-key"
```

### Configuration Steps

1. **Copy the example environment file**:
   ```bash
   cp example.env .env
   ```

2. **Edit `.env` and set your API key**:
   ```bash
   # Set a secure API key for production
   SEMEM_API_KEY=my-secure-api-key-12345
   NODE_ENV=production
   ```

3. **Restart the API server** to apply changes

## Basic Services

The main API server exposes these basic services:

### Memory Management

#### Store Memory
```bash
curl -X POST http://localhost:4100/api/memory \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "What is machine learning?",
    "response": "Machine learning is a subset of AI...",
    "metadata": {"source": "user_question"}
  }'
```

#### Search Memory
```bash
curl -X GET "http://localhost:4100/api/memory/search?query=machine%20learning&limit=5" \
  -H "X-API-Key: your-api-key"
```

#### Generate Embedding
```bash
curl -X POST http://localhost:4100/api/memory/embedding \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text": "Generate embedding for this text"}'
```

#### Extract Concepts
```bash
curl -X POST http://localhost:4100/api/memory/concepts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text": "Extract key concepts from this text about artificial intelligence and machine learning."}'
```

### Chat API

#### Chat Completion
```bash
curl -X POST http://localhost:4100/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "message": "Explain quantum computing",
    "context": "technical discussion",
    "includeMemory": true
  }'
```

#### Streaming Chat
```bash
curl -X POST http://localhost:4100/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"message": "Tell me about AI"}' \
  --no-buffer
```

#### Text Completion
```bash
curl -X POST http://localhost:4100/api/completion \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "The future of artificial intelligence is",
    "maxTokens": 100
  }'
```

### Search API

#### General Search
```bash
curl -X GET "http://localhost:4100/api/search?query=neural%20networks&limit=10" \
  -H "X-API-Key: your-api-key"
```

#### Index Content
```bash
curl -X POST http://localhost:4100/api/index \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "content": "This is content to be indexed",
    "metadata": {"type": "document", "category": "research"}
  }'
```

## System Endpoints

### Health Check
```bash
curl http://localhost:4100/api/health
```

### Configuration
```bash
curl http://localhost:4100/api/config
```

### Metrics
```bash
curl http://localhost:4100/api/metrics \
  -H "X-API-Key: your-api-key"
```

### Service Discovery
```bash
curl http://localhost:4100/api/services
```

## Ragno Services

**Status**: ✅ Now integrated into main API server

The Ragno services provide knowledge graph operations and are now available through the main API server at `http://localhost:4100/api/graph/*`.

### Ragno Endpoints

#### Corpus Decomposition
```bash
curl -X POST http://localhost:4100/api/graph/decompose \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "text": "Your corpus text about machine learning and AI...",
    "options": {
      "extractRelationships": true,
      "minEntityConfidence": 0.3,
      "store": true
    }
  }'
```

#### Graph Statistics
```bash
curl http://localhost:4100/api/graph/stats \
  -H "X-API-Key: your-api-key"
```

#### Get Entities
```bash
curl "http://localhost:4100/api/graph/entities?limit=20&type=person" \
  -H "X-API-Key: your-api-key"
```

#### Search Knowledge Graph
```bash
curl -X POST http://localhost:4100/api/graph/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "machine learning",
    "type": "dual",
    "limit": 10,
    "threshold": 0.7
  }'
```

#### Export Graph Data
```bash
curl "http://localhost:4100/api/graph/export/turtle?limit=1000" \
  -H "X-API-Key: your-api-key"
```

#### Enrich Graph
```bash
curl -X POST http://localhost:4100/api/graph/enrich \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "options": {
      "embeddings": true,
      "attributes": true,
      "communities": true
    }
  }'
```

#### Get Communities
```bash
curl "http://localhost:4100/api/graph/communities?algorithm=louvain&limit=50" \
  -H "X-API-Key: your-api-key"
```

#### Full Pipeline
```bash
curl -X POST http://localhost:4100/api/graph/pipeline \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "text": "Your research corpus...",
    "options": {
      "enrich": true,
      "communities": true,
      "store": true
    }
  }'
```

## ZPT Services

**Status**: ✅ Now integrated into main API server

The ZPT (Zoom, Pan, Tilt) services provide intelligent corpus navigation and are now available through the main API server at `http://localhost:4100/api/navigate/*`.

**ZPT Navigation Concepts:**
- **Zoom**: Controls the abstraction level (entity, unit, text, community, corpus)
- **Pan**: Filters the domain (topic, entity, temporal, geographic constraints)  
- **Tilt**: Chooses the representation format (embedding, keywords, graph, temporal)

### ZPT Navigation Endpoints

#### Main Navigation
```bash
curl -X POST http://localhost:4100/api/navigate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "zoom": "unit",
    "tilt": "keywords", 
    "transform": {
      "maxTokens": 4000, 
      "format": "structured",
      "includeMetadata": true
    }
  }'
```

**Parameter Explanation:**
- `zoom: "unit"` - Navigate at semantic unit level
- `tilt: "keywords"` - Represent results as keyword extractions
- `transform` - Output formatting options

#### Navigation Preview
```bash
curl -X POST http://localhost:4100/api/navigate/preview \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "zoom": "entity",
    "pan": {
      "topic": "machine-learning",
      "temporal": {
        "start": "2024-01-01",
        "end": "2024-12-31"
      }
    },
    "tilt": "embedding"
  }'
```

#### Navigation Options
```bash
curl http://localhost:4100/api/navigate/options
```

#### Navigation Schema
```bash
curl http://localhost:4100/api/navigate/schema
```

#### Navigation Health Check
```bash
curl http://localhost:4100/api/navigate/health
```

#### Advanced Navigation Example
```bash
curl -X POST http://localhost:4100/api/navigate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "zoom": "community",
    "pan": {
      "topic": "artificial-intelligence",
      "entity": ["machine-learning", "deep-learning"],
      "temporal": {
        "start": "2023-01-01",
        "end": "2024-12-31"
      }
    },
    "tilt": "graph",
    "transform": {
      "maxTokens": 8000,
      "format": "json",
      "tokenizer": "cl100k_base",
      "chunkStrategy": "semantic",
      "includeMetadata": true
    }
  }'
```

**Advanced Parameter Explanation:**
- `zoom: "community"` - Navigate at community/cluster level
- `pan: {...}` - Apply multiple domain filters:
  - `topic` - Focus on AI domain
  - `entity` - Include specific ML entities
  - `temporal` - Limit to recent timeframe
- `tilt: "graph"` - Represent results as graph relationships
- `transform: {...}` - Advanced output formatting

## Unified Search Services

**Status**: ✅ New in Phase 3 - Advanced cross-service search

The Unified Search API provides intelligent search across all Semem services with automatic query analysis and result ranking.

### Unified Search Endpoints

#### Intelligent Unified Search
```bash
curl -X POST http://localhost:4100/api/search/unified \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "machine learning neural networks",
    "strategy": "auto",
    "limit": 20
  }'
```

#### Query Analysis
```bash
curl -X POST http://localhost:4100/api/search/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "Who invented the transformer architecture?"
  }'
```

#### Available Services Status
```bash
curl http://localhost:4100/api/search/services
```

#### Search Strategies
```bash
curl http://localhost:4100/api/search/strategies
```

#### Advanced Unified Search with Custom Strategy
```bash
curl -X POST http://localhost:4100/api/search/unified \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "deep learning research papers",
    "strategy": "knowledge-focused",
    "services": ["ragno", "memory", "zpt"],
    "limit": 30,
    "weights": {
      "ragno": 0.5,
      "memory": 0.3,
      "zpt": 0.2
    }
  }'
```

### Search Strategies Available

- **`auto`** - Automatically determines best strategy based on query analysis
- **`entity-focused`** - Prioritizes entity and knowledge graph search (Ragno + Memory)
- **`concept-focused`** - Emphasizes conceptual and semantic search (Memory + Search)
- **`graph-focused`** - Leverages graph relationships (Ragno + ZPT)
- **`navigation-focused`** - Optimized for corpus exploration (ZPT + Ragno)
- **`knowledge-focused`** - Comprehensive knowledge base search (Ragno + Memory + ZPT)
- **`balanced`** - Queries all available services equally

### Query Types Detected

The system automatically analyzes queries and detects:
- **Entity queries** - "Who is...", "What company..."
- **Concept queries** - "What is...", "Define..."
- **Relationship queries** - "How are... connected", "What relates..."
- **Temporal queries** - "When did...", "Timeline of..."
- **Navigation queries** - "Explore...", "Browse through..."
- **Knowledge queries** - "Research on...", "Knowledge about..."

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "requestId": "req-123-abc",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "processingTime": 150
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE", 
  "requestId": "req-123-abc",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limiting

- Default: 100 requests per 15-minute window per IP
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in window  
  - `X-RateLimit-Reset`: Time when window resets

## Configuration

The API server uses configuration from:
1. Environment variables
2. `config.json` file
3. `.env` file

Key environment variables:
- `PORT`: Server port (default: 4100)
- `API_KEY`: Authentication key
- `LOG_LEVEL`: Logging level (info, debug, error)
- `OLLAMA_API_BASE`: Ollama server URL
- `EMBEDDING_MODEL`: Embedding model name
- `CHAT_MODEL`: Chat model name

## CORS Support

CORS is enabled by default for development. Configure allowed origins via:
- `ALLOWED_ORIGINS` environment variable (comma-separated)
- CORS options in server configuration

## WebSocket Support

The server includes WebSocket capabilities for real-time features (see `src/api/http/server/WebSocketServer.js`).

## Error Handling

The API includes comprehensive error handling with:
- Request validation
- Timeout protection  
- Resource cleanup
- Detailed error messages in development
- Sanitized errors in production

## Monitoring

Built-in monitoring features:
- Health checks
- Metrics collection
- Request logging
- Performance tracking
- Component status monitoring

For production deployments, consider integrating with external monitoring solutions.