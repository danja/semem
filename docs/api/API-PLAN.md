
The doc below is out-of-date, needs updating based on current code implementation. All APIs should be exposed systematically via HTTP REST API endpoints and documented both in Open API specs and developer-oriented text docs. Their behaviours should be checked and reported via the healthcheck endpoint. Each block of functionality should have an integration test/demo under examples/api/ following the style of the existing examples, with verbose console logging describing what is happening using loglevel and chalk to showcase facilities. 

# Semantic Memory API Exposure Plan

This document outlines a strategic plan for exposing APIs from the Semem (Semantic Memory) library, based on analysis of current functionality and example implementations.

Modern Javascript will be used throughout with node ES modules. Vitest tests will be created for each key piece of functionality.

## 1. Core API Categories

### Memory Management APIs
These provide access to the semantic memory functionality, the core of the system.

```javascript
POST /api/memory
- Store interactions in memory
- Parameters: prompt, response, metadata (concepts, tags)

GET /api/memory/search
- Retrieve relevant memories
- Parameters: query, similarity threshold, limit, filters

POST /api/memory/embedding
- Generate embeddings for text
- Parameters: text, model

GET /api/memory/concepts
- Extract concepts from text
- Parameters: text
```

### Chat and Completion APIs
These provide natural language generation capabilities with memory integration.

```javascript
POST /api/chat
- Generate responses with memory context
- Parameters: prompt, conversation_id, use_memory (boolean)

POST /api/chat/stream
- Stream responses with memory context
- Parameters: prompt, conversation_id, use_memory (boolean)

POST /api/completion
- Generate text completions with memory context
- Parameters: prompt, max_tokens, temperature
```

### Semantic Search APIs
These provide vector-based search capabilities for articles and other content.

```javascript
GET /api/search
- Search content using vector similarity
- Parameters: query, limit, types, threshold

POST /api/index
- Index content for searching
- Parameters: content, metadata, type
```

## 2. Implementation Approach

### HTTP REST API
1. **Server Implementation**
   - Build on the existing `HTTPServer.js` but expose fully RESTful endpoints
   - Add proper authentication and authorization
   - Implement rate limiting and monitoring

2. **API Documentation**
   - Enhance OpenAPI/Swagger documentation
   - Create interactive playground for testing API endpoints

### JavaScript SDK
1. **Client Library**
   - Create a client library wrapping the HTTP API
   - Match the core interfaces for consistency
   - Add convenience methods for common operations

```javascript
// Example SDK usage
import { SememClient } from 'semem-sdk';

const client = new SememClient({
  apiKey: 'your-api-key',
  endpoint: 'https://api.example.com/semem'
});

// Store an interaction
await client.memory.store({
  prompt: "What's the capital of France?",
  response: "The capital of France is Paris."
});

// Search memory
const results = await client.memory.search("France");

// Generate chat response with memory
const response = await client.chat.generate("Tell me more about Paris");
```

### Node.js Module Exports
1. **Programmatic Interface**
   - Export core classes for direct use in Node.js applications
   - Standardize all interfaces with consistent patterns
   - Create factory methods for common configurations

```javascript
// Example module usage
import { MemoryManager, JSONStore, OllamaConnector } from 'semem';

const memory = new MemoryManager({
  storage: new JSONStore('./memory.json'),
  llmProvider: new OllamaConnector({
    endpoint: 'http://localhost:11434'
  })
});

// Use memory operations
await memory.addInteraction(prompt, response, embedding, concepts);
const relevantMemories = await memory.retrieveRelevantInteractions(query);
```

## 3. Integration Points

### LLM Provider Connectors
- **Standard Interface**: Create a consistent interface for all LLM providers
- **Supported Providers**: Ollama, Claude, Mistral, OpenAI, etc.
- **Custom Providers**: Allow easy extension for custom providers

### Storage Backends
- **Standard Interface**: Continue using the existing BaseStore pattern
- **Supported Backends**: JSON, SPARQL, In-Memory, add MongoDB, Redis, etc.
- **Custom Storage**: Allow custom storage implementations

### Vector Databases
- **Standard Interface**: Create a consistent interface for vector databases
- **Supported Databases**: FAISS, Milvus, Pinecone, etc.
- **Search Methods**: Support various search algorithms and filtering options

## 4. Implementation Priorities

### Phase 1: Core REST API ✅ COMPLETED
1. ✅ Implement HTTP server with basic memory operations
2. ✅ Add authentication and rate limiting
3. ✅ Create comprehensive API documentation
4. ✅ Deploy reference implementation with Ollama backend

