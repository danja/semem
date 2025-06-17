# Utils Module

The Utils module provides essential utility functions and helpers that support the core functionality of the Semem semantic memory system. These utilities handle common operations like validation, data transformation, configuration management, and integration with external services.

## Core Utilities

### Embedding Validation (`EmbeddingValidator.js`)
- **EmbeddingValidator**: Comprehensive validation for vector embeddings
- Dimension consistency checking
- Numerical validity and range validation
- Format standardization and normalization
- Quality assessment and scoring
- Compatibility checking across different models

**Key Features:**
- Multi-model embedding validation
- Automatic dimension detection
- Quality metrics calculation
- Batch validation support
- Error reporting and diagnostics

### SPARQL Helpers (`SPARQLHelpers.js`)
- **SPARQL Utilities**: Common SPARQL query construction and execution helpers
- Query builder with fluent interface
- Parameter binding and sanitization
- Result set processing and transformation
- Performance optimization utilities
- Error handling and debugging support

**Key Features:**
- Type-safe query construction
- Automatic escaping and sanitization
- Result format conversion (JSON, XML, CSV)
- Query caching and optimization
- Connection pooling and management

### Fuseki Discovery (`FusekiDiscovery.js`)
- **Fuseki Discovery**: Automatic discovery and configuration of Apache Fuseki endpoints
- Service discovery and health checking
- Endpoint capability detection
- Load balancing and failover
- Configuration management
- Performance monitoring

**Key Features:**
- Automatic endpoint discovery
- Health check and monitoring
- Capability negotiation
- Load balancing strategies
- Configuration persistence

### Ragno Configuration (`loadRagnoConfig.js`)
- **Ragno Config Loader**: Configuration management for the Ragno knowledge graph system
- Environment-based configuration
- Schema validation and type checking
- Default value management
- Configuration hot-reloading
- Security and access control

## Usage Patterns

### Embedding Validation
```javascript
import { EmbeddingValidator } from './utils/EmbeddingValidator.js';

const validator = new EmbeddingValidator({
  expectedDimension: 1536,
  numericRange: [-1, 1],
  qualityThreshold: 0.1
});

// Validate single embedding
const isValid = validator.validate(embedding);
if (!isValid) {
  console.error('Validation errors:', validator.getErrors());
}

// Batch validation
const results = validator.validateBatch(embeddings);
const validEmbeddings = results.filter(r => r.valid).map(r => r.embedding);

// Quality assessment
const quality = validator.assessQuality(embedding);
console.log(`Embedding quality score: ${quality.score}`);
```

### SPARQL Query Construction
```javascript
import { SPARQLBuilder, executeQuery } from './utils/SPARQLHelpers.js';

// Fluent query building
const query = new SPARQLBuilder()
  .select(['?entity', '?label', '?type'])
  .where([
    '?entity rdfs:label ?label',
    '?entity rdf:type ?type'
  ])
  .filter('regex(?label, ?searchTerm, "i")')
  .orderBy('?label')
  .limit(50)
  .build();

// Execute with parameters
const results = await executeQuery(endpoint, query, {
  searchTerm: 'machine learning'
});

// Process results
const entities = results.bindings.map(binding => ({
  uri: binding.entity.value,
  label: binding.label.value,
  type: binding.type.value
}));
```

### Service Discovery
```javascript
import { FusekiDiscovery } from './utils/FusekiDiscovery.js';

// Automatic discovery
const discovery = new FusekiDiscovery({
  hosts: ['localhost:3030', 'fuseki.example.com'],
  healthCheckInterval: 30000,
  timeout: 5000
});

await discovery.initialize();

// Get available endpoints
const endpoints = discovery.getEndpoints();
console.log('Available SPARQL endpoints:', endpoints);

// Get optimal endpoint for query
const endpoint = discovery.selectEndpoint({
  operation: 'query',
  dataset: 'semem',
  loadBalancing: 'round-robin'
});

// Monitor endpoint health
discovery.on('endpointDown', (endpoint) => {
  console.warn(`Endpoint ${endpoint.url} is down`);
});
```

### Configuration Management
```javascript
import { loadRagnoConfig } from './utils/loadRagnoConfig.js';

// Load configuration with validation
const config = await loadRagnoConfig({
  environment: process.env.NODE_ENV || 'development',
  configPath: './config/ragno.json',
  validateSchema: true
});

// Access configuration sections
const graphConfig = config.graph;
const algorithmConfig = config.algorithms;
const storageConfig = config.storage;

// Hot reload configuration
config.on('change', (newConfig) => {
  console.log('Configuration updated:', newConfig);
});
```

## Validation & Data Quality

