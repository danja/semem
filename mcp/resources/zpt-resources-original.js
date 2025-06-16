/**
 * ZPT (3-dimensional navigation) MCP resources implementation
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
          "description": "Level of abstraction for content selection",
          "details": {
            "entity": {
              "description": "Individual entities and their direct properties",
              "tokenRange": "200-800",
              "useCase": "Specific factual information about particular entities"
            },
            "unit": {
              "description": "Semantic units containing related entities and relationships",
              "tokenRange": "800-2000", 
              "useCase": "Contextual understanding of entity relationships"
            },
            "text": {
              "description": "Raw text elements and detailed content",
              "tokenRange": "1500-4000",
              "useCase": "Detailed textual information and source material"
            },
            "community": {
              "description": "Community-level aggregations and topic clusters", 
              "tokenRange": "500-1500",
              "useCase": "Topic-level insights and domain overviews"
            },
            "corpus": {
              "description": "Corpus-wide summaries and high-level patterns",
              "tokenRange": "200-600",
              "useCase": "High-level overviews and general patterns"
            }
          }
        },
        "pan": {
          "type": "object",
          "description": "Content filtering parameters for focus control",
          "properties": {
            "topic": {
              "type": "string",
              "description": "Topic-based filtering using semantic similarity",
              "examples": ["machine learning", "renewable energy", "genetic research"]
            },
            "temporal": {
              "type": "object",
              "description": "Time-based content filtering",
              "properties": {
                "start": {
                  "type": "string",
                  "format": "date",
                  "description": "Start date for temporal filtering (ISO 8601)",
                  "examples": ["2020-01-01", "2023-06-15"]
                },
                "end": {
                  "type": "string", 
                  "format": "date",
                  "description": "End date for temporal filtering (ISO 8601)",
                  "examples": ["2024-12-31", "2023-12-15"]
                }
              }
            },
            "geographic": {
              "type": "object",
              "description": "Geographic content filtering",
              "properties": {
                "bbox": {
                  "type": "array",
                  "items": {"type": "number"},
                  "minItems": 4,
                  "maxItems": 4,
                  "description": "Geographic bounding box [minLon, minLat, maxLon, maxLat]",
                  "examples": [[-122.5, 37.2, -121.9, 37.6]]
                }
              }
            },
            "entity": {
              "type": "array",
              "items": {"type": "string"},
              "description": "Specific entities to focus navigation on",
              "examples": [["OpenAI", "DeepMind", "Anthropic"], ["United Nations", "European Union"]]
            }
          }
        },
        "tilt": {
          "type": "string", 
          "enum": ["keywords", "embedding", "graph", "temporal"],
          "default": "keywords",
          "description": "Representation style for content projection",
          "details": {
            "keywords": {
              "description": "Keyword-based content representation with term extraction",
              "performance": "Fast (50-200ms)",
              "useCase": "Quick content overview and term identification"
            },
            "embedding": {
              "description": "Vector embedding-based semantic similarity representation",
              "performance": "Medium (200-500ms)",
              "useCase": "Semantic similarity analysis and content clustering"
            },
            "graph": {
              "description": "Graph connectivity-based relationship representation",
              "performance": "Slow (500-1500ms)",
              "useCase": "Relationship exploration and network analysis"
            },
            "temporal": {
              "description": "Temporal sequence-based chronological representation",
              "performance": "Medium (300-800ms)",
              "useCase": "Timeline analysis and temporal pattern identification"
            }
          }
        },
        "transform": {
          "type": "object",
          "description": "Output transformation and formatting options",
          "properties": {
            "maxTokens": {
              "type": "number",
              "minimum": 100,
              "maximum": 16000,
              "default": 4000,
              "description": "Maximum tokens for output content"
            },
            "format": {
              "type": "string",
              "enum": ["json", "markdown", "structured", "conversational"],
              "default": "json",
              "description": "Output format style",
              "details": {
                "json": "Structured JSON with metadata",
                "markdown": "Human-readable markdown format",
                "structured": "Hierarchical structured format",
                "conversational": "Natural language conversational style"
              }
            },
            "tokenizer": {
              "type": "string",
              "enum": ["cl100k_base", "p50k_base", "claude", "llama"],
              "default": "cl100k_base",
              "description": "Tokenizer for accurate token counting"
            },
            "chunkStrategy": {
              "type": "string",
              "enum": ["semantic", "adaptive", "fixed", "sliding"],
              "default": "semantic",
              "description": "Content chunking strategy",
              "details": {
                "semantic": "Chunk at semantic boundaries for coherence",
                "adaptive": "Dynamically adjust chunk size based on content",
                "fixed": "Fixed-size chunks for consistency",
                "sliding": "Overlapping sliding window chunks"
              }
            },
            "includeMetadata": {
              "type": "boolean",
              "default": true,
              "description": "Include navigation metadata in output"
            }
          }
        }
      },
      "required": ["query"],
      "errorCodes": {
        "ZPT_VALIDATION_ERROR": {
          "description": "Parameter validation failed",
          "resolution": "Check parameter values against schema constraints"
        },
        "ZPT_CORPUS_ERROR": {
          "description": "Corpus access or processing error", 
          "resolution": "Verify corpus availability and accessibility"
        },
        "ZPT_SELECTION_ERROR": {
          "description": "Content selection failed",
          "resolution": "Try different zoom/pan parameters or simpler query"
        },
        "ZPT_TRANSFORMATION_ERROR": {
          "description": "Content transformation failed",
          "resolution": "Reduce token limit or try different format"
        },
        "ZPT_MEMORY_ERROR": {
          "description": "Memory storage failed",
          "resolution": "Check memory system availability (non-critical error)"
        }
      },
      "bestPractices": {
        "parameterCombinations": [
          {
            "scenario": "Quick entity lookup",
            "parameters": {"zoom": "entity", "tilt": "keywords", "transform": {"maxTokens": 1000}}
          },
          {
            "scenario": "Detailed topic exploration", 
            "parameters": {"zoom": "unit", "tilt": "graph", "transform": {"maxTokens": 6000}}
          },
          {
            "scenario": "Timeline analysis",
            "parameters": {"zoom": "text", "tilt": "temporal", "pan": {"temporal": {}}}
          },
          {
            "scenario": "High-level overview",
            "parameters": {"zoom": "corpus", "tilt": "keywords", "transform": {"maxTokens": 2000}}
          }
        ],
        "performance": {
          "fastNavigation": "Use entity zoom with keywords tilt for sub-second responses",
          "detailedAnalysis": "Use unit/text zoom with graph tilt for comprehensive exploration",
          "tokenOptimization": "Start with 2000-4000 tokens, adjust based on content density"
        }
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
\`\`\`json
{
  "query": "artificial intelligence",
  "zoom": "entity", 
  "tilt": "keywords"
}
\`\`\`
**Use case**: Quick factual lookup about AI entities
**Expected output**: List of AI-related entities with keyword descriptions
**Response time**: ~100ms

### 2. Contextual Understanding
\`\`\`json
{
  "query": "machine learning algorithms",
  "zoom": "unit",
  "tilt": "embedding",
  "transform": {
    "maxTokens": 3000,
    "format": "structured"
  }
}
\`\`\`
**Use case**: Understanding relationships between ML algorithms
**Expected output**: Semantic units showing algorithm relationships
**Response time**: ~300ms

### 3. Topic Overview
\`\`\`json
{
  "query": "climate change",
  "zoom": "community",
  "tilt": "graph",
  "pan": {
    "temporal": {
      "start": "2020-01-01",
      "end": "2024-12-31"
    }
  }
}
\`\`\`
**Use case**: Recent climate change research overview
**Expected output**: Community clusters with graph relationships
**Response time**: ~800ms

## Advanced Filtering Examples

### 4. Multi-Parameter Navigation
\`\`\`json
{
  "query": "renewable energy solutions",
  "zoom": "unit",
  "pan": {
    "topic": "solar power",
    "temporal": {
      "start": "2022-01-01"
    },
    "entity": ["Tesla", "SolarCity", "First Solar"]
  },
  "tilt": "temporal",
  "transform": {
    "maxTokens": 5000,
    "format": "conversational",
    "chunkStrategy": "semantic"
  }
}
\`\`\`
**Use case**: Recent solar energy developments by specific companies
**Expected output**: Temporal sequence of solar energy developments
**Response time**: ~1200ms

### 5. Geographic Filtering
\`\`\`json
{
  "query": "urban development projects",
  "zoom": "text",
  "pan": {
    "geographic": {
      "bbox": [-122.5, 37.2, -121.9, 37.6]
    },
    "temporal": {
      "start": "2023-01-01"
    }
  },
  "tilt": "keywords",
  "transform": {
    "maxTokens": 4000,
    "format": "markdown"
  }
}
\`\`\`
**Use case**: Urban development in San Francisco Bay Area
**Expected output**: Text content about local development projects  
**Response time**: ~600ms

## Performance Optimization Examples

### 6. Fast Preview Navigation
\`\`\`json
{
  "query": "quantum computing",
  "zoom": "entity",
  "tilt": "keywords",
  "transform": {
    "maxTokens": 1000,
    "format": "json",
    "includeMetadata": false
  }
}
\`\`\`
**Use case**: Quick preview of quantum computing entities
**Expected output**: Minimal entity list with keywords
**Response time**: ~50ms

### 7. Comprehensive Analysis
\`\`\`json
{
  "query": "biomedical research trends",
  "zoom": "unit",
  "pan": {
    "topic": "gene therapy",
    "temporal": {
      "start": "2020-01-01",
      "end": "2024-12-31"
    }
  },
  "tilt": "graph",
  "transform": {
    "maxTokens": 8000,
    "format": "structured",
    "chunkStrategy": "adaptive",
    "includeMetadata": true
  }
}
\`\`\`
**Use case**: Deep analysis of gene therapy research trends
**Expected output**: Comprehensive structured analysis with metadata
**Response time**: ~2000ms

## Error Handling Examples

### 8. Invalid Parameter Recovery
\`\`\`json
// This will fail validation
{
  "query": "",
  "zoom": "invalid_zoom",
  "tilt": "nonexistent_tilt"
}

// Use zpt_validate_params first:
{
  "params": {
    "query": "",
    "zoom": "invalid_zoom", 
    "tilt": "nonexistent_tilt"
  }
}
// Returns detailed validation errors and suggestions
\`\`\`

### 9. Token Budget Management
\`\`\`json
// Preview first to estimate tokens
{
  "query": "global economic indicators",
  "zoom": "corpus"
}
// Then navigate with appropriate token budget based on preview
\`\`\`

## Workflow Integration Examples

### 10. ZPT + Memory Integration
\`\`\`bash
# 1. Navigate with ZPT
zpt_navigate {
  "query": "AI ethics frameworks",
  "zoom": "unit",
  "tilt": "graph"
}

# 2. Results automatically stored in memory
# 3. Retrieve related memories
semem_retrieve_memories {
  "query": "AI ethics frameworks",
  "threshold": 0.8
}
\`\`\`

### 11. ZPT + Ragno Integration  
\`\`\`bash
# 1. Use ZPT for intuitive navigation
zpt_navigate {
  "query": "neural network architectures",
  "zoom": "entity"
}

# 2. Follow up with detailed Ragno analysis
ragno_search_dual {
  "query": "neural network architectures"
}

# 3. Export findings
ragno_export_rdf {
  "format": "turtle",
  "includeStatistics": true
}
\`\`\`

## Common Navigation Patterns

### Research Discovery Pattern
1. **Preview** → Get overview of available content
2. **Entity Navigation** → Identify key entities
3. **Unit Navigation** → Understand relationships  
4. **Graph Analysis** → Explore connections

### Content Analysis Pattern
1. **Corpus Overview** → Understand domain scope
2. **Community Analysis** → Identify topic clusters
3. **Text Navigation** → Extract detailed content
4. **Temporal Analysis** → Understand evolution

### Performance-Optimized Pattern
1. **Quick Keywords** → Fast initial exploration
2. **Embedding Analysis** → Semantic clustering
3. **Selective Graph** → Targeted relationship analysis
4. **Adaptive Chunking** → Optimal content delivery

## Best Practices

### Parameter Selection
- **Entity zoom**: Best for specific factual queries
- **Unit zoom**: Optimal for understanding context
- **Text zoom**: Use when source material is needed
- **Community zoom**: Good for topic overviews
- **Corpus zoom**: High-level pattern identification

### Performance Guidelines
- Start with small token budgets (1000-2000) for exploration
- Use keywords tilt for fast initial navigation
- Enable caching for repeated navigation patterns
- Consider pan filtering to reduce processing scope

### Error Prevention
- Always validate parameters before navigation
- Use preview to estimate resource requirements
- Set reasonable token limits based on zoom level
- Handle temporal range validation carefully

### Integration Tips
- Combine ZPT with memory storage for persistent exploration
- Use ZPT results to inform Ragno detailed analysis
- Export navigation patterns for reuse
- Monitor performance metrics for optimization
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

## Introduction to ZPT

ZPT (Zoom, Pan, Tilt) is a revolutionary approach to knowledge graph navigation that uses intuitive spatial metaphors borrowed from camera and mapping systems. Instead of complex SPARQL queries or rigid hierarchical browsing, ZPT provides a natural way to explore knowledge spaces using familiar concepts.

## The 3-Dimensional Navigation Model

### Zoom: Level of Abstraction
The **Zoom** dimension controls how detailed or abstract your view of the knowledge graph is. Think of it like a camera zoom lens:

- **Entity** (Telephoto): Focus on individual entities and their immediate properties
- **Unit** (Normal): Balanced view of semantic units containing related entities  
- **Text** (Wide-angle): Broader view including detailed textual content
- **Community** (Ultra-wide): Topic-level clusters and domain overviews
- **Corpus** (Satellite): Highest level patterns across entire knowledge base

#### Zoom Level Selection Guide
| Zoom Level | Use When You Want | Token Range | Processing Time |
|------------|-------------------|-------------|-----------------|
| Entity     | Specific facts about particular things | 200-800 | Fast (50-200ms) |
| Unit       | Context and relationships | 800-2000 | Medium (200-500ms) |
| Text       | Detailed source material | 1500-4000 | Slow (500-1200ms) |
| Community  | Topic overviews | 500-1500 | Medium (300-800ms) |
| Corpus     | High-level patterns | 200-600 | Fast (100-300ms) |

### Pan: Content Filtering  
The **Pan** dimension controls what content is included in your view, like panning a camera to focus on different parts of a scene:

#### Topic Filtering
- **Purpose**: Focus on specific subject areas
- **Example**: When exploring "artificial intelligence", pan to "machine learning" for ML-specific content
- **Implementation**: Semantic similarity filtering using embeddings

#### Temporal Filtering
- **Purpose**: Limit content to specific time periods
- **Example**: Recent research (2020-2024) vs historical context (2000-2010)  
- **Implementation**: Date-based filtering on content timestamps

#### Geographic Filtering
- **Purpose**: Focus on location-specific content
- **Example**: Urban development projects in San Francisco Bay Area
- **Implementation**: Bounding box filtering on geo-tagged content

#### Entity Filtering
- **Purpose**: Focus on specific entities or organizations
- **Example**: AI research by particular companies (OpenAI, DeepMind, Anthropic)
- **Implementation**: Entity-based graph traversal

### Tilt: Representation Style
The **Tilt** dimension controls how the selected content is represented and projected, like tilting a camera to change perspective:

#### Keywords Tilt
- **Style**: Term-based representation with keyword extraction
- **Best for**: Quick overviews, content tagging, terminology identification
- **Performance**: Fastest (50-200ms)
- **Output**: Lists of relevant terms and phrases

#### Embedding Tilt  
- **Style**: Vector-based semantic similarity representation
- **Best for**: Content clustering, similarity analysis, semantic exploration
- **Performance**: Medium (200-500ms)
- **Output**: Semantically grouped content with similarity scores

#### Graph Tilt
- **Style**: Relationship-based network representation
- **Best for**: Understanding connections, network analysis, relationship mapping
- **Performance**: Slowest (500-1500ms)
- **Output**: Graph structures with nodes and edges

#### Temporal Tilt
- **Style**: Time-based sequential representation
- **Best for**: Timeline analysis, evolution tracking, chronological understanding
- **Performance**: Medium (300-800ms)  
- **Output**: Chronologically ordered content with temporal context

## Navigation Strategies

### Exploratory Navigation
1. **Start Broad**: Begin with corpus or community zoom for overview
2. **Pan Focus**: Apply topic or temporal filters to narrow scope
3. **Drill Down**: Move to unit or entity zoom for details
4. **Switch Perspective**: Try different tilts for varied viewpoints

### Targeted Research  
1. **Entity Focus**: Start with entity zoom for specific information
2. **Relationship Mapping**: Use graph tilt to understand connections
3. **Context Building**: Move to unit zoom for broader context
4. **Validation**: Cross-reference with text zoom for source material

### Performance-Optimized
1. **Quick Preview**: Use preview tool to estimate scope
2. **Fast Keywords**: Start with keywords tilt for rapid exploration
3. **Selective Analysis**: Apply focused pan filters to reduce scope
4. **Adaptive Tokens**: Adjust token budgets based on content density

## Advanced Concepts

### Multi-Strategy Selection
ZPT uses multiple content selection strategies simultaneously:
- **Embedding Similarity**: Vector-based content matching
- **Keyword Matching**: Term-based content discovery
- **Graph Connectivity**: Relationship-based traversal
- **Temporal Sequencing**: Time-based content ordering

Results are combined using weighted scoring based on zoom level and parameters.

### Token-Aware Processing
ZPT intelligently manages token budgets through:
- **Importance Scoring**: Prioritize content by relevance
- **Adaptive Chunking**: Split content at semantic boundaries
- **Progressive Loading**: Start with summaries, expand to details
- **Format Optimization**: Choose appropriate output formats

### Caching and Performance
ZPT implements multi-level caching:
- **L1 Cache**: Parameter validation (5-minute TTL)
- **L2 Cache**: Selection results (1-hour TTL) 
- **L3 Cache**: Transformation results (24-hour TTL)

## Integration with Semem Ecosystem

### Memory Integration
- Navigation results automatically stored as memory items
- Historical patterns inform future navigation suggestions
- Bidirectional sync between navigation and memory systems

### Ragno Integration  
- Direct access to knowledge graph entities and relationships
- Optimized SPARQL query generation from navigation parameters
- Graph analytics inform zoom level recommendations

### Context Management
- ZPT-aware context window optimization
- Navigation metadata preserved in context
- Smart context pruning based on navigation patterns

## Error Handling and Troubleshooting

### Common Validation Errors
| Error | Cause | Solution |
|-------|-------|----------|
| MISSING_QUERY | Empty or missing query parameter | Provide non-empty query string |
| INVALID_ZOOM | Unrecognized zoom level | Use: entity, unit, text, community, corpus |
| INVALID_TILT | Unrecognized tilt style | Use: keywords, embedding, graph, temporal |
| INVALID_TEMPORAL_RANGE | Start date after end date | Ensure start < end in temporal filtering |

### Performance Issues
- **Slow Response**: Try smaller token budgets or simpler tilt styles
- **High Memory Usage**: Use more focused pan filtering
- **Cache Misses**: Consistent parameter naming improves cache efficiency
- **Timeout Errors**: Reduce scope with entity filtering or temporal constraints

### Content Quality Issues
- **Low Relevance**: Try different zoom levels or refine query terms
- **Fragmented Results**: Use semantic chunking strategy
- **Missing Context**: Move to higher zoom levels (unit/community)
- **Information Overload**: Apply more specific pan filtering

## Best Practices

### Parameter Design
- **Start Simple**: Begin with basic query, entity zoom, keywords tilt
- **Iterate Gradually**: Adjust one dimension at a time
- **Use Preview**: Always preview before full navigation
- **Validate First**: Use parameter validation to catch errors early

### Performance Optimization
- **Cache Wisely**: Reuse similar navigation patterns
- **Budget Tokens**: Start with conservative token limits
- **Filter Early**: Apply pan filters to reduce processing scope
- **Monitor Metrics**: Track response times and adjust accordingly

### Content Quality
- **Semantic Chunking**: Use semantic boundaries for coherent content
- **Include Metadata**: Navigation context helps with interpretation
- **Format Appropriately**: Choose output format based on use case
- **Cross-Reference**: Combine multiple navigation approaches

### Integration Patterns
- **Navigation → Memory**: Store important discoveries automatically
- **Preview → Navigate**: Use preview to inform navigation parameters
- **ZPT → Ragno**: Use ZPT for intuitive exploration, Ragno for detailed analysis
- **Iterative Refinement**: Use results to refine subsequent navigation

## Future Directions

### Planned Enhancements
- **Custom Tilt Styles**: User-defined representation formats
- **Collaborative Navigation**: Shared navigation sessions
- **Learned Preferences**: Adaptive parameter suggestions
- **Real-time Updates**: Dynamic content refresh during navigation

### Research Areas
- **Multi-Modal Navigation**: Integration with visual and audio content
- **Temporal Prediction**: Anticipating content evolution
- **Cross-Corpus Navigation**: Navigation across multiple knowledge bases
- **Semantic Annotation**: Automated content enhancement during navigation

---

ZPT represents a fundamental shift from query-based to navigation-based knowledge exploration, making complex knowledge graphs accessible through intuitive spatial metaphors while maintaining the power and flexibility needed for serious research and analysis.
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
    content: `# ZPT Performance Optimization Guide

## Overview

ZPT navigation performance depends on several factors including corpus size, parameter complexity, caching efficiency, and system resources. This guide provides strategies for optimizing ZPT performance across different use cases.

## Performance Characteristics

### Baseline Performance Metrics
| Operation | Typical Range | Factors |
|-----------|---------------|---------|
| Parameter Validation | 1-5ms | Schema complexity |
| Content Selection | 50-800ms | Zoom level, pan filters |
| Tilt Projection | 40-1200ms | Tilt style, content size |
| Content Transformation | 80-400ms | Token budget, format |
| Total Navigation | 200-2500ms | All factors combined |

### Performance by Zoom Level
| Zoom Level | Avg Time | Token Range | Cache Benefits |
|------------|----------|-------------|----------------|
| Entity | 150ms | 200-800 | High |
| Unit | 400ms | 800-2000 | Medium |
| Text | 800ms | 1500-4000 | Low |
| Community | 300ms | 500-1500 | High |
| Corpus | 200ms | 200-600 | Very High |

### Performance by Tilt Style
| Tilt Style | Processing Time | Memory Usage | Cache Efficiency |
|------------|----------------|--------------|------------------|
| Keywords | 80ms | Low | Excellent |
| Embedding | 300ms | Medium | Good |
| Graph | 900ms | High | Fair |
| Temporal | 400ms | Medium | Good |

## Optimization Strategies

### 1. Parameter Optimization

#### Zoom Level Selection
\`\`\`json
// Fast exploration
{
  "zoom": "entity",
  "tilt": "keywords",
  "transform": {"maxTokens": 1000}
}

// Balanced performance/detail  
{
  "zoom": "unit", 
  "tilt": "embedding",
  "transform": {"maxTokens": 3000}
}

// Detailed analysis (slower)
{
  "zoom": "text",
  "tilt": "graph", 
  "transform": {"maxTokens": 6000}
}
\`\`\`

#### Pan Filtering for Performance
\`\`\`json
// Effective filtering reduces processing scope
{
  "pan": {
    "temporal": {
      "start": "2023-01-01",  // Narrows time range
      "end": "2024-12-31"
    },
    "entity": ["OpenAI", "Anthropic"],  // Limits entity scope
    "topic": "large language models"    // Focuses semantic search
  }
}
\`\`\`

### 2. Caching Strategies

#### Multi-Level Cache Architecture
```
L1 Cache (In-Memory, 5min TTL)
├── Parameter validation results
├── Schema lookups  
└── Quick entity mappings

L2 Cache (Shared, 1hr TTL)
├── Selection results by zoom/pan
├── Embedding computations
└── Graph traversal results

L3 Cache (Persistent, 24hr TTL)  
├── Transformation outputs
├── Formatted content
└── Token count estimates
```

#### Cache Key Optimization
```javascript
// Effective cache keys for reuse
const cacheKey = {
  selection: \`\${hash(query)}-\${zoom}-\${hash(pan)}\`,
  projection: \`\${selectionKey}-\${tilt}\`,
  transformation: \`\${projectionKey}-\${hash(transform)}\`
};

// Cache hit strategies
- Normalize parameter ordering
- Hash complex objects consistently  
- Use semantic equivalence for queries
- Group similar navigation patterns
```

### 3. Token Budget Management

#### Adaptive Token Allocation
```json
// Progressive token allocation
{
  "phase1": {
    "preview": 200,      // Quick overview
    "validation": 50     // Parameter check
  },
  "phase2": {
    "selection": 1000,   // Content identification
    "ranking": 500       // Relevance scoring
  },
  "phase3": {
    "transformation": 2000, // Final formatting
    "metadata": 250         // Navigation context
  }
}
```

#### Token Optimization by Use Case
```json
// Quick exploration (< 1 second)
{
  "maxTokens": 1000,
  "format": "json",
  "includeMetadata": false
}

// Research analysis (2-5 seconds)
{
  "maxTokens": 4000,
  "format": "structured", 
  "chunkStrategy": "semantic"
}

// Comprehensive study (5-15 seconds)
{
  "maxTokens": 8000,
  "format": "conversational",
  "chunkStrategy": "adaptive",
  "includeMetadata": true
}
```

### 4. Concurrent Processing

#### Parallel Selection Strategies
```javascript
// Execute multiple strategies concurrently
const [
  embeddingResults,
  keywordResults, 
  graphResults,
  temporalResults
] = await Promise.all([
  selectByEmbeddingSimilarity(query, zoom, pan),
  selectByKeywordMatching(query, zoom, pan),
  selectByConnectivity(query, zoom, pan), 
  selectByTemporal(query, zoom, pan)
]);

// Combine with weighted scoring
const combined = combineResults(results, getWeights(zoom));
```

#### Transformation Pipeline Parallelization
```javascript
// Parallel content processing
const chunks = await Promise.all([
  transformChunk(content.slice(0, n/3), tilt),
  transformChunk(content.slice(n/3, 2*n/3), tilt),
  transformChunk(content.slice(2*n/3), tilt)
]);

const finalContent = assembleChunks(chunks);
```

## Performance Monitoring

### Key Metrics to Track

#### Response Time Metrics
```json
{
  "navigationMetrics": {
    "totalTime": 850,           // Total navigation time (ms)
    "selectionTime": 320,       // Content selection time  
    "projectionTime": 180,      // Tilt projection time
    "transformationTime": 290,  // Output transformation time
    "cacheTime": 60            // Cache operation time
  }
}
```

#### Resource Utilization
```json
{
  "resourceMetrics": {
    "memoryUsage": "45MB",      // Peak memory during navigation
    "cpuUtilization": "23%",    // Average CPU usage
    "cacheHitRate": 0.73,       // Cache effectiveness
    "concurrentRequests": 3     // Parallel processing load
  }
}
```

#### Content Quality Metrics
```json
{
  "qualityMetrics": {
    "relevanceScore": 0.85,     // Average content relevance
    "coherenceScore": 0.78,     // Content coherence rating
    "completenessRatio": 0.92,  // Query coverage ratio
    "duplicateRatio": 0.05      // Content duplication ratio
  }
}
```

### Performance Alerts and Thresholds
```json
{
  "performanceThresholds": {
    "responseTime": {
      "warning": 2000,    // ms
      "critical": 5000    // ms
    },
    "cacheHitRate": {
      "warning": 0.5,     // 50%
      "critical": 0.3     // 30%
    },
    "memoryUsage": {
      "warning": 100,     // MB
      "critical": 250     // MB
    }
  }
}
```

## Troubleshooting Performance Issues

### Slow Navigation Responses

#### Diagnosis Steps
1. **Check Cache Hit Rate**: Low cache hits indicate parameter variations
2. **Analyze Pan Filtering**: Broad filters increase processing scope
3. **Review Zoom/Tilt Combination**: Some combinations are inherently slower
4. **Monitor Corpus Size**: Large corpora require more processing time

#### Solutions
```json
// High-performance configuration
{
  "query": "specific search term",
  "zoom": "entity",              // Fastest zoom level
  "pan": {
    "temporal": {"start": "2024-01-01"},  // Narrow time range
    "entity": ["specific-entity"]         // Focused entity set
  },
  "tilt": "keywords",           // Fastest tilt style
  "transform": {
    "maxTokens": 2000,          // Moderate token budget
    "format": "json",           // Fastest format
    "includeMetadata": false    // Reduce overhead
  }
}
```

### High Memory Usage

#### Memory Optimization
```javascript
// Streaming content processing
async function streamingTransformation(content, options) {
  const stream = createTransformStream(options);
  
  for await (const chunk of content) {
    yield stream.transform(chunk);
    // Allow garbage collection between chunks
    if (chunk.id % 100 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

// Memory-efficient caching
const cache = new LRUCache({
  max: 1000,              // Limit cache size
  ttl: 1000 * 60 * 60,   // 1 hour TTL
  allowStale: true,       // Serve stale while refreshing
  updateAgeOnGet: true    // LRU behavior
});
```

### Cache Inefficiency

#### Cache Optimization Strategies
```javascript
// Normalize parameters for better cache hits
function normalizeParams(params) {
  return {
    query: params.query.toLowerCase().trim(),
    zoom: params.zoom || 'entity',
    pan: sortObject(params.pan || {}),
    tilt: params.tilt || 'keywords',
    transform: normalizeTransform(params.transform || {})
  };
}

// Semantic caching for similar queries
function semanticCacheKey(query) {
  const keywords = extractKeywords(query);
  const semanticHash = hashKeywords(keywords.sort());
  return \`semantic:\${semanticHash}\`;
}
```

## Benchmarking and Testing

### Performance Test Suite
```javascript
// Navigation performance tests
const performanceTests = [
  {
    name: "Fast Entity Navigation",
    params: {query: "AI", zoom: "entity", tilt: "keywords"},
    expectedTime: 200,
    expectedTokens: 500
  },
  {
    name: "Complex Graph Analysis", 
    params: {query: "machine learning", zoom: "unit", tilt: "graph"},
    expectedTime: 1500,
    expectedTokens: 3000
  },
  {
    name: "Corpus Overview",
    params: {query: "technology trends", zoom: "corpus", tilt: "temporal"},
    expectedTime: 400,
    expectedTokens: 800
  }
];

// Run benchmark suite
for (const test of performanceTests) {
  const start = Date.now();
  const result = await zpt_navigate(test.params);
  const duration = Date.now() - start;
  
  assert(duration < test.expectedTime, \`\${test.name} too slow\`);
  assert(result.tokenCount < test.expectedTokens, \`\${test.name} too many tokens\`);
}
```

### Load Testing
```javascript
// Concurrent navigation load test
async function loadTest(concurrency = 10, iterations = 100) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const batch = Array(concurrency).fill().map(() => 
      zpt_navigate({
        query: \`test query \${Math.random()}\`,
        zoom: randomZoom(),
        tilt: randomTilt()
      })
    );
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  
  return analyzeLoadTestResults(results);
}
```

## Best Practices Summary

### Development
- **Profile Early**: Measure performance during development
- **Cache Strategically**: Design cache keys for maximum reuse
- **Parallel Processing**: Use concurrent operations where possible
- **Token Budgeting**: Right-size token allocations for use cases

### Production
- **Monitor Continuously**: Track key performance metrics
- **Alert on Degradation**: Set up automated performance alerts
- **Optimize Iteratively**: Regular performance review and tuning
- **Scale Appropriately**: Provision resources based on usage patterns

### User Experience
- **Progressive Loading**: Show results as they become available
- **Feedback Mechanisms**: Indicate processing status to users
- **Graceful Degradation**: Provide reduced functionality if needed
- **Documentation**: Clear guidance on performance trade-offs

---

Effective ZPT performance optimization requires balancing response time, resource usage, and content quality. Start with conservative parameters and progressively optimize based on actual usage patterns and performance measurements.
`
  };
}

/**
 * Register ZPT resources using HTTP version pattern
 */
