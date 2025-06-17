# Handlers Module

The Handlers module provides core processing capabilities for managing language model interactions, embeddings, and caching within the Semem system. It acts as the orchestration layer between high-level APIs and low-level connector implementations.

## Architecture

### Core Components

#### LLM Handler (`LLMHandler.js`)
- **LLMHandler**: Central orchestrator for language model operations
- Provider-agnostic interface for chat completions and text generation
- Context management and conversation history
- Token counting and usage optimization
- Error handling and automatic retry logic
- Response streaming and real-time processing

**Key Capabilities:**
- Multi-provider support with automatic failover
- Prompt template management and rendering
- Response validation and formatting
- Cost tracking and usage analytics
- Rate limiting and request queuing

#### Embedding Handler (`EmbeddingHandler.js`)
- **EmbeddingHandler**: Vector embedding generation and management
- Multi-dimensional embedding creation
- Embedding quality assessment and validation
- Batch processing for efficiency
- Caching for performance optimization
- Similarity computation and comparison

**Key Capabilities:**
- Multiple embedding model support
- Dimension reduction and optimization
- Embedding persistence and retrieval
- Similarity search acceleration
- Quality metrics and evaluation

#### Cache Manager (`CacheManager.js`)
- **CacheManager**: Intelligent caching system for performance optimization
- Multi-tier caching strategy (memory, disk, distributed)
- Cache invalidation and refresh policies
- Performance monitoring and optimization
- Memory pressure management
- Cache warming and preloading

**Key Capabilities:**
- LRU (Least Recently Used) eviction policies
- Time-based expiration
- Cache hit/miss analytics
- Distributed caching support
- Cache coherency management

## Usage Patterns

### LLM Operations
```javascript
import LLMHandler from './handlers/LLMHandler.js';

// Initialize with provider
const llmHandler = new LLMHandler(claudeConnector, 'claude-3-sonnet');

// Generate chat response
const response = await llmHandler.generateResponse(
  "Explain quantum computing",
  { temperature: 0.7, maxTokens: 1000 }
);

// Extract concepts from text
const concepts = await llmHandler.extractConcepts(
  "Machine learning is revolutionizing healthcare through predictive analytics."
);

// Stream responses for real-time interaction
for await (const chunk of llmHandler.generateResponseStream(prompt)) {
  console.log(chunk);
}
```

### Embedding Operations
```javascript
import EmbeddingHandler from './handlers/EmbeddingHandler.js';

// Initialize embedding handler
const embeddingHandler = new EmbeddingHandler(ollamaConnector);

// Generate single embedding
const embedding = await embeddingHandler.generateEmbedding(
  "semantic memory system",
  { model: 'nomic-embed-text' }
);

// Batch embedding generation
const texts = ["text1", "text2", "text3"];
const embeddings = await embeddingHandler.generateEmbeddings(texts);

// Calculate similarity
const similarity = embeddingHandler.calculateSimilarity(embedding1, embedding2);

// Find similar embeddings
const similar = await embeddingHandler.findSimilar(
  queryEmbedding,
  candidateEmbeddings,
  { threshold: 0.8, topK: 10 }
);
```

### Cache Management
```javascript
import CacheManager from './handlers/CacheManager.js';

// Initialize cache with configuration
const cache = new CacheManager({
  maxMemorySize: '1GB',
  diskCacheSize: '10GB',
  defaultTTL: 3600000, // 1 hour
  enableDistributed: true
});

// Store and retrieve cached data
await cache.set('embedding:doc123', embedding, { ttl: 7200000 });
const cachedEmbedding = await cache.get('embedding:doc123');

// Cache with tags for group invalidation
await cache.set('llm:response:hash456', response, { 
  tags: ['llm', 'claude', 'conversation:789'] 
});

// Invalidate by tag
await cache.invalidateByTag('conversation:789');

// Cache statistics
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

## Integration with Core System

### Memory Management Integration
- Seamless integration with MemoryManager for storing LLM interactions
- Automatic embedding generation for stored memories
- Context-aware retrieval using cached embeddings
- Memory similarity calculation and clustering

### Search Enhancement
- Embedding-powered semantic search
- Query expansion using LLM capabilities
- Result ranking and relevance scoring
- Real-time search result generation

### API Layer Integration
- Standardized interfaces for all handler operations
- Error propagation and handling
- Performance metrics collection
- Request/response logging and monitoring

## Performance Optimization

### Caching Strategies
- **Embedding Cache**: Store computed embeddings to avoid regeneration
- **LLM Response Cache**: Cache responses for repeated queries
- **Model Cache**: Keep frequently used models in memory
- **Prompt Template Cache**: Pre-compiled prompt templates

### Batch Processing
- **Embedding Batching**: Process multiple texts in single API call
- **Request Batching**: Combine multiple LLM requests efficiently
- **Cache Batch Operations**: Bulk cache read/write operations
- **Background Processing**: Asynchronous processing for non-critical operations

### Resource Management
- **Connection Pooling**: Reuse connections to LLM providers
- **Memory Management**: Efficient memory usage and garbage collection
- **Thread Management**: Optimal thread allocation for concurrent operations
- **Rate Limiting**: Prevent provider API limits from being exceeded

## Error Handling & Resilience

### Failure Recovery
- **Automatic Retry**: Exponential backoff for transient failures
- **Circuit Breaker**: Prevent cascade failures
- **Graceful Degradation**: Fallback to cached or simplified responses
- **Provider Failover**: Switch to backup providers automatically

### Monitoring & Alerting
- **Performance Metrics**: Response times, success rates, error rates
- **Resource Usage**: Memory, CPU, network utilization
- **Provider Health**: Monitor provider API status and performance
- **Alert System**: Proactive alerts for system issues

## Configuration & Tuning

### Performance Tuning
```javascript
const config = {
  llm: {
    maxConcurrentRequests: 10,
    timeoutMs: 30000,
    retryAttempts: 3,
    providerFailoverEnabled: true
  },
  embedding: {
    batchSize: 100,
    maxDimensions: 1536,
    qualityThreshold: 0.1
  },
  cache: {
    memorySize: '2GB',
    ttlDefault: 3600000,
    evictionPolicy: 'lru',
    compressionEnabled: true
  }
};
```

### Security Configuration
- API key encryption and rotation
- Request/response sanitization
- Audit logging for compliance
- Access control and authorization
- Data privacy and anonymization