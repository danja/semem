# ZPT (Zoom, Pan, Tilt) Subsystem Analysis

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Design Principles](#design-principles)
3. [Core Components](#core-components)
4. [Key Algorithms](#key-algorithms)
5. [Integration Patterns](#integration-patterns)
6. [Configuration and Usage](#configuration-and-usage)
7. [Performance Considerations](#performance-considerations)
8. [Development Guide](#development-guide)

## Architecture Overview

### Conceptual Foundation

The ZPT (Zoom, Pan, Tilt) subsystem provides **parameter-driven navigation through a Ragno corpus** using three dimensions to select and transform content for LLM consumption. It implements a camera metaphor for knowledge exploration:

- **Zoom**: Controls abstraction level (entity → unit → text → community → corpus)
- **Pan**: Applies domain filtering (topic, entity, temporal, geographic)
- **Tilt**: Determines representation format (embedding, keywords, graph, temporal)

### High-Level Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   ZOOM      │───▶│     PAN     │───▶│    TILT     │───▶│ TRANSFORM   │
│(abstraction)│    │ (filtering) │    │(projection) │    │  (format)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                    │                    │                    │
      ▼                    ▼                    ▼                    ▼
  Entity Level      Topic Filters      Keywords         JSON/Markdown
  Unit Level        Entity Scope       Embeddings       Structured
  Text Level        Temporal Bounds    Graph Analysis   Conversational
  Community Level   Geographic Limits  Temporal Seq.    Chunked Output
  Corpus Level      
```

### Four-Layer Architecture

1. **Parameter Processing Layer**: Validates, normalizes, and converts navigation parameters
2. **Corpuscle Selection Layer**: Selects content based on zoom/pan/tilt dimensions
3. **LLM Transformation Layer**: Converts selected content to LLM-optimized formats
4. **API Layer**: RESTful endpoints for navigation requests with full error handling

## Design Principles

### 1. Stateless Navigation API
- Each request contains complete navigation state
- No server-side session management
- Cacheable and horizontally scalable

### 2. Parameter-Driven Selection
- Declarative navigation through parameters
- Consistent behavior across zoom levels
- Composable filter combinations

### 3. LLM-First Transformation
- Token budget management
- Format optimization for specific models
- Metadata preservation with navigation context

### 4. Modular Pipeline Architecture
- Independent, testable components
- Configurable transformation stages
- Graceful degradation on component failure

### 5. Performance Optimization
- Multi-level caching strategy
- Parallel processing where possible
- Streaming support for large responses

## Core Components

### Parameter Processing Layer

#### ParameterValidator
**Purpose**: Validates ZPT navigation parameters against schema
**Key Features**:
- Comprehensive validation with detailed error messages
- Support for nested validation (pan filters)
- Schema-based validation with custom rules

```javascript
// Validation schema structure
{
  zoom: { type: 'enum', values: ['entity', 'unit', 'text', 'community', 'corpus'] },
  pan: { 
    type: 'object',
    properties: {
      topic: { type: 'string', pattern: /^[a-zA-Z0-9\-_]+$/ },
      entity: { type: 'array', items: { type: 'string' } },
      temporal: { type: 'object', properties: { start: 'date', end: 'date' } },
      geographic: { type: 'object' }
    }
  },
  tilt: { type: 'enum', values: ['embedding', 'keywords', 'graph', 'temporal'] },
  transform: { type: 'object', properties: { maxTokens: 'number', format: 'enum' } }
}
```

#### ParameterNormalizer
**Purpose**: Standardizes parameters and applies defaults
**Key Features**:
- Default value application
- Parameter hash generation for caching
- Metadata calculation (complexity, hasFilters)

#### FilterBuilder
**Purpose**: Converts parameters to SPARQL queries with Ragno ontology support
**Key Features**:
- SPARQL query generation for each zoom level
- Embedding similarity search integration
- Multi-factor query optimization

#### SelectionCriteria
**Purpose**: Builds selection rules and scoring configuration
**Key Features**:
- Multi-factor scoring system with configurable weights
- Optimization rules based on zoom/tilt combinations
- Result count and quality constraints

### Corpuscle Selection Layer

#### CorpuscleSelector
**Purpose**: Main orchestrator for parameter-based corpuscle selection
**Architecture**:
```javascript
// Selection pipeline stages
1. Parameter validation & normalization
2. Cache checking (parameter hash-based)
3. Selection criteria building
4. Tilt-specific selection execution
5. Post-processing & scoring
6. Result building & caching
```

**Selection Strategies**:
- **Embedding**: Vector similarity with cosine distance
- **Keywords**: Term-based scoring with fuzzy matching
- **Graph**: Connectivity and centrality analysis
- **Temporal**: Chronological ordering with recency weighting

#### ZoomLevelMapper
**Purpose**: Maps zoom levels to Ragno element types and selection strategies
**Zoom Level Mappings**:

| Zoom Level | Primary Types | Scope | Typical Results | Token/Result |
|------------|---------------|--------|----------------|--------------|
| corpus | ragno:Corpus | global | 1 | 200 |
| community | ragno:Community | thematic | 50 | 100 |
| unit | ragno:SemanticUnit | semantic | 200 | 80 |
| entity | ragno:Entity | conceptual | 500 | 30 |
| text | ragno:TextElement | textual | 1000 | 150 |

#### PanDomainFilter
**Purpose**: Applies domain-specific filtering constraints
**Filter Types**:
- **Topic**: Semantic expansion with fuzzy matching
- **Entity**: Direct entity scope filtering
- **Temporal**: Time period bounds with date validation
- **Geographic**: Spatial constraints with bounding boxes

#### TiltProjector
**Purpose**: Generates appropriate representations based on tilt
**Projection Types**:
- **Keywords**: TF-IDF extraction with stop word filtering
- **Embeddings**: Vector generation with dimensionality reduction
- **Graph**: Relationship extraction with centrality metrics
- **Temporal**: Event sequencing with temporal ordering

### LLM Transformation Layer

#### CorpuscleTransformer
**Purpose**: Main transformation engine coordinating all transformation steps
**Pipeline Stages**:
```javascript
1. Input validation
2. Token analysis & budget checking
3. Content chunking (if needed)
4. Format application
5. Metadata encoding
6. Output validation
```

**Features**:
- **Timeout Management**: Per-stage timeout with graceful degradation
- **Error Recovery**: Retry logic with exponential backoff
- **Metrics Collection**: Performance tracking and bottleneck identification

#### TokenCounter
**Purpose**: Accurate token counting for different tokenizers and models
**Supported Tokenizers**: cl100k_base (GPT-4), p50k_base (GPT-3), claude, llama
**Features**:
- Cost estimation for different models
- Context limit checking with reserved token budgets
- Batch processing for efficiency

#### ContentChunker
**Purpose**: Intelligent content chunking with semantic boundaries
**Chunking Strategies**:
- **Fixed**: Equal-sized chunks with configurable overlap
- **Semantic**: Boundary detection using NLP techniques
- **Adaptive**: Dynamic sizing based on content complexity
- **Hierarchical**: Multi-level chunking for large documents
- **Token-Aware**: Precise token budget adherence

#### PromptFormatter
**Purpose**: Formats content for optimal LLM consumption
**Output Formats**:
- **JSON**: Structured data with schema validation
- **Markdown**: Rich text with semantic markup
- **Structured**: Hierarchical organization with headers
- **Conversational**: Natural language format
- **Analytical**: Research-focused format with citations

#### MetadataEncoder
**Purpose**: Preserves ZPT navigation context in outputs
**Encoding Strategies**:
- **Structured**: Full context preservation
- **Compact**: Compressed metadata with key information
- **Inline**: Context markers within content
- **Breadcrumb**: Navigation path preservation

### API Layer

#### NavigationEndpoint
**Purpose**: RESTful navigation handler with complete request lifecycle
**Endpoints**:
- `POST /api/navigate` - Main navigation with full ZPT pipeline
- `POST /api/navigate/preview` - Quick preview without full processing
- `GET /api/navigate/options` - Available parameter values and limits
- `GET /api/navigate/schema` - Parameter documentation and examples
- `GET /api/navigate/health` - System health and component status
- `GET /api/navigate/metrics` - Performance metrics and statistics

**Features**:
- **Rate Limiting**: 100 requests/minute per IP
- **Concurrent Management**: 10 concurrent requests max
- **CORS Support**: Cross-origin request handling
- **Request Tracking**: Full request lifecycle monitoring

#### RequestParser
**Purpose**: Multi-format request parsing with security validation
**Supported Formats**: JSON, form-data, multipart
**Security Features**:
- IP extraction and validation
- Header sanitization
- Request size limits
- Parameter injection prevention

#### ResponseFormatter
**Purpose**: Consistent response formatting with multiple output types
**Response Types**: success, error, preview, options, schema, health, metrics, pagination
**Features**:
- HATEOAS link generation
- Content size calculation
- Compression support
- Error code standardization

#### ErrorHandler
**Purpose**: Comprehensive error management with recovery strategies
**Error Categories**: validation, processing, system, network, timeout, rate-limit
**Features**:
- 40+ specific error codes
- Automatic recovery strategies
- Error statistics collection
- Severity classification

## Key Algorithms

### 1. Multi-Strategy Corpuscle Selection

```javascript
// Core selection algorithm
async select(params) {
  // 1. Validate & normalize parameters
  const normalizedParams = this.normalizer.normalize(params);
  
  // 2. Check cache
  const cacheKey = this.createCacheKey(normalizedParams);
  const cached = this.getCachedResult(cacheKey);
  if (cached) return cached;
  
  // 3. Build selection criteria
  const criteria = this.criteriaBuilder.buildCriteria(normalizedParams);
  
  // 4. Execute tilt-specific selection
  let corpuscles;
  switch (normalizedParams.tilt.representation) {
    case 'embedding':
      corpuscles = await this.selectByEmbedding(normalizedParams, criteria);
      break;
    case 'keywords':
      corpuscles = await this.selectByKeywords(normalizedParams, criteria);
      break;
    case 'graph':
      corpuscles = await this.selectByGraph(normalizedParams, criteria);
      break;
    case 'temporal':
      corpuscles = await this.selectByTemporal(normalizedParams, criteria);
      break;
  }
  
  // 5. Post-process and score
  const processed = await this.postProcessCorpuscles(corpuscles, normalizedParams, criteria);
  
  // 6. Cache and return
  const result = this.buildSelectionResult(processed, normalizedParams, criteria);
  this.cacheResult(cacheKey, result);
  return result;
}
```

### 2. Cosine Similarity Search

```javascript
// Vector similarity calculation
calculateCosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
```

### 3. Token-Aware Content Chunking

```javascript
// Intelligent chunking with semantic boundaries
async chunk(content, options) {
  const { strategy, chunkSize, tokenCounter, preserveStructure } = options;
  
  switch (strategy) {
    case 'token_aware':
      return this.tokenAwareChunking(content, chunkSize, tokenCounter);
    case 'semantic':
      return this.semanticChunking(content, preserveStructure);
    case 'adaptive':
      return this.adaptiveChunking(content, options);
    case 'hierarchical':
      return this.hierarchicalChunking(content, options);
    default:
      return this.fixedChunking(content, chunkSize);
  }
}
```

### 4. Parameter Hash Generation for Caching

```javascript
// Deterministic parameter hashing
createCacheKey(projectedContent, selectionResult, transformOptions) {
  const keyData = {
    projection: {
      type: projectedContent.representation,
      dataHash: this.hashObject(projectedContent.data)
    },
    selection: {
      corpuscleCount: selectionResult.corpuscles?.length || 0,
      navigationHash: this.hashObject(selectionResult.navigation)
    },
    options: {
      format: transformOptions.format,
      tokenizer: transformOptions.tokenizer,
      maxTokens: transformOptions.maxTokens
    }
  };
  
  return this.hashObject(keyData);
}
```

## Integration Patterns

### 1. Ragno Corpus Integration

ZPT integrates directly with the Ragno knowledge graph system:

```javascript
// Ragno ontology mappings
const ragnoTypes = {
  'entity': ['ragno:Entity', 'ragno:Concept', 'ragno:NamedEntity'],
  'unit': ['ragno:SemanticUnit', 'ragno:Unit', 'ragno:Chunk'],
  'text': ['ragno:TextElement', 'ragno:Text', 'ragno:Document'],
  'community': ['ragno:Community', 'ragno:CommunityCluster'],
  'corpus': ['ragno:Corpus']
};

// SPARQL query generation
buildTypeFilter(zoomLevel) {
  const types = ragnoTypes[zoomLevel];
  if (types.length === 1) {
    return `?uri a ${types[0]} .`;
  }
  const typeUnion = types.map(type => `{ ?uri a ${type} }`).join(' UNION ');
  return `{ ${typeUnion} }`;
}
```

### 2. Semem Memory Management Integration

```javascript
// Integration with MemoryManager
class ZPTMemoryIntegration {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
    this.corpuscleSelector = new CorpuscleSelector(
      memoryManager.ragnoCorpus, 
      {
        sparqlStore: memoryManager.sparqlStore,
        embeddingHandler: memoryManager.embeddingHandler
      }
    );
  }
  
  async navigateAndStore(params, contextId) {
    const result = await this.executeNavigation(params);
    
    // Store navigation result in memory
    await this.memoryManager.store({
      id: `nav_${Date.now()}`,
      prompt: `Navigation: ${JSON.stringify(params)}`,
      response: result.content,
      embedding: await this.embeddingHandler.generateEmbedding(result.content),
      metadata: {
        navigation: result.navigation,
        contextId,
        timestamp: new Date().toISOString()
      }
    });
    
    return result;
  }
}
```

### 3. MCP (Model Context Protocol) Server Integration

```javascript
// ZPT exposed through MCP server
import CorpuscleSelector from '../src/zpt/selection/CorpuscleSelector.js';
import ContentChunker from '../src/zpt/transform/ContentChunker.js';

// MCP server tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "zpt_navigate",
      description: "Navigate Ragno corpus using ZPT parameters",
      inputSchema: {
        type: "object",
        properties: {
          zoom: { type: "string", enum: ["entity", "unit", "text", "community", "corpus"] },
          pan: { type: "object" },
          tilt: { type: "string", enum: ["embedding", "keywords", "graph", "temporal"] },
          transform: { type: "object" }
        }
      }
    },
    {
      name: "zpt_chunk_content",
      description: "Chunk content using ZPT content chunker",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string" },
          strategy: { type: "string" },
          chunkSize: { type: "number" }
        }
      }
    }
  ]
}));
```

### 4. LLM Handler Integration

```javascript
// Integration with existing LLM handlers
class ZPTLLMIntegration {
  constructor(llmHandler, embeddingHandler) {
    this.transformer = new CorpuscleTransformer({
      llmHandler,
      embeddingHandler,
      defaultTokenizer: llmHandler.getTokenizer()
    });
  }
  
