# ZPT (Zoom/Pan/Tilt) Navigation Examples

This directory contains comprehensive examples demonstrating the ZPT (Zoom/Pan/Tilt) parameter-driven navigation system for Ragno corpus exploration. These examples showcase the full capabilities of the ZPT pipeline, from basic navigation concepts to advanced performance optimization.

## ZPT Navigation Overview

ZPT Navigation provides a three-dimensional approach to corpus exploration:

- **🔍 Zoom**: Controls abstraction level (entity → unit → text → community → corpus)
- **🎯 Pan**: Applies domain filtering (topic, entity, temporal, geographic constraints)  
- **📊 Tilt**: Selects representation format (keywords, embeddings, graph, temporal)

The ZPT system transforms these parameters through a sophisticated pipeline that includes selection, projection, transformation, and API delivery with comprehensive error handling and performance optimization.

## Example Categories

### 🌟 Basic Navigation (`BasicNavigation.js`)
**Core ZPT concepts and fundamental usage patterns**

```bash
node examples/zpt/BasicNavigation.js
```

**What it demonstrates:**
- Parameter validation and normalization fundamentals
- Different zoom levels and their scope characteristics
- Various tilt projections and output representations
- Multiple transformation formats (JSON, Markdown, structured)
- Complete end-to-end pipeline execution with error handling

**Key learning outcomes:**
- Understanding ZPT parameter structure and validation
- How zoom levels affect content granularity and scope
- Different tilt representations and their use cases
- Basic transformation pipeline orchestration

### 🎛️ Advanced Filtering (`AdvancedFiltering.js`)
**Sophisticated pan filtering with multi-dimensional constraints**

```bash
node examples/zpt/AdvancedFiltering.js
```

**What it demonstrates:**
- Topic-based semantic filtering with pattern matching and fuzzy search
- Entity-specific targeting with type constraints and property filters
- Temporal filtering with flexible date ranges and relative constraints
- Geographic filtering with spatial constraints (bounding boxes, radius searches)
- Complex multi-dimensional filter combinations and optimization
- Filter performance analysis and selectivity optimization

**Key learning outcomes:**
- Advanced SPARQL query generation for semantic filtering
- Multi-dimensional filter combinations and performance implications
- Geographic and temporal constraint modeling
- Filter optimization strategies for better performance

### 🔄 Transformation Pipeline (`TransformationPipeline.js`)
**LLM-optimized content transformation and token management**

```bash
node examples/zpt/TransformationPipeline.js
```

**What it demonstrates:**
- Multi-tokenizer token counting (GPT, Claude, Llama) with cost estimation
- Intelligent content chunking with semantic boundary detection
- Multiple output formats optimized for different LLM capabilities
- Sophisticated metadata encoding and navigation context preservation
- Complete 6-stage transformation pipeline orchestration
- Performance optimization with caching and streaming

**Key learning outcomes:**
- Token budget management across different LLM providers
- Semantic chunking strategies for optimal content segmentation
- Format selection based on downstream LLM requirements
- Metadata preservation techniques for context continuity

### 🌐 API Endpoints (`APIEndpoints.js`)
**Complete RESTful API demonstration with all endpoints**

```bash
node examples/zpt/APIEndpoints.js
```

**What it demonstrates:**
- Main navigation API (`/api/navigate`) with full pipeline execution
- Preview API (`/api/navigate/preview`) for quick result estimation
- Options API (`/api/navigate/options`) for parameter discovery
- Schema API (`/api/navigate/schema`) for documentation and validation
- Health and metrics APIs for system monitoring and performance analysis
- Comprehensive error handling with recovery strategies
- Rate limiting and concurrent request management

**Key learning outcomes:**
- RESTful API design patterns for complex navigation systems
- Error handling and recovery strategies in production APIs
- Rate limiting and client management techniques
- API documentation and self-discovery mechanisms

### ⚡ Performance Optimization (`PerformanceOptimization.js`)
**Advanced performance optimization and monitoring techniques**

```bash
node examples/zpt/PerformanceOptimization.js
```

**What it demonstrates:**
- Multi-level caching strategies with intelligent invalidation
- Query optimization and SPARQL selectivity analysis
- Memory management and garbage collection optimization
- Parallel processing strategies and load balancing
- Streaming and progressive loading for large datasets
- Comprehensive performance profiling and bottleneck identification

**Key learning outcomes:**
- Cache hierarchy design and optimization strategies
- Database query optimization for semantic queries
- Memory-efficient processing techniques for large datasets
- Parallelization patterns for different workload types

## Architecture Overview

The ZPT Navigation system follows a layered architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PARAMETERS    │───▶│   SELECTION     │───▶│ TRANSFORMATION  │
│  Validation &   │    │  Corpuscle      │    │  Token, Chunk,  │
│  Normalization  │    │  Selection      │    │  Format, Encode │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API LAYER     │    │   PROJECTION    │    │   PERFORMANCE   │
│  REST Endpoints │    │  Tilt-based     │    │  Caching, Opt,  │
│  Error Handling │    │  Representation │    │  Monitoring     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

