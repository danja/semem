# ZPT (Zoom-Pan-Tilt) Navigation System

The ZPT navigation system provides a spatial metaphor for exploring knowledge spaces in Semem. It enables users to navigate corpus data at different levels of abstraction (zoom), filter by domains or topics (pan), and choose different analytical perspectives (tilt).

## Core Concepts

### Navigation Parameters

ZPT navigation operates using three primary parameters:

**Zoom**: Controls the level of abstraction for content selection:
- `entity` - Individual entities and stored interactions (default)
- `unit` - Semantic units and text passages  
- `text` - Raw text elements and fragments
- `community` - Topic clusters and concept groups
- `corpus` - Entire corpus view

**Pan**: Defines filtering and domain constraints:
- `domains` - Subject domain filters (comma-separated: "ai, science, technology")
- `keywords` - Keyword filters (comma-separated: "machine learning, neural")
- `concepts` - Concept-based filters using extracted concept labels
- Currently supports domain, keyword, and concept filtering through the workbench UI

**Tilt**: Selects the analytical projection method:
- `keywords` - Keyword-based analysis and matching (default)
- `embedding` - Vector similarity using embeddings
- `graph` - Graph structure and connectivity analysis  
- `temporal` - Time-based organization and sequencing
- `concept` - Concept-based analysis using RDF concept extraction
- `memory` - Memory-based perspective

### Ontology Integration

The system uses formal ZPT ontology URIs (`http://purl.org/stuff/zpt/`) instead of string literals:

- Navigation parameters are automatically converted from strings to ontology URIs
- All navigation metadata is stored as RDF triples using SPARQL
- Provenance tracking uses W3C PROV-O for complete audit trails
- Cross-graph queries enable integration with corpus data

## Workbench Integration

### Navigate Column in Workbench UI

The ZPT system is integrated into the Semantic Memory Workbench through a dedicated "Navigate" column that provides interactive controls for all three navigation dimensions.

#### Current ZPT State Display
At the top of the Navigate column, the current ZPT state is shown in the format:
```
ZPT: entity / all / keywords
```
This displays your current zoom level, pan filters, and tilt perspective.

#### Interactive Controls

**Zoom Controls (🔍 Abstraction Level)**:
- **Entity** (default): Shows individual stored interactions and entities from your knowledge base
- **Unit**: Displays semantic units and text passages
- **Text**: Shows raw text elements and fragments  
- **Community**: Displays topic clusters and concept groups
- **Corpus**: Shows entire corpus view

**Similarity Threshold Slider (📊)**:
- Range: 0.0 (Broad) to 1.0 (Precise)
- Default: 0.3
- Controls how similar content must be to be included in results
- Lower values = more results, potentially less relevant
- Higher values = fewer results, more precisely matched

**Pan Controls (🎯 Domain Filters)**:
- **Domains**: Enter comma-separated domain filters (e.g., "ai, science, technology")
- **Keywords**: Enter comma-separated keyword filters (e.g., "machine learning, neural")
- Changes apply automatically with 500ms debounce

**Tilt Controls (👁️ View Style)**:
- **Keywords** (default): Keyword-based analysis and matching
- **Embedding**: Vector similarity using embeddings
- **Graph**: Graph structure and connectivity analysis
- **Temporal**: Time-based organization and sequencing
- **Concept**: Concept-based analysis using RDF concept extraction  
- **Memory**: Memory-based perspective

#### Navigation Execution

Click the **"Execute Navigation"** button (🧭) to run the ZPT navigation with your current settings. Results appear in the navigation results area showing:

- **Current Perspective**: Summary of active zoom/pan/tilt settings
- **Navigation Results**: Content matching your ZPT parameters
- **Result Metadata**: Count of items found, similarity scores, etc.

### Usage Tips

**Getting Started**:
1. Start with default settings (entity/keywords) to see your stored content
2. Use the similarity threshold to fine-tune result relevance
3. Add domain or keyword filters to narrow results
4. Switch tilt modes to see different analytical perspectives