  async generateResponse(navigationParams, userPrompt) {
    // 1. Navigate corpus using ZPT
    const navigationResult = await this.navigator.navigate(navigationParams);
    
    // 2. Transform for LLM consumption
    const transformedContent = await this.transformer.transform(
      navigationResult.projection,
      navigationResult.selection,
      { format: 'conversational', maxTokens: 4000 }
    );
    
    // 3. Generate LLM response with context
    const response = await this.llmHandler.generateResponse(
      userPrompt,
      transformedContent.content,
      { model: 'gpt-4', temperature: 0.7 }
    );
    
    return {
      response,
      navigationContext: navigationResult.navigation,
      sources: navigationResult.metadata
    };
  }
}
```

## Configuration and Usage

### 1. REST API Usage Examples

#### Basic Navigation Request
```http
POST /api/navigate
Content-Type: application/json

{
  "zoom": "unit",
  "tilt": "keywords",
  "transform": {
    "maxTokens": 4000,
    "format": "structured"
  }
}
```

#### Advanced Navigation with Filters
```http
POST /api/navigate
Content-Type: application/json

{
  "zoom": "entity",
  "pan": {
    "topic": "machine-learning",
    "temporal": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "entity": ["ai", "neural-networks"]
  },
  "tilt": "embedding",
  "transform": {
    "maxTokens": 8000,
    "format": "json",
    "includeMetadata": true,
    "chunkStrategy": "semantic",
    "tokenizer": "cl100k_base"
  }
}
```

#### Preview Request (Fast Response)
```http
POST /api/navigate/preview
Content-Type: application/json

