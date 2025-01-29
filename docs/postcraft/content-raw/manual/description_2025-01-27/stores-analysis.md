# Storage Layer Analysis

## BaseStore.js
**Purpose**: Abstract base class defining the storage interface contract.

Key Methods:
- `loadHistory()`: Load stored interactions
- `saveMemoryToHistory(memoryStore)`: Persist memory state
- `beginTransaction()`: Start transaction
- `commitTransaction()`: Commit changes
- `rollbackTransaction()`: Revert changes
- `verify()`: Validate store state
- `close()`: Cleanup resources

## SPARQLStore.js
**Purpose**: RDF triple store implementation using SPARQL endpoint.

Key Features:
- SPARQL query/update execution
- Transaction management with backup graphs
- Authentication handling
- Embedding validation
- Graph management

Key Methods:
- `_executeSparqlQuery(query, endpoint)`: Execute SPARQL queries
- `_executeSparqlUpdate(update, endpoint)`: Execute SPARQL updates
- `_generateInsertStatements(memories, type)`: Generate RDF statements
- `validateEmbedding(embedding)`: Validate vector format

## CachedSPARQLStore.js
**Purpose**: Caching layer over SPARQLStore for performance optimization.

Key Features:
- Query result caching
- Cache invalidation
- TTL management
- Size limits

Key Methods:
- `_generateCacheKey(query)`: Create cache keys
- `cleanupCache()`: Remove expired entries
- `invalidateCache()`: Clear cache on updates

## JSONStore.js
**Purpose**: File-based storage implementation.

Key Features:
- File-based persistence
- Atomic updates
- Backup management
- Transaction support

Key Methods:
- `ensureDirectory()`: Create storage directory
- `beginTransaction()`: Create temporary file
- `commitTransaction()`: Atomic file replacement
- `verify()`: Validate JSON integrity

## InMemoryStore.js
**Purpose**: Volatile memory storage for testing/development.

Key Features:
- In-memory data structures
- No persistence
- Simple implementation

Key Methods:
- `loadHistory()`: Return memory state
- `saveMemoryToHistory()`: Update memory state

## MemoryStore.js
**Purpose**: Core memory management implementation.

Key Features:
- Vector similarity search
- Concept clustering
- Memory decay
- Semantic memory organization

Key Methods:
- `addInteraction()`: Store new interaction
- `retrieve()`: Find similar interactions
- `classifyMemory()`: Long/short term classification
- `clusterInteractions()`: Semantic grouping

## Implementation Patterns

### Transaction Management
```javascript
async beginTransaction() {
    if (this.inTransaction) {
        throw new Error('Transaction already in progress')
    }
    this.inTransaction = true
    // Store specific setup
}

async commitTransaction() {
    if (!this.inTransaction) {
        throw new Error('No transaction in progress')
    }
    try {
        // Commit changes
    } finally {
        this.inTransaction = false
    }
}
```

### Error Recovery
```javascript
async saveMemoryToHistory(memoryStore) {
    try {
        await this.beginTransaction()
        // Save operations
        await this.commitTransaction()
    } catch (error) {
        await this.rollbackTransaction()
        throw error
    }
}
```

### Data Validation
```javascript
async verify() {
    try {
        // Store-specific verification
        return true
    } catch (error) {
        logger.error('Verification failed:', error)
        return false
    }
}
```

## Storage Selection

Choose storage implementation based on:
1. Persistence requirements
2. Query complexity
3. Performance needs
4. Data volume
5. Transaction requirements

## Configuration

```javascript
// Example configuration
{
    storage: {
        type: 'sparql',
        options: {
            endpoint: 'http://localhost:3030',
            graphName: 'http://example.org/memory',
            cacheEnabled: true,
            cacheTTL: 300000,
            maxCacheSize: 1000
        }
    }
}
```

## Best Practices

1. Always use transactions for updates
2. Implement proper cleanup in close()
3. Validate data before storage
4. Handle partial failures
5. Monitor performance metrics