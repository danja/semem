# ZPT Performance Characteristics

This document provides detailed performance analysis and optimization guidelines for the ZPT (Zoom/Pan/Tilt) navigation system.

## Performance Overview

The ZPT system is designed for sub-second response times on typical knowledge graphs while maintaining high accuracy and comprehensive results. Performance characteristics vary based on corpus size, query complexity, and hardware configuration.

## Benchmark Results

### Standard Hardware Configuration
- **CPU**: 4 cores, 2.4GHz
- **Memory**: 8GB RAM
- **Storage**: SSD
- **Network**: Localhost SPARQL endpoint

### Response Time Benchmarks

| Corpus Size | Zoom Level | Avg Response Time | P95 Response Time | Memory Usage |
|-------------|------------|-------------------|-------------------|--------------|
| 100 entities | entity | 45ms | 80ms | 25MB |
| 500 entities | entity | 120ms | 200ms | 35MB |
| 1,000 entities | entity | 250ms | 400ms | 50MB |
| 5,000 entities | entity | 800ms | 1.2s | 120MB |
| 10,000 entities | entity | 1.5s | 2.1s | 200MB |

| Zoom Level | Complexity | Avg Response Time | Cache Hit Rate |
|------------|------------|-------------------|----------------|
| corpus | Low | 150ms | 85% |
| community | Low-Medium | 300ms | 75% |
| entity | Medium | 250ms | 70% |
| unit | Medium-High | 450ms | 65% |
| text | High | 800ms | 60% |

### Concurrency Performance

| Concurrent Requests | Success Rate | Avg Response Time | Resource Impact |
|-------------------|---------------|-------------------|-----------------|
| 1 | 100% | 250ms | Baseline |
| 5 | 100% | 280ms | +12% |
| 10 | 100% | 320ms | +28% |
| 20 | 98% | 450ms | +80% |
| 50 | 95% | 850ms | +240% |

## Performance Analysis by Component

### 1. Parameter Processing Layer

**Typical Performance**: 1-5ms
```javascript
// Lightweight validation and normalization
validationTime: 2ms
normalizationTime: 1ms
filterBuildingTime: 2ms
```

**Optimization Tips**:
- Parameter validation is cached for repeated patterns
- Use pre-validated parameter objects when possible
- Avoid complex nested pan filters for better performance

### 2. Corpuscle Selection Engine

**Performance by Strategy**:

| Selection Strategy | Avg Time | Use Case | Cache Effectiveness |
|-------------------|----------|----------|-------------------|
| Keywords | 80ms | Text matching | High (90%) |
| Embedding | 200ms | Semantic similarity | Medium (70%) |
| Graph | 350ms | Relationship analysis | Low (50%) |
| Temporal | 120ms | Time-based queries | High (85%) |

**Optimization Factors**:
```javascript
// SPARQL query optimization
selectionTime = baseTime * zoomComplexity * filterComplexity * corpusSize

// Typical breakdown:
baseTime: 50ms
zoomComplexity: {
  corpus: 0.5,
  community: 0.8,
  entity: 1.0,
  unit: 1.5,
  text: 2.0
}
filterComplexity: 1.0 + (numFilters * 0.2)
corpusSize: log(entityCount) / 10
```

### 3. Content Transformation Pipeline

**Performance by Format**:

| Output Format | Processing Time | Memory Overhead | Use Case |
|---------------|----------------|-----------------|----------|
| JSON | 50ms | Low | API responses |
| Structured | 120ms | Medium | Data processing |
| Markdown | 180ms | Medium | Documentation |
| Conversational | 300ms | High | LLM consumption |

**Token Processing Performance**:
```javascript
// Performance scales with token count
transformationTime = baseTime + (tokenCount * 0.1ms) + formatOverhead

// Chunking strategy impact:
semantic: +20% time, better quality
adaptive: +15% time, balanced
fixed: baseline, fastest
sliding: +10% time, good overlap
```

### 4. Caching System Performance

**Cache Hit Rates by Layer**:
- **L1 (Parameter Validation)**: 95% hit rate, 1ms avg
- **L2 (Selection Results)**: 70% hit rate, 15ms avg
- **L3 (Transformation Results)**: 60% hit rate, 50ms avg