{
  "zoom": "community",
  "pan": { "topic": "artificial-intelligence" },
  "tilt": "graph"
}
```

### 2. Programmatic Usage

#### Basic Navigation Pipeline
```javascript
import { initializeZPT } from './zpt-init.js';

async function navigateCorpus() {
  const { selector, projector, transformer } = await initializeZPT();
  
  const params = {
    zoom: 'entity',
    pan: { topic: 'semantics' },
    tilt: 'embedding',
    transform: { maxTokens: 4000, format: 'markdown' }
  };
  
  // Execute navigation pipeline
  const selection = await selector.select(params);
  const projection = await projector.project(selection.corpuscles, params.tilt);
  const transformation = await transformer.transform(projection, selection, params.transform);
  
  return transformation.content;
}
```

#### Custom Integration
```javascript
class CustomZPTIntegration {
  constructor(ragnoCorpus, dependencies) {
    this.pipeline = new ZPTNavigationPipeline(ragnoCorpus, dependencies);
  }
  
  async searchAndFormat(query, outputFormat) {
    const params = {
      zoom: 'unit',
      pan: { topic: this.extractTopic(query) },
      tilt: 'embedding',
      transform: { 
        format: outputFormat,
        maxTokens: this.calculateTokenBudget(query)
      }
    };
    
    return await this.pipeline.execute(params);
  }
  