**Common Workflows**:
- **Broad Exploration**: Use corpus zoom with low similarity threshold
- **Focused Search**: Use entity zoom with high similarity threshold and specific keywords
- **Conceptual Analysis**: Use concept tilt with medium similarity threshold for RDF-based concept extraction
- **Semantic Analysis**: Use embedding tilt with medium similarity threshold for vector-based similarity
- **Topic Discovery**: Use community zoom with keyword filters
- **Concept Discovery**: Use concept tilt with entity zoom to extract and analyze conceptual relationships

**Performance Optimization**:
- Start with higher similarity thresholds and lower them if needed
- Use specific domain/keyword filters to reduce search space
- Entity and unit zoom levels are generally faster than community/corpus

### Troubleshooting Common Issues

**No Results Found**:
- Lower the similarity threshold (try 0.1-0.2 for broad exploration)
- Remove domain/keyword filters to see all available content  
- Switch to entity zoom level to see stored interactions
- Check that you have content in your knowledge base using the Ask or Tell verbs first

**Too Many Results**:
- Increase similarity threshold (try 0.6-0.8 for precision)
- Add specific domain or keyword filters
- Use unit or text zoom levels for more granular content

**Slow Navigation**:
- Increase similarity threshold to reduce result set size
- Add pan filters to limit search space
- Use entity/unit zoom instead of community/corpus
- Check SPARQL endpoint performance

**Unexpected Results**:
- Verify your pan filters are correctly formatted (comma-separated)
- Try different tilt modes (embedding vs keywords) for different perspectives
- Check the Current Perspective display to confirm your settings
- Use the Inspect verb to examine available content types

### Advanced Usage Patterns

**Content Discovery Workflow**:
1. Start with corpus zoom + low threshold to understand available content
2. Switch to community zoom to identify topic clusters  
3. Drill down with entity zoom + specific filters
4. Use unit/text zoom for detailed content examination

**Comparative Analysis**:
1. Set specific domain filters (e.g., "machine learning")
2. Compare results across different tilt modes
3. Adjust similarity thresholds to find optimal balance
4. Use temporal tilt to see evolution of topics over time

**Quality Control**:
1. Use high similarity thresholds (0.7+) with entity zoom
2. Apply specific keyword filters for precision
3. Review results using embedding tilt for semantic coherence
4. Cross-reference with Ask verb for validation

## System Architecture

### Core Components

**CorpuscleSelector**: Main orchestrator for parameter-based content selection. Queries SPARQL store for entities matching zoom level (entities, interactions, etc.) and applies pan filtering.

**FilterBuilder**: Builds SPARQL queries from ZPT parameters. Handles union queries to search both `ragno:Entity` and `semem:Interaction` types for comprehensive results.

**CorpuscleTransformer**: Transforms selected corpuscles into display formats, handling token limits and content chunking.

**ParameterValidator**: Validates navigation parameters against supported values and combinations.

**ParameterNormalizer**: Converts string parameters to standardized internal representation.

### Data Flow

1. **UI Interaction**: User adjusts zoom, pan, and tilt controls in workbench Navigate column
2. **Parameter Collection**: System collects current ZPT state and user query
3. **SPARQL Query Building**: FilterBuilder creates appropriate SPARQL queries based on zoom level
4. **Content Selection**: CorpuscleSelector executes queries against SPARQL store
5. **Result Processing**: Selected content is filtered by similarity threshold and pan criteria  
6. **Content Transformation**: Results are formatted for display in workbench UI
7. **UI Update**: Navigation results and current perspective are updated

### Current Data Sources

The ZPT system currently queries:
- **semem:Interaction** entities (stored via `/tell` endpoint)
- **ragno:Entity** entities (from Ragno corpus processing)
- **ragno:Concept** entities (extracted via concept tilt functionality)
- **Concept relationships** stored as RDF triples with confidence scores
- **Embeddings** for similarity-based navigation
- **Metadata** for filtering and ranking