1. **Parameter System** (`src/zpt/parameters/`)
   - `ParameterValidator.js` - Input validation with comprehensive error messages
   - `ParameterNormalizer.js` - Parameter standardization and defaults
   - `FilterBuilder.js` - SPARQL query generation from parameters
   - `SelectionCriteria.js` - Multi-factor scoring and selection rules

2. **Selection Engine** (`src/zpt/selection/`)
   - `CorpuscleSelector.js` - Main orchestrator for parameter-driven selection
   - `ZoomLevelMapper.js` - Maps zoom levels to specific Ragno element types
   - `PanDomainFilter.js` - Domain-aware filtering with semantic expansion
   - `TiltProjector.js` - Multi-format projection and representation generation

3. **Transformation Pipeline** (`src/zpt/transform/`)
   - `CorpuscleTransformer.js` - 6-stage pipeline orchestrator
   - `TokenCounter.js` - Multi-tokenizer support with cost estimation
   - `ContentChunker.js` - Semantic boundary detection and chunking strategies
   - `PromptFormatter.js` - LLM-optimized output formatting
   - `MetadataEncoder.js` - Navigation context preservation

4. **API Layer** (`src/zpt/api/`)
   - `NavigationEndpoint.js` - RESTful handler with 6 endpoints
   - `RequestParser.js` - Multi-format request parsing and validation
   - `ResponseFormatter.js` - Consistent response formatting with HATEOAS
   - `ErrorHandler.js` - 40+ error codes with recovery strategies

## Prerequisites

### Required Dependencies
- **Node.js 20.11.0+** for ES modules and modern JavaScript features
- **Ragno corpus** with semantic units, entities, and relationships
- **SPARQL endpoint** (Apache Fuseki or compatible) for RDF storage
- **Ollama** with embedding models for vector operations

### Recommended Ollama Models
```bash
# Install required models
ollama pull nomic-embed-text    # For embeddings (1536 dimensions)
ollama pull qwen2:1.5b         # For text generation and analysis
```

### Environment Configuration
Copy and configure the environment file:
```bash
cp example.env .env
# Edit .env with your configuration:
# - OLLAMA_ENDPOINT=http://localhost:11434
# - SPARQL_ENDPOINT=http://localhost:3030/dataset
# - CLAUDE_API_KEY=your-key (if using Claude)
```

## Usage Patterns

### Basic Navigation Request
```javascript
const navigationRequest = {
  zoom: 'unit',                    // Semantic unit level
  tilt: 'keywords',               // Keyword extraction
  transform: {
    maxTokens: 4000,
    format: 'structured'
  }
}
```

### Advanced Filtered Navigation
```javascript
const advancedRequest = {
  zoom: 'entity',
  pan: {
    topic: {
      value: 'machine-learning',
      pattern: 'semantic',
      expandSynonyms: true
    },
    temporal: {
      start: '2023-01-01',
      end: '2023-12-31'
    },
    geographic: {
      bbox: {
        minLon: -122.5, minLat: 37.2,
        maxLon: -121.9, maxLat: 37.6
      }
    }
  },
  tilt: 'embedding',
  transform: {
    maxTokens: 8000,
    format: 'markdown',
    chunkStrategy: 'semantic',
    includeMetadata: true
  }
}
```

### API Integration Example
```javascript
// Using the NavigationEndpoint
const response = await fetch('/api/navigate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(navigationRequest)
})

const result = await response.json()
if (result.success) {
  console.log('Navigation completed:', result.content)
  console.log('Processing time:', result.metadata.pipeline.totalTime)
}
```

## Performance Considerations

### Optimization Strategies
1. **Parameter Selectivity**: Use specific filters to reduce result sets
2. **Caching**: Leverage multi-level caching for repeated requests
3. **Streaming**: Use progressive loading for large result sets
4. **Index Optimization**: Ensure proper indexing for filter dimensions
5. **Parallel Processing**: Utilize concurrent execution for independent operations

### Monitoring and Metrics
- Response time percentiles (P50, P95, P99)
- Cache hit rates across different cache levels
- Memory utilization and garbage collection efficiency
- Query selectivity and index usage statistics
- Error rates and recovery success rates

## Common Use Cases

### 🔬 Research and Discovery
- **Academic Research**: Navigate scientific papers and publications
- **Technology Trends**: Explore emerging technologies and innovations
- **Market Analysis**: Analyze industry trends and competitive landscapes

### 📊 Content Analysis
- **Document Classification**: Categorize and organize large document collections
- **Semantic Search**: Find conceptually related content across domains
- **Knowledge Extraction**: Extract structured knowledge from unstructured text

