# MCP Tools Reference

This document lists all the tools supported by the Semem MCP (Model Context Protocol) server. These tools enable AI agents to interact with the semantic memory system through standardized interfaces.

## ✅ Tool Architecture Refactored

**Update:** The MCP tool architecture has been refactored and consolidated:

1. **Core Tools** (7 essential tools) - Implemented in `src/mcp/tools/core/`
2. **Unified Router** - Single tool routing system in `src/mcp/server/handlers/tool-router.js`
3. **Module System** - Specialized tools organized in `src/mcp/tools/modules/`
4. **Deprecated Tools** - Legacy tools automatically redirected to core equivalents

**Benefits:** Eliminated redundancy, simplified maintenance, clear separation of concerns, and consistent tool patterns.

## Simple Verbs

Core semantic memory operations following natural language patterns.

### tell
**Tool Name:** `tell`
**Description:** Store information in semantic memory
**Parameters:**
- `content` (string, required): Information to store
- `type` (enum, optional): Type of content ('interaction', 'document', 'concept'), default: 'interaction'
- `metadata` (object, optional): Additional metadata
- `lazy` (boolean, optional): Enable lazy processing, default: false

### ask
**Tool Name:** `ask`
**Description:** Query semantic memory for information
**Parameters:**
- `question` (string, required): Question to ask
- `mode` (enum, optional): Query mode ('basic', 'standard', 'comprehensive'), default: 'standard'
- `useContext` (boolean, optional): Use contextual search, default: true
- `useHyDE` (boolean, optional): Use Hypothetical Document Embeddings, default: false
- `useWikipedia` (boolean, optional): Include Wikipedia search, default: false
- `useWikidata` (boolean, optional): Include Wikidata search, default: false
- `useWebSearch` (boolean, optional): Include web search, default: false

### augment
**Tool Name:** `augment`
**Description:** Enhance stored information with additional processing
**Parameters:**
- `target` (string, optional): Target to augment, default: 'all'
- `operation` (enum, optional): Type of operation ('auto', 'concepts', 'attributes', 'relationships', 'process_lazy', 'chunk_documents', 'extract_concepts', 'generate_embedding', 'analyze_text', 'concept_embeddings'), default: 'auto'
- `options` (object, optional): Configuration options for chunking, concept extraction, and augmentation

## ZPT Navigation Tools

Spatial metaphor navigation through knowledge graphs using Zoom/Pan/Tilt operations.

### zoom
**Tool Name:** `zoom`
**Description:** Change the granularity level of view
**Parameters:**
- `level` (enum): Zoom level ('entity', 'concept', 'document', 'community'), default: 'entity'
- `query` (string, optional): Focus query

### pan
**Tool Name:** `pan`
**Description:** Navigate across different domains or relationships
**Parameters:**
- `direction` (enum, optional): Pan direction ('semantic', 'temporal', 'conceptual')
- `domain` (string, optional): Domain to pan to
- `timeRange` (string, optional): Time range filter
- `conceptFilter` (array, optional): Concept filters
- `semanticVector` (array, optional): Semantic direction vector
- `maxResults` (number, optional): Maximum results, default: 50
- `threshold` (number, optional): Similarity threshold, default: 0.5

### tilt
**Tool Name:** `tilt`
**Description:** Change the perspective or representation style
**Parameters:**
- `style` (enum): View style ('keywords', 'summary', 'detailed'), default: 'keywords'
- `query` (string, optional): Focus query

### inspect
**Tool Name:** `inspect`
**Description:** Examine system state or specific components
**Parameters:**
- `type` (enum): Inspection type ('system', 'session', 'concept', 'memory'), default: 'system'
- `target` (string, optional): Specific target to inspect
- `includeRecommendations` (boolean, optional): Include recommendations, default: false

## Memory Management Tools

Advanced memory operations for persistent storage and retrieval.

### remember
**Tool Name:** `remember`
**Description:** Store information with importance and context metadata
**Parameters:**
- `content` (string, required): Content to remember
- `importance` (enum, optional): Importance level ('low', 'medium', 'high', 'critical'), default: 'medium'
- `domain` (string, optional): Domain classification
- `tags` (array, optional): Tags for categorization
- `context` (string, optional): Contextual information
- `metadata` (object, optional): Additional metadata (source, timestamp, category)