## Navigation Operations

### Basic Navigation

Navigation in the workbench starts with the Navigate column interface. The default query is "Navigate knowledge space" and users control perspective through the ZPT controls:

**Example Navigation Flow**:
1. Set zoom level to "entity" (default)
2. Add domain filters: "ai, machine learning" 
3. Set tilt to "embedding" for semantic similarity
4. Adjust similarity threshold to 0.5 for more precise matching
5. Click "Execute Navigation" to run the search

**API Usage** (for programmatic access):
```javascript
// Standard navigation with concept filtering
const result = await apiService.zptNavigate({
  query: "machine learning applications",
  zoom: "entity",
  pan: { 
    domains: "ai, tech", 
    keywords: "neural, algorithm",
    concepts: "machine learning, artificial intelligence"
  },
  tilt: "concept"
});

// Concept extraction and storage
const conceptResult = await apiService.zptNavigate({
  query: "Extract concepts from philosophical texts",
  zoom: "entity",
  pan: { domains: "philosophy" },
  tilt: "concept"  // Will extract and store concepts as ragno:Concept entities
});
```

### Zoom Level Behavior

Each zoom level queries different types of content from the SPARQL store:

**Entity Level** (Default):
- Queries both `ragno:Entity` and `semem:Interaction` types
- Includes stored interactions from `/tell` operations  
- Includes entities extracted from corpus processing
- Returns: URI, label, type, prefLabel, embedding, metadata
- Best for: Exploring specific concepts and stored knowledge

**Unit Level**:
- Queries `ragno:SemanticUnit` entities
- Focuses on semantic units and text passages
- Returns structured text segments with metadata
- Best for: Analyzing semantic chunks and passages

**Text Level**: 
- Queries `ragno:TextElement` entities
- Shows raw text fragments and elements
- Returns lowest-level text content
- Best for: Examining source text and detailed content

**Community Level**:
- Queries `ragno:Community` entities  
- Shows topic clusters and concept groups
- Returns community metadata and member relations
- Best for: Topic-based exploration and clustering analysis

**Corpus Level**:
- Queries `ragno:Corpus` entities
- Provides corpus-wide view and statistics
- Returns high-level corpus metadata
- Best for: Understanding overall content structure

### Selection Methods

**Keywords Tilt** (Default): Text-based matching using keyword extraction and frequency analysis. Scores content based on keyword overlap and term frequency.

**Embedding Tilt**: Vector similarity using embeddings. Generates query embeddings and calculates cosine similarity with stored content embeddings.

**Graph Tilt**: Graph structure analysis using connectivity metrics, centrality measures, and relationship analysis.

**Temporal Tilt**: Time-based organization using creation time, modification time, or temporal annotations.

**Concept Tilt**: RDF-based concept extraction and analysis using the ragno vocabulary. Extracts concepts from content, builds conceptual relationships, stores them as `ragno:Concept` entities in SPARQL, and provides concept-based navigation with confidence scoring and category organization.

**Memory Tilt**: Memory-based perspective incorporating relevance scoring and memory decay factors.

### Concept-Based Navigation

The ZPT system includes comprehensive RDF-based concept functionality that enables conceptual analysis and navigation:

**Concept Extraction**: Automatically extracts concepts from text content using LLM-based analysis and stores them as `ragno:Concept` entities in the SPARQL store.

**Concept Storage**: Concepts are stored with full RDF metadata including:
- **Labels and URIs**: Standardized concept identification using `http://purl.org/stuff/ragno/concept/` namespace
- **Confidence Scores**: Extraction confidence values for quality assessment
- **Categories**: Concept categorization (Philosophy, Science, Technology, etc.)  
- **Relationships**: Conceptual relationships between related concepts
- **Provenance**: Source entity tracking and temporal metadata

**Concept Filtering**: Advanced pan filtering strategies using concept data:
- **Direct Filtering**: Match corpuscles containing specific concept labels
- **Categorical Filtering**: Filter by concept categories (e.g., "Philosophy", "Science")
- **Relational Filtering**: Include content related to target concepts through relationships
- **Similarity Filtering**: Use semantic similarity between concepts with configurable thresholds

