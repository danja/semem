# Semem MCP (Model Context Protocol) Integration

This document provides comprehensive documentation for all available MCP tools, resources, and capabilities in the Semem semantic memory management system.

## Overview

The Semem MCP integration provides programmatic access to Semem's core capabilities through the Model Context Protocol via a simplified verb-based interface. The system centers around 13 core verbs that provide intelligent memory management, knowledge processing, spatial navigation, and visualization.

**Server Information:**
- **Name**: Semem Integration Server
- **Version**: 1.0.0
- **Transport**: stdio
- **Entry Point**: `src/mcp/index.js`

## Core Capabilities

The Semem MCP server provides the following core capabilities:

- ✅ **Semantic Memory**: Tell/ask paradigm with vector embeddings and context awareness
- ✅ **Memory Domains**: Multi-domain memory management (user, project, session, instruction)
- ✅ **Content Augmentation**: Automated concept extraction, chunking, and relationship discovery
- ✅ **ZPT Navigation**: 3-dimensional knowledge space navigation (zoom, pan, tilt)
- ✅ **SPARQL Integration**: Native RDF storage with SPARQL endpoint support

---

## Core Verbs (MCP Tools)

Semem provides 13 core verbs that form a simple, intuitive interface for semantic memory and knowledge management:

### Primary Memory Verbs

#### `semem-tell`
**Purpose**: Store content in the system with minimal processing
**Schema**: Content (required), type (interaction/document/concept), metadata, lazy flag
**Description**: Primary storage verb for adding information to memory with automatic embedding generation and optional lazy processing.

#### `semem-ask`
**Purpose**: Query the system using current context for enhanced answers
**Schema**: Question (required), mode (basic/standard/comprehensive), enhancement flags (HyDE, Wikipedia, Wikidata, WebSearch)
**Description**: Context-aware querying with optional external knowledge enhancement and variable complexity modes.

#### `semem-augment`
**Purpose**: Run operations like concept extraction on stored content
**Schema**: Target scope, operation type (auto/concepts/attributes/relationships), chunking/extraction options
**Description**: Post-processing verb for enriching stored content with concepts, relationships, and structured analysis.

### ZPT Navigation Verbs

#### `semem-zoom`
**Purpose**: Set abstraction level for navigation
**Schema**: level (micro/entity/text/unit/community/corpus, default: entity), query (optional)
**Description**: Controls the granularity of content view from micro-level elements to entire corpus.

#### `semem-pan`
**Purpose**: Set subject domain filters
**Schema**: domains (array), keywords (array), entities (array), corpuscle (array), temporal (object with start/end)
**Description**: Multi-dimensional filtering using domains, keywords, entities, corpuscles, and temporal bounds for focused exploration.

#### `semem-tilt`
**Purpose**: Set representation style
**Schema**: style (keywords/embedding/graph/temporal/concept, default: keywords), query (optional)
**Description**: Controls content presentation style - keywords, embedding-based, graph, temporal, or concept views.

### Inspection and Debugging

#### `semem-inspect`
**Purpose**: Examine system state and stored content
**Schema**: what (session/concepts/all, default: session), details (boolean, default: false)
**Description**: Diagnostic verb for understanding session context, concepts, and system state.

### Advanced Memory Management

#### `semem-remember`
**Purpose**: Store content with explicit importance and domain targeting
**Schema**: Content, importance level (low/medium/high/critical), domain, tags, context, metadata
**Description**: Precision storage for critical information with domain-specific targeting and importance weighting.

#### `semem-forget`
**Purpose**: Reduce memory visibility using navigation strategies
**Schema**: Target, method (fade/remove), intensity level
**Description**: Graceful memory management through fading rather than deletion, preserving information structure.

#### `semem-recall`
**Purpose**: Search memories with domain and temporal filtering
**Schema**: Query, domain filter, time range, tags, limit, threshold
**Description**: Advanced memory retrieval with multi-dimensional filtering and relevance scoring.

### Context Management

#### `semem-project-context`
**Purpose**: Manage project-specific memory domains
**Schema**: Query, projection type (semantic/temporal/conceptual), dimensions, metadata inclusion
**Description**: Project boundary management for organizing memories into distinct contexts and domains.

#### `semem-fade-memory`
**Purpose**: Gradually reduce memory visibility for context transitions
**Schema**: Target, domain, fade rate, importance preservation flag, dry run option
**Description**: Smooth context transitions by gradually reducing memory visibility while preserving important information.

### Visualization

#### `semem-train-vsom`
**Purpose**: Train Visual Self-Organizing Map for data visualization
**Schema**: epochs (1-10000, default: 100), learningRate (0.001-1.0, default: 0.1), gridSize (5-50, default: 20)
**Description**: Train VSOM neural network for visualizing high-dimensional semantic data in 2D/3D space.

