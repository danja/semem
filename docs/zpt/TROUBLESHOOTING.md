# ZPT Troubleshooting Guide

This guide helps resolve common issues when working with the ZPT (Zoom/Pan/Tilt) navigation system.

## Common Issues and Solutions

### 1. Connection and Setup Issues

#### SPARQL Endpoint Connectivity

**Problem**: ZPT navigation falls back to simulation mode
```
⚠️ Missing SPARQL store or embedding handler - falling back to simulation
```

**Causes**:
- SPARQL endpoint not running
- Incorrect endpoint configuration
- Network connectivity issues
- Authentication problems

**Solutions**:
1. **Check SPARQL Endpoint Status**:
   ```bash
   curl -X GET "http://localhost:3030/$/ping"
   ```

2. **Verify Configuration**:
   ```javascript
   // Check your .env file
   SPARQL_ENDPOINT_QUERY=http://localhost:3030/dataset/sparql
   SPARQL_ENDPOINT_UPDATE=http://localhost:3030/dataset/update
   SPARQL_USER=admin
   SPARQL_PASSWORD=admin
   ```

3. **Test Connection**:
   ```javascript
   import SPARQLStore from './src/stores/SPARQLStore.js';
   
   const store = new SPARQLStore({
     query: 'http://localhost:3030/dataset/sparql',
     update: 'http://localhost:3030/dataset/update'
   });
   
   try {
     const health = await store.validateCorpus();
     console.log('Corpus health:', health);
   } catch (error) {
     console.error('Connection failed:', error.message);
   }
   ```

#### Embedding Handler Issues

**Problem**: Embedding generation fails
```
Failed to generate embedding: Service unavailable
```

**Solutions**:
1. **Check Ollama Service**:
   ```bash
   ollama list
   ollama pull nomic-embed-text
   curl http://localhost:11434/api/tags
   ```

2. **Verify Model Availability**:
   ```javascript
   import EmbeddingHandler from './src/handlers/EmbeddingHandler.js';
   
   const handler = new EmbeddingHandler();
   try {
     const embedding = await handler.generateEmbedding('test text');
     console.log('Embedding dimension:', embedding.length);
   } catch (error) {
     console.error('Embedding failed:', error.message);
   }
   ```

### 2. Performance Issues

#### Slow Query Response

**Problem**: ZPT navigation takes too long
```
Navigation timeout after 30 seconds
```

**Diagnostic Steps**:
1. **Check Corpus Size**:
   ```javascript
   const analysis = await zptService.analyzeCorpus('structure', true);
   console.log('Corpus stats:', analysis.analysis.structure);
   ```

2. **Monitor Query Performance**:
   ```javascript
   // Enable debug logging
   process.env.LOG_LEVEL = 'debug';
   
   const result = await zptService.navigate(query, zoom, pan, tilt, transform);
   console.log('Pipeline timing:', result.metadata.pipeline);
   ```

**Solutions**:
1. **Optimize Zoom Level**:
   - Use 'entity' for specific queries
   - Use 'corpus' for high-level overviews
   - Avoid 'text' for large corpora

2. **Reduce Token Limits**:
   ```javascript
   const transform = {
     maxTokens: 2000, // Reduce from 8000
     format: 'json',
     chunkStrategy: 'fixed'
   };
   ```

3. **Add Filters to Narrow Scope**:
   ```javascript
   const pan = {
     temporal: {
       start: '2023-01-01', // Recent data only
       end: '2024-12-31'
     },
     domains: ['specific-domain'] // Narrow topic
   };
   ```

#### High Memory Usage

**Problem**: Memory consumption grows with each navigation
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solutions**:
1. **Enable Garbage Collection**:
   ```bash
   node --expose-gc --max-old-space-size=4096 your-script.js
   ```

2. **Implement Result Streaming**:
   ```javascript
   const transform = {
     maxTokens: 2000, // Smaller chunks
     chunkStrategy: 'semantic'
   };
   ```

3. **Clear Caches Periodically**:
   ```javascript
   // In your application
   if (navigationCount % 100 === 0) {
     await zptService.clearCaches();
   }
   ```

### 3. Data Quality Issues

#### Low Embedding Coverage

**Problem**: Poor similarity search results
```
Embedding coverage: 23% - Low coverage detected
```

**Solutions**:
1. **Regenerate Embeddings**:
   ```javascript
   // Re-embed all entities
   const entities = await sparqlStore.queryByZoomLevel({
     zoomLevel: 'entity',
     filters: {},
     limit: 1000
   });
   
   for (const entity of entities) {
     const embedding = await embeddingHandler.generateEmbedding(entity.label);
     await sparqlStore.storeEntity({ ...entity, embedding });
   }
   ```

2. **Check Embedding Model**:
   ```bash
   ollama show nomic-embed-text
   ```

#### Poor Graph Connectivity

**Problem**: Few relationships between entities
```
Connectivity: 0.05 - Low graph connectivity detected
```

**Solutions**:
1. **Add More Relationships**:
   ```javascript
   // Import relationship data
   const relationships = [
     {
       id: 'rel1',
       source: 'entity1',
       target: 'entity2',
       type: 'relatedTo',
       weight: 0.8
     }
   ];
   
   for (const rel of relationships) {
     await sparqlStore.storeRelationship(rel);
   }
   ```