  extractTopic(query) {
    // Custom topic extraction logic
    return query.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
  
  calculateTokenBudget(query) {
    // Dynamic token budget based on query complexity
    return Math.min(8000, query.length * 10);
  }
}
```

### 3. Configuration Files

#### ZPT System Configuration
```json
{
  "zpt": {
    "selection": {
      "maxConcurrentSelections": 5,
      "defaultTimeout": 30000,
      "caching": {
        "enabled": true,
        "ttl": 3600000,
        "maxSize": 1000
      }
    },
    "transformation": {
      "defaultTokenizer": "cl100k_base",
      "defaultFormat": "structured",
      "maxChunkSize": 4000,
      "chunkOverlap": 100
    },
    "api": {
      "rateLimit": {
        "requests": 100,
        "windowMs": 60000
      },
      "cors": {
        "enabled": true,
        "origins": ["*"]
      },
      "timeout": 120000
    }
  }
}
```

#### Zoom Level Configuration
```json
{
  "zoomLevels": {
    "entity": {
      "maxResults": 500,
      "tokenBudget": 30,
      "recommendedTilt": "embedding",
      "selectionStrategy": "entity_ranking"
    },
    "unit": {
      "maxResults": 200,
      "tokenBudget": 80,
      "recommendedTilt": "embedding",
      "selectionStrategy": "semantic_similarity"
    },
    "text": {
      "maxResults": 1000,
      "tokenBudget": 150,
      "recommendedTilt": "keywords",
      "selectionStrategy": "text_retrieval"
    }
  }
}
```

## Performance Considerations

### 1. Caching Strategy

**Multi-Level Caching**:
- **Parameter Level**: Hash-based caching of normalized parameters
- **Selection Level**: Cache corpuscle selection results
- **Transformation Level**: Cache formatted output by content hash
- **Component Level**: Individual component caching (TokenCounter, etc.)

**Cache Management**:
```javascript
// Cache key generation
createCacheKey(params) {
  const keyData = {
    zoom: params.zoom,
    pan: this.hashObject(params.pan),
    tilt: params.tilt,
    transform: this.hashObject(params.transform)
  };
  return this.hashObject(keyData);
}

// TTL-based cache cleanup
cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of this.cache.entries()) {
    if (now - entry.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
    }
  }
}
```

### 2. Parallel Processing

**Concurrent Corpuscle Processing**:
```javascript
async selectCorpuscles(candidates, criteria) {
  const chunks = this.chunkArray(candidates, 10); // Process in batches of 10
  const results = await Promise.all(
    chunks.map(chunk => this.processChunk(chunk, criteria))
  );
  return results.flat();
}
```

**Streaming Response Support**:
```javascript
async streamTransformation(projectionResult, transform) {
  const stream = new TransformationStream();
  
  // Process chunks as they become available
  for await (const chunk of this.transformer.transformChunks(projectionResult)) {
    stream.write(chunk);
  }
  
  stream.end();
  return stream;
}
```

### 3. Memory Management

**Resource Cleanup**:
```javascript
class ZPTResourceManager {
  constructor() {
    this.activeRequests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  cleanup() {
    // Clean expired requests
    const now = Date.now();
    for (const [id, request] of this.activeRequests.entries()) {
      if (now - request.startTime > request.timeout) {
        this.activeRequests.delete(id);
        request.abort();
      }
    }
    
    // Force garbage collection for large objects
    if (global.gc && this.shouldForceGC()) {
      global.gc();
    }
  }
}
```

### 4. Metrics and Monitoring

**Performance Metrics Collection**:
```javascript
class ZPTMetrics {
  constructor() {
    this.metrics = {
      requests: { total: 0, successful: 0, failed: 0 },
      timing: { selection: [], projection: [], transformation: [] },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      errors: new Map()
    };
  }
  
