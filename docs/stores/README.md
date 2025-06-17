# Stores Module

The Stores module provides a flexible persistence layer for Semem's semantic memory system. It implements multiple storage backends with a unified interface, supporting everything from in-memory caching to distributed RDF triple stores.

## Architecture

### Base Store Interface

#### BaseStore (`BaseStore.js`)
- **BaseStore**: Abstract base class defining the common storage interface
- Standardizes CRUD operations across all storage implementations
- Provides transaction support and consistency guarantees
- Implements connection pooling and resource management
- Defines error handling and retry mechanisms

### Storage Implementations

#### In-Memory Storage

##### InMemoryStore (`InMemoryStore.js`)
- **InMemoryStore**: Fast, transient storage for development and testing
- Complete dataset held in RAM for maximum performance
- No persistence - data lost on application restart
- Ideal for unit testing and prototyping
- Supports complex queries and filtering

##### MemoryStore (`MemoryStore.js`)
- **MemoryStore**: Enhanced in-memory storage with additional features
- Advanced indexing for faster queries
- Memory usage optimization and garbage collection
- Optional persistence to disk snapshots
- Multi-threaded access with locking mechanisms

#### File-Based Storage

##### JSONStore (`JSONStore.js`)
- **JSONStore**: Simple file-based persistence using JSON format
- Human-readable storage format
- Atomic writes with backup and recovery
- Incremental backups and versioning
- Suitable for small to medium datasets
- Development-friendly with easy debugging

#### SPARQL Storage

##### SPARQLStore (`SPARQLStore.js`)
- **SPARQLStore**: Full RDF triple store integration
- Native SPARQL query support
- Semantic web standards compliance
- Scalable to millions of triples
- Distributed deployment support
- Advanced query optimization

##### CachedSPARQLStore (`CachedSPARQLStore.js`)
- **CachedSPARQLStore**: High-performance SPARQL with intelligent caching
- Multi-tier caching strategy
- Query result caching and invalidation
- Connection pooling and load balancing
- Performance monitoring and optimization
- Automatic failover and recovery

#### Specialized Storage

##### RagnoMemoryStore (`RagnoMemoryStore.js`)
- **RagnoMemoryStore**: Optimized storage for knowledge graph operations
- Entity and relationship-aware storage
- Graph traversal optimization
- Community detection support
- Vector similarity indexing
- Real-time graph updates

## Storage Features

### Data Models

#### Memory Item Storage
```javascript
// Standard memory item structure
const memoryItem = {
  id: 'unique-identifier',
  prompt: 'User question or input',
  response: 'System response or answer',
  embedding: [0.1, 0.2, ...], // Vector embedding
  concepts: ['concept1', 'concept2'], // Extracted concepts
  metadata: {
    timestamp: new Date(),
    source: 'user-input',
    confidence: 0.95
  }
};
```

#### RDF Triple Storage
```javascript
// RDF triple representation
const triple = {
  subject: 'http://example.org/entity1',
  predicate: 'http://example.org/hasRelation',
  object: 'http://example.org/entity2',
  graph: 'http://example.org/context'
};
```

### Query Capabilities

#### Vector Similarity Search
```javascript
// Similarity search across stores
const results = await store.search(queryEmbedding, {
  limit: 20,
  threshold: 0.8,
  includeMetadata: true
});
```

#### SPARQL Queries
```javascript
// Complex SPARQL queries
const sparqlQuery = `
  SELECT ?entity ?label ?type WHERE {
    ?entity rdfs:label ?label .
    ?entity rdf:type ?type .
    FILTER(regex(?label, "machine learning", "i"))
  }
`;
const results = await store.query(sparqlQuery);
```

#### Full-Text Search
```javascript
// Text-based search with ranking
const results = await store.searchText('artificial intelligence', {
  fields: ['prompt', 'response'],
  fuzzy: true,
  limit: 50
});
```

## Usage Patterns