export function registerZPTResources(server) {
  mcpDebugger.info('Registering ZPT resources...');

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: ZPTResourceURI.SCHEMA,
          name: "ZPT Parameter Schema",
          description: "Complete JSON schema for ZPT navigation parameters with validation rules and examples",
          mimeType: "application/json"
        },
        {
          uri: ZPTResourceURI.EXAMPLES,
          name: "ZPT Navigation Examples", 
          description: "Comprehensive examples and patterns for ZPT knowledge graph navigation",
          mimeType: "text/markdown"
        },
        {
          uri: ZPTResourceURI.GUIDE,
          name: "ZPT Navigation Guide",
          description: "Complete guide to ZPT concepts, spatial metaphors, and navigation principles", 
          mimeType: "text/markdown"
        },
        {
          uri: ZPTResourceURI.PERFORMANCE,
          name: "ZPT Performance Optimization Guide",
          description: "Performance optimization strategies, caching patterns, and monitoring for ZPT navigation",
          mimeType: "text/markdown"
        }
      ]
    };
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      switch (uri) {
        case ZPTResourceURI.SCHEMA:
          return { contents: [generateZPTSchemaResource()] };
          
        case ZPTResourceURI.EXAMPLES:
          return { contents: [generateZPTExamplesResource()] };
          
        case ZPTResourceURI.GUIDE:
          return { contents: [generateZPTGuideResource()] };
          
        case ZPTResourceURI.PERFORMANCE:
          return { contents: [generateZPTPerformanceResource()] };
          
        default:
          throw new Error(\`Unknown ZPT resource: \${uri}\`);
      }
    } catch (error) {
      mcpDebugger.error(\`Failed to read ZPT resource \${uri}:\`, error);
      throw error;
    }
  });

  mcpDebugger.info('ZPT resources registered successfully');
}

export { ZPTResourceURI };