### Phase 2: SDK Development 🔄 IN PROGRESS
1. 📝 Create JavaScript/TypeScript client SDK
2. 📝 Develop language bindings for Python, Go, etc.
3. 📝 Add convenience methods for common use cases
4. 📝 Create examples and tutorials

### Phase 3: Advanced Features 🔄 PARTIALLY COMPLETED
1. ✅ Add streaming capabilities for chat responses
2. 📝 Implement batch operations for embeddings
3. ✅ Add monitoring and analytics dashboards
4. 📝 Create management APIs for controlling memory storage

## 5. API Design Guidelines

### Consistency
- Use consistent parameter naming across all endpoints
- Follow RESTful principles for resource operations
- Use standard HTTP status codes and error formats

### Security
- Implement proper authentication using API keys or OAuth
- Add rate limiting to prevent abuse
- Sanitize all inputs to prevent injection attacks

### Performance
- Optimize for low latency, especially in chat endpoints
- Add caching for frequently accessed memories
- Support batch operations for efficiency

## 6. Extended Use Cases

### Semantic Knowledge Base
Expose APIs for building and querying a knowledge base with semantic search capabilities:
- Add documents to knowledge base
- Query knowledge base with natural language
- Perform similarity searches across documents

### Agent Orchestration
Provide APIs for creating agents with memory and reasoning capabilities:
- Create and manage multiple agents
- Allow agents to share memories
- Coordinate multi-agent conversations

### Analytics and Monitoring
Add APIs for analyzing memory usage and system performance:
- Track memory health and growth
- Monitor usage patterns
- Generate insights from memory content

## 7. Implementation Examples

### API Server Example

```javascript
// server.js
import express from 'express';
import { MemoryManager, OllamaConnector, JSONStore } from 'semem';

const app = express();
app.use(express.json());

// Initialize memory manager
const memory = new MemoryManager({
  llmProvider: new OllamaConnector({ endpoint: 'http://localhost:11434' }),
  storage: new JSONStore('./memory.json')
});

// Memory endpoints
app.post('/api/memory', async (req, res) => {
  try {
    const { prompt, response } = req.body;
    const embedding = await memory.generateEmbedding(prompt);
    const concepts = await memory.extractConcepts(prompt);
    
    await memory.addInteraction(prompt, response, embedding, concepts);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/memory/search', async (req, res) => {
  try {
    const { query, threshold = 0.7 } = req.query;
    const results = await memory.retrieveRelevantInteractions(query, threshold);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    const retrievals = await memory.retrieveRelevantInteractions(prompt);
    const response = await memory.generateResponse(prompt, [], retrievals);
    
    // Store the interaction
    const embedding = await memory.generateEmbedding(prompt);
    const concepts = await memory.extractConcepts(prompt);
    await memory.addInteraction(prompt, response, embedding, concepts);
    
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

### Client SDK Example

```javascript
// semem-sdk.js
export class SememClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    
    this.memory = {
      store: this.storeMemory.bind(this),
      search: this.searchMemory.bind(this),
      embedding: this.generateEmbedding.bind(this)
    };
    
    this.chat = {
      generate: this.generateChat.bind(this),
      stream: this.streamChat.bind(this)
    };
  }
  
  async request(path, method, data) {
    const response = await fetch(`${this.endpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    
    return response.json();
  }
  
  async storeMemory(data) {
    return this.request('/api/memory', 'POST', data);
  }
  
  async searchMemory(query, options = {}) {
    const params = new URLSearchParams({
      query,
      ...options
    });
    return this.request(`/api/memory/search?${params}`, 'GET');
  }
  
  async generateEmbedding(text) {
    return this.request('/api/memory/embedding', 'POST', { text });
  }
  
  async generateChat(prompt, options = {}) {
    return this.request('/api/chat', 'POST', { prompt, ...options });
  }
  
  async streamChat(prompt, options = {}) {
    const response = await fetch(`${this.endpoint}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ prompt, ...options })
    });
    
    return response.body;
  }
}
```

## Implementation Status

The core API has been implemented according to this plan. Current status:

1. ✅ API specifications created using OpenAPI 3.0
2. ✅ Core HTTP server with RESTful API endpoints implemented
3. ✅ Authentication and error handling systems in place
4. ✅ Memory, Chat, and Search APIs fully functional
5. ✅ Comprehensive test suite for API components

For detailed implementation status, see the [Implementation Status](./implementation-status.md) document.

## Next Steps

1. ✅ Review API plan with stakeholders (COMPLETED)
2. ✅ Create detailed API specifications using OpenAPI (COMPLETED)
3. ✅ Implement reference HTTP server with core APIs (COMPLETED)
4. 🔄 Create documentation website with interactive examples (IN PROGRESS)
5. 📝 Develop client SDK for easy integration (PLANNED)