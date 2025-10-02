# Context Management

## Overview

Context management in Semem is the process of retrieving, processing, and synthesizing relevant information from various sources to provide accurate, contextually-aware responses to user queries. This system combines semantic search, adaptive threshold management, and intelligent response synthesis to create a comprehensive knowledge retrieval and processing pipeline.

## Architecture Components

### Unified Search System

The system uses a unified search architecture orchestrated through the UnifiedSearchAPI (HTTP) and verb-based command architecture (MCP STDIO). These components coordinate between multiple subsystems to provide intelligent responses that combine personal experience with external knowledge sources.

**Core Responsibilities:**
- Query processing and intent analysis
- Concurrent context retrieval from multiple sources
- Context merging and synthesis
- Response generation using LLM integration
- Performance optimization and caching

### Context Sources

The system operates with two primary context source categories:

#### 1. Local Context (Personal Experience)
- **Memory Manager Integration**: Retrieves interactions from short-term and long-term memory stores
- **SPARQL Document Store**: Searches through ingested documents and knowledge chunks
- **Adaptive Search Engine**: Dynamically adjusts similarity thresholds for optimal retrieval
- **ZPT Navigation**: Applies Zoom, Pan, and Tilt filters to focus search scope

#### 2. Enhancement Context (External Knowledge)
- **Wikidata Integration**: Structured knowledge from collaborative databases
- **Wikipedia Integration**: Encyclopedic information retrieval
- **HyDE Enhancement**: Hypothetical Document Embeddings for improved search
- **Web Search**: Real-time information retrieval (when available)

## Search and Retrieval Process

### Adaptive Search Engine

The system employs an adaptive search mechanism that automatically optimizes retrieval based on query characteristics and result quality:

**Threshold Management:**
- User-defined baseline thresholds via workbench controls
- Dynamic threshold expansion when insufficient results are found
- Multi-pass search with progressively relaxed criteria
- Quality scoring to maintain relevance standards

**Search Strategies:**
1. **Initial Pass**: Uses user-specified or default similarity threshold
2. **Expansion Passes**: Gradually reduces threshold to find more results
3. **Quality Filtering**: Removes low-relevance or system metadata entries
4. **Result Ranking**: Normalizes and ranks results across different source types

### ZPT Navigation Integration

The system integrates with ZPT (Zoom, Pan, Tilt) spatial navigation metaphors:

- **Zoom**: Controls abstraction level (entity, unit, text, community, corpus)
- **Pan**: Applies domain and keyword filters
- **Tilt**: Determines representation style (keywords, embedding, graph, temporal)

These settings influence search scope and result presentation without requiring manual configuration.

## Context Processing Pipeline

### 1. Query Analysis
- Intent extraction and query normalization
- Concept identification using LLM-powered extraction
- Context requirements assessment
- Strategy selection based on available sources

### 2. Concurrent Retrieval
The system performs parallel searches across multiple sources:
- Local context search using adaptive thresholds
- Enhancement context retrieval (when enabled)
- Real-time performance monitoring
- Early termination for performance optimization

### 3. Context Merging
Retrieved contexts are intelligently combined:

**Content Extraction:**
- Raw document content extraction
- Metadata filtering to remove system artifacts
- Content deduplication and relevance ranking
- Source attribution maintenance

**Synthesis Preparation:**
- Personal vs. external content categorization
- Key insight extraction
- Cross-reference identification
- Quality assessment and filtering

### 4. Response Generation

The system supports multiple response generation modes:

#### LLM-Powered Synthesis
When LLM services are available, the system creates comprehensive prompts that:
- Include the user's original question
- Provide relevant context from all sources
- Apply clear instructions for source attribution
- Request direct, contextually-aware responses

#### Template-Based Fallback
When LLM services are unavailable or fail:
- Structured response templates organize content
- Source attribution is maintained automatically
- Fallback responses prioritize information delivery
- Error recovery ensures system reliability