  recordRequest(stage, duration, success) {
    this.metrics.requests.total++;
    this.metrics.requests[success ? 'successful' : 'failed']++;
    this.metrics.timing[stage].push(duration);
    
    // Maintain rolling window
    if (this.metrics.timing[stage].length > 1000) {
      this.metrics.timing[stage] = this.metrics.timing[stage].slice(-500);
    }
  }
  
  getAverageResponseTime() {
    const allTimes = Object.values(this.metrics.timing).flat();
    return allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
  }
}
```

## Development Guide

### 1. Setting Up ZPT Development Environment

```bash
# Install dependencies
npm install

# Configure environment
cp example.env .env
# Edit .env with API keys and endpoints

# Initialize Ragno corpus (if needed)
npm run init-corpus

# Run ZPT examples
node examples/zpt/BasicNavigation.js
```

### 2. Creating Custom ZPT Components

#### Custom Tilt Projector
```javascript
import TiltProjector from '../src/zpt/selection/TiltProjector.js';

class CustomTiltProjector extends TiltProjector {
  async projectCustomFormat(corpuscles, options) {
    return {
      representation: 'custom',
      data: await this.customProjection(corpuscles),
      metadata: {
        algorithm: 'custom-algorithm',
        processingTime: Date.now() - startTime
      }
    };
  }
  
