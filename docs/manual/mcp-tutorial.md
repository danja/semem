# Semem MCP Tutorial: Core Verbs Guide

**A practical guide to using Semem's 12 core verbs with MCP-enabled systems**

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Core Verbs Overview](#core-verbs-overview)
4. [Primary Memory Verbs](#primary-memory-verbs)
5. [ZPT Navigation Verbs](#zpt-navigation-verbs)
6. [Advanced Memory Management](#advanced-memory-management)
7. [Workflow Patterns](#workflow-patterns)
8. [Memory Domains](#memory-domains)
9. [Real-World Examples](#real-world-examples)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

Semem provides semantic memory management through 12 intuitive verbs accessible via the Model Context Protocol (MCP). These verbs form a simple, powerful interface for intelligent memory operations, knowledge processing, and spatial navigation.

### Core Verb Categories

**🧠 Primary Memory Verbs**: `tell`, `ask`, `augment` - fundamental storage, querying, and enhancement
**🧭 ZPT Navigation Verbs**: `zoom`, `pan`, `tilt` - 3-dimensional knowledge space exploration
**🔍 Inspection Verbs**: `inspect` - system state and debugging
**📚 Advanced Memory Verbs**: `remember`, `forget`, `recall` - precision memory management
**🗂️ Context Management Verbs**: `project-context`, `fade-memory` - domain and transition management

### What Makes Semem Unique

- **Verb-Centric Design**: Simple, intuitive interface replacing complex tool hierarchies
- **Memory Domains**: Multi-domain organization (user, project, session, instruction)
- **ZPT Navigation**: Camera-like controls for exploring knowledge spaces
- **SPARQL Integration**: Native RDF storage with external endpoint support
- **Context Awareness**: Verbs maintain state and provide contextual responses

---

## Quick Start

### Installation and Setup

```bash
# Clone and install
git clone https://github.com/danja/semem.git
cd semem
npm install

# Configure environment
cp example.env .env
# Edit .env with your API keys if using cloud LLMs

# Start MCP server
npm run mcp-server-new
```

### Connect Your MCP Client

#### For Claude Code
```bash
claude mcp add semem node src/mcp/index.js
claude  # Start Claude
```

#### For Claude Desktop
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/path/to/semem/src/mcp/index.js"]
    }
  }
}
```

### Verify Connection

Once connected, you should see:
- **12 core verbs** with `semem-` prefix for all operations
- **System resources** for status and documentation
- **Unified interface** - all capabilities through simple verb calls

---

## Core Verbs Overview

### Verb Categories and Usage

#### 🧠 Primary Memory Verbs (3 verbs)
- **`semem-tell`**: Store content with minimal processing
- **`semem-ask`**: Context-aware querying with enhancement options
- **`semem-augment`**: Post-processing for concept extraction and relationship discovery

#### 🧭 ZPT Navigation Verbs (3 verbs)
- **`semem-zoom`**: Set abstraction level (entity → community)
- **`semem-pan`**: Apply semantic, temporal, or conceptual filters
- **`semem-tilt`**: Choose representation style (keywords → detailed)

#### 🔍 Inspection Verbs (1 verb)
- **`semem-inspect`**: Examine system state, memory domains, and context

#### 📚 Advanced Memory Verbs (3 verbs)
- **`semem-remember`**: Domain-specific storage with importance weighting
- **`semem-forget`**: Graceful memory fading for context transitions
- **`semem-recall`**: Advanced retrieval with multi-dimensional filtering

#### 🗂️ Context Management Verbs (2 verbs)
- **`semem-project-context`**: Project boundary and domain management
- **`semem-fade-memory`**: Smooth memory visibility transitions

### Memory Domain System

Semem organizes memory into four domains:
- **User**: Personal long-term memories and preferences
- **Project**: Project-specific context and knowledge
- **Session**: Temporary conversation and interaction memory
- **Instruction**: System instructions and behavioral context

### SPARQL Integration

Semem can work with any SPARQL-compatible endpoint:
- Native storage for self-contained operation
- External endpoint integration for existing RDF datasets
- Analysis layer over existing semantic web infrastructure
- Support for domain ontologies and knowledge graphs

---

## Primary Memory Verbs

The three primary verbs form the foundation of all memory operations:

### `semem-tell`: Store Information

**Purpose**: Add content to the system with minimal processing

**Basic Usage**:
```
Use semem-tell with:
- content: "Machine learning is a subset of artificial intelligence"
- type: "concept"
- metadata: {"source": "textbook", "confidence": 0.9}
```

**Parameters**:
- `content` (required): Text to store
- `type`: "interaction", "document", or "concept" (default: interaction)
- `metadata`: Additional structured information
- `lazy`: Defer processing for batch operations (default: false)

**When to Use**:
- Storing conversations and interactions
- Archiving documents and references
- Building concept libraries
- Rapid information capture

### `semem-ask`: Query with Context

**Purpose**: Query the system using current ZPT context for enhanced answers

**Basic Usage**:
```
Use semem-ask with:
- question: "What are the key principles of machine learning?"
- mode: "comprehensive"
- useContext: true
- useWikipedia: true
```

**Parameters**:
- `question` (required): Your query
- `mode`: "basic", "standard", or "comprehensive" (default: standard)
- `useContext`: Include stored memories (default: true)
- `useHyDE`: Hypothetical Document Embeddings enhancement
- `useWikipedia`: External Wikipedia knowledge
- `useWikidata`: Structured data from Wikidata
- `useWebSearch`: Live web search integration

**Enhancement Modes**:
- **Basic**: Fast responses using only stored memory
- **Standard**: Memory + basic enhancement
- **Comprehensive**: Full enhancement with external sources

### `semem-augment`: Enhance Stored Content

**Purpose**: Post-process stored content with concept extraction and analysis

**Basic Usage**:
```
Use semem-augment with:
- target: "all"
- operation: "concepts"
- options: {"maxConcepts": 15, "includeRelationships": true}
```

**Operations**:
- `auto`: Intelligent selection of needed operations
- `concepts`: Extract key concepts and entities
- `attributes`: Add entity attributes and properties
- `relationships`: Discover and model relationships
- `chunk_documents`: Break large documents into semantic units
- `generate_embedding`: Create or refresh vector embeddings

**When to Use**:
- After storing large documents with lazy=true
- Building knowledge graphs from stored content
- Enhancing older memories with new capabilities
- Preparing content for ZPT navigation

---

## ZPT Navigation Verbs

ZPT (Zoom, Pan, Tilt) provides camera-like controls for exploring knowledge spaces:

### `semem-zoom`: Set Abstraction Level

**Purpose**: Control the granularity of content view

**Levels**:
- **entity**: Individual entities and their immediate properties
- **concept**: Balanced view of concepts with related entities
- **document**: Document-level content with broader context
- **community**: Topic-level clusters and domain overviews

**Usage Examples**:
```
# Focus on specific entities
Use semem-zoom with level: "entity", query: "artificial intelligence"

# Get conceptual overview
Use semem-zoom with level: "concept", query: "machine learning algorithms"

# Understand topic communities
Use semem-zoom with level: "community"
```

### `semem-pan`: Apply Filters

**Purpose**: Filter content across multiple dimensions

**Filter Types**:
- **semantic**: Filter by conceptual similarity using vector embeddings
- **temporal**: Filter by time periods or chronological progression
- **conceptual**: Filter by specific topics or domain areas

**Usage Examples**:
```
# Temporal filtering
Use semem-pan with:
- direction: "temporal"
- timeRange: "2020-2024"
- maxResults: 50

# Semantic filtering
Use semem-pan with:
- direction: "semantic"
- conceptFilter: ["machine learning", "neural networks"]
- threshold: 0.7

# Domain-specific filtering
Use semem-pan with:
- direction: "conceptual"
- domain: "computer science"
- maxResults: 25
```

### `semem-tilt`: Choose Representation

**Purpose**: Control how content is presented

**Styles**:
- **keywords**: Brief term-based representation (fastest)
- **summary**: Balanced summary with key points
- **detailed**: Comprehensive structured representation

**Usage Examples**:
```
# Quick keyword overview
Use semem-tilt with style: "keywords"

# Balanced summary
Use semem-tilt with style: "summary", query: "recent developments"

# Detailed analysis
Use semem-tilt with style: "detailed"
```

### Navigation Workflow

**Step-by-Step Navigation**:
1. **Set Level**: Use `semem-zoom` to choose appropriate abstraction
2. **Apply Filters**: Use `semem-pan` to focus on relevant content
3. **Choose View**: Use `semem-tilt` to get the right level of detail
4. **Inspect State**: Use `semem-inspect` to understand current context
5. **Iterate**: Adjust zoom/pan/tilt based on findings

---

## Advanced Memory Management

The advanced memory verbs provide precision control over memory operations:

### `semem-remember`: Domain-Specific Storage

**Purpose**: Store content with explicit importance and domain targeting

**Parameters**:
- `content` (required): Information to remember
- `importance`: "low", "medium", "high", "critical" (default: medium)
- `domain`: Target memory domain (user/project/session/instruction)
- `tags`: Searchable tags for organization
- `context`: Additional contextual information
- `metadata`: Structured metadata (source, timestamp, category)

**Usage Examples**:
```
# Critical project information
Use semem-remember with:
- content: "Database password reset procedure for production"
- importance: "critical"
- domain: "project"
- tags: ["security", "database", "production"]

# Personal preference
Use semem-remember with:
- content: "Prefer detailed explanations with examples"
- importance: "medium"
- domain: "user"
- tags: ["preferences", "communication"]
```

### `semem-forget`: Graceful Memory Management

**Purpose**: Reduce memory visibility using navigation rather than deletion

**Methods**:
- `fade`: Gradually reduce memory visibility
- `remove`: Direct memory removal (use sparingly)

**Usage Examples**:
```
# Fade old project memories
Use semem-forget with:
- target: "project_alpha"
- method: "fade"
- intensity: 0.7

# Remove sensitive information
Use semem-forget with:
- target: "temporary passwords"
- method: "remove"
```

### `semem-recall`: Advanced Retrieval

**Purpose**: Search memories with multi-dimensional filtering

**Filters**:
- `domain`: Specific memory domain
- `timeRange`: Temporal constraints
- `tags`: Tag-based filtering
- `threshold`: Similarity threshold (0.0-1.0)
- `limit`: Maximum results

**Usage Examples**:
```
# Find recent project memories
Use semem-recall with:
- query: "API documentation"
- domain: "project"
- timeRange: "last_week"
- limit: 10

# High-confidence user preferences
Use semem-recall with:
- query: "communication style"
- domain: "user"
- threshold: 0.8
- tags: ["preferences"]
```

### `semem-inspect`: System Examination

**Purpose**: Examine system state and stored content for debugging

**Types**:
- `system`: Overall system health and configuration
- `session`: Current session state and temporary memory
- `concept`: Concept extraction and knowledge graph status
- `memory`: Memory domain statistics and health

**Usage Examples**:
```
# Check system status
Use semem-inspect with type: "system", includeRecommendations: true

# Examine current session
Use semem-inspect with type: "session"

# Review memory domain health
Use semem-inspect with type: "memory", target: "project"
```

---

## Workflow Patterns

Common workflows combining multiple verbs for specific tasks:

### Pattern 1: Document Analysis Pipeline

**Workflow**: Store → Augment → Navigate → Query

**Use Case**: Analyzing research papers or technical documents

**Steps**:
1. **Store Content**: Use `semem-tell` with `lazy: true` for rapid ingestion
2. **Extract Knowledge**: Use `semem-augment` with `operation: "concepts"`
3. **Set Navigation**: Use `semem-zoom` to "concept" level
4. **Query Insights**: Use `semem-ask` with `mode: "comprehensive"`

**Example**:
```
# Store document quickly
Use semem-tell with:
- content: "[Research paper text]"
- type: "document"
- lazy: true

# Extract concepts and relationships
Use semem-augment with:
- operation: "concepts"
- options: {"includeRelationships": true, "maxConcepts": 20}

# Set conceptual view
Use semem-zoom with level: "concept"

# Query for insights
Use semem-ask with:
- question: "What are the main findings and methodologies?"
- mode: "comprehensive"
```

### Pattern 2: Knowledge Discovery

**Workflow**: Navigate → Filter → Query → Remember

**Use Case**: Exploring existing knowledge to find connections

**Steps**:
1. **Set Overview**: Use `semem-zoom` to "community" level
2. **Apply Filters**: Use `semem-pan` with relevant constraints
3. **Choose Detail**: Use `semem-tilt` for appropriate representation
4. **Query Connections**: Use `semem-ask` to explore relationships
5. **Store Insights**: Use `semem-remember` for important discoveries

### Pattern 3: Project Context Setup

**Workflow**: Context → Remember → Tell → Augment

**Use Case**: Starting a new project with existing knowledge

**Steps**:
1. **Create Context**: Use `semem-project-context` to establish boundaries
2. **Remember Goals**: Use `semem-remember` for project objectives
3. **Store Resources**: Use `semem-tell` for relevant documents
4. **Build Knowledge**: Use `semem-augment` to create concept maps

### Pattern 4: Context Transition

**Workflow**: Fade → Context → Recall → Ask

**Use Case**: Switching between projects or domains

**Steps**:
1. **Fade Old Context**: Use `semem-fade-memory` for smooth transition
2. **Switch Context**: Use `semem-project-context` to activate new domain
3. **Recall Relevant**: Use `semem-recall` to refresh context
4. **Query Status**: Use `semem-ask` to understand current state

---

## Memory Domains

Semem organizes memory into four distinct domains for contextual organization:

### Domain Types

#### User Domain
**Purpose**: Personal long-term memories and preferences
**Content**: User preferences, communication styles, personal context
**Persistence**: Long-term, survives sessions and projects
**Access**: Available across all contexts

**Examples**:
- Communication preferences ("I prefer detailed explanations")
- Domain expertise ("I'm experienced in machine learning")
- Working patterns ("I work best with structured information")

#### Project Domain
**Purpose**: Project-specific context and knowledge
**Content**: Project goals, constraints, specific knowledge, team context
**Persistence**: Project lifetime, can be archived
**Access**: Active when project context is set

**Examples**:
- Project objectives and requirements
- Team member roles and expertise
- Project-specific terminology and conventions
- Technical constraints and decisions

#### Session Domain
**Purpose**: Temporary conversation and interaction memory
**Content**: Current conversation, temporary context, session-specific state
**Persistence**: Session lifetime only
**Access**: Current session only

**Examples**:
- Current conversation thread
- Temporary calculations or analysis
- Session-specific assumptions
- Recently referenced information

#### Instruction Domain
**Purpose**: System instructions and behavioral context
**Content**: System behavior modifications, processing instructions
**Persistence**: Configurable, can be session or longer-term
**Access**: Applied to system behavior

**Examples**:
- Output format preferences
- Processing constraints
- Behavioral modifications
- Workflow customizations

### Domain Management

#### Switching Project Context
```
Use semem-project-context with:
- query: "switch to project_beta"
- projectionType: "semantic"
- includeMetadata: true
```

#### Cross-Domain Queries
```
# Query user preferences
Use semem-recall with:
- query: "communication preferences"
- domain: "user"
- threshold: 0.8

# Find project-specific information
Use semem-recall with:
- query: "API endpoints"
- domain: "project"
- tags: ["documentation"]
```

#### Domain Inspection
```
# Check project domain status
Use semem-inspect with:
- type: "memory"
- target: "project"
- includeRecommendations: true
```

---

## Real-World Examples

Practical examples demonstrating verb usage in real scenarios:

### Example 1: Research Paper Analysis

**Scenario**: Analyzing a collection of AI research papers

**Workflow**:
```
# Store papers with lazy processing for speed
Use semem-tell with:
- content: "[Paper 1 content]"
- type: "document"
- metadata: {"source": "arxiv", "year": "2024", "topic": "transformers"}
- lazy: true

# Extract concepts from all stored papers
Use semem-augment with:
- target: "all"
- operation: "concepts"
- options: {"includeRelationships": true, "maxConcepts": 25}

# Navigate to community level to see research themes
Use semem-zoom with level: "community"

# Filter by temporal progression
Use semem-pan with:
- direction: "temporal"
- timeRange: "2020-2024"

# Get detailed view of trends
Use semem-tilt with style: "detailed"

# Query for insights
Use semem-ask with:
- question: "What are the emerging trends in transformer architectures?"
- mode: "comprehensive"
- useWikipedia: true
```

### Example 2: Project Knowledge Management

**Scenario**: Managing knowledge for a software development project

**Workflow**:
```
# Set up project context
Use semem-project-context with:
- query: "create web_app_project"
- projectionType: "semantic"
- includeMetadata: true

# Remember critical project information
Use semem-remember with:
- content: "API rate limits: 1000 requests/hour, database connection pool size: 20"
- importance: "critical"
- domain: "project"
- tags: ["configuration", "limits"]

# Store technical documentation
Use semem-tell with:
- content: "[API documentation]"
- type: "document"
- metadata: {"type": "api_docs", "version": "v2.1"}

# Extract technical concepts
Use semem-augment with:
- operation: "concepts"
- options: {"maxConcepts": 30, "includeAttributes": true}

# Query for specific information
Use semem-ask with:
- question: "What are the authentication requirements for the API?"
- mode: "standard"
```

### Example 3: Context Switching Between Projects

**Scenario**: Switching from one project to another

**Workflow**:
```
# Fade current project memories
Use semem-fade-memory with:
- target: "current_project"
- fadeRate: 0.3
- preserveImportant: true

# Switch to new project context
Use semem-project-context with:
- query: "activate mobile_app_project"
- projectionType: "conceptual"

# Recall relevant memories for new context
Use semem-recall with:
- query: "mobile development best practices"
- domain: "project"
- threshold: 0.7
- limit: 15

# Check what's available in new context
Use semem-inspect with:
- type: "memory"
- target: "project"
- includeRecommendations: true

# Ask context-aware question
Use semem-ask with:
- question: "What's the current status of the mobile app project?"
- mode: "comprehensive"
```

### Example 4: Learning and Knowledge Building

**Scenario**: Building personal knowledge about a new technical domain

**Workflow**:
```
# Remember learning preference
Use semem-remember with:
- content: "I learn best with examples and practical applications"
- importance: "medium"
- domain: "user"
- tags: ["learning", "preferences"]

# Store learning materials
Use semem-tell with:
- content: "[Tutorial content on blockchain]"
- type: "document"
- metadata: {"difficulty": "beginner", "topic": "blockchain"}

# Extract key concepts
Use semem-augment with:
- operation: "concepts"
- options: {"maxConcepts": 20, "minConfidence": 0.7}

# Navigate to concept level
Use semem-zoom with level: "concept"

# Filter by conceptual domain
Use semem-pan with:
- direction: "conceptual"
- domain: "blockchain"

# Ask for explanation with examples
Use semem-ask with:
- question: "Can you explain consensus mechanisms with practical examples?"
- mode: "comprehensive"
- useWikipedia: true
```

---

## Context Management Verbs

The final two verbs handle project boundaries and memory transitions:

### `semem-project-context`: Project Management

**Purpose**: Create, switch, list, or archive project contexts

**Operations**:
- Create new project contexts with specific domains
- Switch between active projects
- List available project contexts
- Archive completed projects

**Parameters**:
- `query` (required): Context operation or project identifier
- `projectionType`: "semantic", "temporal", or "conceptual" (default: semantic)
- `dimensions`: Number of dimensions for context projection (default: 50)
- `includeMetadata`: Include project metadata in responses
- `timeWindow`: Temporal constraints for context
- `conceptFilters`: Specific concept filters for the project

**Usage Examples**:
```
# Create new project context
Use semem-project-context with:
- query: "create machine_learning_research"
- projectionType: "semantic"
- includeMetadata: true

# Switch to existing project
Use semem-project-context with:
- query: "activate web_development_project"
- projectionType: "conceptual"

# List available projects
Use semem-project-context with:
- query: "list projects"
- includeMetadata: true

# Archive completed project
Use semem-project-context with:
- query: "archive mobile_app_project"
```

### `semem-fade-memory`: Memory Transitions

**Purpose**: Gradually reduce memory visibility for smooth context transitions

**Strategies**:
- **Gradual Fading**: Slowly reduce memory visibility over time
- **Importance Preservation**: Maintain critical memories while fading others
- **Context-Aware Fading**: Fade based on relevance to new context
- **Dry Run**: Preview fading effects without applying changes

**Parameters**:
- `target`: Specific memories or domains to fade (optional)
- `domain`: Memory domain to target (optional)
- `fadeRate`: Rate of fading from 0.0 (no fade) to 1.0 (complete fade)
- `preserveImportant`: Keep high-importance memories visible (default: true)
- `dryRun`: Preview changes without applying them (default: false)

**Usage Examples**:
```
# Gentle fade of old project context
Use semem-fade-memory with:
- target: "old_project_context"
- fadeRate: 0.3
- preserveImportant: true

# Preview fading effects
Use semem-fade-memory with:
- domain: "session"
- fadeRate: 0.5
- dryRun: true

# Complete fade of temporary information
Use semem-fade-memory with:
- target: "temporary_calculations"
- fadeRate: 0.9
- preserveImportant: false
```

### Project Lifecycle Management

**Complete Project Workflow**:
```
# 1. Create project context
Use semem-project-context with query: "create data_analysis_project"

# 2. Remember project goals
Use semem-remember with:
- content: "Analyze customer behavior patterns for Q4 marketing strategy"
- importance: "high"
- domain: "project"
- tags: ["goals", "marketing", "analysis"]

# 3. Work with project data...
# [Multiple tell/ask/augment operations]

# 4. Transition to new project
Use semem-fade-memory with:
- domain: "project"
- fadeRate: 0.4
- preserveImportant: true

# 5. Activate new project
Use semem-project-context with query: "activate social_media_campaign"

# 6. Recall relevant cross-project knowledge
Use semem-recall with:
- query: "marketing strategies"
- domain: "user"
- threshold: 0.7
```

### Best Practices

**Memory Domain Organization**:
- Use **user domain** for personal preferences and cross-project knowledge
- Use **project domain** for specific project context and constraints
- Use **session domain** for temporary conversation state
- Use **instruction domain** for system behavior modifications

**Context Transition Guidelines**:
- Always use `semem-fade-memory` before major context switches
- Preserve important memories during transitions
- Use dry run to preview fading effects
- Gradually fade rather than abrupt context switching

---

## Troubleshooting

### Connection Issues

#### MCP Server Won't Start
**Symptoms**: Server fails to initialize or exits immediately

**Common Solutions**:
- Verify Node.js version (requires 20.11.0+)
- Check Ollama is running: `ollama list`
- Validate configuration files
- Review logs for specific errors

#### Client Connection Failures
**Symptoms**: "Connection failed" or timeout errors

**Debugging Steps**:
- Confirm server shows "✅ Semem MCP server running"
- Verify file paths in client configuration
- Check permissions on script files
- Try HTTP transport as alternative

#### Tools Not Appearing
**Symptoms**: Connected but no tools visible

**Solutions**:
- Restart MCP client completely
- Verify configuration syntax
- Check server logs for registration errors
- Test with simple status tool

### Performance Optimization

#### Slow Response Times
**Common Causes and Solutions**:

**Large Document Processing**:
- Reduce chunk sizes in `ragno_decompose_corpus`
- Use higher entity confidence thresholds
- Process documents in smaller batches

**Memory Search Performance**:
- Increase similarity thresholds (0.8+ for precision)
- Reduce result limits for faster responses  
- Use specific concept queries rather than broad searches

**SPARQL Query Optimization**:
- Add LIMIT clauses to prevent large result sets
- Use indexed properties for filtering
- Optimize query patterns for your endpoint

#### Memory Usage Growth
**Symptoms**: Server memory usage increases over time

**Solutions**:
- Restart server periodically for cache clearing
- Configure smaller chunk sizes and limits
- Use streaming processing for large datasets
- Monitor with `semem_get_metrics` tool

### Tool-Specific Issues

#### Knowledge Graph Construction Problems
**Empty Results from ragno_decompose_corpus**:
- Lower entity confidence threshold (0.5 instead of 0.8)
- Verify text contains meaningful content
- Check chunk size isn't too small/large
- Ensure LLM endpoint is responding

#### Memory Search Issues
**No Results from semem_retrieve_memories**:
- Lower similarity threshold (0.5-0.6 for broader search)
- Verify embeddings are generated correctly
- Check memory storage has content
- Try broader query terms

#### Navigation Problems
**ZPT Tools Return Empty Results**:
- Verify corpus has been processed and analyzed
- Check filters aren't too restrictive
- Use `zpt_get_options` to see available content
- Try different zoom/tilt combinations

### SPARQL Store Issues

#### Connection Problems
**Can't Connect to SPARQL Endpoint**:
- Verify endpoint URL and credentials
- Check network connectivity and firewall rules
- Test endpoint directly with simple query
- Verify SPARQL store is running and accessible

#### Data Inconsistency
**Graph Data Appears Incomplete**:
- Check entity confidence thresholds
- Verify relationship extraction is enabled
- Monitor for processing errors in logs
- Use `ragno_get_graph_stats` to verify data

#### Performance Issues
**Slow SPARQL Queries**:
- Add appropriate indexes to your SPARQL store
- Optimize query patterns and filters
- Consider using CachedSPARQL storage backend
- Monitor query performance with store tools

---

## Conclusion

Semem's 12 core verbs provide a simple, powerful interface for semantic memory management, knowledge processing, and spatial navigation. The verb-centric design makes complex operations intuitive while maintaining the full power of the underlying systems.

### Key Success Patterns

1. **Start Simple**: Begin with `tell`, `ask`, and `augment` before exploring advanced verbs
2. **Use Domain Organization**: Leverage memory domains for clean context separation
3. **Navigate Spatially**: Use ZPT verbs to explore knowledge from different perspectives
4. **Manage Transitions**: Use fade and context verbs for smooth workflow transitions
5. **Inspect Regularly**: Use the inspect verb to understand system state

### Verb Selection Guide

**For Basic Operations**:
- Start with `semem-tell` and `semem-ask`
- Add `semem-augment` when you need concept extraction
- Use `semem-inspect` when troubleshooting

**For Advanced Memory Management**:
- Use `semem-remember` for important, domain-specific information
- Use `semem-recall` for precise, filtered retrieval
- Use `semem-forget` for graceful memory management

**For Knowledge Exploration**:
- Use `semem-zoom` to set the right abstraction level
- Use `semem-pan` to filter by semantic, temporal, or conceptual dimensions
- Use `semem-tilt` to control detail level

**For Project Management**:
- Use `semem-project-context` for project boundaries
- Use `semem-fade-memory` for smooth context transitions

### Next Steps

- **Practice with Simple Workflows**: Start with tell/ask patterns
- **Explore Navigation**: Try different zoom/pan/tilt combinations
- **Organize by Domain**: Set up user and project contexts
- **Build Custom Patterns**: Combine verbs for your specific workflows
- **Monitor Performance**: Use inspect to understand system behavior

The verb interface transforms complex semantic operations into intuitive, composable actions. Through thoughtful verb combination and domain organization, Semem enables sophisticated knowledge management that adapts to your specific needs and working patterns.

---

*For detailed implementation reference, see [MCP List](./mcp-list.md) and explore the comprehensive [HTTP API endpoints](./http-api-endpoints.md) for programmatic access.*