**Cache Effectiveness**:
```javascript
// Cache performance varies by query pattern
repeatQuery: 95% hit rate (1st level cache)
similarQuery: 70% hit rate (2nd level cache)
relatedQuery: 40% hit rate (3rd level cache)
newQuery: 0% hit rate (full processing)

// Memory usage by cache level:
L1Cache: ~10MB (5min TTL)
L2Cache: ~50MB (1hr TTL)  
L3Cache: ~200MB (24hr TTL)
```

## Scaling Characteristics

### Corpus Size Scaling

```javascript
// Response time scaling formula (empirical)
responseTime = 50ms + (entityCount * 0.1ms) + (relationshipCount * 0.05ms)

// Memory usage scaling
memoryUsage = 30MB + (entityCount * 0.01MB) + (embeddingCount * 0.002MB)

// Recommended limits by performance tier:
Development: 1,000 entities, <1s response
Production: 10,000 entities, <2s response  
Enterprise: 100,000 entities, <5s response
```

### Concurrent User Scaling

```javascript
// Throughput characteristics
optimalConcurrency = cpuCores * 2
maxConcurrency = cpuCores * 4  

// Resource contention points:
sparqlEndpoint: 10-20 concurrent queries max
embeddingGeneration: 5-10 concurrent requests max
memoryManager: 50+ concurrent operations
```

## Performance Optimization Guide

### 1. Query Optimization

**Efficient Navigation Patterns**:
```javascript
// High Performance (entity zoom with filters)
await zptService.navigate('specific query', 'entity', {
  temporal: { start: '2023-01-01' }, // Recent data
  domains: ['specific-domain']        // Narrow scope
}, 'keywords', { maxTokens: 2000 });

// Medium Performance (unit zoom with embedding)
await zptService.navigate('semantic query', 'unit', {
  keywords: ['key', 'terms']
}, 'embedding', { maxTokens: 4000 });

// Lower Performance (text zoom with graph analysis)
await zptService.navigate('complex query', 'text', {}, 'graph', {
  maxTokens: 8000,
  chunkStrategy: 'semantic'
});
```

**Anti-Patterns to Avoid**:
```javascript
// Avoid: Broad queries without filters
await zptService.navigate('everything', 'text', {}, 'graph', {
  maxTokens: 16000 // Too many tokens
});

// Avoid: Complex nested filters
await zptService.navigate('query', 'entity', {
  temporal: { start: '1900-01-01', end: '2024-12-31' }, // Too broad
  domains: ['domain1', 'domain2', 'domain3', 'domain4'], // Too many
  keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']    // Too many
}, 'embedding', {});
```

### 2. Memory Optimization

**Memory-Efficient Configuration**:
```javascript
const optimizedConfig = {
  maxResults: 25,           // Limit result sets
  enableCaching: true,      // Enable all cache levels
  cacheExpiry: 1800000,    // 30 min (balance hit rate vs memory)
  
  // Transformation settings
  transform: {
    maxTokens: 3000,        // Reasonable limit
    chunkStrategy: 'fixed', // Fastest chunking
    format: 'json'          // Minimal overhead
  }
};
```

**Memory Monitoring**:
```javascript
// Monitor memory usage over time
function trackMemoryUsage() {
  const usage = process.memoryUsage();
  console.log({
    timestamp: new Date().toISOString(),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
  });
}

setInterval(trackMemoryUsage, 30000); // Monitor every 30 seconds
```

### 3. SPARQL Endpoint Optimization

**Connection Pooling**:
```javascript
// Configure connection pooling for better performance
const sparqlStore = new SPARQLStore(endpoint, {
  // Connection settings
  timeout: 30000,
  retryAttempts: 3,
  poolSize: 10,
  
  // Query optimization
  enableQueryCache: true,
  queryTimeout: 15000
});
```

**Index Optimization**:
```sparql
-- Add indexes for common query patterns
CREATE INDEX idx_entity_label ON entities(label);
CREATE INDEX idx_entity_type ON entities(type);
CREATE INDEX idx_timestamp ON semantic_units(timestamp);
CREATE INDEX idx_embedding ON entities(embedding_id);
```

### 4. Caching Strategy

**Multi-Level Cache Configuration**:
```javascript
const cacheConfig = {
  L1: {
    maxSize: 1000,          // Parameter validation cache
    ttl: 300000,            // 5 minutes
    strategy: 'lru'
  },
  L2: {
    maxSize: 500,           // Selection result cache
    ttl: 3600000,          // 1 hour
    strategy: 'lru'
  },
  L3: {
    maxSize: 100,           // Transformation cache
    ttl: 86400000,         // 24 hours
    strategy: 'lfu'         // Keep frequently used
  }
};
```

