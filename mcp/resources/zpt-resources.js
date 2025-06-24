/**
 * ZPT (3-dimensional navigation) MCP resources implementation - Simplified
 * Provides documentation and guidance for ZPT knowledge graph navigation
 */
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { mcpDebugger } from '../lib/debug-utils.js';

// ZPT Resource URIs
const ZPTResourceURI = {
  SCHEMA: 'semem://zpt/schema',
  EXAMPLES: 'semem://zpt/examples', 
  GUIDE: 'semem://zpt/guide',
  PERFORMANCE: 'semem://zpt/performance'
};

/**
 * Generate ZPT parameter schema resource
 */
function generateZPTSchemaResource() {
  return {
    uri: ZPTResourceURI.SCHEMA,
    name: "ZPT Parameter Schema",
    description: "Complete JSON schema for ZPT navigation parameters with validation rules and examples",
    mimeType: "application/json",
    content: JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "ZPT Navigation Parameters",
      "description": "Schema for 3-dimensional knowledge graph navigation using spatial metaphors",
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "minLength": 1,
          "description": "Navigation query for corpus exploration",
          "examples": [
            "artificial intelligence",
            "climate change mitigation strategies",
            "quantum computing applications"
          ]
        },
        "zoom": {
          "type": "string",
          "enum": ["entity", "unit", "text", "community", "corpus"],
          "default": "entity",
          "description": "Level of abstraction for content selection"
        },
        "pan": {
          "type": "object",
          "description": "Content filtering parameters",
          "properties": {
            "topic": { "type": "string", "description": "Topic-based filtering" },
            "temporal": {
              "type": "object",
              "properties": {
                "start": { "type": "string", "format": "date" },
                "end": { "type": "string", "format": "date" }
              }
            },
            "geographic": {
              "type": "object",
              "properties": {
                "bbox": { 
                  "type": "array",
                  "items": { "type": "number" },
                  "minItems": 4,
                  "maxItems": 4
                }
              }
            },
            "entity": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "tilt": {
          "type": "string",
          "enum": ["keywords", "embedding", "graph", "temporal"],
          "default": "keywords",
          "description": "Representation style for content"
        },
        "transform": {
          "type": "object",
          "description": "Output transformation options",
          "properties": {
            "maxTokens": { "type": "number", "min": 100, "max": 16000, "default": 4000 },
            "format": { "type": "string", "enum": ["json", "markdown", "structured", "conversational"] },
            "tokenizer": { "type": "string", "enum": ["cl100k_base", "p50k_base", "claude", "llama"] },
            "chunkStrategy": { "type": "string", "enum": ["semantic", "adaptive", "fixed", "sliding"] },
            "includeMetadata": { "type": "boolean", "default": true }
          }
        }
      },
      "required": ["query"],
      "errorCodes": {
        "ZPT_VALIDATION_ERROR": "Parameter validation failed",
        "ZPT_CORPUS_ERROR": "Corpus access or processing error",
        "ZPT_SELECTION_ERROR": "Content selection failed",
        "ZPT_TRANSFORMATION_ERROR": "Content transformation failed",
        "ZPT_MEMORY_ERROR": "Memory storage failed"
      }
    }, null, 2)
  };
}

/**
 * Generate ZPT examples resource
 */