### Embedding Quality Metrics
```javascript
// Comprehensive quality assessment
const qualityReport = validator.generateQualityReport(embeddings);
console.log({
  averageQuality: qualityReport.avgQuality,
  outlierCount: qualityReport.outliers.length,
  dimensionConsistency: qualityReport.dimensionConsistency,
  numericStability: qualityReport.numericStability
});

// Detect and handle outliers
const cleanedEmbeddings = validator.removeOutliers(embeddings, {
  method: 'iqr',
  threshold: 1.5
});
```

### Data Transformation
```javascript
// Normalize embeddings to unit vectors
const normalized = validator.normalize(embeddings, 'unit');

// Convert between embedding formats
const converted = validator.convertFormat(embeddings, {
  from: 'float32',
  to: 'float64',
  precision: 6
});

// Dimension reduction
const reduced = validator.reduceDimensions(embeddings, {
  method: 'pca',
  targetDimension: 512
});
```

## Performance Optimization

### Caching Strategies
```javascript
// Query result caching
const cachedQuery = SPARQLHelpers.withCache(query, {
  ttl: 300000, // 5 minutes
  key: 'entities-search',
  invalidateOn: ['entity-update', 'schema-change']
});

// Embedding computation caching
const cachedEmbedding = EmbeddingValidator.withCache(text, {
  model: 'nomic-embed-text',
  ttl: 3600000, // 1 hour
  persist: true
});
```

### Batch Processing
```javascript
// Batch SPARQL operations
const batchResults = await SPARQLHelpers.executeBatch(queries, {
  batchSize: 10,
  concurrency: 3,
  retryPolicy: {
    maxRetries: 3,
    backoffFactor: 2
  }
});

// Batch embedding validation
const batchValidation = validator.validateBatch(embeddings, {
  chunkSize: 1000,
  parallel: true,
  progressCallback: (progress) => {
    console.log(`Validation progress: ${progress.percentage}%`);
  }
});
```

## Error Handling & Debugging

### Comprehensive Error Reporting
```javascript
// Detailed error information
try {
  await executeQuery(endpoint, query);
} catch (error) {
  const errorInfo = SPARQLHelpers.analyzeError(error);
  console.error({
    type: errorInfo.type,
    message: errorInfo.message,
    query: errorInfo.query,
    suggestions: errorInfo.suggestions
  });
}
```

### Debug Utilities
```javascript
// Query debugging
const debugQuery = SPARQLHelpers.debug(query, {
  explainPlan: true,
  showBindings: true,
  timing: true
});

// Embedding analysis
const analysis = validator.analyze(embedding, {
  showDistribution: true,
  detectAnomalies: true,
  compareToBaseline: baselineEmbedding
});
```

## Integration Helpers

### Service Integration
```javascript
// Health check utilities
const healthCheck = {
  sparql: await SPARQLHelpers.checkHealth(endpoint),
  fuseki: await FusekiDiscovery.checkService(fusekiUrl),
  embeddings: await EmbeddingValidator.checkService(embeddingService)
};

// Service monitoring
const monitor = new ServiceMonitor({
  services: ['sparql', 'fuseki', 'embeddings'],
  checkInterval: 60000,
  alertThreshold: 3
});

monitor.on('serviceDown', (service) => {
  console.error(`Service ${service.name} is down`);
});
```

### Configuration Utilities
```javascript
// Environment-specific configuration
const config = loadConfig({
  development: {
    sparql: 'http://localhost:3030',
    embedding: 'http://localhost:11434'
  },
  production: {
    sparql: 'https://fuseki.example.com',
    embedding: 'https://api.openai.com'
  }
});

// Configuration validation
const validationResult = validateConfig(config, configSchema);
if (!validationResult.valid) {
  console.error('Configuration errors:', validationResult.errors);
}
```

## Security & Compliance

### Input Sanitization
```javascript
// SPARQL injection prevention
const safeQuery = SPARQLHelpers.sanitize(userQuery, {
  allowedFunctions: ['regex', 'str', 'lang'],
  maxQueryLength: 10000,
  preventInfiniteLoops: true
});

// Parameter validation
const validatedParams = validator.validateParameters(params, {
  searchTerm: { type: 'string', maxLength: 100 },
  limit: { type: 'number', min: 1, max: 1000 }
});
```

### Access Control
```javascript
// Configuration access control
const secureConfig = loadRagnoConfig({
  accessLevel: 'user', // 'admin', 'user', 'readonly'
  maskSensitive: true,
  auditAccess: true
});

// Query authorization
const authorizedQuery = SPARQLHelpers.authorize(query, {
  user: currentUser,
  permissions: userPermissions,
  datasetAccess: allowedDatasets
});
```