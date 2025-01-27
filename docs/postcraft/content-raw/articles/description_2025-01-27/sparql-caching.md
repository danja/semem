# SPARQL Caching Strategy Analysis

## Cache Architecture

The CachedSPARQLStore implements a two-level caching system:

1. Query Cache
   - Maps normalized SPARQL queries to results
   - TTL-based expiration
   - Size-limited with LRU eviction
   - Handles query normalization

2. Timestamp Cache
   - Tracks cache entry ages
   - Supports cleanup operations
   - Manages eviction priorities

## Implementation Details

### Cache Key Generation
```javascript
_generateCacheKey(query) {
    // Normalize query by removing whitespace variations
    return query.replace(/\s+/g, ' ').trim()
}
```

### Cache Operations

1. Query Execution:
```javascript
async _executeSparqlQuery(query, endpoint) {
    if (!this.cacheEnabled) {
        return super._executeSparqlQuery(query, endpoint)
    }

    const cacheKey = this._generateCacheKey(query)
    const cachedResult = this.queryCache.get(cacheKey)
    
    if (cachedResult) {
        const timestamp = this.cacheTimestamps.get(cacheKey)
        if (Date.now() - timestamp < this.cacheTTL) {
            return JSON.parse(JSON.stringify(cachedResult)) // Deep clone
        }
    }

    // Cache miss or expired
    const result = await super._executeSparqlQuery(query, endpoint)
    this.queryCache.set(cacheKey, result)
    this.cacheTimestamps.set(cacheKey, Date.now())
    
    return result
}
```

2. Cache Cleanup:
```javascript
cleanupCache() {
    const now = Date.now()

    // Remove expired entries
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
        if (now - timestamp > this.cacheTTL) {
            this.queryCache.delete(key)
            this.cacheTimestamps.delete(key)
        }
    }

    // Enforce size limit with LRU
    while (this.queryCache.size > this.maxCacheSize) {
        let oldestKey = null
        let oldestTime = Infinity

        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (timestamp < oldestTime) {
                oldestTime = timestamp
                oldestKey = key
            }
        }

        if (oldestKey) {
            this.queryCache.delete(oldestKey)
            this.cacheTimestamps.delete(oldestKey)
        }
    }
}
```

## Cache Invalidation

1. Write Operations
```javascript
async saveMemoryToHistory(memoryStore) {
    this.invalidateCache() // Clear cache on writes
    return super.saveMemoryToHistory(memoryStore)
}
```

2. Transaction Management
```javascript
async rollbackTransaction() {
    await super.rollbackTransaction()
    this.invalidateCache() // Clear cache on rollback
}
```

## Performance Considerations

1. Cache Hit Ratio
   - Monitor with metrics
   - Adjust TTL based on hit rate
   - Track cache effectiveness

2. Memory Usage
   - Monitor cache size
   - Adjust maxCacheSize based on memory
   - Consider entry size in eviction

3. Query Patterns
   - Cache frequent queries longer
   - Consider query complexity
   - Optimize for common patterns

## Configuration Options

```javascript
{
    cacheEnabled: true,
    cacheTTL: 300000, // 5 minutes
    maxCacheSize: 1000,
    cleanupInterval: 60000 // 1 minute
}
```