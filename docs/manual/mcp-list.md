# Semem MCP (Model Context Protocol) Integration

This document provides comprehensive documentation for all available MCP tools, resources, and capabilities in the Semem semantic memory management system.

## Overview

The Semem MCP integration provides programmatic access to Semem's core capabilities through the Model Context Protocol. This enables external applications to leverage Semem's semantic memory management, knowledge graph operations, and 3-dimensional navigation systems.

**Server Information:**
- **Name**: Semem Integration Server
- **Version**: 1.0.0
- **Transport**: stdio

## Core Capabilities

The Semem MCP server provides the following core capabilities:

- ✅ **Memory Management**: Store and retrieve semantic memories with embeddings
- ✅ **Concept Extraction**: LLM-powered concept extraction from text
- ✅ **Embedding Generation**: Vector embedding generation for semantic search
- ✅ **Ragno Knowledge Graph**: RDF-based knowledge graph construction and querying
- ✅ **ZPT Navigation**: 3-dimensional knowledge graph navigation using spatial metaphors

---

## MCP Tools

### Semantic Memory API Tools

#### `mcp__semem__semem_store_interaction`
**Purpose**: Store interactions with automatic embedding generation  
**Description**: Stores user prompts and responses as semantic memories, automatically generating vector embeddings for later retrieval.

#### `mcp__semem__semem_retrieve_memories` 
**Purpose**: Semantic memory search and retrieval  
**Description**: Searches stored memories using vector similarity, returning relevant interactions based on semantic similarity to the query.

#### `mcp__semem__semem_generate_embedding`
**Purpose**: Vector embedding generation  
**Description**: Generates vector embeddings for text content using configured embedding providers.

#### `mcp__semem__semem_generate_response`
**Purpose**: LLM response with memory context  
**Description**: Generates LLM responses augmented with relevant memory context retrieved from the semantic memory store.

#### `mcp__semem__semem_extract_concepts`
**Purpose**: LLM concept extraction  
**Description**: Extracts key concepts and entities from text using large language models.

### Ragno Knowledge Graph API Tools

#### `mcp__semem__ragno_decompose_corpus`
**Purpose**: Text to RDF knowledge graph decomposition  
**Description**: Decomposes text corpora into structured RDF knowledge graphs, extracting entities, relationships, and semantic units following the Ragno ontology.

#### `mcp__semem__ragno_enrich_embeddings`
**Purpose**: Enrich decomposition results with vector embeddings  
**Description**: Adds vector embeddings to decomposed knowledge graph elements for semantic search capabilities.

#### `mcp__semem__ragno_augment_attributes`
**Purpose**: Augment entities with additional attributes and properties  
**Description**: Enhances extracted entities with additional attributes and metadata using LLM analysis.

#### `mcp__semem__ragno_aggregate_communities`
**Purpose**: Detect and aggregate communities in the knowledge graph  
**Description**: Identifies topical communities and clusters within the knowledge graph using graph analytics algorithms.

#### `mcp__semem__ragno_export_sparql`
**Purpose**: Export decomposition results to SPARQL endpoint  
**Description**: Exports structured knowledge graph data to SPARQL endpoints for persistent storage and querying.

#### `mcp__semem__ragno_get_entity`
**Purpose**: Retrieve entity details with relationships and attributes  
**Description**: Fetches detailed information about specific entities including their properties and relationships.

#### `mcp__semem__ragno_search_graph`
**Purpose**: Search the knowledge graph using semantic or entity-based queries  
**Description**: Performs searches across the knowledge graph using various search strategies (semantic, entity-based, or dual).

#### `mcp__semem__ragno_get_graph_stats`
**Purpose**: Get statistics and metrics about the knowledge graph  
**Description**: Provides comprehensive statistics about the knowledge graph including entity counts, relationship metrics, and graph analytics.

### ZPT Navigation API Tools

#### `mcp__semem__zpt_navigate`
**Purpose**: Navigate the knowledge space using 3D spatial metaphors (zoom, pan, tilt)  
**Description**: Provides intuitive knowledge graph navigation using camera-like controls for exploring content at different levels of abstraction and representation styles.

