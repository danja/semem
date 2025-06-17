# Services Module

The Services module provides specialized business logic services that orchestrate complex operations across multiple system components. These services act as the application layer, implementing domain-specific workflows and integrations.

## Architecture

### Service Categories

#### Embedding Services (`embeddings/`)

##### Embedding Creator (`EmbeddingCreator.js`)
- **EmbeddingCreator**: High-level embedding generation service
- Batch processing with optimized throughput
- Multi-model support with automatic selection
- Quality validation and error handling
- Caching and persistence integration
- Performance monitoring and optimization

##### Embedding Service (`EmbeddingService.js`)
- **EmbeddingService**: Core embedding management service
- Provider abstraction and load balancing
- Embedding format standardization
- Similarity computation and indexing
- Real-time embedding generation
- Metrics collection and analysis

##### SPARQL Service (`SPARQLService.js`)
- **SPARQLService**: SPARQL endpoint integration service
- Query optimization and execution
- Result set processing and caching
- Connection pooling and health monitoring
- Error handling and recovery
- Performance analytics

#### Search Services (`search/`)

##### Search Service (`SearchService.js`)
- **SearchService**: Unified search interface
- Multi-modal search (vector, text, graph)
- Result fusion and ranking
- Search analytics and optimization
- Real-time indexing and updates
- Query expansion and refinement

##### Search Server (`SearchServer.js`)
- **SearchServer**: Dedicated search server
- High-performance search operations
- Distributed search capabilities
- Load balancing and scaling
- Search result caching
- API gateway for search operations

##### UI Server (`UIServer.js`)
- **UIServer**: User interface server
- Static asset serving
- API proxy and routing
- Real-time communication (WebSockets)
- Authentication and session management
- Security headers and CORS

#### VSOM Services (`vsom/`)

##### VSOM Service (`VSOMService.js`)
- **VSOM Service**: Vector Self-Organizing Map service
- Neural network training and inference
- Topology management and visualization
- Real-time learning and adaptation
- Model persistence and versioning
- Performance monitoring and tuning

## Service Integration

### Cross-Service Communication
```javascript
// Service orchestration example
import { EmbeddingService } from './services/embeddings/EmbeddingService.js';
import { SearchService } from './services/search/SearchService.js';
import { VSOMService } from './services/vsom/VSOMService.js';

// Initialize services with dependencies
const embeddingService = new EmbeddingService(config.embeddings);
const searchService = new SearchService({
  embeddingService,
  indexConfig: config.search.index
});
const vsomService = new VSOMService({
  embeddingService,
  topology: config.vsom.topology
});

// Service orchestration
async function processDocument(document) {
  // Generate embeddings
  const embedding = await embeddingService.generateEmbedding(document.text);
  
  // Update search index
  await searchService.indexDocument({
    id: document.id,
    content: document.text,
    embedding: embedding
  });
  
  // Train VSOM
  await vsomService.addTrainingData(embedding, document.metadata);
  
  return { indexed: true, trained: true };
}
```

### Service Discovery
```javascript
// Service registry pattern
const serviceRegistry = new ServiceRegistry();

// Register services
serviceRegistry.register('embeddings', embeddingService);
serviceRegistry.register('search', searchService);
serviceRegistry.register('vsom', vsomService);

// Service dependency injection
const service = serviceRegistry.get('search');
const dependencies = serviceRegistry.getDependencies('search');
```

## Usage Patterns

### Embedding Services

#### Batch Processing
```javascript
const embeddingCreator = new EmbeddingCreator({
  batchSize: 100,
  concurrency: 5,
  providers: ['ollama', 'openai'],
  fallbackStrategy: 'best-available'
});

// Process large document collection
const documents = await loadDocuments('./corpus/');
const results = await embeddingCreator.processDocuments(documents, {
  onProgress: (progress) => console.log(`Progress: ${progress.percentage}%`),
  onError: (error, document) => console.error(`Failed to process ${document.id}:`, error)
});
```

#### Real-time Processing
```javascript
const embeddingService = new EmbeddingService({
  realTimeQueue: true,
  cacheStrategy: 'lru',
  maxCacheSize: '1GB'
});

// Real-time embedding generation
const stream = embeddingService.createEmbeddingStream();
stream.on('embedding', (result) => {
  console.log(`Generated embedding for: ${result.text}`);
});

// Add text to processing queue
stream.write('Text to process');
```

### Search Services

#### Multi-Modal Search
```javascript
const searchService = new SearchService({
  modes: ['vector', 'text', 'graph'],
  fusion: 'reciprocal-rank',
  personalization: true
});

// Execute complex search
const results = await searchService.search({
  query: 'machine learning applications',
  modes: {
    vector: { threshold: 0.8, weight: 0.6 },
    text: { fuzzy: true, weight: 0.3 },
    graph: { depth: 2, weight: 0.1 }
  },
  filters: {
    date: { after: '2024-01-01' },
    type: ['article', 'paper']
  },
  personalization: {
    userId: 'user123',
    preferences: userPreferences
  }
});
```