### 🤖 AI and Machine Learning
- **Training Data Curation**: Select and organize training datasets
- **Model Evaluation**: Analyze model performance across different domains
- **Feature Engineering**: Extract relevant features for ML pipelines

### 🏢 Enterprise Applications
- **Knowledge Management**: Organize and retrieve corporate knowledge
- **Customer Support**: Intelligent content recommendation for support teams
- **Business Intelligence**: Navigate business data and generate insights

## Troubleshooting

### Common Issues and Solutions

#### Validation Errors
```javascript
// Error: Invalid zoom level
// Solution: Use valid zoom levels
const validZooms = ['entity', 'unit', 'text', 'community', 'corpus']
```

#### Performance Issues
```javascript
// Slow queries with broad filters
// Solution: Add more selective constraints
const optimizedPan = {
  topic: { value: 'specific-topic', pattern: 'exact' },  // More specific
  temporal: { relative: 'last-month' }                   // Narrower timeframe
}
```

#### Memory Issues
```javascript
// Large result sets consuming too much memory
// Solution: Use streaming or chunking
const streamingTransform = {
  maxTokens: 4000,
  chunkStrategy: 'semantic',
  streamResults: true
}
```

### Debug Information
Most examples include detailed logging and diagnostic information:
- Parameter validation details and error messages
- Performance timing for each pipeline stage
- Cache hit/miss statistics and optimization suggestions
- Memory usage patterns and garbage collection metrics
- Query execution plans and selectivity analysis

## Integration Examples

### With Existing Semem Components
```javascript
import MemoryManager from '../src/MemoryManager.js'
import NavigationEndpoint from '../src/zpt/api/NavigationEndpoint.js'

// Integrate ZPT with memory management
const memoryManager = new MemoryManager(config)
const navigationEndpoint = new NavigationEndpoint()

navigationEndpoint.initialize({
  ragnoCorpus: memoryManager.ragnoCorpus,
  sparqlStore: memoryManager.store,
  embeddingHandler: memoryManager.embeddingHandler,
  llmHandler: memoryManager.llmHandler
})
```

### With External APIs
```javascript
// Custom integration with external search APIs
class CustomCorpusAdapter {
  async search(parameters) {
    const zptRequest = this.convertToZPT(parameters)
    return await this.navigationEndpoint.handleNavigate(zptRequest)
  }
}
```

## Contributing

When adding new ZPT examples:

1. **Follow the established pattern**: Each example should be self-contained with proper setup and cleanup
2. **Include comprehensive logging**: Show parameter processing, performance metrics, and results
3. **Demonstrate realistic scenarios**: Use practical use cases and realistic data sizes
4. **Document key concepts**: Explain the ZPT principles being demonstrated
5. **Handle errors gracefully**: Show proper error handling and recovery patterns

### Example Template
```javascript
/**
 * YourZPTExample.js - Brief Description
 * 
 * This example demonstrates [specific ZPT concept]:
 * 1. [First concept]
 * 2. [Second concept]
 * 
 * Prerequisites: [List requirements]
 */

import dotenv from 'dotenv'
dotenv.config()

import { logger } from '../../src/Utils.js'
// ... other imports

async function runYourZPTExample() {
  try {
    // Initialize components
    // Demonstrate concepts
    // Show results and analysis
    
    logger.info('✅ Example completed successfully!')
  } catch (error) {
    logger.error('Example failed:', error.message)
  } finally {
    // Cleanup
  }
}

runYourZPTExample()
```

## Advanced Topics

### Custom Tilt Projectors
Implement custom representation formats by extending the TiltProjector:

```javascript
class CustomTiltProjector extends TiltProjector {
  async projectCustomFormat(corpuscles, options) {
    // Custom projection logic
    return {
      representation: 'custom',
      data: transformedData,
      metadata: projectionMetadata
    }
  }
}
```

### Custom Filter Strategies
Create domain-specific filters by extending PanDomainFilter:

```javascript
class DomainSpecificFilter extends PanDomainFilter {
  async applyDomainLogic(parameters, context) {
    // Custom filtering logic
    return enhancedParameters
  }
}
```

### Performance Profiling
Enable detailed profiling for optimization:

```javascript
const performanceMonitor = new PerformanceMonitor({
  enableProfiling: true,
  enableMemoryTracking: true,
  profileResolution: 'high'
})
```

## Future Enhancements

The ZPT examples demonstrate current capabilities and provide foundation for:

- **Machine Learning Integration**: Custom scoring models for corpuscle selection
- **Real-time Streaming**: Live corpus updates and incremental processing
- **Federated Search**: Multi-corpus navigation and cross-domain exploration
- **Visualization**: Interactive corpus exploration and navigation interfaces
- **AI Agents**: Autonomous navigation for intelligent content discovery

For the latest updates and roadmap, see the main [Semem documentation](../README.md).