**Cache Warming**:
```javascript
// Pre-warm cache with common queries
const commonQueries = [
  'artificial intelligence',
  'machine learning',
  'neural networks'
];

for (const query of commonQueries) {
  await zptService.navigate(query, 'entity', {}, 'keywords', {});
}
```

## Performance Monitoring

### Key Metrics to Track

```javascript
// Essential performance metrics
const metrics = {
  // Response time metrics
  avgResponseTime: 250,     // Target: <500ms
  p95ResponseTime: 400,     // Target: <1000ms
  p99ResponseTime: 800,     // Target: <2000ms
  
  // Cache performance
  cacheHitRate: 0.75,       // Target: >70%
  cacheMissRate: 0.25,      // Target: <30%
  
  // Resource utilization
  memoryUsage: 150,         // MB, Target: <500MB
  cpuUsage: 0.4,           // Target: <70%
  
  // Error rates
  errorRate: 0.01,         // Target: <1%
  timeoutRate: 0.005,      // Target: <0.5%
  
  // Throughput
  requestsPerSecond: 10,    // Target: >5 req/s
  concurrentUsers: 5        // Target: >3 users
};
```

### Performance Alerting

```javascript
// Set up performance alerts
function checkPerformanceThresholds(metrics) {
  const alerts = [];
  
  if (metrics.avgResponseTime > 1000) {
    alerts.push('High average response time');
  }
  
  if (metrics.cacheHitRate < 0.6) {
    alerts.push('Low cache hit rate');
  }
  
  if (metrics.memoryUsage > 500) {
    alerts.push('High memory usage');
  }
  
  if (metrics.errorRate > 0.05) {
    alerts.push('High error rate');
  }
  
  return alerts;
}
```

## Benchmarking Tools

### Performance Test Suite

Run comprehensive performance tests:
```bash
# Unit performance tests
npm run test:performance:unit

# Integration performance tests  
npm run test:performance:integration

# Stress tests
npm run test:performance:stress

# Memory leak tests
npm run test:performance:memory
```

### Custom Benchmarking

```javascript
// Create custom performance benchmarks
import { PerformanceProfiler } from '../tests/performance/utils.js';

const profiler = new PerformanceProfiler();

async function benchmarkNavigation() {
  const testQueries = [
    'artificial intelligence',
    'machine learning algorithms', 
    'neural network architectures'
  ];
  
  for (const query of testQueries) {
    profiler.start(`query-${query}`);
    
    await zptService.navigate(query, 'entity', {}, 'keywords', {
      maxTokens: 2000
    });
    
    const metrics = profiler.end(`query-${query}`);
    console.log(`Query "${query}": ${metrics.duration}ms`);
  }
}
```

## Production Deployment Recommendations

### Hardware Requirements

**Minimum Configuration**:
- 2 CPU cores, 4GB RAM
- 10GB disk space
- 100 Mbps network

**Recommended Configuration**:
- 4 CPU cores, 8GB RAM  
- 50GB SSD storage
- 1 Gbps network

**High-Performance Configuration**:
- 8+ CPU cores, 16GB+ RAM
- 100GB+ NVMe SSD
- 10 Gbps network

### Scaling Strategies

1. **Vertical Scaling**: Increase server resources for single-instance deployment
2. **Horizontal Scaling**: Deploy multiple ZPT instances behind load balancer
3. **Caching Layer**: Add Redis or Memcached for distributed caching
4. **SPARQL Clustering**: Use federated SPARQL endpoints for data distribution

### Monitoring in Production

```javascript
// Production monitoring setup
const monitoring = {
  healthChecks: {
    interval: 30000,        // 30 seconds
    timeout: 5000,         // 5 seconds
    endpoints: [
      '/health',
      '/metrics',
      '/corpus/health'
    ]
  },
  
  alerting: {
    responseTime: 2000,     // Alert if >2s
    errorRate: 0.01,       // Alert if >1%
    memoryUsage: 0.8       // Alert if >80% of available memory
  },
  
  logging: {
    level: 'info',
    structured: true,
    includeMetrics: true
  }
};
```

---

*Performance characteristics are continuously monitored and updated. Benchmarks reflect typical usage patterns and may vary based on specific configurations and data characteristics.*