2. **Run Community Detection**:
   ```javascript
   // Use external tools or implement community detection
   const communities = await detectCommunities(entities, relationships);
   for (const community of communities) {
     await sparqlStore.storeCommunity(community);
   }
   ```

### 4. Query and Parameter Issues

#### Invalid Parameter Combinations

**Problem**: Parameter validation errors
```
INVALID_ZOOM: Invalid zoom level. Must be one of: entity, unit, text, community, corpus
```

**Solutions**:
1. **Check Parameter Schema**:
   ```javascript
   const schema = await zptService.getSchema();
   console.log('Valid parameters:', schema.schema.parameters);
   ```

2. **Validate Before Navigation**:
   ```javascript
   const validation = zptService.validateParams({
     query: 'test',
     zoom: 'entity',
     pan: {},
     tilt: 'keywords'
   });
   
   if (!validation.validation.valid) {
     console.log('Validation errors:', validation.validation.errors);
   }
   ```

#### Empty Results

**Problem**: Navigation returns no corpuscles
```
Parsed 0 corpuscles for zoom level: entity
```

**Diagnostic Steps**:
1. **Check Corpus Content**:
   ```javascript
   const health = await sparqlStore.validateCorpus();
   console.log('Entity count:', health.stats.entityCount);
   ```

2. **Test Direct Queries**:
   ```javascript
   const results = await sparqlStore.queryByZoomLevel({
     zoomLevel: 'entity',
     filters: {},
     limit: 10
   });
   console.log('Direct query results:', results.length);
   ```

**Solutions**:
1. **Broaden Search Parameters**:
   ```javascript
   const pan = {
     // Remove restrictive filters
     // domains: [], // Remove domain restriction
     // temporal: {}, // Remove time restriction
   };
   ```

2. **Check Data Format**:
   ```sparql
   # Verify data exists in expected format
   SELECT ?entity ?label ?type
   WHERE {
     ?entity a ragno:Entity ;
             rdfs:label ?label ;
             rdf:type ?type .
   } LIMIT 10
   ```

### 5. Error Recovery

#### Graceful Degradation

When real data fails, ZPT automatically falls back to simulation mode:

```javascript
// Configuration for fallback behavior
const zptConfig = {
  enableRealData: true,
  fallbackToSimulation: true, // Enable fallback
  maxSelectionTime: 30000,
  maxTransformationTime: 45000
};
```

#### Retry Mechanisms

Implement retry logic for transient failures:

```javascript
async function robustNavigation(query, zoom, pan, tilt, transform, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await zptService.navigate(query, zoom, pan, tilt, transform);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Performance Monitoring

### Enable Detailed Logging

```javascript
// Set environment variables for debugging
process.env.LOG_LEVEL = 'debug';
process.env.__ENABLE_PERFORMANCE_LOGGING__ = 'true';

// Check pipeline performance
const result = await zptService.navigate(query, zoom, pan, tilt, transform);
console.log('Performance metrics:', {
  validationTime: result.metadata.pipeline.validationTime,
  selectionTime: result.metadata.pipeline.selectionTime,
  transformationTime: result.metadata.pipeline.transformationTime,
  totalTime: result.metadata.pipeline.totalTime,
  mode: result.metadata.pipeline.mode
});
```

### Monitor Resource Usage

```javascript
// Memory monitoring
function logMemoryUsage(label) {
  const usage = process.memoryUsage();
  console.log(`${label} Memory:`, {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  });
}

logMemoryUsage('Before navigation');
await zptService.navigate(query, zoom, pan, tilt, transform);
logMemoryUsage('After navigation');
```

## Getting Help

### Debug Information Collection

When reporting issues, include:

1. **System Information**:
   ```bash
   node --version
   npm list | grep semem
   curl -I http://localhost:3030/$/ping
   ```

2. **Configuration**:
   ```javascript
   console.log('Environment:', {
     NODE_ENV: process.env.NODE_ENV,
     SPARQL_ENDPOINT_QUERY: process.env.SPARQL_ENDPOINT_QUERY,
     EMBEDDING_MODEL: process.env.EMBEDDING_MODEL
   });
   ```

3. **Error Details**:
   ```javascript
   try {
     await zptService.navigate(query, zoom, pan, tilt, transform);
   } catch (error) {
     console.error('Error details:', {
       name: error.name,
       message: error.message,
       stack: error.stack,
       query, zoom, pan, tilt, transform
     });
   }
   ```

### Community Resources

- **Documentation**: `/docs/zpt/`
- **Examples**: `/examples/zpt/`
- **Tests**: `/tests/integration/zpt/`
- **Performance**: `/tests/performance/zpt/`

### Known Limitations

1. **SPARQL Endpoint Compatibility**: Tested with Apache Fuseki, may need adjustments for other endpoints
2. **Embedding Model Dependencies**: Requires Ollama with nomic-embed-text model
3. **Memory Constraints**: Large corpora (>10,000 entities) may require memory optimization
4. **Concurrent Access**: High concurrency may impact SPARQL endpoint performance

---

*This troubleshooting guide is continuously updated. If you encounter issues not covered here, please contribute solutions back to the documentation.*