## Context Strategies

The system employs different strategies based on available context:

### Personal Primary
- Emphasizes personal experience and stored documents
- Uses external sources for supplementary information
- Ideal for queries about personal topics or stored knowledge

### Enhancement Primary
- Prioritizes authoritative external sources
- Uses personal context for validation and examples
- Best for factual queries requiring authoritative information

### Balanced Integration
- Equally weights personal and external sources
- Creates comprehensive responses drawing from both
- Default strategy for general knowledge queries

### Single Source Modes
- **Personal Only**: Uses only local context
- **Enhancement Only**: Uses only external sources
- **No Context**: Provides general responses without specific context

## Performance Optimization

### Caching Strategy
- Template compilation caching for faster response generation
- Embedding result caching to reduce computation overhead
- Session-based context caching for related queries
- Intelligent cache invalidation based on content updates

### Resource Management
- Concurrent processing with proper resource limits
- Timeout management for external service calls
- Graceful degradation when services are unavailable
- Memory usage optimization for large document sets

### Quality Assurance
- Result relevance scoring and filtering
- Duplicate content detection and removal
- Source quality assessment
- Response coherence validation

## Error Handling and Resilience

### Service Availability
- Automatic fallback to template-based responses
- Graceful handling of API rate limits
- Service timeout management
- Alternative provider failover

### Data Quality
- Invalid result filtering
- Malformed content handling
- Empty response detection and recovery
- Consistency validation across sources

### User Experience
- Transparent error communication
- Partial result delivery when possible
- Progress indication for long-running operations
- Clear indication of information limitations

## Configuration and Customization

### Threshold Management
Users can control search sensitivity through:
- Workbench slider controls for real-time adjustment
- Per-query threshold specifications
- Default threshold configuration
- Adaptive threshold learning from usage patterns

### Source Preferences
- Enable/disable specific context sources
- Weight adjustments for different source types
- Custom search scope definitions
- Integration with personal knowledge management workflows

### Response Formatting
- Template customization for different output styles
- Source attribution format preferences
- Response length and detail level controls
- Integration with specific application requirements

## Integration Points

### Memory Management
- Seamless integration with MemoryManager for interaction storage
- Support for both in-memory and persistent storage backends
- Automatic memory organization and retrieval optimization
- Context-aware memory archiving and cleanup

### Knowledge Ingestion
- Document processing and chunking integration
- SPARQL endpoint connectivity for knowledge graphs
- Real-time content updates and index maintenance
- Batch processing for large-scale content ingestion

### User Interface Integration
- Workbench controls for real-time threshold adjustment
- Progress indicators for complex query processing
- Interactive result exploration and refinement
- Session state management and history

## Best Practices

### Query Formulation
- Use specific, clear questions for best results
- Include context clues when asking about personal topics
- Specify desired information sources when known
- Break complex queries into focused sub-questions

### System Configuration
- Adjust similarity thresholds based on content diversity
- Enable appropriate enhancement sources for query types
- Configure caching based on usage patterns
- Monitor performance metrics for optimization opportunities

### Content Management
- Maintain clean, well-structured document ingestion
- Regular cleanup of outdated or irrelevant content
- Proper metadata tagging for improved retrieval
- Balanced content distribution across knowledge domains

## Troubleshooting

### Common Issues
- **No Results Found**: Lower similarity threshold, check content availability
- **Generic Responses**: Verify LLM service availability, check context quality
- **Slow Performance**: Review caching configuration, optimize query complexity
- **Inconsistent Results**: Check for content duplicates, verify source quality

### Diagnostic Information
- Context retrieval statistics and timing
- Source availability and response quality metrics
- LLM service health and response characteristics
- Memory usage and performance indicators

The context management system provides a robust, flexible foundation for intelligent information retrieval and synthesis, enabling natural, contextually-aware interactions with personal and external knowledge sources.