---

## MCP Resources

### Core Status Resources

#### `semem://status`
**Description**: Current system status and service health
**Type**: JSON
**Purpose**: Real-time status information about Semem services, initialization state, memory domains, and ZPT navigation context.

#### `semem://status-http`
**Description**: HTTP server status and endpoint health
**Type**: JSON
**Purpose**: Status information specific to HTTP API server, endpoint availability, and performance metrics.

### Documentation Resources

#### `semem://docs/verbs`
**Description**: Complete documentation for all 13 core verbs
**Type**: Markdown
**Purpose**: Comprehensive guide to verb usage, parameters, schemas, and workflow patterns.

#### `semem://docs/domains`
**Description**: Memory domain system documentation
**Type**: Markdown
**Purpose**: Explanation of user, project, session, and instruction memory domains with management strategies.

### ZPT Navigation Resources

#### `semem://zpt/context`
**Description**: Current ZPT navigation state and context
**Type**: JSON
**Purpose**: Active zoom/pan/tilt settings, available navigation options, and context-aware suggestions.

#### `semem://zpt/schema`
**Description**: ZPT navigation parameter schemas
**Type**: JSON
**Purpose**: Validation schemas for zoom, pan, and tilt operations with examples and constraints.

#### `semem://zpt/examples`
**Description**: ZPT navigation patterns and use cases
**Type**: Markdown
**Purpose**: Practical examples of effective navigation workflows and spatial exploration strategies.

---

## Core Workflows

### Basic Memory Workflow
1. **Store**: Use `semem-tell` to add content with minimal processing
2. **Query**: Use `semem-ask` for context-aware retrieval and responses
3. **Enhance**: Use `semem-augment` to add concepts and relationships post-storage
4. **Navigate**: Use ZPT verbs (zoom/pan/tilt) for spatial exploration

### Advanced Memory Management
1. **Domain Storage**: Use `semem-remember` for domain-specific, importance-weighted storage
2. **Contextual Retrieval**: Use `semem-recall` with domain and temporal filtering
3. **Project Management**: Use `semem-project-context` for project boundary management
4. **Memory Transitions**: Use `semem-fade-memory` for smooth context switching

### ZPT Navigation Workflow
1. **Set Level**: Use `semem-zoom` to choose abstraction level (entity → community)
2. **Apply Filters**: Use `semem-pan` for semantic, temporal, or conceptual filtering
3. **Choose Style**: Use `semem-tilt` for representation (keywords → detailed)
4. **Inspect Results**: Use `semem-inspect` to understand current state

### System Health and Debugging
1. **Status Check**: Query `semem://status` resource for system health
2. **Context Review**: Query `semem://zpt/context` for navigation state
3. **System Inspection**: Use `semem-inspect` with various type filters
4. **Documentation**: Reference `semem://docs/*` resources for guidance

---

## Architecture Notes

### Verb-Centric Design
- **Simple Interface**: 13 intuitive verbs replace complex tool hierarchies
- **Unified Service**: Single `SimpleVerbsService` handles all verb operations
- **Schema Validation**: Zod schemas ensure type safety and parameter validation
- **Centralized Routing**: All verbs route through `tool-router.js` for consistent handling

### Memory Domain System
- **User Domain**: Personal long-term memories and preferences
- **Project Domain**: Project-specific context and knowledge
- **Session Domain**: Temporary conversation and interaction memory
- **Instruction Domain**: System instructions and behavioral context

### SPARQL Integration
- **Backend Agnostic**: Works with any SPARQL-compatible endpoint
- **External Data Support**: Can analyze existing RDF datasets
- **Native Storage**: Built-in SPARQL store for self-contained operation
- **CachedSPARQL**: Performance optimization for frequent queries

### ZPT Navigation Model
- **Zoom**: Abstraction levels from entities to entire corpora
- **Pan**: Multi-dimensional filtering (semantic, temporal, conceptual)
- **Tilt**: Representation styles from keywords to detailed structured views
- **Context Aware**: Navigation maintains state across operations

---

## Implementation Structure

**Core Files:**
- `src/mcp/index.js` - Main MCP server entry point
- `src/mcp/tools/simple-verbs.js` - Verb exports and coordination
- `src/mcp/tools/VerbSchemas.js` - Zod validation schemas
- `src/mcp/tools/SimpleVerbsService.js` - Core verb implementation
- `src/mcp/tools/VerbRegistration.js` - MCP tool registration
- `src/mcp/server/handlers/tool-router.js` - Centralized request routing

**Transport Support:**
- **STDIO**: Direct MCP protocol communication
- **HTTP**: REST API endpoints for web integration
- **Unified Backend**: Both transports share the same service layer

For detailed implementation guides and examples, refer to the resource documents accessible through the MCP resource system.