**Concept Tilt Projection**: When using concept tilt, the system:
1. Extracts concepts from selected corpuscles using LLM analysis
2. Builds concept maps with relationships and confidence scores
3. Stores concepts as RDF entities in SPARQL with full metadata
4. Returns structured concept data including statistics and categorization

**API Methods**: Programmatic concept access through SPARQLStore:
- `storeConcepts(concepts, sourceEntityUri)` - Store extracted concepts as RDF entities
- `storeConceptRelationships(relationships)` - Store conceptual relationships
- `queryConceptsByFilter(filters)` - Query concepts by category, confidence, or relationships

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

### HTTP Endpoints

**POST /zpt/navigate** - Main navigation endpoint used by workbench
```json
{
  "query": "Navigate knowledge space",
  "zoom": "entity", 
  "pan": {"domains": "ai, tech", "keywords": "neural", "concepts": "machine learning, neural networks"},
  "tilt": "concept"
}
```

**Concept-Specific Endpoints**:
- **POST /concepts/extract** - Extract concepts from text content
- **POST /concepts/store** - Store concepts as RDF entities in SPARQL
- **GET /concepts/query** - Query concepts by filters (category, confidence, etc.)

### MCP Tools (for AI Assistant Integration)

The system provides MCP (Model Context Protocol) tools accessible via the MCP server:

**zpt_preview** - Provides lightweight navigation previews for parameter exploration
**zpt_validate_params** - Validates parameter combinations against supported values  
**zpt_get_options** - Returns available navigation options for given contexts
**zpt_analyze_corpus** - Analyzes corpus structure and navigation readiness

### Workbench Integration

The Navigate column in the workbench provides the primary user interface:
- Interactive ZPT controls with real-time state updates
- Visual feedback for current zoom/pan/tilt settings
- Results displayed in structured format with metadata
- Integration with other workbench verbs (Tell, Ask, Augment)

### Response Formats

Navigation results include:
```json
{
  "success": true,
  "results": [...],
  "metadata": {
    "zoom": "entity",
    "pan": {"domains": "ai"},
    "tilt": "embedding", 
    "resultCount": 42,
    "processingTime": "245ms"
  }
}
```

## Testing and Validation

### Concept Integration Test Suite

The ZPT system includes comprehensive testing for concept functionality:

**Unit Tests**:
- `tests/unit/zpt/concept-tilt-projector.test.js` - Tests concept tilt projection functionality
- `tests/unit/zpt/concept-filtering-search.test.js` - Tests concept-based filtering strategies  
- `tests/unit/stores/rdf-concept-storage.test.js` - Tests concept storage in SPARQLStore

**Integration Tests**: Run with `INTEGRATION_TESTS=true` to test against live SPARQL endpoints:
- Live concept extraction and storage operations
- Performance testing with batch concept processing
- Real-world concept filtering scenarios

**Test Execution**:
```bash
# Run unit tests only (fast, mocked dependencies)
npx vitest run tests/unit/zpt/concept-*.test.js tests/unit/stores/rdf-concept-storage.test.js

# Run integration tests (requires live SPARQL store at localhost:3030)
INTEGRATION_TESTS=true npx vitest run tests/unit/zpt/concept-*.test.js tests/unit/stores/rdf-concept-storage.test.js
```

**Test Coverage**: The test suite validates concept extraction, RDF storage, filtering strategies, URI generation, relationship building, and error handling.

## Configuration and Setup

### Required Components

**SPARQL Endpoint**: Required for navigation metadata storage, concept storage as RDF entities, and cross-graph queries. Supports both local Fuseki instances and remote endpoints.

**Embedding Handler**: Required for embedding-based navigation using vector similarity calculations.

**LLM Handler**: Required for concept extraction, response generation, and concept tilt functionality. Must support concept extraction from text content.

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