### forget
**Tool Name:** `forget`
**Description:** Remove or fade information from memory
**Parameters:**
- `target` (string, required): Target to forget
- `method` (enum, optional): Forgetting method ('fade', 'remove'), default: 'fade'
- `intensity` (number, optional): Intensity of forgetting (0-1), default: 0.5

### recall
**Tool Name:** `recall`
**Description:** Retrieve stored memories based on criteria
**Parameters:**
- `query` (string, required): Recall query
- `domain` (string, optional): Domain filter
- `timeRange` (string, optional): Time range filter
- `tags` (array, optional): Tag filters
- `limit` (number, optional): Maximum results, default: 10
- `threshold` (number, optional): Similarity threshold, default: 0.5

### project_context
**Tool Name:** `project_context`
**Description:** Project context into different dimensional spaces
**Parameters:**
- `query` (string, required): Context query
- `projectionType` (enum): Projection type ('semantic', 'temporal', 'conceptual'), default: 'semantic'
- `dimensions` (number, optional): Number of dimensions, default: 50
- `includeMetadata` (boolean, optional): Include metadata, default: true
- `timeWindow` (string, optional): Time window
- `conceptFilters` (array, optional): Concept filters

### fade_memory
**Tool Name:** `fade_memory`
**Description:** Gradually fade memories over time
**Parameters:**
- `target` (string, optional): Specific target to fade
- `domain` (string, optional): Domain to fade
- `fadeRate` (number, optional): Rate of fading (0-1), default: 0.1
- `preserveImportant` (boolean, optional): Preserve important memories, default: true
- `dryRun` (boolean, optional): Preview without applying, default: false

## SPARQL Tools

Direct SPARQL operations for advanced knowledge graph manipulation.

### sparql_execute_query
**Description:** Execute SPARQL SELECT or ASK queries
**Parameters:**
- `query` (string, required): SPARQL query to execute
- `limit` (number, optional): Maximum results, default: 100
- `timeout` (number, optional): Timeout in milliseconds, default: 30000

### sparql_execute_construct
**Description:** Execute SPARQL CONSTRUCT queries to generate RDF
**Parameters:**
- `query` (string, required): SPARQL CONSTRUCT query
- `format` (enum, optional): Output format ('turtle', 'n-triples', 'json-ld', 'rdf-xml'), default: 'turtle'
- `timeout` (number, optional): Timeout in milliseconds, default: 30000

### sparql_navigate_zpt
**Description:** Navigate knowledge graph using ZPT spatial metaphors
**Parameters:**
- `zoom` (enum, required): Zoom level ('micro', 'entity', 'relationship', 'community', 'corpus')
- `filters` (object, optional): Filter criteria (type, label, property, value, dateRange)
- `limit` (number, optional): Maximum results, default: 50
- `orderBy` (enum, optional): Result ordering ('similarity', 'frequency', 'centrality', 'weight', 'timestamp')

### sparql_similarity_search
**Description:** Perform vector similarity search using embeddings
**Parameters:**
- `embedding` (array, required): Query embedding vector (100-2000 dimensions)
- `threshold` (number, optional): Similarity threshold (0-1), default: 0.7
- `limit` (number, optional): Maximum results, default: 10
- `entityTypes` (array, optional): Filter by entity types
- `includeMetadata` (boolean, optional): Include metadata, default: true

### sparql_validate_corpus
**Description:** Validate knowledge graph integrity and health
**Parameters:**
- `checkIntegrity` (boolean, optional): Check graph integrity, default: true
- `checkEmbeddings` (boolean, optional): Check embedding coverage, default: true
- `checkConnectivity` (boolean, optional): Check graph connectivity, default: true
- `detailed` (boolean, optional): Return detailed report, default: false

### sparql_store_dataset
**Description:** Store RDF dataset in knowledge graph
**Parameters:**
- `rdfData` (string, required): RDF data to store
- `format` (enum, optional): Input format ('turtle', 'n-triples', 'json-ld', 'rdf-xml'), default: 'turtle'
- `graphName` (string, optional): Named graph for storage
- `replace` (boolean, optional): Replace existing data, default: false

### sparql_bulk_operations
**Description:** Execute multiple SPARQL operations in batch
**Parameters:**
- `operations` (array, required): Operations to execute (type: 'insert', 'update', 'delete')
- `atomic` (boolean, optional): Execute as atomic transaction, default: true
- `continueOnError` (boolean, optional): Continue on errors, default: false