function generateZPTExamplesResource() {
  return {
    uri: ZPTResourceURI.EXAMPLES,
    name: "ZPT Navigation Examples",
    description: "Comprehensive examples and patterns for ZPT knowledge graph navigation",
    mimeType: "text/markdown",
    content: `# ZPT Navigation Examples

## Basic Navigation Examples

### 1. Simple Entity Exploration
Use entity zoom with keywords tilt for quick factual lookup:
- Query: "artificial intelligence"
- Zoom: "entity" 
- Tilt: "keywords"
- Expected: List of AI-related entities with keyword descriptions
- Response time: ~100ms

### 2. Contextual Understanding
Use unit zoom with embedding tilt for relationship understanding:
- Query: "machine learning algorithms"
- Zoom: "unit"
- Tilt: "embedding"
- Expected: Semantic units showing algorithm relationships
- Response time: ~300ms

### 3. Topic Overview
Use community zoom with graph tilt for topic clusters:
- Query: "climate change"
- Zoom: "community"
- Tilt: "graph"
- Expected: Community clusters with graph relationships
- Response time: ~800ms

## Advanced Filtering Examples

### 4. Temporal Filtering
Navigate with specific time range:
- Query: "renewable energy solutions"
- Pan: temporal filter 2020-2024
- Tilt: "temporal"
- Expected: Recent renewable energy developments

### 5. Entity Filtering
Focus on specific entities:
- Query: "AI research"
- Pan: entities ["OpenAI", "DeepMind", "Anthropic"]
- Expected: AI research by specific companies

### 6. Multi-Parameter Navigation
Complex navigation with multiple filters:
- Query: "biomedical research"
- Zoom: "unit"
- Pan: topic "gene therapy", temporal 2020-2024
- Tilt: "graph"
- Expected: Gene therapy research with relationship mapping

## Performance Optimization

### Fast Navigation Pattern
- Use entity zoom with keywords tilt
- Limit tokens to 1000-2000
- Expected response time: <200ms

### Balanced Analysis Pattern  
- Use unit zoom with embedding tilt
- Set tokens to 3000-4000
- Expected response time: <800ms

### Comprehensive Study Pattern
- Use unit/text zoom with graph tilt
- Set tokens to 6000-8000
- Expected response time: <2000ms

## Integration Workflows

### ZPT + Memory Integration
1. Navigate with ZPT (results auto-stored in memory)
2. Retrieve related memories
3. Generate contextual response

### ZPT + Ragno Integration
1. Use ZPT for intuitive exploration
2. Follow with detailed Ragno analysis
3. Export findings as RDF

## Best Practices

1. Start with preview to understand scope
2. Validate parameters before navigation
3. Use appropriate zoom level for use case
4. Apply pan filters to reduce processing scope
5. Monitor performance and adjust token budgets
`
  };
}

/**
 * Generate ZPT guide resource
 */
function generateZPTGuideResource() {
  return {
    uri: ZPTResourceURI.GUIDE,
    name: "ZPT Navigation Guide",
    description: "Comprehensive guide to ZPT concepts, spatial metaphors, and navigation principles",
    mimeType: "text/markdown",
    content: `# ZPT (3-Dimensional Knowledge Graph Navigation) Guide

## Introduction

ZPT (Zoom, Pan, Tilt) provides intuitive knowledge graph navigation using spatial metaphors borrowed from camera and mapping systems.

## The 3-Dimensional Navigation Model

### Zoom: Level of Abstraction
Controls how detailed or abstract your view is:

- **Entity**: Focus on individual entities and properties
- **Unit**: Balanced view of semantic units with related entities  
- **Text**: Broader view including detailed textual content
- **Community**: Topic-level clusters and domain overviews
- **Corpus**: Highest level patterns across entire knowledge base

### Pan: Content Filtering  
Controls what content is included:

- **Topic Filtering**: Focus on specific subject areas
- **Temporal Filtering**: Limit to specific time periods
- **Geographic Filtering**: Focus on location-specific content
- **Entity Filtering**: Focus on specific entities or organizations

### Tilt: Representation Style
Controls how content is represented:

- **Keywords**: Term-based representation (fastest)
- **Embedding**: Vector-based semantic similarity  
- **Graph**: Relationship-based network representation
- **Temporal**: Time-based sequential representation

## Navigation Strategies

### Exploratory Navigation
1. Start with corpus/community zoom for overview
2. Apply topic or temporal filters to narrow scope
3. Move to unit/entity zoom for details
4. Try different tilts for varied perspectives

### Targeted Research  
1. Start with entity zoom for specific information
2. Use graph tilt to understand connections
3. Move to unit zoom for broader context
4. Cross-reference with text zoom for sources

### Performance-Optimized
1. Use preview tool to estimate scope
2. Start with keywords tilt for rapid exploration
3. Apply focused pan filters
4. Adjust token budgets based on content density

## Integration with Semem

### Memory Integration
- Navigation results automatically stored as memory items
- Historical patterns inform future suggestions
- Bidirectional sync between navigation and memory

### Ragno Integration  
- Direct access to knowledge graph entities
- Optimized SPARQL query generation
- Graph analytics inform recommendations

### Context Management
- ZPT-aware context window optimization
- Navigation metadata preserved in context
- Smart context pruning based on patterns

## Best Practices

### Parameter Design
- Start simple with basic query, entity zoom, keywords tilt
- Iterate gradually, adjusting one dimension at a time
- Use preview before full navigation
- Validate parameters to catch errors early

### Performance Optimization
- Reuse similar navigation patterns for caching
- Start with conservative token limits
- Apply pan filters to reduce scope
- Monitor response times and adjust

### Content Quality
- Use semantic chunking for coherent content
- Include metadata for interpretation context
- Choose appropriate output format for use case
- Combine multiple navigation approaches

## Error Handling

Common issues and solutions:
- Empty query: Provide non-empty query string
- Invalid zoom: Use entity, unit, text, community, or corpus
- Invalid tilt: Use keywords, embedding, graph, or temporal
- Slow response: Try smaller token budgets or simpler tilts
- Low relevance: Try different zoom levels or refine query

---

ZPT makes complex knowledge graphs accessible through intuitive spatial metaphors while maintaining the power needed for serious research and analysis.
`
  };
}

