# ZPT (Zoom-Pan-Tilt) Navigation System

The ZPT navigation system provides a spatial metaphor for exploring knowledge spaces in Semem. It enables users to navigate corpus data at different levels of abstraction (zoom), filter by domains or topics (pan), and choose different analytical perspectives (tilt).

## Core Concepts

### Navigation Parameters

ZPT navigation operates using three primary parameters:

**Zoom**: Controls the level of abstraction for content selection:
- `entity` - Individual concepts and named entities
- `unit` - Semantic units and text passages  
- `text` - Raw text elements and fragments
- `community` - Topic clusters and concept groups
- `corpus` - Entire corpus view
- `micro` - Sub-entity components

**Pan**: Defines filtering and domain constraints:
- `topic` - Specific subject matter or query terms
- `domains` - Subject domain restrictions (e.g., 'ai', 'science')
- `temporal` - Time-based constraints (start/end dates)
- `geographic` - Spatial boundaries (bounding boxes)
- `entity` - Entity-based filtering

**Tilt**: Selects the analytical projection method:
- `keywords` - Keyword-based analysis and matching
- `embedding` - Vector similarity using embeddings
- `graph` - Graph structure and connectivity analysis
- `temporal` - Time-based organization and sequencing

### Ontology Integration

The system uses formal ZPT ontology URIs (`http://purl.org/stuff/zpt/`) instead of string literals:

- Navigation parameters are automatically converted from strings to ontology URIs
- All navigation metadata is stored as RDF triples using SPARQL
- Provenance tracking uses W3C PROV-O for complete audit trails
- Cross-graph queries enable integration with corpus data

## System Architecture

### Core Components

**CorpuscleSelector**: Main orchestrator for parameter-based content selection from Ragno corpus data. Validates parameters, executes selection based on tilt type, and stores navigation metadata.

**ParameterValidator**: Validates navigation parameters against ZPT ontology terms and parameter combination constraints.

**ParameterNormalizer**: Converts raw navigation parameters to standardized internal representation and creates parameter hashes for caching.

**CorpuscleTransformer**: Transforms selected corpuscles into specified output formats while respecting token limits and optimization requirements.

**ZPTDataFactory**: Creates RDF-compliant navigation sessions and views using RDF-Ext, handles ontology URI generation and dataset management.

**NamespaceUtils**: Manages string-to-URI conversion using ZPT ontology mappings and provides namespace resolution services.

### Data Flow

1. **Parameter Processing**: Raw navigation parameters are validated and normalized
2. **Selection Execution**: Content selection based on zoom level and tilt projection
3. **Result Processing**: Selected corpuscles are filtered, ranked, and post-processed
4. **Metadata Storage**: Navigation sessions and views are stored as RDF using SPARQL INSERT
5. **Response Generation**: Results are transformed to requested format with metadata

## Navigation Operations

### Basic Navigation

Navigation begins with parameter specification. The system validates parameters against ontology constraints and normalizes them for processing:

```javascript
const params = {
  query: 'machine learning applications',
  zoom: 'entity',
  pan: { topic: 'artificial intelligence', domains: ['ai', 'tech'] },
  tilt: 'embedding'
};
```

These parameters are converted to formal ontology URIs:
- `zoom: 'entity'` becomes `zpt:EntityLevel`
- `tilt: 'embedding'` becomes `zpt:EmbeddingProjection`
- Domain strings are mapped to domain-specific URIs

### Selection Methods

**Embedding-based Selection**: Uses vector similarity between query embeddings and corpus content. Requires EmbeddingHandler for generating query embeddings and calculating cosine similarity with stored embeddings.

**Keyword Selection**: Performs text-based matching using keyword extraction and frequency analysis. Scores content based on keyword overlap and term frequency.

**Graph Selection**: Leverages graph structure for content selection using connectivity metrics, centrality measures, and relationship analysis.

**Temporal Selection**: Orders content based on temporal metadata such as creation time, modification time, or explicit temporal annotations.

### Cross-Zoom Navigation

The system supports navigation across different abstraction levels within the same session. Users can move from entity-level analysis to unit-level detail or corpus-level overview while maintaining context and session continuity.

Navigation views track zoom level changes and enable analysis of user exploration patterns. This supports optimization of navigation interfaces and understanding of effective knowledge discovery strategies.

### Caching and Performance

The system implements multi-level caching:
- Parameter-based result caching with configurable expiry
- Navigation metadata caching for frequently accessed patterns  
- SPARQL query result caching for performance optimization

Cache keys are generated from normalized parameter representations to ensure consistent cache hits across equivalent navigation requests.

## RDF Storage and Provenance

### Navigation Sessions

Navigation sessions represent user or agent exploration activities. Sessions include:
- Session URI and temporal metadata
- Associated agent information
- Purpose and context description
- PROV-O provenance relationships