#### Real-time Indexing
```javascript
// Set up real-time indexing
searchService.enableRealTimeIndexing({
  updateInterval: 1000, // 1 second
  batchSize: 50,
  incrementalUpdates: true
});

// Add documents to index
searchService.on('documentAdded', (document) => {
  console.log(`Indexed document: ${document.id}`);
});

await searchService.addDocument(newDocument);
```

### VSOM Services

#### Neural Network Training
```javascript
const vsomService = new VSOMService({
  topology: {
    width: 20,
    height: 20,
    shape: 'hexagonal'
  },
  training: {
    epochs: 100,
    learningRate: 0.1,
    learningRateDecay: 0.99,
    neighborhood: 'gaussian'
  }
});

// Train with data
await vsomService.train(trainingData, {
  onEpoch: (epoch, loss) => console.log(`Epoch ${epoch}: Loss ${loss}`),
  onComplete: (model) => console.log('Training completed')
});

// Get trained model
const model = vsomService.getModel();
const coordinates = model.getCoordinates(inputVector);
```

#### Visualization Integration
```javascript
// Generate visualization data
const visualizationData = await vsomService.generateVisualizationData({
  includeWeights: true,
  includeDistances: true,
  colorMapping: 'cluster'
});

// Export for frontend
const frontendData = vsomService.exportForVisualization(visualizationData);
```

## Performance Optimization

### Service-Level Caching
```javascript
// Multi-tier caching strategy
const serviceCache = new ServiceCache({
  memory: {
    maxSize: '512MB',
    ttl: 300000 // 5 minutes
  },
  redis: {
    host: 'redis://localhost:6379',
    ttl: 3600000 // 1 hour
  },
  disk: {
    path: './cache/',
    ttl: 86400000 // 24 hours
  }
});

// Cache-aware service calls
const result = await serviceCache.wrap('embedding:' + textHash, () => {
  return embeddingService.generateEmbedding(text);
});
```

### Load Balancing
```javascript
// Service load balancing
const loadBalancer = new ServiceLoadBalancer({
  strategy: 'round-robin', // or 'least-connections', 'weighted'
  healthCheck: {
    interval: 30000,
    timeout: 5000,
    path: '/health'
  }
});

// Add service instances
loadBalancer.addInstance('embedding-1', embeddingService1);
loadBalancer.addInstance('embedding-2', embeddingService2);

// Balanced service calls
const result = await loadBalancer.call('generateEmbedding', text);
```

### Resource Management
```javascript
// Resource pooling and management
const resourceManager = new ResourceManager({
  maxMemoryUsage: '4GB',
  maxCpuUsage: 80, // percentage
  garbageCollection: {
    interval: 60000,
    aggressiveness: 'moderate'
  }
});

// Monitor and optimize resource usage
resourceManager.on('memoryPressure', () => {
  embeddingService.clearCache();
  searchService.compactIndex();
});
```

## Monitoring & Analytics

### Service Metrics
```javascript
// Comprehensive service monitoring
const serviceMonitor = new ServiceMonitor({
  metrics: ['latency', 'throughput', 'errors', 'resources'],
  alerting: {
    latencyThreshold: 1000,
    errorRateThreshold: 0.05,
    resourceThreshold: 0.9
  }
});

// Collect and analyze metrics
const metrics = await serviceMonitor.getMetrics('embedding-service');
console.log({
  avgLatency: metrics.latency.avg,
  throughput: metrics.throughput.perSecond,
  errorRate: metrics.errors.rate,
  memoryUsage: metrics.resources.memory.percentage
});
```

### Health Checks
```javascript
// Service health monitoring
const healthChecker = new HealthChecker({
  services: ['embeddings', 'search', 'vsom'],
  checkInterval: 30000,
  dependencies: {
    'search': ['embeddings'],
    'vsom': ['embeddings']
  }
});

// Handle service issues
healthChecker.on('serviceDown', (service) => {
  console.error(`Service ${service.name} is down`);
  // Implement fallback or recovery logic
});

healthChecker.on('serviceRecovered', (service) => {
  console.info(`Service ${service.name} has recovered`);
});
```

## Security & Compliance

### Service Authentication
```javascript
// Inter-service authentication
const serviceAuth = new ServiceAuth({
  method: 'jwt',
  secretKey: process.env.SERVICE_SECRET,
  tokenExpiry: 3600000, // 1 hour
  refreshEnabled: true
});

// Secure service calls
const authenticatedCall = serviceAuth.wrap(embeddingService.generateEmbedding);
const result = await authenticatedCall(text, { userId: 'user123' });
```

### Audit Logging
```javascript
// Service operation auditing
const auditLogger = new AuditLogger({
  level: 'info',
  destination: './logs/audit.log',
  format: 'json',
  retention: '30d'
});

// Log service operations
auditLogger.logServiceCall({
  service: 'embedding',
  operation: 'generateEmbedding',
  userId: 'user123',
  inputHash: hash(input),
  timestamp: new Date(),
  duration: responseTime
});
```