/**
 * Generate ZPT performance resource
 */
function generateZPTPerformanceResource() {
  return {
    uri: ZPTResourceURI.PERFORMANCE,
    name: "ZPT Performance Optimization Guide", 
    description: "Performance optimization strategies, caching patterns, and monitoring for ZPT navigation",
    mimeType: "text/markdown",
    content: `# ZPT Performance & Optimization Guide

## Performance Characteristics

### Baseline Metrics
- Parameter Validation: 1-5ms
- Content Selection: 50-800ms (varies by zoom/pan)
- Tilt Projection: 40-1200ms (varies by tilt style)
- Content Transformation: 80-400ms (varies by token budget)
- Total Navigation: 200-2500ms (all factors combined)

### Performance by Zoom Level
- Entity: ~150ms, 200-800 tokens, high cache benefits
- Unit: ~400ms, 800-2000 tokens, medium cache benefits  
- Text: ~800ms, 1500-4000 tokens, low cache benefits
- Community: ~300ms, 500-1500 tokens, high cache benefits
- Corpus: ~200ms, 200-600 tokens, very high cache benefits

### Performance by Tilt Style
- Keywords: ~80ms, low memory, excellent cache efficiency
- Embedding: ~300ms, medium memory, good cache efficiency
- Graph: ~900ms, high memory, fair cache efficiency
- Temporal: ~400ms, medium memory, good cache efficiency

## Optimization Strategies

### 1. Parameter Optimization

Fast exploration: entity zoom + keywords tilt + 1000 tokens
Balanced analysis: unit zoom + embedding tilt + 3000 tokens  
Detailed study: text zoom + graph tilt + 6000 tokens

### 2. Caching Strategies

Multi-level cache architecture:
- L1 Cache: Parameter validation (5min TTL)
- L2 Cache: Selection results (1hr TTL)
- L3 Cache: Transformation outputs (24hr TTL)

### 3. Token Budget Management

Progressive allocation:
- Preview: 200 tokens for quick overview
- Selection: 1000 tokens for content identification  
- Transformation: 2000+ tokens for final formatting

### 4. Concurrent Processing

Execute multiple selection strategies in parallel
Process content chunks concurrently
Use non-blocking cache operations

## Performance Monitoring

### Key Metrics
- Response time by navigation type
- Cache hit/miss ratios
- Memory usage patterns
- Token utilization efficiency
- Content quality scores

### Performance Thresholds
- Warning: >2000ms response time, <50% cache hit rate
- Critical: >5000ms response time, <30% cache hit rate

## Troubleshooting

### Slow Responses
- Check cache hit rate
- Analyze pan filtering scope
- Review zoom/tilt combination complexity
- Monitor corpus size impact

### High Memory Usage
- Use streaming content processing
- Implement memory-efficient caching
- Allow garbage collection between chunks

### Cache Inefficiency  
- Normalize parameters for better hits
- Use semantic caching for similar queries
- Group similar navigation patterns

## Best Practices

### Development
- Profile performance early
- Design cache keys for maximum reuse
- Use concurrent operations where possible
- Right-size token allocations

### Production
- Monitor key metrics continuously
- Set up automated performance alerts
- Regular performance review and tuning
- Provision resources based on usage patterns

### User Experience
- Show results progressively
- Provide processing status feedback
- Graceful degradation when needed
- Clear guidance on performance trade-offs

---

Effective ZPT performance requires balancing response time, resource usage, and content quality based on actual usage patterns and requirements.
`
  };
}

/**
 * Register ZPT resources with the MCP server
 */
export function registerZPTResources(server) {
  mcpDebugger.info('Registering ZPT resources...');

  const resources = [
    generateZPTSchemaResource(),
    generateZPTExamplesResource(),
    generateZPTGuideResource(),
    generateZPTPerformanceResource()
  ];

  for (const resource of resources) {
    server.resource(
      resource.uri,
      resource.name,
      resource.description,
      resource.mimeType,
      async () => {
        return {
          contents: [{
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: resource.content
          }]
        };
      }
    );
  }

  mcpDebugger.info('ZPT resources registered successfully.');
}

export { ZPTResourceURI };