### Navigation Views

Navigation views capture specific navigation operations within sessions:
- Query and parameter specifications
- Selected corpuscle collections
- Zoom, pan, and tilt state objects
- Optimization scores and effectiveness metrics

### SPARQL Integration

Navigation metadata is stored using SPARQL INSERT operations in dedicated named graphs. The system generates RDF quads from navigation objects and executes batch INSERT operations for efficiency.

Cross-graph queries enable integration between navigation metadata and corpus content, supporting analysis of navigation patterns and content relationships.

## API Integration

### MCP Tools

The system provides MCP (Model Context Protocol) tools for AI assistant integration:

**zpt_navigate**: Executes full navigation workflows with parameter validation and result transformation.

**zpt_preview**: Provides lightweight navigation previews for parameter exploration.

**zpt_validate_params**: Validates parameter combinations against ontology constraints.

**zpt_get_options**: Returns available navigation options for given contexts.

**zpt_analyze_corpus**: Analyzes corpus structure and navigation readiness.

### Parameter Conversion

MCP tools automatically handle parameter conversion from string-based inputs to formal ontology URIs. This maintains backward compatibility while enabling formal semantic processing.

### Response Formats

Navigation results support multiple output formats:
- JSON structured data
- Markdown formatted text
- Conversational natural language
- Structured data with metadata

## Configuration and Setup

### Required Components

**SPARQL Endpoint**: Required for navigation metadata storage and cross-graph queries. Supports both local Fuseki instances and remote endpoints.

**Embedding Handler**: Required for embedding-based navigation using vector similarity calculations.

**LLM Handler**: Required for concept extraction and response generation in navigation workflows.

### Storage Configuration

Navigation metadata is stored in configurable named graphs. Default graph is `http://purl.org/stuff/navigation` but can be customized per application requirements.

### Performance Tuning

Key configuration parameters:
- Cache expiry times for navigation results
- SPARQL query timeouts for large corpus operations
- Maximum result limits for memory management
- Similarity thresholds for embedding-based selection

## Integration Patterns

### Corpus Integration

ZPT navigation integrates with Ragno corpus data through cross-graph SPARQL queries. Navigation views can reference corpus corpuscles and analyze navigation effectiveness based on content characteristics.

### Memory Integration

Navigation context influences memory retrieval and ranking. Historical navigation patterns can improve embedding relevance and content selection accuracy.

### Workflow Integration

ZPT navigation can be embedded in larger workflows:
- Document processing pipelines
- Knowledge discovery workflows  
- Interactive exploration interfaces
- Automated content analysis systems

## Monitoring and Analytics

### Navigation Analytics

The system tracks navigation patterns and effectiveness:
- Parameter combination frequency analysis
- Cross-zoom navigation pattern identification
- Query complexity and result quality correlation
- Navigation session duration and depth analysis

### Performance Metrics

Key metrics include:
- Navigation operation timing
- Cache hit rates and effectiveness
- SPARQL query performance
- Memory usage and optimization

### Optimization Insights

Analytics enable optimization recommendations:
- Most effective parameter combinations for content types
- Navigation patterns that lead to successful discovery
- Performance bottlenecks and optimization opportunities
- User behavior patterns and interface improvements

## Error Handling and Reliability

### Parameter Validation

Comprehensive validation ensures navigation requests are well-formed:
- Ontology term validation against ZPT vocabulary
- Parameter combination constraint checking
- Range and type validation for numeric parameters
- Required parameter presence verification

### Graceful Degradation

The system maintains functionality under partial service availability:
- Navigation continues with available components when optional services are unavailable
- Demo modes for tools requiring external dependencies
- Fallback selection methods when preferred approaches fail
- Error recovery with alternative navigation strategies

### Resource Management

Proper resource lifecycle management:
- Automatic cleanup of navigation sessions and temporary data
- Connection pooling for SPARQL endpoints
- Memory management for large corpus operations
- Timeout handling for long-running operations

## Future Extensions

### Domain-Specific Vocabularies

The ontology-based approach enables integration of domain-specific navigation vocabularies. Specialized zoom levels, pan domains, and tilt projections can be defined for particular knowledge domains.

### Advanced Analytics

Enhanced navigation analytics could include:
- Machine learning models for navigation optimization
- Predictive navigation suggestions
- Collaborative filtering for navigation recommendations
- Content discovery effectiveness measurement

### Integration Opportunities

The formal semantic foundation enables integration with:
- External knowledge graphs and vocabularies
- Specialized analytical tools and libraries
- Collaborative knowledge exploration platforms
- Educational and research applications

The ZPT navigation system provides a flexible, extensible foundation for intelligent knowledge exploration that combines spatial metaphors with formal semantic technologies.