#### `mcp__semem__zpt_preview`
**Purpose**: Get a lightweight preview of a navigation destination  
**Description**: Provides quick previews of navigation results without full processing, useful for UI responsiveness.

#### `mcp__semem__zpt_get_schema`
**Purpose**: Get the ZPT schema and available dimensions  
**Description**: Returns the complete JSON schema for ZPT navigation parameters with validation rules and examples.

#### `mcp__semem__zpt_validate_params`
**Purpose**: Validate a set of ZPT navigation parameters  
**Description**: Validates ZPT navigation parameters against the schema before execution.

#### `mcp__semem__zpt_get_options`
**Purpose**: Get available options for ZPT navigation  
**Description**: Returns available navigation options based on current context and corpus state.

#### `mcp__semem__zpt_analyze_corpus`
**Purpose**: Analyze the corpus for ZPT navigation readiness  
**Description**: Analyzes the corpus structure and provides recommendations for optimal ZPT navigation configuration.

---

## MCP Resources

### `semem://status`
**Description**: Current system status and service health  
**Type**: JSON  
**Purpose**: Provides real-time status information about Semem services, initialization state, and available capabilities.

### `semem://docs/api`
**Description**: Complete API documentation for Semem MCP integration  
**Type**: JSON  
**Purpose**: Comprehensive documentation of all available tools, their parameters, and usage examples.

### `semem://graph/schema`
**Description**: Schema and ontology information for the Ragno knowledge graph  
**Type**: JSON  
**Purpose**: Provides the complete RDF schema and ontology definitions used by the Ragno knowledge graph system.

**Key Schema Elements:**
- `ragno:Corpus` - A collection of related documents or texts
- `ragno:Entity` - Named entities extracted from text (people, places, concepts)
- `ragno:SemanticUnit` - Independent semantic units from corpus decomposition
- `ragno:Relationship` - First-class relationship nodes between entities
- `ragno:Element` - Generic element in the knowledge graph

### `semem://zpt/schema`
**Description**: Complete JSON schema for ZPT navigation parameters  
**Type**: JSON  
**Purpose**: Provides validation schema for 3-dimensional knowledge graph navigation parameters.

**Navigation Dimensions:**
- **Zoom**: Level of abstraction (entity, unit, text, community, corpus)
- **Pan**: Content filtering parameters
- **Tilt**: Representation style (keywords, embedding, graph, temporal)

### `semem://zpt/examples`
**Description**: Comprehensive examples and patterns for ZPT knowledge graph navigation  
**Type**: Markdown  
**Purpose**: Practical examples demonstrating effective ZPT navigation patterns and use cases.

### `semem://zpt/guide`
**Description**: Comprehensive guide to ZPT concepts, spatial metaphors, and navigation principles  
**Type**: Markdown  
**Purpose**: Complete conceptual guide explaining the 3-dimensional navigation model and its applications.

### `semem://zpt/performance`
**Description**: Performance optimization strategies, caching patterns, and monitoring for ZPT navigation  
**Type**: Markdown  
**Purpose**: Best practices for optimizing ZPT navigation performance in production environments.

---

## Usage Patterns

### Basic Memory Operations
1. Use `semem_store_interaction` to save conversations
2. Use `semem_retrieve_memories` for semantic search
3. Use `semem_generate_response` for context-aware responses

### Knowledge Graph Construction
1. Use `ragno_decompose_corpus` to process text into RDF
2. Use `ragno_enrich_embeddings` to add semantic search capabilities
3. Use `ragno_export_sparql` to persist to graph database

### 3D Knowledge Navigation
1. Use `zpt_get_schema` to understand navigation parameters
2. Use `zpt_navigate` with appropriate zoom/pan/tilt settings
3. Use `zpt_preview` for efficient UI interactions

### System Monitoring
1. Check `semem://status` for service health
2. Use `ragno_get_graph_stats` for knowledge graph metrics
3. Use `zpt_analyze_corpus` for navigation optimization

---

## Integration Notes

- All tools follow consistent parameter patterns and error handling
- Resources provide both machine-readable schemas and human-readable documentation
- The system supports both synchronous and asynchronous operation modes
- Full compatibility with standard MCP client implementations

For detailed parameter specifications and examples, refer to the individual resource documents accessible through the MCP resource system.