### sparql_graph_management
**Description:** Manage named graphs (create, delete, clear, copy, move)
**Parameters:**
- `operation` (enum, required): Operation type ('create', 'delete', 'clear', 'copy', 'move')
- `graphName` (string, required): Target graph name
- `sourceGraph` (string, optional): Source graph (for copy/move)
- `force` (boolean, optional): Force operation, default: false

## Ragno Tools

Knowledge graph decomposition and corpus analysis tools.

### ragno_decompose_corpus
**Description:** Decompose text corpus into semantic units, entities, and relationships
**Parameters:**
- Text processing and decomposition parameters
- RDF export options
- SPARQL endpoint configuration

### ragno_enrich_embeddings
**Description:** Enrich decomposed knowledge graph with vector embeddings
**Parameters:**
- Embedding model configuration
- Batch processing options

### ragno_augment_attributes
**Description:** Augment entities with additional attributes and properties
**Parameters:**
- Attribute extraction configuration
- Entity enhancement options

### ragno_aggregate_communities
**Description:** Identify and aggregate entity communities in knowledge graph
**Parameters:**
- Community detection algorithms
- Aggregation criteria

## VSOM Tools

Vector Self-Organizing Map tools for clustering and visualization.

### vsom_create_instance
**Description:** Create new VSOM instance for clustering
**Parameters:**
- `mapSize` (array, optional): Grid dimensions [width, height], default: [20, 20]
- `topology` (enum, optional): Grid topology ('rectangular', 'hexagonal'), default: 'rectangular'
- `embeddingDimension` (number, optional): Vector dimension, default: 1536
- `maxIterations` (number, optional): Training iterations, default: 1000
- Training and clustering parameters

### vsom_load_data
**Description:** Load data into VSOM instance
**Parameters:**
- `instanceId` (string, required): VSOM instance ID
- `dataType` (enum, required): Data type ('entities', 'sparql', 'vectorIndex', 'sample')
- `data` (object, required): Data configuration based on type

### vsom_train
**Description:** Train VSOM with loaded data
**Parameters:**
- VSOM instance configuration
- Training parameters

### vsom_get_clusters
**Description:** Extract clusters from trained VSOM
**Parameters:**
- Clustering parameters
- Output format options

## Research Workflow Tools

High-level research and learning workflow tools.

### capture_user_feedback
**Description:** Capture and process user feedback for system improvement
**Parameters:**
- `query` (string, required): Original query
- `response` (string, required): System response
- `feedback` (object, required): User feedback (rating, relevance, comments)
- `userContext` (object, optional): User context information

### incremental_learning
**Description:** Perform incremental learning from feedback data
**Parameters:**
- `learningData` (array, required): Learning examples with queries and responses
- `options` (object, optional): Learning configuration options

## Deprecated Tools (Automatically Redirected)

The following tools have been deprecated and are automatically redirected to core tools:

### Concept & Embedding Tools → `augment`
- `semem_extract_concepts` → `augment` with `operation: 'extract_concepts'`
- `semem_generate_embedding` → `augment` with `operation: 'generate_embedding'`

### Storage Tools → `tell`
- `semem_store_interaction` → `tell` with interaction format
- `uploadDocument` → `tell` with document processing

### Query Tools → `ask`
- `semem_retrieve_memories` → `ask` with memory retrieval
- `semem_answer` → `ask` with comprehensive mode
- `semem_ask` → `ask` with standard processing

### Memory Management Tools → Core Integration
- `remember` → `augment` with `operation: 'remember'`
- `forget` → `augment` with `operation: 'forget'`
- `fade_memory` → `augment` with `operation: 'fade'`
- `recall` → `ask` with memory domain
- `project_context` → `augment` with `operation: 'project_context'`

**Note:** All deprecated tools continue to work seamlessly through automatic redirection to the appropriate core tools.

## Usage Notes

1. All tools return JSON responses with standardized structure including success status, results, and metadata
2. Error handling is implemented consistently across all tools
3. Tools support both synchronous and asynchronous operations
4. Authentication and authorization are handled at the MCP server level
5. Tools can be chained together for complex workflows
6. All operations are logged for debugging and monitoring purposes

## Configuration

Tools are configured through the main MCP server configuration. See the main documentation for setup instructions and configuration options.