  async customProjection(corpuscles) {
    // Custom projection logic
    return corpuscles.map(corpuscle => ({
      id: corpuscle.uri,
      customScore: this.calculateCustomScore(corpuscle),
      features: this.extractCustomFeatures(corpuscle)
    }));
  }
}
```

#### Custom Content Formatter
```javascript
import PromptFormatter from '../src/zpt/transform/PromptFormatter.js';

class CustomPromptFormatter extends PromptFormatter {
  async formatCustom(projectedContent, navigation, options) {
    const template = this.loadCustomTemplate(options.templateName);
    
    return {
      content: this.applyTemplate(template, {
        data: projectedContent.data,
        navigation,
        timestamp: new Date().toISOString()
      }),
      metadata: {
        format: 'custom',
        template: options.templateName,
        generatedAt: new Date().toISOString()
      }
    };
  }
}
```

### 3. Testing ZPT Components

#### Unit Test Example
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import ParameterValidator from '../src/zpt/parameters/ParameterValidator.js';

describe('ParameterValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new ParameterValidator();
  });
  
  it('should validate basic parameters', () => {
    const params = {
      zoom: 'entity',
      tilt: 'keywords'
    };
    
    const result = validator.validate(params);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should reject invalid zoom level', () => {
    const params = {
      zoom: 'invalid-level',
      tilt: 'keywords'
    };
    
    const result = validator.validate(params);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('zoom');
  });
});
```

#### Integration Test Example
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import ZPTTestHarness from '../tests/helpers/ZPTTestHarness.js';

describe('ZPT Full Pipeline Integration', () => {
  let harness;
  
  beforeEach(async () => {
    harness = new ZPTTestHarness();
    await harness.initialize();
  });
  
  it('should execute complete navigation pipeline', async () => {
    const params = {
      zoom: 'unit',
      pan: { topic: 'test-topic' },
      tilt: 'embedding',
      transform: { maxTokens: 1000, format: 'json' }
    };
    
    const result = await harness.executeNavigation(params);
    
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.metadata.pipeline).toBeDefined();
    expect(result.navigation).toEqual(expect.objectContaining({
      zoom: 'unit',
      tilt: 'embedding'
    }));
  });
});
```

### 4. Extending ZPT for New Use Cases

#### Adding New Zoom Level
```javascript
// 1. Update ZoomLevelMapper
const newZoomMapping = {
  'custom-level': {
    primaryTypes: ['custom:CustomType'],
    secondaryTypes: [],
    granularity: 6,
    scope: 'custom',
    description: 'Custom zoom level description',
    typicalResultCount: 100,
    aggregationLevel: 'custom'
  }
};

// 2. Update ParameterValidator schema
const updatedSchema = {
  zoom: {
    type: 'enum',
    values: [...existingValues, 'custom-level']
  }
};

// 3. Implement custom selection logic
class CustomCorpuscleSelector extends CorpuscleSelector {
  async selectByCustomLevel(params, criteria) {
    // Custom selection implementation
  }
}
```

#### Adding New Tilt Representation
```javascript
// 1. Update TiltProjector
class ExtendedTiltProjector extends TiltProjector {
  async projectNewRepresentation(corpuscles, options) {
    return {
      representation: 'new-representation',
      data: await this.generateNewRepresentation(corpuscles),
      metadata: { algorithm: 'new-algorithm' }
    };
  }
}

// 2. Update validation schema
const updatedTiltSchema = {
  tilt: {
    type: 'enum',
    values: [...existingTilts, 'new-representation']
  }
};
```

This comprehensive analysis provides a complete understanding of the ZPT subsystem's architecture, components, algorithms, and integration patterns. The system demonstrates sophisticated parameter-driven navigation capabilities with robust performance optimization and extensibility features.