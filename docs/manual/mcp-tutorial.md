# Semem MCP Tutorial: Complete User Guide

**A comprehensive workflow-focused guide for using Semem with MCP-enabled systems**

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Understanding Semem's Capabilities](#understanding-semems-capabilities)
4. [Core Workflow Patterns](#core-workflow-patterns)
5. [Memory Management Workflows](#memory-management-workflows)
6. [Knowledge Graph Construction Workflows](#knowledge-graph-construction-workflows)
7. [3D Navigation Workflows](#3d-navigation-workflows)
8. [Integrated Multi-System Workflows](#integrated-multi-system-workflows)
9. [SPARQL Store Integration](#sparql-store-integration)
10. [Real-World Use Cases](#real-world-use-cases)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

Semem is a semantic memory management platform that combines three powerful systems through the Model Context Protocol (MCP):

**🧠 Semantic Memory**: Intelligent storage and retrieval with vector embeddings  
**🕸️ Knowledge Graphs**: RDF-based entity extraction and relationship modeling using the Ragno ontology  
**🧭 3D Navigation**: ZPT (Zoom, Pan, Tilt) spatial analysis for multi-dimensional content exploration

### What Makes Semem Unique

- **Workflow-Centric Design**: Pre-built patterns for common research and analysis tasks
- **SPARQL-First Storage**: Native RDF storage with external SPARQL endpoint support
- **Unified Access**: All capabilities accessible through a single MCP interface
- **43 HTTP API Endpoints**: Complete programmatic access alongside MCP tools
- **External Data Integration**: SPARQL stores can be populated independently, then analyzed with Semem

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
claude mcp add semem node mcp/index.js
claude  # Start Claude
```

#### For Claude Desktop
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/path/to/semem/mcp/index.js"]
    }
  }
}
```

### Verify Connection

Once connected, you should see:
- **35+ MCP tools** for memory, knowledge graphs, and navigation
- **15 resources** for documentation and system status  
- **8 workflow prompts** for complex operations

---

## Understanding Semem's Capabilities

### Core System Components

#### 🧠 Semantic Memory (5 tools)
Store and retrieve conversations, documents, and knowledge with vector embeddings for semantic similarity search.

#### 🕸️ Ragno Knowledge Graph (13 tools)  
Transform text into structured RDF knowledge graphs following the Ragno ontology. Extract entities, relationships, and semantic units with full SPARQL compatibility.

#### 🧭 ZPT 3D Navigation (6 tools)
Navigate knowledge spaces using camera-like controls:
- **Zoom**: Level of detail (entity, unit, text, community, corpus)
- **Pan**: Content filtering (temporal, geographic, topical) 
- **Tilt**: Representation style (keywords, embedding, graph, temporal)

#### 📊 System Management (11+ tools)
Storage backends, configuration, metrics, backup/restore, and health monitoring.

### SPARQL Store Independence

**Important**: Semem's SPARQL store can be populated and managed independently of Semem itself. You can:

- Use external tools to populate a SPARQL endpoint with RDF data
- Point Semem at an existing SPARQL store containing domain knowledge
- Apply Semem's analysis capabilities to any RDF dataset
- Combine Semem-generated knowledge graphs with external ontologies

This separation allows Semem to function as an analysis layer over existing semantic web infrastructure.

---

## Core Workflow Patterns

### Pattern 1: Document Analysis and Storage

**Workflow**: Document → Memory Storage → Concept Extraction → Knowledge Graph → Analysis

**Use When**: Processing research papers, reports, or documentation for future reference and analysis.

**Tools Chain**:
1. `semem_store_interaction` - Store document with embeddings
2. `semem_extract_concepts` - Extract key concepts  
3. `ragno_decompose_corpus` - Build knowledge graph
4. `ragno_analyze_graph` - Understand relationships

### Pattern 2: Knowledge Discovery and Exploration

**Workflow**: Query → Memory Search → Graph Navigation → Insight Generation

**Use When**: Exploring existing knowledge to find connections, patterns, or answer research questions.

**Tools Chain**:
1. `semem_retrieve_memories` - Find related content
2. `ragno_search_graph` - Graph-based search
3. `zpt_navigate` - 3D spatial exploration
4. `semem_generate_response` - Synthesize insights

### Pattern 3: Corpus Analysis and Visualization

**Workflow**: Text Corpus → Knowledge Graph → Community Detection → Navigation Interface

**Use When**: Analyzing large document collections to understand structure, themes, and relationships.

**Tools Chain**:
1. `ragno_decompose_corpus` - Process entire corpus
2. `ragno_aggregate_communities` - Find topical clusters
3. `zpt_analyze_corpus` - Prepare for navigation
4. `zpt_navigate` - Interactive exploration

---

## Memory Management Workflows

### Basic Memory Operations

#### Storing Information
Use `semem_store_interaction` to create searchable memories:
```
Store the conversation: "What are sustainable development principles?" 
Response: "Sustainable development balances economic growth with environmental protection..."
```

#### Semantic Search
Use `semem_retrieve_memories` for contextual retrieval:
```
Search for memories about "environmental sustainability" with threshold 0.7
```

#### Context-Aware Responses
Use `semem_generate_response` for intelligent replies:
```
Generate response to "How can cities become more sustainable?" using stored memories
```

### Research Document Workflow

**Use Case**: Academic researcher analyzing multiple papers

**Workflow Steps**:
1. **Batch Storage**: Store multiple research papers using `semem_store_interaction`
2. **Concept Mapping**: Extract concepts from each paper using `semem_extract_concepts`
3. **Cross-Reference**: Find related content using `semem_retrieve_memories`
4. **Synthesis**: Generate comprehensive analysis using `semem_generate_response`

**Benefits**:
- Automatic similarity detection between papers
- Concept-based organization of research
- Contextual synthesis of findings
- Persistent memory for long-term projects

### Educational Content Workflow

**Use Case**: Educator building curriculum connections

**Workflow Steps**:
1. **Content Storage**: Store educational materials and explanations
2. **Prerequisite Mapping**: Use memory search to find foundational concepts
3. **Progression Paths**: Identify learning sequences through concept relationships
4. **Adaptive Responses**: Generate explanations tailored to student level

---

## Knowledge Graph Construction Workflows

### Text to Knowledge Graph Pipeline

#### Single Document Processing
**Workflow**: Document → Entities → Relationships → RDF Graph

```
Use ragno_decompose_corpus with:
- Text: "Apple Inc. founded by Steve Jobs revolutionized computing with the iPhone"
- Options: extractRelationships=true, generateSummaries=true
```

**Results**:
- Entities: Apple Inc. (Organization), Steve Jobs (Person), iPhone (Product)
- Relationships: Steve Jobs → founded → Apple Inc., Apple Inc. → created → iPhone
- RDF triples stored in SPARQL endpoint

#### Multi-Document Corpus
**Workflow**: Document Collection → Unified Graph → Community Analysis

```
Process corpus with ragno_decompose_corpus:
- Multiple documents about technology companies
- Extract cross-document entity relationships
- Identify business ecosystem patterns
```

### Entity-Centric Analysis

#### Finding Key Entities
Use `ragno_get_entities` to discover important entities:
```
Retrieve entities with minimum frequency 3, type "Person", limit 50
```

#### Entity Relationship Mapping
Use `ragno_search_graph` for entity exploration:
```
Search for entities related to "artificial intelligence" with dual search
```

#### Graph Analytics
Use `ragno_analyze_graph` for comprehensive analysis:
```
Analyze graph with centrality, communities, and statistics
```

### SPARQL Integration Workflows

#### Direct SPARQL Queries
Use `ragno_query_sparql` for precise data extraction:
```
Query: "SELECT ?person ?company WHERE { ?person <founded> ?company }"
```

#### External Data Integration
**Workflow**: External SPARQL Store → Semem Analysis

1. **Populate External Store**: Use external tools to load domain ontologies or datasets
2. **Configure Semem**: Point storage backend to external SPARQL endpoint  
3. **Apply Analysis**: Use Ragno tools to analyze existing RDF data
4. **Enhance Data**: Add embeddings and semantic analysis to existing graphs

---

## 3D Navigation Workflows

### Understanding ZPT Navigation

ZPT treats knowledge as a 3-dimensional space you can explore cinematically:

#### Zoom Levels
- **Entity**: Focus on individual entities and their properties
- **Unit**: Balanced view of semantic units with related entities
- **Text**: Broader view including detailed textual content  
- **Community**: Topic-level clusters and domain overviews
- **Corpus**: Highest level patterns across entire knowledge base

#### Pan (Filtering)
- **Temporal**: Filter by time periods or chronological progression
- **Geographic**: Focus on location-specific content
- **Topical**: Filter by subject areas or themes
- **Entity-Based**: Focus on specific organizations, people, or concepts

#### Tilt (Representation)
- **Keywords**: Term-based representation (fastest)
- **Embedding**: Vector-based semantic similarity
- **Graph**: Relationship-based network representation
- **Temporal**: Time-based sequential representation

### Basic Navigation Patterns

#### Quick Entity Overview
```
Navigate "artificial intelligence" with:
- Zoom: entity
- Tilt: keywords  
- Limit: 2000 tokens
```

#### Relationship Exploration
```
Navigate "machine learning algorithms" with:
- Zoom: unit
- Tilt: graph
- Format: structured
```

#### Temporal Analysis
```
Navigate "climate change research" with:
- Zoom: community
- Tilt: temporal
- Pan: date range 2020-2024
```

### Advanced Navigation Workflows

#### Research Domain Exploration
**Use Case**: Understanding a new research field

**Workflow Steps**:
1. **Preview Scope**: Use `zpt_preview` to understand content availability
2. **Parameter Validation**: Use `zpt_validate_params` to verify navigation settings
3. **Navigate Overview**: Start with corpus-level zoom for field overview
4. **Drill Down**: Progressive zoom to entity level for specific topics
5. **Relationship Analysis**: Use graph tilt to understand connections

#### Content Discovery Pipeline
**Use Case**: Finding relevant information in large corpora

**Workflow Steps**:
1. **Corpus Analysis**: Use `zpt_analyze_corpus` to understand structure
2. **Options Discovery**: Use `zpt_get_options` to see available navigation paths
3. **Multi-Dimensional Search**: Combine temporal, geographic, and topical filters
4. **Interactive Exploration**: Use preview-then-navigate pattern for efficiency

---

## Integrated Multi-System Workflows

### Memory + Knowledge Graph Integration

**Workflow**: Document Storage → Graph Construction → Memory-Enhanced Queries

**Steps**:
1. **Store in Memory**: Use `semem_store_interaction` for semantic search capability
2. **Build Graph**: Use `ragno_decompose_corpus` for structured relationships
3. **Enhanced Search**: Use both `semem_retrieve_memories` and `ragno_search_graph`
4. **Synthesize**: Combine memory context with graph relationships for comprehensive analysis

**Benefits**:
- Memory provides semantic similarity and context
- Graph provides structured relationships and reasoning
- Combined approach offers both associative and logical reasoning

### ZPT + Knowledge Graph Exploration

**Workflow**: Graph Construction → Navigation Preparation → Interactive Exploration

**Steps**:
1. **Build Graph**: Create knowledge graph from corpus
2. **Analyze Structure**: Use `ragno_analyze_graph` to understand communities
3. **Prepare Navigation**: Use `zpt_analyze_corpus` for optimization
4. **Explore Spatially**: Use ZPT navigation for intuitive discovery

### Full Pipeline Integration

**Workflow**: Document → Memory → Graph → Navigation → Insights

**Example: Legal Document Analysis**

**Steps**:
1. **Memory Storage**: Store legal documents with metadata
2. **Entity Extraction**: Extract legal entities (cases, statutes, parties)
3. **Relationship Mapping**: Build citation and precedent relationships
4. **Spatial Analysis**: Navigate legal reasoning patterns
5. **Case Law Discovery**: Find relevant precedents through multi-system search

---

## SPARQL Store Integration

### External SPARQL Store Setup

Semem can work with any SPARQL-compatible endpoint:

#### Popular SPARQL Stores
- **Apache Jena Fuseki**: Full-featured, production-ready
- **Virtuoso**: High-performance commercial/open source
- **GraphDB**: Semantic database with reasoning
- **Blazegraph**: High-performance graph database

#### Configuration
Set storage backend to use external SPARQL endpoint:
```
Configure storage: backend="sparql", endpoint="https://your-sparql-store.com/query"
```

### External Data Workflows

#### Workflow 1: Analyze Existing Knowledge Base
**Scenario**: Company has existing RDF data in SPARQL store

**Steps**:
1. **Connect**: Point Semem at existing SPARQL endpoint
2. **Analyze**: Use `ragno_get_graph_stats` to understand existing data
3. **Enhance**: Add embeddings using `ragno_enrich_embeddings`  
4. **Navigate**: Use ZPT tools to explore existing knowledge spatially

#### Workflow 2: Enrich External Ontology
**Scenario**: Enhance domain ontology with new documents

**Steps**:
1. **Load External Data**: Import domain ontology into SPARQL store
2. **Process Documents**: Use Ragno tools to create entities from new content
3. **Link Data**: Connect new entities to existing ontology concepts
4. **Validate**: Use graph analytics to ensure consistency

#### Workflow 3: Multi-Source Integration
**Scenario**: Combine multiple knowledge sources

**Steps**:
1. **Establish Store**: Set up central SPARQL endpoint
2. **Load Sources**: Import data from multiple external sources
3. **Apply Semem**: Use entity extraction and relationship detection
4. **Resolve Conflicts**: Use confidence scoring and validation
5. **Navigate Result**: Explore integrated knowledge space

### Data Export and Backup

#### Export Workflows
Use `ragno_export_sparql` to create portable datasets:
```
Export format options:
- Turtle (.ttl) - Human-readable RDF
- N-Triples (.nt) - Machine-processable format
- JSON-LD - Web-compatible JSON format
- RDF/XML - Standard XML serialization
```

#### Backup Strategies
```
Memory backup: semem_backup_memory (JSON format with embeddings)
Graph backup: ragno_export_sparql (RDF format for SPARQL stores)
System backup: Complete configuration and data export
```

---

## Real-World Use Cases

### Academic Research Pipeline

**Scenario**: Researcher analyzing 50+ papers on renewable energy

**Workflow**:
1. **Batch Import**: Load papers into both memory and knowledge graph
2. **Concept Mapping**: Extract and connect technical concepts across papers
3. **Author Networks**: Build collaboration and citation relationships
4. **Trend Analysis**: Use temporal navigation to identify research progression
5. **Gap Analysis**: Find under-researched areas through graph analysis

**Tools Used**: 
- `ragno_decompose_corpus` for paper processing
- `ragno_aggregate_communities` for research area clustering
- `zpt_navigate` with temporal tilt for trend analysis
- `semem_generate_response` for synthesis

### Corporate Knowledge Management

**Scenario**: Fortune 500 company organizing internal documentation

**Workflow**:
1. **Document Import**: Process policies, procedures, and reports
2. **Department Mapping**: Extract organizational entities and relationships
3. **Expertise Location**: Connect people to topics through document authorship
4. **Compliance Tracking**: Use temporal analysis for policy evolution
5. **Decision Support**: Provide context-aware answers to employee questions

**Architecture**:
- External SPARQL store for persistent company knowledge
- Semem analysis layer for intelligent querying
- Multiple document ingestion pipelines
- Role-based access through API endpoints

### Legal Research System

**Scenario**: Law firm analyzing case precedents and legal relationships

**Workflow**:
1. **Case Database**: Import case law into SPARQL store with metadata
2. **Citation Analysis**: Extract and model legal citations as relationships
3. **Precedent Networks**: Build networks of legal precedent relationships
4. **Topic Evolution**: Track legal principle development over time
5. **Case Research**: Multi-dimensional search for relevant precedents

**Key Features**:
- Entity extraction for legal concepts (parties, statutes, principles)
- Temporal navigation for legal evolution analysis
- Graph analytics for influence and centrality analysis
- Memory system for contextual legal research

### Scientific Literature Analysis

**Scenario**: Medical researchers tracking COVID-19 research evolution

**Workflow**:
1. **Literature Ingestion**: Continuous import of research papers
2. **Methodology Tracking**: Extract and connect research methodologies
3. **Finding Networks**: Connect research findings and contradictions
4. **Geographic Analysis**: Map research activity by location
5. **Knowledge Synthesis**: Generate systematic reviews from graph analysis

**Advanced Features**:
- Real-time literature monitoring
- Contradiction detection through relationship analysis
- Geographic visualization of research activity
- Automated systematic review generation

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

Semem provides a comprehensive platform for intelligent knowledge management through its three integrated systems. The MCP interface makes these powerful capabilities accessible in any MCP-enabled environment, while the HTTP API endpoints provide programmatic access for custom applications.

### Key Success Patterns

1. **Start with Clear Goals**: Define what you want to achieve before choosing tools
2. **Use Appropriate Storage**: Match storage backend to your persistence needs
3. **Leverage Integration**: Combine memory, graphs, and navigation for comprehensive analysis
4. **Optimize Incrementally**: Start with default settings, then tune based on performance
5. **Monitor and Validate**: Use built-in metrics and validation tools

### Next Steps

- **Experiment** with different workflow patterns in your domain
- **Integrate External Data** using SPARQL store capabilities  
- **Build Custom Workflows** combining multiple systems
- **Optimize Performance** using monitoring and tuning tools
- **Contribute** improvements and share use cases with the community

Semem transforms individual AI capabilities into a unified platform for intelligent knowledge processing, analysis, and discovery. Through thoughtful workflow design and proper configuration, it enables sophisticated research and analysis capabilities that adapt to your specific needs and domains.

---

*For detailed API reference and additional resources, visit the [Semem documentation](../README.md) and explore the comprehensive [HTTP API endpoints](./http-api-endpoints.md) for programmatic access.*