### Store Selection and Configuration
```javascript
import { createStore } from './stores/index.js';

// Development: Fast in-memory storage
const devStore = createStore('memory', {
  maxSize: 10000,
  indexFields: ['concepts', 'metadata.source']
});

// Production: Cached SPARQL with persistence
const prodStore = createStore('cached-sparql', {
  endpoint: 'https://fuseki.example.com/dataset',
  cache: {
    maxSize: '1GB',
    ttl: 3600000
  },
  pool: {
    maxConnections: 20,
    idleTimeout: 30000
  }
});

// Hybrid: JSON store with memory cache
const hybridStore = createStore('json', {
  filepath: './data/memories.json',
  cache: true,
  backup: {
    enabled: true,
    interval: 300000, // 5 minutes
    maxBackups: 10
  }
});
```

### Basic Operations
```javascript
// Store a memory
const memoryId = await store.store({
  prompt: "What is machine learning?",
  response: "Machine learning is a subset of AI...",
  embedding: embeddingVector,
  concepts: ['machine-learning', 'artificial-intelligence']
});

// Retrieve by ID
const memory = await store.retrieve(memoryId);

// Update existing memory
await store.update(memoryId, {
  metadata: { ...memory.metadata, updated: new Date() }
});

// Delete memory
await store.delete(memoryId);
```

### Advanced Queries
```javascript
// Multi-criteria search
const results = await store.search(queryEmbedding, {
  filters: {
    concepts: { includes: 'machine-learning' },
    'metadata.confidence': { gte: 0.8 },
    'metadata.timestamp': { 
      gte: new Date('2024-01-01'),
      lte: new Date('2024-12-31')
    }
  },
  sort: [
    { field: 'similarity', order: 'desc' },
    { field: 'metadata.timestamp', order: 'desc' }
  ],
  limit: 100
});

// Aggregation queries
const stats = await store.aggregate([
  { $group: { _id: '$metadata.source', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### Transaction Support
```javascript
// Atomic operations
await store.transaction(async (tx) => {
  const memory1 = await tx.store(memoryData1);
  const memory2 = await tx.store(memoryData2);
  await tx.createRelationship(memory1.id, memory2.id, 'related');
});
```

## Performance Optimization

### Indexing Strategies
- **Vector Indexes**: HNSW for similarity search
- **Text Indexes**: Full-text search with stemming
- **Composite Indexes**: Multi-field query optimization
- **Spatial Indexes**: Geographic data support
- **Graph Indexes**: Relationship traversal optimization

### Caching Layers
- **Query Cache**: Cached query results
- **Object Cache**: Cached memory items
- **Index Cache**: Cached index structures
- **Connection Cache**: Pooled database connections
- **Computed Cache**: Cached expensive computations

### Scaling Strategies
- **Horizontal Partitioning**: Shard data across multiple stores
- **Vertical Partitioning**: Separate hot and cold data
- **Read Replicas**: Scale read operations
- **Write Optimization**: Batch writes and async processing
- **Connection Pooling**: Efficient resource utilization

## Monitoring & Administration

### Performance Metrics
```javascript
const metrics = await store.getMetrics();
console.log({
  totalRecords: metrics.count,
  storageSize: metrics.sizeBytes,
  queryLatency: metrics.avgQueryTime,
  cacheHitRate: metrics.cacheHitRate,
  errorRate: metrics.errorRate
});
```

### Health Checks
```javascript
const health = await store.healthCheck();
if (!health.healthy) {
  console.error('Store issues:', health.issues);
}
```

### Backup & Recovery
```javascript
// Create backup
await store.backup({
  destination: './backups/semem-backup-' + Date.now(),
  compress: true,
  verify: true
});

// Restore from backup
await store.restore({
  source: './backups/semem-backup-1703123456789',
  replaceExisting: false
});
```

## Security & Compliance

### Data Protection
- Encryption at rest and in transit
- Field-level encryption for sensitive data
- Access control and authorization
- Audit logging for compliance
- Data anonymization and masking

### Backup Security
- Encrypted backup storage
- Secure backup transmission
- Backup integrity verification
- Retention policy enforcement
- Disaster recovery procedures

## Migration & Upgrades

### Schema Evolution
- Automatic schema migration
- Backward compatibility maintenance
- Data transformation pipelines
- Version rollback capabilities
- Migration validation and testing

### Store Migration
```javascript
// Migrate between store types
const migrator = new StoreMigrator();
await migrator.migrate(sourceStore, targetStore, {
  batchSize: 1000,
  validate: true,
  preserveIds: true
});
```